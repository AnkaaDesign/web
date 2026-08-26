/* Baú paramétrico — núcleo de geometria.
   ---------------------------------------------------------------------------
   ARQUIVO ESPELHADO. Cópia idêntica em:
     truck-studio-desktop/src/studio/trailer-geometry.ts
     web/src/pages/tools/truck-studio/engine/vehicle/trailer-geometry.ts
   Depende só de `three`. Ao mexer aqui, sincronize as duas cópias.

   O QUE FOI MEDIDO NO GLB
   ---------------------------------------------------------------------------
   Material `Cor_padrao_branco(metalBranco)`: 48 559 v / 72 985 tris.
   AABB  X [-1.3035, 1.3035]  Y [1.3919, 4.1688]  Z [-7.481, 7.233]

   1. FRISO SÓ EXISTE NAS DUAS CHAPAS LATERAIS.
      Decompondo o corpo branco em cascas conexas (solda 0,1 mm) saem 63 peças.
      Só duas delas — as chapas laterais, 6 774 triângulos cada — são frisadas:
      46 frisos, passo 53,00 mm, entre y=1.5669 e y=3.9519.

      As PORTAS TRASEIRAS são quatro lajes de 8 vértices / 32 triângulos —
      CHAPA LISA. Dos 656 valores de Y da traseira, só 10 têm salto > 20 mm e
      NENHUM é periódico. A TESTEIRA são duas chapas planas, também lisas; os
      passos de 29,7 mm que aparecem lá são as fendas da veneziana, não friso.

      Esta é a razão de ser da decomposição por casca. A versão anterior deste
      arquivo classificava por "extensão em Z" e mandava 55 886 dos 72 985
      triângulos para uma zona só, tratando tudo como chapa frisada: empilhava
      friso em cima de porta, moldura e dobradiça. O resultado eram listras
      onde devia ser liso e a testeira retalhada.

   2. A CHAPA LATERAL É EXTRUSÃO PURA EM Z (dois anéis, z=-7.407 e z=+7.173).
      Alongar é exato: esticar uma extrusão no próprio eixo não deforma nada.
      Só a ALTURA precisa de geometria nova.

   3. O RELEVO DO FRISO É 5,20 mm, não 1 mm.
      Vale externo em x=1.29830, crista externa em x=1.30350. Os planos
      1.2975/1.2985 são as DUAS FACES DO MESMO VALE — aquilo é a espessura da
      chapa, 0,80 mm. Arco de 25,91 mm, vale plano de 27,10 mm.

   4. O MODELO JÁ TEM COPLANARIDADE NATIVA.
      Faces gêmeas a 1,9 / 1,5 / 2,3 mm nas lajes das portas (6,2 e 6,5 m² de
      área), e 16 tiras a 0,1–0,6 mm entre si. Qualquer geometria nova colocada
      nessa faixa entra em z-fighting. Por isso nada aqui duplica superfície:
      o que não é friso passa INTACTO, só transformado.

   COMO O REDIMENSIONAMENTO FUNCIONA
   ---------------------------------------------------------------------------
   Cada casca recebe um comportamento, e nenhuma casca é reconstruída sem prova
   de que é chapa frisada:

     RIBBED  as duas laterais — empilha frisos reais em Y, estica em Z
     SPAN    peça que atravessa o vão (forros, perfis) — estica em Z
     REAR    peça colada na traseira — translada rígido
     FRONT   peça colada na dianteira — fica parada
     LOCAL   peça pequena — translada rígido, seguindo o mapa proporcional

   Em altura: chapa lisa GRANDE (folha de porta, testeira) estica em Y, o que é
   exato porque é plana e não tem o que distorcer. Peça PEQUENA (dobradiça,
   fecho, aleta de respiro) NÃO estica — translada rígido para a posição
   proporcional, preservando a forma. */

import * as THREE from 'three';
import {
  layoutDoor, holeOf, rejectReason, doorFrameGeometry, snapFlatSegments, DOOR_PARTS, PART_TOL,
  LEAF_INSET, DOOR_REVEAL, SILL_CLEARANCE, HEAD_DROP,
  type DoorRect, type DoorPart, type DoorPartSpec, type DoorPlacement,
  type DoorPlane, type DoorSurface, type RibGrid,
} from './trailer-door';

export type { DoorRect, DoorPlane };

/** Material da parte branca, medido no arquivo. */
export const WHITE_RE = /Cor_padrao_branco|metalBranco/i;

/**
 * Topo da faixa do FRAME INFERIOR, medido do piso (m).
 *
 * O frame inferior — trilho galvanizado, travas, engates e a parafusaria de
 * tudo isso — é ferragem APARAFUSADA em estrutura presa ao piso: mudar a
 * altura do baú não a move. A regra proporcional ('follow' no conjunto,
 * "peça pequena" no branco) foi feita para ferragem de porta, que mora no
 * meio da parede e acompanha; aplicada à base ela AFUNDA o frame quando o
 * baú encolhe. Medido na bancada (checks-corner-moves, h220): parafusos das
 * pontas do trilho −34 mm, travas e ganchos laterais (x ±1310, FORA da
 * crista do trilho, visíveis) −42 mm, ferragem baixa da traseira −40 mm —
 * com trilho, fita 3M e soleira parados. É o "degrau no encontro" do canto
 * dianteiro e o "frame inferior indo para baixo" do relato.
 *
 * 0,25 m é o `END_CAP` do conjunto, e a igualdade é o argumento: é a faixa
 * em que os MEMBROS VERTICAIS (poste de canto, montante do frame) ficam
 * rígidos por construção — então tudo que está aparafusado ali dentro tem de
 * ficar rígido junto, senão desce em relação ao próprio membro que o segura.
 * Acima dela o membro começa a comprimir e a regra proporcional volta a ser
 * a aproximação certa. O corte exige a peça INTEIRA na faixa — quem a
 * atravessa fica como está, porque peça que cruza a linha pertence a uma
 * montagem que continua para cima e prendê-la pela metade rasga a montagem
 * (ver a nota de `pinLowFrame()` em trailer-assembly.ts, com o ensaio que
 * provou isso). E abaixo dela NENHUM segmento de vedação cabe inteiro (o
 * corrido vertical tem 423 mm), então o corte não alcança borracha nenhuma
 * — quem mora inteiro aqui é frame, e frame não sai do lugar.
 */
export const LOW_FRAME_TOP = 0.25;

/**
 * Centro da PARTE LISA do friso, medido de cada passo da grade (`floorY +
 * skirtHeight + k · pitch`). **46,7 mm — a medida** (`checks-perfil.mjs`): a
 * lisa tem ~27 mm e fica centrada aí, no plano crista − 5,3 mm.
 *
 * ELE NÃO É `valeInfo.row0 + valeH / 2`, e a diferença de 33 mm já custou uma
 * rodada. `valeInfo` devolve onde `findRows()` MARCA a fileira — o começo da
 * unidade ladrilhada —, não o meio da faixa lisa que o olho vê; somar meia
 * altura ali cai em cima da CRISTA. Quem precisa do centro da lisa usa esta
 * constante: `models.measureValeRows()` para a coluna de rebites da emenda
 * (aprovada em foto) e `trailer-bake-fixes.ts` para a ferragem da porta
 * traseira, que tem de assentar no mesmo lugar que os rebites.
 */
export const RIB_FLAT_CENTER = 0.0467;

/** Perfil galvanizado da saia lateral — é o topo dele que dá o batente.
 *
 *  ⚠️ É O NOME DO SEMIRREBOQUE, e nem todo baú chama a mesma peça assim: o
 *  sobrechassi não tem material `metal-galvanizado-mantido` nenhum. Quem usa
 *  outro nome passa `frameMaterial` em `TrailerBodyOptions` — sem isso
 *  `measureSill()` não acha perfil, avisa, e devolve a linha do PISO, o que faz
 *  a porta nascer dentro da cantoneira (o defeito 4 do
 *  `PORTA-LATERAL-HANDOFF.md`). */
const FRAME_MAT_RE = /metal-galvanizado-mantido/i;

/** O MARCO da porta: o perfil escuro da estrutura. Medido no `.gltf` com
 *  hierarquia — os nós `estrutura-principal-34…51` contornam o vão. */
const DOOR_FRAME_MAT_RE = /metal-estrutura-principal-padrao/i;

/* A BORRACHA já não tem material próprio aqui: ela deixou de ser desenhada e
   virou peça EXTRAÍDA do implemento (`BORRACHA_V`/`BORRACHA_H` em
   `trailer-door.ts`), que traz o material junto por construção. */

/** Tolerância de solda de vértice, em metros. */
const WELD = 1e-4;

/** Relevo do friso: 5,20 mm entre o VALE e a CRISTA (cabeçalho, item 3). A
 *  faixa lisa da folha fica no plano do VALE — é a chapa sem o vinco, e é por
 *  isso que ela lê como rebaixo e não como relevo. */
const RIB_RELIEF = 0.0052;

/** Um vão em Y maior que isto separa duas fileiras de friso. */
const ROW_GAP = 0.02;

/** Passo nominal do friso — só palpite inicial; o efetivo sai da medição. */
const NOMINAL_PITCH = 0.053;

/** Uma casca só é aceita como chapa frisada com pelo menos isto de fileiras. */
const MIN_RIB_ROWS = 20;

/**
 * Espessura máxima, em X, de uma FOLHA de chapa de pele.
 *
 * O semirreboque tem UMA casca por lateral, de ponta a ponta: a chapa é uma
 * extrusão pura em Z e a decomposição por casca conexa devolve exatamente ela.
 * O sobrechassi NÃO — a lateral dele são **folhas de 1,000 m** montadas com
 * remonte de 42 mm (medido: 17 cascas de 5 108 triângulos cada, dx 6 mm,
 * y 1,049…3,779, com o passo de z em 0,958 m). São folhas de verdade, não um
 * defeito, e é exatamente o que o produto tem.
 *
 * Só que nenhuma delas atravessa 90 % do vão sozinha, então nenhuma era aceita
 * como frisada — e um baú com ZERO chapa frisada não redimensiona em altura,
 * não recorta painel de livery e não ganha rebite, tudo em silêncio (ver
 * `buildTrailerRig()`, que engole a exceção de propósito).
 *
 * `mergeSkinSheets()` une as folhas de um mesmo lado ANTES da classificação, e
 * esta constante é o que separa "folha de pele" de "membro estrutural na
 * pele": 60 mm, contra os 6 mm medidos na folha (0,8 mm de chapa + 5,2 mm de
 * relevo do friso) e contra os 95…205 mm dos perfis de arremate. O vazio entre
 * as duas famílias é de mais de uma ordem de grandeza.
 */
const SHEET_THICK = 0.06;

/**
 * Quanto duas folhas podem divergir em X e ainda serem a MESMA parede.
 *
 * 3 mm, contra os 5 mm que separam a parede da folha da porta no sobrechassi e
 * contra os 0 mm que separam as folhas da parede entre si (as 8 do flanco
 * esquerdo têm a face externa no mesmo x −1,298 até a quarta casa). O vazio é
 * pequeno em valor absoluto e enorme em relação ao ruído do bake, que aqui é
 * zero — as folhas saíram da mesma extrusão.
 */
const SKIN_PLANE_TOL = 0.003;

/**
 * O DEGRAU DO REMONTE, em metros — a espessura da chapa.
 *
 * As folhas do sobrechassi se sobrepõem 42 mm e, no bake, as duas ficam **no
 * mesmo plano em X até a quarta casa**. Duas superfícies exatamente coplanares
 * brigam no z-buffer em QUALQUER distância — não é falta de precisão, é empate
 * — e o resultado é a costura tracejada que aparece a cada 958 mm ao longo do
 * flanco. Foi confirmada por A/B na bancada (`rasante` × `rasante-cru`): ela
 * está no BAKE, não no corpo paramétrico.
 *
 * Um remonte de verdade não é coplanar: a folha de cima monta SOBRE a de baixo
 * e fica saliente pela espessura da chapa. 0,8 mm é a espessura medida
 * (a casca tem 6,0 mm de vão em X e o relevo do friso mede 5,2). Alternando as
 * folhas em z — uma no plano, a seguinte 0,8 mm para fora — o empate acaba e o
 * flanco passa a ler como chapeamento montado, que é o que ele é.
 *
 * Zero é o valor certo para um baú de chapa corrida: lá não há duas folhas, e
 * `mergeSkinSheets()` nem chega a este ponto.
 */
const SHEET_LAP = 0.0008;

/**
 * Acima disto, o espaço entre duas folhas vizinhas é um VAZIO e não um remonte.
 *
 * Medido no sobrechassi: os remontes de parede são de 41…42 mm e o vazio da
 * porta de fábrica é de 994 mm. 0,10 m cai num vazio de quase um metro entre as
 * duas famílias — não é um limiar escolhido, é o único lugar em que ele cabe.
 */
const SHEET_GAP_TOL = 0.10;

/**
 * A menor CHAPA que uma emenda pode delimitar — 300 mm.
 *
 * Nasceu do flanco do MOTORISTA do sobrechassi, que é o que tem porta: ali as
 * folhas do rip não marcham (o vão obriga duas curtas em volta dele) e
 * `fillSheetGaps()` ainda insere um remendo. Medido, as emendas saíam a
 * 0,972 · 0,970 · 0,880 · 0,912 · 0,913 · **0,262** · 0,920 · 0,972 m — e uma
 * chapa de 262 mm é o *"2 fileiras de rebites perto"* do relato, agora do lado
 * de dentro da correção em vez do lado de fora.
 *
 * Sobra a da FRENTE quando duas brigam, pela mesma regra que `PLATE_FROM_FRONT`
 * segue em models.ts: a fábrica assenta chapa inteira a partir da testeira e
 * corta a última. 300 mm é o mesmo número de `PLATE_END_CLEAR` lá — as duas
 * dizem "aqui não cabe uma chapa" —, repetido porque este arquivo é espelhado e
 * não importa `vehicle/*`.
 */
const SHEET_MIN_RUN = 0.30;

/** Faixa colada às pontas: o que cabe aqui é rígido. */
const CAP_BAND = 0.10;

const EPS = 1e-5;

export interface TrailerDims {
  /** Fixa por norma: 2,60 m. Exposta para leitura, nunca editada. */
  width: number;
  height: number;
  length: number;
}

type Behaviour = 'ribbed' | 'span' | 'rear' | 'front' | 'local';

export interface Tri {
  /** 9 floats: 3 vértices × (x,y,z), em espaço de MUNDO. */
  p: Float32Array;
  /** 9 floats: normais correspondentes, em espaço de mundo. */
  n: Float32Array;
  /**
   * Veio da CHAPA DE TETO (`teto-externo`)?
   *
   * Existe por uma razão só, e ela é de produto: o teto é pintável
   * separadamente do baú (ver `vehicle/trim.ts`), e trocar o material de um
   * SUBCONJUNTO de triângulos não é uma operação que exista. Enquanto o corpo
   * paramétrico desenhava tudo numa malha só, escolher uma cor para o teto
   * aplicava a tinta numa malha `teto-externo` que `rebuild()` tinha acabado de
   * ESCONDER — a cor era aceita e não aparecia.
   *
   * Marcado na COLETA, por nome do nó de origem, e não inferido depois por
   * normal ou por altura: `shellsOf()` solda por vértice e pode juntar o teto às
   * paredes na mesma casca, então o critério tem de sobreviver à decomposição —
   * e sobrevive, porque anda no triângulo.
   */
  roof?: boolean;
}

/**
 * Face do baú, nos mesmos nomes que o formulário de medidas usa.
 *
 * O EIXO É O QUE O RESTO DO ENGINE JÁ DECIDIU, e não uma convenção nova daqui:
 * `models.ts` recorta `SIDE_R` na face de MAIOR X (`>= box.max.x − skin`) e
 * `livery.ts` mapeia `SIDE_R → 'right'`. Portanto **+X é `right`** neste
 * projeto, e a dianteira é +Z (`trailer_meta.json`: `frontZ` é o maior z das
 * chapas). Inverter isto aqui não trocaria só um rótulo — poria toda porta na
 * lateral oposta à que o cliente desenhou no editor, calada.
 */
export type Face = 'left' | 'right' | 'rear';

