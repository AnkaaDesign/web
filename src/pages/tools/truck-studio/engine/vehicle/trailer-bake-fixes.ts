/* Correções aplicadas ao BAKE, antes de qualquer coisa medi-lo.
   ===========================================================================
   Nem tudo que está errado no implemento é erro do paramétrico. Três coisas do
   `trailer.glb` chegam erradas, e nas três o defeito é do próprio arquivo: a
   testeira tem um recorte largo demais no frame de cima, a ferragem que segura
   a porta traseira na lateral está um friso abaixo do que a fábrica monta
   (Kennedy apontou as duas com print em 2026-08-11), e a caixa de cozinha veio
   com a plaqueta da marca do fabricante DELA gravada na folha (2026-08-12).

   POR QUE AQUI, E NÃO NUMA CAMADA ACIMA. `TrailerAssembly` guarda uma cópia
   (`piece.base`) das posições de cada malha no construtor e REESCREVE o
   atributo a partir dela em todo `set()`. Uma correção aplicada depois disso
   dura até o primeiro redimensionamento e some sem deixar rastro — o defeito
   volta quando o usuário arrasta o slider. Então estas rotinas rodam entre
   `TrailerBody` (que é quem MEDE a grade do friso) e `TrailerAssembly` (que é
   quem congela a base), e a partir dali o modelo corrigido é o único que
   existe: o conjunto, o recorte das chapas, o snapshot do editor e o engate
   leem todos a mesma geometria.

   O QUE ELAS NÃO FAZEM: inventar peça. Duas só movem vértices que já existem e
   a terceira só tira do grafo uma peça que existe — nenhuma acrescenta
   geometria. E as três RECUSAM o serviço quando a medida não confere: um bake
   diferente sai intocado e com um aviso no console, em vez de sair deformado
   (ou mutilado) em silêncio. */
import * as THREE from 'three';
import { RIB_FLAT_CENTER } from './trailer-geometry';
import { claimGeometry } from './geometry-share';

/** Galvanizado do frame — o mesmo material do trilho da saia, então a peça é
 *  escolhida pela REGIÃO (testeira, no alto), nunca só pelo material. */
const HEADER_MAT_RE = /metal-galvanizado-mantido/i;
/** O frame da testeira encosta na parede dianteira dentro desta distância. */
const HEADER_FRONT = 0.10;
/** …e vive inteiro nesta faixa abaixo do teto. O trilho da saia (mesmo
 *  material, y do piso) cai fora por este teste, e é para isso que ele serve. */
const HEADER_TOP = 0.40;
/** A ponta dobrada da extrusão tem duas paredes a poucos milímetros — as duas
 *  andam juntas, senão a dobra estica em vez de andar. */
const HEADER_LIP = 0.010;
/** Trecho reto mínimo entre a ponta de dentro e a coluna seguinte. Abaixo
 *  disto não há extrusão para esticar e a correção se recusa. */
const HEADER_RUN = 0.050;
/** Uma ponta já a menos disto da linha de centro não tem recorte nenhum. */
const HEADER_DONE = 0.050;

/** A caixa de cozinha, pelos dois nós que o bake dá a ela. É cópia do
 *  `TRAILER_BOX_NODE_RE` de `models.ts` — e é cópia porque importá-lo fecharia
 *  um ciclo (models → trailer-rig → este arquivo). Se um dia o bake renomear a
 *  caixa, os dois mudam juntos. */
const BOX_NODE_RE = /caixa-ferrmantas|caixa-plastico-ferramentas/i;
/** Espessura máxima da plaqueta: ela é uma chapa aplicada, não uma peça. */
const PLATE_MAX_THICK = 0.002;
/** …e a maior aresta dela. A folha da caixa tem 1 030 mm e cai fora por aqui. */
const PLATE_MAX_SIDE = 0.30;
/** O DISCRIMINANTE: uma chapa lisa de 200 × 50 mm são 12 triângulos. */
const PLATE_MIN_TRIS = 1000;

/** A trava (`engate-femea`), o corpo dela e a borracha de batente da porta. */
const CATCH_MAT_RE = /engate-femea|metal-pouco-polido|borracha-preta/i;
/** Ferragem de porta é peça pequena; o corrido de vedação da traseira mede
 *  2,53 m e é justamente o que este teto mantém de fora. */
const CATCH_MAX_SIZE = 0.12;
/** Faixa em que o centro da peça tem de estar, medida do piso. */
const CATCH_LO = 0.10;
const CATCH_HI = 0.35;
/** Ela é aparafusada POR FORA da crista da lateral — é o que a separa de
 *  qualquer coisa embutida na chapa. */
const CATCH_INSET = 0.010;
const CATCH_PROUD = 0.010;

export interface BakeFixRefs {
  floorY: number;
  roofY: number;
  z0: number;
  z1: number;
  halfWidth: number;
  /** A grade do friso, medida por `TrailerBody`. Sem ela a ferragem não tem
   *  régua e a correção não roda — ver `raiseDoorCatches`. */
  vale: { row0: number; pitch: number; valeH: number } | null;
}

/**
 * Percorre os vértices de uma malha no referencial da RAIZ do implemento.
 *
 * O ida-e-volta pela matriz não é cerimônia: as malhas deste GLB vêm em
 * centímetros, algumas espelhadas em X, e os limiares contra os quais elas
 * são comparadas (`z1`, `floorY`, a grade do friso) vivem na raiz. Comparar
 * coordenada local com limiar de raiz é o erro que já custou uma sessão
 * inteira neste engine (ver a nota de `rigMatrixOf` em trailer-rig.ts).
 *
 * `fn` recebe o vértice na raiz e devolve `true` se o mudou. Nada é escrito
 * antes de a varredura inteira terminar — uma correção que desiste no meio
 * não pode deixar meia malha movida.
 */
function editVerts(
  mesh: THREE.Mesh, toLocal: THREE.Matrix4,
  fn: (v: THREE.Vector3, i: number) => boolean,
): number {
  const leitura = mesh.geometry as THREE.BufferGeometry;
  const pos = leitura.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos) return 0;
  const m4 = new THREE.Matrix4().multiplyMatrices(toLocal, mesh.matrixWorld);
  const inv = m4.clone().invert();
  const v = new THREE.Vector3();
  const moved: { i: number; x: number; y: number; z: number }[] = [];
  for (let i = 0; i < pos.count; i++) {
    /* Pela API do atributo, NUNCA por `pos.array`: os atributos deste GLB são
       INTERLEAVED e o array cru é posição + normal + UV juntos. */
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m4);
    if (!fn(v, i)) continue;
    v.applyMatrix4(inv);
    moved.push({ i, x: v.x, y: v.y, z: v.z });
  }
  if (!moved.length) return 0;

  /* ⚠️ CLONE-NA-ESCRITA, E SÓ AGORA — depois de a varredura ter decidido que há
     algo a mover. Com o acervo deduplicado esta geometria pode ser a MESMA de
     dezenas de outras malhas, e uma correção de bake é, por definição,
     específica de UMA peça: sem a posse, corrigir a testeira moveria os
     vértices correspondentes de todas as irmãs que dividem a forma.

     A posição da chamada é o ponto. Reivindicar no TOPO da função clonaria
     também para as malhas em que `fn` não casa com vértice nenhum — e a
     esmagadora maioria das chamadas é assim, porque estas correções varrem o
     implemento inteiro procurando meia dúzia de peças. O `if` acima é a mesma
     porta que já garantia "uma correção que desiste no meio não deixa meia
     malha movida"; ela agora também garante "não clona à toa".

     Ver `vehicle/geometry-share.ts`. */
  const geo = claimGeometry(mesh);
  const escrita = geo === leitura ? pos
    : geo.getAttribute('position') as THREE.BufferAttribute;
  for (const m of moved) escrita.setXYZ(m.i, m.x, m.y, m.z);
  escrita.needsUpdate = true;
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return moved.length;
}

/**
 * Leva uma cota de MUNDO para o referencial da RAIZ do implemento.
 *
 * ⚠️ ELA EXISTE PORQUE HÁ DUAS RÉGUAS NESTE ARQUIVO, e a fronteira entre as
 * duas é invisível: `TrailerBody` mede em espaço de MUNDO (`collect()` aplica
 * `matrixWorld` a cada vértice), e tudo aqui mede no espaço da RAIZ
 * (`toLocal · matrixWorld` — ver a nota de `editVerts`). Quem atravessa a
 * fronteira são justamente os números soltos que o rig passa adiante:
 * `floorY`, `roofY`, `z0`, `z1`, `vale.row0`.
 *
 * A diferença é a translação que `groundAndCenter()` escreve em
 * `root.position`. Medida no app (`tools/studio-bench/checks-referencial-0820.mjs`,
 * via `state.trailerBase.pos`): **+20 mm no semirreboque e −1 mm no
 * sobrechassi**. Pequena, e por isso sobreviveu — mas ela é POR IMPLEMENTO, e
 * uma correção que a ignore erra de um jeito que não aparece no outro bake.
 *
 * ⚠️ E ela NÃO é aplicada em `raiseDoorCatches()`, de propósito: a régua da
 * ferragem da porta (`RIB_FLAT_CENTER = 46,7`) foi CALIBRADA EM FOTO no
 * semirreboque com estes 20 mm dentro, e tirá-los agora moveria uma peça
 * aprovada. Ver a nota de `measureValeRows()` em `vehicle/models.ts`, onde o
 * mesmo par de erros se cancelava.
 */
function cotaNaRaiz(root: THREE.Object3D, y: number): number {
  const t = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const e = new THREE.Vector3();
  root.matrixWorld.decompose(t, q, e);
  /* Uma raiz girada faz de "floorY" um número sem eixo, e aí não há conversão
     que valha — melhor devolver o que veio e dizer que não se sabe. Hoje toda
     raiz que chega aqui só translada (`buildTrailerRig()` roda antes de
     `placeTrailer()`, e `setTrailerDims()` zera a rotação antes de remedir). */
  if (Math.abs(q.x) + Math.abs(q.y) + Math.abs(q.z) > 1e-6
    || Math.abs(e.y - 1) > 1e-6) {
    console.warn('[bake] a raiz do implemento não está só transladada —',
      'as réguas de mundo entram sem conversão.');
    return y;
  }
  return y - t.y;
}

/** A caixa de uma malha no referencial da raiz, POR VÉRTICE. `Box3.setFromObject`
 *  daria a caixa de uma caixa girada — estritamente maior, e estas decisões são
 *  de milímetros. */
function boxOf(mesh: THREE.Mesh, toLocal: THREE.Matrix4): THREE.Box3 | null {
  const pos = (mesh.geometry as THREE.BufferGeometry)
    .getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos) return null;
  const m4 = new THREE.Matrix4().multiplyMatrices(toLocal, mesh.matrixWorld);
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    b.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m4));
  }
  return b;
}

function matsOf(mesh: THREE.Mesh): string {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return mats.map((m) => (m && m.name) || '').join('+');
}

/**
 * ITEM 1 — o frame galvanizado da testeira, esticado até atrás do Thermo King.
 *
 * O QUE FOI MEDIDO (sondas `checks-frente-*.mjs`, 2026-08-11, baú de fábrica)
 * ---------------------------------------------------------------------------
 * A peça é UMA malha (`stitch_result_…_0_5`, material galvanizado) e tem
 * exatamente QUATRO colunas de |x| — 1043 · 1046 · 1243 · 1247 — ou seja, é
 * uma extrusão pura em X, sem um único vértice intermediário:
 *
 *   · |x| 1243/1247 → y 3961…4171   (o perfil INTEIRO, com a tira de cima)
 *   · |x| 1043/1046 → y 3961…4091   (só a banda de baixo, e é a ponta dela)
 *
 * Traduzindo: a tira de cima (y 4095…4171) atravessa o baú de ponta a ponta,
 * e a banda de baixo (y 3961…4095) só existe nos 200 mm de cada canto. O
 * Thermo King vai até |x| 998, então sobra uma tira BRANCA de 45 mm entre a
 * unidade e a banda — é o "espaço onde vai o Thermo King" do relato, e ela
 * aparece no print como uma listra clara ao lado da carenagem.
 *
 * A CORREÇÃO É EXATA, e é por isso que ela é esta. Esticar uma extrusão ao
 * longo do próprio eixo não deforma nada quando não há vértice no meio do
 * trecho: mover o par da ponta de dentro (1043/1046) para a linha de centro
 * alonga a banda e reproduz a seção idêntica em cada milímetro novo. As duas
 * pontas encostam em x = 0 num topo a topo — nada se sobrepõe.
 *
 * POR QUE ATÉ O CENTRO, e não só até a borda da unidade. Porque a borda da
 * unidade NÃO É UM NÚMERO FIXO: `placeThermoKing()` escala o `thermoking.glb`
 * para caber na parede (`tk.scale.multiplyScalar(s)`), e a carenagem ainda
 * afina no canto de cima — medido, a meia-largura dela cai de 995 mm em
 * y 4040 para 948 em y 4090, que é dentro da faixa da banda. Uma ponta parada
 * em 998 deixaria branco aparecendo no canto arredondado hoje, e deixaria
 * aparecer em qualquer altura de baú amanhã. Cheia, não tem como sobrar
 * branco — e é o que a peça real é: um cabeçalho corrido de canto a canto.
 *
 * O que fica ESCONDIDO não custa: a banda nova mora inteira atrás da unidade
 * (frente dela em z 7237, costas da carenagem em 7233), então ela só aparece
 * justamente nos 45 mm que hoje são brancos.
 */
function stretchFrontHeader(
  root: THREE.Object3D, toLocal: THREE.Matrix4, ref: BakeFixRefs,
): string {
  let found: THREE.Mesh | null = null;
  let bestN = -1;
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !HEADER_MAT_RE.test(matsOf(mesh))) return;
    const box = boxOf(mesh, toLocal);
    if (!box) return;
    if (box.max.z < ref.z1 - HEADER_FRONT) return;          // não é da testeira
    if (box.min.y < ref.roofY - HEADER_TOP) return;          // é o trilho da saia
    if (box.min.x > -0.5 || box.max.x < 0.5) return;         // não atravessa o baú
    const n = (mesh.geometry as THREE.BufferGeometry).getAttribute('position').count;
    if (n > bestN) { bestN = n; found = mesh; }
  });
  if (!found) return 'frame da testeira: não encontrado';
  const mesh: THREE.Mesh = found;

  /* As colunas de |x| de cada lado, e a ponta de dentro de cada uma. */
  const side: Record<'L' | 'R', { inner: number; next: number }> = {
    L: { inner: Infinity, next: Infinity }, R: { inner: Infinity, next: Infinity },
  };
  const xs: Record<'L' | 'R', number[]> = { L: [], R: [] };
  editVerts(mesh, toLocal, (v) => {
    xs[v.x < 0 ? 'L' : 'R'].push(Math.abs(v.x));
    return false;                                   // varredura seca: só mede
  });
  for (const k of ['L', 'R'] as const) {
    if (!xs[k].length) return `frame da testeira: lado ${k} vazio`;
    xs[k].sort((a, b) => a - b);
    side[k].inner = xs[k][0];
    side[k].next = xs[k].find((x) => x > side[k].inner + HEADER_LIP) ?? Infinity;
  }

  /* As três recusas. Elas são a diferença entre corrigir e deformar: um bake
     sem recorte, ou com a banda tesselada no meio, sai INTOCADO. */
  const inner = Math.max(side.L.inner, side.R.inner);
  if (inner <= HEADER_DONE) return `frame da testeira: já é corrido (ponta em ${(inner * 1000) | 0} mm)`;
  for (const k of ['L', 'R'] as const) {
    if (!isFinite(side[k].next)) return `frame da testeira: lado ${k} tem uma coluna só`;
    if (side[k].next - side[k].inner < HEADER_RUN) {
      return `frame da testeira: lado ${k} sem trecho reto para esticar`
        + ` (${((side[k].next - side[k].inner) * 1000) | 0} mm)`;
    }
  }

  /* E o corte: só a ponta de dentro anda, e ela anda INTEIRA (as duas paredes
     da dobra). Tudo que está além do trecho reto fica exatamente onde estava —
     é o canto soldado, e ele não é para esticar. */
  const moved = editVerts(mesh, toLocal, (v) => {
    const k = v.x < 0 ? 'L' : 'R';
    if (Math.abs(v.x) > side[k].inner + HEADER_LIP) return false;
    v.x = Math.sign(v.x) * (Math.abs(v.x) - side[k].inner);
    return true;
  });
  return `frame da testeira: ${moved} vértices · ponta de dentro`
    + ` ${(side.L.inner * 1000).toFixed(0)}/${(side.R.inner * 1000).toFixed(0)} → 0 mm`;
}

/**
 * ITEM 2 — a trava e a borracha da porta traseira, um friso acima.
 *
 * O QUE FOI MEDIDO (sonda `checks-frente-travas-chapas.mjs`, 2026-08-11)
 * ---------------------------------------------------------------------------
 * A grade do friso do bake nasce em +175 mm do piso e marcha de 53 em 53 mm.
 * A ferragem são seis cascas, três por lado:
 *
 *     Borrachas_protefe_porta_laterais  y 171…199   (28 mm — UMA faixa lisa)
 *     mesh_826 / mesh_827 (+ _1)        y 140…219   (79 mm — a trava)
 *
 * QUEM DÁ O ZERO É A BORRACHA, não a trava. Ela mede uma faixa lisa cravada,
 * então "centrada" tem um significado exato para ela e nenhum para a trava,
 * que tem 79 mm e atravessa friso e lisa de qualquer jeito. As duas andam pelo
 * MESMO delta — são uma montagem só, e centrar cada uma no seu centro as
 * separaria 5 mm uma da outra sem nenhum ganho visível.
 *
 * A RÉGUA É `RIB_FLAT_CENTER`, E ISSO É O CONSERTO DE 2026-08-12.
 * A primeira rodada mirou em `valeInfo.row0 + valeH / 2` — parecia a definição
 * de "centro do rebaixo" e não é: `valeInfo` diz onde `findRows()` MARCA a
 * fileira (o começo da unidade ladrilhada), não o meio da faixa lisa. A conta
 * dava 33 mm a mais e punha a peça EM CIMA DA CRISTA; o print seguinte do
 * Kennedy — "não está bem no centro como pedi" — mostra a borracha a cavalo do
 * friso, e a medição do próprio quadro (perfil de brilho da chapa: lisas em
 * 186…210, 238…264, 294…320 px; borracha em 219…246) confirma ~18 mm alta.
 *
 * A régua CERTA já estava no repositório e já tinha sido aprovada em foto: é a
 * mesma que `models.measureValeRows()` usa para a coluna de rebites da emenda,
 * `row0 + RIB_FLAT_CENTER + n · pitch`. Com ela as faixas ficam em
 * +168,7 (n = −1, logo acima do trilho) · +221,7 (n = 0) · +274,7 mm do piso.
 * A borracha de fábrica (centro +185) mora na PRIMEIRA; o pedido é a SEGUNDA,
 * n = 0, +221,7 mm — e agora ferragem e rebites assentam no mesmo plano.
 */
function raiseDoorCatches(
  root: THREE.Object3D, toLocal: THREE.Matrix4, ref: BakeFixRefs,
): string {
  const vale = ref.vale;
  if (!vale) return 'ferragem da porta: bake sem grade de friso';
  /* A SEGUNDA faixa lisa. A primeira é `n = −1` (a que fica logo acima do
     trilho); a segunda é `n = 0`, ou seja o próprio passo da grade. */
  const band = (n: number) => vale.row0 + RIB_FLAT_CENTER + n * vale.pitch;
  const target = band(0);

  const picked: { mesh: THREE.Mesh; box: THREE.Box3 }[] = [];
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !CATCH_MAT_RE.test(matsOf(mesh))) return;
    const box = boxOf(mesh, toLocal);
    if (!box) return;
    const size = box.getSize(new THREE.Vector3());
    if (Math.max(size.x, size.y, size.z) > CATCH_MAX_SIZE) return;
    const cy = (box.min.y + box.max.y) / 2 - ref.floorY;
    if (cy < CATCH_LO || cy > CATCH_HI) return;
    /* Por FORA da crista da lateral, e nas duas bordas: peça embutida na chapa
       tem a borda de dentro para lá da crista e cai fora por aqui. */
    const inX = Math.min(Math.abs(box.min.x), Math.abs(box.max.x));
    const outX = Math.max(Math.abs(box.min.x), Math.abs(box.max.x));
    if (inX < ref.halfWidth - CATCH_INSET || outX < ref.halfWidth + CATCH_PROUD) return;
    /* A trava da porta traseira mora na metade de trás — sempre. */
    if ((box.min.z + box.max.z) / 2 > (ref.z0 + ref.z1) / 2) return;
    picked.push({ mesh, box });
  });
  if (!picked.length) return 'ferragem da porta: nenhuma peça reconhecida';

  /* A borracha é a mais BAIXA das cascas — a que mede um rebaixo. */
  const pad = picked.reduce((a, b) =>
    (b.box.max.y - b.box.min.y) < (a.box.max.y - a.box.min.y) ? b : a);
  const padCy = (pad.box.min.y + pad.box.max.y) / 2;
  /* RECUSA se a peça de fábrica não estiver na PRIMEIRA faixa. O pedido é
     "sobe uma casa"; num bake que já viesse noutra altura, subir para `n = 0`
     seria mover uma peça que ninguém mediu. Meia faixa de tolerância. */
  if (Math.abs(padCy - band(-1)) > vale.pitch / 2) {
    return `ferragem da porta: RECUSADA — de fábrica em`
      + ` ${((padCy - ref.floorY) * 1000) | 0} mm, fora da 1ª faixa lisa`
      + ` (${((band(-1) - ref.floorY) * 1000) | 0} mm)`;
  }
  const dy = target - padCy;
  if (Math.abs(dy) <= 0.001) {
    return `ferragem da porta: já está em ${((padCy - ref.floorY) * 1000) | 0} mm — nada a fazer`;
  }

  /* Geometria COMPARTILHADA anda uma vez só. Os dois lados deste bake são
     malhas espelhadas, e um `+dy` aplicado duas vezes ao mesmo buffer subiria
     a peça o dobro num deles. (O espelho é em X: o mesmo delta local vale
     para os dois.) */
  const done = new Set<THREE.BufferGeometry>();
  let moved = 0;
  for (const p of picked) {
    /* Presa ao PISO, e não à altura do baú: a régua dela agora é a grade do
       friso, que nasce em `floorY + skirtHeight` e marcha de passo fixo. Sem
       esta marca a peça sai da faixa de `LOW_FRAME_TOP` (o topo dela passa de
       +250 mm ao subir) e cairia na regra proporcional — descendo ~50 mm num
       baú de 2,2 m e saindo justamente do friso em que o cliente a pediu. */
    p.mesh.userData.tsFloorAnchored = true;
    const geo = p.mesh.geometry as THREE.BufferGeometry;
    if (done.has(geo)) continue;
    done.add(geo);
    moved += editVerts(p.mesh, toLocal, (v) => { v.y += dy; return true; });
  }
  return `ferragem da porta: ${picked.length} peças (${done.size} malhas, ${moved} vértices)`
    + ` · ${dy > 0 ? '+' : ''}${(dy * 1000).toFixed(0)} mm → 2ª faixa lisa,`
    + ` ${((target - ref.floorY) * 1000).toFixed(1)} mm do piso`;
}

/** Casa o nó ou qualquer ancestral dele, parando na raiz do implemento. */
function underNode(o: THREE.Object3D, root: THREE.Object3D, re: RegExp): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    if (re.test(n.name || '')) return true;
    if (n === root) break;
  }
  return false;
}

