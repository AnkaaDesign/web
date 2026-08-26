/* PORTÃO DA 3ª LEVA — Scania P + sobrechassi, 22/08 (tarde).
   ===========================================================================
   O que esta volta fechou, e o que cada ★ prende:

     1..3  O TRACINHO DO TRILHO. Quatro rodadas tentaram consertar o rebaixo
           (profundidade, normal, UV, z-fighting) e ele ficava. A quinta não
           consertou: APAGOU. Os triângulos do rebaixo saem do índice.
     4..6  O REBITE. Assenta na chapa MEDIDA (não em `fora − face`, que
           misturava dois referenciais e o punha 10 mm no ar), e a fileira sai
           de PASSO + MARGEM — então um baú mais longo ganha MAIS rebites em
           vez de rebites mais afastados.
     7..8  O FILETE. Face plana e acabamento fosco: era um espelho de 8 m.
     9..10 A GRADE. O que tem de acabar antes do baú é o CONJUNTO, tampa de
           ponta incluída.

     node tools/studio-bench/bench.mjs --gpu --geometry --verbose --checks checks-scania-fix3-0822.mjs */

const out = [];
const B = window.__bench;
const mm = (v) => (v === null || v === undefined || !isFinite(v) ? '—' : `${(v * 1000).toFixed(1)}`);

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
t.updateWorldMatrix(true, true);
const toLocal = new THREE.Matrix4().copy(t.matrixWorld).invert();
const caixaLocal = (o) => {
  if (!o.geometry) return null;
  o.geometry.computeBoundingBox();
  return o.geometry.boundingBox.clone()
    .applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld));
};

/* ═════ 1..3 · O REBAIXO NÃO EXISTE MAIS ═════ */
const receita = t.userData?.tsTopRailRivets;
out.push(['1 · receita', receita
  ? receita.porFlanco.map((f) => `${f.sgn > 0 ? '+x' : '-x'} passo ${mm(f.passo)}`
    + ` · margem ${mm(f.margem)} · chapa |x| ${mm(Math.abs(f.xFace))}`
    + ` · queda ${mm(f.queda)}`).join(' · ')
  : 'AUSENTE']);
out.push(['★ 1 · o bake publicou a receita nos dois flancos',
  !!receita && receita.porFlanco.length === 2]);

/* O rebaixo, medido onde ele estava: nenhum triângulo com os TRÊS vértices
   dentro de 4 mm da fileira publicada, na profundidade do rebaixo. */
const trilhos = [];
t.traverse((o) => {
  if (o.isMesh && o.geometry && /^estrutura-principal-9[0-5]_/.test(o.name || '')) trilhos.push(o);
});
out.push(['2 · peças do trilho', String(trilhos.length)]);
out.push(['★ 2 · as seis peças do trilho continuam lá', trilhos.length === 6]);

let comRebaixo = 0, profMax = 0;
for (const o of trilhos) {
  const b = caixaLocal(o);
  if (!b) continue;
  const sgn = (b.min.x + b.max.x) / 2 > 0 ? 1 : -1;
  const fora = sgn > 0 ? b.max.x : b.min.x;
  const pos = o.geometry.getAttribute('position');
  const M = new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld);
  const v = new THREE.Vector3();
  const h = new Map();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(M);
    const d = (fora - v.x) * sgn;
    if (d < -0.0005 || d > 0.030) continue;
    const k = Math.round(d * 2000);
    h.set(k, (h.get(k) || 0) + 1);
  }
  const picos = [...h.entries()].sort((a, b2) => b2[1] - a[1]).slice(0, 2);
  /* Dois picos separados por mais de 0,5 mm E com povoação parecida = rebaixo
     vivo. Depois da cirurgia sobra UM pico dominante. */
  if (picos.length === 2 && picos[1][1] > picos[0][1] * 0.25) {
    comRebaixo++;
    profMax = Math.max(profMax, Math.abs(picos[0][0] - picos[1][0]) / 2);
  }
}
out.push(['3 · peças com dois planos povoados', `${comRebaixo} (fundo até ${profMax.toFixed(1)} mm)`]);
out.push(['★ 3 · nenhuma peça do trilho ainda tem o rebaixo do rebite', comRebaixo === 0]);

