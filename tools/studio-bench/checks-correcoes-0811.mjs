/* VERIFICAÇÃO das três correções pedidas em 2026-08-11 (prints do Kennedy).
   ===========================================================================
     1. o frame galvanizado da testeira tem de chegar até atrás do Thermo King
        — nada de branco entre a carenagem e o frame;
     2. a borracha e a trava da porta traseira, centradas no rebaixo do
        SEGUNDO friso — e continuar lá depois de mudar a altura do baú;
     3. as chapas da lateral começando INTEIRAS na testeira, com a sobra na
        traseira — em qualquer comprimento.

   As sondas que levantaram os números estão em `checks-frente-travas-chapas`,
   `checks-frente-frame`, `checks-frente-forma` e `checks-frente-corte`. Este
   arquivo é o que FALHA quando alguma delas regride.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-correcoes-0811.mjs
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

function refresh() {
  root.updateWorldMatrix(true, true);
  return root.matrixWorld.clone().invert();
}
let toLocal = refresh();

const targets = [];
root.traverse((o) => { if (o.isMesh && o.visible) targets.push(o); });

const ray = new THREE.Raycaster();
const org = new THREE.Vector3();
const dir = new THREE.Vector3();
const hitLocal = new THREE.Vector3();

/** O material do primeiro toque na casca da testeira, ou null. */
function frontHit(x, y) {
  root.updateWorldMatrix(true, true);
  org.set(x, y, 12).applyMatrix4(root.matrixWorld);
  dir.set(0, 0, -1).transformDirection(root.matrixWorld);
  ray.set(org, dir);
  for (const h of ray.intersectObjects(targets, false)) {
    hitLocal.copy(h.point).applyMatrix4(toLocal);
    if (hitLocal.z < 7.10 || hitLocal.z > 7.24) continue;
    const mats = Array.isArray(h.object.material) ? h.object.material : [h.object.material];
    return mats.map((m) => (m && m.name) || '?').join('+');
  }
  return null;
}

/* ---------------- 1. o vão branco da testeira ---------------- */
{
  /* A faixa que ANTES vinha branca: |x| 1000..1040, na altura da banda de
     baixo do frame (y 3965..4090). O teste é "nada de branco aqui". */
  const bad = [];
  for (const y of [3.970, 4.000, 4.030, 4.060, 4.085]) {
    for (const x of [-1.040, -1.020, -1.000, 1.000, 1.020, 1.040]) {
      const m = frontHit(x, y);
      if (!m || /Cor_padrao_branco|metalBranco/i.test(m)) bad.push(`${mm(x)}/${mm(y)}:${m || 'vazio'}`);
    }
  }
  out.push(['1 · testeira sem branco no vão do TK', bad.length === 0]);
  if (bad.length) out.push(['  ainda branco em', bad.join(' ')]);

  /* E o frame chega mesmo à linha de centro (atrás da carenagem). */
  const centre = frontHit(0.20, 4.030);
  out.push(['1 · frame corrido até o centro',
    !!centre && /metal-galvanizado-mantido/i.test(centre)]);
  out.push(['  material no centro', centre || 'vazio']);

  /* O canto NÃO andou: a ponta de fora do frame fica onde estava. */
  const corner = frontHit(1.150, 4.030);
  out.push(['1 · canto intacto', !!corner && /metal-galvanizado-mantido/i.test(corner)]);
}

/* ---------------- 2. a ferragem da porta traseira ---------------- */
function hardware() {
  toLocal = refresh();
  const prof = S.trailerRig.profile;
  const vale = S.trailerRig.body.valeInfo;
  const rows = [];
  const v = new THREE.Vector3();
  root.traverse((node) => {
    const o = node;
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const mat = mats.map((m) => (m && m.name) || '?').join('+');
    if (!/engate-femea|metal-pouco-polido|borracha-preta/i.test(mat)) return;
    const pos = o.geometry.attributes.position;
    const m4 = new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld);
    const b = new THREE.Box3();
    for (let i = 0; i < pos.count; i++) b.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m4));
    const size = b.getSize(new THREE.Vector3());
    if (Math.max(size.x, size.y, size.z) > 0.12) return;
    const inX = Math.min(Math.abs(b.min.x), Math.abs(b.max.x));
    if (inX < 1.28) return;
    if ((b.min.z + b.max.z) / 2 > (prof.z0 + prof.z1) / 2) return;
    const cy = (b.min.y + b.max.y) / 2 - prof.floorY;
    if (cy < 0.05 || cy > 0.45) return;
    rows.push({ name: o.name, mat, h: size.y, cy, lo: b.min.y - prof.floorY, hi: b.max.y - prof.floorY });
  });
  return { vale, prof, rows };
}

