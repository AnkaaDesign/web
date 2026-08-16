/* Gravação de vídeo da cena.
   ===========================================================================
   O PEDIDO QUE REESCREVEU ESTE ARQUIVO, nas palavras do dono:

       *"a gravação de vídeo, a qualidade fica muito ruim e o fps também"*
       *"a gravação deve sair a 60 fps pelo menos, mesmo que tenha que ter um
        loading enorme durante a gravação, para não travar e sair a 60 fps liso
        e na qualidade selecionada"*

   A segunda frase é a que decide o desenho, e ela é uma TROCA explícita: a
   espera é aceita, o engasgo não. Logo:

       O VÍDEO DEIXOU DE SER GRAVADO EM TEMPO REAL.

   ---------------------------------------------------------------------------
   POR QUE A VERSÃO ANTERIOR NÃO TINHA CONSERTO, e não é falta de capricho

   Ela era construída sobre `HTMLCanvasElement.captureStream()` +
   `MediaRecorder`, e essa dupla carimba cada quadro pelo RELÓGIO DE PAREDE. Uma
   máquina que desenha a 12 fps produz, POR DEFINIÇÃO, um vídeo de 12 fps: não há
   taxa de bits, codec nem ajuste que conserte isso, porque não é um defeito, é a
   natureza da API. Pedir "60 fps liso" a ela é pedir que a máquina fique rápida.

   A saída é desacoplar o vídeo do tempo real: desenhar quadro a quadro FORA do
   laço, avançando o mundo por um `dt` VIRTUAL de 1/60 s, e carimbar cada quadro
   no tempo que esse `dt` implica. O render pode levar 300 ms; o vídeo continua
   saindo com 60 quadros por segundo de vídeo. É o que `renderOfflineFrame()`
   (scene.ts) existe para permitir — leia o cabeçalho dela, ele lista o que ela
   deliberadamente NÃO faz e por quê.

   ⚠️ O `dt` VIRTUAL NÃO É DETALHE. Sem ele, um vídeo renderizado a 3 fps reais e
   carimbado a 60 sairia com a chuva 20× lenta, as dissolvências dos prédios
   arrastadas e o giro parecendo uma vitrola sem energia. O mundo tem de andar
   pelo relógio DO VÍDEO.

   ---------------------------------------------------------------------------
   OS TRÊS DEFEITOS DO RELATO, E ONDE CADA UM É FECHADO

   1. **"a qualidade fica muito ruim"**, parte um: A GRAVAÇÃO NUNCA RODOU NO
      TETO. `core/quality.ts` promete desde sempre, na linha ~75, que *"a
      captura e a GRAVAÇÃO rodam SEMPRE no teto"*. A captura cumpria; a gravação
      **não importava uma linha de `quality.ts`**. Quem estava no nível Baixo
      gravava vídeo com `orangePeel` desligado, uma oitava de floco, vegetação a
      35 %, sem ondulação de chuva e com o chão a 1024² — e depois comparava esse
      vídeo com a FOTO, que sai no teto. Fechado por `pinCeilingProfile(true)`,
      o PRIMEIRO passo da sequência abaixo.

   2. **"a qualidade fica muito ruim"**, parte dois: O FLOCO VIRAVA CHUVISCO.
      A versão anterior forçava 1920 × 1080 sobre um viewport de, digamos,
      1152 × 720 e nunca alimentava `uPxScale`. O shader da tinta escolhe a
      oitava do floco por `fwidth()`, que mede o pixel DO BUFFER — com o buffer
      1,5× maior e a referência intocada, ele escolhia uma oitava fina demais e
      a lataria virava ruído de altíssima frequência. Que é, de quebra, **o pior
      caso possível para um codec de vídeo** (ver § taxa de bits). Fechado por
      `reanchorPaintPixel()`, logo depois de forçar a resolução.

   3. **"o fps também"**: resolvido pelo desenho inteiro deste arquivo.

   ---------------------------------------------------------------------------
   OS DOIS MODOS, E OS DOIS SAEM A 60 fps

   `volta` — 100 % OFFLINE E DETERMINÍSTICO. Não há nada em tempo real: o
   percurso é sintético. São `N = round(lap × fps)` quadros, cada um chamando
   `renderOfflineFrame(1/fps)`, carimbados em `i/fps`. Como `controls.update(dt)`
   move o `autoRotate` em função do `dt` — `2π/60 × autoRotateSpeed × dt`, com
   `autoRotateSpeed = 60/lap` — cada quadro gira exatamente `2π/N` e a volta
   FECHA NO MESMO ÂNGULO EM QUALQUER MÁQUINA. É isso que torna a emenda do laço
   de vídeo exata em vez de aproximada.

   `percurso` — O FILME QUE O USUÁRIO AUTORA. Ele marca PONTOS de câmera e o
   tempo entre eles; `scene/timeline.ts` resolve isso numa curva monótona
   (PCHIP) em coordenadas esféricas, e aqui ela é só avaliada em `t = i/fps`. Não
   há nada em tempo real: o percurso já existe inteiro quando a gravação começa.

   ⚠️ ELE SUBSTITUIU O MODO `livre`, E A SUBSTITUIÇÃO FOI UM CONSERTO. O modo
   antigo amostrava a órbita à mão e reamostrava o caminho para 60 fps — ou seja,
   reproduzia com fidelidade ATÉ O TREMOR DA MÃO. O relato do dono foi o
   diagnóstico: *"assim a câmera será suave, não rígida já que manualmente não
   conseguimos deixar ela suave"*. Um vídeo de câmera lisa não sai de suavizar
   um caminho trêmulo depois; sai de nunca ter tremido. O argumento inteiro, com
   as duas curvas descartadas e por quê, está no cabeçalho de `timeline.ts`.

   ---------------------------------------------------------------------------
   A SEQUÊNCIA, E A ORDEM É PARTE DA CORREÇÃO

     1. `pinCeilingProfile(true)` — **PRIMEIRO**. Ele emite mudança de qualidade,
        e `scene.ts` responde reaplicando o perfil e REDIMENSIONANDO o buffer
        para o holder. Fazer isso depois de forçar 1080p apagaria os 1080p, em
        silêncio, e o vídeo sairia no tamanho do viewport com o menu dizendo
        "1080p".
     2. Forçar a resolução (`setPixelRatio(1)` + `setSize(w, h, false)`).
     3. `reanchorPaintPixel()` — ver o defeito 2.
     4. `stopLoop()` — nada mais pode desenhar por conta própria enquanto o laço
        offline estiver no ar. Mesma doutrina de `scene/capture.ts`.
     5. O laço: `renderOfflineFrame(1/fps)` → capturar → codificar.
     6. `finalize()` e o Blob.
     7. `finally`: a pilha de desfazer, `startLoop()` e `pinCeilingProfile(false)`.

   ⚠️ O QUE O PINO **NÃO** ALCANÇA, e é a mesma exceção já registrada em
   `ceilingProfile()`: `spotPool`, `shadowType` e `antialias` são botões FRIOS —
   trocá-los exige recompilar a cena, e uma cortina de dois segundos no meio de
   um vídeo é pior que a degradação. Uma gravação feita no nível Baixo sai com o
   pool de refletores e o filtro de sombra do Baixo. Isso é DITO em
   `RecordResult.degraded`, não escondido.

   ---------------------------------------------------------------------------
   O QUE ESTE ARQUIVO CONTINUA SENDO EM RELAÇÃO A `scene/capture.ts`

   O irmão renderiza para um `WebGLRenderTarget` PRÓPRIO, em ladrilhos, sem nunca
   tocar a câmera viva nem o canvas visível — é isso que lhe permite entregar
   7680 × 4320 num viewport de 1500 × 900, e entregar fundo transparente.

   Aqui nada disso vale, e a razão mudou de nome mas não de natureza. Antes era
   `captureStream()`, que só lê o canvas composto. Agora é o `VideoFrame`, que se
   constrói a partir de um `CanvasImageSource` — e o canvas do renderizador é o
   único que existe. Renderizar para um alvo próprio e voltar por
   `readRenderTargetPixels` custaria um readback completo GPU→CPU por quadro
   (250 MB/s a 1080p60) e ainda exigiria um segundo canvas para o `VideoFrame`
   nascer. Continua sendo o pior dos dois mundos.

   ⚠️⚠️ E daí vem a armadilha que governa o módulo do codificador:
   `preserveDrawingBuffer` é FALSE (`scene/scene.ts:263`), então o pixel do canvas
   só é legível NA MESMA TAREFA SÍNCRONA do `render()`. O padrão obrigatório é

       renderOfflineFrame(dt);     // desenha
       await enc.add(t, 1 / fps);  // agarra na chamada, espera depois

   e a prova de que `add()` agarra síncrono está lida na fonte do pacote, no
   cabeçalho de `scene/record-encoder.ts`. Um `await` entre as duas linhas
   produz vídeo preto — às vezes intermitente, que é pior.

   ---------------------------------------------------------------------------
   O QUE ESTE ARQUIVO DELIBERADAMENTE NÃO FAZ

   FUNDO TRANSPARENTE. `capture.ts` entrega; aqui não. H.264 não tem canal alfa,
   e os contêineres que têm (VP9 com alfa em WebM) quase nenhum player lê. O que
   resolve o mesmo problema de verdade é o fundo PRETO do ciclorama, que já
   existe como pastilha no HUD de estúdio.

   ⚠️ E A CADEIA DE CODECS NÃO REABRE ESSA PORTA, apesar de parecer. Sim, quando
   a sondagem cai em VP9/WebM o par codec+contêiner passa a SUPORTAR alfa (o
   mediabunny inclusive expõe `alpha: 'keep'` para isso). Mas seria um recurso
   que aparece e some conforme a placa do usuário — presente no Firefox sem
   H.264, ausente no Chrome com ele —, e um botão que existe em metade das
   máquinas é pior que um botão que não existe. Alfa continua sendo assunto do
   `capture.ts`, que entrega PNG em qualquer navegador.

   ÁUDIO. Uma trilha entraria como segunda faixa, vinda de um arquivo que alguém
   teria de escolher, guardar e licenciar — é um produto, não um detalhe.

   GRAVAR EM 7680 COMO A IMAGEM. O quadro tem de nascer no canvas para virar
   `VideoFrame`, e um canvas de 7680 px não é composto pelo viewport. É a
   fronteira real entre este arquivo e o irmão. */
