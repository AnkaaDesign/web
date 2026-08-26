/* ▶▶ PORTÃO — A GRADE LATERAL PRESA NO IMPLEMENTO, nas dez configurações.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-grade-fixacao-0823.mjs

   *"o suporte dela no implemento de sobrechassi não se parece nada com o do
   semirreboque, ela não está sendo presa realmente no implemento"* — Kennedy,
   2026-08-23, §46.

   E não estava mesmo. O topo da estação era `TOPO_ESTACAO` = 1 090 mm, que é
   cota do SEMIRREBOQUE — lá o flanco é estrutura de cima a baixo (medido:
   `metal-preto` e `caixa-estrutura-preta` de 460 a 1 100 mm no corredor da
   grade) e o suporte encosta nela. No sobrechassi o implemento é um baú sobre
   longarinas ESTREITAS e no corredor da grade não há NADA abaixo do assoalho:

       barriga medida    topo da estação    AR
       Scania P  1 135         1 090         45 mm
       Volvo VM  1 237         1 090        147 mm
       VW Const. 1 376         1 090      **286 mm**

   O que este portão mede, em cada configuração de rígido:

     1. a DISTÂNCIA entre o topo da estação e a barriga do implemento — é o
        número da queixa, e ele tem de ser ~0;
     2. que o suporte não ATRAVESSA a barriga (esticar de menos é feio, de mais
        é peça dentro de peça);
     3. que a FERRAGEM não é deformada — o grampo tem 80 mm no asset e chegou a
        ×3,81 (305 mm) no VW quando ele esticava em vez de subir;
     4. que a ferragem SOBE com a longarina do implemento (a mordida de 37 mm
        no perfil se conserva);
     5. que nada da grade passou a ficar mais para fora do que já ficava
        (|x| ≤ 1 251, a face) nem mais baixo (a borda de 510 mm é o que a
        CONTRAN 805/1995 limita a 550);
     6. e quantas estações ganharam ferragem, por configuração — é a régua de
        não-regressão contra a leva anterior (Scania 4/4, VM 1/4, VW 1/3). */
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
const { scene, camera, controls, renderer } = S;
const raw = renderer.domElement;

/* As linhas que `attachSideGuard()` imprime — é de lá que saem os fatores. */
const relatos = [];
const orig = console.info;
console.info = (...a) => { try { relatos.push(a.map(String).join(' ')); } catch { /* nada */ } orig.apply(console, a); };

/** As caixas de cada PAPEL sob a raiz da grade, em local do implemento e já com
 *  a pose da instância — `InstancedMesh` não é medida pela matriz do nó. */
function papeis() {
  const t = S.state.trailer;
  const raiz = t?.getObjectByName('TS_PROTECAO_LATERAL');
  if (!raiz) return null;
  const inv = new THREE.Matrix4().copy(t.matrixWorld).invert();
  const L = new THREE.Matrix4(); const M = new THREE.Matrix4(); const v = new THREE.Vector3();
  const porPapel = new Map();
  raiz.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const m = /^(BARRA|ESTACAO|PONTA|BRACO|MAO|GRAMPO)__/.exec((o.name || '').replace(/^FUSAO__/, ''));
    if (!m) return;
    const papel = m[1];
    let b = porPapel.get(papel);
    if (!b) { b = { n: 0, inst: 0, x: [Infinity, -Infinity], y: [Infinity, -Infinity], z: [Infinity, -Infinity] }; porPapel.set(papel, b); }
    b.n++; b.inst += o.isInstancedMesh ? o.count : 1;
    const pos = o.geometry.attributes.position;
    const passo = pos.count > 20000 ? 7 : 1;
    const poses = [];
    if (o.isInstancedMesh) for (let i = 0; i < o.count; i++) { const q = new THREE.Matrix4(); o.getMatrixAt(i, q); poses.push(q); }
    else poses.push(new THREE.Matrix4());
    for (const P of poses) {
      L.copy(inv).multiply(o.matrixWorld).multiply(P);
      for (let i = 0; i < pos.count; i += passo) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L);
        const ax = Math.abs(v.x);
        b.x[0] = Math.min(b.x[0], ax); b.x[1] = Math.max(b.x[1], ax);
        b.y[0] = Math.min(b.y[0], v.y); b.y[1] = Math.max(b.y[1], v.y);
        b.z[0] = Math.min(b.z[0], v.z); b.z[1] = Math.max(b.z[1], v.z);
      }
    }
    void M;
  });
  return porPapel;
}

