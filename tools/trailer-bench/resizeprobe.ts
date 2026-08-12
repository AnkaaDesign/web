/* Bancada do RESIZE — a linha horizontal que aparece no painel ao mudar a
   altura.
   ---------------------------------------------------------------------------
   O defeito relatado (2026-08-09, aberto): mudar a ALTURA do implemento faz
   aparecer uma linha/vinco horizontal correndo o painel lateral branco. Este
   arquivo existe para transformar o relato numa matriz de imagens comparáveis:

     · a MESMA vista ortográfica da lateral, em várias alturas;
     · com o conjunto completo (`TrailerRig` = body + assembly, o que o app
       usa) e com o corpo sozinho (`TrailerBody`) — se a linha só existe com o
       conjunto, ela é de `trailer-assembly.ts`; se existe nos dois, é do
       empilhamento de frisos em `trailer-geometry.ts`;
     · em close na faixa de altura onde a linha aparece, porque a tela do
       relato é um close.

   Ortográfica de propósito: uma costura de milímetros some numa perspectiva de
   conjunto e vira meia dúzia de pixels estáveis numa ortográfica com px/m
   fixo — dá para fazer diff de imagem entre alturas. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TrailerRig } from '@/pages/tools/truck-studio/engine/vehicle/trailer-rig';

declare global {
  interface Window {
    __ready?: boolean;
    __error?: string;
    __diag?: unknown;
    /** Fotografa a lateral `right`. `height` em metros (0 = fábrica);
     *  `win` = [yLo, yHi] em metros RELATIVOS AO PISO para o close (ausente =
     *  painel inteiro). */
    __shot?: (height: number, win: [number, number] | null) => string;
    /** Close de alta densidade: janela [yLo,yHi]×[zLo,zHi] em metros
     *  (y relativo ao piso, z absoluto), na densidade pedida. */
    __closeup?: (height: number, yLo: number, yHi: number,
      zLo: number, zHi: number, pxPerM: number) => string;
    /** Idem, com MeshNormalMaterial — costura de normal vira degrau de cor. */
    __closeupNormals?: (height: number, yLo: number, yHi: number,
      zLo: number, zHi: number, pxPerM: number) => string;
    /** Perfil da parede por raio: para cada passo de y, a PROFUNDIDADE x do
     *  primeiro acerto vindo de fora. Degrau ou buraco na costura vira número. */
    __scanY?: (height: number, z: number, yLo: number, yHi: number,
      stepMm: number) => { y: number; x: number | null; obj: string }[];
  }
}

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2d31);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

/* Luz levemente rasante de cima: é a que denuncia vinco — uma luz frontal
   chapada esconderia exatamente o que se procura. */
const key = new THREE.DirectionalLight(0xffffff, 1.8);
key.position.set(8, 12, 2);
scene.add(key, new THREE.AmbientLight(0xffffff, 0.5));

