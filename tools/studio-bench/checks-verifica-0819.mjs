/* PORTÃO DA RODADA DE 2026-08-19 — as oito correções, medidas no app.
   ===========================================================================
   Cada linha `★` é uma das oito coisas que o dono apontou com print. O que este
   arquivo faz é medir o RESULTADO, não repetir a intenção: onde a carroceria
   parou em relação à cabine, quanto o Thermo King avança da testeira, que
   material cada peça tem, quantas mangueiras sobraram e onde ficou o trilho de
   piso.

       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-verifica-0819.mjs > /tmp/verifica-0819.txt */

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
const THREE = S.THREE;
const r4 = (v) => +v.toFixed(4);
const mm = (v) => `${(v * 1000).toFixed(1)} mm`;
const vis = (o) => { for (let n = o; n; n = n.parent) if (n.visible === false) return false; return true; };

function caixas(root, pred) {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const v = new THREE.Vector3();
  const achadas = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const nome = mats.map((x) => x?.name || '?').join('+');
    if (!pred(o, nome)) return;
    const p = o.geometry.attributes.position;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const b = new THREE.Box3();
    for (let i = 0; i < p.count; i++) b.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(m));
    achadas.push({ nome: o.name, mat: nome, b, vis: vis(o) });
  });
  return achadas;
}
const fb = (b) => [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map(r4);

async function trocar(a) {
  await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: a.mk.id, modelId: a.mo.id, chassisId: a.c.id,
    colorId: null, finishId: null, trim: null,
  }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 16; i++) await B.frame();
}
const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    for (const c of (mo.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, mo, c });
    }
  }
}
const achar = (f) => alvos.find((a) => a.c.file.endsWith(f));

S.lighting.suspendAvoidance?.(true);
async function olharPara(alvoLocal, dirLocal, dist) {
  const t = S.state.trailer;
  t.updateWorldMatrix(true, true);
  const alvo = new THREE.Vector3(...alvoLocal).applyMatrix4(t.matrixWorld);
  const d = new THREE.Vector3(...dirLocal).transformDirection(t.matrixWorld).normalize();
  S.camera.position.copy(alvo.clone().addScaledVector(d, dist));
  S.camera.lookAt(alvo);
  S.controls.target.copy(alvo);
  S.controls.update();
  S.camera.updateProjectionMatrix();
  S.lighting.invalidate?.(6);
  for (let i = 0; i < 8; i++) await B.frame();
}
async function foto(nome) {
  const r = await B.captureViewport({ quality: 'high' });
  if (!r?.blob) return;
  const url = await new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = () => res('');
    fr.readAsDataURL(r.blob);
  });
  if (url) out.push([nome, url]);
}

/* ===================== o sobrechassi no Volvo VM ======================== */
const vm = achar('volvo_vm_2015_6x2r.glb');
if (!vm) { out.push(['★', 'VM fora do catálogo']); return out; }
await trocar(vm);
const t = S.state.trailer;
out.push(['implemento', S.state.implement?.id || '-']);

/* --- 1. MONTAGEM: a testeira a 150 mm da traseira da cabine --- */
{
  const st = S.state;
  const rig = st.trailerGroup?.parent;
  rig?.updateWorldMatrix(true, true);
  const inv = rig ? new THREE.Matrix4().copy(rig.matrixWorld).invert() : new THREE.Matrix4();
  const v = new THREE.Vector3();
  let frente = -Infinity, tras = Infinity;
  t.updateWorldMatrix(true, true);
  t.traverse((o) => {
    if (!o.isMesh || !vis(o) || !o.geometry?.attributes?.position) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((x) => /cor_padrao_branco|metalbranco/i.test(x?.name || ''))) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);
      if (v.z > frente) frente = v.z;
      if (v.z < tras) tras = v.z;
    }
  });
  const m = st.cabMount;
  const folga = m ? (m.cabRearZ - frente) : null;
  out.push(['montagem · testeira (z no rig)', r4(frente)]);
  out.push(['montagem · folga cabine→testeira', folga === null ? '—' : mm(folga)]);
  out.push(['★ 1 · folga é 150 mm ± 5', String(folga !== null && Math.abs(folga - 0.15) < 0.005)]);
  out.push(['montagem · balanço traseiro', m ? mm(tras - m.frameEndZ) : '—']);
}

/* --- 2. THERMO KING: fundo rente à testeira, e o que avança --- */
{
  const tk = S.state.tk;
  if (!tk) out.push(['★ 2', 'sem Thermo King']);
  else {
    const cx = caixas(t, (o) => { for (let n = o; n; n = n.parent) if (n === tk) return true; return false; });
    const b = new THREE.Box3();
    for (const c of cx) b.union(c.b);
    const parede = caixas(t, (o, n) => /cor_padrao_branco|metalbranco/i.test(n) && o.name === 'TRAILER_BODY');
    const frente = parede.length ? parede[0].b.max.z : null;
    out.push(['tk · caixa no implemento', JSON.stringify(fb(b))]);
    out.push(['tk · giro y', r4(tk.rotation.y)]);
    out.push(['tk · avanço da testeira', frente === null ? '—' : mm(b.max.z - frente)]);
    out.push(['tk · penetração no baú', frente === null ? '—' : mm(frente - b.min.z)]);
    out.push(['★ 2 · avanço entre 0,55 e 0,75 m',
      String(frente !== null && (b.max.z - frente) > 0.55 && (b.max.z - frente) < 0.75)]);
    out.push(['tk · peças', JSON.stringify(cx.map((c) => [c.nome, c.mat, r4(c.b.min.z), r4(c.b.max.z)]))]);
  }
}

