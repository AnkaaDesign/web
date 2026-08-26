/* DIAGNÓSTICO — o BERÇO do tanque de ARLA ficou para trás do tanque.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --verbose \
            --checks diag/checks-diag-arla-berco-0823.mjs

   > *"esse componente com tampa azul foi reduzido, mas o suporte dele nao"*
   > — Kennedy, 2026-08-23, com a foto do flanco direito do Scania P.

   `recessFlankEquipment()` (truck-tanks.ts) recua o corpo do ARLA para dentro
   do plano da grade, e para achar o que anda junto ele exige que a malha
   VIZINHA seja CURTA (menos de 1,5 vez o vão do corpo em z). O berço do ARLA
   não é: ele está fundido em `chassis_p15`/`chassis_p18`, que atravessam o
   caminhão inteiro. Logo o corpo recua e a ferragem fica — que é a foto.

   Esta sonda mede isso NO MOTOR, no espaço LOCAL DA CABINE (o mesmo em que
   `recessFlankEquipment` trabalha), e por COMPONENTE CONEXO, que é a única
   régua que separa o berço do resto da malha em que ele foi fundido. */
const out = [];
const B = window.__bench;
const mm = (v) => (v === null || v === undefined || !isFinite(v) ? '—' : `${(v * 1000).toFixed(0)}`);

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

/* O primeiro rígido Scania P do catálogo — o ARLA é o mesmo nos quatro. */
let alvo = null;
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    if (!mo.rigid) continue;
    for (const c of (mo.chassis || [])) {
      if (!alvo && /scania_p_\dx\dr\.glb$/i.test(c.file || '')) alvo = { mk, mo, c };
    }
  }
}
if (!alvo) { out.push(['★ achou um Scania P rígido', false]); return out; }
out.push(['0 · alvo', `${alvo.mo.id}/${alvo.c.id} · ${alvo.c.file}`]);

await S.applyChoice({
  envId: S.choice?.envId || 'estudio',
  manufacturerId: alvo.mk.id, modelId: alvo.mo.id, chassisId: alvo.c.id,
  colorId: null, finishId: null, trim: null,
}, { curtain: false });
await B.until(() => (S.state.cabDef?.file || '') === alvo.c.file, 300000);
await B.until(() => !!S.state.trailer, 300000);
for (let i = 0; i < 30; i++) await B.frame();

const cab = S.state.cab;
cab.updateWorldMatrix(true, true);
const toLocal = new THREE.Matrix4().copy(cab.matrixWorld).invert();
const L2C = new THREE.Matrix4();
const v = new THREE.Vector3();
const ARLA_RE = /arla|adblue/i;
const materiais = (o) => (Array.isArray(o.material) ? o.material : [o.material]).filter(Boolean);

/* 1 · O CORPO DO ARLA, como o motor o vê hoje (depois do recuo). */
const corpo = new THREE.Box3();
const donos = new Map();
cab.traverse((node) => {
  const o = node;
  if (!o.isMesh || !o.visible) return;
  if (!materiais(o).some((m) => ARLA_RE.test(m.name || '')) && !ARLA_RE.test(o.name)) return;
  const pos = o.geometry?.getAttribute('position');
  if (!pos) return;
  L2C.multiplyMatrices(toLocal, o.matrixWorld);
  for (let i = 0; i < pos.count; i++) corpo.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(L2C));
  donos.set(o.name, (donos.get(o.name) || 0) + pos.count);
});
if (corpo.isEmpty()) { out.push(['★ achou o ARLA', false]); return out; }
out.push(['1 · corpo do ARLA (local da cabine)',
  `x ${mm(corpo.min.x)}…${mm(corpo.max.x)} · y ${mm(corpo.min.y)}…${mm(corpo.max.y)}`
  + ` · z ${mm(corpo.min.z)}…${mm(corpo.max.z)} · malhas ${[...donos.keys()].join(', ')}`]);

/* 2 · O QUE HÁ NA REGIÃO, por COMPONENTE CONEXO. A região é a caixa do corpo
      com folga, limitada a x > 250 mm para nenhuma travessa (que cruza a linha
      de centro) caber inteira nela. */
const MG = 0.120;
const reg = new THREE.Box3(
  new THREE.Vector3(0.25, corpo.min.y - MG, corpo.min.z - MG),
  new THREE.Vector3(9, corpo.max.y + MG, corpo.max.z + MG));
