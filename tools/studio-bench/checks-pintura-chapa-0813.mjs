/* A CHAPA PINTADA: a correção do recorte, e o "resquício" da traseira.
   ===========================================================================
   Duas perguntas, e as duas nascem do mesmo lugar — "pintar o implemento com a
   cor do cavalo" ligado.

   1 · O RECORTE SOBREVIVE À TINTA?
       `checks-porta2-diag-0813.mjs` mediu o defeito: com a tinta ligada, todo
       recorte de geometria destruía as chapas de livery e não recriava nenhuma
       (0 malhas SIDE_L depois de abrir um vão), porque `buildLiveryPanels()`
       procurava a carroceria pelo material CORRENTE e a tinta o havia trocado.
       Aqui a trava: depois de dois vãos, as quatro chapas continuam de pé e o
       retrato mostra as duas portas.

   2 · DE QUE É FEITO O RESQUÍCIO?
       Relato: *"quando está a pintura da cor do cavalo aplicada e eu aplico
       outra cor na traseira, fica ainda um resquício da cor do cavalo lá"*. A
       cor da face é pintada na TELA do fabric, que veste só a chapa recortada;
       o que sobra em volta dela continua com a tinta do cavalo. Esta bancada
       não supõe qual peça é: ela lista, por nome de malha e por ÁREA aparente
       de trás, tudo que continua com o material da tinta na fatia traseira.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-pintura-chapa-0813.mjs
*/
const out = [];
const B = window.__bench;
const r1 = (v) => Math.round(v * 10) / 10;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);

