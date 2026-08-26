/* QUARTA VOLTA — sete queixas que sobreviveram ao conserto (2026-08-22, noite).
   ===========================================================================
   Só MEDIDA, com três fotos justas. Nada aqui conserta nada: é para saber o que
   está errado antes de mexer, que é o que faltou nas voltas anteriores desta
   chapa e deste trilho.

       node tools/studio-bench/bench.mjs --gpu --geometry --verbose \
            --checks diag/checks-scania4-0822.mjs */

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
const cab = S.state.cab;
t.updateWorldMatrix(true, true);
const toLocal = new THREE.Matrix4().copy(t.matrixWorld).invert();

/* ═══════════ 1. O TRILHO DE TOPO: o que ainda não olha para fora ═══════════ */
{
  const pecas = [];
  t.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    if (!/^estrutura-principal-9[0-5]_/.test(o.name || '')) return;
    pecas.push(o);
  });
  out.push(['1 · peças de trilho achadas por nome', String(pecas.length)]);
  for (const o of pecas) {
    const pos = o.geometry.getAttribute('position');
    const nor = o.geometry.getAttribute('normal');
    if (!pos || !nor) continue;
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
    /* Histograma de profundidade — se ainda houver DOIS picos, o rebaixo não
       foi fechado. E, no plano da face, quantas normais não olham para fora. */
    const hist = new Map();
    let naFace = 0, tortas = 0, piorCos = 1;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(M);
      const d = (fora - v.x) * sgn;
      if (d >= -0.0005 && d <= 0.03) {
        const bin = Math.round(d * 10000);
        hist.set(bin, (hist.get(bin) || 0) + 1);
      }
    }
    const picos = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const face = picos.length ? Math.min(...picos.slice(0, 2).map((q) => q[0])) / 10000 : 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(M);
      const d = (fora - v.x) * sgn;
      if (Math.abs(d - face) > 0.0002) continue;
      naFace++;
      n.fromBufferAttribute(nor, i).applyMatrix3(NM).normalize();
      const cos = n.x * sgn;
      if (cos < piorCos) piorCos = cos;
      if (cos < 0.999) tortas++;
    }
    out.push([`1 · ${o.name.slice(0, 26)}`,
      `picos ${picos.map(([b, c]) => `${(b / 10).toFixed(1)}mm:${c}`).join(' ')}`
      + ` · na face ${naFace} · NÃO olham para fora ${tortas} · pior cos ${piorCos.toFixed(3)}`]);
  }
}

/* ═══════════ 2. O TETO NO EDITOR: emendas e rebites desenhados ═══════════ */
{
  const g = S.models.getPlateGrid ? S.models.getPlateGrid() : null;
  out.push(['2 · grade publicada', g ? `${g.seamsFromFront.length} emendas · `
    + `${g.rivetRowsFromBottom.length} fileiras` : 'nenhuma']);
  const camadas = S.measures?.getLayers ? 'getLayers existe' : '(sem getLayers)';
  out.push(['2 · api de camadas', camadas]);
  out.push(['2 · snapshot do teto', String(!!(S.livery?.hasSnapshot && S.livery.hasSnapshot('roof')))]);
  const snap = S.livery?.getSnapshot ? S.livery.getSnapshot('roof') : null;
  out.push(['2 · front do teto', snap ? `${!!snap.front} ${snap.front?.width}×${snap.front?.height}` : '—']);
}

/* ═══════════ 3. O CORTE: quanto de ferragem existe ACIMA da chapa ═══════════ */
function acimaDaChapa(nome) {
  const painel = t.getObjectByName(nome);
  if (!painel) return null;
  const gb = painel.geometry.boundingBox
    || (painel.geometry.computeBoundingBox(), painel.geometry.boundingBox);
  const lb = gb.clone().applyMatrix4(new THREE.Matrix4()
    .multiplyMatrices(toLocal, painel.matrixWorld));
  let topo = lb.max.y;
  let quem = '';
  const v = new THREE.Vector3();
  t.traverse((o) => {
    if (!o.isMesh || !o.visible || o === painel || !o.geometry?.attributes?.position) return;
    if (/RIVETS|FILETE|PLACA/.test(o.name || '')) return;
    const a = o.geometry.attributes.position;
    const M = new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld);
    for (let i = 0; i < a.count; i += 3) {
      v.fromBufferAttribute(a, i).applyMatrix4(M);
      /* Na pegada DESTE flanco: mesmo |x| e dentro do z do painel. */
      if (Math.sign(v.x) !== Math.sign((lb.min.x + lb.max.x) / 2)) continue;
      if (Math.abs(v.x) < Math.abs((lb.min.x + lb.max.x) / 2) - 0.10) continue;
      if (v.z < lb.min.z || v.z > lb.max.z) continue;
      if (v.y > topo) { topo = v.y; quem = o.name || '(anon)'; }
    }
  });
  return { chapa: lb.max.y, topo, sobra: topo - lb.max.y, quem, baixo: lb.min.y };
}
for (const k of ['SIDE_L', 'SIDE_R']) {
  const r = acimaDaChapa(k);
  out.push([`3 · ${k}`, r ? `chapa topo ${mm(r.chapa)} · ferragem até ${mm(r.topo)}`
    + ` · SOBRA ${mm(r.sobra)} mm (${r.quem})` : '—']);
}
{
  const snapL = S.livery?.getSnapshot ? S.livery.getSnapshot('right') : null;
  out.push(['3 · retrato motorista', snapL
    ? `ar ${snapL.ar?.toFixed(3)} · pintável v ${snapL.paint?.v0?.toFixed(3)}…${snapL.paint?.v1?.toFixed(3)}`
    : '—']);
}

