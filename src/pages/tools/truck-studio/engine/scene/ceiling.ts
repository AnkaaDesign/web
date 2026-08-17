/* O TETO DO ESTÚDIO — a grelha de laje, vigas e luminárias do cenário `estudio`.
   ===========================================================================
   POR QUE ELE EXISTE. `scene/cyclorama.ts` já fecha a sala por cima, mas com uma
   CASCA LISA a 36 m: uma superfície clara cujo trabalho é ser difusor e tapar o
   domo, e que por construção não tem nada para o olho ler. Numa foto de estúdio
   de verdade — e na referência que originou este módulo — o alto do quadro é a
   parte com MAIS informação: laje escura, vigas, trilhos e o painel aceso da
   softbox. É também metade do que um piso polido devolve, e sem ele o reflexo do
   chão não teria o que refletir além do próprio caminhão.

   A FONTE. Um modelo de estúdio de verdade (`Studio Environment`, 106 OBJ), do
   qual só a estrutura do teto foi ABSTRAÍDA — nenhum byte dele é baixado nem
   versionado aqui. O que ficou foram as MEDIDAS, levantadas varrendo os OBJ:

     | peça no modelo | medida |
     |---|---|
     | sala | 25,96 × 22,16 m, laje a 5,46 m |
     | laje (`model_0`) | telha trapezoidal, passo 0,40 m, relevo 0,073 m |
     | vigas (`model_38`) | grelha 4 × 4, passo 6,30 m, altura 0,36 m |
     | softboxes (`model_14..21`) | 2 × 2 quadros de 2,29 m, 1,96 m abaixo da laje |
     | passarelas (`model_37`) | dois treliçados no vão inteiro, 1,5 m abaixo |

   POR QUE NÃO DÁ PARA SÓ ESCALAR. A sala daqui não tem 26 m: ela é medida a
   partir do alcance da órbita e hoje dá 120 m de vão (ver `sizeRoom()` no
   ciclorama). Multiplicar o modelo por 4,6 produziria vigas de 1,7 m de alma e
   uma telha de passo 1,85 m — nada disso é telha nem viga, é uma maquete
   ampliada. O caminho oposto — manter as medidas de fábrica e repetir a grelha —
   produz o defeito simétrico: a 14 m de altura, uma telha de 40 cm vira listra
   de moiré e uma grelha de 6,3 m vira tela de mosquiteiro.

   A REGRA QUE ESTE MÓDULO USA, e é o "reestruturar" do pedido: **o teto é o teto
   do modelo escalado pela RAZÃO DE ALTURAS, e só a EXTENSÃO cresce mais, por
   repetição.** Como quem olha está no chão, o que define se uma peça "parece uma
   viga" é o ÂNGULO que ela subtende, não o metro que ela mede; preservar
   `medida / altura` preserva exatamente isso. Daí um único fator, `K`, aplicado a
   todas as seções — e uma extensão escolhida à parte, pelo tamanho da sala.

   O TETO NÃO ILUMINA, E ISSO É DELIBERADO. Nenhuma luz do three nasce aqui e
   nada aqui projeta sombra. A luz do cenário é o rig medido do preset
   `ciclorama` (chave a 46°, fill, rim), e os números dele saíram de leitura de
   pixel — pendurar duas RectAreaLight no teto reabriria essa medição inteira
   para ganhar o que a geometria emissiva já dá:

     · o painel ACESO aparece na tela (é ele o brilho no alto do quadro);
     · aparece no REFLEXO do piso, que é metade do pedido;
     · e aparece na SONDA (`scene/probe.ts`), que captura a cena visível — ou
       seja, a lataria passa a refletir uma softbox de verdade em vez do painel
       genérico do RoomEnvironment.

   `castShadow = false` em tudo pelo mesmo motivo, e este é o erro fácil: uma
   laje que projeta sombra sob uma chave a 46° põe o caminhão inteiro na sombra
   do próprio teto, e o sintoma (a cena escurece ao entrar no estúdio) não se
   parece nada com a causa. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { renderer, scene, camera, invalidate, onFrame, onRig, getRig } from './scene';
import { getProfile, onQualityChange } from '../core/quality';

/* ---------------- as medidas do modelo, em metros ----------------
   Cruas, como saíram da varredura. Tudo abaixo deriva daqui — deixá-las
   nomeadas é o que permite conferir a conta contra a tabela do cabeçalho. */
const SRC = {
  ceil: 5.456,        // face inferior da laje
  deckPitch: 0.40,    // passo da telha
  deckRib: 0.073,     // relevo da telha
  beamPitch: 6.30,    // passo da grelha de vigas
  beamDepth: 0.36,    // altura da viga
  beamWidth: 0.18,    // largura da mesa
  boxSize: 2.29,      // lado da softbox
  boxDrop: 1.96,      // quanto ela pende abaixo da laje
};

/* ---------------- a altura, e o fator que sai dela ----------------
   14 m é a única medida AUTORADA deste arquivo, e a referência para ela é o
   caminhão e não a sala: 3,3 vezes a altura de um conjunto de 4,26 m. A foto
   que originou o pedido tem um pé-direito de ~2 alturas de caminhão, e subir um
   pouco disso é o que a órbita exige — a câmera na pose de catálogo (13° a
   43,5 m) passa a 9,8 m do chão, e um teto a 9 m estaria ABAIXO dela.

   Ele acompanha a sala em vez de ficar cravado, pela mesma razão que o
   ciclorama passou a acompanhar: no dia em que o implemento crescer, a órbita
   cresce, a sala cresce, e um número cravado aqui volta a divergir sem aviso.
   0,39 · 36 = 14,0, ou seja hoje ele dá exatamente o valor autorado. */
const CEIL_RATIO = 0.39;
const CEIL_MIN = 11, CEIL_MAX = 17;

let H = 14;          // face inferior da laje
let K = H / SRC.ceil; // o fator de escala por razão de alturas — hoje 2,57
let HALF = 36;       // meia-extensão da grelha

/* ---------------- o que a extensão precisa cobrir ----------------
   A grelha NÃO chega à parede, e isso é a foto e não uma economia. A sala tem
   120 m de vão; um teto que a fechasse a 14 m seria um galpão de proporção 1:8,
   e a rampa de valor do ciclorama — medida, e que é o fundo — ficaria toda
   escondida atrás dele. Na referência é assim que aparece: o teto escuro ocupa
   o alto do quadro, termina numa borda reta, e o ciclorama claro continua
   subindo atrás. 0,78 · raio do piso dá ~36 m, que a 14 m de altura põe essa
   borda a ~7° acima do horizonte da câmera — dentro do quadro, no terço de
   cima, que é onde ela está na foto. */
