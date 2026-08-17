/* O CRIADOR DE VÍDEO — a linha do tempo de câmera.
   ===========================================================================
   O PEDIDO QUE CRIOU ESTE ARQUIVO, nas palavras do dono:

       *"em vez de ter modo livre, o modo livre deve ser um criador de vídeo […]
        irei posicionar a câmera onde quero que comece, selecionarei o tempo,
        por exemplo 2s, então posicionarei a câmera no segundo ponto e direi que
        aquele será o segundo ponto, colocarei um timer novamente, e assim por
        diante […] porque assim a câmera será suave, não rígida já que
        manualmente não conseguimos deixar ela suave"*

   A última oração é a que decide o desenho inteiro, e ela é um DIAGNÓSTICO
   correto do modo que saiu daqui. O modo `livre` amostrava a órbita à mão e
   reamostrava o caminho para 60 fps — ou seja, ele reproduzia com fidelidade
   ATÉ O TREMOR DA MÃO. Um vídeo de câmera lisa não sai de suavizar um caminho
   trêmulo depois; sai de nunca ter tremido: o usuário dá os PONTOS, a máquina
   dá o CAMINHO.

   ---------------------------------------------------------------------------
   O QUE ESTE ARQUIVO É, E O QUE ELE NÃO É

   Ele é o MODELO (as chaves), o INTERPOLADOR (o caminho) e o REPRODUTOR (a
   prévia). Ele não tem uma linha de DOM: quem desenha a linha do tempo é
   `ui/timeline.ts`, e quem grava é `scene/record.ts`. Os três consomem a MESMA
   função `place(t)`, e isso não é economia de código — é a única forma de a
   prévia ser uma promessa em vez de uma aproximação. Uma prévia que rodasse por
   outro caminho de interpolação mentiria justamente sobre a coisa que o usuário
   está tentando decidir olhando.

   ---------------------------------------------------------------------------
   ⚠️ A INTERPOLAÇÃO É EM (AZIMUTE, ELEVAÇÃO, RAIO, LENTE, MIRA), NUNCA ENTRE
   DOIS PONTOS CARTESIANOS. É a mesma lição que o modo cinemático já tinha
   pago (ver o § O MODO CINEMÁTICO em `record.ts`): um `lerp` entre duas
   POSIÇÕES produz uma CORDA, e a corda entre dois pontos opostos de uma órbita
   de 20 m passa POR DENTRO do caminhão. Interpolando em coordenadas esféricas
   em torno da mira, o percurso é sempre um arco em volta do veículo.

   ---------------------------------------------------------------------------
   ⚠️⚠️ A CURVA É PCHIP (HERMITE MONÓTONA), E A ESCOLHA NÃO É ESTÉTICA

   Três candidatas foram consideradas, e as duas descartadas estão escritas aqui
   porque cada uma parece a resposta óbvia até se olhar o que ela faz na cena:

   1. `smootherstep` POR TRECHO, como o modo cinemático faz. Ela dá C¹ de graça
      (velocidade zero dos dois lados de toda emenda), mas o preço é que a
      câmera PARA em todo ponto marcado. No cinemático isso é estilo — o filme é
      autorado em planos e o respiro é deliberado. Aqui seria um defeito: quem
      marca seis pontos para descrever UM movimento contínuo receberia seis
      movimentos com cinco paradinhas, e chamaria isso de travado.

   2. CATMULL-ROM. É a resposta clássica para "passar liso por N pontos", e ela
      SUPERA — a tangente automática num ponto de inflexão joga o valor para
      fora do intervalo dos vizinhos. Num percurso de câmera isso tem nome: a
      câmera passa DO OUTRO LADO do ponto que o usuário marcou e volta. Lê como
      defeito, e no eixo do RAIO chega a empurrar a câmera para dentro da zona
      de expulsão da carroceria (ver as guardas em `scene/scene.ts`).

   3. PCHIP (Fritsch–Carlson), que é o que está aqui. Tangente por média
      harmônica ponderada, zerada em todo extremo local — ou seja **sem
      ultrapassagem, por construção**. A propriedade que isso compra vale ser
      dita por extenso, porque ela é o que dispensa uma dúzia de guardas:

          TODO VALOR INTERMEDIÁRIO FICA ENTRE OS DOIS VIZINHOS.

      E como toda chave nasce de uma pose que o laço vivo já validou (o
      `minDistance`, o `maxPolarAngle` e a coleira da mira já agiram sobre ela),
      um caminho que nunca sai do intervalo das chaves é um caminho que nunca
      viola aquelas guardas. Não é preciso aparar no meio — e aparar no meio é
      justamente o que produz a "dobra" que o cinemático documenta como o pior
      defeito de um percurso keyframado.

      O que se paga: nos extremos locais a velocidade zera. Um percurso que vai
      e volta no mesmo eixo tem uma respirada no ponto de virada. É o oposto do
      defeito (2) e é imperceptível ao lado dele.

   ⚠️ E AS PONTAS TÊM TANGENTE ZERO À FORÇA. O primeiro e o último nó ganham
   `m = 0` em vez da tangente de uma face só: é o que dá a partida macia e a
   parada macia sem nenhum controle na interface. Um vídeo que começa com a
   câmera já em velocidade máxima parece um corte no meio de um movimento.

   ---------------------------------------------------------------------------
   A PARADA (o "respiro") NÃO É UM CAMPO, É UM GESTO

   Não existe controle de pausa, e não existe código de pausa. Quem quiser que a
   câmera descanse num enquadramento **marca o mesmo ponto duas vezes**: as duas
   chaves têm valores idênticos, o trecho entre elas é CHATO (secante zero), e a
   regra de Fritsch–Carlson zera a tangente dos dois lados de um trecho chato —
   então a câmera chega parando, fica parada de verdade pelos segundos daquele
   trecho e sai acelerando.

   ⚠️ HOUVE UM CAMPO `hold` AQUI, e ele saiu no mesmo pedido que trocou o campo
   de segundos pelo select (2026-08-16): *"não precisa das opções abaixo da foto
   […] regravar, s, mover para trás e deletar"*. Ele custava um número por
   cartão, uma segunda grade de tempos e uma tabela de nós com duplicatas — para
   entregar exatamente o que dois cliques em "Marcar ponto" já entregam. É a
   mesma matemática que impede a ultrapassagem fazendo o segundo trabalho de
   graça, e agora sem nada na interface para explicar.

   ---------------------------------------------------------------------------
   ⚠️ O AZIMUTE É DESEMBRULHADO NA CONSTRUÇÃO, E TEM DE SER

   `atan2` devolve (-π, π]. Duas chaves a 170° e a -170° estão a 20° uma da
   outra, e interpolar os números crus varreria 340° pelo lado errado — uma
   volta inteira ao contrário, em dois segundos. O desembrulho soma múltiplos de
   2π para que a diferença entre chaves consecutivas caia sempre em (-π, π], ou
   seja: **entre dois pontos a câmera pega sempre o arco menor**. Quem quiser a
   volta longa marca um ponto no meio, que é como se pede isso em qualquer
   editor.

   ---------------------------------------------------------------------------
   O QUE O TEMPO SIGNIFICA

   Cada chave carrega UM número: `travel`, os segundos de VIAGEM desde a chave
   anterior. É o "selecionarei o tempo, por exemplo 2s" do pedido. Na primeira
   chave não existe viagem, e o campo é ignorado.

   A duração total é a soma dos `travel`, e ela tem TETO:
   `MAX_TIMELINE_SECONDS`. O teto não é gosto — o arquivo de vídeo inteiro fica
   em memória até o `finalize()` do muxer (ver `record-encoder.ts`), e 60 s a
   ~24 Mbps já são ~180 MB. É o mesmo teto que o modo livre tinha, pelo mesmo
   motivo. */
