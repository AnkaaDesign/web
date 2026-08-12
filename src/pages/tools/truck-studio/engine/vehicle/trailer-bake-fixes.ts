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
  const geo = mesh.geometry as THREE.BufferGeometry;
  const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
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
  for (const m of moved) pos.setXYZ(m.i, m.x, m.y, m.z);
  pos.needsUpdate = true;
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return moved.length;
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
