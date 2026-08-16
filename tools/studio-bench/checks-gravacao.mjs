/* O PORTÃO DA GRAVAÇÃO OFFLINE A 60 fps.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-gravacao.mjs

   O pedido do dono: *"a gravação deve sair a 60 fps pelo menos, mesmo que tenha
   que ter um loading enorme durante a gravação, para não travar e sair a 60 fps
   liso e na qualidade selecionada"*.

   O gravador deixou de usar `MediaRecorder` (que carimba pelo relógio de parede,
   e por isso uma máquina a 12 fps produzia um vídeo de 12 fps) e passou a
   desenhar quadro a quadro com `renderOfflineFrame(1/60)`, carimbando em `i/60`
   e montando o MP4 com WebCodecs. Isso cria três formas NOVAS de errar, e as
   três são silenciosas:

   ┌──────────────────────────────────────────────────────────────────────────┐
   │ 1. VÍDEO PRETO. `preserveDrawingBuffer` é FALSE neste renderer, então o   │
   │    canvas só é legível na MESMA tarefa síncrona do `render()`. Um `await` │
   │    fora de lugar entre o desenho e a captura entrega quadros pretos — às  │
   │    vezes todos, às vezes um sim um não, que é pior.                       │
   │                                                                          │
   │ 2. CARIMBO COM FATOR ERRADO. mediabunny trabalha em SEGUNDOS onde o       │
   │    WebCodecs cru usa microssegundos. Um 10⁶ trocado produz um arquivo de  │
   │    0,000018 s que ABRE, não dá erro, e não toca.                          │
   │                                                                          │
   │ 3. EMENDA DO LAÇO. No modo `volta` o último quadro tem de encostar no     │
   │    primeiro. Se a distância da câmera ainda estava assentando quando a    │
   │    volta começou, a emenda aparece como um salto de ZOOM a cada repetição.│
   └──────────────────────────────────────────────────────────────────────────┘

   ⚠️ O ARQUIVO VAI PARA O DISCO de propósito. Validar o vídeo dentro do mesmo
   navegador que o escreveu é fraco: se o carimbo estiver errado, é o próprio
   motor que errou quem leria de volta. Gravado em `shots/`, o juiz vira o
   `ffprobe`, que não tem nada a ver com esta história. */

const out = [];
const B = window.__bench;

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 40000);
await B.settleSelector();
await B.until(() => !!(window.__studio?.state?.trailer || window.__studio?.state?.cab), 120000);
for (let i = 0; i < 30; i++) await B.frame();
await B.until(() => !!window.__studio?.renderer, 60000);

const S = window.__studio;
const R = S.renderer, Q = S.quality;

out.push(['nível vigente antes de gravar', Q.level]);
out.push(['WebCodecs neste motor', typeof VideoEncoder === 'function']);

/* ---------------------------------------------------------------------------
   A GRAVAÇÃO. Volta curta de propósito: 2 s a 60 fps são 120 quadros, o
   bastante para provar carimbo, emenda e não-preto, e pouco o bastante para a
   bancada não estourar o tempo. */
const rec = S.record || S.recorder;
if (!rec?.recordScene) {
  out.push(['★ ABORTADO', 'window.__studio não publica o gravador — sem afordance não há portão. '
    + 'Publicar `record` em studio.ts (recordScene/stopRecording/canRecord).']);
  return out;
}

/* ⚠️ A CARGA SE ADAPTA AO RASTERIZADOR, e isso não é conveniência de bancada —
   é o teste ficar honesto nos dois mundos. Sob SwiftShader (sem `--gpu`) um
   quadro a 1080p custa segundos, e 120 deles estouram qualquer tempo limite.
   Mas os três portões daqui são de CORREÇÃO, não de desempenho: preto, carimbo
   e emenda valem igual em software. E há um bônus: uma máquina que renderiza
   muito abaixo do tempo real e ainda assim entrega um arquivo de 60 fps é
   exatamente a prova do desenho novo. */
const gl0 = R.getContext();
const dbg = gl0.getExtension('WEBGL_debug_renderer_info');
const adaptador = dbg ? String(gl0.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
const software = /swiftshader|llvmpipe|software/i.test(adaptador);
out.push(['rasterizador', adaptador || '(mascarado)']);
const LAP = software ? 1 : 2, FPS = 60;
const RESOLUCAO = software ? 'viewport' : '1080p';
const fases = [];
const t0 = performance.now();
let video;
try {
  video = await rec.recordScene({
    mode: 'volta',
    resolution: RESOLUCAO,
    fps: FPS,
    lapSeconds: LAP,
    onTick: (p) => {
      const ultima = fases[fases.length - 1];
      if (!ultima || ultima.phase !== p.phase) {
        fases.push({ phase: p.phase, frame: p.frame, total: p.total, t: +((performance.now() - t0) / 1000).toFixed(1) });
      }
    },
  });
} catch (e) {
  out.push(['★ A GRAVAÇÃO LANÇOU', String(e && e.message || e)]);
  return out;
}
const parede = (performance.now() - t0) / 1000;

out.push(['fases observadas', JSON.stringify(fases)]);
out.push(['resultado', JSON.stringify({
  ext: video.ext, mime: video.mime, w: video.width, h: video.height,
  fps: video.fps, realtime: video.realtime, seconds: +video.seconds?.toFixed?.(2),
  degraded: video.degraded || null, bytes: video.blob.size,
})]);
out.push(['★ custo de PAREDE por segundo de vídeo',
  `${parede.toFixed(1)} s de espera para ${LAP} s de vídeo — ${(parede / LAP).toFixed(1)}× tempo real`]);
out.push(['★ não caiu na reserva de tempo real', video.realtime !== true]);

/* ---------------------------------------------------------------------------
   PORTÃO 1 — O VÍDEO NÃO É PRETO.
   Decodifica de volta num <video> e desenha três instantes num canvas 2D. Um
   quadro legítimo desta cena tem luminância média bem acima de zero (há céu,
   chão e lataria clara); preto é 0 e é inconfundível. */
const url = URL.createObjectURL(video.blob);
const v = document.createElement('video');
v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
await new Promise((res, rej) => {
  v.onloadedmetadata = () => res();
  v.onerror = () => rej(new Error('o <video> recusou o arquivo'));
  setTimeout(res, 15000);
});
out.push(['metadados lidos de volta',
  `${v.videoWidth}×${v.videoHeight} · duração ${v.duration?.toFixed(3)} s`]);

const cv = document.createElement('canvas');
cv.width = 320; cv.height = 180;
const cx = cv.getContext('2d', { willReadFrequently: true });

async function amostra(t) {
  await new Promise((res) => {
    const done = () => { v.onseeked = null; res(); };
    v.onseeked = done;
    v.currentTime = t;
    setTimeout(done, 4000);
  });
  cx.drawImage(v, 0, 0, cv.width, cv.height);
  const d = cx.getImageData(0, 0, cv.width, cv.height).data;
  let soma = 0, naoPreto = 0;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    soma += l;
    if (l > 8) naoPreto++;
  }
  return {
    media: +(soma / (d.length / 4)).toFixed(1),
    naoPreto: +(naoPreto / (d.length / 4) * 100).toFixed(1),
    url: cv.toDataURL('image/png'),
  };
}