import { Vector3 } from 'three';
import {
  renderer, camera, controls, holder, resize, invalidate, pinFrames, suspendAvoidance,
  setTurntable, isTurntable, setTurntablePeriod, turntableTravel,
  stopLoop, startLoop, renderOfflineFrame, reanchorPaintPixel,
} from './scene';
import { pinCeilingProfile, ceilingProfile, qualityLevel, LEVEL_LABEL } from '../core/quality';
import {
  buildTimelinePath, timelineDuration, timelineCount, suspendTimelineDrivers,
  reassertTimelineMode,
} from './timeline';
import {
  loadOutro, outroDuration, seekOutro, drawOutro, startOutroLive, stopOutroLive,
  OUTRO_FADE,
} from './outro';
import { root } from '../core/dom';
import { hasWebCodecs, openOfflineEncoder, pickOfflineCodec } from './record-encoder';
import type { CodecPick, OfflineEncoder } from './record-encoder';

/* ---------------- o que a interface escolhe ---------------- */

/**
 * `percurso` — o filme que o USUÁRIO autora: pontos de câmera com tempo entre
 *              eles, resolvidos em `scene/timeline.ts`. Substituiu o `livre` e,
 *              depois, o `cinematica`.
 * `volta`    — giro de apresentação sintético, sem nada em tempo real.
 *
 * ⚠️ ERAM TRÊS. O `cinematica` saiu em 2026-08-16 a pedido — *"remova o modo
 * cinemático, não será necessário, já que esse substitui"* —, e o argumento
 * está no bloco § o caminho do modo `percurso`, mais abaixo: ele era um
 * percurso autorado com a decupagem CRAVADA no código, ou seja a mesma coisa
 * que o criador de vídeo faz, sem o botão que deixa o usuário mexer.
 */
export type RecordMode = 'percurso' | 'volta';

/** `viewport` grava o buffer como o teto o deixa; os outros dois o forçam. */
export type RecordResolution = 'viewport' | '1080p' | '1440p';

/* ---------------- o contrato de progresso com a interface ----------------
   `ui/chrome.ts` codifica contra ESTA forma. Ela tem quatro fases porque o
   usuário precisa distinguir quatro esperas de naturezas diferentes — e a
   terceira é a que o desenho novo introduziu: o "loading enorme" que o dono
   aceitou em troca dos 60 fps. Uma barra que não separasse "estou colhendo o
   que você faz" de "estou desenhando 1 080 quadros" faria o segundo parecer um
   travamento. */

export type RecordPhase =
  | 'preparando'    // pino de teto, resolução, primeiro quadro
  /* ⚠️ SÓ NO CAMINHO EM TEMPO REAL (a reserva de `MediaRecorder`). Ela existia
     também para o modo `livre`, que colhia poses enquanto o usuário orbitava;
     com o `percurso` o caminho já existe inteiro antes de a gravação começar,
     então não há mais nada a COLHER — os três modos vão direto de `preparando`
     para `renderizando`. Na reserva a fase continua sendo a verdade: lá o vídeo
     É gravado enquanto a cena roda. */
  | 'gravando'
  | 'renderizando'  // o laço offline: é aqui que mora o "loading enorme"
  | 'finalizando';  // finalize() + montagem do arquivo

export interface RecordProgress {
  phase: RecordPhase;
  /** 0..1 quando há fim previsto; null no `gravando` do modo livre. */
  progress: number | null;
  /** Quadro atual e total, na fase `renderizando`. */
  frame?: number;
  total?: number;
  /** Segundos de PAREDE decorridos. */
  elapsed: number;
  /** Segundos de parede que ainda faltam, quando estimável; null enquanto não for. */
  etaSeconds?: number | null;
  /** Segundos de VÍDEO já prontos — o que o usuário vai assistir. */
  videoSeconds?: number;
}

export type RecordTick = (p: RecordProgress) => void;

export interface RecordOptions {
  mode: RecordMode;
  resolution?: RecordResolution;
  /** Quadros por segundo do ARQUIVO. Padrão 60. */
  fps?: number;
  /**
   * Segundos de uma volta, no modo `volta`.
   *
   * ⚠️ IGNORADO NO `percurso`, e tem de ser: a duração dele é a SOMA dos tempos
   * que o usuário escolheu na linha do tempo, e aceitar um número por fora seria
   * uma segunda fonte para a mesma verdade — a que faz a prévia e o arquivo
   * discordarem.
   */
  lapSeconds?: number;
  /** Progresso. Emitido no máximo ~10×/s — ver `makeTicker()`. */
  onTick?: RecordTick;
}

/* ⚠️ SÃO TRÊS ESTADOS, E NÃO DOIS — a interface tem de saber ler os três.
   A cadeia de codecs (ver `record-encoder.ts`) criou um caso que não existia:

     1. **offline em MP4** — o caminho bom e o comum. `realtime: false`,
        `ext: 'mp4'`. 60 fps garantidos E o arquivo abre em todo lugar.
     2. **offline em WebM** — `realtime: false`, `ext: 'webm'`. Os 60 fps estão
        garantidos do mesmo jeito; o que muda é que o arquivo NÃO abre direto no
        WhatsApp nem no PowerPoint. É uma ressalva de DESTINO, não de qualidade.
     3. **tempo real** — `realtime: true`. A promessa dos 60 fps não vale.

   O par `(realtime, ext)` descreve os três sem campo novo, e é de propósito:
   `ext` já era obrigado a dizer a verdade sobre o contêiner (ver abaixo), então
   uma bandeira separada só criaria uma segunda fonte da mesma verdade, que é
   como as duas se soltam. `ui/chrome.ts` deriva o texto desse par. */
export interface RecordResult {
  blob: Blob;
  /**
   * Extensão do contêiner que de fato saiu, nunca uma presumida.
   *
   * ⚠️ `'mp4'` OU `'webm'`, e quem decide é a sondagem — não há mais um formato
   * fixo. Um WebM batizado de `.mp4` abre no player errado e falha calado, e é
   * por isso que este campo vem de `format.fileExtension` no caminho offline e
   * de `recorder.mimeType` na reserva.
   */
  ext: string;
  mime: string;
  width: number;
  height: number;
  /** Segundos de VÍDEO. No caminho offline é exatamente `quadros / fps`. */
  seconds: number;
  mode: RecordMode;
  /** A taxa do arquivo. */
  fps: number;
  /** `true` quando caiu na reserva e o vídeo saiu em tempo real. */
  realtime: boolean;
  /**
   * O que o usuário precisa saber e não pode ver no arquivo.
   *
   * ⚠️ O CONTÊINER NÃO ENTRA AQUI. Sair em WebM é um fato do RESULTADO, já dito
   * por `ext`, e repeti-lo em `degraded` faria a interface mostrar a mesma
   * ressalva duas vezes (o campo é montado por junção de frases). Este campo é
   * para o que se perdeu na CENA — refletores frios, resolução aparada, gravação
   * truncada.
   */
  degraded?: string;
}

/* ---------------- tetos, e por que existe um de cada ----------------
   O arquivo inteiro fica em memória até o `finalize()` (ver `BufferTarget` em
   record-encoder.ts), então 60 s a ~24 Mbps são ~180 MB. É o limite do que dá
   para segurar e ainda entregar um arquivo que o navegador baixa.

   ⚠️ ESSE TETO MUDOU DE CASA, NÃO DE VALOR. Ele era `MAX_FREE_SECONDS` aqui,
   porque o modo `livre` era o único de duração aberta. Agora quem tem duração
   aberta é o `percurso`, e o teto vive em `MAX_TIMELINE_SECONDS`
   (`scene/timeline.ts`) — onde ele pode ser APLICADO NA EDIÇÃO, aparando o
   campo de segundos na hora em que a pessoa digita, em vez de recusar a
   gravação depois de um fluxo inteiro. Um teto que só aparece no fim é um teto
   que só existe para frustrar.

   O SEGUNDO teto é de TEMPO DE ESPERA: 60 s a 60 fps são 3 600 quadros
   renderizados um a um. Numa integrada a 200 ms por quadro isso são doze
   minutos de "loading". O dono aceitou a espera, mas a interface tem de poder
   dizer QUANTO — daí `etaSeconds` no contrato de progresso, que é a resposta
   honesta a "posso ir tomar café?". */
/** ⚠️ 60, e não os 30 de antes: é o pedido literal do dono. */
const DEFAULT_FPS = 60;
const DEFAULT_LAP_SECONDS = 18;

/** Dimensões forçadas por modo. `viewport` não força nada. */
const RESOLUTIONS: Record<Exclude<RecordResolution, 'viewport'>, [number, number]> = {
  '1080p': [1920, 1080],
  '1440p': [2560, 1440],
};

/* ---------------- taxa de bits ----------------
   ⚠️ **A JUSTIFICATIVA ANTIGA ESTAVA ERRADA, E ERRADA NO SENTIDO QUE CUSTA
   QUALIDADE.** Ela dizia 0,10 bit por pixel por quadro porque este conteúdo
   seria *"o caso fácil para um codec inter-quadro: quase toda a imagem é
   previsível a partir da anterior"*. É o contrário: o FLOCO METÁLICO e a CASCA
   DE LARANJA são detalhe de altíssima frequência que se DESCORRELACIONA entre
   quadros assim que a câmera anda — cada pixel de lataria muda de brilho por
   causa de um grão sub-milimétrico que mudou de ângulo, não por causa de um
   movimento que o codec possa predizer com um vetor. Predição inter-quadro é
   justamente onde este material é PIOR que a média, não melhor. Some a isso a
   chuva, que é ruído por construção.

   ⚠️ **NÚMERO ESTIMADO, NÃO MEDIDO.** É raciocínio de engenharia calibrado
   contra uma referência externa: 0,19 bpp a 1080p60 dá ~23,6 Mbps, que é a
   ordem de grandeza em que uma câmera de celular grava 1080p60 — e o material
   dela (sensor com ruído, câmera na mão) tem o mesmo tipo de dificuldade. Quem
   for MEDIR: renderize a mesma volta a 0,10 / 0,19 / 0,30 bpp e compare a
   lataria em close e a chuva contra o quadro de referência do render offline.

   O piso impede que um viewport pequeno saia com blocagem visível na tinta
   metálica, que é o primeiro lugar em que a compressão aparece neste conteúdo.
   O TETO SUBIU junto com a taxa: 24 Mbps eram o alvo de 1080p60, ou seja o
   antigo teto estrangulava exatamente o caso para o qual ele foi calibrado.
   1440p60 a 0,19 pede ~42 Mbps, e é para isso que 48 existe.

   ⚠️ **O QUE SAI DAQUI É A TAXA DE REFERÊNCIA, E ELA É A DE H.264.** Desde que
   o codificador virou uma CADEIA (`avc` → `vp9` → `av1`, ver o cabeçalho de
   `record-encoder.ts`), o número calculado aqui não é necessariamente o que
   chega ao codificador: cada degrau tem um fator, e quem o aplica é o módulo do
   codificador — que é quem sabe quanto cada codec rende por bit. Este arquivo
   sabe quantos bits o CONTEÚDO pede; aquele sabe traduzir para o codec que
   ganhou. A fronteira está escrita em `EncoderRequest.bitrate`. */
