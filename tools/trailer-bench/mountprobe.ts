/* Bancada de MONTAGEM — onde o sobrechassi assenta no chassi de um rígido.
   ---------------------------------------------------------------------------
   O semirreboque tem um contrato de engate MEDIDO (`hitch.json` + o pino-rei
   remedido em `TrailerRig.hitch`). O sobrechassi não tem engate nenhum: ele é
   APARAFUSADO no quadro de um caminhão rígido, e o contrato equivalente é outro
   — três números, e nenhum deles existia no acervo:

     frameTopY   a MESA da longarina, onde o sub-chassi da carroceria assenta
     cabRearZ    até onde a cabine vai; a carroceria começa depois de uma folga
     frameEndZ   a ponta do quadro, que limita o balanço traseiro

   Por que uma bancada e não uma conta: os três saem de malha de rip, e num rip
   "o chassi" é uma malha fundida que traz travessa, suporte de para-lama, caixa
   de bateria e escapamento junto. O máximo global mente sempre (é uma travessa
   ou um suporte), e a mediana pode mentir se a peça longa não for a longarina.
   Então mede-se por PERCENTIL e se OLHA — que é a mesma doutrina de
   `measureSill()`, com a diferença de que aqui o erro não é de milímetros: um
   plano de montagem 100 mm errado põe a carroceria flutuando ou enterrada no
   quadro, e isso se vê.

   O que ela imprime, e o que ela desenha:

     · as medidas dos dois modelos, no mesmo referencial (chão em y = 0);
     · PLANOS CANDIDATOS — lâminas coloridas nas alturas testadas, para a foto
       dizer qual delas rasa a mesa da longarina;
     · a carroceria assentada na altura escolhida, com a folga da cabine.

   USO
       node tools/trailer-bench/shoot-mount.mjs [caminhao.glb] [percentil]
*/
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

declare global {
  interface Window {
    __ready?: boolean;
    __error?: string;
    __diag?: unknown;
    __shot?: (dir: number[], target: number[] | null, dist: number, planes?: boolean) => string;
  }
}

const W = 1600, H = 900;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H);
renderer.setPixelRatio(Math.max(1, Math.min(4, +(new URLSearchParams(location.search).get('ss') || 1))));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x23262b);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(6, 9, 5);
scene.add(key, new THREE.AmbientLight(0xffffff, 0.4));
const camera = new THREE.PerspectiveCamera(32, W / H, 0.05, 400);

/** Caixa de um objeto medida VÉRTICE A VÉRTICE em mundo, opcionalmente
 *  filtrando malhas — `Box3.setFromObject()` de um nó girado devolve a caixa de
 *  uma caixa girada, estritamente maior, e aqui a diferença é o número. */
