/* O FILTRO DO VÍDEO — a graduação de cor da gravação.
   ===========================================================================
   O PEDIDO, nas palavras do dono:

       *"disponibilize alguns tipos de filtros, diferentes, quentes e frios para
        aplicar"*

   e, na rodada seguinte, o RECORTE que decidiu este arquivo:

       *"a ideia do filtro era aplicar apenas ao vídeo, não no geral"*

   ---------------------------------------------------------------------------
   ⚠️ ELE NÃO É UM ESTADO DA CENA. É UM PARÂMETRO DA GRAVAÇÃO.

   A primeira versão aplicava o filtro em toda parte — viewport, foto de até
   7680 px e miniaturas do percurso —, com o argumento de que "o que se vê é o
   que sai". O argumento está errado para ESTE produto, e a correção vale ser
   registrada porque ela é fácil de desfazer sem querer:

     A FOTO É PROVA DE COR. Ela vai para orçamento e para aprovação de arte, e
     nela a pergunta é *"é esta a tinta?"*. Um filtro âmbar assado numa foto de
     aprovação responde a pergunta errada — e pior, responde-a com confiança.

     O VÍDEO É PEÇA DE APRESENTAÇÃO. Nele a pergunta é *"isto está bonito?"*, e
     tratamento é resposta legítima.

   São duas naturezas diferentes saindo do mesmo render, e o filtro só pertence a
   uma delas. Daí: `capture.ts` NÃO conhece este módulo, e o viewport ao vivo
   também não — o estúdio mostra a cor verdadeira o tempo todo.

   ---------------------------------------------------------------------------
   QUANDO ELE RODA, E A REGRA É UMA SÓ: **o quadro está indo para o vídeo?**

     `renderOfflineFrame()`    SEMPRE. Esta função existe só para a gravação —
                               `scene/record.ts` é o único chamador dela.
     laço vivo, gravando       SIM, e é obrigatório: a reserva em tempo real
                               (`recordRealtime`) grava pelo `captureStream()` do
                               canvas COMPOSTO. Sem isto, a máquina sem WebCodecs
                               entregaria o vídeo sem filtro — e o usuário não
                               tem como saber que caminho a máquina dele pegou.
     laço vivo, na PRÉVIA      SIM. A prévia do percurso é o vídeo antes de ele
                               existir, e `scene/timeline.ts` abre dizendo que
                               uma prévia que mente sobre o que vai ser gravado é
                               *"o único erro que esta ferramenta não pode
                               cometer"*. É também a única forma de comparar oito
                               filtros sem pagar um render de quatro minutos.
     laço vivo, no resto       NÃO. A cena é a cena.

   ---------------------------------------------------------------------------
   COMO ELE É APLICADO: um passe de tela cheia sobre o quadro pronto.

   A saída óbvia seria remendar `ShaderChunk.tonemapping_pars_fragment` e sair com
   `CustomToneMapping`. Duas coisas a mataram, e as duas continuam valendo:

   1. **TROCAR DE FILTRO EXIGIRIA RECOMPILAR A CENA.** O conteúdo de um
      `ShaderChunk` não entra na chave de cache de programa do three — mudar o
      texto do remendo não invalida nada, e forçar `needsUpdate` em todo material
      transformaria um seletor de oito opções numa fila de oito recompilações.
   2. **A GRADUAÇÃO É DISPLAY-REFERRED, e o mapeamento de tons não é.** Os
      números vieram de uma cadeia ffmpeg montada SOBRE o arquivo pronto — curva,
      balanço por faixa tonal e saturação em cima do sRGB já codificado. A mesma
      matemática antes do ACES dá outro resultado, e "outro resultado" aqui quer
      dizer "não é o que foi aprovado".

   ⚠️ E A AMOSTRAGEM É SEM DECODIFICAÇÃO. `FramebufferTexture` nasce em
   `NoColorSpace`, então o `getInternalFormat()` do three devolve RGBA8 e não
   SRGB8_ALPHA8 — não há decodificação em hardware. Um `ShaderMaterial` cru
   também não recebe o `colorspace_fragment` na saída. O byte atravessa nos dois
   sentidos, e é isso que faz o passe operar no MESMO espaço em que a cadeia do
   ffmpeg operava.

   ---------------------------------------------------------------------------
   ⚠️ O FILTRO PARA ANTES DA VINHETA DE ENCERRAMENTO, E ISSO É DELIBERADO

   `onGrade` é uma lista SEPARADA de `onOverlay`, chamada antes dela. A marca da
   Ankaa é a única coisa na tela cuja cor não é escolha estética — o verde é o
   verde —, e um filtro âmbar sobre ela entrega um logo bege. `scene/outro.ts` já
   desliga o ACES pelo mesmo motivo (`toneMapped: false`); aqui a resposta é a
   ORDEM. No caminho offline o desenho é `renderOfflineFrame()` → `drawOutro()`, e
   como a graduação mora dentro do primeiro, a vinheta cai por cima dela intocada,
   sem que `record.ts` precise saber que filtros existem.

   ---------------------------------------------------------------------------
   O QUE NÃO TEM AQUI: **HALAÇÃO / BLOOM**, que é o efeito que mais mata a cara de
   CG e foi o único da prévia em ffmpeg que ficou de fora. Ele lê pixels VIZINHOS,
   e um passe que lê vizinhos precisa de um segundo alvo e de um borrão separável
   — dois passes a mais por quadro num laço que já é o gargalo de um render de
   minutos. Tudo que ficou depende só do pixel e da coordenada dele no quadro. */
