/* O CODIFICADOR DE VÍDEO — WebCodecs por baixo, mediabunny por cima.
   ===========================================================================
   ESTE MÓDULO NÃO SABE NADA SOBRE A CENA, e é essa a razão de ele existir
   separado de `scene/record.ts`. Ele recebe um canvas, um tamanho, uma taxa e
   uma taxa de bits, e devolve um arquivo de vídeo. Quem decide QUANDO desenhar,
   o que desenhar e com que `dt` o mundo anda é o irmão.

   ---------------------------------------------------------------------------
   ⚠️⚠️ A ARMADILHA QUE GOVERNA A FORMA DESTE ARQUIVO INTEIRO

   `scene/scene.ts:263` cria o renderizador SEM `preserveDrawingBuffer`. Isso
   quer dizer que o conteúdo do canvas WebGL só é legível **no mesmo passo de
   execução do `render()`** — assim que a tarefa cede ao compositor, o buffer
   pode ser (e é) descartado. Logo:

       O `render()` E A CAPTURA DO PIXEL TÊM DE ESTAR NA MESMA TAREFA SÍNCRONA.

   Um `await` entre os dois produz vídeo PRETO, ou preto de forma intermitente
   (que é pior, porque parece "um bug de driver" em vez de um erro de ordem).

   POR ISSO A LEITURA DA FONTE, E NÃO A DOCUMENTAÇÃO. Conferido em
   `node_modules/.pnpm/mediabunny@1.54.0/.../src/media-source.ts`,
   `CanvasSource.add()` NÃO é `async`: o corpo dele constrói o quadro ANTES de
   qualquer promessa —

       add(timestamp, duration = 0, encodeOptions?) {
         …validação…
         const sample = new VideoSample(this._canvas, { timestamp, duration });
         return this._encoder.add(sample, true, encodeOptions);
       }

   — e `VideoSample`, quando recebe um `HTMLCanvasElement`, é síncrono nos DOIS
   ramos que existem (`src/sample.ts:517..609`, o ramo `CanvasImageSource`):

     · com WebCodecs, faz literalmente `new VideoFrame(data, …)`, que por
       especificação COPIA o conteúdo do canvas no ato da construção;
     · sem WebCodecs, cai num `new OffscreenCanvas()` + `context.drawImage(data)`
       — que também agarra o pixel na hora, sem `await` nenhum no caminho.

   Ou seja: o pixel é agarrado de forma SÍNCRONA na chamada, e a promessa
   devolvida é só a contrapressão. Portanto o padrão correto, e o único que este
   módulo aceita, é:

       renderOfflineFrame(dt);            // desenha
       await enc.add(t, 1 / fps);         // agarra AQUI, depois espera

   O `await` está DEPOIS da captura, não entre ela e o desenho. Se um dia o
   pacote mudar isso, o caminho de resgate é construir o `VideoFrame` na mão
   logo após o render e alimentar um `VideoSampleSource` com `new
   VideoSample(frame)` — as duas classes existem no pacote e a troca é local a
   este arquivo.

   ---------------------------------------------------------------------------
   AS UNIDADES, CONFERIDAS NA FONTE E NÃO PRESUMIDAS

   O WebCodecs cru trabalha em MICROSSEGUNDOS; o mediabunny trabalha em
   SEGUNDOS e converte na fronteira (`Math.trunc(init.timestamp *
   SECOND_TO_MICROSECOND_FACTOR)` em `src/sample.ts`). Um fator de 10⁶ errado
   aqui produz um arquivo de 0,000018 s que abre em qualquer player e não toca —
   um modo de falha que passa por "o codec não presta". `add()` e o `duration`
   deste módulo são, portanto, SEGUNDOS.

   ⚠️ **`new Quality(numero)` NÃO É UMA TAXA DE BITS.** Está em
   `src/encode.ts`: um número vira `{ quality: numero }`, ou seja um NÍVEL
   qualitativo (0..1), não bits por segundo. A forma correta de pedir uma taxa é
   `new Quality({ bitrate, bitrateMode })`, e `bitrate` tem de ser INTEIRO
   POSITIVO (o pacote recusa fracionário). O campo `bitrate` solto de
   `VideoEncodingConfig` ainda existe mas está `@deprecated`.

   ---------------------------------------------------------------------------
   A CONTRAPRESSÃO JÁ VEM RESOLVIDA, e é por isso que este arquivo não tem fila

   `VideoEncoderWrapper.add()` (`src/media-source.ts`) espera o evento `dequeue`
   sempre que `encoder.encodeQueueSize >= 4`. Cada `VideoFrame` vivo segura
   memória de GPU; empilhar mil derruba a aba. Como `add()` já bloqueia, quem
   chamar `await enc.add(...)` a cada quadro nunca tem mais que ~5 quadros no ar,
   sem escrever uma linha de fila. **Não tirar o `await`.**

   ---------------------------------------------------------------------------
   POR QUE O PACOTE ENTRA POR `import()` DINÂMICO

   O gravador é apertado algumas vezes por dia; os muxers e o registro de codecs
   são carga morta no primeiro pintar da rota. O `import()` põe tudo num pedaço
   próprio, que só é baixado no primeiro clique em "Gravar" — e dá de graça a
   última rede de segurança: se o pedaço não carregar (rede caiu, bloqueador de
   conteúdo), a falha é uma promessa rejeitada que `record.ts` trata caindo na
   reserva do `MediaRecorder`, em vez de uma tela branca.

   ===========================================================================
   § A CADEIA DE CODECS — O QUE ESTA PASSAGEM ACRESCENTOU
   ===========================================================================
   A versão anterior cravava `const CODEC = 'avc'`, com a justificativa (correta
   EM SI) de que H.264/MP4 é o único que o WhatsApp, o PowerPoint e o Instagram
   aceitam sem conversão. O erro não era o argumento, era ele ser a ÚNICA opção:
   um navegador que não codifique H.264 por WebCodecs não ganhava um segundo
   formato, ganhava a **reserva de `MediaRecorder` em tempo real** — que é o
   caminho que carimba pelo relógio de parede e produz exatamente o engasgo que
   o dono pediu para não existir.

   ⚠️ **A REGRA QUE ORDENA A FILA, e ela não é "o mais portátil primeiro":**

       Entre um formato mais PORTÁTIL e a garantia dos 60 fps, a garantia ganha.

   Porque a alternativa nunca foi "MP4 liso" contra "WebM liso". Foi "MP4 liso"
   contra "**WebM engasgado**" — a reserva do Firefox só produz WebM de qualquer
   forma. Um WebM offline a 60 fps é melhor que um WebM em tempo real nos DOIS
   eixos: mesma portabilidade, fluidez incomparável. O único preço real é a
   conversão na hora de postar, e isso a interface diz.

   ---------------------------------------------------------------------------
   ⚠️⚠️ `avc` É O PRIMEIRO DA FILA E ISSO É DELIBERADO — não é herança da versão
   antiga que ninguém revisou. O caso concreto que fixou a ordem é a máquina do
   dono, lida do `about:support` dela:

       H264_HW_ENCODE   available          ← Radeon RX 570 (Polaris, VCE)
       VP9_HW_ENCODE    blocklisted        FEATURE_FAILURE_VIDEO_ENCODING_MISSING
       AV1_HW_ENCODE    blocklisted        FEATURE_FAILURE_VIDEO_ENCODING_MISSING

   O silício explica o relatório: a VCE do Polaris faz H.264 e HEVC e NÃO faz
   VP9 nem AV1. Ou seja, NESTA máquina descer para `vp9` seria trocar um
   codificador de **hardware** por um de **software** — mais lento e pior, para
   ganhar um contêiner que abre em menos lugares. Um duplo prejuízo.

   ⚠️ E É POR ISSO QUE A SONDAGEM É POR CAPACIDADE E NUNCA POR NAVEGADOR.
   `canEncodeVideo()` quase certamente responde `true` para `vp9` mesmo nesta
   máquina, porque o Firefox traz um codificador de SOFTWARE — a sondagem não
   distingue hardware de software. Logo, qualquer atalho do tipo "se é Firefox,
   prefira WebM" entregaria justamente o pior caminho na máquina do dono. A fila
   é FIXA e a pergunta é sempre a mesma: *este navegador codifica isto?*

   ⚠️ E NÃO TENTAMOS PEDIR HARDWARE. `VideoEncoderConfig.hardwareAcceleration`
   aceita `'prefer-hardware'`, mas é uma DICA: a especificação não promete que
   `isConfigSupported()` recuse um codificador de software quando ela está
   ligada, e não existe leitura de volta que diga "isto vai rodar em silício".
   Pedir hardware, portanto, não melhoraria a decisão e pode PIORÁ-LA: um motor
   que interprete a dica ao pé da letra recusaria `avc` numa máquina que só tem
   H.264 por software — e a rebaixaria para VP9 sem necessidade. Fica no padrão
   (`'no-preference'`), e a ordem fixa entrega o resultado certo sozinha.

   ---------------------------------------------------------------------------
   ⚠️ QUEM CAI NA RESERVA, DITO COM PRECISÃO (e este parágrafo já esteve errado)

   **NÃO é "Firefox".** Firefox numa máquina com codificador de H.264 de
   plataforma — AMD VCE, NVIDIA NVENC, Intel QuickSync — pega o caminho bom, em
   `avc`/MP4, exatamente como o Chrome. É o caso do dono, e ele confirmou o
   resultado testando.

   Quem cai na reserva é a máquina que não tem codificador para **nenhum** dos
   formatos da cadeia: nem H.264, nem VP9, nem AV1. É uma máquina sem WebCodecs
   de codificação útil, e aí não há o que negociar — o vídeo sai em tempo real e
   a interface confessa.

   ---------------------------------------------------------------------------
   A FILA, e o argumento de cada degrau

     1. `avc` em MP4  — o destino final do arquivo (WhatsApp, PowerPoint,
        Instagram) e, no caso comum, o único com codificador de hardware. Chrome,
        Edge, Safari e o Firefox do dono param aqui.
     2. `vp9` em WebM — o degrau seguinte porque é o mais VELHO dos dois que
        sobram: um codificador de VP9 existe em praticamente todo motor que
        tenha WebCodecs, e um decodificador de VP9 existe em todo lugar que
        toque WebM. AV1 antes dele trocaria compatibilidade por eficiência num
        ponto em que já estamos negociando compatibilidade.
     3. `av1` em WebM — só se o VP9 recusar. Melhor por bit, mas o codificador é
        mais raro e, quando é de software, é MUITO mais lento.
     4. a reserva em tempo real, em `record.ts`.

   ⚠️ CONFERIDO NA FONTE, e não presumido dos nomes (`src/output-format.ts`):
   `WebMOutputFormat` existe e é exportado pelo índice do pacote; ele estende
   `MkvOutputFormat`; e o `getSupportedCodecs()` dele é exatamente

       VIDEO_CODECS.filter(c => ['vp8', 'vp9', 'av1'].includes(c))

   ou seja **H.264 não cabe em WebM** e VP9/AV1 não cabem em MP4 sem sair do
   padrão. Por isso cada degrau da fila carrega o SEU contêiner, e por isso o
   `getSupportedCodecs()` do formato é consultado antes da sondagem: pedir uma
   combinação inválida ao `Output` lança — e lançaria DEPOIS de a cena já ter
   sido mexida, que é o pior momento possível.

   ---------------------------------------------------------------------------
   ⚠️ A EXTENSÃO E O TIPO SAEM DO CONTÊINER QUE GANHOU, SEMPRE

   Um WebM com nome `.mp4` é um arquivo que abre no player errado e falha calado
   — o Windows dá miniatura, o PowerPoint aceita e depois não toca. É a mesma
   doutrina que a reserva de `record.ts` já seguia com `recorder.mimeType`, e
   aqui ela sai de `format.fileExtension` e `output.getMimeType()`, nunca de um
   literal. (`fileExtension` vem COM ponto — `'.mp4'`, `'.webm'` —, e o ponto é
   tirado aqui porque `EncodedVideo.ext` é o pedaço solto que `chrome.ts` cola
   no nome do arquivo.) */