/**
 * Uma porta, nas unidades e nomes do formulário: tudo em METROS.
 *
 * `position` é medido da DIANTEIRA do baú para trás. É de propósito: o baú
 * cresce para trás (`mapZ()`, comportamento `front`), então uma porta ancorada
 * na dianteira fica onde está quando o comprimento muda. Ancorar na traseira
 * faria toda porta andar a cada centímetro digitado.
 *
 * O editor mede a partir da borda esquerda do PAINEL, que não é o mesmo datum e
 * ainda troca de ponta entre as duas laterais. A conversão é feita por quem
 * chama — `pushDoorsToGeometry()` em `livery-structure.ts` —, que é onde a
 * convenção do painel mora.
 *
 * `height` sobe do PISO: uma porta lateral de baú começa no estrado.
 */
export interface DoorSpec {
  position: number;
  width: number;
  height: number;
}

interface Shell {
  tris: Tri[];
  min: THREE.Vector3;
  max: THREE.Vector3;
  behaviour: Behaviour;
  /** Em que face a casca está, quando dá para dizer. Só estas levam porta. */
  face?: Face;
  /** Só para `ribbed`. */
  rows: number[];
  skirt: Tri[];
  unit: Tri[];
  cap: Tri[];
  ribs: number;
  /** Altura do VALE dentro da unidade (o trecho plano do perfil, medido). */
  valeH: number;
  /** Estica em Y em vez de transladar (chapa lisa grande). */
  stretchY: boolean;
}

export interface TrailerProfile {
  pitch: number;
  floorY: number;
  roofY: number;
  skirtHeight: number;
  capHeight: number;
  ribCount: number;
  /**
   * Onde o pé de uma porta lateral pode nascer: o topo do perfil metálico
   * inferior mais um respiro. MEDIDO — ver `measureSill()`.
   */
  sillY: number;
  z0: number;
  z1: number;
  width: number;
  base: TrailerDims;
  /** Diagnóstico: quantas cascas saíram e quantas são frisadas. */
  shells: number;
  ribbedShells: number;
  /** A face de baixo do perfil de arremate de CIMA, medida. `null` se ausente.
   *  É até aqui que a coluna de rebites sobe — ver `measureTopRail()`. */
  topRailY: number | null;
}

/* ------------------------------------------------------------------ coleta */

/** O nó da CHAPA DE TETO no bake. `-externo` e não `teto`: o `teto-interno` é o
 *  forro, tem o mesmo branco e não se vê de fora. Mesma expressão que
 *  `vehicle/trim.ts` usa para casar a peça no bake fundido — as duas descrevem
 *  a mesma coisa e divergir faria o teto pintar num caminho e não no outro. */
const ROOF_NODE_RE = /^teto-externo/i;

/** O nó casa se ELE ou algum ancestral casar — a malha é neta do grupo do teto. */
function nodeOrAncestor(o: THREE.Object3D, re: RegExp, stop: THREE.Object3D): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    if (re.test(n.name || '')) return true;
    if (n === stop) break;
  }
  return false;
}

function collect(root: THREE.Object3D): {
  tris: Tri[]; meshes: THREE.Mesh[]; material: THREE.Material | null;
} {
  const tris: Tri[] = [];
  const meshes: THREE.Mesh[] = [];
  let material: THREE.Material | null = null;

  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!mats.some((m) => WHITE_RE.test(m.name))) return;

    const isRoof = nodeOrAncestor(mesh, ROOF_NODE_RE, root);
    meshes.push(mesh);
    material ??= mats.find((m) => WHITE_RE.test(m.name)) ?? null;

    const geo = mesh.geometry as THREE.BufferGeometry;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute | undefined;
    if (!pos) return;
    const nrm = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const index = geo.getIndex();
    const m4 = mesh.matrixWorld;
    const m3 = new THREE.Matrix3().getNormalMatrix(m4);
    const v = new THREE.Vector3();
    const count = index ? index.count : pos.count;

    for (let i = 0; i < count; i += 3) {
      const p = new Float32Array(9);
      const n = new Float32Array(9);
      for (let k = 0; k < 3; k++) {
        const idx = index ? index.getX(i + k) : i + k;
        v.fromBufferAttribute(pos, idx).applyMatrix4(m4);
        p[k * 3] = v.x; p[k * 3 + 1] = v.y; p[k * 3 + 2] = v.z;
        if (nrm) {
          v.fromBufferAttribute(nrm, idx).applyMatrix3(m3).normalize();
          n[k * 3] = v.x; n[k * 3 + 1] = v.y; n[k * 3 + 2] = v.z;
        }
      }
      tris.push(isRoof ? { p, n, roof: true } : { p, n });
    }
  });
  return { tris, meshes, material };
}

/* -------------------------------------------------------- cascas conexas */

/**
 * Separa o corpo branco em cascas conexas, soldando vértices a 0,1 mm.
 *
 * É a peça central. O modelo vem "stitched by material": lateral, testeira,
 * portas, batentes, molduras e dobradiças chegam numa malha só. Sem separar,
 * qualquer regra escrita para a chapa lateral vaza para a porta — que foi
 * exatamente o defeito da versão anterior.
 *
 * União por conjuntos disjuntos com compressão de caminho. São 73 mil
 * triângulos: roda em alguns milissegundos, e por isso o perfil pode ser
 * medido em runtime em vez de virar mais um asset para manter em sincronia.
 */
function shellsOf(tris: Tri[]): Tri[][] {
  const key = (p: Float32Array, k: number) =>
    `${Math.round(p[k * 3] / WELD)},${Math.round(p[k * 3 + 1] / WELD)},${Math.round(p[k * 3 + 2] / WELD)}`;

  const parent = new Int32Array(tris.length);
  for (let i = 0; i < tris.length; i++) parent[i] = i;
  const find = (a: number): number => {
    while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; }
    return a;
  };
  const union = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  /* Primeiro triângulo visto em cada vértice; os seguintes se unem a ele. */
  const owner = new Map<string, number>();
  for (let i = 0; i < tris.length; i++) {
    for (let k = 0; k < 3; k++) {
      const kk = key(tris[i].p, k);
      const prev = owner.get(kk);
      if (prev === undefined) owner.set(kk, i);
      else union(i, prev);
    }
  }

  const groups = new Map<number, Tri[]>();
  for (let i = 0; i < tris.length; i++) {
    const r = find(i);
    let g = groups.get(r);
    if (!g) { g = []; groups.set(r, g); }
    g.push(tris[i]);
  }
  return [...groups.values()];
}

const boundsOf = (tris: Tri[]) => {
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const t of tris) {
    for (let k = 0; k < 3; k++) {
      const x = t.p[k * 3], y = t.p[k * 3 + 1], z = t.p[k * 3 + 2];
      if (x < min.x) min.x = x; if (x > max.x) max.x = x;
      if (y < min.y) min.y = y; if (y > max.y) max.y = y;
      if (z < min.z) min.z = z; if (z > max.z) max.z = z;
    }
  }
  return { min, max };
};

/* ------------------------------------------------------------- fileiras */

/**
 * Fileiras de friso de UMA casca, lidas da malha.
 *
 * Lê, não sintetiza: os vãos medidos variam entre 52,9 e 53,1 mm, e um
 * `y0 + k * 0.053` acumula ~1 cm de erro em 46 frisos — o corte deixa de cair
 * em cima de vértice e a chapa rasga.
 */
function findRows(tris: Tri[]): number[] {
  const ys = new Set<number>();
  for (const t of tris) {
    for (let k = 0; k < 3; k++) ys.add(Math.round(t.p[k * 3 + 1] * 1e4) / 1e4);
  }
  const sorted = [...ys].sort((a, b) => a - b);
  const marks: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i + 1] - sorted[i] > ROW_GAP) marks.push(sorted[i]);
  }
  /* Só a corrente contínua cujo vão bate com o passo é friso. A saia (149 mm)
     e o arremate de topo ficam de fora por não casarem.
     A janela é de ±10 %, não ±25 %: o último vão real mede 59,7 mm e passava
     na janela larga, entrando na corrente como se fosse friso. Empilhar a
     passo constante de 53,0 mm depois perdia 6,8 mm e o arremate de topo
     afundava dentro do último friso (topo em 4,1620 contra 4,1688 do original). */
  const keep: number[] = [];
  for (let i = 0; i < marks.length - 1; i++) {
    const d = marks[i + 1] - marks[i];
    if (Math.abs(d - NOMINAL_PITCH) < NOMINAL_PITCH * 0.10) {
      if (!keep.length) keep.push(marks[i]);
      keep.push(marks[i + 1]);
    }
  }
  return keep;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : 0;
};

/**
 * Une as FOLHAS de uma mesma lateral numa casca só, antes da classificação.
 *
 * A decomposição por casca conexa é a coisa certa para tudo o mais — é ela que
 * separa porta de testeira de forro. Para a chapa de pele, porém, ela responde
 * à pergunta errada quando o baú é montado com folhas: devolve N pedaços de
 * 1 m onde o que interessa é a PAREDE, que é o que estica, o que leva friso e
 * o que vira painel de livery.
 *
 * O que entra na união é estreito: casca fina (`SHEET_THICK`), na pele, alta o
 * bastante para ser parede, e com uma corrente de fileiras no passo do friso.
 * Um perfil de arremate não passa na espessura; um forro não passa na pele; a
 * folha da PORTA não passa na altura (2,35 m contra 2,73 da parede — ela é
 * `bodyH * 0.5` = 1,43 m acima do corte, mas fica FORA porque a união exige
 * também a corrente de fileiras E ela tem, então quem a exclui é a altura da
 * PAREDE: a folha começa em 1,249 e a parede em 1,049, e a diferença aparece
 * na união como um degrau). Ver a nota do chamador.
 *
 * ⚠️ Uma casca que JÁ atravessa o vão sai intacta. É o caso do semirreboque, e
 * é o que garante que este passo não mexe em nada do que já estava aprovado.
 */
/**
 * ⚠️ E ELE PUBLICA ONDE AS FOLHAS SE ENCONTRAM (`seamsOut`), porque quem desenha
 * a EMENDA está do outro lado do engine e não tem como adivinhar.
 *
 * `models.buildLiveryPanels()` inventa uma grade de emendas de 1 m contada da
 * testeira, com remonte e coluna de rebites — ela existe porque o semirreboque
 * é chapa CORRIDA (uma folha de 14,58 m, medida no `.glb`) e as emendas
 * simplesmente não estão lá. No sobrechassi elas ESTÃO: nove folhas de 1 m,
 * assentadas pelo rip com remontes irregulares (326 · 42 · 42 · 134 · −94 ·
 * −94 · 93 · 42 mm). Duas grades sobre a mesma chapa é o defeito relatado em
 * 2026-08-25 — *"tem uma chapa ali que não deveria, e ela não tem rebites"*.
 *
 * Medido: a grade inventada e a do bake coincidem a 14 mm na testeira e chegam
 * a 184 mm de distância na traseira, porque uma marcha de 1 000 mm e a outra de
 * ~958. É exatamente o *"às vezes os rebites não estão batendo bem com o fim da
 * chapa, às vezes parece ter 2 chapas menores"*.
 *
 * O que sai daqui são as emendas REAIS, em DISTÂNCIA DA PAREDE DIANTEIRA — a
 * única moeda que atravessa a fronteira sem depender de referencial nem da
 * medida corrente. `TrailerBody.sheetSeamsFromFront()` a escala; quem desenha a
 * consome. Vazio quando a pele é corrida, e aí nada muda.
 */
function mergeSkinSheets(
  groups: Tri[][], cx: number, half: number, bodyH: number, bodyL: number,
  seamsOut?: Map<'left' | 'right', number[]>,
): Tri[][] {
  const out: Tri[][] = [];
  type Cand = { g: Tri[]; face: 'left' | 'right'; outer: number };
  const cands: Cand[] = [];
  for (const g of groups) {
    const b = boundsOf(g);
    const onSkin = Math.abs(b.max.x - cx) > half - 0.05 || Math.abs(b.min.x - cx) > half - 0.05;
    const spans = b.max.z - b.min.z > bodyL * 0.9;
    const thin = b.max.x - b.min.x <= SHEET_THICK;
    const tall = b.max.y - b.min.y > bodyH * 0.5;
    if (spans || !onSkin || !thin || !tall || findRows(g).length < MIN_RIB_ROWS) {
      out.push(g);
      continue;
    }
    const face: 'left' | 'right' = (b.min.x + b.max.x) / 2 > cx ? 'right' : 'left';
    cands.push({ g, face, outer: face === 'right' ? b.max.x : b.min.x });
  }

  /* A PAREDE É O PLANO MAIS EXTERNO, e este filtro é o que separa a folha de
     parede da FOLHA DA PORTA — que passa em todos os testes acima e não pode
     entrar na união.
     Medido no sobrechassi: as 8 folhas do flanco esquerdo têm a face externa em
     x −1,298; a folha da porta, recuada, em −1,293. São 5 mm, e o efeito de
     deixá-la entrar não é cosmético: os frisos dela estão em OUTRA FASE, então
     o conjunto de valores de Y da união passa a ter vãos de ~26 mm em vez de
     53, `findRows()` não fecha corrente nenhuma e o flanco inteiro sai como
     `span` — ou seja, a parede com a porta perde o friso, e só ela. Foi
     exatamente o que a bancada mostrou na primeira tentativa: `right` frisada,
     `left` não. */
  const outermost = new Map<'left' | 'right', number>();
  for (const c of cands) {
    const cur = outermost.get(c.face);
    const better = cur === undefined
      || (c.face === 'right' ? c.outer > cur : c.outer < cur);
    if (better) outermost.set(c.face, c.outer);
  }
  const walls = new Map<'left' | 'right', Cand[]>();
  for (const c of cands) {
    if (Math.abs(c.outer - (outermost.get(c.face) as number)) > SKIN_PLANE_TOL) {
      out.push(c.g);                     // atrás da parede: não é parede
      continue;
    }
    const acc = walls.get(c.face);
    if (acc) acc.push(c); else walls.set(c.face, [c]);
  }

  /* O DEGRAU DO REMONTE — ver `SHEET_LAP`. Em ordem de Z, uma folha sim outra
     não sai `SHEET_LAP` para fora da parede. É o único lugar do arquivo que
     MOVE geometria, e ele o faz porque a alternativa é um empate de z-buffer
     que nenhuma escolha de câmera ou de precisão resolve.
     ⚠️ O que ele move é a CÓPIA: `collect()` aloca um `Float32Array(9)` por
     triângulo, já em espaço de mundo. A malha de origem não é tocada — se
     fosse, o deslocamento se acumularia a cada `rebuild()` e a parede
     caminharia para fora do baú um pouco a cada resize.
     Uma folha só (ou nenhuma) não tem vizinha com quem empatar: o laço não faz
     nada, que é o caso do baú de chapa corrida. */
  const sides = new Map<'left' | 'right', Tri[]>();
  for (const [face, list] of walls) {
    /* O VAZIO É FECHADO ANTES do degrau, porque a alternância é por ÍNDICE em Z
       e uma folha inserida depois entraria com a paridade errada — duas
       vizinhas no mesmo plano, que é justamente o empate que `SHEET_LAP` existe
       para tirar. */
    const cheias = fillSheetGaps(list.map((c) => c.g), SHEET_GAP_TOL)
      .map((g) => ({ g, b: boundsOf(g) }))
      .sort((a, b) => a.b.min.z - b.b.min.z);
    const sign = face === 'right' ? 1 : -1;
    const acc: Tri[] = [];
    cheias.forEach((c, i) => {
      if (cheias.length > 1 && i % 2 === 1) {
        for (const t of c.g) for (let k = 0; k < 3; k++) t.p[k * 3] += sign * SHEET_LAP;
      }
      acc.push(...c.g);
    });
    sides.set(face, acc);
    /* A EMENDA É A BORDA TRASEIRA DE CADA FOLHA — a folha da frente cavalga a de
       trás, então a linha que o olho vê é onde a de cima ACABA. `cheias` está em
       ordem crescente de z (traseira → dianteira); a primeira não tem folha
       atrás dela, é a ponta do painel. Uma folha só não produz emenda nenhuma. */
    if (seamsOut && cheias.length > 1) {
      const frente = cheias[cheias.length - 1].b.max.z;
      const daFrente = cheias.slice(1)
        .map((c) => +(frente - c.b.min.z).toFixed(4))
        .sort((a, b) => a - b);
      /* Duas emendas perto demais não são duas chapas — ver `SHEET_MIN_RUN`. */
      const limpas: number[] = [];
      for (const d of daFrente) {
        if (limpas.length && d - limpas[limpas.length - 1] < SHEET_MIN_RUN) continue;
        limpas.push(d);
      }
      seamsOut.set(face, limpas);
    }
  }
  /* A união entra na lista como uma casca qualquer: quem decide se ela é
     frisada continua sendo o mesmo teste de sempre, agora com o vão certo. Se
     as folhas de um lado não cobrirem a parede (uma parede de meia altura, um
     bake pela metade), a união simplesmente não passa e cai em `local` — o
     mesmo destino que as folhas teriam separadas. */
  for (const acc of sides.values()) out.push(acc);
  return out;
}

