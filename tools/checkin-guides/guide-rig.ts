/* Bancada dos GUIAS DE FOTO de check-in / check-out.
   ===========================================================================
   O QUE ELA PRODUZ, por pose:

     · `guide`  — desenho de linha (branco sobre transparente) para fantasmar
                  no visor da câmera. É o que o app consome.
     · `shaded` — render sombreado do mesmo enquadramento, para a interface
                  mostrar ao operador o que ele tem de fotografar.

   ---------------------------------------------------------------------------
   POR QUE O DESENHO NÃO SAI DE UM DETECTOR DE BORDAS GENÉRICO

   O pedido é "sem frisos, sem chapas, o SHAPE". Um Sobel em normais faz o
   contrário do pedido: o friso é uma ondulação de 5,2 mm com arco de 25,9 mm
   (medido em `trailer-geometry.ts`), então a normal gira quase 90° a cada
   26 mm e o detector devolve 46 listras por lateral — exatamente o ruído que
   se quer fora.

   Aqui o desenho sai de um BUFFER DE IDENTIDADE: cada peça recebe um número
   de GRUPO, a cena é renderizada chapada nesse número, e a linha nasce onde o
   número MUDA. Friso não produz linha porque os dois lados da ondulação são o
   mesmo grupo — a chapa lateral inteira é uma peça só, e o contorno dela é um
   retângulo. O que sobra é o que se queria: silhueta do baú, das portas, das
   rodas, dos para-lamas e do chassi.

   O segundo canal é a PROFUNDIDADE, em 16 bits sobre 60 m (0,9 mm por passo).
   Ela separa duas peças do MESMO grupo que se sobrepõem — a roda de trás
   contra a da frente — sem reintroduzir o friso: o limiar de 50 mm é dez vezes
   o relevo e um décimo do vão entre rodados.

   ---------------------------------------------------------------------------
   O FRISO SAI DA GEOMETRIA, NÃO SÓ DO DESENHO

   O sombreado ainda mostraria as 46 ondulações mesmo com o contorno limpo. Por
   isso `flattenRibs()` achata a chapa de verdade: todo vértice com |x| ≥ 1,29
   vai para a crista, ±1,3035. Os quatro planos do relevo (crista 1,30350,
   vale 1,29830, e as duas faces internas a 1,2975/1,2985, que são a espessura
   de 0,80 mm da chapa) caem todos dentro dessa faixa — é a medição do cabeçalho
   de `trailer-geometry.ts`, não um chute. Fora dela nada é tocado, e por isso
   porta, testeira e teto (que são chapa LISA no arquivo) passam intactos.

   Ordem obrigatória: achatar DEPOIS de qualquer `set()` de medida. O
   `TrailerBody` reconstrói a chapa a cada resize e apagaria o achatamento.

   ---------------------------------------------------------------------------
   A CÂMERA É UMA PESSOA, NÃO UM ORBIT

   As fotos de check-in são feitas por alguém em pé, de celular, no chão do
   pátio. Então a pose NÃO é (direção, distância) como no card do seletor: a
   ALTURA DA CÂMERA é fixa (`camY`) e o que o ajuste move é a distância no
   plano e a mira. Enquadrar por elevação daria a foto de um drone.

   O quadro é 1600×900 / 900×1600 porque é ISSO que o app grava: a amostra de
   88 fotos de check-in do servidor tem 27 retratos 900×1600 e 12 paisagens
   1600×900, sem uma única exceção e sem tag EXIF de rotação. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { TrailerRig } from '@/pages/tools/truck-studio/engine/vehicle/trailer-rig';

/** A pose RESOLVIDA. É o que `shoot.mjs` espelha para o outro lado. */
export interface CamSolucao {
  dist: number;
  aim: [number, number, number];
  pos: [number, number, number];
  fov: number;
}