/** Os codecs que esta cadeia sabe pedir. Subconjunto de `VideoCodec` do pacote. */
export type OfflineCodec = 'avc' | 'vp9' | 'av1';

/** Os contêineres que esta cadeia sabe montar. */
export type OfflineContainer = 'mp4' | 'webm';

/** O que o gravador pede a este módulo. Nada aqui vem da cena. */
export interface EncoderRequest {
  /** Largura do buffer, em pixels. PAR — ver `evenDown()` em record.ts. */
  width: number;
  /** Altura do buffer, em pixels. PAR. */
  height: number;
  /** Quadros por segundo do arquivo. */
  fps: number;
  /**
   * Bits por segundo DE REFERÊNCIA — calibrados para H.264, que é o degrau 1.
   *
   * ⚠️ NÃO é necessariamente a taxa que o codificador vai receber: cada degrau
   * da cadeia tem um `bitrateFactor` (ver `CHAIN`), e quem aplica é este módulo,
   * não `record.ts`. É a divisão de trabalho do arquivo — a cena calcula quantos
   * bits o CONTEÚDO pede, o codificador sabe quanto cada codec rende por bit.
   */
  bitrate: number;
}

/** O arquivo pronto. `ext` e `mime` saem do contêiner de verdade, nunca de um
 *  `.mp4` cravado — ver a doutrina no cabeçalho. */
