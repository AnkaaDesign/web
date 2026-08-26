/* OS TRÊS CHASSIS RÍGIDOS, LADO A LADO — 2026-08-20.
   ===========================================================================
   `mountprobe.ts` mediu os DOIS primeiros rígidos e fixou `frameTopY`. Esta é a
   sonda da rodada seguinte, e existe porque a pergunta mudou: não é mais "que
   altura tem a mesa?", é **"por que o mesmo código põe a carroceria certa no
   Volvo e errada no Scania?"** — e, junto, "o Volkswagen dá para ligar?".

   O que ela faz de diferente:

   1. RODA O CÓDIGO DE VERDADE. `measureCabRearWall()` e `solveRigidMount()` são
      importados de `engine/vehicle/mounting.ts`, não recopiados. Uma sonda que
      reimplementa a regra prova a reimplementação.
   2. ABRE O HISTOGRAMA da parede da cabine. A função devolve UM número (a banda
      de maior área); o defeito mora em QUEM ganhou a banda. Então aqui saem as
      15 maiores, cada uma com as malhas que a alimentaram.
   3. NÃO DEPENDE DE NOME DE NÓ. O `vw_titan` não tem nó `chassis` nenhum — cabine
      e quadro estão fundidos em `truck_p4`/`truck_p5`. Toda medida de quadro
      aqui é por FAIXA DE X e por NORMAL, que é o que existe nos três.

   USO
       node tools/trailer-bench/shoot-chassi.mjs [id-do-rigido]
*/
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  findRigid, solveRigidMount, measureCabRearWall, cabGapOf,
  type MountManifest, type RigidMount,
} from '@/pages/tools/truck-studio/engine/vehicle/mounting';
import { isPaintableMaterial } from '@/pages/tools/truck-studio/engine/vehicle/material-setup';
import {
  applyCabBakeFixes, normalizeExteriorGlass,
} from '@/pages/tools/truck-studio/engine/vehicle/cab-bake-fixes';
import {
  swapTruckWheels, tuneVmWheelMaterials,
} from '@/pages/tools/truck-studio/engine/vehicle/truck-wheels';
import { buildChassisParts, trimFlapsForGuard } from '@/pages/tools/truck-studio/engine/vehicle/chassis-parts';
import { attachSideGuard, guardInnerX, truckObstacles, RECUO_DA_PELE, SIDE_GUARD_ASSET } from '@/pages/tools/truck-studio/engine/vehicle/side-guard';

declare global {
  interface Window {
    __ready?: boolean;
    __error?: string;
    __diag?: unknown;
    __shot?: (dir: number[], target: number[] | null, dist: number) => string;
  }
}

const W = 1600, H = 900;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
renderer.setPixelRatio(Math.max(1, Math.min(4, +(new URLSearchParams(location.search).get('ss') || 1))));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2d33);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(6, 9, 5);
scene.add(key, new THREE.AmbientLight(0xffffff, 0.45));
const camera = new THREE.PerspectiveCamera(32, W / H, 0.05, 400);

const f = (n: number) => +n.toFixed(4);

/** Nome do nó e dos ancestrais até a raiz — o rótulo com que se lê um rip. */
function chainName(o: THREE.Object3D, root: THREE.Object3D) {
  const parts: string[] = [];
  for (let k: THREE.Object3D | null = o; k && k !== root; k = k.parent) if (k.name) parts.push(k.name);
  return parts.join('/');
}
const matNames = (m: THREE.Mesh) =>
  (Array.isArray(m.material) ? m.material : [m.material]).map((x) => x?.name || '').join('+');

/** Caixa por VÉRTICE em mundo. `setFromObject()` de nó girado é caixa de caixa. */
function boxOf(root: THREE.Object3D, keep?: (m: THREE.Mesh) => boolean) {
  const b = new THREE.Box3(); const v = new THREE.Vector3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry?.attributes?.position) return;
    if (keep && !keep(m)) return;
    const pos = m.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) b.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
  });
  return b;
}

/** Percorre triângulos em MUNDO. O callback recebe os três vértices e a malha. */
function eachTriangle(
  root: THREE.Object3D,
  cb: (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, m: THREE.Mesh) => void,
  keep?: (m: THREE.Mesh) => boolean,
) {
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible || !m.geometry?.attributes?.position) return;
    if (keep && !keep(m)) return;
    const pos = m.geometry.attributes.position as THREE.BufferAttribute;
    const idx = m.geometry.getIndex();
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i += 3) {
      const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld);
      b.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld);
      c.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
      cb(a, b, c, m);
    }
  });
}

/* --------------------------------------------------------------------------
   O HISTOGRAMA DA PAREDE, ABERTO.

   `measureCabRearWall()` devolve a banda de maior área e nada mais. Aqui a
   mesma conta sai inteira e com procedência: para cada banda de 20 mm, quanto
   de área e QUAIS malhas. É a diferença entre "a parede saiu em z 2,1" e "a
   parede saiu em z 2,1 porque o para-brisa tem face interna". */
function rearWallHistogram(root: THREE.Object3D, yLim: number, porCentroide: boolean, bin = 0.02) {
  const bands = new Map<number, { area: number; by: Map<string, number> }>();
  const u = new THREE.Vector3(), v = new THREE.Vector3(), n = new THREE.Vector3();
  eachTriangle(root, (a, b, c, m) => {
    if (porCentroide) { if ((a.y + b.y + c.y) / 3 < yLim) return; }
    else if (a.y < yLim && b.y < yLim && c.y < yLim) return;
    u.subVectors(b, a); v.subVectors(c, a); n.crossVectors(u, v);
    const len = n.length();
    if (len < 1e-9) return;
    if (n.z / len > -0.7) return;
    const k = Math.round(((a.z + b.z + c.z) / 3) / bin);
    let e = bands.get(k);
    if (!e) { e = { area: 0, by: new Map() }; bands.set(k, e); }
    e.area += len / 2;
    const tag = `${chainName(m, root)}[${matNames(m)}]`;
    e.by.set(tag, (e.by.get(tag) || 0) + len / 2);
  });
  return bands;
}

type Bandas = Map<number, { area: number; by: Map<string, number> }>;