import { Vector3 } from 'three';
import {
  camera, controls, invalidate, markBusy, onFrame, setTurntable, suspendAvoidance,
} from './scene';
import { setFloorReflection, isFloorReflectionOn } from './floor-reflection';
import { renderScale, setRenderScale } from '../core/quality';
import {
  pchipTangents, hermiteBasis, hermiteValue, segmentIndex, unwrapAngles,
} from './timeline-curve';
import { FOV as CARD_FOV } from './view';

/* ---------------- os limites ---------------- */

/** Teto da duração total. Ver o § O QUE O TEMPO SIGNIFICA. */
export const MAX_TIMELINE_SECONDS = 60;
/** Teto de pontos. Acima disto a tira vira ilegível antes de virar cara. */
export const MAX_TIMELINE_KEYS = 24;
/* ---- O TEMPO DE VIAGEM É UMA ESCOLHA DE OITO, NÃO UM NÚMERO LIVRE ----
   Pedido de 2026-08-16, depois da primeira rodada: *"o seletor de tempo ali não
   está legal, em vez de um input deve ser um select que vá de 1 a 8s"*.

   E ele está certo por um motivo que vale registrar: um campo livre convida a
   precisão que este controle não tem. Ninguém consegue julgar a diferença entre
   2,4 s e 2,6 s de viagem olhando uma prévia — o que se decide aqui é "rápido,
   médio ou lento", e oito degraus cobrem isso com folga. Um campo numérico
   ainda cobrava a digitação, o cursor de texto, o aparo do teto e a vírgula
   decimal do teclado pt-BR para responder uma pergunta de três respostas. */
export const MIN_TRAVEL_SECONDS = 1;
export const MAX_TRAVEL_SECONDS = 8;
/** O tempo que um ponto novo ganha. É o número do pedido ("por exemplo 2s"). */
export const DEFAULT_TRAVEL_SECONDS = 2;

/* Faixa da lente, em graus. 30° é a lente de fábrica do estúdio (`CARD_FOV`);
   13° é a teleobjetiva de retrato que o modo cinemático usa no plano de
   detalhe; 45° já é grande-angular e incha a cabine de perto.
   ⚠️ O ZOOM É DE LENTE E NUNCA DE APROXIMAÇÃO, e a razão está inteira no
   cabeçalho de `record.ts`: `controls.minDistance` é um raio inteiro do
   conjunto e a câmera é EXPULSA da caixa do veículo dentro do próprio quadro —
   chegar perto é mecanicamente impossível nesta cena. */
export const MIN_LENS_FOV = 13;
export const MAX_LENS_FOV = 45;

/* As guardas da cena, repetidas aqui como PISO da avaliação. Elas existem em
   `scene/scene.ts` e agem no laço; tê-las aqui evita que o laço precise aparar
   o que este arquivo escreve — e um aparo no laço é uma dobra na curva. */
const EL_MIN = 0.022;                  // `controls.maxPolarAngle` = π/2 − 0.02
const EL_MAX = Math.PI / 2 - 0.002;
const TARGET_MIN_Y = 0.12;             // o piso do laço é 0,05; ficamos acima
const CAM_MIN_Y = 0.15;

/* ---------------- a chave ---------------- */

export interface TimelineKey {
  /** Identidade estável — a interface referencia por id, nunca por índice, e é
   *  o que faz remover o ponto 2 não renomear o foco do teclado para o 3. */
  readonly id: number;
  /** A pose, em MUNDO. Posição da câmera e mira, exatamente como o laço vivo as
   *  deixou no instante da marcação — ou seja já passadas pelas guardas. */
  px: number; py: number; pz: number;
  tx: number; ty: number; tz: number;
  /** Abertura vertical da lente, em graus. */
  fov: number;
  /** Segundos de viagem desde a chave anterior. Ignorado na primeira. */
  travel: number;
  /** O que a câmera via aqui — data URL, tirada na marcação. Pode faltar. */
  thumb: string | null;
}

/* ⚠️ O ESTADO É DE MÓDULO E NÃO VAI PARA O `localStorage`, e isso é decisão.
   As poses são ABSOLUTAS EM MUNDO (ver `TimelineKey`), e o mundo muda: trocar o
   cenário move o conjunto, e um percurso restaurado numa cena diferente
   apontaria para o pátio vazio com a maior naturalidade — um estado inválido
   que se parece com um estado válido é a pior classe de bug de persistência.
   Dentro da PÁGINA o percurso sobrevive a tudo: o engine é um módulo singleton
   e `unmountStudio()` não o descarta, então sair da rota e voltar mantém a
   linha do tempo montada. */
let keys: TimelineKey[] = [];
let nextId = 1;

const listeners = new Set<() => void>();

/** Assina mudanças no MODELO (chaves e tempos), não na reprodução. */
export function onTimelineChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Toda escrita passa por aqui: ela é o que invalida o caminho memoizado. Um
 *  caminho servido depois de uma edição é a prévia mentindo sobre o que vai
 *  ser gravado, que é o único erro que esta ferramenta não pode cometer. */
function emit() {
  path = null;
  for (const fn of listeners) fn();
}

export const timelineKeys = (): readonly TimelineKey[] => keys;
export const timelineCount = () => keys.length;

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/* ---------------- os tempos ---------------- */

/**
 * O instante em que a câmera CHEGA em cada chave, acumulado.
 *
 * A primeira chega em ZERO SEMPRE — o `travel` dela não existe, e cobrá-lo
 * daria um vídeo que abre com a câmera parada num quadro que o usuário não
 * marcou.
 */
export function timelineTimes(): number[] {
  const out: number[] = [];
  let t = 0;
  for (let i = 0; i < keys.length; i++) {
    if (i > 0) t += Math.max(MIN_TRAVEL_SECONDS, keys[i].travel);
    out.push(t);
  }
  return out;
}

