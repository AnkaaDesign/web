/* Light-rig presets: the tweenable description of a lighting condition.
   -------------------------------------------------------------------------
   Pure DATA plus makeRig(). scene.ts owns the crossfade, the clock and every
   three.js object these numbers end up on; nothing here touches the scene.
   Colours are authored as hex and normalised to THREE.Color by makeRig().

   Split out of scene.ts because this is the part a lighting pass edits: adding
   or retuning a preset never has to go near the rig machinery. */
import * as THREE from 'three';

/* ---------------- presets ---------------- */
/* Every field here is tweened. Colours are authored as hex and normalised to
   THREE.Color once, at module load. */
export const RIG_BASE = {
  keyColor: 0xffefe1, keyIntensity: 3.1, keyAz: 38, keyEl: 52,
  shadowIntensity: 1.0, shadowRadius: 2.0,
  rimColor: 0xbfd6ff, rimIntensity: 0.35,
  /* A ELEVAÇÃO DO RECORTE, em graus. Ela era CRAVADA em applyRig() — a posição
     do rim saía de `22·cos(0,6)` no plano e `y = 14`, ou seja 37,6°, e 38 aqui
     reproduz a mesma direção.
     Virou campo do rig quando se tentou baixá-la no `ciclorama` para tirar o
     recorte do chão. A tentativa foi REJEITADA pela bancada (o bloco do preset
     conta o porquê: a luz rasante cai na direção de espelho do piso polido e
     estoura), mas o campo fica: ele documenta que este ângulo é uma ESCOLHA e
     dá onde mexer a quem for testar um kicker com queda. */
  rimEl: 38,
  hemiSky: 0x8fb8f0, hemiGround: 0x514c44, hemiIntensity: 0.35,
  ambientColor: 0x6f7d90, ambientIntensity: 0.10,
  fogColor: 0xb8d8f5, fogDensity: 0.0028,
  bgColor: 0xb8d8f5,
  skyTop: 0x1f5fc4, skyMid: 0x4d93e8, skyHorizon: 0xb8d8f5,
  skyMidPos: 0.30, skyBias: 0.85,
  skyHaloColor: 0xfff2d8, skyHalo: 0.55, skyDisc: 1.0, cloudiness: 0.06,
  envIntensity: 1.0, exposure: 1.05,
  starOpacity: 0, lampIntensity: 0, lampEmissive: 0, lampColor: 0xffb45e,
  wetness: 0, rain: 0, rainColor: 0xc8d6ea,
  nightness: 0, glintBoost: 1.0,
  /* O NÍVEL DAS LUZES DO VEÍCULO, 0..1. Calculado por resolveRig() a partir da
     HORA (e não da altura do sol) e guardado aqui pelo mesmo motivo que
     `golden`: para atravessar lerpRig() como qualquer outro campo, de modo que
     trocar de preset às 19h seja um crossfade e não um salto. Quem o escreve nos
     materiais é applyRig(), via vehicle/lights.ts — e é lá que está o porquê de
     18:00 em vez de `nightness`. */
  vehLights: 0,
  /* O PESO DO SOL BAIXO, calculado por resolveRig() e guardado AQUI para poder
     ser tweenado como qualquer outro campo do rig.

     Ele já existia como variável local (`g`), aplicada a keyColor, skyHorizon,
     fogColor e bgColor e depois descartada. Descartá-lo era o bug do céu verde:
     `applyRig()` pinta a bruma de horizonte com `set.horizonColor` quando o
     cenário declara um — e essa cor é uma amostra de MEIO-DIA (ver o horizonNote
     do environments.json). Com o override, o entardecer avermelhava a névoa do
     preset e a casca de bruma continuava na cor medida ao meio-dia: às 18/19 h o
     `distrito-industrial` ficava com um céu OLIVA (#5a633f) por cima de um sol
     laranja. Sendo campo do rig, o peso atravessa `lerpRig()` de graça e chega a
     applyRig() já casado com a pose que está sendo aplicada — que é o requisito,
     porque applyRig roda por quadro de tween e não por evento. */
  golden: 0,
  /* O ALBEDO DA SALA DE CICLORAMA, como MULTIPLICADOR da rampa autorada em
     scene/cyclorama.ts. 1 = a rampa como ela está escrita lá.

     Ele é um campo do RIG — e não uma variável solta em cyclorama.ts — por uma
     razão só, e ela é a que faz o desenho inteiro funcionar: tudo que é campo do
     rig atravessa `lerpRig()` de graça. Trocar a cor de fundo do estúdio passa a
     ser um CROSSFADE de 0,8 s como qualquer outra troca de preset, em vez de um
     salto; e cyclorama.ts recebe o valor pelo `onRig()` que ele já assina, sem
     que scene.ts precise importá-lo (o que fecharia um ciclo — cyclorama importa
     scene).
     Vale só onde há sala; nos outros presets ninguém o lê. */
  cycloramaAlbedo: 1,
  /* O PISO E O REFLEXO SAÍRAM DE DENTRO DE `cycloramaAlbedo`, e a razão é uma
     medição: com UM multiplicador só para as duas superfícies, as pastilhas
     `Cinza claro` e `Branco` entregavam o piso em 245 e em 255 de luminância —
     ou seja SATURADO, uma folha branca sem reflexo, sem sombra e sem chão.

     Elas não podem compartilhar um número porque não são a mesma superfície:
     a casca é papel fosco (`roughness` 0,97) e o piso é concreto polido com um
     termo especular SOMADO por cima (floor-reflection.ts). Multiplicar os dois
     por 5 leva o papel de 0,036 a 0,18 — que ainda é cinza — e o piso de 0,132
     a 0,66, que com o reflexo em cima passa de 1,0 e corta no branco.

     `cycloramaGloss` cai conforme o piso clareia, e isso é o que a foto de um
     estúdio mostra: num ciclorama branco o difuso domina e o reflexo lê como
     um véu; num ciclorama escuro ele é a única coisa que o chão tem. */
  cycloramaFloor: 1,
  cycloramaGloss: 1,
};

