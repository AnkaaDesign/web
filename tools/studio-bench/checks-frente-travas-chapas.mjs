/* SONDA do relato de 2026-08-11 (três prints do Kennedy):
     1. o frame metálico superior da TESTEIRA termina antes do Thermo King;
     2. a borracha e a trava lateral da porta traseira estão baixas demais —
        deveriam ficar centradas na parte lisa do SEGUNDO friso;
     3. as chapas de 1 m começam inteiras na TRASEIRA e a sobra fica na frente.

   Só mede e imprime — nenhuma correção aqui.
   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-frente-travas-chapas.mjs
*/
const out = [];
const B = window.__bench;

/* GOTCHA da bancada: esperar o seletor ABRIR antes de atravessá-lo, senão
   `settle()` devolve true por vacuidade e o boot trava nele para sempre. */
await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);

async function settle() {
  const overlay = document.getElementById('ts-selector');
  if (!overlay) return true;
  for (let step = 0; step < 12; step++) {
    if (overlay.classList.contains('hidden')) return true;
    const cards = [...overlay.querySelectorAll('.ts-card:not([disabled])')];
    if (!cards.length) break;
    const local = cards.find((c) => /scania|volvo|iveco/i.test(c.dataset.id || ''));
    (local || cards[0]).click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  return overlay.classList.contains('hidden');
}

out.push(['seletor atravessado', await settle()]);
out.push(['__studio de pé', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;
out.push(['implemento carregado', await B.until(() => !!S.trailerRig, 240000)]);
if (!S.trailerRig) return out;
await B.frame(); await B.frame();

const THREE = S.THREE;
const rig = S.trailerRig;
const prof = rig.profile;
const mm = (v) => Math.round(v * 1000);

const root = S.trailer;
root.updateWorldMatrix(true, true);
const inv = root.matrixWorld.clone().invert();

out.push(['dims correntes', JSON.stringify(S.trailerDims)]);
out.push(['perfil', `piso ${mm(prof.floorY)} · teto ${mm(prof.roofY)}`
  + ` · saia ${mm(prof.skirtHeight)} · passo ${mm(prof.pitch)}`
  + ` · frisos ${prof.ribCount} · z0 ${mm(prof.z0)} · z1 ${mm(prof.z1)}`]);
const vale = rig.body.valeInfo;
out.push(['grade do friso', vale
  ? `row0 ${mm(vale.row0)} (do piso ${mm(vale.row0 - prof.floorY)})`
    + ` · passo ${mm(vale.pitch)} · vale ${mm(vale.valeH)}`
  : 'null']);
if (vale) {
  for (let k = 0; k < 4; k++) {
    const lo = vale.row0 + k * vale.pitch;
    out.push([`  vale #${k + 1}`,
      `${mm(lo - prof.floorY)}..${mm(lo + vale.valeH - prof.floorY)} do piso`
      + ` · centro ${mm(lo + vale.valeH / 2 - prof.floorY)}`]);
  }
}

/* ---------- inventário por MALHA no referencial do implemento ---------- */
const v = new THREE.Vector3();
const m4 = new THREE.Matrix4();
function rowsIn(pred) {
  const rows = [];
  root.traverse((node) => {
    const o = node;
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    m4.multiplyMatrices(inv, o.matrixWorld);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const mat = mats.map((m) => (m && m.name) || '?').join('+');
    const n = o.isInstancedMesh ? o.count : 1;
    for (let inst = 0; inst < n; inst++) {
      const mi = new THREE.Matrix4().copy(m4);
      if (o.isInstancedMesh) {
        const t = new THREE.Matrix4();
        o.getMatrixAt(inst, t);
        mi.multiply(t);
      }
      let xLo = Infinity, xHi = -Infinity, yLo = Infinity, yHi = -Infinity;
      let zLo = Infinity, zHi = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mi);
        if (v.x < xLo) xLo = v.x; if (v.x > xHi) xHi = v.x;
        if (v.y < yLo) yLo = v.y; if (v.y > yHi) yHi = v.y;
        if (v.z < zLo) zLo = v.z; if (v.z > zHi) zHi = v.z;
      }
      const r = { name: o.name || '?', mat, inst, n, xLo, xHi, yLo, yHi, zLo, zHi };
      if (pred(r)) rows.push(r);
    }
  });
  return rows;
}
const fmt = (r) => `${r.name.slice(0, 34)} [${r.mat.slice(0, 28)}]`
  + `${r.n > 1 ? ` i${r.inst}/${r.n}` : ''}`
  + ` x ${mm(r.xLo)}..${mm(r.xHi)} y ${mm(r.yLo)}..${mm(r.yHi)} z ${mm(r.zLo)}..${mm(r.zHi)}`;

/* ---------- 1. testeira: o que existe no alto, e onde a unidade está ---- */
const tk = S.state?.tk;
if (tk) {
  const b = new THREE.Box3();
  const p = new THREE.Vector3();
  tk.updateWorldMatrix(true, true);
  tk.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      b.expandByPoint(p);
    }
  });
  out.push(['thermo king (local)',
    `x ${mm(b.min.x)}..${mm(b.max.x)} y ${mm(b.min.y)}..${mm(b.max.y)} z ${mm(b.min.z)}..${mm(b.max.z)}`]);
}
const front = rowsIn((r) => r.zHi > prof.z1 - 0.30 && r.yHi > prof.roofY - 0.55
  && (r.xHi - r.xLo) > 0.05);