/** Duração do vídeo que este percurso produz, em segundos. */
export function timelineDuration(): number {
  const t = timelineTimes();
  return t.length ? t[t.length - 1] : 0;
}

/** Quantos segundos ainda cabem antes do teto. Nunca negativo. */
export const timelineHeadroom = () =>
  Math.max(0, MAX_TIMELINE_SECONDS - timelineDuration());

/* ---------------- edição ---------------- */

/**
 * Marca um ponto com a pose que a câmera tem AGORA.
 *
 * `thumb` vem de fora (de `scene/capture.ts`) porque tirar a miniatura é um
 * render, e este módulo não renderiza nada — ele só guarda o que lhe dão. Nulo
 * é um caminho válido: a tira mostra a placa numerada e a linha do tempo
 * continua inteira.
 *
 * Devolve `null` quando o teto de pontos foi batido — a interface tem de poder
 * dizer POR QUE nada aconteceu, e um `null` é a única resposta que ela consegue
 * distinguir de "deu certo".
 */
export function addTimelineKey(thumb: string | null = null): TimelineKey | null {
  if (keys.length >= MAX_TIMELINE_KEYS) return null;
  const first = keys.length === 0;
  /* O tempo do ponto novo é aparado pelo que sobra do teto — nunca recusado.
     Recusar o PONTO por causa do TEMPO seria punir a coisa errada: o usuário
     acabou de compor um enquadramento, e o número é ajustável num campo ao
     lado. */
  const travel = first ? 0
    : clamp(DEFAULT_TRAVEL_SECONDS, MIN_TRAVEL_SECONDS,
      Math.max(MIN_TRAVEL_SECONDS, Math.min(MAX_TRAVEL_SECONDS, timelineHeadroom())));
  const k: TimelineKey = {
    id: nextId++,
    px: camera.position.x, py: camera.position.y, pz: camera.position.z,
    tx: controls.target.x, ty: controls.target.y, tz: controls.target.z,
    fov: camera.fov,
    travel,
    thumb,
  };
  keys.push(k);
  emit();
  return k;
}

const indexOfKey = (id: number) => keys.findIndex((k) => k.id === id);

/** Rescreve a pose de um ponto com a da câmera de agora. O tempo fica. */
export function updateTimelineKey(id: number, thumb: string | null = null): boolean {
  const i = indexOfKey(id);
  if (i < 0) return false;
  const k = keys[i];
  k.px = camera.position.x; k.py = camera.position.y; k.pz = camera.position.z;
  k.tx = controls.target.x; k.ty = controls.target.y; k.tz = controls.target.z;
  k.fov = camera.fov;
  if (thumb) k.thumb = thumb;
  emit();
  return true;
}

export function removeTimelineKey(id: number): boolean {
  const i = indexOfKey(id);
  if (i < 0) return false;
  keys.splice(i, 1);
  /* A NOVA PRIMEIRA CHAVE PERDE A VIAGEM DELA. Sem isto, apagar o ponto 1
     deixaria o vídeo abrindo com dois segundos de câmera parada — um tempo de
     viagem que não tem de onde vir. */
  if (keys.length) keys[0].travel = 0;
  emit();
  return true;
}

/** Troca a chave de lugar com a vizinha. `dir` é -1 (antes) ou +1 (depois). */
export function moveTimelineKey(id: number, dir: -1 | 1): boolean {
  const i = indexOfKey(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= keys.length) return false;
  /* ⚠️ OS TEMPOS DE VIAGEM FICAM NA POSIÇÃO, NÃO NA CHAVE. `travel` é uma
     propriedade do TRECHO ("dois segundos daqui até ali"), e carregá-lo junto
     com a chave faria reordenar mudar a duração do vídeo — que é a última coisa
     que alguém espera de uma seta de reordenar. Trocam-se as poses; a grade de
     tempos fica onde estava. */
  const a = keys[i];
  const b = keys[j];
  const at = a.travel, bt = b.travel;
  keys[i] = b; keys[j] = a;
  a.travel = bt; b.travel = at;
  keys[0].travel = 0;
  emit();
  return true;
}

/**
 * O tempo de viagem ATÉ esta chave.
 *
 * ⚠️ APARADO PELO TETO, E O APARO É VISÍVEL DE PROPÓSITO. A alternativa —
 * aceitar o número e recusar a gravação no fim — trocaria um campo que se
 * corrige em dois segundos por uma mensagem de erro depois de um fluxo inteiro.
 * `timelineHeadroom()` é o que a interface lê para dizer que o teto chegou.
 */
export function setTimelineTravel(id: number, secs: number): boolean {
  const i = indexOfKey(id);
  if (i <= 0) return false;                 // a primeira não viaja
  const k = keys[i];
  const room = Math.min(MAX_TRAVEL_SECONDS, timelineHeadroom() + k.travel);
  const v = clamp(+secs || 0, MIN_TRAVEL_SECONDS, Math.max(MIN_TRAVEL_SECONDS, room));
  if (Math.abs(v - k.travel) < 1e-4) return false;
  k.travel = v;
  emit();
  return true;
}

/** A lente desta chave, em graus. Aplicada à câmera viva quando pedido. */
export function setTimelineLens(id: number, fovDeg: number): boolean {
  const i = indexOfKey(id);
  if (i < 0) return false;
  const v = clamp(+fovDeg || CARD_FOV, MIN_LENS_FOV, MAX_LENS_FOV);
  if (Math.abs(v - keys[i].fov) < 1e-4) return false;
  keys[i].fov = v;
  emit();
  return true;
}

export function clearTimeline() {
  if (!keys.length) return;
  keys = [];
  emit();
}

/** Uma chave como ela viaja num arquivo de projeto — sem o `id`, que é local. */
export type TimelineKeyData = Omit<TimelineKey, 'id'>;

/** O percurso inteiro, para gravar. Vazio quando não há nenhum. */
export function exportTimeline(): TimelineKeyData[] {
  return keys.map(({ id: _id, ...rest }) => ({ ...rest }));
}

/**
 * Escreve um percurso inteiro por cima do atual.
 *
 * ⚠️ **QUEM CHAMA ISTO ASSUME A RESPONSABILIDADE DO ⚠️ LÁ EM CIMA.** O bloco de
 * `keys` explica por que este estado não vai para o `localStorage`: as poses são
 * ABSOLUTAS EM MUNDO, e restaurar um percurso numa cena diferente aponta a
 * câmera para um pátio vazio com toda a naturalidade — um estado inválido com
 * cara de válido, que é a pior classe de bug de persistência.
 *
 * Um ARQUIVO DE PROJETO é o caso em que a objeção não se aplica, e é por isso
 * que esta porta existe em vez de a decisão ter sido revertida: o projeto
 * carrega o cenário e o veículo JUNTO com o percurso, e `project/document.ts` só
 * chama isto depois de conferir que a escolha restaurada é a mesma que estava
 * gravada. Mundo igual, poses válidas. Se a conferência falha, o percurso é
 * descartado com um aviso — nunca aplicado "na dúvida".
 *
 * Os ids são NOVOS: eles são identidade de sessão (a interface referencia por
 * id, e o contador é de módulo), não conteúdo do documento.
 */