import * as THREE from 'three';
import { renderer, onGrade, invalidate } from './scene';
import { isRecording } from './record';
import { isTimelinePreviewing } from './timeline';

/* ---------------- o catálogo ---------------- */

export type LookTemp = 'neutro' | 'quente' | 'frio';

export interface Look {
  id: string;
  name: string;
  /** Para a legenda do seletor e para agrupar as opções. */
  temp: LookTemp;
  /** Uma linha do que ele faz — vira a nota do painel de gravação. */
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
   `high` a todo filtro que não a sobrescreve — os que hoje não tingem as sombras
   compartilhariam um array só. Ninguém o muta hoje (o shader lê por
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
 * Os filtros, na ordem em que aparecem no painel de gravação.
 *
 * ⚠️ OS NÚMEROS NÃO SÃO CHUTE. `cinema` é a transcrição do tratamento que o dono
 * aprovou olhando o vídeo tratado no ffmpeg, e a curva bate ponto a ponto: a
 * `curves` daquela cadeia passava por (0,12 → 0,075) e (0,85 → 0,90), e
 * `mix(c, smoothstep(c), 0.55)` devolve 0,0764 e 0,899 nos mesmos dois pontos.
 * Os outros são desvios dele numa direção só de cada vez — é o que os torna
 * comparáveis entre si em vez de oito ajustes independentes.
 */
export const LOOKS: readonly Look[] = [
  {
    ...neutral(),
    id: 'nenhum', name: 'Nenhum', temp: 'neutro',
    hint: 'O vídeo sai como o renderizador entrega, sem tratamento.',
  },
  {
    ...neutral(),
    id: 'padrao', name: 'Padrão', temp: 'neutro',
    hint: 'Contraste e vinheta discretos, sem desviar a cor da tinta.',
    scurve: 0.35, black: 0.010, sat: 1.04, vignette: 0.16, grain: 0.008,
  },
  {
    ...neutral(),
    id: 'cinema', name: 'Cinema', temp: 'quente',
    hint: 'Sombra fria e alta luz quente — o tratamento aprovado no vídeo.',
    scurve: 0.55, black: 0.018, gain: [1.020, 1.000, 0.975], sat: 1.12,
    shadow: [-0.020, 0.000, 0.034],
    mid: [0.006, 0.000, -0.006],
    high: [0.030, 0.008, -0.026],
    vignette: 0.22, grain: 0.014,
  },
  {
    ...neutral(),
    id: 'dourado', name: 'Dourado', temp: 'quente',
    hint: 'Luz de fim de tarde: alta luz puxada para o âmbar.',
    scurve: 0.50, black: 0.014, gain: [1.045, 1.005, 0.945], sat: 1.10,
    shadow: [-0.012, -0.004, 0.018],
    mid: [0.012, 0.004, -0.012],
    high: [0.055, 0.026, -0.042],
    vignette: 0.24, grain: 0.012,
  },
  {
    ...neutral(),
    id: 'ambar', name: 'Âmbar', temp: 'quente',
    hint: 'Quente e dessaturado, com o preto aberto — leitura de filme antigo.',
    scurve: 0.42, black: 0.026, gain: [1.050, 0.990, 0.900], sat: 0.82,
    shadow: [0.014, 0.002, -0.010],
    mid: [0.018, 0.006, -0.014],
    high: [0.048, 0.028, -0.038],
    vignette: 0.28, grain: 0.020,
  },
  {
    ...neutral(),
    id: 'frio', name: 'Frio', temp: 'frio',
    hint: 'Sombra azulada e preto fechado — leitura industrial.',
    scurve: 0.60, black: 0.030, gain: [0.955, 0.995, 1.055], sat: 0.94,
    shadow: [-0.028, -0.008, 0.042],
    mid: [-0.010, 0.000, 0.014],
    high: [0.000, 0.010, 0.022],
    vignette: 0.26, grain: 0.014,
  },
  {
    ...neutral(),
    id: 'aco', name: 'Aço', temp: 'frio',
    hint: 'Muito contraste, pouca cor — o metal na frente da tinta.',
    scurve: 0.70, black: 0.036, gain: [0.945, 0.990, 1.060], sat: 0.78,
    shadow: [-0.024, -0.004, 0.046],
    mid: [-0.012, 0.000, 0.016],
    high: [-0.010, 0.006, 0.028],
    vignette: 0.30, grain: 0.016,
  },
  {
    ...neutral(),
    id: 'noturno', name: 'Noturno', temp: 'frio',
    hint: 'Azul profundo e exposição para baixo — o pátio à noite.',
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

/* A chave segue o padrão de `ui/chrome.ts`, que é quem guarda os OUTROS dois
   parâmetros de gravação — modo e tamanho. O filtro é o terceiro deles. */
const LOOK_KEY = 'truckstudio.record.look.v1';

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
  /* Redesenha porque a PRÉVIA pode estar no ar. Fora dela o quadro vivo não muda
     — o filtro não entra nele —, e um `invalidate()` a mais custa um quadro. */
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
   pow(c, 2.2) no arquivo. Ver o cabeçalho: o passe amostra bytes de display e
   escreve bytes de display; converter para linear no meio daria uma curva
   diferente da que foi aprovada no ffmpeg, que também trabalha em display. */
const FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;

uniform sampler2D uTex;
uniform float uAspect;
/** Largura do quadro em pixels — só o grão a usa. Ver o passo 7. */
uniform float uFramePx;

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

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

/* ⚠️ A SEMENTE ENTRA DENTRO DO sin(), E NÃO SOMADA A p. Somada à coordenada ela
   não sorteia um campo novo: ela TRANSLADA o mesmo campo, e o resultado num
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

  /* 3. GANHO POR CANAL — o balanço de branco. */
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

  /* 6. VINHETA. O raio é medido com o aspecto corrigido — sem isso ela sairia
     oval num 16:9. */
  vec2 d = (vUv - 0.5) * vec2(uAspect, 1.0);
  float r = length(d) / max(1e-4, length(vec2(uAspect, 1.0) * 0.5));
  c *= 1.0 - uVignette * smoothstep(0.30, 1.05, r);

  /* 7. GRÃO, com a célula amarrada ao PIXEL DE SAÍDA (~2 px) e não a uma fração
     do quadro — uma frequência fixa em fração daria 1,8 px por célula a 1440p e
     blocos visíveis num quadro maior. As células são QUADRADAS
     (uFramePx / uAspect é a altura em pixels), senão o grão sairia esticado no
     eixo curto de um 16:9. Pesado pela distância aos extremos: filme não granula
     no preto nem no estouro. */
  vec2 cells = vec2(uFramePx, uFramePx / max(1e-4, uAspect)) * 0.5;
  float n = hash(floor(vUv * cells), uSeed) - 0.5;
  float body = 1.0 - abs(dot(c, LUMA) * 2.0 - 1.0);
  c += n * uGrain * body;

  gl_FragColor = vec4(clamp(c, 0.0, 1.0), src.a);
}`;

let quadScene: THREE.Scene | null = null;
let quadCam: THREE.OrthographicCamera | null = null;
let mat: THREE.ShaderMaterial | null = null;
/** A cópia do quadro composto. Realocada quando o buffer muda de tamanho. */
let frameTex: THREE.FramebufferTexture | null = null;

const _size = new THREE.Vector2();

function ensureRig() {
  if (mat) return;
  mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTex: { value: null },
      uAspect: { value: 16 / 9 },
      uFramePx: { value: 1920 },
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
    },
    depthTest: false,
    depthWrite: false,
    /* ⚠️ `NoBlending` é o que faz este passe SUBSTITUIR o quadro em vez de somar
       a ele. */
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

/* O grão anda com o quadro; parado, ele seria uma textura estática colada na
   lente em vez de grão. Um contador basta — o que importa é que dois quadros
   seguidos não sorteiem o mesmo campo. */
let frameSeed = 0;

/**
 * O passe, pendurado no gancho de graduação.
 *
 * `offline` é verdadeiro só dentro de `renderOfflineFrame()`, que existe
 * unicamente para a gravação. No laço vivo o filtro é a EXCEÇÃO e não a regra —
 * ver a tabela "QUANDO ELE RODA" no cabeçalho.
 */
onGrade((_dt, offline) => {
  if (!isLookActive()) return;
  if (!offline && !isRecording() && !isTimelinePreviewing()) return;

  ensureRig();
  if (!mat || !quadScene || !quadCam) return;

  renderer.getDrawingBufferSize(_size);
  const w = Math.max(1, Math.floor(_size.x));
  const h = Math.max(1, Math.floor(_size.y));

  /* ⚠️ REALOCAR QUANDO O BUFFER MUDA DE TAMANHO NÃO É ZELO. `record.ts` FORÇA a
     resolução da gravação (`setSize(w, h, false)`) depois de o laço já ter
     desenhado quadros no tamanho do viewport — uma textura do tamanho velho
     faria `copyTexSubImage2D` copiar um recorte do canto, e o vídeo inteiro
     sairia com o quadro deslocado. */
  if (!frameTex || frameTex.image.width !== w || frameTex.image.height !== h) {
    frameTex?.dispose();
    frameTex = new THREE.FramebufferTexture(w, h);
    frameTex.minFilter = THREE.NearestFilter;
    frameTex.magFilter = THREE.NearestFilter;
    frameTex.generateMipmaps = false;
  }

  renderer.copyFramebufferToTexture(frameTex);

  frameSeed = (frameSeed + 1) % 1024;
  mat.uniforms.uTex.value = frameTex;
  mat.uniforms.uAspect.value = w / h;
  mat.uniforms.uFramePx.value = w;
  mat.uniforms.uSeed.value = frameSeed;

  /* ⚠️ `autoClear = false` PELO MESMO MOTIVO DE `drawOutro()`: um segundo
     `render()` com a bandeira ligada limparia o buffer. Nunca se limpa o que se
     está compondo. */
  const prevAutoClear = renderer.autoClear;
  renderer.autoClear = false;
  renderer.render(quadScene, quadCam);
  renderer.autoClear = prevAutoClear;
});

/** Solta o que o passe segura. Chamado quando o estúdio é desmontado. */
export function disposeLook() {
  frameTex?.dispose();
  frameTex = null;
}
