/* PLANTIO E ILUMINAÇÃO PÚBLICA — onde árvore e poste ficam, decidido aqui.
   ===========================================================================
   POR QUE ISTO EXISTE, e não é capricho de composição.

   O `set.glb` traz a vegetação e os postes já posicionados, e as duas coisas
   estavam autoradas em torno de um problema que não é de cenário: a câmera.
   Medido no set que está em disco:

     · OS POSTES TÊM UM VÃO DE 130 m. As onze torres `mast_*` correm em z −204,
       −202, −170, −164, −136, −126, −102, −88, −68 … e a próxima é +64. O
       caminhão fica em z 8…36 — ou seja, o buraco é exatamente onde o produto
       está. Não é distribuição, é desvio: tiraram o poste de perto do caminhão
       para ele não entrar na frente. (Medido depois: o vão era de 128 m; hoje o
       maior vão entre vizinhos é 27,2 m.)
     · QUATRO POSTES ILUMINAM O MATO. Os nós carregam duas rotações diferentes, e
       com o braço no +X local isso põe quatro dos seis `mast_m_*` apontando para
       FORA da rua. Passou por detalhe enquanto a luminária era geometria
       apagada; deixou de passar quando ela virou luz.
     · A VEGETAÇÃO ESTÁ ESPALHADA A ESMO. 10 protótipos instanciados (casca +
       folha por protótipo) com as instâncias jogadas por toda a área, inclusive
       em cima do asfalto e do pátio de concreto.

   A decisão do dono do produto foi tirar a câmera dessa conta: ela deixa de
   desviar e passa a ATRAVESSAR, com o que estiver na frente ficando
   transparente (ver `seethrough.ts`). Liberada essa amarra, árvore e poste
   podem ir para onde eles iriam num lugar de verdade — que é o que este módulo
   faz, em cima da geometria do próprio cenário e não de números cravados:

     · ÁRVORE VAI EM CANTEIRO E EM GRAMA. As faixas vêm do set: `median_0` é o
       canteiro central de 10,5 m entre as duas pistas, `turf_*` são as faixas
       de grama do perímetro. Nada é plantado em asfalto ou concreto porque
       nenhuma dessas malhas entra na lista de canteiros.
     · E O CANTEIRO CENTRAL É CURADO. Ele é o que fica ao lado do produto na
       foto, e o dono do produto vetou nele quatro coisas: raiz exposta, mini
       árvore, arbusto e tronco esbranquiçado. As faixas de grama continuam
       recebendo tudo. Ver `vetoNoCanteiro()` — os três critérios são MEDIDOS
       (porte, espalhamento da raiz, albedo da casca no atlas), porque o acervo
       não dá nome nem material que os separe.
     · POSTE SEGUE A BEIRA. As duas linhas de x já estavam certas e ficam: −9,12
       (dentro do canteiro) e +11,47 (a beira do pátio, que começa em x = 10,35).
       O que muda é o Z — passo constante, alternando os lados, sem vão — e a
       ORIENTAÇÃO do braço, que passa a apontar para o eixo da rua. As linhas de x
       são lidas da POSIÇÃO DO NÓ e não do centro da caixa envolvente: a caixa
       inclui o braço, então o centro dela fica 1,2 m para o lado, e com metade
       dos nós virados ao contrário isso dava duas linhas que não existem (±10,3)
       — uma média entre os certos e os errados, que escondia o defeito de
       orientação.
     · E É DAQUI QUE SAI ONDE A LUZ VAI. `lamps.ts` recebe as luminárias medidas
       e põe refletor e vidro aceso nelas: o cenário é dono do fixture, o engine é
       dono da luz. Ver `LampSite` lá.

   TUDO DETERMINÍSTICO. Um configurador que sorteia o cenário a cada F5 é um
   configurador que o cliente não reconhece de uma sessão para a outra, e uma
   foto aprovada deixa de ser reproduzível. O gerador é um `mulberry32` semeado
   por uma constante — mesma árvore no mesmo lugar, sempre. */
import * as THREE from 'three';
import { setLampSites } from './lamps';
import type { LampSite, LampSiteGeo } from './lamps';

/** Semente fixa: ver o cabeçalho. Trocar isto replanta o distrito inteiro. */
const SEED = 0x5eed1e;

/** mulberry32 — 32 bits de estado, distribuição boa o bastante para plantio. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- as faixas plantáveis ----------------
   Lidas do próprio set pelo NOME da malha, e não cravadas: um cenário novo que
   nomeie o canteiro de `median_1` entra sem tocar aqui, e um que não tenha
   canteiro nenhum simplesmente não recebe plantio (em vez de plantar no ar). */
const CANTEIRO_RE = /^median|^rb_island/i;
const GRAMA_RE = /^turf_/i;
/* Margem para dentro da faixa. Um tronco no fio do meio-fio lê como erro de
   modelagem; 1,2 m é a distância que uma muda real guarda do bordo. */
const INSET = 1.2;

interface Faixa {
  min: THREE.Vector2;
  max: THREE.Vector2;
  /**
   * A extensão CRUA da malha, sem o `INSET`.
   *
   * As duas caixas existem porque servem a perguntas opostas: `min`/`max` dizem
   * "onde eu POSSO plantar" (recuado do meio-fio), e `bMin`/`bMax` dizem "até
   * onde esta faixa VAI" — que é o que responde "esta planta está no canteiro?".
   * Usar a recuada para a segunda pergunta deixa uma orla de 1,2 m por onde
   * escapa exatamente o que o veto queria barrar. Aconteceu: um arbusto sobrou
   * no canteiro porque estava DENTRO do meio-fio e FORA da caixa recuada.
   */
  bMin: THREE.Vector2;
  bMax: THREE.Vector2;
  /** Área útil, em m² — é ela que reparte as instâncias entre as faixas. */
  area: number;
  canteiro: boolean;
}

function coletarFaixas(root: THREE.Object3D) {
  const box = new THREE.Box3();
  const faixas: Faixa[] = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const nome = mesh.name || '';
    const canteiro = CANTEIRO_RE.test(nome);
    if (!canteiro && !GRAMA_RE.test(nome)) return;
    box.setFromObject(mesh);
    if (box.isEmpty()) return;
    const min = new THREE.Vector2(box.min.x + INSET, box.min.z + INSET);
    const max = new THREE.Vector2(box.max.x - INSET, box.max.z - INSET);
    if (max.x <= min.x || max.y <= min.y) return;      // faixa estreita demais
    faixas.push({ min, max,
      bMin: new THREE.Vector2(box.min.x, box.min.z),
      bMax: new THREE.Vector2(box.max.x, box.max.z),
      area: (max.x - min.x) * (max.y - min.y), canteiro });
  });
  return faixas;
}

