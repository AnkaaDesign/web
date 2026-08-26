/* DÉCIMA VOLTA — A CIRURGIA DE ÍNDICE, e a prova de que ela sobrevive à MEDIDA.
   ===========================================================================
   Duas perguntas, nesta ordem:

     A. Apagar os triângulos do rebaixo deixa CHAPA (o rebaixo é aplique) ou
        abre BURACO (o rebaixo é furo de verdade)? Uma foto rente responde.
     B. Se ficou chapa: o rebite gerado acompanha quando o BAÚ MUDA DE TAMANHO?
        Fotografa-se a mesma faixa em três comprimentos.

     node tools/studio-bench/bench.mjs --gpu --geometry --verbose --checks checks-scania10-0822.mjs */

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
for (let i = 0; i < 12; i++) await B.frame();

const THREE = S.THREE;
const { scene, camera, controls, renderer } = S;
const raw = renderer.domElement;

const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    for (const c of (mo.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, mo, c });
    }
  }
}
const p = alvos.find((a) => a.c.file.includes('scania_p_6x2r'));
await S.applyChoice({
  envId: S.choice?.envId || 'estudio',
  manufacturerId: p.mk.id, modelId: p.mo.id, chassisId: p.c.id,
  colorId: null, finishId: null, trim: null,
}, { curtain: false });
await B.until(() => (S.state.implement?.id || '').includes('sobrechassi'), 300000);
for (let i = 0; i < 30; i++) await B.frame();

const t = S.state.trailer;

/* Um alvo FIXO no flanco +x, colado no trilho: como o baú vai mudar de
   comprimento, a mira nasce da caixa a cada foto — mas sempre no MESMO ponto
   relativo (frente do baú), para as três medidas serem comparáveis. */
function mira() {
  t.updateWorldMatrix(true, true);
  const b = new THREE.Box3().setFromObject(t);
  return { b, c: b.getCenter(new THREE.Vector3()) };
}
function tira(nome, dist, azDeg, elevDeg, desloca) {
  const { c } = mira();
  const a = THREE.MathUtils.degToRad(azDeg), e = THREE.MathUtils.degToRad(elevDeg);
  const al = c.clone();
  if (desloca) al.add(desloca);
  controls.target.copy(al);
  camera.position.set(
    al.x + Math.sin(a) * Math.cos(e) * dist,
    al.y + Math.sin(e) * dist,
    al.z + Math.cos(a) * Math.cos(e) * dist,
  );
  camera.lookAt(al);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  controls.update();
  renderer.render(scene, camera);
  out.push([nome, raw.toDataURL('image/png')]);
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ═══════════ A. A CHAPA DEPOIS DA CIRURGIA ═══════════ */
const rebites = [];
t.traverse((o) => { if (/^TS_TRILHO_REBITE/.test(o.name || '')) rebites.push(o); });
out.push(['A · malhas de rebite geradas', String(rebites.length)]);
{
  const ud = t.userData?.tsTopRailRivets;
  out.push(['A · receita publicada', ud
    ? ud.porFlanco.map((f) => `${f.sgn > 0 ? '+x' : '-x'}:${f.fz.length} furos`).join(' · ')
    : 'nenhuma']);
}

/* Rente ao trilho, 1,4 m de distância: 1 px ≈ 1,1 mm. */
const RENTE = [1.4, -70, 10, V(0, 1.30, 1.6)];
tira('q10-a0-como-esta', ...RENTE);
const vis = rebites.map((o) => o.visible);
for (const o of rebites) o.visible = false;
tira('q10-a1-sem-os-rebites-gerados', ...RENTE);   /* ← A FOTO QUE DECIDE */
rebites.forEach((o, i) => { o.visible = vis[i]; });

/* ═══════════ B. A MEDIDA MUDA ═══════════ */
const rig = S.state.rig || S.models?.rig || null;
out.push(['B · rig', rig ? 'ok' : 'ausente']);
const med = S.measures || null;

async function remede(comp) {
  /* O caminho oficial de mudar medida é o mesmo do arraste do controle. */
  const r = S.state.rig;
  if (!r || typeof r.set !== 'function') return false;
  r.set(r.height ?? r.baseHeight, comp);
  for (let i = 0; i < 20; i++) await B.frame();
  return true;
}
const base = S.state.rig?.length ?? null;
out.push(['B · comprimento de fábrica', base === null ? '—' : `${(base * 1000).toFixed(0)} mm`]);
if (base) {
  for (const [rot, comp] of [['curto', base - 1.2], ['longo', base + 1.2]]) {
    if (!(await remede(comp))) break;
    const rr = [];
    t.traverse((o) => { if (/^TS_TRILHO_REBITE/.test(o.name || '')) rr.push(o); });
    let n = 0;
    for (const o of rr) n += (o.isInstancedMesh ? o.count : 1);
    out.push([`B · ${rot} (${(comp * 1000).toFixed(0)} mm)`, `${n} rebite(s)`]);
    tira(`q10-b-${rot}`, ...RENTE);
  }
  await remede(base);
}

return out;
