/* A FASE DO FRISO, O REBITE E A SAIA — só o semirreboque, sem trocar chassi.
   ===========================================================================
   Duas perguntas que sobraram da rodada de 2026-08-19, e as duas são de
   MEDIDA, não de opinião:

   1. **"o rebite não está na posição correta"** (foto do flanco, de perto).
      A análise de pixel da foto do dono põe a cabeça do rebite no meio do
      FRISO, não no meio da parte lisa — cerca de 20 mm abaixo de onde ela
      deveria estar. Aqui a régua sai da própria malha: o perfil do painel é
      amostrado por altura e o centro de cada faixa lisa é medido, contra o
      `y` real de cada fileira de rebite.

   2. **"esses caninhos na parte de baixo do frame metálico"** (foto do flanco,
      de longe). Uma varredura de raios na faixa entre o trilho de piso e o
      chassi diz que peça é aquela — a janela para ABAIXO do piso do baú de
      propósito, senão cada célula testaria os 170 mil triângulos de `SIDE_L`.

       node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-friso-0819.mjs > /tmp/friso-0819.txt */

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
for (let i = 0; i < 20; i++) await B.frame();
const THREE = S.THREE;
const r4 = (v) => +v.toFixed(4);

out.push(['implemento', S.state.implement?.id || '-']);

/* ---------------------------------------------------------------- perfil */
const rig = S.state.trailerRig;
if (!rig) out.push(['★', 'sem baú paramétrico']);
else {
  const p = rig.profile;
  out.push(['perfil', JSON.stringify({
    floorY: r4(p.floorY), roofY: r4(p.roofY), skirtHeight: r4(p.skirtHeight),
    capHeight: r4(p.capHeight), ribCount: p.ribCount, pitch: r4(p.pitch),
    topRailY: p.topRailY === null ? null : r4(p.topRailY),
  })]);
  const vi = rig.body.valeInfo;
  out.push(['valeInfo', vi ? JSON.stringify({ row0: r4(vi.row0), pitch: r4(vi.pitch), valeH: r4(vi.valeH) }) : '-']);
  out.push(['row0 de measureValeRows', r4(p.floorY + p.skirtHeight)]);
}

const t = S.state.trailer;
const vis = (o) => { for (let n = o; n; n = n.parent) if (n.visible === false) return false; return true; };

/** O painel de livery de um flanco, no espaço do implemento. */
function painel(nome) {
  let hit = null;
  t.traverse((o) => { if (o.isMesh && o.name === nome) hit = o; });
  return hit;
}

/**
 * O PERFIL DA CHAPA POR ALTURA — o x mais externo em faixas de 1 mm.
 * É a mesma amostragem de `measureValeRows()`, só que aqui ela é RELATADA em
 * vez de consumida: onde a superfície fica no plano recuado é faixa LISA, onde
 * ela avança é friso. O centro medido de cada lisa é a resposta da pergunta 1.
 */
function perfilDoPainel(mesh, sgnOut, y0, y1) {
  t.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(t.matrixWorld).invert();
  const m = new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld);
  const pos = mesh.geometry.attributes.position;
  const nor = mesh.geometry.attributes.normal;
  const v = new THREE.Vector3();
  const BIN = 0.001;
  const outer = new Map();
  for (let i = 0; i < pos.count; i++) {
    if (nor && Math.abs(nor.getX(i)) < 0.7) continue;
    v.fromBufferAttribute(pos, i).applyMatrix4(m);
    if (v.y < y0 || v.y > y1) continue;
    const b = Math.round(v.y / BIN);
    const d = sgnOut * v.x;
    if (!(d <= (outer.get(b) ?? -Infinity))) outer.set(b, d);
  }
  const bins = [...outer.entries()].sort((a, b) => a[0] - b[0]);
  if (!bins.length) return null;
  const crest = Math.max(...bins.map((e) => e[1]));
  /* Lisa = recuada mais de 2,5 mm da crista, a mesma régua de measureValeRows. */
  const lisa = bins.map(([b, d]) => [b * BIN, crest - d > 0.0025]);
  const faixas = [];
  let ini = null;
  for (const [y, e] of lisa) {
    if (e && ini === null) ini = y;
    if (!e && ini !== null) { faixas.push([ini, y]); ini = null; }
  }
  if (ini !== null) faixas.push([ini, lisa[lisa.length - 1][0]]);
  return { crest: r4(crest), faixas: faixas.filter((f) => f[1] - f[0] > 0.010) };
}