/* ---------------- os protótipos ----------------
   Casca e folha do MESMO indivíduo são duas malhas irmãs e têm de receber a
   MESMA matriz, ou a copa descola do tronco.

   ===========================================================================
   O PAR É ESTRUTURAL, NÃO NOMINAL, e essa troca é uma correção de defeito.

   A primeira versão pareava pelo NOME, tirando o sufixo `_1` — porque é assim
   que o GLTFLoader batiza a segunda primitiva de uma malha glTF: `tree_pk_3` e
   `tree_pk_3_1`. Parece exato e não é, porque **o índice do protótipo também
   pode ser 1**. Medido no set: as espécies são `bush_pk_0…3` e `tree_pk_0…5`,
   então

     · `tree_pk_1`   (a CASCA do protótipo 1) → tira `_1` → chave `tree_pk`
     · `tree_pk_1_1` (a COPA do protótipo 1)  → tira `_1` → chave `tree_pk_1`

   ou seja, tronco e copa do protótipo 1 caem em chaves DIFERENTES, e o
   protótipo 1 nunca forma par. As consequências eram duas, ambas invisíveis
   sem medir: no plantio, os dois pedaços do protótipo 1 ficavam com `altura`
   zero (o teste `!/_1$/` classificava os DOIS como folha) e eram descartados —
   então `tree_pk_1` e `bush_pk_1` continuavam nas posições de FÁBRICA, em cima
   do asfalto, que é o defeito que este módulo existe para consertar; e no
   atravessar, tronco e copa recebiam vereditos independentes, que é a meia
   árvore que aquele módulo existe para matar. Quatro dos dez protótipos.

   A estrutura, ao contrário do nome, é inequívoca: para uma malha glTF de VÁRIAS
   primitivas o GLTFLoader cria um `Group` e põe as primitivas dentro
   (`GLTFMeshGpuInstancing.createNodeMesh` → `nodeObject.isGroup` → `add(...)`),
   e para uma de UMA primitiva devolve a malha direto. Então: irmãos sob um Group
   de primitivas são o mesmo indivíduo, e quem não tem esse Group é sozinho. */

/**
 * A chave de agrupamento de um `InstancedMesh` do set: o `Group` de primitivas
 * que o contém, ou ele mesmo quando não há um.
 *
 * O reconhecimento do Group é deliberadamente estreito — poucos filhos e TODOS
 * instanciados —, porque um Group qualquer da cena (um nó de agrupamento do
 * autor) não pode ser confundido com um de primitivas: isso fundiria protótipos
 * diferentes num só indivíduo.
 *
 * Exportada porque `seethrough.ts` precisa do MESMO agrupamento — se os dois
 * módulos discordarem, um replanta a árvore inteira e o outro a dissolve pela
 * metade. Uma regra sutil em dois lugares divergiria na primeira mudança.
 */
export function grupoDePrimitivas(im: THREE.Object3D): THREE.Object3D {
  const p = im.parent;
  if (!p || !(p as THREE.Group).isGroup) return im;
  const n = p.children.length;
  if (n < 2 || n > 4) return im;
  for (const c of p.children) if (!(c as THREE.InstancedMesh).isInstancedMesh) return im;
  return p;
}
interface Proto {
  base: string;
  malhas: THREE.InstancedMesh[];
  /** Quantas instâncias o GLB alocou — o teto, que não aumentamos. */
  cap: number;
  /** Altura do protótipo em unidades locais, para separar árvore de arbusto. */
  altura: number;
  /** Onde a base do modelo está em Y local — o que põe o pé no chão. */
  peY: number;
  /** A malha de casca, quando o acervo a nomeia — é nela que se mede. */
  casca: THREE.InstancedMesh | null;
  /**
   * Raio máximo da casca ABAIXO da linha de chão do próprio modelo (y = 0
   * local), ou seja o quanto a raiz se espalha. Ver `RAIZ_APARENTE`.
   */
  raizR: number;
  /** Albedo médio do TRONCO, lido do atlas. `null` = não deu para medir. */
  albedo: { lum: number; sat: number } | null;
}

function coletarProtos(root: THREE.Object3D) {
  const porGrupo = new Map<THREE.Object3D, Proto>();
  root.traverse((o) => {
    const im = o as THREE.InstancedMesh;
    if (!im.isInstancedMesh || !im.geometry) return;
    const mat = Array.isArray(im.material) ? im.material[0] : im.material;
    if (!mat || !/^PLANT_/.test((mat as THREE.Material).name || '')) return;
    const chave = grupoDePrimitivas(im);
    let p = porGrupo.get(chave);
    if (!p) {
      p = { base: chave.name || im.name || '?', malhas: [], cap: Infinity, altura: 0,
        peY: 0, casca: null, raizR: 0, albedo: null };
      porGrupo.set(chave, p);
    }
    p.malhas.push(im);
    p.cap = Math.min(p.cap, im.count);
  });
  /* O PÉ É O DO TRONCO, e o tronco é reconhecido pelo MATERIAL.
     -------------------------------------------------------------------------
     A ALTURA é a do indivíduo INTEIRO (união das peças) — é ela que a repartição
     por porte quer saber. Mas o PÉ não pode ser o mínimo da união, e isto foi
     medido: 166 das 469 plantas ficaram com o pé fora do chão quando era. A
     folhagem de várias espécies deste acervo desce ABAIXO da base do tronco (mato
     rasteiro modelado junto), então ancorar no mínimo da união LEVANTA a planta
     até a folha mais baixa tocar o chão — e deixa o tronco flutuando. Um tronco
     no ar é o defeito; folha entrando no chão não é (é assim que se vê no campo).

     Quem tem tronco é `PLANT_BARK`, e o nome do material é dado autorado — o
     mesmo raciocínio de sempre neste projeto: perguntar ao asset. O fallback (a
     peça que desce mais) vale para um acervo futuro sem essa nomenclatura. */
  const bb = new THREE.Box3();
  const uni = new THREE.Box3();
  for (const p of porGrupo.values()) {
    uni.makeEmpty();
    let peY = Infinity, peCasca = NaN;
    for (const im of p.malhas) {
      if (!im.geometry.boundingBox) im.geometry.computeBoundingBox();
      const b = im.geometry.boundingBox;
      if (!b) continue;
      bb.copy(b);
      uni.union(bb);
      if (bb.min.y < peY) peY = bb.min.y;
      const mat = Array.isArray(im.material) ? im.material[0] : im.material;
      if (/BARK/i.test((mat as THREE.Material)?.name || '')) { peCasca = bb.min.y; p.casca = im; }
    }
    if (uni.isEmpty()) continue;
    p.altura = uni.max.y - uni.min.y;
    p.peY = Number.isFinite(peCasca) ? peCasca
      : (Number.isFinite(peY) ? peY : uni.min.y);
    p.raizR = medirRaiz(p.casca);
  }
  return [...porGrupo.values()].filter((p) => p.altura > 0 && p.malhas.length > 0);
}

