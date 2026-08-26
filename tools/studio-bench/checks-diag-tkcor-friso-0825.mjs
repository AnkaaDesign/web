/* DIAGNÓSTICO 2026-08-25 — a cor do Thermo King depois do F5, e o friso do
   sobrechassi no retrato do painel.

   node tools/studio-bench/bench.mjs --gpu --geometry \
        --checks checks-diag-tkcor-friso-0825.mjs > /tmp/tkcor-0825.txt */

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

/** As malhas da carcaça do TK — por material corrente OU por qualquer material
 *  guardado (origMat / trimOrigMat / trimFactoryMat). */
function tkMeshes() {
  const t = S.state.trailer;
  const hit = [];
  if (!t) return hit;
  t.traverse((o) => {
    if (!o.isMesh) return;
    const nomes = [
      ...mats(o).map(nome),
      ...[o.userData.origMat, o.userData.trimOrigMat, o.userData.trimFactoryMat]
        .flatMap((m) => (Array.isArray(m) ? m.map(nome) : m ? [nome(m)] : [])),
    ];
    if (nomes.some((n) => /tk-housing-white/i.test(n))) hit.push(o);
  });
  return hit;
}

function tkReport(tag) {
  const rows = tkMeshes().map((o) => ({
    n: o.name,
    mat: mats(o).map(nome).join('+'),
    trimKey: o.userData.trimKey || null,
    origMat: o.userData.origMat ? nome(o.userData.origMat) : null,
    trimOrig: o.userData.trimOrigMat ? nome(o.userData.trimOrigMat) : null,
    trimFab: o.userData.trimFactoryMat ? nome(o.userData.trimFactoryMat) : null,
  }));
  out.push([tag, JSON.stringify(rows)]);
  return rows;
}

function perfil(tag) {
  const rig = S.state.trailerRig;
  out.push([tag, rig ? JSON.stringify({
    shells: rig.profile.shells, ribbedShells: rig.profile.ribbedShells,
    ribCount: rig.profile.ribCount, pitch: +rig.profile.pitch.toFixed(4),
  }) : 'sem baú paramétrico']);
}

async function retrato(tag, key) {
  const snap = S.livery.getSnapshot ? S.livery.getSnapshot(key) : null;
  if (!snap) { out.push([tag, 'sem retrato']); return; }
  out.push([tag + '-box', JSON.stringify({ ar: +snap.ar.toFixed(3), box: snap.box, paint: snap.paint })]);
  try {
    const img = await new Promise((ok, no) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = snap.bg;
    });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    out.push([tag + '-bg', c.toDataURL('image/png')]);
  } catch (e) { out.push([tag + '-bg', 'falhou: ' + (e && e.message)]); }
  try {
    out.push([tag + '-front', snap.front.toDataURL('image/png')]);
  } catch (e) { out.push([tag + '-front', 'falhou']); }
}

/* ================= 1. o implemento do boot (semirreboque) ================= */
out.push(['implemento do boot', S.state.implement?.id || '-']);
perfil('perfil boot');
tkReport('TK boot (paintTarget ' + S.state.paintTarget + ')');
await retrato('semi-left', 'left');

/* ================= 2. o sobrechassi (VM rígido) ========================== */
const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    for (const c of (mo.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, mo, c });
    }
  }
}
const vm = alvos.find((a) => /vm_2015_6x2r/i.test(a.c.file)) || alvos.find((a) => /sobrechassi/i.test(a.c.file || ''));
if (!vm) { out.push(['★ VM', 'fora do catálogo']); return out; }

await S.applyChoice({
  envId: S.choice?.envId || 'estudio',
  manufacturerId: vm.mk.id, modelId: vm.mo.id, chassisId: vm.c.id,
  colorId: null, finishId: null, trim: null,
}, { curtain: false });
await B.until(() => (S.state.implement?.id || '').includes('sobrechassi'), 300000);
for (let i = 0; i < 30; i++) await B.frame();

out.push(['implemento agora', S.state.implement?.id || '-']);
perfil('perfil sobrechassi');
tkReport('TK sobrechassi (paintTarget ' + S.state.paintTarget + ')');
await retrato('sobre-left', 'left');

/* ================= 3. o F5 SIMULADO ======================================
   Uma malha recém-carregada não tem `userData.trimKey`. Apagar o carimbo põe a
   cena no MESMO estado em que um F5 a entrega, e aí aplicamos a escolha
   gravada — alvo da tinta 'both' + cor própria do Thermo King — pela MESMA
   porta que o boot usa (`applyChoice` → runApply). */
for (const o of tkMeshes()) {
  delete o.userData.trimKey;
  delete o.userData.trimOrigMat;
  delete o.userData.trimFactoryMat;
}
out.push(['carimbos apagados', true]);

const corDoTk = '#ff0000';
const cores = (S.catalog.catalog?.colors || []).filter((c) => c.available !== false);
const corId = (cores[0] && cores[0].id) || null;

await S.applyChoice({
  envId: S.choice?.envId || 'estudio',
  manufacturerId: vm.mk.id, modelId: vm.mo.id, chassisId: vm.c.id,
  colorId: corId, finishId: null,
  trim: { thermoking: { color: corDoTk } },
  paintTarget: 'both',
}, { curtain: false });
for (let i = 0; i < 30; i++) await B.frame();

const depois = tkReport('TK depois do F5 simulado (both + cor própria)');
const pintado = depois.some((r) => /carpaint-thermoking/.test(r.mat));
out.push(['★ a cor própria do TK sobreviveu ao F5 com "pintar o implemento" ligado', pintado]);

/* ================= 4. o CONTROLE: mesma escolha, alvo 'cab' ============== */
for (const o of tkMeshes()) {
  delete o.userData.trimKey;
  delete o.userData.trimOrigMat;
  delete o.userData.trimFactoryMat;
}
const cor2 = (cores[1] && cores[1].id) || corId;
await S.applyChoice({
  envId: S.choice?.envId || 'estudio',
  manufacturerId: vm.mk.id, modelId: vm.mo.id, chassisId: vm.c.id,
  colorId: cor2, finishId: null,
  trim: { thermoking: { color: corDoTk } },
}, { curtain: false });
for (let i = 0; i < 30; i++) await B.frame();
const ctrl = tkReport('TK depois do F5 simulado (cab + cor própria)');
out.push(['★ controle: com "pintar o implemento" DESLIGADO a cor sobrevive',
  ctrl.some((r) => /carpaint-thermoking/.test(r.mat))]);

return out;