/** O SOLO no referencial do implemento: a barra do asset mora em 510 mm. */
function solo() {
  const p = papeis();
  return p?.get('BARRA') ? p.get('BARRA').y[0] - 0.510 : null;
}

/** A BARRIGA do implemento sobre o corredor da estação — a mesma régua de
 *  `implementBelly()`, refeita aqui de propósito: um portão que chame a função
 *  medida não mede nada. */
function barriga(yG, xDe, xAte) {
  const t = S.state.trailer;
  const inv = new THREE.Matrix4().copy(t.matrixWorld).invert();
  const L = new THREE.Matrix4(); const v = new THREE.Vector3();
  const cel = new Map();
  t.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || !o.visible) return;
    for (let p = o; p; p = p.parent) if (p.name === 'TS_PROTECAO_LATERAL') return;
    if (/^(FUSAO__)?(BARRA|ESTACAO|PONTA|BRACO|MAO|GRAMPO)__/.test(o.name || '')) return;
    L.copy(inv).multiply(o.matrixWorld);
    const pos = o.geometry.attributes.position;
    const passo = pos.count > 60000 ? 3 : 1;
    for (let i = 0; i < pos.count; i += passo) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L);
      const ax = Math.abs(v.x);
      if (ax < xDe || ax > xAte) continue;
      const y = v.y - yG;
      if (y < 1.030 || y > 2.0) continue;
      const k = Math.round(v.z / 0.25);
      const u = cel.get(k);
      if (u === undefined || y < u) cel.set(k, y);
    }
  });
  const ys = [...cel.values()].sort((a, b) => a - b);
  return ys.length >= 8 ? ys[Math.floor(ys.length / 2)] : null;
}

/* As cotas do ASSET, medidas em `protecao_lateral_v2.glb` componente a
   componente (ver `tools/chassis-bake/bake-protecao-lateral.cjs`). */
const ASSET = {
  barra: [0.510, 1.010], estacao: [0.510, 1.090],
  braco: [0.840, 0.890], mao: [0.626, 0.874], grampo: [0.890, 0.970],
  face: 1.251,
};
/** A descida da grade (`DESCIDA` em `side-guard.ts`). */
const DESCIDA = 0.040;

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
out.push([`configurações de rígido`, alvos.length]);

const tabela = [];
let piorAr = 0, piorAtravessa = 0, piorGrampo = 0, piorFora = 0, piorBaixo = 0;
let semFerragem = 0;