export interface EncodedVideo {
  blob: Blob;
  mime: string;
  ext: string;
}

/**
 * O degrau da cadeia que GANHOU a sondagem. Atravessa de `pickOfflineCodec()`
 * até `openOfflineEncoder()`, e é o que a interface usa para dizer a verdade
 * sobre o formato.
 */
export interface CodecPick {
  codec: OfflineCodec;
  container: OfflineContainer;
  /** Sem ponto: `'mp4'`, `'webm'`. Ver a doutrina da extensão no cabeçalho. */
  ext: string;
  /** Para log e interface: `'H.264 em MP4'`. */
  label: string;
  /** Multiplicador da taxa de referência. Ver § TAXA DE BITS POR CODEC. */
  bitrateFactor: number;
}

/**
 * Um codificador aberto. Vive entre `openOfflineEncoder()` e `finish()`/`abort()`.
 *
 * ⚠️ `add()` agarra o canvas NA CHAMADA (ver o cabeçalho). O `await` que se faz
 * no valor devolvido é contrapressão, não captura.
 */
export interface OfflineEncoder {
  /** Codifica o estado ATUAL do canvas. Tempos em SEGUNDOS. */
  add(timestamp: number, duration: number): Promise<void>;
  /** Fecha o arquivo e devolve o Blob. */
  finish(): Promise<EncodedVideo>;
  /** Solta o codificador sem produzir arquivo. Nunca lança. */
  abort(): Promise<void>;
}

