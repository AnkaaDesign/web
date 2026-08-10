/* Gravação de vídeo da cena.
   ---------------------------------------------------------------------------
   O IRMÃO DESTE ARQUIVO É `scene/capture.ts`, E ELES FAZEM O OPOSTO UM DO OUTRO.
   Vale abrir com isso porque a diferença explica quase todas as decisões aqui.

   `capture.ts` renderiza para um `WebGLRenderTarget` PRÓPRIO, em ladrilhos, sem
   nunca tocar a câmera viva nem o canvas visível — é isso que lhe permite
   entregar 7680 × 4320 num viewport de 1500 × 900, e entregar fundo
   transparente. Aqui NADA disso é possível, e a causa é uma só:

       `HTMLCanvasElement.captureStream()` captura O CANVAS QUE É COMPOSTO.

   Não existe API de navegador que transforme um render target em faixa de vídeo.
   O que o `MediaRecorder` grava é literalmente o que está na tela — então tudo
   que este arquivo quiser mudar na imagem gravada, ele tem de mudar NA TELA, à
   vista do usuário, e desfazer no fim. Daí a tarja durante a gravação em 1080p
   (§ resolução) e daí o vídeo não ter fundo transparente (§ o que não fazemos).

   *Alternativa avaliada e rejeitada:* renderizar fora de tela e desenhar quadro
   a quadro num segundo canvas com `drawImage`. Custa um readback completo de
   GPU→CPU por quadro; a 30 fps em 1080p são 250 MB/s atravessando o barramento
   e o framerate cai para menos da metade — um vídeo mais nítido e travado, que é
   o pior dos dois mundos. */
import {
  renderer, camera, resize, invalidate, pinFrames, suspendAvoidance,
  setTurntable, isTurntable, turntableTravel, setTurntablePeriod,
} from './scene';

/* ---------------- o que a interface escolhe ---------------- */

/**
 * `livre` — grava enquanto o usuário orbita à mão; para no botão ou no teto.
 * `volta` — liga o giro de apresentação e para sozinho ao fechar 360°.
 */
export type RecordMode = 'livre' | 'volta';

/** `viewport` grava o buffer como ele está; os outros dois o forçam. */
export type RecordResolution = 'viewport' | '1080p' | '1440p';

export interface RecordOptions {
  mode: RecordMode;
  resolution?: RecordResolution;
  /** Quadros por segundo pedidos ao `captureStream`. */
  fps?: number;
  /** Segundos de uma volta no modo `volta`. Ignorado no modo `livre`. */
  lapSeconds?: number;
  /** Teto do modo `livre`. O modo `volta` tem o teto derivado da volta. */
  maxSeconds?: number;
  /**
   * Progresso, ~4 vezes por segundo. `progress` é 0..1 no modo `volta` e `null`
   * no `livre` — que não tem fim previsto e portanto não tem fração honesta.
   */
  onTick?: (elapsed: number, progress: number | null) => void;
}

export interface RecordResult {
  blob: Blob;
  /** Extensão do contêiner que GANHOU a sondagem, nunca uma presumida. */
  ext: string;
  mime: string;
  width: number;
  height: number;
  seconds: number;
  mode: RecordMode;
  /** Preenchido quando a gravação terminou por um teto, e não pelo alvo. */
  degraded?: string;
}

/* ---------------- teto, e por que existe um ----------------
   Um `MediaRecorder` sem teto é um vazamento com interface: os pedaços ficam em
   memória até o `stop()`, e a página que grava esquecida numa aba aberta enche a
   RAM sem nada na tela dizendo por quê. 60 s a 8 Mbps são ~60 MB, que é o limite
   do que dá para segurar e ainda entregar um arquivo que o navegador baixa. */
const MAX_FREE_SECONDS = 60;
const DEFAULT_FPS = 30;
const DEFAULT_LAP_SECONDS = 18;

/** Dimensões forçadas por modo. `viewport` não força nada. */
const RESOLUTIONS: Record<Exclude<RecordResolution, 'viewport'>, [number, number]> = {
  '1080p': [1920, 1080],
  '1440p': [2560, 1440],
};

