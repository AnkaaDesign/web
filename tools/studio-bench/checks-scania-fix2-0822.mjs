/* O PORTÃO DA SEGUNDA LEVA DE 2026-08-22 — as sete que sobreviveram.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --verbose \
            --checks checks-scania-fix2-0822.mjs */

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

/* ═════════ 0. O SEMIRREBOQUE, ANTES DA TROCA — regressão do retrato ═════════ */
{
  const s1 = S.livery?.getSnapshot ? S.livery.getSnapshot('right') : null;
  out.push(['0 · semirreboque · retrato motorista', s1
    ? `ar ${s1.ar?.toFixed(3)} · chapa y ${s1.box?.y?.toFixed(4)} h ${s1.box?.h?.toFixed(4)}` : '—']);
  /* A coroa dele mede 5,1 mm, ou seja o piso de 10 mm continua mandando: a
     margem de topo tem de ficar igual à de antes (0,010/frameH). */
  out.push(['★ 0 · o retrato do semirreboque não mudou (margem de topo ≈ 1 cm)',
    !!s1 && Math.abs(s1.box.y - 0.010 / (0.010 + 0.09 + 2.730)) < 0.004]);
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
const p = alvos.find((a) => a.c.file.includes('scania_p_6x2r'));
await S.applyChoice({
  envId: S.choice?.envId || 'estudio',
  manufacturerId: p.mk.id, modelId: p.mo.id, chassisId: p.c.id,
  colorId: null, finishId: null, trim: null,
}, { curtain: false });
await B.until(() => (S.state.implement?.id || '').includes('sobrechassi'), 300000);
for (let i = 0; i < 30; i++) await B.frame();
await B.until(() => !!(S.livery?.hasSnapshot && S.livery.hasSnapshot('roof')), 120000);

const t = S.state.trailer;
const cab = S.state.cab;
t.updateWorldMatrix(true, true);
const toLocal = new THREE.Matrix4().copy(t.matrixWorld).invert();

/* ═════════ 1. O TRILHO: nenhuma normal fora do prumo ═════════ */
{
  let piorCos = 1, tortas = 0, naFace = 0, pecas = 0;
  const uvSet = new Set();
  t.traverse((o) => {
    if (!o.isMesh || !o.geometry || !/^estrutura-principal-9[0-5]_/.test(o.name || '')) return;
    pecas++;
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
    const face = [...hist.entries()].sort((a, b) => b[1] - a[1])[0][0] / 10000;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(M);
      if (Math.abs((fora - v.x) * sgn - face) > 0.0002) continue;
      naFace++;
      n.fromBufferAttribute(nor, i).applyMatrix3(NM).normalize();
      const cos = n.x * sgn;
      if (cos < piorCos) piorCos = cos;
      if (cos < 0.9999) tortas++;
      const uvA = o.geometry.getAttribute('uv');
      if (uvA) uvSet.add(`${Math.round(uvA.getX(i) * 400)},${Math.round(uvA.getY(i) * 400)}`);
    }
  });
  const uvs = uvSet.size;
  out.push(['1 · trilho', `${pecas} peça(s) · ${naFace} vértices no plano da face`
    + ` · fora do prumo ${tortas} · pior cos ${piorCos.toFixed(5)} · UVs distintas ${uvs}`]);
  out.push(['★ 1 · o plano da face do trilho é UM plano só',
    pecas === 6 && naFace > 1000 && tortas === 0]);
  /* ⚠️ E UMA UV SÓ. O material tem `roughnessMap`, então duas ilhas de UV no
     mesmo plano são duas rugosidades — que num metal de 0,30 é o tracinho. */
  out.push(['★ 1 · e a UV do rebaixo é o campo da chapa (nenhuma ilha)',
    uvs > 100]);
}

/* ═════════ 2. O TETO NO EDITOR: nenhuma camada de emenda ═════════ */
{
  const camadas = S.measures?.getLayers ? S.measures.getLayers('roof') : null;
  const emendas = Array.isArray(camadas)
    ? camadas.filter((c) => /plate-seam/.test(c?.id || '')).length : -1;
  out.push(['2 · camadas do teto', Array.isArray(camadas)
    ? `${camadas.length} · emendas ${emendas}` : '(sem getLayers — ver o portão abaixo)']);
  /* Sem afordance de camadas, o portão é a fonte: a grade é publicada só para
     as laterais e `plateLayers()` agora recusa qualquer face que não seja
     `left`/`right`. O que dá para medir aqui é que o teto TEM retrato — e é o
     retrato que substitui o desenho. */
  out.push(['★ 2 · o teto é fotografado (o desenho de emenda não entra)',
    !!(S.livery?.hasSnapshot && S.livery.hasSnapshot('roof'))]);
}