/* ---------------- os fundos do estúdio ----------------
   As quatro pastilhas de "Fundo" do HUD, e por que cada uma é um PAR e não uma
   cor.

   `scene/cyclorama.ts` traz uma tabela MEDIDA (varredura de `gl.readPixels` com
   cavalo, implemento e fundo mascarados em separado) cujo achado central é este:
   a luminância de uma lataria BRANCA é praticamente insensível à luz — mediana
   170 com a chave variando 3x, porque um branco já está no ombro da ACES. Logo a
   separação figura/fundo não se compra subindo a luz; só se compra MEXENDO NO
   FUNDO. A tabela liga escala de albedo a luminância de fundo:

       escala   fundo   separação (branco − fundo)
        1.00     137            33
        0.75     120            50
        0.55     103            67
        0.40      88            82
        0.28      75            95

   A rampa que está escrita em cyclorama.ts É a linha de 0,50 — ou seja, o
   `albedo: 1` abaixo reproduz exatamente o estúdio de hoje, e o padrão não muda
   para ninguém.

   OS OUTROS TRÊS SÃO EXTRAPOLADOS DAQUELA TABELA, NÃO MEDIDOS — e isto está
   escrito porque a diferença importa: os números abaixo são a melhor conta que
   dá para fazer com o que foi medido, e quem quiser fechá-los tem o método
   documentado no cabeçalho de cyclorama.ts para remedir. O que NÃO é
   extrapolação é a FORMA da correção:

   * um fundo CLARO inverte o problema. A lataria branca fica presa em 170 e o
     fundo passa dela, então a separação vira negativa e o veículo some por
     cima em vez de por baixo. A resposta é a mesma de um estúdio de verdade:
     baixar a exposição (tirar o branco do ombro) e SUBIR o recorte, que é a
     única luz que ainda desenha um contorno quando figura e fundo têm o mesmo
     valor;
   * um fundo PRETO não precisa de nada disso — a separação é máxima por
     construção —, mas ganha um pouco de recorte porque um cavalo escuro contra
     preto é a única combinação em que o contorno some por baixo. */
/* ---------------- O QUE A SEGUNDA RODADA MEDIU, E POR QUE A TABELA MUDOU ----
   Os quatro fundos foram fotografados na bancada (`checks-estudio-diag.mjs`,
   pose lateral, mediana de luminância em três faixas do quadro). O resultado:

     fundo           parede   sujeito   PISO
     preto              4,7     129,7      0
     cinza-escuro      53,8     183,9    171,4
     cinza-claro       90,5     209,0    245,5
     branco           118,0     218,9    255,0   ← SATURADO

   Duas leituras, e as duas são o relato do dono do produto ("as cores não
   funcionam bem, não refletem no piso, só nas paredes"):

   1. NO CLARO E NO BRANCO O PISO ESTOURA. 245 e 255 não são "um piso claro",
      são a AUSÊNCIA de piso: sem reflexo, sem sombra de contato, sem a
      variação da laje. O caminhão passa a flutuar numa folha de papel — e é
      por isso que a pastilha parece não fazer nada no chão: ela faz demais, e
      o que ela produz não tem informação nenhuma.
   2. MESMO NO PADRÃO O PISO ESTÁ COLADO NO SUJEITO. 171,4 contra 183,9 são
      doze níveis de separação. O cabeçalho de cyclorama.ts estabelece a regra
      contrária com todas as letras — "o fundo tem de ficar abaixo da lataria" —
      e ela vale para o chão pelo mesmo motivo que vale para a parede.

   A CORREÇÃO É SEPARAR AS DUAS SUPERFÍCIES (ver `cycloramaFloor` em RIG_BASE) e
   escolher o piso pelo ALVO e não pela razão: um piso de estúdio fica entre a
   parede e o sujeito, nunca acima do sujeito. Os alvos abaixo, em luminância:

     fundo           parede    PISO    sujeito (preso em ~185 pelo ombro ACES)
     cinza-escuro     ~50      ~120
     cinza-claro      ~95      ~150
     branco          ~140      ~175

   `albedo` do claro e do branco desceu junto (2,80 → 2,30 e 5,00 → 3,80): a
   escala antiga vinha da tabela de separação medida numa parede que ainda era
   o CHÃO do cenário, e com o piso próprio ela passava do ponto. */
export interface BackdropDef {
  /** kebab-case, estável (vai para o localStorage) */
  id: string;
  /** rótulo pt-BR da pastilha */
  name: string;
  /** multiplicador da rampa de PAREDE de cyclorama.ts (1 = como autorada) */
  albedo: number;
  /** multiplicador do albedo do PISO — ver `cycloramaFloor` em RIG_BASE */
  floor: number;
  /** quanto do reflexo planar entra (1 = como autorado) */
  gloss: number;
  /** cor de limpeza, névoa e bandas do céu — o fundo quando não há sala de pé */
  bg: number;
  /** multiplicador da exposição do preset */
  exposure: number;
  /** multiplicador do recorte (rim) */
  rim: number;
}