for (const [nome, sgn] of [['SIDE_R', 1], ['SIDE_L', -1]]) {
  const mesh = painel(nome);
  if (!mesh) { out.push([nome, 'não existe']); continue; }
  const p = rig.profile;
  const y0 = p.floorY + 0.30, y1 = p.floorY + 0.60;   // três passos, longe das pontas
  const r = perfilDoPainel(mesh, sgn, y0, y1);
  out.push([nome + ' faixas lisas (y0..y1)', r ? JSON.stringify({
    crest: r.crest,
    faixas: r.faixas.map((f) => [r4(f[0]), r4(f[1]), r4((f[0] + f[1]) / 2)]),
  }) : 'sem amostra']);
  /* E o resto da régua: onde `measureValeRows()` teria posto a fileira. */
  const row0 = p.floorY + p.skirtHeight;
  const previstos = [];
  for (let n = -1; n < 40; n++) {
    const y = row0 + 0.0467 + n * p.pitch;
    if (y > y1) break;
    if (y >= y0) previstos.push(r4(y));
  }
  out.push([nome + ' previsto por RIB_FLAT_CENTER', JSON.stringify(previstos)]);
  /* E onde os rebites REALMENTE estão. */
  let riv = null;
  mesh.traverse((o) => { if (o.isMesh && /_RIVETS$/.test(o.name)) riv = o; });
  if (riv) {
    const g = riv.geometry.attributes.position;
    const ys = new Set();
    for (let i = 0; i < g.count; i++) {
      const y = g.getY(i);
      if (y >= y0 - 0.02 && y <= y1 + 0.02) ys.add(Math.round(y * 1000) / 1000);
    }
    const lista = [...ys].sort((a, b) => a - b);
    /* Cada calota tem 12×6 vértices; o centro é a média de cada aglomerado. */
    const centros = [];
    let atual = [lista[0]];
    for (let i = 1; i < lista.length; i++) {
      if (lista[i] - lista[i - 1] < 0.010) atual.push(lista[i]);
      else { centros.push(atual); atual = [lista[i]]; }
    }
    centros.push(atual);
    out.push([nome + ' rebites (y do apex por fileira)', JSON.stringify(
      centros.filter((c) => c.length).map((c) => r4((c[0] + c[c.length - 1]) / 2)))]);
  } else out.push([nome + ' rebites', 'malha _RIVETS não achada']);
}

/* ------------------------------------------------------- os "caninhos" */
function catalogar(root) {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const v = new THREE.Vector3();
  const lista = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const p = o.geometry.attributes.position;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const b = new THREE.Box3();
    for (let i = 0; i < p.count; i++) b.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(m));
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    lista.push({
      o, b, nome: o.name || '(sem nome)',
      mat: mats.map((x) => x?.name || '?').join('+'),
      fusao: /^FUSAO__/.test(o.name || ''), vis: vis(o),
      tris: Math.round((o.geometry.index ? o.geometry.index.count : p.count) / 3),
    });
  });
  return lista;
}

function varrer(root, lista, cfg) {
  const { h0, h1, v0, v1, cols, rows, origem, maxTris = 40000 } = cfg;
  root.updateWorldMatrix(true, true);
  const toWorld = root.matrixWorld;
  const dirW = new THREE.Vector3(-1, 0, 0).transformDirection(toWorld).normalize();
  const cand = lista.filter((c) => {
    if (c.fusao) return false;
    if (c.tris > maxTris) return false;
    return !(c.b.max.y < v0 - 0.02 || c.b.min.y > v1 + 0.02
      || c.b.max.z < h0 - 0.02 || c.b.min.z > h1 + 0.02);
  });
  const objs = cand.map((c) => c.o);
  const porObj = new Map(cand.map((c) => [c.o, c]));
  const rc = new THREE.Raycaster();
  rc.far = 60;
  const o3 = new THREE.Vector3();
  const chaves = [];
  const conta = new Map();
  for (let r = 0; r < rows; r++) {
    const y = v1 - (v1 - v0) * (r + 0.5) / rows;
    const linha = [];
    for (let c = 0; c < cols; c++) {
      const h = h0 + (h1 - h0) * (c + 0.5) / cols;
      o3.set(origem, y, h);
      rc.set(o3.clone().applyMatrix4(toWorld), dirW);
      const hits = rc.intersectObjects(objs, false);
      if (!hits.length) { linha.push(null); continue; }
      const c0 = porObj.get(hits[0].object);
      const chave = c0.nome.slice(0, 30) + ' [' + c0.mat + ']';
      let e = conta.get(chave);
      if (!e) { e = { n: 0, hMin: Infinity, hMax: -Infinity, vMin: Infinity, vMax: -Infinity }; conta.set(chave, e); }
      e.n++;
      if (h < e.hMin) e.hMin = h;
      if (h > e.hMax) e.hMax = h;
      if (y < e.vMin) e.vMin = y;
      if (y > e.vMax) e.vMax = y;
      linha.push(chave);
    }
    chaves.push(linha);
  }
  const ord = [...conta.entries()].sort((a, b) => b[1].n - a[1].n);
  const ALFA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+*#@%$&';
  const cod = new Map(ord.map(([k], i) => [k, ALFA[i] || '?']));
  return {
    mapa: chaves.map((l) => l.map((k) => (k === null ? '.' : cod.get(k))).join('')),
    legenda: ord.map(([k, e]) => `${cod.get(k)} ${String(e.n).padStart(5)}  `
      + `z[${e.hMin.toFixed(3)},${e.hMax.toFixed(3)}] y[${e.vMin.toFixed(3)},${e.vMax.toFixed(3)}]  ${k}`),
  };
}

{
  const lista = catalogar(t);
  const p = rig ? rig.profile : { floorY: 1.392 };
  const janelas = [
    ['saia-alta', p.floorY - 0.09, p.floorY - 0.005],
    ['saia-media', p.floorY - 0.33, p.floorY - 0.09],
    ['saia-baixa', p.floorY - 0.62, p.floorY - 0.33],
  ];
  for (const [nome, v0, v1] of janelas) {
    const r = varrer(t, lista, { h0: -7.5, h1: 7.3, v0, v1, cols: 150, rows: 10, origem: 4 });
    out.push([nome + ' janela', `y[${r4(v0)},${r4(v1)}]`]);
    out.push([nome + ' legenda', '\n' + r.legenda.join('\n')]);
    out.push([nome + ' mapa', '\n' + r.mapa.join('\n')]);
  }
}

return out;