const EXTENT_RATIO = 0.78;
const EXTENT_MIN = 24, EXTENT_MAX = 44;

/* ---------------- a esmaecida por altura de câmera ----------------
   A órbita permite polar 0 — a câmera pode ir para cima do teto, e lá ela
   olharia o caminhão através de uma grelha de vigas. É o único defeito que esta
   forma tem, e a saída é a óbvia: acima da laje o teto se apaga.

   A FAIXA existe para não haver estalo. Ela termina abaixo de `H` e não em `H`
   porque o que incomoda não é atravessar a laje, é a viga entrar entre a lente e
   a cabine — e isso começa a acontecer alguns metros antes. */
/* ⚠️ A FAIXA SEGUE `H`, E ANTES ERA CRAVADA — o defeito que o comentário de
   `CEIL_RATIO` previu, uma constante acima: *"um número cravado aqui volta a
   divergir sem aviso"*. A altura da laje virou dinâmica (11…17 m) e estes dois
   números ficaram absolutos, em 10,6 e 13,2.

   O relato foi *"as lâmpadas do teto, as quadradas, às vezes somem quando
   movimento a câmera"*, e a conta explica o "às vezes": o próprio bloco de
   `CEIL_RATIO` registra que a pose de catálogo põe a câmera a **9,8 m** do chão
   — a 80 cm do início da faixa antiga. Orbitar um palmo para cima já começava a
   apagar o teto, com a laje ainda 3,4 m acima da lente.

   E divergia nas duas pontas: com a sala no mínimo (H = 11) o fim da faixa
   (13,2) ficava ACIMA da laje, então o teto nunca apagava por completo nem com a
   câmera acima dele; com a sala no máximo (H = 17) ele apagava inteiro a 3,8 m
   ABAIXO da laje.

   Agora são recuos A PARTIR da laje, que é o que a intenção autorada sempre
   disse — "termina abaixo de `H` porque a viga entra entre a lente e a cabine
   alguns metros antes". O que muda é o "alguns": 1,6 m em vez de 3,4, porque a
   3,4 m a viga ainda está muito acima da linha de visada e o que se perdia era
   só a softbox, que é a única coisa ACESA do teto — daí ela ser a que some
   primeiro aos olhos, mesmo o esmaecimento sendo uniforme (todos os cinco
   materiais estão em `materials`).

   POR QUE NÃO ZERO: a laje tem espessura e a viga pende abaixo dela, então
   apagar só ao cruzar `H` deixaria a câmera atravessar a grelha visível. Vinte
   centímetros de folga cobrem a viga sem antecipar o apagamento. */
const FADE_BELOW_LO = 1.6, FADE_BELOW_HI = 0.2;
const fadeLo = () => H - FADE_BELOW_LO;
const fadeHi = () => H - FADE_BELOW_HI;

/* ---------------- cinzas ----------------
   Todos R=G=B exatos, pela mesma razão que o ciclorama inteiro é: esta é a cena
   em que se julga uma tinta, e um teto com dominante contamina tanto o reflexo
   do piso quanto a sonda. A laje é o mais escuro do quadro de propósito — é o
   contraponto que faz o ciclorama claro ler como claro. */
const C_DECK = 0x191919;
const C_STEEL = 0x121212;
const C_HOUSING = 0x0d0d0d;

const group = new THREE.Group();
group.name = 'ts-teto';
group.visible = false;
scene.add(group);

const materials: THREE.Material[] = [];
let built = false;
/** O grupo dos 28×3 spots decorativos, guardado para o perfil de qualidade poder
 *  escondê-lo sem mexer no resto do teto. Ver `aplicarSpots()`. */
let spotsGroup: THREE.Group | null = null;
let deckMat: THREE.MeshStandardMaterial | null = null;
let steelMat: THREE.MeshStandardMaterial | null = null;
let bankMat: THREE.MeshStandardMaterial | null = null;
let lensMat: THREE.MeshStandardMaterial | null = null;
let housingMat: THREE.MeshStandardMaterial | null = null;

/* ---------------- a telha ----------------
   Trapezoidal, o perfil de `model_0`. Ela corre em UMA direção (aqui, ao longo
   de X), que é como uma telha de laje de verdade se apoia — e é também o que dá
   ao teto uma direção legível, em vez de uma malha isotrópica que o olho lê como
   textura.

   `DoubleSide` e não `FrontSide`: vista de baixo só a face de baixo importa, mas
   a esmaecida acima já resolve o caso de olhar por cima, e um perfil dobrado com
   enrolamento errado num dos flancos é um defeito bem mais caro de achar do que
   os 500 triângulos que a face de trás custa. */
