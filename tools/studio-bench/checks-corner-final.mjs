/* VALIDAÇÃO FINAL DO CANTO — degrau LAT×TEST ≤ 2 mm, com foto.
   ---------------------------------------------------------------------------
   Bordas do trilho galvanizado nas duas faces, por raio com passo de 1 mm
   (a sonda de 4 mm não resolve a tolerância pedida), em fábrica, h220 e
   h300, mais a foto diagonal do canto em cada medida.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-corner-final.mjs
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
const mm1 = (v) => Math.round(v * 1000);

const canvas = document.createElement('canvas');
const rr = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
rr.setPixelRatio(1);
rr.outputColorSpace = THREE.SRGBColorSpace;
rr.toneMapping = S.renderer.toneMapping;
rr.toneMappingExposure = S.renderer.toneMappingExposure;

/** A borda: menor/maior y (passo 1 mm) em que o raio acerta o material. */
function edges(mk, y0, y1, re) {
  const root = S.trailer;
  root.updateWorldMatrix(true, true);
  const M = root.matrixWorld;
  const ray = new THREE.Raycaster();
  ray.far = 6;
  let lo = null, hi = null;
  for (let y = y0; y <= y1 + 1e-9; y += 0.001) {
    const { o, d } = mk(y);
    ray.set(o.clone().applyMatrix4(M), d.clone().transformDirection(M));
    const h = ray.intersectObjects([S.trailerGroup ?? S.trailer], true)
      .filter((hh) => hh.object.visible)[0];
    if (!h || h.distance > 2.35) continue;
    const mat = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
    if (!re.test(mat?.name || '')) continue;
    if (lo === null) lo = y;
    hi = y;
  }
  return { lo, hi };
}

function cornerOf(mesh, u, vv) {
  const uv = mesh.geometry.getAttribute('uv1');
  const pos = mesh.geometry.getAttribute('position');
  if (!uv || !pos) return null;
  mesh.updateWorldMatrix(true, false);
  let best = Infinity, bi = -1;
  for (let i = 0; i < uv.count; i++) {
    const du = uv.getX(i) - u, dv = uv.getY(i) - vv;
    const d = du * du + dv * dv;
    if (d < best) { best = d; bi = i; }
  }
  return new THREE.Vector3().fromBufferAttribute(pos, bi).applyMatrix4(mesh.matrixWorld);
}

function shoot(tag) {
  const mesh = S.trailer?.getObjectByName('SIDE_L');
  if (!mesh) return;
  const c00 = cornerOf(mesh, 0, 0), c10 = cornerOf(mesh, 1, 0), c11 = cornerOf(mesh, 1, 1);
  const uDir = new THREE.Vector3().subVectors(c10, c00).normalize();
  const vDir = new THREE.Vector3().subVectors(c11, c10).normalize();
  const nDir = new THREE.Vector3().crossVectors(vDir, uDir).normalize();
  const dir = new THREE.Vector3().addVectors(nDir, uDir).normalize();
  const w = 2.0, h = 1.3, ppm = 640;
  const centre = c11.clone().addScaledVector(uDir, -0.25).addScaledVector(vDir, 0.22);
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
  out.push([`${tag}-final-canto`, cc.toDataURL('image/png')]);
}

function battery(tag) {
  const { floorY, z1 } = prof;
  const y0 = floorY - 0.15, y1 = floorY + 0.15;
  const RAIL = /galvanizado-mantido/i;
  /* LATERAL a 350 mm do canto; TESTEIRA a 120 mm para dentro do canto. O
     trilho da testeira tem a lanterna encaixada (−68…−24): a borda de BAIXO
     comparável é o pé do perfil, então mede-se lo e hi do material como um
     todo. */
  const lat = edges((y) => ({
    o: new THREE.Vector3(-2.2, y, z1 - 0.35), d: new THREE.Vector3(1, 0, 0),
  }), y0, y1, RAIL);
  const test = edges((y) => ({
    o: new THREE.Vector3(-1.12, y, z1 + 2.2), d: new THREE.Vector3(0, 0, -1),
  }), y0, y1, RAIL);
  const okLat = lat.lo !== null && test.lo !== null;
  const dTop = okLat ? (lat.hi - test.hi) * 1000 : null;
  const dBot = okLat ? (lat.lo - test.lo) * 1000 : null;
  out.push([`${tag}: trilho LAT ${okLat ? `${mm1(lat.lo - floorY)}..${mm1(lat.hi - floorY)}` : '—'}`
    + ` · TEST ${okLat ? `${mm1(test.lo - floorY)}..${mm1(test.hi - floorY)}` : '—'} (mm rel. piso)`,
  okLat ? true : false]);
  out.push([`${tag}: degrau do TOPO do trilho no canto (mm)`,
    dTop !== null && Math.abs(dTop) <= 2 ? true : dTop]);
  out.push([`${tag}: degrau do PÉ do trilho no canto (mm)`,
    dBot !== null && Math.abs(dBot) <= 2 ? true : dBot]);
  shoot(tag);
}

battery('fabrica');
for (const h of [2.2, 3.0]) {
  S.measures.setImplementMeasures({ height: h });
  const ok = await B.until(() => {
    const d = S.trailerDims;
    return !!d && Math.abs(d.height - h) < 0.06;
  }, 60000);
  out.push([`h${Math.round(h * 100)}: resize assentou`, ok]);
  await B.frame(); await B.frame();
  battery(`h${Math.round(h * 100)}`);
}

return out;
