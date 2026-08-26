/* DIAGNÓSTICO — POR QUE O CORRIDO DIANTEIRO MORRE ANTES DO ARLA (Scania 8x2).
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --verbose \
            --checks checks-diag-grade-frente-0824.mjs

   *"essa grade metálica não está indo até onde deveria, mais ou menos onde está
   aquele componente com tampa azul"* — Kennedy, 2026-08-24, com as fotos dos
   dois flancos do Scania bitruck.

   O componente de tampa azul é o ARLA. A pergunta é UMA: quem manda na ponta
   dianteira do corrido? Três candidatos, e o diagnóstico separa os três:

     · a BAIA do 2º direcional (`rodasMeia`, medida por `wheelBayReach`);
     · um OBSTÁCULO no plano da grade com vão ≥ `AMPUTA_MIN` (o ARLA, se o
       recuo de flanco não bastou);
     · o RECUO DE PONTA barato (≤ 220 mm) contra a lista da ESTAÇÃO.

   Tudo em MUNDO, com o solo em y = 0. */
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

/* O relato do motor sai por `console.info('[grade]', …)`. */
const grade = [];
const infoOrig = console.info.bind(console);
console.info = (...a) => {
  if (a[0] === '[grade]' || a[0] === '[tanques]' || a[0] === '[flanco]') grade.push(a.slice(1).join(' '));
  infoOrig(...a);
};

const acha = (modelo, chassi) => {
  for (const mk of (S.catalog.catalog?.manufacturers || [])) {
    for (const mo of (mk.models || [])) {
      if (mo.id !== modelo) continue;
      for (const c of (mo.chassis || [])) if (c.id === chassi) return { mk, mo, c };
    }
  }
  return null;
};

async function carrega(modelo, chassi) {
  const a = acha(modelo, chassi);
  if (!a) { out.push([`★ acha ${modelo}/${chassi}`, false]); return null; }
  await S.applyChoice({
    envId: S.choice?.envId || 'estudio',
    manufacturerId: a.mk.id, modelId: a.mo.id, chassisId: a.c.id,
    colorId: null, finishId: null, trim: null,
  }, { curtain: false });
  await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
  await B.until(() => !!S.state.trailer, 300000);
  for (let i = 0; i < 40; i++) await B.frame();
  return a;
}

/* Passa por outro chassi primeiro para o relato da grade não ser suprimido
   por `guardLoggedFor` (ele só imprime quando a linha MUDA). */
await carrega('scania-p', '6x2r');
grade.length = 0;
const alvo = await carrega('scania-p', '8x2r');
if (!alvo) return out;

out.push(['0 · configuração', `${S.state.cabDef?.file} · implemento ${S.state.implement?.short}`]);
for (const l of grade) out.push(['   [motor]', l]);

const cab = S.state.cab, t = S.state.trailer;
cab.updateWorldMatrix(true, true); t.updateWorldMatrix(true, true);
const v = new THREE.Vector3();

/* 1 · O CORRIDO QUE FOI MONTADO, por papel e por lado, em z de MUNDO. */
let raiz = null;
t.traverse((o) => { if (o.name === 'TS_PROTECAO_LATERAL') raiz = o; });
out.push(['1 · raiz da grade', raiz ? 'TS_PROTECAO_LATERAL presente' : '⚠ AUSENTE']);
if (raiz) {
  const porPapel = new Map();
  raiz.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const pos = o.geometry.attributes.position;
    const n = o.isInstancedMesh ? o.count : 1;
    const M = new THREE.Matrix4();
    for (let k = 0; k < n; k++) {
      if (o.isInstancedMesh) { o.getMatrixAt(k, M); M.premultiply(o.matrixWorld); }
      else M.copy(o.matrixWorld);
      for (let i = 0; i < pos.count; i += Math.max(1, Math.floor(pos.count / 400))) {
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M);
        const lado = v.x >= 0 ? 'D' : 'E';
        const ch = `${(o.name || '?').replace(/_[DE](_[FT])?$/, '')} ${lado}`;
        let s = porPapel.get(ch);
        if (!s) { s = { z0: Infinity, z1: -Infinity, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, n: 0 }; porPapel.set(ch, s); }
        s.n++; s.z0 = Math.min(s.z0, v.z); s.z1 = Math.max(s.z1, v.z);
        s.y0 = Math.min(s.y0, v.y); s.y1 = Math.max(s.y1, v.y);
        const ax = Math.abs(v.x); s.x0 = Math.min(s.x0, ax); s.x1 = Math.max(s.x1, ax);
      }
    }
  });
  out.push(['1 · peças da grade (z de mundo)', '\n        '
    + [...porPapel].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([n, s]) => `${n}: z ${mm(s.z0)}…${mm(s.z1)} · y ${mm(s.y0)}…${mm(s.y1)} · |x| ${mm(s.x0)}…${mm(s.x1)}`).join('\n        ')]);
}

