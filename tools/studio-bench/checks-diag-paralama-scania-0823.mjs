/* DIAGNÓSTICO — o para-lama do 2º direcional do Scania P 8x2R está "aberto"?
   ===========================================================================
   *"esse paralama do scania bitruck, ele esta muito aberto"* — Kennedy,
   2026-08-23, com foto do 137 PESCADOS de perfil.

   Não conserta nada: mede o vão entre a face de baixo do arco e o pneu, ângulo
   por ângulo em torno do eixo, e tira fotos de perto. O arco do Scania é o
   `t_paralama_0_p*` DE FÁBRICA (o `TS_PARALAMA_DIR2` não entra aqui — o
   `jaTemArco()` de `front-fender.ts` o barra), já com a descida de 110 mm que
   `cab-bake-fixes.ts` aplica. */

const out = [];
const B = window.__bench;
const mm = (v) => (v === null || v === undefined || !isFinite(v) ? '—' : `${(v * 1000).toFixed(0)}`);

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 12; i++) await B.frame();

const THREE = S.THREE;
const { scene, camera, controls, renderer } = S;
const raw = renderer.domElement;

let mk = null, mo = null, c = null;
for (const m of (S.catalog.catalog?.manufacturers || [])) {
  for (const md of (m.models || [])) {
    for (const ch of (md.chassis || [])) {
      if (md.id === 'scania-p' && ch.id === '8x2r') { mk = m; mo = md; c = ch; }
    }
  }
}
if (!c) { out.push(['★ acha scania-p/8x2r', false]); return out; }
await S.applyChoice({
  envId: S.choice?.envId || 'estudio',
  manufacturerId: mk.id, modelId: mo.id, chassisId: c.id,
  colorId: null, finishId: null, trim: null,
}, { curtain: false });
await B.until(() => (S.state.cabDef?.file || '') === c.file, 300000);
await B.until(() => !!S.state.trailer, 300000);
for (let i = 0; i < 25; i++) await B.frame();

const cab = S.state.cab;
const imp = S.state.trailer;
const mount = S.state.cabMount;
const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
  .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0))
  .multiply(new THREE.Matrix4().copy(cab.matrixWorld).invert());
const Ninv = new THREE.Matrix4().copy(N).invert();

const steer = mount.axles.steerZ || [];
const z2 = steer.length >= 2 ? Math.min(...steer) : 0;
out.push(['eixos direcionais Zn', steer.map((z) => mm(z)).join(' · ')]);
out.push(['2º direcional Zn', mm(z2)]);
out.push(['TS_PARALAMA_DIR2 montado?', !!cab.getObjectByName('TS_PARALAMA_DIR2')]);

/* ── varredura de vértice, em normalizado ───────────────────────────────── */
const v = new THREE.Vector3();
const L2N = new THREE.Matrix4();
function varre(re, fn) {
  cab.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    let bate = false;
    for (let p = o; p && p !== cab.parent; p = p.parent) {
      if (re.test(p.name || '')) { bate = true; break; }
    }
    if (!bate) return;
    let vis = true;
    for (let p = o; p && p !== cab.parent; p = p.parent) if (!p.visible) { vis = false; break; }
    if (!vis) return;
    L2N.copy(N).multiply(o.matrixWorld);
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(L2N); fn(v, o); }
  });
}

/* o pneu do 2º direcional: só o flanco de fora, na janela do eixo */
let py0 = Infinity, py1 = -Infinity, pxo = -Infinity, pn = 0;
varre(/wheel|tire|pneu|rim|aro|VM_WHEEL/i, (p) => {
  if (Math.abs(p.z - z2) > 0.70) return;
  if (Math.abs(p.x) < 0.55) return;
  if (p.y < py0) py0 = p.y; if (p.y > py1) py1 = p.y;
  pn++;
});
const dia = py1 - py0;
varre(/wheel|tire|pneu|rim|aro|VM_WHEEL/i, (p) => {
  if (Math.abs(p.z - z2) > 0.70) return;
  const ax = Math.abs(p.x);
  if (ax < 0.55) return;
  if (p.y < py0 + dia * 0.05 || p.y > py0 + dia * 0.35) return;
  if (ax > pxo) pxo = ax;
});
out.push(['pneu do 2º direcional', `Ø ${mm(dia)} · chão ${mm(py0)} · coroa ${mm(py1)}`
  + ` · face externa ${mm(pxo)} · ${pn} vértices`]);

