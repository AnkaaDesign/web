/* PERFIL DE QUALIDADE — o teto onde ele está, e um piso para quem precisa.
   ===========================================================================
   O pedido que originou este arquivo (2026-08-13): *"identificar o quão bom é o
   computador do usuário e adaptar a qualidade do truck studio baseado no
   hardware da pessoa — no meu está muito bom, mas se eu tivesse um computador
   com menos desempenho, diminuir a qualidade para se adaptar"*.

   Leia a frase com cuidado, porque ela define o que este módulo PODE fazer: o
   alvo não é "deixar mais rápido", é **manter o teto onde está e criar um
   piso**. Numa máquina que aguenta, nada aqui muda um pixel — o nível Alto é,
   valor por valor, exatamente o que o estúdio sempre fez. Só a máquina que não
   aguenta desce, e desce sabendo.

   ---------------------------------------------------------------------------
   A REGRA QUE GOVERNA TUDO, E DA QUAL NÃO SE ABRE MÃO

       O perfil só mexe em AMOSTRAGEM. Nunca em decisão visual autorada.

   Resolução de render, anisotropia, resolução de sombra, número de amostras,
   LOD — sim. Cor, exposição, tonemap, preset, ângulo de luz, arranjo de
   cenário, o que é pintável, onde a arte cai — JAMAIS.

   O teste prático, e ele é literal: **uma captura tirada no nível Baixo tem de
   sair com o mesmo enquadramento e a mesma luz da tirada no Alto, só mais
   serrilhada.** Se sair com outra cor, o perfil passou da alçada dele.

   COROLÁRIO, e ele é o que impede este módulo de degradar o PRODUTO: a captura
   (`scene/capture.ts`) e a gravação (`scene/record.ts`) rodam SEMPRE no teto. A
   captura já é imune por construção — ela renderiza em ladrilhos para um
   `WebGLRenderTarget` próprio, que tem o próprio viewport e não passa por
   `setPixelRatio` (o cabeçalho de capture.ts diz isso). Ou seja: um PC fraco
   pode ter uma vista 3D suave E baixar exatamente a mesma imagem que o PC bom
   baixa; só demora mais para gerá-la. É o oposto de um sistema que entrega
   menos produto para quem tem menos máquina.

   ---------------------------------------------------------------------------
   POR QUE ESTE ARQUIVO NÃO IMPORTA NADA DO ENGINE

   Ele é FOLHA de propósito, e a restrição é real, não estética. `scene.ts` cria
   o `WebGLRenderer` no ESCOPO DE MÓDULO — a primeira linha do cabeçalho de lá
   diz isso —, então qualquer coisa que precise ser decidida ANTES do renderer
   existir tem de vir de um módulo que possa ser importado no topo dele sem
   fechar ciclo. `antialias`, por exemplo, é parâmetro de construtor: não há
   segunda chance.

   É a mesma razão de `vehicle/paint.ts` ser sumidouro, e a lição é a mesma:
   quem tem de responder cedo não pode depender de quem nasce tarde.

   ---------------------------------------------------------------------------
   TRÊS EIXOS DE DECISÃO, E NENHUM BASTA SOZINHO

   1. SONDA ESTÁTICA (`probeHardware`) — o que dá para saber antes do primeiro
      quadro. É rápida e é um palpite: ela acerta o caso extremo (sem WebGL2,
      rasterizador de software) e chuta o meio.
   2. MEDIDOR DE QUADRO (`reportFrameTime`) — o único juiz honesto. Média móvel
      exponencial do tempo de quadro, contada só em quadros DESENHADOS.
   3. A ESCOLHA DO USUÁRIO — que ganha dos outros dois, sempre, e é lembrada.

   ⚠️ **AUSÊNCIA DE INFORMAÇÃO NUNCA SIGNIFICA "FRACO".** O Firefox mascara
   `UNMASKED_RENDERER_WEBGL` por privacidade e o Chromium pode remover a
   extensão a qualquer versão. Se a string não vier, o veredito é DESCONHECIDO e
   o piso é o nível Alto — porque o defeito que este sistema existe para não ter
   é justamente "o Firefox inteiro caiu para Baixo em máquinas boas". Só o
   MEDIDOR pode rebaixar quem não se identificou. */

/* ---------------------------------------------------------------------------
   OS NÍVEIS
   --------------------------------------------------------------------------- */

export type QualityLevel = 'alta' | 'media' | 'baixa';
/** `auto` deixa o medidor decidir; os três nomes CONGELAM o nível. */
export type QualityMode = 'auto' | QualityLevel;

