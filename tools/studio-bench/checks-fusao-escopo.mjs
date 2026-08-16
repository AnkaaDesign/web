/* A TRAVA DE ACEITAÇÃO DA FUSÃO POR ESCOPO.
   ===========================================================================
       node tools/studio-bench/bench.mjs --geometry --checks checks-fusao-escopo.mjs

   A fusão por escopo (ver A FUSÃO POR ESCOPO em `vehicle/merge.ts`) funde a
   CAIXA DE COZINHA consigo mesma — 80 primitivas em 6 materiais, num grupo
   próprio cujo NOME casa a regexp que `vehicle/trim.ts` já usa para achar a
   peça. Com isso a caixa continua sendo uma unidade que o card de Configurações
   liga e desliga, e o quadro poupa 74 chamadas (13,4 % das 552).

   ⚠️ POR QUE ESTE ARQUIVO EXISTE, E NÃO SÓ UMA COMPARAÇÃO DE PIXEL A MAIS.
   A fusão global tem UM estado a conferir: a imagem depois de fundir. Esta tem
   QUATRO, porque a peça é ligável:

       fusão de pé   × caixa MOSTRADA      × caixa ESCONDIDA
       fusão solta   × caixa MOSTRADA      × caixa ESCONDIDA

   e o defeito que o desenho existe para não ter mora no segundo passo do
   primeiro par. `applyTrim()` escreve `visible` em TODA malha que casa o nome da
   peça, e as 80 origens continuam casando depois de fundidas — 78 delas pelo
   próprio nome. Sem o CASULO (o `Group` invisível para onde as origens se mudam)
   MOSTRAR a caixa reacenderia as 80 origens por cima dos 6 baldes: a peça
   desenhada duas vezes, 86 chamadas em vez de 6, as duas cópias brigando no
   z-buffer. Um teste que só perguntasse "escondeu?" passaria.

   ⚠️ E O PIXEL SOZINHO TAMBÉM NÃO PEGA ESSE DEFEITO. As origens reacesas estão
   na MESMA pose e com o MESMO material dos baldes, então a imagem sairia quase
   igual — o que muda é o custo e o z-fighting, que é intermitente. Por isso as
   três travas abaixo são independentes: PIXEL, CONTAGEM DE MALHAS e CHAMADAS.

   A quarta trava é o ENQUADRAMENTO: `Box3.expandByObject()` NÃO pula nó
   invisível, então as origens encasuladas entram em toda medida de caixa
   envolvente. É por isso que a matriz delas é reassada na mudança de pai, e é
   isto que confere se a reassadura está certa. */

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
const R = S.renderer, THREE = S.THREE, gl = R.getContext();
const scene = S.scene, camera = S.camera;
const BOX_RE = /caixa-ferrmantas|caixa-plastico-ferramentas/i;

if (!S.trim) {
  out.push(['⚠️ ABORTADO', 'este build não publica `__studio.trim` — sem ele não há'
    + ' como ligar e desligar a peça, e o ciclo que este arquivo mede não existe']);
  return out;
}

/* ---------------------------------------------------------------------------
   A POSE. Fixa e de PERFIL: a caixa fica na lateral do chassi, e uma vista de
   frente a esconderia atrás da testeira — o teste não veria a diferença que ele
   existe para ver. Reaplicada antes de cada leitura porque o desvio de câmera e
   o amortecimento do OrbitControls mexem na pose entre dois quadros. */
const ALVO = new THREE.Vector3(0, 1.8, 0);
const OLHO = new THREE.Vector3(-11, 3.2, 5);
function porPose() {
  camera.position.copy(OLHO);
  S.controls.target.copy(ALVO);
  camera.lookAt(ALVO);
  camera.updateMatrixWorld(true);
}

/* ---------------------------------------------------------------------------
   LEITURA DE PIXEL do buffer de desenho, normalizada para uma grade comum.
   `gl.readPixels` e não `toDataURL`, pelo motivo que `checks-aceitacao.mjs`
   registra: com `preserveDrawingBuffer: false` o dataURL sai preto de forma
   intermitente, e um teste que falha às vezes é pior que teste nenhum. */
