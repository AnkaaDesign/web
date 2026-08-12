/* REGISTRO DO PAINEL — o editor de plotagem contra o baú que ele diz retratar.
   ===========================================================================
   A pergunta única: um quadrado posto no canto da TELA cai no canto da CHAPA
   em 3D? Ela se decide inteiramente por retângulos, e todos são mensuráveis:

     · a caixa do `.stage-panel`      — onde a FOTO do baú é esticada
     · `--ts-pw-ar / x / y / w / h`   — o que o CSS acredita sobre a foto
     · o snapshot (`ar`, `box`)       — o que a foto REALMENTE é
     · a caixa do `.canvas-container` — onde a ARTE é desenhada
     · a caixa do `.ts-structure`     — a chapa 2D
     · a caixa do `.ts-structure--front` — a ferragem por cima

   Em registro perfeito: caixa da arte ≡ `box` do snapshot dentro do palco, e o
   palco tem a razão do snapshot. Qualquer divergência aqui aparece na tela como
   ferragem fantasma meio painel ao lado — o "parece que tem uns 3 modelos
   remontados" do relato.

   Mede também o CUSTO de adicionar uma porta, que é a outra metade do pedido.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-livery-registro.mjs
*/
const out = [];
const B = window.__bench;

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
await B.frame(); await B.frame();

const L = S.livery;
const r4 = (n) => Math.round(n * 10000) / 10000;
const r1 = (n) => Math.round(n * 10) / 10;

/* O retrato é ASSÍNCRONO desde que deixou de travar a página — espera. */
out.push(['retrato das três faces', await B.until(
  () => ['left', 'right', 'rear'].every((k) => !!L.getSnapshot(k)), 60000)]);

/* ---------------- 1 · o que o snapshot diz ---------------- */
for (const key of ['left', 'rear']) {
  const s = L.getSnapshot ? L.getSnapshot(key) : null;
  out.push([`snapshot ${key}`, s
    ? { ar: r4(s.ar), box: { x: r4(s.box.x), y: r4(s.box.y), w: r4(s.box.w), h: r4(s.box.h) } }
    : 'AUSENTE']);
  if (s) {
    out.push([`  área pintável ${key} (fração da chapa)`, {
      u0: r4(s.paint.u0), u1: r4(s.paint.u1), v0: r4(s.paint.v0), v1: r4(s.paint.v1),
    }]);
    const mmk = L.panelMM(key);
    out.push([`  recuo do frame ${key} (mm)`, {
      esq: Math.round(s.paint.u0 * mmk.w), dir: Math.round((1 - s.paint.u1) * mmk.w),
      topo: Math.round(s.paint.v0 * mmk.h), base: Math.round((1 - s.paint.v1) * mmk.h),
    }]);
  }
  const mm = L.panelMM(key);
  out.push([`  chapa ${key} (mm)`, mm]);
  out.push([`  chapa ${key} razão`, r4(mm.w / mm.h)]);
}

/* ---------------- 1b · a LUZ do retrato ----------------
   Nem escuro nem saturado: a chapa branca tem de cair numa faixa alta e NÃO
   estourada, e a foto não pode ter uma pilha de pixels em 255. */
