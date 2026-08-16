/* A VINHETA DE ENCERRAMENTO DO VÍDEO.
   ===========================================================================
   Pedido de 2026-08-16: *"remova a marca d'água durante o vídeo, e coloque ao
   final esse vídeo, de forma sutil, suave a transição"*.

   A troca é de estratégia de marca, e é melhor que a anterior: um carimbo no
   canto pesa em TODO quadro e nunca é o assunto; uma vinheta no fim pesa em
   nenhum e é o assunto por sete segundos. `scene/watermark.ts` saiu inteiro.

   ---------------------------------------------------------------------------
   ⚠️⚠️ O QUADRO DA VINHETA TEM DE NASCER NO CANVAS DO RENDERIZADOR

   E isso não é escolha: `openOfflineEncoder()` constrói um `mb.CanvasSource`
   AMARRADO a `renderer.domElement` (ver `scene/record-encoder.ts`). Toda a
   pipeline — tamanho, codec, carimbo, taxa — pende daquele canvas, e um segundo
   canvas ali dentro significaria um segundo codificador. Então a vinheta é
   desenhada COMO CENA: um quadrilátero ortográfico de tela cheia com a textura
   do `<video>`, exatamente a técnica que a marca d'água usava — e pelo mesmo
   motivo mecânico.

   ---------------------------------------------------------------------------
   ⚠️ O `<video>` É AVANÇADO POR `currentTime`, NUNCA POR `play()`

   O vídeo é montado FORA do tempo real (é o desenho inteiro de `record.ts`: um
   `dt` virtual de 1/60 s, quadros que podem levar 300 ms cada). Um `play()` ali
   avançaria pelo relógio de PAREDE e a vinheta sairia acelerada ou arrastada
   conforme a máquina — o mesmo defeito que fez a gravação inteira deixar de ser
   em tempo real. Buscar por tempo é a única forma de o quadro `i` do arquivo
   corresponder ao instante `i/fps` da vinheta.

   ⚠️ E A BUSCA ACONTECE ANTES DO DESENHO, SEMPRE. O `await` de um `seeked` entre
   `renderOfflineFrame()` e `enc.add()` produziria vídeo preto — é a armadilha do
   `preserveDrawingBuffer: false` que o cabeçalho de `record.ts` documenta. A
   ordem obrigatória é: buscar (assíncrono) → desenhar → `add()` (síncronos).

   ⚠️ NO CAMINHO DE RESERVA É O CONTRÁRIO, e está certo: lá o `MediaRecorder` lê
   o canvas no ritmo da parede, então a vinheta TEM de tocar pelo relógio de
   parede. `startOutroLive()` dá `play()` e o gancho de sobreposição desenha o
   quadro corrente. Dois caminhos, dois relógios, porque são duas naturezas.

   ---------------------------------------------------------------------------
   O ENQUADRAMENTO É "COBRIR", NÃO "CABER"

   A vinheta é 16:9 e o vídeo pode não ser (o tamanho "Da tela" segue o viewport).
   Encaixar por dentro deixaria tarjas pretas; cobrir corta um pouco das bordas.
   Para esta peça cobrir é claramente certo: o logotipo é CENTRADO e pequeno em
   relação ao quadro, e o que se perde no corte é gradiente cinza. */
import * as THREE from 'three';
import { renderer, onOverlay, invalidate } from './scene';
import { BRAND_OUTRO } from '../core/paths';

/**
 * A taxa da vinheta, para não buscar o mesmo quadro duas vezes.
 *
 * O arquivo é nosso e tem 24 fps (ver `BRAND_ASSETS.studioOutro`). A 60 fps de
 * vídeo cada quadro de origem vale 2,5 de saída, então quantizar a busca nesta
 * grade corta ~60 % das buscas — que é o item caro deste módulo.
 *
 * ⚠️ E ERRAR ESTE NÚMERO NÃO QUEBRA NADA: com uma taxa de origem diferente, a
 * quantização amostra a vinheta um pouco mais grosso e o resultado é um trepidar
 * de sub-quadro, não uma falha. Por isso ele é uma constante e não uma sondagem.
 */
const OUTRO_FPS = 24;

/** Segundos de dissolvência entre a cena e a vinheta. Curta o bastante para não
 *  parecer uma pausa e longa o bastante para não ser um corte — é o "de forma
 *  sutil, suave" do pedido. Quem a aplica é `record.ts`; ela mora aqui porque o
 *  caminho de reserva também precisa dela. */