/* 2 · OS EIXOS, em mundo. */
const mount = S.state.cabMount;
const N2W = (zn) => zn;   // o mount mede em espaço normalizado do caminhão
out.push(['2 · eixos (Zn de mount.json)', `steer ${(mount.axles.steerZ || []).map(mm).join(', ')}`
  + ` · drive ${(mount.axles.driveZ || []).map(mm).join(', ')}`
  + ` · lift ${(mount.axles.liftZ || []).map(mm).join(', ') || '—'} · config ${mount.axles.config}`]);

/* 3 · O QUE EXISTE NO CORREDOR DA GRADE, por célula de 100 mm de z.
      Duas faixas de altura: a do SUPORTE (que amputa o corrido) e a da
      ESTAÇÃO INTEIRA (que governa o recuo de ponta). O |x| de corte é o mesmo
      do motor: face da grade (medida acima) menos 155 mm. */
const faceX = 1.275;
const corte = faceX - 0.155;
for (const [y0, y1, rot] of [[0.84, 1.09, 'SUPORTE (y 840…1090) — amputa'],
  [0.50, 1.10, 'ESTAÇÃO (y 500…1100) — recuo de ponta']]) {
  const cel = new Map();
  cab.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || !o.visible) return;
    const pos = o.geometry.attributes.position;
    const passo = pos.count > 120000 ? 2 : 1;
    for (let i = 0; i < pos.count; i += passo) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(o.matrixWorld);
      if (v.y < y0 || v.y > y1) continue;
      const ax = Math.abs(v.x);
      if (ax < corte) continue;
      const k = Math.round(v.z / 0.10);
      const u = cel.get(k);
      if (!u || ax > u.x) cel.set(k, { x: ax, nome: o.name || '(sem nome)', lado: v.x >= 0 ? 'D' : 'E' });
    }
  });
  const ks = [...cel.keys()].sort((a, b) => a - b);
  out.push([`3 · corredor |x| ≥ ${mm(corte)} · ${rot}`, ks.length ? '\n        '
    + ks.map((k) => `z ${mm(k * 0.10)}: |x| ${mm(cel.get(k).x)} · ${cel.get(k).lado} · ${cel.get(k).nome}`).join('\n        ')
    : 'nada']);
}

/* 4 · O ARLA e o TANQUE, onde ficaram depois do recuo de flanco. */
const grupos = new Map();
cab.traverse((o) => {
  if (!o.isMesh || !o.geometry?.attributes?.position || !o.visible) return;
  const mats = (Array.isArray(o.material) ? o.material : [o.material]).map((m) => m?.name || '').join(',');
  const arla = /arla|adblue/i.test(mats) || /arla|adblue/i.test(o.name || '');
  const tanque = /^TS_TANQUE|^tanques?(_\d+)?_p\d+$/i.test(o.name || '');
  if (!arla && !tanque) return;
  const ch = arla ? 'ARLA' : 'TANQUE';
  const pos = o.geometry.attributes.position;
  let s = grupos.get(ch);
  if (!s) { s = { z0: Infinity, z1: -Infinity, x: 0, y0: Infinity, y1: -Infinity, nos: new Set() }; grupos.set(ch, s); }
  s.nos.add(o.name);
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(o.matrixWorld);
    s.z0 = Math.min(s.z0, v.z); s.z1 = Math.max(s.z1, v.z);
    s.y0 = Math.min(s.y0, v.y); s.y1 = Math.max(s.y1, v.y);
    s.x = Math.max(s.x, Math.abs(v.x));
  }
});
for (const [n, s] of grupos) {
  out.push([`4 · ${n}`, `z ${mm(s.z0)}…${mm(s.z1)} · y ${mm(s.y0)}…${mm(s.y1)} · |x| até ${mm(s.x)}`
    + ` · nós ${[...s.nos].slice(0, 6).join(', ')}${s.nos.size > 6 ? ` (+${s.nos.size - 6})` : ''}`]);
}

/* 5 · FOTO do flanco direito, na régua do bench. */
const bb = new THREE.Box3().setFromObject(cab);
const c = bb.getCenter(new THREE.Vector3());
S.camera.position.set(c.x + 9, 1.4, c.z + 1.5);
S.controls.target.set(c.x, 1.1, c.z);
S.controls.update();
for (let i = 0; i < 10; i++) await B.frame();
out.push(['foto-grade-frente-0824-D', S.renderer.domElement.toDataURL('image/png')]);

console.info = infoOrig;
return out;
