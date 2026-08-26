/* ▶▶▶ O CENSO DOS COMPONENTES — quem é quem no chassi, ANTES de mover nada.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks diag/checks-diag-grupos-0825.mjs

   *"você está quebrando tudo, está movendo itens sem mover todo o conjunto …
   seja analítico para agrupar todos os componentes de um grupo para garantir
   que irá funcionar"* — Kennedy, 2026-08-25.

   Ele tem razão, e o erro é de método: eu vinha movendo ora o NÓ inteiro, ora
   um COMPONENTE solto, e as duas coisas se somaram em cima da mesma peça —
   daí o pedaço de roda para trás. O rip do Scania não tem "um nó por peça": são
   ~40 malhas com centenas de componentes conexos misturando longarina, berço,
   suporte e reservatório na MESMA malha.

   Este check não move nada. Ele CLASSIFICA, e imprime o censo para conferência:

     1. varre toda malha visível e quebra em COMPONENTES CONEXOS;
     2. joga fora o que é ESTRUTURA (cruza a linha de centro, ou é longo em z,
        ou é rebite na alma);
     3. atribui cada componente restante a uma JANELA (tandem, estepe, flanco);
     4. FUNDE por CONTATO dentro da mesma janela — disco + cubo + porcas + pneu
        viram UMA peça sem precisar de nome;
     5. e relata cada peça: caixa, tamanho, malhas de origem.

   O que este censo mostrar é o que o motor vai mover — nem mais, nem menos. */
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
const a = acha('scania-p', '6x2r');
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

/* AS JANELAS, em Zn. O tandem e o estepe são medidos; o flanco é a caixa do
   conjunto de tanques que o motor já pôs. */
const eixosTras = [...mount.axles.driveZ, ...mount.axles.liftZ];
const JAN = {
  tandem: [Math.min(...eixosTras) - 0.95, Math.max(...eixosTras) + 0.95],
};

/* 1 · O CENSO. */
const pecas = [];          // {malhas:Set, caixa, n}
const brutos = [];
cab.traverse((o) => {
  if (!o.isMesh || !o.visible || !o.geometry) return;
  const pos = o.geometry.attributes?.position, idx = o.geometry.getIndex?.();
  if (!pos) return;
  const L2N = new THREE.Matrix4().multiplyMatrices(N, new THREE.Matrix4()
    .multiplyMatrices(cabInv, o.matrixWorld));
  /* Peça NOSSA (roda, tanque, estepe do motor) é um nó só — entra inteira. */
  const nosso = (() => { for (let p = o; p; p = p.parent)
    if (/^(VM_WHEEL|TS_)/.test(p.name || '')) return p.name; return null; })();
  if (nosso || !idx) {
    const b = new THREE.Box3();
    for (let i = 0; i < pos.count; i += 3) {
      b.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N));
    }
    if (!b.isEmpty()) brutos.push({ nome: nosso || o.name, malha: o.name, caixa: b, n: pos.count, no: !!nosso });
    return;
  }
  const pai = comps(idx, pos.count);
  const caixas = new Map();
  for (let q = 0; q < idx.count; q += 3) {
    const r = pai[idx.getX(q)];
    let b = caixas.get(r);
    if (!b) { b = { box: new THREE.Box3(), n: 0 }; caixas.set(r, b); }
    for (let k = 0; k < 3; k++) {
      const i = idx.getX(q + k);
      b.box.expandByPoint(v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N));
      b.n++;
    }
  }
  for (const [, b] of caixas) brutos.push({ nome: o.name, malha: o.name, caixa: b.box, n: b.n, no: false });
});
out.push(['0 · componentes brutos', `${brutos.length}`]);

/* 2 · ESTRUTURA sai. */
const estrutura = [];
const livres = [];
for (const c of brutos) {
  const b = c.caixa, d = b.getSize(new THREE.Vector3());
  const cruza = b.min.x * b.max.x <= 0;
  const fx = Math.max(Math.abs(b.min.x), Math.abs(b.max.x));
  const motivo = c.no ? null
    : cruza ? 'cruza a linha de centro'
      : d.z > 1.5 ? 'longo em z'
        : (fx < 0.50 && Math.max(d.x, d.y, d.z) < 0.10) ? 'rebite na alma' : null;
  if (motivo) estrutura.push({ ...c, motivo }); else livres.push(c);
}
out.push(['1 · estrutura recusada', `${estrutura.length} · livres ${livres.length}`]);

/* ▶▶ 3 · ÂNCORA + CONTATO DE PRIMEIRO GRAU.
   ------------------------------------------------------------------------
   A fusão por contato ENCADEADO não serve, e o censo prova: 13 665 componentes
   viram 3 "peças" de 2,4 m, misturando longarina com roda — num chassi tudo se
   toca, e a transitividade engole o caminhão.

   A régua que fecha é outra: parte-se de uma ÂNCORA que sabemos identificar (o
   estepe que o motor pendurou, o tanque que ele pôs, o cilindro de ar pela
   forma) e leva-se o que ENCOSTA NELA — só o primeiro grau, sem propagar. */
const CONTATO = 0.06;
function ancora(nome, caixa) {
  const reg = caixa.clone().expandByScalar(CONTATO);
  const pegos = livres.filter((c) => c.caixa.intersectsBox(reg) && !c.no);
  const juntas = caixa.clone();
  for (const c of pegos) juntas.union(c.caixa);
  const nomes = [...new Set(pegos.map((x) => x.nome))];
  out.push([`3 · ${nome}`, `âncora Zn ${mm(caixa.min.z)}…${mm(caixa.max.z)}`
    + ` · encostam ${pegos.length} componente(s) de [${nomes.slice(0, 6).join(', ')}]`
    + ` · o conjunto vira Zn ${mm(juntas.min.z)}…${mm(juntas.max.z)}`
    + ` · y ${mm(juntas.min.y)}…${mm(juntas.max.y)}`]);
  return pegos;
}
/* A âncora do ESTEPE: o nó que `swapSpareWheel()` pendurou. */
const spare = brutos.find((c) => /^VM_WHEEL_SPARE/.test(c.nome || ''));
if (spare) ancora('ESTEPE', spare.caixa);
/* E a dos TANQUES nossos. */
for (const t of brutos.filter((c) => /^TS_TANQUE/.test(c.nome || ''))) ancora(t.nome, t.caixa);
/* E a dos CILINDROS de ar, achados pela forma. */
const cil = livres.filter((c) => {
  const d = c.caixa.getSize(new THREE.Vector3());
  const fx = Math.max(Math.abs(c.caixa.min.x), Math.abs(c.caixa.max.x));
  return fx > 0.50 && Math.min(d.x, d.y, d.z) > 0.15 && Math.max(d.x, d.y, d.z) < 0.50;
});
out.push(['3 · corpos cilíndricos (reservatórios?)', cil.length ? cil.slice(0, 10)
  .map((c) => `${c.nome}: Zn ${mm(c.caixa.min.z)}…${mm(c.caixa.max.z)} · |x| até `
    + `${mm(Math.max(Math.abs(c.caixa.min.x), Math.abs(c.caixa.max.x)))}`).join(' · ') : 'nenhum']);

return out;