/**
 * O raio da RAIZ: o quanto a casca se espalha abaixo da linha de chão do
 * próprio modelo.
 *
 * ===========================================================================
 * POR QUE `y = 0` LOCAL É A LINHA DE CHÃO, e não o pé da geometria. Quem
 * modelou a árvore pôs a origem onde o terreno ficaria — o que está abaixo
 * dela é raiz, feita para ser ENTERRADA. Como este módulo ancora pelo pé do
 * TRONCO (ver `matrizDe`, e o porquê logo acima), esse pedaço enterrado sobe
 * inteiro para cima da grama: a árvore passa a se equilibrar sobre uma aranha
 * de raízes, que é a *"raiz exposta e flutuando"* que o dono do produto
 * fotografou no canteiro central.
 *
 * A medida é o raio, porque é ele que se vê: uma raiz pivotante fina some no
 * pé do tronco, uma sapopema de 1,2 m de raio vira aranha. Medido nas dez
 * espécies deste acervo, normalizado pela altura da casca:
 *
 *     tree_pk_5 0,274 · tree_pk_0 0,176 ‖ tree_pk_2 0,059 · tree_pk_1 0,050
 *     tree_pk_4 0,051 · tree_pk_3 0,043
 *
 * Duas populações separadas por um fator TRÊS, com o corte de `RAIZ_APARENTE`
 * no meio do vão. Não é ajuste fino: é um buraco no histograma.
 */
function medirRaiz(casca: THREE.InstancedMesh | null) {
  if (!casca) return 0;
  const pos = casca.geometry.getAttribute('position');
  if (!pos) return 0;
  let r = 0;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) >= 0) continue;
    const d = Math.hypot(pos.getX(i), pos.getZ(i));
    if (d > r) r = d;
  }
  return r;
}

/* ---------------- a cor da casca, lida do atlas ----------------
   ===========================================================================
   POR QUE ISTO NÃO SAI DO NOME NEM DO MATERIAL. O acervo tem UM material de
   casca, `PLANT_BARK`, para as dez espécies — o que muda de uma para outra é a
   REGIÃO do atlas que as UVs pegam. Então não há nome, não há material e não há
   sinal nenhum na declaração do glTF que separe o plátano de tronco oliva do
   eucalipto de tronco branco: a informação só existe nos PIXELS.

   E é preciso separá-los porque *"as árvores com o tronco esbranquiçado"* são
   um pedido explícito do dono do produto para o canteiro central.

   O QUE SE MEDE. A média, PONDERADA POR ÁREA de triângulo, do albedo na faixa
   de tronco (10 %…45 % da altura da casca — abaixo disso é raiz, acima começa
   a ramificação), descartando os triângulos de face para cima, que são galho
   visto de topo e não casca vista de lado. Duas grandezas saem daí:

     · LUMINÂNCIA linear — quão CLARO;
     · SATURAÇÃO — quão CINZA.

   "Esbranquiçado" é claro E cinza, e são os DOIS: um tronco marrom claro não é
   esbranquiçado, um cinza-chumbo escuro também não. Medido nas dez espécies
   (lum · sat):

     tree_pk_2 0,156 · 0,04   ⟵ branco
     tree_pk_1 0,130 · 0,10   ⟵ branco
     tree_pk_3 0,110 · 0,20       tree_pk_0 0,110 · 0,21
     tree_pk_5 0,099 · 0,17       tree_pk_4 0,079 · 0,38

   Os cortes caem nos dois vãos, e cada eixo sozinho já separaria — exigir os
   dois é o que garante que uma espécie só é reprovada quando as duas medidas
   concordam.

   O CUSTO É UM `drawImage` DE 128², uma vez por carga de cenário. O atlas vem
   DENTRO do `.glb` (bufferView), então o canvas nunca é de outra origem e o
   `getImageData` não tem como ser barrado por CORS — a armadilha que
   `livery.ts` documenta para as fotos de painel não alcança aqui. Ainda assim o
   `catch` existe: sem pixels a medida ABSTÉM-SE (`albedo` fica `null`) e o
   critério deixa de reprovar, porque um canteiro pelado é pior que um canteiro
   com uma espécie a mais. */

/** Lado do canvas de amostragem. 128 dá 16 px por célula de um atlas 8×8. */
const ATLAS_LADO = 128;

/** sRGB de 0…255 para luminância linear. */
function s2l(c: number) {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function lerAtlas(tex: THREE.Texture | null | undefined, cache: Map<unknown, ImageData | null>) {
  const img = tex?.image as CanvasImageSource | undefined;
  if (!img) return null;
  if (cache.has(img)) return cache.get(img) ?? null;
  let dados: ImageData | null = null;
  try {
    const cv = document.createElement('canvas');
    cv.width = ATLAS_LADO; cv.height = ATLAS_LADO;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(img, 0, 0, ATLAS_LADO, ATLAS_LADO);
      dados = ctx.getImageData(0, 0, ATLAS_LADO, ATLAS_LADO);
    }
  } catch {
    /* Sem pixels a espécie não é reprovada — ver o cabeçalho acima. */
    dados = null;
  }
  cache.set(img, dados);
  return dados;
}

