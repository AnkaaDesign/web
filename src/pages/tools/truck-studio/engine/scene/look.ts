/* O FILTRO — a graduação de cor do estúdio.
   ===========================================================================
   O PEDIDO, nas palavras do dono:

       *"disponibilize alguns tipos de filtros, diferentes, quentes e frios para
        aplicar"*

   e antes dele o diagnóstico que o motivou, sobre um vídeo já gravado: a cena
   sai CHAPADA — preto do baú lendo cinza-médio, céu leitoso, nitidez uniforme
   do para-choque à árvore do fundo. Nada disso é falta de luz nem de modelo; é
   o que falta DEPOIS do render.

   ---------------------------------------------------------------------------
   ONDE ELE ENTRA, E POR QUE NÃO NO MAPEAMENTO DE TONS

   A tentação óbvia é remendar `ShaderChunk.tonemapping_pars_fragment` e sair com
   `CustomToneMapping`: um só ponto, sem passe extra, e a foto herdaria de graça
   (`scene/capture.ts` marca o alvo como `isXRRenderTarget` justamente para que
   `renderer.toneMapping` valha lá dentro). Duas coisas mataram esse caminho:

   1. **TROCAR DE FILTRO EXIGIRIA RECOMPILAR A CENA.** O conteúdo de um
      `ShaderChunk` não entra na chave de cache de programa do three — mudar o
      texto do remendo não invalida nada, e obrigar `needsUpdate` em todo
      material da cena para ver o filtro seguinte transformaria um seletor de
      oito pastilhas numa fila de oito recompilações. É o mesmo argumento que
      `scene/record.ts` já usa para chamar `spotPool`/`shadowType`/`antialias` de
      "botões FRIOS".
   2. **A GRADUAÇÃO É DISPLAY-REFERRED, e o mapeamento de tons não é.** O filtro
      que o dono aprovou foi montado no ffmpeg SOBRE o arquivo pronto — curva,
      balanço por faixa tonal e saturação em cima do sRGB já codificado. Rodar a
      mesma matemática antes do ACES daria outro resultado, e "outro resultado"
      aqui quer dizer "não é o que ele escolheu".

   Então o filtro é um PASSE DE TELA CHEIA sobre o quadro pronto, e ele roda em
   TRÊS sítios, todos amostrando bytes sRGB e escrevendo bytes sRGB — ou seja a
   MESMA matemática, no MESMO espaço, sem uma segunda implementação para
   discordar da primeira:

     tela / vídeo   `onGrade()` em scene.ts, logo depois do `renderer.render()`
     foto           `gradeTile()` entre o render do ladrilho e a leitura
     miniatura      `gradeTile()`, idem, em `poseThumbnail()`

   ⚠️ E OS TRÊS AMOSTRAM SEM DECODIFICAÇÃO. `FramebufferTexture` nasce em
   `NoColorSpace`, e o alvo do mosaico tem `internalFormat = 'RGBA8'` cravado
   (ver o cabeçalho de `capture.ts`: os três campos andam juntos) — nos dois
   casos o `getInternalFormat()` do three devolve RGBA8 e NÃO SRGB8_ALPHA8, logo
   não há decodificação em hardware na amostragem. O que o shader lê é o byte
   que está lá. Um `ShaderMaterial` cru também não recebe o `colorspace_fragment`
   na saída, então o que ele escreve é o byte que fica. O ciclo fecha exato.

   ---------------------------------------------------------------------------
   ⚠️ O FILTRO PARA ANTES DA VINHETA DE ENCERRAMENTO, E ISSO É DELIBERADO

   `onGrade` é uma lista SEPARADA de `onOverlay`, chamada antes dela. A marca da
   Ankaa é a única coisa na tela cuja cor não é uma escolha estética — o verde é
   o verde —, e um filtro âmbar sobre ela entrega um logo bege. `scene/outro.ts`
   já desliga o ACES pelo mesmo motivo (`toneMapped: false`); aqui a resposta é a
   ORDEM. No caminho offline o desenho é `renderOfflineFrame()` → `drawOutro()`,
   e como a graduação mora dentro do primeiro, a vinheta cai por cima dela
   intocada, sem que `record.ts` precise saber que filtros existem.

   ---------------------------------------------------------------------------
   O QUE NÃO TEM AQUI, E POR QUÊ

   **HALAÇÃO / BLOOM.** É o efeito que mais mata a cara de CG, e foi o único da
   prévia em ffmpeg que ficou de fora. O motivo é o mosaico: um borrão lê pixels
   VIZINHOS, e na foto de 7680 px os vizinhos de um ladrilho estão no ladrilho
   seguinte, que ainda não foi renderizado. Sairia uma costura visível a cada
   1920 px — exatamente o defeito que o cabeçalho de `capture.ts` documenta em
   "POR QUE OS LADRILHOS NÃO COSTURAM". Tudo que está aqui depende só do pixel e
   da sua coordenada NO QUADRO INTEIRO (`uFrame`), e por isso é costura-livre por
   construção: vinheta e grão inclusive. */