/* ═════ 4..6 · O REBITE ═════ */
const rr = [];
t.traverse((o) => { if (o.isMesh && /^TRAILER_TOPRAIL_RIVETS_/.test(o.name || '')) rr.push(o); });
out.push(['4 · malhas de rebite', String(rr.length)]);
let foraDaChapa = 0;
for (const o of rr) {
  const b = caixaLocal(o);
  if (!b) continue;
  const sgn = (b.min.x + b.max.x) / 2 > 0 ? 1 : -1;
  const f = receita?.porFlanco?.find((e) => e.sgn === sgn);
  if (!f) { foraDaChapa++; continue; }
  /* A BASE da calota tem de estar NA chapa: meio milímetro de tolerância. */
  const base = sgn > 0 ? b.min.x : b.max.x;
  if (Math.abs(base - f.xFace) > 0.0005) foraDaChapa++;
  out.push([`4 · ${o.name}`, `base em ${mm(base)} · chapa em ${mm(f.xFace)}`
    + ` · saliência ${mm(b.max.x - b.min.x)} mm · ${o.userData?.tsRivets || 0} rebites`]);
}
out.push(['★ 4 · toda calota assenta NA chapa do trilho',
  rr.length === 2 && foraDaChapa === 0]);

/* A MEDIDA MUDA: o passo fica, o número acompanha. */
const dims = S.models?.getTrailerDims ? S.models.getTrailerDims() : null;
const passoAlvo = receita?.porFlanco?.[0]?.passo ?? 0;
const contagens = [];
let passoOk = true;
if (dims?.length && S.models?.setTrailerDims) {
  for (const l of [dims.length - 1.5, dims.length, dims.length + 1.5]) {
    S.models.setTrailerDims({ length: l });
    for (let i = 0; i < 25; i++) await B.frame();
    const novos = [];
    t.traverse((o) => { if (o.isMesh && /^TRAILER_TOPRAIL_RIVETS_/.test(o.name || '')) novos.push(o); });
    let n = 0, vao = 0;
    for (const o of novos) {
      n += (o.userData?.tsRivets || 0);
      const b = caixaLocal(o);
      if (b) vao = Math.max(vao, b.max.z - b.min.z);
    }
    const passoReal = n > 2 ? vao / (n / 2 - 1) : 0;
    contagens.push({ l, n, passoReal });
    if (Math.abs(passoReal - passoAlvo) > passoAlvo * 0.06) passoOk = false;
  }
  S.models.setTrailerDims({ length: dims.length });
  for (let i = 0; i < 25; i++) await B.frame();
}
out.push(['5 · a fileira contra a medida', contagens
  .map((c) => `${mm(c.l)} mm → ${c.n} rebites, passo ${mm(c.passoReal)}`).join(' · ') || '—']);
out.push(['★ 5 · o passo se mantém em qualquer comprimento (±6 %)',
  contagens.length === 3 && passoOk]);
out.push(['★ 6 · baú mais longo, MAIS rebites',
  contagens.length === 3 && contagens[0].n < contagens[1].n && contagens[1].n < contagens[2].n]);

/* ═════ 7..8 · O FILETE ═════ */
const fil = [];
t.traverse((o) => { if (o.isMesh && /^FILETE_/.test(o.name || '')) fil.push(o); });
let filProud = 0, filFosco = true;
for (const o of fil) {
  const b = caixaLocal(o);
  if (b) filProud = Math.max(filProud, b.max.x - b.min.x);
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  if (!m || m.roughness < 0.45) filFosco = false;
}
out.push(['7 · filete', `${fil.length} · saliência ${mm(filProud)} mm`
  + ` · rugosidade ${fil[0] ? (Array.isArray(fil[0].material) ? fil[0].material[0] : fil[0].material).roughness.toFixed(2) : '—'}`]);
