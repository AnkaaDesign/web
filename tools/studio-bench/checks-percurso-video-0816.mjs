/* O VÍDEO DO PERCURSO, E O ARTEFATO QUE ELE NÃO PODE TER — 2026-08-16.
   ===========================================================================
   Relato do dono, na segunda rodada: *"e por algum motivo às vezes o vídeo sai
   com um artefato, garanta que também não irá acontecer"*.

   O "às vezes" é a parte informativa: um defeito que aparece em algumas
   gravações e não em outras depende de ESTADO, e o estado que este recurso
   introduziu é o MOTORISTA DA CÂMERA do criador de vídeo.

   O MECANISMO, por inteiro. A prévia escreve a pose de dentro de um gancho
   `onFrame`. E `renderOfflineFrame()` — a função que desenha cada quadro do
   vídeo — TAMBÉM roda os `onFrame`, porque é o mesmo laço de quadro avaliado
   fora do tempo real. Então, durante uma gravação, cada um dos milhares de
   quadros executa aquele gancho. Se um motorista estivesse vivo ali dentro, ele
   reescreveria a pose que `record.ts` acabou de escrever — DEPOIS de `place()`
   e ANTES do `render()`.

   E o motorista mais fácil de deixar vivo sem perceber não é a prévia: é o VOO
   de 0,45 s que um clique numa miniatura dispara. O gesto natural é justamente
   *"deixa eu ver este ponto… pronto, gravar"* — e meio segundo é exatamente a
   janela em que os dois se cruzam. Daí o "às vezes".

   ESTE ARQUIVO REPRODUZ ESSA JANELA DE PROPÓSITO: dispara o voo e chama a
   gravação no quadro seguinte. Sem `suspendTimelineDrivers()` os primeiros ~27
   quadros do vídeo sairiam deslizando de um lugar que ninguém pediu.

   Roda:  node tools/studio-bench/bench.mjs --gpu --geometry \
            --checks checks-percurso-video-0816.mjs
*/
const out = [];
const B = window.__bench;
const r3 = (v) => Math.round(v * 1000) / 1000;
const q = (s) => document.querySelector(s);

await B.until(() => {
  const o = document.getElementById('ts-selector');
  return !!o && o.classList.contains('is-open');
}, 30000);
await B.settleSelector();
out.push(['__studio de pé', await B.until(() => !!window.__studio, 480000)]);
const S = window.__studio;
if (!S) return out;
await B.until(() => !!(S.state?.trailer || S.state?.cab), 240000);
for (let i = 0; i < 20; i++) await B.frame();

const TL = S.timeline;
const REC = S.record;
if (!TL?.buildTimelinePath || !REC?.recordScene) {
  out.push(['★ ABORTADO', 'window.__studio não publica `timeline` e `record`.']);
  return out;
}
const cam = S.camera;
const controls = S.controls;
const THREE = S.THREE;

/* ---- monta um percurso curto: 2 s a 60 fps são 120 quadros, o bastante para
   provar carimbo, pose e não-preto, e pouco para a bancada não estourar. ---- */
TL.clearTimeline();
const foco = controls.target.clone();
const r0 = cam.position.distanceTo(controls.target);
const pose = (az, el, r) => {
  const a = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  const ce = Math.cos(e);
  controls.target.copy(foco);
  cam.position.set(foco.x + Math.sin(a) * ce * r, foco.y + Math.sin(e) * r,
    foco.z + Math.cos(a) * ce * r);
};
for (const [az, el, rr] of [[25, 15, r0], [125, 25, r0 * 0.85]]) {
  pose(az, el, rr);
  await B.frame(); await B.frame();
  TL.addTimelineKey(null);
}
const sels = document.querySelectorAll('.ts-tl__conn .ts-tl__selin');
for (const sel of sels) { sel.value = '2'; sel.dispatchEvent(new Event('change', { bubbles: true })); }
await B.frame();
const chaves = TL.timelineKeys();
const path = TL.buildTimelinePath();
const DUR = path.duration;
const FPS = 60;
out.push(['percurso montado', `${TL.timelineCount()} pontos · ${DUR} s`]);

/* ---------------------------------------------------------------------------
   A JANELA DO DEFEITO: um voo em curso quando a gravação começa. */
TL.flyToTimelineKey(chaves[0].id, 0.45);
await B.frame();
out.push(['há um motorista vivo na largada (a janela do defeito)',
  TL.isTimelinePreviewing() === false]);

const t0 = performance.now();
let video;
try {
  video = await REC.recordScene({ mode: 'percurso', resolution: 'viewport', fps: FPS });
} catch (e) {
  out.push(['★ A GRAVAÇÃO LANÇOU', String((e && e.message) || e)]);
  return out;
}
out.push(['resultado', JSON.stringify({
  ext: video.ext, w: video.width, h: video.height, fps: video.fps,
  realtime: video.realtime, seconds: r3(video.seconds), bytes: video.blob.size,
  degraded: video.degraded || null,
})]);
out.push(['★ não caiu na reserva de tempo real', video.realtime !== true]);
/* A duração conferida COM o fecho está no portão B2. */
out.push(['custo de parede', `${((performance.now() - t0) / 1000).toFixed(1)} s`]);