function corrugatedDeck(halfX: number, halfZ: number, pitch: number, rib: number) {
  const pos: number[] = [];
  const nor: number[] = [];
  /* ⚠️ UV EM X, e ela existe por UM motivo só: carregar a MANCHA DAS BARRAS
     (`buildSpillTexture`). `u = 0` é `x = −halfX` e `u = 1` é `x = +halfX`, que é
     a mesma régua em que as calhas dos painéis são calculadas — ver
     `bankLanes()`. `v` acompanha z e hoje ninguém a lê; ela vai junto porque uma
     UV pela metade é a armadilha que a próxima textura aqui encontraria.
     Dois vértices por quad em x bastam: a UV é INTERPOLADA por fragmento, então
     a mancha tem a resolução da textura e não a da malha. */
  const uv: number[] = [];
  /* Proporções do perfil medido: vale largo, crista curta, rampas curtas. */
  const wValley = pitch * 0.42, wRamp = pitch * 0.14, wCrest = pitch * 0.30;
  const n = Math.ceil((halfZ * 2) / pitch);
  const z0 = -n * pitch * 0.5;
  const zSpan = n * pitch;

  const quad = (za: number, ya: number, zb: number, yb: number) => {
    /* Normal do segmento no plano (z,y), apontando para BAIXO. */
    const dz = zb - za, dy = yb - ya;
    const len = Math.hypot(dz, dy) || 1;
    const nx = 0, ny = -dz / len, nz = dy / len;
    const v = [
      [-halfX, ya, za], [halfX, ya, za], [halfX, yb, zb],
      [-halfX, ya, za], [halfX, yb, zb], [-halfX, yb, zb],
    ];
    for (const p of v) {
      pos.push(p[0], p[1], p[2]); nor.push(nx, ny, nz);
      uv.push((p[0] + halfX) / (2 * halfX), (p[2] - z0) / zSpan);
    }
  };

  for (let i = 0; i < n; i++) {
    let z = z0 + i * pitch;
    quad(z, 0, z + wValley, 0);              z += wValley;
    quad(z, 0, z + wRamp, rib);              z += wRamp;
    quad(z, rib, z + wCrest, rib);           z += wCrest;
    quad(z, rib, z + wRamp, 0);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

/** Uma caixa posicionada por centro e tamanho, já no referencial do grupo. */
function bar(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) {
  return new THREE.BoxGeometry(sx, sy, sz).translate(cx, cy, cz);
}

/**
 * Onde cada painel corre, em x. UM painel no MEIO de cada vão entre vigas —
 * nunca coincidente com a viga (onde ele ficaria escondido) e sempre no ritmo da
 * estrutura.
 *
 * Virou função porque agora tem DOIS leitores: `buildLights()`, que põe o
 * fixture, e `buildSpillTexture()`, que pinta a mancha dele na laje. Duas cópias
 * da mesma conta acabariam desalinhando a mancha do painel no dia em que alguém
 * mexesse no passo — e o sintoma seria uma sombra de luz ao lado da luz.
 */
function bankLanes(): number[] {
  const pitch = SRC.beamPitch * K;
  const lanes: number[] = [];
  for (let i = -Math.ceil(HALF / pitch); i <= Math.ceil(HALF / pitch); i++) {
    const x = (i + 0.5) * pitch;
    if (Math.abs(x) < HALF) lanes.push(x);
  }
  return lanes;
}

/* ---------------- A MANCHA DAS BARRAS NA LAJE ----------------
   ⚠️ NOVO EM 2026-08-16, e é a segunda metade de *"às vezes o branco das
   lâmpadas some"*. O bloco do difusor explica a primeira (o painel vira de
   perfil); esta é a outra: quando o painel encolhe, o que fica no alto do quadro
   é a LAJE, e ela estava em **4/255 — preto absoluto**. Um teto de estúdio que
   some e deixa um bloco preto no lugar não lê como "a luz sumiu de ângulo", lê
   como defeito.

   POR QUE ELA ESTAVA PRETA, e por que não se conserta com albedo: a laje é uma
   superfície que olha PARA BAIXO. A chave está a 46° ACIMA dela, então
   `N·L = 0` — ela não recebe direta nenhuma, e nenhum multiplicador de `color`
   muda isso, porque `0 · qualquer coisa` é 0. O que ela tem é hemi de baixo,
   ambiente e 14 % de ambiente por `envMapIntensity`. Daí os 4/255.

   O QUE ESTÁ FALTANDO É FÍSICO, e é a razão de ele entrar como EMISSIVO e não
   como luz: um banco de luz pendurado 34 cm abaixo da laje ILUMINA a laje. Numa
   foto de estúdio de verdade a telha ao redor de cada barra é a parte mais clara
   do teto; o resto continua escuro. Como `ceiling.ts` não cria luz nenhuma — ver
   o cabeçalho, e a razão continua valendo —, a mancha é PINTADA: um
   `emissiveMap` de uma linha só, alinhado às calhas por `bankLanes()`.

   ⚠️ É UMA TEXTURA DE 1 PIXEL DE ALTURA. A mancha só varia em x (as barras
   correm em z), então uma linha de 512 amostras descreve o teto inteiro; pedir
   um mapa 2D aqui seria 512x mais memória para guardar a mesma coluna repetida.

   ⚠️ O PERFIL NÃO É UM PICO NA CALHA, é um PLATÔ AO REDOR DELA. Bem embaixo da
   barra a laje está escondida PELA PRÓPRIA BARRA — pintar o máximo ali é pintar
   o que não se vê. O que aparece é a faixa logo ao lado, e é ela que recebe o
   máximo. */
const SPILL_RES = 512;
/** Meia-largura da mancha, em metros a partir do eixo da calha. */
const SPILL_REACH = 6.0;
/** Quanto da mancha some no vão coberto pela própria barra. */
const SPILL_CORE = 0.45;
/**
 * Ganho do emissivo da laje.
 *
 * MEDIDO, não escolhido. Com 0,055 a telha ao lado da barra saía em 51 de
 * luminância; 0,11 a põe em ~78, que é o alvo, e o alvo tem duas âncoras:
 *
 *   · ela tem de ficar ABAIXO DA PAREDE (85 a 120 conforme o fundo), senão a
 *     laje deixa de ser o contraponto escuro que faz o ciclorama ler como claro
 *     — ver o bloco dos cinzas;
 *   · e MUITO abaixo do painel (218), senão a barra deixa de ser a fonte.
 *
 * O vão entre duas barras continua em 3–8, que é o preto de antes: a mancha é
 * uma faixa, não uma clareada geral. É essa razão de 10x entre a telha ao lado
 * da barra e a telha do meio do vão que faz o teto ter DESENHO quando ele é
 * visto de perfil, que era o defeito.
 */
const DECK_SPILL = 0.11;

function buildSpillTexture(): THREE.DataTexture {
  const data = new Uint8Array(SPILL_RES * 4);
  const lanes = bankLanes();
  const bankW = SRC.boxSize * K * 0.62;
  for (let i = 0; i < SPILL_RES; i++) {
    /* Centro do texel de volta para x de mundo — a mesma régua da UV da telha. */
    const x = ((i + 0.5) / SPILL_RES) * 2 * HALF - HALF;
    let v = 0;
    for (const lane of lanes) {
      const d = Math.abs(x - lane);
      if (d >= SPILL_REACH) continue;
      /* Cosseno levantado: 1 na borda da barra, 0 no alcance. */
      const t = Math.min(1, Math.max(0, (d - bankW * 0.5) / (SPILL_REACH - bankW * 0.5)));
      const fora = 0.5 + 0.5 * Math.cos(Math.PI * t);
      /* E o furo do meio, onde a própria barra tapa a laje. */
      const dentro = d < bankW * 0.5 ? SPILL_CORE : 1;
      v = Math.max(v, fora * dentro);
    }
    const b = Math.round(255 * v);
    data[i * 4] = b; data[i * 4 + 1] = b; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, SPILL_RES, 1, THREE.RGBAFormat);
  /* `ClampToEdge` porque a UV cobre exatamente [−HALF, +HALF] e não repete; sem
     isto a borda da telha amostraria a calha do outro lado da sala. */
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  /* ⚠️ `SRGBColorSpace`: um `emissiveMap` é COR e o three o converte para linear
     no shader. Deixá-lo em `NoColorSpace` faria a mancha nascer com o dobro do
     contraste que a curva do canvas descreve. */
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/* ---------------- a grelha ----------------
   Duas ordens, como numa laje de verdade e como no modelo: as VIGAS no passo
   grande (`beamPitch · K`) numa direção, e as TERÇAS — mais rasas e mais juntas
   — na outra. É essa hierarquia que faz a grelha ler como estrutura; um xadrez
   de barras iguais lê como grade. */
/** Altura da face inferior da estrutura, no referencial do grupo (laje = 0). */
function purlinBottom(): number {
  const depth = SRC.beamDepth * K;
  return -0.02 - depth - depth * 0.34;
}

function buildGrid(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const pitch = SRC.beamPitch * K;
  const depth = SRC.beamDepth * K;
  const width = SRC.beamWidth * K;
  const top = -0.02;                 // encostadas na face inferior da laje
  const beamY = top - depth / 2;

  const nBeam = Math.floor(HALF / pitch);
  for (let i = -nBeam; i <= nBeam; i++) {
    parts.push(bar(i * pitch, beamY, 0, width, depth, HALF * 2));
    /* A mesa inferior, mais larga que a alma: é ela que se vê de baixo, e sem
       ela a viga some contra a laje escura em vez de desenhar uma linha. */
    parts.push(bar(i * pitch, beamY - depth / 2 + width * 0.25, 0,
      width * 2.4, width * 0.5, HALF * 2));
  }

  /* Terças: um terço do passo, um terço da altura, cruzando as vigas por baixo. */
  const pPitch = pitch / 3;
  const pDepth = depth * 0.34;
  const nPurlin = Math.floor(HALF / pPitch);
  const purlinY = beamY - depth / 2 - pDepth / 2;
  for (let i = -nPurlin; i <= nPurlin; i++) {
    parts.push(bar(0, purlinY, i * pPitch, HALF * 2, pDepth, width * 1.2));
  }
  return mergeGeometries(parts, false)!;
}

/* ---------------- as luminárias ----------------
   DUAS FAMÍLIAS, porque a referência tem duas e elas fazem trabalhos diferentes:

   · o PAINEL — a barra acesa e comprida, encaixada entre as vigas. É a fonte
     macia, é o que aparece esticado no piso polido e é o que a sonda entrega
     como realce alongado na lataria. Ele é a softbox 2 × 2 do modelo
     (`model_14..21`) relida como barra: a mesma área de difusor, no formato que
     um veículo de 19 m pede.
   · os SPOTS — os corpos pretos pendurados em hastes curtas. Eles não iluminam
     nada; existem para dar ESCALA e ritmo ao teto. Um teto só com laje e viga
     não tem nenhum objeto de tamanho conhecido, e sem isso ele pode ser um teto
     a 14 m ou a 40 m.

   OS PAINÉIS COBREM O TETO INTEIRO, e não só o centro. A primeira versão punha
   dois deles sobre o veículo e eles NUNCA apareciam: com a laje a 14 m e a
   câmera a 7 m numa lente de 30°, o alto do quadro corta em ~6° acima do
   horizonte, e um painel a 8 m do centro está a 15°. O que entra no quadro é
   sempre o teto DISTANTE — e por isso a fileira de painéis tem de atravessar o
   vão inteiro, um por vão entre vigas, como num estúdio de verdade. */
function buildLights(): { banks: THREE.Mesh; frames: THREE.Mesh; spots: THREE.Group } {
  const pitch = SRC.beamPitch * K;
  const bankLen = HALF * 1.7;
  const bankW = SRC.boxSize * K * 0.62;
  /* ABAIXO DAS TERÇAS, e este é o número que estava errado na primeira versão.
     Ele valia `-beamDepth·K - 0,10`, que põe o painel ENTRE a viga e a terça —
     e a terça, que cruza na outra direção a cada 5,4 m, picotava cada painel em
     retângulos. O teto lia como forro de escritório iluminado, e não como uma
     fileira de softboxes. Pendurado abaixo de toda a estrutura, cada painel volta
     a ser uma barra contínua, que é o que a referência mostra. */
  const bankY = purlinBottom() - 0.34;

  const lanes = bankLanes();

  /* ---------------- O DIFUSOR PENDE DA MOLDURA ----------------
     ⚠️ ELE ERA UMA LÂMINA DE 6 cm CENTRADA NA FACE DE BAIXO DA MOLDURA, e essa
     era a causa do relato **"algumas vezes quando mexo a câmera as iluminações
     não saem das lâmpadas/painéis, meio que apenas existem"**. Reproduzido na
     bancada e nas duas capturas que vieram com o pedido, e a explicação é
     puramente geométrica:

       · a moldura vai de `bankY` a `bankY + 0,40` e é 34 cm MAIS LARGA que o
         difusor, então ela o esconde por cima e pelos lados;
       · o difusor ia de `bankY − 0,03` a `bankY + 0,03`, ou seja sobrava
         **3 cm** dela para baixo.

     Com a câmera baixa — a pose de foto de veículo, e as duas do relato — o
     teto é visto RASANTE: o que entra no quadro é o flanco do painel, e 3 cm de
     flanco a 30 m subtendem 0,06°. O emissivo simplesmente não tinha área. Daí
     o painel ACENDER quando a câmera sobe (aí se vê a face de baixo) e APAGAR
     quando ela desce, sem que luz nenhuma tenha mudado — que é exatamente o
     "às vezes, quando mexo a câmera".

     A correção é a forma que uma softbox de verdade tem: o difusor é um bloco
     que PENDE da moldura. Ele passa a ter flanco emissivo em toda a volta, então
     lê como aceso de qualquer ângulo de onde a moldura não o tampe — e de cima
     do teto quem manda continua sendo a esmaecida, que apaga o grupo inteiro.

     Ele continua sendo NARROWER que a moldura (bankW contra bankW + 0,34), que
     é o que mantém a borda escura do bloco original.

     ⚠️ **26 cm → 50 cm EM 2026-08-16**, e a segunda rodada tem número.
     -----------------------------------------------------------------------
     O relato voltou: *"às vezes ainda acontece do branco das lâmpadas
     sumirem"*, com o fundo em Branco e a câmera alta. Reproduzido na bancada
     (`checks-teto-altura-0816.mjs`) e medido no pixel da captura: a faixa branca
     tinha **5 px** de espessura, contra os ~60 px que ela tem de câmera baixa.

     A conta que fecha isso, e ela é de projeção e não de material. Um painel é
     um bloco horizontal visto de baixo a uma elevação θ; o que ele entrega ao
     quadro é

         face de baixo · sen θ   +   flanco · cos θ

     A face de baixo tem 3,35 m e o flanco tinha 0,26 m, então elas se EMPATAM em
     `tan θ = 0,26 / 3,35`, ou seja **θ = 4,4°**. Abaixo disso quem sustenta o
     painel é só o flanco. E θ desaba quando a câmera sobe: com a câmera a 10,7 m
     o painel está 1,6 m acima dela, e a 30 m de distância isso é θ = 3°. Não há
     nada de errado com o emissivo — o painel virou de perfil.

     ⚠️ NÃO EXISTE CONSERTO QUE FAÇA UMA FACE HORIZONTAL SOBREVIVER A θ → 0. O
     que existe é dar ao fixture ALTURA, que é o termo que sobra: 0,50 m de
     flanco entregam 1,9x o que 0,26 entregavam, e a mesma face de baixo. Um
     difusor de meio metro pendurado sob uma moldura de 40 cm é a proporção de um
     banco de luz de estúdio de verdade a 14 m de pé-direito — não é um aumento
     "para caber no teste".

     A OUTRA METADE do mesmo relato é a LAJE, que a θ → 0 fica preta (medido:
     4/255, com o painel em 200). Ela é tratada em `buildSpillTexture()`. */
  const bankT = 0.50;
  const faces: THREE.BufferGeometry[] = [];
  const frames: THREE.BufferGeometry[] = [];
  for (const x of lanes) {
    faces.push(bar(x, bankY - bankT / 2 + 0.03, 0, bankW, bankT, bankLen));
    /* A moldura é o que impede o painel de ler como retângulo branco colado no
       teto: ela lhe dá espessura e uma borda escura. */
    frames.push(bar(x, bankY + 0.20, 0, bankW + 0.34, 0.40, bankLen + 0.34));
  }

  const banks = new THREE.Mesh(mergeGeometries(faces, false)!, bankMat!);
  banks.name = 'teto-painel';
  const frame = new THREE.Mesh(mergeGeometries(frames, false)!, steelMat!);
  frame.name = 'teto-painel-moldura';

  /* Os spots. Corpo + haste num `InstancedMesh` cada, para o teto inteiro
     continuar cabendo numa mão cheia de chamadas de desenho. */
  const spots = new THREE.Group();
  spots.name = 'teto-spots';
  const rows: THREE.Vector3[] = [];
  const step = pitch / 2;
  const nz = Math.floor(bankLen / (2 * step));
  for (const x of lanes) {
    for (let i = -nz; i <= nz; i++) {
      rows.push(new THREE.Vector3(x + bankW * 1.3, bankY - 1.35, i * step));
    }
  }
  const bodyGeo = new THREE.CylinderGeometry(0.30, 0.44, 0.72, 14, 1, true);
  /* ---------------- A LENTE SAI DA BOCA DA CÚPULA ----------------
     ⚠️ MESMO DEFEITO DO DIFUSOR, e a mesma causa. Ela era um disco de raio 0,30
     e 6 cm de altura assentado no PLANO da boca (`p.y − 0,36`) — e a boca da
     cúpula tem raio 0,44. Ou seja o vidro ficava 14 cm RECUADO para dentro do
     abajur, e horizontal: de qualquer câmera que não estivesse quase embaixo
     dele, a aba da cúpula o tampava e a luminária lia como um cone preto morto.
     Nas capturas do relato são 28 cones pretos pendurados sem nenhum sinal de
     estarem acesos — o **"as lâmpadas meio que apenas existem"**.

     Agora ela é uma lente TRONCADA que sai 16 cm por baixo da boca: 0,42 de
     raio encostando na aba (que tem 0,44 — 2 cm de folga para não haver
     z-fighting com a parede da cúpula) e 0,30 na ponta. Ela tem flanco, então
     acende em silhueta; e como ela sobra da aba, nenhuma câmera abaixo do plano
     da boca a perde. Continua sem luz nenhuma do three — ver o cabeçalho. */
  const capGeo = new THREE.CylinderGeometry(0.42, 0.30, 0.17, 14);
  const rodGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6);
  const body = new THREE.InstancedMesh(bodyGeo, housingMat!, rows.length);
  const cap = new THREE.InstancedMesh(capGeo, lensMat!, rows.length);
  const rod = new THREE.InstancedMesh(rodGeo, steelMat!, rows.length);
  const m = new THREE.Matrix4();
  rows.forEach((p, i) => {
    body.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z));
    /* O topo da lente (meia-altura acima do centro) fica em `p.y − 0,355`, ou
       seja 5 mm dentro da boca da cúpula, que está em `p.y − 0,36`. */
    cap.setMatrixAt(i, m.makeTranslation(p.x, p.y - 0.44, p.z));
    rod.setMatrixAt(i, m.makeTranslation(p.x, p.y + 1.01, p.z));
  });
  for (const im of [body, cap, rod]) {
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = false;
    im.receiveShadow = false;
    spots.add(im);
  }
  return { banks, frames: frame, spots };
}