/**
 * ITEM 3 — a plaqueta da marca do fabricante da caixa de cozinha, fora.
 *
 * Pedido de produto (2026-08-12): "remova a plaquinha que seria resfriar". A
 * caixa é a Cozinha Resfri Ar de catálogo e o bake veio com o logotipo dela
 * gravado numa chapa aplicada à folha — marca de terceiro num implemento que
 * sai com a nossa.
 *
 * COMO ELA É ACHADA, e por que não pelo nome do nó. O nó se chama
 * `Caixa-ferrmantas-modelo1_p54`, e `p54` é um número de peça do modelo de
 * origem: um re-bake renumera e a correção vira ou um no-op silencioso ou —
 * pior — a remoção de outra peça. É a mesma razão pela qual `trim.ts` casa a
 * caixa por nó e os paralamas por material: cada um pelo critério que o bake
 * torna estável PARA ELE.
 *
 * A assinatura é MEDIDA, e o discriminante é a densidade:
 *
 *   dentro da caixa      só ali existe plaqueta de marca de caixa
 *   ≤ 2 mm de espessura  chapa aplicada, não peça
 *   ≤ 300 mm de aresta   medida: 200 × 50 mm
 *   ≥ 1000 triângulos    UMA CHAPA LISA DESSE TAMANHO SÃO 12. Os 2 112 que ela
 *                        tem são as letras do logotipo.
 *
 * Conferido nas 80 malhas da caixa: a segunda mais densa entre as finas tem
 * 476 triângulos (o forro de 1 mm da folha), ou seja o corte de 1 000 cai num
 * vazio de 4x. E a função só remove quando o casamento é ÚNICO — duas
 * candidatas significam que a assinatura deixou de identificar, e aí a resposta
 * certa é não remover nada e dizer isso, não escolher uma.
 *
 * NÃO É `visible = false`: `applyTrim()` reescreve `mesh.visible` em toda malha
 * da caixa a cada aplicação de acabamento (é assim que o card "Caixa de
 * ferramentas" a esconde e a devolve), e a plaqueta voltaria no primeiro clique.
 * Destacar do grafo é o que sobrevive a isso.
 *
 * A geometria NÃO é descartada: as malhas espelhadas deste bake compartilham
 * buffer (ver a nota de `raiseDoorCatches`), e um `dispose()` aqui poderia
 * levar junto o de uma peça que ficou. Solta do grafo, ela nunca é desenhada e
 * o coletor cuida do resto — isto roda antes do primeiro quadro do implemento,
 * então nada dela chegou à GPU.
 */
function removeBoxNameplate(root: THREE.Object3D, toLocal: THREE.Matrix4): string {
  const found: { mesh: THREE.Mesh; side: number; tris: number }[] = [];
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!underNode(mesh, root, BOX_NODE_RE)) return;
    const geo = mesh.geometry as THREE.BufferGeometry;
    const tris = (geo.index ? geo.index.count : geo.getAttribute('position')?.count ?? 0) / 3;
    if (tris < PLATE_MIN_TRIS) return;
    const box = boxOf(mesh, toLocal);
    if (!box) return;
    const s = box.getSize(new THREE.Vector3());
    const thick = Math.min(s.x, s.y, s.z);
    const side = Math.max(s.x, s.y, s.z);
    if (thick > PLATE_MAX_THICK || side > PLATE_MAX_SIDE) return;
    found.push({ mesh, side, tris });
  });

  if (!found.length) return 'plaqueta da caixa: não encontrada — nada a remover';
  if (found.length > 1) {
    return `plaqueta da caixa: RECUSADA — ${found.length} candidatas`
      + ` (${found.map((f) => `${f.tris | 0} tri`).join(', ')}); a assinatura`
      + ' deixou de identificar uma peça só';
  }
  const { mesh, side, tris } = found[0];
  mesh.removeFromParent();
  return `plaqueta da caixa: removida (${(side * 1000) | 0} mm, ${tris | 0} triângulos)`;
}

/**
 * Aplica as três correções. Roda uma vez por carga, entre `TrailerBody` e
 * `TrailerAssembly` — ver o cabeçalho deste arquivo para o porquê da ordem.
 */
export function applyBakeFixes(root: THREE.Object3D, ref: BakeFixRefs): void {
  root.updateWorldMatrix(true, true);
  const toLocal = root.matrixWorld.clone().invert();
  const notes = [
    stretchFrontHeader(root, toLocal, ref),
    raiseDoorCatches(root, toLocal, ref),
    removeBoxNameplate(root, toLocal),
  ];
  console.info('[bake] correções —', notes.join(' · '));
}

/* ===========================================================================
   AS CORREÇÕES DO SOBRECHASSI — 2026-08-18
   ===========================================================================
   As três de cima são do semirreboque e rodam por medida em qualquer bake. As
   duas abaixo são do sobrechassi e são REMOÇÕES: o bake traz peças que o
   produto Ankaa não tem, e nenhuma delas pode ser corrigida no lugar.

   Elas são chamadas por `loadTrailer()` ANTES de `splitTrailerHardware()` e de
   `buildTrailerRig()`, e essa ordem é contrato: `TrailerBody` decompõe o
   material branco em cascas conexas no construtor, e uma folha de porta ainda
   pendurada ali entra na conta da parede.
   =========================================================================== */

/** Material da parte branca — a mesma âncora de `trailer-geometry.ts`. */
const WHITE_BAKE_RE = /Cor_padrao_branco|metalBranco/i;

/** Quão fina é uma folha de chapa, em X. Ver `SHEET_THICK` do baú. */
const LEAF_THICK = 0.06;
/** Uma folha de porta mede entre isto e o teto do baú em altura. */
const LEAF_MIN_H = 1.60;
/** …e isto em largura. Uma folha de parede é bem mais larga. */
const LEAF_MAX_W = 1.40;
/** Quão recuada do plano da parede a folha da porta está. Medido: 5 mm. */
const LEAF_RECESS_MIN = 0.002;
/** Margem em Z, para fora da folha, onde ainda mora ferragem DA PORTA.
 *  Medido no sobrechassi: o marco desce até 130 mm antes da folha. */
const DOOR_REACH_Z = 0.20;

/**
 * Tira a PORTA LATERAL DE FÁBRICA do bake — folha, marco, borracha e ferragem.
 *
 * POR QUE ELA SAI, e não é preferência de acabamento:
 *
 *  1. **A folha está 7,7 mm FORA DE FASE com a parede.** Medido: as fileiras de
 *     friso dela ficam em 0,7480 + k·53 mm e as da parede em 0,3693 + k·53. A
 *     onda da folha não continua a da parede, e é isso que a faz ler como uma
 *     peça estranha colada no flanco.
 *  2. **Ela impede o flanco de virar chapa frisada.** Fora de fase, entrar na
 *     união quebra a corrente de `findRows()` e o flanco INTEIRO perde o friso
 *     — sem erro nenhum. Ver `mergeSkinSheets()`.
 *  3. **Porta é sob demanda.** No semirreboque nenhuma porta lateral vem no
 *     bake: quem as põe é `TrailerBody.setDoors()`, com o kit extraído da porta
 *     traseira do próprio implemento. Uma porta fixa no bake é uma porta que o
 *     usuário não pode tirar.
 *
 * O vão que sobra é fechado por `fillSheetGaps()`, clonando uma folha da
 * própria parede — a única maneira de manter a fase.
 *
 * A BUSCA É POR FORMA, não por nome: `borracha-porta-lateral-01` é o nome de um
 * bake e o próximo renomeia. A folha é reconhecida por ser branca, fina,
 * ALTA-mas-estreita e RECUADA do plano da parede; a ferragem, por morar dentro
 * do retângulo dela e não atravessar a linha de centro (o que exclui as
 * travessas da gancheira, que passam de flanco a flanco na mesma altura).
 *
 * @returns quantas malhas saíram.
 */
export function removeBakedSideDoor(root: THREE.Object3D): number {
  root.updateWorldMatrix(true, true);
  const toLocal = root.matrixWorld.clone().invert();
  const mm = new THREE.Matrix4();
  const bx = new THREE.Box3();

  interface Cand { o: THREE.Mesh; b: THREE.Box3 }
  const brancas: Cand[] = [];
  const todas: Cand[] = [];
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const gb = o.geometry.boundingBox;
    if (!gb) return;
    bx.copy(gb).applyMatrix4(mm.multiplyMatrices(toLocal, o.matrixWorld));
    const b = bx.clone();
    todas.push({ o, b });
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => !!m && WHITE_BAKE_RE.test(m.name || ''))) brancas.push({ o, b });
  });
  if (!brancas.length) return 0;

  /* ⚠️ O PLANO DA PAREDE É POR FLANCO, e um `skin` global custou uma rodada.
     O baú não é simétrico em X — medido no sobrechassi, a pele direita está em
     +1,309 e a esquerda em −1,299, 10 mm de diferença. Com um único `skin` de
     1,309, TODA folha da parede esquerda aparece "recuada 10 mm" e passa por
     folha de porta: a primeira versão marcou 8 janelas no flanco esquerdo e
     removeu 346 malhas — o flanco inteiro, com fita, lanterna e parafusaria
     junto. Por lado, a parede do lado tem recuo ZERO e só a porta sobra. */
  const skinDe = (sinal: number) => {
    let s = 0;
    for (const c of brancas) {
      const outer = sinal > 0 ? c.b.max.x : -c.b.min.x;
      if (sinal > 0 ? c.b.max.x <= 0 : c.b.min.x >= 0) continue;
      if (outer > s) s = outer;
    }
    return s;
  };
  const skin = { 1: skinDe(1), '-1': skinDe(-1) } as Record<string, number>;

  const folhas = brancas.filter((c) => {
    const dx = c.b.max.x - c.b.min.x, dy = c.b.max.y - c.b.min.y, dz = c.b.max.z - c.b.min.z;
    if (dx > LEAF_THICK || dy < LEAF_MIN_H || dz > LEAF_MAX_W || dz < 0.4) return false;
    const lado = (c.b.min.x + c.b.max.x) / 2 > 0 ? 1 : -1;
    const outer = lado > 0 ? c.b.max.x : -c.b.min.x;
    return skin[String(lado)] - outer >= LEAF_RECESS_MIN;   // RECUADA da parede
  });
  if (!folhas.length) return 0;

  let n = 0;
  const doomed = new Set<THREE.Object3D>();
  for (const folha of folhas) {
    const lado = (folha.b.min.x + folha.b.max.x) / 2 > 0 ? 1 : -1;
    const z0 = folha.b.min.z - DOOR_REACH_Z, z1 = folha.b.max.z + DOOR_REACH_Z;
    for (const c of todas) {
      if (doomed.has(c.o)) continue;
      /* No flanco, e SEM atravessar a linha de centro — é o que deixa de fora
         as travessas da gancheira, que dividem a faixa de Z com a porta. */
      if (lado > 0 ? c.b.min.x < 0.9 : c.b.max.x > -0.9) continue;
      if (c.b.min.z < z0 || c.b.max.z > z1) continue;
      if (c.b.max.y < folha.b.min.y - 0.4) continue;   // deixa o sub-chassi
      doomed.add(c.o);
    }
  }
  /* `removeFromParent()` e NÃO `visible = false`: `applyTrim()` e o assembly
     reescrevem `mesh.visible` em famílias inteiras, e a porta voltaria no
     primeiro clique de acabamento. É a mesma razão de `removeBoxNameplate()`. */
  for (const o of doomed) { o.removeFromParent(); n++; }
  console.info('[bake] porta lateral de fábrica removida —', n, 'malhas ·',
    folhas.length, 'folha(s) ·', 'o vão é fechado por fillSheetGaps()');
  return n;
}

/** As plaquetas da marca do FABRICANTE do bake. Material próprio, então o
 *  casamento por nome é exato — e elas são as únicas que o usam. */
const MAKER_PLATE_MAT_RE = /^logo-chapas(-metal)?$/i;
/** Uma chapa de marca é FINA, PEQUENA e DENSA — as letras são recorte. */
const MAKER_PLATE_MAX_THICK = 0.05;
const MAKER_PLATE_MAX_EDGE = 1.20;
/**
 * …e ela é LARGA. Sem este piso a densidade sozinha levava 17 malhas em vez de
 * 5: a ferragem do fecho traseiro é fina, centrada, na traseira e densa
 * (11 492 triângulos num bloco de 92 mm), e passava em tudo. Uma chapa de marca
 * tem 700 mm de aresta maior; a maior aresta do fecho tem 92.
 */
const MAKER_PLATE_MIN_EDGE = 0.35;
const MAKER_PLATE_MIN_TRIS = 1500;
/** E ela mora na ponta traseira: medido, a 20 mm dela. 0,30 m é folgado para o
 *  recuo e estreito para tudo o que mora no meio do implemento. */
const MAKER_PLATE_REAR_BAND = 0.30;

/**
 * Tira a marca do FABRICANTE DO IMPLEMENTO (Ibiporã) do bake.
 *
 * São duas famílias, e as duas foram medidas no sobrechassi:
 *
 *  · **4 plaquetas de flanco**, material `logo-chapas-metal`, 700 × 50 mm na
 *    saia, em z ±3,84. Material EXCLUSIVO delas, então saem por nome.
 *  · **a chapa de recorte da traseira**, 700 × 170 × 20 mm com **5 084
 *    triângulos** — as letras vazadas. Ela usa `metal-galvanizado-polido`, que é
 *    o material da gancheira inteira, então nome não serve: a assinatura é
 *    DENSIDADE, a mesma de `removeBoxNameplate()` (uma chapa lisa de 700 × 170
 *    são 12 triângulos; esta tem 5 084, ou seja 400×).
 *
 * O implemento é vendido pela Ankaa e a marca dele é a Ankaa — a do fabricante
 * do baú não entra na peça de venda.
 *
 * @returns quantas malhas saíram.
 */
export interface MakerBrandingResult {
  /** quantas malhas saíram */
  removed: number;
  /** a caixa da CHAPA DE RECORTE que saiu, em espaço local da raiz — é o
   *  SÍTIO onde a chapa da Ankaa entra. `null` se não havia chapa. */
  site: THREE.Box3 | null;
}

export function removeMakerBranding(root: THREE.Object3D): MakerBrandingResult {
  root.updateWorldMatrix(true, true);
  const toLocal = root.matrixWorld.clone().invert();
  const mm = new THREE.Matrix4();
  const bx = new THREE.Box3();
  const doomed: THREE.Object3D[] = [];

  /* A ponta traseira do implemento, para o teste de Z abaixo. Medida na
     malharia e não suposta: a traseira é o MENOR z (mesma convenção do resto). */
  let rearZ = Infinity;
  let site: THREE.Box3 | null = null;
  let siteW = 0;
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const gb = o.geometry.boundingBox;
    if (!gb) return;
    bx.copy(gb).applyMatrix4(mm.multiplyMatrices(toLocal, o.matrixWorld));
    if (bx.min.z < rearZ) rearZ = bx.min.z;
  });

  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => !!m && MAKER_PLATE_MAT_RE.test(m.name || ''))) {
      doomed.push(o);
      return;
    }
    /* A chapa de recorte: fina, pequena e densa. O teste de densidade é o que
       a separa da gancheira, que divide o material com ela. */
    const pos = o.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos || pos.count / 3 < MAKER_PLATE_MIN_TRIS) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const gb = o.geometry.boundingBox;
    if (!gb) return;
    bx.copy(gb).applyMatrix4(mm.multiplyMatrices(toLocal, o.matrixWorld));
    const d = [bx.max.x - bx.min.x, bx.max.y - bx.min.y, bx.max.z - bx.min.z].sort((a, b) => a - b);
    if (d[0] > MAKER_PLATE_MAX_THICK || d[2] > MAKER_PLATE_MAX_EDGE) return;
    if (d[2] < MAKER_PLATE_MIN_EDGE) return;
    /* Na LINHA DE CENTRO **e na traseira**: a chapa de marca do bake é centrada
       e mora na ponta traseira. Sem o teste de Z a primeira versão levou 15
       malhas em vez de 5 — há peça densa, fina e centrada em outros lugares do
       implemento (a ferragem do fecho traseiro, por exemplo). */
    if (Math.abs((bx.min.x + bx.max.x) / 2) > 0.15) return;
    if (bx.min.z > rearZ + MAKER_PLATE_REAR_BAND) return;
    /* O SÍTIO é o da chapa de recorte, e só dela: as plaquetas de flanco saem
       pelo material e não servem de referência para a chapa da traseira. */
    if (!site || (bx.max.x - bx.min.x) > siteW) { site = bx.clone(); siteW = bx.max.x - bx.min.x; }
    doomed.push(o);
  });

  for (const o of doomed) o.removeFromParent();
  if (doomed.length) {
    console.info('[bake] marca do fabricante removida —', doomed.length, 'malhas',
      site ? `· sítio ${(siteW * 1000).toFixed(0)} mm de largura` : '· sem chapa de recorte');
  }
  return { removed: doomed.length, site };
}

/** Quanto a chapa da Ankaa pode ser reescalada para caber no sítio. Fora disto
 *  o sítio não é um sítio de chapa e a peça fica de fora — melhor sem marca que
 *  com uma marca de tamanho arbitrado. */
const BRAND_SCALE_RANGE: readonly [number, number] = [0.5, 1.6];
/** A rugosidade da chapa da Ankaa: inox ESCOVADO de placa de identificação.
 *  0,28 é a mesma faixa do `inox-ferragem__polido` da ferragem da porta, que é
 *  o que o dono aponta como "inox" quando compara. Ver o bloco em
 *  `attachBrandPlate()` para os quatro renders que fixaram este número. */
const BRAND_ROUGH = 0.28;
/** E o ambiente dela. As famílias estruturais do implemento estão em 1,0 e as
 *  peças que o dono lê como inox estão em 1,35; uma chapa PLANA precisa de mais
 *  que uma curva para varrer o mesmo tanto de céu. */
const BRAND_ENV = 1.6;

/**
 * Põe a chapa de recorte da ANKAA no lugar de onde a do fabricante saiu.
 *
 * A peça vem do asset compartilhado (`KIT_PLACA_MARCA`, harvestada do
 * `trailer.glb` — 810 × 230 × 54 mm, 1 548 triângulos, as letras são recorte) e
 * é reescalada UNIFORMEMENTE para a largura do sítio: a do sobrechassi mede
 * 700 mm, então a chapa entra a 0,864. Uniforme porque a peça é produto físico
 * — esticar só na largura daria uma letra deformada.
 *
 * A face de trás dela encosta na face de trás do sítio. As duas olham para −Z
 * (a traseira) nos dois bakes, então não há giro: a orientação já é a mesma.
 */
export function attachBrandPlate(
  root: THREE.Object3D, kit: THREE.Object3D, site: THREE.Box3,
): boolean {
  let src: THREE.Mesh | null = null;
  kit.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!src && m.isMesh && m.name === 'KIT_PLACA_MARCA') src = m;
  });
  if (!src) {
    console.warn('[marca] KIT_PLACA_MARCA não está no asset — a traseira fica sem chapa.');
    return false;
  }
  const mesh = src as THREE.Mesh;
  const geo = mesh.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const gb = geo.boundingBox as THREE.Box3;
  const w = gb.max.x - gb.min.x;
  const siteW = site.max.x - site.min.x;
  const s = siteW / (w || 1);
  if (!(s >= BRAND_SCALE_RANGE[0] && s <= BRAND_SCALE_RANGE[1])) {
    console.warn('[marca] sítio de', (siteW * 1000).toFixed(0), 'mm pede escala', s.toFixed(2),
      '— fora da faixa; a chapa fica de fora.');
    return false;
  }
  /* ---- O INOX É O DO IMPLEMENTO, NÃO O DO KIT ----
     *"essa placa com Ankaa deveria estar com a mesma textura de inox em volta
     dele"* — Kennedy, 2026-08-20, com print da traseira: a chapa sai BRANCA
     FOSCA entre cantoneiras que espelham o mato e o asfalto.

     E não é cor errada: o kit já declara `inox-ferragem` (baseColor 0,64/0,67/
     0,69, roughness 0,3). O que muda é a INSTÂNCIA. `porta_kit_v1.glb` é
     carregado por `loadDoorKit()`, um asset à parte do implemento, então o
     `THREE.Material` que sai dele é um objeto novo — e tudo o que o estúdio faz
     com o inox depois do load (envMap, `envMapIntensity`, o mapa anisotrópico
     do escovado) foi aplicado nos materiais DO IMPLEMENTO. O material do kit
     nunca passou por lá: fica um PBR nu, que sem reflexo nenhum lê como tinta
     branca. Duas peças coladas uma na outra, com o mesmo nome de material e
     acabamentos diferentes.

     Então a chapa passa a usar, por NOME, a instância que já está na raiz. Se
     não houver nenhuma com esse nome ali, fica a do kit — pior é não ter chapa. */
  let tinta: THREE.Material | THREE.Material[] = mesh.material;
  {
    const alvo = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material)?.name || '';
    /* ⚠️ NÃO SE CASA PELO NOME EXATO, e a primeira versão desta busca casava —
       avisou *"não há inox-ferragem no implemento"* num implemento que tem 59
       malhas de inox. É que `splitStainlessHardware()` já rodou (bem antes,
       junto de `splitTrailerHardware()`) e QUEBROU A FAMÍLIA: o que era um
       `inox-ferragem` só virou `inox-ferragem__caixa` e companhia, para separar
       o inox da caixa de cozinha do inox da ferragem. Nome exato não sobrevive
       a isso; a família, sim.

       E entre os irmãos quem ganha é o MAIS PERTO. O pedido é *"a mesma textura
       de inox em volta dele"* — em volta, não "algum inox". As cantoneiras que
       emolduram o sítio são o que o olho compara, e é o material delas que a
       chapa tem de vestir; herdar o da caixa de cozinha seria acertar a família
       e errar o acabamento. */
    /* ⚠️⚠️ E A FAMÍLIA NÃO É SÓ A DO KIT — TERCEIRA VOLTA (2026-08-22).
       A §33.9 já tinha medido que **o que emoldura a chapa NÃO é inox**: ela é
       `inox-ferragem__polido` (rugosidade 0,3, espelhada) e quem a cerca é
       `metal-galvanizado-polido` (rugosidade forçada a ≥0,62 pela régua de
       acabamento, ou seja FOSCO). A conclusão de lá foi registrar a diferença;
       o dono voltou uma terceira vez com a mesma frase — *"a chapa com a logo
       da empresa continua com uma textura diferente da esperada, inox, igual as
       partes metálicas ao redor dela"*.

       Registrar não era a resposta: o pedido é de IGUALDADE, e igualdade com
       "as partes metálicas ao redor dela". Então a busca deixa de ser pela
       família do KIT e passa a ser pela **peça metálica estrutural mais próxima
       do sítio**, seja ela qual for. As quatro famílias abaixo são as do metal
       de estrutura do implemento; o que fica de fora é o que NÃO é chapa —
       fita refletiva (que é metálica no fator e é decalque), lente, plástico,
       borracha e mangueira.

       O argumento da §33.5 continua de pé e é o que faz a busca ser no
       IMPLEMENTO: o material que o `porta_kit_v1.glb` traz é uma instância CRUA
       (nunca passou pelo envMap nem pelo escovado do estúdio) e PBR nu sem
       reflexo lê como tinta branca. Qualquer material daqui já passou. */
    const ESTRUTURAL = /^(inox-ferragem|metal-galvanizado|metal-pouco-polido|metal-estrutura)/;
    const familia = ESTRUTURAL;
    /* ⚠️ E ENTRE OS ESTRUTURAIS, O ACABAMENTO DECIDE ANTES DA DISTÂNCIA.
       Uma placa de identificação de implemento é AÇO INOX ESCOVADO, e escovado
       é uma faixa de rugosidade, não um extremo. Medidos os quatro candidatos
       que moram a menos de 0,6 m do sítio no gancheiro:

           metal-estrutura-principal-padrao   m1 · r1,00   longarina — FOSCA
           metal-pouco-polido                 m1 · r1,00   idem
           metal-galvanizado-mantido          m1 · r0,62   SATINADA  ← escovado
           inox-ferragem__polido              m1 · r0,30   ESPELHO

       A mais PERTO é a longarina em que a chapa é aparafusada, e herdar dela dá
       um metal totalmente fosco: sob a carroceria, onde não há luz para
       espalhar, isso lê como chapa preta e o logotipo some. O outro extremo já
       foi tentado — a §33.5 deu à chapa o `inox-ferragem__polido` e o dono
       voltou pela terceira vez com a mesma frase. Um espelho plano virado para
       trás reflete a sombra do próprio veículo, e sombra não tem textura.

       O meio é o certo, e é o que o pedido nomeia: *"inox, igual as partes
       metálicas ao redor dela"*. Satinado tem lóbulo largo o bastante para
       pegar o céu por cima do para-choque e estreito o bastante para não virar
       cinza chapado. Por isso a busca prefere a faixa e só cai na distância
       pura quando não há nenhum satinado por perto. */
    const SATIN = [0.35, 0.75];
    const satinado = (m: THREE.Material) => {
      const r = (m as THREE.MeshStandardMaterial).roughness;
      return typeof r === 'number' && r >= SATIN[0] && r <= SATIN[1];
    };
    root.updateWorldMatrix(true, true);
    const paraRaiz = root.matrixWorld.clone().invert();
    const centro = site.getCenter(new THREE.Vector3());
    let achado: THREE.Material | null = null;
    let melhor = Infinity;
    let achadoSatin = false;
    root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh || !o.geometry) return;
      const mats = (Array.isArray(o.material) ? o.material : [o.material])
        .filter((m): m is THREE.Material => !!m && familia.test(m.name || ''));
      if (!mats.length) return;
      const b = boxOf(o, paraRaiz);
      if (!b) return;
      const d = b.distanceToPoint(centro);
      for (const m of mats) {
        const sat = satinado(m);
        /* Satinado ganha de qualquer distância; entre iguais, o mais perto. */
        if (sat && !achadoSatin) { achadoSatin = true; melhor = d; achado = m; continue; }
        if (sat === achadoSatin && d < melhor) { melhor = d; achado = m; }
      }
    });
    if (achado) {
      /* ▶▶ E ELA GANHA UMA INSTÂNCIA PRÓPRIA, DERIVADA DESSA — QUARTA VOLTA.
         --------------------------------------------------------------------
         *"essa chapa escrita Ankaa ainda está fosca / cinza"* — Kennedy,
         2026-08-22, terceira vez seguida. Três materiais COMPARTILHADOS já
         foram tentados nela e os três falharam:

             §33.5   inox-ferragem__polido            m1 · r0,30   espelho
             §38.11  metal-estrutura-principal-padrao m1 · r1,00   fosco
             §38.11  metal-galvanizado-mantido        m1 · r0,62   satinado

         O EXPERIMENTO QUE FECHOU (`diag/checks-scania6-0822.mjs`) separou material
         de geometria com quatro renders do mesmo quadro:

             (a) como está …………………………………… cinza fosco
             (b) inox m1/r0,28/env1,6, normais REFEITAS …… inox
             (c) inox m1/r0,28/env1,6, normais ORIGINAIS … inox (igual a b)
             (d) material de hoje, normais REFEITAS ……… cinza fosco (igual a a)

         (b) ≡ (c) e (a) ≡ (d): **a normal não decide nada, o material decide
         tudo.** E o que separa os dois é `envMapIntensity` — 1,0 nas famílias
         estruturais contra 1,35 das peças que o dono chama de inox — somado à
         rugosidade. Uma chapa PLANA virada para trás, na sombra da carroceria,
         não tem curvatura para varrer o ambiente: ela devolve UMA direção, e
         com pouco ambiente essa direção é cinza.

         ⚠️ POR QUE UMA INSTÂNCIA PRÓPRIA, se §33.5 dizia para não criar
         material novo. O aviso de lá é contra o material do KIT, que nunca
         passou pelo estúdio e por isso não tem `envMap`. Aqui não se cria do
         zero: CLONA-SE a instância do implemento — que já tem o cubemap local,
         a régua de acabamento e a molhagem — e mexe-se em dois escalares. O
         que não se pode é dar a ESTA chapa uma rugosidade que o resto da
         família precisa manter: o mesmo `metal-galvanizado-mantido` veste o
         trilho de topo e a barra da proteção lateral, e as duas peças estão
         aprovadas como estão.

         Custo: uma chamada de desenho a mais (a chapa sai do balde da família).
         `refreshVehicleReflection()` roda depois e alcança este material pela
         malha, como alcança os outros. */
      const base = achado as THREE.MeshStandardMaterial;
      const proprio = base.clone();
      proprio.name = 'marca-ankaa-inox';
      proprio.metalness = 1;
      proprio.roughness = BRAND_ROUGH;
      proprio.envMapIntensity = BRAND_ENV;
      proprio.needsUpdate = true;
      tinta = proprio;
      console.info('[marca] chapa em', proprio.name, '— derivada de', base.name,
        achadoSatin ? '(satinado)' : '(sem satinado por perto)',
        'a', (melhor * 1000).toFixed(0), 'mm do sítio ·',
        `rugosidade ${base.roughness?.toFixed(2)} → ${BRAND_ROUGH}`,
        `· ambiente ${(base.envMapIntensity ?? 1).toFixed(2)} → ${BRAND_ENV}`);
    } else {
      console.warn('[marca] nenhuma peça de metal estrutural perto do sítio —',
        'a chapa fica com o material do kit', alvo ? `(${alvo})` : '', '.');
    }
  }
  const placa = new THREE.Mesh(geo, tinta);
  placa.name = 'PLACA_MARCA_ANKAA';
  placa.scale.setScalar(s);
  placa.castShadow = placa.receiveShadow = true;
  /* Centro em X e Y no centro do sítio; em Z, a face de trás encostada na face
     de trás do sítio (as duas olham para −Z). */
  const c = site.getCenter(new THREE.Vector3());
  const d = (gb.max.z - gb.min.z) * s;
  placa.position.set(c.x, c.y, site.min.z + d / 2);
  root.add(placa);
  console.info('[marca] chapa Ankaa posta —', (siteW * 1000).toFixed(0), 'mm ·',
    'escala', s.toFixed(3));
  return true;
}

