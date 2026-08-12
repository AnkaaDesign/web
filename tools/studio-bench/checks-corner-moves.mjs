/* O QUE SE DESLOCA EM Y NUM RESIZE — inventário por CASCA do assembly.
   ---------------------------------------------------------------------------
   As sondas de faixa mostraram a base do canto imóvel. Mas o usuário vê "o
   frame inferior indo para baixo". Aqui: para CADA casca do TrailerAssembly,
   o y médio dela em fábrica e depois de h220/h300, no referencial do RIG —
   e a lista de todo mundo que desceu/subiu mais de 3 mm, com a regra que o
   moveu. É a peça divergente, nomeada.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-corner-moves.mjs
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
const asm = S.trailerRig.assembly;
const mm = (v) => Math.round(v * 1000);

/** y médio (e faixa) de cada casca, no referencial do RIG, lida da GEOMETRIA
 *  CORRENTE da malha (pós-set) — não das caixas de carga. */
function snapshot() {
  const root = S.trailer;
  root.updateWorldMatrix(true, true);
  const inv = root.matrixWorld.clone().invert();
  const m4 = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const rows = [];
  for (const piece of asm.pieces ?? []) {
    const mesh = piece.mesh;
    const pos = mesh.geometry.getAttribute('position');
    if (!pos) continue;
    m4.multiplyMatrices(inv, mesh.matrixWorld);
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const mat = mats.map((m) => (m && m.name) || '?').join('+');
    for (let pi = 0; pi < piece.parts.length; pi++) {
      const p = piece.parts[pi];
      if (p.repeated) continue;              // colapsada — não é visível
      let lo = Infinity, hi = -Infinity, zLo = Infinity, zHi = -Infinity, cx = 0;
      for (const i of p.idx) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m4);
        if (v.y < lo) lo = v.y;
        if (v.y > hi) hi = v.y;
        if (v.z < zLo) zLo = v.z;
        if (v.z > zHi) zHi = v.z;
        cx += v.x;
      }
      rows.push({
        key: `${mesh.name}#${pi}`, mat, y: p.y, z: p.z,
        latch: !!p.latch, below: !!p.below,
        lo, hi, zLo, zHi, cx: cx / p.idx.length,
      });
    }
  }
  return rows;
}

const base = snapshot();
out.push(['cascas vivas', base.length]);

async function compare(h, tag) {
  S.measures.setImplementMeasures({ height: h });
  await B.until(() => {
    const d = S.trailerDims;
    return !!d && Math.abs(d.height - h) < 0.06;
  }, 60000);
  await B.frame(); await B.frame();
  const now = snapshot();
  const byKey = new Map(now.map((r) => [r.key, r]));
  const moved = [];
  for (const b of base) {
    const n = byKey.get(b.key);
    if (!n) continue;
    const dy = ((n.lo + n.hi) - (b.lo + b.hi)) / 2;
    if (Math.abs(dy) < 0.003) continue;
    moved.push({ ...b, dy });
  }
  moved.sort((a, b2) => (a.lo - b2.lo));
  out.push([`${tag}: cascas que andaram em Y`, moved.length]);
  for (const r of moved.slice(0, 90)) {
    out.push([`  ${tag}`, `dy ${mm(r.dy)} · ${r.y}/${r.z}${r.latch ? ' latch' : ''}`
      + ` · ${r.mat} · y ${mm(r.lo - prof.floorY)}..${mm(r.hi - prof.floorY)}`
      + ` · z ${mm(r.zLo)}..${mm(r.zHi)} · x̄ ${mm(r.cx)} · ${r.key}`]);
  }
  /* De volta à base para a próxima comparação partir do mesmo lugar. */
  S.measures.setImplementMeasures({ height: S.trailerRig.base.height });
  await B.until(() => {
    const d = S.trailerDims;
    return !!d && Math.abs(d.height - S.trailerRig.base.height) < 0.06;
  }, 60000);
  await B.frame(); await B.frame();
}

await compare(2.2, 'h220');
await compare(3.0, 'h300');

return out;