export function importTimeline(list: readonly TimelineKeyData[] | null | undefined): number {
  if (!Array.isArray(list)) { clearTimeline(); return 0; }
  const num = (v: unknown, d: number) => (Number.isFinite(+(v as number)) ? +(v as number) : d);
  /* O TETO É REAFIRMADO AQUI, e não presumido do arquivo: um documento com 40
     chaves (escrito à mão, ou por uma versão futura com outro limite) não pode
     entrar e deixar a interface num estado que ela própria não sabe produzir. */
  keys = list.slice(0, MAX_TIMELINE_KEYS).map((k, i) => ({
    id: nextId++,
    px: num(k?.px, 0), py: num(k?.py, 0), pz: num(k?.pz, 0),
    tx: num(k?.tx, 0), ty: num(k?.ty, 0), tz: num(k?.tz, 0),
    fov: clamp(num(k?.fov, CARD_FOV), MIN_LENS_FOV, MAX_LENS_FOV),
    /* A primeira não tem viagem — `timelineTimes()` a ignora, e gravar um número
       ali só criaria um campo que mente. */
    travel: i === 0 ? 0
      : clamp(num(k?.travel, DEFAULT_TRAVEL_SECONDS), MIN_TRAVEL_SECONDS, MAX_TRAVEL_SECONDS),
    thumb: typeof k?.thumb === 'string' && k.thumb ? k.thumb : null,
  }));
  emit();
  return keys.length;
}

/* ---------------- a lente VIVA ----------------
   Mexer no `fov` da câmera do estúdio é seguro enquanto alguém devolver o valor
   de fábrica: `resize()` reescreve `aspect` e recalcula a projeção, mas NÃO
   devolve o `fov` — uma teleobjetiva de 13° sobreviveria ao fechamento do
   criador e o estúdio ficaria com a lente errada até o próximo F5, sem nada na
   interface explicando por quê. É a mesma armadilha que `record.ts` documenta
   no `prevFov`, e quem paga a dívida aqui é `exitTimelineMode()`. */

/** Escreve a lente na câmera viva. Devolve o valor efetivo (aparado). */
export function applyLiveLens(fovDeg: number): number {
  const v = clamp(+fovDeg || CARD_FOV, MIN_LENS_FOV, MAX_LENS_FOV);
  if (Math.abs(camera.fov - v) > 1e-4) {
    camera.fov = v;
    camera.updateProjectionMatrix();
    invalidate();
  }
  return v;
}

export const liveLens = () => camera.fov;

/* ===========================================================================
   O CAMINHO
   =========================================================================== */

export interface TimelinePath {
  /** Segundos de vídeo. */
  duration: number;
  /** Escreve a pose do instante `t` na câmera e na mira. */
  place: (t: number) => void;
  /** Menor e maior distância da câmera ao pé do conjunto, para a checagem do
   *  passo da caixa de sombra em `record.ts`. */
  minDist: number;
  maxDist: number;
  /** O INSTANTE da menor distância. `record.ts` assenta a cena ali antes de
   *  gravar, para travar `tuneShadowSpan()` no passo fechado — um número, e não
   *  uma busca, porque quem conhece o percurso é este arquivo. */
  minDistAt: number;
  /** `true` quando alguma chave pede uma lente diferente da de fábrica — a
   *  interface usa para dizer que o vídeo tem zoom. */
  hasLens: boolean;
}

/* ---- PCHIP ----
   A matemática mora em `./timeline-curve`, que não importa NADA — é o que a
   torna testável em nó (ver o cabeçalho de lá: `scene/scene.ts` constrói um
   `WebGLRenderer` no tempo de import, então tudo que o alcança é impossível de
   carregar num teste). Aqui sobra só o arranjo: uma faixa = valores +
   tangentes, e as sete dividem a mesma grade de tempos. */
type Track = { v: number[]; m: number[] };
const track = (t: number[], v: number[]): Track => ({ v, m: pchipTangents(t, v) });

/** Memoizado. `emit()` o zera — ver a nota lá. */
let path: TimelinePath | null = null;

const _tgt = new Vector3();

/**
 * Resolve o percurso contra as chaves de AGORA.
 *
 * Devolve `null` com menos de duas chaves: um percurso de um ponto só é uma
 * foto, e uma foto tem botão próprio.
 */
