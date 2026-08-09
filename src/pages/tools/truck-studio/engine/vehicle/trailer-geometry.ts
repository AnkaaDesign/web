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

/** Material da parte branca, medido no arquivo. */
export const WHITE_RE = /Cor_padrao_branco|metalBranco/i;

/** Tolerância de solda de vértice, em metros. */
const WELD = 1e-4;

/** Um vão em Y maior que isto separa duas fileiras de friso. */
const ROW_GAP = 0.02;

/** Passo nominal do friso — só palpite inicial; o efetivo sai da medição. */
const NOMINAL_PITCH = 0.053;

/** Uma casca só é aceita como chapa frisada com pelo menos isto de fileiras. */
const MIN_RIB_ROWS = 20;

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

interface Tri {
  /** 9 floats: 3 vértices × (x,y,z), em espaço de MUNDO. */
  p: Float32Array;
  /** 9 floats: normais correspondentes, em espaço de mundo. */
  n: Float32Array;
}

interface Shell {
  tris: Tri[];
  min: THREE.Vector3;
  max: THREE.Vector3;
  behaviour: Behaviour;
  /** Só para `ribbed`. */
  rows: number[];
  skirt: Tri[];
  unit: Tri[];
  cap: Tri[];
  ribs: number;
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
  z0: number;
  z1: number;
  width: number;
  base: TrailerDims;
  /** Diagnóstico: quantas cascas saíram e quantas são frisadas. */
  shells: number;
  ribbedShells: number;
}

/* ------------------------------------------------------------------ coleta */

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
      tris.push({ p, n });
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
    out.push({ p, n });
  }
  return out;
}

/* ------------------------------------------------------------ construção */

export class TrailerBody {
  readonly profile: TrailerProfile;
  readonly mesh: THREE.Mesh;
  readonly group = new THREE.Group();

  private shells: Shell[] = [];
  private originals: THREE.Mesh[];
  private dims: TrailerDims;

  constructor(root: THREE.Object3D) {
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

    for (const group of shellsOf(tris)) {
      const b = boundsOf(group);
      const sh: Shell = {
        tris: group, min: b.min, max: b.max,
        behaviour: 'local', rows: [], skirt: [], unit: [], cap: [], ribs: 0,
        stretchY: false,
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
          sh.rows = rows;
          sh.ribs = rows.length - 1;
          const gaps = rows.slice(1).map((y, i) => y - rows[i]);
          pitch = median(gaps) || NOMINAL_PITCH;
          ribCount = sh.ribs; row0 = rows[0]; rowN = rows[rows.length - 1];
          this.sliceRibbed(sh, pitch);
          this.shells.push(sh);
          continue;
        }
      }

      if (spanZ > bodyL * 0.5) sh.behaviour = 'span';
      else if (b.max.z < z0 + CAP_BAND) sh.behaviour = 'rear';
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
      skirtHeight, capHeight, ribCount, z0, z1,
      width: body.max.x - body.min.x,
      base: { width: body.max.x - body.min.x, height: baseHeight, length: bodyL },
      shells: this.shells.length,
      ribbedShells: this.shells.filter((s) => s.behaviour === 'ribbed').length,
    };
    this.dims = { ...this.profile.base };

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

    /* A geometria está em espaço de MUNDO e o grupo pendura em `root`; sem
       desfazer a matriz de `root`, ela seria aplicada duas vezes e o baú
       apareceria flutuando ao lado do chassi. Desfazer pela matriz (em vez de
       pendurar na cena) mantém o corpo como filho do modelo. */
    this.group.matrixAutoUpdate = false;
    this.group.matrix.copy(root.matrixWorld).invert();

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
      for (const c of clipSlab(t, lo, hi)) {
        const p = new Float32Array(c.p);
        for (let k = 0; k < 3; k++) p[k * 3 + 1] = (p[k * 3 + 1] - lo) * sy;
        sh.unit.push({ p, n: c.n });
      }
    }
  }

  get current(): TrailerDims { return { ...this.dims }; }

  snapHeight(h: number): number {
    const { skirtHeight, capHeight, pitch } = this.profile;
    if (!this.profile.ribCount) return h;
    const n = Math.max(1, Math.round((h - skirtHeight - capHeight) / pitch));
    return skirtHeight + n * pitch + capHeight;
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

    /* Mapa de Z por comportamento. `front` fica parado porque é ele que carrega
       o pino-rei: alongar mexendo na dianteira desengataria o conjunto. */
    const mapZ = (z: number, b: Behaviour) => {
      if (b === 'front') return z;
      if (b === 'rear') return z + dzRear;
      return z1 - (z1 - z) * kz;
    };

    const push = (t: Tri, dy: number, b: Behaviour) => {
      for (let k = 0; k < 3; k++) {
        const x = t.p[k * 3];
        const y = t.p[k * 3 + 1] + dy;
        const z = mapZ(t.p[k * 3 + 2], b);
        pos.push(x, y, z);
        nrm.push(t.n[k * 3], t.n[k * 3 + 1], t.n[k * 3 + 2]);
        /* UV de livery: u no comprimento, v na altura, normalizada pelos
           limites CORRENTES — a arte continua casando com a borda após resize. */
        uv.push((z - zBack) / this.dims.length, (y - floorY) / this.dims.height);
      }
    };

    for (const sh of this.shells) {
      if (sh.behaviour === 'ribbed') {
        const n = Math.max(1, sh.ribs + extra);
        const y0 = sh.rows[0];
        for (const t of sh.skirt) push(t, 0, 'ribbed');
        for (let i = 0; i < n; i++) {
          const dy = y0 + i * pitch;
          for (const t of sh.unit) push(t, dy, 'ribbed');
        }
        for (const t of sh.cap) push(t, y0 + n * pitch - sh.rows[sh.rows.length - 1], 'ribbed');
        continue;
      }

      if (sh.stretchY) {
        /* Chapa lisa grande: estica em Y. Exato — é plana. */
        for (const t of sh.tris) {
          for (let k = 0; k < 3; k++) {
            const x = t.p[k * 3];
            const y = floorY + (t.p[k * 3 + 1] - floorY) * ky;
            const z = mapZ(t.p[k * 3 + 2], sh.behaviour);
            pos.push(x, y, z);
            nrm.push(t.n[k * 3], t.n[k * 3 + 1], t.n[k * 3 + 2]);
            uv.push((z - zBack) / this.dims.length, (y - floorY) / this.dims.height);
          }
        }
        continue;
      }

      /* Peça pequena: forma preservada, centro levado à posição proporcional.
         Esticar dobradiça e fecho junto com a porta seria deformá-los. */
      const cy = (sh.min.y + sh.max.y) / 2;
      const dy = (floorY + (cy - floorY) * ky) - cy;
      for (const t of sh.tris) push(t, dy, sh.behaviour);
    }

    const geo = this.mesh.geometry as THREE.BufferGeometry;
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    for (const m of this.originals) m.visible = false;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.group.removeFromParent();
    for (const m of this.originals) m.visible = true;
  }
}
