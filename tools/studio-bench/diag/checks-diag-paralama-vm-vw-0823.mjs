/* DIAGNÓSTICO — o mesmo arco no VM e no VW, que o recebem por `front-fender.ts`.
   ===========================================================================
   `TS_PARALAMA_DIR2` é o `t_paralama_0` do Scania ripado. Se o defeito do
   Scania (descida maior que o vão real sobre o pneu) se repete lá, ele vem da
   descida de `attachSecondSteerFender()`, que é medida contra a COROA EXTERNA
   do grupo e não contra a face interna do arco. */
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

const ALVOS = [
  ['volvo-vm-2015', '8x2r', 'vm'],
  ['vw-constellation', '8x2-tl', 'vw'],
  ['scania-p', '8x2r', 'scania'],
];
for (const [modelId, chassisId, tag] of ALVOS) {
  let mk = null, mo = null, c = null;
  for (const m of (S.catalog.catalog?.manufacturers || [])) for (const md of (m.models || [])) for (const ch of (md.chassis || []))
    if (md.id === modelId && ch.id === chassisId) { mk = m; mo = md; c = ch; }
  if (!c) { out.push([`★ acha ${modelId}/${chassisId}`, false]); continue; }
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
  const z2 = Math.min(...steer);
  const v = new THREE.Vector3(), L2N = new THREE.Matrix4();

  const visivel = (o) => { for (let p = o; p && p !== cab.parent; p = p.parent) if (!p.visible) return false; return true; };
  const naArvore = (o, re) => { for (let p = o; p && p !== cab.parent; p = p.parent) if (re.test(p.name || '')) return true; return false; };

  let py0 = Infinity, py1 = -Infinity;
  cab.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || !visivel(o)) return;
    if (!naArvore(o, /wheel|tire|pneu|rim|aro|VM_WHEEL/i)) return;
    L2N.copy(N).multiply(o.matrixWorld);
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(L2N);
      if (Math.abs(v.z - z2) > 0.70 || Math.abs(v.x) < 0.55) continue;
      if (v.y < py0) py0 = v.y; if (v.y > py1) py1 = v.y;
    }
  });
  const rP = (py1 - py0) / 2, yc = py0 + rP;

  /* o arco: o montado (`TS_PARALAMA_DIR2`) ou o de fábrica (`t_paralama_0`) */
  const pl = cab.getObjectByName('TS_PARALAMA_DIR2');
  const ARCO = pl ? null : /^t_paralama_0_p[13]$/;
  const NB = 18, rmin = new Array(NB).fill(Infinity);
  let ay1 = -Infinity, apy0 = Infinity, ax = -Infinity;
  const alvos = [];
  cab.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || !visivel(o)) return;
    if (pl ? !naArvore(o, /^TS_PARALAMA_DIR2$/) : !ARCO.test(o.name || '')) return;
    alvos.push(o);
  });
  for (const o of alvos) {
    L2N.copy(N).multiply(o.matrixWorld);
    const pos = o.geometry.attributes.position;
    const casca = pl ? /_p[13]$/.test(o.name || '') || alvos.length <= 2 : true;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(L2N);
      if (v.y > ay1) ay1 = v.y;
      if (v.y < apy0) apy0 = v.y;
      if (Math.abs(v.x) > ax) ax = Math.abs(v.x);
      if (!casca || v.x < 0.80 || v.x > 1.35) continue;
      const dy = v.y - yc, dz = v.z - z2, r = Math.hypot(dy, dz);
      let a = Math.atan2(dy, dz) * 180 / Math.PI; if (a < 0) a += 360;
      const b = Math.min(NB - 1, Math.floor(a / (360 / NB)));
      if (r < rmin[b]) rmin[b] = r;
    }
  }
  out.push([`${tag} · arco`, `${pl ? 'TS_PARALAMA_DIR2 (montado)' : 't_paralama_0 (de fábrica)'}`
    + ` · ${alvos.length} malhas · pneu Ø ${mm(rP * 2)} centro y ${mm(yc)}`
    + ` · coroa externa y ${mm(ay1)} · base y ${mm(apy0)} · |x| ${mm(ax)}`]);
  out.push([`${tag} · vão radial`, rmin.map((r, i) => Number.isFinite(r) ? `${i * 20}°:${mm(r - rP)}` : null).filter(Boolean).join(' ')]);
  const negativos = rmin.filter((r) => Number.isFinite(r) && r - rP < 0).length;
  out.push([`★ ${tag}: o arco não entra no pneu`, negativos === 0]);

  const foto = (nome, alvoN, olhoN) => {
    const alvo = new THREE.Vector3(...alvoN).applyMatrix4(Ninv);
    controls.target.copy(alvo);
    camera.position.copy(new THREE.Vector3(...olhoN).applyMatrix4(Ninv));
    camera.lookAt(alvo); camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); controls.update();
    renderer.render(scene, camera);
    out.push([nome, raw.toDataURL('image/png')]);
  };
  foto(`vmvw-${tag}-perfil`, [0, 0.75, z2], [6.0, 0.95, z2]);
  foto(`vmvw-${tag}-perto`, [0, 0.80, z2], [3.2, 1.00, z2 + 0.10]);
}
return out;