function medirAlbedos(protos: Proto[]) {
  const cache = new Map<unknown, ImageData | null>();
  for (const p of protos) {
    const casca = p.casca;
    if (!casca) continue;
    const mat = (Array.isArray(casca.material) ? casca.material[0] : casca.material) as
      THREE.MeshStandardMaterial | undefined;
    const atlas = lerAtlas(mat?.map, cache);
    if (!atlas) continue;
    const geo = casca.geometry;
    const pos = geo.getAttribute('position');
    const uv = geo.getAttribute('uv');
    if (!pos || !uv) continue;
    const idx = geo.index;
    const tris = (idx ? idx.count : pos.count) / 3;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const lo = minY + (maxY - minY) * 0.10, hi = minY + (maxY - minY) * 0.45;
    let area = 0, sl = 0, sr = 0, sg = 0, sb = 0;
    for (let t = 0; t < tris; t++) {
      const a = idx ? idx.getX(t * 3) : t * 3;
      const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      const ay = pos.getY(a), by = pos.getY(b), cy = pos.getY(c);
      const yc = (ay + by + cy) / 3;
      if (yc < lo || yc > hi) continue;
      const e1x = pos.getX(b) - pos.getX(a), e1y = by - ay, e1z = pos.getZ(b) - pos.getZ(a);
      const e2x = pos.getX(c) - pos.getX(a), e2y = cy - ay, e2z = pos.getZ(c) - pos.getZ(a);
      const nx = e1y * e2z - e1z * e2y;
      const ny = e1z * e2x - e1x * e2z;
      const nz = e1x * e2y - e1y * e2x;
      const A = Math.hypot(nx, ny, nz) / 2;
      if (A < 1e-9) continue;
      /* Face mais horizontal que vertical é galho visto de cima, não casca. */
      if (Math.abs(ny) > Math.hypot(nx, nz)) continue;
      const u = (uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3;
      const v = (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3;
      /* `flipY` é FALSO nas texturas de glTF, então v = 0 é a primeira linha da
         imagem — a mesma que o `drawImage` põe no topo do canvas. Sem inverter. */
      const px = Math.min(ATLAS_LADO - 1, Math.max(0, Math.floor((((u % 1) + 1) % 1) * ATLAS_LADO)));
      const py = Math.min(ATLAS_LADO - 1, Math.max(0, Math.floor((((v % 1) + 1) % 1) * ATLAS_LADO)));
      const o = (py * ATLAS_LADO + px) * 4;
      const r = atlas.data[o], g2 = atlas.data[o + 1], b2 = atlas.data[o + 2];
      area += A; sr += r * A; sg += g2 * A; sb += b2 * A;
      sl += (0.2126 * s2l(r) + 0.7152 * s2l(g2) + 0.0722 * s2l(b2)) * A;
    }
    if (!area) continue;
    const R = sr / area, G = sg / area, B = sb / area;
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    p.albedo = { lum: sl / area, sat: mx > 0 ? (mx - mn) / mx : 0 };
  }
}

/* ---------------- quem tem vaga no canteiro central ----------------
   ===========================================================================
   O CANTEIRO É CURADO, E O RESTO NÃO. Este é um pedido do dono do produto sobre
   o canteiro central do distrito, com as palavras dele: fora *"as árvores que
   têm a raiz exposta e estão flutuando"*, fora *"todas as mini árvores e os
   arbustos"*, fora *"as árvores com o tronco esbranquiçado"* — e *"nos canteiros
   ao redor deve manter como está"*.

   Então a reprovação vale SÓ para as faixas de canteiro. As faixas de grama
   continuam recebendo exatamente o que recebiam, inclusive as espécies vetadas
   aqui — as duas grandes (`tree_pk_4`, `tree_pk_5`) nunca entraram no canteiro
   de qualquer forma, e os arbustos ficam com a grama, que já era o destino da
   esmagadora maioria deles.

   Uma espécie reprovada que não tenha OUTRO destino simplesmente não é plantada
   (`im.count = 0`, o caminho que `plantar()` já tinha). Empurrá-la para a grama
   seria mudar os canteiros ao redor, que é justamente o que foi pedido para
   ficar como está. */

/** Raiz que se espalha mais que isto, em fração da altura, lê como aranha. */
const RAIZ_APARENTE = 0.10;
/** Acima desta luminância linear o tronco lê como CLARO. */
const CASCA_CLARA = 0.12;
/** Abaixo desta saturação ele lê como CINZA. Claro + cinza = esbranquiçado. */
const CASCA_NEUTRA = 0.14;

/** Por que a espécie não serve ao canteiro, ou `null` se serve. */
function vetoNoCanteiro(p: Proto): string | null {
  if (p.altura < PORTE_ARBUSTO) return 'porte de arbusto';
  if (p.altura > PORTE_GRANDE) return 'porte grande demais';
  if (p.raizR > p.altura * RAIZ_APARENTE) return 'raiz aparente';
  if (p.albedo && p.albedo.lum >= CASCA_CLARA && p.albedo.sat <= CASCA_NEUTRA) {
    return 'casca esbranquiçada';
  }
  return null;
}

/* ---------------- o plantio ----------------
   REPARTIÇÃO POR PORTE, e é o que separa "distribuído" de "espalhado". Uma
   árvore de 15 m no canteiro de 10,5 m entre duas pistas não existe na vida
   real — ela vai para o perímetro; o canteiro recebe porte médio, alinhado,
   porque canteiro de via é plantio ORDENADO; e arbusto fecha o pé dos dois.

   Os limiares são do próprio acervo (as dez espécies deste set medem de 1,1 a
   17,2 m), não constantes universais. */
const PORTE_ARBUSTO = 4;
const PORTE_GRANDE = 11;

/** Passo do alinhamento do canteiro, em metros. Alameda, não bosque. */
const PASSO_CANTEIRO = 14;
/** Jitter do alinhamento — sem ele a fileira lê como régua, com muito lê como mato. */
const JITTER_CANTEIRO = 1.6;

function plantar(protos: Proto[], faixas: Faixa[]) {
  const canteiros = faixas.filter((f) => f.canteiro);
  const gramas = faixas.filter((f) => !f.canteiro);
  const rand = rng(SEED);
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const esc = new THREE.Vector3();
  const eixoY = new THREE.Vector3(0, 1, 0);

  /* Quem pode ir aonde. Um protótipo sem destino não é plantado — e sumir é
     melhor que aparecer no meio da pista, que é o estado de hoje.

     O VETO SÓ TIRA CANTEIRO, nunca acrescenta grama: o que a espécie já tinha
     de destino fora do canteiro ela continua tendo, e o que ela só tinha DENTRO
     dele ela perde. É essa assimetria que atende *"as remoções devem ser
     somente no canteiro central, nos canteiros ao redor manter como está"* — o
     contrário (empurrar a árvore vetada para a grama) mudaria justamente o que
     foi pedido para não mudar. */
  const destino = (p: Proto) => {
    const base = p.altura < PORTE_ARBUSTO ? [...canteiros, ...gramas]
      : p.altura > PORTE_GRANDE ? (gramas.length ? gramas : canteiros)
        : (canteiros.length ? canteiros : gramas);
    return vetoNoCanteiro(p) ? base.filter((f) => !f.canteiro) : base;
  };

  /* AS ESPÉCIES DA ALAMEDA DIVIDEM AS ESTAÇÕES, e isto é uma correção.
     ------------------------------------------------------------------------
     Cada protótipo alinhado percorria a faixa inteira sozinho, e como a
     estação é `t = (i + 0,5) / n` — a mesma conta para todos —, N espécies
     caíam nos MESMOS pontos, separadas só pelo jitter de ±1,6 m. Quatro
     espécies aprovadas no canteiro central deste set davam quatro troncos
     dentro de uma caixa de 3,2 m a cada 14 m: a "parede de troncos" que o dono
     do produto fotografou, e que nenhum ajuste de passo consertaria porque o
     passo estava certo — o que estava errado era cada espécie ignorar as
     outras.

     Round-robin: a espécie de índice `k` fica com as estações k, k+K, k+2K…
     Com UMA espécie aprovada (o estado de hoje, depois do veto) o laço é
     idêntico ao anterior; com duas ou mais, a alameda alterna em vez de
     empilhar. */
  const alinhados = protos.filter((p) => {
    const alvos = destino(p);
    return p.altura >= PORTE_ARBUSTO && p.altura <= PORTE_GRANDE
      && alvos.some((f) => f.canteiro);
  });

  for (const p of protos) {
    const alvos = destino(p);
    const usados: THREE.Matrix4[] = [];
    if (!alvos.length) { for (const im of p.malhas) im.count = 0; continue; }

    const vez = alinhados.indexOf(p);
    const alinhado = vez >= 0;

    if (alinhado) {
      /* ALAMEDA: passo fixo ao longo do eixo LONGO da faixa, com o tronco no
         meio da largura e um jitter pequeno nos dois eixos. */
      for (const f of alvos) {
        const lx = f.max.x - f.min.x, lz = f.max.y - f.min.y;
        const aoLongoDeZ = lz >= lx;
        const comp = aoLongoDeZ ? lz : lx;
        const n = Math.max(1, Math.floor(comp / PASSO_CANTEIRO));
        for (let i = vez % Math.max(1, alinhados.length); i < n && usados.length < p.cap;
          i += Math.max(1, alinhados.length)) {
          const t = (i + 0.5) / n;
          const meio = aoLongoDeZ
            ? (f.min.x + f.max.x) / 2 : (f.min.y + f.max.y) / 2;
          const along = (aoLongoDeZ ? f.min.y : f.min.x) + t * comp;
          const jx = (rand() - 0.5) * 2 * JITTER_CANTEIRO;
          const jz = (rand() - 0.5) * 2 * JITTER_CANTEIRO;
          const x = (aoLongoDeZ ? meio : along) + jx;
          const z = (aoLongoDeZ ? along : meio) + jz;
          usados.push(matrizDe(p, x, z, rand, q, pos, esc, eixoY));
        }
      }
    } else {
      /* MASSA: sorteio por área, para uma faixa três vezes maior receber três
         vezes mais árvores em vez de o mesmo tanto.

         E O SORTEIO É REJEITADO QUANDO CAI NO CANTEIRO, para uma espécie vetada
         lá. Tirar o canteiro da lista de alvos NÃO BASTA, e isso foi medido: as
         caixas envolventes das faixas SE SOBREPÕEM — a ilha da rotatória
         (`rb_island`, x −16,6…−1,6 · z 98…113) fica dentro de uma faixa de
         grama —, então sortear "na grama" ainda põe planta na ilha. Um arbusto
         escapou por aí. */
      const total = alvos.reduce((s, f) => s + f.area, 0) || 1;
      const quantas = Math.min(p.cap, Math.max(1, p.cap));
      const vetado = !!vetoNoCanteiro(p) && canteiros.length > 0;
      for (let i = 0; i < quantas; i++) {
        let x = 0, z = 0, serve = false;
        /* Oito tentativas: com o canteiro ocupando menos de 2 % da área
           sorteável, a chance de oito seguidas caírem nele é nula na prática —
           e se caírem, a instância é PULADA em vez de plantada no canteiro. */
        for (let tent = 0; tent < 8 && !serve; tent++) {
          let r = rand() * total;
          let f = alvos[0];
          for (const cand of alvos) { r -= cand.area; f = cand; if (r <= 0) break; }
          x = f.min.x + rand() * (f.max.x - f.min.x);
          z = f.min.y + rand() * (f.max.y - f.min.y);
          /* Contra a extensão CRUA do canteiro, e não contra a recuada — ver o
             porquê no campo `bMin` de `Faixa`. */
          serve = !vetado || !canteiros.some(
            (c) => x >= c.bMin.x && x <= c.bMax.x && z >= c.bMin.y && z <= c.bMax.y);
        }
        if (!serve) continue;
        usados.push(matrizDe(p, x, z, rand, q, pos, esc, eixoY));
      }
    }

    for (const im of p.malhas) {
      for (let i = 0; i < usados.length; i++) im.setMatrixAt(i, usados[i]);
      im.count = usados.length;
      im.instanceMatrix.needsUpdate = true;
      /* As caixas envolventes são as do plantio ANTIGO até isto rodar, e é por
         elas que o three descarta a malha inteira do frustum — e do passe de
         sombra. Sem os dois recomputes a copa some em metade das órbitas. */
      im.computeBoundingBox();
      im.computeBoundingSphere();
    }
  }
}

/** Uma matriz de instância: pé no chão, giro livre em Y, porte variado. */
function matrizDe(p: Proto, x: number, z: number, rand: () => number,
  q: THREE.Quaternion, pos: THREE.Vector3,
  esc: THREE.Vector3, eixoY: THREE.Vector3) {
  /* ±18 % de porte. Um pomar de clones idênticos é a assinatura de cenário
     gerado; é a variação de tamanho, mais que a de posição, que desmancha. */
  const s = 0.82 + rand() * 0.36;
  q.setFromAxisAngle(eixoY, rand() * Math.PI * 2);
  esc.set(s, s, s);
  /* `-peY * s`: a origem do modelo não é o pé dele. Sem isto metade do acervo
     nasce enterrada e a outra metade flutuando. */
  pos.set(x, -p.peY * s, z);
  return new THREE.Matrix4().compose(pos, q, esc);
}

/* ---------------- os postes ----------------
   As duas linhas de X do set estão certas e ficam (ver o cabeçalho). O que este
   passo refaz é o Z — passo constante ao longo do trecho que os postes já
   ocupavam, alternando os lados — e a ORIENTAÇÃO.

   ALTERNADO, e não pareado: iluminação viária de pista dupla é escalonada — um
   poste de cada lado a meio passo — porque isso cobre a via com metade dos
   postes de um arranjo frente a frente. É também o que `lamps.ts` já faz no
   arranjo procedural, então os dois caminhos concordam.

   ===========================================================================
   O BRAÇO DE QUATRO DELES APONTAVA PARA FORA DA RUA, e isso é um defeito do
   `.glb` que só aparece quando se vai acender a luminária — enquanto ela era
   geometria apagada, um braço virado para o mato passava por detalhe. Medido nos
   nós do arquivo: a geometria `mast` tem a luminária no +X local (x 1,59…2,47) e
   os onze nós carregam duas rotações diferentes,

     · `mast_e_*` (x = +11,47) e a maioria dos `mast_m_*`: (0,−1,0,0), ou seja
       180° em Y ⇒ braço para −X;
     · `mast_m_3` e `mast_m_5`: identidade ⇒ braço para +X.

   Com o mastro do lado LESTE a rua está em −X, e com o do lado OESTE está em +X.
   Logo: os cinco do leste estavam certos, os dois de identidade do oeste estavam
   certos, e os QUATRO `mast_m_*` com 180° iluminavam o canteiro atrás deles.

   A correção não copia rotação de vizinho — ela DERIVA do lado: o braço tem de
   apontar para o eixo da rua, então o alvo é −X para x > 0 e +X para x < 0. E é
   verificada no mundo em vez de assumida no nó, porque a raiz do set pode ter
   `rotationY` e o pai pode ter o que quiser: mede-se a direção do braço depois
   de escrever e, se ela ficou do lado errado, gira meia volta. Um teste em vez
   de uma suposição sobre a hierarquia.

   ===========================================================================
   E DAQUI SAI ONDE A LUZ VAI. `lamps.ts` recebe as luminárias medidas (posição
   do mastro, para onde o braço aponta, altura e alcance) e põe o refletor e o
   vidro aceso nelas — ver o cabeçalho de `LampSite` lá. As medidas saem da
   GEOMETRIA, nunca de constante: um set novo com torre de 12 m entra sem tocar
   em código. */
const MAST_RE = /^mast_/i;

/** Eixo Y para as rotações e para medir o braço. */
const EIXO_Y = new THREE.Vector3(0, 1, 0);

/**
 * Onde a luminária está, na geometria do mastro e em unidades LOCAIS dele.
 *
 * O braço é o extremo da caixa no eixo horizontal de maior alcance, e a
 * luminária é o pedaço além de 60 % dele — no `mast` deste set isso recorta
 * exatamente a caixa 1,59…2,47 x 9,69…10,03 que o dump do glTF mostra.
 *
 * ===========================================================================
 * O QUE SE MEDE É A FACE DE BAIXO, E NÃO A CAIXA DO CONJUNTO.
 *
 * Relato: *"a luz do poste, a posicao dela, oque seria o vidro, nao esta batendo
 * corretamente como deveria, a angulacao"*. A sonda `checks-poste-vidro.mjs`
 * fotografou de perto e mediu, nos onze postes, sempre os mesmos números:
 *
 *     luminária  tam(0,87 x 0,34 x 0,42)   centro (−7,09 · 9,87)
 *     vidro      tam(0,87 x 0,04 x 0,48)   centro (−7,18 · 9,68)
 *
 * Ou seja o vidro saía **6 cm MAIS LARGO que a carcaça inteira** (0,48 contra
 * 0,42) e deslocado 9 cm para dentro. Na foto isso é uma chapa branca acesa
 * transbordando pelos dois lados de uma luminária que ainda por cima é TRONCADA
 * — a face de baixo dela é bem mais estreita que a caixa. Duas causas, as duas
 * aqui:
 *
 *   1. `lensT` já era medido e **o manifesto de saída o descartava**: só
 *      `lensR` chegava a `lamps.ts`, e a largura vinha de `LAMP_LENS_ASPECT`
 *      (0,55), uma constante afinada para a luminária PROCEDURAL. 0,437 × 2 ×
 *      0,55 = 0,481 — os 6 cm a mais, exatamente.
 *   2. o alcance era a MÉDIA dos vértices além do corte, e essa média inclui o
 *      TUBO DO BRAÇO, que puxa o centro para dentro. Daí os 9 cm: a média deu
 *      1,937 e o centro real da luminária é (1,59 + 2,47)/2 = 2,03.
 *
 * ===========================================================================
 * E A CAUSA PRINCIPAL É A TERCEIRA: **A LUMINÁRIA DESTE SET É INCLINADA.**
 *
 * Medir "o quinto de baixo" foi tentado e devolveu 0,21 m de comprimento contra
 * 0,87 m do conjunto — um número absurdo, que só faz sentido se o pedaço mais
 * baixo for uma PONTA e não uma face. O perfil por faixas de altura (a sonda
 * imprime `faixa 0…9`) mostrou o porquê, e são 36 vértices ao todo:
 *
 *     y 9,692            a 1,626           t ±0,21     ← a ponta de dentro, embaixo
 *     y 9,826…9,860      a 1,593…1,769     t ±0,21
 *     y 9,860…9,894      a 2,467           t ±0,21     ← a ponta de fora, no alto
 *     y 9,994…10,028     a 2,434           t ±0,21
 *
 * Ou seja a carcaça é uma CUNHA: ela desce do lado do braço para o lado da rua.
 * A face de baixo sobe ~0,17 m ao longo de 0,84 m de alcance — **11,3° de
 * inclinação**. E o vidro era uma caixa HORIZONTAL: ele encostava na luminária só
 * na ponta de dentro e ficava até 17 cm pendurado no ar na ponta de fora. É
 * exatamente *"a angulacao"* do relato.
 *
 * Então a medida certa não é uma faixa, é o PLANO da face de baixo: menor y por
 * faixa de alcance, reta ajustada por mínimos quadrados, e o vidro nasce sobre
 * essa reta com a inclinação dela.
 *
 * ⚠️ O AJUSTE OLHA SÓ AS BEIRADAS (|t| ≥ 60 % da meia-largura). Sem isso o
 * suporte estreito do braço (a = 1,75 · t ±0,075 · y 9,894 na tabela acima) entra
 * na conta como se fosse a face e torce a reta — ele está ACIMA da face e no meio
 * dela, que é o pior lugar possível para um ponto espúrio.
 */
/** Em quantas faixas de alcance a face de baixo é amostrada. */
const FAIXAS_DA_FACE = 8;
/** Só as beiradas entram no ajuste — ver o aviso acima. */
const BEIRADA_MIN = 0.6;

function medirLuminaria(mesh: THREE.Mesh) {
  const geo = mesh.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const pos = geo.getAttribute('position');
  if (!bb || !pos) return null;
  /* O alcance é no eixo em que a caixa é mais LONGA na horizontal; o mastro em si
     é uma coluna de ±0,15 m, então quem alarga a caixa é o braço. */
  const ax = Math.max(Math.abs(bb.min.x), Math.abs(bb.max.x));
  const az = Math.max(Math.abs(bb.min.z), Math.abs(bb.max.z));
  const eixoX = ax >= az;
  const alcanceMax = eixoX ? bb.max.x : bb.max.z;
  if (alcanceMax < 0.5) return null;              // sem braço: não é uma torre
  const corte = alcanceMax * 0.6;

  /* PRIMEIRA PASSADA: a largura da luminária, que define quem é BEIRADA. */
  let n = 0, minY = Infinity, maxT = 0;
  for (let i = 0; i < pos.count; i++) {
    const a = eixoX ? pos.getX(i) : pos.getZ(i);
    if (a < corte) continue;
    const t = Math.abs(eixoX ? pos.getZ(i) : pos.getX(i));
    const y = pos.getY(i);
    n++;
    if (y < minY) minY = y;
    if (t > maxT) maxT = t;
  }
  if (!n) return null;
  const beirada = maxT * BEIRADA_MIN;

  /* SEGUNDA PASSADA: o menor y por faixa de alcance, só nas beiradas. É a face
     de baixo, amostrada — e é o que revela a inclinação da cunha. */
  const loA: number[] = new Array(FAIXAS_DA_FACE).fill(Infinity);
  const hiA: number[] = new Array(FAIXAS_DA_FACE).fill(-Infinity);
  const loY: number[] = new Array(FAIXAS_DA_FACE).fill(Infinity);
  let minA = Infinity, maxA = -Infinity;
  const passo = Math.max(1e-6, (alcanceMax - corte) / FAIXAS_DA_FACE);
  for (let i = 0; i < pos.count; i++) {
    const a = eixoX ? pos.getX(i) : pos.getZ(i);
    if (a < corte) continue;
    if (Math.abs(eixoX ? pos.getZ(i) : pos.getX(i)) < beirada) continue;
    if (a < minA) minA = a;
    if (a > maxA) maxA = a;
    const k = Math.min(FAIXAS_DA_FACE - 1, Math.floor((a - corte) / passo));
    const y = pos.getY(i);
    if (y < loY[k]) { loY[k] = y; }
    if (a < loA[k]) loA[k] = a;
    if (a > hiA[k]) hiA[k] = a;
  }
  if (!Number.isFinite(minA)) return null;

  /* A RETA DA FACE, por mínimos quadrados sobre as faixas que têm ponto. Com uma
     luminária plana o ajuste devolve inclinação 0 e nada muda — é o caso geral
     que continua valendo para o próximo set. */
  let sx = 0, sy = 0, sxx = 0, sxy = 0, k = 0;
  for (let f = 0; f < FAIXAS_DA_FACE; f++) {
    if (!Number.isFinite(loY[f])) continue;
    const x = (loA[f] + hiA[f]) / 2;
    sx += x; sy += loY[f]; sxx += x * x; sxy += x * loY[f]; k++;
  }
  let incl = 0, base = minY;
  const centro = (minA + maxA) / 2;
  if (k >= 2) {
    const den = k * sxx - sx * sx;
    if (Math.abs(den) > 1e-9) {
      incl = (k * sxy - sx * sy) / den;
      base = (sy - incl * sx) / k;
    }
  }
  /* Um ajuste doido (geometria estranha, faixa única com dois y) não pode virar
     um vidro em pé: 35° é mais do que qualquer luminária viária tem. */
  if (!Number.isFinite(incl) || Math.abs(incl) > 0.7) { incl = 0; base = minY; }
  const yNoCentro = k >= 2 ? incl * centro + base : minY;

  return {
    /* O CENTRO da face ao longo do braço — não a média dos vértices, que incluía
       o tubo. Escala é aplicada pelo chamador; aqui é tudo local. */
    outreach: centro,
    /* A altura da face NO CENTRO dela, que é onde o vidro é ancorado. */
    lensY: yNoCentro,
    /* Meia-medida ao longo do braço e ATRAVÉS dele, as duas da face de baixo. */
    lensR: Math.max(0.12, (maxA - minA) / 2),
    lensT: Math.max(0.06, maxT),
    /** Inclinação da face, em RADIANOS, positiva quando ela sobe indo para fora. */
    lensTilt: Math.atan(incl),
    topY: bb.max.y,
    baseY: bb.min.y,
    eixoX,
  };
}

function realinharPostes(root: THREE.Object3D) {
  const postes: { mesh: THREE.Mesh; x: number; z: number }[] = [];
  const p3 = new THREE.Vector3();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry || !MAST_RE.test(mesh.name || '')) return;
    /* A POSIÇÃO DO NÓ, e não o centro da caixa envolvente. A caixa inclui o
       braço, então o centro dela fica ~1,2 m para o lado do braço — e como
       metade dos nós tem o braço virado ao contrário, medir pela caixa dava DUAS
       linhas de x que não existem (±10,3 em vez de +11,47 / −9,12) e escondia o
       defeito de orientação atrás de uma média. */
    mesh.getWorldPosition(p3);
    postes.push({ mesh, x: p3.x, z: p3.z });
  });
  if (postes.length < 2) {
    /* SEM TORRE, ESQUECE AS ANTERIORES. Um cenário sem `mast_*` — o `armazem` é
       um — voltaria com os onze vidros acesos do distrito flutuando onde as
       torres dele estavam, porque `lamps.ts` guarda os sites em coordenadas de
       MUNDO e nada mais os limparia nesse caminho. */
    setLampSites(null, null);
    return { movidos: 0, girados: 0, sites: 0 };
  }

  /* As duas linhas de X saem dos próprios postes: a mediana de cada lado do
     eixo. Ler em vez de cravar é o que mantém isto válido se o set mudar. */
  const oeste = postes.filter((p) => p.x < 0).map((p) => p.x).sort((a, b) => a - b);
  const leste = postes.filter((p) => p.x >= 0).map((p) => p.x).sort((a, b) => a - b);
  const mediana = (v: number[]) => (v.length ? v[Math.floor(v.length / 2)] : NaN);
  const xO = mediana(oeste), xL = mediana(leste);

  const zs = postes.map((p) => p.z);
  const z0 = Math.min(...zs), z1 = Math.max(...zs);
  const n = postes.length;
  /* O passo cobre o trecho INTEIRO com os postes que existem — é isto que fecha
     o vão de 130 m, sem pedir um poste a mais ao GLB. */
  const passo = (z1 - z0) / Math.max(1, n - 1);

  /* Ordenados por Z para o realinhamento preservar a vizinhança de cada peça —
     assim o poste que já estava ao norte continua ao norte. */
  postes.sort((a, b) => a.z - b.z);
  const inv = new THREE.Matrix4();
  const alvo = new THREE.Vector3();
  const origem = new THREE.Vector3();
  const braco = new THREE.Vector3();
  const sites: LampSite[] = [];
  let geoSite: LampSiteGeo | null = null;
  let movidos = 0, girados = 0;

  for (let i = 0; i < n; i++) {
    const p = postes[i];
    const temOeste = Number.isFinite(xO), temLeste = Number.isFinite(xL);
    const x = temOeste && temLeste ? (i % 2 ? xL : xO) : (temLeste ? xL : xO);
    const z = z0 + i * passo;

    /* ORIENTAÇÃO ANTES DA POSIÇÃO: girar o nó não muda a origem dele (o mastro
       está no zero local), mas muda a caixa — e quem lê a caixa depois disto é
       o passo de sombra e o de atravessar. */
    const m = medirLuminaria(p.mesh);
    if (m) {
      /* O braço tem de apontar para o EIXO DA RUA. Escrever e VERIFICAR, em vez
         de supor que o nó não tem pai girado. */
      const querX = x > 0 ? -1 : 1;
      p.mesh.updateMatrixWorld(true);
      braco.set(m.eixoX ? 1 : 0, 0, m.eixoX ? 0 : 1)
        .transformDirection(p.mesh.matrixWorld);
      if (braco.x * querX < 0) {
        p.mesh.quaternion.premultiply(
          new THREE.Quaternion().setFromAxisAngle(EIXO_Y, Math.PI));
        p.mesh.updateMatrix();
        p.mesh.updateMatrixWorld(true);
        girados++;
      }
    }

    /* O deslocamento é de MUNDO e a posição do nó é do PAI — a mesma conversão
       que `applyPushback()` documenta em set.ts. */
    alvo.set(x - p.x, 0, z - p.z);
    if (p.mesh.parent) {
      inv.copy(p.mesh.parent.matrixWorld).invert();
      origem.set(0, 0, 0).applyMatrix4(inv);
      alvo.applyMatrix4(inv).sub(origem);
    }
    p.mesh.position.add(alvo);
    p.mesh.updateMatrix();
    p.mesh.updateMatrixWorld(true);
    movidos++;

    if (!m) continue;
    /* A ESCALA DE MUNDO do nó entra nas medidas: elas foram lidas na geometria
       local. `matrixWorld` já está atualizada duas linhas acima. */
    const esc = new THREE.Vector3();
    p.mesh.getWorldScale(esc);
    const sy = esc.y || 1;
    const sh = (Math.abs(esc.x) + Math.abs(esc.z)) / 2 || 1;
    p.mesh.getWorldPosition(p3);
    braco.set(m.eixoX ? 1 : 0, 0, m.eixoX ? 0 : 1)
      .transformDirection(p.mesh.matrixWorld).setY(0);
    if (braco.lengthSq() < 1e-6) braco.set(x > 0 ? -1 : 1, 0, 0);
    braco.normalize();
    sites.push({ x: p3.x, y: p3.y, z: p3.z, aimX: braco.x, aimZ: braco.z,
      host: p.mesh });
    if (!geoSite) {
      /* MEDIDO DA ORIGEM DO NÓ, e NÃO da base da geometria — foi um erro de
         40 cm, e ele tem um motivo geométrico: o mastro deste set desce até
         y = −0,40 local, ou seja tem 40 cm ENTERRADOS abaixo da origem do nó.
         Subtrair `baseY` mede "a altura do pedaço de geometria", que não é a
         altura de nada no mundo; o que `lamps.ts` quer é o deslocamento a partir
         da origem do nó, porque é ali que ele ancora a unidade (ver
         `applyLampLayout()` no ramo `set`). Com o `baseY` subtraído, o vidro e o
         refletor nasciam 40 cm ACIMA da luminária — fora dela. */
      geoSite = {
        height: m.topY * sy,
        outreach: m.outreach * sh,
        lensY: m.lensY * sy,
        lensR: m.lensR * sh,
        /* A LARGURA MEDIDA, que antes era medida e jogada fora — ver o bloco
           O QUE SE MEDE É A FACE DE BAIXO em medirLuminaria(). */
        lensT: m.lensT * sh,
        /* E A INCLINAÇÃO DELA. Sem este campo o vidro é uma chapa horizontal sob
           uma carcaça em cunha, encostada numa ponta e a 17 cm de distância na
           outra — o *"a angulacao"* do relato. */
        lensTilt: m.lensTilt,
      };
    }
  }
  root.updateMatrixWorld(true);
  setLampSites(sites.length ? sites : null, geoSite);
  return { movidos, girados, sites: sites.length };
}