/** Espessura máxima, em X, de uma banda de arremate: ela é chapa dobrada. */
const LOW_BAND_THICK = 0.06;
/** …e altura máxima dela. O perfil de baixo do sobrechassi mede 140 mm. */
const LOW_BAND_HEIGHT = 0.25;
/** Quão acima do pé do branco a banda pode começar e ainda ser a de BAIXO. */
const LOW_BAND_FOOT = 0.30;

/**
 * A BANDA DE BAIXO DO FLANCO É FRAME, NÃO CHAPA — e no bake ela veio branca.
 *
 * Medido, comparando os dois implementos na MESMA vista relativa
 * (`tools/trailer-bench/shoot-impl.mjs`, vistas `rel-*`):
 *
 *   semirreboque  a banda sob a chapa frisada é `metal-galvanizado-mantido`,
 *                 y 1,309…1,519 em |x| 1,281…1,307 — ela SOBRESSAI 3,5 mm da
 *                 pele branca (1,3035) e por isso se vê, com a fita 3M colada
 *                 nela;
 *   sobrechassi   a mesma banda é `Cor_padrao_branco(metalBranco)`,
 *                 y 0,167…0,307 em |x| 1,271…1,297 — branca, rente à pele, e
 *                 o quadro de verdade (`metal-estrutura-principal-padrao`,
 *                 0,214…0,309) fica ATRÁS dela, invisível.
 *
 * O resultado é o relato do dono: *"a parte de baixo não mostra a separação de
 * chapa e frame metálico"*. Não é iluminação nem acabamento — é o material da
 * peça, e ele está errado no arquivo.
 *
 * A troca é só de MATERIAL: nenhum vértice se move. E ela tem de rodar antes de
 * `TrailerBody`, porque tirar a banda da família branca muda o `floorY` do baú
 * (o pé do branco sobe para o começo da chapa frisada), e o `floorY` é a régua
 * de tudo o que vem depois.
 *
 * A busca é por FORMA: casca branca fina, baixa, que atravessa o baú e mora no
 * pé do branco. No semirreboque nada casa — a única peça branca que atravessa
 * o baú é a tira do teto, e ela tem 2,59 m de largura.
 *
 * @returns quantas malhas trocaram de material.
 */
export function fixLowFrameSkin(root: THREE.Object3D, frameRe: RegExp): number {
  root.updateWorldMatrix(true, true);
  const toLocal = root.matrixWorld.clone().invert();
  const mm = new THREE.Matrix4();
  const bx = new THREE.Box3();

  interface Cand { o: THREE.Mesh; b: THREE.Box3 }
  const brancas: Cand[] = [];
  const box = new THREE.Box3();
  let frameMat: THREE.Material | null = null;
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!frameMat) {
      const hit = mats.find((m) => !!m && frameRe.test(m.name || ''));
      if (hit) frameMat = hit;
    }
    if (!mats.some((m) => !!m && WHITE_BAKE_RE.test(m.name || ''))) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const gb = o.geometry.boundingBox;
    if (!gb) return;
    bx.copy(gb).applyMatrix4(mm.multiplyMatrices(toLocal, o.matrixWorld));
    brancas.push({ o, b: bx.clone() });
    box.union(bx);
  });
  if (!brancas.length) return 0;
  if (!frameMat) {
    console.warn('[bake] material de quadro', frameRe, 'não existe neste implemento —',
      'a banda de baixo fica branca.');
    return 0;
  }

  const spanZ = (box.max.z - box.min.z) * 0.9;
  const alvos = brancas.filter((c) => {
    if (c.b.max.z - c.b.min.z < spanZ) return false;
    if (c.b.max.x - c.b.min.x > LOW_BAND_THICK) return false;
    if (c.b.max.y - c.b.min.y > LOW_BAND_HEIGHT) return false;
    return c.b.min.y <= box.min.y + LOW_BAND_FOOT;
  });
  for (const c of alvos) {
    c.o.material = Array.isArray(c.o.material)
      ? c.o.material.map((m) => (WHITE_BAKE_RE.test(m?.name || '') ? frameMat as THREE.Material : m))
      : frameMat as THREE.Material;
  }
  if (alvos.length) {
    console.info('[bake] banda de baixo do flanco passou a', (frameMat as THREE.Material).name,
      '—', alvos.length, 'malhas · a separação chapa/frame volta a aparecer');
  }
  return alvos.length;
}

/** A fita retrorrefletiva do bake — o mesmo casador de `retroreflect.ts`. */
const TAPE_MAT_RE = /faixa.?3m/i;
/**
 * AS QUATRO ÂNCORAS DA FITA VERTICAL DE CANTO, MEDIDAS NO SEMIRREBOQUE.
 *
 * E são QUATRO, não duas: a fita da face de flanco e a da face de topo (a
 * dianteira/traseira) têm réguas DIFERENTES, e foi lê-las como uma só que
 * deixou metade delas fora do lugar. Medido nos dois bakes com o mesmo
 * instrumento (`tools/trailer-bench/medir-0820.mjs`), no semirreboque:
 *
 *   de FLANCO (chata em X)   base a **51,9 mm** sob o piso · topo a **28,0 mm** sob o teto
 *   de FACE   (chata em Z)   base a **70,0 mm** sob o piso · topo a **16,9 mm** sob o teto
 *
 * As duas têm 300 mm e as duas ATRAVESSAM o perfil de arremate — a de cima
 * sobe do meio da chapa até em cima do quadro, a de baixo desce da chapa até
 * em baixo dele. É isso que o dono quer dizer com *"a vertical das faces
 * laterais deveria ser na parte de inox que faz fronteira com a frente"*: ela
 * mora NO QUADRO, não parada abaixo dele.
 */
const TAPE_TOP_FROM_ROOF = 0.0280;
const TAPE_LOW_FROM_FLOOR = -0.0519;
const TAPE_FACE_TOP_FROM_ROOF = 0.0169;
const TAPE_FACE_LOW_FROM_FLOOR = -0.0700;
/**
 * ⚠️ AS DUAS DE BAIXO SÃO REDE, NÃO RÉGUA — e isto é o conserto de 2026-08-20.
 *
 * Elas ancoram no PISO, e "piso" (`profile.floorY`) é o menor y do material
 * branco — o que NÃO é a mesma coisa nos dois bakes:
 *
 *   semirreboque  a chapa do flanco começa em `floorY` (a parede e o flanco
 *                 terminam na mesma linha)
 *   sobrechassi   a chapa do flanco começa em **`floorY` + 82,5 mm**: quem
 *                 puxa o `floorY` para baixo é a TESTEIRA, que desce mais
 *
 * Medido: por causa disso TODO o conjunto de baixo do sobrechassi lê 82,5 mm
 * mais alto em relação ao `floorY` — o trilho, a fileira de fita 3M, as
 * travessas do piso e a travessa da testeira, todos +82,5. A fita vertical,
 * ancorada em `floorY − 51,9`, caía então 82,5 mm ABAIXO do quadro e ficava
 * pendurada sobre o chassi do caminhão. É o print de 10:34.
 *
 * A ÂNCORA CERTA É A PRÓPRIA FILEIRA DE FITA 3M HORIZONTAL, e ela não é
 * escolha: medida no semirreboque, a base da fita vertical e a base da fileira
 * horizontal são A MESMA LINHA, nas duas faces —
 *
 *   flanco  fileira `floorY −51,9…−1,9`  ·  fita vertical base `floorY −51,9`
 *   face    fileira `floorY −70,0…−20,0` ·  fita vertical base `floorY −70,0`
 *
 * — o que faz sentido: é a mesma fita dobrando a esquina. Ancorar nela é
 * livre de referencial e livre de bake, e reproduz o padrão ouro por
 * construção. Estas duas constantes só entram quando a fileira não existe.
 */
/** Altura de uma fita da FILEIRA horizontal (50 mm) e o comprimento dela. */
const TAPE_ROW_H = 0.08;
const TAPE_ROW_LEN = 0.20;
/** O montante de canto — o quadro entre a lateral e a frente/traseira. */
const POST_MAT_RE = /metal-estrutura-principal-padrao|metal-galvanizado-mantido/i;
/** Ele vai do piso ao teto; nada mais desta família é tão alto num canto. */
const POST_MIN_H = 2.0;
/** …e é esbelto nos dois eixos horizontais. */
const POST_MAX_W = 0.15;
/** Quão longe a fita pode estar do montante e ainda ser a dele. */
const POST_REACH = 0.30;
/**
 * Quão fora do plano da fita a FACE de um montante pode estar e ele ainda ser
 * aquele em que ela está colada.
 *
 * ⚠️ ELE EXISTE PORQUE OS MONTANTES SÃO ANINHADOS, e a versão anterior escolhia
 * o de DENTRO. No canto dianteiro do sobrechassi há dois:
 *
 *   estrutura-principal-02   87 × 2850 × 87   face em |x| 1,3016   z 4,1622…4,2492
 *   estrutura-principal-03   65 × 2850 × 65   face em |x| 1,3116   z 4,1942…4,2592
 *
 * A crista da pele está em 1,3101 e a fita em 1,3119: ela está colada no **-03**,
 * cuja face aflora na pele. O -02 fica 8,5 mm PARA DENTRO — invisível — e mesmo
 * assim ganhava, porque a escolha era pelo Z MAIS PRÓXIMO e a fita nascia 36 mm
 * dele contra 57 do outro. Resultado: a fita centrada num montante que ninguém
 * vê, 21 mm atrás do que ela cobre. É *"ela deveria estar no centro do poste
 * metálico vertical entre a lateral e a frontal"*, 2026-08-20.
 *
 * No semirreboque os dois montantes do canto compartilham o mesmo centro em z
 * (−7,4421 e −7,44225), então lá a regra antiga e esta dão a MESMA resposta —
 * o que é o teste de que esta não quebra o padrão ouro.
 */
const POST_FACE_TOL = 0.004;
/** Quão perto de uma PONTA do baú uma fita vertical ainda é fita DE CANTO. */
const TAPE_END_BAND = 0.35;

/**
 * Reancora as FITAS VERTICAIS DE CANTO à régua do semirreboque.
 *
 * Medido, comparando os dois bakes:
 *
 *   semirreboque  12 fitas verticais de 300 mm — 4 dobradas no canto dianteiro
 *                 (dx 36 mm E dz 36 mm) e 8 chatas no traseiro, 4 na face de
 *                 flanco e 4 na face da traseira. As de flanco em z −7,4421,
 *                 que é o centro EXATO do montante de canto (−7,44225): erro de
 *                 0,15 mm. As de face em |x| 1,2745 contra 1,2715 do montante:
 *                 3,0 mm. Ou seja: no padrão ouro TODA fita vertical é centrada
 *                 no montante do canto dela, cada uma no seu eixo.
 *   sobrechassi   12 fitas verticais chatas, e nenhuma dobrada. As do canto
 *                 DIANTEIRO já foram trazidas em §28.5; as OITO do traseiro
 *                 nunca foram tocadas — a versão anterior filtrava por
 *                 `f.b.max.z >= frontZ − 120 mm`, e isso é meio baú.
 *
 * O que estava errado nas oito, medido (do piso / do teto):
 *
 *   flanco de baixo   base a **+80,6 mm** do piso  (devia ser −51,9)  → 132 mm
 *   flanco de cima    topo a **−78,1 mm** do teto  (devia ser −28,0)  →  50 mm
 *   face de baixo     base a **+19,4 mm** do piso  (devia ser −70,0)  →  89 mm
 *   face de cima      topo a **−10,0 mm** do teto  (devia ser −16,9)  →   7 mm
 *
 * A correção é uma TRANSLAÇÃO — nenhum vértice novo, nenhuma dobra inventada.
 * A dobra do canto (os 36 mm em dx do semirreboque) é geometria que o bake do
 * sobrechassi não tem; forjá-la seria inventar peça, que é o que este arquivo
 * inteiro se recusa a fazer.
 *
 * @returns quantas fitas foram movidas.
 */
export function fixCornerTape(root: THREE.Object3D, floorYMundo: number, roofYMundo: number): number {
  root.updateWorldMatrix(true, true);
  const toLocal = root.matrixWorld.clone().invert();
  /* A RÉGUA CHEGA EM MUNDO E AS CAIXAS SAEM NA RAIZ — ver `cotaNaRaiz()`. */
  const floorY = cotaNaRaiz(root, floorYMundo);
  const roofY = cotaNaRaiz(root, roofYMundo);
  const v = new THREE.Vector3();

  interface Fita { o: THREE.Mesh; b: THREE.Box3; face: boolean }
  const verticais: Fita[] = [];
  let zMin = Infinity, zMax = -Infinity;
  /* A BASE DA FILEIRA HORIZONTAL, por face — a âncora real da fita vertical.
     Ver a nota das constantes. */
  const baseDaFileira: Record<'flanco' | 'face', number> = {
    flanco: Infinity, face: Infinity,
  };
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((m) => !!m && TAPE_MAT_RE.test(m.name || ''))) return;
    const b = boxOf(o, toLocal);
    if (!b) return;
    const dx = b.max.x - b.min.x, dy = b.max.y - b.min.y, dz = b.max.z - b.min.z;
    if (dy < TAPE_ROW_H && Math.max(dx, dz) > TAPE_ROW_LEN
      && b.min.y < floorY + 0.35 && b.min.y > floorY - 0.35) {
      const qual = dz > dx ? 'flanco' : 'face';
      if (b.min.y < baseDaFileira[qual]) baseDaFileira[qual] = b.min.y;
    }
    if (dy <= dz || dy <= dx) return;                       // não é vertical
    /* CHATA EM X é fita de FLANCO; chata em Z é fita de FACE. A do
       semirreboque que é dobrada nos dois eixos não é nenhuma das duas e fica
       de fora — ela já está no lugar e não há régua para reancorá-la. */
    const face = dz < 0.005;
    if (!face && dx >= 0.005) return;                       // dobrada
    const zc = (b.min.z + b.max.z) / 2;
    if (zc < zMin) zMin = zc;
    if (zc > zMax) zMax = zc;
    verticais.push({ o, b, face });
  });
  if (!verticais.length) return 0;

  /* DE CANTO É PERTO DE UMA DAS DUAS PONTAS, e são as duas — a versão anterior
     olhava só para a dianteira. ⚠️ A ponta é a das FITAS, não a do implemento:
     medir o maior z de toda malha põe a régua na ponta das mangueiras (4,338
     contra 4,194 do baú) e nenhuma fita entra na banda. */
  const alvos = verticais.filter((f) => {
    const zc = (f.b.min.z + f.b.max.z) / 2;
    return zc <= zMin + TAPE_END_BAND || zc >= zMax - TAPE_END_BAND;
  });
  if (!alvos.length) return 0;

  const montantes: THREE.Box3[] = [];
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((m) => !!m && POST_MAT_RE.test(m.name || ''))) return;
    const b = boxOf(o, toLocal);
    if (!b) return;
    if (b.max.y - b.min.y < POST_MIN_H) return;               // vai do piso ao teto
    if (b.max.x - b.min.x > POST_MAX_W || b.max.z - b.min.z > POST_MAX_W) return;
    if (Math.abs((b.min.x + b.max.x) / 2) < 1.0) return;      // é de canto
    montantes.push(b);
  });

  const meio = (floorY + roofY) / 2;
  let n = 0;
  for (const f of alvos) {
    const dy = f.b.max.y - f.b.min.y;
    const alta = f.b.min.y > meio;
    /* A RÉGUA É POR FACE — ver as quatro constantes. */
    const qual = f.face ? 'face' : 'flanco';
    const daFileira = baseDaFileira[qual];
    const base = isFinite(daFileira)
      ? daFileira
      : floorY + (f.face ? TAPE_FACE_LOW_FROM_FLOOR : TAPE_LOW_FROM_FLOOR);
    const alvoTopo = alta
      ? roofY - (f.face ? TAPE_FACE_TOP_FROM_ROOF : TAPE_TOP_FROM_ROOF)
      : base + dy;
    const desloca = alvoTopo - f.b.max.y;

    /* ---- E O CENTRO DO MONTANTE ----
       *"essa faixa refletiva da lateral vertical deveria ficar no centro do
       frame metálico entre a lateral e a frente, e a da traseira no frame
       vertical da lateral"* — Kennedy, 2026-08-19, com print.

       Cada fita se centra no montante do canto dela, NO EIXO EM QUE ELA É
       CHATA: a de flanco em Z, a de face em X. É o que o semirreboque tem
       (erro de 0,15 mm e 3,0 mm respectivamente), e é uma regra só para as
       duas — a versão anterior aplicava apenas a de flanco. */
    let dz = 0, dx = 0;
    if (montantes.length) {
      const lado = (f.b.min.x + f.b.max.x) / 2 > 0 ? 1 : -1;
      const zc = (f.b.min.z + f.b.max.z) / 2, xc = (f.b.min.x + f.b.max.x) / 2;
      /* A FACE PRIMEIRO, O Z DEPOIS — ver `POST_FACE_TOL`. A fita está colada
         num montante, e o montante em que ela está é o que AFLORA no plano
         dela; entre os que afloram, o mais próximo em z. Só quando nenhum
         aflora é que a régua antiga (o mais próximo em z, qualquer um) volta
         a valer. */
      const doLado = montantes.filter(
        (p) => ((p.min.x + p.max.x) / 2 > 0 ? 1 : -1) === lado);
      const faceDaFita = lado > 0 ? f.b.max.x : -f.b.min.x;
      const aflorando = f.face ? doLado : doLado.filter((p) => {
        const faceDoPoste = lado > 0 ? p.max.x : -p.min.x;
        return faceDoPoste >= faceDaFita - POST_FACE_TOL;
      });
      const candidatos = aflorando.length ? aflorando : doLado;
      let melhorP: THREE.Box3 | null = null, melhor = Infinity;
      for (const p of candidatos) {
        const d = Math.abs((p.min.z + p.max.z) / 2 - zc);
        if (d < melhor) { melhor = d; melhorP = p; }
      }
      /* Só se o montante estiver PERTO: uma fita que não seja de canto não
         pode ser puxada meio metro para achar um. */
      if (melhorP && melhor < POST_REACH) {
        if (f.face) dx = (melhorP.min.x + melhorP.max.x) / 2 - xc;
        else dz = (melhorP.min.z + melhorP.max.z) / 2 - zc;
      }
    }
    if (Math.abs(desloca) < 1e-4 && Math.abs(dz) < 1e-4 && Math.abs(dx) < 1e-4) continue;
    /* O deslocamento é em Y do espaço LOCAL DA RAIZ, e `position` mora no
       espaço do PAI — que pode estar girado (os nós do rip estão). Então o
       vetor é levado de um para o outro pela parte LINEAR da matriz; ponto e
       vetor não se transformam igual, e usar a matriz cheia somaria a
       translação do pai ao deslocamento. */
    const pai = f.o.parent;
    if (!pai) continue;
    const raizParaPai = new THREE.Matrix4()
      .multiplyMatrices(toLocal, pai.matrixWorld).invert();
    v.set(dx, desloca, dz).applyMatrix3(new THREE.Matrix3().setFromMatrix4(raizParaPai));
    f.o.position.add(v);
    f.o.updateMatrix();
    n++;
  }
  if (n) {
    const daBase = (k: 'flanco' | 'face') => (isFinite(baseDaFileira[k])
      ? `${((baseDaFileira[k] - floorY) * 1000).toFixed(1)} mm do piso (fileira)`
      : 'régua de reserva');
    console.info('[bake] fita vertical de canto reancorada —', n, 'de', alvos.length,
      `· base do flanco ${daBase('flanco')} · base da face ${daBase('face')}`,
      `· topo ${(TAPE_TOP_FROM_ROOF * 1000).toFixed(0)}/${(TAPE_FACE_TOP_FROM_ROOF * 1000).toFixed(0)} mm sob o teto`,
      '· centradas no montante');
  }
  return n;
}