/**
 * Fecha os VAZIOS da parede clonando a folha vizinha.
 *
 * Um vazio aparece quando o bake traz uma PORTA de fábrica: a folha da porta é
 * uma peça à parte, recuada e — medido no sobrechassi — **7,7 mm fora de fase**
 * com a parede (as fileiras dela ficam em 0,7480 + k·53 contra 0,3693 + k·53 da
 * parede). Fora de fase ela não pode entrar na união: `findRows()` deixa de
 * fechar corrente e o flanco inteiro perde o friso. E é a mesma defasagem que
 * faz a porta de fábrica LER ERRADO na imagem — as ondas dela não continuam as
 * da parede.
 *
 * Com a porta removida (`removeBakedSideDoor()`), sobra um vão de 994 mm na
 * parede. Ele é fechado do único jeito que mantém a fase: **clonando uma folha
 * da própria parede** e transladando em Z. Todas são a mesma extrusão (5 108
 * triângulos cada, idênticas), então a cópia é a peça certa por construção — a
 * mesma doutrina de `extractDoorKit()`, que monta a porta lateral com as peças
 * da porta traseira do próprio implemento.
 *
 * O passo é `comprimento − remonte`, medido nas vizinhas; a última cópia pode
 * montar mais do que o remonte nominal, e isso é um remonte também.
 */
function fillSheetGaps(sheets: Tri[][], lapZ: number): Tri[][] {
  if (sheets.length < 2) return sheets;
  const withBox = sheets.map((g) => ({ g, b: boundsOf(g) }))
    .sort((a, b) => a.b.min.z - b.b.min.z);
  const out = withBox.map((e) => e.g);
  for (let i = 0; i < withBox.length - 1; i++) {
    const gap = withBox[i + 1].b.min.z - withBox[i].b.max.z;
    if (gap <= lapZ) continue;                    // remonte normal, ou encosto
    /* Clona a folha ANTERIOR — ela é a que já está em fase e no plano certo. */
    const src = withBox[i];
    const len = src.b.max.z - src.b.min.z;
    const step = Math.max(0.05, len - lapZ);
    let z = src.b.max.z - lapZ;
    let guard = 0;
    while (z < withBox[i + 1].b.min.z && guard++ < 32) {
      const dz = z - src.b.min.z;
      const copy: Tri[] = src.g.map((t) => {
        const p = new Float32Array(t.p);
        for (let k = 0; k < 3; k++) p[k * 3 + 2] += dz;
        return t.roof ? { p, n: new Float32Array(t.n), roof: true } : { p, n: new Float32Array(t.n) };
      });
      out.push(copy);
      z += step;
    }
  }
  return out;
}

/* ------------------------------------------------------------- clipping */

/** Recorta um triângulo à faixa `y ∈ [lo, hi]`, interpolando posição e normal. */
function clipSlab(t: Tri, lo: number, hi: number): Tri[] {
  const ys = [t.p[1], t.p[4], t.p[7]];
  if (ys.every((y) => y >= lo - EPS && y <= hi + EPS)) return [t];
  if (Math.min(...ys) >= hi - EPS || Math.max(...ys) <= lo + EPS) return [];

  type V = { p: number[]; n: number[] };
  let poly: V[] = [0, 1, 2].map((k) => ({
    p: [t.p[k * 3], t.p[k * 3 + 1], t.p[k * 3 + 2]],
    n: [t.n[k * 3], t.n[k * 3 + 1], t.n[k * 3 + 2]],
  }));

  /* Distância COM SINAL ao plano, positiva do lado que fica.
     A versão anterior testava `>= plane - EPS` e, quando um vértice caía EM
     cima do plano, empurrava esse vértice para dentro E ainda emitia a
     interseção com s≈0 — o mesmo ponto duas vezes. Medido: 43,7 % da saída do
     clipping era lixo (1 286 triângulos de área zero em 2 940), e isso ×46
     cópias enchia a malha de degenerados. Aqui a interseção só é emitida
     quando a aresta CRUZA de verdade, com os dois extremos fora do plano. */
  const cut = (keepAbove: boolean, plane: number) => {
    const out: V[] = [];
    const dist = (v: V) => (keepAbove ? v.p[1] - plane : plane - v.p[1]);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const da = dist(a), db = dist(b);
      if (da >= -EPS) out.push(a);
      if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) {
        const d = b.p[1] - a.p[1];
        const s = Math.abs(d) < 1e-12 ? 0 : (plane - a.p[1]) / d;
        out.push({
          p: [a.p[0] + (b.p[0] - a.p[0]) * s, plane, a.p[2] + (b.p[2] - a.p[2]) * s],
          n: [a.n[0] + (b.n[0] - a.n[0]) * s, a.n[1] + (b.n[1] - a.n[1]) * s, a.n[2] + (b.n[2] - a.n[2]) * s],
        });
      }
    }
    poly = out;
  };

  cut(true, lo);
  if (poly.length < 3) return [];
  cut(false, hi);
  if (poly.length < 3) return [];

  const out: Tri[] = [];
  for (let i = 1; i < poly.length - 1; i++) {
    const p = new Float32Array(9), n = new Float32Array(9);
    const vs = [poly[0], poly[i], poly[i + 1]];
    /* Descarta degenerado: área nula vira listra preta no shading. */
    const ax = vs[1].p[0] - vs[0].p[0], ay = vs[1].p[1] - vs[0].p[1], az = vs[1].p[2] - vs[0].p[2];
    const bx = vs[2].p[0] - vs[0].p[0], by = vs[2].p[1] - vs[0].p[1], bz = vs[2].p[2] - vs[0].p[2];
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
    const area2 = cx * cx + cy * cy + cz * cz;
    if (area2 < 1e-18) continue;

    /* RENORMALIZAR — e não só por higiene.
       O lerp entre a normal da crista e a do vale, que são quase opostas,
       colapsa: o comprimento mínimo medido foi 0,0107. Empilhado 46 vezes isso
       produzia 68 264 normais não-unitárias (16,6 % da malha; o original tem
       zero), o que arruinava a iluminação E a máscara por normal do livery
       — `smoothstep(0.55, 0.82, abs(n.x))` passava a alternar entre branco
       puro e textura em faixas de 53 mm, que é a listra que aparecia na porta.
       Quando o lerp colapsa a ponto de não ter direção confiável, cai-se na
       normal geométrica da face. */
    const gl = Math.sqrt(area2);
    for (let k = 0; k < 3; k++) {
      p[k * 3] = vs[k].p[0]; p[k * 3 + 1] = vs[k].p[1]; p[k * 3 + 2] = vs[k].p[2];
      let nx = vs[k].n[0], ny = vs[k].n[1], nz = vs[k].n[2];
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len < 0.2) { nx = cx / gl; ny = cy / gl; nz = cz / gl; }
      else { nx /= len; ny /= len; nz /= len; }
      n[k * 3] = nx; n[k * 3 + 1] = ny; n[k * 3 + 2] = nz;
    }
    out.push(t.roof ? { p, n, roof: true } : { p, n });
  }
  return out;
}

/* ----------------------------------------------------- recorte de portas */

/**
 * Recorta um triângulo a um semiespaço num eixo, guardando posição e normal.
 *
 * Genérico no componente (1 = Y, 2 = Z) para servir tanto ao corte horizontal
 * do vão quanto ao vertical, sem duas cópias da mesma álgebra. Repare que ele
 * repete, deliberadamente, as duas correções de `clipSlab()`: interseção só
 * quando a aresta CRUZA de fato (senão sai ponto duplicado e triângulo de área
 * zero) e normal renormalizada com queda para a normal geométrica quando o lerp
 * colapsa. Um vão de porta corta a MESMA pele frisada, então ele herdaria os
 * mesmos dois defeitos se fosse escrito ingenuamente.
 */
function clipComp(t: Tri, comp: 1 | 2, plane: number, keepGreater: boolean): Tri[] {
  type V = { p: number[]; n: number[] };
  const dist = (v: V) => (keepGreater ? v.p[comp] - plane : plane - v.p[comp]);
  const poly: V[] = [0, 1, 2].map((k) => ({
    p: [t.p[k * 3], t.p[k * 3 + 1], t.p[k * 3 + 2]],
    n: [t.n[k * 3], t.n[k * 3 + 1], t.n[k * 3 + 2]],
  }));

  const out: V[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = dist(a), db = dist(b);
    if (da >= -EPS) out.push(a);
    if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) {
      const d = b.p[comp] - a.p[comp];
      const s = Math.abs(d) < 1e-12 ? 0 : (plane - a.p[comp]) / d;
      const p = [0, 1, 2].map((k) => a.p[k] + (b.p[k] - a.p[k]) * s);
      p[comp] = plane;
      out.push({ p, n: [0, 1, 2].map((k) => a.n[k] + (b.n[k] - a.n[k]) * s) });
    }
  }
  if (out.length < 3) return [];

  const tris: Tri[] = [];
  for (let i = 1; i < out.length - 1; i++) {
    const vs = [out[0], out[i], out[i + 1]];
    const ax = vs[1].p[0] - vs[0].p[0], ay = vs[1].p[1] - vs[0].p[1], az = vs[1].p[2] - vs[0].p[2];
    const bx = vs[2].p[0] - vs[0].p[0], by = vs[2].p[1] - vs[0].p[1], bz = vs[2].p[2] - vs[0].p[2];
    const c0 = ay * bz - az * by, c1 = az * bx - ax * bz, c2 = ax * by - ay * bx;
    const area2 = c0 * c0 + c1 * c1 + c2 * c2;
    if (area2 < 1e-18) continue;
    const gl = Math.sqrt(area2);
    const p = new Float32Array(9), n = new Float32Array(9);
    for (let k = 0; k < 3; k++) {
      p[k * 3] = vs[k].p[0]; p[k * 3 + 1] = vs[k].p[1]; p[k * 3 + 2] = vs[k].p[2];
      let nx = vs[k].n[0], ny = vs[k].n[1], nz = vs[k].n[2];
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len < 0.2) { nx = c0 / gl; ny = c1 / gl; nz = c2 / gl; }
      else { nx /= len; ny /= len; nz /= len; }
      n[k * 3] = nx; n[k * 3 + 1] = ny; n[k * 3 + 2] = nz;
    }
    tris.push(t.roof ? { p, n, roof: true } : { p, n });
  }
  return tris;
}

/** Longe do retângulo — o teste barato que evita pagar o clipping. */
function outside(t: Tri, g: DoorRect): boolean {
  const y = [t.p[1], t.p[4], t.p[7]];
  const z = [t.p[2], t.p[5], t.p[8]];
  return Math.min(...y) >= g.y1 - EPS || Math.max(...y) <= g.y0 + EPS
    || Math.min(...z) >= g.z1 - EPS || Math.max(...z) <= g.z0 + EPS;
}

/**
 * Subtrai um retângulo de um triângulo, por faixas — o VÃO da porta lateral.
 *
 * A subtração é por faixas e não por diferença booleana (abaixo do vão, acima,
 * e dentro da faixa de altura, antes e depois), então as quatro partes não se
 * sobrepõem por construção — o que evita a coplanaridade que este modelo já tem
 * de sobra.
 *
 * ATENÇÃO ao que esta função NÃO faz: ela recorta uma chapa de espessura zero e
 * não deixa nenhuma superfície na borda do corte. O vão sozinho é um furo
 * limpo para dentro do baú. Quem fecha é `jambGeometry()`, e as duas andam
 * sempre juntas — um comentário anterior aqui dizia que esta função não era
 * usada pela porta lateral, quando `emit()` a chama desde que a feature existe.
 */
export function subtractGap(t: Tri, g: DoorRect): Tri[] {
  if (outside(t, g)) return [t];
  const out: Tri[] = [];
  out.push(...clipComp(t, 1, g.y0, false));
  out.push(...clipComp(t, 1, g.y1, true));
  for (const band of clipComp(t, 1, g.y0, true)) {
    for (const inner of clipComp(band, 1, g.y1, false)) {
      out.push(...clipComp(inner, 2, g.z0, false));
      out.push(...clipComp(inner, 2, g.z1, true));
    }
  }
  return out;
}

/** O AVESSO de `subtractGap()`: o pedaço que cai DENTRO do retângulo — é dele
 *  que sai a FOLHA, recortada da própria pele. */
export function intersectRect(t: Tri, g: DoorRect): Tri[] {
  if (outside(t, g)) return [];
  const out: Tri[] = [];
  for (const band of clipComp(t, 1, g.y0, true)) {
    for (const inner of clipComp(band, 1, g.y1, false)) {
      for (const a of clipComp(inner, 2, g.z0, true)) {
        out.push(...clipComp(a, 2, g.z1, false));
      }
    }
  }
  return out;
}

/**
 * O topo do perfil metálico inferior da lateral — o BATENTE da porta.
 *
 * A porta não nasce no piso do baú. Neste modelo o perfil galvanizado da saia
 * sobe 33,2 mm ACIMA da linha do piso do corpo branco, e uma porta ancorada em
 * `floorY` nasce dentro dele. Isto é MEDIDO e não constante porque o perfil é do
 * bake: outro implemento, outro batente.
 *
 * POR MATERIAL, e essa é a parte que custou duas medições erradas. A primeira
 * versão pegava o maior Y de qualquer peça não-branca na faixa da pele e
 * devolveu 157,9 mm; estreitando a janela para 60 mm, devolveu 67,8. Nos dois
 * casos o resultado ficou colado no TETO DA JANELA, que é a assinatura de uma
 * medida que não achou nada e devolveu o próprio limite: a pele lateral tem
 * ferragem corrida em toda altura (os frisos de rebite em `inox-ferragem` que
 * `trailer-rig.ts` descreve), então "o mais alto perto do piso" nunca isola o
 * perfil. Quem isola é o NOME do material — a mesma doutrina de `WHITE_RE` e
 * `TYRE_RE` no resto do engine.
 *
 * A janela em Y continua existindo para recusar a cantoneira de TOPO, que é do
 * mesmo material e corre a lateral inteira lá em cima.
 */
function measureSill(
  root: THREE.Object3D, cx: number, half: number, floorY: number, frameRe: RegExp,
): number {
  const v = new THREE.Vector3();
  const skin = half - 0.06;
  /* Máximo POR CÉLULA de 250 mm ao longo do baú, e depois a MEDIANA das
     células. Não o máximo global: o perfil que interessa é o que CORRE a
     lateral inteira, e o máximo global é sempre uma peça de canto — montante de
     testeira, batente de traseira — que sobe muito mais alto e existe em dois
     lugares só. Neste bake os dois valores COINCIDEM em 1,5194 (127,5 mm acima
     do piso), o que é a resposta certa e também a confirmação de que o perfil
     corre mesmo de ponta a ponta: ele lapa os 127 mm de baixo da saia lisa de
     175 mm, e o primeiro friso começa logo acima (1,5669). A votação por célula
     fica porque é ela que garante isso em vez de supor — num bake com montante
     de canto mais alto, o máximo global mentiria e a mediana não.
     É a mesma técnica que `trailer-rig.ts` usa para achar a chapa do pino-rei,
     e pelo mesmo motivo: a densidade de malha varia de peça para peça, então
     vota-se por ÁREA (uma célula, um voto) e não por vértice. */
  const cells = new Map<number, number>();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || !mesh.geometry?.attributes?.position) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!mats.some((m) => !!m && frameRe.test(m.name || ''))) return;
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      if (Math.abs(v.x - cx) < skin) continue;
      if (v.y < floorY - 0.40 || v.y > floorY + 0.30) continue;
      const k = Math.round(v.z / 0.25);
      const cur = cells.get(k);
      if (cur === undefined || v.y > cur) cells.set(k, v.y);
    }
  });
  if (cells.size < 4) {
    console.warn('[porta] perfil inferior da lateral não encontrado em malha'
      + ` suficiente (material ${frameRe}) — o batente cai na linha do piso, e a`
      + ' porta pode nascer dentro da cantoneira. Ver `frameMaterial` em'
      + ' TrailerBodyOptions.');
    return floorY;
  }
  const tops = [...cells.values()].sort((a, b) => a - b);
  return tops[tops.length >> 1];
}