/* ---------------- § TAXA DE BITS POR CODEC ----------------
   ⚠️ **OS DOIS FATORES SÃO ESTIMADOS, NÃO MEDIDOS.** A taxa de referência
   (0,19 bpp, em `record.ts`) foi calibrada contra H.264. VP9 e AV1 rendem mais
   por bit, e a literatura de BD-rate costuma dar ~30–50 % para VP9 sobre H.264 e
   outro tanto para AV1 sobre VP9.

   ⚠️ **E OS NÚMEROS ABAIXO SÃO DE PROPÓSITO MAIS TÍMIDOS QUE A LITERATURA.** O
   motivo é o mesmo que já reescreveu a justificativa da taxa em `record.ts`:
   este conteúdo é FLOCO METÁLICO e CHUVA, ou seja detalhe de altíssima
   frequência que se descorrelaciona entre quadros. Os ganhos de BD-rate são
   medidos em sequências de teste comuns, e vêm em boa parte de predição e
   transformadas grandes — ferramentas que ajudam MENOS em conteúdo parecido com
   ruído, onde todo codec converge para "gastar bits". Reivindicar 50 % aqui
   seria transportar um número de fora do seu domínio.

   A troca, dita por inteiro: um arquivo um pouco maior que o ótimo é um
   incômodo; blocagem na lataria metálica é o defeito que o dono relatou e que
   esta passagem inteira existe para não reintroduzir. Na dúvida, gastar bits.

   ⚠️ E O PISO DE 4 Mbps DE `record.ts` NÃO É REAPLICADO DEPOIS DO FATOR, DE
   PROPÓSITO. Ele existe para impedir blocagem visível num viewport pequeno; se
   o fator está calibrado para preservar QUALIDADE, então escalá-lo preserva a
   INTENÇÃO do piso. 3,4 Mbps de VP9 valem os 4 Mbps de H.264 que o piso queria
   — é o mesmo argumento, aplicado de forma consistente. Reaplicar o piso em
   número absoluto seria dizer que o fator vale para o teto e não para o chão.

   QUEM FOR MEDIR: grave a mesma volta nos três codecs e compare a lataria em
   close e a chuva contra o quadro de referência do render offline. */