export const LEVELS: QualityLevel[] = ['baixa', 'media', 'alta'];
export const LEVEL_LABEL: Record<QualityLevel, string> = {
  alta: 'Alta', media: 'Média', baixa: 'Baixa',
};

/**
 * Os botões que o perfil pode girar — e SÓ eles.
 *
 * Todos são QUENTES: trocáveis a qualquer momento, sem recompilar um shader.
 * Essa divisão é o que torna a adaptação automática segura por construção — uma
 * adaptação que causasse um engasgo de recompilação seria precisamente o
 * defeito que ela existe para evitar.
 *
 * O QUE FICOU DE FORA, E POR QUÊ (os FRIOS):
 *   `antialias`          parâmetro de construtor do renderer; uma vez só.
 *   `NUM_SPOT_LIGHTS`    é chave de cache de programa — recompila a cena inteira.
 *   `shadowMap.type`     é `#define`.
 * Os três só mudam sob cortina, por ato do usuário, e nenhum deles está aqui.
 */
export interface QualityProfile {
  /** Teto do `devicePixelRatio`. O custo de preenchimento escala com o QUADRADO
   *  disto, e é por isso que ele é o botão dominante: entre um 4K a DPR 2 e um
   *  1080p a DPR 1 há 16× de diferença de pixels, decidida por este número. */
  pixelRatioCap: number;
  /** Lado do mapa de sombra. Realocação de alvo — barata e trocável a qualquer
   *  momento, ao contrário do TIPO do mapa, que é `#define`. */
  shadowMapSize: number;
  /** Anisotropia das texturas do veículo (`material-setup.ts`). */
  anisotropyVehicle: number;
  /** Anisotropia do albedo do chão (`set.ts`). O chão é visto quase sempre em
   *  ângulo rasante, que é exatamente o caso que a anisotropia existe para
   *  resolver — daí ele ter um número próprio, mais alto que o do veículo. */
  anisotropyGround: number;
  /**
   * O reflexo do piso do Estúdio — LIGA/DESLIGA, e não uma escala.
   *
   * A tentação era degradá-lo por níveis (meia resolução, sem MSAA), e a
   * medição registrada em `floor-reflection.ts` diz que isso não paga:
   * **14,1 fps a meio lado contra 14,7 a um quarto**. O gargalo é a segunda
   * varredura de GEOMETRIA, não a taxa de preenchimento — baixar a resolução do
   * alvo devolve meio fps e cobra por isso uma silhueta serrilhada que cintila
   * no giro (o próprio arquivo chama isso de "a outra metade do tremido").
   *
   * Ou seja: escalar seria qualidade perdida de graça. Ou a passada acontece
   * inteira, ou não acontece. No Médio ela fica INTEIRA de propósito — o
   * Estúdio é o cenário que existe para julgar cor, e um piso sem reflexo muda
   * a leitura da lataria. Só o Baixo abre mão dela.
   */
  floorReflection: boolean;
  /** Casca de laranja do verniz (`paint.ts` → `uPeel`). É o trecho mais caro do
   *  shader de tinta (4 avaliações de altura, 2 ruídos cada) e o efeito mais
   *  sutil dos três acima de ~2 m. Uniforme, então não recompila. */
  orangePeel: boolean;
}

/* Os números do nível ALTO não são "o máximo que dá": são, valor por valor, o
   que o estúdio já fazia antes deste arquivo existir. Isso é verificável e é
   para ser verificado — `min(dpr, 2)` estava em scene.ts:247, o 3072 em
   scene.ts:609 (e ele já era `min` com `maxTextureSize`), o 8 em
   material-setup.ts:145, o máximo do dispositivo em set.ts:219, e o
   `SCALE 0,5` + MSAA 4 em floor-reflection.ts. Se algum dia esta tabela e o
   código divergirem, é a tabela que está errada. */
const PROFILES: Record<QualityLevel, QualityProfile> = {
  alta: {
    pixelRatioCap: 2,
    shadowMapSize: 3072,
    anisotropyVehicle: 8,
    anisotropyGround: 16,          // "o máximo do dispositivo", limitado adiante
    floorReflection: true,
    orangePeel: true,
  },
  media: {
    pixelRatioCap: 1.5,
    shadowMapSize: 2048,
    anisotropyVehicle: 4,
    anisotropyGround: 8,
    /* INTEIRO, e não reduzido — ver a nota do campo. Reduzi-lo devolve meio fps
       e cobra uma silhueta que cintila no giro. */
    floorReflection: true,
    orangePeel: true,
  },
  baixa: {
    pixelRatioCap: 1,
    shadowMapSize: 1024,
    anisotropyVehicle: 2,
    anisotropyGround: 2,
    floorReflection: false,        // a segunda passada inteira sai
    orangePeel: false,
  },
};