/* o arco de fábrica */
const ARCO = /^t_paralama_0_p\d+/;
let ax0 = Infinity, ax1 = -Infinity, ay0 = Infinity, ay1 = -Infinity, az0 = Infinity, az1 = -Infinity, an = 0;
const porNo = new Map();
varre(ARCO, (p, o) => {
  an++;
  if (p.x < ax0) ax0 = p.x; if (p.x > ax1) ax1 = p.x;
  if (p.y < ay0) ay0 = p.y; if (p.y > ay1) ay1 = p.y;
  if (p.z < az0) az0 = p.z; if (p.z > az1) az1 = p.z;
  let b = porNo.get(o.name);
  if (!b) { b = { x: [Infinity, -Infinity], y: [Infinity, -Infinity], z: [Infinity, -Infinity] }; porNo.set(o.name, b); }
  b.x[0] = Math.min(b.x[0], p.x); b.x[1] = Math.max(b.x[1], p.x);
  b.y[0] = Math.min(b.y[0], p.y); b.y[1] = Math.max(b.y[1], p.y);
  b.z[0] = Math.min(b.z[0], p.z); b.z[1] = Math.max(b.z[1], p.z);
});
out.push(['arco t_paralama_0 (caixa)', `x ${mm(ax0)}…${mm(ax1)} · y ${mm(ay0)}…${mm(ay1)}`
  + ` · z ${mm(az0)}…${mm(az1)} · ${an} vértices`]);
out.push(['arco por nó', [...porNo].map(([k, b]) =>
  `${k}: x ${mm(b.x[0])}…${mm(b.x[1])} y ${mm(b.y[0])}…${mm(b.y[1])} z ${mm(b.z[0])}…${mm(b.z[1])}`).join(' · ')]);

/* perfil angular: raio mínimo do arco em torno do centro do eixo, num flanco */
const yc = py0 + dia / 2;
const NB = 24;
const rmin = new Array(NB).fill(Infinity);
varre(/^t_paralama_0_p[13]$/, (p) => {
  if (p.x < 0.80 || p.x > 1.35) return;
  const dy = p.y - yc, dz = p.z - z2;
  const r = Math.hypot(dy, dz);
  let a = Math.atan2(dy, dz) * 180 / Math.PI; if (a < 0) a += 360;
  const b = Math.min(NB - 1, Math.floor(a / (360 / NB)));
  if (r < rmin[b]) rmin[b] = r;
});
const rp = dia / 2;
out.push(['raio do pneu', mm(rp)]);
out.push(['vão arco−pneu por ângulo (0°=+Zn, 90°=cima)',
  rmin.map((r, i) => Number.isFinite(r) ? `${i * 15}°:${mm(r - rp)}` : null)
    .filter(Boolean).join(' ')]);

/* ── as fotos ───────────────────────────────────────────────────────────── */
const foto = (nome, alvoN, olhoN) => {
  const alvo = new THREE.Vector3(alvoN[0], alvoN[1], alvoN[2]).applyMatrix4(Ninv);
  controls.target.copy(alvo);
  camera.position.copy(new THREE.Vector3(olhoN[0], olhoN[1], olhoN[2]).applyMatrix4(Ninv));
  camera.lookAt(alvo);
  camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); controls.update();
  renderer.render(scene, camera);
  out.push([nome, raw.toDataURL('image/png')]);
};
foto('scania-pl-1-perfil', [0, 0.75, z2], [7.0, 0.95, z2]);
foto('scania-pl-2-perto', [0, 0.80, z2], [3.4, 1.05, z2 + 0.15]);
foto('scania-pl-3-baixo', [0, 0.60, z2], [2.6, -0.20, z2 + 0.8]);
foto('scania-pl-4-tres-quartos', [0, 0.80, z2], [3.6, 1.6, z2 - 1.8]);

/* o mesmo enquadramento do 1º direcional, para comparar */
const z1 = steer.length >= 2 ? Math.max(...steer) : z2;
foto('scania-pl-5-1o-direcional', [0, 0.80, z1], [3.4, 1.05, z1 + 0.15]);

return out;