const uni = (idx, n) => {
  const pai = new Int32Array(n);
  for (let i = 0; i < n; i++) pai[i] = i;
  const acha = (i) => { let r = i; while (pai[r] !== r) r = pai[r]; while (pai[i] !== r) { const t = pai[i]; pai[i] = r; i = t; } return r; };
  const une = (i, j) => { const a = acha(i), b = acha(j); if (a !== b) pai[a] = b; };
  for (let q = 0; q < idx.count; q += 3) {
    une(idx.getX(q), idx.getX(q + 1));
    une(idx.getX(q + 1), idx.getX(q + 2));
  }
  for (let i = 0; i < n; i++) pai[i] = acha(i);
  return pai;
};
const achados = [];
cab.traverse((node) => {
  const o = node;
  if (!o.isMesh || !o.visible || !o.geometry) return;
  const pos = o.geometry.getAttribute('position');
  const idx = o.geometry.getIndex();
  if (!pos || !idx) return;
  if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
  L2C.multiplyMatrices(toLocal, o.matrixWorld);
  const bb = o.geometry.boundingBox.clone().applyMatrix4(L2C);
  if (!bb.intersectsBox(reg)) return;
  const pai = uni(idx, pos.count);
  const caixas = new Map();
  for (let q = 0; q < idx.count; q += 3) {
    const r = pai[idx.getX(q)];
    let c = caixas.get(r);
    if (!c) { c = { b: new THREE.Box3(), n: 0 }; caixas.set(r, c); }
    c.n++;
    for (let k = 0; k < 3; k++) c.b.expandByPoint(v.fromBufferAttribute(pos, idx.getX(q + k)).applyMatrix4(L2C));
  }
  for (const [, c] of caixas) {
    if (!reg.containsBox(c.b)) continue;
    const ax = Math.max(Math.abs(c.b.min.x), Math.abs(c.b.max.x));
    if (ax < 0.90) continue;
    achados.push({ no: o.name, mat: materiais(o)[0]?.name || '?', n: c.n, b: c.b, ax });
  }
});
achados.sort((a, b) => b.ax - a.ax);
out.push([`2 · componentes na região com |x| ≥ 900 mm (${achados.length})`, '\n        '
  + achados.map((a) => `|x| até ${mm(a.ax)}  ${a.no} · ${a.mat} · ${a.n} tri ·`
    + ` x ${mm(a.b.min.x)}…${mm(a.b.max.x)} y ${mm(a.b.min.y)}…${mm(a.b.max.y)}`
    + ` z ${mm(a.b.min.z)}…${mm(a.b.max.z)}`).join('\n        ')]);

/* 3 · A CONTA QUE INTERESSA: a face do corpo contra a face da ferragem. */
const ferro = achados.filter((a) => !ARLA_RE.test(a.mat) && !ARLA_RE.test(a.no));
const faceFerro = ferro.length ? Math.max(...ferro.map((a) => a.ax)) : null;
out.push(['3 · face do CORPO × face da FERRAGEM',
  `corpo |x| ${mm(corpo.max.x)} · ferragem |x| ${faceFerro === null ? '—' : mm(faceFerro)}`
  + (faceFerro === null ? '' : ` · degrau ${mm(faceFerro - corpo.max.x)} mm`)]);
out.push(['★ a ferragem do ARLA está no mesmo plano do corpo (20 mm)',
  faceFerro !== null && Math.abs(faceFerro - corpo.max.x) <= 0.020]);
out.push(['★ nada do conjunto do ARLA passa do teto de flanco (1 100 mm)',
  Math.max(corpo.max.x, faceFerro ?? 0) <= 1.1005]);

/* 4 · O CORRIDO da grade sobre o ARLA — é o que o recuo existe para conseguir. */
const g = S.state.trailerRig?.sideGuard || S.state.sideGuard || null;
out.push(['4 · grade', g ? 'rig tem sideGuard' : '(não exposto no state — ver a foto)']);

/* 5 · FOTOS: o flanco direito na altura do ARLA. */
const mount = S.state.cabMount;
if (mount) {
  const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
    .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0))
    .multiply(new THREE.Matrix4().copy(cab.matrixWorld).invert());
  const Ninv = new THREE.Matrix4().copy(N).invert();
  /* ⚠️ O LADO SAI DA MATRIZ, e não do sinal do x local: `orientYaw` gira o
     caminhão e o flanco do ARLA (x > 0 na cabine) pode virar o outro em
     normalizado. A 1ª versão desta sonda chutou +x e fotografou o flanco
     ESQUERDO, onde o ARLA não existe. */
  /* …e o ponto entra em MUNDO: `N` já traz `cab.matrixWorld⁻¹` dentro dele. */
  const cN = corpo.getCenter(new THREE.Vector3())
    .applyMatrix4(cab.matrixWorld).applyMatrix4(N);
  const zArla = cN.z;
  const sig = Math.sign(cN.x) || 1;
  out.push(['5 · o ARLA em normalizado', `x ${mm(cN.x)} · z ${mm(cN.z)} · lado ${sig > 0 ? 'D' : 'E'}`]);
  const foto = (nome, alvoN, olhoN) => {
    const t = new THREE.Vector3(...alvoN).applyMatrix4(Ninv);
    const o = new THREE.Vector3(...olhoN).applyMatrix4(Ninv);
    controls.target.copy(t); camera.position.copy(o); camera.lookAt(t);
    camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); controls.update();
    renderer.render(scene, camera);
    out.push([nome, raw.toDataURL('image/webp', 0.9)]);
  };
  foto("ARLA-1-perfil", [0, 0.70, zArla], [sig * 3.4, 0.95, zArla]);
  foto('ARLA-2-tres-quartos', [0, 0.70, zArla], [sig * 2.6, 1.20, zArla + 1.8]);
  foto('ARLA-3-baixo', [0, 0.55, zArla], [sig * 2.8, -0.10, zArla + 0.9]);
  foto('ARLA-4-de-cima', [0, 0.70, zArla], [sig * 2.2, 2.0, zArla + 0.6]);
}

return out;