export interface Pose {
  name: string;
  /** Quadro de saída. 1600×900 ou 900×1600 — o que a câmera do app grava. */
  w: number;
  h: number;
  /** 0° = de frente para a TESTEIRA (+Z). 90° = lado +X. 180° = PORTAS. */
  azDeg: number;
  /** Altura do olho/celular, em metros. */
  camY: number;
  /** Campo de visão no eixo LONGO do quadro, em graus. */
  fovLongDeg: number;
  /** Fração do quadro que a silhueta pode ocupar, por eixo. */
  fillW: number;
  fillH: number;
  /** Centro alvo da silhueta, em fração do quadro. */
  cx: number;
  cy: number;
  /** Mira inicial em Y (m). O ajuste corrige a partir daqui. */
  aimY: number;
  /** Mira inicial em Z (m). Ausente = centro da caixa. */
  aimZ?: number;
  /** Mira inicial em X (m). Ausente = centro da caixa. Espelha com a pose. */
  aimX?: number;
  /** Trava a mira em x = 0 — poses de eixo (testeira, portas). */
  travaX?: boolean;
  /**
   * Trava a mira INTEIRA: o ajuste não recentra.
   *
   * É o que um close-up precisa. Recentrar significa "traga a silhueta para o
   * meio do quadro", e a silhueta de um close é o veículo inteiro — a mira foge
   * do assunto para o centro do implemento. Foi exatamente o que aconteceu com
   * a carenagem: mira pedida em y 3,5 / z +6,2 terminou em y 3,48 / z −0,02,
   * ou seja, no meio da carreta, e o quadro saiu vazio.
   */
  travaMira?: boolean;
  /** Espessura da linha do guia, em pixels do quadro FINAL. */
  lineW?: number;
  /** Distância fixa (m). Se vier, o ajuste de escala não roda. */
  dist?: number;
}

declare global {
  interface Window {
    __ready?: boolean;
    __error?: string;
    __diag?: unknown;
    __dims?: unknown;
    __setDims?: (patch: { height?: number; length?: number }) => unknown;
    __shot?: (pose: Pose, kind: 'guide' | 'shaded' | 'both', cam?: CamSolucao | null) => {
      guide?: string; shaded?: string; meta: unknown;
    };
  }
}

/* ------------------------------------------------------------------ grupos */
/* O número é a IDENTIDADE no buffer; a ordem não significa nada além de ser
   estável entre poses (o app pode vir a querer pintar um grupo de outra cor).
   `DESCARTE` não é um grupo: é a lista do que não entra no desenho nem no
   sombreado — ferragem, faixas refletivas, lanternas, borrachas e registros.
   São 1.155 malhas de `inox-ferragem` sozinhas, 1,56 M de triângulos, e nada
   disso é SHAPE: a saliência máxima delas sobre a crista da chapa é 12 mm. */
const GRP = {
  BAU: 1,        // chapa lateral, testeira, teto, forro
  PORTA: 2,      // folhas das portas traseiras
  PARALAMA: 3,
  RODA: 4,
  CHASSI: 5,     // longarinas, saia, caixa de ferramenta, para-barros
} as const;
type GrpId = typeof GRP[keyof typeof GRP];

/** Material → grupo. `null` = descartado. */
const BY_MATERIAL: Array<[RegExp, GrpId | null]> = [
  [/^Cor_padrao_branco|metalBranco/i, GRP.BAU],
  [/^platico-branco|^lona-fria|^plastico-cinza-lona/i, GRP.BAU],
  [/^metal-estrutura-principal|^metal-galvanizado-mantido/i, GRP.BAU],
  [/^paralamas/i, GRP.PARALAMA],
  [/^pneu-|^aro-rodas/i, GRP.RODA],
  [/^metal-preto|^caixa-estrutura-preta|^plastico-preto$|^metal-claro|^plastico-cinza-polido/i, GRP.CHASSI],
  [/^metal-pouco-polido|^metal-galvanizado-polido/i, GRP.CHASSI],
  /* Tudo o mais é ferragem, sinalização ou vedação — fora. */
  [/^inox-ferragem|^Faixa-3M|faixa3M|^borracha|^vidro-|^lente-|^lanterna|^led-|^painel-curva-led/i, null],
  [/^registro-|^engate-|^cano-ar|^suporte-varao|^plastico-preto-polido|^Material$/i, null],
];

/** As portas traseiras: chapa branca colada no plano da traseira. */
const REAR_DOOR_Z = -7.30;   // qualquer coisa branca atrás disto é porta
const RIB_CREST = 1.30350;   // crista externa medida no GLB (m)
const RIB_ZONE = 1.29;       // abaixo disto o vértice não é da pele lateral

/* ------------------------------------------------------------- renderizador */
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, alpha: true, preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 400);

/* ------------------------------------------------------------------- luzes */
/* Três softboxes no referencial do IMPLEMENTO (não da câmera), pelo mesmo
   motivo que `studio-render/rig.ts` dá: uma direcional deixa realce PONTUAL, e
   o que se lê como chapa é uma FAIXA — o reflexo do painel esticado ao longo da
   carroceria. Postas no veículo, o realce cai no mesmo lugar em todas as poses,
   que é o que faz as seis fotos do jogo parecerem o mesmo objeto. */