/* ===========================================================================
   A RODADA DE 2026-08-19 — o trilho de piso, e a mangueira a mais
   ===========================================================================
   Duas correções, e as duas saíram da MESMA comparação peça a peça que produziu
   o enxerto de material (`tools/implement-bake/graft-materials.mjs`): a bancada
   despeja nome + material + triângulos + caixa de cada malha nos dois
   implementos, e o que sobra é a diferença real entre os dois produtos.
   =========================================================================== */

/** O perfil de arremate do semirreboque, agora presente no sobrechassi — ver o
 *  enxerto de `metal-galvanizado-mantido` em `graft-materials.mjs`. */
const RAIL_MAT_RE = /^metal-galvanizado-mantido$/i;
/**
 * A RÉGUA DO TRILHO DE PISO, medida no semirreboque:
 *
 *   piso do baú   1,3919      (pé da chapa frisada)
 *   trilho        1,3094 … 1,5194   =  piso −82,5 mm … piso +127,5 mm
 *   pele          |x| 1,3059
 *   trilho        |x| 1,2806 … 1,3064   → SOBRESSAI 0,5 mm da pele
 *
 * E o que o sobrechassi tinha antes desta correção:
 *
 *   piso do baú   0,2490
 *   banda         0,1665 … 0,3065   =  piso −82,5 mm … piso **+57,5 mm**
 *   pele          |x| 1,3105 (direita) · 1,3024 (esquerda)
 *   banda         |x| até 1,3061 / 1,2984 → **4,4 mm PARA DENTRO** da pele
 *
 * Ou seja: o pé já está no lugar exato (−82,5 mm nos dois, o que é a prova de
 * que a régua é a mesma), e o que falta são **70 mm de altura** e os poucos
 * milímetros que tiram o perfil de trás da chapa. Sem os dois, "subir o topo"
 * só esconderia a banda atrás da pele — ela ficaria mais alta e MENOS visível.
 */
const RAIL_TOP_FROM_FLOOR = 0.1275;
const RAIL_BOTTOM_FROM_FLOOR = -0.0825;
/**
 * ONDE O TOPO DO TRILHO PARA — **47,8 mm abaixo da primeira fileira de friso**,
 * e não numa altura fixa.
 *
 * ⚠️ ESTE É O CONSERTO DE 2026-08-20 (tarde), e ele substitui `RAIL_HEIGHT`
 * como alvo do topo. Os 210 mm vieram do semirreboque e valiam enquanto o
 * `floorY` do sobrechassi estava 82,5 mm baixo (§30.1): com a régua consertada,
 * forçar 210 mm põe o topo do perfil em `floorY + 127,5` enquanto a primeira
 * fileira de friso está em `floorY + 120,2` — **o trilho entra 7,3 mm dentro do
 * primeiro friso**, e o que se vê é a crista dele aflorando na aresta do
 * perfil. É *"parte do branco está vazando no frame metálico inferior na
 * lateral"*, 2026-08-20, com print.
 *
 * A altura não é a invariante; a FOLGA ATÉ O FRISO é:
 *
 *   semirreboque  row0 `floorY + 175,3`  ·  topo do trilho `floorY + 127,5`
 *                 → 47,8 mm de saia lisa entre o perfil e o primeiro friso
 *   sobrechassi   row0 `floorY + 120,2`  ·  topo alvo `floorY + 72,4`
 *                 → os mesmos 47,8 mm, com um perfil de 155 mm
 *
 * Os dois baús têm saias diferentes (175 contra 120 mm), então um perfil de
 * altura fixa não pode servir aos dois. Aplicada ao semirreboque, esta régua
 * devolve exatamente o topo que ele já tem — que é o teste de que ela é a dele.
 */
const RAIL_TOP_UNDER_ROW0 = 0.0478;
/** …e a ALTURA que sai das duas — a do SEMIRREBOQUE, e ela deixou de ser alvo
 *  em 2026-08-20 (ver `RAIL_TOP_UNDER_ROW0`); fica como a medida que era: os dois perfis já têm o PÉ no mesmo lugar (piso −82,5 mm), então
 *  ancorar no pé medido do próprio perfil tira `floorY` da conta. Isso importa
 *  porque `profile.floorY` é o pé da CHAPA FRISADA, e uma medida que dependesse
 *  dele mudaria de resposta com qualquer coisa que mexesse na decomposição de
 *  cascas — que é exatamente o tipo de acoplamento que já custou uma rodada
 *  neste arquivo. */
/* SEM LEITOR desde 2026-08-20, e fica assim de propósito: as duas cotas de que
   ela sai continuam sendo lidas, e a subtração documenta a relação entre elas
   sem custar nada. Exportada só para o `noUnusedLocals` não tropeçar nela. */
export const RAIL_HEIGHT = RAIL_TOP_FROM_FLOOR - RAIL_BOTTOM_FROM_FLOOR;
/**
 * QUANTO O TRILHO SOBRESSAI DA PELE — 2,9 mm, e o número tem de ser MAIOR QUE
 * `PLATE_T`.
 *
 * *"o frame metálico inferior está errado, com a parte branca sobrepondo ele em
 * partes"* — Kennedy, 2026-08-19, terceira leva.
 *
 * Ele valeu 0,5 mm até 2026-08-20, e 0,5 mm era o número certo pela medida
 * errada: comparava a face do perfil com a CRISTA CRUA do friso, no corpo de
 * fábrica. Só que a chapa que aparece na cena não é essa — é a de livery, e
 * `applyPlateLap()` a desloca para FORA em até **`PLATE_T` = 2,2 mm**
 * (`vehicle/models.ts`), depois de esta correção já ter rodado
 * (`buildLiveryPanels()` vem depois de `buildTrailerRig()`). Com 0,5 mm de
 * saliência contra 2,2 mm de remonte, a chapa termina **1,7 mm à frente do
 * perfil** em todo trecho onde o envelope do remonte está cheio — que é
 * exatamente "sobrepondo ele EM PARTES".
 *
 * O valor novo é MEDIDO no semirreboque, com o mesmo instrumento nos dois
 * implementos (`tools/trailer-bench/medir-0820.mjs`):
 *
 *   semirreboque  trilho |x| 1,3066  ·  crista da pele 1,3037  →  **+2,9 mm**
 *   sobrechassi   trilho |x| 1,3078  ·  crista da pele 1,3101  →  **−2,2 mm**
 *
 * Ou seja: no padrão ouro o perfil cobre o remonte com 0,7 mm de folga, e no
 * sobrechassi ele nasce ATRÁS da chapa. Os 2,9 mm reproduzem o padrão ouro.
 *
 * ⚠️ **A relação com `PLATE_T` é o contrato, não o valor.** Se o remonte
 * crescer, este número tem de crescer junto — senão a queixa volta, e volta
 * como "às vezes", porque o envelope do remonte desvanece perto das pontas.
 */
const RAIL_PROUD = 0.0029;
/** Espessura máxima do perfil, em X — ele é chapa dobrada. */
const RAIL_THICK = 0.06;
/** …e a altura máxima ANTES da correção. Depois ele passa de 210 mm. */
const RAIL_MAX_H = 0.25;
/** Quão longe do pé do baú o perfil ainda é o DE PISO. */
const RAIL_FOOT = 0.30;
/** A fita 3M horizontal que viaja colada no perfil. */
const RAIL_TAPE_RE = /faixa.?3m/i;

/**
 * O TRILHO DE PISO DO FLANCO, pela régua do semirreboque.
 *
 * *"o frame metálico da lateral inferior deve ser completamente substituído
 * pelo do semirreboque"* — Kennedy, 2026-08-19, com print.
 *
 * O material já vem certo do asset (o enxerto de `metal-galvanizado-mantido`);
 * o que falta é a FORMA, e ela é resolvida sem inventar geometria:
 *
 *  1. **os 70 mm de altura** saem de mover para cima os vértices da METADE
 *     SUPERIOR da seção. Um perfil de 140 mm vira um de 210 mm com a dobra de
 *     cima intacta e 70 mm a mais de alma — que é como um perfil mais alto é
 *     feito de verdade. Escalar a seção inteira em 1,5× seria a outra saída, e
 *     é pior: engorda as dobras, que têm raio de fábrica e não de proporção.
 *  2. **o degrau em X** é uma translação, POR FLANCO. O baú não é simétrico
 *     (§26.1) — a pele direita está 8 mm mais fora que a esquerda —, então um
 *     deslocamento único deixaria um lado enterrado e o outro solto.
 *  3. **a fita 3M horizontal acompanha**, com o MESMO deslocamento em X. Ela
 *     está hoje 0,9 mm para dentro da face do perfil e é assim que ela aparece;
 *     mover só o perfil a enterraria. A altura dela não muda: medida, ela já
 *     está em piso −51,8…−1,8 mm, contra os −51,9…−1,9 do semirreboque.
 *
 * @returns quantas malhas de perfil e de fita foram corrigidas.
 */
/* ===========================================================================
   O TRILHO DE TOPO: fechar os rebaixos de rebite e pôr o filete da junta
   ===========================================================================
   *"nesse frame metálico lateral superior, crie um filete, levemente elevado
   entre ele e a parte branca, de 5x8 mm, e feche os buracões que são para
   rebite, já que os rebites devem ser gerados sob demanda mais tarde de acordo
   com o tamanho do implemento"* — Kennedy, 2026-08-20.

   O PORQUÊ DO PEDIDO está na comparação com o semirreboque, e é ela que dá a
   régua. Na mesma faixa, os dois implementos têm peças completamente
   diferentes:

       semirreboque   26 × 210 × 14580 mm    412 tri   uma peça, LISA
       sobrechassi    65 × 103 ×  3000 mm  3 004 tri   seis peças, FURADAS

   Mil por cento mais triângulo para a mesma tira de metal, e o excedente é
   furo: o bake trouxe os rebites MODELADOS na chapa. Isso briga com
   `addPlateRivets()`, que gera a rebitagem sob demanda a partir do tamanho do
   implemento — furo assado é furo no passo do desenhista, não no passo do baú
   que o estúdio monta.

   ⚠️ E NÃO SÃO BURACOS VAZADOS. A sonda topológica devolveu ZERO aresta de
   borda nas seis peças, o que primeiro me fez concluir que não havia furo
   nenhum. São REBAIXOS FECHADOS — furo com fundo —, e o que os denuncia é o
   histograma de profundidade a partir da face:

       0 mm:   12 vértices     (os cantos do perfil)
       6 mm: 1454 vértices     ← a FACE, e as bordas dos rebaixos
       8 mm: 1454 vértices     ← o FUNDO dos rebaixos

   Dois picos gêmeos: cada furo é um anel na face e o mesmo anel 2 mm mais
   fundo. Fechá-los é levar o fundo até a face — os triângulos da parede do
   furo ficam coplanares e somem, sem mexer em contagem de vértice, em índice,
   em UV nem na caixa envolvente (o fundo anda para FORA, e para dentro do que
   a caixa já continha). */

/** Quanto o fundo de um rebaixo pode estar da face para ainda ser rebaixo. */
const POCKET_MAX_DEPTH = 0.012;
/** Raio em torno do centro de um rebaixo que ainda é rebaixo. O furo modelado
 *  tem Ø 4,6 mm; 4 mm de raio cobrem o anel e o chanfro dele e param bem antes
 *  dos 12 vértices do contorno da peça, que ficam a mais de 11 mm da ponta. */
const POCKET_R = 0.004;
/* ⚠️ NÃO HÁ AFUNDAMENTO. Foi tentado (0,4 mm atrás da face, na hipótese de que
   o rebaixo fosse um APLIQUE sobre uma chapa sólida) e não mudou nada — o que
   provou que ele é FURO de verdade: o fundo trazido ao plano PREENCHE a
   abertura, sem sobreposição e sem briga de profundidade. O que restava era a
   UV, e é ela que o bloco no laço conserta. */
/** Altura e saliência do filete da junta, na ordem em que o dono os disse. */
const BEAD_H = 0.006;
/* 5 → 3 mm: *"deixe essa fita que você adicionou levemente mais fino, a altura
   ficou boa"* — Kennedy, 2026-08-20, com o filete já na tela. */
const BEAD_PROUD = 0.002;

/**
 * Fecha os rebaixos de rebite do trilho de topo e põe o filete da junta.
 *
 * As duas coisas saem da MESMA medição das mesmas peças, e é por isso que são
 * uma função só: "onde está o trilho de topo" é a pergunta cara, e respondê-la
 * duas vezes seria a receita de as duas respostas divergirem.
 *
 * @param root       a raiz do implemento
 * @param roofYMundo a cota do teto, em MUNDO — a mesma régua de `profile`
 * @returns quantas peças foram tratadas
 */