const VP9_BITRATE_FACTOR = 0.85;
const AV1_BITRATE_FACTOR = 0.75;

/**
 * A FILA. A ordem é a do bloco § A CADEIA DE CODECS e não deve ser reordenada
 * sem ler o argumento do `avc` em primeiro lugar — ele é hardware na máquina do
 * dono, e os dois seguintes não são.
 */
const CHAIN: readonly CodecPick[] = [
  { codec: 'avc', container: 'mp4', ext: 'mp4', label: 'H.264 em MP4', bitrateFactor: 1 },
  { codec: 'vp9', container: 'webm', ext: 'webm', label: 'VP9 em WebM', bitrateFactor: VP9_BITRATE_FACTOR },
  { codec: 'av1', container: 'webm', ext: 'webm', label: 'AV1 em WebM', bitrateFactor: AV1_BITRATE_FACTOR },
];

/**
 * `latencyMode` do codificador, num só lugar porque ele tem de ser IDÊNTICO na
 * sondagem e na abertura.
 *
 * ⚠️ **E ISSO É UM CONSERTO, NÃO ARRUMAÇÃO.** A versão anterior sondava sem
 * `latencyMode` e abria com `'quality'`, ou seja perguntava por uma configuração
 * e usava outra. Um motor que aceitasse a primeira e recusasse a segunda faria o
 * `openOfflineEncoder()` lançar DEPOIS de a cena já ter sido mexida — que é
 * justamente o modo de falha que a sondagem existe para não ter. Conferido em
 * `src/encode.ts`: `canEncodeVideo()` recebe `VideoEncodingAdditionalOptions`, e
 * `latencyMode` está lá, então dá para perguntar exatamente o que se vai usar.
 *
 * `'quality'` é também o padrão do pacote, e está escrito porque o outro valor —
 * `'realtime'` — **PODE DESCARTAR QUADROS** quando o codificador satura. O
 * desenho inteiro deste gravador existe para que nenhum quadro se perca; um modo
 * que os descarta em silêncio destruiria a promessa no lugar mais difícil de
 * perceber (um vídeo com 1 079 quadros em vez de 1 080 continua abrindo).
 */
const LATENCY_MODE = 'quality' as const;

/**
 * O navegador tem WebCodecs? Sondagem SÍNCRONA, para a interface poder decidir
 * antes de qualquer promessa.
 *
 * Escrito contra `globalThis` e não como `typeof VideoEncoder` porque este
 * repositório não instala `@types/dom-webcodecs` na raiz (o pacote traz o dele,
 * dentro do próprio `node_modules`), então o identificador global não existe
 * para o compilador — e um `declare global` só para um teste de existência
 * seria mentir sobre a API inteira.
 */
export function hasWebCodecs(): boolean {
  const g = globalThis as { VideoEncoder?: unknown; VideoFrame?: unknown };
  return typeof g.VideoEncoder === 'function' && typeof g.VideoFrame === 'function';
}

/* O mínimo do `VideoFrame` que este módulo usa. Mesma razão do `globalThis`
   acima: declarar a API inteira seria mentir; declarar o construtor que de fato
   se chama é honesto e é o bastante para o compilador. */
type FrameLike = { close(): void };
type VideoFrameCtor = new (
  source: HTMLCanvasElement,
  init: { timestamp: number },
) => FrameLike;

