/* PORTÃO 2026-08-25 — toda linha vertical da lateral tem de ter coluna de
   rebite, no semirreboque E no sobrechassi, de fábrica E redimensionados.
   node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-emendas-fix-0825.mjs */

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
const r4 = (v) => +v.toFixed(4);

function acha(nome) {
  let hit = null;
  S.state.trailer.traverse((o) => { if (o.isMesh && o.name === nome) hit = o; });
  return hit;
}
function colunas(panel) {
  let riv = null;
  panel.traverse((o) => { if (o.isMesh && /_RIVETS$/.test(o.name)) riv = o; });
  if (!riv) return [];
  const pos = riv.geometry.getAttribute('position');
  const set = new Set();
  for (let i = 0; i < pos.count; i++) set.add(Math.round(pos.getZ(i) * 200) / 200);
  const zs = [...set].sort((a, b) => a - b);
  const g = [];
  for (const z of zs) { const t = g[g.length - 1]; if (t && z - t.fim < 0.05) t.fim = z; else g.push({ ini: z, fim: z }); }
  return g.map((x) => r4((x.ini + x.fim) / 2));
}

async function mede(tag) {
  for (const nome of ['SIDE_L', 'SIDE_R']) {
    const p = acha(nome);
    if (!p) { out.push([`${tag} ${nome}`, 'ausente']); continue; }
    const c = colunas(p);
    const vaos = c.slice(1).map((z, i) => +(z - c[i]).toFixed(3));
    out.push([`${tag} ${nome} colunas`, JSON.stringify(c)]);
    out.push([`${tag} ${nome} vãos`, JSON.stringify(vaos)]);
    const min = Math.min(...vaos), max = Math.max(...vaos);
    out.push([`★ ${tag} ${nome}: nenhum par de colunas mais perto que 0,50 m`, !vaos.length || min >= 0.5]);
    out.push([`${tag} ${nome} vão min/max`, JSON.stringify([min, max])]);
  }
  const g = S.models.getPlateGrid ? S.models.getPlateGrid() : null;
  out.push([`${tag} plateGrid`, g ? JSON.stringify({ pitch: g.pitch, seams: g.seamsFromFront }) : 'null']);
}

await mede('semi fábrica');
/* redimensionado */
S.setTrailerDims({ length: 12.4, height: S.trailerRig?.current?.height ?? 2.78 }, { frame: false });
for (let i = 0; i < 40; i++) await B.frame();
await mede('semi 12,4 m');
S.resetTrailerDims();
for (let i = 0; i < 40; i++) await B.frame();

/* sobrechassi */
const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    for (const c of (mo.chassis || [])) { if (c.file && c.available !== false) alvos.push({ mk, mo, c }); }
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
  await mede('sobre fábrica');
  S.setTrailerDims({ length: 7.5, height: S.trailerRig?.current?.height ?? 2.73 }, { frame: false });
  for (let i = 0; i < 40; i++) await B.frame();
  await mede('sobre 7,5 m');
}
return out;