out.push(['★ 7 · um filete por flanco, saliência ≤ 2,5 mm',
  fil.length === 2 && filProud <= 0.0025]);
out.push(['★ 8 · o filete não é mais espelho (rugosidade ≥ 0,45)', filFosco]);

/* ═════ 9..10 · A GRADE ═════ */
let pele = null;
t.traverse((o) => {
  if (!o.isMesh || !o.visible) return;
  if (!/^(TRAILER_PANEL|TRAILER_SIDE|TRAILER_ROOF|TRAILER_FLOOR|TRAILER_FRONT|TRAILER_REAR)/.test(o.name || '')) return;
  const b = caixaLocal(o);
  if (!b) return;
  if (pele) pele.union(b); else pele = b.clone();
});
let grade = null;
const varre = (raiz) => raiz.traverse((o) => {
  if (!o.isMesh || !/^(BARRA__|ESTACAO__|PONTA__)/.test(o.name || '')) return;
  const b = caixaLocal(o);
  if (!b) return;
  if (grade) grade.union(b); else grade = b.clone();
});
varre(t); if (!grade) varre(scene);
const folga = pele && grade ? grade.min.z - pele.min.z : null;
out.push(['9 · grade × parede traseira', pele && grade
  ? `baú ${mm(pele.min.z)} · grade ${mm(grade.min.z)} · folga ${mm(folga)} mm` : '—']);
out.push(['★ 9 · o conjunto da grade acaba ANTES do baú', folga !== null && folga > 0]);
out.push(['★ 10 · e não recua demais (folga ≤ 250 mm)', folga !== null && folga <= 0.250]);

const bMundo = new THREE.Box3().setFromObject(t);

/* ═════ 11..12 · A ARTE DA TRASEIRA ═════
   *"a traseira ainda está mais opaca que a lateral"*. A sobreposição tinha
   acabamento PRÓPRIO (rugosidade 0,55 · metal 0,10 · env 1,00) enquanto a
   chapa é 1,00 · 0,05 · 1,35: um espelho borrado por cima do pigmento, cujo
   véu cresce com o ângulo de visada. Ver o ▶▶▶ em `makeLiveryOverlay()`. */
const faces = {};
t.traverse((o) => {
  if (o.isMesh && /^(SIDE_R|SIDE_L|REAR|FRONT|TRAILER_ROOF)$/.test(o.name || '')) faces[o.name] = o;
});
let herdam = 0, total = 0;
for (const [nome, o] of Object.entries(faces)) {
  const base = Array.isArray(o.material) ? o.material[0] : o.material;
  const ov = o.children.find((c) => c.userData?.liveryOverlay);
  if (!ov) continue;
  total++;
  const m = Array.isArray(ov.material) ? ov.material[0] : ov.material;
  const igual = Math.abs(m.roughness - base.roughness) < 1e-6
    && Math.abs(m.metalness - base.metalness) < 1e-6
    && Math.abs(m.envMapIntensity - base.envMapIntensity) < 1e-6;
  if (igual) herdam++;
  else out.push([`11 · ${nome} DIVERGE`, `chapa r${base.roughness}/m${base.metalness}`
    + `/e${base.envMapIntensity} · arte r${m.roughness}/m${m.metalness}/e${m.envMapIntensity}`]);
}
out.push(['11 · faces com sobreposição', String(total)]);
out.push(['★ 11 · a arte usa o acabamento da chapa em todas as faces',
  total >= 4 && herdam === total]);

/* E o pigmento, medido: o mesmo azul nas duas faces, de frente e de esguelha.
   O que se prende é a ESTABILIDADE — a arte não pode desbotar por causa do
   ângulo, que é a queixa. */