function makeMaterials() {
  if (deckMat) return;
  deckMat = new THREE.MeshStandardMaterial({
    color: C_DECK, roughness: 0.88, metalness: 0.15, side: THREE.DoubleSide,
    /* A MANCHA DAS BARRAS — ver `buildSpillTexture()`. `emissive` branco aqui
       porque `applyCeilingRig()` o troca pelo matiz da chave logo em seguida; o
       mapa é ligado em `build()`, que é quem conhece as medidas da sala. */
    emissive: 0xffffff, emissiveIntensity: DECK_SPILL,
    /* Baixo pelo mesmo motivo da casca do ciclorama: este é um objeto grande, e
       devolver o ambiente inteiro nele transformaria a laje escura num verniz
       cinza — que é o oposto do que ela está aqui para fazer. */
    envMapIntensity: 0.14,
  });
  deckMat.name = 'TETO_LAJE';
  steelMat = new THREE.MeshStandardMaterial({
    color: C_STEEL, roughness: 0.55, metalness: 0.45, envMapIntensity: 0.30,
  });
  steelMat.name = 'TETO_ESTRUTURA';
  housingMat = new THREE.MeshStandardMaterial({
    color: C_HOUSING, roughness: 0.42, metalness: 0.30, side: THREE.DoubleSide,
  });
  housingMat.name = 'TETO_SPOT';
  /* ACESOS SEM SEREM LUZ. `color` preto e `emissive` branco: o painel não
     participa da iluminação (não é uma luz) e também não é ILUMINADO — ele
     entrega o mesmo valor de qualquer ângulo, que é o que um difusor aceso faz.
     Deixá-lo com albedo branco faria a chave bater nele e o painel mudaria de
     brilho conforme a hora, o que é exatamente o que uma lâmpada não faz. */
  bankMat = new THREE.MeshStandardMaterial({
    /* 0,8 e não 1,0. O painel é a coisa mais clara da cena e o piso polido o
       devolve em faixas de trinta metros; a 1,0 essas faixas ficavam mais claras
       que a lataria branca, e o chão passava a competir com o sujeito. */
    color: 0x000000, emissive: 0xffffff, emissiveIntensity: 0.8,
    roughness: 1, metalness: 0,
  });
  bankMat.name = 'TETO_PAINEL';
  lensMat = new THREE.MeshStandardMaterial({
    color: 0x000000, emissive: 0xffffff, emissiveIntensity: 0.55,
    roughness: 1, metalness: 0,
  });
  lensMat.name = 'TETO_LENTE';
  materials.push(deckMat, steelMat, housingMat, bankMat, lensMat);
}

