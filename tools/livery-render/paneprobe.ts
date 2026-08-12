/* Bancada de RENDER POR PEÇA do painel — a arte do editor sai do implemento.
   ---------------------------------------------------------------------------
   O QUE MUDOU DA VERSÃO ANTERIOR, e por quê

   A primeira bancada recortava por REGIÃO — "tudo que estiver na faixa de
   cima", "tudo que estiver no canto" — e produzia GRUPOS: cantoneira, fita,
   parafuso e borracha achatados numa imagem só. Um grupo não tem como obedecer
   duas regras ao mesmo tempo, e o painel precisa disso: a cantoneira estica, a
   fita NÃO, o rebite repete noutro passo. Alongar o baú esticava tudo junto, e
   era esse o desenho quebrado.

   Agora cada peça é isolada por MATERIAL e por JANELA, uma por vez, a partir da
   tabela medida em `parts.ts`. Duas peças que dividem a mesma faixa de altura —
   o trilho e os rebites sobre ele — saem em arquivos diferentes, com passos
   diferentes, e o compositor as empilha.

   ---------------------------------------------------------------------------
   O REFERENCIAL É A PELE BRANCA DE CADA FACE

   Medido aqui, por face, e não herdado do perfil do baú:

     lateral   2 620,0 mm  (y 1,3919 … 4,0119)
     traseira  2 460,4 mm  (y 1,5917 … 4,0521)
     testeira  2 720,0 mm  (y 1,4119 … 4,1319)

   A versão anterior usava piso→teto (2 777 mm) nas quatro, e errava em todas.
   É a pele branca porque é ela que `buildLiveryPanels()` recorta e
   `addLiveryUV()` normaliza: `uv1 = 0` é o topo do BRANCO. Qualquer outro datum
   põe cada peça fora de registro pela diferença — 157 mm na lateral.

   ---------------------------------------------------------------------------
   COMO UMA PEÇA É ISOLADA

     1. CÂMERA ORTOGRÁFICA na janela exata, em px/m CONHECIDO — nunca
        "preencher o quadro", que garante escalas diferentes entre peças;
     2. SLAB de profundidade (near/far): o que está atrás da pele sai do
        frustum, em vez de sair por lista de nomes;
     3. FILTRO POR MATERIAL: um material por peça. Peça que precisaria de dois
        materiais é duas peças — foi a regra que faltava.

   A chapa branca é escondida SEMPRE: ela é o fundo que o editor pinta por CSS
   (`--ts-implement`), e desenhá-la aqui a pintaria duas vezes. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SIDE_PARTS, REAR_PARTS, FRONT_PARTS, type PartSpec } from './parts';

declare global {
  interface Window {
    __ready?: boolean;
    __error?: string;
    __plan?: () => unknown;
    __shoot?: (id: string) => { png: string; wPx: number; hPx: number };
  }
}

const SSAA = 2;
const TARGET_PX_PER_M = 1600;
const MAX_SIDE_PX = 4096;

/* Teto do BUFFER, não da imagem final: o supersampling multiplica cada lado
   antes de o pedido chegar ao renderer. Medido neste SwiftShader — anuncia
   8 192 de lado mas aloca até ~36 Mpx e falha em 60 Mpx, e a falha ENVENENA o
   contexto seguinte, derrubando todas as peças posteriores. */
const MAX_BUFFER_SIDE = 8192;
const MAX_BUFFER_PX = 32e6;

const WHITE_RE = /Cor_padrao_branco|metalBranco/i;
/** Nunca entram numa peça: a chapa é o fundo, o pneu não é painel. Por
 *  MATERIAL e nunca pelo nome do nó — o stitch do bake põe "metalBranco" no
 *  NOME de nós cujo primitivo é galvanizado, e filtrar por nome apagava a
 *  cantoneira inteira. `lona-fria` é o FORRO FRIGORÍFICO interno: ele forra a
 *  cara de dentro das folhas a ~30 mm da pele e entrava nas faixas da traseira
 *  como um chapadão preto sobre a área de arte. */
const GLOBAL_HIDE = /Cor_padrao_branco|metalBranco|pneu|tire|aro-rodas|lona-fria/i;

