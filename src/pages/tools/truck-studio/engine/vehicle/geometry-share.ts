/* POSSE DE GEOMETRIA — clone-na-escrita para malhas que compartilham uma
   `BufferGeometry`.
   ===========================================================================

   O PROBLEMA, E POR QUE ELE NÃO EXISTIA ATÉ AGORA
   ---------------------------------------------------------------------------
   O `trailer.glb` tem 2 157 primitivas para **855 formas distintas** — 1 302
   delas (60 %) são cópias byte a byte de uma carga Draco que já está no
   arquivo. Isso é medido, e a ferramenta é
   `node tools/studio-bench/glbstat.mjs --cargas public/models/vehicles/trailer.glb`.

   Hoje elas custam caro à toa: a chave de cache de primitiva do `GLTFLoader` é
   o **índice** do bufferView (`'draco:' + ext.bufferView + …`), e o arquivo
   gasta 2 157 índices distintos apontando para só 855 faixas de bytes. Logo o
   three decodifica 2 157 vezes e sobe 2 157 buffers de vértice — 165,6 MB de
   geometria descomprimida — para desenhar 855 formas, que caberiam em 73,0 MB.

   `tools/studio-assets/dedup-cargas.mjs` conserta isso no ARQUIVO, repontando
   as cópias para o mesmo bufferView sem descomprimir nada. Aí o `GLTFLoader`
   passa a entregar **UMA `BufferGeometry` compartilhada por até 104 malhas** —
   que é o ganho (−92,7 MB, −1 302 decodificações) e é também o perigo, porque
   este motor ESCREVE dentro da geometria carregada, por malha:

     · `trailer-assembly.ts` `resize()` — lê `piece.base` (a cópia pristina),
       aplica a `matrixWorld` DAQUELA malha, deforma e escreve de volta com
       `pos.setXYZ(...)`. Duas malhas na mesma geometria têm matrizes de mundo
       diferentes; a segunda escrita sobrescreveria a primeira e as duas
       renderizariam a deformação de uma só.
     · o mesmo laço, no ramo `part.repeated`: a casca original é COLAPSADA num
       ponto para dar lugar ao `InstancedMesh`. Compartilhada com uma peça que
       NÃO virou conjunto, a peça inteira sumiria — e este é o pior dos dois,
       porque o defeito é uma ausência e ausência não chama atenção.
     · `trailer-bake-fixes.ts` `editVerts()` — mesma escrita, mesmo risco.

   A ORIGINAL COMPARTILHADA NUNCA É ESCRITA — e isto foi APRENDIDO NUM PORTÃO,
   não deduzido
   ---------------------------------------------------------------------------
   A primeira versão deste módulo era mais esperta e estava errada. Ela dava a
   original à PRIMEIRA malha que escrevesse ("posse na primeira escrita") e
   clonava só para as seguintes, com o argumento de que assim se faz o mínimo de
   clones. `tools/studio-bench/checks-geometria-partilhada.mjs` reprovou:

       ✗ REPROVADO — 12 diferenças.
         3.92 mm  …/stitch_result_stitch_all_parafusos_0_413
         3.92 mm  …/stitch_result_stitch_all_parafusos_0_414          (e mais 10)

   O erro é de ORDEM, e é sutil o bastante para merecer o parágrafo: quem clona
   por último clona de uma geometria que o primeiro JÁ MODIFICOU. Em
   `trailer-bake-fixes.ts` isso é literal — a malha B varre `mesh.geometry`
   procurando os vértices a mover, e o que ela lê já traz a correção que a malha
   A escreveu ali. O clone sai contaminado, e o defeito aparece como uma peça
   3,92 mm fora do lugar: exatamente a magnitude de uma correção de bake.

   Então a regra é a que `models.ts:3357` (`geomUsers`) já usava, e ela é a certa
   pelo motivo que agora está medido: **enquanto mais de uma malha apontar para
   uma geometria, ela é um MOLDE — ninguém escreve nela.** Quem for escrever tira
   uma cópia própria, sempre, e o molde permanece pristino para os irmãs que
   ainda vão tirar a delas.

   O QUE ISSO CUSTA, dito por inteiro: uma família de 104 malhas em que TODAS
   escrevem termina com 104 cópias — o mesmo que hoje, mais o molde. É por isso
   que o módulo conta quantas malhas ainda apontam para o molde e **descarta o
   molde quando a última sai**: aí o saldo volta a ser exatamente 104 e não 105.

   E a propriedade que faz o negócio valer: **quem nunca escreve nunca clona.**
   Uma geometria compartilhada por 104 malhas que ninguém deforma continua uma
   só, para sempre. Medido na bancada, com o acervo deduplicado: 2 265 malhas em
   **932 geometrias** logo depois da carga, contra 2 234 no acervo cru. O ganho
   só é devolvido na medida exata em que um redimensionamento precisa dele.

   ⚠️ O CLONE É CARO E É INTERCALADO. Os atributos deste GLB são
   `InterleavedBufferAttribute` — posição, normal e UV no MESMO buffer. Um
   `geometry.clone()` copia esse buffer inteiro. É por isso que a posse importa:
   cada clone evitado é o buffer inteiro de uma peça. `BufferGeometry.copy()`
   trata o caso corretamente (ele passa um mapa `data` a cada
   `attribute.clone(data)`, então o buffer intercalado é copiado UMA vez e
   compartilhado entre os atributos do clone, e não uma vez por atributo).

   ⚠️ ISTO NÃO SUBSTITUI A FUSÃO, E NÃO CONFLITA COM ELA. `vehicle/merge.ts`
   esconde as origens e chama `geometry.dispose()` nelas (só o lado GPU; os
   `TypedArray` da CPU ficam). `releaseMerge()` devolve `.visible` e o three
   re-sobe na próxima vez que a malha for desenhada — as origens continuam com a
   MESMA instância de `BufferGeometry`. Como `setTrailerDims()` solta a fusão na
   primeira linha e a refaz na última, todas as escrituras deste arquivo
   acontecem com a fusão SOLTA, e trocar `mesh.geometry` nesse intervalo é
   invisível para `merge.ts`, que guarda MALHAS (`Balde.fontes`) e relê
   `o.geometry` na hora de assar.

   ⚠️ NÃO HÁ VAZAMENTO. A geometria original nunca fica sem dono: quem a clonou
   foi um SEGUNDO escritor, e o primeiro continua usando-a. Por isso este módulo
   nunca chama `dispose()` — descartar a original apagaria o buffer de quem
   ficou com ela. */