function build() {
  if (built) return;
  makeMaterials();

  /* A MANCHA DAS BARRAS. Ela depende de `HALF` e de `K`, então nasce aqui e não
     em `makeMaterials()` — e é REFEITA a cada `rebuild()`, porque uma troca de
     medidas move as calhas.
     ⚠️ A textura ANTIGA é descartada antes: `rebuild()` mantém os materiais
     vivos, e sem isto cada mudança de sala vazaria uma textura na GPU. */
  deckMat!.emissiveMap?.dispose();
  deckMat!.emissiveMap = buildSpillTexture();
  /* A primeira atribuição é `null` → textura, e isso É uma troca de programa —
     por isso ela acontece antes de `aquecerEsmaecida()`, que compila as duas
     configurações de `transparent` já com o mapa no lugar. */
  deckMat!.needsUpdate = true;

  const deck = new THREE.Mesh(
    corrugatedDeck(HALF, HALF, SRC.deckPitch * K, SRC.deckRib * K), deckMat!,
  );
  deck.name = 'teto-laje';
  const grid = new THREE.Mesh(buildGrid(), steelMat!);
  grid.name = 'teto-grelha';
  const { banks, frames, spots } = buildLights();

  for (const o of [deck, grid, banks, frames]) {
    o.castShadow = false;
    o.receiveShadow = false;
    group.add(o);
  }
  group.add(spots);
  spotsGroup = spots;
  aplicarSpots();
  group.position.y = H;
  built = true;
  aquecerEsmaecida();
}