export const OUTRO_FADE = 0.6;

let video: HTMLVideoElement | null = null;
let texture: THREE.VideoTexture | null = null;
let scene: THREE.Scene | null = null;
let cam: THREE.OrthographicCamera | null = null;
let quad: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null;
let loading: Promise<boolean> | null = null;
/** Só o caminho de RESERVA usa: o gancho desenha enquanto isto for > 0. */
let liveAlpha = 0;
let liveOn = false;

const _size = new THREE.Vector2();

/** Segundos de vinheta. `0` enquanto ela não tiver carregado. */
export const outroDuration = (): number =>
  (video && Number.isFinite(video.duration) ? video.duration : 0);

export const isOutroReady = () => !!video && outroDuration() > 0;

/** Instante corrente do `<video>`, e o que o navegador diz ser BUSCÁVEL. Só a
 *  bancada usa: uma vinheta que não busca sai congelada no primeiro quadro, e
 *  esse defeito é invisível de dentro — o arquivo abre, tem a duração certa e
 *  mostra um fundo parado. */
export function outroSeekInfo() {
  const v = video;
  if (!v) return { t: 0, seekable: 'sem vídeo', ready: 0 };
  const r: string[] = [];
  for (let i = 0; i < v.seekable.length; i++) {
    r.push(`${v.seekable.start(i).toFixed(2)}–${v.seekable.end(i).toFixed(2)}`);
  }
  return { t: v.currentTime, seekable: r.join(',') || '(nenhum)', ready: v.readyState };
}

/**
 * Baixa a vinheta e deixa o primeiro quadro pronto. Idempotente e **nunca
 * lança**.
 *
 * ⚠️ FALHAR AQUI NÃO PODE DERRUBAR UMA GRAVAÇÃO — a mesma regra que a marca
 * d'água tinha: um render de quatro minutos perdido porque um MP4 de 1,5 MB não
 * respondeu seria a pior troca possível. Devolve `false`, o vídeo sai sem o
 * fecho e a ressalva de `degraded` diz.
 *
 * ⚠️⚠️ ELA ESPERA `loadeddata`, E **NÃO** `canplaythrough` — e a diferença
 * custou uma gravação inteira preta. `canplaythrough` promete que o arquivo
 * TODO cabe sem engasgo, e ele simplesmente NÃO CHEGA em vários caminhos
 * legítimos (um servidor que devolve o tipo errado, um `Content-Length`
 * ausente, uma conexão que o navegador julga lenta). `loadeddata`
 * (`readyState >= 2`) é o que este módulo de fato precisa: há duração, há
 * dimensão e há um quadro para amostrar — o resto vem por `seek`, que é como
 * ele lê o vídeo de qualquer forma.
 *
 * ⚠️ E QUEM CHAMA TEM DE CHAMAR **ANTES DE MEXER NA CENA**. Ver a nota em
 * `recordScene()`: esta espera é de REDE, e uma espera de rede depois do
 * `stopLoop()` deixa o estúdio preparado e parado por segundos — foi ali que o
 * preto nasceu.
 */
export function loadOutro(): Promise<boolean> {
  if (loading) return loading;
  loading = new Promise<boolean>((resolve) => {
    const v = document.createElement('video');
    /* ⚠️⚠️ A ESCOLHA DO CONTÊINER É SONDADA, E O WEBM VEM PRIMEIRO — a mesma
       doutrina do gravador ("codec livre onde ele basta, proprietário só como
       reserva"), com um motivo próprio e MEDIDO: um `<video>` com H.264 derruba
       o processo de GPU no `chrome-headless-shell`. O contexto WebGL é perdido,
       `renderer.render()` passa a sair em 0,2 ms e a gravação inteira sai preta,
       sem erro nenhum. Com VP9 nada disso acontece.
       `canPlayType` respondeu "probably" para os DOIS naquele motor, então a
       sondagem sozinha não teria salvado — quem salva é a ORDEM. A sondagem
       existe para o caminho inverso: um Safari antigo sem VP9 cai no MP4. */
    const fonte = BRAND_OUTRO.find((f) => v.canPlayType(f.type) !== '')
      ?? BRAND_OUTRO[BRAND_OUTRO.length - 1];
    v.src = fonte.url;
    v.preload = 'auto';
    v.muted = true;
    /* Sem faixa de áudio no arquivo (ver o asset), mas `muted` também é o que
       permite `play()` sem gesto do usuário no caminho de reserva. */
    v.playsInline = true;
    v.crossOrigin = 'anonymous';
    let done = false;
    const ok = () => {
      if (done) return;
      done = true;
      video = v;
      resolve(Number.isFinite(v.duration) && v.duration > 0);
    };
    const fail = () => {
      if (done) return;
      done = true;
      console.warn('[truck-studio] a vinheta de encerramento não carregou:', fonte.url);
      resolve(false);
    };
    v.addEventListener('loadeddata', ok, { once: true });
    v.addEventListener('error', fail, { once: true });
    /* A rede pode simplesmente não responder. Um teto CURTO — a peça é
       decorativa, e fazer o usuário esperar por ela seria trocar o essencial
       pelo acessório. */
    setTimeout(() => (v.readyState >= 2 ? ok() : fail()), 8000);
    v.load();
  });
  return loading;
}