/**
 * A FACE DE BAIXO do perfil de arremate de CIMA — onde a coluna de rebites para.
 *
 * Irmã de `measureSill()`, e pela mesma razão: o quadro é o mesmo material, o
 * que muda é a ponta do baú que se mede. Máximo... aqui MÍNIMO por célula de
 * 250 mm ao longo do flanco, e a MEDIANA das células — o mínimo global seria
 * uma peça de canto que desce muito mais, e a mediana é o perfil que corre de
 * ponta a ponta.
 *
 * POR QUE ELA PRECISOU EXISTIR: a margem do rebite era `yMax − 0,20`, uma
 * constante. 200 mm é a ALTURA DO PERFIL DO SEMIRREBOQUE (medido: 3,961…4,171,
 * ou seja 210 mm). O perfil do sobrechassi tem 103 mm (2,948…3,051), e os
 * ~97 mm de diferença saíam como parede pelada no alto do flanco — que é
 * exatamente o "parte de cima faltando rebites" do relato.
 *
 * Devolve `null` quando o perfil não é encontrado; quem chama volta à
 * constante e diz que voltou.
 */
function measureTopRail(
  root: THREE.Object3D, cx: number, half: number, roofY: number, frameRe: RegExp,
): number | null {
  const v = new THREE.Vector3();
  const skin = half - 0.06;
  const cells = new Map<number, number>();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || !mesh.geometry?.attributes?.position) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (!mats.some((m) => !!m && frameRe.test(m.name || ''))) return;
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      if (Math.abs(v.x - cx) < skin) continue;
      /* A janela é o alto do baú: 400 mm abaixo do teto e 200 acima. O perfil
         de BAIXO (mesmo material) fica a metros daqui e cai fora por ela. */
      if (v.y < roofY - 0.40 || v.y > roofY + 0.20) continue;
      const k = Math.round(v.z / 0.25);
      const cur = cells.get(k);
      if (cur === undefined || v.y < cur) cells.set(k, v.y);
    }
  });
  if (cells.size < 4) return null;
  const lows = [...cells.values()].sort((a, b) => a - b);
  return lows[lows.length >> 1];
}

/**
 * As peças da porta, extraídas DO PRÓPRIO IMPLEMENTO.
 *
 * Não há asset novo: manípulo, contra-fecho, fecho de ponta, guia, alavanca,
 * varão e tala já existem no `trailer.glb`, montados nas portas TRASEIRAS.
 * Cinco deles batem ao milímetro com o que a porta lateral do modelo da
 * Ibiporã usa; os outros dois são a mesma família num comprimento diferente e
 * são extrusões, então esticam exato. Reusá-los faz a textura ser a mesma por
 * CONSTRUÇÃO — é a mesma malha e o mesmo material, não uma aproximação.
 *
 * A PERMUTAÇÃO DE EIXOS É DERIVADA, não escrita. Cada peça está no baú na
 * orientação da porta traseira, que não é a da lateral; o alvo de
 * `DoorPartSpec.size` diz quanto ela deve medir em cada eixo DA PORTA, e o
 * casamento guloso entre as duas ternas dá a permutação. Uma permutação escrita
 * à mão já entregou um kit inteiro deitado 90° — tamanho certo, eixos trocados,
 * nenhum erro para denunciar. Derivada da medida, esse defeito não volta.
 *
 * Uma permutação ímpar tem determinante −1 e inverte o ENROLAMENTO. Com
 * `FrontSide` isso não escurece a peça: apaga. Por isso o índice é revertido
 * junto quando o determinante é negativo.
 */
/** As famílias que existem em PAR ESPELHADO nas pontas da porta — o kit as
 *  guarda na orientação da ponta de BAIXO e `layoutDoor()` espelha a de cima. */
const END_FLIP = new Set<DoorPart>(['CABECOTE', 'MACHO', 'ENCAIXE', 'BORRACHA_H']);

/**
 * Remonta o `Map` do kit a partir do asset exportado.
 *
 * O contrato é o NOME: `tools/trailer-bench/kitexport.ts` escreve uma malha por
 * família, chamada `KIT_<FAMÍLIA>`, com a geometria LOCAL que
 * `extractDoorKit()` entregou — já recentrada e já espelhada peça a peça (ver a
 * nota do espelho em `rebuildParts`). Nada é medido de novo aqui: medir de novo
 * seria abrir a porta para o asset e o extrator discordarem.
 *
 * Uma família ausente no asset simplesmente não entra, e `rebuildParts()` pula
 * a peça — o mesmo comportamento de um bake sem ela.
 */
function readKitAsset(asset: THREE.Object3D): Map<DoorPart, DoorKitEntry> {
  const kit = new Map<DoorPart, DoorKitEntry>();
  const conhecidas = new Set<string>(DOOR_PARTS.map((sp) => sp.part as string));
  asset.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const m = /^KIT_(.+)$/.exec(mesh.name || '');
    if (!m) return;
    const part = m[1] as DoorPart;
    if (!conhecidas.has(part) || kit.has(part)) return;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!mat) return;
    kit.set(part, { geo: mesh.geometry, mat });
  });
  console.info('[porta] kit compartilhado —', kit.size, 'famílias:',
    [...kit.keys()].sort().join(' '));
  return kit;
}

function extractDoorKit(
  root: THREE.Object3D, bodyWorld: THREE.Box3,
): Map<DoorPart, DoorKitEntry> {
  const kit = new Map<DoorPart, DoorKitEntry>();
  root.updateWorldMatrix(true, true);
  const inv = root.matrixWorld.clone().invert();
  const body = bodyWorld.clone().applyMatrix4(inv);
  const centre = body.getCenter(new THREE.Vector3());
  const v = new THREE.Vector3();

  /* A JANELA DA BUSCA: a faixa de 60 cm colada à traseira do corpo branco.
     O kit é o das PORTAS TRASEIRAS, e sem esta janela o casamento por tamanho
     varria o implemento inteiro — chassi, suspensão, caixa de ferramentas — a
     caçar a primeira malha com três medidas parecidas. Peças pequenas são as
     que sofrem: `TRAVA_PINO` (16 × 10 × 15) saía com 2 762 triângulos, ou seja
     alguma outra coisa do baú, e `PORCA` e `REBITE` trocavam de malha conforme
     a ordem de travessia. Dentro da janela só existe a porta.

     A folga de 60 cm cobre a ferragem que fica ATRÁS do plano da chapa (o
     conjunto do varão mora em z −7,50 contra os −7,48 do corpo) com margem, e
     não chega perto do bogie. */
  const zBack = body.min.z + 0.60;

  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry?.attributes?.position) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const pending = DOOR_PARTS.filter((sp) => !kit.has(sp.part)
      && mats.some((m) => !!m && sp.material.test(m.name || '')));
    if (!pending.length) return;

    const m4 = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
    const pos = mesh.geometry.attributes.position;
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m4);
      const c = [v.x, v.y, v.z];
      for (let k = 0; k < 3; k++) {
        if (c[k] < lo[k]) lo[k] = c[k];
        if (c[k] > hi[k]) hi[k] = c[k];
      }
    }
    const size = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
    /* Fora da janela: não é peça de porta traseira, seja qual for o tamanho. */
    if ((lo[2] + hi[2]) / 2 > zBack) return;
    if ((lo[1] + hi[1]) / 2 < body.min.y - 0.10) return;

    /* ------------------------------------------ QUAL FAMÍLIA FICA COM A MALHA
       A que MELHOR a descreve entre TODAS — e a comparação é com todas, não só
       com as que ainda faltam. `GUIA` (100 × 34 × 41,4) e `ENCAIXE`
       (101,5 × 36,5 × 44) diferem 1,5 · 2,5 · 2,6 mm, ou seja cada uma cabe na
       malha da outra dentro dos 4 mm de `PART_TOL`. Duas versões erradas disto:

         "a primeira que couber"   a ordem de travessia decidia, e a guia ia
                                   parar no encaixe;
         "a melhor entre as que    a primeira malha de guia ia certo para
          ainda faltam"            `GUIA`; a SEGUNDA malha de guia — há oito na
                                   traseira — encontrava `ENCAIXE` sozinho na
                                   lista e ia para lá. O encaixe do varão saía
                                   com a geometria da guia, 297 triângulos em
                                   vez de 1707, e o defeito era invisível: duas
                                   peças de suporte parecidas.

       Comparando com todas, uma malha de guia só pode ser guia. Se `GUIA` já
       está no kit, ela é DESCARTADA — que é o certo, porque é uma segunda
       cópia da mesma peça. */
    const erroDe = (sp: DoorPartSpec) => {
      const used = [false, false, false];
      let worst = 0;
      for (let t = 0; t < 3; t++) {
        let best = -1, bestErr = Infinity;
        for (let s = 0; s < 3; s++) {
          if (used[s]) continue;
          const e = Math.abs(size[s] - sp.size[t]);
          if (e < bestErr) { bestErr = e; best = s; }
        }
        used[best] = true;
        if (bestErr > worst) worst = bestErr;
      }
      return worst;
    };
    let dono: DoorPartSpec | null = null;
    let donoErr = Infinity;
    for (const sp of DOOR_PARTS) {
      if (!mats.some((m) => !!m && sp.material.test(m.name || ''))) continue;
      const e = erroDe(sp);
      if (e < donoErr) { donoErr = e; dono = sp; }
    }
    if (!dono || donoErr > PART_TOL || kit.has(dono.part)) return;

    for (const sp of [dono]) {
      /* ------------------------------------------- QUAL EIXO VIRA QUAL EIXO
         Todas as SEIS permutações são avaliadas, e entre as que cabem na
         tolerância vence a que põe no eixo de PROFUNDIDADE o eixo em que a peça
         está mais longe do centro do baú.

         Era um casamento guloso — primeiro eixo do alvo fica com o eixo de
         origem mais parecido —, e ele é ambíguo justamente nas peças de seção
         quadrada. O varão (25,1 × 2490 × 25,4) contra o alvo (25, 2490, 25):
         para o primeiro 25 o guloso escolhia X (erro 0,1) em vez de Z (erro
         0,4), e X não é a profundidade de uma porta traseira. Daí os dois
         avisos que este arquivo emitia desde sempre — "VARAO/ANEL: a peça está
         a −115 mm do centro no eixo de profundidade, perto demais para dizer
         que lado é fora" —, e daí um kit onde duas famílias saíam por um
         palpite.

         O critério novo é MEDIDO e não tem empate real: a ferragem das portas
         traseiras mora a ~7,4 m do centro do baú em Z e a ~0,1 m em X. Quem
         estiver a 7,4 m é a profundidade. */
      const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
      const mid = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
      let perm: number[] | null = null;
      let bestOff = -1;
      for (const cand of PERMS) {
        let fits = true;
        for (let t = 0; t < 3; t++) {
          if (Math.abs(size[cand[t]] - sp.size[t]) > PART_TOL) { fits = false; break; }
        }
        if (!fits) continue;
        const off = Math.abs(mid[cand[0]] - centre.getComponent(cand[0]));
        if (off > bestOff) { bestOff = off; perm = cand; }
      }
      if (!perm) continue;

      /* ------------------------------------------------------- O SENTIDO
         A permutação diz QUAL eixo do baú vira qual eixo da porta. Ela NÃO diz
         para que LADO — e essa metade faltando é o defeito que a tela relatou
         como "a ferragem está virada para dentro do baú".

         `perm = [2,1,0]` para a tala, por exemplo, é uma TRANSPOSIÇÃO: sinal
         −1, determinante −1, ou seja um ESPELHO e não um giro. O código
         detectava o determinante negativo e revertia o enrolamento — o que faz
         a peça voltar a ser DESENHADA, e é por isso que o defeito passou: a
         peça aparecia, com as medidas certas, do avesso. Uma ferragem espelhada
         é a mesma silhueta com a cara para o outro lado, e a cara dela ficava
         para dentro da parede.

         O conserto é escolher os SINAIS, não reverter o enrolamento:

           s0  o eixo de profundidade aponta para FORA. Qual lado é fora sai da
               própria peça: a ferragem das portas TRASEIRAS mora a ~7 m do
               centro do baú, então o vetor centro→peça, projetado no eixo de
               origem, é a normal de saída daquele painel. Medido, não suposto —
               um bake com a traseira em +Z inverte o número e a conta segue.
           s1  a altura é a altura: o eixo vertical do baú é o vertical da porta.
           s2  o que sobra, e ele é ESCOLHIDO para fechar determinante +1.

         Com det = +1 a transformação é um GIRO: a peça mantém a mão (ferragem é
         quiral — uma dobradiça espelhada não existe no estoque) e o enrolamento
         continua válido sem reversão nenhuma. Para a tala isto dá exatamente
         `x = −z, y = y, z = x`, que é o giro de −90° em Y que leva um painel
         virado para a traseira a um painel virado para a lateral direita. */
      const off = mid[perm[0]] - centre.getComponent(perm[0]);
      if (Math.abs(off) < 0.5) {
        console.warn(`[porta] ${sp.part}: a peça de origem está a`
          + ` ${(off * 1000).toFixed(0)} mm do centro do baú no eixo de`
          + ' profundidade — perto demais para dizer que lado é fora. Ela sai'
          + ' com o sentido presumido e pode aparecer virada para dentro.');
      }
      const s0 = off < 0 ? -1 : 1;
      const s1 = 1;
      /* Sinal da permutação, pela definição: Π_{i<j} (σ(j) − σ(i)). */
      const parity = (perm[1] - perm[0]) * (perm[2] - perm[0]) * (perm[2] - perm[1]) > 0 ? 1 : -1;

      /* --------------------------------------------- s2: DE QUAL PORTA VEIO
         As duas portas TRASEIRAS são imagens espelhadas uma da outra, e este
         laço pega a PRIMEIRA que encontrar — a mão do kit era, até aqui, um
         cara-ou-coroa da ordem de travessia. A tala é a única peça bem
         assimétrica no eixo do painel (massa a +3,6 % do centro da caixa na
         porta esquerda, −3,6 % na direita), então era ela que denunciava, e o
         varão e os fechos, quase simétricos, saíam plausíveis das duas formas.
         Daí o relato: "a dobradiça está ao contrário, o resto está como na
         traseira".

         `sideOf` é o lado da porta de origem: a direção que, naquela porta,
         aponta para a borda EXTERNA — a que leva a dobradiça. Na lateral essa
         borda é a TRASEIRA da folha, ou seja −Z (ver `layoutDoor()`). Então o
         eixo do painel tem de mapear `sideOf` em −Z, e é isso que `s2` diz.

         Derivado por peça, e não por kit: nada garante que tala e manípulo
         venham da MESMA porta traseira, e um sinal global acertaria uma e
         erraria a outra. */
      const panel = perm[2];
      const lado = mid[panel] - centre.getComponent(panel);
      let s2: number;
      if (Math.abs(lado) < 0.3) {
        /* Peça centrada no baú: não dá para dizer de que porta veio. O varão é
           o caso — seção 25 × 25 mm, simétrica, e o casamento por tamanho ainda
           resolve a profundidade dele para o eixo errado. Cai no sinal que fecha
           det = +1, que para uma peça simétrica é indistinguível do certo. */
        s2 = parity * s0 * s1;
      } else {
        s2 = lado > 0 ? -1 : 1;
      }

      const geo = mesh.geometry.clone();
      geo.applyMatrix4(m4);
      orientGeometry(geo, perm, [s0, s1, s2]);
      /* PEÇA DE PONTA VEM NORMALIZADA PARA A PONTA DE BAIXO. Cabeçote, macho,
         encaixe e travessa de borracha existem em pares espelhados na vertical
         (a unidade do topo é a imagem da de baixo), e este laço pega a PRIMEIRA
         malha que casar — de qual ponta ela vem é sorte da travessia. Sem
         normalizar, um kit extraído do topo saía de cabeça para baixo nas duas
         pontas; normalizado, `layoutDoor()` marca `flipY` na instância do topo
         e o came do macho aponta para a boca do encaixe em vez de para longe
         dela. O espelho inverte o enrolamento, então ele é revertido junto. */
      if (END_FLIP.has(sp.part)
        && mid[perm[1]] > centre.getComponent(perm[1])) {
        geo.scale(1, -1, 1);
        reverseWinding(geo);
      }
      anchorGeometry(geo, sp.anchor);
      const src = mats.find((m) => !!m && sp.material.test(m.name || '')) as THREE.Material;
      kit.set(sp.part, { geo, mat: src });
      /* UMA malha, UMA família. Sem o corte, a malha da guia que também cabia
         em `ENCAIXE` era gravada nas DUAS — a mesma peça instanciada em dois
         lugares diferentes, com a medida de um e o nome do outro. */
      break;
    }
  });

  const faltando = DOOR_PARTS.filter((sp) => !kit.has(sp.part)).map((sp) => sp.part);
  if (faltando.length) {
    console.warn('[porta] peças não encontradas no implemento:', faltando.join(', '),
      '— a porta sai sem elas. Este bake não tem a ferragem das portas traseiras'
      + ' nas medidas esperadas.');
  }
  return kit;
}