import * as THREE from 'three';
import { renderer, onGrade, invalidate } from './scene';

/* ---------------- o catálogo ---------------- */

export type LookTemp = 'neutro' | 'quente' | 'frio';

export interface Look {
  id: string;
  name: string;
  /** Para a legenda do seletor e para agrupar as pastilhas. */
  temp: LookTemp;
  /** Uma linha do que ele faz — vira o `title` da pastilha. */
  hint: string;
  /** Intensidade da curva S (0 = reta, 1 = smoothstep puro). */
  scurve: number;
  /** Ponto de preto: quanto do pé é comido antes de renormalizar. */
  black: number;
  /** Ganho POR CANAL — o balanço de branco do filtro. `[1,1,1]` é neutro.
   *  ⚠️ ELE É A ALAVANCA QUE FAZ "QUENTE" E "FRIO" LEREM COMO TAL, e por isso
   *  ele é vetor e não escalar. Os desvios por faixa tonal (`shadow`/`high`)
   *  somam alguns centésimos e desaparecem quando a própria cena já é quente —
   *  um poente engole um tingimento azul de +0,03 nas sombras. Um multiplicador
   *  por canal age em TODA a imagem, inclusive nas altas luzes onde a soma
   *  satura, e é o que separa os dois grupos de relance. */
  gain: [number, number, number];
  /** Saturação, 1 = neutra. */
  sat: number;
  /** Cor somada às sombras / meios-tons / altas luzes. */
  shadow: [number, number, number];
  mid: [number, number, number];
  high: [number, number, number];
  /** Vinheta, 0..1. */
  vignette: number;
  /** Grão, em amplitude de sinal (0,02 já é bem visível). */
  grain: number;
}

/* ⚠️ UMA FUNÇÃO E NÃO UM OBJETO, e a diferença não é estilo. Espalhado
   (`...NEUTRAL`), um objeto entregaria a MESMA REFERÊNCIA de `shadow`/`mid`/
   `high` a todo filtro que não a sobrescreve — os quatro que hoje não tingem as
   sombras compartilhariam um array só. Ninguém o muta hoje (o shader lê por
   `fromArray`), então é uma armadilha adormecida e não um defeito; e uma
   armadilha adormecida num catálogo que vai crescer é exatamente a que acorda
   seis meses depois, no dia em que alguém escrever um controle deslizante para
   ajustar um filtro e vir três outros se mexerem junto. */
const neutral = (): Omit<Look, 'id' | 'name' | 'temp' | 'hint'> => ({
  scurve: 0, black: 0, gain: [1, 1, 1], sat: 1,
  shadow: [0, 0, 0], mid: [0, 0, 0], high: [0, 0, 0],
  vignette: 0, grain: 0,
});