/** A chapa branca durante o disparo: só profundidade — transparente no pixel,
 *  opaca para o teste de oclusão. `DoubleSide` porque a folha é casca fina e o
 *  enrolamento do bake não é confiável dos dois lados. */
const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });

const renderer = new THREE.WebGLRenderer({
  antialias: true, alpha: true, preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.setClearAlpha(0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = null;
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

/* Luz frontal e quase chapada: uma peça ortográfica vista de frente sob luz
   direcional viraria um gradiente sem assunto. Ambiente uniforme dá o volume do
   perfil galvanizado sem inventar direção. */
const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
scene.add(keyLight, new THREE.AmbientLight(0xffffff, 0.9));

type FaceKey = 'left' | 'right' | 'rear' | 'front';

/** O retângulo branco de uma face — o referencial do painel dela. */
interface Frame {
  face: FaceKey;
  /** Extensão vertical do branco, em mundo. */
  y0: number; y1: number;
  /** Extensão do branco no eixo que o painel corre (z nas laterais, x nas outras). */
  u0: number; u1: number;
  /** Plano da pele no eixo de vista, e o sentido de "para fora". */
  face0: number; sgn: number;
}

interface Shot {
  id: string; face: FaceKey; file: string;
  u0: number; u1: number; v0: number; v1: number;
  d0: number; d1: number;
  only: RegExp;
  rect: { x: number; y: number; w: number | null; h: number | null };
  anchorX?: 'start' | 'end' | 'stretch'; anchorY?: 'roof' | 'floor' | 'stretch';
  tile?: number; span?: number; phase?: number;
  nota: string;
}

const matsOf = (m: THREE.Mesh): THREE.Material[] =>
  Array.isArray(m.material) ? m.material : [m.material];

/** Caixa em MUNDO pelo atributo — `setFromObject` superestima. */
function worldBox(mesh: THREE.Mesh): THREE.Box3 | null {
  const pos = mesh.geometry?.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!pos?.count) return null;
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  mesh.updateWorldMatrix(true, false);
  for (let i = 0; i < pos.count; i++) {
    b.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  }
  return b.isEmpty() ? null : b;
}

let frames: Record<FaceKey, Frame>;
let shots: Shot[] = [];
const notas: string[] = [];

/**
 * O retângulo de cada face — e ele é a CHAPA RECORTADA, não a "pele branca".
 *
 * A versão anterior media a caixa das malhas brancas finas ("a pele"), e o
 * topo dela dava 4,0464. Mas quem define o datum da arte é `addLiveryUV()`,
 * que normaliza sobre a caixa do PAINEL que `buildLiveryPanels()` recorta — e
 * o recorte leva TODO triângulo branco dentro do slab de 40 mm, inclusive a
 * parede que continua subindo por trás da cantoneira até o teto (4,1688).
 * São 122 mm de diferença: cada peça presa ao teto saía 122 mm acima do baú.
 * O layout antigo (designHeight 2,777, cantoneira y 0,2075 = o
 * CANTONEIRA_DROP medido de livery-layers.ts) sempre usou o datum do painel —
 * a régua certa é a dele.
 *
 * Então aqui o recorte é REPLICADO, triângulo a triângulo, com a MESMA regra
 * de models.ts (slab de 40 mm por profundidade nas laterais; slab de 100 mm
 * mais normal na traseira), e o frame é a caixa do que entraria no painel.
 * A TESTEIRA não tem painel 3D (a "quarta face" é só do editor): ela continua
 * sendo a caixa da pele branca dela.
 */
const LIVERY_SKIN_SIDE = 0.04;
const LIVERY_SKIN_REAR = 0.10;

function measureFrames(root: THREE.Object3D): Record<FaceKey, Frame> {
  /* A caixa do corpo branco inteiro — os extremos dela ancoram os slabs,
     exatamente como o passo 1 de buildLiveryPanels(). */
  const body = new THREE.Box3();
  const whites: THREE.Mesh[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    if (!matsOf(m).some((x) => !!x && WHITE_RE.test(x.name || ''))) return;
    const b = worldBox(m);
    if (!b) return;
    whites.push(m);
    body.union(b);
  });
  if (!whites.length) throw new Error('nenhuma malha branca no bake');

  const boxes: Partial<Record<FaceKey, THREE.Box3>> = {};
  const add = (k: FaceKey, ...pts: THREE.Vector3[]) => {
    const b = boxes[k] ?? (boxes[k] = new THREE.Box3());
    for (const p of pts) b.expandByPoint(p);
  };
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3();
  for (const mesh of whites) {
    const g = mesh.geometry;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const idx = g.index ? g.index.array : null;
    const tri = Math.floor((idx ? idx.length : pos.count) / 3);
    mesh.updateWorldMatrix(true, false);
    for (let t = 0; t < tri; t++) {
      const i0 = idx ? idx[t * 3] : t * 3;
      const i1 = idx ? idx[t * 3 + 1] : t * 3 + 1;
      const i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
      va.fromBufferAttribute(pos, i0).applyMatrix4(mesh.matrixWorld);
      vb.fromBufferAttribute(pos, i1).applyMatrix4(mesh.matrixWorld);
      vc.fromBufferAttribute(pos, i2).applyMatrix4(mesh.matrixWorld);
      if (Math.min(va.x, vb.x, vc.x) >= body.max.x - LIVERY_SKIN_SIDE) { add('right', va, vb, vc); continue; }
      if (Math.max(va.x, vb.x, vc.x) <= body.min.x + LIVERY_SKIN_SIDE) { add('left', va, vb, vc); continue; }
      if (Math.max(va.z, vb.z, vc.z) <= body.min.z + LIVERY_SKIN_REAR) {
        e1.subVectors(vb, va); e2.subVectors(vc, va);
        fn.crossVectors(e1, e2).normalize();
        if (Math.abs(fn.z) >= 0.7) add('rear', va, vb, vc);
        continue;
      }
      /* A quarta face, do editor: a pele branca da testeira, fina em z. */
      if (Math.min(va.z, vb.z, vc.z) >= body.max.z - LIVERY_SKIN_REAR) {
        e1.subVectors(vb, va); e2.subVectors(vc, va);
        fn.crossVectors(e1, e2).normalize();
        if (Math.abs(fn.z) >= 0.7) add('front', va, vb, vc);
      }
    }
  }

  const mk = (face: FaceKey, b: THREE.Box3): Frame => {
    const lateral = face === 'left' || face === 'right';
    const sgn = face === 'right' || face === 'front' ? 1 : -1;
    return {
      face,
      y0: b.min.y, y1: b.max.y,
      u0: lateral ? b.min.z : b.min.x,
      u1: lateral ? b.max.z : b.max.x,
      face0: lateral ? (sgn > 0 ? b.max.x : b.min.x) : (sgn > 0 ? b.max.z : b.min.z),
      sgn,
    };
  };
  const out = {} as Record<FaceKey, Frame>;
  for (const f of ['left', 'right', 'rear', 'front'] as FaceKey[]) {
    const b = boxes[f];
    if (!b) throw new Error(`chapa da face "${f}" não encontrada`);
    out[f] = mk(f, b);
    notas.push(`${f}: chapa y ${b.min.y.toFixed(4)}..${b.max.y.toFixed(4)}`
      + ` (${((b.max.y - b.min.y) * 1000).toFixed(1)} mm)`
      + ` × ${(((f === 'left' || f === 'right') ? b.max.z - b.min.z : b.max.x - b.min.x) * 1000).toFixed(1)} mm`);
  }
  return out;
}

/**
 * A âncora DO PAINEL de um canto, a partir do lado da janela em u.
 *
 * `side` fala do MUNDO (u0 = a menor coordenada: a traseira nas laterais, o
 * menor x na traseira/testeira). O painel fala do DESENHO, e `addLiveryUV()`
 * espelha o eixo entre as faces: na SIDE_L u cresce do rear, na SIDE_R do
 * front, na REAR de max-x para min-x. Errar esta conversão põe o montante da
 * dobradiça na ponta do fecho — plausível e errado.
 */
function anchorXFor(face: FaceKey, side: 'start' | 'end'): 'start' | 'end' {
  const flip = face === 'right' || face === 'rear';
  return flip === (side === 'start') ? 'end' : 'start';
}

/**
 * Uma peça da tabela vira um disparo, contra o referencial da face.
 *
 * O `y` do manifesto é RELATIVO à pele branca e pode ser negativo — o trilho
 * nasce abaixo dela. Em peças presas ao teto, `y` é quanto o PÉ fica abaixo do
 * topo do branco, e também pode ser negativo (a fita alta passa acima).
 */
function toShot(p: PartSpec, f: Frame): Shot {
  const out = p.out ?? 0.07;
  const inn = p.in ?? 0.05;
  const d0 = f.face0 + f.sgn * out;
  const d1 = f.face0 - f.sgn * inn;

  /* A JANELA EM `u`, e por que ela difere por comportamento.
     `run` é uniforme ao longo da face: uma fatia basta, e ladrilhá-la equivale
     a esticá-la — com a vantagem de manter px/m constante em vez de esticar um
     recorte de 300 mm para 14,6 m. `tile` enquadra a unidade mais uma folga de
     meio milímetro para o antialiasing não comer a borda. `corner` pega a
     largura declarada, presa à ponta. `band` e `sheet` fotografam a extensão
     INTEIRA — são as faces de largura fixa, onde 1 px continua valendo o mesmo
     milímetro para sempre. */
  const mid = (f.u0 + f.u1) / 2;
  /* `tile` centra na UNIDADE MEDIDA quando a peça declara a fase — o meio do
     painel pode cair exatamente no vão entre unidades (foi o caso dos pares de
     rebite, passo 1 m, meio a 320 mm do par mais próximo: peça vazia). */
  const tileAt = p.how === 'tile' && p.at !== undefined ? p.at : mid;
  let u0: number, u1: number;
  if (p.how === 'run') { u0 = mid - 0.15; u1 = mid + 0.15; }
  else if (p.how === 'tile') { u0 = tileAt - (p.unit ?? 0.1) / 2 - 0.004; u1 = tileAt + (p.unit ?? 0.1) / 2 + 0.004; }
  else if (p.how === 'band') { u0 = f.u0 - 0.02; u1 = f.u1 + 0.02; }
  else if (p.how === 'sheet') { u0 = f.u0 + (p.inset0 ?? 0); u1 = f.u1 - (p.inset1 ?? 0); }
  else if (p.side === 'start') { u0 = f.u0 - 0.02; u1 = f.u0 + (p.width ?? 0.09); }
  else { u0 = f.u1 - (p.width ?? 0.09); u1 = f.u1 + 0.02; }

  /* O canto acompanha a ALTURA DO PAINEL, então a janela dele sobe até o topo
     do frame — que agora é o topo da CHAPA RECORTADA (4,1688 na lateral), não
     o da pele. Um canto fotografado até 4,0464 sairia 122 mm curto e o editor
     o esticaria para compensar, deformando a ferragem da ponta. */
  const v0 = p.y0;
  const v1 = p.how === 'corner' ? f.y1 + 0.01 : p.y1;

  const rect = p.anchor === 'roof'
    ? { x: 0, y: +(f.y1 - p.y0).toFixed(4), w: null as number | null, h: +(p.y1 - p.y0).toFixed(4) }
    : { x: 0, y: +(p.y0 - f.y0).toFixed(4), w: null as number | null, h: +(p.y1 - p.y0).toFixed(4) };
  if (p.how === 'corner') { rect.w = +((u1 - u0)).toFixed(4); rect.h = null; }
  if (p.how === 'sheet') { rect.w = null; rect.h = null; rect.y = 0; }

  return {
    id: p.id, face: f.face, file: `${f.face}-${p.id}.png`,
    u0, u1, v0, v1, d0, d1,
    only: p.material,
    rect,
    ...(p.how === 'corner' ? { anchorX: anchorXFor(f.face, p.side ?? 'start') } : {}),
    ...(p.how === 'sheet' ? { anchorX: 'stretch' as const, anchorY: 'stretch' as const } : {}),
    ...(p.how !== 'corner' && p.how !== 'sheet' ? { anchorY: p.anchor } : {}),
    ...(p.how === 'run' ? { tile: +(u1 - u0).toFixed(4) } : {}),
    ...(p.how === 'tile' ? { tile: p.pitch, span: +(u1 - u0).toFixed(4) } : {}),
    /* A fase, da ponta DIANTEIRA da chapa ao centro da unidade mais próxima —
       a mesma âncora dianteira que o 3D usa para tudo. `u1` é a frente nas
       laterais (u corre em z). */
    ...(p.how === 'tile' && p.at !== undefined && p.pitch
      ? { phase: +((((f.u1 - p.at) % p.pitch) + p.pitch) % p.pitch).toFixed(4) }
      : {}),
    nota: p.nota,
  };
}

const VIEW: Record<FaceKey, THREE.Vector3> = {
  left: new THREE.Vector3(1, 0, 0),
  right: new THREE.Vector3(-1, 0, 0),
  rear: new THREE.Vector3(0, 0, 1),
  front: new THREE.Vector3(0, 0, -1),
};

const out2d = document.createElement('canvas');
const outCtx = out2d.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
outCtx.imageSmoothingEnabled = true;
outCtx.imageSmoothingQuality = 'high';

function shoot(s: Shot): { png: string; wPx: number; hPx: number } {
  const lateral = s.face === 'left' || s.face === 'right';
  const dir = VIEW[s.face];

  const w = Math.abs(s.u1 - s.u0);
  const h = Math.abs(s.v1 - s.v0);
  const ppm = Math.min(TARGET_PX_PER_M, MAX_SIDE_PX / Math.max(w, h));
  const wPx = Math.max(2, Math.round(w * ppm));
  const hPx = Math.max(2, Math.round(h * ppm));

  const uMid = (s.u0 + s.u1) / 2;
  const vMid = (s.v0 + s.v1) / 2;
  const camDist = 1.0;
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2,
    camDist - 1e-3, camDist + Math.abs(s.d1 - s.d0) + 1e-3);

  if (lateral) {
    cam.position.set(s.d0 - dir.x * camDist, vMid, uMid);
    cam.lookAt(s.d0, vMid, uMid);
  } else {
    cam.position.set(uMid, vMid, s.d0 - dir.z * camDist);
    cam.lookAt(uMid, vMid, s.d0);
  }
  cam.up.set(0, 1, 0);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);

  keyLight.position.copy(cam.position).addScaledVector(new THREE.Vector3(0, 1, 0), 3);
  keyLight.target.position.set(
    lateral ? s.d1 : uMid, vMid, lateral ? uMid : s.d1,
  );
  scene.add(keyLight.target);

  const touched: [THREE.Object3D, boolean][] = [];
  const swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
  (scene.getObjectByName('TRAILER_ROOT') ?? scene).traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = matsOf(m).map((x) => x?.name || '?').join('+');
    /* A CHAPA BRANCA NÃO SOME — ela OCLUI. Invisível, ela deixava ver o que
       mora atrás dela e que no baú real nunca aparece: o reforço interno em
       inox das folhas saía como um chapadão escuro sobre a área de arte
       (medido em `inv.mjs`, seção `rear_black`: 90 769 triângulos de
       `inox-ferragem` a ≤ 35 mm da pele). Escrever só PROFUNDIDADE dá as duas
       coisas ao mesmo tempo: pixel transparente onde há chapa, e nada de
       dentro vazando — a mesma oclusão que a folha de verdade faz. */
    if (WHITE_RE.test(mat)) {
      if (m.visible) { swapped.push([m, m.material]); m.material = depthOnly; }
      return;
    }
    let vis = m.visible;
    if (GLOBAL_HIDE.test(mat)) vis = false;
    if (!s.only.test(mat)) vis = false;
    if (vis !== m.visible) { touched.push([m, m.visible]); m.visible = vis; }
  });

  let ss = SSAA;
  while (ss > 1 && (wPx * ss > MAX_BUFFER_SIDE || hPx * ss > MAX_BUFFER_SIDE
    || wPx * ss * hPx * ss > MAX_BUFFER_PX)) ss--;
  renderer.setSize(wPx * ss, hPx * ss, false);
  const gl = renderer.getContext();
  if (gl.drawingBufferWidth !== wPx * ss || gl.drawingBufferHeight !== hPx * ss) {
    throw new Error(`peça "${s.face}/${s.id}": driver deu`
      + ` ${gl.drawingBufferWidth}×${gl.drawingBufferHeight} para ${wPx * ss}×${hPx * ss}`);
  }
  renderer.render(scene, cam);

  out2d.width = wPx; out2d.height = hPx;
  outCtx.clearRect(0, 0, wPx, hPx);
  outCtx.drawImage(renderer.domElement, 0, 0, wPx, hPx);

  for (const [o, vis] of touched) o.visible = vis;
  for (const [m, orig] of swapped) m.material = orig;

  /* Peça vazia FALHA em vez de gravar um PNG transparente: um seletor que não
     pegou nada é um buraco no painel que ninguém relata. */
  const img = outCtx.getImageData(0, 0, wPx, hPx).data;
  let solid = 0;
  for (let i = 3; i < img.length; i += 4) if (img[i] > 24) solid++;
  const pct = (solid / (wPx * hPx)) * 100;
  if (pct < 0.2) {
    throw new Error(`peça "${s.face}/${s.id}" saiu vazia (${pct.toFixed(2)} %)`
      + ` — janela u ${s.u0.toFixed(3)}..${s.u1.toFixed(3)} v ${s.v0.toFixed(3)}..${s.v1.toFixed(3)}`
      + ` slab ${s.d0.toFixed(3)}..${s.d1.toFixed(3)} material ${s.only}`);
  }
  return { png: out2d.toDataURL('image/png'), wPx, hPx };
}