export function buildTimelinePath(): TimelinePath | null {
  if (path) return path;
  if (keys.length < 2) return null;

  const T = timelineTimes();
  const duration = T[T.length - 1];
  if (!(duration > 0)) return null;

  /* ---- as chaves viram parâmetros ---- */
  const n = keys.length;
  const kAz: number[] = new Array(n);
  const kEl: number[] = new Array(n);
  const kR: number[] = new Array(n);
  let hasLens = false;
  for (let i = 0; i < n; i++) {
    const k = keys[i];
    const dx = k.px - k.tx, dy = k.py - k.ty, dz = k.pz - k.tz;
    const r = Math.max(1e-3, Math.hypot(dx, dy, dz));
    kR[i] = r;
    kEl[i] = clamp(Math.asin(clamp(dy / r, -1, 1)), EL_MIN, EL_MAX);
    kAz[i] = Math.atan2(dx, dz);
    if (Math.abs(k.fov - CARD_FOV) > 0.5) hasLens = true;
  }
  /* O DESEMBRULHO — ver o ⚠️ do cabeçalho, e a prova em
     `timeline-curve.test.ts`. */
  const azUnwrapped = unwrapAngles(kAz);
  for (let i = 0; i < n; i++) kAz[i] = azUnwrapped[i];

  /* ---- os nós: UM por chave ----
     ⚠️ HOUVE UM SEGUNDO NÓ AQUI, para as chaves com pausa. Ele saiu com o campo
     `hold` — ver o § A PARADA no cabeçalho. A pausa continua existindo, e por um
     caminho mais simples: duas chaves com a MESMA pose dão um trecho chato, e o
     interpolador já para nele sem saber que aquilo é uma pausa. */
  const vAz = kAz;
  const vEl = kEl;
  const vR = kR;
  const vFov = keys.map((k) => clamp(k.fov, MIN_LENS_FOV, MAX_LENS_FOV));
  const vTx = keys.map((k) => k.tx);
  const vTy = keys.map((k) => Math.max(TARGET_MIN_Y, k.ty));
  const vTz = keys.map((k) => k.tz);

  const az = track(T, vAz);
  const el = track(T, vEl);
  const rr = track(T, vR);
  const fv = track(T, vFov);
  const tx = track(T, vTx);
  const ty = track(T, vTy);
  const tz = track(T, vTz);

  /* A faixa de distância, medida nas CHAVES e não em amostras: a monotonicidade
     garante que nenhum instante intermediário sai do intervalo delas, então os
     extremos do caminho são extremos de chave. É a mesma propriedade que
     dispensa aparar no meio.
     ⚠️ MEDIDA ATÉ O PÉ DO CONJUNTO (a mira rebatida em y = 0), e não até a
     mira: `tuneShadowSpan()` compara a distância ao foco de sombra, que
     `scene.ts` põe no chão de propósito. Com a câmera a 10 m de altura os dois
     números diferem em mais de um metro, e a checagem existe justamente para
     dizer se o percurso encosta nos 30 m. */
  let minDist = Infinity;
  let maxDist = 0;
  let minDistAt = 0;
  for (let i = 0; i < n; i++) {
    const k = keys[i];
    const d = Math.hypot(k.px - k.tx, k.py, k.pz - k.tz);
    if (d < minDist) { minDist = d; minDistAt = T[i]; }
    if (d > maxDist) maxDist = d;
  }

  /* O cursor é do PERCURSO e não da chamada: o laço de render e a prévia pedem
     tempos monotônicos, e `segmentIndex()` avança de onde parou. */
  let cursor = 0;

  const place = (tRaw: number) => {
    const t = clamp(tRaw, 0, duration);
    cursor = segmentIndex(T, t, cursor);
    const i = cursor;
    const h = Math.max(1e-6, T[i + 1] - T[i]);
    /* A BASE UMA VEZ, PARA AS SETE FAIXAS. Elas dividem a mesma grade de tempos,
       então recalcular os quatro polinômios por faixa seria sete vezes o mesmo
       trabalho — 3 600 vezes por vídeo. */
    const b = hermiteBasis(clamp((t - T[i]) / h, 0, 1));
    const ev = (k: Track) => hermiteValue(b, h, k.v[i], k.v[i + 1], k.m[i], k.m[i + 1]);

    _tgt.set(ev(tx), Math.max(TARGET_MIN_Y, ev(ty)), ev(tz));
    const elv = clamp(ev(el), EL_MIN, EL_MAX);
    const azv = ev(az);
    /* As duas guardas de raio são LIDAS da cena, e não presumidas: se
       `setVehicleFocus()` mudar os fatores, o percurso acompanha sozinho. */
    const dMax = controls.maxDistance > 0 && Number.isFinite(controls.maxDistance)
      ? controls.maxDistance : Infinity;
    const rad = clamp(ev(rr), controls.minDistance || 0, dMax);
    const ce = Math.cos(elv);
    controls.target.copy(_tgt);
    camera.position.set(
      _tgt.x + Math.sin(azv) * ce * rad,
      _tgt.y + Math.sin(elv) * rad,
      _tgt.z + Math.cos(azv) * ce * rad,
    );
    if (camera.position.y < CAM_MIN_Y) camera.position.y = CAM_MIN_Y;
    const f = clamp(ev(fv), MIN_LENS_FOV, MAX_LENS_FOV);
    if (Math.abs(camera.fov - f) > 1e-4) {
      camera.fov = f;
      camera.updateProjectionMatrix();
    }
  };

  path = { duration, place, minDist, maxDist, minDistAt, hasLens };
  return path;
}

/* ===========================================================================
   A PRÉVIA — e o VOO até um ponto
   ===========================================================================
   *"e também deve ter um preview, ao clicar irá simular o posicionamento que a
   câmera fará"*

   ⚠️⚠️ A POSE É ESCRITA DE DENTRO DE UM GANCHO DE QUADRO, E NUNCA DE UM
   `requestAnimationFrame` PRÓPRIO. A diferença decide se a prévia funciona:

     · o laço de `scene.ts` chama `controls.update(dt)` no TOPO do quadro, e o
       `update()` do OrbitControls RECOMPÕE `camera.position` a partir da órbita
       que ele encontrar. Uma pose escrita antes disso é lida e reescrita por
       ele; uma escrita depois é a que vai para a tela;
     · dois `requestAnimationFrame` do mesmo quadro correm na ordem em que foram
       registrados, e a nossa seria decidida por quem chamou primeiro — ou seja
       a prévia funcionaria ou não conforme o quadro. Um gancho de quadro tem
       ordem DEFINIDA e roda sempre, inclusive no quadro que o laço sob demanda
       decidiu pular (ver `onFrame` em `scene.ts`).

   E é o mesmo lugar, na mesma ordem, em que a guarda de expulsão da carroceria
   roda — o que faz a prévia e o render offline verem exatamente as mesmas
   correções. */

type Driver =
  | null
  | { kind: 'preview' }
  | { kind: 'fly'; t: number; dur: number; from: number[]; to: number[] };

let driver: Driver = null;
let playing = false;
let previewT = 0;
let modeOn = false;
let fovBefore = CARD_FOV;
let controlsWere = true;

const ticks = new Set<(t: number, playing: boolean) => void>();

/** Assina o RELÓGIO da prévia. Separado de `onTimelineChange` de propósito: o
 *  modelo muda por gesto, isto muda sessenta vezes por segundo. */
export function onTimelineTick(fn: (t: number, playing: boolean) => void): () => void {
  ticks.add(fn);
  return () => { ticks.delete(fn); };
}

function tickOut() {
  for (const fn of ticks) fn(previewT, playing);
}

export const isTimelinePreviewing = () => playing;
export const timelinePreviewTime = () => previewT;

/* `smootherstep`, a mesma do modo cinemático: primeira E segunda derivadas
   nulas nas duas pontas. Aqui ela serve só ao VOO até um ponto — a curva do
   percurso é a PCHIP lá em cima. */
