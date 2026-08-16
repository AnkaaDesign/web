/* PORTÃO DE ACEITAÇÃO DOS TRÊS NÍVEIS — desempenho E imagem, na mesma corrida.
   ===========================================================================
       node tools/studio-bench/bench.mjs --gpu --geometry --checks checks-aceitacao.mjs

   POR QUE ELE EXISTE, e por que ele não se parece com `checks-qualidade.mjs`.

   Aquele arquivo mede se o SELETOR mexe no renderizador — e a lição gravada no
   cabeçalho dele ("conferir que um número de configuração mudou não prova
   nada") continua certa e continua sendo respeitada aqui. O que ele NÃO mede é
   a metade do relato do dono:

       "nem mesmo o Baixo está rodando — e isso que no Baixo a qualidade
        visual fica horrível."

   São DUAS reprovações ao mesmo tempo, e um portão que só olha milissegundos
   aprova a segunda. Então este arquivo mede as duas, e a régua da segunda é
   estrutural, não estética:

   ┌─ A REGRA ─────────────────────────────────────────────────────────────────┐
   │ Um nível mais baixo pode desenhar a MESMA CENA COM MENOS AMOSTRAS.        │
   │ Ele não pode desenhar UMA CENA DIFERENTE.                                │
   │                                                                          │
   │ Operacionalmente: a contagem de malhas VISÍVEIS do veículo tem de ser     │
   │ IDÊNTICA nos três níveis. Se o Baixo desenha menos peças que o Alto,      │
   │ alguém apagou pedaço do caminhão, e é exatamente isso que o dono chama    │
   │ de "horrível".                                                           │
   └──────────────────────────────────────────────────────────────────────────┘

   Essa é a régua exata — um inteiro, sem interpretação. A diferença de PIXEL
   entra depois, como leitura de apoio: ela distingue "mais macio" (diferença
   espalhada e pequena) de "faltando coisa" (diferença concentrada e forte), e
   as imagens saem em `tools/studio-bench/shots/` para o olho humano julgar, que
   é o único juiz que decide se está bonito.

   ⚠️ AS IMAGENS SÃO LIDAS DO VIEWPORT, NÃO DA CAPTURA. `scene/capture.ts` roda
   de propósito no TETO (`ceilingProfile()`), então uma foto tirada por ele sai
   igual nos três níveis — e um teste que a usasse aprovaria qualquer coisa. O
   que se lê aqui é `gl.readPixels` do buffer de desenho de verdade, no tamanho
   de verdade, logo depois do `render()`. */

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
const scene = S.scene, camera = S.camera, Q = S.quality;
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

out.push(['cena', JSON.stringify(S.choice)]);
out.push(['fusão por material', S.merge ? JSON.stringify(S.merge.info?.() ?? 'presente') : 'AUSENTE (agente 2 não entregou ou não publicou o afordance)']);

/* ---------------------------------------------------------------------------
   POSE FIXA. Sem ela, dois níveis medidos em quadros diferentes têm câmeras
   diferentes e a comparação de imagem não significa nada. */
const alvo = S.controls.target.clone();
const pose = camera.position.clone();
function porPose() {
  camera.position.copy(pose);
  S.controls.target.copy(alvo);
  camera.lookAt(alvo);
  camera.updateMatrixWorld(true);
}

/* ---------------------------------------------------------------------------
   O CONTADOR VERDADEIRO. `info.reset()` roda DEPOIS de `shadowMap.render()` no
   three 0.179.1 (linhas 16471/16477), então o contador automático nunca vê o
   passe de sombra. Aqui ele é desligado e zerado à mão. */
R.info.autoReset = false;
function conta(reassarSombra) {
  porPose();
  R.shadowMap.needsUpdate = !!reassarSombra;
  R.info.reset();
  R.render(scene, camera);
  return { calls: R.info.render.calls, tris: R.info.render.triangles };
}

function ms(n = 20) {
  porPose();
  for (let i = 0; i < 3; i++) R.render(scene, camera);
  gl.finish();
  const t = performance.now();
  for (let i = 0; i < n; i++) R.render(scene, camera);
  gl.finish();
  return (performance.now() - t) / n;
}

/* ---------------------------------------------------------------------------
   CENSO DE MALHAS VISÍVEIS — a régua estrutural.
   Conta o que o renderizador de fato percorreria: malha visível com todos os
   pais visíveis. Uma malha escondida por LOD, por fusão ou por qualquer um dos
   nove donos de `.visible` NÃO conta. */
function censo() {
  const rig = scene.getObjectByName('RIG');
  let malhas = 0, tri = 0, instancias = 0;
  rig?.traverse((o) => {
    if (!o.isMesh) return;
    let p = o, v = true;
    while (p && p !== scene) { if (!p.visible) { v = false; break; } p = p.parent; }
    if (!v) return;
    malhas++;
    if (o.isInstancedMesh) instancias += o.count;
    const g = o.geometry;
    tri += ((g?.index ? g.index.count : (g?.attributes?.position?.count ?? 0)) / 3)
      * (o.isInstancedMesh ? o.count : 1);
  });
  return { malhas, tri: +(tri / 1e6).toFixed(2), instancias };
}

