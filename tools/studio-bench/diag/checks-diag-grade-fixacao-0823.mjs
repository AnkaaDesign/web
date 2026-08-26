/* DIAGNÓSTICO 2 — ONDE A GRADE PODE SE PRENDER, medido nos quatro implementos.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks diag/checks-diag-grade-fixacao-0823.mjs

   O primeiro diagnóstico (`diag/checks-diag-grade-suporte-0823.mjs`) mostrou O QUE
   FALTA: ferragem em 1 de 4 estações no VM e 1 de 3 no VW, e um grampo esticado
   ×3,81. Este mede O QUE EXISTE PARA PRENDER: o que o IMPLEMENTO oferece acima
   da grade (|x| 1,00…1,32) e o que o CAMINHÃO põe no caminho do braço. */
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

/* O SOLO no referencial da raiz do implemento: a grade é posta em `yGround` e a
   barra do asset mora em 510…1010 mm de solo, então o solo é o y da barra
   menos 0,510. Sem isso não há como converter as cotas do implemento. */
function soloDoImplemento() {
  const t = S.state.trailer;
  const raiz = t.getObjectByName('TS_PROTECAO_LATERAL');
  if (!raiz) return null;
  const inv = new THREE.Matrix4().copy(t.matrixWorld).invert();
  const L = new THREE.Matrix4(); const v = new THREE.Vector3();
  let yMin = Infinity;
  raiz.traverse((o) => {
    if (!o.isMesh || !/^BARRA__/.test(o.name || '')) return;
    L.copy(inv).multiply(o.matrixWorld);
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 3) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L);
      if (v.y < yMin) yMin = v.y;
    }
  });
  return isFinite(yMin) ? yMin - 0.510 : null;
}

/* O PERFIL DE BAIXO do implemento no corredor da grade, por célula de z. Por
   VÉRTICE e no espaço local do implemento — é lá que a grade é montada. */
function tetoSobreAGrade(yGround, xMin, xMax, yMinCorte) {
  const t = S.state.trailer;
  const inv = new THREE.Matrix4().copy(t.matrixWorld).invert();
  const L = new THREE.Matrix4(); const v = new THREE.Vector3();
  const CEL = 0.25;
  const cel = new Map();       // k -> {y, nome}
  const nomes = new Map();     // nome -> {n, y0,y1, x0,x1, z0,z1}
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
      if (ax < xMin || ax > xMax) continue;
      const y = v.y - yGround;
      if (y < yMinCorte || y > 2.0) continue;
      const k = Math.round(v.z / CEL);
      const u = cel.get(k);
      if (!u || y < u.y) cel.set(k, { y, nome: o.name });
      let s = nomes.get(o.name);
      if (!s) { s = { n: 0, y0: Infinity, y1: -Infinity, x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity }; nomes.set(o.name, s); }
      s.n++; s.y0 = Math.min(s.y0, y); s.y1 = Math.max(s.y1, y);
      s.x0 = Math.min(s.x0, ax); s.x1 = Math.max(s.x1, ax);
      s.z0 = Math.min(s.z0, v.z); s.z1 = Math.max(s.z1, v.z);
    }
  });
  return { cel, nomes };
}

/* O QUE O CAMINHÃO PÕE NO CAMINHO DO BRAÇO — com NOME, que é o que falta no
   relato do motor. Mesmo corte de `truckArmObstacles()`. */