export const BACKDROPS: readonly BackdropDef[] = [
  /* PRETO É "SEM SALA", NÃO "SALA ESCURA" — e a diferença é o pedido inteiro.
     ---------------------------------------------------------------------
     A primeira versão deste fundo era a rampa a 18 %: um ciclorama cinza bem
     escuro, ILUMINADO. O dono do produto corrigiu: *"a ideia do fundo preto é
     não receber luz, a luz ficar somente no cavalo e trailer"*. E ele está
     certo — um fundo que recebe luz tem gradiente, tem realce de key e clareia
     quando alguém sobe a intensidade, ou seja não é preto: é cinza variável.

     `albedo: 0` não é "quase nada de albedo", é um SINAL: cyclorama.ts esconde a
     casca inteira e põe no lugar um piso de `ShadowMaterial`, que escreve só a
     máscara de sombra. O que sobra na tela é a cor de limpeza (#000, abaixo) e o
     veículo. Nenhuma superfície de fundo para a luz alcançar.

     O PISO DE SOMBRA É O QUE IMPEDE O CAMINHÃO DE FLUTUAR. Sem chão não há
     sombra de contato, e sem sombra de contato um veículo sobre preto lê como
     recorte mal feito. É a mesma peça — e o mesmo motivo — do recorte
     transparente em scene/capture.ts. */
  /* `gloss: 0` porque não há piso polido para receber o termo — quem fica de pé
     é o `ShadowMaterial`. E o TETO sai junto com a casca (ver applyShellMode):
     a primeira versão deixava laje, vigas, painéis acesos e quatro dezenas de
     spots pendurados no vazio preto, que é a sala inteira menos as paredes. */
  { id: 'preto', name: 'Preto', albedo: 0, floor: 0, gloss: 0, bg: 0x000000, exposure: 1.00, rim: 1.25 },
  /* A PAREDE é a de hoje byte a byte (albedo 1 = a rampa como está escrita), e
     0x242424 é o `bgColor` que o preset `ciclorama` já traz. O que mudou é o
     PISO: 0,58 tira os doze níveis de colagem medidos contra a lataria. */
  { id: 'cinza-escuro', name: 'Cinza escuro', albedo: 1.00, floor: 0.58, gloss: 0.85, bg: 0x242424, exposure: 1.00, rim: 1.00 },
  { id: 'cinza-claro', name: 'Cinza claro', albedo: 2.30, floor: 0.95, gloss: 0.70, bg: 0x6a6a6a, exposure: 0.94, rim: 1.30 },
  { id: 'branco', name: 'Branco', albedo: 3.80, floor: 1.30, gloss: 0.55, bg: 0xc4c4c4, exposure: 0.88, rim: 1.55 },
];

export const DEFAULT_BACKDROP = 'cinza-escuro';

/* ---------------- temperatura de cor ----------------
   Pedido do dono do produto: *"falta seletores de color temperature, que seria
   interessante"*. É o controle que faltava para o estúdio ser um estúdio — luz
   quente e luz fria mudam completamente como uma tinta lê, e é justamente a
   pergunta que um cliente faz ("como fica no sol? e dentro do galpão?").

   6500 K É EXATAMENTE NEUTRO, e isso é requisito, não arredondamento. Esta é a
   cena em que se JULGA uma tinta; o preset `ciclorama` autora a chave em R=G=B
   exato por esse motivo, e um controle de temperatura que passasse por ele
   deixando um resíduo de cor destruiria a premissa do cenário inteiro sem
   ninguém perceber. Por isso a conversão é NORMALIZADA pelo próprio valor em
   6500 K: no meio da faixa o multiplicador é (1, 1, 1) por construção, não por
   sorte.

   A aproximação é a de Tanner Helland — a mesma que praticamente todo software
   de foto usa para a régua de Kelvin. Ela não é um corpo negro exato e não
   precisa ser: o que ela tem de acertar é a FAMÍLIA (2700 K parece lâmpada
   incandescente, 5000 K parece luz de dia, 7500 K parece sombra azulada), e
   nisso ela é indistinguível do exato.

   O multiplicador pode passar de 1 num canal — em 7500 K o verde sai ~2 % acima
   — e isso é ACEITO de propósito. Limitar a 1 achataria o matiz justamente para
   preservar uma normalização que não é sobre intensidade; 2 % de ganho num canal
   é invisível ao lado da própria mudança de temperatura, e a intensidade tem
   controle próprio. */
export const TEMP_NEUTRAL = 6500;
export const TEMP_MIN = 2200;
export const TEMP_MAX = 9000;

function planckRGB(kelvin: number): [number, number, number] {
  const t = Math.max(1000, Math.min(12000, kelvin)) / 100;
  const r = t <= 66 ? 255 : 329.698727446 * ((t - 60) ** -0.1332047592);
  const g = t <= 66
    ? 99.4708025861 * Math.log(t) - 161.1195681661
    : 288.1221695283 * ((t - 60) ** -0.0755148492);
  const b = t >= 66 ? 255
    : (t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307);
  const c = (v: number) => Math.min(255, Math.max(0, v)) / 255;
  return [c(r), c(g), c(b)];
}

const TEMP_WHITE = planckRGB(TEMP_NEUTRAL);

/** O multiplicador de cor desta temperatura. `TEMP_NEUTRAL` → (1, 1, 1) exato. */
export function kelvinTint(kelvin: number, out: THREE.Color): THREE.Color {
  const [r, g, b] = planckRGB(kelvin);
  return out.setRGB(r / TEMP_WHITE[0], g / TEMP_WHITE[1], b / TEMP_WHITE[2]);
}