/**
 * Os filtros, na ordem em que aparecem no painel.
 *
 * ⚠️ OS NÚMEROS NÃO SÃO CHUTE. `cinema` é a transcrição do tratamento que o dono
 * aprovou olhando o vídeo tratado no ffmpeg, e a curva bate ponto a ponto: a
 * `curves` daquela cadeia passava por (0,12 → 0,075) e (0,85 → 0,90), e
 * `mix(c, smoothstep(c), 0.55)` devolve 0,0764 e 0,899 nos mesmos dois pontos.
 * Os outros sete são desvios dele numa direção só de cada vez — é o que os torna
 * comparáveis entre si em vez de oito ajustes independentes.
 */
export const LOOKS: readonly Look[] = [
  {
    ...neutral(),
    id: 'nenhum', name: 'Nenhum', temp: 'neutro',
    hint: 'A imagem como o renderizador a entrega, sem tratamento',
  },
  {
    ...neutral(),
    id: 'padrao', name: 'Padrão', temp: 'neutro',
    hint: 'Contraste e vinheta discretos, sem desviar a cor da tinta',
    scurve: 0.35, black: 0.010, sat: 1.04, vignette: 0.16, grain: 0.008,
  },
  {
    ...neutral(),
    id: 'cinema', name: 'Cinema', temp: 'quente',
    hint: 'Sombra fria e alta luz quente — o tratamento aprovado no vídeo',
    scurve: 0.55, black: 0.018, gain: [1.020, 1.000, 0.975], sat: 1.12,
    shadow: [-0.020, 0.000, 0.034],
    mid: [0.006, 0.000, -0.006],
    high: [0.030, 0.008, -0.026],
    vignette: 0.22, grain: 0.014,
  },
  {
    ...neutral(),
    id: 'dourado', name: 'Dourado', temp: 'quente',
    hint: 'Luz de fim de tarde: alta luz puxada para o âmbar',
    scurve: 0.50, black: 0.014, gain: [1.045, 1.005, 0.945], sat: 1.10,
    shadow: [-0.012, -0.004, 0.018],
    mid: [0.012, 0.004, -0.012],
    high: [0.055, 0.026, -0.042],
    vignette: 0.24, grain: 0.012,
  },
  {
    ...neutral(),
    id: 'ambar', name: 'Âmbar', temp: 'quente',
    hint: 'Quente e dessaturado, com o preto aberto — leitura de filme antigo',
    scurve: 0.42, black: 0.026, gain: [1.050, 0.990, 0.900], sat: 0.82,
    shadow: [0.014, 0.002, -0.010],
    mid: [0.018, 0.006, -0.014],
    high: [0.048, 0.028, -0.038],
    vignette: 0.28, grain: 0.020,
  },
  {
    ...neutral(),
    id: 'frio', name: 'Frio', temp: 'frio',
    hint: 'Sombra azulada e preto fechado — leitura industrial',
    scurve: 0.60, black: 0.030, gain: [0.955, 0.995, 1.055], sat: 0.94,
    shadow: [-0.028, -0.008, 0.042],
    mid: [-0.010, 0.000, 0.014],
    high: [0.000, 0.010, 0.022],
    vignette: 0.26, grain: 0.014,
  },
  {
    ...neutral(),
    id: 'aco', name: 'Aço', temp: 'frio',
    hint: 'Muito contraste, pouca cor — o metal na frente da tinta',
    scurve: 0.70, black: 0.036, gain: [0.945, 0.990, 1.060], sat: 0.78,
    shadow: [-0.024, -0.004, 0.046],
    mid: [-0.012, 0.000, 0.016],
    high: [-0.010, 0.006, 0.028],
    vignette: 0.30, grain: 0.016,
  },
  {
    ...neutral(),
    id: 'noturno', name: 'Noturno', temp: 'frio',
    hint: 'Azul profundo e exposição para baixo — o pátio à noite',
    scurve: 0.50, black: 0.050, gain: [0.860, 0.900, 1.020], sat: 0.88,
    shadow: [-0.034, -0.014, 0.058],
    mid: [-0.014, -0.004, 0.026],
    high: [-0.014, 0.000, 0.030],
    vignette: 0.34, grain: 0.018,
  },
];

