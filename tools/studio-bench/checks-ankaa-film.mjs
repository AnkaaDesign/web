/* AS FOTOS DO FILME ANKAA — Volvo VM 6x2 rígido + sobrechassi de fábrica
   (2,68 larg. × 2,89 alt. × 8,66 compr.), plotado com o layout institucional.

       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-ankaa-film.mjs

   ⚠️ SEM `setTrailerDims()`. Recortar o baú para 8,60 × 2,60 desprega a
   ferragem da porta traseira — as dobradiças e as chapas de trava ficam
   flutuando ao lado do corpo (medido em 2026-09-03, lote A). A geometria de
   fábrica já está a 6 cm do alvo, então o recorte custava um defeito visível
   para comprar nada.

   ⚠️ A ARTE VEM DE `/studio-assets/v1/…`. A bancada só serve quatro prefixos;
   `/ankaa-layout-art.png` cru devolve 404, e o `File` resultante carrega o
   corpo "404" — o `fabric.FabricImage.fromURL()` rejeita EM SILÊNCIO dentro do
   ouvinte assíncrono e a chapa fica branca sem uma linha de erro.

   ⚠️ `controls.update()` APARADO. O OrbitControls aplica `maxDistance` a cada
   quadro; um perfil teleobjetivo pede 34 m e voltava aparado para dentro do
   limite — o caminhão saía cortado nas duas pontas. */
const out = [];
const B = window.__bench;
const LOTE = 'd';

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 10; i++) await B.frame();

const THREE = S.THREE;

/* ---------- 1 · o veículo ---------- */
await S.applyChoice({
  envId: 'estudio',
  manufacturerId: 'volvo', modelId: 'volvo-vm-2015', chassisId: '6x2r',
  colorId: null, finishId: null, trim: null,
}, { curtain: false });
await B.until(() => (S.state.cabDef?.file || '').includes('volvo_vm_2015_6x2r'), 300000);
await B.until(() => !!S.state.trailer, 300000);
for (let i = 0; i < 40; i++) await B.frame();
out.push(['dims-de-fabrica', S.trailerDims]);

/* ---------- 2 · a câmera, sem aparo ---------- */
S.controls.minDistance = 0.01;
S.controls.maxDistance = 1e6;
S.controls.enabled = false;
S.controls.update = () => false;

const caixa = () => new THREE.Box3().setFromObject(S.state.cab)
  .union(new THREE.Box3().setFromObject(S.state.trailer));

function enquadrar(azDeg, elDeg, fov, preenche = 0.9, alvoY = 0.5) {
  const box = caixa();
  const c = box.getCenter(new THREE.Vector3());
  const min = box.min, max = box.max;
  c.y = min.y + (max.y - min.y) * alvoY;
  const az = azDeg * Math.PI / 180, el = elDeg * Math.PI / 180;
  const dir = new THREE.Vector3(
    Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
  S.camera.fov = fov; S.camera.updateProjectionMatrix();
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(up, dir).normalize();
  const upC = new THREE.Vector3().crossVectors(dir, right).normalize();
  const tanV = Math.tan(fov * Math.PI / 360);
  const tanH = tanV * S.camera.aspect;
  let d = 0;
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
    const v = new THREE.Vector3(x, y, z).sub(c);
    const px = v.dot(right), py = v.dot(upC), pz = v.dot(dir);
    d = Math.max(d, pz + Math.abs(px) / tanH, pz + Math.abs(py) / tanV);
  }
  d /= preenche;
  S.camera.position.copy(c).addScaledVector(dir, d);
  S.controls.target.copy(c);
  S.camera.lookAt(c);
  S.camera.updateMatrixWorld(true);
  S.camera.updateProjectionMatrix();
  /* conferência: a caixa do veículo em NDC. |x|,|y| < 1 = coube. */
  let nx = 0, ny = 0;
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
    const p = new THREE.Vector3(x, y, z).project(S.camera);
    nx = Math.max(nx, Math.abs(p.x)); ny = Math.max(ny, Math.abs(p.y));
  }
  return { d: +d.toFixed(2), fov, ndc: [+nx.toFixed(3), +ny.toFixed(3)] };
}