/* --- 3 a 7. OS MATERIAIS QUE O ENXERTO DEVOLVEU --- */
for (const [rot, re, esperado] of [
  ['3 · suporte do varão', /^suporte-varao-preto$/, 4],
  ['5 · engate fêmea', /^engate-femea-preto$/, 3],
  ['7 · registro', /^registro-corpo-laranja$/, 2],
  ['7 · cano do registro', /^cano-ar-preto$/, 2],
  ['banda de baixo', /^metal-galvanizado-mantido$/, 2],
]) {
  const cx = caixas(t, (o, n) => re.test(n)).filter((c) => c.vis);
  out.push([rot, `${cx.length} malha(s) · ` + JSON.stringify(cx.slice(0, 3).map((c) => fb(c.b)))]);
  out.push([`★ ${rot} = ${esperado}`, String(cx.length === esperado)]);
}
{
  const claro = caixas(t, (o, n) => /^metal-claro$/.test(n));
  out.push(['★ 4 · nenhum metal-claro no sobrechassi', String(claro.length === 0)]);
  const inox = caixas(t, (o, n) => /^inox-ferragem/.test(n))
    .filter((c) => c.vis && c.b.max.z < -4.0 && c.b.min.y > 0.55 && c.b.max.y < 0.75);
  out.push(['4 · manípulo da porta traseira', `${inox.length} malha(s) em inox`]);
}

/* --- 6. UMA MANGUEIRA SÓ --- */
{
  const h = caixas(t, (o) => /^Mangueida/i.test(o.name || ''));
  out.push(['6 · mangueiras traseiras', `${h.length} · ` + JSON.stringify(h.map((c) => fb(c.b)))]);
  out.push(['★ 6 · sobrou uma', String(h.length === 1)]);
}

/* --- 8. O TRILHO DE PISO, pela régua do semirreboque --- */
{
  const p = S.state.trailerRig?.profile;
  const trilho = caixas(t, (o, n) => /^metal-galvanizado-mantido$/.test(n));
  const pele = caixas(t, (o) => o.name === 'SIDE_R' || o.name === 'SIDE_L');
  out.push(['8 · perfil do baú', p ? JSON.stringify({
    floorY: r4(p.floorY), roofY: r4(p.roofY), pitch: r4(p.pitch), ribCount: p.ribCount,
    topRailY: p.topRailY === null ? null : r4(p.topRailY),
  }) : '-']);
  for (const c of trilho) {
    const lado = (c.b.min.x + c.b.max.x) / 2 > 0 ? 'D' : 'E';
    const skin = pele.find((s) => ((s.b.min.x + s.b.max.x) / 2 > 0 ? 'D' : 'E') === lado);
    const outerT = lado === 'D' ? c.b.max.x : -c.b.min.x;
    const outerP = skin ? (lado === 'D' ? skin.b.max.x : -skin.b.min.x) : null;
    out.push([`8 · trilho ${lado}`, JSON.stringify({
      altura: mm(c.b.max.y - c.b.min.y),
      pe: p ? mm(c.b.min.y - p.floorY) : '-',
      topo: p ? mm(c.b.max.y - p.floorY) : '-',
      sobressai: outerP === null ? '-' : mm(outerT - outerP),
    })]);
  }
  const fita = caixas(t, (o, n) => /faixa.?3m/i.test(n))
    .filter((c) => (c.b.max.z - c.b.min.z) > (c.b.max.y - c.b.min.y) && c.b.max.y < (p?.floorY ?? 1));
  out.push(['8 · fita baixa', fita.length ? JSON.stringify(fb(fita[0].b)) : 'nenhuma']);
}

/* ------------------------------------------------------------- fotos */
await olharPara([0.00, 2.30, 4.60], [0.75, 0.20, 1], 4.2);
await foto('v-tk');
await olharPara([1.30, 0.30, 0.00], [1, 0.10, 0.30], 3.6);
await foto('v-saia');
await olharPara([0.00, 0.62, -4.30], [0.06, 0.06, -1], 1.7);
await foto('v-traseira-pe');
await olharPara([0.00, 1.70, -4.30], [0.10, 0.05, -1], 2.6);
await foto('v-traseira');
await olharPara([1.30, 0.45, -3.19], [1, 0.06, 0.25], 1.2);
await foto('v-engate');
await olharPara([0.00, 1.40, -4.10], [0.25, -0.35, -1], 3.4);
await foto('v-mangueira');
S.lighting.frameAll?.([S.state.cabGroup, S.state.trailerGroup]);
for (let i = 0; i < 8; i++) await B.frame();
await foto('v-conjunto');

return out;