/* ---------------------------------------------------------------------------
   LEITURA DE PIXEL do buffer de desenho, normalizada para uma grade comum.
   `gl.readPixels` e não `toDataURL`: o renderizador pode ter
   `preserveDrawingBuffer: false`, e aí o dataURL sai preto de forma
   intermitente — um teste que falha às vezes é pior que teste nenhum. */
const GRADE_W = 480, GRADE_H = 300;
function lerViewport() {
  porPose();
  R.render(scene, camera);
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const buf = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  /* Reamostra para a grade comum passando pelo 2D do navegador: os níveis
     desenham em buffers de tamanhos diferentes, e é justamente assim — esticado
     até o tamanho do CSS — que o usuário os vê. Comparar nos tamanhos nativos
     compararia duas coisas que ninguém olha. */
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
  return {
    px: dctx.getImageData(0, 0, GRADE_W, GRADE_H).data,
    url: dst.toDataURL('image/png'),
    nativo: `${w}×${h}`,
  };
}

/** Diferença perceptual barata: luminância, média e cauda. */
function difere(a, b) {
  let soma = 0, fortes = 0, muitoFortes = 0;
  const n = a.length / 4;
  for (let i = 0; i < a.length; i += 4) {
    const la = 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2];
    const lb = 0.2126 * b[i] + 0.7152 * b[i + 1] + 0.0722 * b[i + 2];
    const d = Math.abs(la - lb);
    soma += d;
    if (d > 12) fortes++;
    if (d > 48) muitoFortes++;
  }
  return {
    media: +(soma / n).toFixed(2),
    fortes: +(fortes / n * 100).toFixed(2),
    muitoFortes: +(muitoFortes / n * 100).toFixed(2),
  };
}

/* ---------------------------------------------------------------------------
   TROCAR DE NÍVEL E ESPERAR A TROCA ACONTECER DE VERDADE.

   ⚠️ ESTE PORTÃO MEDIA O NÍVEL ERRADO. A versão anterior fazia `Q.set(nivel)`
   e esperava 14 quadros — ~233 ms. Mas a parte FRIA do perfil (`spotPool`,
   `shadowType`, as variantes de asset) passa por um debounce de 700 ms
   (`FRIO_DEBOUNCE_MS`) que é REARMADO a cada `set`, e só então pela cortina.
   Ou seja: a cortina subia DEPOIS de a medição terminar, e o "Baixo" era
   cronometrado com os 14 refletores e o PCF de 17 taps do Alto ainda no ar —
   justamente os dois maiores degraus do nível.

   A receita é de `checks-qualidade.mjs`, que já tinha topado com isto: cobrir o
   debounce em quadros, esperar `coldPending` zerar, e só então deixar assentar.
   Um portão que mede o estado errado é pior que portão nenhum, porque ele
   APROVA. */
async function assentarNivel(l) {
  Q.set(l);
  for (let i = 0; i < 60; i++) await B.frame();       // cobre os 700 ms do debounce
  await B.until(() => !Q.coldPending, 180000);        // e a cortina de recarga
  for (let i = 0; i < 20; i++) await B.frame();       // e a estabilização depois dela
}

/* ---------------------------------------------------------------------------
   A CORRIDA */
const niveis = ['alta', 'media', 'baixa'];
const R_ = {};
for (const nivel of niveis) {
  await assentarNivel(nivel);
  const c = censo();
  const sem = conta(false);
  const com = conta(true);
  const t = +med([ms(), ms(), ms()]).toFixed(2);
  const img = lerViewport();
  R_[nivel] = { c, sem, com, t, img };
  out.push([`${nivel.toUpperCase()}`,
    `${t} ms/quadro · chamadas ${sem.calls} (+${com.calls - sem.calls} de sombra = ${com.calls}) · ` +
    `${(sem.tris / 1e6).toFixed(2)} M tri · buffer ${img.nativo} · ` +
    `malhas visíveis do veículo ${c.malhas} (${c.tri} M tri)`]);
}

/* ---------------------------------------------------------------------------
   PORTÃO 1 — ESTRUTURAL. A régua que decide "horrível". */
const mAlta = R_.alta.c.malhas, mMedia = R_.media.c.malhas, mBaixa = R_.baixa.c.malhas;
const igual = mAlta === mMedia && mMedia === mBaixa;
out.push(['★ PORTÃO 1 · nenhuma peça do veículo foi apagada',
  igual
    ? `PASSOU — ${mAlta} malhas visíveis nos três níveis`
    : `FALHOU — alta ${mAlta} · média ${mMedia} (−${mAlta - mMedia}) · baixa ${mBaixa} (−${mAlta - mBaixa}). `
      + `Peça apagada é a degradação mais feia por milissegundo; ver o cabeçalho de vehicle/lod.ts.`]);