const listar = (bands: Bandas, bin = 0.02, n = 15) =>
  [...bands.entries()].sort((x, y) => y[1].area - x[1].area).slice(0, n)
    .map(([k, e]) => ({
      z: f(k * bin), area_m2: f(e.area),
      quem: [...e.by.entries()].sort((p, q) => q[1] - p[1]).slice(0, 3)
        .map(([t, ar]) => `${t}=${ar.toFixed(2)}`).join(' · '),
    }));

/** A régua de hoje: a banda de maior área, e nada mais. */
const regraArgmax = (bands: Bandas, minArea: number, bin = 0.02) => {
  let melhor = 0, area = 0;
  for (const [k, e] of bands) if (e.area > area) { area = e.area; melhor = k; }
  return area < minArea ? null : melhor * bin;
};

/**
 * A régua CANDIDATA: a parede traseira é a superfície do TAMANHO DE PAREDE mais
 * ATRÁS, e não a maior do caminhão inteiro.
 *
 * Agrupa bandas vizinhas (uma superfície real ocupa várias, porque nem parede
 * de cabine é plano perfeito), soma a área do grupo, e escolhe o grupo mais
 * traseiro que junte `minArea`. Dentro dele, a banda de maior área.
 */
const regraGrupoTraseiro = (bands: Bandas, minArea: number, bin = 0.02, ruido = 0.06, vaoMax = 3) => {
  const ks = [...bands.entries()].filter(([, e]) => e.area >= ruido)
    .map(([k]) => k).sort((a, b) => a - b);
  if (!ks.length) return null;
  const grupos: number[][] = [[ks[0]]];
  for (let i = 1; i < ks.length; i++) {
    if (ks[i] - ks[i - 1] <= vaoMax) grupos[grupos.length - 1].push(ks[i]);
    else grupos.push([ks[i]]);
  }
  for (const g of grupos) {              // já em ordem crescente de z: o 1º é o mais traseiro
    const soma = g.reduce((s, k) => s + (bands.get(k)?.area || 0), 0);
    if (soma < minArea) continue;
    let melhor = g[0], area = 0;
    for (const k of g) { const ar = bands.get(k)!.area; if (ar > area) { area = ar; melhor = k; } }
    return melhor * bin;
  }
  return null;
};

/* A MESA DA LONGARINA, pelas duas réguas que `mounts.json` documenta:
   percentil do máximo por célula, e histograma de ÁREA de face para cima. */
function railTable(root: THREE.Object3D, lo: number, hi: number, zMax: number, zMin: number) {
  const cells = new Map<number, number>();
  const v = new THREE.Vector3();
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible || !m.geometry?.attributes?.position) return;
    if (/wheel|tire|pneu|interior/i.test(chainName(m, root) + matNames(m))) return;
    const pos = m.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      const ax = Math.abs(v.x);
      if (ax < lo || ax > hi || v.z > zMax || v.z < zMin) continue;
      const k = Math.round(v.z / 0.25);
      const cur = cells.get(k);
      if (cur === undefined || v.y > cur) cells.set(k, v.y);
    }
  });
  const vals = [...cells.values()].sort((a, b) => a - b);
  const at = (p: number) => (vals.length ? vals[Math.min(vals.length - 1, Math.floor(vals.length * p))] : NaN);

  const flat = new Map<number, number>();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), nrm = new THREE.Vector3();
  eachTriangle(root, (a, b, c) => {
    const cz = (a.z + b.z + c.z) / 3, cx = Math.abs((a.x + b.x + c.x) / 3);
    if (cz > zMax || cz < zMin || cx < lo || cx > hi) return;
    ab.subVectors(b, a); ac.subVectors(c, a); nrm.crossVectors(ab, ac);
    const area = nrm.length() / 2;
    if (area < 1e-9 || nrm.y / (area * 2) < 0.9) return;
    const k = Math.round(((a.y + b.y + c.y) / 3) * 200) / 200;
    flat.set(k, (flat.get(k) || 0) + area);
  }, (m) => !/wheel|tire|pneu|interior/i.test(chainName(m, root) + matNames(m)));

  return {
    celulas: vals.length,
    p25: f(at(0.25)), p50: f(at(0.5)), p75: f(at(0.75)), p90: f(at(0.9)),
    min: f(vals[0] ?? NaN), max: f(vals[vals.length - 1] ?? NaN),
    por_area: [...flat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([y, ar]) => `${y.toFixed(3)}:${ar.toFixed(2)}m²`).join('  '),
    perfil: [...cells.entries()].sort((a, b) => b[0] - a[0])
      .map(([k, y]) => `${(k * 0.25).toFixed(2)}:${y.toFixed(3)}`).join(' '),
  };
}

/**
 * A MESA POR ÁREA DE FACE, célula a célula — o porte de `medeMesa()` de
 * `tools/studio-bench/checks-mesa-0820.mjs` para cá.
 *
 * O percentil do y não isola a mesa (travessa, tanque e berço de eixo moram na
 * mesma faixa de x). O que a mesa tem e as outras peças não é uma FACE
 * HORIZONTAL GRANDE virada para cima: por célula de 250 mm em z, o histograma
 * de área por banda de 5 mm em y, e a resposta é a banda de maior área.
 */
function mesaPorArea(truck: THREE.Object3D, lo = 0.30, hi = 0.52) {
  const cel = new Map<number, Map<number, number>>();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nn = new THREE.Vector3();
  eachTriangle(truck, (a, b, c) => {
    const ax = Math.abs((a.x + b.x + c.x) / 3);
    if (ax < lo || ax > hi) return;
    nn.copy(e1.subVectors(b, a)).cross(e2.subVectors(c, a));
    const area2 = nn.length();
    if (area2 < 1e-9 || nn.y / area2 < 0.9) return;
    const k = Math.round(((a.z + b.z + c.z) / 3) / 0.25);
    let h = cel.get(k);
    if (!h) { h = new Map(); cel.set(k, h); }
    const yb = Math.round(((a.y + b.y + c.y) / 3) / 0.005);
    h.set(yb, (h.get(yb) || 0) + area2 / 2);
  }, (m) => !/wheel|tire|pneu|interior/i.test(chainName(m, truck) + matNames(m)));

  const cells: { z: number; y: number; a: number }[] = [];
  for (const [k, h] of cel) {
    let my = 0, ma = 0;
    for (const [yb, ar] of h) if (ar > ma) { ma = ar; my = yb * 0.005; }
    if (ma >= 0.02) cells.push({ z: k * 0.25, y: my, a: ma });
  }
  cells.sort((x, y) => x.z - y.z);
  return cells;
}