/* ---------------------------------------------------------------------------
   A SONDA ESTÁTICA
   --------------------------------------------------------------------------- */

export interface HardwareProbe {
  /** Há WebGL2? Sem isso o engine não sobe: three r163+ é WebGL2-only. */
  webgl2: boolean;
  /** A string do adaptador, ou `null` quando mascarada. `null` é DESCONHECIDO. */
  renderer: string | null;
  /** O adaptador é um rasterizador de SOFTWARE — ou seja, a aceleração gráfica
   *  do navegador está desligada (ou indisponível). É o único veredito de
   *  hardware em que esta sonda tem certeza. */
  software: boolean;
  /** Reconhecidamente modesto (integrada antiga, móvel). Palpite, não certeza. */
  weakHint: boolean;
  cores: number;
  /** GB, só no Chromium; 0 = não informado. */
  memoryGB: number;
  maxTextureSize: number;
  maxAnisotropy: number;
  /** Pixels que a tela pede, já com o DPR — o que importa mais que a GPU. */
  pixels: number;
  touch: boolean;
}

/* Rasterizadores de software. Esta lista é de CERTEZA: qualquer uma destas
   strings significa que não há placa envolvida, e nenhum ajuste de qualidade
   conserta isso — é o caso do aviso de aceleração desligada, não o do perfil. */
const SOFTWARE_RE = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic|apple software/i;
/* Famílias reconhecidamente modestas. Esta lista é de PALPITE e só empurra o
   chute inicial: o medidor corrige em segundos, e uma máquina boa que caia aqui
   sobe sozinha. Por isso ela pode errar para o lado seguro sem custo. */
const WEAK_RE = /(intel).*(hd|uhd) graphics|gma|vega\s?[38]\b|radeon r[2-5]\b|mali-?[gt]?[0-6]|adreno\s?[1-5]\d\d|powervr|videocore|geforce (8|9|2\d\d|3\d\d|4\d\d|5\d\d|610m|710m|810m)/i;

let probed: HardwareProbe | null = null;

/**
 * Sonda o adaptador. Memoizada: cria UM canvas descartável e o solta.
 *
 * Roda antes de qualquer coisa do engine e não pode lançar em hipótese nenhuma
 * — ela é justamente o que existe para transformar "o app quebrou" numa tela
 * que diz o que fazer.
 */
export function probeHardware(): HardwareProbe {
  if (probed) return probed;
  const out: HardwareProbe = {
    webgl2: false, renderer: null, software: false, weakHint: false,
    cores: 0, memoryGB: 0, maxTextureSize: 0, maxAnisotropy: 0,
    pixels: 0, touch: false,
  };
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    out.cores = nav.hardwareConcurrency || 0;
    out.memoryGB = nav.deviceMemory || 0;
    out.pixels = Math.round(
      (window.innerWidth || 1280) * (window.innerHeight || 720)
      * Math.min(window.devicePixelRatio || 1, 2));
    out.touch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const gl = canvas.getContext('webgl2', {
      failIfMajorPerformanceCaveat: false,
      powerPreference: 'high-performance',
    }) as WebGL2RenderingContext | null;
    if (!gl) return (probed = out);
    out.webgl2 = true;
    out.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    out.maxAnisotropy = aniso
      ? gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 0 : 0;

    /* MASCARADO NO FIREFOX POR PRIVACIDADE, e pode sumir do Chromium a qualquer
       versão. Um `null` aqui é "não sei", e a política de `null` é tratar como
       máquina BOA — ver o aviso no cabeçalho. */
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      const s = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
      if (typeof s === 'string' && s) {
        out.renderer = s;
        out.software = SOFTWARE_RE.test(s);
        out.weakHint = !out.software && WEAK_RE.test(s);
      }
    }
    /* Solta o contexto na hora: um contexto WebGL vivo conta para o limite do
       navegador (~16), e este aqui já respondeu tudo que tinha a responder. */
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* sonda nunca lança — ver o doc */ }
  return (probed = out);
}

/**
 * O nível que a sonda estática sugere, antes de qualquer quadro ter sido
 * desenhado. É um CHUTE, e é assumido como tal: o medidor o substitui em
 * segundos. Serve para não abrir a sessão inteira errada numa máquina que
 * qualquer um reconheceria de longe.
 */