/* ═══════════ 4. A CHAPA DA ANKAA: identidade, normal e material ═══════════ */
let placaAnkaa = null;
t.traverse((o) => { if (!placaAnkaa && /PLACA_MARCA_ANKAA/.test(o.name || '')) placaAnkaa = o; });
if (!placaAnkaa) out.push(['4 · chapa Ankaa', 'AUSENTE']);
else {
  const m = Array.isArray(placaAnkaa.material) ? placaAnkaa.material[0] : placaAnkaa.material;
  const pos = placaAnkaa.geometry.getAttribute('position');
  const nor = placaAnkaa.geometry.getAttribute('normal');
  const M = new THREE.Matrix4().multiplyMatrices(toLocal, placaAnkaa.matrixWorld);
  const NM = new THREE.Matrix3().getNormalMatrix(M);
  const n = new THREE.Vector3();
  const soma = new THREE.Vector3();
  let paraTras = 0, paraFrente = 0;
  for (let i = 0; i < nor.count; i++) {
    n.fromBufferAttribute(nor, i).applyMatrix3(NM).normalize();
    soma.add(n);
    if (n.z < -0.7) paraTras++; else if (n.z > 0.7) paraFrente++;
  }
  soma.divideScalar(Math.max(1, nor.count));
  out.push(['4 · chapa Ankaa', `${placaAnkaa.name} vis ${placaAnkaa.visible}`
    + ` · verts ${pos.count} · normal média ${soma.toArray().map((v) => v.toFixed(3)).join(',')}`
    + ` · para −z ${paraTras} · para +z ${paraFrente}`]);
  out.push(['4 · material', `${m?.name} · cor #${m?.color?.getHexString?.()}`
    + ` · metal ${m?.metalness} · rough ${m?.roughness} · envInt ${m?.envMapIntensity}`
    + ` · envMap ${!!m?.envMap} · side ${m?.side} · flatShading ${m?.flatShading}`]);
  /* E o que o olho compara: os materiais das peças a menos de 0,4 m, com o
     BRILHO delas (metal × (1 − rough)) para ordenar. */
  const b = new THREE.Box3().setFromObject(placaAnkaa);
  const c = b.getCenter(new THREE.Vector3());
  const perto = new Map();
  t.traverse((o) => {
    if (!o.isMesh || o === placaAnkaa || !o.geometry?.attributes?.position) return;
    const bb = new THREE.Box3().setFromObject(o);
    const d = bb.distanceToPoint(c);
    if (d > 0.4) return;
    for (const x of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!x?.name) continue;
      const prev = perto.get(x.name);
      if (!prev || d < prev.d) perto.set(x.name, { d, m: x });
    }
  });
  const lista = [...perto.entries()].sort((a, b2) => a[1].d - b2[1].d)
    .map(([nome, e]) => `${nome} @${mm(e.d)} m${(e.m.metalness ?? 0).toFixed(2)}`
      + `/r${(e.m.roughness ?? 1).toFixed(2)}/env${(e.m.envMapIntensity ?? 0).toFixed(2)}`);
  out.push(['4 · vizinhos por distância', lista.join(' · ')]);
}

/* ═══════════ 5. AS LINHAS DO TK: onde nascem e onde morrem ═══════════ */
{
  const linhas = [];
  t.traverse((o) => { if (/^TS_TK_LINHA_/.test(o.name || '')) linhas.push(o); });
  const bs = [];
  for (const o of linhas) {
    const a = o.geometry.getAttribute('position');
    const M = new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld);
    const bb = new THREE.Box3();
    const v = new THREE.Vector3();
    for (let i = 0; i < a.count; i++) bb.expandByPoint(v.fromBufferAttribute(a, i).applyMatrix4(M));
    bs.push(`${o.name} x ${mm(bb.min.x)}…${mm(bb.max.x)} y ${mm(bb.min.y)}…${mm(bb.max.y)}`
      + ` z ${mm(bb.min.z)}…${mm(bb.max.z)}`);
  }
  out.push(['5 · linhas do TK', String(linhas.length)]);
  for (const s of bs) out.push(['5 ·', s]);
  /* E as PONTAS do asset, para ver se a junção casa. */
  const tk = S.state.tk;
  if (tk) {
    const bb = new THREE.Box3();
    const v = new THREE.Vector3();
    tk.traverse((o) => {
      if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
      const a = o.geometry.attributes.position;
      const M = new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld);
      for (let i = 0; i < a.count; i++) bb.expandByPoint(v.fromBufferAttribute(a, i).applyMatrix4(M));
    });
    out.push(['5 · caixa do TK', `x ${mm(bb.min.x)}…${mm(bb.max.x)} y ${mm(bb.min.y)}…${mm(bb.max.y)}`
      + ` z ${mm(bb.min.z)}…${mm(bb.max.z)}`]);
  }
  const painel = t.getObjectByName('SIDE_L');
  if (painel) {
    const gb = painel.geometry.boundingBox;
    const lb = gb.clone().applyMatrix4(new THREE.Matrix4()
      .multiplyMatrices(toLocal, painel.matrixWorld));
    out.push(['5 · piso/parede do baú', `piso ${mm(lb.min.y)} · testeira ${mm(lb.max.z)}`]);
  }
}