const inicio = await amostra(0.02);
const meio = await amostra(LAP / 2);
const fim = await amostra(Math.max(0, (v.duration || LAP) - 0.05));

for (const [nome, a] of [['início', inicio], ['meio', meio], ['fim', fim]]) {
  out.push([`quadro ${nome}`, `luminância média ${a.media}/255 · ${a.naoPreto} % dos pixels acima de 8`]);
}
const preto = [inicio, meio, fim].some((a) => a.naoPreto < 5);
out.push(['★ PORTÃO 1 · o vídeo não é preto',
  preto
    ? 'FALHOU — algum quadro veio preto. É a assinatura de `preserveDrawingBuffer:false` '
      + 'com um `await` entre o render e a captura do quadro. Ver record-encoder.ts.'
    : 'PASSOU — os três instantes têm imagem']);
out.push(['portão 1 (bruto)', !preto]);

/* ---------------------------------------------------------------------------
   PORTÃO 2 — A DURAÇÃO BATE COM O QUE FOI PEDIDO.
   É o portão do fator 10⁶: um carimbo em microssegundos tratado como segundos
   daria 0,000018 s aqui, e um em segundos tratado como microssegundos daria
   ~30 minutos. Tolerância de dois quadros. */
const esperada = LAP;
const erro = Math.abs((v.duration || 0) - esperada);
out.push(['★ PORTÃO 2 · a duração é a pedida',
  erro <= 2 / FPS
    ? `PASSOU — ${v.duration.toFixed(3)} s contra ${esperada} s pedidos`
    : `FALHOU — ${v.duration?.toFixed?.(6)} s contra ${esperada} s. `
      + 'Erro de UNIDADE no carimbo (mediabunny usa SEGUNDOS; WebCodecs cru, microssegundos).']);
out.push(['portão 2 (bruto)', erro <= 2 / FPS]);

/* ---------------------------------------------------------------------------
   PORTÃO 3 — A EMENDA DO LAÇO.
   Primeiro e último quadro de uma volta fechada distam UM passo (2π/N). O que
   este portão pega é o caso em que distam um SALTO DE ZOOM — a câmera ainda
   estava assentando a distância quando a volta começou. */
function difere(a, b) {
  let soma = 0, fortes = 0;
  for (let i = 0; i < a.length; i += 4) {
    const la = 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2];
    const lb = 0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2];
    const d = Math.abs(la - lb);
    soma += d;
    if (d > 24) fortes++;
  }
  const n = a.length / 4;
  return { media: +(soma / n).toFixed(2), fortes: +(fortes / n * 100).toFixed(2) };
}
cx.drawImage(v, 0, 0, cv.width, cv.height);
const pxFim = cx.getImageData(0, 0, cv.width, cv.height).data;
await amostra(0.02);
const pxIni = cx.getImageData(0, 0, cv.width, cv.height).data;
const emenda = difere(pxIni, pxFim);
out.push(['★ PORTÃO 3 · a emenda do laço',
  `ΔL médio ${emenda.media}/255 · ${emenda.fortes} % dos pixels acima de 24 — `
  + (emenda.fortes < 8
    ? 'um passo de giro, que é o esperado'
    : '⚠️ salto grande: a distância da câmera provavelmente ainda assentava')]);

out.push(['quadro-inicio', inicio.url]);
out.push(['quadro-meio', meio.url]);
out.push(['quadro-fim', fim.url]);

/* O arquivo, para o ffprobe julgar de fora. */
const b64 = await new Promise((res) => {
  const fr = new FileReader();
  fr.onload = () => res(fr.result);
  fr.readAsDataURL(video.blob);
});
out.push(['gravacao', b64]);

URL.revokeObjectURL(url);
out.push(['nível depois de gravar (o pino tem de ter sido solto)', Q.level]);
out.push(['perfil depois de gravar', JSON.stringify({
  orangePeel: Q.profile().orangePeel, flakeOctaves: Q.profile().flakeOctaves,
  renderScale: Q.profile().renderScale,
})]);
out.push(['buffer restaurado', `${R.domElement.width}×${R.domElement.height}`]);

return out;