/**
 * Replanta a vegetação e realinha os postes de `root`, no lugar.
 *
 * Roda DEPOIS de `applyPushback()` (que ainda move construção) e ANTES de
 * `setupShadows()` (que lê a caixa em mundo para decidir quem projeta) — ver a
 * ordem em `applySet()`.
 *
 * @returns o que foi mexido, para o log de carga.
 */
export function arranjarCenario(root: THREE.Object3D) {
  const faixas = coletarFaixas(root);
  const protos = coletarProtos(root);
  /* ANTES de plantar: é o veto do canteiro que decide o destino, e ele lê o
     albedo. Depois seria tarde. */
  medirAlbedos(protos);
  if (faixas.length && protos.length) plantar(protos, faixas);
  const postes = realinharPostes(root);
  root.updateMatrixWorld(true);
  /* Quem foi barrado do canteiro e por quê — sai no log de carga porque é a
     única forma de ver, sem abrir a bancada, que a curadoria pegou a espécie
     certa quando o acervo do cenário mudar. */
  const vetados = protos
    .map((p) => ({ nome: p.base, veto: vetoNoCanteiro(p) }))
    .filter((v) => v.veto && !/^porte /.test(v.veto))
    .map((v) => `${v.nome}: ${v.veto}`);
  return {
    faixas: faixas.length,
    protos: protos.length,
    plantas: protos.reduce((s, p) => s + (p.malhas[0]?.count || 0), 0),
    ...postes,
    ...(vetados.length ? { vetadosNoCanteiro: vetados } : {}),
  };
}
