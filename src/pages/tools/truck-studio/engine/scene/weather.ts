/* Rain streaks + impact ripples for the Chuvoso preset.
   ---------------------------------------------------------------------------
   Both systems are single-draw-call InstancedBufferGeometry with ALL motion in
   the vertex shader, so a frame costs two uniform writes and zero buffer
   uploads.

   THREE.Points was rejected for the rain: gl_PointSize produces a square that
   is always axis-aligned to the screen, so a streak sprite can neither
   foreshorten nor follow the drop's world velocity when the camera tilts —
   look straight up a real downpour and the streaks should collapse to dots.

   The lattice trick: drop positions are a world-space grid that is FOLDED into
   a box centred on the camera (mod around the camera in XZ, mod against the box
   height in Y). That gives free recycling, keeps rain from visibly "sticking"
   to the camera, and anchors the field to the ground rather than to the eye.
*/
import * as THREE from 'three';
import { scene, camera, onFrame, onRig } from './scene';
import { getProfile, onQualityChange } from '../core/quality';
import type { Rig } from './presets';

const RAIN_COUNT = 2600;                 // ≈0.21 drops/m³ in a 26 m box
const RAIN_BOX = new THREE.Vector3(26, 26, 26);
/* 160 bastavam para uma faixa de 12 x 40 m onde TODA instância estava sempre
   viva. O campo agora é 44 x 44 m (4x a área) e cada instância só desenha
   enquanto o aro dela existe — o resto do intervalo ela fica ociosa, que é o
   ponto (ver `lifeT` no shader). Essa fração média é ~0,42, e a borda do
   quadrado ainda está em fade, então o que decide o número é a densidade VISTA
   perto da câmera: 1400 x 0,42 ≈ 590 aros no ar, ou ~0,3 por m² nos 31 x 31 m
   centrais — a mesma densidade que os 160 antigos davam na faixa estreita.
   Continua um único draw call de quads de dois triângulos. */
const RIPPLE_COUNT = 1400;

/* ---------------- shared quad ---------------- */
type QuadAttr = [name: string, data: Float32Array, itemSize: number];

function instancedQuad(count: number, extraAttrs: QuadAttr[]) {
  const geo = new THREE.InstancedBufferGeometry();
  geo.instanceCount = count;
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
  ]), 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  for (const [name, arr, size] of extraAttrs) {
    geo.setAttribute(name, new THREE.InstancedBufferAttribute(arr, size));
  }
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return geo;
}

