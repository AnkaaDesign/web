/* DIAGNÓSTICO 3 — A REGRA DO SEMIRREBOQUE: a que altura a estação encontra o
   implemento, medido NO ORIGINAL.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-diag-grade-referencia-0823.mjs

   O diagnóstico 2 mediu, nos três rígidos, o TETO que o implemento oferece
   acima da grade: 1 135 mm no Scania, 1 237 no VM e 1 376 no VW — contra um
   topo de estação FIXO em 1 090, que é cota do asset. Falta o número do
   original: se lá o teto está em 1 090, a regra é "o topo da estação é a
   barriga do implemento" e o conserto é esticar. Tudo em MUNDO, com o solo em
   y = 0 (a bancada põe o conjunto no chão). */
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

let mk = null, mo = null, c = null;
for (const m of (S.catalog.catalog?.manufacturers || [])) for (const md of (m.models || [])) for (const ch of (md.chassis || []))
  if (!c && /4x2/.test(ch.id) && /scania-r-2016/.test(md.id)) { mk = m; mo = md; c = ch; }
if (!c) { out.push(['★ acha o cavalo 4x2', false]); return out; }
await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: mk.id, modelId: mo.id, chassisId: c.id, colorId: null, finishId: null, trim: null }, { curtain: false });
await B.until(() => (S.state.cabDef?.file || '') === c.file, 300000);
await B.until(() => !!S.state.trailer, 300000);
for (let i = 0; i < 40; i++) await B.frame();
out.push(['implemento', `${S.state.implement?.id} · ${S.state.implement?.short}`]);

const t = S.state.trailer;
t.updateWorldMatrix(true, true);
const v = new THREE.Vector3();

/* 1 · A GRADE do original, por material, em MUNDO. */
const porNome = new Map();
const anota = (mapa, chave, x, y, z) => {
  let s = mapa.get(chave);
  if (!s) { s = { n: 0, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity }; mapa.set(chave, s); }
  s.n++; s.x0 = Math.min(s.x0, x); s.x1 = Math.max(s.x1, x);
  s.y0 = Math.min(s.y0, y); s.y1 = Math.max(s.y1, y);
  s.z0 = Math.min(s.z0, z); s.z1 = Math.max(s.z1, z);
};
/* O corredor da grade: |x| 1,10…1,32, y 0,40…1,10 — a caixa medida no bake. */
t.traverse((o) => {
  if (!o.isMesh || !o.geometry?.attributes?.position || !o.visible) return;
  const pos = o.geometry.attributes.position;
  const passo = pos.count > 60000 ? 3 : 1;
  const mat = (Array.isArray(o.material) ? o.material[0] : o.material)?.name || '?';
  for (let i = 0; i < pos.count; i += passo) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(o.matrixWorld);
    const ax = Math.abs(v.x);
    if (ax < 1.10 || ax > 1.32 || v.y < 0.40 || v.y > 1.10) continue;
    anota(porNome, `${o.name} · ${mat}`, ax, v.y, v.z);
  }
});
out.push(['1 · o que existe no corredor da grade (|x| 1100…1320, y 400…1100)', '\n        '
  + [...porNome].sort((p, q) => q[1].n - p[1].n).slice(0, 10)
    .map(([n, s]) => `${n}: ${s.n} pts · |x| ${mm(s.x0)}…${mm(s.x1)} y ${mm(s.y0)}…${mm(s.y1)} z ${mm(s.z0)}…${mm(s.z1)}`).join('\n        ')]);

/* 2 · O TETO acima da grade, por célula de z — a mesma régua do diagnóstico 2. */
for (const [x0, x1, rot] of [[1.00, 1.32, 'sobre a GRADE (|x| 1000…1320)'],
  [0.62, 1.00, 'entre grade e longarina (|x| 620…1000)']]) {
  const cel = new Map(); const donos = new Map();
  t.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || !o.visible) return;
    const pos = o.geometry.attributes.position;
    const passo = pos.count > 60000 ? 3 : 1;
    for (let i = 0; i < pos.count; i += passo) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(o.matrixWorld);
      const ax = Math.abs(v.x);
      if (ax < x0 || ax > x1 || v.y < 1.02 || v.y > 2.0) continue;
      const k = Math.round(v.z / 0.25);
      const u = cel.get(k);
      if (!u || v.y < u.y) cel.set(k, { y: v.y, nome: o.name });
      anota(donos, o.name, ax, v.y, v.z);
    }
  });
  out.push([`2 · teto ${rot} — y por célula de 250 mm`, '\n        '
    + [...cel].sort((p, q) => p[0] - q[0]).map(([k, u]) => `${mm(k * 0.25)}:${mm(u.y)}`).join(' ')]);
  out.push(['    quem faz esse teto', '\n        '
    + [...donos].sort((p, q) => q[1].n - p[1].n).slice(0, 6)
      .map(([n, s]) => `${n}: ${s.n} pts · |x| ${mm(s.x0)}…${mm(s.x1)} y ${mm(s.y0)}…${mm(s.y1)}`).join('\n        ')]);
}

/* 3 · E a LONGARINA do semirreboque, para conferir o número do bake (|x| 477…483,
      face de baixo em 933 mm). */
{
  let minY = Infinity; const pts = [];
  t.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || !o.visible) return;
    const pos = o.geometry.attributes.position;
    const passo = pos.count > 60000 ? 3 : 1;
    for (let i = 0; i < pos.count; i += passo) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(o.matrixWorld);
      const ax = Math.abs(v.x);
      if (ax < 0.30 || ax > 0.62 || v.y < 0.40 || v.y > 1.80) continue;
      pts.push({ x: ax, y: v.y }); if (v.y < minY) minY = v.y;
    }
  });
  const naFace = pts.filter((p) => p.y < minY + 0.03).map((p) => p.x).sort((a, b) => a - b);
  out.push(['3 · longarina do semirreboque (|x| 300…620)',
    `face de baixo ${mm(minY)} mm · |x| p95 ${mm(naFace[Math.floor(naFace.length * 0.95)] || NaN)} · ${naFace.length} pts na face`]);
}
return out;