async function luma(key) {
  const s = L.getSnapshot(key);
  if (!s) return 'sem retrato';
  const img = new Image();
  await new Promise((r) => { img.onload = r; img.onerror = r; img.src = s.bg; });
  if (!img.naturalWidth) return 'não decodificou';
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0);
  /* Só o miolo da CHAPA — fora dela há alfa e contexto. */
  const x0 = Math.round((s.box.x + s.box.w * (s.paint.u0 + 0.05)) * c.width);
  const x1 = Math.round((s.box.x + s.box.w * (s.paint.u1 - 0.05)) * c.width);
  const y0 = Math.round((s.box.y + s.box.h * (s.paint.v0 + 0.05)) * c.height);
  const y1 = Math.round((s.box.y + s.box.h * (s.paint.v1 - 0.05)) * c.height);
  const d = cx.getImageData(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)).data;
  /* MEDIANA, e não média. A área pintável da TRASEIRA é atravessada por varões,
     dobradiças e fechos — ferragem escura que a média puxa para baixo, e foi
     ela que me fez ler "a traseira está 22 níveis mais escura" quando o que
     estava escuro era o que passa por cima dela. A chapa é a superfície
     DOMINANTE da região; a mediana é justamente o valor dela.
     `estourado` e `escuro` continuam sendo contagens sobre TUDO — ali o que se
     quer saber é se ALGUM pixel morreu no topo ou no fundo da escala. */
  const hist = new Uint32Array(256);
  let n = 0, clipped = 0, dark = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 250) continue;
    const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    hist[Math.min(255, Math.max(0, Math.round(y)))]++;
    n++;
    if (d[i] >= 254 && d[i + 1] >= 254 && d[i + 2] >= 254) clipped++;
    if (y < 60) dark++;
  }
  if (!n) return 'vazio';
  const at = (frac) => {
    let acc = 0; const alvo = n * frac;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= alvo) return v; }
    return 255;
  };
  return {
    mediana: at(0.5), p90: at(0.9),
    estourado_pct: r1(clipped / n * 100), escuro_pct: r1(dark / n * 100),
  };
}
/* AS TRÊS, e a comparação entre elas é o teste: o pedido é "os 3 devem ter um
   mesmo nível de exposição", e sob um ambiente uniforme em azimute isso tem de
   sair por construção, não por calibração por face. */
out.push(['luminância da chapa · motorista', await luma('left')]);
out.push(['luminância da chapa · passageiro', await luma('right')]);
out.push(['luminância da chapa · traseira', await luma('rear')]);

/* A FITA REFLETIVA tem de continuar VERMELHA. `retroreflect.ts` soma um lóbulo
   por luz DIRECIONAL/pontual/spot, e uma chave perto do eixo da lente estoura
   a fita em branco — o relato foi "as faixas refletivas muito claras, o
   vermelho dela". A prova é contar pixels de fato vermelhos na faixa. */
async function fita(key, band) {
  const s = L.getSnapshot(key);
  if (!s) return 'sem retrato';
  const img = new Image();
  await new Promise((r) => { img.onload = r; img.onerror = r; img.src = s.bg; });
  if (!img.naturalWidth) return 'não decodificou';
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0);
  const y0 = Math.round(band[0] * c.height), y1 = Math.round(band[1] * c.height);
  const d = cx.getImageData(0, y0, c.width, Math.max(1, y1 - y0)).data;
  let vermelho = 0, branco = 0, n = 0, maxR = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 250) continue;
    n++;
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
    if (r > maxR) maxR = r;
    /* Vermelho de fita: canal R alto e os outros bem abaixo. */
    if (r > 110 && r - g > 55 && r - b > 55) vermelho++;
    else if (r > 235 && g > 235 && b > 235) branco++;
  }
  return n ? {
    vermelho_pct: r1(vermelho / n * 100), branco_pct: r1(branco / n * 100), maxR,
  } : 'vazio';
}
/* As faixas superiores: lateral no topo do quadro, traseira idem. */
out.push(['fita do topo · esquerda', await fita('left', [0.0, 0.06])]);
out.push(['fita do topo · traseira', await fita('rear', [0.0, 0.06])]);
out.push(['fita de baixo · traseira', await fita('rear', [0.92, 1.0])]);
out.push(['retrato-esquerda', L.getSnapshot('left')?.bg
  ? await (async () => {
    const b = await (await fetch(L.getSnapshot('left').bg)).blob();
    return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
  })() : 'sem retrato']);
out.push(['retrato-traseira', L.getSnapshot('rear')?.bg
  ? await (async () => {
    const b = await (await fetch(L.getSnapshot('rear').bg)).blob();
    return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
  })() : 'sem retrato']);

