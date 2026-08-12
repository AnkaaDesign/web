/* Bancada da rodagem: roda o CÓDIGO DE VERDADE (swapTrailerWheels) num
   three.js headless e devolve pixel + diagnóstico. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { setupCommon } from '@/pages/tools/truck-studio/engine/vehicle/material-setup';
import { swapTrailerWheels } from '@/pages/tools/truck-studio/engine/vehicle/wheels';

const W = 1100, H = 750;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(W, H);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9aa3ad);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;

const key = new THREE.DirectionalLight(0xffefe1, 2.6);
key.position.set(6, 9, 7);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -6; key.shadow.camera.right = 6;
key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
key.shadow.camera.near = 1; key.shadow.camera.far = 40;
scene.add(key, key.target);
scene.add(new THREE.HemisphereLight(0x8fb8f0, 0x514c44, 0.5));

const camera = new THREE.PerspectiveCamera(35, W / H, 0.05, 400);

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('/vendor/draco/');
loader.setDRACOLoader(draco);
const load = (u: string) => new Promise<THREE.Group>((ok, no) =>
  loader.load(u, (g) => ok(g.scene), undefined, no));

const V = '/studio-assets/v1/models/vehicles/';
const diag: Record<string, unknown> = {};

function describe(root: THREE.Object3D, label: string) {
  const out: string[] = [];
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    const kind = o.isMesh ? 'Mesh' : (o as THREE.Object3D).type;
    if (!o.isMesh) { out.push(`${kind} "${o.name}" (${o.children.length} filhos)`); return; }
    const mats = (Array.isArray(o.material) ? o.material : [o.material])
      .map((m) => {
        const s = m as THREE.MeshStandardMaterial;
        return `${s?.name}[map=${s?.map ? 'y' : 'n'} nrm=${s?.normalMap ? 'y' : 'n'}`
          + ` met=${s?.metalness?.toFixed(2)} rug=${s?.roughness?.toFixed(2)}`
          + ` env=${s?.envMapIntensity?.toFixed(2)} vc=${s?.vertexColors ? 'y' : 'n'}`
          + ` side=${s?.side} vis=${s?.visible}]`;
      }).join(' + ');
    const pos = o.geometry?.getAttribute('position');
    const attrs = Object.keys(o.geometry?.attributes ?? {}).join(',');
    o.geometry?.computeBoundingBox();
    const b = o.geometry?.boundingBox;
    out.push(`Mesh "${o.name}" v=${pos?.count} attrs=[${attrs}] vis=${o.visible}`
      + ` bbox=[${b?.min.toArray().map((n) => n.toFixed(3))}]..[${b?.max.toArray().map((n) => n.toFixed(3))}]`
      + ` mats=${mats}`);
  });
  diag[label] = out;
}

function worldBox(o: THREE.Object3D) {
  const b = new THREE.Box3();
  o.updateWorldMatrix(true, true);
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      b.expandByPoint(v);
    }
  });
  return b;
}

let trailer: THREE.Object3D;
let originals: THREE.Mesh[] = [];
const tyreMats: THREE.MeshStandardMaterial[] = [];

(async () => {
  trailer = await load(V + 'trailer.glb');
  setupCommon(trailer);
  scene.add(trailer);
  trailer.updateWorldMatrix(true, true);

  originals = [];
  trailer.traverse((n) => {
    const o = n as THREE.Mesh;
    if (!o.isMesh) return;
    const mats = (Array.isArray(o.material) ? o.material : [o.material]) as THREE.Material[];
    if (mats.some((m) => m && /^(pneu-(corpo|lateral)|aro-rodas)$/i.test(m.name || ''))) {
      originals.push(o);
    }
  });
  diag.originais = originals.length;

  const asset = await load(V + 'wheel_fh16_v2.glb');
  setupCommon(asset);
  describe(asset, 'asset');

  const placed = swapTrailerWheels(trailer, asset);
  diag.placed = placed;

  /* O que `applyTrailerFinish()` faria com o pneu no app (TRAILER_RUBBER_RE).
     Sem isto a bancada mostraria a borracha a env 1.35 e a comparação mentiria
     para os dois lados. */
  const seen = new Set<string>();
  trailer.traverse((n) => {
    const o = n as THREE.Mesh;
    if (!o.isMesh) return;
    for (const raw of (Array.isArray(o.material) ? o.material : [o.material])) {
      const m = raw as THREE.MeshStandardMaterial;
      if (!m || seen.has(m.uuid)) continue;
      seen.add(m.uuid);
      /* A roda autorada sai intocada — é a regra nova (FH16_WHEEL_RE). */
      if (/-fh16(\.\d+)?$/i.test(m.name || '')) { tyreMats.push(m); continue; }
      if (/^borracha|aparabarro|^pneu/i.test(m.name || '')) m.envMapIntensity = 0.3;
      /* A FERRAGEM DE INOX (2026-08-12). No app, `splitTrailerHardware()`
         CLONA este material por MALHA antes do acabamento e só o trilho
         (z-span ≥ 2 m) fica com o piso de 0,62. Esta varredura é por MATERIAL,
         então ela não tem como reproduzir a divisão — e trata a família
         inteira como ferragem.

         A aproximação é boa AQUI e só aqui: esta bancada existe para o A/B da
         RODAGEM, e o que ela enquadra é o rodado. As 27 malhas de trilho
         (flanco e proteção de piso) saem 0,32 mais polidas do que no app e
         nenhuma delas aparece no quadro. Quem for fotografar o FLANCO por esta
         bancada precisa da divisão de verdade, não desta linha. */
      else if (/^inox-ferragem$|^metal-pouco-polido$/i.test(m.name || '')) {
        m.metalness = 1;
        m.roughness = Math.min(m.roughness ?? 1, 0.30);
        m.envMapIntensity = 1.0;
      } else if (/galvanizado|estrutura-principal|^aro-rodas/i.test(m.name || '')) {
        if (!m.roughnessMap) m.roughness = Math.max(m.roughness ?? 0, 0.62);
        m.envMapIntensity = 1.0;
      }
      m.needsUpdate = true;
    }
  });

  /* O QUE O APP FAZ E A BANCADA NAO FAZIA. `refreshVehicleReflection()` prende
     o cubemap da sonda como `envMap` EXPLICITO em todo material do veiculo. Sem
     isso o material so recebe `scene.environment`, e neste caminho o quadro nao
     responde ao `envMapIntensity` por material — foi por isso que o primeiro
     A/B saiu byte a byte identico entre 0.3 e 8. Com o envMap preso, o
     multiplicador morde, que e o regime do app. */
  const bound = new Set<string>();
  trailer.traverse((n) => {
    const o = n as THREE.Mesh;
    if (!o.isMesh) return;
    for (const raw of (Array.isArray(o.material) ? o.material : [o.material])) {
      const m = raw as THREE.MeshStandardMaterial;
      if (!m || bound.has(m.uuid)) continue;
      bound.add(m.uuid);
      m.envMap = envTex;
      m.needsUpdate = true;
    }
  });
  diag.tyreMats = tyreMats.map((m) => `${m.name} env=${m.envMapIntensity}`);
  const units = trailer.children.filter((c) => c.name.startsWith('FH16_WHEEL_'));
  diag.units = units.map((u) => {
    const b = worldBox(u);
    return `${u.name} bbox=[${b.min.toArray().map((n) => n.toFixed(3))}]..`
      + `[${b.max.toArray().map((n) => n.toFixed(3))}] `
      + `filhos=${u.children.length} matrix=${u.matrix.elements.map((n) => n.toFixed(3)).join(',')}`;
  });
  if (units[0]) describe(units[0], 'unidade0');

  (window as unknown as Record<string, unknown>).__diag = diag;
  (window as unknown as Record<string, unknown>).__ready = true;
})().catch((e) => {
  (window as unknown as Record<string, unknown>).__error = String(e?.stack || e);
  (window as unknown as Record<string, unknown>).__ready = true;
});

