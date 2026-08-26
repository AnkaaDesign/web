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
       (Os dois números são os do nível ALTO; desde 2026-08-14 quem os dita é o
       perfil de qualidade — ver o bloco `passos()`/`minMs()` abaixo.)

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
   ⚠️ A CURVA SAIU DAQUI EM 2026-08-24, E É PRECISO SABER PARA ONDE.

   Este módulo recebia `nightness` e aplicava `smoothstep(n, 0,25 … 0,95)`. Ele
   passa a receber o PESO PRONTO, 0..1, e a única coisa que faz com ele é
   `clamp`. Quem calcula é `skyMixAt()` em scene/scene.ts, e o campo que o
   carrega é `rig.skyMix`.

   POR QUE MUDOU. As duas saturações se somavam — `nightness` satura quando o sol
   cruza −14° (19:20) e a curva saturava em n = 0,95 (**18:55**) —, então a
   travessia inteira acontecia entre 17:45 e 18:55 e **de 19:00 a 24:00 o céu era
   bit-a-bit o mesmo**. Cinco paradas de um controle de 72 carregavam tudo e
   vinte não mudavam nada. Um campo saturado não tem como falar sobre o resto da
   noite; a ALTITUDE DO SOL tem, e continua caindo até −70,6°.

   POR QUE A CURVA FOI JUNTO, e não só a entrada. Ela é `smoothstep` sobre uma
   BANDA, e uma banda em `nightness` não é conversível numa banda em graus: o
   extremo de baixo da faixa nova (−12°) cai no trecho onde `nightness` já está
   quase saturado, e um `smoothstep` sobre um domínio esmagado deixa de ser um
   `smoothstep`. Manter meia curva aqui e meia lá daria duas réguas para um
   número só — que é a armadilha que o aviso de quantização mais abaixo descreve,
   chegando por outra porta.

   ⚠️ O QUE NÃO PODE SE PERDER NA MUDANÇA — A TRAVA DA LUA, e ela é medida aqui.
   O pico do plate de noite é **55 633** (a lua, três texels de diâmetro) contra
   **33** do sol do plate de dia: os `_puresky` domam o disco solar, e ninguém
   domou a lua. Numa interpolação linear, com o peso em 0,3 às 18h20 — céu ainda
   de poente — já haveria meia lua de 28 mil unidades no meio do crepúsculo, um
   ponto branco cravado num céu laranja. Era o `0,25` da curva antiga que
   segurava isso, e é o `+10°` da banda nova que segura agora: às 18:00 o peso é
   **0,049**, contra os 0,083 que a curva antiga entregava. A trava não afrouxou —
   apertou. Quem for mexer na banda de scene.ts tem de reconferir esta linha.

   ⚠️⚠️ E O OUTRO EXTREMO É AINDA MAIS APERTADO, POR UM MOTIVO QUE SÓ APARECE NA
   FOTO. O lado "dia" deste par é um POENTE ESTÁTICO — sol sempre a +4,7°, cúmulo
   sempre aceso por baixo —, e o par não tem plate de crepúsculo. Logo **todo peso
   residual do lado de dia é literalmente uma foto de poente sobreposta à noite**,
   e ele não desbota sozinho: `applyRig()` escala os DOIS lados pelo mesmo
   `backgroundIntensity`, então escurecer deixa a nuvem mais escura, nunca ausente.
   A primeira tentativa levou a banda a −30° para espalhar a travessia até as
   20:15 e deixou 44 % de poente no ar às 19:00 — o relato *"mesmo estando escuro
   ainda mostra nuvens"*. **A travessia tem de ACABAR quando a noite começa
   (−12°, 19:15); o que se pode espalhar é só o caminho até lá.**

   O QUE ESTE MÓDULO NÃO FAZ: mexer em intensidade, exposição ou cor. Quem
   escurece a noite continua sendo `applyRig()`, e os fatores dele foram
   reajustados na mesma rodada — com o plate certo no lugar, esmagar o fundo a
   6 % passou a ser escuro demais. Ver NIGHT_BG/NIGHT_ENV em scene.ts. */
import * as THREE from 'three';
import { renderer, pmrem, invalidate } from './scene';
import { getProfile } from '../core/quality';