/* ---------------- 2 · o palco, medido ---------------- */
L.openEditor('left');
for (let i = 0; i < 6; i++) await B.frame();
await new Promise((r) => setTimeout(r, 400));
for (let i = 0; i < 4; i++) await B.frame();

function boxes(key) {
  const stage = document.getElementById('stage-' + key);
  if (!stage) return null;
  const st = getComputedStyle(stage);
  const sp = stage.getBoundingClientRect();
  const cc = stage.querySelector('.canvas-container')?.getBoundingClientRect();
  const bk = stage.querySelector('.ts-structure:not(.ts-structure--front)')?.getBoundingClientRect();
  const fr = stage.querySelector('.ts-structure--front')?.getBoundingClientRect();
  const rel = (b) => (b && sp.width ? {
    x: r4((b.left - sp.left) / sp.width), y: r4((b.top - sp.top) / sp.height),
    w: r4(b.width / sp.width), h: r4(b.height / sp.height),
  } : null);
  return {
    palco: { w: r1(sp.width), h: r1(sp.height), ar: r4(sp.width / sp.height) },
    css: {
      ar: st.getPropertyValue('--ts-pw-ar').trim(),
      x: st.getPropertyValue('--ts-pw-x').trim(), y: st.getPropertyValue('--ts-pw-y').trim(),
      w: st.getPropertyValue('--ts-pw-w').trim(), h: st.getPropertyValue('--ts-pw-h').trim(),
    },
    arte: rel(cc), chapa2d: rel(bk), ferragem: rel(fr),
  };
}

const bl = boxes('left');
out.push(['palco esquerda', bl]);

/* A DIVERGÊNCIA, em fração do palco: arte contra a caixa da chapa no snapshot. */
const sl = L.getSnapshot ? L.getSnapshot('left') : null;
if (sl && bl?.arte) {
  const d = {
    dx: r4(bl.arte.x - sl.box.x), dy: r4(bl.arte.y - sl.box.y),
    dw: r4(bl.arte.w - sl.box.w), dh: r4(bl.arte.h - sl.box.h),
  };
  out.push(['desvio arte×chapa (fração do palco)', d]);
  out.push(['  em pixels de tela', {
    dx: r1(d.dx * bl.palco.w), dy: r1(d.dy * bl.palco.h),
    dw: r1(d.dw * bl.palco.w), dh: r1(d.dh * bl.palco.h),
  }]);
  out.push(['razão do palco × razão do snapshot', {
    palco: bl.palco.ar, snapshot: r4(sl.ar),
    erro_pct: r1((bl.palco.ar / sl.ar - 1) * 100),
  }]);
}

/* ---------------- 3 · o print do palco ---------------- */
const stageShot = async (tag) => {
  const el = document.getElementById('modal-stage');
  if (!el) return;
  const b = el.getBoundingClientRect();
  out.push([`  ${tag} caixa`, { w: r1(b.width), h: r1(b.height) }]);
};
await stageShot('palco');

/* ---------------- 4 · a traseira ---------------- */
L.showSurface('rear');
for (let i = 0; i < 6; i++) await B.frame();
await new Promise((r) => setTimeout(r, 300));
const br = boxes('rear');
out.push(['palco traseira', br]);
const sr = L.getSnapshot ? L.getSnapshot('rear') : null;
if (sr && br?.arte) {
  out.push(['desvio arte×chapa traseira', {
    dx: r4(br.arte.x - sr.box.x), dy: r4(br.arte.y - sr.box.y),
    dw: r4(br.arte.w - sr.box.w), dh: r4(br.arte.h - sr.box.h),
    razao_palco: br.palco.ar, razao_snap: r4(sr.ar),
  }]);
}

/* ---------------- 5 · o custo de adicionar uma porta ---------------- */
L.showSurface('left');
for (let i = 0; i < 4; i++) await B.frame();