const BITS_PER_PIXEL_FRAME = 0.19;
const MIN_BITRATE = 4_000_000;
const MAX_BITRATE = 48_000_000;

const bitrateFor = (w: number, h: number, fps: number) =>
  Math.round(Math.max(MIN_BITRATE,
    Math.min(MAX_BITRATE, w * h * fps * BITS_PER_PIXEL_FRAME)));

/* Progresso no máximo ~10×/s, e o número não é gosto: repintar a interface a
   cada quadro rouba tempo do render, que é justamente o recurso escasso aqui.
   Num render de 4 ms por quadro, ticar a cada quadro seriam 250 repinturas por
   segundo para uma barra que anda 250 pixels em minuto nenhum. */
const TICK_MS = 100;

/* Quantos quadros o giro leva para ASSENTAR antes de a volta começar a contar.
   `turntableFrame()` recentra a mira e empurra a câmera até a distância de
   abertura com constante de tempo de 0,20 s — ou seja, se a gravação começasse a
   contar no primeiro quadro, o vídeo teria uma aproximação de um segundo no
   começo e a emenda do laço não fecharia em DISTÂNCIA mesmo fechando em ÂNGULO.
   Seis constantes de tempo (1,2 s) levam o resíduo a 0,25 %, e o laço abaixo
   sai antes disso quando a pose já está no lugar (o caso comum: quem acabou de
   abrir o estúdio já está na pose de abertura). */
const SETTLE_SECONDS = 1.2;

/* ---------------- estado ----------------
   Um de cada vez, e o guarda é aqui e não só na UI: `scene/capture.ts` chama
   `stopLoop()` e remexe no tamanho do buffer, o que no meio de uma gravação
   destruiria o arquivo. A UI impede o clique; isto impede o resto. */
let busy = false;
/** Pedido de encerramento vindo de fora. `null` quando não há gravação. */
let stopRequested: ((discard: boolean) => void) | null = null;

/**
 * A bandeira que todas as fases consultam.
 *
 * `parar` e `descartar` são coisas diferentes e o mesmo botão produz as duas em
 * momentos diferentes — ver `stopRecording()`.
 */
type RecordState = 'segue' | 'parar' | 'descartar';

export const isRecording = () => busy;

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
 * ⚠️ **ELE TEM DE CANCELAR O RENDER OFFLINE NO MEIO, e não só a fase de
 * captura.** Um laço de 3 600 quadros pode levar minutos; um botão "parar" que
 * só valesse enquanto o usuário orbita seria um botão morto durante a espera
 * mais longa que este produto tem. O laço confere a bandeira A CADA QUADRO.
 *
 * Parar pelo botão durante o render ENTREGA o que já foi codificado — um vídeo
 * mais curto é uma resposta; um erro não é. Só o descarte joga fora.
 *
 * `discard` existe para a SAÍDA DA ROTA. Sem ele, `unmountStudio()` terminaria a
 * gravação normalmente e o navegador baixaria um arquivo alguns minutos depois
 * de o usuário já estar em outra tela.
 */
export function stopRecording(discard = false) {
  stopRequested?.(discard);
}

/* ---------------- sondagem do caminho de reserva ----------------
   MANTIDA INTEIRA, e não por compatibilidade: é o último degrau da cadeia de
   codificação, depois de H.264, VP9 e AV1 terem sido perguntados e recusados.

   ⚠️⚠️ **E "QUEM CAI AQUI" NÃO É "FIREFOX". ESTA FRASE JÁ ESTEVE ERRADA NESTE
   ARQUIVO E O ERRO CUSTOU UMA CORREÇÃO PÚBLICA.** O `VideoEncoder` do Firefox
   expõe o codificador DA PLATAFORMA, então um Firefox numa máquina com H.264 em
   hardware — AMD VCE, NVIDIA NVENC, Intel QuickSync — pega o caminho offline em
   `avc`/MP4 exatamente como o Chrome. É o caso da máquina do dono (Radeon RX
   570, `H264_HW_ENCODE available` no `about:support`), confirmado por ele
   testando. Quem cai nesta reserva é a máquina que não codifica NENHUM dos três
   formatos da cadeia — e aí não há o que negociar. O argumento completo, com o
   relatório da placa, está no cabeçalho de `record-encoder.ts`.

   A ordem dos candidatos abaixo não é de preferência estética, é de UTILIDADE
   PARA QUEM RECEBE o arquivo. MP4/H.264 é o único que o WhatsApp, o PowerPoint e
   o Instagram aceitam sem conversão — e é para lá que estes vídeos vão.

   `isTypeSupported` é a única forma honesta de escolher: o suporte a MP4 no
   MediaRecorder chegou no Chrome ~126 e no Safari por outro caminho, e um
   `includes('Chrome')` no user agent erraria nos dois sentidos. A extensão do
   arquivo SAI DAQUI, e nunca de um `.mp4` cravado. */
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

/** Um canvas que talvez saiba abrir uma faixa de mídia — só a reserva usa. */
type StreamCanvas = HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream };

/**
 * A gravação é possível neste navegador? Consultado pela UI para esconder o
 * botão, e por isso SÍNCRONO.
 *
 * Dois caminhos independentes: WebCodecs (o offline, o bom) ou
 * captureStream + MediaRecorder (a reserva). Basta um.
 */
export function canRecord(): boolean {
  if (hasWebCodecs()) return true;
  const el = renderer.domElement as StreamCanvas;
  return typeof el.captureStream === 'function' && pickCodec() !== null;
}

/* ---------------- ceder o controle ao navegador ----------------
   ⚠️ UM LAÇO DE 3 600 QUADROS SEM CEDER CONGELA A ABA: a barra de progresso não
   repinta, o botão "parar" não responde e o navegador oferece matar a página.
   Ceder é obrigatório, e a forma de ceder importa:

     · `requestAnimationFrame` — errado aqui. Ele PACEIA no compositor, então um
       quadro que renderiza em 4 ms passaria a custar 16,7 ms e um vídeo de 18 s
       levaria 18 s para renderizar numa máquina que faria em 5. Estamos gastando
       o recurso escasso para não fazer nada.
     · `setTimeout(0)` — errado também. A partir do quinto temporizador aninhado
       os motores forçam 4 ms de piso; 3 600 × 4 ms são 14 s jogados fora.
     · `MessageChannel` — certo. É uma tarefa de MACRO de verdade, sem
       estrangulamento e sem pacing, e entre duas tarefas o navegador roda os
       passos de renderização quando há quadro a apresentar. Custa microssegundos.

   Um canal só para o módulo, com fila de resolvedores: abrir um `MessageChannel`
   por quadro vazaria duas portas por quadro. */
let taskChannel: MessageChannel | null = null;
const taskQueue: (() => void)[] = [];

function nextTask(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof MessageChannel === 'undefined') { setTimeout(resolve, 0); return; }
    if (!taskChannel) {
      taskChannel = new MessageChannel();
      taskChannel.port1.onmessage = () => { taskQueue.shift()?.(); };
    }
    taskQueue.push(resolve);
    taskChannel.port2.postMessage(0);
  });
}

/* Um quadro pintado de verdade. Só a reserva usa, e só para esperar o canvas
   nascer no tamanho novo. Mesma armadilha de `ui/chrome.ts:painted()`:
   `requestAnimationFrame` NÃO DISPARA em aba de segundo plano, e um `await` nele
   pendura a promessa para sempre. O `setTimeout` é o resgate. */
const nextFrame = () =>
  new Promise<void>((resolve) => {
    let done = false;
    const go = () => { if (!done) { done = true; resolve(); } };
    requestAnimationFrame(() => requestAnimationFrame(go));
    setTimeout(go, 250);
  });

/* ---------------- o emissor de progresso ----------------
   Estrangulado, com uma exceção deliberada: mudança de FASE e o último quadro
   passam sempre. Uma barra que engolisse a transição para `finalizando` deixaria
   a interface dizendo "quadro 1080 de 1080" enquanto o muxer trabalha, que é a
   espera que mais parece travamento. */
type TickArgs = Omit<RecordProgress, 'elapsed'>;

function makeTicker(cb: RecordTick | undefined, startedAt: number) {
  let lastAt = -Infinity;
  let lastPhase: RecordPhase | null = null;
  return (p: TickArgs, force = false) => {
    if (!cb) return;
    const now = performance.now();
    if (!force && p.phase === lastPhase && now - lastAt < TICK_MS) return;
    lastAt = now;
    lastPhase = p.phase;
    cb({ ...p, elapsed: (now - startedAt) / 1000 });
  };
}