/**
 * Leva uma peça do referencial em que ela foi ASSADA ao referencial da porta.
 *
 * `perm` diz qual eixo do baú vira qual eixo da porta; `signs` diz para que
 * lado. Os dois juntos formam uma matriz de permutação COM SINAL, e o chamador
 * escolhe os sinais de modo que o determinante seja +1 — ou seja, um giro.
 *
 * O determinante pode dar −1, e aí a peça é ESPELHADA — o que é correto e
 * esperado: as duas portas traseiras são imagens uma da outra, então o kit que
 * vem de uma delas precisa ser espelhado para servir à lateral e o que vem da
 * outra não. Quando isso acontece o enrolamento é revertido junto, porque com
 * `FrontSide` um triângulo invertido não escurece: SOME.
 *
 * A diferença para a versão anterior está em QUEM decide. Lá o determinante era
 * um efeito colateral da permutação de tamanhos — um cara-ou-coroa — e a
 * reversão de enrolamento era o band-aid que fazia a peça reaparecer, espelhada,
 * com a cara virada para dentro da parede. Aqui o sinal de cada eixo é escolhido
 * pela geometria de origem (ver `s0`, `s1`, `s2` em `extractDoorKit()`) e o
 * determinante é a consequência, não a causa.
 */
function orientGeometry(geo: THREE.BufferGeometry, perm: number[], signs: number[]) {
  const move = (a: THREE.BufferAttribute) => {
    for (let i = 0; i < a.count; i++) {
      const c = [a.getX(i), a.getY(i), a.getZ(i)];
      a.setXYZ(i, signs[0] * c[perm[0]], signs[1] * c[perm[1]], signs[2] * c[perm[2]]);
    }
    a.needsUpdate = true;
  };
  move(geo.getAttribute('position') as THREE.BufferAttribute);
  const nrm = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (nrm) move(nrm);

  const parity = (perm[1] - perm[0]) * (perm[2] - perm[0]) * (perm[2] - perm[1]) > 0 ? 1 : -1;
  if (parity * signs[0] * signs[1] * signs[2] < 0) reverseWinding(geo);
  geo.computeBoundingBox();
}

/** Inverte a ordem dos triângulos — o par obrigatório de qualquer
 *  transformação com determinante negativo. */
function reverseWinding(geo: THREE.BufferGeometry) {
  const idx = geo.getIndex();
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i); idx.setX(i, idx.getX(i + 2)); idx.setX(i + 2, a);
    }
    idx.needsUpdate = true;
    return;
  }
  for (const name of ['position', 'normal', 'uv'] as const) {
    const a = geo.getAttribute(name) as THREE.BufferAttribute | undefined;
    if (!a) continue;
    const n = a.itemSize;
    const arr = a.array as Float32Array;
    for (let t = 0; t < a.count; t += 3) {
      for (let k = 0; k < n; k++) {
        const i = t * n + k, j = (t + 2) * n + k;
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
    }
    a.needsUpdate = true;
  }
}

/** Leva a geometria à origem contratada. */
function anchorGeometry(geo: THREE.BufferGeometry, how: 'centro' | 'base') {
  geo.computeBoundingBox();
  const b = geo.boundingBox as THREE.Box3;
  const c = b.getCenter(new THREE.Vector3());
  geo.translate(-c.x, how === 'base' ? -b.min.y : -c.y, -c.z);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
}

/* `reverseWinding()` morava aqui, e a remoção dele é o registro do defeito.
   Ele existia para salvar a peça depois de uma transformação com determinante
   negativo — mas reverter o enrolamento conserta o DESCARTE, não a orientação:
   a peça voltava a ser desenhada, espelhada, com a cara virada para dentro da
   parede. `orientGeometry()` escolhe os sinais para o determinante ser +1, então
   não sobrou nada para reverter. `mirrorX()` continua revertendo o dela — lá o
   espelho é INTENCIONAL (a porta é peça de mão) e a reversão é o par correto. */

interface DoorKitEntry { geo: THREE.BufferGeometry; mat: THREE.Material }

/**
 * O material do BATENTE: o galvanizado do próprio implemento, clonado.
 *
 * Mesma doutrina do kit de ferragem — nada de material inventado. O batente
 * real é o mesmo perfil `metal-galvanizado-mantido` que corre a saia e a
 * cantoneira, e reusá-lo faz o batente responder ao acabamento e à iluminação
 * exatamente como o resto do metal do baú, em vez de ser um cinza escolhido a
 * dedo que descola a cada troca de cenário.
 *
 * Clonado e renomeado pelo mesmo motivo que o branco e que `partMaterial()`:
 * `applyTrailerFinish()` despacha por NOME, e um homônimo seria tratado como a
 * peça de fábrica.
 *
 * `DoubleSide` é decisão, não descuido. O corpo branco é `FrontSide` porque é
 * chapa de 0,80 mm com face gêmea atrás (ver o construtor); o batente é
 * superfície ÚNICA, sem par para brigar no z-buffer, e uma face virada ao
 * contrário aqui não escureceria: SUMIRIA, reabrindo o furo que esta peça
 * existe para fechar. As normais são escritas em `jambGeometry()`, então o
 * sombreamento não depende do enrolamento.
 */
function makeJambMaterial(
  root: THREE.Object3D, re: RegExp, rótulo: string, reserva: number,
  tinta?: number,
): THREE.Material {
  let src: THREE.Material | null = null;
  root.traverse((o) => {
    if (src) return;
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    src = mats.find((m) => !!m && re.test(m.name || '')) ?? null;
  });
  if (!src) {
    console.warn(`[porta] material do ${rótulo} (${re.source}) não encontrado no`
      + ' implemento — a peça sai numa cor de reserva. O vão continua fechado;'
      + ' só o acabamento é que não acompanha o resto do baú.');
  }
  const m = (src as THREE.Material | null)?.clone()
    ?? new THREE.MeshStandardMaterial({ color: reserva, metalness: 0.6, roughness: 0.6 });
  m.name = `${(src as THREE.Material | null)?.name ?? rótulo}__porta`;
  m.side = THREE.DoubleSide;
  /* O ACABAMENTO DE METAL ESTRUTURAL, aplicado AQUI e não pela varredura.
     `applyTrailerFinish()` anda por MALHAS, e este clone nasce no construtor
     do `TrailerBody`, quando ainda não existe porta nenhuma — sem malha, a
     varredura nunca o vê. O original recebe rug ≥0,62 e env 1,0 (o bloco
     `TRAILER_STRUCT_METAL_RE` de `models.ts`: galvanizado de usinagem é
     ACETINADO, não espelho); o clone órfão ficava com os escalares crus do
     rip — metalness 1, roughness baixa — e virava um espelho do HDRI: é o
     "o inox da porta está refletindo o HDR". O mesmo piso, escrito aqui,
     torna o resultado independente da ordem das varreduras. */
  {
    const s = m as THREE.MeshStandardMaterial;
    if ('roughness' in s) {
      if (!s.roughnessMap) s.roughness = Math.max(s.roughness ?? 0, 0.62);
      s.envMapIntensity = 1.0;
    }
  }
  /* A tinta é um MECANISMO DORMENTE: hoje nenhum chamador a passa.
   *
   * Ela existiu para escurecer o marco para 0x2b2e33, imitando a faixa preta
   * da foto de catálogo da Ibiporã — e a decisão foi revertida (ver o call
   * site no construtor): escurecido, o marco empatava com a borracha e o
   * conjunto lia INVERTIDO. A referência de aparência é a porta traseira do
   * NOSSO bake, onde o marco é claro e o contorno escuro é da borracha.
   *
   * O bloco fica porque ele ensina o que "escurecer um material" exige de
   * verdade — cor sozinha não escurece nada: num metal puro a cor tinge o
   * REFLEXO (daí o metalness descer), e `clearcoat`/`sheen` refletem o
   * ambiente POR CIMA de qualquer cor de base (daí serem zerados). Se um
   * acabamento escuro voltar a ser necessário, é por aqui. */
  if (tinta !== undefined && 'color' in m) {
    const s = m as THREE.MeshPhysicalMaterial;
    s.color.setHex(tinta);
    s.metalness = Math.min(s.metalness, 0.35);
    s.roughness = Math.max(s.roughness, 0.55);
    if (s.metalnessMap) s.metalnessMap = null;
    if (s.roughnessMap) s.roughnessMap = null;
    if (s.map) s.map = null;
    /* E as CAMADAS POR CIMA da cor, que são o motivo de as duas linhas acima
       não terem bastado nas primeiras tentativas. `clearcoat` é um verniz: ele
       reflete o ambiente — aqui uma sala branca — por cima de qualquer cor de
       base, então o perfil continuava saindo com o gradiente espelhado de
       sempre enquanto o diagnóstico jurava `cor #2b2e33, metalness 0,35`.
       Escurecer um material sem desligar o verniz dele é escurecer o que não
       se vê. */
    if (typeof s.clearcoat === 'number') s.clearcoat = 0;
    if (typeof s.sheen === 'number') s.sheen = 0;
    if (typeof s.specularIntensity === 'number') s.specularIntensity = 0.25;
    if (typeof s.iridescence === 'number') s.iridescence = 0;
    s.envMapIntensity = Math.min(s.envMapIntensity ?? 1, 0.5);
    s.needsUpdate = true;
  }
  return m;
}

/**
 * Espelha uma geometria num eixo. As peças da porta usam os dois:
 *
 *   `z`  SEMPRE. O kit sai das portas TRASEIRAS e `orientGeometry()` o entrega
 *        com a dobradiça apontando para +Z; a porta lateral tem a charneira na
 *        TRASEIRA (ver `layoutDoor()`). Espelhar só as coordenadas do layout
 *        deixaria cada peça do avesso no próprio lugar — o punho da tala
 *        entrando na folha e a chapa de fixação pendurada fora dela.
 *   `x`  na lateral ESQUERDA, onde "fora" troca de sinal.
 *
 * ESPELHA, e não gira, e isso é o ponto: a porta é peça de MÃO. Um giro de 180°
 * em Y trocaria as pontas mantendo a mão, e o que se quer é a outra mão — a
 * porta esquerda de um implemento é a imagem refletida da direita, não a mesma
 * peça virada. Na lateral esquerda os dois espelhos se compõem e o resultado é
 * um giro; é consequência, não intenção.
 *
 * O preço de cada espelho é o ENROLAMENTO: todo triângulo fica ao contrário e,
 * com `FrontSide`, a peça SOME em vez de escurecer. Por isso o índice é
 * revertido a cada chamada — dois espelhos revertem duas vezes e voltam ao
 * lugar, que é exatamente o certo para a composição acima.
 *
 * (`wheel-bake` resolve o problema oposto — lá a roda é simétrica e girar é o
 * certo, e o cabeçalho dele diz "giro, não espelhamento" pelo mesmo motivo
 * técnico visto do outro lado.)
 */
function mirrorAxis(src: THREE.BufferGeometry, axis: 'x' | 'y' | 'z'): THREE.BufferGeometry {
  const geo = src.clone();
  const k = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const flip = (a: THREE.BufferAttribute) => {
    for (let i = 0; i < a.count; i++) {
      const c = [a.getX(i), a.getY(i), a.getZ(i)];
      c[k] = -c[k];
      a.setXYZ(i, c[0], c[1], c[2]);
    }
    a.needsUpdate = true;
  };
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  flip(pos);
  const nrm = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
  if (nrm) flip(nrm);
  const idx = geo.getIndex();
  if (idx) {
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i);
      idx.setX(i, idx.getX(i + 2));
      idx.setX(i + 2, a);
    }
    idx.needsUpdate = true;
  } else {
    /* Sem índice, reverter significa trocar dois vértices de cada triângulo. */
    const arr = pos.array as Float32Array;
    const nar = nrm ? (nrm.array as Float32Array) : null;
    for (let t = 0; t < pos.count; t += 3) {
      for (let k = 0; k < 3; k++) {
        const i = (t + 0) * 3 + k, j = (t + 2) * 3 + k;
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        if (nar) { const tn = nar[i]; nar[i] = nar[j]; nar[j] = tn; }
      }
    }
  }
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/* ------------------------------------------------------------ construção */

/**
 * O nome da malha de TETO do corpo paramétrico.
 *
 * Exportado porque três módulos precisam reconhecê-la pelo nome e nenhum deles
 * pode importar a classe: `vehicle/trim.ts` (para pintá-la sozinha),
 * `vehicle/models.ts` (para não a tratar como fonte de recorte de livery) e o
 * descarte de chapas. Um literal repetido em quatro arquivos é como um renome
 * de malha vira um teto que deixa de aceitar cor sem nenhum erro.
 */
export const TRAILER_ROOF_MESH = 'TRAILER_ROOF';

/**
 * O que muda de BAKE PARA BAKE e não dá para medir.
 *
 * Este arquivo é espelhado e depende só de `three` — ele não pode importar o
 * catálogo de implementos (`vehicle/implements.ts`) sem trazer o engine inteiro
 * junto e sem quebrar a cópia do `truck-studio-desktop`. Então o que é
 * declarado por implemento CHEGA por aqui, do chamador (`TrailerRig`, que
 * recebe de `models.ts`).
 *
 * Só entra nesta interface o que NÃO tem como sair de uma medida. Altura de
 * friso, passo, plano da pele, vão do baú: tudo isso é lido da malha e continua
 * sendo. Um nome de material, não — ele é uma convenção do bake, e dois bakes
 * do mesmo fabricante já divergiram nela.
 */
export interface TrailerBodyOptions {
  /**
   * O material do PERFIL DE ARREMATE do baú — o quadro que corre o flanco em
   * cima e embaixo. Padrão: `metal-galvanizado-mantido`, o nome do
   * semirreboque; no sobrechassi o mesmo papel é de
   * `metal-estrutura-principal-padrao`.
   *
   * DUAS medidas saem dele, e é por isso que ele é um só:
   *   · `sillY`    — o topo do perfil de BAIXO, que dá o batente da porta;
   *   · `topRailY` — a face de baixo do perfil de CIMA, que é onde a coluna de
   *                  rebites tem de parar.
   *
   * Ter dois nomes para o mesmo quadro já foi o erro: a margem do rebite era
   * uma CONSTANTE de 200 mm, que é a altura do perfil do semirreboque. O do
   * sobrechassi tem 103 mm, e os 97 mm de diferença são parede pelada.
   */
  frameMaterial?: RegExp;
  /**
   * O material do perfil de BAIXO, quando ele não é o mesmo do de cima.
   *
   * No semirreboque é o mesmo (`metal-galvanizado-mantido` faz os dois), e por
   * isso o padrão é `frameMaterial`. No sobrechassi NÃO: o de cima é
   * `metal-estrutura-principal-padrao`, mas esse nome cobre o ESQUELETO
   * INTEIRO — montante de canto, marco de porta, arco de teto —, e a mediana
   * por célula de `measureSill()` sobe com os montantes: medido, o batente
   * saiu a **250,5 mm** do piso, contra os 127,5 do semirreboque. O perfil de
   * baixo dele é `metal-preto`, a 115 mm, que é a peça análoga.
   */
  sillMaterial?: RegExp;
  /**
   * O KIT DA PORTA já pronto, vindo de `models/vehicles/porta_kit_v1.glb`.
   *
   * Sem ele, `extractDoorKit()` monta a porta com as peças da porta TRASEIRA do
   * próprio implemento, casadas por tamanho. Isso é o certo quando o bake tem
   * as peças — e o semirreboque tem: o kit dele sai com 21 famílias.
   *
   * O sobrechassi sai com 15. A traseira dele tem **2 varões, contra 4 do
   * semirreboque**, então `VARAO`, `ENCAIXE`, `SUPORTE_GUIA` (a peça de
   * plástico preto que segura o varão), `SUPORTE_TALA` e as duas `BORRACHA_H`
   * simplesmente não existem naquele arquivo. Afrouxar tolerância não resolve:
   * não há o que casar.
   *
   * A porta é UMA SÓ — a do modelo antigo — e todo implemento usa aquela. Ver
   * `tools/trailer-bench/kitexport.ts`.
   */
  kit?: THREE.Object3D;
  /**
   * Reancorar a FITA VERTICAL DE CANTO à régua do semirreboque.
   *
   * Ver `fixCornerTape()`: no sobrechassi as quatro fitas param encostadas por
   * baixo do perfil de arremate em vez de subirem nele, e o dono pediu que elas
   * fiquem "na parte de inox que faz fronteira com a frente".
   */
  cornerTape?: boolean;
  /**
   * Refazer o TRILHO DE PISO do flanco pela régua do semirreboque.
   *
   * Ver `fixLowFrameRail()`: o perfil do sobrechassi tem 140 mm onde o do
   * semirreboque tem 210, e ainda está 4,4 mm para DENTRO da pele — subir o
   * topo sem tirá-lo de trás da chapa só o esconderia. O pé dos dois já
   * coincide (piso −82,5 mm), e é essa coincidência que prova que a régua é a
   * mesma peça em dois comprimentos.
   */
  lowFrameRail?: boolean;
  /** Assentar a estação de encosto da porta na faixa lisa do friso — ver
   *  `seatFlankCatches()`. */
  flankCatchOnFlat?: boolean;
  /**
   * Este implemento traz o PRÓPRIO SUB-CHASSI, e ele acompanha o comprimento.
   *
   * `TrailerBody` não usa: quem usa é `TrailerAssembly`, que recebe daqui pelo
   * `TrailerRig`. O motivo de estar nesta interface e não numa própria é o do
   * cabeçalho — este é o ÚNICO canal por onde variação de bake atravessa a
   * fronteira do arquivo espelhado, e abrir um segundo canal para um booleano
   * seria duplicar a fronteira.
   *
   * Ver `AssemblyRefs.subframe`, onde está a medida que a justifica.
   */
  subframe?: boolean;
}

