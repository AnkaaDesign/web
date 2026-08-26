/* DIAGNÓSTICO 2 — QUEM OCUPA O CORREDOR ENTRE O ARLA E O 2º DIRECIONAL.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks diag/checks-diag-grade-frente2-0824.mjs

   O diagnóstico 1 fixou os números do Scania 8x2 (z do IMPLEMENTO):

       baú            -4259 … 4252
       corrido        -4080…-3347  ·  -350…1813
       baia 2º direc.  3107 ± 682   →  2425 … 3789
       ARLA            2024 … 2324  ·  |x| até 1095 (recuado, cabe)
       obstáculo       2032 … 3732  ← É ESTE que empurra a ponta para 1932

   A pergunta que falta: entre 2032 e 2425 — os 393 mm que o obstáculo tem
   ALÉM da baia — o que existe no corredor da grade? Se for só o arco do
   para-lama, a baia já cuida dele e a amputação está cobrando duas vezes.

   Reproduz `truckObstacles()` VÉRTICE A VÉRTICE, no espaço normalizado do
   caminhão e com a mesma célula de 100 mm, guardando o DONO de cada célula —
   que é o que a função original joga fora. */
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

const acha = (modelo, chassi) => {
  for (const mk of (S.catalog.catalog?.manufacturers || [])) {
    for (const mo of (mk.models || [])) {
      if (mo.id !== modelo) continue;
      for (const c of (mo.chassis || [])) if (c.id === chassi) return { mk, mo, c };
    }
  }
  return null;
};
const a = acha('scania-p', '8x2r');
await S.applyChoice({
  envId: S.choice?.envId || 'estudio',
  manufacturerId: a.mk.id, modelId: a.mo.id, chassisId: a.c.id,
  colorId: null, finishId: null, trim: null,
}, { curtain: false });
await B.until(() => (S.state.cabDef?.file || '') === a.c.file, 300000);
await B.until(() => !!S.state.trailer, 300000);
for (let i = 0; i < 40; i++) await B.frame();

const cab = S.state.cab, t = S.state.trailer, mount = S.state.cabMount;
cab.updateWorldMatrix(true, true); t.updateWorldMatrix(true, true);

/* O espaço NORMALIZADO do caminhão, como o motor o monta. */
const cabInv = new THREE.Matrix4().copy(cab.matrixWorld).invert();
const N = new THREE.Matrix4().makeRotationY(mount.orientYaw)
  .multiply(new THREE.Matrix4().makeTranslation(-mount.centerX, -mount.groundY, 0));
const W2N = N.clone().multiply(cabInv);
/* …e a raiz do implemento DENTRO dele: é o `zRaiz` de `models.ts`. */
const raizN = t.getWorldPosition(new THREE.Vector3()).applyMatrix4(W2N);
const zRaiz = raizN.z;
const paraImpl = (zn) => zn - zRaiz;
const eixos = [...mount.axles.steerZ, ...mount.axles.driveZ, ...mount.axles.liftZ];
out.push(['0 · zRaiz e eixos em z do implemento',
  `zRaiz ${mm(zRaiz)} · eixos ${eixos.map((z) => mm(paraImpl(z))).join(' · ')}`
  + ' (o relato do motor diz 5322 · 3107 · -1252 · -2608)']);

/* A face da grade, medida na peça montada. */
let faceX = 0;
const v = new THREE.Vector3();
t.traverse((o) => {
  if (!o.isMesh || !/^BARRA__/.test(o.name || '') || !o.geometry?.attributes?.position) return;
  const pos = o.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(o.matrixWorld);
    faceX = Math.max(faceX, Math.abs(v.x));
  }
});
const corte = faceX - 0.155;
out.push(['0 · face da grade (medida) e corte de obstáculo', `${mm(faceX)} · ${mm(corte)}`]);

/* A VARREDURA, igual à do motor: faixa do SUPORTE, por vértice, célula de
   100 mm, |x| ≥ face − 155. Guarda dono, |x| e se a célula é só ARCO. */