/** Theil–Sen: a mediana das inclinações par a par. Um mínimos-quadrados é
 *  arrastado pelo raio que bate numa travessa; a mediana não é. */
function theilSen(pts: { z: number; y: number }[], dzMin = 0.5) {
  const d: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dz = pts[j].z - pts[i].z;
      if (Math.abs(dz) < dzMin) continue;
      d.push((pts[j].y - pts[i].y) / dz);
    }
  }
  d.sort((a, b) => a - b);
  return { inc: d.length ? d[d.length >> 1] : 0, pares: d.length };
}

/**
 * O VÃO POR RAIO — a régua que fechou a inclinação em §32.
 *
 * Do fundo da carroceria (POR CÉLULA: com ela inclinada, um plano horizontal
 * deixa de ser paralelo ao fundo e o "vão" que sai é a própria inclinação) para
 * baixo, até a primeira coisa do caminhão. O perfil dessa distância É a cunha.
 */
function vaoPorRaio(truck: THREE.Object3D, body: THREE.Object3D, zA: number, zB: number) {
  const v = new THREE.Vector3();
  const fundo = new Map<number, number>();
  body.updateWorldMatrix(true, true);
  body.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible || !m.geometry?.attributes?.position) return;
    const pos = m.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 3) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (Math.abs(v.x) > 0.6) continue;
      const k = Math.round(v.z / 0.25);
      const e = fundo.get(k);
      if (e === undefined || v.y < e) fundo.set(k, v.y);
    }
  });
  const rc = new THREE.Raycaster();
  const dir = new THREE.Vector3(0, -1, 0);
  const pts: { z: number; y: number; vao: number }[] = [];
  for (let k = Math.ceil((zA + 0.2) / 0.25); k <= Math.floor((zB - 0.2) / 0.25); k++) {
    const z = k * 0.25;
    const f2 = fundo.get(k);
    if (f2 === undefined) continue;
    for (const sx of [0.42, -0.42]) {
      rc.set(new THREE.Vector3(sx, f2 + 0.02, z), dir);
      const hit = rc.intersectObject(truck, true)[0];
      if (!hit) continue;
      const vao = (f2 + 0.02) - hit.point.y;
      if (vao > 0.6) continue;
      pts.push({ z, y: hit.point.y, vao });
      break;
    }
  }
  return pts;
}