function checkHardware(tag) {
  const { vale, rows } = hardware();
  if (!vale || !rows.length) { out.push([`2 · ${tag}`, false]); return; }
  const base = vale.row0 - S.trailerRig.profile.floorY; // +175 de fábrica
  /* A RÉGUA É `RIB_FLAT_CENTER` (+46,7 mm de cada passo), a mesma dos rebites
     de emenda — e NÃO `row0 + valeH/2`, que é onde a fileira é MARCADA e caía
     33 mm alta, em cima da crista. Ver o cabeçalho de `raiseDoorCatches()`. */
  const target = base + 0.0467;                         // 2ª faixa lisa (n = 0)
  const pad = rows.reduce((a, b) => (b.h < a.h ? b : a));
  out.push([`2 · ${tag}: borracha na 2ª faixa lisa`, Math.abs(pad.cy - target) <= 0.003]);
  out.push([`  ${tag} faixa lisa #2`,
    `centro ${mm(target)} do piso`
    + ` · borracha ${mm(pad.lo)}..${mm(pad.hi)} (centro ${mm(pad.cy)})`]);
  out.push([`  ${tag} peças`, rows.map((r) => `${r.mat.slice(0, 14)}@${mm(r.cy)}`).join(' ')]);
  /* Todas juntas: a montagem não pode ter se separado. */
  const spread = Math.max(...rows.map((r) => r.cy)) - Math.min(...rows.map((r) => r.cy));
  out.push([`2 · ${tag}: montagem coesa`, spread <= 0.010]);
}
checkHardware('fábrica');

/* ---------------- 3. a grade das chapas ---------------- */
function panelSpanZ() {
  toLocal = refresh();
  let lo = Infinity, hi = -Infinity;
  const v = new THREE.Vector3();
  root.traverse((node) => {
    const o = node;
    if (!o.isMesh || o.name !== 'SIDE_L' || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    const m4 = new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m4);
      if (v.z < lo) lo = v.z; if (v.z > hi) hi = v.z;
    }
  });
  return hi - lo;
}

function checkPlates(tag) {
  const g = S.models.getPlateGrid?.();
  const span = panelSpanZ();
  if (!g || !g.seamsFromFront?.length) { out.push([`3 · ${tag}`, false]); return; }
  const widths = [];
  let prev = 0;
  for (const x of g.seamsFromFront) { widths.push(+(x - prev).toFixed(4)); prev = x; }
  widths.push(+(span - prev).toFixed(4));
  const whole = widths.slice(0, -1);
  const last = widths[widths.length - 1];
  out.push([`  ${tag} larguras (frente→trás)`, widths.map(mm).join(' | ')]);
  out.push([`3 · ${tag}: todas inteiras menos a última`,
    whole.every((w) => Math.abs(w - g.pitch) <= 0.002)]);
  /* A última é a ÚNICA que pode não ser inteira, e o teto dela é passo +
     `PLATE_END_CLEAR` (0,30 m): quando a sobra ficaria menor que isso a grade
     não abre a emenda e a chapa de trás sai mais larga, em vez de sair uma
     lasca de 20 cm. É o comportamento certo e é a fábrica que manda nele. */
  out.push([`3 · ${tag}: a sobra fica atrás`, last <= g.pitch + 0.302]);
}
checkPlates('fábrica');

/* ---------------- e agora com o baú mexido ---------------- */
async function atDims(patch, tag) {
  S.setTrailerDims(patch);
  await B.until(() => {
    const d = S.trailerDims;
    if (!d) return false;
    return (patch.length === undefined || Math.abs(d.length - patch.length) < 0.06)
      && (patch.height === undefined || Math.abs(d.height - patch.height) < 0.08);
  }, 60000);
  await B.frame(); await B.frame();
  toLocal = refresh();
  out.push([`dims ${tag}`, JSON.stringify(S.trailerDims)]);
  checkPlates(tag);
  checkHardware(tag);
}
await atDims({ length: 12.4 }, 'L=12,4m');
await atDims({ length: 15.6 }, 'L=15,6m');
await atDims({ length: 14.7, height: 2.2 }, 'h=2,2m');
await atDims({ height: 3.1 }, 'h=3,1m');

return out;