const ARCO_RE = /paralama|lameiro|TS_PARALAMA/i;
function varre(y0, y1) {
  const cel = new Map();
  const L2N = new THREE.Matrix4();
  cab.traverse((node) => {
    const m = node;
    if (!m.isMesh || !m.geometry?.attributes?.position || !m.visible) return;
    let arco = false;
    for (let p = m; p && p !== cab.parent; p = p.parent) {
      if (ARCO_RE.test(p.name || '')) { arco = true; break; }
    }
    L2N.copy(N).multiply(cabInv).multiply(m.matrixWorld);
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N);
      if (v.y < y0 - 0.03 || v.y > y1 + 0.03) continue;
      const ax = Math.abs(v.x);
      if (ax < corte) continue;
      const k = Math.round(v.z / 0.10);
      let u = cel.get(k);
      if (!u) { u = { x: 0, nome: '', arco: true, lado: '' }; cel.set(k, u); }
      u.arco = u.arco && arco;
      if (ax > u.x) { u.x = ax; u.nome = m.name || '(sem nome)'; u.lado = v.x >= 0 ? 'D' : 'E'; }
    }
  });
  return cel;
}

for (const [y0, y1, rot] of [[0.840, 1.090, 'SUPORTE — a lista que AMPUTA'],
  [0.500, 1.100, 'ESTAÇÃO — a lista do recuo de ponta']]) {
  const cel = varre(y0, y1);
  const ks = [...cel.keys()].sort((p, q) => p - q);
  const linhas = ks.map((k) => {
    const u = cel.get(k);
    return `zImpl ${mm(paraImpl(k * 0.10))}: |x| ${mm(u.x)} · ${u.lado} · ${u.nome}${u.arco ? ' · ARCO' : ''}`;
  });
  /* A janela que interessa: da ponta do corrido (1813) até depois da baia. */
  const janela = ks.filter((k) => {
    const z = paraImpl(k * 0.10);
    return z > 1.40 && z < 4.20;
  }).map((k) => {
    const u = cel.get(k);
    return `zImpl ${mm(paraImpl(k * 0.10))}: |x| ${mm(u.x)} · ${u.lado} · ${u.nome}${u.arco ? ' · ARCO' : ''}`;
  });
  out.push([`1 · ${rot} — janela 1400…4200 do implemento`,
    janela.length ? '\n        ' + janela.join('\n        ') : 'VAZIA — nada no corredor']);
  out.push([`1 · ${rot} — todas as células`, '\n        ' + linhas.join('\n        ')]);
}

/* 2 · O QUE HÁ NA JANELA, por NÓ, sem o filtro de |x| — para ver de quanto
      cada peça está do plano da grade (a que falta pouco é candidata a recuo,
      como o ARLA foi). */
const donos = new Map();
{
  const L2N = new THREE.Matrix4();
  cab.traverse((node) => {
    const m = node;
    if (!m.isMesh || !m.geometry?.attributes?.position || !m.visible) return;
    L2N.copy(N).multiply(cabInv).multiply(m.matrixWorld);
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(L2N);
      const z = v.z - zRaiz;
      if (z < 1.40 || z > 4.20) continue;
      if (v.y < 0.40 || v.y > 1.15) continue;
      const ax = Math.abs(v.x);
      if (ax < 0.95) continue;
      let s = donos.get(m.name || '?');
      if (!s) { s = { x: 0, z0: Infinity, z1: -Infinity, y0: Infinity, y1: -Infinity, n: 0 }; donos.set(m.name || '?', s); }
      s.n++; s.x = Math.max(s.x, ax);
      s.z0 = Math.min(s.z0, z); s.z1 = Math.max(s.z1, z);
      s.y0 = Math.min(s.y0, v.y); s.y1 = Math.max(s.y1, v.y);
    }
  });
}
out.push(['2 · nós no corredor largo (|x| ≥ 950, y 400…1150, zImpl 1400…4200)', '\n        '
  + [...donos].sort((p, q) => q[1].x - p[1].x).slice(0, 25)
    .map(([n, s]) => `${n}: |x| até ${mm(s.x)} · zImpl ${mm(s.z0)}…${mm(s.z1)} · y ${mm(s.y0)}…${mm(s.y1)} · ${s.n} pts`).join('\n        ')]);

return out;