RectAreaLightUniformsLib.init();

const key = new THREE.DirectionalLight(0xfff6ec, 2.1);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0012;
key.shadow.normalBias = 0.06;
scene.add(key, key.target);

const fill = new THREE.DirectionalLight(0xdfe8ff, 0.55);
scene.add(fill, fill.target);

const hemi = new THREE.HemisphereLight(0xdfe9ff, 0.35);
scene.add(hemi);

/** Softbox de topo: a faixa que corre o comprimento do teto. */
const softTop = new THREE.RectAreaLight(0xffffff, 3.4, 3.0, 16);
/** Softbox do lado da câmera: o realce longo na parede. */
const softSide = new THREE.RectAreaLight(0xfff4ea, 2.2, 16, 4.5);
/** Kicker traseiro: separa a silhueta do fundo transparente. */
const softKick = new THREE.RectAreaLight(0xcddcf6, 2.6, 5.0, 4.0);
scene.add(softTop, softSide, softKick);

/** Chão que só recebe sombra — some no PNG, a sombra fica. */
const shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.ShadowMaterial({ opacity: 0.30 }),
);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

/* --------------------------------------------------------------- materiais */
const matShaded: Record<number, THREE.Material> = {
  [GRP.BAU]: new THREE.MeshPhysicalMaterial({
    color: 0xe9eaee, roughness: 0.40, metalness: 0.05,
    clearcoat: 0.30, clearcoatRoughness: 0.35, side: THREE.DoubleSide,
  }),
  [GRP.PORTA]: new THREE.MeshPhysicalMaterial({
    color: 0xe2e4e9, roughness: 0.44, metalness: 0.05,
    clearcoat: 0.30, clearcoatRoughness: 0.35, side: THREE.DoubleSide,
  }),
  [GRP.PARALAMA]: new THREE.MeshStandardMaterial({
    color: 0x5b5f66, roughness: 0.62, metalness: 0.10, side: THREE.DoubleSide,
  }),
  [GRP.RODA]: new THREE.MeshStandardMaterial({
    color: 0x1a1c1f, roughness: 0.86, metalness: 0.05, side: THREE.DoubleSide,
  }),
  [GRP.CHASSI]: new THREE.MeshStandardMaterial({
    color: 0x3c4046, roughness: 0.55, metalness: 0.30, side: THREE.DoubleSide,
  }),
};

