/* VERIFICAÇÃO das correções de 2026-08-12 (prints do Kennedy).
   ===========================================================================
     1. a ferragem da porta traseira, CENTRADA na parte lisa do 2º friso — a
        rodada anterior mirou em `valeInfo.row0 + valeH/2` e caiu 33 mm alta,
        em cima da crista. A régua certa é `RIB_FLAT_CENTER`, a mesma dos
        rebites de emenda.
     2. a porta lateral não leva rebite de emenda nenhum;
     3. nem o marco/moldura dela;
     4. a dobradiça fica para a DIANTEIRA nos DOIS flancos.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-portas-0812.mjs
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
const mm = (v) => Math.round(v * 1000);
const root = S.trailer;
const prof = S.trailerRig.profile;

function toLocal() {
  root.updateWorldMatrix(true, true);
  return root.matrixWorld.clone().invert();
}

/** Caixa de uma malha (ou de uma instância) no referencial do implemento. */
function boxesOf(pred) {
  const inv = toLocal();
  const v = new THREE.Vector3();
  const rows = [];
  root.traverse((node) => {
    const o = node;
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const mat = mats.map((m) => (m && m.name) || '?').join('+');
    if (!pred(o, mat)) return;
    const pos = o.geometry.attributes.position;
    const base = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const n = o.isInstancedMesh ? o.count : 1;
    for (let i = 0; i < n; i++) {
      const m4 = base.clone();
      if (o.isInstancedMesh) {
        const t = new THREE.Matrix4();
        o.getMatrixAt(i, t);
        m4.multiply(t);
      }
      const b = new THREE.Box3();
      for (let k = 0; k < pos.count; k++) b.expandByPoint(v.fromBufferAttribute(pos, k).applyMatrix4(m4));
      rows.push({ name: o.name || '?', mat, box: b });
    }
  });
  return rows;
}

/* ---------------- 1. a ferragem da porta traseira ---------------- */
{
  const vale = S.trailerRig.body.valeInfo;
  /* A MESMA régua dos rebites: `row0 + 46,7 mm + n · passo`. Ela é constante do
     engine (`RIB_FLAT_CENTER`); repetida aqui de propósito, para o teste falhar
     se alguém mudar a constante sem querer. */
  const band = (n) => vale.row0 + 0.0467 + n * vale.pitch;
  const hw = boxesOf((o, mat) => /engate-femea|metal-pouco-polido|borracha-preta/i.test(mat))
    .filter((r) => {
      const s = r.box.getSize(new THREE.Vector3());
      if (Math.max(s.x, s.y, s.z) > 0.12) return false;
      const inX = Math.min(Math.abs(r.box.min.x), Math.abs(r.box.max.x));
      if (inX < 1.28) return false;
      const cz = (r.box.min.z + r.box.max.z) / 2;
      if (cz > (prof.z0 + prof.z1) / 2) return false;
      const cy = (r.box.min.y + r.box.max.y) / 2 - prof.floorY;
      return cy > 0.05 && cy < 0.45;
    });
  out.push(['1 · peças de ferragem achadas', hw.length === 6]);
  const pad = hw.reduce((a, b2) =>
    (b2.box.max.y - b2.box.min.y) < (a.box.max.y - a.box.min.y) ? b2 : a, hw[0]);
  const padCy = (pad.box.min.y + pad.box.max.y) / 2;
  out.push(['1 · borracha na 2ª faixa lisa', Math.abs(padCy - band(0)) <= 0.002]);
  out.push(['  faixas lisas (do piso)',
    [-1, 0, 1, 2].map((n) => `${n}:${mm(band(n) - prof.floorY)}`).join(' ')]);
  out.push(['  borracha', `${mm(pad.box.min.y - prof.floorY)}..${mm(pad.box.max.y - prof.floorY)}`
    + ` · centro ${mm(padCy - prof.floorY)} · alvo ${mm(band(0) - prof.floorY)}`]);
  out.push(['  todas', hw.map((r) => `${r.mat.slice(0, 12)}@${mm((r.box.min.y + r.box.max.y) / 2 - prof.floorY)}`).join(' ')]);
  /* E o cruzamento que importa: a ferragem tem de assentar no MESMO plano dos
     rebites de emenda, senão uma das duas está no friso errado. */
  const g = S.models.getPlateGrid?.();
  if (g?.rivetRowsFromBottom?.length) {
    const near = g.rivetRowsFromBottom
      .map((r) => Math.abs((r + (prof.floorY - 0.02)) - padCy))
      .sort((a, b2) => a - b2)[0];
    out.push(['  rebite mais próximo da borracha (mm)', mm(near)]);
  }
}

/* ---------------- portas nos DOIS lados ---------------- */
const L = S.trailerDims.length;
S.measures.setImplementDoors?.('left', []);
const doorSpec = [{ position: L / 2 - 0.45, width: 0.9, height: 2.35 }];
S.models.setTrailerDoors('left', doorSpec);
S.models.setTrailerDoors('right', doorSpec);
await B.until(() => S.trailerRig.body.getDoorHoles('left').length === 1
  && S.trailerRig.body.getDoorHoles('right').length === 1, 60000);
await B.frame(); await B.frame();

for (const face of ['left', 'right']) {
  const h = S.trailerRig.body.getDoorHoles(face)[0];
  out.push([`vão ${face}`, h ? `y ${mm(h.y0)}..${mm(h.y1)} · z ${mm(h.z0)}..${mm(h.z1)}` : 'AUSENTE']);
}

