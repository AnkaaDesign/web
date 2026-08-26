/* SEXTA VOLTA — EXPERIMENTO. Duas perguntas que só o pixel responde.
   ===========================================================================
     A. DE QUE PEÇA são os tracinhos do trilho de topo, e são NORMAL ou
        GEOMETRIA? A geometria já foi medida e está plana (um pico só, 6,0 mm);
        as normais já foram medidas e estão retas (6 tortas em 2 924). Sobra
        pintar cada candidata e olhar.
     B. A CHAPA DA ANKAA lê fosca com QUALQUER material — três já foram
        tentados. O censo diz que a face visível dela tem 12 vértices e que
        OITO deles têm normal PERPENDICULAR à face. Aqui isso vira imagem.

       node tools/studio-bench/bench.mjs --gpu --geometry --checks diag/checks-scania6-0822.mjs */

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

const bMundo = new THREE.Box3().setFromObject(t);
const alvo0 = bMundo.getCenter(new THREE.Vector3());
function tira(nome, dist, azDeg, elevDeg, desloca) {
  const a = THREE.MathUtils.degToRad(azDeg), e = THREE.MathUtils.degToRad(elevDeg);
  const al = alvo0.clone();
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
const TRILHO = [2.2, -72, 14, V(0, 1.25, 1.0)];

/* ═══════════ A. QUEM DESENHA OS TRACINHOS ═══════════ */
/* ⚠️ DEPOIS DA FUSÃO as peças de origem estão INVISÍVEIS e quem desenha é o
   balde. Pintar a peça original não muda pixel nenhum — é a lição de §23. Então
   o experimento é ao contrário: ESCONDE-SE o balde e mostram-se as origens. */
const baldes = [];
t.traverse((o) => { if (/^FUSAO__/.test(o.name || '')) baldes.push(o); });
out.push(['A · baldes de fusão', String(baldes.length)]);

const grupos = {
  trilho: /^estrutura-principal-9[0-5]_/,
  arremate: /^estrutura-principal-(1[567]|5[234])_/,
};
const achados = {};
for (const [k, re] of Object.entries(grupos)) {
  achados[k] = [];
  t.traverse((o) => { if (o.isMesh && re.test(o.name || '')) achados[k].push(o); });
  out.push([`A · ${k}`, `${achados[k].length} malha(s) · vis ${achados[k][0]?.visible}`]);
}

/* 1) o quadro normal */
tira('q6-a0-normal', ...TRILHO);

/* 2) SÓ as origens do trilho, pintadas de magenta, com os baldes fora. */
const visBalde = baldes.map((o) => o.visible);
for (const o of baldes) o.visible = false;
const guarda = [];
for (const k of Object.keys(achados)) {
  for (const o of achados[k]) {
    guarda.push([o, o.material, o.visible]);
    o.visible = true;
    o.material = new THREE.MeshBasicMaterial({
      color: k === 'trilho' ? 0xff00ff : 0x00ffff,
    });
  }
}
tira('q6-a1-so-origens-chapadas', ...TRILHO);

/* 3) as MESMAS origens, com material NORMAL (a normal vira cor). */
for (const [o] of guarda) o.material = new THREE.MeshNormalMaterial();
tira('q6-a2-normais', ...TRILHO);

/* 4) e com um DIFUSO PURO — sem metal, sem ambiente: só a normal decide. */
for (const [o] of guarda) {
  o.material = new THREE.MeshStandardMaterial({
    color: 0xcfd4d8, metalness: 0, roughness: 1,
  });
}
tira('q6-a3-difuso', ...TRILHO);

/* devolve tudo */
for (const [o, mat, vis] of guarda) { o.material = mat; o.visible = vis; }
baldes.forEach((o, i) => { o.visible = visBalde[i]; });
tira('q6-a4-devolvido', ...TRILHO);

/* ═══════════ B. A CHAPA DA ANKAA ═══════════ */
let placa = null;
t.traverse((o) => { if (!placa && /PLACA_MARCA_ANKAA/.test(o.name || '')) placa = o; });
const ANKAA = [3.0, 0, -3, V(0, -1.13, 4.6)];
if (!placa) out.push(['B', 'chapa ausente']);
else {
  /* O CENSO POR PLANO DE Z: onde está a área, e como são as normais de cada. */
  const pos = placa.geometry.getAttribute('position');
  const nor = placa.geometry.getAttribute('normal');
  const idx = placa.geometry.getIndex();
  const M = new THREE.Matrix4().multiplyMatrices(toLocal, placa.matrixWorld);
  const NM = new THREE.Matrix3().getNormalMatrix(M);
  const a = new THREE.Vector3(), b2 = new THREE.Vector3(), c2 = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const planos = new Map();
  const n = idx ? idx.count : pos.count;
  for (let i = 0; i < n; i += 3) {
    const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1,
      i2 = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, i0).applyMatrix4(M);
    b2.fromBufferAttribute(pos, i1).applyMatrix4(M);
    c2.fromBufferAttribute(pos, i2).applyMatrix4(M);
    e1.subVectors(b2, a); e2.subVectors(c2, a);
    const area = 0.5 * e1.cross(e2).length();
    const z = Math.round(((a.z + b2.z + c2.z) / 3) * 200) / 200;   // caixas de 5 mm
    const e = planos.get(z) || { area: 0, tris: 0 };
    e.area += area; e.tris++;
    planos.set(z, e);
  }
  const top = [...planos.entries()].sort((x, y) => y[1].area - x[1].area).slice(0, 6);
  out.push(['B · área por plano de z (5 mm)',
    top.map(([z, e]) => `${mm(z)}mm:${e.area.toFixed(3)}m²/${e.tris}t`).join(' · ')]);
  /* E as normais do plano DE MAIOR ÁREA, por vértice. */
  const zAlvo = top[0][0];
  const distN = new Map();
  const nn = new THREE.Vector3(), vv = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    vv.fromBufferAttribute(pos, i).applyMatrix4(M);
    if (Math.abs(vv.z - zAlvo) > 0.004) continue;
    nn.fromBufferAttribute(nor, i).applyMatrix3(NM).normalize();
    const k = Math.round(-nn.z * 10) / 10;
    distN.set(k, (distN.get(k) || 0) + 1);
  }
  out.push(['B · normais do plano principal',
    `z ${mm(zAlvo)} · ` + [...distN.entries()].sort((x, y) => y[0] - x[0])
      .map(([k, q]) => `${k}:${q}`).join(' ')]);

  tira('q6-b0-como-esta', ...ANKAA);
  const antes = placa.material;
  /* (i) normais como cor */
  placa.material = new THREE.MeshNormalMaterial();
  tira('q6-b1-normais', ...ANKAA);
  /* (ii) inox com normais RECALCULADAS por face (flatShading) */
  const geoFlat = placa.geometry.clone();
  geoFlat.deleteAttribute('normal');
  geoFlat.computeVertexNormals();
  const geoOrig = placa.geometry;
  placa.geometry = geoFlat;
  const inox = new THREE.MeshStandardMaterial({
    color: 0xd6dade, metalness: 1, roughness: 0.28, envMapIntensity: 1.6,
  });
  const src = (Array.isArray(antes) ? antes[0] : antes);
  inox.envMap = src?.envMap ?? null;
  placa.material = inox;
  tira('q6-b2-inox-normais-refeitas', ...ANKAA);
  /* (iii) o mesmo inox, com as normais ORIGINAIS — separa material de normal */
  placa.geometry = geoOrig;
  tira('q6-b3-inox-normais-originais', ...ANKAA);
  /* (iv) normais refeitas, material de hoje */
  placa.geometry = geoFlat;
  placa.material = antes;
  tira('q6-b4-hoje-normais-refeitas', ...ANKAA);
  placa.geometry = geoOrig;
  placa.material = antes;
}

return out;