export function dressTopRail(root: THREE.Object3D, roofYMundo: number): number {
  root.updateWorldMatrix(true, true);
  const toLocal = root.matrixWorld.clone().invert();
  const tetoR = cotaNaRaiz(root, roofYMundo);

  /* ---- QUEM É O TRILHO DE TOPO ----
     Por FORMA e por COTA, não por material: `metal-estrutura-principal-padrao`
     é o material de meia estrutura do implemento, e no semirreboque a mesma
     peça é `metal-galvanizado-mantido`. O que é próprio dela é ser CORRIDA
     (mais de meio metro de z), morar no flanco (|x| > 0,9 m) e encostar no
     teto. */
  const pecas: { o: THREE.Mesh; b: THREE.Box3; sgn: number }[] = [];
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry || !o.visible) return;
    if (/^(TRAILER_|PLACA_|FILETE_)/.test(o.name)) return;
    const b = boxOf(o, toLocal);
    if (!b) return;
    if (b.max.z - b.min.z < 0.5) return;
    const cx = (b.min.x + b.max.x) / 2;
    if (Math.abs(cx) < 0.9) return;
    if (b.max.y < tetoR - 0.06) return;
    const h = b.max.y - b.min.y;
    if (h < 0.05 || h > 0.30) return;
    pecas.push({ o, b, sgn: cx > 0 ? 1 : -1 });
  });
  if (!pecas.length) {
    console.warn('[bake] trilho de topo: não encontrado — sem filete e sem fechar rebaixo.');
    return 0;
  }

  /* ---- 1. OS REBAIXOS ---- */
  let fechados = 0, comFuro = 0, normaisRefeitas = 0, uvsRefeitas = 0, trisApagados = 0;
  /* ▶▶ ONDE CADA FURO ESTÁ, por flanco — e não só o passo dele.
     ⚠️ *"os furos do frame metálico superior continuam lá e nem batem com os
     rebites em si"* — Kennedy, 2026-08-22. Eram DUAS fileiras periódicas de
     passos diferentes (a do bake, 102 mm, e a minha, ancorada na testeira),
     batendo uma contra a outra: de longe isso é um borrão irregular de pontos
     grandes e pequenos, que é exatamente o que a foto dele mostra.
     A resposta é a única que fecha as duas queixas de uma vez: **o rebite vai
     EM CIMA do furo**. Para isso a receita deixa de ser "passo + fase" e passa
     a ser a LISTA das posições, guardada em FRAÇÃO do vão do flanco — que é
     como ela sobrevive ao esticamento, já que o trilho estica com o baú
     (`z: 'span'`) e os furos esticam junto. */
  const furosPorFlanco = new Map<number, { z: number[]; y: number; xFace: number;
    z0: number; z1: number; yPe: number; yTopo: number; face: number }>();
  for (const p of pecas) {
    const fora = p.sgn > 0 ? p.b.max.x : p.b.min.x;
    /* O histograma, em décimos de milímetro a partir da face de fora. */
    const hist = new Map<number, number>();
    editVerts(p.o, toLocal, (v) => {
      const d = (fora - v.x) * p.sgn;
      if (d >= -0.0005 && d <= 0.030) {
        const bin = Math.round(d * 10000);
        hist.set(bin, (hist.get(bin) || 0) + 1);
      }
      return false;                       // varredura: NÃO move nada ainda
    });
    const picos = [...hist.entries()].sort((a, b) => b[1] - a[1]);
    if (picos.length < 2) continue;
    /* A FACE é o pico mais RASO entre os dois maiores; o FUNDO é o outro. Pegar
       "o maior" e "o segundo maior" sem ordenar por profundidade inverteria o
       par nas peças em que o fundo tem um vértice a mais que a face — e o
       resultado seria empurrar a face para DENTRO, afundando a chapa inteira. */
    const dois = [picos[0][0], picos[1][0]].sort((a, b) => a - b);
    const face = dois[0] / 10000, fundo = dois[1] / 10000;
    const prof = fundo - face;
    if (!(prof > 0.0005 && prof <= POCKET_MAX_DEPTH)) continue;
    if (picos[1][1] < 20) continue;               // dois picos, mas não é rebitagem

    /* ▶▶▶ O REBAIXO NÃO SE FECHA NO PLANO DA FACE — ELE SE AFUNDA ATRÁS DELA.
       ------------------------------------------------------------------------
       ⚠️⚠️ ESTA É A TERCEIRA TENTATIVA, E AS DUAS PRIMEIRAS ERRARAM PELA MESMA
       SUPOSIÇÃO NÃO VERIFICADA: que o furo era um FURO. A §33.7 levou o fundo
       até a face ("coplanar, sem mexer em vértice, índice, UV nem caixa"); a
       §33.8 concluiu que o que sobrava era normal e reescreveu as normais; a
       §38 tirou a peneira de 0,9 e deixou o plano da face com **cosseno 1,000
       em 16 392 vértices**. E o tracinho continuou lá, nas três.

       A CONTAGEM DE VÉRTICES É QUE DIZ O QUE ELE É. No plano da face de uma
       peça há 2 924 vértices: 12 do contorno e 2 912 em 30 pares anel+fundo de
       48 lados. **Uma face com 30 furos não se triangula com 12 vértices de
       contorno** — logo a face é uma QUAD INTEIRA e os rebaixos são um
       APLIQUE POR CIMA dela, não uma abertura nela.

       E aplique coplanar é Z-FIGHTING. Foi por isso que o difuso puro do
       experimento não mostrou tracinho nenhum (`diag/checks-scania6-0822.mjs`,
       q6-a3): sem o espelho, as duas superfícies em briga têm a MESMA cor e a
       briga fica invisível. Com `metalness 1` e `rugosidade 0,30` cada pixel
       ganho pelo aplique reflete de um ângulo levemente diferente, e o que se
       vê é o tracinho.

       Então o conserto não é alinhar: é TIRAR DA FRENTE. A face é sólida e
       opaca; 0,4 mm atrás dela o rebaixo inteiro — anel, parede e fundo —
       simplesmente não é desenhado. Sem furo na malha, sem normal a corrigir,
       sem briga de profundidade.

       ⚠️ E AFUNDA O ANEL JUNTO, não só o fundo. O anel mora NO plano da face e
       é metade do aplique; deixá-lo para trás manteria metade da briga. Quem
       diz quem é anel é a POSIÇÃO em torno do centro do rebaixo — e os centros
       já foram medidos logo acima, para a receita do rebite. */
    const centros: { y: number; z: number }[] = [];
    {
      const brutos: { y: number; z: number }[] = [];
      editVerts(p.o, toLocal, (v) => {
        if (Math.abs((fora - v.x) * p.sgn - fundo) < 0.0006) brutos.push({ y: v.y, z: v.z });
        return false;
      });
      /* Agrupa por proximidade em (y, z) — cada anel é um rebaixo. */
      const usado = new Uint8Array(brutos.length);
      for (let i = 0; i < brutos.length; i++) {
        if (usado[i]) continue;
        const fila = [i]; usado[i] = 1;
        let sy = brutos[i].y, sz = brutos[i].z, q = 1;
        while (fila.length) {
          const a = fila.pop() as number;
          for (let j = 0; j < brutos.length; j++) {
            if (usado[j]) continue;
            const dy = brutos[a].y - brutos[j].y, dz = brutos[a].z - brutos[j].z;
            if (dy * dy + dz * dz > POCKET_R * POCKET_R) continue;
            usado[j] = 1; fila.push(j); sy += brutos[j].y; sz += brutos[j].z; q++;
          }
        }
        if (q >= 6) centros.push({ y: sy / q, z: sz / q });
      }
    }
    if (centros.length >= 3) {
      const e = furosPorFlanco.get(p.sgn) ?? {
        z: [], y: 0, z0: Infinity, z1: -Infinity, yPe: Infinity, yTopo: -Infinity, face,
        /* ▶▶▶ O X **ABSOLUTO** DA FACE, e não a profundidade dela.
           ----------------------------------------------------------------
           *"agora o frame superior tem uma linha seguindo os rebites"* —
           Kennedy, 2026-08-22. `addTopRailRivets()` remontava o x por
           `fora − face`, e os dois termos vinham de referenciais DIFERENTES:
           aqui `fora` é a caixa DESTA PEÇA do trilho (1296,5 mm), lá era a
           caixa UNIDA do flanco, que engorda com o filete e com o que mais
           encoste no perfil (1308 mm). Doze milímetros de erro punham a
           calota FLUTUANDO fora da chapa — medido: rebite em 1306,6…1308,8
           contra a face em 1296,5 —, e um disco solto de 11 mm a cada 102 mm
           lido de esguelha vira uma FITA de luz. Guardar o x já resolvido
           tira o segundo referencial da conta. */
        xFace: 0,
      };
      /* O plano é a MODA do x dos vértices da peça, em caixas de meio
         milímetro: a chapa do perfil é, de longe, a maior superfície dele
         (medido: 2 918 vértices em |x| 1296,5 contra 28 no segundo lugar).
         Reconstruir por `fora − face` parecia equivalente e não é: num flanco
         o bake tem uma aba 8 mm mais para fora que no outro, e ali o par de
         picos do histograma cai na aba em vez de na chapa. A moda não tem esse
         jeito de errar porque não depende de nenhum outro termo. */
      {
        const hx = new Map<number, number>();
        editVerts(p.o, toLocal, (v) => {
          if (Math.abs(v.x) < 0.9) return false;
          const k = Math.round(v.x * 2000);
          hx.set(k, (hx.get(k) || 0) + 1);
          return false;
        });
        let kx = 0, kq = 0;
        for (const [k, q] of hx) if (q > kq) { kq = q; kx = k; }
        const xm = kx / 2000;
        /* Entre peças do mesmo flanco fica a mais EXTERNA: é nela que a
           rebitagem aparece. */
        if (!e.xFace || Math.abs(xm) > Math.abs(e.xFace)) e.xFace = xm;
      }
      /* A fileira é a MODA do y dos centros — as duas pontas da peça também
         têm rebaixo e ficam fora dela. */
      const porY = new Map<number, number>();
      for (const c of centros) {
        const k = Math.round(c.y * 1000);
        porY.set(k, (porY.get(k) || 0) + 1);
      }
      let ky = 0, kn = 0;
      for (const [k, q] of porY) if (q > kn) { kn = q; ky = k / 1000; }
      for (const c of centros) if (Math.abs(c.y - ky) < 0.002) e.z.push(c.z);
      e.y = ky;
      e.z0 = Math.min(e.z0, p.b.min.z); e.z1 = Math.max(e.z1, p.b.max.z);
      e.yPe = Math.min(e.yPe, p.b.min.y); e.yTopo = Math.max(e.yTopo, p.b.max.y);
      furosPorFlanco.set(p.sgn, e);
    }

    const dentroDeRebaixo = (y: number, z: number) => centros.some((c) => {
      const dy = y - c.y, dz = z - c.z;
      return dy * dy + dz * dz <= POCKET_R * POCKET_R;
    });
    const alvoX = fora - face * p.sgn;
    const n = editVerts(p.o, toLocal, (v) => {
      const d = (fora - v.x) * p.sgn;
      /* Todo vértice do aplique: do plano da face até o fundo, e dentro do
         raio de algum rebaixo. Fora do raio é a chapa, e ela não se toca. */
      if (d < face - 0.0002 || d > fundo + 0.001) return false;
      if (!dentroDeRebaixo(v.y, v.z)) return false;
      v.x = alvoX;
      return true;
    });
    if (!n) continue;
    fechados += n;
    comFuro++;

    /* ▶▶▶ E OS TRIÂNGULOS DELES SAEM DO ÍNDICE — a única coisa que ainda não
       tinha sido tentada, e a que fecha o assunto.
       ------------------------------------------------------------------------
       Aplainar não bastou, endireitar a normal não bastou, uniformizar a UV não
       bastou e afundar não bastou (ver o bloco 1.5). O que sobra é não desenhar:
       todo triângulo cujos TRÊS vértices caem dentro de algum rebaixo deixa de
       ser referenciado. Cirurgia só de ÍNDICE — nenhum vértice se move, nenhum
       atributo muda de tamanho, e a caixa envolvente não se altera —, a mesma
       técnica de `buildLiveryPanels()` quando ele tira os triângulos da chapa do
       corpo branco.

       ⚠️ E ISTO SÓ É SEGURO PORQUE O REBAIXO É UM APLIQUE, NÃO UMA ABERTURA —
       e essa é a medida que faltava: afundar o fundo 0,4 mm ATRÁS da face não
       mudou pixel nenhum na rodada anterior. Se ele fosse furo, afundar teria
       aberto uma cova visível; como é aplique sobre chapa cheia, o que está
       atrás dele é chapa, e apagá-lo mostra a chapa. */
    {
      const geoIdx = p.o.geometry as THREE.BufferGeometry;
      const idx = geoIdx.getIndex();
      const posIdx = geoIdx.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (idx && posIdx) {
        const paraRaizIdx = new THREE.Matrix4().multiplyMatrices(toLocal, p.o.matrixWorld);
        const vd = new THREE.Vector3();
        /* Um passe por VÉRTICE marca quem é rebaixo; o passe por triângulo só
           consulta a marca. Sem isto seriam três transformações por triângulo. */
        const ehRebaixo = new Uint8Array(posIdx.count);
        for (let i = 0; i < posIdx.count; i++) {
          vd.set(posIdx.getX(i), posIdx.getY(i), posIdx.getZ(i)).applyMatrix4(paraRaizIdx);
          const d = (fora - vd.x) * p.sgn;
          if (d < face - 0.0005 || d > fundo + 0.001) continue;
          if (dentroDeRebaixo(vd.y, vd.z)) ehRebaixo[i] = 1;
        }
        const fica: number[] = [];
        let apagados = 0;
        for (let t2 = 0; t2 < idx.count; t2 += 3) {
          const a = idx.getX(t2), b2 = idx.getX(t2 + 1), c2 = idx.getX(t2 + 2);
          if (ehRebaixo[a] && ehRebaixo[b2] && ehRebaixo[c2]) { apagados++; continue; }
          fica.push(a, b2, c2);
        }
        if (apagados) {
          const Arr = posIdx.count > 65535 ? Uint32Array : Uint16Array;
          geoIdx.setIndex(new THREE.BufferAttribute(new Arr(fica), 1));
          trisApagados += apagados;
        }
      }
    }

    /* ▶▶▶ E A **UV** DELES, que continua valendo para o que sobrou na borda.
       ------------------------------------------------------------------------
       ⚠️⚠️ O MATERIAL DESTE TRILHO TEM `roughnessMap`. Foi a última coisa que
       eu fui olhar e era a primeira que explicava tudo:

           metal-estrutura-principal-padrao__polido
           metalness 1 · roughness 0,30 · roughnessMap SIM · map não

       O rebaixo é uma ILHA DE UV própria — ele foi modelado como furo e o
       desempacotamento deu a ele um pedaço do atlas que não é o pedaço da
       chapa em volta. Aplainar a geometria e endireitar as normais não muda
       isso: os triângulos ficam no mesmo plano, com a mesma normal, e AINDA
       assim amostram outra rugosidade. Num metal de rugosidade 0,30 — um
       espelho — a diferença aparece como um tracinho.

       É por isso que os experimentos "sem material" limpavam a faixa e o
       material de verdade não: `MeshBasicMaterial` e `MeshStandardMaterial`
       difuso puro NÃO TÊM MAPA, então a ilha de UV deixava de existir para
       eles. Eu li aquilo como "é sombreamento" e fui atrás das normais duas
       vezes; era TEXTURA.

       O conserto é a mesma ideia das outras duas metades — fazer o rebaixo
       parar de ser distinto: toda a ilha passa a amostrar UM ponto só do
       atlas, o do vizinho de chapa mais próximo. A rugosidade da faixa fica
       uniforme e o rebaixo some de vez.

       ⚠️ O ponto é o de um vértice DA CHAPA, não uma constante: o atlas deste
       bake não é uniforme, e cravar (0,0) traria a rugosidade de outro canto
       da textura para dentro do trilho. */
    {
      const geoUv = p.o.geometry as THREE.BufferGeometry;
      const uv = geoUv.getAttribute('uv') as THREE.BufferAttribute | undefined;
      const posUv = geoUv.getAttribute('position') as THREE.BufferAttribute | undefined;
      if (uv && posUv) {
        const paraRaizUv = new THREE.Matrix4().multiplyMatrices(toLocal, p.o.matrixWorld);
        const vv2 = new THREE.Vector3();
        /* ⚠️ NÃO É UMA AMOSTRA, É O CAMPO. Dar a mesma UV a todos os 2 720
           vértices do rebaixo os deixa uniformes ENTRE SI e diferentes da chapa
           em volta, que interpola: a marca deixaria de ser um anel e viraria um
           quadrado. O que fecha é continuar o campo da própria chapa.

           A face é uma QUAD (medido: 2 726 vértices no plano, 2 720 deles de
           rebaixo — sobram ~6, os cantos), e sobre uma quad o campo de UV é
           AFIM em (y, z). Ajusta-se `u = a + b·y + c·z` e `v = d + e·y + f·z`
           por mínimos quadrados nesses cantos e avalia-se nos vértices do
           rebaixo. Com isso a ilha some: não há UV de rebaixo, há a UV que
           aquele ponto da chapa teria. */
        const naFace: number[] = [];
        const cantos: { y: number; z: number; u: number; v: number }[] = [];
        for (let i = 0; i < posUv.count; i++) {
          vv2.set(posUv.getX(i), posUv.getY(i), posUv.getZ(i)).applyMatrix4(paraRaizUv);
          if (Math.abs((fora - vv2.x) * p.sgn - face) > 0.0003) continue;
          if (dentroDeRebaixo(vv2.y, vv2.z)) { naFace.push(i); continue; }
          cantos.push({ y: vv2.y, z: vv2.z, u: uv.getX(i), v: uv.getY(i) });
        }
        /* Mínimos quadrados 3×3 sobre [1, y, z]. Três cantos não colineares
           bastam; abaixo disso não há campo a ajustar e a UV fica como está. */
        const ajusta = (alvo: 'u' | 'v'): [number, number, number] | null => {
          let s00 = 0, s01 = 0, s02 = 0, s11 = 0, s12 = 0, s22 = 0;
          let t0 = 0, t1 = 0, t2 = 0;
          for (const c of cantos) {
            const w = alvo === 'u' ? c.u : c.v;
            s00 += 1; s01 += c.y; s02 += c.z;
            s11 += c.y * c.y; s12 += c.y * c.z; s22 += c.z * c.z;
            t0 += w; t1 += w * c.y; t2 += w * c.z;
          }
          const A = [[s00, s01, s02], [s01, s11, s12], [s02, s12, s22]];
          const b = [t0, t1, t2];
          /* Eliminação de Gauss com pivô parcial, 3×3. */
          for (let i = 0; i < 3; i++) {
            let piv = i;
            for (let j = i + 1; j < 3; j++) if (Math.abs(A[j][i]) > Math.abs(A[piv][i])) piv = j;
            if (Math.abs(A[piv][i]) < 1e-12) return null;
            [A[i], A[piv]] = [A[piv], A[i]];
            [b[i], b[piv]] = [b[piv], b[i]];
            for (let j = i + 1; j < 3; j++) {
              const f = A[j][i] / A[i][i];
              for (let k = i; k < 3; k++) A[j][k] -= f * A[i][k];
              b[j] -= f * b[i];
            }
          }
          const x = [0, 0, 0];
          for (let i = 2; i >= 0; i--) {
            let acc = b[i];
            for (let k = i + 1; k < 3; k++) acc -= A[i][k] * x[k];
            x[i] = acc / A[i][i];
          }
          return [x[0], x[1], x[2]];
        };
        const cu = cantos.length >= 3 ? ajusta('u') : null;
        const cv = cantos.length >= 3 ? ajusta('v') : null;
        if (cu && cv && naFace.length) {
          for (const i of naFace) {
            vv2.set(posUv.getX(i), posUv.getY(i), posUv.getZ(i)).applyMatrix4(paraRaizUv);
            uv.setXY(i,
              cu[0] + cu[1] * vv2.y + cu[2] * vv2.z,
              cv[0] + cv[1] * vv2.y + cv[2] * vv2.z);
          }
          uv.needsUpdate = true;
          uvsRefeitas += naFace.length;
        }
      }
    }


    /* ---- E AS NORMAIS, QUE SÃO O TRABALHO INTEIRO ----
       Levar o fundo até a face apaga o RELEVO e não apaga a MARCA: os
       triângulos da parede do furo ficam coplanares com a chapa mas continuam
       com a normal apontando para o lado, e o sombreamento os desenha como
       anéis escuros.

       ⚠️⚠️ A PENEIRA `cos > 0,9` ERA CEDO DEMAIS, e é por isso que a marca
       sobreviveu a DUAS rodadas. A versão anterior só reescrevia a normal do
       vértice que ainda não olhasse para fora, com o argumento de poupar as
       quinas do perfil. O argumento é bom e o limiar era errado por uma ordem
       de grandeza: **este trilho é `metal-estrutura-principal-padrao__polido`,
       metalicidade 1 e rugosidade 0,30 — um ESPELHO.** Num espelho, meio grau
       de diferença de normal muda o raio refletido em um grau, e no horizonte
       céu/chão isso é a diferença entre um pixel claro e um escuro. `> 0,9`
       deixava passar até 25°.

       O EXPERIMENTO QUE FECHOU (2026-08-22, `diag/checks-scania6-0822.mjs`): com as
       mesmas peças pintadas de DIFUSO PURO (metalicidade 0, rugosidade 1) os
       tracinhos SOMEM; com `MeshBasicMaterial` também. Geometria e profundidade
       já estavam certas — um pico só, a 6,0 mm — e o que restava era shading.

       E O CENSO DIZ QUE A PENEIRA NÃO É MAIS NECESSÁRIA: no plano da face há
       **2 924 vértices e só 6** com cosseno abaixo de 0,999. As quinas do
       perfil que o argumento antigo protegia **não moram no plano da face** —
       elas estão a 0,0 e a 2,1 mm dele (medido). Então reescrever TODO vértice
       do plano da face é seguro e é o que torna a chapa um plano só.

       ⚠️ CONTINUA VALENDO: NÃO SE USA `computeVertexNormals()`. Ele faz média
       por vértice e o perfil é uma caixa — as quinas viveriam suaves, e um
       trilho de topo com quina redonda é um defeito maior que o anel. */
    const geo = p.o.geometry as THREE.BufferGeometry;
    const nor = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const pos2 = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!nor || !pos2) continue;
    const paraRaiz = new THREE.Matrix4().multiplyMatrices(toLocal, p.o.matrixWorld);
    const normalM = new THREE.Matrix3().getNormalMatrix(paraRaiz);
    const inversaN = normalM.clone().invert();
    const vv = new THREE.Vector3();
    const nn = new THREE.Vector3();
    let refeitas = 0;
    for (let i = 0; i < pos2.count; i++) {
      vv.set(pos2.getX(i), pos2.getY(i), pos2.getZ(i)).applyMatrix4(paraRaiz);
      if (Math.abs((fora - vv.x) * p.sgn - face) > 0.0002) continue;
      nn.set(nor.getX(i), nor.getY(i), nor.getZ(i)).applyMatrix3(normalM).normalize();
      /* ⚠️ SEM PENEIRA. Ver o bloco acima: 0,9 deixava 25° passar e o trilho é
         um espelho. Quem já está exatamente para fora não muda de valor — a
         escrita é idempotente e custa uma multiplicação de matriz. */
      if (nn.x * p.sgn > 0.99999) continue;
      nn.set(p.sgn, 0, 0).applyMatrix3(inversaN).normalize();
      nor.setXYZ(i, nn.x, nn.y, nn.z);
      refeitas++;
    }
    if (refeitas) { nor.needsUpdate = true; normaisRefeitas += refeitas; }
  }

  /* ---- 1.5 O QUE SOBRA DO TRACINHO, E O QUE JÁ FOI ELIMINADO ----
     ------------------------------------------------------------------------
     ⚠️ **AINDA EM ABERTO.** *"continuam marcações dos rebites no frame metálico
     superior"* — Kennedy, 2026-08-22, terceira vez. As quatro metades abaixo
     foram consertadas e MEDIDAS nesta rodada, e o tracinho continua:

         profundidade  um pico só, 6,0 mm — o rebaixo está no plano da chapa
         normais       16 356 vértices no plano, TODOS com cosseno 1,00000
         UV            o campo afim da própria chapa (mínimos quadrados nos
                       cantos) — nenhuma ilha, e o material tem `roughnessMap`
         z-fighting    afundar o rebaixo 0,4 mm atrás da face não mudou nada,
                       o que prova que ele é FURO e o fundo o preenche

     E O QUE A BANCADA JÁ ELIMINOU, cada um com o quadro guardado em
     `tools/studio-bench/shots/` (`diag/checks-scania6/7/8/9-0822.mjs`):

         q9-2  fusão SOLTA + as 6 peças escondidas ....... faixa LIMPA
         q9-1  fusão SOLTA, tudo visível ................. tracinho
             ⇒ ele é das próprias `estrutura-principal-90…95`, não de vizinho
               e não da fusão
         q6-a1 material BÁSICO (sem luz, sem normal) ..... LIMPA
         q6-a3 difuso puro (metal 0, rugosidade 1) ....... LIMPA
         q8-3  sem `roughnessMap` ........................ tracinho (mais fraco)
         q8-2  sem o filete ............................. tracinho
         q8-1  sem os rebites gerados ................... tracinho
             ⇒ é fenômeno ESPECULAR: só aparece com metalicidade 1

     E o que NÃO resolve, tentado e revertido nesta mesma rodada: baixar o
     brilho do perfil para a rugosidade 0,62 do semirreboque. O tracinho
     sobrevive a ela — ou seja quem o revela é a METALICIDADE, não o lóbulo — e
     escurecer um perfil aprovado sem consertar o defeito é trocar um problema
     por outro.

     O PRÓXIMO PASSO, para quem pegar isto: bissecção POR FAIXA DE TRIÂNGULO
     dentro de uma das seis peças, com a fusão solta. O conjunto de candidatos
     já está reduzido a uma malha de 3 004 triângulos. */

  /* ---- 2. O FILETE DA JUNTA ----
     Um por FLANCO, correndo toda a extensão do trilho daquele lado. A junta é
     a face de BAIXO do trilho (é ali que a chapa branca começa), e o filete
     fica centrado nela: 8 mm de altura, 4 para cada lado da costura.

     A saliência é medida a partir da face de fora DO TRILHO, não da pele: o
     trilho já está recuado uns 6 mm em relação à crista do friso, então 5 mm
     de saliência põem o filete rente-a-levemente-proud do conjunto — que é o
     "levemente elevado" do pedido. */
  const flancos = new Map<number, { z0: number; z1: number; y: number; x: number; o: THREE.Mesh }>();
  for (const p of pecas) {
    const e = flancos.get(p.sgn);
    const fora = p.sgn > 0 ? p.b.max.x : p.b.min.x;
    if (!e) {
      flancos.set(p.sgn, { z0: p.b.min.z, z1: p.b.max.z, y: p.b.min.y, x: fora, o: p.o });
    } else {
      e.z0 = Math.min(e.z0, p.b.min.z);
      e.z1 = Math.max(e.z1, p.b.max.z);
      e.y = Math.min(e.y, p.b.min.y);
      if (Math.abs(fora) > Math.abs(e.x)) e.x = fora;
    }
  }
  let filetes = 0;
  for (const [sgn, f] of flancos) {
    const len = f.z1 - f.z0;
    if (!(len > 0.5)) continue;
    /* ▶▶▶ REDONDO, E SEM ESPELHO.
       ----------------------------------------------------------------------
       *"e agora o frame superior tem uma linha seguindo os rebites"* —
       Kennedy, 2026-08-22. Medido na bancada com a fusão SOLTA (sem soltar,
       esconder a origem não muda pixel nenhum — §23): esconder os dois filetes
       muda uma faixa de **4 px de altura por 1 152 de largura**, e é ela.

       A causa é a forma somada ao acabamento. Era uma `BoxGeometry`: uma face
       PLANA de 8 mm de altura por 8,4 m de comprimento, virada para fora, no
       material do trilho — metalicidade 1, rugosidade 0,30. Um espelho plano
       daquele tamanho devolve a MESMA coisa em toda a extensão, então a
       lê-se uma fita de brilho constante em vez de um vinco. Um filete de
       verdade é uma meia-cana: o brilho corre num fio no alto da curva e o
       resto desce em degradê.

       Então: cilindro no lugar da caixa (metade enterrada na chapa, saliência
       igual à de antes e altura visível de 7,7 mm contra os 8 pedidos), e uma
       cópia do material com um dedo a mais de rugosidade — a mesma medida
       tomada na cabeça do rebite, e pelo mesmo motivo. */
    /* ⚠️ REDONDO FOI TENTADO E É PIOR: a meia-cana devolve mais luz que a face
       plana (medido no mesmo pixel: 179/146/173 contra 93/123/155), porque a
       curva sempre acha um ângulo que aponta para o céu. Fica a face plana, que
       é também a forma que o pedido descreve, e o que muda é o ACABAMENTO. */
    const geo = new THREE.BoxGeometry(BEAD_PROUD, BEAD_H, len);
    const base = (Array.isArray(f.o.material) ? f.o.material[0] : f.o.material) as
      THREE.MeshStandardMaterial;
    const mat = base.clone();
    mat.name = 'trilho-filete';
    mat.roughness = Math.min(1, (base.roughness ?? 0.3) + 0.25);
    const bead = new THREE.Mesh(geo, mat);
    bead.name = sgn > 0 ? 'FILETE_TRILHO_TOPO_R' : 'FILETE_TRILHO_TOPO_L';
    bead.position.set(
      f.x + (BEAD_PROUD / 2 - 0.0005) * sgn,   // meio milímetro cravado na chapa
      f.y, (f.z0 + f.z1) / 2,
    );
    bead.castShadow = bead.receiveShadow = true;
    root.add(bead);
    filetes++;
  }

  /* A RECEITA FICA NA RAIZ, para `addTopRailRivets()` reproduzir a rebitagem a
     cada medida. Ausente = este bake não trazia rebite modelado no trilho, e
     nesse caso NÃO se inventa nenhum: o semirreboque tem o trilho liso e é o
     padrão ouro. */
  const raizUd = root.userData as { tsTopRailRivets?: unknown };
  const porFlanco = [...furosPorFlanco.entries()]
    .filter(([, e]) => e.z.length >= 3 && e.z1 > e.z0)
    .map(([sgn, e]) => {
      /* ▶▶▶ PASSO E MARGEM, não a lista de furos.
         --------------------------------------------------------------------
         *"isso não adianta, desde que siga até mesmo quando o tamanho do frame
         metálico mudar"* — Kennedy, 2026-08-22.

         Guardar a FRAÇÃO de cada furo faz a fileira acompanhar o esticamento —
         mas acompanha ESTICANDO: 84 rebites num baú de 6,9 m dão passo de
         82 mm e num de 9,9 m dão 118 mm. Rebite não estica; quem estica é a
         CHAPA, e um baú mais longo leva MAIS rebites, não rebites mais
         afastados. Então o que se mede é o passo e a folga da ponta, e o
         número sai da conta a cada medida.

         O passo é a MEDIANA dos vãos entre furos vizinhos, não a média: um
         furo perdido pela peneira do agrupamento dobra um vão e a média vai
         junto; a mediana não se move. */
      const zs = [...e.z].sort((a, b) => a - b);
      const vaos: number[] = [];
      for (let i = 1; i < zs.length; i++) vaos.push(zs[i] - zs[i - 1]);
      vaos.sort((a, b) => a - b);
      const passo = vaos.length ? vaos[vaos.length >> 1] : 0.102;
      /* A folga da ponta: a média das duas, que é o que um gabarito de furação
         faz — ele centra a fileira no perfil. */
      const margem = Math.max(0, ((zs[0] - e.z0) + (e.z1 - zs[zs.length - 1])) / 2);
      return {
        sgn,
        passo,
        margem,
        xFace: e.xFace,
        /* A FILEIRA, como QUEDA A PARTIR DO TOPO do perfil — não como fração
           da altura dele. Mesmo motivo do `xFace`: a altura de referência de lá
           é a caixa UNIDA do flanco e a daqui é a da peça, e uma fração de uma
           não é a fração da outra. O perfil não muda de seção quando o baú
           cresce; só sobe. Então o que se guarda é a distância RÍGIDA do topo
           até a fileira, que sobe junto sem esticar. */
        queda: e.yTopo - e.y,
        face: e.face,
        n: zs.length,
      };
    });
  if (porFlanco.length) raizUd.tsTopRailRivets = { porFlanco };
  else delete raizUd.tsTopRailRivets;

  console.info('[bake] trilho de topo vestido —', comFuro, 'de', pecas.length,
    'peça(s) com rebaixo fechado (', fechados, 'vértices,',
    normaisRefeitas, 'normais,', uvsRefeitas, 'UVs,', trisApagados, 'triângulos) ·', filetes,
    `filete(s) de ${(BEAD_PROUD * 1000).toFixed(0)}×${(BEAD_H * 1000).toFixed(0)} mm`,
    porFlanco.length
      ? '· rebitagem medida: ' + porFlanco.map((f) => `${f.sgn > 0 ? '+x' : '-x'}`
        + ` passo ${(f.passo * 1000).toFixed(1)} mm · margem ${(f.margem * 1000).toFixed(0)} mm`
        + ` (${f.n} furos, ${(f.queda * 1000).toFixed(0)} mm abaixo do topo,`
        + ` chapa em |x| ${(Math.abs(f.xFace) * 1000).toFixed(1)} mm)`).join(' · ')
      : '· sem rebite modelado neste bake');
  return pecas.length;
}

/* ===========================================================================
   OS REBITES DO TRILHO DE TOPO, GERADOS SOB DEMANDA

   *"esse frame metálico superior ainda mostra os furos dos rebites, mas não
   mostra os rebites em si, e deveria, mas deveria ser in runtime já que deve
   seguir de acordo com o tamanho do baú"* — Kennedy, 2026-08-22.

   É a contraparte de `dressTopRail()`: lá o relevo de fábrica é APAGADO (ele
   está no passo do desenhista, não no passo do baú que o estúdio monta); aqui a
   rebitagem volta, no comprimento corrente e com a receita que aquele apagou.
   As duas metades juntas são o que o pedido descreve — furo que some, rebite
   que aparece, e a contagem seguindo a medida.

   IRMÃ DE `addPlateRivets()`, com três diferenças que valem registro:

     · **a fileira é UMA**, e horizontal. A da chapa é uma COLUNA por emenda,
       vertical, com um rebite por friso;
     · **geometria FUNDIDA e não instanciada**, pelo mesmo motivo daquela — 644
       instâncias existiam na cena do Kennedy e nenhuma chegava ao quadro
       (`drawElementsInstanced` no Firefox/RX 570). 84 calotas por flanco de ~60
       triângulos são 5 k triângulos, nada numa cena de 1,5 M;
     · **material próprio, nunca clone do bake**, também pelo mesmo motivo: um
       clone carrega os ganchos de shader que o acabamento pendura, e um gancho
       cujo uniforme ninguém vincula compila na bancada e falha no app.

   ⚠️ E ELA NÃO INVENTA REBITE. Sem `tsTopRailRivets` na raiz — ou seja, num
   bake cujo trilho não trazia rebaixo — a função devolve 0 e não cria nada. O
   semirreboque é exatamente esse caso: o trilho dele tem 412 triângulos e é
   LISO, e é o padrão aprovado. */

/** Raio da cabeça.
 *
 *  4,5 → 5,5 → 4,7 mm (2026-08-22). O furo modelado mede Ø 4,6 mm e um rebite
 *  pop com esse corpo tem cabeça de 9 a 9,5 — Ø 9,4 é a peça de catálogo. O
 *  Ø 11 do meio-dia foi para cobrir o anel do furo com folga, e o furo não
 *  existe mais: os triângulos dele saíram do índice em `dressTopRail()`. Então
 *  a cabeça volta à medida da peça real. */