export const backdropOf = (id: string | null | undefined): BackdropDef =>
  BACKDROPS.find((b) => b.id === id) || BACKDROPS.find((b) => b.id === DEFAULT_BACKDROP)!;

/* Night is a WEATHER-ORTHOGONAL axis: every preset has a dia and a noite face,
   so "overcast at night" and "raining at night" both exist and look right. */
const NIGHT_CLEAR = {
  /* Moonlight is physically ~4100 K — warm, it is reflected sunlight — but is
     universally perceived and depicted as blue (the Purkinje shift moves rod
     vision toward 507 nm at low light). Film convention wins here. */
  keyColor: 0x8fa8d8, keyIntensity: 0.55, keyAz: 300, keyEl: 48,
  shadowIntensity: 0.55, shadowRadius: 4.0,
  rimColor: 0x5f78b0, rimIntensity: 0.10,
  hemiSky: 0x3d5580, hemiGround: 0x1a1c22, hemiIntensity: 0.22,
  ambientColor: 0x26314a, ambientIntensity: 0.10,
  fogColor: 0x141d2e, fogDensity: 0.0050,
  bgColor: 0x141d2e,
  skyTop: 0x050912, skyMid: 0x0b1424, skyHorizon: 0x22304a,
  skyMidPos: 0.26, skyBias: 0.9,
  skyHaloColor: 0xaec4ee, skyHalo: 0.22, skyDisc: 0.55, cloudiness: 0.05,
  envIntensity: 0.35, exposure: 1.45,
  starOpacity: 1, lampIntensity: 240, lampEmissive: 3,
  nightness: 1, glintBoost: 2.0,
};

/* WHY EVERY lampIntensity JUMPED ~2.5x.
   The lamps used to be 5.08 m up with `decay: 1.6`; they are now 8.8 m up with
   `decay: 2`, which is what three's photometric path has meant since r155.
   Illuminance under the lamp is I·d^-decay, so the same number would have
   produced 95/5.08^1.6 = 7.4 before and 95/8.8² = 1.2 after — a 6x collapse of
   the one thing this pass exists to improve.
   Recalibrated on the target instead of on the ratio: this scene is not
   physically scaled (its sun is 3.1, not 100 000 lux), and what matters is the
   pool against the ambient night. A clear night gives the ground
   key·sin(46°) + hemi + ambient ≈ 0.4 + 0.22 + 0.10 ≈ 0.7, so a lamp pool at
   240/8.8² ≈ 3.1 sits ~4.4x above it: unmistakably lit, and still inside ACES's
   shoulder at the 1.45 exposure these presets use. Real street lighting is
   ~100x moonlight, which tone maps to a white hole — 4.4x is the readable
   version of the same statement.
   The hysteresis levels below (6 / 1.5) are ABSOLUTE and did not move; they sit
   even further into the invisible now, which is exactly where they belong. */