/* ===========================================================================
   AS DUAS CONFIGURAÇÕES DE `transparent`, PRÉ-COMPILADAS NA MONTAGEM
   ===========================================================================
   ⚠️ ESTE É O CONSERTO DO ENGASGO QUE O BLOCO DE `applyFade()` DESCREVIA E NÃO
   CONSERTAVA. Reproduzido dali, porque é a causa e ela não se parece com o
   sintoma: entre 10,6 e 13,2 m de altura de câmera, `m.transparent` muda de
   valor e leva `m.needsUpdate = true` junto. **`transparent` é chave de programa
   no three** — ele entra em `parameters.opaque` e acende o bit 17 de
   `getProgramCacheKeyBooleans()`, o que muda o `#define OPAQUE` e portanto o
   binário. São 5 materiais (laje, estrutura, spot, painel, lente), logo **5
   compilações de programa no meio de um arrasto de órbita**. O sintoma é a
   câmera travar meio segundo ao subir acima do teto; a causa é uma faixa de
   esmaecida.

   POR QUE PRÉ-COMPILAR E NÃO DEIXAR `transparent: true` SEMPRE. O bloco de
   `applyFade()` já responde e continua valendo: um material transparente sai do
   passe opaco e entra no ordenado por profundidade, e deixar a laje inteira
   nesse passe pagaria ordenação e perda de descarte de profundidade em 100 % dos
   quadros por um efeito que roda em quase nenhum. A troca certa é pagar o
   compilador UMA vez, na montagem, debaixo da cortina que a troca de cenário já
   tem.

   ⚠️ E É UMA VEZ SÓ POR SESSÃO DE MATERIAL, NÃO UMA VEZ POR CRUZAMENTO — o que
   também explica por que o defeito era difícil de flagrar. `materialProperties
   .programs` é um `Map` por MATERIAL chaveado pelo cache key (three r179,
   WebGLRenderer:2067), e ele só é esvaziado no `dispose` do material. Ou seja o
   segundo cruzamento da faixa já acertava o cache e não compilava nada. O
   engasgo era real, era visível, e acontecia exatamente uma vez: na PRIMEIRA vez
   que o usuário levanta a câmera — que é também a primeira vez que ele julga se
   a movimentação é fluida.

   ⚠️ SÍNCRONO, E ISSO É REQUISITO E NÃO PREGUIÇA. `renderer.compile()` não
   cede o controle, então a inversão e a restauração dos 5 materiais vivem na
   MESMA tarefa e nenhum quadro pode ser apresentado entre elas — é a garantia
   que `warmLightPrograms()` (scene.ts) cita para explicar por que ela, sendo
   `compileAsync`, precisa de `drawSuspended`. Aqui não precisa.

   ⚠️ `compile(group, camera, scene)` E NÃO `compile(scene, camera)`. A assinatura
   é `compile(scene, camera, targetScene)`: o PRIMEIRO argumento é o que se
   percorre para inicializar material (e é `traverse`, não `traverseVisible` —
   funciona com o grupo ainda apagado, que é o estado dele aqui, porque
   `setStudioCeiling()` só acende depois de `build()` voltar); o TERCEIRO é de
   onde vêm as luzes e o estado de cena. Passar a cena inteira compilaria o
   veículo e o cenário de novo por nada. */
let aquecida = false;

function aquecerEsmaecida() {
  if (aquecida || !materials.length) return;
  aquecida = true;
  const antes = materials.map((m) => m.transparent);
  try {
    for (const m of materials) { m.transparent = !m.transparent; m.needsUpdate = true; }
    renderer.compile(group, camera, scene);
  } catch (err) {
    /* Aquecer é otimização; nunca pode ser o motivo de o teto não subir. */
    console.warn('[truck-studio] pré-compilação da esmaecida do teto falhou'
      + ' — a primeira subida da câmera acima de 10,6 m pode engasgar.', err);
  } finally {
    /* Restaurado no `finally` pelo mesmo motivo do `try/finally` da passada de
       reflexo: uma exceção no meio deixaria os 5 materiais no estado INVERTIDO,
       e o sintoma seria uma laje translúcida permanente. */
    materials.forEach((m, i) => {
      if (m.transparent !== antes[i]) { m.transparent = antes[i]; m.needsUpdate = true; }
    });
  }
  /* E a configuração que de fato vai ser desenhada agora, para o primeiro quadro
     depois da cortina também não ser uma compilação. Mesma sequência, e mesma
     ordem, de `warmLightPrograms()`. */
  try { renderer.compile(group, camera, scene); } catch { /* ver acima */ }
}