const TOPRAIL_RIVET_R = 0.0047;
/** Quanto a cabeça se levanta da face.
 *
 *  1,6 → 2,2 → 0,9 mm (2026-08-22). *"agora o frame superior tem uma linha
 *  seguindo os rebites"* — Kennedy.
 *
 *  ▶▶▶ A ALTURA DA CABEÇA É O QUE DECIDE SE A FILEIRA LÊ COMO PONTOS OU COMO
 *  FITA, e não o tamanho dela. Uma calota de Ø 11 com 2,2 mm de flecha sobe
 *  22 %: a normal do topo dela abre uns 45° em relação à chapa, e num material
 *  de metalicidade 1 isso significa que ela reflete o CÉU enquanto a chapa ao
 *  redor reflete o pátio escuro. A 8 m o passo de 102 mm cai em sete pixels e
 *  cada cabeça fica sub-pixel — uma fileira de pontos sub-pixel de altíssimo
 *  contraste não lê como pontos, lê como uma linha branca contínua.
 *
 *  Com 0,9 mm sobre Ø 9,4 a flecha é 9,5 % e a normal abre uns 21°: a cabeça
 *  reflete quase o mesmo que a chapa e aparece pelo RELEVO, que é como um
 *  rebite de repuxo aparece de longe num perfil de alumínio. De perto (a foto
 *  de 0,4 m da bancada) as calotas continuam redondas e visíveis. */
const TOPRAIL_RIVET_PROUD = 0.0009;
/** Os nós que esta função cria e destrói. */
const TOPRAIL_RIVET_NODE = 'TRAILER_TOPRAIL_RIVETS';
/** Casa os dois nós, para a exclusão da fusão. */
export const TOPRAIL_RIVET_MESH_RE = /^TRAILER_TOPRAIL_RIVETS_[LR]$/;

/**
 * (Re)constrói a fileira de rebites do trilho de topo, nas medidas correntes.
 *
 * IDEMPOTENTE: apaga o que uma chamada anterior criou. `setTrailerDims()` passa
 * por aqui a cada arraste do controle de comprimento.
 *
 * @param root       a raiz do implemento
 * @param roofYMundo a cota do teto, em MUNDO — a mesma régua de `dressTopRail`
 * @returns quantos rebites entraram
 */
export function addTopRailRivets(root: THREE.Object3D, roofYMundo: number): number {
  /* IDEMPOTÊNCIA primeiro, e antes de qualquer medida: um rebite da passada
     anterior mora no flanco, na altura do trilho, e entraria na busca. */
  const velhos: THREE.Object3D[] = [];
  root.traverse((o) => { if (TOPRAIL_RIVET_MESH_RE.test(o.name || '')) velhos.push(o); });
  for (const o of velhos) {
    o.removeFromParent();
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) m.geometry.dispose();
  }

  const receita = (root.userData as {
    tsTopRailRivets?: { porFlanco: {
      sgn: number; passo: number; margem: number; queda: number; face: number;
      xFace: number }[] };
  }).tsTopRailRivets;
  if (!receita?.porFlanco?.length) return 0;

  root.updateWorldMatrix(true, true);
  const toLocal = root.matrixWorld.clone().invert();
  const tetoR = cotaNaRaiz(root, roofYMundo);

  /* O trilho AGORA — a mesma peneira de `dressTopRail()`, e ela tem de ser a
     mesma: uma segunda definição de "quem é o trilho" divergiria no primeiro
     bake novo. O que muda é o momento (aqui é depois do resize) e a união: os
     rebites correm o flanco INTEIRO, não peça a peça. */
  const flanco = new Map<number, THREE.Box3>();
  const matDoTrilho = new Map<number, THREE.MeshStandardMaterial>();
  const maiorArea = new Map<number, number>();
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry || !o.visible) return;
    if (/^(TRAILER_|PLACA_|FILETE_)/.test(o.name)) return;
    const b = boxOf(o, toLocal);
    if (!b) return;
    if (b.max.z - b.min.z < 0.5) return;
    const cx = (b.min.x + b.max.x) / 2;
    if (Math.abs(cx) < 0.9) return;
    if (b.max.y < tetoR - 0.06) return;
    const h = b.max.y - b.min.y;
    if (h < 0.05 || h > 0.30) return;
    const sgn = cx > 0 ? 1 : -1;
    const e = flanco.get(sgn);
    if (e) e.union(b); else flanco.set(sgn, b.clone());
    /* E O MATERIAL DELE — ver o ▶▶▶ abaixo. Fica o da peça de maior área de
       flanco, que é a chapa do perfil. */
    const area = (b.max.z - b.min.z) * (b.max.y - b.min.y);
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m && (!maiorArea.has(sgn) || area > (maiorArea.get(sgn) as number))) {
      maiorArea.set(sgn, area);
      matDoTrilho.set(sgn, m as THREE.MeshStandardMaterial);
    }
  });
  if (!flanco.size) return 0;

  /* ▶▶▶ O REBITE É DO MATERIAL DO TRILHO, NÃO DO REBITE DA CHAPA.
     ------------------------------------------------------------------------
     *"agora o frame superior tem uma linha seguindo os rebites"* — Kennedy,
     2026-08-22, e esta é a segunda metade da resposta (a primeira foi o plano
     de assentamento, no ▶▶▶ de `xFace`).

     A 0,4 m as calotas estão certas: redondas, Ø 11, assentadas. O que vira
     FITA é o CONTRASTE. Elas nasciam com os números do rebite de emenda —
     `#d7dadd`, metal 0,85, rugosidade 0,3 —, que é prata polido, e o trilho é
     escuro. Cada cabeça devolvia um brilho muito mais claro que o fundo; a
     8 m de distância o passo de 102 mm cai em sete pixels, cada calota fica
     sub-pixel, e uma fileira de pontos sub-pixel de alto contraste NÃO lê como
     pontos: lê como uma linha contínua. Na chapa branca a mesma fileira lê
     como pontinhos porque ali o contraste é quase nada.

     Num perfil de verdade o rebite é da MESMA liga do perfil e recebe o mesmo
     acabamento — ele aparece pelo relevo, não pela cor. Então o material sai
     do próprio trilho, com um dedo a mais de rugosidade (a cabeça é rebatida a
     martelo, não extrudada) e SEM os mapas: a calota não tem UV, e um
     `roughnessMap` sem UV amostra sempre o mesmo texel. */
  function materialDoRebite(sgn: number): THREE.MeshStandardMaterial {
    const base = matDoTrilho.get(sgn);
    const m = new THREE.MeshStandardMaterial({
      color: base?.color?.clone() ?? new THREE.Color(0xb9bfc4),
      metalness: base?.metalness ?? 0.85,
      roughness: Math.min(1, (base?.roughness ?? 0.3) + 0.20),
    });
    if (base?.envMap) { m.envMap = base.envMap; m.envMapIntensity = base.envMapIntensity; }
    m.name = 'trilho-rebite';
    return m;
  }

  let total = 0;
  const passos: number[] = [];
  const diag: string[] = [];
  for (const f of receita.porFlanco) {
    const b = flanco.get(f.sgn);
    if (!b) continue;
    const y = b.max.y - f.queda;
    /* A BASE DA CALOTA FICA **NA** FACE, medida — ver o ▶▶▶ de `xFace`.
       A calota cresce para fora dali por conta própria (é meia esfera achatada
       com o polo em +x·sgn), então somar a saliência aqui a levantaria de
       novo: o `x` é o plano da chapa, e ponto. */
    const x = f.xFace;
    /* ▶▶ A FILEIRA SAI DO PASSO, e o número dela sai da MEDIDA.
       O vão útil é o trilho de hoje menos as duas folgas de ponta; nele cabem
       `round(vão/passo)` intervalos, e o passo real é redistribuído para fechar
       exatamente nas duas pontas — meio milímetro de diferença contra o passo
       medido, e a fileira centrada em qualquer comprimento.

       ⚠️ Isto SÓ é honesto porque os furos do bake não estão mais lá: eles
       saíram do índice em `dressTopRail()`. Enquanto estavam, uma fileira de
       passo próprio batia contra a deles e produzia o borrão que o dono
       fotografou — e foi por isso que a volta anterior tentou a fração. */
    const vao = (b.max.z - b.min.z) - 2 * f.margem;
    if (vao <= 0 || f.passo <= 0) continue;
    const n0 = Math.max(1, Math.round(vao / f.passo));
    const dz = vao / n0;
    const zs: number[] = [];
    for (let k = 0; k <= n0; k++) zs.push(b.min.z + f.margem + k * dz);

    const dome = new THREE.SphereGeometry(TOPRAIL_RIVET_R, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.rotateZ(f.sgn > 0 ? -Math.PI / 2 : Math.PI / 2);
    /* Achatada: uma cabeça de rebite é uma calota rasa, não meia esfera. */
    dome.scale(TOPRAIL_RIVET_PROUD / TOPRAIL_RIVET_R, 1, 1);
    const bPos = dome.getAttribute('position') as THREE.BufferAttribute;
    const bNor = dome.getAttribute('normal') as THREE.BufferAttribute;
    const bIdx = dome.getIndex() as THREE.BufferAttribute;
    const vc = bPos.count, ic = bIdx.count, n = zs.length;
    const P = new Float32Array(vc * 3 * n);
    const N = new Float32Array(vc * 3 * n);
    const I = new (vc * n > 65535 ? Uint32Array : Uint16Array)(ic * n);
    for (let k = 0; k < n; k++) {
      for (let v = 0; v < vc; v++) {
        const o3 = (k * vc + v) * 3;
        P[o3] = bPos.getX(v) + x;
        P[o3 + 1] = bPos.getY(v) + y;
        P[o3 + 2] = bPos.getZ(v) + zs[k];
        N[o3] = bNor.getX(v);
        N[o3 + 1] = bNor.getY(v);
        N[o3 + 2] = bNor.getZ(v);
      }
      for (let i = 0; i < ic; i++) I[k * ic + i] = bIdx.getX(i) + k * vc;
    }
    dome.dispose();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    geo.setIndex(new THREE.BufferAttribute(I, 1));
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, materialDoRebite(f.sgn));
    mesh.name = `${TOPRAIL_RIVET_NODE}_${f.sgn > 0 ? 'R' : 'L'}`;
    mesh.castShadow = true;
    (mesh.userData as { tsRivets?: number }).tsRivets = n;
    root.add(mesh);
    total += n;
    passos.push(dz);
    diag.push(`${f.sgn > 0 ? '+x' : '-x'} perfil y ${(b.min.y * 1000).toFixed(0)}…`
      + `${(b.max.y * 1000).toFixed(0)} · fileira em ${(y * 1000).toFixed(0)}`
      + ` (${((b.max.y - y) / (b.max.y - b.min.y) * 100).toFixed(0)} % abaixo do topo)`);
  }
  console.info('[trilho] rebitagem —', total, 'rebite(s) em', flanco.size, 'flanco(s)',
    '· passo real', passos.map((d) => `${(d * 1000).toFixed(1)}`).join('/'), 'mm',
    '(medido', receita.porFlanco.map((f) => `${(f.passo * 1000).toFixed(1)}`).join('/'), 'mm)',
    `· Ø ${(TOPRAIL_RIVET_R * 2000).toFixed(1)} mm ·`, diag.join(' · '));
  return total;

}

export function fixLowFrameRail(
  root: THREE.Object3D, floorYMundo: number, row0Mundo: number,
): number {
  root.updateWorldMatrix(true, true);
  const toLocal = root.matrixWorld.clone().invert();
  /* Idem `fixCornerTape()`: as duas réguas chegam em MUNDO e as caixas saem na
     raiz. `floorY` só serve de portão (±300 mm) e nunca mudou resultado; `row0`
     é ALVO, e nele a conversão importa. */
  const floorY = cotaNaRaiz(root, floorYMundo);
  const row0 = cotaNaRaiz(root, row0Mundo);
  /** O topo que todo perfil deste quadro persegue — ver `RAIL_TOP_UNDER_ROW0`. */
  const alvoTopo = row0 - RAIL_TOP_UNDER_ROW0;
  const mm = new THREE.Matrix4();
  const bx = new THREE.Box3();
  const v = new THREE.Vector3();

  interface Cand { o: THREE.Mesh; b: THREE.Box3 }
  const trilhos: Cand[] = [];
  const fitas: Cand[] = [];
  const brancas: Cand[] = [];
  const corpo = new THREE.Box3();
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const gb = o.geometry.boundingBox;
    if (!gb) return;
    bx.copy(gb).applyMatrix4(mm.multiplyMatrices(toLocal, o.matrixWorld));
    const b = bx.clone();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const nome = mats.map((m) => (m && m.name) || '').join('+');
    if (WHITE_BAKE_RE.test(nome)) { brancas.push({ o, b }); corpo.union(b); }
    if (RAIL_MAT_RE.test(nome)) trilhos.push({ o, b });
    if (RAIL_TAPE_RE.test(nome)) fitas.push({ o, b });
  });
  if (!trilhos.length || corpo.isEmpty()) return 0;

  /* O PLANO DA PELE É POR FLANCO — a lição de `removeBakedSideDoor()`. */
  const skinDe = (sinal: number) => {
    let s = 0;
    for (const c of brancas) {
      if (sinal > 0 ? c.b.max.x <= 0 : c.b.min.x >= 0) continue;
      const outer = sinal > 0 ? c.b.max.x : -c.b.min.x;
      if (outer > s) s = outer;
    }
    return s;
  };
  const skin: Record<string, number> = { '1': skinDe(1), '-1': skinDe(-1) };

  const vaoZ = (corpo.max.z - corpo.min.z) * 0.9;
  /* A faixa que o perfil ocupava ANTES da correção — é ela que diz qual fita é
     a dele. Preenchida no laço abaixo. */
  const faixa = { y0: Infinity, y1: -Infinity };
  const alvos = trilhos.filter((c) => {
    if (c.b.max.z - c.b.min.z < vaoZ) return false;                 // corrido
    if (c.b.max.x - c.b.min.x > RAIL_THICK) return false;           // chapa
    const h = c.b.max.y - c.b.min.y;
    if (h > RAIL_MAX_H || h < 0.05) return false;
    return c.b.min.y <= floorY + RAIL_FOOT && c.b.max.y < corpo.max.y - 0.5;
  });
  if (!alvos.length) return 0;

  let n = 0;
  const desloca: { lado: number; dx: number }[] = [];
  for (const c of alvos) {
    const lado = (c.b.min.x + c.b.max.x) / 2 > 0 ? 1 : -1;
    const outer = lado > 0 ? c.b.max.x : -c.b.min.x;
    const alvoX = (skin[String(lado)] || outer) + RAIL_PROUD;
    const dx = lado * (alvoX - outer);
    /* O PÉ NÃO SE MEXE; o TOPO vai parar 47,8 mm abaixo do primeiro friso —
       ver `RAIL_TOP_UNDER_ROW0`. Nenhuma altura fixa entra, e o sinal é livre:
       um perfil alto demais DESCE o topo pelo mesmo caminho. */
    const meio = (c.b.min.y + c.b.max.y) / 2;
    const sobe = alvoTopo - c.b.max.y;
    if (Math.abs(sobe) < 1e-4 && Math.abs(dx) < 1e-4) continue;
    const mexidos = editVerts(c.o, toLocal, (p) => {
      if (p.y > meio) p.y += sobe;
      p.x += dx;
      return true;
    });
    if (c.b.min.y < faixa.y0) faixa.y0 = c.b.min.y;
    if (c.b.max.y > faixa.y1) faixa.y1 = c.b.max.y;
    if (mexidos) { n++; desloca.push({ lado, dx }); }
  }
  if (!n) return 0;

  /* A FITA HORIZONTAL DO PERFIL — a que mora dentro da faixa que o trilho
     OCUPAVA, deitada em Z. As verticais de canto são de `fixCornerTape()` e não
     entram aqui: elas são mais altas que largas e o teste `dz > dy` as recusa.

     A faixa é a de ANTES da subida, de propósito: a fita está colada na parte
     baixa do perfil, que não se moveu. */
  let nf = 0;
  for (const f of fitas) {
    const dy = f.b.max.y - f.b.min.y, dz = f.b.max.z - f.b.min.z;
    if (dz <= dy) continue;                                   // deitada
    if (f.b.min.y < faixa.y0 - 0.01 || f.b.max.y > faixa.y1 + 0.01) continue;
    const lado = (f.b.min.x + f.b.max.x) / 2 > 0 ? 1 : -1;
    const d = desloca.find((x) => x.lado === lado);
    if (!d || Math.abs(d.dx) < 1e-4) continue;
    const pai = f.o.parent;
    if (!pai) continue;
    /* Vetor, não ponto: a parte LINEAR da matriz — a mesma nota de
       `fixCornerTape()`. */
    const raizParaPai = new THREE.Matrix4()
      .multiplyMatrices(toLocal, pai.matrixWorld).invert();
    v.set(d.dx, 0, 0).applyMatrix3(new THREE.Matrix3().setFromMatrix4(raizParaPai));
    f.o.position.add(v);
    f.o.updateMatrix();
    nf++;
  }
  /* ---- OS RETORNOS DA TESTEIRA ----
     O quadro de baixo não para no flanco: ele dobra a esquina e atravessa a
     testeira. No semirreboque isso é UMA peça corrida de 2 490 × 210 × 26 mm;
     no sobrechassi são dois retornos de 300 mm nos cantos dianteiros, e eles
     têm a MESMA SEÇÃO (26 × 140) e o MESMO PÉ que a banda do flanco tinha
     antes desta correção — porque são a mesma chapa dobrada.

     Se eles não subissem junto, o quadro ficaria com um degrau de 70 mm na
     esquina: 210 mm no flanco contra 140 mm na testeira. O `dx` NÃO se aplica
     a eles — a face deles olha para +z, não para ±x, e a testeira não se
     moveu. */
  let nr = 0;
  const peDoTrilho = faixa.y0;
  for (const c of trilhos) {
    if (alvos.includes(c)) continue;
    if (c.b.max.z - c.b.min.z >= vaoZ) continue;                 // é corrido
    if (Math.abs(c.b.min.y - peDoTrilho) > 0.005) continue;      // mesmo pé
    const h = c.b.max.y - c.b.min.y;
    if (h > RAIL_MAX_H || h < 0.05) continue;
    const sobe = alvoTopo - c.b.max.y;
    if (Math.abs(sobe) < 1e-4) continue;
    const meioR = (c.b.min.y + c.b.max.y) / 2;
    if (editVerts(c.o, toLocal, (v) => {
      if (v.y <= meioR) return false;
      v.y += sobe;
      return true;
    })) nr++;
  }

  console.info('[bake] trilho de piso pela régua do semirreboque —', n, 'perfil(is) ·',
    nr, 'retorno(s) de testeira ·',
    nf, 'fita(s) ·', `topo a ${((alvoTopo - floorY) * 1000).toFixed(1)} mm do piso`,
    `(${(RAIL_TOP_UNDER_ROW0 * 1000).toFixed(1)} mm abaixo do 1º friso) ·`,
    'degrau', desloca.map((d) => `${(d.dx * 1000).toFixed(1)} mm`).join(' / '));
  return n + nf + nr;
}

/* ===========================================================================
   OS "CANINHOS" — sete tubos de 20 × 20 mm que o produto Ankaa não tem
   ===========================================================================
   *"os caninhos que ficam abaixo do frame metálico continuam lá, são 2 em uma
   lateral, 3 em outra e 2 na frente"* — Kennedy, 2026-08-19.

   A contagem assimétrica é a assinatura, e ela fecha exata. O que existe no
   sobrechassi e NÃO existe no semirreboque são sete tubos quadrados de
   `metal-pouco-polido`, **20 × 2 946,5 × 20 mm**, embutidos na parede
   (|x| ≈ 1,25 contra 1,31 da pele) e aparecendo só onde a parede acaba —
   abaixo do perfil de piso, na faixa preta:

     DIREITA    z −3,157 · +0,004 · +1,019      → 3
     ESQUERDA   z −1,071 · +3,104               → 2
     FRENTE     z +4,235, |x| 1,13              → 2

   Eles aparecem como BARRAS CLARAS na faixa preta porque `metal-pouco-polido`
   é polido e pega o céu; a varredura de raios da elevação do flanco
   (`tools/trailer-bench/medir-0820.mjs`, seção `varredura_da_faixa`) devolve
   `metal-pouco-polido` exatamente nesses u, e ZERO ocorrências no
   semirreboque — que é o que os condena.

   ⚠️ NÃO são as lanternas laterais de chassi. Aquelas são OITO
   (`lanterna-lateral-chassis`, `plastico-preto` + `vidro-lanternas-pisca` +
   LEDs, nas estações z ±4,11 e ±1,37), simétricas, e são peça legítima — a
   rodada anterior chegou a suspeitar delas porque uma família vizinha
   (`metal-preto` 17 × 45 × 110, o berço da lanterna) também soma sete. Essa
   família FICA: a foto mostra que ela é uma lasca de 2 mm atrás da lente, e
   removê-la deixaria a lanterna sem corpo.

   A busca é por FORMA, não por material nem por nome: tubo esbelto (mais de
   50 × mais alto que grosso), quadrado em planta e alto o bastante para
   atravessar a parede inteira. Nada mais no bake tem essa razão de aspecto.
   =========================================================================== */

/** Quão esbelto um tubo tem de ser para ser um deles. */
const CONDUIT_SLENDER = 50;
/** …e quão grosso ele pode ser, em cada eixo horizontal. */
const CONDUIT_MAX_W = 0.04;
/**
 * …e quanto da ALTURA DA PAREDE ele tem de cobrir, e da MEIA-LARGURA dela ele
 * tem de estar afastado.
 *
 * ⚠️ OS DOIS EXISTEM POR CAUSA DO VARÃO DA PORTA TRASEIRA, e a primeira versão
 * levou os dois junto: `|x| 0,11 e 0,13 · z −4,27`, esbeltos, verticais e
 * quadrados em planta como os tubos. O que os separa é medida, não nome:
 *
 *   tubo embutido   2 946,5 mm de altura (a parede tem 2 859)  ·  |x| 1,13…1,27
 *   varão da porta  2 480 mm                                   ·  |x| 0,11…0,13
 *
 * Relativos e não absolutos porque o baú redimensiona e porque o próximo bake
 * pode ter outra medida: o que define um é atravessar a parede INTEIRA rente ao
 * flanco, e isso continua verdadeiro em qualquer tamanho.
 */
const CONDUIT_MIN_H_FRAC = 0.9;
const CONDUIT_MIN_X_FRAC = 0.6;

/**
 * Tira os tubos embutidos que o bake herdou do implemento de origem.
 *
 * @returns quantos saíram.
 */
export function removeStrayConduits(root: THREE.Object3D): number {
  root.updateWorldMatrix(true, true);
  const toLocal = root.matrixWorld.clone().invert();
  /* A PAREDE, que é a régua dos dois limiares. Medida aqui e não recebida:
     esta correção roda ANTES de `TrailerBody`, na janela das remoções, e é
     essa ordem que garante que uma peça a mais não entre na decomposição em
     cascas. Ver a nota de `loadTrailer()`. */
  const parede = new THREE.Box3();
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry) return;
    if (!WHITE_BAKE_RE.test(matsOf(o))) return;
    const b = boxOf(o, toLocal);
    if (b) parede.union(b);
  });
  if (parede.isEmpty()) {
    console.warn('[bake] tubos embutidos: sem material branco para servir de régua.');
    return 0;
  }
  const alturaMin = (parede.max.y - parede.min.y) * CONDUIT_MIN_H_FRAC;
  const xMin = ((parede.max.x - parede.min.x) / 2) * CONDUIT_MIN_X_FRAC;

  const fora: THREE.Object3D[] = [];
  const onde: string[] = [];
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry) return;
    const b = boxOf(o, toLocal);
    if (!b) return;
    const dx = b.max.x - b.min.x, dy = b.max.y - b.min.y, dz = b.max.z - b.min.z;
    if (dy < alturaMin) return;
    if (Math.abs((b.min.x + b.max.x) / 2) < xMin) return;
    if (dx > CONDUIT_MAX_W || dz > CONDUIT_MAX_W) return;
    if (dy < Math.max(dx, dz) * CONDUIT_SLENDER) return;
    /* QUADRADO EM PLANTA — um montante de canto é chapa dobrada e tem os dois
       lados bem diferentes; estes têm 20 × 20. */
    if (Math.abs(dx - dz) > 0.006) return;
    fora.push(o);
    onde.push(`x ${((b.min.x + b.max.x) / 2).toFixed(2)} z ${((b.min.z + b.max.z) / 2).toFixed(2)}`);
  });
  for (const o of fora) o.parent?.remove(o);
  if (fora.length) {
    console.info('[bake] tubos embutidos removidos —', fora.length, '·', onde.join(' · '));
  }
  return fora.length;
}