out.push(['portão 1 (bruto)', igual]);

/* ---------------------------------------------------------------------------
   PORTÃO 2 — PERCEPTUAL. Macio é aceitável; buraco não é. */
for (const nivel of ['media', 'baixa']) {
  const d = difere(R_.alta.img.px, R_[nivel].img.px);
  out.push([`★ PORTÃO 2 · ${nivel} contra alta, mesma pose`,
    `ΔL médio ${d.media}/255 · ${d.fortes} % dos pixels acima de 12 · ${d.muitoFortes} % acima de 48`]);
  out.push([`   leitura`,
    d.muitoFortes > 1.5
      ? `⚠️ ${d.muitoFortes} % de diferença FORTE e concentrada — o padrão de "sumiu geometria", não de "ficou macio". Olhe as imagens.`
      : `diferença espalhada e fraca — o padrão de reamostragem. É o que se quer.`]);
}

/* ---------------------------------------------------------------------------
   PORTÃO 3 — DESEMPENHO. O nível tem de DEVOLVER quadro, e o passe de sombra
   não pode voltar a rodar em todo quadro de arrasto. */
out.push(['★ PORTÃO 3 · o nível devolve quadro?',
  `alta ${R_.alta.t} ms → média ${R_.media.t} ms (${((1 - R_.media.t / R_.alta.t) * 100).toFixed(0)} % mais rápido) `
  + `→ baixa ${R_.baixa.t} ms (${((1 - R_.baixa.t / R_.alta.t) * 100).toFixed(0)} %)`]);

/* reassaduras de sombra num arrasto — o defeito que o agente 1 foi consertar */
const sm = R.shadowMap;
let valor = sm.needsUpdate, coletando = false, sujadas = 0;
Object.defineProperty(sm, 'needsUpdate', {
  configurable: true,
  get() { return valor; },
  set(v) { if (v && !valor && coletando) sujadas++; valor = v; },
});
for (const nivel of niveis) {
  await assentarNivel(nivel);   /* mesma razão da corrida acima */
  sujadas = 0; coletando = true;
  for (let i = 0; i < 90; i++) {
    const a = i * 0.02, r0 = camera.position.distanceTo(alvo);
    camera.position.set(alvo.x + Math.cos(a) * r0, camera.position.y, alvo.z + Math.sin(a) * r0);
    camera.lookAt(alvo);
    S.lighting.invalidate?.(1);
    await new Promise((r) => requestAnimationFrame(() => r()));
  }
  coletando = false;
  out.push([`★ PORTÃO 4 · ${nivel}: sombra reassada em 90 quadros de arrasto`,
    `${sujadas} vezes (${Math.round(sujadas / 90 * 100)} %) — ${sujadas > 45 ? '⚠️ ainda em quase todo quadro' : 'estrangulada'}`]);
}
delete sm.needsUpdate; sm.needsUpdate = false;

/* ---------------------------------------------------------------------------
   MEMÓRIA — o que decide se a integrada roda */
Q.set('alta');
for (let i = 0; i < 10; i++) await B.frame();
function vram() {
  const vistas = new Set();
  let mb = 0;
  scene.traverse((o) => {
    const ms2 = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms2) for (const k of Object.keys(m)) {
      const t = m[k];
      if (!t?.isTexture || !t.image || vistas.has(t.uuid)) continue;
      vistas.add(t.uuid);
      const w = t.image.width || 0, h = t.image.height || 0;
      if (w && h) mb += w * h * 4 * 1.3333 / 1048576;
    }
  });
  return { n: vistas.size, mb: Math.round(mb) };
}
const vAlta = vram();
out.push(['VRAM de textura · alta', `${vAlta.mb} MB em ${vAlta.n} texturas`]);
out.push(['renderer.info', `${R.info.memory.geometries} geometrias · ${R.info.memory.textures} texturas · ${R.info.programs?.length} programas`]);

/* ⚠️ NÃO DEVOLVER PARA `true`. Desde 2026-08-15 `scene/scene.ts` é o DONO de
   `info.autoReset = false` e zera o contador à mão no laço — é assim que
   `getRenderStats()` passou a enxergar o passe de sombra. Religar aqui não
   quebra o teste (ele já terminou de medir): quebra o PAINEL, em silêncio, para
   o resto da sessão do navegador, porque o three volta a zerar depois de
   `shadowMap.render()` e o número exibido volta a esconder 40–70 % do custo. */
R.info.autoReset = false;
Q.set('alta');

/* As imagens, para o olho humano — o único juiz que decide se está bonito. */
out.push(['viewport-alta', R_.alta.img.url]);
out.push(['viewport-media', R_.media.img.url]);
out.push(['viewport-baixa', R_.baixa.img.url]);

return out;