import * as THREE from 'three';

/* Quantas malhas ainda apontam para cada MOLDE — as geometrias que nasceram
   compartilhadas. Uma geometria fora deste mapa é privada de uma malha só e
   pode ser escrita direto.

   `WeakMap` e não `userData`: a chave é a geometria, o valor não deve sobreviver
   a ela, e `userData` de uma geometria compartilhada é, ele próprio,
   compartilhado — guardar posse ali seria guardar o dado no lugar exato em que
   o problema mora. */
const restantes = new WeakMap<THREE.BufferGeometry, number>();

let clonesFeitos = 0;
let escritasDiretas = 0;
let moldesDescartados = 0;

/**
 * Devolve uma `BufferGeometry` que **esta** malha pode escrever à vontade,
 * clonando-a antes se outra malha já tiver reivindicado a original.
 *
 * Chame ANTES de qualquer `pos.setXYZ()`, `setAttribute()` ou `setIndex()` numa
 * geometria que veio do arquivo, e use o retorno — não `mesh.geometry`, que
 * pode ter acabado de ser trocado por este chamada.
 *
 * ```ts
 * const geo = claimGeometry(piece.mesh);
 * const pos = geo.getAttribute('position') as THREE.BufferAttribute;
 * pos.setXYZ(i, x, y, z);
 * pos.needsUpdate = true;
 * ```
 *
 * É idempotente por malha: chamar duas vezes para a mesma malha devolve a mesma
 * geometria sem clonar de novo. Por isso pode ficar dentro de um laço quente
 * sem cerimônia — o custo é uma consulta de `WeakMap`.
 *
 * ⚠️ **Os índices de vértice sobrevivem ao clone**, e é disso que dependem
 * `piece.base` e `part.idx` em `trailer-assembly.ts`: o clone tem exatamente os
 * mesmos vértices na mesma ordem, então um instantâneo tirado antes continua
 * casando depois. Se algum dia alguém REORDENAR vértices aqui, esses dois
 * instantâneos passam a mentir.
 */
