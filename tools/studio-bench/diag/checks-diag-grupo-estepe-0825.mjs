/* ▶▶▶ O GRUPO DO ESTEPE, MEDIDO NO TOCO — que é onde ele está intacto.
   ===========================================================================
   *"analise o toco que lá está correto, ache o grupo inteiro de componentes
   para garantir que irá mover tudo"* — Kennedy, 2026-08-25.

   O toco (4x2) não move nada do conjunto traseiro, então é a REFERÊNCIA. Aqui
   o critério é a FATIA em z: um conjunto que se desmonta ao andar é feito de
   peças que vivem, todas, dentro da mesma fatia — o que atravessa a fatia é
   chassi (longarina, cardã, tubo de ar), e é justamente o que NÃO pode andar.

   Este check só MEDE. Lista, na fatia do estepe do toco:
     · o que cabe inteiro nela e passa dos filtros (candidatos a andar);
     · o que a atravessa (fica);
   com nome, caixa, tamanho e se cruza a linha de centro. */
const out = [];
const B = window.__bench;
const mm = (v) => (v === null || v === undefined || !isFinite(v) ? '—' : `${(v * 1000).toFixed(0)}`);
await B.until(() => { const o = document.getElementById('ts-selector'); return !!o && o.classList.contains('is-open'); }, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 12; i++) await B.frame();
const THREE = S.THREE;
const acha = (m, c) => {
  for (const mk of (S.catalog.catalog?.manufacturers || []))
    for (const mo of (mk.models || []))
      if (mo.id === m) for (const ch of (mo.chassis || [])) if (ch.id === c) return { mk, mo, c: ch };
  return null;
};
function comps(idx, n) {
  const pai = new Int32Array(n);
  for (let i = 0; i < n; i++) pai[i] = i;
  const raiz = (i) => { while (pai[i] !== i) { pai[i] = pai[pai[i]]; i = pai[i]; } return i; };
  for (let q = 0; q < idx.count; q += 3) {
    const x = raiz(idx.getX(q)), y = raiz(idx.getX(q + 1)), z = raiz(idx.getX(q + 2));
    if (x !== y) pai[y] = x;
    if (x !== z) pai[z] = x;
  }
  for (let i = 0; i < n; i++) pai[i] = raiz(i);
  return pai;
}
const a = acha('scania-p', '4x2r');
await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: a.mk.id,
  modelId: a.mo.id, chassisId: a.c.id, colorId: null, finishId: null, trim: null }, { curtain: false });
await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
await B.until(() => !!S.state.trailer, 300000);
for (let i = 0; i < 40; i++) await B.frame();
const cab = S.state.cab, mount = S.state.cabMount;
cab.updateWorldMatrix(true, true);
const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
  .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0));
const v = new THREE.Vector3();
const spare = cab.getObjectByName('VM_WHEEL_SPARE');
const cxE = new THREE.Box3();
spare.traverse((n) => {
  const m = n;
  const pos = m.isMesh ? m.geometry?.attributes?.position : null;
  if (!pos) return;
  const M = new THREE.Matrix4().copy(N).multiply(cabInv).multiply(m.matrixWorld);
  for (let i = 0; i < pos.count; i += 3) cxE.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M));
});
const FOLGA = 0.10;
const fatia = [cxE.min.z - FOLGA, cxE.max.z + FOLGA];
out.push(['0 · estepe no toco', `Zn ${mm(cxE.min.z)}…${mm(cxE.max.z)} · |x| ${mm(cxE.min.x)}…${mm(cxE.max.x)}`
  + ` · y ${mm(cxE.min.y)}…${mm(cxE.max.y)} · fatia ${mm(fatia[0])}…${mm(fatia[1])}`]);

const dentro = [], atravessa = [];
cab.traverse((o) => {
  if (!o.isMesh || !o.visible || !o.geometry) return;
  if (/^(VM_WHEEL|TS_)/.test(o.name || '')) return;
  const pos = o.geometry.attributes?.position, idx = o.geometry.getIndex?.();
  if (!pos || !idx || pos.count > 260000) return;
  const M = new THREE.Matrix4().copy(N).multiply(cabInv).multiply(o.matrixWorld);
  const pai = comps(idx, pos.count);
  const caixas = new Map();
  for (let q = 0; q < idx.count; q += 3) {
    const r = pai[idx.getX(q)];
    let b = caixas.get(r);
    if (!b) { b = { box: new THREE.Box3(), n: 0 }; caixas.set(r, b); }
    for (let k = 0; k < 3; k++) {
      const i = idx.getX(q + k);
      b.box.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M));
      b.n++;
    }
  }
  for (const [, b] of caixas) {
    const bb = b.box, d = bb.getSize(new THREE.Vector3());
    /* Toca a fatia? */
    if (bb.max.z < fatia[0] || bb.min.z > fatia[1]) continue;
    const cabe = bb.min.z >= fatia[0] && bb.max.z <= fatia[1];
    const item = { nome: o.name, txt: `${o.name}: Zn ${mm(bb.min.z)}…${mm(bb.max.z)}`
      + ` · x ${mm(bb.min.x)}…${mm(bb.max.x)} · y ${mm(bb.min.y)}…${mm(bb.max.y)}`
      + ` · ${mm(d.x)}×${mm(d.y)}×${mm(d.z)}${bb.min.x * bb.max.x <= 0 ? ' · CRUZA' : ''}`,
      vol: d.x * d.y * d.z, dmax: Math.max(d.x, d.y, d.z) };
    if (cabe) dentro.push(item); else atravessa.push(item);
  }
});
dentro.sort((p, q) => q.vol - p.vol);
atravessa.sort((p, q) => q.vol - p.vol);
const grandes = dentro.filter((x) => x.dmax >= 0.10);
const miudos = dentro.filter((x) => x.dmax < 0.10);
out.push([`1 · CABEM na fatia e ≥ 100 mm — ${grandes.length}`, '\n        '
  + grandes.slice(0, 20).map((x) => x.txt).join('\n        ')]);
out.push([`2 · cabem mas são miúdos (< 100 mm) — ${miudos.length}`,
  `${[...new Set(miudos.map((x) => x.nome))].join(' · ')}`]);
out.push([`3 · ATRAVESSAM a fatia (ficam) — ${atravessa.length}`, '\n        '
  + atravessa.slice(0, 12).map((x) => x.txt).join('\n        ')]);
return out;
