/* O SCANIA P COM SOBRECHASSI, MEDIDO E FOTOGRAFADO — 2026-08-22.
   ===========================================================================
   Onze queixas numa foto só (Kennedy, 2026-08-22). Esta bancada existe para
   separar as que são MEDIDA das que são JUÍZO, e para dar um número a cada uma
   antes de qualquer conserto:

     A_rebites    a coluna de rebites de emenda POR FLANCO — contagem, emendas
                  vivas, emendas mortas (porta) e a caixa de cada conjunto.
                  *"os rebites aqui não estão corretos, enquanto do outro lado
                  estão"* — e as duas fotos são dos DOIS flancos do mesmo baú.
     B_grade      os trechos da proteção lateral, com as estações que cada um
                  ficou tendo. *"a grade está muito longa, o suporte dela fica
                  flutuando"*.
     C_fita       toda instância de fita retrorrefletiva da saia: passo, casas
                  ocupadas e os VÃOS entre unidades consecutivas. *"as faixas
                  refletivas não possuem um espaçamento perfeito entre si"*.
     D_placa      a placa traseira (a nossa e a de fábrica) e a aba do
                  para-barro, com o |x| final contra a face interna da grade.
     E_preto      o censo de material EXTREMAMENTE PRETO da cabine, por área e
                  por albedo linear. *"algumas partes do scania estão
                  extremamente pretas"*.
     F_teto       o que existe acima do teto do baú (o quadro que aparece na
                  vista de cima) e se ele tem `uv1` — ou seja, se ele entra no
                  livery do teto. *"a visão superior possui um frame metálico,
                  mas não aparece no livery do teto"*.
     G_trilho     o trilho de topo: rebaixos fechados, normais e se existe
                  rebite GERADO nele.
     H_tk         o Thermo King e o que sai dele para baixo.

   ⚠️ RODE COM GEOMETRIA E COM PLACA:
       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-scania-0822.mjs
   Sem `--geometry` não há caminhão nem baú e tudo sai em travessão. */

const out = [];
const B = window.__bench;

const mm = (v) => (v === null || v === undefined || !isFinite(v) ? '—' : `${(v * 1000).toFixed(0)}`);
const cx = (b) => (b ? `${mm(b.min.x)}…${mm(b.max.x)} · ${mm(b.min.y)}…${mm(b.max.y)}`
  + ` · ${mm(b.min.z)}…${mm(b.max.z)}` : '—');

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 40000);
await B.settleSelector();
await B.until(() => !!window.__studio, 60000);
const S = window.__studio;
await B.until(() => !!S?.state?.trailer, 300000);
for (let i = 0; i < 16; i++) await B.frame();

const THREE = S.THREE;
const { scene, camera, controls, renderer } = S;

/* ---------------------------------------------------------------- a troca */
const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    for (const c of (mo.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, mo, c });
    }
  }
}
const alvoArg = (window.__benchArgv || []).includes('--chassi')
  ? window.__benchArgv[window.__benchArgv.indexOf('--chassi') + 1] : 'scania_p_6x2r';
const p = alvos.find((a) => a.c.file.includes(alvoArg));
if (!p) { out.push(['★ alvo no catálogo', `NÃO — ${alvoArg}`]); return out; }
await S.applyChoice({
  envId: S.choice?.envId || 'estudio',
  manufacturerId: p.mk.id, modelId: p.mo.id, chassisId: p.c.id,
  colorId: null, finishId: null, trim: null,
}, { curtain: false });
await B.until(() => (S.state.cabDef?.file || '') === p.c.file, 300000);
await B.until(() => !!S.state.trailer, 300000);
await B.until(() => (S.state.implement?.id || '').includes('sobrechassi'), 300000);
for (let i = 0; i < 30; i++) await B.frame();

out.push(['—— ALVO ——', `${p.c.file} · implemento ${S.state.implement?.id}`]);

const t = S.state.trailer;
const cab = S.state.cab;
t.updateWorldMatrix(true, true);
cab?.updateWorldMatrix(true, true);