/* ===========================================================================
   A FERRAGEM DE ENCOSTO DA PORTA, NO FLANCO — 2026-08-20 (fim de tarde)
   ===========================================================================
   Cada porta que abre 270° tem, no flanco, uma ESTAÇÃO de encosto: uma borracha
   de 37 × 28 × 28 mm e a fêmea do engate, 100 mm atrás dela. Medido nos dois:

     semirreboque  UMA estação por flanco, em z −6,51/−6,41   (a da porta traseira)
     sobrechassi   a mesma em z −3,29/−3,19  MAIS uma no flanco esquerdo em
                   z +2,23/+2,33 — a da PORTA LATERAL DE FÁBRICA

   *"remova essas peças na lateral na parte da frente, deve ficar somente a da
   parte de trás, já que a lateral não tem mais porta"* — Kennedy, 2026-08-20.

   `removeBakedSideDoor()` tira a folha, o marco e a ferragem que mora DENTRO do
   retângulo do vão; a estação de encosto fica a mais de um metro dali, no
   caminho do arco da porta, e por isso sobrevivia. Ela sai aqui, e o critério é
   o mesmo que a frase do dono: **fica a estação mais à TRÁS, saem as outras**.
   Num bake com uma estação só — o semirreboque — isso não remove nada.
   =========================================================================== */

/** A borracha de encosto e a fêmea do engate, as duas peças da estação. */
const CATCH_STATION_RE = /^(borracha-preta|engate-femea-preto)$/i;
/** Quão longe em z duas peças ainda são a MESMA estação. A borracha fica
 *  100 mm à frente da fêmea; 300 mm cobre isso com folga e continua muito
 *  abaixo do vão entre estações (5,5 m no sobrechassi). */
const CATCH_STATION_SPAN = 0.30;

/**
 * Tira as estações de encosto que não são a da porta TRASEIRA.
 *
 * @returns quantas peças saíram.
 */
export function removeSideDoorCatches(root: THREE.Object3D): number {
  root.updateWorldMatrix(true, true);
  const toLocal = root.matrixWorld.clone().invert();
  const pecas: { o: THREE.Mesh; z: number }[] = [];
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((m) => !!m && CATCH_STATION_RE.test(m.name || ''))) return;
    const b = boxOf(o, toLocal);
    if (!b) return;
    /* NO FLANCO e PEQUENA: a borracha da maçaneta da testeira tem o mesmo
       material e mora em |x| 1,13, longe da pele. */
    if (Math.abs((b.min.x + b.max.x) / 2) < 1.0) return;
    const d = b.getSize(new THREE.Vector3());
    if (Math.max(d.x, d.y, d.z) > 0.12) return;
    pecas.push({ o, z: (b.min.z + b.max.z) / 2 });
  });
  if (pecas.length < 2) return 0;
  /* A ESTAÇÃO DE TRÁS é a do menor z — a traseira do baú é −z nos dois bakes
     (ver `implements.json`). Tudo a mais de uma estação dali é de outra porta. */
  const zTras = Math.min(...pecas.map((p) => p.z));
  const fora = pecas.filter((p) => p.z > zTras + CATCH_STATION_SPAN);
  for (const p of fora) p.o.parent?.remove(p.o);
  if (fora.length) {
    console.info('[bake] encosto de porta lateral removido —', fora.length, 'peça(s) em z',
      [...new Set(fora.map((p) => p.z.toFixed(2)))].join(', '),
      `· fica a estação de z ${zTras.toFixed(2)}`);
  }
  return fora.length;
}

/* ===========================================================================
   E ONDE ELA ASSENTA: a faixa lisa do TERCEIRO friso
   ===========================================================================
   *"essas peças (a borracha e a fêmea do engate da traseira) devem ficar
   centralizadas na parte lisa do terceiro friso"* — Kennedy, 2026-08-20.

   A grade das faixas lisas, MEDIDA (`measureRibProfile()` dá a fase; o topo do
   quadro dá de onde contar), no sobrechassi:

     topo do quadro   piso +72,4 mm
     faixa #1         piso +77,6    (5,2 mm acima do quadro — encoberta)
     faixa #2         piso +130,6
     faixa #3         piso +183,6   ← o alvo
     faixa #4         piso +236,6

   e a peça de fábrica está em piso +200/+205 mm, ou seja **a cavalo do friso**,
   16 a 21 mm acima do centro da faixa. É o que o print mostra.

   ⚠️ POR QUE NÃO É `raiseDoorCatches()`. Aquela função põe a peça em
   `row0 + RIB_FLAT_CENTER + n·pitch`, e essa régua foi calibrada EM FOTO no
   semirreboque com o erro de referencial de +20 mm dentro (§29.3/§30). No
   sobrechassi ela RECUSA — a peça de fábrica cai fora da janela — e recusar é o
   caminho seguro. Corrigir a constante moveria a peça aprovada do semirreboque
   19 mm; medir a grade e assentar nela é o que este implemento pede, e é
   local a ele.
   =========================================================================== */

/**
 * Assenta a estação de encosto na faixa lisa mais próxima.
 *
 * @param faseP a fase (em y absoluto) do centro do platô recuado, medida.
 * @returns quantas peças foram movidas.
 */
export function seatFlankCatches(
  root: THREE.Object3D, pitch: number, faseP: number,
): number {
  root.updateWorldMatrix(true, true);
  const toLocal = root.matrixWorld.clone().invert();
  const pecas: { o: THREE.Mesh; cy: number }[] = [];
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((m) => !!m && CATCH_STATION_RE.test(m.name || ''))) return;
    const b = boxOf(o, toLocal);
    if (!b) return;
    if (Math.abs((b.min.x + b.max.x) / 2) < 1.0) return;
    const d = b.getSize(new THREE.Vector3());
    if (Math.max(d.x, d.y, d.z) > 0.12) return;
    pecas.push({ o, cy: (b.min.y + b.max.y) / 2 });
  });
  if (!pecas.length || !(pitch > 0.01)) return 0;

  /* UM DESLOCAMENTO SÓ PARA A ESTAÇÃO INTEIRA, e é decisão: a borracha e a
     fêmea ficam 5 mm desencontradas de fábrica (piso +205 contra +200) e é
     assim que a peça é. Assentar cada uma na sua faixa mais próxima poderia
     separá-las num passo inteiro; o que se assenta é o CONJUNTO, pela peça
     mais baixa. */
  const cy = Math.min(...pecas.map((p) => p.cy));
  const fase = cotaNaRaiz(root, faseP);
  const alvo = Math.round((cy - fase) / pitch) * pitch + fase;
  const assenta = alvo - cy;
  /* Meio passo é o teto: além disso a peça não estava "descentrada", estava em
     outro lugar, e mover meio friso às cegas é pior que não mover. O teto vale
     para o ASSENTAMENTO, que é correção de FASE; o degrau deliberado logo
     abaixo é outra coisa e não passa por ele. */
  if (Math.abs(assenta) > pitch / 2) {
    console.warn('[bake] encosto da porta: a faixa lisa mais próxima está a',
      (assenta * 1000).toFixed(0), 'mm — fora de meio passo; intocado.');
    return 0;
  }
  /* ---- E UM FRISO ACIMA ----
     *"suba um friso essas peças"* — Kennedy, 2026-08-20, olhando a estação já
     assentada. O assentamento acerta a FASE (a peça no centro da parte lisa e
     não montada na crista); a ALTURA em que a estação mora é outra decisão, e
     essa é dele. Um passo inteiro preserva a fase — é por isso que o degrau é
     `pitch` e não um número em milímetros: em qualquer bake, com qualquer
     passo, a peça continua centrada na faixa lisa, só que na de cima. */
  const SOBE_FRISOS = 1;
  const dy = assenta + pitch * SOBE_FRISOS;
  if (Math.abs(dy) < 1e-4) return 0;
  const feitas = new Set<THREE.BufferGeometry>();
  let n = 0;
  for (const p of pecas) {
    p.o.userData.tsFloorAnchored = true;
    const geo = p.o.geometry as THREE.BufferGeometry;
    if (feitas.has(geo)) continue;
    feitas.add(geo);
    if (editVerts(p.o, toLocal, (v) => { v.y += dy; return true; })) n++;
  }
  console.info('[bake] encosto da porta assentado na faixa lisa —', pecas.length,
    'peça(s),', n, 'malha(s) ·', `${dy > 0 ? '+' : ''}${(dy * 1000).toFixed(1)} mm`);
  return pecas.length;
}

/** As mangueiras traseiras do sobrechassi, pelo nome que o bake lhes deu
 *  (a grafia é do arquivo — `Mangueida`, com D). */
const REAR_HOSE_RE = /^Mangueida/i;

/**
 * DUAS MANGUEIRAS TRASEIRAS, E O PRODUTO TEM UMA.
 *
 * *"essas mangueiras traseiras, deve ficar apenas uma"* — Kennedy, 2026-08-19.
 *
 * Elas são as duas peças que penduram 800 mm abaixo do sub-chassi (é por causa
 * delas que `measureMountDatum()` existe — ver `vehicle/mounting.ts`), uma por
 * flanco, em |x| ≈ 1,10. O REGISTRO de cada uma fica no lugar: ele é a torneira
 * de dreno, mora rente ao sub-chassi e é o que o dono pediu em LARANJA — tirar
 * o par inteiro apagaria a peça que a outra metade do pedido acabou de pintar.
 *
 * Qual das duas some é decidido por COORDENADA, não por ordem de travessia: a
 * ordem em que o `GLTFLoader` monta o grafo não é contrato, e um critério que
 * dependa dela troca de lado a cada re-bake sem que nada no relatório mude.
 *
 * @returns quantas malhas saíram.
 */
export function removeExtraRearHose(root: THREE.Object3D): number {
  root.updateWorldMatrix(true, true);
  const toLocal = root.matrixWorld.clone().invert();
  const mm = new THREE.Matrix4();
  const bx = new THREE.Box3();
  const achadas: { o: THREE.Mesh; x: number }[] = [];
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry) return;
    if (!REAR_HOSE_RE.test(o.name || '')) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const gb = o.geometry.boundingBox;
    if (!gb) return;
    bx.copy(gb).applyMatrix4(mm.multiplyMatrices(toLocal, o.matrixWorld));
    achadas.push({ o, x: (bx.min.x + bx.max.x) / 2 });
  });
  if (achadas.length < 2) return 0;
  /* Fica a de MENOR x, sai o resto — determinístico e reproduzível. */
  achadas.sort((a, b) => a.x - b.x);
  let n = 0;
  for (const c of achadas.slice(1)) { c.o.removeFromParent(); n++; }
  console.info('[bake] mangueira traseira a mais removida —', n, 'de',
    achadas.length, '· fica a de x =', achadas[0].x.toFixed(3));
  return n;
}


/* ===========================================================================
   A FERRAGEM DE DUAS CORES QUE O EXPORT FUNDIU NUMA MALHA SÓ — 2026-08-19
   ===========================================================================
   *"essa peça está toda preta agora, não deveria — ela tem uma parte preta, mas
   tem uma parte metálica também"* e *"essa peça da traseira, que é o macho da
   lateral para prender a traseira na lateral, também possui uma parte preta de
   plástico"*. São os dois lados do mesmo engate, e o mesmo defeito de arquivo.

   NO SEMIRREBOQUE cada uma são DUAS malhas, com materiais diferentes:

     fêmea (no flanco)     `mesh_826`    16 × 79 × 38 mm   metal-pouco-polido
                           `mesh_826_1`  17 × 79 × 57 mm   engate-femea-preto
     macho (na porta)      `mesh_1841`   39 × 150 × 10 mm  metal-pouco-polido
                           `mesh_1841_1` 54 × 65 × 12 mm   engate-macho-preto

   NO SOBRECHASSI o `stitch_all` da origem juntou cada par numa primitiva só,
   com um material só — 17 × 79 × 57 e 54 × 149 × 12, que são as UNIÕES das duas
   caixas. Não há nome para separar, e o enxerto de material
   (`tools/implement-bake/graft-materials.mjs`) não alcança: ele pinta
   primitivas inteiras, e aqui meia primitiva é preta. Pintar tudo de preto foi
   exatamente o que o dono reprovou.

   O QUE SEPARA AS DUAS *NÃO* É A TOPOLOGIA — e esta é a medida de 2026-08-20
   que derruba a primeira tentativa. A rodada anterior supôs que, tendo sido
   objetos distintos antes do `stitch_all`, elas continuariam sendo cascas
   conexas distintas dentro do mesmo buffer. A sonda mediu, e não continuam:

     `componentesConexas()` devolve **1** para as SEIS malhas de engate do
     sobrechassi (1 312 triângulos na fêmea, 1 608 no macho, tudo numa
     componente só). O `stitch_all` SOLDOU os vértices.

   E havia um segundo defeito, esse pior porque era calado: `caixaDeTris()`
   media a componente no espaço LOCAL da geometria, enquanto `alvoSize` e
   `capSize` vinham em metros no espaço da RAIZ. O rip está em CENTÍMETROS e o
   nó `stitch_result_stitch_all` gira 180° em torno de (1,0,1)/√2 — o que troca
   X e Z. A comparação saía com 7 821 mm de erro, e a função desistia com um
   aviso que parecia dizer "a peça não casa" quando dizia "a régua está em outra
   unidade". (No semirreboque, onde as peças JÁ vêm separadas, ela ainda casava
   a capa por assinatura e imprimia esse aviso duas vezes por carga.)

   O QUE SEPARA AS DUAS É A REGIÃO, e ela está medida no doador:

     fêmea   metal 17 × 79 × 38 ⊂ capa 17 × 79 × 57, MESMO CENTRO nos três eixos
             → a capa são DUAS componentes de 9,5 mm nas PONTAS do eixo de 57 mm
               (medido: x_local −2,85…−1,90 e +1,90…+2,85 cm)
     macho   metal 39 × 149,5 × 12, capa 54 × 65 × 12 com o MESMO topo
             → a capa são as ABAS, além dos 39 mm do metal no eixo de 54 mm
               (medido: |x_local| 1,95…2,70 cm, mais duas orelhas de 0,5 mm)

   Nos dois casos a regra é a MESMA e sai de uma subtração: o eixo em que a
   UNIÃO é mais larga que o METAL é o eixo do corte, e o corte fica em
   ±metal/2 a partir do centro da peça. Fêmea: ±19 mm no eixo de 57. Macho:
   ±19,5 mm no eixo de 54. Nenhum número escolhido à mão — os dois saem de
   `metalSize`, que é a cota da malha metálica DO SEMIRREBOQUE.

   O eixo é descoberto por comparação de assinaturas ORDENADAS, e não fixado:
   as três instâncias do macho no sobrechassi não compartilham orientação (uma
   está no flanco com 12 mm em x, duas na porta com 12 mm em z).

   O resultado é `material` em ARRAY mais dois grupos de índice: a mesma malha,
   desenhada em duas chamadas, uma por cor. Nenhum vértice se move.
   =========================================================================== */

/** Tolerância da assinatura de caixa, em metros. */
const CAP_TOL = 0.004;

/** Cotas em ordem crescente — as instâncias não compartilham orientação, então
 *  a comparação é entre assinaturas ORDENADAS e nunca eixo a eixo. */
const ordena3 = (a: number[]) => [...a].sort((x, y) => x - y);
const distAssinatura = (a: number[], b: number[]) => {
  const x = ordena3(a), y = ordena3(b);
  return Math.max(Math.abs(x[0] - y[0]), Math.abs(x[1] - y[1]), Math.abs(x[2] - y[2]));
};

/**
 * Devolve à malha fundida as DUAS cores dela, cortando por REGIÃO.
 *
 * @param alvoSize a cota da malha FUNDIDA (a união das duas partes), como o
 *   sobrechassi a traz — é ela que seleciona a peça.
 * @param metalSize a cota da parte METÁLICA, medida no semirreboque — é a
 *   diferença entre as duas que diz onde cortar, e em que eixo.
 * @returns quantas malhas foram divididas.
 */
export function splitFusedBlackCap(
  root: THREE.Object3D,
  alvoSize: [number, number, number],
  metalSize: [number, number, number],
  capMatRe: RegExp,
  metalMatRe: RegExp,
): number {
  root.updateWorldMatrix(true, true);
  const toLocal = root.matrixWorld.clone().invert();

  /* O EIXO DO CORTE sai da subtração das assinaturas ORDENADAS: é aquele em
     que a união é mais larga que o metal. Se não houver um só, não há regra —
     e inventar uma seria pintar meia peça no escuro. */
  const au = ordena3(alvoSize), mu = ordena3(metalSize);
  let iDif = -1, maior = 0;
  for (let i = 0; i < 3; i++) {
    const d = au[i] - mu[i];
    if (d > maior) { maior = d; iDif = i; }
  }
  if (iDif < 0 || maior < 0.005) {
    console.warn('[bake] ferragem fundida:', capMatRe,
      '— união e metal têm a mesma cota; sem eixo de corte.');
    return 0;
  }
  const larguraUniao = au[iDif];
  const larguraMetal = mu[iDif];

  let capMat: THREE.Material | null = null;
  let metalMat: THREE.Material | null = null;
  /* OS CENTROS DAS MALHAS METÁLICAS QUE JÁ EXISTEM. No semirreboque o par vem
     separado e a capa SOZINHA mede a união (17 × 79 × 57), então ela casa a
     assinatura e a função tentava cortá-la — devolvendo "corte degenerado" duas
     vezes por carga. Uma peça que já tem o irmão metálico no mesmo lugar está
     pronta, e o certo é sair calado. */
  const jaSeparadas: THREE.Vector3[] = [];
  const alvos: { o: THREE.Mesh; b: THREE.Box3 }[] = [];
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      if (!capMat && capMatRe.test(m.name || '')) capMat = m;
      if (!metalMat && metalMatRe.test(m.name || '')) metalMat = m;
    }
    if (Array.isArray(o.material)) return;                 // já dividida
    if (metalMatRe.test((o.material as THREE.Material)?.name || '')) {
      const bm = boxOf(o, toLocal);
      if (bm && distAssinatura(
        [bm.max.x - bm.min.x, bm.max.y - bm.min.y, bm.max.z - bm.min.z],
        metalSize) <= CAP_TOL) jaSeparadas.push(bm.getCenter(new THREE.Vector3()));
      return;
    }
    /* ⚠️ SÓ a malha cujo material é o da CAPA. Sem este filtro a função pega
       também a peça já correta do semirreboque (lá a capa sozinha mede a união)
       e sai avisando que não conseguiu dividi-la — ruído por carga, e um convite
       a alguém "consertar" o que está certo. */
    if (!capMatRe.test((o.material as THREE.Material)?.name || '')) return;
    const b = boxOf(o, toLocal);
    if (!b) return;
    const d: [number, number, number] = [
      b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
    if (distAssinatura(d, alvoSize) > CAP_TOL) return;
    alvos.push({ o, b });
  });
  if (!alvos.length || !capMat || !metalMat) return 0;
  const prontas = alvos.filter(({ b }) => {
    const c = b.getCenter(new THREE.Vector3());
    return jaSeparadas.some((q) => q.distanceTo(c) < CAP_TOL);
  }).length;
  if (prontas === alvos.length) return 0;             // este bake já vem certo

  let n = 0;
  let capaTris = 0, metalTris = 0;
  for (const { o, b } of alvos) {
    const c = b.getCenter(new THREE.Vector3());
    if (jaSeparadas.some((q) => q.distanceTo(c) < CAP_TOL)) continue;
    const d = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
    /* Qual dos três eixos DESTA instância é o do corte. As instâncias não
       compartilham orientação — o macho aparece com 12 mm em x no flanco e em z
       na porta —, então o eixo é reconhecido pela COTA, não fixado. */
    const eixos = [0, 1, 2].filter((i) => Math.abs(d[i] - larguraUniao) < CAP_TOL);
    if (eixos.length !== 1) {
      console.warn('[bake] ferragem fundida: eixo de corte ambíguo em', o.name,
        '— cotas', d.map((x) => (x * 1000).toFixed(0)).join('×'), 'mm; intocada.');
      continue;
    }
    const eixo = eixos[0];
    const centro = [(b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2,
      (b.min.z + b.max.z) / 2][eixo];
    const meio = larguraMetal / 2;

    const geo = claimGeometry(o);
    const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
    const idx = geo.getIndex() as THREE.BufferAttribute | null;
    if (!pos || !idx) continue;
    /* O CENTROIDE DE CADA TRIÂNGULO, no MESMO referencial da caixa. Foi a
       mistura desses dois espaços que fez a primeira versão medir 7,8 m de
       erro num engate de 57 mm. */
    const m4 = new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld);
    const v = new THREE.Vector3();
    const tri = idx.count / 3;
    const capa: number[] = [], resto: number[] = [];
    for (let t = 0; t < tri; t++) {
      let u = 0;
      for (let kk = 0; kk < 3; kk++) {
        v.fromBufferAttribute(pos, idx.getX(t * 3 + kk)).applyMatrix4(m4);
        u += [v.x, v.y, v.z][eixo];
      }
      (Math.abs(u / 3 - centro) > meio ? capa : resto).push(t);
    }
    /* Um lado vazio é sinal de que a régua não vale para esta malha; meia peça
       pintada é pior que uma peça de uma cor só. */
    if (capa.length < tri * 0.05 || resto.length < tri * 0.05) {
      console.warn('[bake] ferragem fundida: corte degenerado em', o.name,
        `(${capa.length}/${tri} na capa) — intocada.`);
      continue;
    }
    const novo = new Uint32Array(idx.count);
    let w = 0;
    for (const lista of [capa, resto]) {
      for (const t of lista) {
        novo[w++] = idx.getX(t * 3);
        novo[w++] = idx.getX(t * 3 + 1);
        novo[w++] = idx.getX(t * 3 + 2);
      }
    }
    geo.setIndex(new THREE.BufferAttribute(novo, 1));
    geo.clearGroups();
    geo.addGroup(0, capa.length * 3, 0);
    geo.addGroup(capa.length * 3, resto.length * 3, 1);
    o.material = [capMat, metalMat];
    capaTris += capa.length; metalTris += resto.length;
    n++;
  }
  if (n) {
    console.info('[bake] ferragem de duas cores dividida —', n, 'malha(s) ·',
      `corte no eixo de ${(larguraUniao * 1000).toFixed(0)} mm a ±${(larguraMetal * 500).toFixed(1)} mm ·`,
      `${capaTris} tris de ${(capMat as THREE.Material).name} +`,
      `${metalTris} de ${(metalMat as THREE.Material).name}`);
  }
  return n;
}

/** Componentes conexas de uma geometria indexada, por vértice SOLDADO.
 *  ⚠️ A solda por posição não é opcional: o buffer traz o mesmo ponto repetido
 *  por causa da normal e do UV, e sem soldar cada face vira a própria
 *  componente. */