function ensureRig(): boolean {
  if (!video) return false;
  if (quad) return true;
  /* ⚠️⚠️ `VideoTexture` PELO CAMINHO DE UPLOAD, `needsUpdate` NA MÃO PELO
     GATILHO — e chegar a esta combinação custou duas medições.

     O GATILHO. `VideoTexture` delega a atualização ao
     `requestVideoFrameCallback` quando o navegador o tem (é o que o construtor
     dele faz, em `three/src/textures/VideoTexture.js`), e o rVFC só dispara
     quando o vídeo APRESENTA um quadro. O laço offline nunca apresenta nada —
     ele desenha, captura e cede —, então a textura ficava CONGELADA no primeiro
     quadro: 588 quadros de vídeo com a mesma luminância de ponta a ponta.

     O UPLOAD. A resposta óbvia para o gatilho — trocar por uma `Texture` comum e
     marcar `needsUpdate` na mão — sai PIOR: o `WebGLTextures` só passa o
     elemento direto para o `texImage2D` quando `isVideoTexture` é verdadeiro; no
     caminho comum ele lê `image.width`, que num `<video>` é 0 (a dimensão mora
     em `videoWidth`), e sobe uma textura vazia. Medido também: a vinheta saiu
     PRETA em vez de congelada.

     Então: a classe certa pelo upload, e `drawOutro()` marcando
     `needsUpdate = true` uma linha antes de desenhar. O rVFC continua marcando
     também quando existe — marcar duas vezes é idempotente. */
  texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  /* Sem mipmap: a vinheta é AMPLIADA (720p para 1080p/1440p), nunca reduzida, e
     gerar mipmap de um quadro de vídeo a cada busca é trabalho jogado fora. */
  texture.generateMipmaps = false;
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  cam.position.z = 1;
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 1,
    /* ⚠️ O MESMO motivo da marca d'água: o renderizador sai em ACESFilmic, que
       escureceria e dessaturaria o verde da marca — e a vinheta É a marca. Com
       a bandeira desligada, o que sai é o pixel do arquivo. */
    toneMapped: false,
    depthTest: false,
    depthWrite: false,
  });
  quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  quad.frustumCulled = false;
  scene.add(quad);
  return true;
}

/**
 * Põe o `<video>` no instante `t` da vinheta.
 *
 * ⚠️ QUANTIZADA NA GRADE DA ORIGEM (`OUTRO_FPS`): sem isso seriam ~470 buscas
 * num fecho de 7,8 s a 60 fps, e a busca é a operação cara deste módulo. Com a
 * quantização são ~187, e cada quadro de origem é apresentado 2 ou 3 vezes —
 * que é exatamente o que um vídeo de 24 fps dentro de um de 60 fps deve fazer.
 *
 * ⚠️ E O TETO DE 2 s É REDE, NÃO OTIMIZAÇÃO. Um `seeked` que não chega
 * penduraria a promessa, e com ela um render de quatro minutos, para sempre.
 */
export function seekOutro(t: number): Promise<void> {
  const v = video;
  if (!v || !(v.duration > 0)) return Promise.resolve();
  const grid = Math.round(t * OUTRO_FPS) / OUTRO_FPS;
  /* O meio do quadro, e não a borda: pousar exatamente no limite deixa o
     navegador escolher entre dois quadros por arredondamento. */
  const alvo = Math.min(Math.max(0, grid + 0.5 / OUTRO_FPS), v.duration - 1e-3);
  if (Math.abs(v.currentTime - alvo) < 0.5 / OUTRO_FPS) return Promise.resolve();
  return new Promise<void>((resolve) => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      v.removeEventListener('seeked', go);
      resolve();
    };
    v.addEventListener('seeked', go);
    v.currentTime = alvo;
    setTimeout(go, 2000);
  });
}

