/* QUINTA VOLTA — as quatro perguntas que a quarta deixou em aberto.
   ===========================================================================
     A. o trilho de topo SEM os meus rebites: o que sobra é o quê? (normais no
        plano CERTO — a volta anterior mediu num plano de 2,1 mm por engano)
     B. a chapa da Ankaa: as normais da face de trás. Uma chapa de 54 mm com
        normais suavizadas nas quinas sombreia como couro, não como metal.
     C. o percurso do TK, visto do lado do passageiro, inteiro.
     D. quanto de ferragem existe acima da chapa NO SEMIRREBOQUE — é o número
        que decide se a margem de topo do retrato pode ser medida sem mexer no
        padrão ouro.

       node tools/studio-bench/bench.mjs --gpu --geometry --checks diag/checks-scania5-0822.mjs */

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

/* ───────── D. O SEMIRREBOQUE PRIMEIRO (ele já está em cena no boot) ───────── */
function sobraAcimaDaChapa(t, nome) {
  const toLocal = new THREE.Matrix4().copy(t.matrixWorld).invert();
  const painel = t.getObjectByName(nome);
  if (!painel) return null;
  if (!painel.geometry.boundingBox) painel.geometry.computeBoundingBox();
  const lb = painel.geometry.boundingBox.clone()
    .applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, painel.matrixWorld));
  const sgn = Math.sign((lb.min.x + lb.max.x) / 2) || 1;
  let topo = lb.max.y, quem = '';
  const v = new THREE.Vector3();
  t.traverse((o) => {
    if (!o.isMesh || !o.visible || o === painel || !o.geometry?.attributes?.position) return;
    if (/RIVETS|FILETE|PLACA|TS_/.test(o.name || '')) return;
    const a = o.geometry.attributes.position;
    const M = new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld);
    for (let i = 0; i < a.count; i += 2) {
      v.fromBufferAttribute(a, i).applyMatrix4(M);
      if (Math.sign(v.x) !== sgn) continue;
      if (Math.abs(v.x) < Math.abs((lb.min.x + lb.max.x) / 2) - 0.10) continue;
      if (v.z < lb.min.z || v.z > lb.max.z) continue;
      if (v.y > topo) { topo = v.y; quem = o.name || '(anon)'; }
    }
  });
  return { chapa: lb.max.y, topo, sobra: topo - lb.max.y, quem };
}
{
  const t0 = S.state.trailer;
  out.push(['D · implemento no boot', S.state.implement?.id || '—']);
  for (const k of ['SIDE_L', 'SIDE_R']) {
    const r = sobraAcimaDaChapa(t0, k);
    out.push([`D · ${k}`, r ? `chapa ${mm(r.chapa)} · ferragem ${mm(r.topo)}`
      + ` · SOBRA ${mm(r.sobra)} mm (${r.quem})` : '—']);
  }
  const s1 = S.livery?.getSnapshot ? S.livery.getSnapshot('right') : null;
  out.push(['D · retrato motorista (semi)', s1
    ? `ar ${s1.ar?.toFixed(3)} · v ${s1.paint?.v0?.toFixed(3)}…${s1.paint?.v1?.toFixed(3)}` : '—']);
}

/* ───────── troca para o Scania ───────── */
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