export class TrailerBody {
  readonly profile: TrailerProfile;
  readonly mesh: THREE.Mesh;
  /**
   * O TETO, malha PRÓPRIA — e é isso que o torna pintável separadamente.
   *
   * Mesma geometria de sempre, mesmo material, mesmo lugar: o que muda é que os
   * triângulos de `teto-externo` saem num buffer só deles em vez de dissolvidos
   * no corpo. Duas chamadas de desenho no lugar de uma, e em troca `trim.ts`
   * ganha um alvo real para trocar de material — trocar material é uma operação
   * de MALHA, e enquanto o teto não fosse uma, a cor escolhida para ele era
   * escrita numa malha de fábrica que `rebuild()` já tinha escondido.
   *
   * Fica INVISÍVEL quando o bake não tem chapa de teto branca (`rebuild()`
   * decide), e nesse caso nada aponta para ela.
   */
  readonly roof: THREE.Mesh;
  readonly group = new THREE.Group();

  private shells: Shell[] = [];
  private originals: THREE.Mesh[];
  private dims: TrailerDims;

  /** Portas por face, como o editor as cadastrou. Vazio é o estado de fábrica. */
  private doors = new Map<Face, DoorSpec[]>();
  /**
   * Os VÃOS do último `rebuild()`, por face — a saída de `doorsOf()`, guardada.
   *
   * Guardada e não recalculada: `doorsOf()` aplica dois clamps (o comprimento
   * corrente e a cantoneira) e ancora o pé no batente medido, e quem lê isto de
   * fora precisa do MESMO retângulo, não de um parecido. O consumidor é
   * `models.buildLiveryPanels()`, que usa o vão para não cravar rebite de
   * emenda em cima da porta — ver `addPlateRivets()`.
   */
  private doorHoles = new Map<Face, DoorRect[]>();
  /** A CRISTA do friso de cada lateral — o plano em que a porta é montada. */
  private skinX: Record<'left' | 'right', number> = { left: 0, right: 0 };
  /** A grade do friso de cada lateral, para ancorar as faixas lisas da folha
   *  no VALE (`snapFlatSegments`). Medida na malha, como tudo aqui. */
  private ribGrid: Partial<Record<'left' | 'right', RibGrid>> = {};
  /** As emendas que o BAKE já traz, em distância da parede dianteira e na
   *  medida DE FÁBRICA. Vazio quando a pele é chapa corrida. Ver
   *  `mergeSkinSheets()` e `sheetSeamsFromFront()`. */
  private sheetSeams = new Map<'left' | 'right', number[]>();
  /** As peças da porta, extraídas do próprio implemento no construtor. */
  private kit = new Map<DoorPart, DoorKitEntry>();
  /** As malhas instanciadas em cena, por `peça|lado`. */
  private inst = new Map<string, THREE.InstancedMesh>();
  /** Um clone por material de origem — várias peças dividem `inox-ferragem`. */
  private partMats = new Map<THREE.Material, THREE.Material>();
  /** Marco e borracha de cada lateral: duas malhas por face, todas as portas
   *  juntas. Chave `face|frame` / `face|seal`. */
  private jambs = new Map<string, THREE.Mesh>();
  /** Os materiais das peças de vão, tirados do próprio implemento. */
  private jambMat: { frame: THREE.Material; trim: THREE.Material } | null = null;
  /** Ver `TrailerBodyOptions.frameMaterial`. */
  private readonly frameRe: RegExp;
  /** Ver `TrailerBodyOptions.sillMaterial`. */
  private readonly sillRe: RegExp;
  /** O kit compartilhado, quando há um. Ver `TrailerBodyOptions.kit`. */
  private readonly kitAsset: THREE.Object3D | null;
  constructor(root: THREE.Object3D, opts: TrailerBodyOptions = {}) {
    this.frameRe = opts.frameMaterial ?? FRAME_MAT_RE;
    this.sillRe = opts.sillMaterial ?? this.frameRe;
    this.kitAsset = opts.kit ?? null;
    const { tris, meshes, material } = collect(root);
    if (!tris.length) throw new Error('TrailerBody: nenhuma malha branca encontrada');
    this.originals = meshes;

    const body = boundsOf(tris);
    const bodyH = body.max.y - body.min.y;

    /* Planos da extrusão: medidos na PELE lateral, não no corpo todo — o corpo
       inclui o bojo da testeira (z 7.233) e as lajes das portas (z -7.481),
       que não fazem parte do varrido. */
    const cx = (body.min.x + body.max.x) / 2;
    const half = (body.max.x - body.min.x) / 2;
    const isOuter = (x: number) => Math.abs(x - cx) > half - 0.05;
    let z0 = Infinity, z1 = -Infinity;
    for (const t of tris) {
      for (let k = 0; k < 3; k++) {
        if (!isOuter(t.p[k * 3])) continue;
        const z = t.p[k * 3 + 2];
        if (z < z0) z0 = z; if (z > z1) z1 = z;
      }
    }
    const bodyL = z1 - z0;

    /* Decomposição em cascas — o passo que a versão anterior não tinha. */
    let pitch = NOMINAL_PITCH;
    let ribCount = 0, row0 = body.min.y, rowN = body.max.y;

    /* AS FOLHAS DE PELE SÃO UNIDAS AQUI, e não dentro do laço, porque a decisão
       é sobre o CONJUNTO de cascas e não sobre uma delas — ver
       `mergeSkinSheets()`. Num bake de chapa corrida (o semirreboque) esta
       chamada devolve exatamente o que recebeu. */
    for (const group of mergeSkinSheets([...shellsOf(tris)], cx, half, bodyH, bodyL,
      this.sheetSeams)) {
      const b = boundsOf(group);
      const sh: Shell = {
        tris: group, min: b.min, max: b.max,
        behaviour: 'local', rows: [], skirt: [], unit: [], cap: [], ribs: 0,
        valeH: 0, stretchY: false,
      };

      const spanZ = b.max.z - b.min.z;
      const spanY = b.max.y - b.min.y;

      /* Chapa frisada: precisa ESTAR na pele externa, atravessar o vão, e
         exibir uma corrente longa de fileiras no passo certo. Sem as três
         condições, não é friso — e não leva friso. */
      const onSkin = Math.abs(b.max.x - cx) > half - 0.05 || Math.abs(b.min.x - cx) > half - 0.05;
      if (onSkin && spanZ > bodyL * 0.9 && spanY > bodyH * 0.5) {
        const rows = findRows(group);
        if (rows.length >= MIN_RIB_ROWS) {
          sh.behaviour = 'ribbed';
          /* +X é `right` — ver o comentário do tipo `Face`. Trocar este teste
             põe a porta na lateral oposta à desenhada, sem erro nenhum. */
          sh.face = (b.min.x + b.max.x) / 2 > cx ? 'right' : 'left';
          sh.rows = rows;
          sh.ribs = rows.length - 1;
          const gaps = rows.slice(1).map((y, i) => y - rows[i]);
          pitch = median(gaps) || NOMINAL_PITCH;
          ribCount = sh.ribs; row0 = rows[0]; rowN = rows[rows.length - 1];
          this.sliceRibbed(sh, pitch);
          if (sh.face && sh.valeH > 0) {
            this.ribGrid[sh.face as 'left' | 'right'] =
              { row0: rows[0], pitch, valeH: sh.valeH };
          }
          this.shells.push(sh);
          continue;
        }
      }

      if (spanZ > bodyL * 0.5) sh.behaviour = 'span';
      else if (b.max.z < z0 + CAP_BAND) { sh.behaviour = 'rear'; sh.face = 'rear'; }
      else if (b.min.z > z1 - CAP_BAND) sh.behaviour = 'front';
      else sh.behaviour = 'local';

      /* Chapa lisa grande estica em Y sem distorcer nada — é plana. Peça
         pequena preserva a forma e só translada. */
      sh.stretchY = spanY > bodyH * 0.5;
      this.shells.push(sh);
    }

    const skirtHeight = row0 - body.min.y;
    const capHeight = body.max.y - rowN;
    const baseHeight = ribCount ? skirtHeight + ribCount * pitch + capHeight : bodyH;

    this.profile = {
      pitch, floorY: body.min.y, roofY: body.max.y,
      skirtHeight, capHeight, ribCount,
      /* ANTES do `rebuild()` que fecha o construtor: ele esconde as malhas
         brancas de fábrica, e `measureSill()` filtra por `visible` para não
         medir geometria morta. Medido depois, o filtro passaria a excluir o que
         já estava excluído por material — inofensivo hoje, e uma armadilha no
         dia em que o bake trouxer branco e perfil na mesma malha. */
      sillY: measureSill(root, cx, half, body.min.y, this.sillRe) + SILL_CLEARANCE,
      /* MEDIDO, não constante — ver `measureTopRail()`. `null` quando o perfil
         não aparece, e aí `measureValeRows()` volta à margem antiga. */
      topRailY: measureTopRail(root, cx, half, body.max.y, this.frameRe),
      z0, z1,
      width: body.max.x - body.min.x,
      base: { width: body.max.x - body.min.x, height: baseHeight, length: bodyL },
      shells: this.shells.length,
      ribbedShells: this.shells.filter((s) => s.behaviour === 'ribbed').length,
    };
    this.dims = { ...this.profile.base };

    /* Os dois planos de montagem de porta. São as CRISTAS do friso — o mesmo
       `body.min.x`/`body.max.x` que define a largura —, medidos e não supostos:
       `trailer-door.ts` posiciona moldura, borracha e ferragem contra eles em
       milímetros, e um plano arbitrado erraria as três de uma vez. */
    this.skinX = { left: body.min.x, right: body.max.x };

    const mat = (material as THREE.Material)?.clone() ?? new THREE.MeshStandardMaterial({ color: 0xffffff });
    mat.name = (material?.name ?? 'metalBranco') + '__parametric';

    /* O material branco vem `DoubleSide` do GLB, e o baú é chapa de 0,80 mm:
       95,1 % dos raios na lateral atravessam DUAS superfícies, com separação
       p10 de 0,161 mm e 7,7 % dos pares abaixo de 0,1 mm nas paredes do vinco.
       Com o z-buffer resolvendo ~0,149 mm a 25 m, é z-fighting garantido — a
       lateral "pisca". Renderizar só a face da frente elimina a face de trás
       do par, que nunca deveria estar visível num corpo fechado. */
    mat.side = THREE.FrontSide;
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    this.mesh.name = 'TRAILER_BODY';
    this.mesh.castShadow = this.mesh.receiveShadow = true;
    this.group.add(this.mesh);

    /* O TETO COMPARTILHA O MATERIAL, e é de propósito: sem cor própria ele tem
       de ser indistinguível do resto da chapa, e duas instâncias do mesmo
       material branco divergiriam na primeira correção de acabamento que
       `applyTrailerFinish()` fizesse por nome. Quando `trim.ts` lhe dá uma cor,
       ele TROCA a referência desta malha — o material do corpo fica intacto. */
    this.roof = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    this.roof.name = TRAILER_ROOF_MESH;
    this.roof.castShadow = this.roof.receiveShadow = true;
    this.group.add(this.roof);


    /* A geometria está em espaço de MUNDO e o grupo pendura em `root`; sem
       desfazer a matriz de `root`, ela seria aplicada duas vezes e o baú
       apareceria flutuando ao lado do chassi. Desfazer pela matriz (em vez de
       pendurar na cena) mantém o corpo como filho do modelo. */
    this.group.matrixAutoUpdate = false;
    this.group.matrix.copy(root.matrixWorld).invert();

    /* O KIT vem do PRÓPRIO implemento, e é extraído aqui — antes do primeiro
       `rebuild()`, que já pode precisar dele. Ver `extractDoorKit()`. */
    /* O KIT COMPARTILHADO GANHA, quando existe. Ele é o do bake completo, e
       usá-lo em todo implemento é o que faz a porta ser a MESMA em todos —
       inclusive as peças que o bake local não tem. Sem ele, o caminho de sempre.
       Ver `TrailerBodyOptions.kit`. */
    this.kit = this.kitAsset
      ? readKitAsset(this.kitAsset)
      : extractDoorKit(root, new THREE.Box3(body.min.clone(), body.max.clone()));
    /* SEM tinta, e a remoção é decisão de produto (2026-08-10). O marco chegou a
       ser escurecido para 0x2b2e33 imitando a foto de catálogo da Ibiporã — mas
       borracha (#2b2b2d) e marco tingido (#2b2e33) são o MESMO tom, e os dois
       fundiam num anel preto de ~130 mm. O perfil arredondado da borracha pega
       brilho e lia como METAL encostado na folha; o marco chapado lia como
       BORRACHA por fora — "está invertido", sendo que a geometria estava certa
       (folha → borracha → marco, provado por raio na bancada). No NOSSO bake a
       referência é a porta traseira: marco galvanizado CLARO com a borracha
       preta destacada contra ele. Sem tinta, o contorno escuro volta a ser da
       borracha, que é de quem ele é. */
    this.jambMat = {
      frame: makeJambMaterial(root, DOOR_FRAME_MAT_RE, 'marco', 0x2b2e33),
      /* A moldura é GALVANIZADA — o material da saia e da cantoneira, não o
         do marco e não inox: pedido de produto, e é o mesmo perfil que
         `measureSill()` já localiza por este nome. */
      /* A moldura é o perfil de arremate do baú — o mesmo quadro que dá o
         batente e o teto do rebite. Era `FRAME_MAT_RE` fixo, e num bake sem
         `metal-galvanizado-mantido` ela caía na cor de degradação. */
      trim: makeJambMaterial(root, this.frameRe, 'moldura', 0x9aa0a3),
    };

    this.rebuild();
  }