export const LIGHT_PRESETS: Record<string, LightPreset> = {
  ensolarado: {
    name: 'Ensolarado',
    dia: {},                       // RIG_BASE *is* the sunny day
    noite: { ...NIGHT_CLEAR },
  },

  /* Cool, flat, desaturated — and deliberately containing not one warm hex.
     The cloud deck IS the light source, so hemi does the heavy lifting (1.05)
     while the key light drops to 18 % and its shadow goes faint and very soft.
     Zenith brighter than horizon, per CIE overcast. */
  nublado: {
    name: 'Nublado',
    dia: {
      keyColor: 0xc6d2e0, keyIntensity: 0.58, keyEl: 62,
      shadowIntensity: 0.34, shadowRadius: 9.0,
      rimColor: 0xc9d6e8, rimIntensity: 0.18,
      hemiSky: 0xc4ced9, hemiGround: 0x4e4c48, hemiIntensity: 1.05,
      ambientColor: 0x9aa4ae, ambientIntensity: 0.22,
      fogColor: 0xc2c9cf, fogDensity: 0.0046,
      bgColor: 0xc2c9cf,
      skyTop: 0xc8cbd1, skyMid: 0xacacad, skyHorizon: 0xa1a1a2,
      skyMidPos: 0.42, skyBias: 1.0,
      skyHaloColor: 0xdfe4ea, skyHalo: 0.12, skyDisc: 0.0, cloudiness: 0.85,
      envIntensity: 1.25, exposure: 1.18,
      glintBoost: 1.15,
    },
    noite: {
      ...NIGHT_CLEAR,
      keyColor: 0x7f90ad, keyIntensity: 0.30, keyEl: 60,
      shadowIntensity: 0.22, shadowRadius: 9.0,
      hemiSky: 0x3a4356, hemiGround: 0x191b1f, hemiIntensity: 0.40,
      ambientColor: 0x2b3242, ambientIntensity: 0.16,
      fogColor: 0x1a2028, fogDensity: 0.0062,
      bgColor: 0x1a2028,
      skyTop: 0x141922, skyMid: 0x171c25, skyHorizon: 0x1b2028,
      skyMidPos: 0.42, skyBias: 1.0,
      skyHalo: 0.05, skyDisc: 0.0, cloudiness: 0.9,
      starOpacity: 0,                     // overcast: no stars
      envIntensity: 0.45, exposure: 1.5,
    },
  },

  chuvoso: {
    name: 'Chuvoso',
    dia: {
      keyColor: 0xdfe7ff, keyIntensity: 0.34, keyEl: 68,
      shadowIntensity: 0.20, shadowRadius: 12.0,
      rimColor: 0xb9c8de, rimIntensity: 0.14,
      hemiSky: 0x8e9aa8, hemiGround: 0x2b2c2e, hemiIntensity: 0.88,
      ambientColor: 0x6b7683, ambientIntensity: 0.20,
      fogColor: 0x79848f, fogDensity: 0.0076,
      bgColor: 0x79848f,
      skyTop: 0x898b8f, skyMid: 0x7b7b7d, skyHorizon: 0x767677,
      skyMidPos: 0.45, skyBias: 1.0,
      skyHaloColor: 0xc3c9cf, skyHalo: 0.05, skyDisc: 0.0, cloudiness: 1.0,
      envIntensity: 1.45, exposure: 1.02,
      wetness: 1.0, rain: 0.85,
      glintBoost: 1.2,
    },
    noite: {
      ...NIGHT_CLEAR,
      keyColor: 0x6d7e9e, keyIntensity: 0.24, keyEl: 66,
      shadowIntensity: 0.16, shadowRadius: 12.0,
      hemiSky: 0x2f3846, hemiGround: 0x14161a, hemiIntensity: 0.42,
      ambientColor: 0x252c38, ambientIntensity: 0.16,
      fogColor: 0x12171f, fogDensity: 0.0090,
      bgColor: 0x12171f,
      skyTop: 0x0f131a, skyMid: 0x11161d, skyHorizon: 0x151a21,
      skyMidPos: 0.45, skyBias: 1.0,
      skyHalo: 0.03, skyDisc: 0.0, cloudiness: 1.0,
      starOpacity: 0,
      envIntensity: 0.50, exposure: 1.42,
      wetness: 1.0, rain: 0.9, rainColor: 0x9fb0c8,
      lampIntensity: 295,                 // wet asphalt mirroring lamps: the
      glintBoost: 2.1,                    // best-looking state in the app
    },
  },

  dourado: {
    name: 'Dourado',
    dia: {
      keyColor: 0xffbb81, keyIntensity: 2.2, keyAz: 285, keyEl: 8,
      shadowIntensity: 0.95, shadowRadius: 3.0,
      rimColor: 0x9fb7e8, rimIntensity: 0.30,
      hemiSky: 0xb98ec4, hemiGround: 0x5c4632, hemiIntensity: 0.35,
      ambientColor: 0x8a6f78, ambientIntensity: 0.12,
      fogColor: 0xe8a469, fogDensity: 0.0036,
      bgColor: 0xe8a469,
      skyTop: 0x1d4f8f, skyMid: 0x7b7fae, skyHorizon: 0xff9d4a,
      skyMidPos: 0.34, skyBias: 0.7,
      skyHaloColor: 0xffcf9a, skyHalo: 0.95, skyDisc: 1.4, cloudiness: 0.12,
      envIntensity: 0.95, exposure: 1.15,
    },
    /* golden hour after sundown is the blue hour, not moonlight */
    noite: {
      ...NIGHT_CLEAR,
      keyColor: 0x7e8fc8, keyIntensity: 0.62, keyAz: 285, keyEl: 14,
      hemiSky: 0x4a5f96, hemiGround: 0x241f28, hemiIntensity: 0.34,
      ambientColor: 0x323a5c, ambientIntensity: 0.14,
      fogColor: 0x2b3352, fogDensity: 0.0044,
      bgColor: 0x2b3352,
      skyTop: 0x0a1130, skyMid: 0x1d2a5c, skyHorizon: 0x5a4f7a,
      skyMidPos: 0.32, skyBias: 0.72,
      skyHaloColor: 0xd8a2a0, skyHalo: 0.45, skyDisc: 0.0, cloudiness: 0.10,
      starOpacity: 0.55,
      envIntensity: 0.50, exposure: 1.35,
      lampIntensity: 180,
      glintBoost: 1.7,
    },
  },

  neblina: {
    name: 'Neblina',
    dia: {
      keyColor: 0xeceff9, keyIntensity: 0.42, keyEl: 60,
      shadowIntensity: 0.12, shadowRadius: 12.0,
      rimColor: 0xd6dce6, rimIntensity: 0.12,
      hemiSky: 0xc9d1d4, hemiGround: 0x4a4a48, hemiIntensity: 0.95,
      ambientColor: 0xa3abb0, ambientIntensity: 0.30,
      fogColor: 0xcfd5d6, fogDensity: 0.0165,
      bgColor: 0xcfd5d6,
      skyTop: 0xc6cccd, skyMid: 0xcbd1d2, skyHorizon: 0xd2d7d8,
      skyMidPos: 0.45, skyBias: 1.0,
      skyHaloColor: 0xe8ecee, skyHalo: 0.10, skyDisc: 0.0, cloudiness: 0.45,
      envIntensity: 1.15, exposure: 1.22,
      wetness: 0.35,
      glintBoost: 1.1,
    },
    noite: {
      ...NIGHT_CLEAR,
      keyColor: 0x8492a8, keyIntensity: 0.26, keyEl: 58,
      shadowIntensity: 0.10, shadowRadius: 12.0,
      hemiSky: 0x3f4650, hemiGround: 0x1b1d20, hemiIntensity: 0.46,
      ambientColor: 0x30363f, ambientIntensity: 0.22,
      fogColor: 0x24292e, fogDensity: 0.0180,
      bgColor: 0x24292e,
      skyTop: 0x1d2126, skyMid: 0x1f2429, skyHorizon: 0x22272c,
      skyMidPos: 0.45, skyBias: 1.0,
      skyHalo: 0.04, skyDisc: 0.0, cloudiness: 0.5,
      starOpacity: 0,
      envIntensity: 0.55, exposure: 1.45,
      wetness: 0.4,
      lampIntensity: 270,
    },
  },

  /* Neutral showroom: the one preset that keeps RoomEnvironment, whose
     rectangular light panels give paint the elongated softbox highlights a
     gradient sky cannot. Pick this to judge a colour.
     `solar: false` is the only opt-out from the clock's sun geometry, and it is
     not a special case so much as a statement of fact: a showroom has no sky,
     so its key light is a softbox on a stand and must not orbit with the hour
     or pick up the low-sun reddening. The clock still crossfades its two faces
     — a studio can be shot at night — it just does not move the lamp. */
  estudio: {
    name: 'Estúdio', env: 'room', solar: false,
    dia: {
      keyColor: 0xfff6ed, keyIntensity: 2.1, keyAz: 150, keyEl: 45,
      shadowIntensity: 0.65, shadowRadius: 6.0,
      rimColor: 0xdfe6f2, rimIntensity: 0.45,
      hemiSky: 0x8a8f96, hemiGround: 0x3c3e42, hemiIntensity: 0.45,
      ambientColor: 0x787d84, ambientIntensity: 0.16,
      fogColor: 0x4a4e54, fogDensity: 0.0012,
      bgColor: 0x4a4e54,
      skyTop: 0x3a3d42, skyMid: 0x4a4e54, skyHorizon: 0x5a5f66,
      skyMidPos: 0.4, skyBias: 1.0,
      skyHaloColor: 0xffffff, skyHalo: 0.05, skyDisc: 0.0, cloudiness: 0,
      envIntensity: 1.35, exposure: 1.10,
    },
    noite: {
      keyColor: 0xe8eefb, keyIntensity: 1.5, keyAz: 150, keyEl: 45,
      shadowIntensity: 0.75, shadowRadius: 5.0,
      rimColor: 0xc6d2ea, rimIntensity: 0.55,
      hemiSky: 0x2c3038, hemiGround: 0x141619, hemiIntensity: 0.35,
      ambientColor: 0x2a2e36, ambientIntensity: 0.12,
      fogColor: 0x14161a, fogDensity: 0.0012,
      bgColor: 0x14161a,
      skyTop: 0x0b0d11, skyMid: 0x101317, skyHorizon: 0x161a1f,
      skyMidPos: 0.4, skyBias: 1.0,
      skyHaloColor: 0xffffff, skyHalo: 0.04, skyDisc: 0.0, cloudiness: 0,
      envIntensity: 1.15, exposure: 1.20,
      nightness: 1, glintBoost: 1.4,
      /* The only noite face that does not spread NIGHT_CLEAR, so it was also
         the only one whose lamps stayed dark — and this is the preset the
         assetless fallback cenário ships with, i.e. the night scene most users
         see first. Cool white rather than the sodium 0xffb45e every other
         preset uses: this is the preset you pick to judge a paint colour, and
         a modest cold LED spill leaves that judgement intact where an orange
         one would not. */
      lampIntensity: 140, lampEmissive: 2.2, lampColor: 0xcfd8e8,
    },
  },

  /* CICLORAMA — a luz do cenário `estudio` do seletor.
     ---------------------------------------------------------------------
     Por que não reusar `estudio` acima: aquele preset já é o do cenário
     `armazem`, e dois cenários com a mesma luz seriam o mesmo cenário com
     dois nomes. Este é o outro extremo do mesmo material.

     As três diferenças, e nenhuma é cosmética:
     1. FUNDO SEM EMENDA. `fogDensity` cai a 0.0004 (o `estudio` usa 0.0012) e
        as três bandas do céu ficam a um passo de distância umas das outras
        (0x60646b → 0x6d7178). O gradiente quase-liso é o que lê como papel de
        ciclorama; um degradê marcado leria como horizonte, que é exatamente o
        que um estúdio não tem.
     2. KEY/FILL/RIM SEPARADOS DE VERDADE. Key mais forte e mais alta (2.6 a
        52°) com sombra MAIS DURA e mais escura (raio 3.4 contra 6.0): num
        estúdio a softbox está perto, então o contato é definido. O hemi cai
        para 0.30 e vira o FILL — a chapa branca do outro lado —, e o rim sobe
        para 0.62 com uma luz fria, que é o contorno que separa a lataria do
        fundo cinza. Com fill alto e rim baixo, cavalo escuro e ciclorama viram
        a mesma mancha.
     3. NENHUMA CONTAMINAÇÃO DE COR. `ambientColor` neutro puro (0x7a7e84,
        R=G=B) e `keyColor` a 0xfffaf4 em vez do 0xfff6ed do showroom: esta é a
        cena em que se JULGA uma tinta, e qualquer dominante aqui é uma
        mentira sobre a cor que o cliente vai receber.

     `env:'room'` e `solar:false` pelos mesmos motivos do `estudio`: os painéis
     retangulares do RoomEnvironment dão à tinta o realce alongado de softbox
     que um céu em gradiente não tem, e um estúdio não tem sol para orbitar. */
  ciclorama: {
    name: 'Ciclorama', env: 'room', solar: false, studio: true,
    dia: {
      /* KEY NEUTRA POR DEFINIÇÃO. Esta é a cena em que se JULGA uma tinta, então
         a luz principal não pode ter dominante nenhuma: R=G=B exato. A "leve
         frieza" que uma foto de estúdio tem vem do rim lá embaixo, que é luz de
         recorte e não luz de leitura. A versão anterior usava 0xfffaf4 — 11
         níveis de amarelo — e isso desloca qualquer branco para creme. */
      keyColor: 0xffffff, keyIntensity: 3.4, keyAz: 138, keyEl: 46,
      /* Softbox grande e PERTO: sombra funda o bastante para dar peso e macia o
         bastante para não virar recorte duro. É ela que apoia o pneu no chão —
         antes não havia sombra nenhuma, porque não havia chão. */
      shadowIntensity: 0.90, shadowRadius: 4.5,
      /* O RECORTE. Subiu de 0.62 para 0.88 e é a peça que separa a lataria do
         fundo agora que o fundo ficou escuro. Frio de propósito, e é a ÚNICA
         dominante autorada nesta cena: contra uma key neutra ele lê como o
         contorno de uma segunda fonte, que é o que um kicker é.

         RASANTE FOI TENTADO E REJEITADO — `rimEl: 13`, e a bancada matou a
         ideia. O raciocínio era bom no papel: a 38° a direcional cobre os 120 m
         de chão com cos 0,61 e a lateral do baú com 0,79; a 13° os dois trocam
         de lado (0,22 e 0,97), então o recorte desenharia contorno em vez de
         acender o set. O que a conta ignora é o ESPECULAR. O piso tem
         `roughness` 0,22, e uma câmera de foto de veículo olha o chão de cima
         para baixo num ângulo raso — a direção de espelho dela sai rasante,
         que é exatamente onde uma luz a 13° está. A foto voltou com uma PLUMA
         BRANCA SATURADA subindo do chão diante da cabine, azulada como o
         próprio rim. E o ganho nem apareceu: o sujeito melhorou 7,8 → 4,3.
         A 38° o realce especular do rim no piso cai longe da lente.

         O QUE FICA EM ABERTO: uma direcional não tem queda com a distância,
         então ela ilumina os 120 m de piso com a mesma força que ilumina o
         caminhão, e é por isso que varrer o Recorte ainda move mais o chão que
         o sujeito. O conserto de verdade é um kicker com QUEDA (um spot mirado
         no conjunto), não um ângulo. */
      rimColor: 0xccd9f2, rimIntensity: 0.88,
      /* FILL, e estritamente neutro. O hemi é a chapa branca do outro lado. */
      hemiSky: 0x9c9c9c, hemiGround: 0x3a3a3a, hemiIntensity: 0.32,
      /* AMBIENTE BAIXO. Luz ambiente é justamente o termo que achata: ela chega
         igual em toda face e come a diferença entre o lado da key e o lado do
         fill. 0.14 -> 0.09 é metade da correção de "muito opaco". */
      ambientColor: 0x7d7d7d, ambientIntensity: 0.09,
      /* FUNDO NEUTRO E ESCURO, R=G=B exato.
         Duas mudanças numa. (1) A COR: 0x60646b é 96/100/107 — azul, e era o que
         deixava a tela do carregamento puxando para azul contra o cinza neutro
         do restante da interface. (2) O VALOR: medido no app, o fundo antigo
         renderizava em luminância 110 contra uma carreta branca em 141. Trinta e
         um níveis de separação num quadro de 255 é o que o olho lê como "tudo
         colado, tudo esbranquiçado". Um estúdio de verdade mantém o fundo BEM
         abaixo do sujeito e devolve a separação pelo rim.
         Isto é também a cor de limpeza do canvas antes de a sala existir, então
         ela fica perto do #1c1c1c da interface de propósito — a transição do
         carregamento para a cena deixa de ter emenda de cor. */
      fogColor: 0x242424, fogDensity: 0.0004,
      bgColor: 0x242424,
      /* O domo fica DESLIGADO neste cenário (a sala é fechada, ver
         scene/cyclorama.ts), mas as bandas continuam autoradas e neutras: elas
         ainda alimentam o PMREM procedural se alguém abrir este preset num
         cenário sem sala. */
      skyTop: 0x242424, skyMid: 0x2a2a2a, skyHorizon: 0x303030,
      skyMidPos: 0.5, skyBias: 1.0,
      skyHaloColor: 0xffffff, skyHalo: 0.02, skyDisc: 0.0, cloudiness: 0,
      /* 1.45 -> 0.85. O RoomEnvironment é uma caixa BRANCA, e a 1.45 ele
         despejava luz quase omnidirecional no cavalo: forma nenhuma, tudo no
         mesmo meio-tom. A modelagem passa a vir da key; o ambiente volta a ser o
         que num estúdio ele é — o preenchimento das sombras e o realce alongado
         de softbox no verniz. Este número também é o que mantém cavalo e
         implemento juntos: ele escala o que o cavalo reflete, e a sala escura que
         a sonda captura escala o que o implemento reflete, na mesma direção.
         A exposição desce junto (1.06 -> 0.95) para tirar o branco do ombro da
         ACES: medido, a 1.06 a lataria branca ficava presa em ~198 de luminância
         mesmo variando a key em 3x — que é a definição de "estourado".

         0,85 -> 1,15 QUANDO O AMBIENTE DEIXOU DE SER O RoomEnvironment. Este
         número é uma ESCALA sobre uma textura, então ele só tem significado
         junto com a textura que escala — e ela trocou: `buildStudioEnv()`
         (scene/scene.ts) desenha a sala DESTE cenário, que é um ciclorama
         escuro, no lugar da caixa branca do addon do three. Medido, a troca
         levou a parede de 53,8 para 34,5 de luminância e o sujeito de 183,9
         para 154,4 sem que nada mais mudasse: não é escurecimento de projeto, é
         a mesma escala aplicada a uma fonte com um terço da radiância. Subir
         aqui devolve o nível SEM devolver a caixa branca fantasma — que era o
         que achatava a modelagem e punha um borrão claro num canto do piso. */
      envIntensity: 1.15, exposure: 0.95,
    },
    noite: {
      /* A face noite de um ciclorama não é "de noite": é o mesmo estúdio com a
         luz de sala apagada e só os painéis acesos. Fundo bem mais escuro,
         key e rim intactos em COR (a tinta continua tendo de ser julgável) e
         só um pouco menores em intensidade.
         Todos os cinzas aqui também são R=G=B exato: o motivo de neutralidade da
         face dia não muda quando a luz de sala apaga. */
      keyColor: 0xffffff, keyIntensity: 3.0, keyAz: 138, keyEl: 46,
      shadowIntensity: 0.94, shadowRadius: 4.0,
      rimColor: 0xc4d3ef, rimIntensity: 0.95,
      hemiSky: 0x353535, hemiGround: 0x181818, hemiIntensity: 0.22,
      ambientColor: 0x2c2c2c, ambientIntensity: 0.07,
      fogColor: 0x131313, fogDensity: 0.0004,
      bgColor: 0x131313,
      skyTop: 0x131313, skyMid: 0x161616, skyHorizon: 0x1a1a1a,
      skyMidPos: 0.5, skyBias: 1.0,
      skyHaloColor: 0xffffff, skyHalo: 0.02, skyDisc: 0.0, cloudiness: 0,
      /* 0,70 -> 0,95 pela mesma razão que a face dia subiu: o ambiente deixou de
         ser a caixa branca do RoomEnvironment e passou a ser a própria sala. */
      envIntensity: 0.95, exposure: 1.06,
      nightness: 1, glintBoost: 1.3,
      /* Sem poste: um ciclorama não tem luminária de rua, e acender uma aqui
         jogaria uma dominante quente na única cena que existe para não ter
         nenhuma. */
      lampIntensity: 0, lampEmissive: 0,
    },
  },
};