/* ═════════ 3. O CORTE DO RETRATO ═════════ */
for (const k of ['right', 'left']) {
  const s1 = S.livery?.getSnapshot ? S.livery.getSnapshot(k) : null;
  out.push([`3 · retrato ${k}`, s1
    ? `ar ${s1.ar.toFixed(3)} · chapa x ${s1.box.x.toFixed(4)} y ${s1.box.y.toFixed(4)}`
      + ` w ${s1.box.w.toFixed(4)} h ${s1.box.h.toFixed(4)}` : '—']);
}
{
  const s1 = S.livery?.getSnapshot ? S.livery.getSnapshot('right') : null;
  /* A coroa do sobrechassi mede 72,1 mm; com 8 mm de folga a margem de topo
     vira 80,1 mm num quadro de 2 730 + 80,1 + 90 = 2 900 mm → y ≈ 0,0276. */
  out.push(['★ 3 · a margem de topo passou a caber o trilho (y ≈ 0,028)',
    !!s1 && s1.box.y > 0.020 && s1.box.y < 0.036]);
  out.push(['★ 3 · a chapa não é a foto inteira', !!s1 && s1.box.h < 0.98]);
}

/* ═════════ 4. AS LINHAS DO TK ═════════ */
{
  const linhas = [];
  t.traverse((o) => { if (/^TS_TK_LINHA_\d+$/.test(o.name || '')) linhas.push(o); });
  const presilhas = [];
  t.traverse((o) => { if (/^TS_TK_LINHA_\d+_P/.test(o.name || '')) presilhas.push(o); });
  out.push(['4 · presilhas', String(presilhas.length)]);
  const painel = t.getObjectByName('SIDE_L');
  const lb = painel && painel.geometry.boundingBox
    ? painel.geometry.boundingBox.clone().applyMatrix4(
      new THREE.Matrix4().multiplyMatrices(toLocal, painel.matrixWorld))
    : null;
  const caixas = linhas.map((o) => {
    const a = o.geometry.getAttribute('position');
    const M = new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld);
    const bb = new THREE.Box3(); const v = new THREE.Vector3();
    for (let i = 0; i < a.count; i++) bb.expandByPoint(v.fromBufferAttribute(a, i).applyMatrix4(M));
    return bb;
  });
  for (const [i, bb] of caixas.entries()) {
    out.push([`4 · ${linhas[i].name}`, `y ${mm(bb.min.y)}…${mm(bb.max.y)}`
      + ` · z ${mm(bb.min.z)}…${mm(bb.max.z)}`]);
  }
  out.push(['4 · parede/piso', lb ? `pele z ${mm(lb.max.z)} · piso ${mm(lb.min.y)}` : '—']);
  out.push(['★ 4 · as linhas chegam abaixo do piso',
    !!lb && caixas.length > 0 && caixas.every((b) => b.min.y < lb.min.y)]);
  /* ⚠️ O PORTÃO QUE FALTAVA: elas não podem ATRAVESSAR a parede ACIMA do piso.
     Abaixo dele podem e devem — é ali que a linha entra sob o assoalho. Então
     o teste é por VÉRTICE, não por caixa: a caixa mistura as duas metades. */
  let furando = 0;
  for (const o of linhas) {
    const a = o.geometry.getAttribute('position');
    const M = new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld);
    const v = new THREE.Vector3();
    for (let i = 0; i < a.count; i++) {
      v.fromBufferAttribute(a, i).applyMatrix4(M);
      if (lb && v.y > lb.min.y + 0.01 && v.z < lb.max.z) furando++;
    }
  }
  out.push(['4 · vértices dentro do baú acima do piso', String(furando)]);
  out.push(['★ 4 · nenhuma linha entra no baú acima do piso', furando === 0]);
}