/* ---------------- o caminho do modo `percurso` ----------------
   AQUI NÃO HÁ NADA, e a ausência é o registro de DUAS remoções.

   1. O MODO `livre` (2026-08-16, manhã). Moravam neste ponto ~140 linhas: a
      struct `Pose`, o `poseAt()` que interpolava esfericamente entre duas
      amostras e o `capturePath()` que colhia a órbita à mão com dois relógios.
      As três existiam para colher um caminho amostrado — e o pedido do dono foi
      o diagnóstico de por que aquilo não tinha conserto: *"assim a câmera será
      suave, não rígida já que manualmente não conseguimos deixar ela suave"*. Em
      vez de SUAVIZAR um caminho trêmulo (o tremor da mão é sinal, não ruído), o
      percurso passou a ser RESOLVIDO a partir de poucos pontos autorados. Quem
      faz isso é `scene/timeline.ts`; este arquivo só avalia a curva em
      `t = i/fps`.

   2. O MODO `cinematica` (2026-08-16, tarde). Moravam aqui outras ~520 linhas:
      a decupagem de seis planos (`CINE_SHOTS`), o `buildCinePath()` que a
      resolvia contra a caixa do conjunto, o `fitDistance()` de oito cantos, o
      `rigFrame()`, o `slerpDir()` e o `ease()`. O pedido foi literal: *"remova o
      modo cinemático, não será necessário, já que esse substitui"*.

      ⚠️ E ELE ESTÁ CERTO, POR UMA RAZÃO QUE VALE FICAR ESCRITA. Aquele modo era
      um percurso autorado — pontos de câmera com tempo entre eles, aceleração
      nas pontas e zoom de lente. É exatamente o que o criador de vídeo faz,
      com uma diferença que decide: a decupagem estava CRAVADA NO CÓDIGO, e o
      usuário não podia mexer em um grau dela. Manter os dois seria manter duas
      implementações do mesmo conceito — e a que ninguém pode ajustar é a que
      envelhece.

      O que ele sabia e o criador herdou está registrado em `timeline.ts`: a
      interpolação em coordenadas esféricas (nunca entre dois pontos
      cartesianos, senão a câmera corta caminho por dentro do caminhão), o zoom
      por LENTE e não por aproximação (as guardas da cena tornam o close-up
      mecanicamente impossível), e o assentamento de dois estágios antes do
      primeiro quadro — que continua vivo, logo abaixo, no ramo do percurso. */


/* ---------------- utilitários pequenos ---------------- */

/** Para baixo, e par. H.264 exige as duas dimensões pares; um buffer de 1501 px
 *  (um holder ímpar num monitor 1x) faria o codificador recusar a faixa.
 *
 *  ⚠️ CONTINUA VALENDO PARA TODA A CADEIA, e não só para o degrau do H.264. VP9
 *  e AV1 aceitam dimensão ímpar (o próprio pacote só recusa ímpar para `avc` e
 *  `hevc`, lido em `src/encode.ts`), mas arredondar SEMPRE é o certo: o degrau
 *  que ganha a sondagem não se conhece na hora de dimensionar o buffer, e um
 *  pixel a menos não custa nada perto de um codificador que recusa a faixa. */
const evenDown = (n: number) => Math.max(2, Math.floor(n / 2) * 2);

/** Junta avisos numa frase só, sem pontuação duplicada. */
function note(list: string[], s: string | undefined | null) {
  if (s) list.push(s);
}

/**
 * O aviso dos botões FRIOS, quando ele é verdade.
 *
 * O pino de teto alcança tudo que é QUENTE. `spotPool`, `shadowType` e
 * `antialias` recompilam a cena, então uma gravação feita fora do nível Alta sai
 * com o pool de refletores e o filtro de sombra daquele nível. É uma exceção
 * conhecida (está escrita em `ceilingProfile()` e em `pinCeilingProfile()`), e a
 * resposta de produto é DIZER, não fingir que não existe.
 */
function coldWarning(): string | null {
  const l = qualityLevel();
  if (l === 'alta') return null;
  return `refletores e filtro de sombra continuam no nível ${LEVEL_LABEL[l]}`
    + ' (mudá-los exigiria recarregar a cena no meio do vídeo)';
}

/* ---------------- O CONTEXTO 3D AINDA ESTÁ VIVO? ----------------
   ⚠️⚠️ ESTA GUARDA NÃO EXISTIA, E A FALTA DELA CUSTOU UM ARQUIVO ENTREGUE COMO
   SUCESSO E COMPLETAMENTE PRETO.

   Quando o navegador perde o contexto WebGL — a placa reinicia, o processo de
   GPU cai, um driver desiste —, `renderer.render()` **sai na primeira linha sem
   erro nenhum**. O laço offline continua rodando: desenha nada, captura nada,
   codifica nada, e no fim entrega um MP4 legítimo, com a duração certa, os
   carimbos certos e todos os quadros pretos. A pessoa só descobre ao abrir.

   Foi assim que um `<video>` com H.264 (a vinheta de encerramento, no
   `chrome-headless-shell`) produziu 240 quadros pretos em 44 KB sem uma única
   mensagem — e o mesmo aconteceria com qualquer outra causa de perda de
   contexto, que é um evento comum o bastante para o WebGL ter um evento próprio.

   Conferida ANTES de abrir o codificador e DE NOVO dentro do laço, esparsa: é
   uma leitura de booleano, mas num laço de 3 600 quadros até isso merece uma
   janela. O primeiro quadro é sempre conferido — se já nasceu morto, não há por
   que renderizar os outros 3 599. */
function contextLost(): boolean {
  const gl = renderer.getContext() as { isContextLost?: () => boolean };
  return typeof gl.isContextLost === 'function' && gl.isContextLost();
}

/** O erro de contexto perdido. Texto de PRODUTO: ele diz o que aconteceu, que o
 *  arquivo teria saído inútil, e o que fazer. */
const CONTEXT_LOST_MSG = 'O navegador perdeu o contexto 3D no meio da gravação — '
  + 'o vídeo sairia todo preto. Recarregue a página e tente de novo.';

/* ---------------- o laço offline, o coração do arquivo ---------------- */

interface RenderLoopArgs {
  enc: OfflineEncoder;
  /** Quantos quadros de vídeo produzir. */
  total: number;
  fps: number;
  /** Chamado ANTES de cada quadro no `percurso`; ausente no `volta`. */
  place?: (i: number) => void;
  tick: ReturnType<typeof makeTicker>;
  /** Consultado a cada quadro. `'parar'` trunca; `'descartar'` aborta. */
  state: () => RecordState;
}

/**
 * Desenha e codifica `total` quadros. Devolve quantos de fato entraram.
 *
 * ⚠️ AS DUAS LINHAS CENTRAIS TÊM DE FICAR COLADAS. `renderOfflineFrame()`
 * desenha no canvas e `enc.add()` agarra o pixel NA CHAMADA; o `await` vem
 * DEPOIS da captura e é só contrapressão do codificador. Um `await` entre elas
 * cede ao compositor, o drawing buffer é descartado (`preserveDrawingBuffer` é
 * false) e o vídeo sai preto. Ver o cabeçalho de `record-encoder.ts`, onde a
 * prova está lida na fonte do pacote.
 */
async function renderLoop(a: RenderLoopArgs): Promise<number> {
  const dt = 1 / a.fps;
  const startedAt = performance.now();
  let done = 0;

  for (let i = 0; i < a.total; i++) {
    const s = a.state();
    if (s === 'descartar') throw new RecordingDiscarded();
    if (s === 'parar') break;

    a.place?.(i);
    renderOfflineFrame(dt);
    /* Ver `contextLost()`: o primeiro quadro sempre, depois de trinta em trinta.
       Um contexto perdido não LANÇA — ele silenciosamente não desenha. */
    if ((i === 0 || i % 30 === 0) && contextLost()) throw new Error(CONTEXT_LOST_MSG);
    await a.enc.add(i * dt, dt);
    done = i + 1;

    /* A estimativa sai do que JÁ FOI, e não de um número de tabela: as máquinas
       em que este laço demora são justamente aquelas cujo desempenho ninguém
       consegue prever. Medida sobre o laço inteiro (e não sobre o último
       quadro), que é o que a torna estável apesar de o custo por quadro variar
       com o que entra em campo. */
    const spent = (performance.now() - startedAt) / 1000;
    a.tick({
      phase: 'renderizando',
      progress: done / a.total,
      frame: done,
      total: a.total,
      etaSeconds: done > 2 ? (spent / done) * (a.total - done) : null,
      videoSeconds: done * dt,
    }, done === a.total);

    /* Uma tarefa de macro por quadro. É o que mantém a aba viva, a barra
       pintando e o botão "parar" clicável — ver `nextTask()`. */
    await nextTask();
  }
  return done;
}

/* ---------------- O LAÇO DA VINHETA ----------------
   Irmão de `renderLoop()`, e as diferenças entre os dois são todas do MESMO
   motivo: aqui o quadro não vem da cena, vem de um `<video>`.

   ⚠️⚠️ A ORDEM DAS TRÊS OPERAÇÕES É O CONTRATO DESTE LAÇO, e ela não é a
   intuitiva:

       await seekOutro(t);        // ASSÍNCRONO, e por isso vem PRIMEIRO
       drawOutro(alpha);          // síncrono: sobe a textura e desenha
       await enc.add(ts, dt);     // agarra o pixel NA CHAMADA

   O `await` de uma busca ENTRE o desenho e o `add()` produziria vídeo preto —
   `preserveDrawingBuffer` é falso e o pixel do canvas só existe até a tarefa
   ceder. É a mesma armadilha que o cabeçalho deste arquivo documenta para
   `renderOfflineFrame()`, e é a razão de a busca ser a primeira coisa.

   ⚠️ E A CENA SÓ É REDESENHADA DURANTE A DISSOLVÊNCIA. Depois dela o
   quadrilátero da vinheta é OPACO e cobre o quadro inteiro, então renderizar a
   cena por baixo seria trabalho jogado fora — e não é pouco: um fecho de 7,8 s a
   60 fps são ~470 quadros, e a cena custa ~24 ms cada nesta bancada. Pular a
   cena troca ~11 s de espera por ~2 s.

   ⚠️ A CÂMERA FICA ONDE PAROU, de propósito. `renderOfflineFrame()` continua
   sendo chamado durante a dissolvência, e a pose é a do ÚLTIMO quadro do
   percurso: a cena congela e a vinheta cresce por cima dela. Deixar a câmera
   andando durante a dissolvência daria um movimento que o percurso não pediu. */
interface OutroLoopArgs {
  enc: OfflineEncoder;
  fps: number;
  tick: ReturnType<typeof makeTicker>;
  state: () => RecordState;
  /** Quantos quadros a cena já emitiu — os carimbos continuam daqui. */
  fromFrame: number;
}