export const PRESET_ORDER = [
  'ensolarado', 'nublado', 'chuvoso', 'dourado', 'neblina', 'estudio', 'ciclorama',
];

/* ---------------- types ----------------
   A preset FACE is authored as hex + numbers (RigSource); the rig the scene
   actually drives has THREE.Color instances in the colour slots (Rig). makeRig()
   is the one conversion between the two, which is why both types live here. */

/** One preset face as authored: every value a plain number, colours as hex. */
export type RigSource = typeof RIG_BASE;

/** Rig fields that are colours — lerped as THREE.Color, never as numbers. */
export type RigColorField =
  | 'keyColor' | 'rimColor' | 'hemiSky' | 'hemiGround' | 'ambientColor'
  | 'fogColor' | 'bgColor' | 'skyTop' | 'skyMid' | 'skyHorizon' | 'skyHaloColor'
  | 'lampColor' | 'rainColor';

/** Everything else: plain tweenable scalars. */
export type RigNumField = Exclude<keyof RigSource, RigColorField>;

/** The resolved rig scene.ts applies to three.js objects. */
export type Rig = Record<RigNumField, number> & Record<RigColorField, THREE.Color>;

/** A named weather condition with its two time-of-day faces. */
export interface LightPreset {
  name: string;
  dia: Partial<RigSource>;
  noite: Partial<RigSource>;
  /** 'room' swaps the procedural sky PMREM for three's RoomEnvironment. */
  env?: 'room';
  /** false opts the preset out of the clock's sun geometry — see `estudio`. */
  solar?: boolean;
  /**
   * Este preset é uma SALA DE ESTÚDIO — tem ciclorama, e portanto tem fundo
   * escolhível e luz de estúdio em vez de hora do dia e clima.
   *
   * É a marca que o HUD lê para trocar de face (ui/hud.ts). Poderia ter sido
   * `env === 'room'`, e estaria ERRADO: o `estudio` também é `room` e é a luz do
   * cenário `armazem` — um galpão fechado, sem ciclorama nenhum. Oferecer ali
   * uma pastilha de "cor de fundo" seria um controle que não muda nada, que é a
   * pior espécie de controle.
   *
   * Também não é "o ciclorama está de pé?": essa pergunta só cyclorama.ts sabe
   * responder, e scene.ts não pode importá-lo (a seta é a contrária).
   */
  studio?: boolean;
}

/* which rig fields are colours (lerped as THREE.Color) vs plain numbers */
export const COLOR_FIELDS: RigColorField[] = [
  'keyColor', 'rimColor', 'hemiSky', 'hemiGround', 'ambientColor',
  'fogColor', 'bgColor', 'skyTop', 'skyMid', 'skyHorizon', 'skyHaloColor',
  'lampColor', 'rainColor',
];
export const NUM_FIELDS = (Object.keys(RIG_BASE) as (keyof RigSource)[])
  .filter((k): k is RigNumField => !(COLOR_FIELDS as string[]).includes(k));

export function makeRig(src: RigSource): Rig {
  const out = {} as Rig;
  for (const k of NUM_FIELDS) out[k] = src[k];
  for (const k of COLOR_FIELDS) out[k] = new THREE.Color(src[k]);
  return out;
}