front.sort((a, b2) => b2.yHi - a.yHi);
out.push(['testeira alta: peças', front.length]);
for (const r of front.slice(0, 40)) out.push(['  testeira', fmt(r)]);

/* ---------- 2. a trava e a borracha da lateral ---------- */
const HW = /engate-femea|metal-pouco-polido|borracha/i;
const hw = rowsIn((r) => HW.test(r.mat) && Math.abs(r.xHi) > 1.25
  && r.zHi < prof.z0 + 2.0 && r.yLo > prof.floorY && r.yLo < prof.floorY + 0.6);
hw.sort((a, b2) => a.yLo - b2.yLo);
out.push(['ferragem lateral baixa: peças', hw.length]);
for (const r of hw) {
  out.push(['  ferragem', `${fmt(r)} · centro y ${mm((r.yLo + r.yHi) / 2 - prof.floorY)} do piso`]);
}

/* ---------- 3. a grade das chapas ---------- */
function panelSpanZ() {
  let lo = Infinity, hi = -Infinity;
  root.traverse((node) => {
    const o = node;
    if (!o.isMesh || o.name !== 'SIDE_L' || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    m4.multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m4);
      if (v.z < lo) lo = v.z; if (v.z > hi) hi = v.z;
    }
  });
  return hi - lo;
}

function dumpGrid(tag) {
  const g = S.models.getPlateGrid?.();
  const span = panelSpanZ();
  if (!g || !g.seamsFromFront?.length) { out.push([tag, 'sem grade']); return; }
  const s = g.seamsFromFront;
  const widths = [];
  let prev = 0;
  for (const x of s) { widths.push(mm(x - prev)); prev = x; }
  widths.push(mm(span - prev));
  out.push([tag, `painel ${mm(span)} mm · ${widths.length} chapas`]);
  out.push([`  ${tag} larguras (frente→trás)`, widths.join(' | ')]);
}
dumpGrid('chapas de fábrica');

/* ---------- e agora com o baú esticado, que é onde o relato mora ------- */
async function atLength(L) {
  S.measures.setImplementMeasures({ length: L });
  await B.until(() => {
    const d = S.trailerDims;
    return !!d && Math.abs(d.length - L) < 0.06;
  }, 60000);
  await B.frame(); await B.frame();
  dumpGrid(`L=${L}m`);
}
await atLength(12.4);
await atLength(15.6);

return out;