/**
 * Este navegador constrói um `VideoFrame` A PARTIR DESTE CANVAS?
 *
 * ⚠️ **É UMA PERGUNTA DIFERENTE DE `hasWebCodecs()`, E A DIFERENÇA JÁ TEM DONO.**
 * `hasWebCodecs()` só confere que os dois construtores EXISTEM. Mas o quadro
 * deste gravador nasce de um `HTMLCanvasElement` — e um motor que tenha
 * `VideoFrame` e recuse a sobrecarga de `CanvasImageSource` passaria pela
 * primeira pergunta e quebraria na primeira chamada de `add()`, ou seja **depois
 * de a cena já ter sido mexida**: perfil de teto pinado, buffer forçado a 1080p,
 * laço parado. Falhar depois de mexer é estritamente pior que falhar antes,
 * porque o usuário vê o estúdio se contorcer para nada.
 *
 * ⚠️ E ISTO NÃO É COBERTO PELA SONDAGEM DO PACOTE. Lido em `src/encode.ts`: no
 * Firefox, `canEncodeVideo()` não confia no `isConfigSupported()` e chega a
 * codificar um quadro de teste de verdade — mas o quadro dele nasce de um
 * `Uint8Array` com `format: 'RGBA'`, que é a OUTRA sobrecarga do construtor.
 * Aquilo prova o `VideoEncoder`; isto prova o caminho canvas → `VideoFrame`. São
 * provas de coisas diferentes e as duas fazem falta.
 *
 * O quadro é fechado no ato: um `VideoFrame` vivo segura memória de GPU.
 *
 * ⚠️ Canvas sem tamanho devolve `true`, e não `false`. Um canvas 0 × 0 faz o
 * construtor lançar por um motivo que nada tem a ver com suporte (o estúdio
 * ainda não foi dimensionado), e condenar o caminho offline por causa disso
 * rebaixaria para tempo real uma máquina perfeitamente capaz. Inconclusivo não é
 * negativo.
 */
export function canBuildFrameFromCanvas(canvas: HTMLCanvasElement): boolean {
  const g = globalThis as { VideoFrame?: VideoFrameCtor };
  const Ctor = g.VideoFrame;
  if (typeof Ctor !== 'function') return false;
  if (!canvas.width || !canvas.height) return true;

  let frame: FrameLike | null = null;
  try {
    frame = new Ctor(canvas, { timestamp: 0 });
    return true;
  } catch (e) {
    console.warn('[record] este navegador tem VideoFrame mas não o constrói a partir'
      + ' do canvas; o caminho offline está fora', e);
    return false;
  } finally {
    try { frame?.close(); } catch { /* nunca nasceu: nada a fechar */ }
  }
}

/**
 * Resolve a CADEIA e devolve o degrau que este navegador aguenta, ou `null`
 * quando nenhum deles passa (aí quem chamou cai na reserva em tempo real).
 *
 * Chamado ANTES de a gravação mexer em qualquer coisa da cena, de propósito: a
 * decisão entre o caminho offline e a reserva tem de acontecer enquanto ainda
 * não há nada a desfazer. O resultado de cada pergunta é memoizado dentro do
 * pacote (`canEncodeVideoMemo`), então repetir a sondagem é de graça.
 *
 * ⚠️ O tamanho passado aqui pode ser uma ESTIMATIVA (é o caso da resolução
 * `viewport`, cujo valor final só se conhece depois de o pino de teto
 * redimensionar o buffer). Isso é aceitável porque a única coisa que o tamanho
 * decide é o NÍVEL do codec, e não existe codificador que faça 720p e recuse
 * 1080p. Um erro aqui aparece como exceção no `openOfflineEncoder()`, que é
 * tratada, e não como vídeo corrompido.
 *
 * ⚠️ O CUSTO DESTA FUNÇÃO NÃO É ZERO NO FIREFOX, e é bom saber por quê. Lido em
 * `src/encode.ts`: como o `isConfigSupported()` do Firefox é pouco confiável, o
 * pacote **codifica um quadro de teste de verdade** lá, alocando
 * `largura × altura × 4` bytes (8,3 MB a 1080p) por candidato de configuração.
 * Com uma taxa de bits explícita há exatamente UM candidato por codec
 * (`buildVideoEncoderConfigs` só gera o segundo quando há quantizador), então o
 * pior caso desta cadeia são três encodes de teste — e só na primeira gravação
 * da aba, porque o resultado é memoizado.
 */