const ease = (t: number) => {
  const u = clamp(t, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};

/** A pose viva como os sete parâmetros do caminho. */
function livePose(): number[] {
  const dx = camera.position.x - controls.target.x;
  const dy = camera.position.y - controls.target.y;
  const dz = camera.position.z - controls.target.z;
  const r = Math.max(1e-3, Math.hypot(dx, dy, dz));
  return [
    Math.atan2(dx, dz), Math.asin(clamp(dy / r, -1, 1)), r, camera.fov,
    controls.target.x, controls.target.y, controls.target.z,
  ];
}

function keyPose(k: TimelineKey): number[] {
  const dx = k.px - k.tx, dy = k.py - k.ty, dz = k.pz - k.tz;
  const r = Math.max(1e-3, Math.hypot(dx, dy, dz));
  return [
    Math.atan2(dx, dz), Math.asin(clamp(dy / r, -1, 1)), r, k.fov,
    k.tx, Math.max(TARGET_MIN_Y, k.ty), k.tz,
  ];
}

function writePose(p: number[]) {
  const el = clamp(p[1], EL_MIN, EL_MAX);
  const dMax = controls.maxDistance > 0 && Number.isFinite(controls.maxDistance)
    ? controls.maxDistance : Infinity;
  const r = clamp(p[2], controls.minDistance || 0, dMax);
  const ce = Math.cos(el);
  controls.target.set(p[4], Math.max(TARGET_MIN_Y, p[5]), p[6]);
  camera.position.set(
    controls.target.x + Math.sin(p[0]) * ce * r,
    controls.target.y + Math.sin(el) * r,
    controls.target.z + Math.cos(p[0]) * ce * r,
  );
  if (camera.position.y < CAM_MIN_Y) camera.position.y = CAM_MIN_Y;
  const f = clamp(p[3], MIN_LENS_FOV, MAX_LENS_FOV);
  if (Math.abs(camera.fov - f) > 1e-4) {
    camera.fov = f;
    camera.updateProjectionMatrix();
  }
}

/* Enquanto algo dirige a câmera, o usuário não. `controls.enabled = false` é o
   único jeito honesto: com ele ligado, um arrasto no meio da prévia soma o
   delta do usuário à pose escrita e o resultado é uma câmera que briga com ela
   mesma — e a inércia sobrevive ao fim da prévia, deslizando por cima do
   primeiro segundo do vídeo se a gravação vier em seguida. */
let grabbed = false;

function grabControls() {
  /* ⚠️ A GUARDA É `grabbed` E NÃO `driver`. Os dois motoristas se sucedem — uma
     prévia interrompida por um voo até um ponto, um voo interrompido por um
     play — e cada troca passa por aqui. Sem a bandeira, a segunda chamada
     guardaria `controls.enabled` JÁ DESLIGADO como o valor "de antes", e o
     `release` do fim devolveria a órbita permanentemente travada: o estúdio
     ficaria sem arrastar até um F5, sem nada na tela explicando por quê. */
  if (grabbed) return;
  grabbed = true;
  controlsWere = controls.enabled;
  controls.enabled = false;
}

function releaseControls() {
  if (!grabbed) return;
  grabbed = false;
  controls.enabled = controlsWere;
}

/* ⚠️⚠️ O INTERRUPTOR QUE IMPEDE DUAS MÃOS NA MESMA CÂMERA — e ele é o conserto
   de *"às vezes o vídeo sai com um artefato"*.

   O gancho abaixo é um `onFrame`, e `renderOfflineFrame()` (`scene/scene.ts`)
   **também roda os `onFrame`** — é o mesmo laço de quadro, avaliado fora do
   tempo real. Ou seja: durante uma gravação, cada um dos 3 600 quadros do vídeo
   executa este gancho. Se houvesse um motorista vivo ali dentro — uma prévia
   esquecida tocando, ou o VOO de 0,45 s que um clique numa miniatura acabou de
   começar —, ele reescreveria a pose que `record.ts` tinha acabado de escrever,
   **depois** de ela ter sido escrita e **antes** do `renderer.render()`.

   O resultado não é um erro: é um vídeo que abre deslizando de um lugar que
   ninguém pediu, ou com um trecho fora do percurso. Intermitente, porque depende
   de o usuário ter clicado num ponto menos de meio segundo antes de gravar — que
   é exatamente o gesto natural ("deixa eu ver este ponto… pronto, gravar").

   E há um segundo estrago, mais silencioso: `tickOut()` faria escritas de DOM
   3 600 vezes dentro do laço em que a CPU é o recurso escasso.

   `record.ts` liga isto no começo de TODA gravação — inclusive a `volta`, que
   não tem nada a ver com o criador — e desliga no `finally`.
   Um `stopTimelinePreview()` no começo resolveria o caso comum; um interruptor
   resolve também o caso em que alguém, um dia, chamar uma prévia de dentro de
   outro caminho. */
let externalDrive = false;

export function suspendTimelineDrivers(on: boolean) {
  externalDrive = !!on;
  if (!externalDrive) return;
  /* Para de verdade, e não só cala o gancho: uma prévia "tocando" que não anda
     deixaria o botão em ▮▮ e o cabeçote parado no meio, e o usuário voltaria da
     gravação achando que a interface travou. */
  if (playing || driver) {
    playing = false;
    driver = null;
    releaseControls();
    tickOut();
  }
  /* ⚠️ FORA do `if`: a passada do piso pode ter sido derrubada por uma prévia
     que já terminou sozinha num caminho que não passou por aqui. Restaurar é
     idempotente, e uma gravação com o reflexo desligado sairia com o piso fosco
     — um defeito PERMANENTE no arquivo, ao contrário de um quadro feio. */
  leaveProxy();
}

onFrame((dt) => {
  if (externalDrive || !driver) return;
  if (driver.kind === 'fly') {
    driver.t = Math.min(driver.dur, driver.t + dt);
    const u = ease(driver.t / driver.dur);
    const p: number[] = new Array(7);
    for (let i = 0; i < 7; i++) {
      /* Só o azimute tem descontinuidade; os outros seis são interpoláveis
         crus. O desembrulho é o mesmo do caminho: arco menor, sempre. */
      let a = driver.from[i];
      const b = driver.to[i];
      if (i === 0) a += Math.PI * 2 * Math.round((b - a) / (Math.PI * 2));
      p[i] = a + (b - a) * u;
    }
    writePose(p);
    invalidate();
    /* ⚠️ O VOO TAMBÉM TICA, E O CABEÇOTE NÃO ANDA COM ELE. Parece contraditório
       e não é: o tique é o pulso que a interface usa para repintar o que segue a
       CÂMERA, e a lente é uma dessas coisas — o voo escreve o `fov` da chave, e
       um cursor de lente parado em 30° estaria mentindo sobre o que o botão de
       regravar vai guardar. `previewT` não é tocado, então o cabeçote fica onde
       estava, que é o correto: voar até um ponto não é assistir ao vídeo. */
    tickOut();
    if (driver.t >= driver.dur) { driver = null; releaseControls(); }
    return;
  }
  /* ---- prévia ---- */
  const p = buildTimelinePath();
  if (!p) { stopTimelinePreview(); return; }
  if (playing) {
    /* ⚠️ A CADA QUADRO, e a janela é curta de propósito: ela tem de cobrir a
       prévia inteira e EXPIRAR sozinha logo depois, para que o medidor volte a
       aprender com o regime de verdade sem ninguém precisar lembrar de
       desligá-la num `finally`. O PORQUÊ está no § O MODO PROXY — e não é o
       flash de realocação, que `flushPendingScale()` já resolveu. */
    markBusy(700);
    /* A taxa da prévia, em janelas de ~0,4 s. Duas somas e uma divisão. */
    fpsFrames++;
    fpsWindow += dt;
    if (fpsWindow >= 0.4) {
      fpsValue = fpsFrames / fpsWindow;
      fpsFrames = 0;
      fpsWindow = 0;
    }
    previewT += dt;
    if (previewT >= p.duration) {
      previewT = p.duration;
      p.place(previewT);
      invalidate();
      /* PARA NO FIM E FICA LÁ. Voltar ao começo faria a prévia de um percurso
         curto parecer um laço, que é o que o modo `volta` é e este não é. */
      playing = false;
      driver = null;
      releaseControls();
      leaveProxy();
      tickOut();
      return;
    }
  }
  p.place(previewT);
  invalidate();
  if (playing) tickOut();
});

/* ===========================================================================
   O MODO PROXY DA PRÉVIA
   ===========================================================================
   ⚠️⚠️ SEGUNDA PASSAGEM PELO MESMO RELATO — *"tinha parado de bugar durante o
   preview, mas voltou por algum motivo"* —, e o "por algum motivo" é a parte
   informativa: um defeito que vai e volta sem o código mudar depende de ESTADO,
   e o estado aqui é **a escala de render no instante em que se aperta ▶**.

   ---------------------------------------------------------------------------
   O QUE A PRIMEIRA TENTATIVA ERROU, e ela está registrada porque o erro é
   instrutivo:

   1. ELA CULPOU O FLASH DE REALOCAÇÃO. A hipótese era que o controlador de
      qualidade, vendo quadros caros, trocava a escala e o `setSize()` limpava o
      drawing buffer — um quadro em branco por degrau. **É falso, e o próprio
      `scene.ts` prova**: aquele defeito EXISTIU, foi relatado ("está dando umas
      piscadas às vezes") e já foi consertado — `flushPendingScale()` aplica a
      escala no TOPO do quadro, antes do `render()`, justamente para que a
      realocação e o desenho caiam no mesmo quadro. Não há flash a evitar.

   2. E, PIOR, ELA TIROU A ÚNICA VÁLVULA QUE AJUDAVA. `markBusy()` congela o
      controlador — e o controlador é exatamente quem abaixa a resolução quando o
      quadro não cabe no orçamento. Ou seja: a prévia passou a ser a ÚNICA
      interação do estúdio sem adaptação. Com a escala em 1,0 no momento do
      clique, ela ficava em 1,0 o percurso inteiro; com a escala já baixa (porque
      o usuário tinha acabado de orbitar numa cena pesada), ela ficava lisa.
      **É esse o "por algum motivo".**

   3. E O CORTE DO REFLEXO ESTAVA CONDICIONADO À MEDIDA ERRADA.
      `floorReflectionCost()` devolve ms de SUBMISSÃO, e o próprio
      `floor-reflection.ts` avisa por escrito que a conclusão antiga não pode ser
      copiada para a cena fundida: depois do `merge`, a submissão deixou de
      dominar e o que sobrou é PREENCHIMENTO, que aquele número não mede. Um
      limiar sobre a grandeza errada é um botão que às vezes liga.

   ---------------------------------------------------------------------------
   A RESPOSTA CERTA É UM PROXY, E ELE É IMEDIATO

   Toda ferramenta de vídeo tem um modo de prévia mais barato que o render final,
   e pela mesma razão: o que se decide olhando uma prévia de câmera é o
   MOVIMENTO. Resolução e reflexo do piso não mudam essa decisão; a fluidez
   MUDA — um percurso julgado a 24 fps parece brusco mesmo quando a curva é lisa.

   Então, enquanto a prévia toca, e voltando exatamente como estava ao pausar:

     · O REFLEXO DO PISO SAI, sem limiar nenhum. Ele é uma SEGUNDA RENDERIZAÇÃO
       COMPLETA da cena (`floor-reflection.ts`), e o diagnóstico do próprio
       estúdio na máquina do dono o mede em **4,6 ms de 16,2 ms — 29 % do
       quadro**. É o maior item isolado, e é o único que se pode devolver
       intacto.
     · A ESCALA DE RENDER CAI PARA `PREVIEW_SCALE`, NO PRIMEIRO QUADRO. Não
       adianta esperar o controlador: `SCALE_COOLDOWN_DOWN` é 900 ms POR DEGRAU,
       então ele levaria ~2 s para chegar onde este corte chega imediatamente — e
       uma prévia de 4 s teria metade dela travada antes de o socorro chegar. O
       custo de preenchimento segue a escala AO QUADRADO: 0,70 é menos da metade
       dos fragmentos.

   ⚠️ E O CONTROLADOR CONTINUA CONGELADO (`markBusy`), agora pelo motivo CERTO —
   que não é o flash:
     · no nível Alta o piso da faixa dele é 0,80, ou seja **acima** do que o
       proxy já aplicou: ele não tem nada melhor a oferecer sem DESCER DE NÍVEL;
     · e descer de nível no meio de um movimento LIGA O LOD (`lodMinPx` é 0 no
       Alta e positivo abaixo dele), o que faz centenas de peças pequenas
       aparecerem e sumirem — isto sim seria visto como "flicando";
     · e quatro segundos de percurso não são um regime permanente para o medidor
       aprender. É a mesma razão que `markBusy()` documenta para a gravação.

   ⚠️ A ESCALA NÃO É PERSISTIDA (`setScale` só avisa ouvintes, ver
   `core/quality.ts`), então mexer nela aqui não deixa rastro na sessão do
   usuário — e a restauração é guardada, não recalculada. */

/** Escala de render da prévia. 0,70 é menos da metade do preenchimento de 1,0 e
 *  continua legível para julgar enquadramento — a 1440p ainda são ~1000 linhas. */
const PREVIEW_SCALE = 0.7;

/** O que foi mexido, para devolver exatamente isso. `null` = não mexemos. */
let proxy: { reflect: boolean; scale: number } | null = null;

/** A interface pergunta para escrever a ressalva na tela. */
export const previewDroppedReflection = () => !!proxy?.reflect;
export const isPreviewProxyOn = () => proxy !== null;

function enterProxy() {
  if (proxy) return;
  proxy = { reflect: isFloorReflectionOn(), scale: renderScale() };
  if (proxy.reflect) setFloorReflection(false);
  if (proxy.scale > PREVIEW_SCALE + 1e-4) setRenderScale(PREVIEW_SCALE);
  invalidate();
}

function leaveProxy() {
  if (!proxy) return;
  const { reflect, scale } = proxy;
  proxy = null;
  setFloorReflection(reflect);
  /* Só devolve a escala se ela ainda for a NOSSA: entre o play e o pause alguém
     pode tê-la fixado pelo console ou pelo painel, e sobrescrever uma escolha
     explícita do usuário seria pior do que deixar a prévia barata no ar. */
  if (Math.abs(renderScale() - PREVIEW_SCALE) < 1e-4) setRenderScale(scale);
  invalidate();
}

/* ---------------- QUANTOS QUADROS A PRÉVIA ESTÁ ENTREGANDO ----------------
   Medido e MOSTRADO, e isso é metade do conserto — a outra metade é o proxy.

   ⚠️ PORQUE A PERGUNTA POR TRÁS DE "a prévia está travada" QUASE SEMPRE É OUTRA:
   *"o vídeo vai sair assim?"*. E a resposta é NÃO, categoricamente: o arquivo é
   desenhado quadro a quadro, fora do tempo real, com um relógio virtual de
   1/60 s — é o desenho inteiro de `scene/record.ts`. Uma prévia a 24 fps numa
   máquina modesta produz um vídeo a 60 fps liso, e sem esta linha na tela não há
   como o usuário saber disso. */
let fpsFrames = 0;
let fpsWindow = 0;
let fpsValue = 0;

/** Quadros por segundo medidos na prévia. `0` enquanto não houver amostra. */
export const previewFps = () => fpsValue;

/** Toca (ou retoma) a prévia. Sem caminho, não faz nada. */
export function playTimelinePreview(): boolean {
  const p = buildTimelinePath();
  if (!p) return false;
  if (playing) return true;
  /* Uma prévia que acabou recomeça do zero: apertar ▶ com o cabeçote no fim e
     não ver nada acontecer é a interface parecendo quebrada. */
  if (previewT >= p.duration - 1e-3) previewT = 0;
  fpsFrames = 0;
  fpsWindow = 0;
  fpsValue = 0;
  /* O giro de apresentação giraria POR CIMA das poses escritas. */
  setTurntable(false);
  grabControls();
  enterProxy();
  driver = { kind: 'preview' };
  playing = true;
  invalidate();
  tickOut();
  return true;
}

export function pauseTimelinePreview() {
  if (!playing) return;
  playing = false;
  driver = null;
  releaseControls();
  leaveProxy();
  tickOut();
}

/** Para e devolve o cabeçote ao começo. */
export function stopTimelinePreview() {
  playing = false;
  driver = null;
  previewT = 0;
  releaseControls();
  leaveProxy();
  tickOut();
}

/**
 * Leva o cabeçote (e a câmera) a um instante.
 *
 * É o que faz o arrasto na régua ser uma prévia quadro a quadro em vez de um
 * número que anda: a mesma `place()` da gravação, chamada com o tempo sob o
 * dedo.
 */
export function seekTimelinePreview(t: number) {
  const p = buildTimelinePath();
  if (!p) return;
  previewT = clamp(t, 0, p.duration);
  if (playing) { tickOut(); return; }
  /* SEM PRENDER OS CONTROLES, e de propósito: quem arrasta a régua está com o
     ponteiro FORA do canvas, então não há arrasto de órbita a disputar — e
     quem solta a régua quer voltar a orbitar no gesto seguinte, sem um estado
     preso esperando alguém devolvê-lo. O `driver` continua nulo, então o
     gancho de quadro não reescreve nada e a pose posta permanece. */
  p.place(previewT);
  invalidate();
  tickOut();
}

/** Voa até a pose de um ponto, em ~0,45 s. Instantâneo seria um corte, e um
 *  corte faz meio bairro dissolver de uma vez (ver `seethrough.ts`). */
export function flyToTimelineKey(id: number, seconds = 0.45): boolean {
  const k = keys.find((x) => x.id === id);
  if (!k) return false;
  if (playing) pauseTimelinePreview();
  setTurntable(false);
  grabControls();
  driver = { kind: 'fly', t: 0, dur: Math.max(0.05, seconds), from: livePose(), to: keyPose(k) };
  invalidate();
  return true;
}

/* ===========================================================================
   ENTRAR E SAIR DO MODO
   ===========================================================================
   Três coisas mudam no ESTADO DA CENA enquanto o criador está aberto, e as três
   têm de ser desfeitas — inclusive numa saída de rota, que é o caminho que
   ninguém testa:

     1. o GIRO DE APRESENTAÇÃO é desligado. Ele gira por cima de qualquer pose
        escrita, e um ponto marcado com o giro ligado grava um enquadramento que
        não existe mais um segundo depois;
     2. o DESVIO DAS CONSTRUÇÕES é suspenso. É a mesma decisão que `record.ts`
        toma para os três modos, e aqui ela vale desde a AUTORIA: o desvio
        corrige a pose por baixo, então uma chave marcada com ele ligado guarda
        a pose CORRIGIDA e a gravação — que roda com ele suspenso — reproduziria
        outra. Suspender desde o começo é o que faz o que se compõe ser o que
        se grava;
     3. a LENTE volta ao valor de fábrica. Ver o § A LENTE VIVA. */

export const isTimelineMode = () => modeOn;

export function enterTimelineMode() {
  if (modeOn) return;
  modeOn = true;
  fovBefore = camera.fov;
  setTurntable(false);
  suspendAvoidance(true);
  invalidate();
}

export function exitTimelineMode() {
  if (!modeOn) return;
  modeOn = false;
  stopTimelinePreview();
  leaveProxy();
  suspendAvoidance(false);
  if (Math.abs(camera.fov - fovBefore) > 1e-4) {
    camera.fov = fovBefore;
    camera.updateProjectionMatrix();
  }
  invalidate();
}

/**
 * Reafirma o estado do modo depois de uma gravação.
 *
 * ⚠️ ISTO NÃO É PARANOIA. `suspendAvoidance()` é um booleano GLOBAL, não um
 * contador: o `finally` de `recordScene()` o devolve para `false` sem saber que
 * o criador ainda está aberto, e a partir daí o desvio voltaria a corrigir as
 * poses que o usuário compõe — sem nada na tela dizendo que a régua mudou no
 * meio do trabalho.
 */
export function reassertTimelineMode() {
  if (!modeOn) return;
  suspendAvoidance(true);
}

/* ---------------------------------------------------------------------------
   O QUE ESTE ARQUIVO DELIBERADAMENTE NÃO FAZ

   CORTES. Todo ponto é ligado ao seguinte por um movimento; não há "pule
   direto". Um corte seco faria a dissolvência das construções (`seethrough.ts`,
   rampa de ~550 ms) reagir de uma vez e meio bairro apareceria durante o
   primeiro segundo do plano novo — o mesmo motivo pelo qual o modo cinemático
   encadeia os seis planos em vez de cortá-los. Quem quiser um corte monta dois
   vídeos.

   VELOCIDADE POR TRECHO ("acelere aqui, desacelere ali"). O tempo de viagem já
   é isso, dito na unidade que a pessoa tem na cabeça: dois pontos distantes com
   um segundo entre eles é um movimento rápido. Um segundo controle de
   aceleração seria uma segunda forma de dizer a mesma coisa, e as duas
   discordariam.

   PERSISTÊNCIA EM DISCO. Ver o ⚠️ do estado de módulo. */