/* ---------------- rain ---------------- */
const RAIN_VERT = /* glsl */`
uniform float uTime;
uniform vec3 uCamPos;
uniform vec3 uBox;
uniform vec2 uWind;
uniform float uLen;
uniform float uWidth;
uniform float uAmount;
attribute vec3 aSeed;
attribute float aRand;
attribute vec3 aVar;
varying vec2 vQuad;
varying float vFade;

void main() {
  // instances above the current density threshold are clipped away entirely,
  // so rainAmount scales the visible count without touching any buffer
  if ( aRand > uAmount ) {
    gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
    vQuad = vec2( 0.0 );
    vFade = 0.0;
    return;
  }

  /* CALIBRE DA GOTA — em aVar.x, e NÃO mais em aRand.
     aRand é o gate de densidade: derivar o tamanho dele amarrava as duas coisas
     (uma chuva fraca só tinha as gotas de um extremo) e, pior, fazia toda gota
     que existia num dado uAmount cair numa faixa estreita de velocidade — um
     campo inteiro descendo em bloco, que é metade da leitura de "chuva de
     protetor de tela". Com um segundo sorteio o calibre é independente de
     quantas gotas estão no ar. */
  float sz = aVar.x;
  // Gunn & Kinzer terminal velocities: 1 mm → 4.0 m/s, 2 mm → 6.5, 5 mm → 9.1
  float speed = mix( 4.0, 9.2, sz );

  /* RAJADA. O vento era uma constante, então o campo inteiro descia na mesma
     inclinação para sempre — nenhuma chuva real faz isso. Duas senóides de
     períodos incomensuráveis (0,23 e 0,57 Hz) nunca repetem o mesmo par, e a
     rajada é GLOBAL de propósito: é uma massa de ar que passa, então as gotas
     têm de inclinar JUNTAS. O que é por gota é só um resto de turbulência,
     defasado por aVar.y. */
  float gust = 1.0 + 0.50 * sin( uTime * 0.9 ) + 0.22 * sin( uTime * 2.3 + 1.7 );
  vec2 wind = uWind * gust;
  float turb = 0.12 * sin( uTime * 2.1 + aVar.y * 31.4 );

  vec3 base = aSeed * uBox;
  /* O DESLOCAMENTO É A INTEGRAL DA RAJADA, não uTime vezes wind. Multiplicar o
     fator instantâneo pelo tempo faria a amplitude do balanço CRESCER com o
     relógio — meio minuto de cena e o campo inteiro estaria varrendo dezenas de
     metros para os lados a cada ciclo. Integrada, a rajada vale ±0,56 m de
     balanço para sempre, e — o que importa de verdade — é a mesma história que
     wind conta lá embaixo na inclinação do risco: os traços tombam no mesmo
     instante em que as gotas andam de lado.
     ∫0.50·sin(0.9t) = −0.556·cos(0.9t);  ∫0.22·sin(2.3t+1.7) = −0.096·cos(…) */
  float drift = uTime - 0.556 * cos( uTime * 0.9 ) - 0.096 * cos( uTime * 2.3 + 1.7 );
  base.xz += uWind * drift + turb;
  base.y -= uTime * speed;

  // fold XZ around the camera, Y against the box height (ground-anchored)
  vec2 rel = mod( base.xz - uCamPos.xz + 0.5 * uBox.xz, uBox.xz ) - 0.5 * uBox.xz;
  float wy = mod( base.y, uBox.y );
  vec3 world = vec3( uCamPos.x + rel.x, wy, uCamPos.z + rel.y );

  vec3 posV = ( viewMatrix * vec4( world, 1.0 ) ).xyz;
  vec3 velV = ( viewMatrix * vec4( vec3( wind.x, -speed, wind.y ), 0.0 ) ).xyz;

  vec2 d = velV.xy;
  float lenXY = length( d );
  vec2 dir = lenXY > 1e-4 ? d / lenXY : vec2( 0.0, 1.0 );
  // foreshortening: a drop travelling toward the eye has almost no screen-space
  // velocity, so its streak shrinks to a point
  float fore = lenXY / max( length( velV ), 1e-4 );

  /* O RISCO É UM BORRÃO DE EXPOSIÇÃO, então ele acompanha a velocidade: uma
     gota grande cai o dobro mais rápido e deixa o dobro de rastro no mesmo
     obturador. Antes uLen/uWidth eram os mesmos para todas — 2600 traços
     idênticos, que o olho lê como textura rolando e não como chuva. */
  float len = uLen * ( 0.45 + 1.15 * sz );
  float wid = uWidth * ( 0.72 + 0.56 * sz );

  vec2 perp = vec2( -dir.y, dir.x );
  posV.xy += dir * ( position.y * len * fore ) + perp * ( position.x * wid );

  vQuad = position.xy;
  // fade the nearest drops out: a streak a few centimetres from the lens is a
  // full-screen smear
  float dist = length( world - uCamPos );
  vFade = smoothstep( 0.6, 2.5, dist ) * ( 0.35 + 0.65 * fore );

  /* CORTINAS. Chuva vem em levas: faixas mais e menos densas atravessando o
     campo. É uma onda longa (~22 m de período) lida na posição de MUNDO da
     gota, não no índice dela, senão a leva andaria grudada na câmera.
     Aplicada na OPACIDADE e não no descarte: cortar a gota faria cada uma
     piscar ao cruzar a borda da faixa — na opacidade ela entra e sai da leva. */
  float curtain = 0.62 + 0.38 * sin( world.x * 0.29 + world.z * 0.21 - uTime * 0.9 );
  vFade *= curtain * ( 0.72 + 0.56 * aVar.z );

  gl_Position = projectionMatrix * vec4( posV, 1.0 );
}
`;