export function suggestLevel(p = probeHardware()): QualityLevel {
  if (!p.webgl2) return 'baixa';
  /* Rasterizador de software: nem o nível Baixo salva, mas é o menos ruim, e é
     o único caso em que esta função tem CERTEZA em vez de palpite. */
  if (p.software) return 'baixa';

  let score = 0;
  /* Sinais que empurram para baixo. Nenhum sozinho decide. */
  if (p.weakHint) score -= 2;
  if (p.touch) score -= 1;
  if (p.cores && p.cores <= 4) score -= 1;
  if (p.memoryGB && p.memoryGB <= 4) score -= 2;
  else if (p.memoryGB && p.memoryGB <= 8) score -= 1;
  /* PIXELS A PREENCHER, que importa mais que a placa: um 4K numa integrada é
     pior que um 1080p na mesma integrada, e o custo é o mesmo shader. */
  if (p.pixels > 5_000_000) score -= 1;
  /* E os que empurram para cima. */
  if (p.cores >= 12) score += 1;
  if (p.memoryGB >= 16) score += 1;
  if (p.maxTextureSize >= 16384) score += 1;

  if (score <= -3) return 'baixa';
  if (score <= -1) return 'media';
  return 'alta';
}

/* ---------------------------------------------------------------------------
   O ESTADO, E A MEMÓRIA DELE
   --------------------------------------------------------------------------- */

/* Mesma família de chave do resto do estúdio (`truckstudio.hud.v1`). */
const KEY = 'truckstudio.quality.v1';

let mode: QualityMode = 'auto';
let level: QualityLevel = 'alta';
let hydrated = false;

function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const j = JSON.parse(raw) as { mode?: string };
      if (j.mode === 'auto' || j.mode === 'alta' || j.mode === 'media' || j.mode === 'baixa') {
        mode = j.mode;
      }
    }
  } catch { /* storage bloqueado: o padrão vale */ }
  level = mode === 'auto' ? suggestLevel() : mode;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ mode })); } catch { /* idem */ }
}

const listeners: ((l: QualityLevel, m: QualityMode) => void)[] = [];
/** Avisado a cada mudança EFETIVA de nível, e também quando só o modo muda. */
export function onQualityChange(cb: (l: QualityLevel, m: QualityMode) => void) {
  listeners.push(cb);
  return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); };
}
const emit = () => { for (const cb of listeners) cb(level, mode); };

export function qualityLevel(): QualityLevel { hydrate(); return level; }
export function qualityMode(): QualityMode { hydrate(); return mode; }

/**
 * O perfil vigente, já limitado pelo que o adaptador REALMENTE tem.
 *
 * O limite é aplicado aqui e não na tabela porque a tabela é a INTENÇÃO e o
 * device é o fato: pedir anisotropia 16 a uma placa que dá 4 não é erro, é um
 * pedido que o three apara sozinho — mas aparar aqui deixa `getProfile()`
 * dizendo a verdade sobre o que vai acontecer, e é isso que a interface mostra.
 */
export function getProfile(): QualityProfile {
  hydrate();
  const p = PROFILES[level];
  const hw = probeHardware();
  const maxA = hw.maxAnisotropy || 1;
  const maxT = hw.maxTextureSize || 2048;
  return {
    ...p,
    anisotropyVehicle: Math.min(p.anisotropyVehicle, maxA),
    anisotropyGround: Math.min(p.anisotropyGround, maxA),
    shadowMapSize: Math.min(p.shadowMapSize, maxT),
  };
}

/**
 * O lado do mapa de sombra do TETO, seja qual for o nível vigente.
 *
 * Existe para a CAPTURA, e é a única coisa neste módulo que serve para IGNORAR
 * o perfil em vez de aplicá-lo. A regra do cabeçalho diz que a imagem baixada é
 * o produto e não se degrada nunca; a resolução de render já obedece por
 * construção (a captura tem alvo próprio), mas o mapa de sombra é global do
 * renderizador e obedeceria ao nível se ninguém o levantasse. Ver
 * `scene/capture.ts`.
 */
export const ceilingShadowMapSize = () =>
  Math.min(PROFILES.alta.shadowMapSize, probeHardware().maxTextureSize || 3072);

/** O perfil de um nível qualquer, sem mexer no vigente (a bancada usa). */
export const profileOf = (l: QualityLevel): QualityProfile => ({ ...PROFILES[l] });

function setLevel(next: QualityLevel, why: string) {
  if (next === level) return;
  const from = level;
  level = next;
  console.info(`[qualidade] ${from} → ${next} · ${why}`);
  emit();
}

