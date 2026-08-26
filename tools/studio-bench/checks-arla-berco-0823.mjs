/* ▶▶ O PORTÃO DO BERÇO DO ARLA — a ferragem anda com o tanque, nos 10 rígidos.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-arla-berco-0823.mjs

   > *"esse componente com tampa azul foi reduzido, mas o suporte dele nao"*
   > — Kennedy, 2026-08-23.

   O defeito, medido antes do conserto no `scania_p_8x2r`: corpo do ARLA em
   |x| 1 094 e ferragem em 1 217 — **123 mm de degrau**, porque o berço está
   fundido em `chassis_p15`/`chassis_p18` (malhas de caminhão inteiro) e a pesca
   de vizinhança de `recessFlankEquipment()` só aceitava malha CURTA.

   O que este portão trava, e cada linha é uma maneira medida de o conserto
   regredir:

     1. **o degrau** — corpo e ferragem no mesmo plano (20 mm), que é o defeito
        da foto;
     2. **o teto de flanco** — o conjunto inteiro dentro de 1 100 mm, que é o
        que faz a grade passar POR FORA (§43.5). Um conserto que arrume o
        degrau largando os dois para fora desfaz aquilo em silêncio;
     3. **a face INTERNA** — o conjunto não pode afundar na longarina. A versão
        antiga recuava por TRANSLAÇÃO e punha o corpo em |x| 516, ou seja
        62 mm DENTRO da alma (que vive em 341…578). Não se via, e é exatamente
        por isso que precisa de portão;
     4. **a altura INTACTA** — o topo do ARLA é a régua de altura dos dois
        tanques de combustível (§41.4). Encolher a seção dele em y moveria o
        tanque do VM junto, no carregamento seguinte;
     5. **o VM e o VW não se mexem** — a pesca por componente é do ARLA e só
        dele. Medido: no VM ela não teria o que pegar, e no VW pegaria duas
        peças de `truck_p4` que são SAIA DE CABINE. O portão conta as malhas
        que cada grupo moveu, lendo o relato do próprio motor. */

const out = [];
const B = window.__bench;
const mm = (v) => (v === null || v === undefined || !isFinite(v) ? '—' : `${(v * 1000).toFixed(0)}`);

/* O TETO DE FLANCO, repetido aqui de propósito: se ele mudar em
   `truck-tanks.ts` o portão tem de ser lido de novo, não seguir junto. */
const TETO = 1.100;

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

/* O RELATO DO PRÓPRIO MOTOR — `models.ts` imprime uma linha `[flanco]` por
   grupo movido, e ela diz quantas malhas e com que mapa. É a única maneira de
   ver o que a pesca por componente pegou sem reimplementá-la aqui. */
const flanco = [];
const infoOrig = console.info.bind(console);
console.info = (...a) => {
  if (a[0] === '[flanco]') flanco.push(a.map((x) => (typeof x === 'string' ? x : String(x))).join(' '));
  infoOrig(...a);
};

const ARLA_RE = /arla|adblue/i;
const TANK_NODE_RE = /^tanques?(_\d+)?_p\d+$/i;
const materiais = (o) => (Array.isArray(o.material) ? o.material : [o.material]).filter(Boolean);
const uni = (idx, n) => {
  const pai = new Int32Array(n);
  for (let i = 0; i < n; i++) pai[i] = i;
  const acha = (i) => { let r = i; while (pai[r] !== r) r = pai[r]; while (pai[i] !== r) { const t = pai[i]; pai[i] = r; i = t; } return r; };
  const une = (i, j) => { const a = acha(i), b = acha(j); if (a !== b) pai[a] = b; };
  for (let q = 0; q < idx.count; q += 3) { une(idx.getX(q), idx.getX(q + 1)); une(idx.getX(q + 1), idx.getX(q + 2)); }
  for (let i = 0; i < n; i++) pai[i] = acha(i);
  return pai;
};

const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    if (!mo.rigid) continue;
    for (const c of (mo.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, mo, c });
    }
  }
}
out.push(['0 · rígidos no catálogo', alvos.map((a) => `${a.mo.id}/${a.c.id}`).join(' · ')]);

