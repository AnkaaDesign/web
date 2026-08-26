/* ▶▶▶ CENSO DO CONJUNTO DO ESTEPE — toco (correto) × truck × bitruck.
   ===========================================================================
   *"ficou dois conjuntos de peças separadas … deveria ir do verde para o
   vermelho … analise o modelo toco que não teve mudança"* — Kennedy, 2026-08-25.

   Só MEDE. Para cada configuração lista TODA a vizinhança do estepe componente
   a componente, com nome, caixa, tamanho, contagem e a posição RELATIVA ao
   centro do estepe. Como o estepe anda junto com o conjunto, uma peça que
   pertence ao grupo tem a MESMA posição relativa nos três; uma que ficou tem a
   relativa deslocada de −dz. */
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

/* A vizinhança: a caixa do estepe inflada. Larga o bastante para conter a peça
   tanto na cota nova quanto na antiga (o maior passo é 400 mm). */
const INFLA = new THREE.Vector3(0.60, 0.75, 0.85);

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
  let atravessam = 0;
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
      if (!reg.containsBox(b.box)) { atravessam++; continue; }
      const d = b.box.getSize(new THREE.Vector3());
      const rel = b.box.getCenter(new THREE.Vector3()).sub(centro);
      itens.push({ nome: o.name, d, rel, n: b.n,
        chave: `${o.name}|${mm(d.x)}x${mm(d.y)}x${mm(d.z)}`,
        pos: `${mm(rel.x)},${mm(rel.y)},${mm(rel.z)}` });
    }
  });
  return { itens, atravessam, centro, cxE };
}

const cfg = ['4x2r', '6x2r', '8x2r'];
const dados = {};
for (const c of cfg) dados[c] = await mede(c);
for (const c of cfg) {
  const D = dados[c];
  out.push([`0 · ${c} · estepe`, `caixa ${mm(D.cxE.min.x)}…${mm(D.cxE.max.x)} × ${mm(D.cxE.min.y)}…${mm(D.cxE.max.y)}`
    + ` × ${mm(D.cxE.min.z)}…${mm(D.cxE.max.z)} · vizinhança ${D.itens.length} comp. (${D.atravessam} atravessam)`]);
}

/* A chave conta quantas vezes aparece — peça repetida (dois lados) tem de casar
   pela posição também. Agrupa por chave+pos. */
const idx = (D) => {
  const m = new Map();
  for (const it of D.itens) {
    const k = `${it.chave}@${it.pos}`;
    m.set(k, it);
  }
  return m;
};
const T = idx(dados['4x2r']);
for (const c of ['6x2r', '8x2r']) {
  const X = idx(dados[c]);
  const iguais = [...T.keys()].filter((k) => X.has(k));
  const soToco = [...T.keys()].filter((k) => !X.has(k));
  const soEle = [...X.keys()].filter((k) => !T.has(k));
  out.push([`1 · ${c} — casam com o toco (andaram junto)`, `${iguais.length} de ${T.size}`]);
  out.push([`2 · ${c} — NÃO casam (ficaram ou mudaram) — ${soToco.length}`,
    soToco.length ? '\n        ' + soToco.slice(0, 60).map((k) => {
      const it = T.get(k);
      /* Onde ele foi parar neste chassi: mesma chave, outra posição. */
      const irmaos = [...X.values()].filter((o) => o.chave === it.chave)
        .map((o) => o.pos).join(' | ');
      return `${it.chave} n=${it.n} toco@${it.pos}  →  ${c}@[${irmaos || 'AUSENTE'}]`;
    }).join('\n        ') : 'nada']);
  out.push([`3 · ${c} — só nele — ${soEle.length}`,
    soEle.length ? '\n        ' + soEle.slice(0, 40).map((k) => {
      const it = X.get(k); return `${it.chave} n=${it.n} @${it.pos}`;
    }).join('\n        ') : 'nada']);
}
return out;