export function claimGeometry(mesh: THREE.Mesh): THREE.BufferGeometry {
  const g0 = mesh.geometry;
  const n = restantes.get(g0);
  /* Não é molde: ou nunca foi compartilhada, ou já é a cópia privada desta
     malha. Nos dois casos escrever direto é o certo — e é o caminho quente,
     porque a maioria das malhas do implemento tem geometria só sua. */
  if (n === undefined) { escritasDiretas++; return g0; }

  const g = g0.clone();
  mesh.geometry = g;
  clonesFeitos++;

  /* Uma malha a menos apontando para o molde. Quando a última sai, o molde não
     é referenciado por ninguém e o lado GPU dele pode ir embora — sem isto, uma
     família em que todas as malhas escrevem terminaria com 105 buffers em vez
     de 104, e o `dispose()` seria impossível de fazer depois (não há quem
     saiba que ninguém mais aponta). Os `TypedArray` da CPU o `GC` recolhe. */
  const sobra = n - 1;
  if (sobra <= 0) { restantes.delete(g0); g0.dispose(); moldesDescartados++; }
  else restantes.set(g0, sobra);
  return g;
}

/**
 * Marca as geometrias de `root` que nascem COMPARTILHADAS, contando quantas
 * malhas apontam para cada uma.
 *
 * Tem de rodar UMA vez, logo depois da carga e **antes de qualquer escrita** —
 * é o que separa "molde, ninguém escreve" de "privada, escreva à vontade". Sem
 * ela `claimGeometry()` trata tudo como privada e o compartilhamento vira
 * corrupção silenciosa; com ela rodando tarde demais, uma geometria já
 * modificada viraria molde e a modificação vazaria para as irmãs.
 *
 * É idempotente: recontar do zero dá o mesmo resultado, e as cópias privadas já
 * criadas ficam com contagem 1 e portanto fora do mapa.
 *
 * @returns quantas malhas compartilham alguma geometria.
 */
export function markShared(root: THREE.Object3D): number {
  const uso = new Map<THREE.BufferGeometry, number>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    uso.set(m.geometry, (uso.get(m.geometry) || 0) + 1);
  });
  let compartilhadas = 0;
  for (const [g, n] of uso) {
    if (n > 1) { restantes.set(g, n); compartilhadas += n; }
    else restantes.delete(g);
  }
  return compartilhadas;
}

/**
 * Quantas malhas de `root` compartilham uma geometria com outra — o número que
 * diz se o acervo publicado é o deduplicado ou o cru.
 *
 * Não escreve nada; é diagnóstico, e é o que a bancada publica para o portão
 * saber com qual arquivo está falando.
 */
export function shareStats(root: THREE.Object3D): {
  malhas: number; geometrias: number; compartilhadas: number; maiorFamilia: number;
} {
  const uso = new Map<THREE.BufferGeometry, number>();
  let malhas = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    malhas++;
    uso.set(m.geometry, (uso.get(m.geometry) || 0) + 1);
  });
  let compartilhadas = 0; let maiorFamilia = 0;
  for (const n of uso.values()) {
    if (n > 1) compartilhadas += n;
    if (n > maiorFamilia) maiorFamilia = n;
  }
  return { malhas, geometrias: uso.size, compartilhadas, maiorFamilia };
}

/** Contadores desde o início da sessão. Para a bancada e para o console. */
export function claimStats(): { clones: number; direto: number; moldesDescartados: number } {
  return { clones: clonesFeitos, direto: escritasDiretas, moldesDescartados };
}
