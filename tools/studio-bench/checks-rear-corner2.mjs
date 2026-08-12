/* CANTO TRASEIRO, rente — últimas dezenas de mm antes da quina.
   ---------------------------------------------------------------------------
   A rodada 1 (checks-rear-corner) provou que a 350 mm da quina NADA muda com a
   altura. Esta rodada mede RENTE à quina (z = zRear+0,06 na lateral; x = −1,28
   na traseira) e fotografa em close (0,9 m de quadro, 1200 px/m) nas mesmas
   três alturas, com a MESMA moldura de câmera (ancorada no pé de fábrica para
   as fotos serem comparáveis pixel a pixel).

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-rear-corner2.mjs
*/
const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);

async function settle() {
  const overlay = document.getElementById('ts-selector');
  if (!overlay) return true;
  for (let step = 0; step < 12; step++) {
    if (overlay.classList.contains('hidden')) return true;
    const cards = [...overlay.querySelectorAll('.ts-card:not([disabled])')];
    if (!cards.length) break;
    const local = cards.find((c) => /scania|volvo|iveco/i.test(c.dataset.id || ''));
    (local || cards[0]).click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  return overlay.classList.contains('hidden');
}

out.push(['seletor atravessado', await settle()]);
out.push(['__studio de pé', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;
out.push(['implemento carregado', await B.until(() => !!S.trailerRig, 240000)]);
if (!S.trailerRig) return out;
await B.frame(); await B.frame();

const THREE = S.THREE;
const scene = S.scene;
const prof = S.trailerRig.profile;
const mm = (v) => Math.round(v * 1000);

const canvas = document.createElement('canvas');
const rr = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
rr.setPixelRatio(1);
rr.outputColorSpace = THREE.SRGBColorSpace;
rr.toneMapping = S.renderer.toneMapping;
rr.toneMappingExposure = S.renderer.toneMappingExposure;

function profileOf(mk, y0, y1, depthAxis) {
  const root = S.trailer;
  root.updateWorldMatrix(true, true);
  const M = root.matrixWorld;
  const inv = M.clone().invert();
  const ray = new THREE.Raycaster();
  ray.far = 6;
  const steps = [];
  for (let y = y0; y <= y1 + 1e-9; y += 0.001) {
    const { o, d } = mk(y);
    ray.set(o.clone().applyMatrix4(M), d.clone().transformDirection(M));
    const h = ray.intersectObjects([S.trailerGroup ?? S.trailer], true)
      .filter((hh) => hh.object.visible)[0];
    if (!h || h.distance > 2.35) { steps.push(null); continue; }
    const mat = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
    const p = h.point.clone().applyMatrix4(inv);
    steps.push({ y, who: `${h.object.name || '(sem nome)'}·${(mat && mat.name) || '?'}`, d: p[depthAxis] });
  }
  const bands = [];
  let cur = null;
  for (const s of steps) {
    if (!s) { cur = null; continue; }
    if (cur && cur.who === s.who) {
      cur.hi = s.y;
      if (s.d < cur.dLo) cur.dLo = s.d;
      if (s.d > cur.dHi) cur.dHi = s.d;
    } else {
      cur = { who: s.who, lo: s.y, hi: s.y, dLo: s.d, dHi: s.d };
      bands.push(cur);
    }
  }
  return bands;
}

function reportBands(tag, face, bands) {
  const { floorY } = prof;
  out.push([`${tag} · ${face}: bandas`, bands.length]);
  for (const b of bands) {
    out.push([`  ${tag} ${face}`, `${b.who} y ${mm(b.lo - floorY)}..${mm(b.hi - floorY)}`
      + ` (esp ${mm(b.hi - b.lo)}) prof ${mm(b.dLo)}..${mm(b.dHi)}`]);
  }
}

/* Moldura de câmera FIXA, medida uma vez na fábrica (pé da chapa na quina
   traseira), para as três fotos serem sobreponíveis. */
let frame0 = null;
function measureFrame() {
  const mesh = S.trailer?.getObjectByName('SIDE_L');
  if (!mesh) return null;
  const uv = mesh.geometry.getAttribute('uv1');
  const pos = mesh.geometry.getAttribute('position');
  if (!uv || !pos) return null;
  mesh.updateWorldMatrix(true, false);
  const cornerOf = (u, vv) => {
    let best = Infinity, bi = -1;
    for (let i = 0; i < uv.count; i++) {
      const du = uv.getX(i) - u, dv = uv.getY(i) - vv;
      const d = du * du + dv * dv;
      if (d < best) { best = d; bi = i; }
    }
    return new THREE.Vector3().fromBufferAttribute(pos, bi).applyMatrix4(mesh.matrixWorld);
  };
  const c00 = cornerOf(0, 0), c10 = cornerOf(1, 0), c11 = cornerOf(1, 1), c01 = cornerOf(0, 1);
  const uDir = new THREE.Vector3().subVectors(c10, c00).normalize();
  const vDir = new THREE.Vector3().subVectors(c11, c10).normalize();
  const nDir = new THREE.Vector3().crossVectors(vDir, uDir).normalize();
  return { c01, uDir, vDir, nDir };
}

function shoot(tag, dirKind) {
  if (!frame0) return;
  const { c01, uDir, vDir, nDir } = frame0;
  const dir = dirKind === 'diag'
    ? new THREE.Vector3().subVectors(nDir, uDir).normalize()
    : nDir.clone();
  const w = 0.9, h = 0.62, ppm = 1200;
  const centre = c01.clone().addScaledVector(uDir, 0.16).addScaledVector(vDir, 0.10);
  const wPx = Math.round(w * ppm), hPx = Math.round(h * ppm);
  rr.setSize(wPx, hPx, false);
  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.05, 12);
  cam.position.copy(centre).addScaledVector(dir, 5);
  cam.up.copy(vDir).negate();
  cam.lookAt(centre);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  const lamp = new THREE.DirectionalLight(0xffffff, 2.5);
  lamp.position.copy(cam.position);
  lamp.target.position.copy(centre);
  const amb = new THREE.AmbientLight(0xffffff, 1.5);
  scene.add(lamp, lamp.target, amb);
  rr.render(scene, cam);
  scene.remove(lamp, lamp.target, amb);
  const cc = document.createElement('canvas');
  cc.width = wPx; cc.height = hPx;
  cc.getContext('2d').drawImage(canvas, 0, 0);
  out.push([`${tag}-close-${dirKind}`, cc.toDataURL('image/png')]);
}

async function battery(tag) {
  await B.frame(); await B.frame();
  const d = S.trailerDims;
  out.push([`${tag}: dims efetivas`, `h ${mm(d.height)} · c ${mm(d.length)}`]);
  const { floorY, z1 } = prof;
  const zRear = z1 - d.length;
  const y0 = floorY - 0.20, y1 = floorY + 0.32;
  reportBands(tag, 'LAT-quina60', profileOf((y) => ({
    o: new THREE.Vector3(-2.2, y, zRear + 0.06), d: new THREE.Vector3(1, 0, 0),
  }), y0, y1, 'x'));
  reportBands(tag, 'LAT-quina150', profileOf((y) => ({
    o: new THREE.Vector3(-2.2, y, zRear + 0.15), d: new THREE.Vector3(1, 0, 0),
  }), y0, y1, 'x'));
  reportBands(tag, 'TRAS-quina', profileOf((y) => ({
    o: new THREE.Vector3(-1.28, y, zRear - 2.2), d: new THREE.Vector3(0, 0, 1),
  }), y0, y1, 'z'));
  if (!frame0) frame0 = measureFrame();
  shoot(tag, 'diag');
  shoot(tag, 'lado');
}

await battery('fabrica');
for (const h of [2.72, 2.60]) {
  S.measures.setImplementMeasures({ height: h });
  const snapped = S.trailerRig.snapHeight(h);
  const ok = await B.until(() => {
    const d = S.trailerDims;
    return !!d && Math.abs(d.height - snapped) < 0.002;
  }, 60000);
  out.push([`h${Math.round(h * 100)}: resize assentou (snap ${mm(snapped)})`, ok]);
  await battery(`h${Math.round(h * 100)}`);
}

return out;