async function main() {
  const draco = new DRACOLoader();
  draco.setDecoderPath('/vendor/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  const gltf = await loader.loadAsync('/models/vehicles/trailer.glb');
  const root = gltf.scene;
  root.updateWorldMatrix(true, true);
  scene.add(root);

  /* O RIG COMPLETO, como o app monta — body + assembly. A pose é a de carga
     (raiz na identidade), que é a exigência do `assembly.set()`. */
  const rig = new TrailerRig(root);
  const prof = rig.profile;

  window.__diag = {
    base: rig.base,
    perfil: {
      frisos: prof.ribCount, passo_mm: +(prof.pitch * 1000).toFixed(2),
      saia_mm: +(prof.skirtHeight * 1000).toFixed(1),
      arremate_mm: +(prof.capHeight * 1000).toFixed(1),
      piso: +prof.floorY.toFixed(4), teto: +prof.roofY.toFixed(4),
    },
    /* A conferência numérica sugerida pelo mapa do assembly: o branco sobe
       `height − base.height` EXATO; o conjunto sobe `dRoof` proporcional. Se
       `base.height` divergir do vão real piso→teto, todo `roof` desliza. */
    altura_base_vs_corpo_mm: +(((prof.roofY - prof.floorY) - prof.base.height) * 1000).toFixed(3),
  };

  window.__shot = (height, win) => {
    const want = height > 0 ? height : rig.base.height;
    const d = rig.set({ height: want });

    const skin = prof.width / 2;
    const yLo = win ? prof.floorY + win[0] : prof.floorY - 0.15;
    const yHi = win ? prof.floorY + win[1] : prof.floorY + d.height + 0.1;
    const z0 = prof.z1 - d.length, z1 = prof.z1;

    const w = z1 - z0 + 0.3, h = yHi - yLo;
    /* px/m constante entre alturas do MESMO enquadramento: 3072 px de largura
       para o painel inteiro, o que dá ~200 px/m — e o close herda a densidade
       da janela dele. */
    const wPx = Math.min(3072, Math.round(w * 400));
    const hPx = Math.max(64, Math.round(wPx * (h / w)));
    renderer.setSize(wPx, hPx, false);

    const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 12);
    cam.position.set(skin + 6, (yLo + yHi) / 2, (z0 + z1) / 2);
    cam.lookAt(skin, (yLo + yHi) / 2, (z0 + z1) / 2);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);

    renderer.render(scene, cam);
    return renderer.domElement.toDataURL('image/png');
  };

  window.__closeup = (height, yLo, yHi, zLo, zHi, pxPerM) => {
    const want = height > 0 ? height : rig.base.height;
    rig.set({ height: want });

    const skin = prof.width / 2;
    const y0 = prof.floorY + yLo, y1 = prof.floorY + yHi;
    const w = zHi - zLo, h = y1 - y0;
    const wPx = Math.min(4096, Math.round(w * pxPerM));
    const hPx = Math.min(4096, Math.round(h * pxPerM));
    renderer.setSize(wPx, hPx, false);

    const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 12);
    cam.position.set(skin + 6, (y0 + y1) / 2, (zLo + zHi) / 2);
    cam.lookAt(skin, (y0 + y1) / 2, (zLo + zHi) / 2);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    renderer.render(scene, cam);
    return renderer.domElement.toDataURL('image/png');
  };

  /* O MESMO close com `MeshNormalMaterial`: costura de normal vira degrau de
     COR, independente de luz — é o teste que decide se a linha do relato é
     sombreamento (normais) ou geometria. */
  window.__closeupNormals = (height: number, yLo: number, yHi: number,
    zLo: number, zHi: number, pxPerM: number) => {
    scene.overrideMaterial = new THREE.MeshNormalMaterial();
    try {
      return window.__closeup!(height, yLo, yHi, zLo, zHi, pxPerM);
    } finally {
      scene.overrideMaterial = null;
    }
  };

  window.__scanY = (height, z, yLo, yHi, stepMm) => {
    const want = height > 0 ? height : rig.base.height;
    rig.set({ height: want });
    const skin = prof.width / 2;
    const ray = new THREE.Raycaster();
    const out: { y: number; x: number | null; obj: string }[] = [];
    const dir = new THREE.Vector3(-1, 0, 0);
    for (let y = prof.floorY + yLo; y <= prof.floorY + yHi; y += stepMm / 1000) {
      ray.set(new THREE.Vector3(skin + 2, y, z), dir);
      const hit = ray.intersectObjects([root], true)
        .filter((h) => (h.object as THREE.Mesh).visible)[0];
      out.push({
        y: +(y - prof.floorY).toFixed(4),
        x: hit ? +hit.point.x.toFixed(5) : null,
        obj: hit ? `${hit.object.name || '(sem nome)'}` : '(vazio)',
      });
    }
    return out;
  };

  window.__ready = true;
}

main().catch((e) => {
  window.__error = (e && (e.stack || e.message)) || String(e);
  window.__ready = true;
});