const RAIN_FRAG = /* glsl */`
uniform vec3 uTint;
uniform float uOpacity;
varying vec2 vQuad;
varying float vFade;
void main() {
  float a = 1.0 - abs( vQuad.x ) * 2.0;                     // soft across the streak
  // edge0 < edge1 always: smoothstep is UNDEFINED when edge0 >= edge1, so the
  // taper is written as an inverted forward ramp rather than a reversed one
  a *= 1.0 - smoothstep( 0.18, 0.5, abs( vQuad.y ) );       // taper the ends
  a *= vFade * uOpacity;
  if ( a <= 0.002 ) discard;
  gl_FragColor = vec4( uTint, a );
}
`;

const rainU = {
  uTime: { value: 0 },
  uCamPos: { value: new THREE.Vector3() },
  uBox: { value: RAIN_BOX },
  uWind: { value: new THREE.Vector2(1.1, 0.35) },
  uLen: { value: 0.55 },
  uWidth: { value: 0.012 },
  uAmount: { value: 0 },
  uTint: { value: new THREE.Color(0xc8d6ea) },
  uOpacity: { value: 0 },
};


/* Os três sorteios INDEPENDENTES de aRand: calibre da gota (x), fase da
   turbulência (y) e variação de opacidade (z). Estarem separados do gate de
   densidade é o que impede "toda gota visível numa chuva fraca é do mesmo
   tamanho" — ver o comentário no vertex shader. */
function varSeeds(count: number) {
  const v = new Float32Array(count * 3);
  for (let i = 0; i < v.length; i++) v[i] = Math.random();
  return v;
}