/* ═══════════ 6. A BARRA DO PARA-BARRO: caixa e o que ela cruza ═══════════ */
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
  let barra = null;
  cab.traverse((o) => { if (!barra && /^TS_CHASSI_BARRA_/.test(o.name || '')) barra = o; });
  if (!barra) out.push(['6 · barra do para-barro', 'AUSENTE']);
  else {
    const bb = caixaDe(barra);
    out.push(['6 · barra', `x ${mm(bb.min.x)}…${mm(bb.max.x)} y ${mm(bb.min.y)}…${mm(bb.max.y)}`
      + ` z ${mm(bb.min.z)}…${mm(bb.max.z)} · verts ${barra.geometry.attributes.position.count}`]);
    /* Quem ELA cruza: qualquer malha do caminhão cuja caixa intersecta a dela. */
    const cruza = [];
    cab.traverse((o) => {
      if (!o.isMesh || o === barra || !o.geometry?.attributes?.position) return;
      if (/^TS_CHASSI_/.test(o.name || '')) return;
      const b2 = caixaDe(o);
      if (!b2.intersectsBox(bb)) return;
      const i = b2.clone().intersect(bb);
      const vol = (i.max.x - i.min.x) * (i.max.y - i.min.y) * (i.max.z - i.min.z);
      if (vol > 1e-7) cruza.push(`${o.name} vol ${(vol * 1e6).toFixed(0)} cm³`
        + ` x ${mm(i.min.x)}…${mm(i.max.x)}`);
    });
    out.push(['6 · a barra cruza', String(cruza.length)]);
    for (const c of cruza.slice(0, 12)) out.push(['6 ·', c]);
    let aba = null;
    cab.traverse((o) => { if (!aba && /lameiro_0_p0/.test(o.name || '')) aba = o; });
    if (aba) {
      const ab = caixaDe(aba);
      out.push(['6 · aba', `x ${mm(ab.min.x)}…${mm(ab.max.x)} y ${mm(ab.min.y)}…${mm(ab.max.y)}`
        + ` z ${mm(ab.min.z)}…${mm(ab.max.z)}`]);
      /* Os dois LOBOS da aba, para a barra poder ser por lobo. */
      const a = aba.geometry.getAttribute('position');
      const M = new THREE.Matrix4().multiplyMatrices(inv, aba.matrixWorld);
      const v = new THREE.Vector3();
      let pos0 = Infinity, pos1 = -Infinity, neg0 = Infinity, neg1 = -Infinity;
      for (let i = 0; i < a.count; i++) {
        v.fromBufferAttribute(a, i).applyMatrix4(M);
        if (v.x >= 0) { pos0 = Math.min(pos0, v.x); pos1 = Math.max(pos1, v.x); }
        else { neg0 = Math.min(neg0, v.x); neg1 = Math.max(neg1, v.x); }
      }
      out.push(['6 · lobos da aba', `+x ${mm(pos0)}…${mm(pos1)} · −x ${mm(neg0)}…${mm(neg1)}`]);
    }
  }
}

/* ═══════════ AS FOTOS ═══════════ */
const raw = renderer.domElement;
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
tira('q4-trilho-justo', 2.2, -72, 14, V(0, 1.25, 1.0));
tira('q4-tk-junta', 2.6, 205, 6, V(0, 0.55, -3.6));
tira('q4-tk-baixo', 4.5, 215, -8, V(0, -0.9, -3.2));
tira('q4-barra', 4.0, 175, -10, V(0, -1.25, 3.4));

/* A CHAPA DA ANKAA, CHAPADA DE MAGENTA — a única prova de identidade que vale.
   Se o retângulo que o dono aponta não ficar magenta, a peça que ele vê não é
   esta e todo o resto da investigação estava no objeto errado. */
if (placaAnkaa) {
  const antes = placaAnkaa.material;
  placaAnkaa.material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
  tira('q4-ankaa-magenta', 4.0, 178, -6, V(0, -1.15, 3.4));
  placaAnkaa.material = antes;
  tira('q4-ankaa', 4.0, 178, -6, V(0, -1.15, 3.4));
}

return out;