/**
 * A escolha do usuário. `auto` devolve a decisão ao medidor; um nome a CONGELA.
 *
 * Congelar é um direito, e é por isso que o medidor nem é consultado depois:
 * quem escolheu Alta num PC fraco escolheu ver 20 fps, e passar por cima disso
 * seria o app discordando de uma decisão explícita.
 */
export function setQualityMode(next: QualityMode) {
  hydrate();
  mode = next;
  save();
  if (next === 'auto') {
    resetMeter();
    setLevel(suggestLevel(), 'automático, pela sonda de hardware');
  } else {
    setLevel(next, 'escolha do usuário');
  }
  emit();
}

/* ---------------------------------------------------------------------------
   O MEDIDOR — o único juiz honesto
   --------------------------------------------------------------------------- */

/* Média móvel exponencial do tempo de quadro. A janela é curta o bastante para
   reagir e longa o bastante para não perseguir um pico. */
const EMA_ALPHA = 0.1;
/* Sobe de nível com folga sustentada; desce com aperto sustentado. As duas
   janelas são DIFERENTES de propósito: descer é urgente (o usuário está
   sofrendo agora), subir pode esperar (ele não está perdendo nada). */
const UP_MS = 13, UP_HOLD = 4000;
const DOWN_MS = 28, DOWN_HOLD = 2000;
/* Um degrau por vez, e nunca dois seguidos sem respiro. Sem isto, uma cena que
   fica pesada por dois segundos desce dois níveis e a imagem "desmonta". */
const STEP_COOLDOWN = 10000;
/* Teto de descidas por sessão. Existe para o caso patológico: uma máquina que
   oscila em volta do limiar não pode passar a sessão inteira mudando de nível —
   isso é pior que ficar no nível errado, porque a IMAGEM MUDANDO é o que o
   usuário percebe, não o fps. */
const MAX_DROPS = 3;

let ema = 0;
let goodSince = 0, badSince = 0, lastStep = 0, drops = 0;

function resetMeter() { ema = 0; goodSince = badSince = 0; }

/**
 * Um quadro DESENHADO levou `ms`. Chamado do laço, e só de lá.
 *
 * ⚠️ **SÓ EM QUADRO DESENHADO.** Com o laço sob demanda, um quadro pulado custa
 * ~0 ms e mentiria descaradamente: a média despencaria com a cena parada e o
 * adaptador concluiria que a máquina é um foguete justamente quando ela não
 * está fazendo nada. `scene.ts` chama isto depois do `render()`, e é por isso.
 *
 * `busy` é a segunda trava: gravação em curso, tween de preset, carga de
 * veículo ou de cenário. Todos são picos CONHECIDOS, e adaptar em cima de um
 * pico conhecido é aprender a coisa errada — o nível cairia toda vez que o
 * usuário trocasse de caminhão, que é o momento em que ele mais está olhando.
 */
export function reportFrameTime(ms: number, busy: boolean) {
  hydrate();
  if (mode !== 'auto') return;
  if (busy || !Number.isFinite(ms) || ms <= 0) { goodSince = badSince = 0; return; }
  ema = ema ? ema + (ms - ema) * EMA_ALPHA : ms;

  const now = performance.now();
  if (now - lastStep < STEP_COOLDOWN) return;

  if (ema > DOWN_MS) {
    goodSince = 0;
    if (!badSince) badSince = now;
    else if (now - badSince > DOWN_HOLD && drops < MAX_DROPS) {
      const i = LEVELS.indexOf(level);
      if (i > 0) {
        drops++;
        lastStep = now; badSince = 0;
        setLevel(LEVELS[i - 1], `${ema.toFixed(1)} ms por quadro sustentados`);
      }
    }
  } else if (ema < UP_MS) {
    badSince = 0;
    if (!goodSince) goodSince = now;
    else if (now - goodSince > UP_HOLD) {
      const i = LEVELS.indexOf(level);
      if (i < LEVELS.length - 1) {
        lastStep = now; goodSince = 0;
        setLevel(LEVELS[i + 1], `${ema.toFixed(1)} ms por quadro sustentados`);
      }
    }
  } else {
    goodSince = badSince = 0;
  }
}

/** Tempo de quadro médio medido, em ms. 0 = ainda não mediu. */
export const frameTimeEma = () => ema;

/** Diagnóstico legível — o que a bancada e o console leem. */
export function qualityInfo() {
  const hw = probeHardware();
  return {
    modo: qualityMode(),
    nivel: qualityLevel(),
    sugestaoDaSonda: suggestLevel(),
    msPorQuadro: Math.round(ema * 10) / 10,
    rebaixamentos: drops,
    hardware: hw,
    perfil: getProfile(),
  };
}