/* Espaço LOCAL da raiz do implemento — é nele que a geometria do baú nasce. */
const toLocal = new THREE.Matrix4().copy(t.matrixWorld).invert();
function caixaLocal(o) {
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  o.updateWorldMatrix(true, true);
  o.traverse((n) => {
    if (!n.isMesh || !n.geometry?.attributes?.position) return;
    const a = n.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      v.fromBufferAttribute(a, i).applyMatrix4(n.matrixWorld).applyMatrix4(toLocal);
      b.expandByPoint(v);
    }
  });
  return b.isEmpty() ? null : b;
}

/* ================================================== A — REBITES POR FLANCO */
const grade = S.models.getPlateGrid ? S.models.getPlateGrid() : null;
out.push(['A · grade de chapas', grade
  ? `passo ${mm(grade.pitch)} · ${grade.seamsFromFront.length} emendas a `
    + grade.seamsFromFront.map((v) => mm(v)).join('/')
    + ` · ${grade.rivetRowsFromBottom.length} fileiras`
  : '(sem grade publicada)']);

for (const lado of ['SIDE_L', 'SIDE_R']) {
  const painel = t.getObjectByName(lado);
  const riv = t.getObjectByName(lado + '_RIVETS');
  const nRiv = riv?.userData?.rivets ?? 0;
  const bp = painel ? caixaLocal(painel) : null;
  const br = riv ? caixaLocal(riv) : null;
  out.push([`A · ${lado} painel`, painel
    ? `${(painel.geometry.getIndex()?.count ?? painel.geometry.attributes.position.count) / 3} tris · ${cx(bp)}`
    : 'AUSENTE']);
  out.push([`A · ${lado} rebites`, riv
    ? `${nRiv} calotas · caixa ${cx(br)}` : 'AUSENTE']);
  /* Quantas COLUNAS distintas em z: cada emenda viva é uma. */
  if (riv) {
    const zs = new Set();
    const a = riv.geometry.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < a.count; i += 7) {
      v.fromBufferAttribute(a, i).applyMatrix4(riv.matrixWorld).applyMatrix4(toLocal);
      zs.add(Math.round(v.z * 50));           // caixas de 20 mm
    }
    const col = [...zs].map((k) => k / 50).sort((x, y) => x - y);
    const grupos = [];
    for (const z of col) {
      const u = grupos[grupos.length - 1];
      if (u && z - u[u.length - 1] < 0.05) u.push(z); else grupos.push([z]);
    }
    out.push([`A · ${lado} colunas`, `${grupos.length} · z `
      + grupos.map((g) => mm((g[0] + g[g.length - 1]) / 2)).join(' / ')]);
  }
  const buracos = S.state.trailerRig?.body?.getDoorHoles(lado === 'SIDE_R' ? 'right' : 'left') ?? [];
  out.push([`A · ${lado} vãos de porta`, buracos.length
    ? buracos.map((h) => `${mm(h.z0)}…${mm(h.z1)}`).join(' · ') : 'nenhum']);
}

/* ================================================= B — A PROTEÇÃO LATERAL */
const guarda = t.getObjectByName('TS_PROTECAO_LATERAL');
if (!guarda) out.push(['B · proteção lateral', 'AUSENTE']);
else {
  const filhos = guarda.children;
  out.push(['B · trechos×lados', String(filhos.length)]);
  for (const g of filhos) {
    const barras = [], est = [], pontas = [];
    for (const c of g.children) {
      if (c.isInstancedMesh) est.push(c);
      else if (/^BARRA__/.test(c.name)) barras.push(c);
      else if (/^PONTA__/.test(c.name)) pontas.push(c);
    }
    const b = caixaLocal(g);
    out.push([`B · ${g.name}`, `barras ${barras.length} · estações `
      + `${est.length ? est[0].count : 0} · pontas ${pontas.length} · ${cx(b)}`]);
    if (est.length) {
      const m = new THREE.Matrix4();
      const zs = [];
      for (let i = 0; i < est[0].count; i++) {
        est[0].getMatrixAt(i, m);
        zs.push(g.position.z + m.elements[14]);
      }
      out.push([`B · ${g.name} estações z`, zs.map((z) => mm(z)).join(' / ') || '(nenhuma)']);
    }
  }
}