export async function pickOfflineCodec(
  canvas: HTMLCanvasElement,
  req: EncoderRequest,
): Promise<CodecPick | null> {
  if (!hasWebCodecs()) return null;
  /* Antes de qualquer pergunta sobre codec: o quadro sequer NASCE deste canvas?
     Ver o cabeçalho da função — é a checagem que impede a quebra tardia. */
  if (!canBuildFrameFromCanvas(canvas)) return null;

  try {
    const mb = await import('mediabunny');

    for (const link of CHAIN) {
      /* 1. O CONTÊINER ACEITA ESTE CODEC? Perguntado ao FORMATO e não a uma
            tabela nossa: `WebMOutputFormat.getSupportedCodecs()` é a verdade, e
            uma combinação inválida faria o `Output` lançar lá na frente, depois
            de a cena já estar mexida. É de graça e é local. */
      const format = link.container === 'mp4'
        ? new mb.Mp4OutputFormat()
        : new mb.WebMOutputFormat();
      if (!format.getSupportedVideoCodecs().includes(link.codec)) continue;

      /* 2. O NAVEGADOR CODIFICA ISTO? A pergunta é EXATAMENTE a configuração
            que `openOfflineEncoder()` vai usar — mesma taxa, mesmo modo de taxa,
            mesmo `latencyMode`. Ver o comentário de `LATENCY_MODE`. */
      const bitrate = scaledBitrate(req.bitrate, link.bitrateFactor);
      const ok = await mb.canEncodeVideo(link.codec, {
        width: req.width,
        height: req.height,
        quality: new mb.Quality({ bitrate, bitrateMode: 'variable' }),
        latencyMode: LATENCY_MODE,
      });

      if (ok) {
        console.info('[record] codec do vídeo: ' + link.label
          + ' (' + link.codec + ' em ' + link.container + ') · '
          + (bitrate / 1e6).toFixed(1) + ' Mbps · '
          + req.width + '×' + req.height + ' a ' + req.fps + ' fps');
        return link;
      }
      console.info('[record] o codificador recusou ' + link.label
        + '; tentando o próximo da cadeia');
    }

    console.warn('[record] nenhum codec da cadeia (H.264, VP9, AV1) é codificável'
      + ' aqui; caindo na reserva em tempo real');
    return null;
  } catch (e) {
    /* Pedaço que não carregou, API que lançou, navegador que mente: tudo é
       "não dá", e quem chamou cai na reserva. Uma exceção subindo daqui
       transformaria um vídeo em tempo real num erro de tela. */
    console.warn('[record] a sondagem do WebCodecs falhou', e);
    return null;
  }
}

/** A taxa que o codec do degrau vai receber. INTEIRA — o pacote recusa
 *  fracionário — e nunca zero, que faria o `Quality` lançar. */
const scaledBitrate = (reference: number, factor: number) =>
  Math.max(1, Math.round(reference * factor));

/**
 * Abre o codificador no degrau JÁ ESCOLHIDO por `pickOfflineCodec()`. Devolve
 * `null` quando este navegador não dá conta — nunca lança por incapacidade, só
 * por erro de verdade.
 *
 * ⚠️ O `pick` é PARÂMETRO e não é resolvido aqui de novo, e isso é a metade do
 * conserto: sondar num lugar e escolher noutro é como se reintroduz a
 * divergência entre o que foi perguntado e o que foi usado. Quem sondou manda.
 *
 * O alvo é um `BufferTarget`: o arquivo inteiro fica em memória até o
 * `finalize()`. É a escolha certa aqui e tem um preço nomeado — 60 s a 24 Mbps
 * são ~180 MB —, que é o mesmo preço que a reserva de `MediaRecorder` já pagava
 * acumulando pedaços.
 *
 * ⚠️ E ele paga um bônus que só vale no MP4: com `BufferTarget` o mediabunny
 * escolhe sozinho `fastStart: 'in-memory'`, ou seja o `moov` sai no COMEÇO do
 * arquivo — é o que faz o vídeo começar a tocar antes de terminar de baixar e o
 * que faz o Windows gerar miniatura para ele. **O WebM não tem esse ajuste** (é
 * ISOBMFF, e Matroska resolve o mesmo problema com Cues escritos no
 * `finalize()`), então não procure por ele no ramo do WebM: não está faltando,
 * não existe.
 */