async function main() {
  const draco = new DRACOLoader();
  draco.setDecoderPath('/vendor/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  const gltf = await loader.loadAsync('/models/vehicles/trailer.glb');
  const root = gltf.scene;
  root.name = 'TRAILER_ROOT';
  root.updateWorldMatrix(true, true);
  scene.add(root);

  frames = measureFrames(root);

  const TABLE: Record<FaceKey, PartSpec[]> = {
    left: SIDE_PARTS, right: SIDE_PARTS, rear: REAR_PARTS, front: FRONT_PARTS,
  };
  shots = [];
  for (const face of ['left', 'right', 'rear', 'front'] as FaceKey[]) {
    for (const p of TABLE[face]) shots.push(toShot(p, frames[face]));
  }

  const r4 = (n: number) => +n.toFixed(4);
  window.__plan = () => ({
    notas,
    faces: Object.fromEntries((Object.keys(frames) as FaceKey[]).map((k) => {
      const f = frames[k];
      return [k, {
        designLength: r4(f.u1 - f.u0),
        designHeight: r4(f.y1 - f.y0),
        anchor: k === 'left' ? 'end' : 'start',
      }];
    })),
    pecas: shots.map((s) => ({
      face: s.face, id: s.id, file: s.file, plane: 'front',
      x: s.rect.x, y: s.rect.y, w: s.rect.w, h: s.rect.h,
      ...(s.anchorX ? { anchorX: s.anchorX } : {}),
      ...(s.anchorY ? { anchorY: s.anchorY } : {}),
      ...(s.tile ? { tile: r4(s.tile) } : {}),
      ...(s.span ? { span: r4(s.span) } : {}),
      ...(s.phase !== undefined ? { phase: r4(s.phase) } : {}),
      nota: s.nota,
      janela_m: [r4(Math.abs(s.u1 - s.u0)), r4(Math.abs(s.v1 - s.v0))],
    })),
  });

  window.__shoot = (id: string) => {
    const s = shots.find((x) => `${x.face}/${x.id}` === id);
    if (!s) throw new Error(`peça desconhecida: ${id}`);
    return shoot(s);
  };

  window.__ready = true;
}

main().catch((e) => {
  window.__error = (e && (e.stack || e.message)) || String(e);
  window.__ready = true;
});