  /** Fatia a chapa frisada em saia / unidade repetível / arremate de topo. */
  private sliceRibbed(sh: Shell, pitch: number) {
    const R = sh.rows.length - 1;
    /* A unidade sai do MEIO: as fileiras das pontas encostam em reforço, e uma
       delas como molde propagaria o reforço pelo baú inteiro. */
    const u = Math.max(0, Math.min(R - 1, R >> 1));
    const lo = sh.rows[u], hi = sh.rows[u + 1];
    const sy = pitch / (hi - lo);

    for (const t of sh.tris) {
      const ys = [t.p[1], t.p[4], t.p[7]];
      if (Math.max(...ys) <= sh.rows[0] + EPS) { sh.skirt.push(t); continue; }
      if (Math.min(...ys) >= sh.rows[R] - EPS) { sh.cap.push(t); continue; }

      /* QUEM CRUZA A FRONTEIRA ENTRA RECORTADO — não descartado. Um triângulo
         que atravessa `rows[0]` não é saia (max > rows[0]), não é arremate e
         quase nunca alcança o slab da unidade do MEIO: a versão que só tinha
         os três baldes o jogava fora, e a pele parametrica ficava com um RASGO
         horizontal de 1-2 mm exatamente em rows[0] — o ladrilho i=0 recomeça
         ali, mas a saia parava um triângulo antes. MEDIDO na bancada
         (checks-banda2, 2026-08-11): "linha preta" a 175 mm do pé da chapa,
         raio horizontal atravessa até o galvanizado da longarina a 66 mm, e
         raio subindo de baixo (o ângulo de quem olha um baú do chão) vaza
         pelo vão; o bake original é CONTÍNUO na mesma altura. O gêmeo em
         `rows[R]` fica atrás da cantoneira, mas é o mesmo defeito. A parte
         que invade o campo dos ladrilhos é descartada de propósito: aquela
         faixa é reposta pela cópia da unidade, com o MESMO perfil. */
      if (Math.min(...ys) < sh.rows[0] - EPS) {
        for (const c of clipSlab(t, sh.min.y - 1, sh.rows[0])) sh.skirt.push(c);
      }
      if (Math.max(...ys) > sh.rows[R] + EPS) {
        for (const c of clipSlab(t, sh.rows[R], sh.max.y + 1)) sh.cap.push(c);
      }
      for (const c of clipSlab(t, lo, hi)) {
        const p = new Float32Array(c.p);
        for (let k = 0; k < 3; k++) p[k * 3 + 1] = (p[k * 3 + 1] - lo) * sy;
        sh.unit.push({ p, n: c.n });
      }
    }

    /* O VALE da unidade, medido nela: a fileira começa no vale (é onde
       `findRows` marca), que é um trecho PLANO — nenhum vértice no meio. O
       primeiro salto grande na lista de Ys é a altura dele. É esta medida que
       ancora as bordas das faixas lisas da folha (`snapFlatSegments`): borda
       de faixa no meio do ARCO deixa o perfil cortado a meia subida, o degrau
       que lia como "a parte lisa está por cima do friso". */
    const ys = new Set<number>();
    for (const t of sh.unit) {
      for (let k = 0; k < 3; k++) ys.add(Math.round(t.p[k * 3 + 1] * 1e4) / 1e4);
    }
    const sorted = [...ys].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i + 1] - sorted[i] > ROW_GAP) { sh.valeH = sorted[i + 1]; break; }
    }
  }

  get current(): TrailerDims { return { ...this.dims }; }

  /**
   * A grade do friso — onde cada REBAIXO (a parte lisa entre frisos) começa e
   * quanto ele mede. É a régua dos rebites das emendas de chapa
   * (`models.addPlateRivets`): rebite fora do centro do rebaixo é o defeito
   * que a foto denuncia primeiro. Medida no bake, réplica exata do que o
   * `rebuild()` ladrilha.
   */
  /** Os vãos de porta da face, como o último `rebuild()` os abriu. */
  getDoorHoles(face: Face): DoorRect[] {
    return (this.doorHoles.get(face) ?? []).map((r) => ({ ...r }));
  }

  get valeInfo(): { row0: number; pitch: number; valeH: number } | null {
    const g = this.ribGrid.left ?? this.ribGrid.right;
    return g ? { ...g } : null;
  }

  /**
   * As emendas de folha DESTE BAKE, em distância da parede dianteira e já na
   * medida corrente. Vazio quando a pele é chapa corrida — e aí quem desenha
   * volta a inventar a grade, que é o comportamento do semirreboque.
   *
   * A escala é a MESMA de `mapZ(z, 'ribbed')` — `z1 − (z1 − z)·kz`, que sobre
   * uma distância da dianteira é só `d·kz`. Ter as duas contas escritas em
   * lugares diferentes é o que faria a emenda e a chapa discordarem no primeiro
   * resize; por isso esta devolve a distância e nunca um z.
   */
  sheetSeamsFromFront(face: 'left' | 'right'): number[] {
    const raw = this.sheetSeams.get(face);
    if (!raw?.length) return [];
    const kz = this.dims.length / this.profile.base.length;
    return raw.map((d) => +(d * kz).toFixed(4));
  }

  snapHeight(h: number): number {
    const { skirtHeight, capHeight, pitch } = this.profile;
    if (!this.profile.ribCount) return h;
    const n = Math.max(1, Math.round((h - skirtHeight - capHeight) / pitch));
    return skirtHeight + n * pitch + capHeight;
  }

  /**
   * As portas de uma face. Lista vazia remove todas.
   *
   * O vão é ABERTO na chapa e a folha é o pedaço que saiu, deslocado para fora
   * — nunca uma porta DESENHADA por cima. Uma porta pintada sobre chapa inteira
   * continua mostrando o friso atravessando o vão, e é o friso que denuncia a
   * fraude à primeira volta de câmera.
   *
   * Guardar a lista aqui (em vez de aplicar e esquecer) é o que faz a porta
   * sobreviver ao redimensionamento: todo `set()` chama `rebuild()`, e
   * `rebuild()` relê este mapa. Sem isso, cada centímetro digitado no formulário
   * fecharia as portas de volta.
   */
  setDoors(face: Face, doors: DoorSpec[]) {
    this.stageDoors(face, doors);
    this.rebuild();
    return this;
  }

  /**
   * Guarda as portas SEM reconstruir.
   *
   * Existe porque `rebuild()` reescreve os atributos do corpo inteiro, e quem
   * chama de fora do baú costuma ter mais o que refazer depois disso: as chapas
   * de livery são RECORTADAS do corpo (os triângulos migram para SIDE_L/SIDE_R/
   * REAR), então um rebuild solto devolve ao corpo os triângulos que já estão
   * nas chapas e as duas cópias passam a disputar o teste de profundidade — o
   * "marrom lamacento" que `models.ts` descreve em `buildLiveryPanels()`.
   *
   * `models.setTrailerDoors()` usa este método e deixa o rebuild para a
   * sequência que também redescasca as chapas. Quem quiser só mexer na geometria
   * (console, sonda) usa `setDoors()` e paga o rebuild na hora.
   */
  stageDoors(face: Face, doors: DoorSpec[]) {
    this.doors.set(face, doors.map((d) => ({ ...d })));
    return this;
  }

  getDoors(face: Face): DoorSpec[] {
    return (this.doors.get(face) ?? []).map((d) => ({ ...d }));
  }

  set(patch: { height?: number; length?: number }): TrailerDims {
    if (patch.height !== undefined) this.dims.height = this.snapHeight(patch.height);
    if (patch.length !== undefined) this.dims.length = patch.length;
    this.rebuild();
    return { ...this.dims };
  }

  reset() { return this.set({ height: this.profile.base.height, length: this.profile.base.length }); }

  private rebuild() {
    const { pitch, floorY, base, z0, z1 } = this.profile;
    const extra = pitch ? Math.round((this.dims.height - base.height) / pitch) : 0;
    const kz = this.dims.length / base.length;
    const ky = this.dims.height / base.height;
    const zBack = z1 - this.dims.length;
    const dzRear = zBack - z0;

    const pos: number[] = [];
    const nrm: number[] = [];
    const uv: number[] = [];
    /* O TETO EM BUFFER SEPARADO — ver `Tri.roof` e `this.roof`. Dois arrays e
       não dois grupos de geometria: `buildLiveryPanels()` reescreve o índice
       desta malha e chama `clearGroups()` no caminho, então grupos não
       sobreviveriam ao primeiro recorte de chapa. */
    const rPos: number[] = [];
    const rNrm: number[] = [];
    const rUv: number[] = [];

    /* Mapa de Z por comportamento. `front` fica parado porque é ele que carrega
       o pino-rei: alongar mexendo na dianteira desengataria o conjunto. */
    const mapZ = (z: number, b: Behaviour) => {
      if (b === 'front') return z;
      if (b === 'rear') return z + dzRear;
      return z1 - (z1 - z) * kz;
    };

    /* As portas de cada face, já em coordenadas FINAIS.

       `position` é medido da dianteira para trás, e a dianteira (`z1`) é o datum
       que não anda — por isso uma porta não escorrega quando o baú fica mais
       comprido. A altura sobe do PISO, que é o outro datum imóvel: a chapa lisa
       estica a partir dele.

       A CHAPA É RECORTADA, e o `.gltf` COM HIERARQUIA é quem diz: a pele
       esquerda dele é feita de painéis de 1 m e tem um vão de z 0,2704 a
       1,3292 — 1 059 mm de abertura para uma folha de 870. A direita é
       contínua porque naquele implemento a porta só existe do lado esquerdo.
       Um comentário anterior aqui afirmava o contrário ("a chapa não é
       recortada") apoiado nos `.zip` de OBJ, que são capturas por chamada de
       desenho e perderam as matrizes de instância — medir a porta por eles leva
       a conclusões erradas com cara de certas, e esta foi uma delas.

       O que se vê pela faixa de 94,5 mm em volta da folha é o BATENTE, 73 mm
       atrás (`JAMB_DEPTH`), e é ele que fecha o vão — ver `jambGeometry()`. A
       folha é o pedaço da própria pele, então o friso dela continua alinhado
       com o da parede: é o mesmo friso, no mesmo passo e na mesma fase. */
    type DoorCut = {
      leaf: DoorRect; hole: DoorRect;
      segs: { lo: number; hi: number; flat: boolean }[];
    };
    const doorsOf = (face: Face | undefined): DoorCut[] => {
      const list = face ? this.doors.get(face) : undefined;
      if (!list?.length || face === 'rear') return [];
      const out: DoorCut[] = [];
      for (const d of list) {
        /* CLAMP AQUI, e não só no editor. `livery-structure.ts` também limita —
           mas ele limita o que o formulário mostra, e as duas listas são
           atualizadas por caminhos diferentes: encurtar o baú dispara `set()`,
           que passa direto por aqui sem repassar as portas. Sem este clamp uma
           porta ficaria pendurada no ar atrás da traseira nova, e o buraco dela
           sairia num pedaço de chapa que não existe mais. */
        const width = Math.min(Math.max(d.width, 0), this.dims.length);
        const from = Math.min(Math.max(d.position, 0), this.dims.length - width);
        /* O PÉ É O BATENTE, não o piso. E o topo para debaixo da cantoneira:
           uma porta que subisse até o teto entraria no perfil galvanizado que
           corre a lateral inteira. Os dois limites são geometria, não gosto —
           `sillY` foi medido e `HEAD_DROP` também.

           O TETO DESCONTA O VÃO, não a folha. Quem corta a chapa é `hole`, que
           é `DOOR_REVEAL` maior que a folha em cada lado; limitar a folha pela
           cantoneira deixaria o recorte 94,5 mm acima dela, abrindo o vão ATRÁS
           de um perfil que não se mexe — e o batente, mais fundo ainda, sairia
           por dentro dele. */
        const headY = floorY + this.dims.height - HEAD_DROP - DOOR_REVEAL;
        /* O BATENTE MEDIDO É O PÉ DO VÃO, NÃO O DA FOLHA.

           `sillY` é o topo do perfil galvanizado que corre a lateral inteira, e
           a porta ASSENTA sobre ele — nenhuma parte dela desce por baixo. Como
           `holeOf()` abre `DOOR_REVEAL` além da folha nos quatro lados, ancorar
           a FOLHA em `sillY` punha o recorte 94,5 mm ABAIXO do perfil: o vão
           atravessava o perfil e a peça de baixo da porta aparecia por cima
           dele, quando ela tem de aparecer acima. Ancorando o VÃO, a moldura
           inferior fica apoiada no perfil e a folha começa uma folga acima —
           que é o que um implemento montado mostra. */
        const y0 = this.profile.sillY + DOOR_REVEAL;
        const y1 = Math.min(y0 + Math.max(d.height, 0), headY);
        const leaf: DoorRect = { y0, y1, z0: z1 - (from + width), z1: z1 - from };
        const why = rejectReason(leaf);
        if (why) {
          console.warn('[porta] porta de', face, 'recusada —', why);
          continue;
        }
        /* As faixas lisas saem daqui, UMA vez por porta, já ancoradas no VALE
           do friso da face — é a grade medida quem decide onde cada borda
           para, e é o que faz as quatro faixas terminarem como a que "já
           continua a descida do friso". */
        const grid = face === 'left' || face === 'right'
          ? this.ribGrid[face] : undefined;
        out.push({ leaf, hole: holeOf(leaf), segs: snapFlatSegments(leaf, grid) });
      }
      return out;
    };

    /* Uma face por vez: `doorsOf()` roda uma vez por lateral, não uma vez por
       triângulo. São ~73 mil triângulos e a lista é relida em cada um. */
    const doorsFor = new Map<Face, DoorCut[]>();
    for (const face of ['left', 'right'] as const) doorsFor.set(face, doorsOf(face));
    this.doorHoles.clear();
    for (const [face, cuts] of doorsFor) {
      this.doorHoles.set(face, cuts.map((c) => ({ ...c.hole })));
    }

    const write = (t: Tri) => {
      const P = t.roof ? rPos : pos;
      const N = t.roof ? rNrm : nrm;
      const U = t.roof ? rUv : uv;
      for (let k = 0; k < 3; k++) {
        const y = t.p[k * 3 + 1];
        const z = t.p[k * 3 + 2];
        P.push(t.p[k * 3], y, z);
        N.push(t.n[k * 3], t.n[k * 3 + 1], t.n[k * 3 + 2]);
        /* UV de livery: u no comprimento, v na altura, normalizada pelos
           limites CORRENTES — a arte continua casando com a borda após resize. */
        U.push((z - zBack) / this.dims.length, (y - floorY) / this.dims.height);
      }
    };

    /* A crista de cada lateral, para o achatamento das faixas lisas da folha. */
    const xCrest = this.skinX;

    /** Triângulos da FOLHA, por face — entram no mesmo buffer branco no fim. */
    const leafTris: { face: 'left' | 'right'; tris: Tri[] }[] = [
      { face: 'left', tris: [] }, { face: 'right', tris: [] },
    ];

    /**
     * Abre o VÃO e destaca a FOLHA, do mesmo triângulo.
     *
     * O vão é 94,5 mm maior que a folha de cada lado — medido: a pele externa
     * do modelo abre 1 059 mm para uma folha de 870. É essa folga que aparece
     * como a faixa escura em volta da porta, e é o que faz o friso PARAR na
     * borda do vão em vez de atravessar a porta.
     *
     * A folha é o pedaço da própria pele, recortado no retângulo dela e levado
     * 5,1 mm para dentro (medido). Sair da pele é o que garante que ela tenha o
     * MESMO passo e a MESMA fase de friso da parede — uma folha importada de
     * outro arquivo teria 53,0 mm contra os 53,4 mm daqui e sairia fora de fase
     * em ~18 mm ao longo da altura.
     */
    const emit = (t: Tri, face: Face | undefined) => {
      const doors = face === 'left' || face === 'right' ? doorsFor.get(face) : undefined;
      if (!doors?.length) { write(t); return; }

      if (face !== 'left' && face !== 'right') { write(t); return; }
      const bucket = leafTris.find((l) => l.face === face);
      const sgn = face === 'right' ? -1 : 1;
      const dx = sgn * LEAF_INSET;
      for (const { leaf, segs } of doors) {
        /* A FOLHA NÃO TEM O FRISO CORRIDO DA PAREDE. Ela sai recortada dela —
           é o que mantém passo e FASE do friso — e SÓ os segmentos FRISADOS
           passam por aqui. As faixas lisas NÃO são o friso achatado: cada uma
           é UM QUAD, emitido uma vez por porta depois desta varredura (ver o
           laço das faixas em `rebuild()`).

           A versão que achatava a malha projetava TODOS os vértices do
           segmento no plano do vale — pele externa, pele INTERNA (a face gêmea
           0,8 mm atrás, ver o construtor) e paredes do vinco viravam
           superfícies exatamente COPLANARES. Em branco `FrontSide` isso era
           invisível: a pele interna é descartada pelo enrolamento e o que
           sobrepõe sombreia igual. Com a tinta do cavalo — flake amostrado por
           fragmento, camadas físicas — coplanaridade é ruído por pixel: o
           "piscando, chuviscando" que só aparecia nas partes lisas e só com
           essa tinta. Uma chapa lisa é UM plano; a geometria agora diz isso
           literalmente, e de quebra o corte na borda da faixa continua exato
           (`clipSlab` na fronteira do segmento). */
        for (const whole of intersectRect(t, leaf)) {
        for (const seg of segs) {
        if (seg.flat) continue;
        for (const piece of clipSlab(whole, seg.lo, seg.hi)) {
          const q = new Float32Array(piece.p);
          for (let k = 0; k < 3; k++) q[k * 3] += dx;
          bucket?.tris.push({ p: q, n: piece.n });
        }
        }
        }
      }

      /* Um vão de cada vez: o resto de um vira entrada do seguinte, o que faz
         portas encostadas se comportarem como um vão só. */
      let parts: Tri[] = [t];
      for (const { hole } of doors) {
        const next: Tri[] = [];
        for (const q of parts) next.push(...subtractGap(q, hole));
        parts = next;
        if (!parts.length) return;
      }
      for (const q of parts) write(q);
    };

    const push = (t: Tri, dy: number, b: Behaviour, face?: Face) => {
      const p = new Float32Array(9);
      for (let k = 0; k < 3; k++) {
        p[k * 3] = t.p[k * 3];
        p[k * 3 + 1] = t.p[k * 3 + 1] + dy;
        p[k * 3 + 2] = mapZ(t.p[k * 3 + 2], b);
      }
      emit({ p, n: t.n, roof: t.roof }, face);
    };

    for (const sh of this.shells) {
      if (sh.behaviour === 'ribbed') {
        const n = Math.max(1, sh.ribs + extra);
        const y0 = sh.rows[0];
        for (const t of sh.skirt) push(t, 0, 'ribbed', sh.face);
        for (let i = 0; i < n; i++) {
          const dy = y0 + i * pitch;
          for (const t of sh.unit) push(t, dy, 'ribbed', sh.face);
        }
        for (const t of sh.cap) push(t, y0 + n * pitch - sh.rows[sh.rows.length - 1], 'ribbed', sh.face);
        continue;
      }

      if (sh.stretchY) {
        /* Chapa lisa grande: estica em Y. Exato — é plana. */
        for (const t of sh.tris) {
          const p = new Float32Array(9);
          for (let k = 0; k < 3; k++) {
            p[k * 3] = t.p[k * 3];
            p[k * 3 + 1] = floorY + (t.p[k * 3 + 1] - floorY) * ky;
            p[k * 3 + 2] = mapZ(t.p[k * 3 + 2], sh.behaviour);
          }
          emit({ p, n: t.n, roof: t.roof }, sh.face);
        }
        continue;
      }

      /* Peça pequena: forma preservada, centro levado à posição proporcional.
         Esticar dobradiça e fecho junto com a porta seria deformá-los.

         EXCETO a peça que mora INTEIRA na faixa do frame inferior: essa é
         ferragem da base, presa ao piso — o piso é o datum imóvel, e levá-la
         à posição proporcional é o que afundava o frame quando o baú
         encolhia (ver LOW_FRAME_TOP; o mesmo corte vale para o conjunto
         não-branco em `pinLowFrame()`, trailer-assembly.ts). */
      const cy = (sh.min.y + sh.max.y) / 2;
      const dy = sh.max.y <= floorY + LOW_FRAME_TOP
        ? 0
        : (floorY + (cy - floorY) * ky) - cy;
      for (const t of sh.tris) push(t, dy, sh.behaviour, sh.face);
    }

    /* AS FAIXAS LISAS DA FOLHA, um QUAD por faixa — a contraparte do `continue`
       em `emit()`. Duas faces de triângulo no plano do VALE da folha
       (crista − 5,2 − 5,1 mm), normal do painel, enrolamento para FORA (o
       corpo é `FrontSide`: enrolamento errado não escurece, SOME). Nenhuma
       estrutura interna: é isso que mata o chuvisco da tinta flake. */
    for (const l of leafTris) {
      const sgn = l.face === 'right' ? -1 : 1;
      for (const { leaf, segs } of doorsFor.get(l.face) ?? []) {
        const x = xCrest[l.face] + sgn * (RIB_RELIEF + LEAF_INSET);
        for (const seg of segs) {
          if (!seg.flat) continue;
          const { z0, z1 } = leaf;
          const quad: [number, number][] = sgn < 0
            ? [[seg.lo, z0], [seg.hi, z1], [seg.lo, z1], [seg.lo, z0], [seg.hi, z0], [seg.hi, z1]]
            : [[seg.lo, z0], [seg.lo, z1], [seg.hi, z1], [seg.lo, z0], [seg.hi, z1], [seg.hi, z0]];
          for (let tI = 0; tI < 2; tI++) {
            const p = new Float32Array(9), n = new Float32Array(9);
            for (let k = 0; k < 3; k++) {
              const [y, z] = quad[tI * 3 + k];
              p[k * 3] = x; p[k * 3 + 1] = y; p[k * 3 + 2] = z;
              n[k * 3] = -sgn; n[k * 3 + 1] = 0; n[k * 3 + 2] = 0;
            }
            l.tris.push({ p, n });
          }
        }
      }
    }

    /* A folha entra DEPOIS da chapa e no MESMO buffer: mesma malha, mesmo
       material, mesmo recorte de painel de livery. Numa malha própria ela
       ficaria de fora de `buildLiveryPanels()` e seria a única parte do baú sem
       a arte do cliente. */
    for (const l of leafTris) for (const t of l.tris) write(t);

    this.rebuildJambs(doorsFor);
    this.rebuildParts(doorsFor);

    const geo = this.mesh.geometry as THREE.BufferGeometry;
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();

    /* O TETO. Um bake sem `teto-externo` branco simplesmente não produz
       triângulo nenhum aqui, e a malha fica invisível em vez de vazia na cena —
       uma malha sem posições dispara aviso de bounding sphere NaN no three. */
    const rGeo = this.roof.geometry as THREE.BufferGeometry;
    rGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3));
    rGeo.setAttribute('normal', new THREE.Float32BufferAttribute(rNrm, 3));
    rGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rUv, 2));
    rGeo.computeBoundingBox();
    rGeo.computeBoundingSphere();
    this.roof.visible = rPos.length > 0;

    for (const m of this.originals) m.visible = false;
  }

  /** Diagnóstico: que peças o kit trouxe do implemento. */
  get kitParts(): string[] { return [...this.kit.keys()].sort(); }

  /**
   * O batente de cada lateral — UMA malha por face, com todas as portas dela.
   *
   * Uma malha por face e não uma por porta: são 16 triângulos por porta, e três
   * portas cadastradas dariam seis nós numa cena que já conta chamada de
   * desenho. Recriada a cada `rebuild()` em vez de reaproveitada porque a
   * contagem de vértices muda com o número de portas e o custo é desprezível
   * perto dos ~73 mil triângulos que o corpo reescreve na mesma passada.
   *
   * A malha entra em `this.group`, que já desfaz a matriz de `root` — a
   * geometria do batente está em espaço de MUNDO, como a do corpo, porque sai
   * dos mesmos retângulos de `doorsOf()`.
   */
  private rebuildJambs(doorsFor: Map<Face, { leaf: DoorRect; hole: DoorRect }[]>) {
    for (const [key, mesh] of this.jambs) {
      mesh.geometry.dispose(); mesh.removeFromParent(); this.jambs.delete(key);
    }
    if (!this.jambMat) return;

    for (const face of ['left', 'right'] as const) {
      const doors = doorsFor.get(face) ?? [];
      if (!doors.length) continue;

      const plane: DoorPlane = {
        xSkin: this.skinX[face], sign: face === 'right' ? 1 : -1,
      };
      /* DUAS superfícies: o marco e a MOLDURA galvanizada em volta do vão.
         (Um anel de `borracha-preta` desenhado à mão já morou aqui e saiu: a
         vedação de verdade é peça EXTRAÍDA — `BORRACHA_V`/`BORRACHA_H`.) */
      const acc: Record<'frame' | 'trim', DoorSurface> = {
        frame: { position: [], normal: [] },
        trim: { position: [], normal: [] },
      };
      for (const { leaf } of doors) {
        const q = doorFrameGeometry(leaf, plane);
        for (const k of ['frame', 'trim'] as const) {
          acc[k].position.push(...q[k].position);
          acc[k].normal.push(...q[k].normal);
        }
      }

      for (const k of ['frame', 'trim'] as const) {
        const s = acc[k];
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(s.position, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(s.normal, 3));
        /* `uv` zerado, e de propósito: os materiais do bake têm mapas que leem
           uv0, e um atributo AUSENTE faz o three amostrar lixo em vez de um
           texel só. Zero é um texel definido — o mesmo argumento que
           `buildLiveryPanels()` usa ao carregar o uv0 de origem junto. */
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(
          new Float32Array((s.position.length / 3) * 2), 2));
        geo.computeBoundingBox();
        geo.computeBoundingSphere();

        const mesh = new THREE.Mesh(geo, this.jambMat[k]);
        mesh.name = `PORTA_${k === 'frame' ? 'MARCO' : 'MOLDURA'}_${face === 'right' ? 'R' : 'L'}`;
        mesh.castShadow = mesh.receiveShadow = true;
        this.group.add(mesh);
        this.jambs.set(`${face}|${k}`, mesh);
      }
    }
  }

  /**
   * As peças de todas as portas, instanciadas.
   *
   * `InstancedMesh` por peça e por LADO, e não uma malha por porta: uma porta
   * leva ~28 rebites, e três portas cadastradas dariam 84 nós numa cena que já
   * conta draw call. Cada peça vira uma chamada, com as matrizes num buffer.
   *
   * As malhas são recriadas quando a CONTAGEM muda e só reescritas quando não
   * muda — `InstancedMesh` tem contagem fixa na alocação, e realocar a cada
   * tecla digitada no formulário de medidas é o que se quer evitar.
   */
  private rebuildParts(doorsFor: Map<Face, { leaf: DoorRect; hole: DoorRect }[]>) {
    const wanted = new Map<string, DoorPlacement[]>();
    for (const face of ['left', 'right'] as const) {
      const doors = doorsFor.get(face) ?? [];
      if (!doors.length) continue;
      const plane: DoorPlane = {
        xSkin: this.skinX[face], sign: face === 'right' ? 1 : -1,
      };
      for (const { leaf } of doors) {
        /* A CHARNEIRA VAI PARA A DIANTEIRA, NOS DOIS LADOS.
           -----------------------------------------------------------------
           `layoutDoor()` monta a porta com a dobradiça em `leaf.z0` (a
           traseira) e o varão em `leaf.z1`, e o cabeçalho dele defende essa
           escolha com os renders de catálogo. O Kennedy corrigiu em
           2026-08-12, com print dos dois flancos: "as dobradiças das portas
           dos dois lados do implemento devem sempre estar para o lado frontal
           do implemento". Quem fabrica decide, e a medida original do `.gltf`
           com hierarquia concorda — o inventário no topo de `trailer-door.ts`
           diz "4 dobradiças, borda DIANTEIRA".

           O conserto é um espelho em Z do CONJUNTO, e tem de ser nos dois
           lugares ao mesmo tempo: as coordenadas do layout (aqui) e a
           geometria de cada peça (`mirrorAxis(geo, 'z')` lá embaixo). Só as
           coordenadas deixaria cada peça do avesso no lugar certo — o punho da
           tala entrando na folha —, que é exatamente o que o cabeçalho de
           `mirrorAxis()` avisa. `anchorGeometry()` centra todas as peças em Z,
           então o espelho da geometria é uma virada no próprio lugar.

           NÃO foi feito dentro de `layoutDoor()` de propósito: aquele arquivo
           é ESPELHADO com `truck-studio-desktop`, e esta cópia não tem como
           sincronizar a outra. */
        const zMid = leaf.z0 + leaf.z1;
        for (const raw of layoutDoor(leaf, plane)) {
          const pl = { ...raw, z: zMid - raw.z };
          /* A instância de TOPO de uma peça de ponta é ESPELHADA na vertical
             (`flipY`), e espelho é geometria — não cabe na matriz de uma
             InstancedMesh sem inverter o enrolamento da chamada inteira. Cada
             orientação vira sua própria malha instanciada. */
          const key = `${pl.part}|${face}|${pl.flipY ? 'v' : '-'}`;
          const list = wanted.get(key);
          if (list) list.push(pl); else wanted.set(key, [pl]);
        }
      }
    }


    /* Some com o que não é mais pedido. */
    for (const [key, mesh] of this.inst) {
      if (!wanted.has(key)) { mesh.geometry.dispose(); mesh.removeFromParent(); this.inst.delete(key); }
    }

    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();   // identidade: nenhuma peça gira
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    for (const [key, list] of wanted) {
      const [part, face, flip] = key.split('|') as [DoorPart, 'left' | 'right', 'v' | '-'];
      const entry = this.kit.get(part);
      if (!entry) continue;

      let mesh = this.inst.get(key);
      if (!mesh || mesh.count !== list.length) {
        if (mesh) { mesh.geometry.dispose(); mesh.removeFromParent(); }
        /* NENHUM espelho em Z aqui, e a ausência é o conserto. Ele já foi
           aplicado, PEÇA A PEÇA, por `extractDoorKit()`: quem sabe se a peça
           precisa dele é quem sabe de qual das duas portas traseiras ela veio, e
           isso só se lê na origem. Um espelho global neste ponto acertava as
           peças de uma porta e virava as da outra — a dobradiça ao contrário com
           o resto do kit certo. `x` continua aqui porque é do LADO do baú, não
           da peça. */
        let geo = face === 'right' ? entry.geo.clone() : mirrorAxis(entry.geo, 'x');
        /* O par do espelho de coordenadas lá em cima — a charneira na
           DIANTEIRA. `extractDoorKit()` entrega o kit com a borda da dobradiça
           apontando para −Z, uma peça de cada vez (é lá que se sabe de qual
           porta traseira ela veio); este espelho é do CONJUNTO e vira as duas
           metades juntas, então ele compõe com aquele em vez de brigar. */
        geo = mirrorAxis(geo, 'z');
        /* O espelho VERTICAL da instância de topo — composto com o de lado
           quando os dois se aplicam; cada `mirrorAxis` reverte o enrolamento
           do seu espelho, então a composição fecha sozinha. */
        if (flip === 'v') geo = mirrorAxis(geo, 'y');
        mesh = new THREE.InstancedMesh(geo, this.partMaterial(entry.mat), list.length);
        mesh.name = `PORTA_${part}_${face === 'right' ? 'R' : 'L'}${flip === 'v' ? '_TOPO' : ''}`;
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.frustumCulled = false;   // a caixa de uma InstancedMesh mal cobre o conjunto
        this.group.add(mesh);
        this.inst.set(key, mesh);
      }
      for (let i = 0; i < list.length; i++) {
        const pl = list[i];
        pos.set(pl.x, pl.y, pl.z);
        /* Só EXTRUSÕES escalam, e só no PRÓPRIO eixo: o varão em Y, os dois
           perfis de borracha em Y (montante) e Z (travessa). Esticar uma
           extrusão no eixo dela é exato. Nenhuma outra peça escala — dobradiça,
           guia e manípulo são produto físico e não crescem com a porta. */
        scl.set(1, pl.sy ?? 1, pl.sz ?? 1);
        mesh.setMatrixAt(i, m4.compose(pos, q, scl));
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }

  /**
   * O material de uma peça da porta: o DO IMPLEMENTO, clonado com sufixo.
   *
   * Clonado e renomeado pelo mesmo motivo que o branco: `applyTrailerFinish()`
   * despacha por NOME (ARCHITECTURE.md §6), e um clone homônimo seria repintado
   * junto com a peça de fábrica. Renomeando, a porta fica com a aparência que o
   * acabamento já deu ao original e não é tocada de novo.
   */
  private partMaterial(src: THREE.Material): THREE.Material {
    const have = this.partMats.get(src);
    if (have) return have;
    const m = src.clone();
    m.name = `${src.name}__porta`;
    this.partMats.set(src, m);
    return m;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.roof.geometry.dispose();
    /* O material é COMPARTILHADO com o teto (ver o construtor), então uma
       liberação só. O que o teto pode ter de próprio é a tinta de acabamento, e
       ela é de `vehicle/trim.ts` — que a reusa entre implementos. */
    (this.mesh.material as THREE.Material).dispose();
    for (const m of this.inst.values()) { m.geometry.dispose(); m.removeFromParent(); }
    this.inst.clear();
    for (const m of this.jambs.values()) { m.geometry.dispose(); m.removeFromParent(); }
    this.jambs.clear();
    if (this.jambMat) for (const m of Object.values(this.jambMat)) m.dispose();
    this.jambMat = null;
    for (const e of this.kit.values()) e.geo.dispose();
    this.kit.clear();
    for (const m of this.partMats.values()) m.dispose();
    this.partMats.clear();
    this.group.removeFromParent();
    for (const m of this.originals) m.visible = true;
  }
}