export const DEFAULT_LOOK = 'nenhum';

export const lookById = (id: string | null | undefined): Look =>
  LOOKS.find((l) => l.id === id) ?? LOOKS[0];

/* ---------------- o estado ---------------- */

const LOOK_KEY = 'ts.look';

/* Mesmo idioma de `ui/chrome.ts`: uma chave, try/catch nos dois lados, e um
   armazenamento recusado vale para a sessão em vez de derrubar o estúdio. */
function readStored(): string {
  try {
    const v = localStorage.getItem(LOOK_KEY);
    if (v && LOOKS.some((l) => l.id === v)) return v;
  } catch { /* modo privado, cota, política — o padrão serve */ }
  return DEFAULT_LOOK;
}

let current: Look = lookById(readStored());

const listeners = new Set<(l: Look) => void>();

export const currentLook = (): Look => current;
export const isLookActive = () => current.id !== 'nenhum';

export function onLookChange(fn: (l: Look) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/**
 * Troca o filtro. `persist` é falso quando quem escreveu foi um PROJETO sendo
 * aberto — a mesma disciplina de `restoreSceneState()`: abrir um arquivo não
 * pode reescrever a preferência da máquina de quem abriu.
 */
export function setLook(id: string, opts: { persist?: boolean } = {}): Look {
  const next = lookById(id);
  if (next.id === current.id) return current;
  current = next;
  writeUniforms();
  if (opts.persist !== false) {
    try { localStorage.setItem(LOOK_KEY, next.id); }
    catch { /* vale para a sessão */ }
  }
  for (const fn of listeners) fn(next);
  invalidate();
  return next;
}

/* ---------------- o passe ---------------- */

const VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

/* ⚠️ TUDO AQUI OPERA EM sRGB CODIFICADO, e é por isso que não há uma única
   `pow(c, 2.2)` no arquivo. Ver o cabeçalho: o passe amostra bytes de display e
   escreve bytes de display; converter para linear no meio daria uma curva
   diferente da que foi aprovada no ffmpeg, que também trabalha em display. */
const FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;

uniform sampler2D uTex;
/** uv do quadrilátero -> uv do QUADRO INTEIRO: (escalaX, escalaY, offX, offY).
    Na tela é (1,1,0,0); num ladrilho do mosaico é o recorte dele. É o que torna
    vinheta e grão idênticos numa foto de 16 ladrilhos e numa de um só. */
uniform vec4 uFrame;
uniform float uAspect;

uniform float uSCurve;
uniform float uBlack;
uniform vec3 uGain;
uniform float uSat;
uniform vec3 uShadow;
uniform vec3 uMid;
uniform vec3 uHigh;
uniform float uVignette;
uniform float uGrain;
uniform float uSeed;
/** Largura do QUADRO INTEIRO em pixels — só o grão a usa. Ver o passo 7. */
uniform float uFramePx;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

/* ⚠️ A SEMENTE ENTRA DENTRO DO sin(), E NÃO SOMADA A p. Somada à coordenada
   ela não sorteia um campo novo: ela TRANSLADA o mesmo campo, e o resultado num
   vídeo é um grão que ANDA na diagonal quadro a quadro — o olho lê isso como
   sujeira deslizando sobre a lente, que é pior que não ter grão nenhum. Dentro
   do argumento, cada semente é um campo descorrelacionado. */
float hash(vec2 p, float seed) {
  return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed * 43.317) * 43758.5453);
}

