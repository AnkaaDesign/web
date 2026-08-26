/* ONZE — O TRILHO DE TOPO DE FRENTE, e a prova de que ele segue a MEDIDA.
   ===========================================================================
   As voltas anteriores fotografaram o trilho de esguelha e a face nunca
   apareceu. Aqui a câmera é ABSOLUTA: fica no lado +x, um palmo acima da
   fileira, olhando para dentro. É o único jeito de ver a face que tem o
   tracinho.

     node tools/studio-bench/bench.mjs --gpu --geometry --verbose --checks checks-scania11-0822.mjs */

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

/* ─── ONDE ESTÁ A FILEIRA, medida: não se adivinha altura de trilho ─── */
function fileira() {
  t.updateWorldMatrix(true, true);
  const ud = t.userData?.tsTopRailRivets;
  const b = new THREE.Box3().setFromObject(t);
  /* A face do flanco +x: a maior |x| do baú (o trilho é a peça mais externa). */
  const f = ud?.porFlanco?.find((e) => e.sgn > 0) || null;
  const rr = [];
  t.traverse((o) => { if (/^TRAILER_TOPRAIL_RIVETS_/.test(o.name || '')) rr.push(o); });
  let y = b.max.y - 0.12, x = b.max.x;
  if (rr.length) {
    /* O flanco de +x é o que a câmera vê: escolhe-se pela CAIXA, não pelo
       sufixo do nome (L/R são do referencial da peça, não do mundo). */
    let melhor = null;
    for (const o of rr) {
      const cb = new THREE.Box3().setFromObject(o);
      if (!melhor || cb.max.x > melhor.max.x) melhor = cb;
    }
    y = (melhor.min.y + melhor.max.y) / 2; x = melhor.max.x;
  }
  return { b, x, y, f, rr };
}
function foto(nome, alvo, cam) {
  controls.target.copy(alvo);
  camera.position.copy(cam);
  camera.lookAt(alvo);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  controls.update();
  renderer.render(scene, camera);
  out.push([nome, raw.toDataURL('image/png')]);
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function quadro(nome, ocultaRebites) {
  const { x, y, rr, b } = fileira();
  const zc = (b.min.z + b.max.z) / 2;
  const vis = rr.map((o) => o.visible);
  if (ocultaRebites) for (const o of rr) o.visible = false;
  /* 1,10 m de distância, 12° acima, 18° de lado: 1 px ≈ 0,9 mm na face. */
  const alvo = V(x, y, zc);
  const d = 1.10;
  const cam = V(x + d * Math.cos(0.21) * Math.cos(0.31),
    y + d * Math.sin(0.21),
    zc + d * Math.cos(0.21) * Math.sin(0.31));
  foto(nome, alvo, cam);
  rr.forEach((o, i) => { o.visible = vis[i]; });
}

const f0 = fileira();
out.push(['fileira medida', `x ${(f0.x * 1000).toFixed(0)} · y ${(f0.y * 1000).toFixed(0)}`
  + ` · ${f0.rr.length} malha(s) de rebite · `
  + (f0.f ? `passo ${(f0.f.passo * 1000).toFixed(1)} mm, margem ${(f0.f.margem * 1000).toFixed(0)} mm`
    : 'sem receita')]);

quadro('q11-0-como-esta', false);
quadro('q11-1-sem-rebite-gerado', true);   /* ← a face nua: sobrou tracinho? */
/* E um quadro com os rebites BERRANTES, que é o régua para achar a fileira no
   pixel: sem isto, recortar o quadro é adivinhar onde ela está. */
{
  const { rr } = fileira();
  const antes = rr.map((o) => o.material);
  for (const o of rr) o.material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
  quadro('q11-1b-fileira-marcada', false);
  rr.forEach((o, i) => { o.material = antes[i]; });
}

/* ─── A MEDIDA MUDA ─── */
const dims = S.models?.getTrailerDims ? S.models.getTrailerDims() : null;
out.push(['dims', dims ? JSON.stringify({ h: dims.height, l: dims.length }) : '—']);
if (S.models?.setTrailerDims && dims?.length) {
  for (const [rot, l] of [['curto', dims.length - 1.5], ['longo', dims.length + 1.5]]) {
    S.models.setTrailerDims({ length: l });
    for (let i = 0; i < 25; i++) await B.frame();
    const g = fileira();
    let n = 0;
    for (const o of g.rr) n += (o.userData?.tsRivets || 0);
    const f = g.f;
    out.push([`medida ${rot} ${(l * 1000).toFixed(0)} mm`,
      `${n} rebite(s) · passo medido ${f ? (f.passo * 1000).toFixed(1) : '—'} mm`]);
    quadro(`q11-2-${rot}`, false);
  }
  S.models.setTrailerDims({ length: dims.length });
  for (let i = 0; i < 25; i++) await B.frame();
}

return out;