/* ---------------------------------------------------------------------------
   A TAXA DE REASSADURA VEM DO PERFIL DE QUALIDADE (2026-08-14)

   Eram duas constantes — `PASSOS = 12` e `MIN_MS = 110` —, e o cabeçalho já
   dizia por que elas são o botão certo: cada assadura custa 10 a 40 ms, então
   uma varredura completa do relógio são DOZE picos desses. Metade dos passos é
   metade dos picos, e a defasagem do céu misturado é invisível pelo argumento
   deste próprio arquivo (ver "O DESCASAMENTO É INVISÍVEL"): o fundo é reescrito
   a cada quadro de tween e continua liso; o que atrasa é só o reflexo, que é um
   termo difuso mais um realce desfocado.

     Alta  12 passos / 110 ms   — como sempre foi.
     Média  8 passos / 150 ms
     Baixa  6 passos / 200 ms   — metade dos picos, e cada pico ~4× mais barato
                                  quando `hdrVariant` = '@1k' entra junto (o
                                  custo do PMREM escala com a ÁREA; ver
                                  `ColdProfile.hdrVariant` em core/quality.ts).

   ⚠️ SÃO FUNÇÕES, E NÃO CONSTANTES LIDAS UMA VEZ. O nível muda no meio da
   sessão — pelo medidor ou por escolha do usuário — e um `const` de módulo
   congelaria a taxa no nível em que a página abriu. É a mesma armadilha que
   `textureAnisotropy()` teve de virar função para não ter. Por serem lidas a
   cada chamada, este módulo NÃO precisa assinar `onQualityChange`.

   ⚠️⚠️ E `PASSOS` É ARITMÉTICA DE QUANTIZAÇÃO, não um contador — o que faz dele
   uma armadilha de verdade quando muda no meio do caminho. `passoAssado` guarda
   `round(peso · PASSOS)`, e a comparação `passo === passoAssado` é o que decide
   PULAR uma assadura. Com o número de passos mudando, um índice gravado na
   régua velha pode COINCIDIR com um índice da régua nova em pesos diferentes, e
   aí a assadura seria pulada por engano — o reflexo ficaria preso num degrau
   até o próximo movimento do relógio, e no fim de um arrasto "o próximo
   movimento" pode não vir. Daí `passosAssados`: o índice só vale enquanto a
   régua que o produziu for a mesma. Uma troca de nível força uma reassadura, o
   que é o lado certo de errar (uma assadura a mais, nunca um céu preso).

   O ERRO EM REPOUSO, dito por inteiro e sem maquiagem: com a mistura parada, o
   reflexo corresponde ao peso em que o degrau foi cruzado, não ao peso final —
   erro de até 1/(2·PASSOS) da mistura. Isso JÁ EXISTIA com 12 passos (±4,2 %);
   com 6 ele dobra para ±8,3 %. Sobre um envmap difuso já borrado pelo PMREM
   isso é indistinguível, e é exatamente a mesma aposta que os 110 ms de atraso
   fazem — só que em amplitude em vez de em tempo.
   --------------------------------------------------------------------------- */

/** Passos de mistura em que o PMREM é reassado. Doze numa varredura inteira, no
 *  nível Alto. */
const passos = () => Math.max(1, getProfile().pmremSteps);
/** Piso entre duas reassaduras, em ms. ~9 por segundo no pior arrasto (Alta). */
const minMs = () => getProfile().pmremMinMs;


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
/** Com QUANTOS passos `passoAssado` foi calculado. Ver o aviso da quantização
 *  no topo: um índice só é comparável com outro da mesma régua. */
let passosAssados = 0;
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
 * @param peso o peso do plate de NOITE, 0..1, JÁ COM A CURVA APLICADA. Desde
 *   2026-08-24 este módulo não conhece mais `nightness` nem a banda de
 *   crepúsculo: quem calcula é `skyMixAt()` em scene/scene.ts, que é quem tem a
 *   régua solar. Ver o bloco "A CURVA SAIU DAQUI" no cabeçalho.
 * @returns null quando falta um dos dois lados — e aí quem chama segue pelo
 *   caminho de sempre (um plate só, escurecido). Um HDRI de noite que não baixou
 *   nunca pode ser motivo de tela preta.
 */
export function setSkyPair(d: THREE.Texture | null, n: THREE.Texture | null,
  peso: number) {
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
  pesoAtual = THREE.MathUtils.clamp(peso, 0, 1);
  passosAssados = passos();
  passoAssado = Math.round(pesoAtual * passosAssados);
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
 *
 * @param peso o peso do plate de NOITE, 0..1, já com a curva aplicada — é
 *   `rig.skyMix`, ou seja o valor JÁ TWEENADO por `lerpRig()`. Passar
 *   `skyMixAt(hora)` daqui seria ler a hora crua no meio de um tween e fazer a
 *   mistura saltar enquanto o resto do rig atravessa.
 */
export function updateSkyBlend(peso: number) {
  if (!alvo) return;
  const p = THREE.MathUtils.clamp(peso, 0, 1);
  if (Math.abs(p - pesoAtual) < 1e-4) return;
  pesoAtual = p;
  pintar();
  invalidate();

  /* A RÉGUA É LIDA UMA VEZ POR CHAMADA, e o índice só é comparável com um
     índice da MESMA régua — ver o aviso da quantização no topo. Nível trocado
     ⇒ `passo === passoAssado` não pode mais autorizar um pulo. */
  const ps = passos();
  const espera = minMs();
  const passo = Math.round(pesoAtual * ps);
  if (passo === passoAssado && ps === passosAssados) return;
  const agora = performance.now();
  if (agora - ultimoBake >= espera) {
    if (pendente) { clearTimeout(pendente); pendente = 0; }
    passoAssado = passo;
    passosAssados = ps;
    ultimoBake = agora;
    assar();
    invalidate();
    return;
  }
  if (pendente) return;
  pendente = setTimeout(() => {
    pendente = 0;
    if (!alvo) return;
    /* RELIDO aqui dentro, e não capturado: entre o agendamento e o disparo cabe
       uma troca de nível, e o índice tem de ser gravado na régua que valia na
       hora de assar. */
    passosAssados = passos();
    passoAssado = Math.round(pesoAtual * passosAssados);
    ultimoBake = performance.now();
    assar();
    invalidate();
  }, espera - (agora - ultimoBake));
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
  passosAssados = 0;
}

/** Há um par montado? É o liga/desliga que scene.ts consulta em applyRig(). */
export function hasSkyPair() { return !!alvo; }

/** Para o console e para a bancada. */
export function getSkyBlend() {
  return {
    ativo: !!alvo,
    peso: pesoAtual,
    passoAssado,
    /* A régua vigente e a que produziu `passoAssado`. Divergirem é normal logo
       depois de uma troca de nível e some na próxima assadura. */
    passos: passos(),
    passosAssados,
    minMs: minMs(),
    bakes,
    tamanho: alvo ? [alvo.width, alvo.height] : null,
  };
}