/* ---------------- OS SPOTS SÃO O PRIMEIRO A SAIR ----------------
   `ceilingSpots` (Alta/Média sim, Baixa não) esconde o grupo dos spots.

   POR QUE JUSTO ELES, e por que isto não fere a regra de "só amostragem". O
   próprio bloco das luminárias acima os declara DECORATIVOS: *"Eles não iluminam
   nada; existem para dar ESCALA e ritmo ao teto"*. Nenhuma luz do three nasce
   aqui, nada aqui projeta sombra, e os PAINÉIS — que são a fonte que aparece no
   quadro, no reflexo do piso e na sonda — CONTINUAM ligados. Ou seja: a foto
   sai com a mesma luz, o mesmo enquadramento e a mesma softbox; o teto perde os
   corpos pretos pendurados, e com eles a referência de escala que diz se a laje
   está a 14 m ou a 40 m. É uma perda de LEITURA, não de iluminação.

   O QUE SE GANHA: 3 `InstancedMesh` de 28 instâncias cada — corpo (cilindro
   aberto de 14 lados), tampa e haste — somem do passe opaco E da segunda
   varredura de geometria do reflexo do piso, que é o gargalo medido em
   `floor-reflection.ts` (14,1 fps a meio lado contra 14,7 a um quarto: o custo
   é GEOMETRIA, não preenchimento). Contagem exata de triângulos NÃO VERIFICADA.

   ⚠️ É FUNÇÃO e não constante, pela razão de sempre neste engine: o nível muda
   no meio da sessão e uma leitura congelada na montagem deixaria os spots no
   estado do nível em que a página abriu.

   ⚠️ E ELA TEM DE VIR DEPOIS DE `applyFade()`, que escreve `visible` em TODO
   filho do grupo — daí `applyFade` chamá-la no fim em vez de o contrário. */
function aplicarSpots() {
  if (!spotsGroup) return;
  /* `faded < 0` = a esmaecida ainda não foi medida nesta acendida (ver `faded`),
     e aí quem decide é só o perfil. */
  const fadeOn = faded < 0 || faded > 0.004;
  spotsGroup.visible = getProfile().ceilingSpots && fadeOn;
}

onQualityChange(() => {
  if (!group.visible || !built) return;
  aplicarSpots();
  invalidate();
});

/** Refaz a geometria com as medidas correntes. Uma vez por mudança de sala. */
function rebuild() {
  if (!built) return;
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
  }
  built = false;
  build();
}

let lastHalf = NaN, lastH = NaN;

/**
 * Redimensiona e recentra o teto a partir das medidas da sala.
 * Chamado por `cyclorama.ts`, que é quem sabe onde a sala está.
 */
export function sizeStudioCeiling(m: {
  floorR: number; ceilY: number; centerX: number; centerZ: number;
}) {
  if (!group.visible) return;
  const h = THREE.MathUtils.clamp(m.ceilY * CEIL_RATIO, CEIL_MIN, CEIL_MAX);
  const half = THREE.MathUtils.clamp(m.floorR * EXTENT_RATIO, EXTENT_MIN, EXTENT_MAX);
  const moved = group.position.x !== m.centerX || group.position.z !== m.centerZ;
  /* Um metro de folga antes de refazer: `sizeRoom()` arredonda a parede de 5 em
     5 m, então esta comparação só dispara numa troca de medidas de verdade e
     nunca por quadro. */
  const resized = !(Math.abs(half - lastHalf) < 1 && Math.abs(h - lastH) < 0.5);
  if (!moved && !resized && built) return;
  if (resized) {
    HALF = half; H = h; K = H / SRC.ceil;
    lastHalf = half; lastH = h;
    if (built) rebuild(); else build();
  }
  group.position.set(m.centerX, H, m.centerZ);
  group.updateMatrixWorld(true);
  invalidate();
}

/* ---------------- a esmaecida ----------------
   `transparent` só é LIGADO durante a faixa. Um material transparente sai do
   passo opaco e entra no ordenado por profundidade, e deixar a laje inteira
   nesse passo o tempo todo pagaria ordenação e perda de descarte de
   profundidade em 100 % dos quadros por um efeito que roda em quase nenhum.

   ⚠️ O ENGASGO DA TRAVESSIA DA FAIXA — as 5 recompilações de programa ao cruzar
   10,6–13,2 m — FOI CONSERTADO EM 2026-08-16, e o conserto é o que a auditoria
   de 2026-08-14 tinha mandado fazer: pré-compilar as duas configurações no
   aquecimento, do mesmo jeito que `warmLightPrograms()` faz para o pool de
   refletores. Ver `aquecerEsmaecida()`, logo acima, que também explica por que
   NÃO se resolve deixando `transparent: true` sempre.

   ⚠️ O QUE CONTINUA VALENDO da mesma auditoria, e é de outro dono: `applyFade`
   roda em `onFrame`, ou seja **inclusive em quadro PULADO** — o gancho corre
   mesmo quando o laço sob demanda decide não desenhar. Nos dois cenários sem
   ciclorama ele sai na primeira linha (`!group.visible`), que é o caso em 2 dos
   3 cenários do acervo; no Estúdio ele custa um `smoothstep` e uma comparação.
   É barato e fica.

   E é por causa do custo de programa que o perfil de qualidade não tem nenhum
   botão que ligue/desligue este caminho: um botão que recompilasse 5 programas
   sozinho, no meio de um arrasto, seria exatamente o defeito que a adaptação
   automática existe para evitar. */
let faded = -1;

function applyFade() {
  if (!group.visible || !built) return;
  /* Altura ABSOLUTA da câmera: o piso do mundo é y=0 e a sala segue o rig só em
     x/z, então a faixa não precisa ser relativa ao grupo. */
  const k = 1 - THREE.MathUtils.smoothstep(camera.position.y, fadeLo(), fadeHi());
  if (Math.abs(k - faded) < 0.01) return;
  faded = k;
  const on = k > 0.004;
  for (const m of materials) {
    const t = k < 0.999;
    if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; }
    m.opacity = k;
    m.depthWrite = !t;
  }
  for (const child of group.children) child.visible = on;
  /* DEPOIS do laço, que acabou de escrever `visible` em todo filho: os spots têm
     um segundo dono (o perfil de qualidade) e precisam da última palavra. */
  aplicarSpots();
  invalidate();
}