const GRADE_W = 480, GRADE_H = 300;
function lerViewport() {
  porPose();
  R.render(scene, camera);
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const buf = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  const src = document.createElement('canvas');
  src.width = w; src.height = h;
  const sctx = src.getContext('2d');
  const img = sctx.createImageData(w, h);
  img.data.set(buf);
  sctx.putImageData(img, 0, 0);
  const dst = document.createElement('canvas');
  dst.width = GRADE_W; dst.height = GRADE_H;
  const dctx = dst.getContext('2d');
  dctx.imageSmoothingEnabled = true;
  dctx.imageSmoothingQuality = 'high';
  /* readPixels devolve a imagem de cabeça para baixo (origem no canto inferior
     esquerdo do GL). Espelha em Y na mesma passada. */
  dctx.translate(0, GRADE_H);
  dctx.scale(1, -1);
  dctx.drawImage(src, 0, 0, GRADE_W, GRADE_H);
  return dctx.getImageData(0, 0, GRADE_W, GRADE_H).data;
}

/** Diferença perceptual barata: luminância, média e cauda. */
function difere(a, b) {
  let soma = 0, fortes = 0;
  const n = a.length / 4;
  for (let i = 0; i < a.length; i += 4) {
    const la = 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2];
    const lb = 0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2];
    const d = Math.abs(la - lb);
    soma += d;
    if (d > 12) fortes++;
  }
  return { media: +(soma / n).toFixed(3), fortes: +(fortes / n * 100).toFixed(3) };
}

/* ---------------------------------------------------------------------------
   AS MEDIDAS DE UM ESTADO */

/** Malhas da caixa VISÍVEIS de verdade — a cadeia de pais inteira até a raiz. */
function caixaNaTela() {
  const root = S.state.trailer;
  if (!root) return { malhas: 0, tri: 0 };
  let malhas = 0, tri = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    let casa = false;
    for (let n = o; n; n = n.parent) {
      if (BOX_RE.test(n.name || '')) { casa = true; break; }
      if (n === root) break;
    }
    if (!casa) return;
    for (let n = o; n; n = n.parent) { if (!n.visible) return; if (n === root) break; }
    malhas++;
    const g = o.geometry;
    tri += (g?.index ? g.index.count : (g?.attributes?.position?.count ?? 0)) / 3;
  });
  return { malhas, tri: Math.round(tri) };
}

/** A caixa envolvente do conjunto — a régua do enquadramento automático. */
function caixaDoConjunto() {
  const b = new THREE.Box3();
  if (S.state.trailer) b.expandByObject(S.state.trailer);
  return b.isEmpty() ? null
    : [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z];
}

async function estado(rot) {
  for (let i = 0; i < 8; i++) await B.frame();
  const px = lerViewport();
  const st = S.getRenderStats();
  const cx = caixaNaTela();
  out.push([rot, `chamadas ${st.calls} · malhas da caixa na tela ${cx.malhas}`
    + ` · ${cx.tri} tri`]);
  return { px, calls: st.calls, ...cx };
}

async function verCaixa(v) {
  S.trim.set('box', { visible: v });
  for (let i = 0; i < 12; i++) await B.frame();
}

/* ---------------------------------------------------------------------------
   O ESCOPO EXISTE? */

porPose();
for (let i = 0; i < 20; i++) await B.frame();

const info = S.merge?.info?.();
out.push(['modo da fusão', info ? info.modo : 'AUSENTE']);
out.push(['chamadas poupadas pela fusão global', info ? info.poupadas : '—']);
for (const e of info?.escopos || []) {
  out.push([`escopo "${e.motivo}"`,
    `${e.origens} origens → ${e.baldes} baldes · poupa ${e.poupadas} · grupo "${e.nome}"`]);
}

/* ⚠️ SEM ESCOPO O RESTO DO ARQUIVO COMPARA A FUSÃO GLOBAL CONSIGO MESMA e passa
   sem medir nada — o pior resultado possível num teste, porque ele vira um
   carimbo. Falha explicitamente. */
const escopoCaixa = (info?.escopos || []).find((e) => /caixa/i.test(e.motivo));
out.push(['ESCOPO DA CAIXA PRESENTE',
  escopoCaixa ? 'sim ✓' : '⚠️ NÃO — nada abaixo prova coisa alguma']);