function boxOf(root: THREE.Object3D, keep?: (m: THREE.Mesh) => boolean) {
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
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

const matNames = (m: THREE.Mesh) =>
  (Array.isArray(m.material) ? m.material : [m.material]).map((x) => x?.name || '').join('+');

/** Nome do nó ou de um ancestral, até a raiz dada. */
function chainName(o: THREE.Object3D, root: THREE.Object3D) {
  const parts: string[] = [];
  for (let k: THREE.Object3D | null = o; k && k !== root; k = k.parent) parts.push(k.name || '');
  return parts.join('/');
}

async function main() {
  const q = new URLSearchParams(location.search);
  const truckFile = q.get('truck') || 'volvo_vm_2015.glb';
  const bodyFile = q.get('body') || 'sobrechassi_frigorifico_gancheiro.glb';
  const pct = +(q.get('pct') || 0.75);
  const gap = +(q.get('gap') || 0.15);

  const draco = new DRACOLoader();
  draco.setDecoderPath('/vendor/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);

  const [tg, bg] = await Promise.all([
    loader.loadAsync('/models/trucks/' + truckFile).catch(() => loader.loadAsync('/models/vehicles/' + truckFile)),
    loader.loadAsync('/models/vehicles/' + bodyFile),
  ]);
  const truck = tg.scene, body = bg.scene;
  scene.add(truck, body);

  /* ⚠️ OS DOIS GLB APONTAM PARA LADOS OPOSTOS, e ignorar isso põe a carroceria
     à frente do capô — foi o primeiro resultado desta bancada.

     `hitch.json` declara `axes.forward: "+Z"` como o espaço NORMALIZADO e traz
     `orientYaw: π` para cada cavalo: no GLB cru eles apontam para −Z (o eixo
     direcional do VM está em z −1,85 e a ponta do quadro em +7,25). Os dois
     rígidos vêm da mesma fonte que a frota, então herdam a mesma convenção.

     O IMPLEMENTO não passa por isso: a testeira dele é o MAIOR z e continua
     sendo (é o que `state.trailerBase.frontZ` lê). Ou seja, depois de
     normalizado o cavalo, a carroceria é montada com a testeira no MAIOR z da
     zona de carroceria, andando para −Z — que é para onde o semirreboque
     também anda. */
  truck.rotation.y = +(q.get('yaw') ?? Math.PI);
  truck.updateWorldMatrix(true, true);

  /* ---------------- o CAMINHÃO ---------------- */
  const tyres = (m: THREE.Mesh) => /tire|pneu/i.test(chainName(m, truck) + matNames(m));
  const tyreBox = boxOf(truck, tyres);
  const groundY = tyreBox.min.y;
  truck.position.y -= groundY;                    // pneu no chão, como o app faz
  truck.updateWorldMatrix(true, true);

  const cabBox = boxOf(truck, (m) => /^(cabin|interior|sunshld|s_mirror|mirror)/i.test(chainName(m, truck)));
  /* Normalizado, a cabine está no +Z e a zona de carroceria corre para −Z: a
     traseira da cabine é o MENOR z dela. */
  const cabRearZ = cabBox.min.z;

  /* A mesa da longarina: máximo por célula de 250 mm na bitola do perfil, e o
     PERCENTIL das células. `pct` é argumento porque é a única coisa aqui que
     não é medida — é escolha, e a foto é quem a fecha. */
  const railLo = 0.25, railHi = 0.55, cell = 0.25;
  const cells = new Map<number, number>();
  const v = new THREE.Vector3();
  let frameEndZ = Infinity;
  truck.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry?.attributes?.position) return;
    if (!/chassis|chs_base/i.test(chainName(m, truck))) return;
    const pos = m.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      if (v.z < frameEndZ) frameEndZ = v.z;          // a ponta do quadro é o MENOR z
      const ax = Math.abs(v.x);
      if (ax < railLo || ax > railHi || v.z > cabRearZ) continue;
      const k = Math.round(v.z / cell);
      const cur = cells.get(k);
      if (cur === undefined || v.y > cur) cells.set(k, v.y);
    }
  });
  /* A MESA, MEDIDA POR FACE E NÃO POR VÉRTICE.
     O máximo por célula sobe com qualquer coisa que passe pela janela — uma
     travessa, um suporte de para-lama, o berço do eixo elevatório. Medido no
     VM, ele desenha uma RAMPA de 200 mm em 8 m, e longarina reta não faz rampa:
     o que estava sendo medido não era a mesa.
     A mesa é uma superfície HORIZONTAL e VOLTADA PARA CIMA, e é a maior delas
     na faixa da longarina. Então: triângulo a triângulo, normal de mundo com
     ny > 0,9, e o histograma é ponderado por ÁREA — assim uma cantoneira de
     20 cm² não disputa com uma mesa de 8 m. */
  const flat = new Map<number, number>();          // y (célula de 5 mm) → área
  {
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const ab = new THREE.Vector3(), ac = new THREE.Vector3(), nrm = new THREE.Vector3();
    truck.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry?.attributes?.position) return;
      if (!/chassis|chs_base/i.test(chainName(m, truck))) return;
      const pos = m.geometry.attributes.position as THREE.BufferAttribute;
      const idx = m.geometry.getIndex();
      const n = idx ? idx.count : pos.count;
      for (let i = 0; i < n; i += 3) {
        const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
        a.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld);
        b.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld);
        c.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
        const cz = (a.z + b.z + c.z) / 3, cx2 = Math.abs((a.x + b.x + c.x) / 3);
        if (cz > cabRearZ || cz < frameEndZ) continue;
        if (cx2 < railLo || cx2 > railHi) continue;
        ab.subVectors(b, a); ac.subVectors(c, a); nrm.crossVectors(ab, ac);
        const area = nrm.length() / 2;
        if (area < 1e-9) continue;
        if (nrm.y / (area * 2) < 0.9) continue;      // só face para CIMA
        const k = Math.round(((a.y + b.y + c.y) / 3) * 200) / 200;
        flat.set(k, (flat.get(k) || 0) + area);
      }
    });
  }
  const flatTop = [...flat.entries()].sort((a2, b2) => b2[1] - a2[1]).slice(0, 8);

  const vals = [...cells.values()].sort((a, b) => a - b);
  const at = (p: number) => vals[Math.min(vals.length - 1, Math.floor(vals.length * p))];
  const frameTopY = vals.length ? at(pct) : 1.0;

  /* ---------------- a CARROCERIA ----------------
     O datum dela NÃO é o ponto mais baixo: as duas mangueiras traseiras
     penduram 800 mm abaixo do sub-chassi e assentar por elas põe a carroceria
     0,8 m alta. O datum é o ESTRUTURAL — tudo menos a família das mangueiras. */
  const bodyAll = boxOf(body);
  const bodyStruct = boxOf(body, (m) => !/^metal-pouco-polido$/i.test(matNames(m)));
  const bodyBottom = bodyStruct.min.y;
  const bodyFrontZ = bodyStruct.max.z;              // testeira: maior z
  const bodyLen = bodyStruct.max.z - bodyStruct.min.z;

  /* ---------------- assentar ---------------- */
  body.position.y += frameTopY - bodyBottom;
  body.position.z += (cabRearZ - gap) - bodyFrontZ;
  body.updateWorldMatrix(true, true);
  const placed = boxOf(body, (m) => !/^metal-pouco-polido$/i.test(matNames(m)));

  /* ---------------- planos candidatos ---------------- */
  const planes = new THREE.Group();
  planes.name = 'PLANOS';
  const candidates: [number, number][] = [
    [at(0.25), 0xff4444], [at(0.5), 0xffaa00], [at(0.75), 0x33cc55], [at(0.9), 0x3399ff],
  ];
  /* Lâminas ESTREITAS e SÓ DO LADO DA CÂMERA (x positivo), rentes à face
     externa da longarina. Uma lâmina larga tapa o quadro e a foto não decide
     nada — foi o primeiro enquadramento e não serviu para ler altura nenhuma.
     Assim cada lâmina fica encostada no perfil e a leitura é direta: a que
     rasa a mesa é a que some na aresta de cima. */
  for (const [y, color] of candidates) {
    const g = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.004, Math.max(0.5, cabRearZ - frameEndZ)),
      new THREE.MeshBasicMaterial({ color }),
    );
    g.position.set(0.53, y, (cabRearZ + frameEndZ) / 2);
    planes.add(g);
  }
  planes.visible = false;
  scene.add(planes);

  const f = (n: number) => +n.toFixed(4);
  window.__diag = {
    caminhao: {
      arquivo: truckFile,
      chao_original_y: f(groundY),
      cabine_traseira_z: f(cabRearZ),
      cabine_topo_y: f(cabBox.max.y),
      quadro_fim_z: f(frameEndZ),
      util_atras_da_cabine: f(cabRearZ - frameEndZ),
      mesa_celulas: vals.length,
      mesa_p25: f(at(0.25)), mesa_p50: f(at(0.5)), mesa_p75: f(at(0.75)), mesa_p90: f(at(0.9)),
      mesa_min: f(vals[0]), mesa_max: f(vals[vals.length - 1]),
      escolhido_pct: pct, escolhido_y: f(frameTopY),
      /* O PERFIL CRU, célula a célula ao longo de z. É ele que mostra se a
         mesa é um PLATÔ (uma longarina reta, e aí o percentil é só escolher o
         platô) ou uma rampa (e aí a peça medida não é a longarina). */
      mesa_por_area: flatTop.map(([y, ar]) => `${y.toFixed(3)}:${ar.toFixed(3)}m²`).join('  '),
      mesa_perfil: [...cells.entries()].sort((a, b) => b[0] - a[0])
        .map(([k, y]) => `${(k * cell).toFixed(2)}:${y.toFixed(3)}`).join(' '),
    },
    carroceria: {
      arquivo: bodyFile,
      caixa_total_y: [f(bodyAll.min.y), f(bodyAll.max.y)],
      caixa_estrutural_y: [f(bodyStruct.min.y), f(bodyStruct.max.y)],
      pendurado_abaixo_mm: f((bodyStruct.min.y - bodyAll.min.y) * 1000),
      comprimento: f(bodyLen),
      folga_cabine: gap,
    },
    montado: {
      piso_carroceria_y: f(placed.min.y),
      teto_y: f(placed.max.y),
      altura_total: f(placed.max.y),
      z: [f(placed.min.z), f(placed.max.z)],
      balanco_traseiro: f(frameEndZ - placed.min.z),
      sobra_de_quadro: f((cabRearZ - frameEndZ) - bodyLen - gap),
      teto_acima_da_cabine: f(placed.max.y - cabBox.max.y),
    },
  };

  const whole = new THREE.Box3().union(boxOf(truck)).union(placed);
  const centre = whole.getCenter(new THREE.Vector3());
  const radius = whole.getSize(new THREE.Vector3()).length() / 2;
  window.__shot = (dir, target, dist, showPlanes) => {
    planes.visible = !!showPlanes;
    body.visible = !showPlanes;
    const t = target && target.length ? new THREE.Vector3(...target) : centre;
    const d = new THREE.Vector3(...dir).normalize();
    camera.position.copy(t).addScaledVector(d, dist || radius * 1.7);
    camera.lookAt(t);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    const png = renderer.domElement.toDataURL('image/png');
    planes.visible = false; body.visible = true;
    return png;
  };
  window.__ready = true;
}

main().catch((e) => {
  window.__error = (e as Error)?.stack || String(e);
  window.__ready = true;
});