async function main() {
  const q = new URLSearchParams(location.search);
  const truckFile = q.get('truck') || 'volvo_vm_2015_6x2r.glb';
  const bodyFile = q.get('body') || 'sobrechassi_frigorifico_gancheiro.glb';

  const draco = new DRACOLoader();
  draco.setDecoderPath('/vendor/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  const man: MountManifest | null = await fetch('/models/vehicles/mounts.json')
    .then((r) => r.json()).catch(() => null);

  const [tg, bg, wg] = await Promise.all([
    loader.loadAsync('/models/trucks/' + truckFile),
    loader.loadAsync('/models/vehicles/' + bodyFile),
    loader.loadAsync('/models/vehicles/wheel_vm_v1.glb').catch(() => null),
  ]);
  const gradeKit = await loader.loadAsync('/models/vehicles/' + SIDE_GUARD_ASSET)
    .then((g) => g.scene).catch(() => null);
  const truck = tg.scene, body = bg.scene;
  scene.add(truck, body);

  /* AS CORREÇÕES DE BAKE, DO ENGINE — importadas, não recopiadas, e aplicadas
     no MESMO ponto do app (logo depois da carga, antes de qualquer medida).
     `?semCorrecao=1` desliga, que é como se fotografa o A/B. */
  const semCorrecao = q.get('semCorrecao') === '1';
  const correcoes = semCorrecao ? ['(desligadas por ?semCorrecao=1)']
    : applyCabBakeFixes(truck, 'models/trucks/' + truckFile);
  const vidros = semCorrecao ? [] : normalizeExteriorGlass(truck);
  /* A RODAGEM, no mesmo ponto do app: antes de qualquer medida de silhueta. */
  let rodas = 0;
  if (!semCorrecao && wg && !/volvo_vm_2015_6x2r/.test(truckFile)) {
    tuneVmWheelMaterials(wg.scene);
    rodas = swapTruckWheels(truck, wg.scene);
  }

  /* ---- NORMALIZAR ----
     O manifesto manda quando existe; senão π, que é a convenção da frota (o
     GLB cru aponta para −Z). O VW ainda não tem entrada e cai no padrão. */
  const declared = findRigid(man, { file: 'models/trucks/' + truckFile });
  const yaw = q.has('yaw') ? +q.get('yaw')! : (declared?.orientYaw ?? Math.PI);
  truck.rotation.y = yaw;
  truck.updateWorldMatrix(true, true);

  const isTyre = (m: THREE.Mesh) => /tire|pneu/i.test(chainName(m, truck) + matNames(m));
  const tyreBox = boxOf(truck, isTyre);
  const groundYRaw = tyreBox.min.y;
  truck.position.y -= groundYRaw;
  truck.updateWorldMatrix(true, true);

  /* AS PEÇAS QUE O RIP NÃO TEM — proteção lateral e barra do para-barro.
     Roda AQUI, e não antes, porque `buildChassisParts()` precisa do
     `RigidMount` (as cotas de eixo saem dele) e porque ele mede a largura do
     caminhão, que a troca de rodagem acabou de mudar. `?pecas=0` desliga, para
     a foto do ANTES. Ver `engine/vehicle/chassis-parts.ts`. */
  const pecas: string[] = [];
  if (declared && q.get('pecas') !== '0') {
    pecas.push(...buildChassisParts(truck, declared));
    truck.updateWorldMatrix(true, true);
    for (const l of pecas) console.info('[chassi-peças]', truckFile, '·', l);
  }

  const all = boxOf(truck);

  /* ---- OS EIXOS, pelos nós de roda ---- */
  const axles: { nome: string; z: number; raio: number }[] = [];
  truck.traverse((o) => {
    if (!/^wheel_[fr]_\d+_\d+_[fr]_tire/.test(o.name || '')) return;
    const b = boxOf(o);
    if (b.isEmpty()) return;
    axles.push({ nome: o.name, z: f((b.min.z + b.max.z) / 2), raio: f((b.max.y - b.min.y) / 2) });
  });
  axles.sort((a, b) => b.z - a.z);

  /* ⚠️ NO VW OS QUATRO RODADOS SÃO UM NÓ SÓ (`wheel_f_0_0_f_tire_p0` cobre
     z −2,14…5,78 no cru), e a caixa do nó devolve o CENTRO DO CAMINHÃO em vez
     de um eixo. Contar por nó é ler a fusão, não a rodagem. Então os eixos saem
     de um HISTOGRAMA de vértice de pneu em z: um eixo é um pico, e o centro
     dele é a média dos vértices do pico. Serve para os três — nos que têm um nó
     por roda, cada pico junta as duas rodas do mesmo eixo, que é o número que
     `mounts.json` guarda. */
  const eixos: { z: number; verts: number }[] = [];
  {
    const hist = new Map<number, { n: number; s: number }>();
    const v = new THREE.Vector3();
    truck.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry?.attributes?.position) return;
      if (!isTyre(m)) return;
      const pos = m.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        const k = Math.round(v.z / 0.05);
        const e = hist.get(k) || { n: 0, s: 0 };
        e.n++; e.s += v.z; hist.set(k, e);
      }
    });
    const ks = [...hist.keys()].sort((a, b) => a - b);
    const pico = Math.max(...[...hist.values()].map((e) => e.n));
    let grupo: number[] = [];
    const fecha = () => {
      if (!grupo.length) return;
      let n = 0, s = 0;
      for (const k of grupo) { const e = hist.get(k)!; n += e.n; s += e.s; }
      if (n > pico * 0.5) eixos.push({ z: f(s / n), verts: n });
      grupo = [];
    };
    for (const k of ks) {
      if (grupo.length && k - grupo[grupo.length - 1] > 2) fecha();
      grupo.push(k);
    }
    fecha();
    eixos.sort((a, b) => b.z - a.z);
  }

  /* ---- O QUADRO ---- */
  const notWheel = (m: THREE.Mesh) => !/wheel|tire|pneu/i.test(chainName(m, truck) + matNames(m));
  const chassisBox = boxOf(truck, notWheel);
  const frameEndZ = chassisBox.min.z;

  /* ---- A CABINE ----
     Por NOME quando o rip tem nós de cabine, e o resultado sai junto com a
     medida por forma para poder discordar em público. */
  const cabRe = /^(cabin|interior|sunshld|parasol|parabrisa|clima|capa|mirror|s_mirror|wiper|banco|steering)/i;
  const cabByName = boxOf(truck, (m) => cabRe.test(chainName(m, truck)));

  /* ---- A PAREDE, pela função DE VERDADE ---- */
  const railLo = 0.25, railHi = 0.55;
  const mesaAll = railTable(truck, railLo, railHi, cabByName.min.z, frameEndZ);
  const frameTopY = declared?.frameTopY ?? mesaAll.p90;

  const mount: RigidMount = declared ?? {
    id: '(sem manifesto) ' + truckFile,
    orientYaw: yaw, groundY: groundYRaw, centerX: 0,
    frameTopY, frameSlope: 0, cabRearZ: cabByName.min.z,
    frameEndZ, cabTopY: cabByName.max.y, axles: { config: '?' },
  };
  const paredeReal = measureCabRearWall(truck, mount);
  /* O mesmo limiar que a função usa, para o histograma abaixo dizer do que ela
     estava olhando: `frameTopY` é acima do SOLO, e o truck já está no solo. */
  const yLim = mount.frameTopY + 0.30;
  const bandasVertice = rearWallHistogram(truck, yLim, false);
  const bandasCentro = rearWallHistogram(truck, yLim, true);
  const reguas = {
    'A_hoje (vértice + argmax)': regraArgmax(bandasVertice, 0.6),
    'B_centroide + argmax': regraArgmax(bandasCentro, 0.6),
    'C_vértice + grupo traseiro': regraGrupoTraseiro(bandasVertice, 0.6),
    'D_centroide + grupo traseiro': regraGrupoTraseiro(bandasCentro, 0.6),
  };

  /* ---- A CARROCERIA ----
     Branco de fábrica, que é o que `bodyPanelPred()` acaba casando nos dois
     bakes; e o datum estrutural, sem a família das mangueiras. */
  const white = (m: THREE.Mesh) => /cor_padrao_branco|metalbranco/i.test(matNames(m));
  const bodyBox = boxOf(body, white);
  const bodyAll = boxOf(body);
  const bodyStruct = boxOf(body, (m) => !/^metal-pouco-polido$/i.test(matNames(m)));

  /* ---- RESOLVER com o código do app ---- */
  const gap = q.has('gap') ? +q.get('gap')! : cabGapOf(man);
  const encosto = paredeReal ?? mount.cabRearZ;
  const sol = solveRigidMount({ ...mount, cabRearZ: encosto }, {
    bottom: bodyStruct.min.y, frontZ: bodyBox.max.z, rearZ: bodyBox.min.z,
    roofY: bodyBox.max.y, centerX: (bodyBox.min.x + bodyBox.max.x) / 2,
  }, gap);

  /* ---- A MESA, MEDIDA AQUI e não lida do manifesto ----
     Primeiro a carroceria NIVELADA na cota candidata: é essa pose que deixa o
     vão contar a inclinação do QUADRO, e não a que já foi aplicada. */
  const mesaArea = mesaPorArea(truck);
  const nivelDeTeste = mesaArea.length
    ? [...mesaArea].map((c) => c.y).sort((a, b) => a - b)[mesaArea.length >> 1]
    : mount.frameTopY;
  body.rotation.set(0, 0, 0);
  body.position.set(
    mount.centerX - (bodyBox.min.x + bodyBox.max.x) / 2,
    nivelDeTeste - bodyStruct.min.y,
    (encosto - gap) - bodyBox.max.z,
  );
  body.updateWorldMatrix(true, true);
  const nivelado = boxOf(body, white);
  const raios = vaoPorRaio(truck, body, nivelado.min.z, nivelado.max.z);
  const ts = theilSen(raios.map((p) => ({ z: p.z, y: p.y })));
  const vaos = raios.map((p) => p.vao);

  body.position.set(sol.body.x, sol.body.y, sol.body.z);
  body.rotation.set(sol.body.pitchX, 0, 0);
  body.updateWorldMatrix(true, true);

  /* A PROTEÇÃO LATERAL, com o código do app — e presa ao IMPLEMENTO, que é o
     ponto: ela herda o `pitchX` que a linha acima acabou de aplicar. As cotas
     saem do baú NA POSE DE IDENTIDADE, porque é esse o referencial da raiz que
     `attachSideGuard()` espera. */
  const linhasGrade: string[] = [];
  if (q.get('grade') !== '0') {
    const pos0 = body.position.clone(), rot0 = body.rotation.clone();
    body.position.set(0, 0, 0); body.rotation.set(0, 0, 0);
    body.updateWorldMatrix(true, true);
    const localBranco = boxOf(body, white);
    body.position.copy(pos0); body.rotation.copy(rot0);
    body.updateWorldMatrix(true, true);
    const matsBau = new Map<string, THREE.Material>();
    body.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      for (const mm of (Array.isArray(m.material) ? m.material : [m.material])) {
        if (mm?.name && !matsBau.has(mm.name)) matsBau.set(mm.name, mm);
      }
    });
    const eixos = [...mount.axles.steerZ, ...mount.axles.driveZ, ...mount.axles.liftZ];
    const xGuarda = localBranco.max.x - RECUO_DA_PELE;
    const Nq = new THREE.Matrix4().makeRotationY(mount.orientYaw)
      .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0));
    const obstaculos = truckObstacles(truck, (z) => z - sol.body.z, Nq, xGuarda, 0);
    linhasGrade.push(...attachSideGuard(body, gradeKit, {
      yGround: -sol.body.y, skinX: localBranco.max.x,
      z0: localBranco.min.z, z1: localBranco.max.z, obstaculos,
      rodasZ: eixos.map((z) => z - sol.body.z), materiais: matsBau,
    }));
    body.updateWorldMatrix(true, true);
    /* A MESMA segunda passada que `placeTrailer()` faz: a aba do para-barro só
       pode ser estreitada depois que a grade existe, porque é dela que sai a
       face interna. Sem isto o bench fotografaria um caminhão diferente do que
       o app monta — e uma foto que não é do que roda não prova nada. */
    linhasGrade.push(...trimFlapsForGuard(truck, declared,
      guardInnerX(gradeKit, localBranco.max.x)));
    for (const l of linhasGrade) console.info('[grade]', truckFile, '·', l);
  }
  const posto = boxOf(body, white);
  const raiosFinal = vaoPorRaio(truck, body, posto.min.z, posto.max.z);

  /* ---- O VÃO, célula a célula ----
     A carroceria inclinada não tem fundo plano: medir o vão de um plano seria
     medir a própria inclinação. Por célula de 250 mm, o menor y do fundo do baú
     contra o maior y do caminhão na mesma célula e na faixa da longarina. */
  const fundo = new Map<number, number>();
  {
    const v = new THREE.Vector3();
    body.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible || !m.geometry?.attributes?.position) return;
      if (/^metal-pouco-polido$/i.test(matNames(m))) return;
      const pos = m.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        if (Math.abs(v.x) < 0.25 || Math.abs(v.x) > 0.55) continue;
        const k = Math.round(v.z / 0.25);
        const cur = fundo.get(k);
        if (cur === undefined || v.y < cur) fundo.set(k, v.y);
      }
    });
  }
  const topo = new Map<number, number>();
  {
    const v = new THREE.Vector3();
    truck.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible || !m.geometry?.attributes?.position) return;
      if (!notWheel(m)) return;
      const pos = m.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        if (Math.abs(v.x) < 0.25 || Math.abs(v.x) > 0.55) continue;
        if (v.y > mount.frameTopY + 0.25) continue;   // só o quadro, não a cabine
        const k = Math.round(v.z / 0.25);
        const cur = topo.get(k);
        if (cur === undefined || v.y > cur) topo.set(k, v.y);
      }
    });
  }
  const vao: string[] = [];
  for (const [k, yb] of [...fundo.entries()].sort((a, b) => b[0] - a[0])) {
    const yt = topo.get(k);
    if (yt === undefined) continue;
    vao.push(`${(k * 0.25).toFixed(2)}:${((yb - yt) * 1000).toFixed(0)}`);
  }

  /* ---- QUEM RECEBE A TINTA ----
     A pergunta do dono é "a cor vai ser aplicada?", e ela não se responde
     lendo o `.glb`: quem decide é `isPaintableMaterial()`, com a lista
     `paintMaterials` do chassi quando ela existe. Então a sonda faz a MESMA
     pergunta com a MESMA função, e chapa MAGENTA em quem responder que sim —
     branco sobre branco não prova cobertura, magenta prova.

     `?pinta=` vazio = detecção automática (o que o app faz hoje sem lista);
     `?pinta=a,b` = a lista candidata, que é o que se quer aprovar antes de
     escrevê-la no brands.json. */
  const pintaParam = q.get('pinta');
  const authored = pintaParam === null ? null
    : pintaParam.split(',').map((s) => s.trim()).filter(Boolean);
  const pintados = new Map<string, number>();
  const recusados = new Map<string, number>();
  {
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nn = new THREE.Vector3();
    /* Área por material, para a cobertura ser um NÚMERO e não uma impressão. */
    eachTriangle(truck, (p0, p1, p2, m) => {
      a.copy(p0); b.copy(p1); c.copy(p2);
      nn.copy(e1.subVectors(b, a)).cross(e2.subVectors(c, a));
      const ar = nn.length() / 2;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (!mat) continue;
        const alvo = isPaintableMaterial(mat, authored) ? pintados : recusados;
        alvo.set(mat.name || '(sem nome)', (alvo.get(mat.name || '(sem nome)') || 0) + ar);
      }
    });
    /* Só chapa quando `?pinta` foi PEDIDO. Chapar sempre tinge o caminhão
       inteiro de magenta e estraga qualquer outra foto de detalhe — foi o que
       apareceu na primeira rodada com `?destaca`. */
    if (pintaParam !== null) truck.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (mat && isPaintableMaterial(mat, authored)) {
          (mat as THREE.MeshStandardMaterial).color?.setHex(0xff00cc);
          (mat as THREE.MeshStandardMaterial).map = null;
          mat.needsUpdate = true;
        }
      }
    });
  }
  const areaPintada = [...pintados.values()].reduce((s, x) => s + x, 0);
  const areaTotal = areaPintada + [...recusados.values()].reduce((s, x) => s + x, 0);

  /* ---- ⚠️ QUEM DO CAMINHÃO ENTRA NA CARROCERIA, E POR QUANTO ----
     *"o implemento está muito baixo, entrando dentro do chassi"* — Kennedy.

     A medida do VÃO (acima) responde "a carroceria assenta na mesa?" e responde
     que SIM, com 7…16 mm. Ela olha só para a FAIXA DA LONGARINA, |x| 0,25…0,55,
     porque é ali que o sub-chassi encosta. Mas a carroceria não é uma tábua:
     ela tem saia até |x| 1,31 e uma travessa traseira, e o que entra nela não
     está na faixa da longarina — é o para-lama do tandem, a barra de lanterna,
     o montante do para-choque traseiro.

     Então aqui o fundo do baú é um CAMPO DE ALTURA em (x, z), célula de 100 mm,
     e a pergunta é feita por triângulo do caminhão: quanto ele PASSA do fundo
     na célula dele. Sai por peça, com a área e o excesso máximo — que é o
     número com que se decide se a peça sai da cena ou se a régua está errada. */
  const invasores = new Map<string, { area: number; max: number; x: number; z: number; contra: string }>();
  {
    /* ⚠️ CÉLULA DE 50 mm, e não 100. Com 100 mm uma peça 46 mm ao LADO da
       longarina auxiliar cai na mesma coluna que ela e vira "interferência" —
       foi assim que o VW pediu 80 mm de subida por causa de algo que passa de
       raspão pelo lado. */
    const cel = 0.05;
    const chave = (x: number, z: number) => `${Math.round(x / cel)}|${Math.round(z / cel)}`;
    /* ⚠️ O FUNDO É O SUB-CHASSI, e não "a malha mais baixa da coluna".
       -------------------------------------------------------------------
       A carroceria pendura suporte, mangueira e travessa curta por baixo do
       piso, e nenhum deles é o que ela APOIA no quadro. Medindo contra eles, o
       VW pediu 80 mm de subida por causa de um suporte de 100 cm² tocando
       outro suporte — e 80 mm de subida abrem um rasgo de luz de ponta a ponta,
       que foi o relato *"tem um espaço entre o implemento e o truck vw"*.

       Quem apoia é o membro que ATRAVESSA a carroceria, que é a mesma
       definição de `measureMountDatum()` em `vehicle/mounting.ts`: as duas
       longarinas auxiliares têm 8,45 m de vão em z contra 8,63 m de baú, e as
       mangueiras 0,33 m — o corte em metade do comprimento cai num vazio de
       8,1 m. */
    const fundoXZ = new Map<string, number>();
    /** Quem FORMA o piso em cada célula. Sem isto, "passa 80 mm" não diz se o
     *  que está embaixo é a longarina auxiliar ou uma mangueira. */
    const quemFundo = new Map<string, string>();
    {
      const v = new THREE.Vector3();
      body.updateWorldMatrix(true, true);
      const meioBau = (posto.max.z - posto.min.z) / 2;
      body.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.visible || !m.geometry?.attributes?.position) return;
        /* As mangueiras penduram 800 mm abaixo do sub-chassi e não são fundo de
           carroceria — a mesma exclusão de `measureMountDatum()`. */
        if (/^metal-pouco-polido$/i.test(matNames(m))) return;
        /* E só quem ATRAVESSA a carroceria — ver o bloco acima. */
        const bb = boxOf(m);
        if (bb.isEmpty() || bb.max.z - bb.min.z < meioBau) return;
        const pos = m.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
          const k = chave(v.x, v.z);
          const cur = fundoXZ.get(k);
          if (cur === undefined || v.y < cur) {
            fundoXZ.set(k, v.y);
            quemFundo.set(k, `${o.name || '?'}[${matNames(m)}]`);
          }
        }
      });
    }
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nn = new THREE.Vector3();
    eachTriangle(truck, (a, b, c, m) => {
      const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3, cz = (a.z + b.z + c.z) / 3;
      /* ⚠️ A CÉLULA DA TESTEIRA É ARTEFATO. A parede dianteira do baú e a
         traseira da cabine caem na MESMA célula de 100 mm, e ali o "excesso" é
         a altura da cabine sobre o piso do baú — 804 mm no VM, que não é
         interferência nenhuma. Meio metro de folga tira a coluna inteira. */
      if (cz > posto.max.z - 0.5) return;
      const piso = fundoXZ.get(chave(cx, cz));
      if (piso === undefined) return;
      const excesso = cy - piso;
      if (excesso <= 0.002) return;             // 2 mm de tolerância de malha
      nn.copy(e1.subVectors(b, a)).cross(e2.subVectors(c, a));
      const tag = `${chainName(m, truck)}[${matNames(m)}]`;
      const e = invasores.get(tag) || { area: 0, max: 0, x: 0, z: 0, contra: '' };
      e.area += nn.length() / 2;
      if (excesso > e.max) {
        e.max = excesso; e.x = cx; e.z = cz;
        e.contra = quemFundo.get(chave(cx, cz)) || '?';
      }
      invasores.set(tag, e);
    }, (m) => !isTyre(m));
  }

  /* ---- ⚠️ E O QUE FICA ATRÁS DO BAÚ CRUZA A SAIA DELE? ----
     Numa vista de trás, "atrás do baú" é NA FRENTE da câmera: qualquer peça do
     caminhão que passe da linha da saia aparece por cima da travessa traseira e
     da plaqueta. Não é interferência de sólido — é oclusão —, mas é o mesmo
     número que a conserta: quanto o topo do rabo passa do fundo da saia.

     A faixa é a LARGURA DO BAÚ: o que está fora dela passa pelo lado e não
     encobre nada. */
  const atras = new Map<string, { max: number; z: number }>();
  {
    const meiaLarg = (posto.max.x - posto.min.x) / 2;
    const saia = posto.min.y;
    const v = new THREE.Vector3();
    truck.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible || !m.geometry?.attributes?.position) return;
      if (isTyre(m)) return;
      const pos = m.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        if (v.z > posto.min.z) continue;             // não está atrás
        if (Math.abs(v.x) > meiaLarg) continue;      // passa pelo lado
        const excesso = v.y - saia;
        if (excesso <= 0.002) continue;
        const tag = `${chainName(m, truck)}[${matNames(m)}]`;
        const e = atras.get(tag) || { max: 0, z: 0 };
        if (excesso > e.max) { e.max = excesso; e.z = v.z; }
        atras.set(tag, e);
      }
    });
  }

  /* ---- A CABINE ENTRA NA CARROCERIA? ----
     A folga de 250 mm é medida contra a PAREDE, e a parede não é o ponto mais
     atrás da cabine: a chaminé do VM passa 167 mm dela. Enquanto o que passa
     for ESTREITO, não há encontro nenhum — o baú tem 2,6 m de largura e a
     chaminé mora na quina. O que decide não é a distância, é a INTERSEÇÃO.

     Então a sonda pergunta direto: que malha do caminhão tem centróide DENTRO
     da caixa da carroceria montada? A resposta sai por peça e com área, porque
     "2 cm² de espelho retrovisor" e "0,4 m² de traseira de cabine" são dois
     resultados diferentes com o mesmo sinal. */
  const dentro = new Map<string, number>();
  {
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nn = new THREE.Vector3();
    const folgaX = (posto.max.x - posto.min.x) / 2;
    eachTriangle(truck, (a, b, c, m) => {
      const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3, cz = (a.z + b.z + c.z) / 3;
      if (Math.abs(cx) > folgaX) return;
      if (cy < posto.min.y || cy > posto.max.y) return;
      if (cz < posto.min.z || cz > posto.max.z) return;
      nn.copy(e1.subVectors(b, a)).cross(e2.subVectors(c, a));
      const tag = `${chainName(m, truck)}[${matNames(m)}]`;
      dentro.set(tag, (dentro.get(tag) || 0) + nn.length() / 2);
    }, (m) => !isTyre(m));
  }

  /* ---- IDENTIFICAR PEÇA POR FOTO ----
     "o para-lama está muito alto", "o limpador está no meio do para-brisa",
     "que parte vermelha é essa na placa" — três queixas sobre PEÇAS, e num rip
     de 114 materiais o nome não diz qual é qual. `?destaca=<regex>` chapa
     magenta em quem casar (nome de nó OU de material) e devolve a caixa de cada
     um: a foto diz se é a peça certa e a caixa diz de quanto ela erra.

     É a mesma técnica do disparo `sonda-cores` da bancada da porta, e existe
     pela mesma razão: cor chapada separa "a peça não é essa" de "a peça é essa
     e está no lugar errado", que nenhuma medida sozinha separa. */
  /* `?tingeTruck=1` chapa o CAMINHÃO INTEIRO de magenta e deixa a carroceria
     como está. É a foto que separa "o que corta a plaqueta é peça do caminhão"
     de "é peça do próprio implemento" — pergunta que nenhuma medida responde
     tão rápido quanto uma cor chapada. */
  if (q.get('tingeTruck') === '1') {
    const vistos = new Set<THREE.Material>();
    truck.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.material) return;
      for (const mat of (Array.isArray(m.material) ? m.material : [m.material])) {
        if (!mat || vistos.has(mat)) continue;
        vistos.add(mat);
        const st = mat as THREE.MeshStandardMaterial;
        st.color?.setHex(0xff00cc); st.map = null; st.metalness = 0; st.roughness = 0.6;
        st.transparent = false; st.opacity = 1;
        mat.needsUpdate = true;
      }
    });
  }

  const destaques: string[] = [];
  const alvoRe = q.get('destaca') ? new RegExp(q.get('destaca')!, 'i') : null;
  if (alvoRe) {
    truck.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry?.attributes?.position) return;
      const rotulo = chainName(m, truck) + '[' + matNames(m) + ']';
      if (!alvoRe.test(rotulo)) return;
      const b = boxOf(m);
      destaques.push(`${rotulo} x[${f(b.min.x)},${f(b.max.x)}]`
        + ` y[${f(b.min.y)},${f(b.max.y)}] z[${f(b.min.z)},${f(b.max.z)}]`);
      for (const mat of (Array.isArray(m.material) ? m.material : [m.material])) {
        if (!mat) continue;
        const s = mat as THREE.MeshStandardMaterial;
        s.color?.setHex(0xff00cc); s.map = null; s.emissive?.setHex(0x330022);
        s.metalness = 0; s.roughness = 0.5;
        mat.needsUpdate = true;
      }
    });
  }

  window.__diag = {
    arquivo: truckFile,
    CORRECOES_DE_BAKE: correcoes,
    VIDRO_NA_REGUA: vidros,
    RODAS_TROCADAS: rodas,
    DESTAQUES: destaques,
    TINTA: {
      lista: authored ? authored.join(',') : '(detecção automática)',
      materiais: pintados.size,
      area_m2: f(areaPintada),
      fracao_da_malha: f(areaTotal > 0 ? areaPintada / areaTotal : 0),
      quem: [...pintados.entries()].sort((a, b) => b[1] - a[1])
        .map(([n, ar]) => `${n}=${ar.toFixed(2)}m²`),
      maiores_recusados: [...recusados.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
        .map(([n, ar]) => `${n}=${ar.toFixed(2)}m²`),
    },
    manifesto: declared ? declared.id : '(SEM ENTRADA EM mounts.json)',
    normalizacao: { yaw: f(yaw), chao_cru_y: f(groundYRaw), raio_pneu: axles[0]?.raio ?? null },
    caixa_total: { x: [f(all.min.x), f(all.max.x)], y: [f(all.min.y), f(all.max.y)], z: [f(all.min.z), f(all.max.z)] },
    eixos_por_no: axles.map((a) => `${a.nome} z=${a.z}`),
    EIXOS: eixos.map((e) => `z=${e.z} (${e.verts} vért.)`),
    cabine: {
      por_nome_z: [f(cabByName.min.z), f(cabByName.max.z)],
      /* Nó a nó, para escolher `cabRearZ` sem herdar uma malha solta: no VW o
         `interior_anim_p1` (116 vértices de painel) chega 550 mm atrás da
         cabine e puxaria a caixa inteira com ele. */
      nos_da_cabine: (() => {
        const r: string[] = [];
        truck.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh || !m.geometry?.attributes?.position) return;
          if (!cabRe.test(chainName(m, truck))) return;
          const b = boxOf(m);
          r.push(`${chainName(m, truck)} z[${f(b.min.z)},${f(b.max.z)}] y[${f(b.min.y)},${f(b.max.y)}]`);
        });
        return r.sort();
      })(),
      topo_y: f(cabByName.max.y),
      manifesto_cabRearZ: declared?.cabRearZ ?? null,
      PAREDE_MEDIDA: paredeReal === null ? null : f(paredeReal),
      limiar_y: f(yLim),
      REGUAS: reguas,
      histograma_vertice: listar(bandasVertice),
      histograma_centroide: listar(bandasCentro),
      bandas_por_z: [...bandasCentro.entries()].sort((a, b) => a[0] - b[0])
        .filter(([, e]) => e.area >= 0.03)
        .map(([k, e]) => `${(k * 0.02).toFixed(2)}:${e.area.toFixed(2)}`).join(' '),
    },
    quadro: {
      fim_z: f(frameEndZ),
      manifesto_frameEndZ: declared?.frameEndZ ?? null,
      manifesto_frameTopY: declared?.frameTopY ?? null,
      manifesto_frameSlope: declared?.frameSlope ?? null,
      mesa_percentil: mesaAll,
      MESA_POR_AREA: {
        celulas: mesaArea.length,
        mediana: f(nivelDeTeste),
        theil_sen_mm_por_m: f(theilSen(mesaArea).inc * 1000),
        perfil: mesaArea.map((c) => `${c.z.toFixed(2)}:${c.y.toFixed(3)}`).join(' '),
      },
      MESA_POR_VAO: {
        raios: raios.length,
        nivel_de_teste: f(nivelDeTeste),
        vao_mm: raios.length
          ? `${(Math.min(...vaos) * 1000).toFixed(0)}…${(Math.max(...vaos) * 1000).toFixed(0)}`
          : '—',
        /* `frameSlope` do manifesto está no espaço NORMALIZADO e é NEGATIVA (a
           mesa cai para a frente). É exatamente esta inclinação. */
        frameSlope_medido: f(ts.inc),
        pares: ts.pares,
        perfil: raios.map((p) => `${p.z.toFixed(2)}:${(p.vao * 1000).toFixed(0)}`).join(' '),
      },
    },
    carroceria: {
      arquivo: bodyFile,
      branco_z: [f(bodyBox.min.z), f(bodyBox.max.z)],
      branco_y: [f(bodyBox.min.y), f(bodyBox.max.y)],
      estrutural_min_y: f(bodyStruct.min.y),
      tudo_min_y: f(bodyAll.min.y),
      comprimento: f(bodyBox.max.z - bodyBox.min.z),
    },
    montado: {
      folga_usada: gap,
      encosto_usado: f(encosto),
      pitch_graus: f((sol.body.pitchX * 180) / Math.PI),
      z_baú: [f(posto.min.z), f(posto.max.z)],
      piso_y: f(posto.min.y),
      teto_y: f(sol.roofY),
      teto_acima_da_cabine: f(sol.roofY - cabByName.max.y),
      balanco_traseiro_mm: f(sol.rearOverhang * 1000),
      TESTEIRA_DENTRO_DA_CABINE_mm: f((cabByName.min.z - posto.max.z) * 1000),
      SUBIR_area_min_m2: 0.002,
      ATRAS_DO_BAU: [...atras.entries()].sort((a, b) => b[1].max - a[1].max).slice(0, 10)
        .map(([n, e]) => `${n} passa ${(e.max * 1000).toFixed(0)} mm da saia em z ${f(e.z)}`),
      /* ⚠️ COM PISO DE ÁREA. Um triângulo solto — o `interior_anim_p1` do VW são
         116 vértices de painel que se esticam 550 mm para trás da cabine — dá
         "465 mm de interferência" sobre 0,000 m². Subir a carroceria meio metro
         por causa dele seria deixar o defeito escolher a régua. */
      SUBIR_mm: f(Math.max(
        0,
        ...[...invasores.values()].filter((e) => e.area >= 0.002).map((e) => e.max),
        ...[...atras.values()].map((e) => e.max),
      ) * 1000),
      INVASORES: [...invasores.entries()].sort((a, b) => b[1].max - a[1].max).slice(0, 14)
        .map(([n, e]) => `${n} passa ${(e.max * 1000).toFixed(0)} mm em x ${f(e.x)} z ${f(e.z)}`
          + ` CONTRA ${e.contra} · ${e.area.toFixed(3)} m²`),
      INTERSECAO_area_m2: f([...dentro.values()].reduce((s, x) => s + x, 0)),
      intersecao_quem: [...dentro.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([n, ar]) => `${n}=${ar.toFixed(3)}m²`),
      vao_por_celula_mm: vao.join(' '),
      VAO_FINAL_mm: raiosFinal.length
        ? `${(Math.min(...raiosFinal.map((p) => p.vao)) * 1000).toFixed(0)}…${(Math.max(...raiosFinal.map((p) => p.vao)) * 1000).toFixed(0)}`
        : '—',
      vao_final_perfil: raiosFinal.map((p) => `${p.z.toFixed(2)}:${(p.vao * 1000).toFixed(0)}`).join(' '),
    },
  };

  const whole = new THREE.Box3().union(boxOf(truck)).union(posto);
  const centre = whole.getCenter(new THREE.Vector3());
  const radius = whole.getSize(new THREE.Vector3()).length() / 2;
  window.__shot = (dir, target, dist) => {
    const t = target && target.length ? new THREE.Vector3(...target) : centre;
    const d = new THREE.Vector3(...dir).normalize();
    camera.position.copy(t).addScaledVector(d, dist || radius * 1.7);
    camera.lookAt(t);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  };
  window.__ready = true;
}

main().catch((e) => {
  window.__error = (e as Error)?.stack || String(e);
  window.__ready = true;
});