export async function openOfflineEncoder(
  canvas: HTMLCanvasElement,
  req: EncoderRequest,
  pick: CodecPick,
): Promise<OfflineEncoder | null> {
  if (!hasWebCodecs()) return null;

  const mb = await import('mediabunny');
  const target = new mb.BufferTarget();
  const format = pick.container === 'mp4'
    ? new mb.Mp4OutputFormat()
    : new mb.WebMOutputFormat();
  const output = new mb.Output({ format, target });

  const source = new mb.CanvasSource(canvas, {
    codec: pick.codec,
    quality: new mb.Quality({
      /* INTEIRO, obrigatoriamente — ver o cabeçalho. E escalado pelo fator do
         degrau: a referência que `record.ts` manda é sempre a de H.264. */
      bitrate: scaledBitrate(req.bitrate, pick.bitrateFactor),
      /* Variável: este conteúdo tem quadros baratos (o caminhão parado contra o
         ciclorama) e quadros caros (a chuva com a câmera andando). Uma taxa
         constante gastaria o mesmo nos dois e é justamente no caro que a
         blocagem aparece. */
      bitrateMode: 'variable',
    }),
    /* O MESMO valor que a sondagem perguntou. Ver `LATENCY_MODE`. */
    latencyMode: LATENCY_MODE,
    /* O padrão do pacote são 2 s entre quadros-chave. Fica: mais frequente
       melhora o arrastar da linha de tempo e engorda o arquivo, e este vídeo é
       feito para ser ASSISTIDO (e postado), não navegado. */
  });

  /* `frameRate` não é decorativo: o pacote GRUDA todos os carimbos e durações
     desta faixa nesta taxa. É o que garante que 1 080 quadros carimbados em
     i/60 saiam como exatamente 60 fps no contêiner, em vez de 59,94 por erro de
     ponto flutuante acumulado. */
  output.addVideoTrack(source, { frameRate: req.fps });
  await output.start();

  let closed = false;

  return {
    add(timestamp: number, duration: number) {
      /* ⚠️ SEM `await` ANTES DESTA LINHA, JAMAIS. Ver o cabeçalho: é aqui que o
         pixel é agarrado, e ele só existe até a tarefa ceder. */
      return source.add(timestamp, duration);
    },
    async finish(): Promise<EncodedVideo> {
      closed = true;
      await output.finalize();
      /* O tipo EFETIVO, com a cadeia de codec resolvida
         (`video/mp4; codecs="avc1.640028"`, ou `video/webm; codecs="vp09…"`), e
         não um literal. A reserva de `record.ts` segue a mesma doutrina lendo
         `recorder.mimeType`: a extensão e o tipo seguem o contêiner de verdade. */
      const mime = await output.getMimeType().catch(() => format.mimeType);
      /* `fileExtension` vem COM ponto (`'.webm'`); `EncodedVideo.ext` é o pedaço
         solto que a interface cola no nome. Tirado aqui, uma vez. */
      const ext = format.fileExtension.replace(/^\./, '') || pick.ext;
      const buffer = target.buffer;
      if (!buffer || buffer.byteLength === 0) {
        throw new Error('O codificador devolveu um arquivo vazio.');
      }
      return { blob: new Blob([buffer], { type: mime }), mime, ext };
    },
    async abort() {
      if (closed) return;
      closed = true;
      /* `cancel()` solta o `VideoEncoder` e o escritor. Sem ele, um descarte
         deixaria um codificador de hardware preso até a coleta de lixo — e em
         algumas placas isso é um recurso EXCLUSIVO, ou seja a próxima gravação
         falharia sem explicação. */
      try { await output.cancel(); } catch { /* já morto: nada a soltar */ }
    },
  };
}