/* ---------------- codec: SONDADO, nunca presumido ----------------
   A ordem não é de preferência estética, é de UTILIDADE PARA QUEM RECEBE o
   arquivo. MP4/H.264 é o único que o WhatsApp, o PowerPoint e o Instagram
   aceitam sem conversão — e é para lá que estes vídeos vão. WebM/VP9 é melhor
   por bit e não abre em metade dos lugares em que este material é mostrado.

   `isTypeSupported` é a única forma honesta de escolher: o suporte a MP4 no
   MediaRecorder chegou no Chrome ~126 e no Safari por outro caminho, e um
   `includes('Chrome')` no user agent erraria nos dois sentidos. A extensão do
   arquivo SAI DAQUI, e nunca de um `.mp4` cravado — um contêiner WebM com nome
   `.mp4` é um arquivo que o sistema abre no player errado e que falha calado. */
const CANDIDATES: { mime: string; ext: string }[] = [
  { mime: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4' },
  { mime: 'video/mp4', ext: 'mp4' },
  { mime: 'video/webm;codecs=vp9', ext: 'webm' },
  { mime: 'video/webm;codecs=vp8', ext: 'webm' },
  { mime: 'video/webm', ext: 'webm' },
];

function pickCodec(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const c of CANDIDATES) {
    /* `isTypeSupported` é estático e pode não existir em motores antigos que
       ainda têm o construtor — daí o teste de função, não um `?.` que o TS
       consideraria sempre verdadeiro. */
    if (typeof MediaRecorder.isTypeSupported !== 'function') break;
    if (MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  /* Nenhum tipo aceito mas o construtor existe: deixa o navegador escolher o
     padrão dele. O contêiner de fato vem em `recorder.mimeType` depois do
     `start()`, e é dali que a extensão é corrigida. */
  return { mime: '', ext: 'webm' };
}

/** A gravação é possível neste navegador? Consultado pela UI para esconder o botão. */
export function canRecord(): boolean {
  const el = renderer.domElement as HTMLCanvasElement & {
    captureStream?: (fps?: number) => MediaStream;
  };
  return typeof el.captureStream === 'function' && pickCodec() !== null;
}

/* ---------------- taxa de bits ----------------
   0,10 bit por pixel por quadro. Medido contra o material que este estúdio
   produz — lataria lisa, fundo de estúdio ou pátio, câmera em movimento lento e
   contínuo —, que é justamente o caso fácil para um codec inter-quadro: quase
   toda a imagem é previsível a partir da anterior. Em 1080p30 dá ~6,2 Mbps, na
   mesma faixa do que uma câmera de celular grava.
   O piso de 2 Mbps é o que impede um viewport pequeno (uma janela de 800 × 500
   num monitor 1x) de sair com blocagem visível na tinta metálica, que é o
   primeiro lugar em que a compressão aparece neste conteúdo. */
const bitrateFor = (w: number, h: number, fps: number) =>
  Math.round(Math.max(2_000_000, Math.min(24_000_000, w * h * fps * 0.10)));

/* ---------------- estado ----------------
   Um de cada vez, e o guarda é aqui e não só na UI: `scene/capture.ts` chama
   `stopLoop()` e remexe no tamanho do buffer, o que no meio de uma gravação
   congelaria o vídeo por segundos. A UI impede o clique; isto impede o resto. */
let recorder: MediaRecorder | null = null;
let stopRequested: ((discard: boolean) => void) | null = null;

export const isRecording = () => recorder !== null;

/**
 * Erro de um descarte pedido. Tipo próprio para que quem chama possa distinguir
 * "o usuário saiu da rota" de "a gravação falhou" — o primeiro é silencioso, o
 * segundo tem de aparecer na linha de estado.
 */
export class RecordingDiscarded extends Error {
  constructor() { super('Gravação descartada.'); this.name = 'RecordingDiscarded'; }
}

/**
 * Encerra a gravação em curso. Sem efeito se não houver uma.
 *
 * `discard` existe para a SAÍDA DA ROTA. Sem ele, `unmountStudio()` terminaria a
 * gravação normalmente e o navegador baixaria um arquivo alguns segundos depois
 * de o usuário já estar em outra tela — um download que ninguém pediu, de uma
 * ferramenta que ele fechou. Parar pelo botão continua entregando o vídeo, que é
 * o que o botão promete.
 */
export function stopRecording(discard = false) {
  stopRequested?.(discard);
}

/* Um quadro pintado de verdade. Mesmo motivo (e mesma armadilha) de
   `ui/chrome.ts:painted()`: `requestAnimationFrame` NÃO DISPARA em aba de
   segundo plano, e um `await` nele pendura a promessa para sempre. O
   `setTimeout` é o resgate. */
const nextFrame = () =>
  new Promise<void>((resolve) => {
    let done = false;
    const go = () => { if (!done) { done = true; resolve(); } };
    requestAnimationFrame(() => requestAnimationFrame(go));
    setTimeout(go, 250);
  });

/**
 * Grava a cena e devolve o arquivo.
 *
 * A promessa resolve quando o vídeo está FECHADO e pronto — nunca quando a
 * gravação começa. Quem chama fica com uma pílula no ar até lá.
 */
export async function recordScene(opts: RecordOptions): Promise<RecordResult> {
  if (recorder) throw new Error('Já existe uma gravação em andamento.');

  const canvas = renderer.domElement as HTMLCanvasElement & {
    captureStream?: (fps?: number) => MediaStream;
  };
  if (typeof canvas.captureStream !== 'function') {
    throw new Error('Este navegador não sabe gravar o conteúdo de um canvas.');
  }
  const codec = pickCodec();
  if (!codec) throw new Error('Este navegador não tem MediaRecorder.');

  const fps = Math.max(15, Math.min(60, Math.round(opts.fps || DEFAULT_FPS)));
  const lap = Math.max(4, opts.lapSeconds || DEFAULT_LAP_SECONDS);
  const cap = opts.mode === 'volta'
    /* O teto de uma volta é a própria volta com folga: se o alvo de ângulo não
       chegar (aba que perdeu quadros, usuário que desligou o giro na mão), o
       vídeo tem de terminar assim mesmo em vez de gravar até o teto livre. */
    ? lap * 1.6
    : Math.max(2, Math.min(MAX_FREE_SECONDS, opts.maxSeconds || MAX_FREE_SECONDS));

  /* ---- o que vai ser DESFEITO no fim ----
     Coletado como uma pilha de fechamentos em vez de um punhado de variáveis
     `prevX`: cada passo registra a própria desfeita na hora em que a aplica, e o
     `finally` roda a pilha ao contrário. Um passo que não chegou a rodar não tem
     o que desfazer, e é por construção que não desfaz — que é a parte que uma
     lista de `prev` sempre erra quando alguém acrescenta um passo no meio. */
  const undo: (() => void)[] = [];
  const wasTurning = isTurntable();

  let width = canvas.width;
  let height = canvas.height;
  let degraded: string | undefined;

  try {
    /* ---- 1. RESOLUÇÃO ----
       ISTO MEXE NO CANVAS VISÍVEL, e é a única forma: o `captureStream` só
       captura o canvas que é composto. `updateStyle = false` mantém o tamanho em
       CSS, então o elemento continua ocupando o mesmo espaço no layout e o
       ResizeObserver de mountStudio() não dispara — o que muda é só o buffer, e
       com uma proporção diferente da do holder o navegador o estica: durante a
       gravação o viewport aparece com tarja. É esperado e é dito na interface.
       `setPixelRatio(1)` porque o pedido é "1080p" e não "1080p vezes o DPR do
       monitor": sem isso, num MacBook o buffer sairia 3840 × 2160. */
    if (opts.resolution && opts.resolution !== 'viewport') {
      const [w, h] = RESOLUTIONS[opts.resolution];
      const maxDim = renderer.capabilities.maxTextureSize;
      if (w <= maxDim && h <= maxDim) {
        renderer.setPixelRatio(1);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        width = w; height = h;
        /* `resize()` recalcula tudo a partir do holder — DPR, tamanho e aspecto
           — então devolver é chamá-lo, não restaurar três valores lembrados. */
        undo.push(() => { resize(); });
      } else {
        degraded = 'resolução acima do limite da placa';
      }
    } else {
      /* O buffer pode ter dimensão ÍMPAR (um holder de 1501 px num monitor 1x), e
         H.264 exige as duas pares — o `MediaRecorder` de alguns motores recusa a
         faixa calado, entregando um arquivo de zero byte. Só o que é gravado
         precisa ser par, então o buffer é arredondado para baixo e o CSS fica. */
      const w = width - (width % 2), h = height - (height % 2);
      if (w !== width || h !== height) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        width = w; height = h;
        undo.push(() => { resize(); });
      }
    }

    /* ---- 2. O LAÇO NÃO PODE OCIAR ----
       Ver o cabeçalho de `pinFrames()` em scene.ts: o que a gravação lê é o
       canvas composto, e um quadro que o laço decide não desenhar é um quadro
       gravado repetido. */
    pinFrames(true);
    undo.push(() => pinFrames(false));

    /* ---- 3. O GIRO ----
       Desligar ANTES de ligar não é redundância: `setTurntable()` só zera o
       contador de ângulo na transição de desligado para ligado, e uma volta que
       começasse com o giro já em curso herdaria o percurso anterior e pararia
       cedo. Este par é o que garante que `turntableTravel()` comece em zero.

       `damping: false` é o que faz o laço FECHAR. Com amortecimento o giro
       acelera no começo e desacelera no fim, então o primeiro e o último quadro
       não coincidem e a emenda aparece toda vez que o vídeo dá a volta. */
    if (opts.mode === 'volta') {
      setTurntable(false);
      setTurntablePeriod(lap);
      setTurntable(true, { damping: false });
      undo.push(() => { setTurntable(wasTurning); });
      /* O desvio das construções vira oscilação de altura numa volta — ver o
         cabeçalho de `suspendAvoidance()`. */
      suspendAvoidance(true);
      undo.push(() => suspendAvoidance(false));
    }

    /* Um quadro pintado no tamanho novo ANTES de abrir a faixa: a mudança de
       buffer o deixa em branco, e o `captureStream` fixa as dimensões da faixa
       no momento em que é criado. Abrir antes grava um primeiro quadro branco e,
       em alguns motores, a faixa inteira no tamanho velho. */
    invalidate();
    await nextFrame();

    /* ---- 4. GRAVA ---- */
    const stream = canvas.captureStream(fps);
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, {
      ...(codec.mime ? { mimeType: codec.mime } : {}),
      videoBitsPerSecond: bitrateFor(width, height, fps),
    });
    recorder = rec;
    undo.push(() => {
      recorder = null;
      stopRequested = null;
      /* As faixas ficam vivas depois do `stop()` do recorder e seguram o canvas
         como fonte. Sem isto o Chrome mantém o pipeline de captura ligado até a
         página sair. */
      for (const t of stream.getTracks()) t.stop();
    });

    const t0 = performance.now();
    const elapsed = () => (performance.now() - t0) / 1000;

    const finished = new Promise<void>((resolve, reject) => {
      rec.ondataavailable = (e: BlobEvent) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => resolve();
      rec.onerror = () => reject(new Error('A gravação falhou no meio.'));
    });

    /* `start(1000)` e não `start()`: com um pedaço por segundo a memória sobe em
       degraus previsíveis e um erro no meio ainda deixa o que já foi gravado.
       Sem o argumento, tudo fica num buffer interno até o `stop()`. */
    rec.start(1000);

    /* ---- 5. QUANDO PARAR ----
       Dois relógios, de propósito. O de ÂNGULO (`turntableTravel`) é quem decide
       a volta: ele mede o que a câmera realmente andou, então uma aba que perdeu
       quadros fecha a volta mesmo assim, só demorando mais. O de PAREDE é o teto,
       e é o único que funciona quando o de ângulo não anda (giro desligado na
       mão no meio da gravação).

       `setInterval` e não `requestAnimationFrame`: numa aba em segundo plano o
       rAF para, e a gravação ficaria pendurada sem nada que a encerrasse. O
       intervalo continua correndo (com folga, a 1 Hz mínimo garantido pelos
       motores) e o teto de parede é honrado. */
    const TWO_PI = Math.PI * 2;
    let discarded = false;
    await new Promise<void>((resolve) => {
      let ended = false;
      const end = (why?: string) => {
        if (ended) return;
        ended = true;
        if (why) degraded = why;
        clearInterval(timer);
        stopRequested = null;
        if (rec.state !== 'inactive') rec.stop();
        resolve();
      };
      /* O botão "parar" da interface entra por aqui — mesma porta do teto, para
         que exista um só caminho de encerramento. */
      stopRequested = (discard: boolean) => { discarded = discard; end(); };
      const timer = setInterval(() => {
        const t = elapsed();
        const done = opts.mode === 'volta'
          ? Math.min(1, Math.abs(turntableTravel()) / TWO_PI)
          : null;
        opts.onTick?.(t, done);
        if (opts.mode === 'volta' && done !== null && done >= 1) { end(); return; }
        if (t >= cap) {
          end(opts.mode === 'volta'
            ? 'a volta não fechou no tempo previsto'
            : `limite de ${MAX_FREE_SECONDS} s`);
        }
      }, 250);
    });

    /* Esperado MESMO no descarte: o `stop()` já foi pedido e as faixas só podem
       ser fechadas depois que o recorder soltar o último pedaço. Sair antes
       deixaria o `ondataavailable` escrevendo num array que ninguém mais lê e o
       `finally` derrubando faixas ainda ocupadas. */
    await finished;
    if (discarded) throw new RecordingDiscarded();

    const seconds = elapsed();
    /* O tipo EFETIVO, lido do recorder depois do start: quando a sondagem cai no
       ramo de mime vazio, é só aqui que se descobre o que o navegador escolheu.
       A extensão segue o contêiner de verdade, sempre. */
    const mime = rec.mimeType || codec.mime || 'video/webm';
    const ext = /mp4/i.test(mime) ? 'mp4' : 'webm';
    const blob = new Blob(chunks, { type: mime });
    if (!blob.size) throw new Error('O navegador devolveu um vídeo vazio.');

    return { blob, ext, mime, width, height, seconds, mode: opts.mode, degraded };
  } finally {
    /* Ao contrário: cada passo desfaz o seu, na ordem inversa da aplicação. */
    for (let i = undo.length - 1; i >= 0; i--) {
      try { undo[i](); } catch (e) { console.warn('[record] desfazer falhou', e); }
    }
    recorder = null;
    stopRequested = null;
    invalidate();
  }
}

/* ---------------- o que este arquivo deliberadamente NÃO faz ----------------

   FUNDO TRANSPARENTE. `scene/capture.ts` entrega, e a diferença não é de
   esforço: nenhum contêiner que o `MediaRecorder` produz no navegador carrega
   canal alfa de forma confiável — o VP9 tem um perfil com alfa que o Chrome
   grava e quase nenhum player lê, e o H.264 não tem nenhum. O que resolve o
   mesmo problema de verdade é o fundo PRETO do ciclorama, que já existe como
   pastilha no HUD de estúdio.

   ÁUDIO. `captureStream` de um canvas devolve uma faixa de vídeo e nada mais.
   Uma trilha entraria como uma segunda faixa, vinda de um arquivo que alguém
   teria de escolher, guardar e licenciar — é um produto, não um detalhe.

   GRAVAR EM ALTA COMO A IMAGEM. Está no topo do arquivo: `captureStream` lê o
   canvas composto, e um canvas de 7680 px de largura não cabe no viewport nem
   é composto por ele. É a fronteira real entre este arquivo e o irmão. */
