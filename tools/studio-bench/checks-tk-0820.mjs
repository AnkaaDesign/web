/* O THERMO KING: onde ele está, o cano acima dele e os rebites que flutuam.
   ===========================================================================
   *"o thermo king está afastado de onde deveria estar, além disso remova o cano
   acima dele, e os rebites acima do thermo king que estão flutuando"* e *"esse
   cano da direita do thermo king não está conectado nele"* — Kennedy,
   2026-08-20.

   Quatro peças e uma pose, e nenhuma delas se resolve fora do app: a unidade é
   um asset à parte (`thermoking_p360.glb`), pendurada por `placeThermoKing()`
   contra o VÃO da testeira, e os rebites são gerados por `addPlateRivets()` na
   chapa de livery — que só existe depois de `buildLiveryPanels()`.

       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-tk-0820.mjs > /tmp/tk.txt */

const out = [];
const B = window.__bench;

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
const r4 = (v) => +v.toFixed(4);
const mm = (v) => +(v * 1000).toFixed(1);
const nomeMat = (o) => (Array.isArray(o.material) ? o.material : [o.material])
  .map((m) => m?.name || '?').join('+');

/* O console da página — a bancada não o encaminha, e é onde `[tk]` fala. */
const CONSOLE = [];
for (const nivel of ['info', 'warn', 'error']) {
  const orig = console[nivel].bind(console);
  console[nivel] = (...a) => {
    const txt = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ');
    if (/\[tk\]|\[livery\]|\[montagem\]|\[marca\]|\[bake\]/.test(txt)) CONSOLE.push(`${nivel}: ${txt}`);
    orig(...a);
  };
}

const alvos = [];
for (const mk of (S.catalog.catalog?.manufacturers || [])) {
  for (const mo of (mk.models || [])) {
    for (const c of (mo.chassis || [])) {
      if (!c.file || c.available === false) continue;
      alvos.push({ mk, mo, c });
    }
  }
}
const vm = alvos.find((a) => /vm_2015_6x2r/i.test(a.c.file));
if (!vm) { out.push(['★', 'VM fora do catálogo']); out.push(['console', CONSOLE.join('\n      ')]);
return out; }
await S.applyChoice({
  envId: S.choice?.envId || 'estudio',
  manufacturerId: vm.mk.id, modelId: vm.mo.id, chassisId: vm.c.id,
  colorId: null, finishId: null, trim: null,
}, { curtain: false });
await B.until(() => (S.state.implement?.id || '').includes('sobrechassi'), 300000);
for (let i = 0; i < 24; i++) await B.frame();

const t = S.state.trailer;
t.updateWorldMatrix(true, true);
const p = S.state.trailerRig.profile;
/* O MUNDO DE CONSTRUÇÃO — o mesmo de `checks-referencial-0820.mjs`, e pela
   mesma razão: `profile` foi escrito antes de `placeTrailer()`. */
const base = S.state.trailerBase?.pos;
const M = new THREE.Matrix4()
  .makeTranslation(base ? base.x : 0, base ? base.y : 0, base ? base.z : 0)
  .multiply(new THREE.Matrix4().copy(t.matrixWorld).invert());
const v = new THREE.Vector3();
function caixa(o) {
  const at = o.geometry?.attributes?.position;
  if (!at) return null;
  const b = new THREE.Box3();
  const m = new THREE.Matrix4().multiplyMatrices(M, o.matrixWorld);
  for (let i = 0; i < at.count; i++) b.expandByPoint(v.fromBufferAttribute(at, i).applyMatrix4(m));
  return b;
}

out.push(['perfil', JSON.stringify({
  floorY: r4(p.floorY), roofY: r4(p.roofY), z1: r4(p.z1), topRailY: r4(p.topRailY ?? 0),
})]);

/* ---- 1. A UNIDADE: onde ela está contra a testeira ---- */
let tk = null;
t.traverse((o) => { if (o.name === 'THERMO_KING' || /thermo/i.test(o.name || '')) tk = tk || o; });
if (!tk) {
  for (const o of S.scene.children) { if (/thermo/i.test(o.name || '')) tk = o; }
}
out.push(['nó do TK', tk ? tk.name : '(não achado por nome)']);

