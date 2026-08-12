/* DOIS CÉUS, UM MAPA — a dissolvência do plate de dia para o de noite.
   ===========================================================================
   O PROBLEMA. Até aqui a noite era o plate de DIA escurecido: `nightness` levava
   `scene.backgroundIntensity` a 6 % e `scene.environmentIntensity` a 40 %, e o
   resultado é o que o dono do produto descreveu — *"somente escurecer nao fica
   bom"*. E está certo, porque escurecer não muda nada do que faz uma foto ser de
   dia: continua havendo cúmulo iluminado por baixo, continua havendo o degradê
   quente do poente, continua não havendo estrela nem lua. Uma foto subexposta é
   uma foto subexposta; ela nunca vira noite.

   O CONSERTO é ter o céu de noite de verdade e ATRAVESSAR de um para o outro. O
   par é medido, não escolhido por gosto (ver `hdriNight` no manifesto e o
   CREDITS.md): `kloppenheim_06_puresky` de dia e `kloppenheim_02_puresky` de
   noite, a mesma série, o mesmo tripé, o mesmo tratamento `_puresky` que
   substitui a metade de baixo por um degradê limpo — que é a razão pela qual
   este cenário trocou de HDRI em 2026-08-10 e continua valendo aqui. A lua do
   plate de noite está em u = 0,599 e o sol do de dia em u = 0,613: cinco graus
   de diferença, então o `envRotation` de 4,7124 rad continua servindo aos dois e
   a fonte do envmap continua concordando com a chave do rig.

   ===========================================================================
   POR QUE UM ALVO INTERMEDIÁRIO, e não dois envmaps. `scene.environment` e
   `scene.background` aceitam UMA textura cada. Não existe "dois envmaps com
   peso" no three sem reescrever o shader de todo material da cena, então a
   mistura tem de acontecer ANTES: um passe de tela cheia interpola os dois
   equirects num terceiro, e é esse terceiro que a cena usa.

   O ALVO SERVE AOS DOIS CONSUMIDORES, e isso é o que torna o esquema barato:

     · O FUNDO é o próprio alvo, ligado como equirect. Ele é reescrito a cada
       mudança de mistura — um passe de 2048x1024, abaixo de um milissegundo — e
       portanto o céu que se vê atravessa PERFEITAMENTE liso, quadro a quadro.
     · O REFLEXO é o PMREM do alvo. Esse é o passo caro (seis faces mais a cadeia
       de desfoque, 10 a 40 ms), então ele é LIMITADO POR TAXA: no máximo um a
       cada 110 ms, e só quando a mistura andou um passo de 1/12. Numa varredura
       do dia à noite são doze reassaduras em vez de uma por evento de ponteiro.

   O DESCASAMENTO É INVISÍVEL, e é por isso que a divisão funciona: o fundo é
   estrutura (nuvem, lua, horizonte) e o olho o segue; o reflexo é um termo de
   ambiente difuso mais um realce desfocado, e 110 ms de atraso num ambiente não
   tem como ser percebido. Inverter a divisão — fundo defasado, reflexo liso —
   seria imediatamente visível.

   REUSAR O ALVO DO PMREM É O QUE MANTÉM A COSTURA SIMPLES.
   `PMREMGenerator.fromEquirectangular(tex, rt)` aceita o alvo de volta e escreve
   NELE. Como a identidade da textura não muda entre reassaduras,
   `scene.environment` é atribuído UMA vez, na montagem, e nunca mais — nenhum
   retorno de chamada, nenhum reapontar, e o invariante de scene.ts de que
   `setExternalEnvironment()` é o único escritor daquelas duas propriedades fica
   de pé.

   ===========================================================================
   A CURVA NÃO É LINEAR, E O MOTIVO É A LUA. O pico do plate de noite é 55 633
   (a lua, três texels de diâmetro) contra 33 do sol do plate de dia — os
   `_puresky` domam o disco solar, e ninguém domou a lua. Numa interpolação
   linear, com `nightness` em 0,3 — que é 18h20, céu ainda de poente — já haveria
   meia lua de 28 mil unidades no meio do crepúsculo, um ponto branco cravado num
   céu laranja. Então o peso da noite entra por `smoothstep(0,25 … 0,95)`: até um
   quarto de escuridão o céu é o de dia inteiro, e a lua só começa a aparecer
   quando o poente já cedeu. É também o que o pedido chama de sutil.

   O QUE ESTE MÓDULO NÃO FAZ: mexer em intensidade, exposição ou cor. Quem
   escurece a noite continua sendo `applyRig()`, e os fatores dele foram
   reajustados na mesma rodada — com o plate certo no lugar, esmagar o fundo a
   6 % passou a ser escuro demais. Ver NIGHT_BG/NIGHT_ENV em scene.ts. */
