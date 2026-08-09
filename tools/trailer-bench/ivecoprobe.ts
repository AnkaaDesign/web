/* O Iveco S-Way pode ser UM modelo com a Metallica como COR?
   ---------------------------------------------------------------------------
   O bake do Metallica traz a película ASSADA no albedo da tinta: todo material
   `*_carpaint_color` chega com um `map` chamado `*_carpaint_color_assada`,
   enquanto no rip de fábrica (ver o Volvo) o `carpaint_color` vem SEM textura.
   É por isso que o modelo declara `paintMaterials: []` — pintar multiplicava
   textura x cor e devolvia a película em tons da cor escolhida.

   A pergunta que este arquivo responde com pixel: derrubando esse `map`, sobra
   um S-Way liso e pintável? Se sobrar, o mesmo arquivo serve de "S-Way 480" em
   qualquer cor E de "S-Way 480 Metallica", e a Metallica vira o que o dono do
   produto pediu — uma cor, não um modelo. Se não sobrar (se o `map` carregar
   sombra de painel, sujeira ou vinco que a tinta lisa perde), então manter as
   duas malhas é o unico caminho honesto.

   Roda com: node tools/trailer-bench/shoot-iveco.mjs */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { setupCommon } from '@/pages/tools/truck-studio/engine/vehicle/material-setup';

const W = 1100, H = 750;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(W, H);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb6bcc4);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;
const key = new THREE.DirectionalLight(0xffefe1, 2.4);
key.position.set(7, 9, 8);
scene.add(key, key.target);
scene.add(new THREE.HemisphereLight(0x8fb8f0, 0x514c44, 0.45));

const camera = new THREE.PerspectiveCamera(32, W / H, 0.05, 200);

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('/vendor/draco/');
loader.setDRACOLoader(draco);
const load = (u: string) => new Promise<THREE.Group>((ok, no) =>
  loader.load(u, (g) => ok(g.scene), undefined, no));

/** Os materiais de tinta do rip, pelo mesmo critério de material-setup.ts. */
const PAINT_RE = /carpaint|plain_grey/i;

const diag: Record<string, unknown> = {};
let truck: THREE.Object3D;
const paintMats: THREE.MeshStandardMaterial[] = [];
const bakedMap = new Map<THREE.MeshStandardMaterial, THREE.Texture | null>();

(async () => {
  truck = await load('/studio-assets/v1/models/trucks/iveco_metallica_4x2.glb');
  setupCommon(truck);
  scene.add(truck);
  truck.updateWorldMatrix(true, true);

  const seen = new Set<string>();
  const rows: string[] = [];
  truck.traverse((n) => {
    const o = n as THREE.Mesh;
    if (!o.isMesh) return;
    for (const raw of (Array.isArray(o.material) ? o.material : [o.material])) {
      const m = raw as THREE.MeshStandardMaterial;
      if (!m || seen.has(m.uuid)) continue;
      seen.add(m.uuid);
      if (!PAINT_RE.test(m.name || '')) continue;
      paintMats.push(m);
      bakedMap.set(m, m.map ?? null);
      rows.push(`${m.name} map=${m.map ? (m.map.name || 'sim') : 'NAO'} `
        + `alpha=${m.alphaTest || 0} transp=${m.transparent}`);
    }
  });
  diag.paintMats = rows;

  /* Enquadramento fixo: a mesma caixa nos dois lados do A/B. */
  const box = new THREE.Box3().setFromObject(truck);
  const c = box.getCenter(new THREE.Vector3());
  const r = box.getSize(new THREE.Vector3()).length() / 2;
  const dist = r / Math.tan((camera.fov * Math.PI / 180) / 2) / 0.9;
  camera.position.copy(c).add(new THREE.Vector3(1, 0.42, 1).normalize().multiplyScalar(dist));
  camera.lookAt(c);
  camera.updateProjectionMatrix();
  key.target.position.copy(c);
  key.target.updateMatrixWorld(true);

  (window as unknown as Record<string, unknown>).__diag = diag;
  (window as unknown as Record<string, unknown>).__ready = true;
})().catch((e) => {
  (window as unknown as Record<string, unknown>).__error = String(e?.stack || e);
  (window as unknown as Record<string, unknown>).__ready = true;
});

/**
 * @param mode 'pelicula' devolve o arquivo como ele é; qualquer outro valor
 *   derruba o `map` assado e pinta com o hex pedido — que é o que o motor de
 *   tinta faria se `paintMaterials` apontasse para estes materiais.
 */
(window as unknown as Record<string, unknown>).__shot = (mode: string, hex: number) => {
  for (const m of paintMats) {
    if (mode === 'pelicula') {
      m.map = bakedMap.get(m) ?? null;
      m.color.setRGB(1, 1, 1);
    } else {
      /* `alphaTest`/`transparent` vinham do mapa: sem ele, uma chapa com
         alphaTest some inteira. As grades (`*_colmeia`) sao MASK de verdade e
         ficam de fora do teste acima por nao casarem PAINT_RE... exceto as
         `carpaint_net_color`, que sao grade E tinta — por isso o mapa delas
         nao pode cair. */
      const keepMask = /net_color|colmeia/i.test(m.name || '');
      m.map = keepMask ? (bakedMap.get(m) ?? null) : null;
      m.color.setHex(hex);
    }
    m.needsUpdate = true;
  }
  renderer.render(scene, camera);
  return renderer.domElement.toDataURL('image/png');
};