onFrame(applyFade);

/* ---------------- O TETO SEGUE O RIG ----------------
   ESTE GANCHO NÃO EXISTIA, e a consequência era visível em duas frentes.

   1. OS PAINÉIS SÃO A FONTE DE LUZ QUE APARECE NO QUADRO, e ficavam BRANCOS em
      qualquer temperatura. O controle de Kelvin tingia a chave, o hemi e o
      ambiente — ou seja tudo que ILUMINA — e deixava a única coisa que se vê
      ACESA em 6500 K. Um estúdio a 2800 K com as luminárias brancas é a
      denúncia mais direta que a cena tinha: a luz é quente e a lâmpada não.
      E o piso polido devolve essas barras em faixas de trinta metros, então o
      erro aparecia duas vezes no mesmo quadro.
   2. A LAJE NÃO SABIA QUAL É O FUNDO. Num ciclorama branco a sala inteira
      devolve luz para o teto e ele nunca fica tão escuro quanto num preto; com
      a laje cravada em 0x191919, `Branco` produzia uma parede clara sob um teto
      de porão.

   TUDO AQUI É MULTIPLICADOR SOBRE O AUTORADO, e em `cycloramaAlbedo` = 1 com
   `keyColor` neutro os fatores valem 1,000 por construção — o teto de hoje não
   muda um pixel para quem não tocar em nada. */
const _ceilTint = new THREE.Color();

/** Só o MATIZ de uma cor de luz: o valor continua sendo o do material. */
function hueOf(col: THREE.Color): THREE.Color {
  _ceilTint.copy(col);
  const m = Math.max(_ceilTint.r, _ceilTint.g, _ceilTint.b) || 1;
  return _ceilTint.multiplyScalar(1 / m);
}

let lastTintHex = -1;
let lastAlbedo = NaN;

function applyCeilingRig(rig: { keyColor: THREE.Color; cycloramaAlbedo: number } | null) {
  if (!rig || !group.visible || !bankMat) return;
  const tint = hueOf(rig.keyColor);
  const hex = tint.getHex();
  /* A laje clareia com o fundo, mas MUITO menos que ele: ela é o contraponto
     escuro que faz o ciclorama claro ler como claro (ver o bloco dos cinzas), e
     acompanhar o fundo um por um a apagaria. Raiz quadrada, e teto em 2x. */
  const albedo = Math.max(0, rig.cycloramaAlbedo);
  const lift = Math.min(2, Math.sqrt(Math.max(0.04, albedo)));
  if (hex === lastTintHex && Math.abs(lift - lastAlbedo) < 0.02) return;
  lastTintHex = hex; lastAlbedo = lift;

  bankMat.emissive.copy(tint);
  if (lensMat) lensMat.emissive.copy(tint);
  /* As superfícies passivas ganham o matiz no ALBEDO — elas são pintadas de
     cinza e o que as tinge é a luz que as banha, que é a mesma dos painéis. */
  if (deckMat) {
    deckMat.color.setHex(C_DECK).multiply(tint).multiplyScalar(lift);
    /* E a MANCHA das barras acompanha a cor da própria barra, não o albedo da
       laje: ela é a luz do painel batendo na telha, então ela é do painel.
       Sem esta linha um estúdio a 2800 K teria as barras âmbar e a mancha delas
       branca — o mesmo defeito que este gancho existe para consertar, uma camada
       abaixo. Ela NÃO leva o `lift`: quem clareia com o fundo é a telha. */
    deckMat.emissive.copy(tint);
  }
  if (steelMat) steelMat.color.setHex(C_STEEL).multiply(tint).multiplyScalar(lift);
  if (housingMat) housingMat.color.setHex(C_HOUSING).multiply(tint);
  invalidate();
}

onRig(applyCeilingRig);

/**
 * Liga ou desliga o teto do estúdio.
 * Quem chama é `cyclorama.ts`: o teto é parte da mesma sala e não faz sentido
 * sozinho — sem a casca clara atrás dele, uma laje escura no alto não lê como
 * teto, lê como recorte.
 */
export function setStudioCeiling(on: boolean) {
  if (on) build();
  group.visible = on;
  if (on) {
    faded = -1;
    applyFade();
    /* O TINGIMENTO É REAPLICADO AO ACENDER, e o memo é zerado antes.
       `makeMaterials()` devolve o teto às cores de fábrica sempre que
       `disposeStudioCeiling()` passou por aqui, e `applyCeilingRig` sai cedo
       enquanto o grupo está escondido — que é o estado em cinco dos seis
       cenários. Sem esta chamada, acender o teto o deixaria em 6500 K neutro
       até o próximo evento de rig, e "o próximo evento de rig" pode não vir. */
    lastTintHex = -1; lastAlbedo = NaN;
    applyCeilingRig(getRig());
  }
  invalidate();
}

/** @returns {boolean} */
export const isStudioCeilingOn = () => group.visible;

/** Altura da face inferior da laje, em metros. Lida por quem enquadra. */
export const studioCeilingHeight = () => H;

/** Libera geometria e material. Chamado quando o estúdio solta a cena. */
export function disposeStudioCeiling() {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.geometry.dispose();
    });
  }
  /* A MANCHA DAS BARRAS é textura NOSSA e `Material.dispose()` não solta mapa —
     ele só emite o evento que libera o programa. Sem esta linha, sair e voltar
     ao Estúdio deixaria uma `DataTexture` por visita na GPU. */
  deckMat?.emissiveMap?.dispose();
  for (const m of materials) m.dispose();
  materials.length = 0;
  /* ⚠️ Os programas pré-compilados morrem COM os materiais: `onMaterialDispose`
     chama `releaseMaterialProgramReferences()`, que zera o `Map` por material.
     Deixar a bandeira em `true` faria a próxima visita ao Estúdio voltar a ter o
     engasgo, agora sem ninguém para pré-compilar. */
  aquecida = false;
  deckMat = steelMat = bankMat = lensMat = housingMat = null;
  /* O grupo dos spots acabou de sair de `group.children` e teve a geometria
     descartada no laço acima; segurar a referência faria `aplicarSpots()`
     escrever num objeto morto. */
  spotsGroup = null;
  built = false;
  group.visible = false;
  invalidate();
}