/** Passe de identidade: id no R, profundidade em 16 bits no G+B, máscara no A. */
const ID_VERT = /* glsl */`
varying float vDepth;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const ID_FRAG = /* glsl */`
uniform float uId;
uniform float uFar;
varying float vDepth;
void main() {
  float d = clamp(vDepth / uFar, 0.0, 1.0) * 65535.0;
  float hi = floor(d / 256.0);
  float lo = d - hi * 256.0;
  gl_FragColor = vec4(uId / 255.0, hi / 255.0, lo / 255.0, 1.0);
}`;
const ID_FAR = 60.0;

const matId: Record<number, THREE.ShaderMaterial> = {};
for (const id of Object.values(GRP)) {
  matId[id] = new THREE.ShaderMaterial({
    vertexShader: ID_VERT, fragmentShader: ID_FRAG,
    uniforms: { uId: { value: id }, uFar: { value: ID_FAR } },
    side: THREE.DoubleSide,
  });
}

/* ---------------------------------------------------------------- carregar */
const draco = new DRACOLoader().setDecoderPath('/vendor/draco/');
const loader = new GLTFLoader().setDRACOLoader(draco);

let rig: TrailerRig;
let root: THREE.Object3D;
const parts: Array<{ mesh: THREE.Mesh; grp: GrpId; orig: THREE.Material | THREE.Material[] }> = [];
let box = new THREE.Box3();

function grpOf(mesh: THREE.Mesh): GrpId | null {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const name = (mats[0] as THREE.Material)?.name || '';
  for (const [re, g] of BY_MATERIAL) if (re.test(name)) return g;
  return null;
}

/** Caixa da malha no referencial de `root`, lida do ATRIBUTO. */
function boxIn(mesh: THREE.Mesh): THREE.Box3 | null {
  const p = mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!p || !p.count) return null;
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const m = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) b.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(m));
  return b;
}

/**
 * Achata o friso: vértice com |x| ≥ RIB_ZONE vai para a crista.
 *
 * Mede em espaço LOCAL da malha, o que só é válido porque a pele lateral não
 * gira — ela é extrusão pura em Z (dois anéis, z = −7,407 e +7,173). Uma malha
 * girada teria de ser testada em espaço do implemento, e é por isso que o
 * filtro exige que a caixa da malha ENCOSTE nos dois lados: só a pele encosta.
 */
function flattenRibs(): { meshes: number; verts: number } {
  let meshes = 0, verts = 0;
  for (const { mesh, grp } of parts) {
    if (grp !== GRP.BAU) continue;
    const b = boxIn(mesh);
    if (!b || b.max.x < RIB_ZONE || b.min.x > -RIB_ZONE) continue;
    const p = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    let touched = 0;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      if (x >= RIB_ZONE && x <= RIB_CREST + 0.01) { p.setX(i, RIB_CREST); touched++; }
      else if (x <= -RIB_ZONE && x >= -RIB_CREST - 0.01) { p.setX(i, -RIB_CREST); touched++; }
    }
    if (touched) {
      p.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      /* E a normal da pele é ESCRITA, não recalculada.
         Achatar deixa a face externa e a INTERNA da chapa (0,80 mm de
         espessura, planos 1,2975/1,2985) exatamente coplanares — o z-buffer
         passa a escolher uma ou outra por pixel. Medido antes desta linha: a
         parede oscilava 234↔237 com período de 5,33 px, que a 9,79 mm/px dá
         52 mm — o passo do friso, 53,00 mm. Ou seja, o friso voltava pela
         SOMBRA depois de sumir da geometria.
         Escrever ±X nas duas faces torna a disputa invisível: quem quer que
         ganhe o pixel, sombreia igual. Não se vê o lado de dentro do baú em
         nenhuma pose deste jogo, então a normal invertida lá não custa nada. */
      const nrm = mesh.geometry.getAttribute('normal') as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        if (x === RIB_CREST) nrm.setXYZ(i, 1, 0, 0);
        else if (x === -RIB_CREST) nrm.setXYZ(i, -1, 0, 0);
      }
      nrm.needsUpdate = true;
      mesh.geometry.computeBoundingSphere();
      meshes++; verts += touched;
    }
  }
  return { meshes, verts };
}

async function build() {
  const gltf = await loader.loadAsync('/models/vehicles/trailer.glb');
  root = gltf.scene;
  root.updateMatrixWorld(true);
  rig = new TrailerRig(root);
  root.updateMatrixWorld(true);
  scene.add(root);

  const seen = new Map<string, number>();
  const dropped = new Map<string, number>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    /* `visible` importa: `TrailerBody` deixa as cascas de origem na cena e
       desligadas quando o corpo paramétrico assume. Levar as duas para o
       buffer poria duas peles no mesmo plano e um z-fight de contorno. */
    let vis = true;
    for (let p: THREE.Object3D | null = m; p; p = p.parent) if (!p.visible) { vis = false; break; }
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const name = (mats[0] as THREE.Material)?.name || '(anon)';
    if (!vis) return;
    const g = grpOf(m);
    if (g === null) { dropped.set(name, (dropped.get(name) || 0) + 1); m.visible = false; return; }
    seen.set(name, (seen.get(name) || 0) + 1);
    m.castShadow = true;
    /* RECEBER sombra é por grupo, e é uma decisão medida.
       A parede do baú é a maior superfície plana da cena e a que o mapa de
       sombra menos perdoa: com ela recebendo, a coluna do render oscilava
       234↔237 num passo de 5,33 px — que a 9,79 mm/px dá 52 mm. É acne de
       shadow map, não friso (a chapa já estava achatada e a normal escrita à
       mão; desligar `shadowMap` zerou a oscilação e nada mais mudou). Chassi,
       rodado e para-lama recebem: são escuros e recortados, o acne não se lê
       neles, e é ali que a sombra do baú dá volume ao conjunto. */
    m.receiveShadow = g === GRP.CHASSI || g === GRP.RODA || g === GRP.PARALAMA;
    parts.push({ mesh: m, grp: g, orig: m.material });
  });

  /* As PORTAS saem do BAÚ por posição, não por nome: no arquivo elas são chapa
     branca como a parede. É a única separação que o desenho precisa e que o
     material não dá — sem ela a traseira sai como um retângulo vazio. */
  let doors = 0;
  for (const p of parts) {
    if (p.grp !== GRP.BAU) continue;
    const b = boxIn(p.mesh);
    if (b && b.max.z <= REAR_DOOR_Z) { p.grp = GRP.PORTA; doors++; }
  }

  const flat = flattenRibs();

  box = new THREE.Box3();
  for (const p of parts) { const b = boxIn(p.mesh); if (b) box.union(b); }

  window.__dims = rig.current;
  window.__diag = {
    malhas: parts.length,
    portas: doors,
    friso_achatado: flat,
    caixa: {
      x: [box.min.x, box.max.x], y: [box.min.y, box.max.y], z: [box.min.z, box.max.z],
    },
    materiais_usados: [...seen.entries()].sort((a, b) => b[1] - a[1]),
    materiais_descartados: [...dropped.entries()].sort((a, b) => b[1] - a[1]),
  };
}

/* ---------------------------------------------------------------- troca de material */
function useId() { for (const p of parts) p.mesh.material = matId[p.grp]; shadowPlane.visible = false; }
function useShaded() { for (const p of parts) p.mesh.material = matShaded[p.grp]; shadowPlane.visible = true; }

/* ------------------------------------------------------------------ câmera */
/** FOV vertical a partir do FOV do eixo LONGO do quadro. */
function vFovFor(fovLong: number, w: number, h: number) {
  const half = THREE.MathUtils.degToRad(fovLong) / 2;
  if (h >= w) return fovLong;                       // retrato: o longo É o vertical
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(half) * h / w));
}

const _dir = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();

/** Buffer de calibração: 1/6 de lado. Sobra para medir uma silhueta. */
let calRT: THREE.WebGLRenderTarget | null = null;
let calBuf: Uint8Array = new Uint8Array(0);

function measureSilhouette(cw: number, ch: number) {
  if (!calRT || calRT.width !== cw || calRT.height !== ch) {
    calRT?.dispose();
    calRT = new THREE.WebGLRenderTarget(cw, ch, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      type: THREE.UnsignedByteType, colorSpace: THREE.NoColorSpace, depthBuffer: true,
    });
    calBuf = new Uint8Array(cw * ch * 4);
  }
  renderer.setRenderTarget(calRT);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.readRenderTargetPixels(calRT, 0, 0, cw, ch, calBuf);
  renderer.setRenderTarget(null);

  let x0 = cw, x1 = -1, y0 = ch, y1 = -1;
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      if (calBuf[(y * cw + x) * 4 + 3] < 128) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  /* readRenderTargetPixels devolve de baixo para cima; o quadro é de cima para
     baixo. Espelhar aqui é mais barato que espelhar a imagem inteira. */
  return {
    w: (x1 - x0 + 1) / cw, h: (y1 - y0 + 1) / ch,
    cx: (x0 + x1 + 1) / 2 / cw, cy: 1 - (y0 + y1 + 1) / 2 / ch,
  };
}

/**
 * Resolve a pose: distância no PLANO e mira, com a altura da câmera FIXA.
 *
 * O ajuste do card (`studio-render/rig.ts`) anda a câmera ao longo da direção
 * de vista, o que muda a altura junto — aqui isso é proibido, porque a altura é
 * a única coisa que a pose promete ao operador. Então a correção de escala é
 * aplicada só no raio horizontal e a de centro só na mira.
 */
function solve(p: Pose) {
  camera.fov = vFovFor(p.fovLongDeg, p.w, p.h);
  camera.aspect = p.w / p.h;

  const az = THREE.MathUtils.degToRad(p.azDeg);
  _dir.set(Math.sin(az), 0, Math.cos(az));

  const c = box.getCenter(new THREE.Vector3());
  _aim.set(p.travaX ? 0 : (p.aimX ?? c.x), p.aimY, p.aimZ ?? c.z);

  let d = p.dist ?? box.getSize(new THREE.Vector3()).length() * 1.1;
  const cw = Math.max(120, Math.round(p.w / 6));
  const ch = Math.max(120, Math.round(p.h / 6));

  useId();
  const steps = p.dist ? 3 : 6;
  for (let i = 0; i < steps; i++) {
    camera.position.set(_aim.x + _dir.x * d, p.camY, _aim.z + _dir.z * d);
    camera.lookAt(_aim);
    camera.updateProjectionMatrix();
    const e = measureSilhouette(cw, ch);
    if (!e) break;
    if (p.travaMira) { if (!p.dist) { const n = Math.max(e.w / p.fillW, e.h / p.fillH); if (Number.isFinite(n) && n > 0) d *= n; } continue; }

    const fh = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const fw = fh * camera.aspect;
    _right.setFromMatrixColumn(camera.matrixWorld, 0);
    _up.setFromMatrixColumn(camera.matrixWorld, 1);
    /* A mira anda no sentido do erro em X e no sentido CONTRÁRIO em Y: `cy` é
       medido de cima para baixo e o `up` da câmera aponta para cima, então
       silhueta baixa demais (cy > alvo) pede mira mais BAIXA — o quadro desce e
       o objeto sobe dentro dele. Sem esse sinal a correção realimenta e a mira
       foge para debaixo do chão em três passadas. */
    _aim.addScaledVector(_right, (e.cx - p.cx) * fw)
      .addScaledVector(_up, -(e.cy - p.cy) * fh);
    if (p.travaX) _aim.x = 0;

    if (!p.dist) {
      const need = Math.max(e.w / p.fillW, e.h / p.fillH);
      if (Number.isFinite(need) && need > 0) d *= need;
    }
  }
  if (p.travaX) _aim.x = 0;
  camera.position.set(_aim.x + _dir.x * d, p.camY, _aim.z + _dir.z * d);
  camera.lookAt(_aim);
  camera.updateProjectionMatrix();
  return {
    dist: d, aim: _aim.toArray() as [number, number, number],
    pos: camera.position.toArray() as [number, number, number], fov: camera.fov,
  };
}

/** Aplica uma solução pronta — o caminho do lado espelhado. Nada é medido. */
function apply(p: Pose, cam: CamSolucao): CamSolucao {
  camera.fov = cam.fov;
  camera.aspect = p.w / p.h;
  camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
  camera.up.set(0, 1, 0);
  camera.lookAt(cam.aim[0], cam.aim[1], cam.aim[2]);
  camera.updateProjectionMatrix();
  return cam;
}

/* ------------------------------------------------------------- composição */
const out = document.createElement('canvas');
const outCtx = out.getContext('2d', { willReadFrequently: true })!;
const SS = 2;   // supersample dos dois passes

let idRT: THREE.WebGLRenderTarget | null = null;
let idBuf = new Uint8Array(0);

/**
 * Desenho de linha a partir do buffer de identidade.
 *
 * Linha onde a MÁSCARA muda (silhueta), onde o GRUPO muda (porta contra parede,
 * roda contra saia) ou onde a profundidade tem um DEGRAU.
 *
 * O degrau é medido pela SEGUNDA diferença — |d(i−1) − 2·d(i) + d(i+1)| —, não
 * pela primeira, e a razão é a lateral vista de raspão. Numa pose de 46° a
 * parede corre 14 m de profundidade em poucas centenas de pixels do buffer, o
 * que dá dezenas de milímetros POR PIXEL: um limiar de primeira diferença que
 * ignorasse isso teria de ser enorme, e a 50 mm ele passava raspando — o guia
 * da carenagem saía com tracejado ao longo da parede, que é ruído e não
 * geometria. Numa superfície plana inclinada a primeira diferença é CONSTANTE,
 * então a segunda é zero por construção; num degrau de verdade ela é o degrau
 * inteiro. O ruído de quantização (0,9 mm por passo, 60 m em 16 bits) chega a
 * ~2 mm na segunda diferença, vinte vezes abaixo do limiar.
 */
const DEPTH_STEP = 0.04;

let lastGuideStats: unknown = null;

function drawGuide(p: Pose) {
  const W = p.w * SS, H = p.h * SS;
  if (!idRT || idRT.width !== W || idRT.height !== H) {
    idRT?.dispose();
    idRT = new THREE.WebGLRenderTarget(W, H, {
      minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
      type: THREE.UnsignedByteType, colorSpace: THREE.NoColorSpace, depthBuffer: true,
    });
    idBuf = new Uint8Array(W * H * 4);
  }
  useId();
  renderer.setRenderTarget(idRT);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.readRenderTargetPixels(idRT, 0, 0, W, H, idBuf);
  renderer.setRenderTarget(null);

  const depth = new Float32Array(W * H);
  const idm = new Uint8Array(W * H);
  for (let i = 0, n = W * H; i < n; i++) {
    const o = i * 4;
    idm[i] = idBuf[o + 3] < 128 ? 0 : idBuf[o];
    depth[i] = ((idBuf[o + 1] * 256 + idBuf[o + 2]) / 65535) * ID_FAR;
  }

  let cobertos = 0;
  for (let i = 0, n = W * H; i < n; i++) if (idm[i]) cobertos++;
  lastGuideStats = { W, H, cobertos };

  const edge = new Uint8Array(W * H);
  /** Silhueta e troca de peça: a máscara ou o grupo mudam entre vizinhos. */
  const trocou = (a: number, b: number) => idm[a] !== idm[b];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if ((x + 1 < W && trocou(i, i + 1)) || (y + 1 < H && trocou(i, i + W))) edge[i] = 1;
    }
  }
  /* Degrau de profundidade DENTRO do mesmo grupo — a roda de trás contra a da
     frente. Os três pixels têm de ser do mesmo grupo, senão a conta atravessa
     uma borda que a passada acima já marcou. */
  for (let y = 0; y < H; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const g = idm[i];
      if (!g || idm[i - 1] !== g || idm[i + 1] !== g) continue;
      if (Math.abs(depth[i - 1] - 2 * depth[i] + depth[i + 1]) > DEPTH_STEP) edge[i] = 1;
    }
  }
  for (let x = 0; x < W; x++) {
    for (let y = 1; y < H - 1; y++) {
      const i = y * W + x;
      const g = idm[i];
      if (!g || idm[i - W] !== g || idm[i + W] !== g) continue;
      if (Math.abs(depth[i - W] - 2 * depth[i] + depth[i + W]) > DEPTH_STEP) edge[i] = 1;
    }
  }

  /* PONTINHOS: fora.
     ---------------------------------------------------------------------
     A chapa lisa saía salpicada de pontos de 1 a 2 px. Eles não são friso (a
     pele está achatada) nem ruído do detector: são peças que ficaram
     COPLANARES com a pele depois do achatamento. `plastico-preto` e
     `metal-estrutura-principal-padrao`, por exemplo, têm caixa em x ±1,304 e
     ±1,308 contra a crista em 1,3035 — meio milímetro de um lado ou do outro.
     O z-buffer escolhe uma ou outra por pixel, o número do grupo pisca, e cada
     pisca vira um ponto.

     Empurrar a pele para fora só troca quem ganha a disputa. O que separa
     ponto de desenho não é a causa, é o TAMANHO: uma linha de verdade tem
     centenas de pixels conexos, um artefato de coplanaridade tem menos de dez.
     Então a filtragem é por COMPONENTE CONEXA, e vem antes da dilatação —
     depois dela os pontos já teriam engordado até a espessura da linha e não
     dariam mais para distinguir.

     24 px do buffer supersampleado = 6 px do quadro final. A menor feição que
     o jogo precisa mostrar (o contorno de um fecho de porta) passa de 60. */
  const MIN_EDGE_PX = 24;
  {
    const visto = new Uint8Array(W * H);
    const pilha = new Int32Array(W * H);
    const comp = new Int32Array(W * H);
    for (let i = 0; i < W * H; i++) {
      if (!edge[i] || visto[i]) continue;
      let topo = 0, n = 0;
      pilha[topo++] = i;
      visto[i] = 1;
      while (topo > 0) {
        const j = pilha[--topo];
        comp[n++] = j;
        const jx = j % W, jy = (j / W) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = jx + dx, ny = jy + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const k = ny * W + nx;
            if (edge[k] && !visto[k]) { visto[k] = 1; pilha[topo++] = k; }
          }
        }
      }
      if (n < MIN_EDGE_PX) for (let q = 0; q < n; q++) edge[comp[q]] = 0;
    }
  }

  /* Dilatação separável: a linha nasce com 1 px do buffer supersampleado e o
     downscale a deixaria em 1/SS de pixel — invisível sobre o visor. */
  const lineW = p.lineW ?? 2.6;
  const k = Math.max(0, Math.round((lineW * SS - 1) / 2));
  let cur = edge;
  if (k > 0) {
    const tmp = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let v = 0;
        for (let dx = -k; dx <= k && !v; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < W && cur[y * W + xx]) v = 1;
        }
        tmp[y * W + x] = v;
      }
    }
    const tmp2 = new Uint8Array(W * H);
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        let v = 0;
        for (let dy = -k; dy <= k && !v; dy++) {
          const yy = y + dy;
          if (yy >= 0 && yy < H && tmp[yy * W + x]) v = 1;
        }
        tmp2[y * W + x] = v;
      }
    }
    cur = tmp2;
  }

  /* Branco pré-multiplicado com alfa: é o contrato do overlay do app
     (`sketch_reference.frag` devolve `vec4(a,a,a,a)`), então o guia já sai
     pronto e o shader não precisa reinterpretar nada. */
  const big = document.createElement('canvas');
  big.width = W; big.height = H;
  const bctx = big.getContext('2d')!;
  const img = bctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const src = (H - 1 - y) * W;          // readRenderTargetPixels é de baixo p/ cima
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4;
      const v = cur[src + x] ? 255 : 0;
      img.data[o] = v; img.data[o + 1] = v; img.data[o + 2] = v; img.data[o + 3] = v;
    }
  }
  bctx.putImageData(img, 0, 0);

  out.width = p.w; out.height = p.h;
  outCtx.clearRect(0, 0, p.w, p.h);
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(big, 0, 0, p.w, p.h);
  return out.toDataURL('image/png');
}

function drawShaded(p: Pose) {
  useShaded();
  placeLights();
  renderer.setSize(p.w * SS, p.h * SS, false);
  renderer.setRenderTarget(null);
  renderer.clear();
  renderer.render(scene, camera);

  out.width = p.w; out.height = p.h;
  outCtx.clearRect(0, 0, p.w, p.h);
  outCtx.imageSmoothingEnabled = true;
  outCtx.imageSmoothingQuality = 'high';
  outCtx.drawImage(canvas, 0, 0, p.w, p.h);
  return out.toDataURL('image/png');
}

/** As luzes acompanham a CÂMERA em azimute, e o veículo em altura. */
function placeLights() {
  const c = box.getCenter(new THREE.Vector3());
  const r = box.getSize(new THREE.Vector3()).length() * 0.5;

  const v = new THREE.Vector3().subVectors(camera.position, c);
  v.y = 0;
  if (v.lengthSq() < 1e-6) v.set(0, 0, 1);
  v.normalize();
  const side = new THREE.Vector3(-v.z, 0, v.x);

  key.position.copy(c).addScaledVector(v, r * 0.9).addScaledVector(side, r * 1.1)
    .add(new THREE.Vector3(0, r * 1.5, 0));
  key.target.position.copy(c);
  key.target.updateMatrixWorld();
  const sc = key.shadow.camera as THREE.OrthographicCamera;
  sc.left = -r * 1.2; sc.right = r * 1.2; sc.top = r * 1.2; sc.bottom = -r * 1.2;
  sc.near = 0.5; sc.far = r * 6;
  sc.updateProjectionMatrix();

  fill.position.copy(c).addScaledVector(v, r * 1.2).addScaledVector(side, -r * 1.2)
    .add(new THREE.Vector3(0, r * 0.6, 0));
  fill.target.position.copy(c);
  fill.target.updateMatrixWorld();

  softTop.position.set(c.x, box.max.y + 3.2, c.z);
  softTop.lookAt(c.x, box.max.y, c.z);

  softSide.position.copy(c).addScaledVector(v, r * 0.85).add(new THREE.Vector3(0, 1.2, 0));
  softSide.lookAt(c.x, c.y + 0.6, c.z);

  softKick.position.copy(c).addScaledVector(v, -r * 0.8).addScaledVector(side, -r * 0.6)
    .add(new THREE.Vector3(0, 1.6, 0));
  softKick.lookAt(c.x, c.y, c.z);
}

/* -------------------------------------------------------------------- main */
async function main() {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  scene.environmentIntensity = 0.55;

  await build();

  /* Sonda: histograma dos X da pele, em décimos de milímetro. Se o achatamento
     funcionou, sobra UM valor por lado. */
  (window as unknown as Record<string, unknown>).__xhist = () => {
    const h = new Map<number, number>();
    for (const q of parts) {
      if (q.grp !== GRP.BAU) continue;
      const a = q.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < a.count; i++) {
        const x = a.getX(i);
        if (Math.abs(x) < 1.2) continue;
        const k = Math.round(x * 10000);
        h.set(k, (h.get(k) || 0) + 1);
      }
    }
    return [...h.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)
      .map(([k, n]) => [k / 10000, n]);
  };

  window.__setDims = (patch) => {
    const d = rig.set(patch);
    root.updateMatrixWorld(true);
    flattenRibs();
    box = new THREE.Box3();
    for (const p of parts) { const b = boxIn(p.mesh); if (b) box.union(b); }
    return d;
  };

  window.__shot = (pose, kind, cam) => {
    renderer.setSize(pose.w * SS, pose.h * SS, false);
    const meta: Record<string, unknown> = { ...(cam ? apply(pose, cam) : solve(pose)) };
    const r: { guide?: string; shaded?: string; meta: unknown } = { meta };
    if (kind === 'guide' || kind === 'both') r.guide = drawGuide(pose);
    if (kind === 'shaded' || kind === 'both') r.shaded = drawShaded(pose);
    meta.stats = lastGuideStats;
    return r;
  };

  window.__ready = true;
}

main().catch((e) => { window.__error = String(e?.stack || e); window.__ready = true; });