/* ═══════════ A. O TRILHO DE TOPO, no plano CERTO ═══════════ */
{
  const pecas = [];
  t.traverse((o) => {
    if (o.isMesh && o.geometry && /^estrutura-principal-9[0-5]_/.test(o.name || '')) pecas.push(o);
  });
  for (const o of pecas.slice(0, 2)) {
    const pos = o.geometry.getAttribute('position');
    const nor = o.geometry.getAttribute('normal');
    const M = new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld);
    const NM = new THREE.Matrix3().getNormalMatrix(M);
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    let x0 = Infinity, x1 = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(M);
      if (v.x < x0) x0 = v.x; if (v.x > x1) x1 = v.x;
    }
    const sgn = (x0 + x1) / 2 > 0 ? 1 : -1;
    const fora = sgn > 0 ? x1 : x0;
    const hist = new Map();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(M);
      const d = (fora - v.x) * sgn;
      if (d >= -0.0005 && d <= 0.03) {
        const bin = Math.round(d * 10000);
        hist.set(bin, (hist.get(bin) || 0) + 1);
      }
    }
    /* A FACE é a MODA — o plano com mais vértices. Foi aqui que a volta
       anterior errou: ela pegava o menor dos dois maiores picos, e com o
       rebaixo já fechado só existe UM pico. */
    const face = [...hist.entries()].sort((a, b) => b[1] - a[1])[0][0] / 10000;
    let naFace = 0, tortas = 0, pior = 1;
    const faixa = new Map();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(M);
      if (Math.abs((fora - v.x) * sgn - face) > 0.0002) continue;
      naFace++;
      n.fromBufferAttribute(nor, i).applyMatrix3(NM).normalize();
      const cos = n.x * sgn;
      if (cos < pior) pior = cos;
      if (cos < 0.999) {
        tortas++;
        const k = Math.round(cos * 20) / 20;
        faixa.set(k, (faixa.get(k) || 0) + 1);
      }
    }
    out.push([`A · ${o.name.slice(0, 26)}`,
      `face a ${mm(face)} mm · na face ${naFace} · tortas ${tortas} · pior ${pior.toFixed(3)}`
      + ` · faixa ${[...faixa.entries()].sort((a, b) => a[0] - b[0])
        .map(([c, q]) => `${c}:${q}`).join(' ')}`]);
  }
  /* E o UV: se a chapa tiver mapa, a marca pode estar na textura. */
  const m0 = pecas[0] && (Array.isArray(pecas[0].material) ? pecas[0].material[0] : pecas[0].material);
  out.push(['A · material do trilho', m0
    ? `${m0.name} map ${!!m0.map} normalMap ${!!m0.normalMap} rough ${m0.roughness}`
      + ` metal ${m0.metalness} flat ${m0.flatShading}` : '—']);
}

/* ═══════════ B. A CHAPA DA ANKAA: as normais da face de trás ═══════════ */
let placa = null;
t.traverse((o) => { if (!placa && /PLACA_MARCA_ANKAA/.test(o.name || '')) placa = o; });
if (placa) {
  const pos = placa.geometry.getAttribute('position');
  const nor = placa.geometry.getAttribute('normal');
  const M = new THREE.Matrix4().multiplyMatrices(toLocal, placa.matrixWorld);
  const NM = new THREE.Matrix3().getNormalMatrix(M);
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  let zMin = Infinity;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(M);
    if (v.z < zMin) zMin = v.z;
  }
  /* A FACE VISÍVEL é a de menor z (a traseira olha para −z no referencial do
     implemento). Quantos vértices dela e como as normais se distribuem. */
  let nFace = 0;
  const dist = new Map();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(M);
    if (v.z - zMin > 0.002) continue;
    nFace++;
    n.fromBufferAttribute(nor, i).applyMatrix3(NM).normalize();
    const k = Math.round(-n.z * 20) / 20;
    dist.set(k, (dist.get(k) || 0) + 1);
  }
  out.push(['B · face de trás da chapa', `z ${mm(zMin)} · ${nFace} vértices`
    + ` · −n.z: ${[...dist.entries()].sort((a, b) => b[0] - a[0])
      .map(([c, q]) => `${c}:${q}`).join(' ')}`]);
  const m = Array.isArray(placa.material) ? placa.material[0] : placa.material;
  out.push(['B · material', `${m?.name} cor #${m?.color?.getHexString?.()} m${m?.metalness}`
    + ` r${m?.roughness} env${m?.envMapIntensity} map ${!!m?.map}`]);
}

/* ═══════════ AS FOTOS — a traseira é +z em MUNDO; a frente é −z ═══════════ */
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

/* A. o trilho SEM os meus rebites — a prova de que a marca é do bake. */
const meus = [];
t.traverse((o) => { if (/^TRAILER_TOPRAIL_RIVETS_/.test(o.name || '')) meus.push(o); });
for (const o of meus) o.visible = false;
tira('q5-trilho-sem-rebite', 2.2, -72, 14, V(0, 1.25, 1.0));
for (const o of meus) o.visible = true;
tira('q5-trilho-com-rebite', 2.2, -72, 14, V(0, 1.25, 1.0));

/* B. a traseira, de perto e na altura da chapa. */
tira('q5-ankaa', 3.2, 0, -4, V(0, -1.15, 4.6));
if (placa) {
  const antes = placa.material;
  placa.material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
  tira('q5-ankaa-magenta', 3.2, 0, -4, V(0, -1.15, 4.6));
  placa.material = antes;
}
/* E a barra do para-barro, no mesmo enquadramento um pouco mais alto. */
tira('q5-barra', 4.2, 0, 2, V(0, -0.95, 4.6));

/* C. o percurso do TK, do lado do passageiro e de baixo. */
tira('q5-tk-lado', 4.0, 250, 2, V(0, 0.2, -3.4));
tira('q5-tk-baixo', 3.2, 235, -14, V(0, -0.75, -3.6));

return out;