async function outroLoop(a: OutroLoopArgs): Promise<number> {
  const dt = 1 / a.fps;
  const dur = outroDuration();
  const total = Math.max(0, Math.round(dur * a.fps));
  if (!total) return 0;

  const startedAt = performance.now();
  let done = 0;
  for (let i = 0; i < total; i++) {
    const st = a.state();
    if (st === 'descartar') throw new RecordingDiscarded();
    /* "Parar" durante o fecho ENTREGA o que já existe: a cena inteira mais o
       pedaço de vinheta que couber. Um vídeo mais curto é uma resposta. */
    if (st === 'parar') break;

    const t = i * dt;
    /* 1. BUSCAR — assíncrono, e só ele. */
    await seekOutro(t);
    /* ⚠️ E AQUI A GUARDA VALE DOBRADO: decodificar vídeo é justamente uma das
       coisas que derruba um processo de GPU. Ver `contextLost()`. */
    if ((i === 0 || i % 30 === 0) && contextLost()) throw new Error(CONTEXT_LOST_MSG);

    /* 2. DESENHAR — daqui até o `add()` não pode haver `await`. */
    const alpha = OUTRO_FADE > 0 ? Math.min(1, t / OUTRO_FADE) : 1;
    if (alpha < 1) renderOfflineFrame(dt);
    drawOutro(alpha);

    /* 3. CODIFICAR. */
    await a.enc.add((a.fromFrame + i) * dt, dt);
    done = i + 1;

    const spent = (performance.now() - startedAt) / 1000;
    a.tick({
      phase: 'renderizando',
      progress: 1,
      frame: a.fromFrame + done,
      total: a.fromFrame + total,
      etaSeconds: done > 2 ? (spent / done) * (total - done) : null,
      videoSeconds: (a.fromFrame + done) * dt,
    }, done === total);
    await nextTask();
  }
  return done;
}

/**
 * Deixa o giro de apresentação ASSENTAR antes de a volta começar a contar.
 *
 * `turntableFrame()` (scene.ts) faz duas correções com constante de tempo de
 * 0,20 s: recentra a mira no alvo do veículo e empurra a câmera até a distância
 * de abertura, se ela estiver mais perto. Sem assentar antes, o vídeo abriria
 * com uma aproximação de um segundo e — o que importa mais — o primeiro e o
 * último quadro teriam o mesmo ÂNGULO e distâncias DIFERENTES, ou seja a emenda
 * do laço apareceria como um salto de zoom.
 *
 * ⚠️ Estes quadros são renderizados e NÃO entram no vídeo. É o preço, e ele é
 * cobrado no tamanho já forçado (1080p/1440p), então numa integrada são alguns
 * segundos de espera antes da espera. Sai assim que converge, que é imediato no
 * caso comum (a câmera já está na pose de abertura).
 *
 * ⚠️ E ele NÃO PODE ser feito com o giro desligado: `turntableFrame()` sai na
 * primeira linha quando `autoRotate` é falso, ou seja é justamente o giro que
 * traz a câmera para o lugar. Os quadros de assentamento portanto GIRAM — e isso
 * é inofensivo, porque tudo que a volta exige é que os N quadros CONTADOS
 * comecem de uma pose estável, não de um ângulo específico.
 */
function settleTurntable(fps: number, tick: ReturnType<typeof makeTicker>,
  state: () => RecordState) {
  const max = Math.max(1, Math.round(SETTLE_SECONDS * fps));
  const prevTarget = new Vector3(NaN, NaN, NaN);
  let prevRadius = Infinity;
  for (let i = 0; i < max; i++) {
    if (state() === 'descartar') throw new RecordingDiscarded();
    renderOfflineFrame(1 / fps);
    const radius = camera.position.distanceTo(controls.target);
    /* Convergência medida nas DUAS grandezas que o assentamento move — o alvo e
       o raio —, e nunca na posição, que o giro muda todo quadro por construção e
       que portanto nunca "converge". */
    if (Math.abs(radius - prevRadius) < 1e-3
      && controls.target.distanceToSquared(prevTarget) < 1e-6) break;
    prevRadius = radius;
    prevTarget.copy(controls.target);
    tick({ phase: 'preparando', progress: (i + 1) / max });
  }
}

/**
 * Quadros renderizados e NÃO emitidos, para o estado da cena assentar numa pose
 * nova antes de a gravação contar.
 *
 * Serve ao modo cinemático o que `settleTurntable()` serve à volta, e a dívida
 * que ele paga é outra: a DISSOLVÊNCIA dos prédios (`seethrough.ts`) tem rampa
 * de ~550 ms e reage à posição da câmera. O único salto de câmera que o filme
 * tem é o primeiro — da pose em que o usuário deixou a câmera para a pose de
 * abertura —, e sem estes quadros meio bairro dissolveria durante o primeiro
 * segundo do vídeo. Aqui isso acontece fora do arquivo.
 *
 * ⚠️ E ele paga uma segunda dívida, mais sutil: `tuneShadowSpan()` troca a
 * meia-caixa da sombra em 30 m / 24 m com histerese. Chamando isto uma vez na
 * distância MÍNIMA do filme, o passo fechado fica travado antes do primeiro
 * quadro — senão um usuário que estivesse orbitando longe começaria no passo
 * largo e veria a sombra estourar de nitidez no meio do primeiro plano.
 */
function settleFrames(n: number, fps: number, state: () => RecordState) {
  for (let i = 0; i < n; i++) {
    if (state() === 'descartar') throw new RecordingDiscarded();
    renderOfflineFrame(1 / fps);
  }
}

/* ---------------- a reserva: MediaRecorder em tempo real ----------------
   MANTIDA, e mantida INTEIRA. Ela é o que atende Firefox e Safari antigos, onde
   `VideoEncoder` simplesmente não existe. O que ela entrega é honestamente pior
   — o vídeo sai no ritmo da máquina, com os engasgos que o dono reclamou — e é
   por isso que `realtime: true` e `degraded` existem no resultado: a interface
   tem de poder dizer que ESTE vídeo é de outra natureza.

   O que ela GANHOU nesta passagem e não tinha antes: o pino de teto e a
   reancoragem do floco. Os dois são baratos, valem para qualquer caminho, e são
   dois dos três defeitos do relato. */
