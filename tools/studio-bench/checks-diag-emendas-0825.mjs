/* DIAGNÓSTICO 2026-08-25 — as EMENDAS da lateral: quantas linhas verticais a
   chapa tem, onde elas caem, e quais delas levam rebite.
   node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-diag-emendas-0825.mjs */

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

/** As linhas verticais da pele: onde o x EXTERNO salta ao longo de z. */
function degraus(mesh, sgn) {
  const pos = mesh.geometry.getAttribute('position');
  const porZ = new Map();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const k = Math.round(z * 10000);
    const cur = porZ.get(k);
    const ext = sgn > 0 ? x : -x;             // "para fora" positivo
    if (cur === undefined || ext > cur) porZ.set(k, ext);
  }
  const zs = [...porZ.keys()].sort((a, b) => a - b);
  const saltos = [];
  for (let i = 1; i < zs.length; i++) {
    const d = porZ.get(zs[i]) - porZ.get(zs[i - 1]);
    if (Math.abs(d) > 0.0005 && (zs[i] - zs[i - 1]) < 60) {
      saltos.push({ z: r4(zs[i] / 10000), d: +(d * 1000).toFixed(2) });
    }
  }
  /* agrupa saltos vizinhos (a parede da emenda tem 1,8 mm e vários vértices) */
  const grupos = [];
  for (const s of saltos) {
    const g = grupos[grupos.length - 1];
    if (g && Math.abs(s.z - g.zFim) < 0.02) { g.zFim = s.z; g.dTotal += s.d; }
    else grupos.push({ zIni: s.z, zFim: s.z, dTotal: s.d });
  }
  return grupos.map((g) => ({ z: r4((g.zIni + g.zFim) / 2), mm: +g.dTotal.toFixed(2) }));
}

/** As colunas de rebite: os z distintos das calotas. */
function colunas(panel) {
  let riv = null;
  panel.traverse((o) => { if (o.isMesh && /_RIVETS$/.test(o.name)) riv = o; });
  if (!riv) return [];
  const pos = riv.geometry.getAttribute('position');
  const set = new Set();
  for (let i = 0; i < pos.count; i++) set.add(Math.round(pos.getZ(i) * 200) / 200);
  const zs = [...set].sort((a, b) => a - b);
  const grupos = [];
  for (const z of zs) {
    const g = grupos[grupos.length - 1];
    if (g && z - g.fim < 0.05) g.fim = z; else grupos.push({ ini: z, fim: z });
  }
  return grupos.map((g) => r4((g.ini + g.fim) / 2));
}

async function analisa(tag) {
  out.push([tag + ' · implemento', S.state.implement?.id || '-']);
  const grid = S.models.getPlateGrid ? S.models.getPlateGrid() : null;
  out.push([tag + ' · plateGrid', grid ? JSON.stringify(grid) : 'null']);
  for (const nome of ['SIDE_L', 'SIDE_R']) {
    const p = acha(nome);
    if (!p) { out.push([tag + ' · ' + nome, 'ausente']); continue; }
    const bb = p.geometry.boundingBox || (p.geometry.computeBoundingBox(), p.geometry.boundingBox);
    out.push([tag + ' · ' + nome + ' caixa', JSON.stringify({
      x: [r4(bb.min.x), r4(bb.max.x)], y: [r4(bb.min.y), r4(bb.max.y)], z: [r4(bb.min.z), r4(bb.max.z)],
    })]);
    const sgn = nome === 'SIDE_R' ? 1 : -1;
    const g = degraus(p, sgn);
    out.push([tag + ' · ' + nome + ' linhas verticais (z, salto mm)', JSON.stringify(g)]);
    const c = colunas(p);
    out.push([tag + ' · ' + nome + ' colunas de rebite (z)', JSON.stringify(c)]);
    /* Casa cada linha com a coluna de rebite mais próxima. */
    const pares = g.map((s) => {
      let melhor = null, dist = Infinity;
      for (const z of c) { const d = Math.abs(z - s.z); if (d < dist) { dist = d; melhor = z; } }
      return { linha: s.z, mm: s.mm, rebite: melhor, dz: melhor === null ? null : +((melhor - s.z) * 1000).toFixed(1) };
    });
    out.push([tag + ' · ' + nome + ' linha × rebite', JSON.stringify(pares)]);
  }
}

await analisa('semirreboque');

/* ---- sobrechassi ---- */
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
  await analisa('sobrechassi');
}
return out;
