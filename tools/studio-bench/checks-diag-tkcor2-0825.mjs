/* DIAGNÓSTICO 2026-08-25 (2ª volta) — a carcaça do Thermo King some do
   casamento assim que "pintar o implemento" a repinta.
   node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-diag-tkcor2-0825.mjs */

const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 20; i++) await B.frame();

const nome = (m) => (m && m.name) || '?';
const mats = (o) => (Array.isArray(o.material) ? o.material : [o.material]);

function tkMeshes() {
  const t = S.state.trailer; const hit = [];
  if (!t) return hit;
  t.traverse((o) => {
    if (!o.isMesh) return;
    const ns = [
      ...mats(o).map(nome),
      ...[o.userData.origMat, o.userData.trimOrigMat, o.userData.trimFactoryMat]
        .flatMap((m) => (Array.isArray(m) ? m.map(nome) : m ? [nome(m)] : [])),
    ];
    if (ns.some((n) => /tk-housing-white/i.test(n))) hit.push(o);
  });
  return hit;
}
const snapshotTk = (tag) => {
  const rows = tkMeshes().map((o) => ({
    n: o.name, mat: mats(o).map(nome).join('+'), trimKey: o.userData.trimKey || null,
    origMat: o.userData.origMat ? nome(o.userData.origMat) : null,
  }));
  out.push([tag, JSON.stringify(rows)]);
  return rows;
};

/* ---- vai para o SOBRECHASSI (VM rígido) ---- */
const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    for (const c of (mo.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, mo, c });
    }
  }
}
const vm = alvos.find((a) => /vm_2015_6x2r/i.test(a.c.file));
if (vm) {
  await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: vm.mk.id, modelId: vm.mo.id, chassisId: vm.c.id,
    colorId: null, finishId: null, trim: null,
  }, { curtain: false });
  await B.until(() => (S.state.implement?.id || '').includes('sobrechassi'), 300000);
  for (let i = 0; i < 30; i++) await B.frame();
}
out.push(['implemento', S.state.implement?.id || '-']);
out.push(['paintTarget', S.state.paintTarget]);
snapshotTk('1. de fábrica (cab)');

/* ---- 2. O ESTADO DE UM F5: malha recém-carregada, SEM carimbo ---- */
S.livery.setImplementPainted(false, { echo: true });
for (let i = 0; i < 4; i++) await B.frame();
for (const o of tkMeshes()) {
  delete o.userData.trimKey; delete o.userData.trimOrigMat;
  delete o.userData.trimFactoryMat; delete o.userData.origMat;
}
snapshotTk('2. carimbos apagados (= malha recém-carregada)');

/* ---- 3. A PRIMEIRA COISA QUE O BOOT FAZ com paintTarget:'both' ---- */
S.livery.setImplementPainted(true, { echo: true });
for (let i = 0; i < 6; i++) await B.frame();
const dep = snapshotTk('3. depois de setImplementPainted(true)');
const perdido = dep.every((r) => !r.trimKey);
out.push(['★ a carcaça do TK deixou de ser CASÁVEL por trim.ts (trimKey nulo)', perdido]);
out.push(['★ …e o material dela agora é a tinta do baú',
  dep.every((r) => /carpaint(?!-)/.test(r.mat))]);

/* ---- 4. CONTROLE: o mesmo, mas com o alvo 'cab' ---- */
S.livery.setImplementPainted(false, { echo: true });
for (let i = 0; i < 6; i++) await B.frame();
for (const o of tkMeshes()) {
  delete o.userData.trimKey; delete o.userData.trimOrigMat;
  delete o.userData.trimFactoryMat; delete o.userData.origMat;
}
S.livery.setImplementPainted(false, { echo: true });
for (let i = 0; i < 6; i++) await B.frame();
const ctrl = snapshotTk('4. controle: alvo cab, carimbos apagados');
out.push(['★ controle: com o alvo cab a carcaça É carimbada',
  ctrl.some((r) => r.trimKey === 'thermoking')]);

/* ---- 5. o retrato do flanco com o implemento PINTADO ---- */
S.livery.setImplementPainted(true, { echo: true });
for (let i = 0; i < 40; i++) await B.frame();
const snap = S.livery.getSnapshot && S.livery.getSnapshot('left');
if (snap) {
  try {
    const img = await new Promise((ok, no) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = snap.bg;
    });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    out.push(['sobre-left-bg-pintado', c.toDataURL('image/png')]);
  } catch (e) { out.push(['sobre-left-bg-pintado', 'falhou']); }
}
return out;
