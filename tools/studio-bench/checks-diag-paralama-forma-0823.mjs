/* DIAGNÓSTICO — candidatos de forma para o para-lama do 2º direcional do Scania.
   ===========================================================================
   Não conserta nada. Aplica, uma de cada vez, uma transformação do grupo
   `t_paralama_0_p*` em torno do CENTRO DO EIXO e fotografa. A transformação é
   escrita na matriz local de cada malha (`Pc⁻¹ · C · Pc · M`), então funciona
   qualquer que seja o pai. */

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
const mount = S.state.cabMount;
const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
  .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0))
  .multiply(new THREE.Matrix4().copy(cab.matrixWorld).invert());
const Ninv = new THREE.Matrix4().copy(N).invert();
const steer = mount.axles.steerZ || [];
const z2 = Math.min(...steer);

/* pneu do 2º direcional */
const v = new THREE.Vector3(); const L2N = new THREE.Matrix4();
let py0 = Infinity, py1 = -Infinity;
cab.traverse((o) => {
  if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
  let roda = false;
  for (let p = o; p && p !== cab.parent; p = p.parent) if (/wheel|tire|pneu|rim|aro/i.test(p.name || '')) { roda = true; break; }
  if (!roda) return;
  L2N.copy(N).multiply(o.matrixWorld);
  const pos = o.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(L2N);
    if (Math.abs(v.z - z2) > 0.70 || Math.abs(v.x) < 0.55) continue;
    if (v.y < py0) py0 = v.y; if (v.y > py1) py1 = v.y;
  }
});
const rPneu = (py1 - py0) / 2;
const yc = py0 + rPneu;
out.push(['pneu', `Ø ${mm(py1 - py0)} · centro y ${mm(yc)} · Zn ${mm(z2)}`]);

/* ── as malhas do arco e a matriz original de cada uma ─────────────────── */
const ARCO = /^t_paralama_0_p\d+$/;
const pecas = [];
cab.traverse((o) => { if (o.isMesh && ARCO.test(o.name || '')) pecas.push(o); });
out.push(['malhas do arco', pecas.map((o) => o.name).join(' · ')]);
for (const o of pecas) {
  o.matrixAutoUpdate = false;
  o.userData.m0 = o.matrix.clone();
  o.userData.pc = new THREE.Matrix4().copy(cab.matrixWorld).invert().multiply(o.parent.matrixWorld);
}

/* C em espaço da CABINE: normalizado → escala em torno do eixo → de volta. */
function aplica({ sy = 1, sz = 1, dy = 0, dz = 0 }) {
  const Nc = new THREE.Matrix4().makeRotationY(mount.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0));
  const Nci = new THREE.Matrix4().copy(Nc).invert();
  const T = new THREE.Matrix4()
    .multiply(new THREE.Matrix4().makeTranslation(0, yc + dy, z2 + dz))
    .multiply(new THREE.Matrix4().makeScale(1, sy, sz))
    .multiply(new THREE.Matrix4().makeTranslation(0, -yc, -z2));
  const C = new THREE.Matrix4().copy(Nci).multiply(T).multiply(Nc);
  for (const o of pecas) {
    const pcI = new THREE.Matrix4().copy(o.userData.pc).invert();
    o.matrix.copy(pcI).multiply(C).multiply(o.userData.pc).multiply(o.userData.m0);
    o.matrixWorldNeedsUpdate = true;
  }
  cab.updateWorldMatrix(true, true);
}

/* medida do vão radial mínimo, por ângulo */
function perfil() {
  const NB = 18, rmin = new Array(NB).fill(Infinity);
  for (const o of pecas) {
    if (!/_p[13]$/.test(o.name)) continue;
    L2N.copy(N).multiply(o.matrixWorld);
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(L2N);
      if (v.x < 0.80 || v.x > 1.35) continue;
      const dy = v.y - yc, dz = v.z - z2;
      const r = Math.hypot(dy, dz);
      let a = Math.atan2(dy, dz) * 180 / Math.PI; if (a < 0) a += 360;
      const b = Math.min(NB - 1, Math.floor(a / (360 / NB)));
      if (r < rmin[b]) rmin[b] = r;
    }
  }
  return rmin.map((r, i) => Number.isFinite(r) ? `${i * 20}°:${mm(r - rPneu)}` : null)
    .filter(Boolean).join(' ');
}

const foto = (nome, alvoN, olhoN) => {
  const alvo = new THREE.Vector3(alvoN[0], alvoN[1], alvoN[2]).applyMatrix4(Ninv);
  controls.target.copy(alvo);
  camera.position.copy(new THREE.Vector3(olhoN[0], olhoN[1], olhoN[2]).applyMatrix4(Ninv));
  camera.lookAt(alvo);
  camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); controls.update();
  renderer.render(scene, camera);
  out.push([nome, raw.toDataURL('image/png')]);
};

/* A tabela do bake já desceu 110 mm; o candidato parte do arquivo CRU, então
   todo candidato leva +110 embutido em `dy`. */
const DESCIDA = 0.110;
const CAND = [
  ['A-atual',    { dy: 0 }],
  ['s086',       { dy: +DESCIDA, sy: 0.86, sz: 0.86 }],
  ['s088',       { dy: +DESCIDA, sy: 0.88, sz: 0.88 }],
  ['s090',       { dy: +DESCIDA, sy: 0.90, sz: 0.90 }],
  ['s092',       { dy: +DESCIDA, sy: 0.92, sz: 0.92 }],
];
for (const [nome, cfg] of CAND) {
  aplica(cfg);
  for (let i = 0; i < 3; i++) await B.frame();
  out.push([`${nome} · vão`, perfil()]);
  foto(`escala-${nome}-perfil`, [0, 0.75, z2], [6.0, 0.95, z2]);
  foto(`escala-${nome}-perto`, [0, 0.80, z2], [3.2, 1.00, z2 + 0.10]);
}
aplica({ dy: 0 });
return out;