if (!escopoCaixa) return out;
out.push(['origens = 80?',
  escopoCaixa.origens === 80 ? 'sim ✓' : `⚠️ ${escopoCaixa.origens} (medido no glb: 80)`]);
out.push(['poupa 74 chamadas?',
  escopoCaixa.poupadas === 74 ? 'sim ✓' : `⚠️ ${escopoCaixa.poupadas} (esperado 74)`]);

/* ---------------------------------------------------------------------------
   OS QUATRO ESTADOS, MAIS OS DOIS DA VOLTA */

await verCaixa(true);
const fMostra = await estado('fundida · caixa MOSTRADA');
const bboxFundida = caixaDoConjunto();
await verCaixa(false);
const fEsconde = await estado('fundida · caixa ESCONDIDA');
/* O ciclo COMPLETO: é aqui que o casulo é posto à prova. Um estado medido uma
   vez só não prova reversibilidade. */
await verCaixa(true);
const fVolta = await estado('fundida · caixa MOSTRADA DE NOVO');

S.merge.release();
for (let i = 0; i < 15; i++) await B.frame();
const sMostra = await estado('solta · caixa MOSTRADA');
const bboxSolta = caixaDoConjunto();
await verCaixa(false);
const sEsconde = await estado('solta · caixa ESCONDIDA');
await verCaixa(true);
const sVolta = await estado('solta · caixa MOSTRADA DE NOVO');

/* ---------------------------------------------------------------------------
   OS VEREDITOS */

out.push(['— PIXELS (fundida × solta, mesma pose) —', '']);
for (const [rot, a, b] of [
  ['mostrada', fMostra, sMostra],
  ['escondida', fEsconde, sEsconde],
  ['mostrada de novo', fVolta, sVolta],
  ['reversível (fundida): antes × depois do ciclo', fMostra, fVolta],
  ['reversível (solta): antes × depois do ciclo', sMostra, sVolta],
]) {
  const d = difere(a.px, b.px);
  out.push([rot, `média ${d.media} · ${d.fortes} % de pixels fortes`
    + (d.fortes > 0.5 ? '  ⚠️ REPROVA' : ' ✓')]);
}

out.push(['— A CAIXA SUMIU MESMO? —', '']);
out.push(['fundida, escondida: malhas na tela',
  fEsconde.malhas === 0 ? '0 ✓' : `⚠️ ${fEsconde.malhas}`]);
out.push(['solta, escondida: malhas na tela',
  sEsconde.malhas === 0 ? '0 ✓' : `⚠️ ${sEsconde.malhas}`]);

out.push(['— O CASULO (as origens não podem voltar) —', '']);
out.push(['fundida, mostrada: malhas da caixa na tela',
  `${fMostra.malhas} (solta: ${sMostra.malhas})`
  + (fMostra.malhas < sMostra.malhas ? ' ✓' : ' ⚠️ AS ORIGENS VOLTARAM')]);
out.push(['depois do ciclo esconder→mostrar',
  `${fVolta.malhas}`
  + (fVolta.malhas === fMostra.malhas ? ' ✓' : ' ⚠️ o ciclo mudou a contagem')]);
out.push(['triângulos na tela idênticos?',
  fMostra.tri === sMostra.tri
    ? `sim ✓ (${fMostra.tri})` : `⚠️ ${fMostra.tri} × ${sMostra.tri}`]);
out.push(['mostrar a caixa fundida custa menos chamadas?',
  fMostra.calls < sMostra.calls
    ? `sim ✓ (${fMostra.calls} × ${sMostra.calls})`
    : `⚠️ ${fMostra.calls} × ${sMostra.calls}`]);

out.push(['— O ENQUADRAMENTO (a matriz reassada do casulo) —', '']);
if (bboxFundida && bboxSolta) {
  const d = Math.max(...bboxFundida.map((v, i) => Math.abs(v - bboxSolta[i])));
  out.push(['caixa envolvente do conjunto: maior desvio',
    `${(d * 1000).toFixed(2)} mm${d > 0.002 ? '  ⚠️ a matriz do casulo está errada' : ' ✓'}`]);
} else {
  out.push(['caixa envolvente', '⚠️ não medida']);
}

S.merge.apply();
return out;