import * as THREE from 'three';
import { renderer, pmrem, invalidate } from './scene';

/** Passos de mistura em que o PMREM é reassado. Doze numa varredura inteira. */
const PASSOS = 12;
/** Piso entre duas reassaduras, em ms. ~9 por segundo no pior arrasto. */
const MIN_MS = 110;

/* A janela em que a noite entra, em unidades de `nightness`. Ver o cabeçalho:
   o 0,25 é o que mantém a lua fora do céu de poente. */
const NOITE_DE = 0.25, NOITE_ATE = 0.95;

const VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4( position.xy, 0.0, 1.0 );
}
`;

/* SEM tonemapping e SEM conversão de espaço de cor, de propósito: os dois lados
   são radiância linear e o alvo é meio-float linear, então o passe tem de ser
   passagem pura. Um ShaderMaterial cru não recebe nenhum dos dois includes do
   three, que é justamente por que ele foi escolhido aqui.

   `max(0.0, ...)` porque meio-float negativo existe em plate de HDRI (ruído de
   sensor abaixo de zero em pixel escuro) e o PMREM propaga NaN a partir dele. */
const FRAG = /* glsl */`
uniform sampler2D tDia;
uniform sampler2D tNoite;
uniform float uMix;
varying vec2 vUv;
void main() {
  vec3 d = texture2D( tDia, vUv ).rgb;
  vec3 n = texture2D( tNoite, vUv ).rgb;
  gl_FragColor = vec4( max( vec3( 0.0 ), mix( d, n, uMix ) ), 1.0 );
}
`;

let dia: THREE.Texture | null = null;
let noite: THREE.Texture | null = null;
let alvo: THREE.WebGLRenderTarget | null = null;
let pmremRT: THREE.WebGLRenderTarget | null = null;

let quadCena: THREE.Scene | null = null;
let quadCam: THREE.Camera | null = null;
let quadMat: THREE.ShaderMaterial | null = null;

/** Mistura corrente (já com a curva aplicada) e a última que foi para o PMREM. */
let pesoAtual = 0;
let passoAssado = -1;
let ultimoBake = 0;
let pendente: ReturnType<typeof setTimeout> | 0 = 0;

/** Quantas vezes o PMREM foi reassado nesta sessão — para a bancada. */
let bakes = 0;

function montarQuad() {
  if (quadCena) return;
  quadMat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      tDia: { value: null },
      tNoite: { value: null },
      uMix: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
  });
  /* PlaneGeometry(2,2) põe uv (0,0) no canto de MENOR y do plano, e o vértice
     vai direto para clip space — então vUv.y cresce com o y da GL. É o que faz a
     linha que se LÊ em `v` ser a mesma que se ESCREVE em `v`, e portanto o que
     dispensa qualquer inversão: o plate de origem tem `flipY = true` (o
     RGBELoader o põe) e o alvo tem `flipY = false`, mas os dois são amostrados
     com a mesma convenção de `v`, e é a amostragem que importa. Errar isto
     entrega o céu de cabeça para baixo — o zênite no chão. */
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat);
  quad.frustumCulled = false;
  quadCena = new THREE.Scene();
  quadCena.add(quad);
  quadCam = new THREE.Camera();
}

/** O peso da noite a partir de `nightness`. Ver a nota da curva no cabeçalho. */
function pesoDe(nightness: number) {
  const n = THREE.MathUtils.clamp(nightness, 0, 1);
  return THREE.MathUtils.smoothstep(n, NOITE_DE, NOITE_ATE);
}

/** Reescreve o alvo com a mistura corrente. Um passe, sub-milissegundo. */
function pintar() {
  if (!alvo || !quadCena || !quadCam || !quadMat) return;
  quadMat.uniforms.tDia.value = dia;
  quadMat.uniforms.tNoite.value = noite;
  quadMat.uniforms.uMix.value = pesoAtual;
  const antes = renderer.getRenderTarget();
  const antesCubo = renderer.getActiveCubeFace();
  const antesMip = renderer.getActiveMipmapLevel();
  renderer.setRenderTarget(alvo);
  try {
    renderer.render(quadCena, quadCam);
  } finally {
    renderer.setRenderTarget(antes, antesCubo, antesMip);
  }
}

/** Reassa o PMREM a partir do alvo. Caro — só é chamado pelo limitador de taxa. */
function assar() {
  if (!alvo) return;
  try {
    /* O MESMO alvo de volta: `fromEquirectangular` escreve nele e o devolve, e
       manter a identidade é o que dispensa reapontar `scene.environment`. Na
       primeira chamada `pmremRT` é null e o three aloca — daí em diante é
       reescrita no lugar. */
    pmremRT = pmrem.fromEquirectangular(alvo.texture, pmremRT || undefined);
    bakes++;
  } catch (err) {
    console.warn('[truck-studio] falha ao reassar o PMREM do céu misturado', err);
  }
}

/**
 * Monta o par de céus e devolve o que ligar em `scene.environment` e
 * `scene.background`.
 *
 * As DUAS texturas cruas continuam vivas depois disto — é o que separa este
 * caminho do `toPmrem()` de environment.ts, que descarta o equirect assim que
 * assa. Aqui elas são o insumo de cada mistura, e soltá-las congelaria o céu na
 * primeira hora aplicada.
 *
 * @returns null quando falta um dos dois lados — e aí quem chama segue pelo
 *   caminho de sempre (um plate só, escurecido). Um HDRI de noite que não baixou
 *   nunca pode ser motivo de tela preta.
 */
export function setSkyPair(d: THREE.Texture | null, n: THREE.Texture | null,
  nightness: number) {
  if (!d || !n || !d.image || !n.image) { disposeSkyBlend(); return null; }
  disposeSkyBlend();
  dia = d;
  noite = n;
  d.mapping = THREE.EquirectangularReflectionMapping;
  n.mapping = THREE.EquirectangularReflectionMapping;

  const w = (d.image.width as number) || 2048;
  const h = (d.image.height as number) || 1024;
  alvo = new THREE.WebGLRenderTarget(w, h, {
    /* Meio-float e linear: é radiância, não cor de tela. `depthBuffer: false`
       porque um passe de tela cheia sem teste de profundidade não tem o que
       fazer com ele — e são 8 MB a menos. */
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    colorSpace: THREE.LinearSRGBColorSpace,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
    stencilBuffer: false,
  });
  alvo.texture.mapping = THREE.EquirectangularReflectionMapping;
  /* Sem isto a costura em u = 0 (o meridiano de trás) vira uma linha vertical
     dura: o degradê do céu atravessa a emenda e a filtragem bilinear precisa dos
     dois lados. */
  alvo.texture.wrapS = THREE.RepeatWrapping;
  alvo.texture.wrapT = THREE.ClampToEdgeWrapping;

  montarQuad();
  pesoAtual = pesoDe(nightness);
  passoAssado = Math.round(pesoAtual * PASSOS);
  ultimoBake = performance.now();
  pintar();
  assar();
  if (!pmremRT) { disposeSkyBlend(); return null; }
  return { env: pmremRT.texture, bg: alvo.texture };
}

/**
 * Anda a mistura. Chamado por `applyRig()` a cada quadro de tween e a cada
 * evento do controle de hora.
 *
 * O FUNDO SEMPRE, o PMREM por taxa — ver o cabeçalho. A reassadura atrasada é
 * agendada e não descartada: sem ela, soltar o controle no meio de um passo
 * deixaria o reflexo permanentemente numa mistura que não é a da tela.
 */
export function updateSkyBlend(nightness: number) {
  if (!alvo) return;
  const p = pesoDe(nightness);
  if (Math.abs(p - pesoAtual) < 1e-4) return;
  pesoAtual = p;
  pintar();
  invalidate();

  const passo = Math.round(pesoAtual * PASSOS);
  if (passo === passoAssado) return;
  const agora = performance.now();
  if (agora - ultimoBake >= MIN_MS) {
    if (pendente) { clearTimeout(pendente); pendente = 0; }
    passoAssado = passo;
    ultimoBake = agora;
    assar();
    invalidate();
    return;
  }
  if (pendente) return;
  pendente = setTimeout(() => {
    pendente = 0;
    if (!alvo) return;
    passoAssado = Math.round(pesoAtual * PASSOS);
    ultimoBake = performance.now();
    assar();
    invalidate();
  }, MIN_MS - (agora - ultimoBake));
}

/**
 * Solta o alvo e o PMREM. As texturas CRUAS não são descartadas: elas pertencem
 * ao cache de ambientes de environment.ts, que é quem decide quando uma cena sai
 * de vez — descartá-las aqui faria a volta ao cenário rebaixar tudo.
 */
export function disposeSkyBlend() {
  if (pendente) { clearTimeout(pendente); pendente = 0; }
  if (alvo) { alvo.dispose(); alvo = null; }
  if (pmremRT) { pmremRT.dispose(); pmremRT = null; }
  dia = null;
  noite = null;
  passoAssado = -1;
}

/** Há um par montado? É o liga/desliga que scene.ts consulta em applyRig(). */
export function hasSkyPair() { return !!alvo; }

/** Para o console e para a bancada. */
export function getSkyBlend() {
  return {
    ativo: !!alvo,
    peso: pesoAtual,
    passoAssado,
    bakes,
    tamanho: alvo ? [alvo.width, alvo.height] : null,
  };
}
