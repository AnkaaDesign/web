/* DIAGNÓSTICO — largura: o arco do 2º direcional cobre o pneu que está na tela? */
const out = [];
const B = window.__bench;
const mm = (v) => (v === null || v === undefined || !isFinite(v) ? '—' : `${(v * 1000).toFixed(0)}`);
await B.until(() => { const o = document.getElementById('ts-selector'); return !!o && o.classList.contains('is-open'); }, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 12; i++) await B.frame();
const THREE = S.THREE;
const { scene, camera, controls, renderer } = S;
const raw = renderer.domElement;
let mk = null, mo = null, c = null;
for (const m of (S.catalog.catalog?.manufacturers || [])) for (const md of (m.models || [])) for (const ch of (md.chassis || []))
  if (md.id === 'scania-p' && ch.id === '8x2r') { mk = m; mo = md; c = ch; }
await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: mk.id, modelId: mo.id, chassisId: c.id, colorId: null, finishId: null, trim: null }, { curtain: false });
await B.until(() => (S.state.cabDef?.file || '') === c.file, 300000);
await B.until(() => !!S.state.trailer, 300000);
for (let i = 0; i < 25; i++) await B.frame();

const cab = S.state.cab, mount = S.state.cabMount;
const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
  .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0))
  .multiply(new THREE.Matrix4().copy(cab.matrixWorld).invert());
const Ninv = new THREE.Matrix4().copy(N).invert();
const steer = mount.axles.steerZ || [];
const z2 = Math.min(...steer), z1 = Math.max(...steer);
const v = new THREE.Vector3(), L2N = new THREE.Matrix4();

function caixaPorNo(re, janelaZ) {
  const r = new Map();
  cab.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    let vis = true; for (let p = o; p && p !== cab.parent; p = p.parent) if (!p.visible) { vis = false; break; }
    if (!vis) return;
    let bate = false; for (let p = o; p && p !== cab.parent; p = p.parent) if (re.test(p.name || '')) { bate = true; break; }
    if (!bate) return;
    L2N.copy(N).multiply(o.matrixWorld);
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(L2N);
      if (janelaZ && Math.abs(v.z - janelaZ[0]) > janelaZ[1]) continue;
      let b = r.get(o.name);
      if (!b) { b = { x: [Infinity, -Infinity], y: [Infinity, -Infinity], z: [Infinity, -Infinity], n: 0 }; r.set(o.name, b); }
      b.x[0] = Math.min(b.x[0], v.x); b.x[1] = Math.max(b.x[1], v.x);
      b.y[0] = Math.min(b.y[0], v.y); b.y[1] = Math.max(b.y[1], v.y);
      b.z[0] = Math.min(b.z[0], v.z); b.z[1] = Math.max(b.z[1], v.z);
      b.n++;
    }
  });
  return r;
}
const rodas2 = caixaPorNo(/wheel|tire|pneu|rim|aro|VM_WHEEL/i, [z2, 0.70]);
out.push(['rodagem do 2º direcional', [...rodas2].map(([k, b]) =>
  `${k}: |x| ${mm(Math.max(Math.abs(b.x[0]), Math.abs(b.x[1])))} y ${mm(b.y[0])}…${mm(b.y[1])}`).join(' · ')]);
const rodas1 = caixaPorNo(/wheel|tire|pneu|rim|aro|VM_WHEEL/i, [z1, 0.70]);
out.push(['rodagem do 1º direcional', [...rodas1].map(([k, b]) =>
  `${k}: |x| ${mm(Math.max(Math.abs(b.x[0]), Math.abs(b.x[1])))} y ${mm(b.y[0])}…${mm(b.y[1])}`).join(' · ')]);
const arco2 = caixaPorNo(/^t_paralama_0_p\d+$/, null);
out.push(['arco do 2º direcional', [...arco2].map(([k, b]) =>
  `${k}: |x| ${mm(Math.max(Math.abs(b.x[0]), Math.abs(b.x[1])))}`).join(' · ')]);
const arco1 = caixaPorNo(/^paralama_f_0_p\d+$/, null);
out.push(['arco do 1º direcional', [...arco1].map(([k, b]) =>
  `${k}: |x| ${mm(Math.max(Math.abs(b.x[0]), Math.abs(b.x[1])))} z ${mm(b.z[0])}…${mm(b.z[1])}`).join(' · ')]);

const foto = (nome, alvoN, olhoN) => {
  const alvo = new THREE.Vector3(...alvoN).applyMatrix4(Ninv);
  controls.target.copy(alvo);
  camera.position.copy(new THREE.Vector3(...olhoN).applyMatrix4(Ninv));
  camera.lookAt(alvo); camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); controls.update();
  renderer.render(scene, camera);
  out.push([nome, raw.toDataURL('image/png')]);
};
foto('larg-1-frente-baixa', [0, 0.6, z2], [1.9, 0.55, z2 + 3.2]);
foto('larg-2-topo', [0, 0.9, z2], [2.0, 3.4, z2 + 0.2]);
foto('larg-3-tras-baixa', [0, 0.6, z2], [1.9, 0.45, z2 - 2.6]);
foto('larg-4-1o-direcional-frente', [0, 0.6, z1], [1.9, 0.55, z1 + 3.2]);
return out;
