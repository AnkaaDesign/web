/* ▶▶▶ O GRUPO DO ESTEPE, PEÇA A PEÇA — vizinhança ESTREITA.
   ===========================================================================
   O censo largo (diag/checks-diag-estepe-conjunto-0825) devolveu 6 233 componentes:
   a vizinhança pegava metade do caminhão. Aqui a região é a caixa do estepe
   inflada de pouco, e a lista sai INTEIRA e ordenada por tamanho — é a lista
   que vira contrato no motor. */
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
/* Região: a caixa do estepe + o que a cesta e o braço podem passar dela.
   O braço sobe até a longarina (y) e o tirante passa por cima (y). */
const INFLA = new THREE.Vector3(0.16, 0.42, 0.16);

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
  const reg = new THREE.Box3(cxE.min.clone().sub(INFLA), cxE.max.clone().add(INFLA));
  const itens = [];
  const fora = [];
  cab.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry) return;
    for (let p = o; p; p = p.parent) if (/^(VM_WHEEL|TS_)/.test(p.name || '')) return;
    const pos = o.geometry.attributes?.position, idx = o.geometry.getIndex?.();
    if (!pos || !idx || pos.count > 260000) return;
    const M = new THREE.Matrix4().copy(N).multiply(cabInv).multiply(o.matrixWorld);
    const px = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
      px[i * 3] = v.x; px[i * 3 + 1] = v.y; px[i * 3 + 2] = v.z;
    }
    const pai = comps(idx, pos.count);
    const caixas = new Map();
    for (let q = 0; q < idx.count; q += 3) {
      const r = pai[idx.getX(q)];
      let b = caixas.get(r);
      if (!b) { b = { box: new THREE.Box3(), n: 0 }; caixas.set(r, b); }
      for (let k = 0; k < 3; k++) {
        const i = idx.getX(q + k);
        b.box.expandByPoint(v.set(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]));
        b.n++;
      }
    }
    for (const [, b] of caixas) {
      if (!b.box.intersectsBox(reg)) continue;
      const d = b.box.getSize(new THREE.Vector3());
      const rel = b.box.getCenter(new THREE.Vector3()).sub(centro);
      const it = { nome: o.name, d, rel, n: b.n, box: b.box,
        maior: Math.max(d.x, d.y, d.z),
        chave: `${o.name}|${mm(d.x)}x${mm(d.y)}x${mm(d.z)}`,
        pos: `${mm(rel.x)},${mm(rel.y)},${mm(rel.z)}` };
      if (reg.containsBox(b.box)) itens.push(it); else fora.push(it);
    }
  });
  itens.sort((a, b2) => b2.maior - a.maior);
  fora.sort((a, b2) => b2.maior - a.maior);
  return { itens, fora, centro, cxE };
}

const cfg = ['4x2r', '8x2r', '6x2r'];
const dados = {};
for (const c of cfg) dados[c] = await mede(c);
const T = dados['4x2r'];
out.push(['0 · toco · estepe', `caixa ${mm(T.cxE.min.x)}…${mm(T.cxE.max.x)} × ${mm(T.cxE.min.y)}…${mm(T.cxE.max.y)}`
  + ` × ${mm(T.cxE.min.z)}…${mm(T.cxE.max.z)} · dentro ${T.itens.length} · atravessam ${T.fora.length}`]);
out.push(['1 · TOCO — dentro da região, do maior ao menor',
  '\n        ' + T.itens.slice(0, 120).map((it) =>
    `${it.chave} n=${it.n} @${it.pos}`).join('\n        ')]);
out.push(['2 · TOCO — atravessam a região (ficam, é o chassi) — top 20',
  '\n        ' + T.fora.slice(0, 20).map((it) =>
    `${it.chave} n=${it.n} @${it.pos}`).join('\n        ')]);
for (const c of ['8x2r', '6x2r']) {
  const X = dados[c];
  const dentro = new Map();
  for (const it of X.itens) dentro.set(`${it.chave}@${it.pos}`, it);
  const ok = [], falta = [];
  for (const it of T.itens) {
    if (dentro.has(`${it.chave}@${it.pos}`)) ok.push(it); else falta.push(it);
  }
  out.push([`3 · ${c} — do grupo do toco, casam ${ok.length}/${T.itens.length}`,
    falta.length ? '\n        FALTAM (não andaram, ou andaram torto):\n        '
      + falta.slice(0, 60).map((it) => {
        const iguais = [...X.itens, ...X.fora].filter((o) => o.chave === it.chave).map((o) => o.pos);
        return `${it.chave} n=${it.n} toco@${it.pos} → ${c}@[${iguais.join(' | ') || 'AUSENTE'}]`;
      }).join('\n        ') : 'todas'],
  );
  out.push([`4 · ${c} — dentro da região e SEM par no toco — ${X.itens.length - ok.length}`,
    '\n        ' + X.itens.filter((it) => !T.itens.some((t) => t.chave === it.chave && t.pos === it.pos))
      .slice(0, 40).map((it) => `${it.chave} n=${it.n} @${it.pos}`).join('\n        ')]);
}
return out;