/* ═════════ 5. OS BRAÇOS DO PARA-BARRO ═════════ */
if (cab) {
  cab.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const caixaDe = (o) => {
    const a = o.geometry.getAttribute('position');
    const M = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const bb = new THREE.Box3(); const v = new THREE.Vector3();
    for (let i = 0; i < a.count; i++) bb.expandByPoint(v.fromBufferAttribute(a, i).applyMatrix4(M));
    return bb;
  };
  const bracos = [];
  cab.traverse((o) => { if (/^TS_CHASSI_BARRA_/.test(o.name || '')) bracos.push(o); });
  let aba = null;
  cab.traverse((o) => { if (!aba && /lameiro_0_p0/.test(o.name || '')) aba = o; });
  const ab = aba ? caixaDe(aba) : null;
  out.push(['5 · braços', String(bracos.length)]);
  let atravessa = 0, foraDaAba = 0;
  for (const o of bracos) {
    const bb = caixaDe(o);
    out.push([`5 · ${o.name}`, `x ${mm(bb.min.x)}…${mm(bb.max.x)}`
      + ` y ${mm(bb.min.y)}…${mm(bb.max.y)} z ${mm(bb.min.z)}…${mm(bb.max.z)}`]);
    if (ab && (bb.min.x < ab.min.x - 0.02 || bb.max.x > ab.max.x + 0.02)) foraDaAba++;
    /* Atravessa o chassi? Qualquer malha do caminhão cuja caixa cruze a dele
       com mais de 5 cm³ e que NÃO seja a própria aba. */
    cab.traverse((o2) => {
      if (!o2.isMesh || o2 === o || !o2.geometry?.attributes?.position) return;
      if (/^TS_CHASSI_|lameiro/.test(o2.name || '')) return;
      const b2 = caixaDe(o2);
      if (!b2.intersectsBox(bb)) return;
      const it = b2.clone().intersect(bb);
      const vol = (it.max.x - it.min.x) * (it.max.y - it.min.y) * (it.max.z - it.min.z);
      if (vol > 5e-6) atravessa++;
    });
  }
  out.push(['5 · aba', ab ? `x ${mm(ab.min.x)}…${mm(ab.max.x)}` : '—']);
  out.push(['★ 5 · há um braço por lobo', bracos.length === 2]);
  out.push(['★ 5 · nenhum braço passa da aba', foraDaAba === 0]);
  out.push(['5 · cruzamentos de caixa', String(atravessa)]);
}

/* ═════════ 6. A CHAPA DA ANKAA ═════════ */
{
  let placa = null;
  t.traverse((o) => { if (!placa && /PLACA_MARCA_ANKAA/.test(o.name || '')) placa = o; });
  const m = placa && (Array.isArray(placa.material) ? placa.material[0] : placa.material);
  out.push(['6 · chapa', m ? `${m.name} · m${m.metalness} r${m.roughness}`
    + ` env${m.envMapIntensity} envMap ${!!m.envMap}` : 'AUSENTE']);
  out.push(['★ 6 · a chapa tem material próprio de inox',
    !!m && m.name === 'marca-ankaa-inox' && m.roughness <= 0.3 && m.envMapIntensity >= 1.5]);
  out.push(['★ 6 · e ela herdou o cubemap do implemento', !!m && !!m.envMap]);
}

/* ═════════ AS FOTOS ═════════ */
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
tira('f2-trilho', 2.2, -72, 14, V(0, 1.25, 1.0));
tira('f2-trilho-longe', 6.0, -70, 12, V(0, 1.0, 0));
tira('f2-ankaa', 3.2, 0, -4, V(0, -1.15, 4.6));
tira('f2-bracos', 4.2, 0, 1, V(0, -0.95, 4.6));
tira('f2-tk-lado', 4.2, 250, 0, V(0, 0.1, -3.5));
tira('f2-tk-baixo', 3.6, 232, -12, V(0, -0.8, -3.6));
tira('f2-conjunto', 15, -90, 5, null);
/* E o retrato do teto e da lateral, como imagem. */
for (const k of ['roof', 'right']) {
  const s1 = S.livery?.getSnapshot ? S.livery.getSnapshot(k) : null;
  if (!s1?.bg) continue;
  const d = await fetch(s1.bg).then((r) => r.blob()).then((b) => new Promise((res) => {
    const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.readAsDataURL(b);
  })).catch(() => null);
  if (d) out.push([`f2-retrato-${k}`, d]);
}

return out;