async function foto(nome, azDeg, elDeg, fov, preenche, alvoY) {
  const info = enquadrar(azDeg, elDeg, fov, preenche, alvoY);
  for (let i = 0; i < 8; i++) await B.frame();
  enquadrar(azDeg, elDeg, fov, preenche, alvoY);   // reafirma depois dos quadros
  const cap = await B.captureViewport({ quality: 'medium', background: 'cena' });
  const bmp = await createImageBitmap(cap.blob);
  const cv = document.createElement('canvas');
  cv.width = bmp.width; cv.height = bmp.height;
  cv.getContext('2d').drawImage(bmp, 0, 0);
  out.push([nome + '-info', { ...info, w: cap.width, h: cap.height, degraded: cap.degraded }]);
  const url = cv.toDataURL('image/webp', 0.93);
  /* ⚠️ SOLTAR OS BUFFERS. Quatro capturas de 3840 × 2400 numa rodada só
     derrubavam a aba ("Inspected target navigated or closed"): cada uma
     segura um ImageBitmap, um canvas 2D e o PNG do preset ao mesmo tempo. */
  bmp.close();
  cv.width = 1; cv.height = 1;
  out.push([nome, url]);
}

/* ---------- 3 · o branco de fábrica, ANTES da plotagem ---------- */
if (LOTE === 'a') await foto('A0-branco-tres-quartos', 52, 8, 26, 0.90, 0.48);
if (LOTE === 'd') {
  await foto('D0-branco-heroi', 138, 10, 26, 0.90, 0.48);
  await foto('D1-branco-perfil-direito', 90, 2, 16, 0.90, 0.52);
  return out;
}

/* ---------- 4 · a plotagem ---------- */
const res = await fetch('/studio-assets/v1/ankaa-layout-art.png');
out.push(['arte-http', { ok: res.ok, status: res.status, type: res.headers.get('content-type') }]);
const blob = await res.blob();
const file = new File([blob], 'ankaa-layout.png', { type: 'image/png' });
const input = document.getElementById('logo-input');

for (const k of ['left', 'right']) {
  S.livery.setActiveKey(k);
  const c = S.livery.surfaces[k];
  const antes = c.getObjects().length;
  const dt = new DataTransfer(); dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  const ok = await B.until(() => c.getObjects().length > antes, 40000);
  if (!ok) { out.push([`plot-${k}`, false]); continue; }
  const img = c.getObjects()[c.getObjects().length - 1];
  const W = c.getWidth(), H = c.getHeight();
  /* a arte tem 8,50 m de largura; o painel de fábrica tem ~8,66 → 98 % */
  const s = (W * 0.98) / img.width;
  img.set({ left: W / 2, top: H / 2, originX: 'center', originY: 'center', scaleX: s, scaleY: s });
  c.setActiveObject(img);
  c.discardActiveObject();
  c.requestRenderAll();
  S.livery.markDirty(k);
  out.push([`plot-${k}`, { canvas: [W, H], img: [img.width, img.height], s: +s.toFixed(4) }]);
}
S.livery.closeEditor?.();
for (let i = 0; i < 60; i++) await B.frame();

/* ---------- 5 · os ângulos ---------- */
if (LOTE === 'a') {
  await foto('A1-perfil-direito', 90, 2, 16, 0.94, 0.52);
  await foto('A2-tres-quartos-dianteiro', 52, 8, 26, 0.90, 0.48);
} else if (LOTE === 'b') {
  await foto('B1-tres-quartos-traseiro', 138, 10, 26, 0.90, 0.48);
  await foto('B2-frontal-baixo', 26, 2, 30, 0.88, 0.40);
} else if (LOTE === 'c') {
  await foto('C1-perfil-esquerdo', -90, 2, 16, 0.90, 0.52);
  await foto('C2-perfil-direito', 90, 2, 16, 0.90, 0.52);
}
return out;
