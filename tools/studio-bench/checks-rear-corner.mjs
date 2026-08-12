/* CANTO TRASEIRO — perfil da faixa de base LATERAL × marco TRASEIRO.
   ---------------------------------------------------------------------------
   Relato (prints 2026-08-11): em h 2,60 (vindo de 2,72) o frame inferior
   LATERAL termina VÁRIOS mm abaixo da travessa inferior TRASEIRA, e a
   "primeira elevação" do frame inferior fica GROSSA depois do resize.

   Esta sonda mede, por altura (fábrica, 2,72, 2,60 — snapadas a frisos):

     1. PERFIL POR RAIO com passo de 1 mm em Y: a superfície mais externa da
        tira LATERAL na ponta traseira e da face TRASEIRA perto do canto,
        agrupada em BANDAS por objeto+material — cada banda sai com o y-extent
        (mm rel. piso) e a profundidade (x ou z local). É a banda que ENGORDAR
        entre alturas que denuncia a casca esticada.
     2. Varredura de vértice por malha (referencial LOCAL do rig — o conjunto
        gira no engate), nas duas tiras.
     3. Foto diagonal do canto traseiro-inferior.

   E uma vez só: as REGRAS do assembly para toda peça que mora no canto
   traseiro na faixa de base (caixas de fábrica — não mudam com resize).

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-rear-corner.mjs
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
const mm1 = (v) => (v * 1000).toFixed(1);

out.push(['perfil', `floorY ${mm(prof.floorY)} · z0 ${mm(prof.z0)} · z1 ${mm(prof.z1)}`
  + ` · saia ${mm(prof.skirtHeight)} · passo ${mm1(prof.pitch)} · base h ${mm(prof.base.height)}`]);

const canvas = document.createElement('canvas');
const rr = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
rr.setPixelRatio(1);
rr.outputColorSpace = THREE.SRGBColorSpace;
rr.toneMapping = S.renderer.toneMapping;
rr.toneMappingExposure = S.renderer.toneMappingExposure;

/* ------------------------------------------------------------------------ */
/* REGRAS do assembly no canto traseiro (uma vez — caixas de fábrica). */
{
  const asm = S.trailerRig.assembly;
  const { floorY, z0 } = prof;
  const rows = [];
  for (const piece of asm.pieces ?? []) {
    const mats = Array.isArray(piece.mesh.material) ? piece.mesh.material : [piece.mesh.material];
    const mat = mats.map((m) => (m && m.name) || '?').join('+');
    for (const p of piece.parts) {
      if (p.min.y > floorY + 0.45 || p.max.y < floorY - 0.45) continue;
      if (p.min.z > z0 + 1.2) continue;
      const onFace = p.min.z < z0 + 0.15;
      const onSide = Math.abs((p.min.x + p.max.x) / 2) > 1.10;
      if (!onFace && !onSide) continue;
      rows.push(`${onFace ? 'TRAS' : 'LAT '} y=${p.y}/z=${p.z}`
        + `${p.below ? ' below' : ''}${p.rigidZ ? ' rigidZ' : ''}`
        + `${p.repeated ? ' rep' : ''}${p.latch ? ' latch' : ''}`
        + ` ${mat} [x ${mm(p.min.x)}..${mm(p.max.x)}`
        + ` y ${mm(p.min.y)}..${mm(p.max.y)} z ${mm(p.min.z)}..${mm(p.max.z)}]`);
    }
  }
  rows.sort();
  out.push(['regras do canto traseiro (assembly)', rows.length]);
  for (const r of rows.slice(0, 80)) out.push(['  parte', r]);
}

/* ------------------------------------------------------------------------ */
/* 1. PERFIL POR RAIO. Origem/direção em LOCAL do rig, levadas a mundo pela
   matriz da raiz (o conjunto gira no engate). */
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
  /* Agrupa em bandas contíguas do mesmo objeto+material. */
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