/* ---- 2. TUDO o que existe ACIMA da linha do TK, na testeira ---- */
const acima = [];
const raiz = tk ? tk : t;
for (const alvoRaiz of [t, ...(tk && tk !== t ? [tk] : [])]) {
  alvoRaiz.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    for (let n = o; n; n = n.parent) if (n.visible === false) return;
    const b = caixa(o);
    if (!b) return;
    const cz = (b.min.z + b.max.z) / 2;
    if (cz < p.z1 - 0.30) return;
    if (b.max.y < p.roofY - 0.45) return;
    const d = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z];
    acima.push({
      no: o.name, mat: nomeMat(o), d: d.map(mm),
      x: r4((b.min.x + b.max.x) / 2), z: r4(cz),
      y: [mm(b.min.y - p.roofY), mm(b.max.y - p.roofY)],
      raiz: alvoRaiz === t ? 'implemento' : 'TK',
    });
  });
}
for (const a of acima.sort((x, y2) => y2.y[1] - x.y[1])) {
  out.push(['  acima do TK', `${a.raiz} · ${a.no.slice(0, 40)} · ${a.mat.slice(0, 28)}`
    + ` · d ${JSON.stringify(a.d)} · x ${a.x} z ${a.z} · do teto ${JSON.stringify(a.y)}`]);
}

/* ---- 2b. AS CHAPAS DE LIVERY, com a cota de cada uma ---- */
{
  const linhas = [];
  for (const nome of ['SIDE_L', 'SIDE_R', 'REAR', 'FRONT']) {
    const o = t.getObjectByName(nome);
    if (!o) { linhas.push(`${nome}: ausente`); continue; }
    const b = caixa(o);
    const at = o.geometry.attributes.position;
    linhas.push(`${nome}: ${(at.count / 3) | 0} tris · d `
      + `${mm(b.max.x - b.min.x)}×${mm(b.max.y - b.min.y)}×${mm(b.max.z - b.min.z)}`
      + ` · z ${r4((b.min.z + b.max.z) / 2)}`);
  }
  out.push(['chapas de livery', linhas.join(' | ')]);
}

/* ---- 2c. AS COMPONENTES do que sobra acima do teto ---- */
if (tk) {
  const linhas = [];
  tk.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const b = caixa(o);
    if (!b || b.max.y < p.roofY - 0.02) return;
    const geo = o.geometry;
    const pos = geo.attributes.position;
    const idx = geo.getIndex();
    if (!idx) { linhas.push(`${o.name}: sem índice`); return; }
    /* componentes conexas por vértice soldado */
    const chave = new Map(); const pai = new Int32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const k = `${Math.round(pos.getX(i) * 1e5)},${Math.round(pos.getY(i) * 1e5)},${Math.round(pos.getZ(i) * 1e5)}`;
      const j = chave.get(k);
      if (j === undefined) { chave.set(k, i); pai[i] = i; } else pai[i] = j;
    }
    const acha = (i) => { let r = i; while (pai[r] !== r) r = pai[r]; while (pai[i] !== r) { const n2 = pai[i]; pai[i] = r; i = n2; } return r; };
    const une = (x, y2) => { const rx = acha(x), ry = acha(y2); if (rx !== ry) pai[rx] = ry; };
    const nTri = idx.count / 3;
    for (let q = 0; q < nTri; q++) { une(idx.getX(q * 3), idx.getX(q * 3 + 1)); une(idx.getX(q * 3 + 1), idx.getX(q * 3 + 2)); }
    const g2 = new Map();
    for (let q = 0; q < nTri; q++) { const r = acha(idx.getX(q * 3)); const e = g2.get(r); if (e) e.push(q); else g2.set(r, [q]); }
    const m2 = new THREE.Matrix4().multiplyMatrices(M, o.matrixWorld);
    const comps = [...g2.values()].map((tris) => {
      const bb = new THREE.Box3(); const vv = new THREE.Vector3();
      for (const q of tris) for (let kk = 0; kk < 3; kk++) bb.expandByPoint(vv.fromBufferAttribute(pos, idx.getX(q * 3 + kk)).applyMatrix4(m2));
      return { tris: tris.length, topo: mm(bb.max.y - p.roofY), d: [mm(bb.max.x - bb.min.x), mm(bb.max.y - bb.min.y), mm(bb.max.z - bb.min.z)] };
    }).sort((x, y2) => y2.topo - x.topo);
    linhas.push(`${o.name} (${nTri} tris, ${comps.length} comp): `
      + comps.slice(0, 5).map((c) => `${c.tris}t topo${c.topo} d${JSON.stringify(c.d)}`).join(' , '));
  });
  out.push(['acima do teto, por componente', linhas.join(' || ') || '(nada)']);
}