function makeRain() {
  const seeds = new Float32Array(RAIN_COUNT * 3);
  const rand = new Float32Array(RAIN_COUNT);
  for (let i = 0; i < RAIN_COUNT; i++) {
    seeds[i * 3] = Math.random();
    seeds[i * 3 + 1] = Math.random();
    seeds[i * 3 + 2] = Math.random();
    rand[i] = Math.random();
  }
  const geo = instancedQuad(RAIN_COUNT, [
    ['aSeed', seeds, 3],
    ['aRand', rand, 1],
    ['aVar', varSeeds(RAIN_COUNT), 3],
  ]);
  const mat = new THREE.ShaderMaterial({
    uniforms: rainU,
    vertexShader: RAIN_VERT,
    fragmentShader: RAIN_FRAG,
    transparent: true,
    /* NormalBlending, not additive: rain must near-vanish against a bright sky
       and read against the dark road and the truck, which is what real rain
       does. Additive blows out the sky. */
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    fog: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 30;
  m.visible = false;
  return m;
}

/* ---------------- impact ripples ----------------
   Without these the wet road reads as "it rained an hour ago" — the drops
   visibly never arrive.

   O QUE HAVIA AQUI E POR QUE LIA COMO PADRÃO, e não como chuva. Três coisas,
   todas de construção:

   * UM RELÓGIO SÓ. `life = fract(uTime * 1.15 + aRand * 7.31)`: todo anel do
     campo tinha O MESMO período de 0,87 s, defasado. Um campo inteiro pulsando
     na mesma frequência é a definição de mecânico — o olho acha o compasso em
     dois segundos. Agora o período é por instância (aVar.x).
   * POSIÇÃO FIXA. A posição saía de `aSeed` e nunca mudava, então cada anel
     renascia EXATAMENTE no mesmo ponto a cada ciclo: 160 pontos parados
     piscando para sempre, que é o padrão que se enxerga. Agora a posição é
     sorteada A CADA CICLO por um hash de (instância, número do ciclo) — a gota
     seguinte cai noutro lugar, como uma gota faz.
   * UM TAMANHO SÓ. `radius = 0.05 + life * 0.34` para todos. Agora o raio
     máximo e a força também saem do hash do ciclo.

   A FAIXA DE 12 m TAMBÉM SAIU. Ela vinha de quando o cenário era `rodovia` —
   um disco de asfalto estreito, e o comentário original dizia "ondulação na
   grama seria absurdo". Esse cenário foi removido em 2026-08-03; os dois que
   restaram são um pátio de concreto de 178 m e um galpão. Prender os anéis a
   |x| < 6 hoje só desenha uma esteira no meio do pátio, com o resto da laje
   seca sob a mesma chuva. O campo agora é um quadrado dobrado em torno da
   câmera, com as bordas em fade — quem cruza a borda da dobra cruza invisível,
   que é o que impede o salto de posição de aparecer. */
const RIPPLE_VERT = /* glsl */`
uniform float uTime;
uniform vec3 uCamPos;
uniform float uSpan;
uniform float uAmount;
attribute float aRand;
attribute vec3 aVar;
varying vec2 vQuad;
varying float vLife;
varying float vRing;
varying float vFade;

/* hash 2D → 2D (Dave Hoskins). Barato e sem textura: é o que permite sortear
   uma posição NOVA a cada ciclo sem tocar em buffer nenhum. */
vec2 hash22( vec2 p ) {
  vec3 p3 = fract( vec3( p.xyx ) * vec3( 0.1031, 0.1030, 0.0973 ) );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.xx + p3.yz ) * p3.zy );
}

void main() {
  if ( aRand > uAmount ) {
    gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
    vQuad = vec2( 0.0 ); vLife = 0.0; vRing = 0.5; vFade = 0.0;
    return;
  }

  /* INTERVALO e DURAÇÃO SÃO COISAS DIFERENTES, e é aqui que a versão de cima
     ainda errava: com life = fract(uTime / period) o anel durava o período
     inteiro, então um ponto onde a gota cai a cada 1,9 s desenhava um aro se
     abrindo em 1,9 s — câmera lenta. Uma ondulação de impacto real se abre e
     morre em meio segundo, chova muito ou pouco; o que a intensidade muda é de
     quanto em quanto tempo a PRÓXIMA cai ali.
     Então period é só o intervalo, lifeT é a duração do aro, e entre uma
     coisa e outra a instância simplesmente não desenha. O ciclo ocioso é o que
     dá o espaçamento irregular que faz o campo parecer chuva e não pisca-pisca. */
  float period = mix( 0.55, 1.9, aVar.x );
  float t = uTime / period + aRand * 7.31;
  float cycle = floor( t );

  // sorteio novo a cada ciclo: onde cai, que tamanho tem, quanto dura, quanto marca
  vec2 h = hash22( vec2( aRand * 137.0 + cycle, aVar.y * 91.0 - cycle * 1.7 ) );
  vec2 g = hash22( vec2( cycle * 3.1 - aVar.z * 57.0, aRand * 11.0 + cycle ) );
  vec2 k = hash22( vec2( aVar.x * 63.0 - cycle, cycle * 7.7 + aRand * 29.0 ) );

  float lifeT = mix( 0.30, 0.62, g.y );      // duração do aro, em segundos
  float phase = fract( t ) * period;         // segundos desde a batida
  if ( phase > lifeT ) {                     // entre uma gota e a seguinte
    gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );
    vQuad = vec2( 0.0 ); vLife = 0.0; vRing = 0.5; vFade = 0.0;
    return;
  }
  float life = phase / lifeT;

  float radius = ( 0.04 + life * mix( 0.20, 0.46, g.x ) );

  vec2 p0 = ( h - 0.5 ) * uSpan;
  vec2 rel = mod( p0 - uCamPos.xz + 0.5 * uSpan, uSpan ) - 0.5 * uSpan;
  vec3 world = vec3( uCamPos.x + rel.x, 0.008, uCamPos.z + rel.y );

  // ground-plane billboard: the quad lies flat in XZ
  world.x += position.x * radius * 2.0;
  world.z += position.y * radius * 2.0;

  vQuad = position.xy;
  vLife = life;
  /* Espessura do anel, por ciclo: um respingo miúdo faz um aro fino e nítido,
     uma gota graúda faz uma marca larga e mole. Era uma constante no fragmento. */
  vRing = mix( 0.16, 0.42, k.x );
  /* FADE DE BORDA, e a força do respingo no mesmo varying.
     A dobra é o que mantém o campo em volta da câmera, e o preço dela é um salto
     de uSpan metros para quem cruza a borda no meio da vida. Apagando os
     últimos 15% do quadrado, esse salto acontece com alpha zero. */
  float edge = 1.0 - smoothstep( 0.35, 0.5, max( abs( rel.x ), abs( rel.y ) ) / uSpan );
  vFade = edge * ( 0.45 + 0.85 * k.y );
  gl_Position = projectionMatrix * viewMatrix * vec4( world, 1.0 );
}
`;

const RIPPLE_FRAG = /* glsl */`
uniform vec3 uTint;
uniform float uOpacity;
varying vec2 vQuad;
varying float vLife;
varying float vRing;
varying float vFade;
void main() {
  float d = abs( length( vQuad ) * 2.0 - 0.92 );
  float a = 1.0 - smoothstep( 0.0, vRing, d );      // forward edges, see above
  a *= ( 1.0 - vLife ) * ( 1.0 - vLife ) * uOpacity * vFade;
  if ( a <= 0.002 ) discard;
  gl_FragColor = vec4( uTint, a );
}
`;

const rippleU = {
  uTime: { value: 0 },
  uCamPos: { value: new THREE.Vector3() },
  /* Lado do quadrado dobrado em volta da câmera. Era `uSpanZ: 40` sobre uma
     faixa de 12 m em x; agora os dois eixos são o mesmo vão, e 44 m cobre a
     órbita inteira do estúdio (maxDistance passa de 50 m, mas o chão visível
     junto ao veículo é o que precisa de respingo). */
  uSpan: { value: 44 },
  uAmount: { value: 0 },
  uTint: { value: new THREE.Color(0xdbe6f5) },
  uOpacity: { value: 0 },
};


function makeRipples() {
  /* SEM `aSeed` aqui, ao contrário da chuva: a posição do anel deixou de ser um
     sorteio fixo por instância e passou a sair do hash do CICLO — era justamente
     a posição congelada que desenhava o padrão. O que sobra por instância é o
     gate de densidade e as três variações de aVar. */
  const rand = new Float32Array(RIPPLE_COUNT);
  for (let i = 0; i < RIPPLE_COUNT; i++) rand[i] = Math.random();
  const geo = instancedQuad(RIPPLE_COUNT, [
    ['aRand', rand, 1],
    ['aVar', varSeeds(RIPPLE_COUNT), 3],
  ]);
  const mat = new THREE.ShaderMaterial({
    uniforms: rippleU,
    vertexShader: RIPPLE_VERT,
    fragmentShader: RIPPLE_FRAG,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 29;
  m.visible = false;
  return m;
}

/* ---------------- wiring ---------------- */
/** O que o RIG pede — a intensidade autorada do preset, 0..1. É ela que manda na
 *  opacidade, na cor e na largura do risco; o perfil de qualidade só mexe em
 *  QUANTAS gotas existem. Ver `aplicarPerfil()`. */
let amount = 0;
const _rippleTint = new THREE.Color();
const WHITE = new THREE.Color(0xffffff);

export function initWeather() {
  /* Locals, not module state: both closures below capture them, and nothing
     outside this function ever needs the meshes again. */
  const rain = makeRain();
  const ripples = makeRipples();
  scene.add(rain, ripples);

  /* ---------------- O PERFIL DE QUALIDADE ENTRA AQUI, e só aqui ----------------
     DUAS COISAS, e nenhuma delas é "chuva mais fraca":

     · `rainAmount` (1 / 0,7 / 0,45) multiplica SÓ o `uAmount`, que é o gate de
       densidade `aRand > uAmount` do topo dos dois vertex shaders (o da chuva e
       o das ondulações). Instância acima do limiar sai em `gl_Position` fora do
       clip e não gera fragmento nenhum. Ou seja: no nível Baixo passam ~1 170
       das 2 600 gotas e ~630 dos 1 400 aros, com a MESMA opacidade, a MESMA cor
       e o MESMO calibre — o que se perde é densidade de campo, que é
       amostragem; o que NÃO muda é a leitura autorada da chuva, que é a regra do
       cabeçalho de `core/quality.ts`.
       ⚠️ Por isso a opacidade, o tint e `uWidth` continuam saindo de `amount`
       (o rig) e não do produto: multiplicá-los também seria pagar o desconto
       duas vezes e escurecer/afinar a chuva, que é decisão visual.
     · `rainRipples` esconde o campo de ondulações inteiro no nível Baixo. São
       quads DEITADOS com `NormalBlending` e `depthWrite:false` — overdraw
       transparente sem early-Z, a categoria mais cara numa integrada — e o custo
       de VÉRTICE deles é o que a auditoria achou de pior: os `~3× hash22`
       (~50 ALU) das linhas 294-296 são pagos ANTES do early-out de fase
       (`phase > lifeT`), e ~58 % das instâncias são descartadas DEPOIS de
       pagá-los. Reordenar isso não dá: o `lifeT` que decide o descarte sai
       justamente do segundo hash.
       O que se perde: o chão molhado volta a ler como "choveu há uma hora" —
       as gotas visivelmente nunca chegam (ver o cabeçalho da seção). É uma
       perda REAL, e é por isso que ela só acontece no nível Baixo.

     ⚠️ O QUE ISTO **NÃO** DEVOLVE, e é a maior parte do custo da chuva: o laço.
     `wantsFrame()` (scene/scene.ts) devolve `true` enquanto `rig.rain > 0.02`,
     então com chuva a cena inteira desenha em 60 fps — as duas chamadas de
     desenho daqui são troco perto de redesenhar o set, o veículo e o reflexo
     todo quadro. Tirar `rain` de `wantsFrame()` seria trocar o custo por uma
     chuva CONGELADA (o `uTime` dela avança no gancho de quadro), o que é um
     defeito visual e não uma otimização. Logo: o perfil corta o preenchimento e
     o vértice da chuva, e o pino de 60 fps continua — de propósito.

     É FUNÇÃO, e não uma leitura feita uma vez na montagem: o nível muda no meio
     da sessão (medidor ou escolha do usuário), e um `const` de módulo
     congelaria a densidade no nível em que a página abriu. É a mesma armadilha
     que `textureAnisotropy()` teve de virar função para não ter. */
  const aplicarPerfil = () => {
    const p = getProfile();
    rainU.uAmount.value = amount * p.rainAmount;
    rippleU.uAmount.value = amount * 0.9 * p.rainAmount;
    const on = amount > 0.02;
    rain.visible = on;
    ripples.visible = on && p.rainRipples;
  };

  onRig((rig: Rig) => {
    amount = THREE.MathUtils.clamp(rig.rain, 0, 1);
    /* 0.34 -> 0.46 PARA COMPENSAR AS CORTINAS, não para deixar a chuva mais
       forte. O `curtain` do vertex shader multiplica a opacidade por algo entre
       0,24 e 1,0 (média 0,62), então manter 0,34 aqui entregaria uma chuva ~40%
       mais fraca do que a de antes só por causa da variação. Com 0,46 a faixa
       DENSA da leva bate perto do que o preset já entregava e a faixa rala fica
       de fato mais rala — que é o ponto. */
    rainU.uOpacity.value = 0.46 * Math.min(1, amount * 1.4);
    rainU.uTint.value.copy(rig.rainColor);
    rainU.uWidth.value = 0.010 + 0.006 * amount;

    rippleU.uOpacity.value = 0.30 * amount;
    rippleU.uTint.value.copy(_rippleTint.copy(rig.rainColor).lerp(WHITE, 0.35));

    /* Densidade e visibilidade num lugar só, para o rig e a troca de nível não
       terem duas cópias da mesma regra. */
    aplicarPerfil();
  });

  /* SEM `invalidate()` aqui, e é dedução e não esquecimento: enquanto há chuva
     na tela o laço já está preso em 60 fps por `wantsFrame()`, então o quadro
     seguinte vem sozinho; e quando não há chuva (`amount <= 0.02`) as duas
     malhas estão invisíveis e nada do que esta função escreve muda um pixel. */
  onQualityChange(aplicarPerfil);

  onFrame((dt: number) => {
    if (amount <= 0.02) return;
    /* accumulate from the clamped dt rather than reading an absolute clock, or
       returning to a backgrounded tab teleports the whole field */
    rainU.uTime.value += dt;
    rippleU.uTime.value += dt;
    rainU.uCamPos.value.copy(camera.position);
    rippleU.uCamPos.value.copy(camera.position);
  });
}