/* ---------------------------------------------------------------------------
   PORTÃO A — A CÂMERA TERMINOU NO ÚLTIMO PONTO.
   É a assinatura direta do defeito: com um motorista vivo, a pose final seria a
   do VOO (o ponto 1) e não a do fim do percurso (o ponto 2). Os dois estão a
   cem graus de azimute um do outro, então a diferença é de dezenas de metros —
   não há como confundir com ruído numérico. */
const kFim = chaves[chaves.length - 1];
const alvoFim = new THREE.Vector3(kFim.px, kFim.py, kFim.pz);
const kIni = chaves[0];
const alvoIni = new THREE.Vector3(kIni.px, kIni.py, kIni.pz);
const dFim = cam.position.distanceTo(alvoFim);
const dIni = cam.position.distanceTo(alvoIni);
out.push(['distância da pose final ao último ponto', `${r3(dFim)} m`]);
out.push(['distância da pose final ao PRIMEIRO ponto', `${r3(dIni)} m`]);
out.push(['★ o voo não roubou a câmera durante a gravação', dFim < 0.05 && dIni > 1]);

/* ---------------------------------------------------------------------------
   PORTÃO B — O ARQUIVO VAI PARA O DISCO, E O JUIZ É EXTERNO.

   ⚠️ NÃO SE DECODIFICA O VÍDEO AQUI DENTRO, e a razão é medida: o
   `chrome-headless-shell` não traz o pipeline de mídia proprietário, então um
   `<video>` com H.264 desenha PRETO num canvas mesmo com o arquivo perfeito. O
   `checks-gravacao.mjs` cai na mesma armadilha desde sempre e relata "o vídeo é
   preto" para arquivos que abrem em qualquer player.

   E há um argumento mais forte que a limitação: validar o arquivo no MESMO
   motor que o escreveu é fraco por construção. Com o `.mp4` no disco, quem
   julga é o `ffprobe`/`ffmpeg` — é a mesma doutrina que o bloco de vídeo do
   `bench.mjs` já registra. A análise de quadros roda fora, no shell. */
const b64 = await new Promise((res) => {
  const fr = new FileReader();
  fr.onload = () => res(String(fr.result));
  fr.readAsDataURL(video.blob);
});
out.push(['percurso-video', b64]);

/* ---------------------------------------------------------------------------
   PORTÃO B2 — A VINHETA DE ENCERRAMENTO ENTROU NO ARQUIVO.

   ⚠️ ELA SUBSTITUIU A MARCA D'ÁGUA no mesmo dia — *"remova a marca d'água
   durante o vídeo, e coloque ao final esse vídeo"*. O que se conferia antes era
   se a bandeira do carimbo tinha sido solta; o que se confere agora é se o
   arquivo ficou MAIS LONGO que o percurso, exatamente pela duração da vinheta.
   O conteúdo dos quadros é julgado FORA, pelo ffmpeg, sobre o `.mp4` no disco. */
const durFecho = S.outro?.outroDuration?.() ?? 0;
out.push(['duração da vinheta', `${r3(durFecho)} s`]);
out.push(['★ a vinheta carregou', durFecho > 1]);
out.push(['★ o arquivo = percurso + vinheta',
  `${r3(DUR)} + ${r3(durFecho)} = ${r3(DUR + durFecho)} · saiu ${r3(video.seconds)}`,
  Math.abs(video.seconds - (DUR + durFecho)) <= 3 / FPS]);

/* ⚠️ E A VINHETA TEM DE SER BUSCÁVEL — o portão que faltava quando ela saiu
   CONGELADA. O laço offline a avança por `currentTime`, e um navegador só
   habilita a busca em mídia quando o servidor anuncia `Accept-Ranges`: sem isso
   `seekable` fica VAZIO, todo `currentTime = t` é aparado para 0 em silêncio, e
   o fecho vira sete segundos de fundo parado. O arquivo abre, tem a duração
   certa, e está errado — que é a pior classe de defeito que este projeto tem. */
const busca = S.outro?.outroSeekInfo?.() ?? {};
out.push(['a vinheta é buscável', JSON.stringify(busca)]);
out.push(['★ o navegador deixa buscar dentro da vinheta',
  typeof busca.seekable === 'string' && busca.seekable !== '(nenhum)'
  && !/^0\.00–0\.00$/.test(busca.seekable)]);

/* ---------------------------------------------------------------------------
   PORTÃO C — A CENA VOLTOU INTEIRA.
   Uma gravação com o piso espelhado desligado (a prévia o derruba quando ele
   custa caro) sairia com o piso fosco no ARQUIVO — um defeito permanente, ao
   contrário de um quadro feio. E o desvio das construções tem de voltar a ser
   quem era. */
out.push(['a prévia voltou a responder',
  TL.playTimelinePreview() === true]);
TL.stopTimelinePreview();
out.push(['a órbita voltou para o usuário', controls.enabled === true]);

return out;