for (const a of alvos) {
  const rot = `${a.mo.id}/${a.c.id}`;
  relatos.length = 0;
  await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: a.mk.id, modelId: a.mo.id, chassisId: a.c.id,
    colorId: null, finishId: null, trim: null,
  }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 25; i++) await B.frame();

  const P = papeis();
  if (!P || !P.get('ESTACAO') || !P.get('BARRA')) {
    out.push([`★ ${rot} — a grade existe`, false]);
    continue;
  }
  const yG = solo();
  const cota = (papel, i) => P.get(papel) ? P.get(papel).y[i] - yG : null;
  const bar = barriga(yG, ASSET.face - 0.33, ASSET.face - 0.01);
  const topo = cota('ESTACAO', 1);
  const ar = bar === null ? null : bar - topo;          /* + sobra ar, − atravessa */
  const grampoAlt = P.get('GRAMPO') ? cota('GRAMPO', 1) - cota('GRAMPO', 0) : null;
  const bracoY = P.get('BRACO') ? cota('BRACO', 0) : null;
  const bracoTopo = P.get('BRACO') ? cota('BRACO', 1) : null;
  const foraX = Math.max(...[...P.values()].map((b) => b.x[1]));
  const baixoY = cota('BARRA', 0);
  const linha = relatos.filter((l) => /suporte esticado|estação no topo|barriga/i.test(l))[0] || '';
  const ferr = relatos.filter((l) => /ferragem em|ferragem NÃO/i.test(l))[0] || '';
  const q = /ferragem em (\d+) de (\d+)/.exec(ferr);
  if (!q) semFerragem++;
  tabela.push({ rot, bar, topo, ar, grampoAlt, bracoY, bracoTopo, foraX, baixoY,
    com: q ? +q[1] : 0, de: q ? +q[2] : 0, linha, ferr });
  if (ar !== null) { piorAr = Math.max(piorAr, Math.max(0, ar)); piorAtravessa = Math.max(piorAtravessa, Math.max(0, -ar)); }
  if (grampoAlt !== null) piorGrampo = Math.max(piorGrampo, Math.abs(grampoAlt - (ASSET.grampo[1] - ASSET.grampo[0])));
  piorFora = Math.max(piorFora, foraX - ASSET.face);
  piorBaixo = Math.max(piorBaixo, Math.abs((ASSET.barra[0] - DESCIDA) - baixoY));
}

out.push(['tabela — barriga · topo da estação · ar · grampo · braço · ferragem', '\n        '
  + tabela.map((t) => `${t.rot.padEnd(26)} barriga ${String(mm(t.bar)).padStart(5)}`
    + ` · topo ${String(mm(t.topo)).padStart(5)} · ar ${String(mm(t.ar)).padStart(5)}`
    + ` · grampo ${String(mm(t.grampoAlt)).padStart(4)} mm · braço em `
    + `${String(mm(t.bracoY)).padStart(5)} · ferragem ${t.com}/${t.de}`).join('\n        ')]);
out.push(['relato do motor, por configuração', '\n        '
  + tabela.map((t) => `${t.rot}\n          ${t.linha}\n          ${t.ferr}`).join('\n        ')]);

/* ── OS PORTÕES ── */
out.push(['★ 1 · a estação ENCOSTA na barriga do implemento (ar ≤ 20 mm)',
  piorAr <= 0.020, `pior sobra ${mm(piorAr)} mm`]);
out.push(['★ 2 · …e não a ATRAVESSA (≤ 5 mm)',
  piorAtravessa <= 0.005, `pior invasão ${mm(piorAtravessa)} mm`]);
out.push(['★ 3 · o GRAMPO conserva os 80 mm do asset (≤ 3 mm de diferença)',
  piorGrampo <= 0.003, `pior diferença ${mm(piorGrampo)} mm`]);
/* ★ 4 · O BRAÇO ENCOSTA NA BARRIGA. É a estrela da queixa: *"o problema era o
   suporte horizontal, que realmente prende no implemento"*. O topo dele tem de
   estar a `FOLGA_BRACO_TETO` (15 mm) da barriga, em toda configuração. */
const bracoTeto = tabela.filter((t) => t.bracoTopo !== null && t.bar !== null)
  .map((t) => Math.abs((t.bar - t.bracoTopo) - 0.015));
out.push(['★ 4 · o BRAÇO encosta na barriga do implemento (15 ± 5 mm)',
  bracoTeto.length === tabela.length && Math.max(...bracoTeto) <= 0.005,
  `pior ${mm(Math.max(0, ...bracoTeto))} mm · ${bracoTeto.length}/${tabela.length} com braço`]);
/* ★ 4b · e ele conserva os 50 mm de chapa do asset — não estica em y. */
const bracoAlt = tabela.filter((t) => t.bracoTopo !== null)
  .map((t) => Math.abs((t.bracoTopo - t.bracoY) - (ASSET.braco[1] - ASSET.braco[0])));
