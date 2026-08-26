/* DOZE — a grade que passa do baú, e a LINHA nova no trilho.
   ===========================================================================
     A. *"essa grade lateral metálica está indo muito para trás, ela deve
        acabar antes do baú"* — mede-se a ponta de CADA peça da grade contra a
        parede traseira do baú, em milímetro.
     B. *"agora o frame superior tem uma linha seguindo os rebites"* — a
        cirurgia de índice tirou os triângulos do rebaixo; se o perfil for
        chapa fina, o que ficou é FURO VAZADO, e uma fileira de furos rasantes
        lê como linha. Fotografa-se rente e olha-se por trás.

     node tools/studio-bench/bench.mjs --gpu --geometry --verbose --checks diag/checks-scania12-0822.mjs */

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
function caixaLocal(o) {
  const g = o.geometry;
  if (!g) return null;
  g.computeBoundingBox();
  const b = g.boundingBox.clone();
  const M = new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld);
  return b.applyMatrix4(M);
}

/* ═══════════ A. A GRADE CONTRA O BAÚ ═══════════ */
/* A PAREDE DO BAÚ não é a caixa do implemento: esta inclui para-choque,
   lanterna e a própria grade. O baú é a PELE — as chapas da carroceria. */
let pele = null;
t.traverse((o) => {
  if (!o.isMesh || !o.visible) return;
  if (!/^(TRAILER_PANEL|TRAILER_SIDE|TRAILER_ROOF|TRAILER_FLOOR|TRAILER_FRONT|TRAILER_REAR)/.test(o.name || '')) return;
  const b = caixaLocal(o);
  if (!b) return;
  if (pele) pele.union(b); else pele = b.clone();
});
if (!pele) {
  /* Sem nome conhecido: cai na maior caixa de malha alta e longa. */
  t.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const b = caixaLocal(o);
    if (!b) return;
    if (b.max.y - b.min.y < 1.5 || b.max.z - b.min.z < 3) return;
    if (pele) pele.union(b); else pele = b.clone();
  });
}
out.push(['A · baú (pele)', pele ? `z ${mm(pele.min.z)}…${mm(pele.max.z)} · y ${mm(pele.min.y)}…${mm(pele.max.y)}` : '—']);

const gr = [];
t.traverse((o) => {
  if (o.isMesh && /^(BARRA__|ESTACAO__|PONTA__|TS_GRADE)/.test(o.name || '')) gr.push(o);
});
/* A grade pode estar presa ao IMPLEMENTO — se não aparecer aqui, procura-se na cena. */
if (!gr.length) {
  scene.traverse((o) => {
    if (o.isMesh && /^(BARRA__|ESTACAO__|PONTA__|TS_GRADE)/.test(o.name || '')) gr.push(o);
  });
}
out.push(['A · peças da grade', String(gr.length)]);
let caixa = null;
const porTipo = new Map();
for (const o of gr) {
  const b = caixaLocal(o);
  if (!b) continue;
  if (caixa) caixa.union(b); else caixa = b.clone();
  const k = (o.name.split('__')[0] || o.name).slice(0, 12);
  const e = porTipo.get(k);
  if (e) { e.z0 = Math.min(e.z0, b.min.z); e.z1 = Math.max(e.z1, b.max.z); e.n++; }
  else porTipo.set(k, { z0: b.min.z, z1: b.max.z, n: 1 });
}
out.push(['A · grade inteira', caixa ? `z ${mm(caixa.min.z)}…${mm(caixa.max.z)}` : '—']);
out.push(['A · por tipo', [...porTipo.entries()]
  .map(([k, e]) => `${k}(${e.n}) ${mm(e.z0)}…${mm(e.z1)}`).join(' · ')]);
if (pele && caixa) {
  out.push(['A · folga da grade à parede traseira',
    `${mm(caixa.min.z - pele.min.z)} mm (negativo = a grade PASSA do baú)`]);
  out.push(['★ A · a grade acaba antes do baú',
    caixa.min.z >= pele.min.z - 0.001]);
}

/* ═══════════ B. O TRILHO, RENTE E POR TRÁS ═══════════ */
const bMundo = new THREE.Box3().setFromObject(t);
const c0 = bMundo.getCenter(new THREE.Vector3());
function tira(nome, dist, azDeg, elevDeg, desloca) {
  const a = THREE.MathUtils.degToRad(azDeg), e = THREE.MathUtils.degToRad(elevDeg);
  const al = c0.clone();
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
/* O ângulo da foto do dono: de cima, de perto, olhando o trilho de esguelha. */
tira('q12-b-trilho-dono', 3.2, -55, 22, V(0, 1.1, -1.4));
tira('q12-b-trilho-rente', 1.6, -78, 8, V(0, 1.25, 0.2));

/* E a PROVA de vazado: esconde-se tudo que não é o trilho e olha-se do LADO
   DE DENTRO. Se o rebaixo virou furo, entra luz por ele. */
const trilhos = [];
t.traverse((o) => {
  if (o.isMesh && /^estrutura-principal-9[0-5]_/.test(o.name || '')) trilhos.push(o);
});
const baldes = [];
t.traverse((o) => { if (/^FUSAO__/.test(o.name || '')) baldes.push(o); });
const visB = baldes.map((o) => o.visible), visT = trilhos.map((o) => o.visible);
for (const o of baldes) o.visible = false;
for (const o of trilhos) o.visible = true;
tira('q12-b-so-o-trilho', 1.2, -78, 6, V(0, 1.25, 0.2));
baldes.forEach((o, i) => { o.visible = visB[i]; });
trilhos.forEach((o, i) => { o.visible = visT[i]; });

return out;