/* 2. Varredura de vértice por malha, nas tiras do canto traseiro. */
function scan(zRear) {
  const root = S.trailer;
  root.updateWorldMatrix(true, true);
  const inv = root.matrixWorld.clone().invert();
  const { floorY } = prof;
  const v = new THREE.Vector3();
  const rows = new Map();
  const im = new THREE.Matrix4();
  const m4 = new THREE.Matrix4();
  const mi = new THREE.Matrix4();

  root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const mat = mats.map((m) => (m && m.name) || '?').join('+');
    const interesting = /galvanizado|3M|inox|arremate|estrutura|plastico-preto|branco/i.test(mat)
      || /SILL|HEM|RIVET|TRAILER_BODY|SIDE_L|SIDE_R|REAR/i.test(o.name);
    if (!interesting) return;
    const pos = o.geometry && o.geometry.getAttribute('position');
    if (!pos || pos.count > 500000) return;
    m4.multiplyMatrices(inv, o.matrixWorld);
    const nInst = o.isInstancedMesh ? o.count : 1;
    const key = `${o.name || '(sem nome)'} · ${mat}`;
    for (let k = 0; k < nInst; k++) {
      mi.copy(m4);
      if (o.isInstancedMesh) { o.getMatrixAt(k, im); mi.multiply(im); }
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mi);
        if (v.y < floorY - 0.45 || v.y > floorY + 0.45) continue;
        let face = null;
        if (v.z <= zRear + 0.12 && Math.abs(v.x) <= 1.45) face = 'tras';
        else if (Math.abs(v.x) >= 1.15 && v.z >= zRear + 0.15 && v.z <= zRear + 1.2) face = 'lat';
        if (!face) continue;
        let r = rows.get(key);
        if (!r) { r = {}; rows.set(key, r); }
        let a = r[face];
        if (!a) { a = { lo: Infinity, hi: -Infinity, n: 0 }; r[face] = a; }
        if (v.y < a.lo) a.lo = v.y;
        if (v.y > a.hi) a.hi = v.y;
        a.n++;
      }
    }
  });
  const { floorY: f } = prof;
  const fmt = (a) => (a ? `${mm(a.lo - f)}..${mm(a.hi - f)}` : '—');
  return { rows, fmt };
}

/* 3. FOTO do canto traseiro-inferior. u=0 é a TRASEIRA, v=1 é o PÉ. */
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
  if (!mesh) { out.push([`${tag}-foto`, '(sem SIDE_L)']); return; }
  const c00 = cornerOf(mesh, 0, 0), c10 = cornerOf(mesh, 1, 0), c11 = cornerOf(mesh, 1, 1);
  const c01 = cornerOf(mesh, 0, 1);
  if (!c00 || !c10 || !c11 || !c01) return;
  const uDir = new THREE.Vector3().subVectors(c10, c00).normalize(); // traseira→dianteira
  const vDir = new THREE.Vector3().subVectors(c11, c10).normalize(); // desce
  const nDir = new THREE.Vector3().crossVectors(vDir, uDir).normalize(); // para fora
  const dir = new THREE.Vector3().subVectors(nDir, uDir).normalize(); // fora+atrás
  const w = 2.0, h = 1.3, ppm = 640;
  const centre = c01.clone().addScaledVector(uDir, 0.25).addScaledVector(vDir, 0.22);
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
  out.push([`${tag}-canto-traseiro`, cc.toDataURL('image/png')]);
}

async function battery(tag) {
  await B.frame(); await B.frame();
  const d = S.trailerDims;
  out.push([`${tag}: dims efetivas`, `h ${mm(d.height)} · c ${mm(d.length)}`]);
  const { floorY, z1 } = prof;
  const zRear = z1 - d.length;
  const y0 = floorY - 0.15, y1 = floorY + 0.32;
  const lat = profileOf((y) => ({
    o: new THREE.Vector3(-2.2, y, zRear + 0.35), d: new THREE.Vector3(1, 0, 0),
  }), y0, y1, 'x');
  reportBands(tag, 'LAT-tras', lat);
  const rear = profileOf((y) => ({
    o: new THREE.Vector3(-1.12, y, zRear - 2.2), d: new THREE.Vector3(0, 0, 1),
  }), y0, y1, 'z');
  reportBands(tag, 'TRASEIRA', rear);

  const { rows, fmt } = scan(zRear);
  const keys = [...rows.keys()].sort();
  for (const k of keys) {
    const r = rows.get(k);
    out.push([`${tag} · malha ${k}`, `LAT ${fmt(r.lat)} · TRAS ${fmt(r.tras)} (mm rel. piso)`]);
  }
  shoot(tag);
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