function quemBloqueiaOBraco(yGroundImpl) {
  const cab = S.state.cab; const t = S.state.trailer;
  if (!cab || !t) return [];
  const inv = new THREE.Matrix4().copy(t.matrixWorld).invert();
  const L = new THREE.Matrix4();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const porNome = new Map();
  cab.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || !o.visible) return;
    L.copy(inv).multiply(o.matrixWorld);
    const pos = o.geometry.attributes.position;
    const idx = o.geometry.index;
    const nT = idx ? idx.count / 3 : pos.count / 3;
    const passo = nT > 40000 ? 3 : 1;
    for (let f = 0; f < nT; f += passo) {
      const i0 = idx ? idx.getX(f * 3) : f * 3, i1 = idx ? idx.getX(f * 3 + 1) : f * 3 + 1, i2 = idx ? idx.getX(f * 3 + 2) : f * 3 + 2;
      a.set(pos.getX(i0), pos.getY(i0), pos.getZ(i0)).applyMatrix4(L);
      b.set(pos.getX(i1), pos.getY(i1), pos.getZ(i1)).applyMatrix4(L);
      c.set(pos.getX(i2), pos.getY(i2), pos.getZ(i2)).applyMatrix4(L);
      const y0 = Math.min(a.y, b.y, c.y) - yGroundImpl, y1 = Math.max(a.y, b.y, c.y) - yGroundImpl;
      if (y1 < 0.780 || y0 > 0.990) continue;
      const ax0 = Math.min(Math.abs(a.x), Math.abs(b.x), Math.abs(c.x));
      const ax1 = Math.max(Math.abs(a.x), Math.abs(b.x), Math.abs(c.x));
      if (ax1 < 0.62 || ax0 > 1.20) continue;
      let s = porNome.get(o.name);
      if (!s) { s = { n: 0, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity }; porNome.set(o.name, s); }
      s.n++;
      s.x0 = Math.min(s.x0, ax0); s.x1 = Math.max(s.x1, ax1);
      s.y0 = Math.min(s.y0, y0); s.y1 = Math.max(s.y1, y1);
      s.z0 = Math.min(s.z0, a.z, b.z, c.z); s.z1 = Math.max(s.z1, a.z, b.z, c.z);
    }
  });
  return [...porNome].sort((p, q) => q[1].n - p[1].n).slice(0, 12);
}

function estacoesZ() {
  const t = S.state.trailer;
  const raiz = t.getObjectByName('TS_PROTECAO_LATERAL');
  if (!raiz) return [];
  const zs = [];
  raiz.traverse((o) => {
    if (!o.isInstancedMesh || !/^ESTACAO__/.test(o.name || '') || !/_D$/.test(o.name || '')) return;
    const m = new THREE.Matrix4();
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      const p = new THREE.Vector3().setFromMatrixPosition(m).applyMatrix4(o.matrixWorld);
      zs.push(p.z);
    }
  });
  return [...new Set(zs.map((z) => Math.round(z * 1000) / 1000))].sort((a, b) => a - b);
}

const CFG = [
  ['scania-p', '8x2r', 'scania'],
  ['volvo-vm-2015', '8x2r', 'vm'],
  ['vw-constellation', '8x2-tl', 'vw'],
];
for (const [modelId, chassisId, tag] of CFG) {
  let mk = null, mo = null, c = null;
  for (const m of (S.catalog.catalog?.manufacturers || [])) for (const md of (m.models || [])) for (const ch of (md.chassis || []))
    if (md.id === modelId && ch.id === chassisId) { mk = m; mo = md; c = ch; }
  if (!c) { out.push([`★ acha ${modelId}/${chassisId}`, false]); continue; }
  await S.applyChoice({ envId: S.choice?.envId || 'estudio', manufacturerId: mk.id, modelId: mo.id, chassisId: c.id, colorId: null, finishId: null, trim: null }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 30; i++) await B.frame();
  const yG = soloDoImplemento();
  out.push([`${tag} · solo no referencial do implemento`, `${mm(yG)} mm`]);
  if (yG === null) continue;
  const zs = estacoesZ();
  out.push([`${tag} · estações em z (local)`, zs.map(mm).join(' · ')]);
  for (const [x0, x1, corte, rot] of [[1.00, 1.32, 1.02, 'sobre a GRADE (|x| 1000…1320)'],
    [0.62, 1.00, 1.02, 'entre grade e longarina (|x| 620…1000)']]) {
    const { cel, nomes } = tetoSobreAGrade(yG, x0, x1, corte);
    const linhas = [...cel].sort((p, q) => p[0] - q[0]).map(([k, u]) => `${mm(k * 0.25)}:${mm(u.y)}`);
    out.push([`${tag} · teto ${rot} — y por célula de 250 mm`, '\n        ' + linhas.join(' ')]);
    out.push([`${tag} · quem faz esse teto`, '\n        ' + [...nomes].sort((p, q) => q[1].n - p[1].n).slice(0, 8)
      .map(([n, s]) => `${n}: ${s.n} pts · |x| ${mm(s.x0)}…${mm(s.x1)} y ${mm(s.y0)}…${mm(s.y1)} z ${mm(s.z0)}…${mm(s.z1)}`).join('\n        ')]);
  }
  out.push([`${tag} · quem bloqueia o BRAÇO`, '\n        ' + quemBloqueiaOBraco(yG)
    .map(([n, s]) => `${n}: ${s.n} tri · |x| ${mm(s.x0)}…${mm(s.x1)} y ${mm(s.y0)}…${mm(s.y1)} z ${mm(s.z0)}…${mm(s.z1)}`).join('\n        ')]);
}
return out;