let comArla = 0;
for (const a of alvos) {
  const rot = `${a.mo.id}/${a.c.id}`;
  flanco.length = 0;
  await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: a.mk.id, modelId: a.mo.id, chassisId: a.c.id,
    colorId: null, finishId: null, trim: null,
  }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 20; i++) await B.frame();

  const cab = S.state.cab;
  cab.updateWorldMatrix(true, true);
  const toLocal = new THREE.Matrix4().copy(cab.matrixWorld).invert();
  const L2C = new THREE.Matrix4();
  const v = new THREE.Vector3();

  /* 1 · o corpo do ARLA e o tanque de combustível VISÍVEL, por caixa. */
  const corpo = new THREE.Box3();
  const tanque = new THREE.Box3();
  let nArla = 0;
  cab.traverse((node) => {
    const o = node;
    if (!o.isMesh || !o.visible) return;
    const ehArla = materiais(o).some((m) => ARLA_RE.test(m.name || '')) || ARLA_RE.test(o.name);
    const ehTanque = TANK_NODE_RE.test(o.name || '') || /^TS_TANQUE_VM/.test(o.parent?.name || '')
      || /^TS_TANQUE_VM/.test(o.parent?.parent?.name || '');
    if (!ehArla && !ehTanque) return;
    const pos = o.geometry?.getAttribute('position');
    if (!pos) return;
    L2C.multiplyMatrices(toLocal, o.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(L2C);
      if (ehArla) { corpo.expandByPoint(v); nArla++; } else tanque.expandByPoint(v);
    }
  });

  /* O relato do motor, por grupo. */
  const linha = flanco.join(' | ');
  const nMalhas = (nome) => {
    const m = new RegExp(`${nome}: (\\d+) malha`).exec(linha);
    return m ? +m[1] : 0;
  };
  out.push([`${rot} · relato do motor`, linha || '(nenhum grupo recuado)']);

  /* 2 · o tanque de combustível, em TODO rígido — não regrediu. */
  if (!tanque.isEmpty()) {
    const faceT = Math.max(Math.abs(tanque.min.x), Math.abs(tanque.max.x));
    out.push([`★ ${rot} · o tanque de combustível cabe no teto de flanco`, faceT <= TETO + 0.0005]);
    if (faceT > TETO + 0.0005) out.push([`${rot} · face do tanque`, mm(faceT)]);
  }

  /* Sem ARLA de verdade (o VM tem um DECALQUE de 2 triângulos com esse
     material) não há o que checar aqui — e o motor tem de ter deixado quieto. */
  const dA = corpo.getSize(new THREE.Vector3());
  if (corpo.isEmpty() || nArla < 500 || Math.max(dA.x, dA.y, dA.z) > 1.20) {
    out.push([`★ ${rot} · sem tanque de ARLA: o motor não mexeu em nada por conta dele`,
      nMalhas('arla') === 0]);
    continue;
  }
  comArla++;

  /* 3 · A FERRAGEM: componentes na região do ARLA que não são o corpo dele. */
  const MG = 0.120;
  const reg = new THREE.Box3(
    new THREE.Vector3(0.25, corpo.min.y - MG, corpo.min.z - MG),
    new THREE.Vector3(9, corpo.max.y + MG, corpo.max.z + MG));
  const ferro = new THREE.Box3();
  let nFerro = 0;
  cab.traverse((node) => {
    const o = node;
    if (!o.isMesh || !o.visible || !o.geometry) return;
    if (materiais(o).some((m) => ARLA_RE.test(m.name || '')) || ARLA_RE.test(o.name)) return;
    if (/^TS_/.test(o.parent?.name || '') || /^TS_/.test(o.parent?.parent?.name || '')) return;
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
      let b = caixas.get(r);
      if (!b) { b = new THREE.Box3(); caixas.set(r, b); }
      for (let k = 0; k < 3; k++) b.expandByPoint(v.fromBufferAttribute(pos, idx.getX(q + k)).applyMatrix4(L2C));
    }
    for (const [, b] of caixas) {
      if (!reg.containsBox(b)) continue;
      if (Math.max(Math.abs(b.min.x), Math.abs(b.max.x)) < 0.90) continue;
      ferro.union(b);
      nFerro++;
    }
  });

  const faceC = Math.max(Math.abs(corpo.min.x), Math.abs(corpo.max.x));
  const faceF = ferro.isEmpty() ? null : Math.max(Math.abs(ferro.min.x), Math.abs(ferro.max.x));
  const dentro = Math.min(Math.abs(corpo.min.x), Math.abs(corpo.max.x));
  out.push([`${rot} · ARLA`,
    `corpo |x| ${mm(dentro)}…${mm(faceC)} · y ${mm(corpo.min.y)}…${mm(corpo.max.y)}`
    + ` · z ${mm(corpo.min.z)}…${mm(corpo.max.z)} · ferragem |x| até ${faceF === null ? '—' : mm(faceF)}`
    + ` (${nFerro} componente(s)) · tanque topo y ${mm(tanque.max.y)}`]);

  /* 1 — o degrau da foto. */
  out.push([`★ ${rot} · corpo e ferragem do ARLA no mesmo plano (20 mm)`,
    faceF !== null && Math.abs(faceF - faceC) <= 0.020]);
  /* 2 — o teto de flanco, que é o motivo de o recuo existir. */
  out.push([`★ ${rot} · o conjunto do ARLA cabe no teto de flanco (1 100)`,
    Math.max(faceC, faceF ?? 0) <= TETO + 0.0005]);
  /* 3 — e ele não afundou na longarina (a alma vive em 341…578). */
  out.push([`★ ${rot} · a face interna do ARLA não entra na longarina (≥ 570)`,
    dentro >= 0.570]);
  /* 4 — a altura é a régua dos tanques de combustível: intacta. */
  out.push([`★ ${rot} · a altura do ARLA está intacta (593 × 300 mm de rip)`,
    Math.abs(dA.y - 0.593) <= 0.002 && Math.abs(dA.z - 0.300) <= 0.002]);
  /* ⚠️ A RÉGUA É O DATUM DO MOLDE, e não o topo da caixa do tanque montado: o
     datum de `tank_vm_v1.glb` é o topo da CASCA e a ferragem das cintas passa
     17 mm dele (o contrato aceita até 50). Comparar caixa com caixa reprova um
     motor certo — foi o que esta linha fez na 1ª versão. O `at.y` que
     `swapTruckTanks()` compôs é exatamente `arlaTopo`. */
  let datum = null;
  cab.traverse((o) => {
    if (!/^TS_TANQUE_VM_/.test(o.name || '')) return;
    const p = new THREE.Vector3();
    o.matrix.decompose(p, new THREE.Quaternion(), new THREE.Vector3());
    datum = datum === null ? p.y : Math.max(datum, p.y);
  });
  out.push([`${rot} · datum do tanque novo`, datum === null ? '—' : mm(datum)]);
  out.push([`★ ${rot} · o datum do tanque de combustível ainda é o topo do ARLA`,
    datum !== null && Math.abs(datum - corpo.max.y) <= 0.003]);
}

out.push(['★ os quatro Scania P entraram na conta', comArla === 4]);
console.info = infoOrig;
return out;