out.push(['★ 4b · …com os 50 mm de chapa do asset (não estica em y)',
  bracoAlt.length > 0 && Math.max(...bracoAlt) <= 0.003,
  `pior ${mm(Math.max(0, ...bracoAlt))} mm`]);
/* ★ 4c · TODA estação ganha ferragem. Antes de §46 eram 1 de 4 no VM e 1 de 3
   no VW, porque a régua era o chassi do CAMINHÃO. */
out.push(['★ 4c · TODA estação ganha braço (a régua é o implemento, não o caminhão)',
  tabela.every((t) => t.de > 0 && t.com === t.de),
  tabela.map((t) => `${t.com}/${t.de}`).join(' ')]);
out.push(['★ 5 · nada da grade passou da face em |x| 1 251 (≤ 3 mm)',
  piorFora <= 0.003, `pior ${mm(piorFora)} mm`]);
out.push([`★ 6 · a borda de baixo desceu ${mm(DESCIDA)} mm e parou em `
  + `${mm(ASSET.barra[0] - DESCIDA)} mm (≤ 3 mm de erro)`,
piorBaixo <= 0.003, `pior ${mm(piorBaixo)} mm`]);
/* ★ 6b · e continua abaixo dos 550 mm que a CONTRAN 805/1995 põe como TETO da
   borda inferior — descer é sempre legal, subir é que não. */
out.push(['★ 6b · borda inferior ≤ 550 mm (CONTRAN 805/1995)',
  tabela.every((t) => t.baixoY <= 0.550), `maior ${mm(Math.max(...tabela.map((t) => t.baixoY)))} mm`]);
out.push(['★ 7 · toda configuração monta ferragem em pelo menos uma estação',
  semFerragem === 0, `${semFerragem} sem`]);

/* ── AS FOTOS, dos três de referência ── */
const foto = (nome, alvo, olho) => {
  controls.target.copy(new THREE.Vector3(...alvo));
  camera.position.set(...olho);
  camera.lookAt(controls.target);
  camera.updateMatrixWorld(true); camera.updateProjectionMatrix(); controls.update();
  renderer.render(scene, camera);
  out.push([nome, raw.toDataURL('image/png')]);
};
for (const [modelId, chassisId, tag] of [['scania-p', '8x2r', 'scania'],
  ['volvo-vm-2015', '8x2r', 'vm'], ['vw-constellation', '8x2-tl', 'vw']]) {
  const a = alvos.find((x) => x.mo.id === modelId && x.c.id === chassisId);
  if (!a) continue;
  await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: a.mk.id,
    modelId: a.mo.id, chassisId: a.c.id, colorId: null, finishId: null, trim: null }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 30; i++) await B.frame();
  const bb = new THREE.Box3().setFromObject(S.state.trailer);
  const zc = (bb.min.z + bb.max.z) / 2;
  foto(`fix-${tag}-1-perto`, [0, 0.8, zc], [2.4, 0.9, zc + 1.2]);
  foto(`fix-${tag}-2-baixo`, [0, 0.7, zc], [3.0, 0.15, zc + 2.6]);
  foto(`fix-${tag}-3-por-dentro`, [0, 0.8, zc], [1.6, 0.35, zc + 3.4]);
  /* ▶ E O ÂNGULO DA FOTO DO DONO: de BAIXO DO CONJUNTO, olhando ao longo do
     flanco. É o único de onde se vê o braço — ele mora atrás da barra e acima
     dela, e de fora some contra o preto do sobrechassi. */
  foto(`fix-${tag}-4-de-baixo`, [1.0, 1.15, zc], [0.2, 0.30, zc + 3.0]);
  foto(`fix-${tag}-5-de-baixo-perto`, [1.0, 1.15, zc + 0.6], [0.6, 0.55, zc + 2.0]);
}
console.info = orig;
return out;
