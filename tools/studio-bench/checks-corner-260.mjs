/* VALIDAÇÃO DO CANTO — dianteiro E traseiro, em fábrica/h2,72/h2,60.
   ---------------------------------------------------------------------------
   Mesma métrica de checks-corner-final no canto DIANTEIRO (trilho LAT ×
   TESTEIRA, raio a 1 mm), mais a do canto TRASEIRO: pé do trilho na ponta
   traseira × pé do marco traseiro (face lateral do montante, medida rente à
   quina) e × a banda baixa do para-choque na face de trás. Fotos dos dois
   cantos por altura.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-corner-260.mjs
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

function frameOf() {
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
  return { c01, c11, uDir, vDir, nDir };
}

function shoot(tag, end) {
  const f = frameOf();
  if (!f) return;
  const { c01, c11, uDir, vDir, nDir } = f;
  const dir = end === 'tras'
    ? new THREE.Vector3().subVectors(nDir, uDir).normalize()
    : new THREE.Vector3().addVectors(nDir, uDir).normalize();
  const anchor = end === 'tras' ? c01 : c11;
  const along = end === 'tras' ? 0.25 : -0.25;
  const w = 2.0, h = 1.3, ppm = 640;
  const centre = anchor.clone().addScaledVector(uDir, along).addScaledVector(vDir, 0.22);
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
  out.push([`${tag}-canto-${end}`, cc.toDataURL('image/png')]);
}

async function battery(tag) {
  await B.frame(); await B.frame();
  const { floorY, z1 } = prof;
  const d = S.trailerDims;
  const zRear = z1 - d.length;
  const y0 = floorY - 0.15, y1 = floorY + 0.15;
  const RAIL = /galvanizado-mantido/i;
  const FRAME = /estrutura-principal/i;

  /* DIANTEIRO: trilho LAT a 350 mm do canto × perfil da TESTEIRA. */
  const latF = edges((y) => ({
    o: new THREE.Vector3(-2.2, y, z1 - 0.35), d: new THREE.Vector3(1, 0, 0),
  }), y0, y1, RAIL);
  const test = edges((y) => ({
    o: new THREE.Vector3(-1.12, y, z1 + 2.2), d: new THREE.Vector3(0, 0, -1),
  }), y0, y1, RAIL);
  const okF = latF.lo !== null && test.lo !== null;
  out.push([`${tag} DIANT: trilho LAT ${okF ? `${mm1(latF.lo - floorY)}..${mm1(latF.hi - floorY)}` : '—'}`
    + ` · TEST ${okF ? `${mm1(test.lo - floorY)}..${mm1(test.hi - floorY)}` : '—'} (mm rel. piso)`, okF]);
  if (okF) {
    const dTop = (latF.hi - test.hi) * 1000, dBot = (latF.lo - test.lo) * 1000;
    out.push([`${tag} DIANT: degrau topo (mm)`, Math.abs(dTop) <= 2 ? true : dTop]);
    out.push([`${tag} DIANT: degrau pé (mm)`, Math.abs(dBot) <= 2 ? true : dBot]);
  }

  /* TRASEIRO: pé do trilho na ponta traseira × pé do marco (face lateral do
     montante, rente à quina) × banda baixa do para-choque na face de trás. */
  const latR = edges((y) => ({
    o: new THREE.Vector3(-2.2, y, zRear + 0.15), d: new THREE.Vector3(1, 0, 0),
  }), y0, y1, RAIL);
  const post = edges((y) => ({
    o: new THREE.Vector3(-2.2, y, zRear + 0.06), d: new THREE.Vector3(1, 0, 0),
  }), y0, y1, FRAME);
  const rear = edges((y) => ({
    o: new THREE.Vector3(-1.28, y, zRear - 2.2), d: new THREE.Vector3(0, 0, 1),
  }), y0, y1, FRAME);
  const okR = latR.lo !== null && post.lo !== null && rear.lo !== null;
  out.push([`${tag} TRAS: trilho ${latR.lo !== null ? `${mm1(latR.lo - floorY)}..${mm1(latR.hi - floorY)}` : '—'}`
    + ` · montante(lado) ${post.lo !== null ? `${mm1(post.lo - floorY)}..${mm1(post.hi - floorY)}` : '—'}`
    + ` · marco(face) ${rear.lo !== null ? `${mm1(rear.lo - floorY)}..${mm1(rear.hi - floorY)}` : '—'} (mm rel. piso)`, okR]);
  if (okR) {
    const dPost = (latR.lo - post.lo) * 1000;
    const dFace = (latR.lo - rear.lo) * 1000;
    out.push([`${tag} TRAS: pé do trilho × pé do montante (mm)`, Math.abs(dPost) <= 2 ? true : dPost]);
    out.push([`${tag} TRAS: pé do trilho × pé do marco na face (mm)`, Math.abs(dFace) <= 2 ? true : dFace]);
  }
  shoot(tag, 'diant');
  shoot(tag, 'tras');
}

await battery('fabrica');
for (const h of [2.72, 2.60]) {
  S.measures.setImplementMeasures({ height: h });
  const snapped = S.trailerRig.snapHeight(h);
  const ok = await B.until(() => {
    const d = S.trailerDims;
    return !!d && Math.abs(d.height - snapped) < 0.002;
  }, 60000);
  out.push([`h${Math.round(h * 100)}: resize assentou (snap ${mm1(snapped)})`, ok]);
  await battery(`h${Math.round(h * 100)}`);
}

return out;
