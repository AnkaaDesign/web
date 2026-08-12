/* SONDA 4 — os vértices EXATOS que a correção vai mexer, nos três itens.
   ===========================================================================
   O que já está medido (sondas 1..3 de 2026-08-11):

   · o galvanizado da testeira é UMA malha, e a banda de baixo dela é uma
     extrusão PURA: os únicos |x| que existem abaixo de y 4093 são
     1043 · 1046 · 1243 · 1247. Esticar uma extrusão ao longo do próprio eixo
     é exato — basta mover o par da ponta de dentro.
   · o vão branco vai de |x| 998 (borda do Thermo King) a 1043.
   · a trava e a borracha da porta traseira estão centradas no vale #1
     (185 mm do piso) e o pedido é o vale #2 (242 mm).

   Falta o que uma edição precisa e uma caixa não dá: o RECORTE. Onde termina
   a banda de baixo e começa a tira cheia de cima (um vértice na fronteira
   errada rasga a malha), e se a regra de seleção da ferragem traseira pega
   exatamente as seis peças e nada mais.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-frente-corte.mjs
*/
const out = [];
const B = window.__bench;

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
const prof = S.trailerRig.profile;
const mm = (v) => Math.round(v * 1000);
const root = S.trailer;
root.updateWorldMatrix(true, true);
const toLocal = root.matrixWorld.clone().invert();

/* ---------------- 1. o galvanizado da testeira, vértice a vértice -------- */
let frame = null;
root.traverse((node) => {
  const o = node;
  if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  if (!mats.some((m) => /metal-galvanizado-mantido/i.test((m && m.name) || ''))) return;
  const pos = o.geometry.attributes.position;
  const m4 = new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld);
  const v = new THREE.Vector3();
  let n = 0;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(m4);
    if (v.z > 7.0 && v.y > 3.9) n++;
  }
  if (n > 0 && (!frame || n > frame.n)) frame = { mesh: o, n, m4 };
});
if (frame) {
  const pos = frame.mesh.geometry.attributes.position;
  const v = new THREE.Vector3();
  out.push(['frame', `${frame.mesh.name} · ${pos.count} vértices no total`]);

  /* Histograma por |x|: quantos vértices, e em que faixa de y cada coluna
     vive. É isto que diz se a tira cheia de cima e a banda de baixo dividem
     algum vértice. */
  const cols = new Map();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(frame.m4);
    const k = mm(Math.abs(v.x));
    let c = cols.get(k);
    if (!c) { c = { n: 0, yLo: Infinity, yHi: -Infinity, zLo: Infinity, zHi: -Infinity }; cols.set(k, c); }
    c.n++;
    c.yLo = Math.min(c.yLo, v.y); c.yHi = Math.max(c.yHi, v.y);
    c.zLo = Math.min(c.zLo, v.z); c.zHi = Math.max(c.zHi, v.z);
  }
  const keys = [...cols.keys()].sort((a, b) => a - b);
  out.push(['colunas |x| do frame', keys.length]);
  for (const k of keys) {
    const c = cols.get(k);
    out.push([`  |x| ${k}`, `${c.n} vértices · y ${mm(c.yLo)}..${mm(c.yHi)} · z ${mm(c.zLo)}..${mm(c.zHi)}`]);
  }

  /* E o corte: para cada coluna de dentro, TODOS os y distintos. Se a banda
     de baixo termina em 4095 e a tira começa em 4095 sem compartilhar
     vértice, mover por `y <= 4094` é seguro. */
  for (const target of keys.filter((k) => k < 1150)) {
    const ys = new Set();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(frame.m4);
      if (mm(Math.abs(v.x)) !== target) continue;
      ys.add(mm(v.y));
    }
    out.push([`  y distintos em |x| ${target}`,
      [...ys].sort((a, b) => a - b).join(' ')]);
  }
}

/* ---------------- 2. a silhueta do Thermo King na faixa da banda -------- */
const tk = S.state?.tk;
if (tk) {
  tk.updateWorldMatrix(true, true);
  const rows = new Map();
  const p = new THREE.Vector3();
  tk.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).applyMatrix4(toLocal);
      if (p.y < 3.90 || p.y > 4.11) continue;
      const k = Math.round(p.y * 100) / 100;
      rows.set(k, Math.max(rows.get(k) || 0, Math.abs(p.x)));
    }
  });
  out.push(['meia-largura do TK por altura',
    [...rows.keys()].sort((a, b) => a - b).map((k) => `${mm(k)}:${mm(rows.get(k))}`).join(' ')]);
}

/* ---------------- 3. a regra de seleção da ferragem traseira ------------ */
const HW_MAT = /engate-femea|metal-pouco-polido|borracha-preta/i;
const SKIN = 1.295;            // a crista da lateral fica em 1,304
const picked = [];
const v2 = new THREE.Vector3();
root.traverse((node) => {
  const o = node;
  if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  const mat = mats.map((m) => (m && m.name) || '?').join('+');
  if (!HW_MAT.test(mat)) return;
  const pos = o.geometry.attributes.position;
  const m4 = new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld);
  const b = new THREE.Box3();
  for (let i = 0; i < pos.count; i++) b.expandByPoint(v2.fromBufferAttribute(pos, i).applyMatrix4(m4));
  const cy = (b.min.y + b.max.y) / 2 - prof.floorY;
  const inX = Math.min(Math.abs(b.min.x), Math.abs(b.max.x));
  const outX = Math.max(Math.abs(b.min.x), Math.abs(b.max.x));
  const size = b.getSize(new THREE.Vector3());
  const hit = inX >= SKIN && outX > 1.310
    && Math.max(size.x, size.y, size.z) <= 0.12
    && cy > 0.10 && cy < 0.35
    && (b.min.z + b.max.z) / 2 < (prof.z0 + prof.z1) / 2;
  if (hit) {
    picked.push(`${o.name.slice(0, 34)} [${mat.slice(0, 22)}]`
      + ` x ${mm(b.min.x)}..${mm(b.max.x)} y ${mm(b.min.y)}..${mm(b.max.y)}`
      + ` z ${mm(b.min.z)}..${mm(b.max.z)} · centro ${mm(cy)} do piso`);
  }
});
out.push(['ferragem selecionada: peças', picked.length]);
for (const p of picked) out.push(['  pega', p]);

return out;