void main() {
  vec4 src = texture2D(uTex, vUv);
  vec3 c = src.rgb;

  /* 1. A CURVA S. smoothstep() puro preserva 0 e 1 por construção, então
     misturar em direção a ele aumenta o contraste SEM nunca ceifar — que é o
     defeito de um contraste linear em torno de 0,5. */
  vec3 s = c * c * (3.0 - 2.0 * c);
  c = mix(c, s, uSCurve);

  /* 2. O PONTO DE PRETO, renormalizado: come o pé e devolve a faixa inteira. */
  c = clamp((c - uBlack) / max(1e-4, 1.0 - uBlack), 0.0, 1.0);

  /* 3. GANHO. */
  c *= uGain;

  /* 4. BALANÇO POR FAIXA TONAL. Os três pesos somam ~1 em qualquer luminância,
     então um filtro que soma a mesma cor nos três se comporta como um desvio
     global — é o que os torna combináveis sem surpresa. */
  float l = dot(c, LUMA);
  float wS = 1.0 - smoothstep(0.0, 0.5, l);
  float wH = smoothstep(0.5, 1.0, l);
  float wM = max(0.0, 1.0 - wS - wH);
  c += uShadow * wS + uMid * wM + uHigh * wH;

  /* 5. SATURAÇÃO, depois do balanço: saturar antes multiplicaria também o
     desvio de cor que o balanço acabou de somar. */
  float l2 = dot(c, LUMA);
  c = mix(vec3(l2), c, uSat);

  /* ---- daqui para baixo é o que depende de ONDE o pixel está no quadro ---- */
  vec2 fuv = vUv * uFrame.xy + uFrame.zw;

  /* 6. VINHETA. O raio é medido no quadro com o aspecto corrigido — sem isso
     ela sairia oval num 16:9. */
  vec2 d = (fuv - 0.5) * vec2(uAspect, 1.0);
  float r = length(d) / max(1e-4, length(vec2(uAspect, 1.0) * 0.5));
  c *= 1.0 - uVignette * smoothstep(0.30, 1.05, r);

  /* 7. GRÃO, com a célula amarrada ao PIXEL DE SAÍDA e não à fração do quadro.
     ⚠️ A ALTERNATIVA FOI MEDIDA E RECUSADA. Uma frequência fixa em fração de
     quadro (1400 células de ponta a ponta) dá 1,8 px por célula a 1440p — certo
     para o vídeo — e 5,5 px na foto de 7680, ou seja QUADRADOS visíveis, que
     numa peça que vai para impressão é um defeito e não uma textura. Amarrada ao
     pixel, a célula tem ~2 px em qualquer tamanho: o preço é o grão sumir quando
     uma foto de 33 MP é reduzida para caber na tela, e sumir é invisível
     enquanto um bloco de 5 px não é.
     As células são QUADRADAS (uFramePx / uAspect é a altura em pixels), senão
     o grão sairia esticado no eixo curto de um 16:9.
     Pesado pela distância aos extremos: filme não granula no preto nem no
     estouro. */
  vec2 cells = vec2(uFramePx, uFramePx / max(1e-4, uAspect)) * 0.5;
  float n = hash(floor(fuv * cells), uSeed) - 0.5;
  float body = 1.0 - abs(dot(c, LUMA) * 2.0 - 1.0);
  c += n * uGrain * body;

  gl_FragColor = vec4(clamp(c, 0.0, 1.0), src.a);
}`;

let quadScene: THREE.Scene | null = null;
let quadCam: THREE.OrthographicCamera | null = null;
let mat: THREE.ShaderMaterial | null = null;
/** A cópia do quadro da TELA. Realocada quando o buffer muda de tamanho. */
let frameTex: THREE.FramebufferTexture | null = null;
/** O alvo para onde o passe escreve nos caminhos OFFSCREEN (foto, miniatura). */
let tileRT: THREE.WebGLRenderTarget | null = null;

const _size = new THREE.Vector2();

function ensureRig() {
  if (mat) return;
  mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTex: { value: null },
      uFrame: { value: new THREE.Vector4(1, 1, 0, 0) },
      uAspect: { value: 16 / 9 },
      uSCurve: { value: 0 },
      uBlack: { value: 0 },
      uGain: { value: new THREE.Vector3(1, 1, 1) },
      uSat: { value: 1 },
      uShadow: { value: new THREE.Vector3() },
      uMid: { value: new THREE.Vector3() },
      uHigh: { value: new THREE.Vector3() },
      uVignette: { value: 0 },
      uGrain: { value: 0 },
      uSeed: { value: 0 },
      uFramePx: { value: 1920 },
    },
    depthTest: false,
    depthWrite: false,
    /* ⚠️ `NoBlending` é o que faz este passe SUBSTITUIR o quadro em vez de somar
       a ele — e é também o que preserva o alfa da captura recortada, que sai
       daqui exatamente como entrou. */
    blending: THREE.NoBlending,
    toneMapped: false,
  });
  /* O quadrilátero é escrito direto em clip space pelo vértice (ver VERT), então
     a geometria só precisa cobrir -1..1 e a câmera é formalidade. */
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  quadScene = new THREE.Scene();
  quadScene.add(quad);
  quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  writeUniforms();
}

function writeUniforms() {
  if (!mat) return;
  const u = mat.uniforms;
  const l = current;
  u.uSCurve.value = l.scurve;
  u.uBlack.value = l.black;
  (u.uGain.value as THREE.Vector3).fromArray(l.gain);
  u.uSat.value = l.sat;
  (u.uShadow.value as THREE.Vector3).fromArray(l.shadow);
  (u.uMid.value as THREE.Vector3).fromArray(l.mid);
  (u.uHigh.value as THREE.Vector3).fromArray(l.high);
  u.uVignette.value = l.vignette;
  u.uGrain.value = l.grain;
}

function draw(
  tex: THREE.Texture, aspect: number,
  frame: [number, number, number, number], seed: number, frameFx: boolean,
  framePx: number,
) {
  if (!mat || !quadScene || !quadCam) return;
  mat.uniforms.uTex.value = tex;
  mat.uniforms.uAspect.value = aspect;
  (mat.uniforms.uFrame.value as THREE.Vector4).set(...frame);
  mat.uniforms.uSeed.value = seed;
  mat.uniforms.uFramePx.value = Math.max(1, framePx);
  /* ⚠️ VINHETA E GRÃO SÃO PROPRIEDADES DO QUADRO, NÃO DO OBJETO — e é por isso
     que eles têm um interruptor. Num recorte transparente não existe quadro: a
     imagem vai ser composta em OUTRO fundo, e uma vinheta assada ali escurece os
     cantos do CAMINHÃO por um enquadramento que não vai mais existir. A cor
     continua valendo (é a mesma tinta em qualquer fundo); a moldura, não. */
  mat.uniforms.uVignette.value = frameFx ? current.vignette : 0;
  mat.uniforms.uGrain.value = frameFx ? current.grain : 0;
  renderer.render(quadScene, quadCam);
}

/* ---------------- 1. o caminho da TELA (viewport e vídeo) ---------------- */

/* O grão anda com o quadro no caminho vivo e no offline; parado, ele seria uma
   textura estática colada na lente em vez de grão. Um contador simples basta —
   o que importa é que dois quadros seguidos não sorteiem o mesmo campo. */
let frameSeed = 0;

onGrade(() => {
  if (!isLookActive()) return;
  ensureRig();
  if (!mat) return;

  renderer.getDrawingBufferSize(_size);
  const w = Math.max(1, Math.floor(_size.x));
  const h = Math.max(1, Math.floor(_size.y));

  /* ⚠️ REALOCAR QUANDO O BUFFER MUDA DE TAMANHO NÃO É ZELO. `record.ts` FORÇA a
     resolução da gravação (`setSize(w, h, false)`) depois de já ter desenhado
     quadros no tamanho do viewport — uma textura do tamanho velho faria
     `copyTexSubImage2D` copiar um recorte do canto e o vídeo inteiro sairia com
     o quadro deslocado. */
  if (!frameTex || frameTex.image.width !== w || frameTex.image.height !== h) {
    frameTex?.dispose();
    frameTex = new THREE.FramebufferTexture(w, h);
    frameTex.minFilter = THREE.NearestFilter;
    frameTex.magFilter = THREE.NearestFilter;
    frameTex.generateMipmaps = false;
  }

  renderer.copyFramebufferToTexture(frameTex);

  frameSeed = (frameSeed + 1) % 1024;
  /* ⚠️ `autoClear = false` PELO MESMO MOTIVO DE `drawOutro()`: um segundo
     `render()` com a bandeira ligada limparia o buffer — e como o passe AMOSTRA
     a cópia e não o buffer, o que sairia seria o filtro aplicado sobre... nada
     visível de errado no quadro, mas o alfa e a profundidade iriam junto. Nunca
     se limpa o que se está compondo. */
  const prevAutoClear = renderer.autoClear;
  renderer.autoClear = false;
  draw(frameTex, w / h, [1, 1, 0, 0], frameSeed, true, w);
  renderer.autoClear = prevAutoClear;
});

/* ---------------- 2. o caminho OFFSCREEN (foto e miniatura) ---------------- */

/**
 * Gradua um alvo já renderizado e devolve DE ONDE LER.
 *
 * Sem filtro ativo devolve o próprio `src` — quem chama não precisa de um `if`,
 * e o caminho sem filtro não paga alocação nenhuma.
 *
 * ⚠️ CHAMAR DEPOIS DE `renderer.setRenderTarget(null)`, e a ordem é a mesma
 * armadilha que `capture.ts` documenta duas vezes: é o desligamento do alvo que
 * RESOLVE o multiamostrado para a textura de uma amostra. Amostrar `src.texture`
 * com o alvo ainda ligado leria um buffer não resolvido.
 *
 * @param frame recorte deste ladrilho no quadro inteiro, em uv (escala e offset).
 *              `[1,1,0,0]` quando o render foi de uma vez só.
 */
export function gradeTile(
  src: THREE.WebGLRenderTarget, w: number, h: number,
  frame: [number, number, number, number] = [1, 1, 0, 0],
  aspect = w / h,
  frameFx = true,
): THREE.WebGLRenderTarget {
  if (!isLookActive()) return src;
  ensureRig();
  if (!mat) return src;

  if (!tileRT || tileRT.width !== w || tileRT.height !== h) {
    tileRT?.dispose();
    /* SEM multiamostragem e SEM profundidade: a origem já resolveu o MSAA, e um
       quadrilátero de tela cheia não tem o que testar em profundidade. É a
       diferença entre ~40 bytes por pixel (o alvo do mosaico) e 4. */
    tileRT = new THREE.WebGLRenderTarget(w, h, {
      depthBuffer: false,
      stencilBuffer: false,
      samples: 0,
    });
    /* O MESMO par que `makeTarget()` usa, e pelo mesmo motivo: com
       `internalFormat` cravado em RGBA8 não há decodificação em hardware na
       amostragem nem codificação na escrita — o byte atravessa. */
    tileRT.texture.colorSpace = THREE.SRGBColorSpace;
    tileRT.texture.internalFormat = 'RGBA8';
    tileRT.texture.minFilter = THREE.NearestFilter;
    tileRT.texture.magFilter = THREE.NearestFilter;
    tileRT.texture.generateMipmaps = false;
  }

  const prevTarget = renderer.getRenderTarget();
  const prevAutoClear = renderer.autoClear;
  renderer.setRenderTarget(tileRT);
  renderer.autoClear = true;
  /* Semente FIXA no caminho offscreen: uma foto tirada duas vezes da mesma pose
     tem de sair byte a byte igual, e um mosaico tem de granular como UM quadro e
     não como dezesseis sorteios. */
  /* A largura do QUADRO INTEIRO, deduzida do recorte: num ladrilho `w` é o
     ladrilho, e é o mosaico completo que decide o tamanho do grão. */
  draw(src.texture, aspect, frame, 0, frameFx, w / Math.max(1e-4, frame[0]));
  renderer.autoClear = prevAutoClear;
  renderer.setRenderTarget(prevTarget);
  return tileRT;
}

/** Solta o que o passe segura. Chamado quando o estúdio é desmontado. */
export function disposeLook() {
  frameTex?.dispose();
  frameTex = null;
  tileRT?.dispose();
  tileRT = null;
}