/* ---------------- 2 e 3. nenhum rebite de emenda na porta ---------------- */
{
  const TRIM = 0.0073, DOME = 0.009;
  let bad = 0;
  const detail = [];
  for (const face of ['left', 'right']) {
    const hole = S.trailerRig.body.getDoorHoles(face)[0];
    if (!hole) continue;
    const name = face === 'right' ? 'SIDE_R_RIVETS' : 'SIDE_L_RIVETS';
    const inv = toLocal();
    const v = new THREE.Vector3();
    let seen = 0, hit = 0;
    root.traverse((node) => {
      const o = node;
      if (!o.isMesh || o.name !== name || !o.geometry?.attributes?.position) return;
      const pos = o.geometry.attributes.position;
      const m4 = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      const zs = new Set();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m4);
        zs.add(Math.round(v.z * 200));           // agrupa por coluna (5 mm)
        if (v.z >= hole.z0 - TRIM - DOME && v.z <= hole.z1 + TRIM + DOME
          && v.y >= hole.y0 - TRIM - DOME && v.y <= hole.y1 + TRIM + DOME) hit++;
      }
      seen = zs.size;
    });
    detail.push(`${face}: ${hit} vértices dentro do vão · ${seen} colunas`);
    if (hit) bad++;
  }
  out.push(['2/3 · nenhum rebite de emenda sobre porta ou marco', bad === 0]);
  for (const d of detail) out.push(['  ', d]);

  /* E o contra-teste: as colunas fora da porta continuam lá. Uma regra que
     apagasse TODOS os rebites também passaria no teste acima. */
  const g = S.models.getPlateGrid?.();
  out.push(['2/3 · as outras colunas sobreviveram',
    !!g && g.seamsFromFront.length > 4]);
}

/* ---------------- 5. a folha é uma CHAPA ÚNICA, sem emenda -------------- */
{
  /* O remonte desloca a chapa em X ao longo do metro (0 → 2,2 mm) e devolve o
     degrau numa parede curta na emenda. Numa folha sem emenda, a profundidade
     de cada friso tem de ser a MESMA em toda a largura: mede-se o x mais
     externo por faixa de 2 mm de altura, dentro do vão, e compara-se a
     dispersão em Z. Com remonte a dispersão é da ordem do degrau (2,2 mm);
     sem ele, é ruído de tesselação. */
  const inv = toLocal();
  const v = new THREE.Vector3();
  let worst = 0, leafVerts = 0;
  for (const face of ['left', 'right']) {
    const hole = S.trailerRig.body.getDoorHoles(face)[0];
    if (!hole) continue;
    const name = face === 'right' ? 'SIDE_R' : 'SIDE_L';
    const sgn = face === 'right' ? 1 : -1;
    root.traverse((node) => {
      const o = node;
      if (!o.isMesh || o.name !== name || !o.geometry?.attributes?.position) return;
      const pos = o.geometry.attributes.position;
      const m4 = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      /* Por FAIXA de altura, o x mais externo em cada terço da largura. */
      const bins = new Map();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m4);
        if (v.z <= hole.z0 || v.z >= hole.z1 || v.y <= hole.y0 || v.y >= hole.y1) continue;
        leafVerts++;
        const b = Math.round(v.y / 0.002);
        const third = Math.floor(((v.z - hole.z0) / (hole.z1 - hole.z0)) * 3);
        const key = b * 4 + Math.min(2, Math.max(0, third));
        const d = sgn * v.x;
        if (!(d <= (bins.get(key) ?? -Infinity))) bins.set(key, d);
      }
      /* Junta os três terços de cada faixa e mede o espalhamento. */
      const rows = new Map();
      for (const [key, d] of bins) {
        const b = Math.floor(key / 4);
        const arr = rows.get(b) ?? [];
        arr.push(d);
        rows.set(b, arr);
      }
      for (const arr of rows.values()) {
        if (arr.length < 3) continue;
        worst = Math.max(worst, Math.max(...arr) - Math.min(...arr));
      }
    });
  }
  out.push(['5 · folha vértices medidos', leafVerts > 100]);
  out.push(['5 · folha sem degrau de remonte', worst < 0.0008]);
  out.push(['  maior desnível na folha (µm)', Math.round(worst * 1e6)]);
}

/* ---------------- 4. dobradiça para a DIANTEIRA nos dois lados ---------- */
{
  let ok = true;
  for (const face of ['left', 'right']) {
    const hole = S.trailerRig.body.getDoorHoles(face)[0];
    if (!hole) { ok = false; continue; }
    const zMid = (hole.z0 + hole.z1) / 2;
    const suf = face === 'right' ? 'R' : 'L';
    const talas = boxesOf((o) => o.name === `PORTA_TALA_${suf}`);
    const varoes = boxesOf((o) => o.name === `PORTA_VARAO_${suf}`);
    const tz = talas.length
      ? talas.reduce((s, r) => s + (r.box.min.z + r.box.max.z) / 2, 0) / talas.length : NaN;
    const vz = varoes.length
      ? varoes.reduce((s, r) => s + (r.box.min.z + r.box.max.z) / 2, 0) / varoes.length : NaN;
    /* +Z é a DIANTEIRA (a testeira é `z1`). */
    const good = talas.length > 0 && tz > zMid && (!varoes.length || vz < zMid);
    if (!good) ok = false;
    out.push([`  ${face}`, `${talas.length} talas @ z ${mm(tz)} · varão @ z ${mm(vz)}`
      + ` · meio do vão ${mm(zMid)} · ${good ? 'dobradiça À FRENTE' : 'ERRADO'}`]);
  }
  out.push(['4 · dobradiça para a dianteira nos dois flancos', ok]);
}

return out;