/* ======================================================== C — A FITA 3M */
const fitas = [];
t.traverse((o) => { if (o.isInstancedMesh && /^REPEAT_skirt/.test(o.name || '')) fitas.push(o); });
out.push(['C · conjuntos de saia', String(fitas.length)]);
for (const f of fitas) {
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const zs = [];
  for (let i = 0; i < f.count; i++) {
    f.getMatrixAt(i, m);
    v.setFromMatrixPosition(m);
    zs.push(v.z);
  }
  zs.sort((a, b) => a - b);
  const vaos = [];
  for (let i = 1; i < zs.length; i++) vaos.push(zs[i] - zs[i - 1]);
  const mat = Array.isArray(f.material) ? f.material[0] : f.material;
  const bb = f.geometry.boundingBox || (f.geometry.computeBoundingBox(), f.geometry.boundingBox);
  out.push([`C · ${f.name} [${mat?.name || '?'}]`,
    `${f.count} unidades · unidade ${mm(bb.max.z - bb.min.z)}×${mm(bb.max.y - bb.min.y)} mm`
    + ` · z ${mm(zs[0])}…${mm(zs[zs.length - 1])}`]);
  out.push([`C · ${f.name} vãos`, vaos.map((g) => mm(g)).join(' ')]);
}

/* ===================================================== D — PLACA E ABA */
const placas = [];
scene.traverse((o) => { if (/placa|plate/i.test(o.name || '') && o.isMesh) placas.push(o); });
out.push(['D · nós de placa na cena', placas.map((o) => `${o.name}${o.visible ? '' : '(oculto)'}`).join(' · ') || 'nenhum']);
const pecas = cab?.getObjectByName('TS_CHASSI_PECAS');
out.push(['D · TS_CHASSI_PECAS', pecas ? `${pecas.children.length} filho(s)` : 'AUSENTE']);
if (cab) {
  const abas = [];
  cab.traverse((o) => { if (o.isMesh && /lameiro/i.test(o.name || '')) abas.push(o); });
  for (const a of abas) {
    const b = new THREE.Box3().setFromObject(a);
    const bl = caixaLocal(a);
    out.push([`D · aba ${a.name}`, `mundo ${cx(b)} · local do baú ${cx(bl)}`]);
  }
}
if (guarda) {
  const gx = S.models.guardInnerX ? '(não exposto)' : '(não exposto)';
  out.push(['D · face interna da grade', gx]);
}

/* ==================================================== E — O PRETO DA CABINE */
if (cab) {
  const porMat = new Map();
  cab.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const a = o.geometry.attributes.position;
    const idx = o.geometry.getIndex();
    const n = idx ? idx.count : a.count;
    const A = new THREE.Vector3(), Bv = new THREE.Vector3(), C = new THREE.Vector3();
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    let area = 0;
    for (let i = 0; i < n; i += 3) {
      const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
      A.fromBufferAttribute(a, i0).applyMatrix4(o.matrixWorld);
      Bv.fromBufferAttribute(a, i1).applyMatrix4(o.matrixWorld);
      C.fromBufferAttribute(a, i2).applyMatrix4(o.matrixWorld);
      e1.subVectors(Bv, A); e2.subVectors(C, A);
      area += 0.5 * e1.cross(e2).length();
    }
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m) continue;
      const k = m.name || '(sem nome)';
      const e = porMat.get(k) || { area: 0, m, vis: o.visible };
      e.area += area; e.vis = e.vis || o.visible;
      porMat.set(k, e);
    }
  });
  const linhas = [...porMat.entries()]
    .map(([nome, e]) => ({
      nome, area: e.area, vis: e.vis,
      lum: e.m.color ? 0.2126 * e.m.color.r + 0.7152 * e.m.color.g + 0.0722 * e.m.color.b : 1,
      met: e.m.metalness ?? 0, rou: e.m.roughness ?? 1,
      tex: e.m.map ? 'T' : '-', tr: e.m.transparent ? 'α' : '-',
    }))
    .filter((r) => r.lum < 0.025 && r.area > 0.2 && r.vis)
    .sort((a, b) => b.area - a.area);
  out.push(['E · materiais < 0,025 linear (visíveis, > 0,2 m²)', String(linhas.length)]);
  for (const r of linhas) {
    out.push([`E · ${r.nome}`, `${r.area.toFixed(2)} m² · lum ${r.lum.toFixed(4)}`
      + ` · metal ${r.met.toFixed(2)} · rough ${r.rou.toFixed(3)} · ${r.tex}${r.tr}`]);
  }
}

