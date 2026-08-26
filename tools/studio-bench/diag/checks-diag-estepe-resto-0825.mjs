/* DIAGNÓSTICO — O QUE FICOU PARA TRÁS do estepe, componente a componente.
   ===========================================================================
   *"ainda parte do suporte do estepe não está no lugar certo, analise melhor"*
   — Kennedy, 2026-08-25.

   O conjunto anda +300 mm no truck. Então todo componente da vizinhança está
   numa de duas cotas: a NOVA (andou) ou a ANTIGA (ficou). Este check lista as
   duas listas lado a lado, com nome, caixa e tamanho — sem adivinhar forma. */
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

/* Mede a vizinhança do estepe num chassi e devolve a lista de componentes,
   com a posição RELATIVA ao centro do estepe — assim o toco (que não anda) e o
   truck (que anda 300 mm) ficam comparáveis peça a peça. */
async function mede(chassi) {
  const alvo = acha('scania-p', chassi);
  await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: alvo.mk.id,
    modelId: alvo.mo.id, chassisId: alvo.c.id, colorId: null, finishId: null, trim: null }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === alvo.c.file, 300000);
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
  const centro = cxE.getCenter(new THREE.Vector3());
  const reg = cxE.clone().expandByScalar(0.30);
  const lista = new Map();
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
      if (b.n < 60) continue;
      if (!reg.containsBox(b.box)) continue;          // só o que cabe INTEIRO na vizinhança
      const d = b.box.getSize(new THREE.Vector3());
      if (Math.max(d.x, d.y, d.z) < 0.06) continue;
      const rel = b.box.getCenter(new THREE.Vector3()).sub(centro);
      /* A chave é a FORMA + a posição relativa arredondada: a mesma peça, nos
         dois chassis, tem a mesma chave se andou junto com a roda. */
      const chave = `${o.name}|${mm(d.x)}×${mm(d.y)}×${mm(d.z)}`;
      const atual = lista.get(chave) || [];
      atual.push(`${mm(rel.x)},${mm(rel.y)},${mm(rel.z)}`);
      lista.set(chave, atual);
    }
  });
  return { lista, centro, cxE };
}

const toco = await mede('4x2r');
const truck = await mede('6x2r');
out.push(['0 · vizinhança medida', `toco ${toco.lista.size} chave(s) · truck ${truck.lista.size}`]);
const soNoToco = [...toco.lista.keys()].filter((k) => !truck.lista.has(k));
const soNoTruck = [...truck.lista.keys()].filter((k) => !toco.lista.has(k));
out.push([`1 · PERDEU no truck (existe no toco, sumiu da vizinhança) — ${soNoToco.length}`,
  soNoToco.length ? '\n        ' + soNoToco.slice(0, 20).map((k) => `${k} @ ${toco.lista.get(k).slice(0, 2).join(' / ')}`).join('\n        ') : 'nada']);
out.push([`2 · APARECEU no truck — ${soNoTruck.length}`,
  soNoTruck.length ? '\n        ' + soNoTruck.slice(0, 12).join('\n        ') : 'nada']);
/* …e as que existem nos dois, mas em posição relativa diferente = andaram torto. */
const tortas = [...truck.lista.keys()].filter((k) => toco.lista.has(k)
  && toco.lista.get(k).join('|') !== truck.lista.get(k).join('|'));
out.push([`3 · MESMA peça, posição relativa DIFERENTE — ${tortas.length}`,
  tortas.length ? '\n        ' + tortas.slice(0, 14)
    .map((k) => `${k}\n            toco  ${toco.lista.get(k).slice(0, 3).join(' / ')}`
      + `\n            truck ${truck.lista.get(k).slice(0, 3).join(' / ')}`).join('\n        ') : 'nenhuma']);
return out;