/**
 * Desenha o quadro corrente da vinheta sobre o que já está no buffer.
 *
 * `alpha` de 0 a 1 é a TRANSIÇÃO: em 1 o quadrilátero é opaco e cobre a cena
 * inteira, então não é preciso limpar nada — o que estava lá some por baixo.
 *
 * ⚠️ `autoClear = false` É O QUE FAZ ISTO SER UMA SOBREPOSIÇÃO. Com a bandeira
 * ligada — que é o padrão — este segundo `render()` limparia o buffer, e durante
 * a dissolvência o que se veria por baixo seria vazio em vez da cena.
 */
export function drawOutro(alpha: number): void {
  if (!ensureRig() || !quad || !scene || !cam) return;
  const a = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  if (a <= 0) return;
  quad.material.opacity = a;
  /* O QUADRO CORRENTE DO `<video>` SOBE AGORA. Ver o ⚠️⚠️ de `ensureRig()`:
     sem esta linha a textura fica no primeiro quadro para sempre. */
  if (texture) texture.needsUpdate = true;

  renderer.getDrawingBufferSize(_size);
  const frameAspect = _size.x > 0 && _size.y > 0 ? _size.x / _size.y : 16 / 9;
  const v = video;
  const vw = v?.videoWidth || 16;
  const vh = v?.videoHeight || 9;
  const videoAspect = vw / vh;
  /* COBRIR: o menor quadrilátero que contém o quadro inteiro sem distorcer.
     `sx/sy = videoAspect / frameAspect` é a condição de não-distorção (ver o § do
     enquadramento); a partir dela, o que exceder 2 é o que fica de fora. */
  let sx = 2;
  let sy = 2;
  if (videoAspect >= frameAspect) sx = 2 * (videoAspect / frameAspect);
  else sy = 2 * (frameAspect / videoAspect);
  quad.scale.set(sx, sy, 1);
  quad.position.set(0, 0, 0);
  quad.updateMatrix();
  quad.updateMatrixWorld(true);

  const prevAutoClear = renderer.autoClear;
  renderer.autoClear = false;
  renderer.render(scene, cam);
  renderer.autoClear = prevAutoClear;
}

/* ---------------- o caminho de RESERVA (tempo real) ----------------
   Lá o `MediaRecorder` lê o canvas composto no ritmo da parede, então a vinheta
   toca de verdade e o gancho de sobreposição a desenha em cada quadro do laço
   vivo. É o oposto exato do caminho offline, e pelo motivo certo: dois relógios
   diferentes para duas naturezas diferentes. */
onOverlay(() => {
  if (!liveOn || !video) return;
  const dur = outroDuration();
  if (!(dur > 0)) return;
  /* A mesma dissolvência do caminho offline, medida no tempo do PRÓPRIO vídeo —
     que aqui é o relógio de parede, porque ele está tocando. */
  const a = OUTRO_FADE > 0 ? Math.min(1, video.currentTime / OUTRO_FADE) : 1;
  liveAlpha = a;
  drawOutro(a);
  invalidate();
});

/** Começa a tocar a vinheta sobre o laço vivo. Só a reserva usa. */
export async function startOutroLive(): Promise<void> {
  if (!video) return;
  liveOn = true;
  liveAlpha = 0;
  video.currentTime = 0;
  try { await video.play(); } catch { /* sem gesto? o quadro parado ainda serve */ }
  invalidate();
}

/** Para a vinheta do caminho vivo e a tira da tela. */
export function stopOutroLive(): void {
  if (!liveOn) return;
  liveOn = false;
  liveAlpha = 0;
  video?.pause();
  invalidate();
}

export const outroLiveAlpha = () => liveAlpha;

/** Solta o vídeo e a textura. Chamado quando o estúdio devolve a cena à GPU. */
export function disposeOutro(): void {
  stopOutroLive();
  quad?.geometry.dispose();
  quad?.material.dispose();
  texture?.dispose();
  if (video) { video.removeAttribute('src'); video.load(); }
  quad = null;
  scene = null;
  cam = null;
  texture = null;
  video = null;
  loading = null;
}