/* ========================================================= F — O TETO */
const teto = t.getObjectByName('TRAILER_ROOF');
const bTeto = teto ? caixaLocal(teto) : null;
out.push(['F · TRAILER_ROOF', teto
  ? `${cx(bTeto)} · uv1 ${teto.geometry.getAttribute('uv1') ? 'sim' : 'NÃO'}` : 'AUSENTE']);
if (bTeto) {
  const acima = [];
  t.traverse((o) => {
    if (!o.isMesh || o === teto || !o.visible || !o.geometry?.attributes?.position) return;
    const b = caixaLocal(o);
    if (!b) return;
    if (b.max.y > bTeto.max.y - 0.02 && b.min.y > bTeto.min.y - 0.10) {
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      acima.push(`${o.name || '(anon)'}[${mat?.name || '?'}] y ${mm(b.min.y)}…${mm(b.max.y)}`
        + ` x ${mm(b.min.x)}…${mm(b.max.x)} uv1:${o.geometry.getAttribute('uv1') ? 'S' : 'N'}`);
    }
  });
  out.push(['F · acima/no plano do teto', String(acima.length)]);
  for (const a of acima.slice(0, 24)) out.push(['F ·', a]);
}

/* ====================================================== G — TRILHO DE TOPO */
const perfil = S.state.trailerRig?.profile;
out.push(['G · perfil', perfil
  ? `piso ${mm(perfil.floorY)} · teto ${mm(perfil.roofY)} · passo ${mm(perfil.pitch)}`
    + ` · frisos ${perfil.ribCount} · saia ${mm(perfil.skirtHeight)}`
    + ` · topRailY ${perfil.topRailY === null ? '—' : mm(perfil.topRailY)}` : '—']);

/* ============================================================ H — O TK */
let tk = null;
t.traverse((o) => { if (!tk && /thermo/i.test(o.name || '')) tk = o; });
const bTk = tk ? caixaLocal(tk) : null;
out.push(['H · Thermo King', tk ? `${tk.name} · ${cx(bTk)}` : 'AUSENTE']);

/* ============================================================== AS FOTOS */
const raw = renderer.domElement;
const bMundo = new THREE.Box3().setFromObject(t);
const alvo0 = bMundo.getCenter(new THREE.Vector3());
function tira(nome, dist, azDeg, elevDeg, desloca) {
  const a = THREE.MathUtils.degToRad(azDeg), e = THREE.MathUtils.degToRad(elevDeg);
  const al = alvo0.clone();
  if (desloca) al.add(desloca);
  controls.target.copy(al);
  camera.position.set(
    al.x + Math.sin(a) * Math.cos(e) * dist,
    al.y + Math.sin(e) * dist,
    al.z + Math.cos(a) * Math.cos(e) * dist,
  );
  camera.lookAt(al);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  controls.update();
  renderer.render(scene, camera);
  out.push([nome, raw.toDataURL('image/png')]);
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
tira('sc-perfil-motorista', 14, 90, 4, null);
tira('sc-perfil-passageiro', 14, -90, 4, null);
tira('sc-flanco-motorista-perto', 6.5, 90, 2, V(0, -0.4, 0));
tira('sc-flanco-passageiro-perto', 6.5, -90, 2, V(0, -0.4, 0));
tira('sc-traseira', 6.5, 180, 2, V(0, -1.0, 0));
tira('sc-traseira-baixa', 5.5, 180, -6, V(0, -1.2, 0));
tira('sc-frente-3-4', 9, 35, 18, null);
tira('sc-grade-lateral', 7.5, 78, -8, V(0, -1.3, 0));
tira('sc-topo', 12, 0, 88, null);
tira('sc-tk', 5, 30, 26, V(0, 1.0, 3.0));

return out;