const medidor = document.createElement('canvas');
const ctx2d = medidor.getContext('2d', { willReadFrequently: true });
function medeAdesivo(o, giroDeg) {
  const b = new THREE.Box3().setFromObject(o);
  const c = b.getCenter(new THREE.Vector3());
  const d = b.getSize(new THREE.Vector3());
  const n = (d.x <= d.y && d.x <= d.z)
    ? new THREE.Vector3(Math.sign(c.x) || 1, 0, 0)
    : new THREE.Vector3(0, 0, Math.sign(c.z - (bMundo.min.z + bMundo.max.z) / 2) || 1);
  const dir = n.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(giroDeg));
  const dist = Math.max(d.x, d.y, d.z) * 0.9 + 2.5;
  const limA = controls.minDistance, limB = controls.maxDistance, nearA = camera.near;
  controls.minDistance = 0.02; controls.maxDistance = 1e5; camera.near = 0.05;
  controls.target.copy(c);
  camera.position.copy(c.clone().addScaledVector(dir, dist));
  camera.lookAt(c);
  camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
  controls.update();
  renderer.render(scene, camera);
  controls.minDistance = limA; controls.maxDistance = limB;
  camera.near = nearA; camera.updateProjectionMatrix();
  const w = renderer.domElement.width, h = renderer.domElement.height;
  medidor.width = w; medidor.height = h;
  ctx2d.drawImage(renderer.domElement, 0, 0);
  const dt = ctx2d.getImageData(w >> 2, h >> 2, w >> 1, h >> 1).data;
  const sats = [];
  for (let i = 0; i < dt.length; i += 16) {
    const r = dt[i], g = dt[i + 1], bl = dt[i + 2];
    if (!(bl > r && bl > g && bl < 200 && r < 160)) continue;
    const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
    if (mx) sats.push((mx - mn) / mx);
  }
  sats.sort((a, b2) => a - b2);
  return sats.length ? sats[sats.length >> 1] : null;
}
const AZUL = 0x1b3a6b;
const restaura = [];
for (const nome of ['SIDE_R', 'REAR']) {
  const o = faces[nome];
  const ov = o?.children.find((c) => c.userData?.liveryOverlay);
  if (!ov) continue;
  const m = Array.isArray(ov.material) ? ov.material[0] : ov.material;
  restaura.push([m, m.map, m.visible, m.transparent, m.color.clone()]);
  m.map = null; m.transparent = false; m.visible = true; m.color.setHex(AZUL);
  m.needsUpdate = true;
}
const leituras = {};
for (const nome of ['SIDE_R', 'REAR']) {
  if (!faces[nome]) continue;
  leituras[nome] = [medeAdesivo(faces[nome], 0), medeAdesivo(faces[nome], 55)];
}
for (const [m, map, vis, tr, cor] of restaura) {
  m.map = map; m.visible = vis; m.transparent = tr; m.color.copy(cor);
  m.needsUpdate = true;
}
const desbota = Object.values(leituras)
  .filter((v) => v[0] !== null && v[1] !== null)
  .map((v) => Math.abs(v[0] - v[1]));
out.push(['12 · saturação do adesivo (0° · 55°)', Object.entries(leituras)
  .map(([k, v]) => `${k} ${v.map((x) => x === null ? '—' : x.toFixed(3)).join(' · ')}`).join(' | ')]);
out.push(['★ 12 · a arte não desbota com o ângulo (Δsat ≤ 0,06)',
  desbota.length === 2 && desbota.every((d) => d <= 0.06)]);

/* ═════ FOTOS ═════ */
const c0 = bMundo.getCenter(new THREE.Vector3());
function tira(nome, dist, azDeg, elevDeg, desloca) {
  const a = THREE.MathUtils.degToRad(azDeg), e = THREE.MathUtils.degToRad(elevDeg);
  const al = c0.clone();
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
tira('f3-trilho', 3.2, -55, 22, V(0, 1.1, -1.4));
tira('f3-trilho-rente', 1.6, -78, 8, V(0, 1.25, 0.2));
tira('f3-grade-traseira', 7.5, 38, 5, V(0, -1.0, -2.2));
tira('f3-conjunto', 14, 40, 8, V(0, -0.4, 0));

return out;