/* ---- 2d. O QUE ENCOSTA NA ESCADA ---- */
{
  const linhas = [];
  const perto = [];
  t.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    for (let n = o; n; n = n.parent) if (n.visible === false) return;
    const b = caixa(o);
    if (!b) return;
    const cxx = (b.min.x + b.max.x) / 2, czz = (b.min.z + b.max.z) / 2;
    if (czz < p.z1 + 0.02 || czz > p.z1 + 0.25) return;   // no plano da escada
    if (cxx < 0.95 || cxx > 1.40) return;
    perto.push({ o, b });
  });
  for (const q of perto.sort((x, y2) => y2.b.max.y - x.b.max.y)) {
    const b = q.b;
    linhas.push(`${(q.o.name || '?').slice(0, 34)}·${nomeMat(q.o).slice(0, 26)}`
      + ` d${mm(b.max.x - b.min.x)}×${mm(b.max.y - b.min.y)}×${mm(b.max.z - b.min.z)}`
      + ` x${r4((b.min.x + b.max.x) / 2)} y${mm(b.min.y - p.floorY)}…${mm(b.max.y - p.floorY)}`);
  }
  out.push(['perto da escada', linhas.join(' | ') || '(nada)']);
}

/* ---- 3. OS REBITES que caem na frente do TK ---- */
{
  const linhas = [];
  t.traverse((o) => {
    if (!o.isMesh || !/rebite/i.test(nomeMat(o))) return;
    const b = caixa(o);
    if (!b) return;
    linhas.push(`${o.name || '(anon)'} · x ${r4((b.min.x + b.max.x) / 2)}`
      + ` · z ${r4(b.min.z)}…${r4(b.max.z)} · y ${r4(b.min.y)}…${r4(b.max.y)}`
      + ` · do teto ${mm(b.max.y - p.roofY)}`);
  });
  out.push(['rebites', linhas.join(' | ') || '(nenhum)']);
}
/* ---- 4. A PLACA DA ANKAA contra as CANTONEIRAS AO LADO ----
   *"a textura da placa Ankaa continua diferente do restante"* — Kennedy. Ela já
   herda a instância de material da vizinha, então se o brilho ainda difere a
   causa não é o material: é o que o material LÊ da malha. Aqui saem os dois
   lados da conta — o material e a malha. */
{
  const linhas = [];
  const placa = t.getObjectByName('PLACA_MARCA_ANKAA');
  const desc = (m) => !m ? '(nulo)' : [
    m.name, 'metal ' + (m.metalness ?? '?'), 'rough ' + (m.roughness ?? '?'),
    'envInt ' + (m.envMapIntensity ?? '?'),
    'envMap ' + (m.envMap ? 'sim' : 'não'),
    'cor ' + (m.color ? '#' + m.color.getHexString() : '?'),
    'flat ' + (m.flatShading ? 'sim' : 'não'),
    'map ' + (m.map ? 'sim' : 'não'),
    'nMap ' + (m.normalMap ? 'sim' : 'não'),
    'aniso ' + (m.anisotropy ?? '-'),
    'clear ' + (m.clearcoat ?? '-'),
  ].join(' · ');
  if (!placa) linhas.push('PLACA_MARCA_ANKAA ausente');
  else {
    const mp = Array.isArray(placa.material) ? placa.material[0] : placa.material;
    const g = placa.geometry;
    linhas.push('PLACA: ' + desc(mp));
    linhas.push('  malha: attrs ' + Object.keys(g.attributes).join(',')
      + ' · tris ' + ((g.getIndex() ? g.getIndex().count : g.attributes.position.count) / 3 | 0)
      + ' · escala ' + placa.scale.x.toFixed(3));
    /* As vizinhas: tudo que encosta na caixa da placa. */
    const bp = caixa(placa);
    /* ---- QUEM EMOLDURA A PLACA, POR TRIÂNGULO ----
       ⚠️ A caixa da malha não serve, e a primeira volta usou caixa: depois da
       fusão, `FUSAO__inox-ferragem__polido` é UMA malha com todo o inox do
       implemento, de ponta a ponta. A caixa dela contém a placa, então a
       distância dá 0 mm e a resposta "a vizinha mais próxima" é qualquer
       coisa. O que responde é o TRIÂNGULO mais perto — e, numa malha de
       material em array, o GRUPO a que ele pertence. */
    {
      const alvo = bp.getCenter(new THREE.Vector3());
      const meia = bp.getSize(new THREE.Vector3()).multiplyScalar(0.5);
      const cand = [];
      t.traverse((o) => {
        if (!o.isMesh || o === placa || !o.geometry?.attributes?.position) return;
        const at = o.geometry.attributes.position;
        const idx = o.geometry.getIndex();
        const m = new THREE.Matrix4().multiplyMatrices(M, o.matrixWorld);
        const v2 = new THREE.Vector3();
        const n = idx ? idx.count : at.count;
        let melhor = Infinity, iMelhor = -1;
        const passo = Math.max(1, Math.floor(n / 24000));
        for (let i = 0; i < n; i += passo) {
          const vi = idx ? idx.getX(i) : i;
          v2.fromBufferAttribute(at, vi).applyMatrix4(m);
          /* Distância só em X e Y: a placa e a moldura estão no MESMO plano de
             z, e incluir z faria a peça de trás ganhar da peça de lado. */
          const dx = Math.max(0, Math.abs(v2.x - alvo.x) - meia.x);
          const dy = Math.max(0, Math.abs(v2.y - alvo.y) - meia.y);
          const dz = Math.abs(v2.z - alvo.z);
          if (dz > 0.12) continue;
          const d = Math.hypot(dx, dy);
          if (d < melhor) { melhor = d; iMelhor = i; }
        }
        if (iMelhor < 0 || melhor > 0.25) return;
        let grupo = null;
        if (Array.isArray(o.material) && o.geometry.groups?.length) {
          for (const g of o.geometry.groups) {
            if (iMelhor >= g.start && iMelhor < g.start + g.count) { grupo = g.materialIndex; break; }
          }
        }
        const mm2 = Array.isArray(o.material)
          ? o.material[grupo ?? 0] : o.material;
        cand.push({ nome: o.name || '?', d: melhor, m: mm2 });
      });
      cand.sort((a, b) => a.d - b.d);
      linhas.push('  ── quem emoldura, por TRIÂNGULO ──');
      for (const c of cand.slice(0, 6)) {
        linhas.push(`  ${(c.d * 1000).toFixed(0)}mm ${c.nome.slice(0, 30)}`
          + ` [${c.m === mp ? 'MESMA INSTÂNCIA' : 'outra'}] ` + desc(c.m));
      }
    }
    const perto = [];
    t.traverse((o) => {
      if (!o.isMesh || o === placa || !o.geometry?.attributes?.position) return;
      const b = caixa(o);
      if (!b) return;
      const d = b.distanceToPoint(bp.getCenter(new THREE.Vector3()));
      if (d < 0.5) perto.push({ o, d });
    });
    perto.sort((a, b) => a.d - b.d);
    for (const q of perto.slice(0, 5)) {
      const m = Array.isArray(q.o.material) ? q.o.material[0] : q.o.material;
      linhas.push(`  vizinha ${(q.d * 1000).toFixed(0)}mm ${(q.o.name || '?').slice(0, 26)}`
        + ` [${m === mp ? 'MESMA INSTÂNCIA' : 'outra'}] ` + desc(m));
    }
  }
  out.push(['placa Ankaa', linhas.join('\n      ')]);
}
out.push(['console', CONSOLE.join('\n      ')]);
return out;