function componentesConexas(geo: THREE.BufferGeometry): number[][] {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
  const idx = geo.getIndex();
  if (!pos || !idx) return [];
  const chave = new Map<string, number>();
  const pai = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 1e5)},${Math.round(pos.getY(i) * 1e5)},`
      + `${Math.round(pos.getZ(i) * 1e5)}`;
    const j = chave.get(k);
    if (j === undefined) { chave.set(k, i); pai[i] = i; } else pai[i] = j;
  }
  const acha = (i: number): number => {
    let r = i;
    while (pai[r] !== r) r = pai[r];
    while (pai[i] !== r) { const n = pai[i]; pai[i] = r; i = n; }
    return r;
  };
  const une = (a: number, b: number) => {
    const ra = acha(a), rb = acha(b);
    if (ra !== rb) pai[ra] = rb;
  };
  const tri = idx.count / 3;
  for (let t = 0; t < tri; t++) {
    une(idx.getX(t * 3), idx.getX(t * 3 + 1));
    une(idx.getX(t * 3 + 1), idx.getX(t * 3 + 2));
  }
  const g = new Map<number, number[]>();
  for (let t = 0; t < tri; t++) {
    const r = acha(idx.getX(t * 3));
    const e = g.get(r);
    if (e) e.push(t); else g.set(r, [t]);
  }
  return [...g.values()];
}

/** Caixa de uma lista de triângulos, no espaço LOCAL da geometria. */
function caixaDeTris(geo: THREE.BufferGeometry, tris: number[]): THREE.Box3 {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const idx = geo.getIndex() as THREE.BufferAttribute;
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const t of tris) {
    for (let k = 0; k < 3; k++) {
      const i = idx.getX(t * 3 + k);
      b.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)));
    }
  }
  return b;
}

/* ===========================================================================
   O REGISTRO E A MANGUEIRA — 2026-08-20
   ===========================================================================
   *"o registro apenas deve ser laranja, não tudo, tem uma parte marrom, e a
   mangueira está metálica, não deveria"* — Kennedy, 2026-08-20, com dois prints.

   DUAS PEÇAS DA MESMA MONTAGEM, dois defeitos de export, e as duas medidas
   contra o semirreboque:

   1. **O REGISTRO.** No doador ele são DUAS malhas — `mesh_847`
      (`registro-tubo-marrom`, o tubo de passagem) e `mesh_847_1`
      (`registro-corpo-laranja`, o corpo da válvula com o manípulo). No
      sobrechassi o `stitch_all` juntou as duas numa primitiva só, e
      `graft-materials.mjs` só podia pintar a primitiva INTEIRA — de laranja.
      Daí "não tudo": o tubo ficou laranja junto.

      ⚠️ E aqui, ao contrário do engate (§29.4), **a topologia SOBROU**. Medido:

        doador   tubo   comp de 1 376 tris, caixa local 7053,1 × 7002,2 × 11917,4
                 corpo  comps de 372 (2692,2 × 1673,1 × 10066,8) e 222
        alvo     UMA malha de 2 028 tris com **três** componentes:
                 1 400 → 7053,0 × 7002,4 × 11917,4   (o tubo, ao micrômetro)
                   372 → 2691,9 × 1672,8 × 10066,8   (o corpo)
                   256 → 4679,1 × 4365,2 × 3999,7    (o corpo)

      As caixas batem com as do doador em menos de meio micrômetro, porque é a
      MESMA geometria de origem. Então a divisão é por componente, e o tubo é o
      MAIOR dos três — pelo número de triângulos E pela caixa, que é o que torna
      a regra livre de unidade e de orientação.

   2. **A MANGUEIRA.** No doador o cano da montagem
      (`cano-Mangueida+registro-Traseira-E`) é `cano-ar-preto`. No sobrechassi a
      mangueira (`MangueidaTraseira-D`, 62 × 829,5 × 334 mm) saiu como
      `metal-pouco-polido` — `metalness: 1`, `roughness: 1` —, e é por isso que
      ela desce reluzindo como um tubo cromado no lugar de uma mangueira.

   POR QUE AQUI E NÃO EM `graft-materials.mjs`, que é onde mora identidade de
   material: porque metade disto é MEIA PRIMITIVA, e o enxerto pinta primitiva
   inteira — a mesma razão do engate. Separar o par entre duas ferramentas
   deixaria dois lugares para procurar quando a montagem mudasse.
   =========================================================================== */

/** A cor do tubo do registro, MEDIDA no material do doador
 *  (`registro-tubo-marrom`: #a9713f, metalness 0,50, roughness 0,45). Ela só é
 *  usada quando o bake não traz o material — se um re-bake o trouxer, o dele
 *  ganha. */
const REGISTRO_TUBO = { cor: 0xa9713f, metalness: 0.5, roughness: 0.45 };
/** O corpo laranja, que é quem seleciona a peça. */
const REGISTRO_CORPO_RE = /^registro-corpo-laranja$/i;
/** O tubo, pelo nome que o doador lhe dá. */
const REGISTRO_TUBO_RE = /^registro-tubo-marrom$/i;
/** A mangueira, pelo nome do nó (a grafia é do arquivo — `Mangueida`, com D). */
const HOSE_NODE_RE = /^Mangueid/i;
/** …e o material que ela deveria ter, que é o do cano da mesma montagem. */
const HOSE_MAT_RE = /^cano-ar-preto$/i;

/** Volume da caixa de uma lista de triângulos — a régua livre de unidade que
 *  escolhe o tubo entre as componentes. */
function volumeDeTris(geo: THREE.BufferGeometry, tris: number[]): number {
  const d = caixaDeTris(geo, tris).getSize(new THREE.Vector3());
  return d.x * d.y * d.z;
}

/**
 * Devolve ao registro o TUBO MARROM que o export fundiu no corpo laranja, e à
 * mangueira o preto que ela perdeu.
 *
 * @returns quantas peças foram corrigidas.
 */
export function fixRegistroAndHose(root: THREE.Object3D): number {
  root.updateWorldMatrix(true, true);
  let corpoMat: THREE.Material | null = null;
  let tuboMat: THREE.Material | null = null;
  let canoMat: THREE.Material | null = null;
  const registros: THREE.Mesh[] = [];
  const mangueiras: THREE.Mesh[] = [];
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m) continue;
      if (!corpoMat && REGISTRO_CORPO_RE.test(m.name || '')) corpoMat = m;
      if (!tuboMat && REGISTRO_TUBO_RE.test(m.name || '')) tuboMat = m;
      if (!canoMat && HOSE_MAT_RE.test(m.name || '')) canoMat = m;
    }
    if (Array.isArray(o.material)) return;                    // já dividida
    const nome = (o.material as THREE.Material)?.name || '';
    if (REGISTRO_CORPO_RE.test(nome)) registros.push(o);
    if (HOSE_NODE_RE.test(o.name || '') && !HOSE_MAT_RE.test(nome)) mangueiras.push(o);
  });

  let n = 0;

  /* ---- 1. A MANGUEIRA, que é uma reatribuição e nada mais ---- */
  if (mangueiras.length) {
    if (!canoMat) {
      console.warn('[bake] mangueira: este bake não tem `cano-ar-preto` —',
        'ela fica com o material que veio.');
    } else {
      for (const o of mangueiras) o.material = canoMat;
      console.info('[bake] mangueira traseira deixou de ser metálica —',
        mangueiras.length, 'malha(s) →', (canoMat as THREE.Material).name);
      n += mangueiras.length;
    }
  }

  /* ---- 2. O REGISTRO, que é meia primitiva ----
     ⚠️ UM BAKE QUE JÁ TRAZ O TUBO SEPARADO NÃO É TOCADO, e é este `if` que
     torna a função segura em qualquer implemento: no semirreboque o corpo
     laranja também tem três componentes, e sem esta porta a maior delas seria
     pintada de marrom numa peça que já está certa. A existência do material
     `registro-tubo-marrom` no bake é a prova de que o par sobreviveu ao
     export. */
  if (tuboMat) {
    console.info('[bake] registro: este bake já traz o tubo separado — intocado.');
    return n;
  }
  if (!registros.length || !corpoMat) return n;
  /* O material do tubo é um clone MEDIDO do doador — e clonar o CORPO (em vez
     de criar do zero) é o que faz o tubo herdar `envMapIntensity`, `side` e o
     que mais o acabamento tenha posto no par. */
  {
    const base = (corpoMat as THREE.MeshStandardMaterial).clone();
    base.name = 'registro-tubo-marrom';
    base.color = new THREE.Color(REGISTRO_TUBO.cor);
    base.metalness = REGISTRO_TUBO.metalness;
    base.roughness = REGISTRO_TUBO.roughness;
    tuboMat = base;
  }

  let divididos = 0;
  for (const o of registros) {
    const geo = claimGeometry(o);
    const comps = componentesConexas(geo);
    if (comps.length < 2) {
      console.warn('[bake] registro: uma componente só em', o.name,
        '— o tubo fica laranja.');
      continue;
    }
    /* O TUBO É O MAIOR, pelos DOIS critérios. Exigir os dois é o que torna a
       regra auto-verificável: se eles discordarem, a peça não é a que se
       pensava e o certo é sair sem pintar. */
    let porTris = 0, porVolume = 0, maiorV = -1;
    comps.forEach((tris, i) => {
      if (tris.length > comps[porTris].length) porTris = i;
      const v = volumeDeTris(geo, tris);
      if (v > maiorV) { maiorV = v; porVolume = i; }
    });
    if (porTris !== porVolume) {
      console.warn('[bake] registro: o maior em triângulos não é o maior em caixa',
        'em', o.name, '— intocado.');
      continue;
    }
    const idx = geo.getIndex() as THREE.BufferAttribute | null;
    if (!idx) continue;
    const tubo = comps[porVolume];
    const resto = comps.filter((_, i) => i !== porVolume).flat();
    const novo = new Uint32Array(idx.count);
    let w = 0;
    for (const lista of [tubo, resto]) {
      for (const t of lista) {
        novo[w++] = idx.getX(t * 3);
        novo[w++] = idx.getX(t * 3 + 1);
        novo[w++] = idx.getX(t * 3 + 2);
      }
    }
    geo.setIndex(new THREE.BufferAttribute(novo, 1));
    geo.clearGroups();
    geo.addGroup(0, tubo.length * 3, 0);
    geo.addGroup(tubo.length * 3, resto.length * 3, 1);
    o.material = [tuboMat, corpoMat];
    divididos++;
    n++;
  }
  if (divididos) {
    console.info('[bake] registro dividido —', divididos, 'peça(s) · tubo',
      (tuboMat as THREE.Material).name, '+ corpo', (corpoMat as THREE.Material).name);
  }
  return n;
}

/**
 * As duas peças de engate do sobrechassi, com a cota MEDIDA nos DOIS bakes.
 *
 * A segunda cota é a do METAL (a malha `metal-pouco-polido` do semirreboque),
 * não a da capa: é a diferença entre união e metal que localiza o corte. Ver o
 * cabeçalho da seção.
 */
export function splitEngateHardware(root: THREE.Object3D): number {
  return splitFusedBlackCap(root, [0.017, 0.079, 0.057], [0.017, 0.079, 0.038],
    /^engate-femea-preto$/i, /^metal-pouco-polido/i)
    + splitFusedBlackCap(root, [0.054, 0.1495, 0.012], [0.039, 0.1495, 0.012],
      /^engate-macho-preto$/i, /^metal-pouco-polido/i);
}

/* ===========================================================================
   O TUBO E A FIAÇÃO DO THERMO KING, ATÉ EMBAIXO DO IMPLEMENTO

   *"preciso que termine esse tubo e fiação do thermo king que deve ir do thermo
   king até embaixo do implemento"* — Kennedy, 2026-08-22, com a foto do canto
   dianteiro.

   ⚠️ ISTO É GEOMETRIA NOVA, e é a primeira deste arquivo depois do filete do
   trilho. A regra da casa continua valendo — este módulo CORRIGE bake, não
   inventa peça —, e a exceção se justifica pelo mesmo argumento de
   `vehicle/chassis-parts.ts`: o que falta aqui o veículo real tem, e não dá
   para assar no `.glb` porque o percurso depende do BAÚ (a altura muda, o piso
   muda, e o `_v1` da árvore servida é imutável por contrato de cache).

   O QUE O ASSET JÁ TEM, MEDIDO (`thermoking_p360.glb`, espaço cru, componentes
   conexas de `refri_mat_0006_plastic_hard_6`):

       x  332…606   y 0…504   z 154…172     mangueira
       x  362…629   y 5…502   z 154…172     mangueira
       x −414…−395  y 51…406  z 154…161     eletroduto
       x −426…−407  y 52…406  z 154…161     eletroduto

   Quatro linhas que descem da carcaça e **param em y ≈ 0**, que é o pé da
   caixa da unidade. No caminhão real elas seguem pela testeira até abaixo do
   assoalho, onde entram no chicote e na linha de refrigerante. No estúdio elas
   simplesmente acabavam no ar, e é isso que a foto mostra.

   COMO O PERCURSO É DECIDIDO
   ---------------------------------------------------------------------------
   Nada aqui é cota do Scania nem do gancheiro. A ponta sai da PRÓPRIA linha (o
   agrupamento por componente conexa acha onde ela morre e com que espessura), a
   parede sai da caixa do corpo branco e o piso sai do perfil do baú. Trocar de
   implemento ou esticar o baú refaz tudo.

   ⚠️ E ELA É REFEITA A CADA MEDIDA, como os rebites do trilho: o piso não anda,
   mas a testeira anda em z e a unidade sobe com o teto. */

/** Nome dos nós que esta função cria e destrói. */
const TK_LINE_NODE = 'TS_TK_LINHA';
/** Casa os nós, para a exclusão da fusão. */
export const TK_LINE_MESH_RE = /^TS_TK_LINHA_\d+$/;
/** Uma componente mais alta que isto não é linha pendurada, é carcaça. */
const TK_LINE_MAX_ESPESSURA = 0.06;
/** Quanto a linha desce ABAIXO do piso do baú antes de acabar. */
const TK_LINE_ABAIXO_DO_PISO = 0.10;
/** Quanto a linha recua para dentro do vão do baú ao passar do piso. */
const TK_LINE_RECUO = 0.16;
/** Faixa em y, a partir da ponta, que define a SEÇÃO da linha. */
const TK_LINE_PONTA = 0.025;
/** Passo entre braçadeiras no trecho reto. 600 mm é o que se vê num chicote de
 *  unidade de refrigeração: perto o bastante para a linha não bater na parede e
 *  longe o bastante para não virar uma escada. */
const TK_LINE_PRESILHA = 0.60;
/** Quanto o tubo novo ENTRA na mangueira do asset, para a junção fechar.
 *  Nascer rente à ponta deixa uma fresta do tamanho do antialiasing; 25 mm de
 *  sobreposição dentro de uma peça opaca não custam nada e fecham a emenda. */
const TK_LINE_ENTRA = 0.025;

/**
 * Estende até abaixo do implemento as linhas que descem do Thermo King.
 *
 * IDEMPOTENTE: apaga o que uma chamada anterior criou.
 *
 * @param trailer  a raiz do implemento — é nela que os tubos nascem, porque a
 *                 ponta de baixo é ancorada no PISO e não na unidade
 * @param tk       a unidade, para achar as linhas
 * @param pisoY    o piso do baú, no referencial da raiz do implemento
 * @param paredeZ  a face dianteira do corpo branco, no mesmo referencial
 * @returns quantas linhas foram estendidas
 */
export function routeThermoKingLines(
  trailer: THREE.Object3D, tk: THREE.Object3D | null | undefined,
  pisoY: number, paredeZ: number,
): number {
  const velhos: THREE.Object3D[] = [];
  trailer.traverse((o) => { if (TK_LINE_MESH_RE.test(o.name || '')) velhos.push(o); });
  for (const o of velhos) {
    o.removeFromParent();
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) m.geometry.dispose();
  }
  if (!tk) return 0;

  trailer.updateWorldMatrix(true, true);

  /* ---- AS PONTAS SOLTAS ----
     Por COMPONENTE CONEXA e não por malha: as quatro linhas moram num material
     só (`plastic_hard`), junto com o painel de comando e as grades — dez
     componentes na mesma malha. É o mesmo caminho de `splitEngateHardware()`. */
  interface Ponta { x: number; z: number; y: number; r: number }
  const pontas: Ponta[] = [];
  const v = new THREE.Vector3();
  tk.updateWorldMatrix(true, true);
  tk.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry || !o.visible) return;
    const pos = o.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    const idx = o.geometry.getIndex();
    if (!pos || !idx) return;
    const n = pos.count;
    /* Solda por posição, união-find — a mesma de `componentesConexas()`. */
    const chave = new Map<string, number>();
    const pai = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const k = `${Math.round(pos.getX(i) * 1e5)},${Math.round(pos.getY(i) * 1e5)},`
        + `${Math.round(pos.getZ(i) * 1e5)}`;
      const j = chave.get(k);
      if (j === undefined) { chave.set(k, i); pai[i] = i; } else pai[i] = j;
    }
    const acha = (i: number): number => {
      let r = i;
      while (pai[r] !== r) r = pai[r];
      while (pai[i] !== r) { const t = pai[i]; pai[i] = r; i = t; }
      return r;
    };
    const une = (a: number, b: number) => {
      const ra = acha(a), rb = acha(b);
      if (ra !== rb) pai[ra] = rb;
    };
    for (let t = 0; t < idx.count; t += 3) {
      une(idx.getX(t), idx.getX(t + 1)); une(idx.getX(t), idx.getX(t + 2));
    }
    const grupos = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const r = acha(i);
      let g = grupos.get(r);
      if (!g) { g = []; grupos.set(r, g); }
      g.push(i);
    }
    const mat = trailer.matrixWorld.clone().invert().multiply(o.matrixWorld);
    for (const g of grupos.values()) {
      if (g.length < 12) continue;
      const b = new THREE.Box3();
      for (const i of g) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mat);
        b.expandByPoint(v);
      }
      /* Uma LINHA é esbelta nos dois eixos horizontais e desce: se ela fosse
         grossa seria carcaça, e se não descesse não teria ponta solta. */
      if (b.max.x - b.min.x > 0.35 || b.max.z - b.min.z > 0.35) continue;
      if (b.max.y - b.min.y < 0.15) continue;
      /* A SEÇÃO na ponta, e a ponta é o pé da componente. */
      const yPonta = b.min.y;
      let sx0 = Infinity, sx1 = -Infinity, sz0 = Infinity, sz1 = -Infinity;
      let n2 = 0;
      for (const i of g) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mat);
        if (v.y - yPonta > TK_LINE_PONTA) continue;
        sx0 = Math.min(sx0, v.x); sx1 = Math.max(sx1, v.x);
        sz0 = Math.min(sz0, v.z); sz1 = Math.max(sz1, v.z);
        n2++;
      }
      if (n2 < 4) continue;
      const espessura = Math.max(sx1 - sx0, sz1 - sz0);
      if (!(espessura > 0.004 && espessura < TK_LINE_MAX_ESPESSURA)) continue;
      /* E ela tem de estar SOLTA: a ponta acaba bem acima do piso. Uma linha que
         já chegasse embaixo não precisa de continuação — e é assim que esta
         função não faz nada num bake que já traga o percurso. */
      if (yPonta < pisoY + 0.15) continue;
      pontas.push({
        x: (sx0 + sx1) / 2, z: (sz0 + sz1) / 2, y: yPonta, r: espessura / 2,
      });
    }
  });
  if (!pontas.length) return 0;

  /* O MATERIAL É O DA LINHA DE AR DO PRÓPRIO IMPLEMENTO, por nome. Ele existe
     no gancheiro (`cano-ar-preto`, enxertado por `graft-materials.mjs`) e é o
     mesmo acabamento que a mangueira do registro traseiro usa — assim as duas
     tubulações do baú envelhecem juntas. Sem ele, o material da própria ponta. */
  let mat: THREE.Material | null = null;
  trailer.traverse((node) => {
    if (mat) return;
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (m && /cano-ar|mangueira|borracha-preta/i.test(m.name || '')) { mat = m; return; }
    }
  });
  const material = mat ?? new THREE.MeshStandardMaterial({
    name: 'tk-linha', color: 0x141416, metalness: 0.35, roughness: 0.52,
  });

  /* ▶▶ ONDE A CARCAÇA ACABA — é DELA que a linha tem de sair, não do coto.
     *"esse tubo na frontal continua não chegando até o thermo king"* — Kennedy,
     2026-08-22. E é literal: os cotos do asset descem 534 mm ABAIXO da carcaça
     antes de acabar, e o tubo novo nascia na ponta deles. De longe o conjunto
     lê como duas peças que não se encontram — o coto é fino e escuro, o tubo é
     redondo e escuro, e entre a carcaça branca e o começo do coto há um vão que
     o olho fecha como "não chega".
     Nascendo na barriga da carcaça, o percurso é UMA peça só da unidade até o
     chassi, e o coto do asset fica por dentro dele. */
  let barriga = -Infinity;
  tk.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.visible || !o.geometry) return;
    const mats = (Array.isArray(o.material) ? o.material : [o.material])
      .map((m) => m?.name || '').join('+');
    if (!/housing|carca|tk-housing/i.test(mats + (o.name || ''))) return;
    const a = o.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!a) return;
    const mm2 = new THREE.Matrix4().multiplyMatrices(
      new THREE.Matrix4().copy(trailer.matrixWorld).invert(), o.matrixWorld);
    const q = new THREE.Vector3();
    let lo = Infinity;
    for (let i = 0; i < a.count; i++) {
      q.set(a.getX(i), a.getY(i), a.getZ(i)).applyMatrix4(mm2);
      if (q.y < lo) lo = q.y;
    }
    if (lo > barriga) barriga = lo;
  });

  const yFim = pisoY - TK_LINE_ABAIXO_DO_PISO;
  let n = 0;
  for (const p of pontas) {
    if (yFim >= p.y - 0.05) continue;
    /* O topo do percurso: a barriga da carcaça quando ela foi achada, e a ponta
       do coto (com sobreposição) quando não. */
    const yTopo = isFinite(barriga) && barriga > p.y
      ? barriga - 0.005
      : p.y + TK_LINE_ENTRA;
    /* ▶▶ O PERCURSO — REESCRITO EM 2026-08-22, e as duas queixas que o
       reescreveram estão no traçado:

       *"ainda não está conectado esse cano no thermo king corretamente"*
         A primeira versão nascia 10 mm ABAIXO da ponta e já saía curvando em z
         na direção da parede. Uma Catmull-Rom com o segundo ponto deslocado nos
         dois eixos sai da ponta em diagonal: a junção abria uma meia-lua e o
         tubo parecia encostado, não emendado. Agora ela nasce 25 mm ACIMA da
         ponta (dentro da mangueira do asset, que é opaca) e o segundo ponto
         está na MESMA vertical — a tangente inicial é reta para baixo, que é
         como um tubo sai de um bocal.

       *"e nem estão indo até embaixo"*
         A primeira versão mergulhava para dentro a partir de `piso + 220 mm`,
         e o `zParede` que ela perseguia era a CAIXA do corpo branco (4 252 mm),
         não a PELE (4 194) — 58 mm de diferença. Resultado: a partir de meia
         altura o tubo cruzava o plano da parede e passava a ser desenhado
         DENTRO do baú, ou seja escondido pela própria chapa. Da rua, ele
         simplesmente sumia no meio do caminho. Agora ele desce **na vertical do
         próprio bocal**, que está por construção à frente de tudo (a unidade é
         montada na face externa), e só dobra para dentro DEPOIS de passar do
         piso, onde não há mais chapa para escondê-lo.

       Catmull-Rom e não segmentos retos: uma linha de ar dobra com raio, e uma
       quina viva num tubo de 14 mm lê como erro de modelagem. */
    const pontos = [
      new THREE.Vector3(p.x, yTopo, p.z),
      new THREE.Vector3(p.x, (yTopo + pisoY) / 2, p.z),
      new THREE.Vector3(p.x, pisoY + 0.10, p.z),
      new THREE.Vector3(p.x, pisoY - 0.02, p.z - TK_LINE_RECUO * 0.30),
      new THREE.Vector3(p.x, yFim, p.z - TK_LINE_RECUO),
    ];
    const curva = new THREE.CatmullRomCurve3(pontos, false, 'catmullrom', 0.2);
    const geo = new THREE.TubeGeometry(curva, 40, p.r, 10, false);
    const m = new THREE.Mesh(geo, material);
    m.name = `${TK_LINE_NODE}_${n}`;
    m.castShadow = m.receiveShadow = true;
    trailer.add(m);
    n++;

    /* ▶▶ AS BRAÇADEIRAS — *"a outra fiação precisa de seguradores que a parte
       inicial tem"*, Kennedy, 2026-08-22. O asset prende os primeiros 500 mm com
       presilhas e o resto descia solto: uma linha de 1,8 m sem apoio nenhum não
       existe em veículo nenhum, e é o que denunciava o trecho como acrescentado.

       Uma presilha a cada `TK_LINE_PRESILHA` ao longo do trecho RETO (a parte
       vertical, colada na parede — na curva de baixo ela não caberia), e ela é
       um anel achatado em volta do tubo, do mesmo material escuro. Instanciar
       não vale: são três ou quatro por linha. */
    const zPresilha = p.z - p.r - 0.004;
    for (let y = yTopo - TK_LINE_PRESILHA; y > pisoY + 0.18; y -= TK_LINE_PRESILHA) {
      const gp = new THREE.BoxGeometry(p.r * 2.9, 0.014, p.r * 2 + 0.016);
      gp.translate(p.x, y, zPresilha + (p.r * 2 + 0.016) / 2 - 0.004);
      const mp = new THREE.Mesh(gp, material);
      mp.name = `${TK_LINE_NODE}_${n - 1}_P${Math.round(y * 1000)}`;
      mp.castShadow = mp.receiveShadow = true;
      trailer.add(mp);
    }
  }
  if (n) {
    console.info('[tk] linhas estendidas —', n, 'de', pontas.length, 'ponta(s) solta(s)',
      `· do y ${(pontas[0].y * 1000).toFixed(0)} até ${(yFim * 1000).toFixed(0)} mm`,
      `· z ${(pontas[0].z * 1000).toFixed(0)} (parede em ${(paredeZ * 1000).toFixed(0)})`,
      `· Ø ${(pontas.map((p) => p.r * 2000).map((r) => r.toFixed(0)).join('/'))} mm`,
      `· material ${(material as THREE.Material).name}`);
  }
  return n;
}
