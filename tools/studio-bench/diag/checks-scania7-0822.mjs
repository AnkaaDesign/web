/* SÉTIMA VOLTA — o teste que faltava: BALDE contra ORIGEM.
   ===========================================================================
   Os experimentos anteriores trocaram DUAS coisas de uma vez (esconderam o
   balde E trocaram o material), e por isso não separaram as duas hipóteses.
   Aqui só uma muda: o balde sai e a origem entra COM O MATERIAL DELA.

       node tools/studio-bench/bench.mjs --gpu --geometry --checks diag/checks-scania7-0822.mjs */

const out = [];
const B = window.__bench;
const mm = (v) => (v === null || v === undefined || !isFinite(v) ? '—' : `${(v * 1000).toFixed(2)}`);

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

const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    for (const c of (mo.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, mo, c });
    }
  }
}
const p = alvos.find((a) => a.c.file.includes('scania_p_6x2r'));
await S.applyChoice({
  envId: S.choice?.envId || 'estudio',
  manufacturerId: p.mk.id, modelId: p.mo.id, chassisId: p.c.id,
  colorId: null, finishId: null, trim: null,
}, { curtain: false });
await B.until(() => (S.state.implement?.id || '').includes('sobrechassi'), 300000);
for (let i = 0; i < 30; i++) await B.frame();

const t = S.state.trailer;
t.updateWorldMatrix(true, true);
const toLocal = new THREE.Matrix4().copy(t.matrixWorld).invert();

const bMundo = new THREE.Box3().setFromObject(t);
const alvo0 = bMundo.getCenter(new THREE.Vector3());
function tira(nome, dist, azDeg, elevDeg, desloca) {
  const a = THREE.MathUtils.degToRad(azDeg), e = THREE.MathUtils.degToRad(elevDeg);
  const al = alvo0.clone();
  if (desloca) al.add(desloca);
  controls.target.copy(al);
  camera.position.set(
    al.x + Math.sin(a) * Math.cos(e) * dist,
    al.y + Math.sin(e) * dist,
    al.z + Math.cos(a) * Math.cos(e) * dist,
  );
  camera.lookAt(al);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  controls.update();
  renderer.render(scene, camera);
  out.push([nome, raw.toDataURL('image/png')]);
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TRILHO = [2.2, -72, 14, V(0, 1.25, 1.0)];

/* ───────── o material do trilho, por inteiro ───────── */
const trilhos = [];
t.traverse((o) => {
  if (o.isMesh && o.geometry && /^estrutura-principal-9[0-5]_/.test(o.name || '')) trilhos.push(o);
});
{
  const m = trilhos[0] && (Array.isArray(trilhos[0].material)
    ? trilhos[0].material[0] : trilhos[0].material);
  out.push(['mat do trilho', m ? JSON.stringify({
    nome: m.name, tipo: m.type, metal: m.metalness, rough: m.roughness,
    env: m.envMapIntensity, temEnv: !!m.envMap, flat: m.flatShading,
    aniso: m.anisotropy ?? null, anisoMap: !!m.anisotropyMap,
    clearcoat: m.clearcoat ?? null, sheen: m.sheen ?? null,
    normalMap: !!m.normalMap, roughnessMap: !!m.roughnessMap, map: !!m.map,
    lados: m.side, uv: !!trilhos[0].geometry.getAttribute('uv'),
    grupos: (trilhos[0].geometry.groups || []).length,
    arrayDeMat: Array.isArray(trilhos[0].material),
  }) : '—']);
  /* E as normais do BALDE que desenha esta faixa, contra as da origem. */
  const balde = [];
  t.traverse((o) => {
    if (o.isMesh && /^FUSAO__metal-estrutura-principal-padrao__polido/.test(o.name || '')) {
      balde.push(o);
    }
  });
  out.push(['baldes do trilho', balde.map((o) => o.name).join(' · ') || 'nenhum']);
  for (const o of balde) {
    const pos = o.geometry.getAttribute('position');
    const nor = o.geometry.getAttribute('normal');
    const M = new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld);
    const NM = new THREE.Matrix3().getNormalMatrix(M);
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    /* Só a faixa do trilho no flanco +x: y acima de 2,90 e x acima de 1,2. */
    const hist = new Map();
    let cnt = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(M);
      if (v.y < 2.90 || v.x < 1.2) continue;
      cnt++;
      n.fromBufferAttribute(nor, i).applyMatrix3(NM).normalize();
      const k = Math.round(n.x * 100) / 100;
      hist.set(k, (hist.get(k) || 0) + 1);
    }
    out.push([`balde ${o.name.slice(-24)}`, `${cnt} vértices na faixa · n.x: `
      + [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([k, q]) => `${k}:${q}`).join(' ')]);
    /* E a PROFUNDIDADE deles: o balde tem o rebaixo afundado ou não? */
    let x1 = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(M);
      if (v.y < 2.90 || v.x < 1.2) continue;
      if (v.x > x1) x1 = v.x;
    }
    const prof = new Map();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(M);
      if (v.y < 2.90 || v.x < 1.2) continue;
      const d = x1 - v.x;
      if (d > 0.03) continue;
      const b2 = Math.round(d * 10000);
      prof.set(b2, (prof.get(b2) || 0) + 1);
    }
    out.push([`balde ${o.name.slice(-24)} profundidade`,
      [...prof.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([b2, q]) => `${(b2 / 10).toFixed(1)}mm:${q}`).join(' ')]);
  }
}

/* ───────── O TESTE: balde fora, origem dentro, MATERIAL DELA ───────── */
tira('q7-0-como-esta', ...TRILHO);
const baldes = [];
t.traverse((o) => { if (/^FUSAO__/.test(o.name || '')) baldes.push(o); });
const vis = baldes.map((o) => o.visible);
for (const o of baldes) o.visible = false;
const eram = trilhos.map((o) => o.visible);
for (const o of trilhos) o.visible = true;
tira('q7-1-so-origens-material-real', ...TRILHO);
for (const o of baldes) o.visible = true;
trilhos.forEach((o, i) => { o.visible = eram[i]; });
tira('q7-2-devolvido', ...TRILHO);

/* ───────── E O TK, de perto ───────── */
tira('q7-tk-junta', 2.0, 200, 10, V(0, 0.75, -3.6));
tira('q7-tk-inteiro', 5.5, 235, -4, V(0, -0.2, -3.4));

return out;