/** Aponta a câmera para uma caixa. */
function frame(b: THREE.Box3, dir: [number, number, number], fill = 0.8) {
  const c = b.getCenter(new THREE.Vector3());
  const r = Math.max(0.2, b.getSize(new THREE.Vector3()).length() / 2);
  const d = new THREE.Vector3(...dir).normalize();
  const dist = r / Math.tan((camera.fov * Math.PI / 180) / 2) / fill;
  camera.position.copy(c).addScaledVector(d, dist);
  camera.lookAt(c);
  camera.updateProjectionMatrix();
  key.target.position.copy(c);
  key.position.copy(c).add(new THREE.Vector3(4, 6, 5));
  key.target.updateMatrixWorld(true);
  key.updateMatrixWorld(true);
}

/* A MESMA CAIXA nos dois lados do A/B. Enquadrar a roda nova numa foto e a
   velha noutra compara duas fotos, não duas rodas. */
let abBox: THREE.Box3 | null = null;

(window as unknown as Record<string, unknown>).__shot = (
  what: string, dir: [number, number, number], fill: number,
) => {
  const showNew = what !== 'original';
  /* 'escuro' reproduz o comportamento ANTIGO: o corte de borracha aplicado
     tambem a roda autorada. 'novo' e a regra atual — 1.35, como no cavalo. */
  const envOf: Record<string, number> = { escuro: 0.3, novo: 1.35, zero: 0, forte: 8 };
  if (what in envOf) {
    for (const m of tyreMats) { m.envMapIntensity = envOf[what]; m.needsUpdate = true; }
  }
  /* Sondas da PROPRIA bancada: se estas nao mudarem o quadro, nao ha IBL aqui
     e nenhuma conclusao sobre ambiente vale. */
  scene.environment = what === 'semambiente' ? null : envTex;
  scene.environmentIntensity = what === 'ambientex4' ? 4 : 1;
  for (const m of tyreMats) {
    if (what === 'corvermelha') m.color.setRGB(1, 0, 0); else m.color.setRGB(1, 1, 1);
    m.needsUpdate = true;
  }
  for (const u of trailer.children) {
    if (u.name.startsWith('FH16_WHEEL_')) u.visible = showNew;
  }
  for (const o of originals) o.visible = !showNew;

  if (!abBox) {
    const u = trailer.children.find((c) => c.name.startsWith('FH16_WHEEL_DUAL'));
    abBox = u ? worldBox(u) : new THREE.Box3().setFromObject(trailer);
  }
  frame(abBox, dir, fill);
  renderer.render(scene, camera);
  /* LER NO MESMO QUADRO. Sem `preserveDrawingBuffer` o backbuffer e limpo assim
     que o navegador compoe, entao um readPixels numa chamada posterior devolve
     zeros — foi exatamente o que aconteceu na primeira tentativa. */
  const gl = renderer.getContext();
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let sum = 0, n = 0, black = 0;
  for (let i = 0; i < W * H; i++) {
    const l = 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2];
    if (l < 110) { sum += l; n++; if (l < 12) black++; }   // o que e escuro: a borracha
  }
  (window as unknown as Record<string, unknown>).__lastLum =
    n ? { media: +(sum / n).toFixed(1), pixels: n, quasePreto: +(100 * black / n).toFixed(1) } : null;
  return renderer.domElement.toDataURL('image/png');
};