async function settle() {
  const overlay = document.getElementById('ts-selector');
  if (!overlay) return true;
  for (let step = 0; step < 12; step++) {
    if (overlay.classList.contains('hidden')) return true;
    const cards = [...overlay.querySelectorAll('.ts-card:not([disabled])')];
    if (!cards.length) break;
    const local = cards.find((c) => /scania|volvo|iveco/i.test(c.dataset.id || ''));
    (local || cards[0]).click();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  return overlay.classList.contains('hidden');
}

out.push(['seletor atravessado', await settle()]);
out.push(['__studio de pé', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;
out.push(['implemento carregado', await B.until(() => !!S.trailerRig, 240000)]);
if (!S.trailerRig) return out;
const L = S.livery;
const THREE = S.THREE;
await B.frame(); await B.frame();

const panelCount = () => {
  const n = { SIDE_L: 0, SIDE_R: 0, REAR: 0, FRONT: 0 };
  S.trailer?.traverse((o) => { if (o.isMesh && n[o.name] !== undefined) n[o.name]++; });
  return n;
};
const panelsOk = () => {
  const n = panelCount();
  return n.SIDE_L === 1 && n.SIDE_R === 1 && n.REAR === 1 && n.FRONT === 1;
};

function frontProfile(snap) {
  const c = snap && snap.front;
  if (!c || !c.width || !c.height) return null;
  const cx = c.getContext('2d', { willReadFrequently: true });
  if (!cx) return null;
  const N = 48;
  const y0 = Math.floor(c.height * 0.30), y1 = Math.floor(c.height * 0.80);
  const cols = [];
  for (let i = 0; i < N; i++) {
    const x0 = Math.floor((i / N) * c.width);
    const x1 = Math.max(x0 + 1, Math.floor(((i + 1) / N) * c.width));
    const d = cx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let opaque = 0;
    for (let p = 3; p < d.length; p += 4) if (d[p] > 96) opaque++;
    cols.push(opaque / ((x1 - x0) * (y1 - y0)));
  }
  return cols;
}
const bar = (cols) => cols.map((v) => '0123456789'[Math.min(9, Math.round(v * 10))]).join('');

async function settleDoors(n) {
  const okGeo = await B.until(
    () => (S.trailerRig.body.getDoorHoles('left') || []).length === n, 90000);
  const okBusy = await B.until(() => !S.measures.isGeometryBusy(), 90000);
  for (let i = 0; i < 90; i++) await B.frame();
  await new Promise((r) => setTimeout(r, 3000));
  for (let i = 0; i < 30; i++) await B.frame();
  return okGeo && okBusy;
}

/* ---------------- liga a tinta ---------------- */
const box = document.getElementById('paint-trailer');
if (box && !box.checked) { box.checked = true; box.dispatchEvent(new Event('change')); }
await new Promise((r) => setTimeout(r, 2500));
for (let i = 0; i < 40; i++) await B.frame();
out.push(['tinta do cavalo aplicada ao implemento', S.models.state.paintTarget === 'both']);
out.push(['1 · as 4 chapas existem ANTES do recorte', panelsOk()]);

/* ---------------- 1 · dois vãos com a tinta ligada ---------------- */
const card = document.querySelector('.preview-card[data-surface="left"]');
if (card) card.click();
for (let i = 0; i < 6; i++) await B.frame();

document.querySelector('.ms-door-add')?.click();
await settleDoors(1);
out.push(['1 · as 4 chapas sobrevivem ao 1º vão', panelsOk()]);

document.querySelector('.ms-door-add')?.click();
await settleDoors(2);
out.push(['1 · as 4 chapas sobrevivem ao 2º vão', panelsOk()]);
out.push(['    contagem', JSON.stringify(panelCount())]);

const snap = L.getSnapshot('left');
const prof = frontProfile(snap);
if (prof) out.push(['    perfil da lateral', bar(prof)]);
/* Dois picos separados = duas portas na foto.
   ⚠️ UMA PORTA PRODUZ MAIS DE UM GRUPO DE COLUNAS. O perfil medido de uma porta
   é `22 0 14`: o batente esquerdo, o VÃO (que é vazado, alfa zero, e por isso
   morre no meio) e o batente direito com o fecho. Contar grupos contíguos dava
   5 picos para 2 portas e reprovava uma foto correta. A porta tem ~1,2 m num
   painel de 14,7 m, ou seja ~4 colunas de 48 — então duas colunas mortas ainda
   são a MESMA porta, e só um vão maior separa duas.

   E AS COLUNAS DAS PONTAS SAEM DA CONTA: o recorte da ferragem começa e termina
   no montante de canto, que dá ~0,2 de cobertura na primeira coluna em toda
   foto — com ou sem porta. Contá-lo é contar uma porta a mais, sempre. */
const GAP = 3;
let peaks = 0, dead = GAP;
const inner = (prof || []).slice(1, -1);
for (const v of inner) {
  if (v > 0.05) { if (dead >= GAP) peaks++; dead = 0; } else dead++;
}
out.push(['1 · o retrato mostra DUAS portas', peaks === 2]);
out.push(['    picos no perfil', peaks]);

/* ---------------- 2 · o resquício da traseira ---------------- */
const rearTab = document.querySelector('#surface-tabs .tab[data-surface="rear"]');
if (rearTab) rearTab.click();
for (let i = 0; i < 4; i++) await B.frame();
const pick = document.getElementById('bgcolor');
if (pick) {
  pick.value = '#101010';
  pick.dispatchEvent(new Event('input', { bubbles: true }));
  pick.dispatchEvent(new Event('change', { bubbles: true }));
}
for (let i = 0; i < 20; i++) await B.frame();
out.push(['2 · traseira com cor própria', L.surfaces.rear.backgroundColor === '#101010']);

/* A ÁREA POR TRIÂNGULO, e não pela caixa: a caixa de `TRAILER_BODY` alcança a
   traseira porque o baú inteiro alcança, e diria 7 m² de "resquício" onde pode
   não haver nenhum. O que a câmera de trás vê é o triângulo cuja NORMAL aponta
   para −Z e que está no PLANO da traseira. */
const paintMat = S.models.state.trailerPaintMat;
S.trailer.updateWorldMatrix(true, true);
const inv = S.trailer.matrixWorld.clone().invert();
const toLocalOf = (o) => new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);

let zMin = Infinity;
S.trailer.traverse((o) => {
  if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
  const b = new THREE.Box3().setFromBufferAttribute(o.geometry.attributes.position)
    .applyMatrix4(toLocalOf(o));
  if (b.min.z < zMin) zMin = b.min.z;
});
const zLim = zMin + 0.15;

/** Área dos triângulos virados para trás e no plano da traseira, em m². */
function rearFacingArea(o) {
  const g = o.geometry;
  const pos = g.attributes.position;
  if (!pos) return 0;
  const m4 = toLocalOf(o);
  const idx = g.index ? g.index.array : null;
  const tri = Math.floor((idx ? idx.length : pos.count) / 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
  let area = 0;
  for (let t = 0; t < tri; t++) {
    const i0 = idx ? idx[t * 3] : t * 3;
    const i1 = idx ? idx[t * 3 + 1] : t * 3 + 1;
    const i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
    a.fromBufferAttribute(pos, i0).applyMatrix4(m4);
    b.fromBufferAttribute(pos, i1).applyMatrix4(m4);
    c.fromBufferAttribute(pos, i2).applyMatrix4(m4);
    if (a.z > zLim || b.z > zLim || c.z > zLim) continue;
    e1.subVectors(b, a); e2.subVectors(c, a);
    n.crossVectors(e1, e2);
    const len = n.length();
    if (len < 1e-9) continue;
    if (n.z / len > -0.7) continue;               // não está virado para trás
    area += len / 2;
  }
  return area;
}

const rows = [];
S.trailer.traverse((o) => {
  if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  const painted = mats.some((m) => m === paintMat);
  const area = rearFacingArea(o);
  if (area < 0.005) return;
  rows.push({ name: o.name || '(sem nome)', mat: (mats[0] && mats[0].name) || '?', painted, area });
});
rows.sort((a, b) => b.area - a.area);
out.push(['2 · superfícies viradas para trás', rows.length]);
for (const r of rows.slice(0, 14)) {
  out.push(['    ', `${r.painted ? 'TINTA' : '     '} ${r1(r.area)} m² · ${r.name} · ${r.mat}`]);
}
const rear = rows.filter((r) => r.name === 'REAR').reduce((s, r) => s + r.area, 0);
const resid = rows.filter((r) => r.painted && r.name !== 'REAR').reduce((s, r) => s + r.area, 0);
out.push(['    chapa plotável (REAR) m²', r1(rear)]);
out.push(['    RESQUÍCIO com a cor do cavalo m²', r1(resid)]);
out.push(['    resquício como % da traseira',
  r1(100 * resid / Math.max(1e-6, rear + resid)) + ' %']);

return out;