/* Quanto tempo a THREAD PRINCIPAL fica presa. `performance.now()` em volta da
   chamada síncrona é exatamente o congelamento que o usuário sente. */
/* O MAIOR BLOCO SEM PINTAR é o número honesto de "trava?": o usuário não sente
   a soma do trabalho, sente o intervalo em que a tela não responde. Um laço de
   rAF medindo o próprio atraso mede exatamente isso. */
let worstGap = 0, prevTick = performance.now(), watching = true;
(function tick() {
  const now = performance.now();
  const gap = now - prevTick;
  if (gap > worstGap) worstGap = gap;
  prevTick = now;
  if (watching) requestAnimationFrame(tick);
})();
await B.frame();

const t0 = performance.now();
S.measures.addDoor('left');
const tClick = performance.now() - t0;
out.push(['addDoor: bloqueio NO CLIQUE (ms)', r1(tClick)]);
out.push(['  porta já está no painel 2D', S.measures.getDoors('left').length === 1]);
out.push(['  inspetor entrou em "ocupado"', S.measures.isGeometryBusy()]);
out.push(['  porta chegou na geometria', await B.until(
  () => S.trailerRig.body.getDoorHoles('left').length === 1, 60000)]);
out.push(['  ocupado foi liberado', await B.until(() => !S.measures.isGeometryBusy(), 60000)]);
/* E as fotos, que vêm depois do recorte e são o resto do trabalho. */
await B.until(() => !!L.getSnapshot('left'), 60000);
for (let i = 0; i < 40; i++) await B.frame();
watching = false;
out.push(['addDoor: MAIOR quadro sem pintar (ms)', r1(worstGap)]);

/* E o mesmo, decomposto: o retrato sozinho, agora assíncrono. */
await new Promise((r) => setTimeout(r, 800));
for (let i = 0; i < 4; i++) await B.frame();
const t1 = performance.now();
const job = L.refreshSnapshots(S.trailer);
out.push(['refreshSnapshots: bloqueio SÍNCRONO (ms)', r1(performance.now() - t1)]);
await job;
out.push(['refreshSnapshots: total até publicar (ms)', r1(performance.now() - t1)]);

/* ---------------- 5b · onde os ~1,9 s do recorte moram ----------------
   Cada peça cronometrada isolada, para o corte ser decidido por medida e não
   por palpite. */
const timeIt = (label, fn) => {
  const t = performance.now();
  try { fn(); } catch (e) { out.push([`  ${label} LANÇOU`, String(e?.message || e)]); }
  out.push([`  ${label} (ms)`, r1(performance.now() - t)]);
};
for (let i = 0; i < 4; i++) await B.frame();
timeIt('models.setTrailerDims({}) inteiro', () => S.models.setTrailerDims({}));
for (let i = 0; i < 8; i++) await B.frame();
timeIt('livery.attachOverlays sozinho', () => S.livery.attachOverlays(S.trailer));
for (let i = 0; i < 8; i++) await B.frame();
timeIt('models.refreshVehicleReflection sozinho', () => S.models.refreshVehicleReflection());
for (let i = 0; i < 8; i++) await B.frame();
timeIt('models.setPaintTarget sozinho', () => S.models.setPaintTarget(S.state.paintTarget));
for (let i = 0; i < 8; i++) await B.frame();

/* E o registro DEPOIS da porta: a caixa da chapa mudou, e o palco tem de ter
   acompanhado sozinho (`setStageResizer`). */
for (let i = 0; i < 6; i++) await B.frame();
const b2 = boxes('left');
const s2 = L.getSnapshot('left');
if (b2?.arte && s2) {
  out.push(['desvio arte×chapa APÓS a porta', {
    dx: r4(b2.arte.x - s2.box.x), dy: r4(b2.arte.y - s2.box.y),
    dw: r4(b2.arte.w - s2.box.w), dh: r4(b2.arte.h - s2.box.h),
  }]);
}

return out;