async function recordRealtime(
  opts: RecordOptions,
  fps: number,
  lap: number,
  tick: ReturnType<typeof makeTicker>,
  state: () => RecordState,
  onStop: (fn: (discard: boolean) => void) => void,
  degraded: string[],
  /** Ver a nota gêmea em `recordOffline()`. */
  temFecho: boolean,
): Promise<RecordResult> {
  const canvas = renderer.domElement as StreamCanvas;
  if (typeof canvas.captureStream !== 'function') {
    throw new Error('Este navegador não sabe gravar o conteúdo de um canvas.');
  }
  const codec = pickCodec();
  if (!codec) throw new Error('Este navegador não tem MediaRecorder.');

  /* O percurso é conduzido AQUI TAMBÉM, e essa é a diferença em relação ao modo
     `livre` que ele substituiu. Lá a reserva simplesmente deixava o usuário
     orbitar enquanto o `MediaRecorder` lia o canvas; aqui o caminho já existe,
     então a mesma `place()` da gravação offline é chamada pelo RELÓGIO DE
     PAREDE. O vídeo continua sendo pior — sai no ritmo da máquina, com os
     engasgos que `realtime: true` confessa —, mas ele mostra o PERCURSO, e não
     uma cena parada esperando alguém mexer. */
  const cap = opts.mode === 'volta'
    /* O teto de uma volta é a própria volta com folga: se o alvo de ângulo não
       chegar (aba que perdeu quadros, usuário que desligou o giro na mão), o
       vídeo tem de terminar assim mesmo em vez de gravar até o teto. */
    ? lap * 1.6
    : Math.max(2, lap * 1.25);

  const undo: (() => void)[] = [];
  const wasTurning = isTurntable();
  let width = canvas.width;
  let height = canvas.height;

  try {
    pinCeilingProfile(true);
    undo.push(() => pinCeilingProfile(false));

    const forced = forceResolution(opts.resolution, degraded);
    if (forced) { width = forced[0]; height = forced[1]; undo.push(() => resize()); }
    else { width = canvas.width; height = canvas.height; }
    reanchorPaintPixel();

    /* Ver o cabeçalho de `pinFrames()` em scene.ts: o que a reserva lê é o canvas
       COMPOSTO, e um quadro que o laço sob demanda decide não desenhar é um
       quadro gravado repetido. Só aqui: o caminho offline para o laço inteiro e
       desenha na mão, então não tem esse problema. */
    pinFrames(true);
    undo.push(() => pinFrames(false));

    /* A VINHETA VALE PARA OS DOIS CAMINHOS. Sem isto, a máquina que cai na
       reserva receberia um vídeo sem fecho e não teria como saber por quê — o
       caminho de codificação é uma descoberta de runtime, não uma escolha. */
    undo.push(() => stopOutroLive());

    let drive: ((seconds: number) => void) | null = null;

    if (opts.mode === 'volta') {
      /* Desligar ANTES de ligar não é redundância: `setTurntable()` só zera o
         contador de ângulo na transição de desligado para ligado, e uma volta que
         começasse com o giro já em curso herdaria o percurso anterior e pararia
         cedo. `damping: false` é o que faz o laço FECHAR. */
      setTurntable(false);
      setTurntablePeriod(lap);
      setTurntable(true, { damping: false });
      undo.push(() => { setTurntable(wasTurning); });
      suspendAvoidance(true);
      undo.push(() => suspendAvoidance(false));
    } else if (opts.mode === 'percurso') {
      const tl = buildTimelinePath();
      if (!tl) throw new Error('Marque pelo menos dois pontos no criador de vídeo.');
      /* O giro ficaria girando POR CIMA das poses escritas — e ao contrário do
         caminho offline, aqui é o laço VIVO que desenha, então o `autoRotate`
         somaria um azimute por quadro ao percurso inteiro. */
      setTurntable(false);
      undo.push(() => { setTurntable(wasTurning); });
      suspendAvoidance(true);
      undo.push(() => suspendAvoidance(false));
      /* ⚠️ A LENTE VOLTA NO DESFAZER, e é a mesma armadilha do caminho offline:
         `resize()` reescreve `aspect` mas NÃO devolve o `fov`, então um percurso
         com zoom deixaria o estúdio com uma teleobjetiva até o próximo F5. */
      const prevFov = camera.fov;
      undo.push(() => {
        if (camera.fov !== prevFov) { camera.fov = prevFov; camera.updateProjectionMatrix(); }
      });
      /* A inércia residual do arrasto seria somada a CADA pose reproduzida —
         ver o cabeçalho de `drainControlsInertia()`. */
      drainControlsInertia();
      tl.place(0);
      drive = (s) => tl.place(s);
    }

    /* Um quadro pintado no tamanho novo ANTES de abrir a faixa: a mudança de
       buffer o deixa em branco, e o `captureStream` fixa as dimensões da faixa no
       momento em que é criado. */
    invalidate();
    await nextFrame();

    const stream = canvas.captureStream(fps);
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, {
      ...(codec.mime ? { mimeType: codec.mime } : {}),
      videoBitsPerSecond: bitrateFor(width, height, fps),
    });
    undo.push(() => {
      /* As faixas ficam vivas depois do `stop()` e seguram o canvas como fonte.
         Sem isto o Chrome mantém o pipeline de captura ligado até a página sair. */
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
       degraus previsíveis e um erro no meio ainda deixa o que já foi gravado. */
    rec.start(1000);

    /* Dois relógios, de propósito. O de ÂNGULO (`turntableTravel`) é quem decide
       a volta: ele mede o que a câmera realmente andou, então uma aba que perdeu
       quadros fecha a volta mesmo assim, só demorando mais. O de PAREDE é o teto.
       `setInterval` e não `requestAnimationFrame` porque numa aba em segundo
       plano o rAF para e a gravação ficaria pendurada. */
    const TWO_PI = Math.PI * 2;
    await new Promise<void>((resolve) => {
      let ended = false;
      let raf = 0;
      const end = (why?: string) => {
        if (ended) return;
        ended = true;
        note(degraded, why);
        clearInterval(timer);
        cancelAnimationFrame(raf);
        /* ⚠️ O `rec.stop()` SAIU DAQUI e foi para depois da vinheta. Ele parava a
           gravação no fim do PERCURSO, e com o fecho tocando em seguida isso
           cortaria exatamente a parte nova. Quem para agora é a linha logo
           depois do bloco da vinheta — e o `finally` cobre os caminhos de erro,
           porque `stop()` num recorder já inativo é inofensivo. */
        resolve();
      };
      onStop(() => end());
      /* ---- o percurso, conduzido pelo RELÓGIO DE PAREDE ----
         ⚠️ `requestAnimationFrame` e não o `setInterval` de 250 ms logo abaixo:
         aquele é o relógio de GUARDA (ele existe porque o rAF não dispara em aba
         de segundo plano), e uma câmera reposicionada quatro vezes por segundo
         seria um vídeo aos saltos. Este roda no quadro que o usuário vê, que é o
         mesmo que o `captureStream` está lendo.
         A pose é escrita ANTES do quadro do laço, então `controls.update()` a lê
         e a devolve aparada — igual ao caminho offline. */
      if (drive) {
        const step = () => {
          if (ended) return;
          drive?.(Math.min(lap, elapsed()));
          raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      }
      const timer = window.setInterval(() => {
        const t = elapsed();
        /* ⚠️ `!== 'segue'` e não `=== 'descartar'`. O botão "parar" entra por
           `onStop()`, que só é ligado algumas linhas acima — um clique que chegue
           ANTES disso (a interface fica clicável desde o começo da preparação)
           marcaria a bandeira sem ninguém para lê-la, e a gravação só terminaria
           no teto de parede. Este relógio é a rede. */
        if (state() !== 'segue') { end(); return; }
        /* Duas fontes de fração, e a diferença é o que cada modo PROMETE. A
           volta promete um ÂNGULO, então quem a mede é o ângulo percorrido — uma
           aba que perdeu quadros fecha a volta assim mesmo, só demorando mais. O
           percurso promete uma DURAÇÃO, e quem a mede é o relógio: a mesma
           parede que está conduzindo a câmera algumas linhas acima. */
        const frac = opts.mode === 'volta'
          ? Math.min(1, Math.abs(turntableTravel()) / TWO_PI)
          : opts.mode === 'percurso'
            ? Math.min(1, t / Math.max(0.1, lap))
            : null;
        tick({
          phase: 'gravando',
          progress: frac,
          videoSeconds: t,
          etaSeconds: frac !== null && frac > 0.02 ? (t / frac) * (1 - frac) : null,
        });
        if (frac !== null && frac >= 1) { end(); return; }
        if (t >= cap) end('a gravação não fechou no tempo previsto');
      }, 250);
    });

    /* ---- A VINHETA, NO RELÓGIO DE PAREDE ----
       ⚠️ AQUI ELA TOCA DE VERDADE, e é o oposto exato do caminho offline. Lá o
       vídeo é montado fora do tempo real e a vinheta é BUSCADA quadro a quadro;
       aqui o `MediaRecorder` carimba pelo relógio de parede (é a natureza da API
       — ver o cabeçalho deste arquivo), então tocar é a única forma de a vinheta
       sair na velocidade certa. Dois relógios, duas naturezas.

       O gancho de sobreposição (`scene/outro.ts`) desenha o quadro corrente em
       cima do laço vivo, e o `captureStream` lê o canvas já com ela.

       ⚠️ SÓ SE A GRAVAÇÃO CHEGOU AO FIM SOZINHA. Um "parar" no botão é o usuário
       dizendo "chega"; emendar sete segundos depois disso seria ignorá-lo. */
    if (temFecho && state() === 'segue' && rec.state === 'recording') {
      await startOutroLive();
      await new Promise<void>((resolve) => {
        const fim = performance.now() + outroDuration() * 1000;
        const timer = window.setInterval(() => {
          if (state() !== 'segue' || performance.now() >= fim) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
      stopOutroLive();
    }

    /* AGORA sim: percurso e fecho já foram para dentro do fluxo. */
    if (rec.state !== 'inactive') rec.stop();
    /* Esperado MESMO no descarte: o `stop()` já foi pedido e as faixas só podem
       ser fechadas depois que o recorder soltar o último pedaço. */
    tick({ phase: 'finalizando', progress: 1 }, true);
    await finished;
    if (state() === 'descartar') throw new RecordingDiscarded();

    const seconds = elapsed();
    /* O tipo EFETIVO, lido do recorder depois do start: quando a sondagem cai no
       ramo de mime vazio, é só aqui que se descobre o que o navegador escolheu. */
    const mime = rec.mimeType || codec.mime || 'video/webm';
    const ext = /mp4/i.test(mime) ? 'mp4' : 'webm';
    const blob = new Blob(chunks, { type: mime });
    if (!blob.size) throw new Error('O navegador devolveu um vídeo vazio.');

    return {
      blob, ext, mime, width, height, seconds, mode: opts.mode, fps,
      realtime: true,
      degraded: degraded.join(' · ') || undefined,
    };
  } finally {
    for (let i = undo.length - 1; i >= 0; i--) {
      try { undo[i](); } catch (e) { console.warn('[record] desfazer falhou', e); }
    }
    invalidate();
  }
}

/* ---------------- forçar a resolução ----------------
   ISTO MEXE NO CANVAS VISÍVEL, e continua sendo a única forma: o quadro tem de
   nascer no canvas do renderizador para virar `VideoFrame`. `updateStyle = false`
   mantém o tamanho em CSS, então o elemento continua ocupando o mesmo espaço no
   layout e o `ResizeObserver` de `mountStudio()` não dispara — o que muda é só o
   buffer, e com uma proporção diferente da do holder o navegador o estica:
   durante a gravação o viewport aparece com tarja. É esperado e é dito na
   interface.

   `setPixelRatio(1)` porque o pedido é "1080p" e não "1080p vezes o DPR do
   monitor": sem isso, num MacBook o buffer sairia 3840 × 2160.

   ⚠️ E TEM DE VIR DEPOIS DO PINO DE TETO. `pinCeilingProfile(true)` emite
   mudança de qualidade, e `applyQualityProfile()` responde com
   `setPixelRatio(effectivePixelRatio())` + `setSize(holder)`. Chamado na ordem
   inversa, ele apagaria estes 1080p sem deixar rastro.

   Devolve as dimensões efetivas, ou `null` quando nada foi forçado (o chamador
   então lê o canvas). */
function forceResolution(res: RecordResolution | undefined, degraded: string[]):
[number, number] | null {
  if (res && res !== 'viewport') {
    const [w, h] = RESOLUTIONS[res];
    const maxDim = renderer.capabilities.maxTextureSize;
    if (w <= maxDim && h <= maxDim) {
      renderer.setPixelRatio(1);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      return [w, h];
    }
    /* ⚠️ NÃO É UM `return` — é uma QUEDA para o caminho do viewport logo abaixo,
       e a diferença já foi um defeito. Saindo aqui, o buffer ficava do tamanho
       que o pino de teto deixou, INCLUSIVE ÍMPAR: H.264 exige as duas dimensões
       pares, e a recusa do codificador é calada (a reserva entregava um arquivo
       de zero byte). Uma placa que não faz 1440p ainda tem de entregar vídeo. */
    note(degraded, 'resolução acima do limite da placa');
  }
  /* `viewport`: o buffer é o que o pino de teto acabou de dimensionar, e só
     precisa ser PAR. Só o que é gravado precisa disso, então o buffer é
     arredondado para baixo e o CSS fica.

     ⚠️ **`setPixelRatio(1)` TAMBÉM AQUI, E NÃO É CÓPIA DESATENTA DO RAMO DE
     CIMA.** `renderer.setSize(w, h, false)` interpreta `w`/`h` em pixels de CSS
     e MULTIPLICA pelo `pixelRatio` corrente; os números daqui já são pixels de
     BUFFER (saíram de `canvas.width`). Num monitor a dpr 2 com um buffer ímpar,
     arredondar 2001 para 2000 e chamar `setSize(2000, …)` produziria um canvas
     de 4000 px — quatro vezes o custo por quadro, para consertar um pixel.
     Fixando a razão em 1, os dois números passam a significar a mesma coisa.

     (E é por isso que a comparação com `canvas.width` vem ANTES: no caso comum,
     em que o buffer já é par, nada é tocado e nem esta armadilha existe.) */
  const canvas = renderer.domElement;
  const w = evenDown(canvas.width);
  const h = evenDown(canvas.height);
  if (w === canvas.width && h === canvas.height) return null;
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  return [w, h];
}

/**
 * Drena a INÉRCIA da órbita antes de o caminho gravado ser reproduzido.
 *
 * ⚠️ O DEFEITO QUE ELA FECHA. `OrbitControls` com `enableDamping` guarda o
 * arrasto do usuário em `_sphericalDelta` e o libera aos poucos: cada
 * `update()` aplica `delta × dampingFactor` e depois encolhe o resto. Se o
 * usuário aperta "parar" ainda arrastando — que é o caso NORMAL —, sobra um
 * delta que o laço offline aplicaria POR CIMA de cada pose reproduzida. Como
 * `renderOfflineFrame()` chama `controls.update(dt)` depois de nós escrevermos a
 * pose, o vídeo sairia com um deslizamento extra no primeiro segundo, e a pose
 * renderizada deixaria de ser a pose colhida.
 *
 * `update(0)` é a forma barata de pagar essa dívida: com `dt` zero o giro de
 * apresentação não anda (`_getAutoRotationAngle(0)` é 0) e nada mais depende do
 * relógio, então o único efeito é o delta decair. Custa microssegundos por
 * chamada — não há render nenhum aqui — e 200 chamadas levam um
 * `dampingFactor` de 0,05 a 3,5·10⁻⁵ do valor original.
 *
 * A câmera SE MOVE durante a drenagem, e isso é irrelevante: o laço escreve a
 * pose do quadro 0 logo em seguida.
 */
function drainControlsInertia() {
  for (let i = 0; i < 200; i++) controls.update(0);
}

/**
 * O tamanho que a gravação PROVAVELMENTE terá, sem mexer em nada.
 *
 * Serve só para sondar o codec ANTES de a gravação tocar na cena — a decisão
 * entre o caminho offline e a reserva tem de acontecer enquanto ainda não há
 * nada a desfazer. Para os presets é exato; para `viewport` é uma estimativa
 * DE CIMA (o holder no `pixelRatioCap` do teto, que é o que o pino vai
 * produzir). Ver `pickOfflineCodec()` para por que uma estimativa basta.
 */
function estimateSize(res: RecordResolution | undefined): [number, number] {
  if (res && res !== 'viewport') return RESOLUTIONS[res];
  const canvas = renderer.domElement;
  const pr = Math.min(window.devicePixelRatio || 1, ceilingProfile().pixelRatioCap);
  const w = evenDown((holder.clientWidth || canvas.width) * pr);
  const h = evenDown((holder.clientHeight || canvas.height) * pr);
  return [w, h];
}

/* ---------------- a entrada ---------------- */

/**
 * Grava a cena e devolve o arquivo.
 *
 * A promessa resolve quando o vídeo está FECHADO e pronto — nunca quando a
 * gravação começa. No modo `volta` a chamada inteira é trabalho de CPU/GPU e
 * pode levar minutos numa máquina fraca; quem chama tem de subir a interface de
 * progresso e viver de `onTick` até lá.
 */
export async function recordScene(opts: RecordOptions): Promise<RecordResult> {
  if (busy) throw new Error('Já existe uma gravação em andamento.');

  const fps = Math.max(15, Math.min(60, Math.round(opts.fps || DEFAULT_FPS)));
  /* ⚠️ NO `percurso` A DURAÇÃO NÃO VEM DE `opts`, ela vem da LINHA DO TEMPO —
     ver a nota de `lapSeconds`. Uma segunda fonte para este número é como a
     prévia e o arquivo passam a ter durações diferentes. */
  const lap = opts.mode === 'percurso'
    ? Math.max(0.5, timelineDuration())
    : Math.max(4, opts.lapSeconds || DEFAULT_LAP_SECONDS);

  /* ⚠️ NENHUM MOTORISTA DO CRIADOR PODE ESTAR VIVO, E ISSO VALE PARA OS TRÊS
     MODOS. O gancho de quadro do criador roda também dentro de
     `renderOfflineFrame()`, então uma prévia tocando — ou o voo de 0,45 s que um
     clique numa miniatura acabou de começar — reescreveria a pose de CADA quadro
     do vídeo, depois de `place()` e antes do `render()`. É o defeito
     intermitente relatado como *"às vezes o vídeo sai com um artefato"*: ele
     depende de o usuário ter clicado num ponto meio segundo antes de gravar.
     Ligado aqui e solto no `finally` — o argumento inteiro está em
     `suspendTimelineDrivers()`. */
  suspendTimelineDrivers(true);

  const startedAt = performance.now();
  const tick = makeTicker(opts.onTick, startedAt);
  const degraded: string[] = [];
  note(degraded, coldWarning());

  /* A BANDEIRA DE ENCERRAMENTO, uma só para as duas fases.
     `stopRequested` é reapontado por quem estiver no comando (a reserva em tempo
     real tem a porta dela), mas o ESTADO é global à gravação — é o que permite
     ao laço offline conferir "parar" a cada quadro sem saber quem pediu.

     ⚠️ O `consumeStop()` QUE MORAVA AQUI FOI EMBORA COM O MODO `livre`, e vale
     dizer o que ele fazia porque a ausência dele é uma SIMPLIFICAÇÃO REAL: o
     mesmo botão mudava de significado no meio da gravação — durante a colheita
     "parar" queria dizer "chega de colher" (e o vídeo saía), durante o render
     queria dizer "trunque aqui". Consumir a bandeira era o truque que permitia
     as duas leituras. Sem colheita não há duas leituras: "parar" durante o
     render trunca, e é a única coisa que ele faz. */
  let flag: RecordState = 'segue';
  const state = () => flag;
  const setStop = (fn?: (discard: boolean) => void) => {
    stopRequested = (discard: boolean) => {
      flag = discard ? 'descartar' : 'parar';
      fn?.(discard);
    };
  };
  setStop();

  busy = true;
  try {
    /* ---- A DECISÃO DE CAMINHO, ANTES DE QUALQUER MUTAÇÃO ----
       Sondada e não presumida, e sondada AQUI porque a reserva faz a própria
       preparação: decidir depois de já ter mexido no buffer obrigaria a desfazer
       para refazer diferente, que é o tipo de caminho que ninguém testa.

       ⚠️ E A SONDAGEM PRECISA DO CANVAS, não só do tamanho. `pickOfflineCodec()`
       confere, antes de perguntar por codec nenhum, se um `VideoFrame` NASCE
       deste canvas — um motor que tenha WebCodecs e recuse a sobrecarga de
       `CanvasImageSource` quebraria na primeira chamada de `add()`, ou seja
       depois de o pino de teto, os 1080p forçados e o `stopLoop()` já terem
       acontecido. Ver o cabeçalho daquela função. */
    const [estW, estH] = estimateSize(opts.resolution);
    const pick = await pickOfflineCodec(renderer.domElement, {
      width: estW, height: estH, fps, bitrate: bitrateFor(estW, estH, fps),
    });

    /* ---- A VINHETA DE ENCERRAMENTO, BAIXADA AQUI E NÃO NA PREPARAÇÃO ----
       ⚠️⚠️ E A POSIÇÃO É O CONSERTO DE UMA GRAVAÇÃO INTEIRA PRETA. A primeira
       versão a baixava no meio da FASE 2, depois de `pinCeilingProfile()`, dos
       1080p forçados e do `stopLoop()` — ou seja, punha uma espera de REDE de
       vários segundos com o estúdio já preparado e o laço parado. Medido na
       bancada: `renderOfflineFrame()` passou a devolver preto em 0,2 ms depois
       daquela espera, e o arquivo saiu com 240 quadros pretos e 44 KB.

       Aqui ela está no MESMO lugar e pelo MESMO motivo que a sondagem de codec
       logo acima: antes de qualquer mutação da cena. Se demorar, demora com o
       estúdio inteiro funcionando e o laço desenhando; se falhar, não há nada a
       desfazer.

       ⚠️ E FALHAR NÃO CANCELA NADA. Quatro minutos de render perdidos por uma
       peça decorativa de 1,5 MB seria a pior troca possível: o vídeo sai sem o
       fecho e a ressalva diz. É a mesma regra do `degraded` para os refletores
       frios.

       ⚠️ A MARCA D'ÁGUA QUE MORAVA NA FASE 2 SAIU (`scene/watermark.ts` foi
       apagado): *"remova a marca d'água durante o vídeo, e coloque ao final esse
       vídeo"*. A troca é boa — um carimbo no canto pesa em TODO quadro e nunca é
       o assunto; uma vinheta no fim pesa em nenhum e é o assunto por sete
       segundos. */
    const temFecho = await loadOutro();
    if (!temFecho) {
      note(degraded, 'a vinheta de encerramento não pôde ser carregada e o vídeo '
        + 'saiu sem ela');
    }

    if (!pick) {
      /* ⚠️ O TEXTO NÃO CULPA O NAVEGADOR, culpa a CAPACIDADE — porque é isso que
         foi medido. Chegar aqui quer dizer que nem H.264, nem VP9, nem AV1
         passaram pela sondagem nesta máquina; não quer dizer "você está no
         Firefox". Ver o bloco da reserva. */
      note(degraded, 'esta máquina não codifica vídeo fora do tempo real em '
        + 'nenhum formato, então o vídeo saiu no ritmo dela e pode ter engasgado');
      return await recordRealtime(opts, fps, lap, tick, state,
        (fn) => setStop(fn), degraded, temFecho);
    }

    return await recordOffline(opts, fps, lap, tick, state, degraded, temFecho, pick);
  } finally {
    busy = false;
    stopRequested = null;
    /* ⚠️ NO `finally` E NÃO NO CAMINHO FELIZ: um erro, um descarte ou uma saída
       de rota no meio da gravação deixariam a prévia muda para sempre — e o
       botão ▶ do criador viraria um botão morto sem nada explicando por quê. */
    suspendTimelineDrivers(false);
    invalidate();
  }
}

/**
 * O caminho bom: sintetizar o percurso e renderizar quadro a quadro fora do
 * tempo real.
 *
 * ⚠️ ELE PERDEU DOIS PARÂMETROS NESTA RODADA (`freeCap` e `consumeStop`), e a
 * perda é a medida do que o modo `livre` custava: os dois existiam SÓ para a
 * fase de colheita em tempo real — o teto de parede e o "parar" que mudava de
 * significado no meio da gravação. Sem colheita, os três modos entram aqui com
 * o caminho já resolvido e o botão de parar tem UM significado do começo ao fim.
 */
async function recordOffline(
  opts: RecordOptions,
  fps: number,
  lap: number,
  tick: ReturnType<typeof makeTicker>,
  state: () => RecordState,
  degraded: string[],
  /** A vinheta já está em memória? Baixada por `recordScene()`, ANTES de a cena
   *  ser tocada — ver a nota lá. */
  temFecho: boolean,
  /** O degrau da cadeia que ganhou a sondagem, resolvido antes de mexer na cena. */
  pick: CodecPick,
): Promise<RecordResult> {
  const canvas = renderer.domElement;
  const wasTurning = isTurntable();
  const undo: (() => void)[] = [];
  let width = canvas.width;
  let height = canvas.height;
  let enc: OfflineEncoder | null = null;

  try {
    /* ---- O DESVIO DAS CONSTRUÇÕES SAI DE CENA ----
       No `volta` o motivo é o de sempre: numa órbita fechada ele vira oscilação
       de altura com o período dos prédios, que é a coisa mais visível de um
       vídeo de 20 s. Ver o cabeçalho de `suspendAvoidance()`.

       ⚠️ NO `percurso` O MOTIVO É OUTRO, E ELE VALE DESDE A AUTORIA. O laço
       vivo aplica a correção DEPOIS dos ganchos de quadro e a deixa aplicada até
       o topo do quadro seguinte — ou seja, um ponto marcado com o desvio ligado
       guarda a pose CORRIGIDA, e a gravação, que roda com ele suspenso,
       reproduziria outra. É por isso que `enterTimelineMode()`
       (`scene/timeline.ts`) já suspende o desvio quando o criador ABRE, e não
       aqui: o que se compõe tem de ser o que se grava. Esta linha é a rede — ela
       cobre o `volta` e uma gravação de percurso disparada com o criador
       fechado.

       ⚠️⚠️ E É POR ISSO QUE `reassertTimelineMode()` EXISTE. `suspendAvoidance`
       é um booleano GLOBAL, não um contador: o `undo` abaixo o devolve para
       `false` sem saber que o criador continua aberto. Sem a reafirmação, o
       desvio voltaria a corrigir as poses do usuário DEPOIS da primeira
       gravação — uma régua que muda no meio do trabalho, em silêncio. */
    suspendAvoidance(true);
    undo.push(() => { suspendAvoidance(false); reassertTimelineMode(); });

    /* ---- FASE 2: PREPARAR ---- */
    tick({ phase: 'preparando', progress: null }, true);

    /* 1. O PINO DE TETO, PRIMEIRO. Ver a sequência no cabeçalho. */
    pinCeilingProfile(true);
    undo.push(() => pinCeilingProfile(false));

    /* 2. A RESOLUÇÃO. */
    const forced = forceResolution(opts.resolution, degraded);
    width = forced ? forced[0] : canvas.width;
    height = forced ? forced[1] : canvas.height;
    if (forced) undo.push(() => resize());

    /* 3. O FLOCO VOLTA AO PIXEL DA IMAGEM FINAL. Depois de forçar, sempre. */
    reanchorPaintPixel();

    /* 4. NADA MAIS DESENHA POR CONTA PRÓPRIA. Mesma doutrina de capture.ts. */
    stopLoop();
    undo.push(() => { if (root.isConnected) startLoop(); });

    /* O giro: ligado e cronometrado no `volta`, DESLIGADO nos outros dois — lá
       as poses vêm de um caminho, e um `autoRotate` vivo giraria por cima
       delas. */
    if (opts.mode === 'volta') {
      setTurntable(false);
      setTurntablePeriod(lap);
      setTurntable(true, { damping: false });
    } else {
      setTurntable(false);
    }
    undo.push(() => { setTurntable(wasTurning); });

    /* ⚠️ A LENTE É RESTAURADA SEMPRE, e por isso é guardada aqui e não dentro do
       modo cinemático: `camera.fov` é a única coisa que aquele modo muda na
       câmera e que `resize()` NÃO devolve — ele reescreve `aspect` e recalcula a
       projeção, e um `fov` de 13° sobreviveria à gravação inteira. O estúdio
       ficaria com uma teleobjetiva até o próximo recarregamento, e nada na
       interface explicaria por quê. */
    const prevFov = camera.fov;
    undo.push(() => {
      if (camera.fov !== prevFov) { camera.fov = prevFov; camera.updateProjectionMatrix(); }
    });

    let total: number;
    let place: ((i: number) => void) | undefined;

    if (opts.mode === 'volta') {
      settleTurntable(fps, tick, state);
      /* ⚠️ `N = round(lap × fps)` E EMITIMOS OS N, sem tirar o último.
         `renderOfflineFrame()` chama `controls.update(dt)` ANTES de desenhar,
         então o quadro `i` já está no ângulo `θ₀ + (i+1)·2π/N`. Os N quadros
         cobrem portanto os N ângulos distintos do círculo, e o último cai
         exatamente em `θ₀` — que é o ângulo do quadro que viria depois do
         primeiro se o vídeo continuasse. Emenda exata, sem quadro repetido.
         Tirar um quadro aqui é que criaria um salto de `2×2π/N` no laço. */
      total = Math.max(2, Math.round(lap * fps));
    } else {
      /* ---- O PERCURSO DO USUÁRIO ----
         A curva já existe: ela foi resolvida em `scene/timeline.ts` na hora em
         que a linha do tempo foi montada, e a prévia que o usuário assistiu
         chamou ESTA MESMA `place()`. É por isso que não há nada a colher aqui —
         o vídeo é a prévia, renderizada devagar.

         ⚠️ A RECUSA É UM ERRO E NÃO UMA QUEDA PARA A VOLTA. O cinemático cai
         para a volta quando não há veículo em cena porque o problema é DA CENA e
         o usuário não pediu aquele percurso em particular. Aqui o usuário
         desenhou um percurso: entregar-lhe um giro em vez dele seria trocar o
         trabalho da pessoa por outro sem avisar. A interface já impede o clique
         com menos de dois pontos; isto é a rede de baixo. */
      const tl = buildTimelinePath();
      if (!tl) {
        throw new Error(timelineCount() === 0
          ? 'Nenhum ponto marcado — abra o criador de vídeo e marque o percurso.'
          : 'Marque pelo menos dois pontos para o vídeo ter movimento.');
      }
      total = Math.max(2, Math.round(tl.duration * fps));
      place = (i: number) => tl.place(i / fps);
      /* A dívida de inércia é paga ANTES da primeira pose — ver a função. */
      drainControlsInertia();
      /* ⚠️ OS DOIS ASSENTAMENTOS, NA MESMA ORDEM DO CINEMÁTICO E PELAS MESMAS
         DUAS DÍVIDAS: primeiro a pose mais PRÓXIMA, que trava `tuneShadowSpan()`
         no passo fechado (senão uma órbita distante herdaria o passo largo e a
         sombra estouraria de nitidez no meio do vídeo); depois a de abertura,
         onde a dissolvência das construções assenta. Estes quadros são
         renderizados e NÃO entram no arquivo. */
      tl.place(tl.minDistAt);
      settleFrames(2, fps, state);
      place(0);
      settleFrames(Math.max(2, Math.round(0.7 * fps)), fps, state);
      if (tl.maxDist > 30 && tl.minDist < 24) {
        note(degraded, 'o percurso cruza o limiar de 30 m e a caixa de sombra'
          + ' troca de passo no meio');
      }
    }

    /* ---- FASE 3: RENDERIZAR ----
       ⚠️ A TAXA É RECALCULADA COM O TAMANHO REAL, e o `pick` é o MESMO objeto
       que a sondagem devolveu. Os dois pontos importam: a sondagem rodou com uma
       ESTIMATIVA de tamanho (o caso `viewport` só se conhece depois do pino de
       teto), então a taxa daqui é a boa; e reescolher o codec agora é que
       reintroduziria a divergência entre o que foi perguntado e o que é usado.
       O fator por codec é aplicado lá dentro — ver `EncoderRequest.bitrate`. */
    const bitrate = bitrateFor(width, height, fps);
    /* ANTES de abrir o codificador: um contexto já perdido produziria um arquivo
       inteiro de quadros pretos, e o lugar de descobrir isso é aqui. */
    if (contextLost()) throw new Error(CONTEXT_LOST_MSG);
    enc = await openOfflineEncoder(canvas, { width, height, fps, bitrate }, pick);
    if (!enc) throw new Error('O codificador de vídeo não abriu neste navegador.');

    tick({
      phase: 'renderizando', progress: 0, frame: 0, total, videoSeconds: 0,
    }, true);
    const done = await renderLoop({ enc, total, fps, place, tick, state });
    if (done < 1) throw new RecordingDiscarded();
    if (done < total) {
      note(degraded, `parado no quadro ${done} de ${total}`);
    }

    /* ---- FASE 3B: A VINHETA ----
       Só quando a cena foi ATÉ O FIM. Um vídeo truncado pelo botão "parar" é o
       usuário dizendo "chega"; emendar sete segundos de fecho depois disso seria
       ignorá-lo. */
    let doneOutro = 0;
    if (temFecho && done >= total) {
      doneOutro = await outroLoop({
        enc, fps, tick, state,
        /* Os carimbos CONTINUAM de onde a cena parou: o arquivo é uma faixa só,
           e um relógio que reiniciasse aqui daria um vídeo com dois começos. */
        fromFrame: done,
      });
    }
    const totalFrames = done + doneOutro;

    /* ---- FASE 4: FECHAR O ARQUIVO ----
       O muxer escreve o `moov` inteiro aqui (ver `fastStart` em
       record-encoder.ts), e num vídeo de milhares de quadros isso não é
       instantâneo. Merece fase própria: é a espera que mais parece travamento,
       porque a barra já está em 100 %. */
    tick({
      phase: 'finalizando', progress: 1, frame: totalFrames,
      total: total + Math.round(temFecho ? outroDuration() * fps : 0),
      videoSeconds: totalFrames / fps,
    }, true);
    const file = await enc.finish();
    enc = null;

    return {
      blob: file.blob,
      ext: file.ext,
      mime: file.mime,
      width,
      height,
      seconds: totalFrames / fps,
      mode: opts.mode,
      fps,
      realtime: false,
      degraded: degraded.join(' · ') || undefined,
    };
  } finally {
    /* O codificador primeiro: se chegamos aqui com ele aberto, é porque algo
       falhou ou foi descartado, e um `VideoEncoder` de hardware não solto é um
       recurso EXCLUSIVO preso até a coleta de lixo — a próxima gravação falharia
       sem explicação. `abort()` nunca lança. */
    if (enc) { void enc.abort(); }
    /* Ao contrário: cada passo desfaz o seu, na ordem inversa da aplicação. Um
       passo que não chegou a rodar não tem o que desfazer, e é por CONSTRUÇÃO
       que não desfaz — que é a parte que uma lista de `prev` sempre erra quando
       alguém acrescenta um passo no meio. */
    for (let i = undo.length - 1; i >= 0; i--) {
      try { undo[i](); } catch (e) { console.warn('[record] desfazer falhou', e); }
    }
  }
}
