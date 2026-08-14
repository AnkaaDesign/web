/* O PAINEL DO EDITOR SAI DO PRÓPRIO MODELO — snapshot ortográfico em runtime.
   ===========================================================================
   POR QUE ISTO EXISTE (2026-08-11, pedido do dono do produto)

   Três gerações de representação do painel falharam pelo mesmo motivo: eram
   RECONSTRUÇÕES. A foto estática não redimensionava; os SVGs eram feios e
   errados; os renders por peça — mesmo medidos do bake — exigiam que uma
   tabela de comportamentos (estica/ladrilha/ancora) reproduzisse o que o 3D
   faz, e cada regra esquecida virava defeito na tela: fita sem fase, montante
   cortando dobradiça, traseira desmontada no resize.

   A saída é não reconstruir: FOTOGRAFAR o implemento que está NA CENA, com a
   geometria corrente (altura, comprimento, portas, emendas de chapa, rebites),
   numa ortográfica exata, a cada rebuild. O que o cliente vê no editor é o
   próprio baú — fidelidade por construção, sem tabela nenhuma para manter.

   DOIS PASSES, e a fronteira é OBJETO, não profundidade:

     · FUNDO   — tudo visível. É a CHAPA como ela é, e ele vai ATRÁS da arte no
                 palco (`.ts-pw-behind` em core/studio.css). O quadro fecha no
                 frame metálico: nada de chassi, rodagem ou para-choque.
     · FRENTE  — a MESMA câmera com a chapa recortada em depth-only
                 (`colorWrite: false`): sobra só o que está NA FRENTE da
                 superfície da arte — trilhos, fita, montantes, varões,
                 dobradiças, rebites — desenhado POR CIMA do desenho do
                 cliente. É a mesma fronteira do 3D, onde a arte é uma
                 sobreposição coplanar à chapa: o que a cobre lá, cobre aqui.

   Com os dois nessa ordem, CADA PIXEL DO PALCO TEM UMA FONTE SÓ: a chapa vem
   do fundo, a arte vem do fabric, a ferragem vem da frente. Foi a falta disso
   que produziu o relato "parece que tem uns 3 modelos remontados" — o fundo
   ficava por cima com um buraco retangular e repintava a mesma ferragem que o
   plano da frente já desenhava, em escala diferente.

   E O PASSE DA FRENTE MEDE, além de desenhar: o alfa dele é exatamente "aqui a
   arte some atrás de metal", e é dele que sai a ÁREA PINTÁVEL — ver
   `measurePaintRect()`. A silhueta tracejada do editor deixou de ser um palpite
   sobre caixas de malha e passou a ser uma leitura da própria foto.

   A ARTE É ESCONDIDA durante os dois passes: o snapshot alimenta o palco onde
   a arte é desenhada VIVA pelo fabric — fotografá-la junto a duplicaria.

   A LUZ É PRÓPRIA E FIXA, e o quadro é o do FRAME PARA DENTRO. Os dois blocos
   abaixo explicam; os dois vieram de pedido explícito depois de olhar a tela.

   A CÂMERA NASCE DA BASE DO PRÓPRIO PAINEL (`makeBasis(u, up, u×up)`), não de
   eixos de mundo: o conjunto anda e GIRA quando é engatado, e a bancada já
   provou que sonda em coordenada de mundo mede o interior do baú achando que
   mede a pele. `u×up` é, nas três faces, exatamente o "para fora". */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export type SnapshotKey = 'left' | 'right' | 'rear' | 'front';

/**
 * A área LIVRE da chapa — do frame metálico para dentro — em frações da
 * própria chapa, com `v` contado do TOPO.
 *
 * É o MESMO sistema de coordenadas da tela do fabric (ver `addLiveryUV`: `uv1`
 * normaliza a caixa da chapa e `v = 0` é o teto), então este retângulo pode ser
 * multiplicado pelo tamanho da tela sem conversão nenhuma. É isso que o torna
 * utilizável como área de segurança: encostar um objeto em `u0` no editor é
 * encostá-lo na cantoneira no baú, sem folga e sem corte.
 */
export interface PaintRect { u0: number; u1: number; v0: number; v1: number }

export interface FaceSnapshot {
  /** O FUNDO, como URL de objeto — vai direto para `--ts-pw-img`. */
  bg: string;
  /**
   * A FERRAGEM da frente, recortada na caixa da CHAPA.
   *
   * Um CANVAS e não uma URL, de propósito: ele é desenhado 1:1 no plano da
   * frente do palco e na miniatura do card, e passar por data-URL custaria uma
   * codificação e uma decodificação por face a cada rebuild — os 723 ms
   * medidos em `refreshSnapshots` eram quase todos isso. Um canvas atravessa
   * essa fronteira sem nenhuma das duas.
   */
  front: HTMLCanvasElement;
  /** Razão da imagem de fundo (largura/altura). */
  ar: number;
  /** Onde a CHAPA cai dentro do fundo, em frações [0..1] com y para baixo. */
  box: { x: number; y: number; w: number; h: number };
  /** A área pintável, MEDIDA na própria ferragem — ver `PaintRect`. */
  paint: PaintRect;
}

/* O QUADRO É A CHAPA — "do frame metálico para dentro, nada do chassi".
   ---------------------------------------------------------------------------
   As margens eram de CONTEXTO: 8 cm nos lados, 5 no topo e **18 embaixo**. Os
   18 cm de baixo são o que punha na foto a saia, o para-lama, as lanternas de
   chassi e a sombra do rodado — tudo que aparece amontoado sob o painel nos
   prints, e nada disso é painel.

   E elas não são necessárias: a cantoneira de topo, o trilho inferior com a
   fita 3M e os montantes de canto ficam DENTRO da caixa da chapa (é por isso
   que `measurePaintRect()` os encontra recuando das bordas para dentro). Ou
   seja, "o frame" já está no quadro sem margem nenhuma.

   Mas "sem margem" também não serve, e a segunda rodada de olhos mostrou por
   quê: **o montante de canto não está DENTRO da caixa da chapa.** Medido no
   `trailer.glb`, com a área livre lida no alfa da ferragem, o montante traseiro
   invade 74 mm da chapa e o dianteiro só 11 — mas eles têm 173,5 e 142,1 mm de
   largura (`panels/layout.json`), ou seja quase toda a peça fica AO LADO da
   chapa. Com sangria de 1 cm o relato foi exato: *"o frame metálico da frente
   não está mostrando"*, nos dois flancos.

   Então a margem lateral é o que falta do montante mais folga: 15 cm nas
   laterais. Na TRASEIRA os montantes já entram 92 mm de cada lado e 3 cm
   fecham a peça; mais do que isso começaria a mostrar a parede lateral do baú,
   que é outra face. */
/* A TESTEIRA usa a margem da traseira, e pela mesma razão: os montantes de
   canto já entram na caixa da chapa dos dois lados, e 3 cm fecham a peça sem
   começar a mostrar a parede lateral, que é outra face. */
const M_SIDE: Record<SnapshotKey, number> = { left: 0.15, right: 0.15, rear: 0.03, front: 0.03 };
const M_TOP = 0.01;
/**
 * A folga de baixo é POR FACE, e a das laterais não é sangria: é o trilho.
 *
 * O trilho inferior das laterais nasce **82,5 mm abaixo do piso** e tem 210 mm
 * (`panels/layout.json`, peça `rail-bottom`), e a fita 3M mora inteira nessa
 * saia (`tape-low`, y −51,9 mm). Ou seja: com sangria de 1 cm a fita aparecia
 * PELA METADE na borda da foto — o trilho é frame, e frame cortado ao meio lê
 * como imagem cortada.
 *
 * Noventa milímetros mostram o trilho inteiro e param bem antes do que o
 * usuário mandou tirar: o para-lama, a lanterna de chassi e a sombra do rodado
 * moram na faixa dos 180 mm, que é exatamente o que a margem anterior pegava.
 *
 * A TRASEIRA precisa de MUITO mais, e o dono do produto marcou em verde onde o
 * quadro tem de fechar: abaixo da última faixa refletiva vermelha e branca, a
 * que corre a travessa inferior. A caixa da chapa traseira termina no piso das
 * folhas; a travessa de batente e essa faixa ficam inteiras ABAIXO dela — com
 * 4 cm o relato foi "está mostrando menos que deveria".
 *
 * A medida saiu do retângulo verde que o dono do produto desenhou sobre o
 * render 3D: o corte tem de cair **abaixo** da faixa refletiva vermelha e
 * branca da travessa, não acima dela.
 *
 * ⚠️ E ELA CONTA DA CAIXA DA CHAPA, QUE NA TRASEIRA NÃO CHEGA AO PISO. É o que
 * fez 15 e depois 21 cm continuarem cortando acima da faixa: `PANEL_MM.rear`
 * mede **2 577 mm** de altura num baú de 2 790 — a chapa traseira termina uns
 * 213 mm ACIMA do piso, porque as folhas das portas são geometria própria e
 * descem além dela. Então cada centímetro pedido aqui só começa a valer depois
 * de vencer esse degrau: 21 cm de margem eram 0 cm abaixo do piso.
 *
 * O ajuste fino veio de três leituras, com a fração de pixel vermelho da faixa
 * medida na bancada a cada uma:
 *
 *     21 cm → 1,5 %   a faixa nem entra no quadro ("está cortando acima")
 *     27 cm → 12,9 %  ela entra, mas cortada ao meio na borda da imagem
 *     34 cm → 13,4 %  inteira e com sobra ("passando muito da faixa")
 *
 * O salto de 1,5 % para 12,9 % é o degrau de 213 mm sendo vencido; entre 27 e
 * 34 a faixa já está toda dentro e o que muda é só quanto de travessa sobra
 * embaixo. **31 cm** fecham rente ao pé da faixa: inteira, sem sobra, e o
 * para-choque de proteção, as lanternas e a placa continuam fora — que é o
 * outro lado do mesmo pedido ("nada do chassi").
 */
/* A TESTEIRA fica no MEIO entre as laterais e a traseira, e as duas pontas do
   raciocínio são medidas diferentes.
   Ela não tem o degrau da traseira: os 31 cm de lá existem para vencer os
   ~213 mm em que a chapa traseira termina acima do piso (as folhas das portas
   descem além dela) e alcançar a faixa refletiva da travessa; a chapa da frente
   vai do piso ao teto (`PANEL_MM.front` mede a altura cheia), então 31 cm ali
   só mostrariam chassi.
   Mas 9 cm, como as laterais, também não serve — e foi o primeiro valor, com o
   relato "está faltando o frame metálico inferior, está cortando antes do final
   dele". O frame da testeira não é o trilho da saia lateral: é a travessa
   dianteira, mais alta, e ela desce abaixo da linha em que a lateral já acabou.
   22 cm fecham a travessa inteira e param antes do conjunto do pino-rei e das
   patolas, que é o "nada do chassi" do mesmo pedido. */
const M_BOTTOM: Record<SnapshotKey, number> = { left: 0.09, right: 0.09, rear: 0.31, front: 0.22 };

/* Fatia de profundidade fotografada, a partir da pele: para FORA e para DENTRO.
   Dentro, o suficiente para a saia e o trilho — e pouco o bastante para o
   interior do baú nunca entrar no quadro. */
/**
 * A fatia PARA FORA é por face, e a TESTEIRA precisa de muito mais.
 *
 * Trinta centímetros cobrem a ferragem mais saliente de uma lateral (o medidor
 * de área usa `SKIN_OUT = 0,20`) sem alcançar o rodado. Na frente há uma peça
 * que não é ferragem: o THERMO KING, montado na testeira, com **451 mm de
 * profundidade** (`thermoking_meta.json`, `dims.d`). Com 30 cm o plano PRÓXIMO
 * da ortográfica caía 151 mm dentro dele — a carcaça aparecia com o miolo
 * decepado, que é o "a parte central do Thermo King está sendo cortada".
 *
 * 0,75 m dá os 451 mm mais folga para o suporte e as mangueiras. Podia ser
 * arriscado: o CAVALO fica logo à frente, e o engate é justamente clampeado
 * contra `tkDepth` — ou seja a traseira da cabine está a poucos centímetros do
 * fim do Thermo King. Não é, porque o cavalo sai de cena durante o disparo (ver
 * `hide` em `takeFaceSnapshots`), que é a resposta certa de qualquer forma: o
 * retrato é do IMPLEMENTO.
 */
const D_OUT: Record<SnapshotKey, number> = {
  left: 0.30, right: 0.30, rear: 0.30, front: 0.75,
};
/**
 * E a fatia PARA DENTRO é por face, porque a traseira tem uma peça funda.
 *
 * A faixa refletiva vermelha e branca da travessa inferior — o
 * `faixa3M-parachoque-traseiro` — não fica no plano das folhas: ela é RECUADA,
 * na travessa que sustenta o batente. Com 30 cm de fatia ela caía atrás do
 * plano distante da ortográfica e simplesmente não era desenhada; o que
 * aparecia no lugar era o perfil cinza mais próximo, e o relato foi "ainda está
 * faltando as faixas refletivas inferiores" mesmo depois de o QUADRO já
 * alcançá-la.
 *
 * Sessenta centímetros a trazem. A traseira pode: a chapa das folhas é opaca e
 * oclui todo o interior do baú acima da travessa, então aumentar a fatia só
 * revela o que está ABAIXO das folhas — que é justamente a travessa.
 */
const D_IN: Record<SnapshotKey, number> = { left: 0.30, right: 0.30, rear: 0.60, front: 0.30 };

/** Densidades: lateral tem 15 m — o teto de textura manda; a traseira é
 *  pequena e merece mais pixel por metro. */
const SIDE_MAX_W = 2816;
const REAR_PPM = 380;

const invisible = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });

/* ---------------- A LUZ DA BANCADA É PRÓPRIA, E FIXA ----------------
   O painel do editor é um DOCUMENTO, não uma fotografia de ambiente: ele tem de
   sair igual às três da tarde e às onze da noite, no ciclorama branco e no
   distrito industrial. Herdar a luz da cena fazia o contrário — o preset de
   noite deixava a chapa marrom-escura e o de sol estourava a fita refletiva.

   Três decisões, e cada uma resolve um dos dois defeitos que o dono do produto
   nomeou ("não ficar escuro ou saturar"):

   1. AS LUZES DA CENA SAEM DE CENA durante o disparo. Todas — o rig do estúdio,
      os postes do distrito, o sol. O que ilumina é o par abaixo, e só ele.

      E O QUE ENTRA NÃO TEM NENHUMA DIRECIONAL, o que é o oposto do que se
      esperaria de uma bancada e é a correção mais importante deste bloco.
      A razão está em `vehicle/retroreflect.ts`: a fita 3M soma
      `Σ_luzes cor · (N·L) · (0,30 + ganho·(L·V)^4)` percorrendo
      `directionalLights[]`, `pointLights[]` e `spotLights[]`. Uma chave posta
      perto do eixo da lente — que é a pose óbvia para fotografar um painel —
      põe `L·V ≈ 1` e dispara o lóbulo retrorrefletivo inteiro: a fita
      **estoura em branco e perde o vermelho**, que foi exatamente o relato
      ("as faixas refletivas muito claras, o vermelho dela"). Aumentar a
      exposição para clarear a chapa piorava isso na mesma proporção.

      `HemisphereLight` e `scene.environment` NÃO entram naqueles laços. Com só
      esses dois, o termo retro é ZERO por construção e a fita devolve o próprio
      albedo — vermelho e branco, com contraste. O relevo continua legível
      porque um IBL não é luz chapada: o gradiente do item 2 varia do teto ao
      piso, e é essa variação que desenha a aba da emenda, o friso e a calota do
      rebite.

   2. ENTRA UM AMBIENTE NEUTRO PRÓPRIO — um gradiente vertical, uniforme em
      torno do eixo. Sem ambiente nenhum o galvanizado da cantoneira e o inox da
      ferragem saem PRETOS: metal quase não tem difusa, então sem nada para
      refletir ele não tem nada. Ver `benchEnvironment()` para as duas razões de
      não reusar o `scene.environment` da cena (ele muda com a hora; e é um alvo
      de render de OUTRO contexto de WebGL, que aqui chegaria vazio) e por que o
      `RoomEnvironment` do addon também não serve (é uma caixa, e cada face a vê
      de um ângulo diferente).

   3. A EXPOSIÇÃO É CRAVADA, E É UMA SÓ PARA AS TRÊS FACES. `toneMappingExposure`
      fixo com ACES: ACES porque ela dobra o brilho alto em vez de cortá-lo — é
      o que impede a fita refletiva e o inox de virarem manchas brancas sem
      forma —, e cravada porque o preset da cena mexe na exposição do
      renderizador principal e o painel não pode seguir junto. Uma só porque as
      quatro faces são o mesmo documento; ver `EXPOSURE`. */
/* Os quatro números da luz, e como eles foram escolhidos: MEDINDO a foto.
   `checks-livery-registro.mjs` lê a luminância média do miolo da chapa, a
   fração de pixels estourados (≥ 254 nos três canais) e a fração escura
   (< 60). O alvo é branco de papel — alto o bastante para a chapa ler como
   branca, baixo o bastante para o relevo da emenda e a fita refletiva
   continuarem tendo FORMA em vez de virarem mancha.

   Rodada 1 (chave 1,15 · fill 0,55 · env 0,85 · exposição 1,0):
       lateral 218,2 · traseira 170,0 · estourado 0 % · escuro 0 / 7,4 %
   → "estão muito escuros". Chapa branca lendo como cinza.

   Rodada 2 (chave 1,55 · fill 1,35 · kick 0,5 · env 1,35 · exposição 1,3):
       lateral 240,9 · traseira 214,6 · estourado 0 % · escuro 0 / 4,2 %
   → o número ficou bom e a IMAGEM ficou pior: "muito estourado a saturação" na
   lateral, "as faixas refletivas muito claras" nas duas, "os frames continuam
   muito escuros". Ou seja subir tudo junto ALARGOU o contraste — a chave levou
   o branco e a fita ao topo e não alcançou o preto do frame.

   O que a rodada 3 muda é a NATUREZA da luz, não o volume dela: as direcionais
   saem inteiras (é o que desarma o lóbulo retrorrefletivo — ver o item 1) e
   sobram ambiente + hemisférico, que iluminam por IRRADIÂNCIA. Luz de
   irradiância comprime o alcance dinâmico por construção: ela alcança a face
   estreita da dobradiça e o fundo do vão, que é o que levanta o frame, sem
   criar o realce especular que estourava a chapa e a fita. A exposição volta
   para perto de 1 porque não há mais um pico a compensar. */
const FILL_INTENSITY = 1.9;
/**
 * O ganho de `scene.environment` durante a foto.
 *
 * ⚠️ E O `envMapIntensity` DE CADA MATERIAL NÃO É TOCADO — houve uma versão que
 * o cravava neste mesmo número "para as três faces responderem igual", e o
 * resultado foi pior de um jeito instrutivo: o frame da traseira é pintado de
 * PRETO FOSCO e tem ganho de ambiente baixo por autoria. Forçado a 1,15 ele
 * passou a refletir a sala inteira e virou CINZA — o retrato deixou de bater
 * com o baú justamente na peça que o cliente chama de frame.
 *
 * O ganho por material é o que diz "este aqui é preto fosco e aquele é inox".
 * É parte do modelo, e um retrato do modelo não pode reescrevê-lo. O que este
 * arquivo corrige é só o que está QUEBRADO no contexto dele: a textura de
 * ambiente que não atravessa o contexto de WebGL, e o azimute da caixa.
 */
const ENV_GAIN = 1.0;
/**
 * A EXPOSIÇÃO É UMA SÓ PARA AS QUATRO FACES — e chegar a isso levou três voltas.
 *
 * O pedido sempre foi *"os 3 devem ter um mesmo nível de exposição"*, e o que
 * ele quer dizer é o RESULTADO: as faces têm de ler como o mesmo documento.
 * Houve uma versão que compensava a traseira com quase o dobro de exposição, e
 * ela estava errada — não pelo mecanismo, mas porque mascarava dois DEFEITOS,
 * corrigidos onde nasciam:
 *
 *   1. o `envMap` da sonda chegava vazio neste renderizador e todo metal
 *      renderizava preto (ver a troca de `envMap` em `snapFace`);
 *   2. o ambiente é uma CAIXA, e cada face a via de um ângulo diferente (ver
 *      `envRot`, também em `snapFace`).
 *
 * Depois deles sobrou um `EXPOSURE_TRIM` por face — 1,00 nas laterais contra
 * 0,52 nas pontas —, calibrado a olho sobre o baú BRANCO. Ele foi o último a
 * cair, e caiu com número: `logExposure()` (leia o bloco dele) mediu as quatro
 * faces nos dois estados que importam.
 *
 *                    BRANCO DE FÁBRICA          PINTADO DE PRETO
 *     lateral        232   (exposição 1,145)     47   (exposição 1,145)
 *     traseira       238   (exposição 0,754)     22   (exposição 0,754)
 *     testeira       227   (exposição 0,754)     22   (exposição 0,754)
 *
 * Ceifado (250+ nos três canais): 0,0 % nas laterais e na frente, 0,3 % na
 * traseira. Ou seja o estouro que motivou a rodada anterior já não existia — e
 * mesmo assim a lateral estava errada, de um jeito que só o baú PINTADO
 * mostrava: com tinta preta ela lia **mais que o dobro** das duas pontas.
 *
 * A LEITURA DOS NÚMEROS, e ela é o argumento inteiro. Compare lateral e
 * testeira, que são a MESMA chapa de corpo, sob 52 % mais exposição na lateral:
 *
 *   · no branco, 52 % de exposição a mais valem **cinco níveis** (227 → 232).
 *     A chapa branca está no OMBRO do ACES, onde a curva é quase horizontal;
 *   · no preto, os mesmos 52 % valem **mais que o dobro** (22 → 47). A tinta
 *     escura está no PÉ da curva, onde a resposta é quase linear.
 *
 * Isto é o que a calibração a olho não tinha como ver: um aparo escolhido sobre
 * a chapa branca é praticamente GRATUITO na chapa branca e CARÍSSIMO na
 * pintada. Igualar a exposição custa ~5 níveis num caso e conserta um fator de
 * dois no outro — não é um meio-termo, é ganho dos dois lados.
 *
 * Sobra uma diferença real entre a lateral e as pontas, e ela FICA: dos 2,14×
 * medidos no preto, ~1,52× era exposição e ~1,4× é a lateral ser FRISADA. Cada
 * friso é um meio-cilindro e, num render ortográfico de frente, todos devolvem
 * a mesma banda especular ao mesmo tempo. Uma lateral frisada preta é mais
 * clara que uma porta traseira plana preta — no baú de verdade também é, e um
 * retrato que apagasse isso mentiria.
 *
 * Se uma face voltar a divergir, `logExposure()` diz qual e quanto ANTES de
 * alguém inventar um número. Um aparo por face é fácil de reintroduzir; o que
 * não se recupera é a medição que justifica o valor dele.
 */
const EXPOSURE = 0.754;


let renderer: THREE.WebGLRenderer | null = null;
let benchEnv: THREE.Texture | null = null;

function rendererFor(w: number, h: number) {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
  }
  /* FORA do `if`, mesmo com a exposição sendo uma só: um renderizador reusado
     entre quatro faces não pode depender de ninguém ter escrito isto na
     criação — foi assim que o aparo por face, quando existia, vazava da
     primeira face para as outras. */
  renderer.toneMappingExposure = EXPOSURE;
  renderer.setSize(w, h, false);
  return renderer;
}

/**
 * O ambiente neutro, assado uma vez NESTE renderizador.
 *
 * O `RoomEnvironment` do addon — uma caixa branca com painéis emissivos, que é
 * a luz de estúdio que um documento quer, e o único ambiente que este
 * renderizador aceita com HDR de verdade. Duas alternativas foram tentadas e
 * caíram, e vale registrar porque a segunda parece obviamente melhor:
 *
 *   · `scene.environment` DA CENA — muda com a hora do dia, e é um alvo de
 *     render assado no renderizador PRINCIPAL: textura de render-target não
 *     atravessa contexto de WebGL, então aqui chega VAZIA;
 *   · um EQUIRRETANGULAR DE GRADIENTE em canvas, que seria uniforme em azimute
 *     e resolveria a assimetria de graça. `PMREMGenerator.fromEquirectangular()`
 *     o aceita sem lançar exceção nenhuma e devolve um mapa que renderiza
 *     PRETO. Medido: subir `envMapIntensity` de 2,6 para 8,0 não mudou um único
 *     nível de cinza em nenhuma das três faces — a assinatura de um ambiente que
 *     simplesmente não está lá. Um canvas LDR também não teria a faixa
 *     dinâmica que faz metal parecer metal.
 *
 * A ASSIMETRIA DA CAIXA é resolvida ONDE ELA APARECE, e não trocando a caixa:
 * o ambiente é GIRADO por face (ver `envRot` em `snapFace`), de modo que as
 * três vejam a mesma parede. É o que permite uma exposição só.
 */
function benchEnvironment(rr: THREE.WebGLRenderer): THREE.Texture | null {
  if (benchEnv) return benchEnv;
  try {
    const gen = new THREE.PMREMGenerator(rr);
    const rt = gen.fromScene(new RoomEnvironment(), 0.04);
    benchEnv = rt.texture;
    gen.dispose();
  } catch (e: unknown) {
    console.warn('[livery] ambiente da bancada indisponível —',
      e instanceof Error ? e.message : String(e));
    benchEnv = null;
  }
  return benchEnv;
}

/** Caixa LOCAL pelo atributo de posição — `setFromObject` superestima. */
function attrBox(mesh: THREE.Mesh): THREE.Box3 {
  const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const b = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) b.expandByPoint(v.fromBufferAttribute(pos, i));
  return b;
}

/** Os eixos LOCAIS do desenho de cada face — os mesmos de `addLiveryUV()`:
 *  u corre o comprimento no sentido em que o painel é lido de fora, v desce. */
const AXES: Record<SnapshotKey, { u: THREE.Vector3; skin: 'minX' | 'maxX' | 'minZ' | 'maxZ' }> = {
  left: { u: new THREE.Vector3(0, 0, 1), skin: 'minX' },
  right: { u: new THREE.Vector3(0, 0, -1), skin: 'maxX' },
  rear: { u: new THREE.Vector3(-1, 0, 0), skin: 'minZ' },
  /* A testeira corre ao CONTRÁRIO da traseira — quem a olha está na frente do
     baú e vê o +X à direita. É o mesmo espelho que `addLiveryUV()` aplica, e as
     duas tabelas têm de concordar ou o retrato sai invertido em relação à arte
     que ele emoldura. */
  front: { u: new THREE.Vector3(1, 0, 0), skin: 'maxZ' },
};

/** As faces de PONTA: o painel delas corre no X e a pele é um plano de z. */
const isEndSkin = (skin: string) => skin === 'minZ' || skin === 'maxZ';

/* ---------------- A ÁREA PINTÁVEL, MEDIDA NA FERRAGEM ----------------
   O passe da FRENTE já é, por construção, a resposta: ele contém exatamente o
   que fica ENTRE o olho e a chapa. Um pixel com alfa ali é um pixel em que a
   arte do cliente vai sumir atrás de metal. Então a área pintável não precisa
   ser inferida de caixas de malha — ela pode ser LIDA.

   Isso substitui `measurePaintable()`, que decidia por bounding box ("a peça
   alcança a pele?", "ela corre metade do painel?") e errava de duas maneiras
   documentadas: uma malha agrupada ocupava a faixa de tudo que ela agrupa, e o
   resultado era um véu cinza sobre chapa limpa. Uma caixa é uma caixa; um
   pixel é um pixel.

   O SCAN É DAS BORDAS PARA DENTRO, e não "o maior vão livre". A diferença
   importa: um vão de porta, os varões da traseira e a borracha central são
   obstruções INTERIORES, e o maior-vão-livre encolheria a área de segurança
   para um lado da porta — quando na prática o adesivo passa por cima dela. O
   que o cliente pede é o recuo do FRAME: o quanto a cantoneira, o trilho e os
   montantes de canto comem de cada borda. Andar de fora para dentro até a
   primeira linha livre responde exatamente isso e ignora o miolo. */

/** Alfa a partir do qual o pixel conta como coberto (a borda tem antialias). */
const COVER_A = 24;
/** Fração de uma linha/coluna coberta que a caracteriza como FERRAGEM CORRIDA.
 *  Meia linha: um trilho atravessa o painel inteiro, um rebite ocupa 0,1 %. */
const COVER_RUN = 0.5;
/** A área pintável nunca é menor que isto — abaixo disso a medida é implausível
 *  e devolver a chapa inteira é mais honesto do que devolver um selo. */
const MIN_PAINT = 0.25;

function measurePaintRect(crop: HTMLCanvasElement): PaintRect {
  const W = crop.width, H = crop.height;
  const full: PaintRect = { u0: 0, u1: 1, v0: 0, v1: 1 };
  if (!(W > 8 && H > 8)) return full;
  const ctx = crop.getContext('2d', { willReadFrequently: true });
  if (!ctx) return full;
  let data: Uint8ClampedArray;
  try { data = ctx.getImageData(0, 0, W, H).data; } catch { return full; }

  const rowCov = new Float32Array(H);
  const colCov = new Float32Array(W);
  for (let y = 0; y < H; y++) {
    let n = 0;
    const base = y * W * 4;
    for (let x = 0; x < W; x++) {
      if (data[base + x * 4 + 3] > COVER_A) { n++; colCov[x]++; }
    }
    rowCov[y] = n / W;
  }

  /* Das bordas para dentro, parando na primeira linha/coluna livre. */
  let top = 0; while (top < H && rowCov[top] >= COVER_RUN) top++;
  let bot = H - 1; while (bot > top && rowCov[bot] >= COVER_RUN) bot--;
  let lef = 0; while (lef < W && colCov[lef] / H >= COVER_RUN) lef++;
  let rig = W - 1; while (rig > lef && colCov[rig] / H >= COVER_RUN) rig--;

  const r: PaintRect = { u0: lef / W, u1: (rig + 1) / W, v0: top / H, v1: (bot + 1) / H };
  if (r.u1 - r.u0 < MIN_PAINT || r.v1 - r.v0 < MIN_PAINT) return full;
  return r;
}

interface RawShot { bgCanvas: HTMLCanvasElement; snap: FaceSnapshot }

function snapFace(
  scene: THREE.Scene, panel: THREE.Mesh, alsoHide: THREE.Object3D[],
): RawShot | null {
  const lb = attrBox(panel);
  const key: SnapshotKey = panel.name === 'SIDE_L' ? 'left'
    : panel.name === 'SIDE_R' ? 'right'
      : panel.name === 'FRONT' ? 'front' : 'rear';
  const axes = AXES[key];
  const mBottom = M_BOTTOM[key];
  const mSide = M_SIDE[key];

  const chapaW = axes.u.z !== 0 ? lb.max.z - lb.min.z : lb.max.x - lb.min.x;
  const chapaH = lb.max.y - lb.min.y;
  if (!(chapaW > 0.5 && chapaH > 0.5)) return null;

  const skinAt = axes.skin === 'minX' ? lb.min.x
    : axes.skin === 'maxX' ? lb.max.x
      : axes.skin === 'maxZ' ? lb.max.z : lb.min.z;

  /* Centro do QUADRO em coordenadas locais: o centro da chapa deslocado por
     meia diferença de margens (as laterais são iguais; a vertical não). */
  const c = lb.getCenter(new THREE.Vector3());
  if (isEndSkin(axes.skin)) c.z = skinAt; else c.x = skinAt;
  c.y += (M_TOP - mBottom) / 2;

  const frameW = chapaW + 2 * mSide;
  const frameH = chapaH + M_TOP + mBottom;

  /* Base da câmera no MUNDO, tirada da matriz do painel. */
  panel.updateWorldMatrix(true, false);
  const m = panel.matrixWorld;
  const uW = axes.u.clone().transformDirection(m);
  const upW = new THREE.Vector3(0, 1, 0).transformDirection(m);
  const outW = new THREE.Vector3().crossVectors(uW, upW).normalize();
  const centerW = c.clone().applyMatrix4(m);

  const ppm = isEndSkin(axes.skin) ? REAR_PPM : Math.min(190, SIDE_MAX_W / frameW);
  const wPx = Math.max(64, Math.round(frameW * ppm));
  const hPx = Math.max(64, Math.round(frameH * ppm));

  const rr = rendererFor(wPx, hPx);
  const cam = new THREE.OrthographicCamera(-frameW / 2, frameW / 2, frameH / 2, -frameH / 2,
    3 - D_OUT[key], 3 + D_IN[key]);
  const rot = new THREE.Matrix4().makeBasis(uW, upW, outW);
  cam.quaternion.setFromRotationMatrix(rot);
  cam.position.copy(centerW).addScaledVector(outW, 3);
  cam.updateMatrixWorld(true);

  /* Luz de bancada — ver o bloco "A LUZ DA BANCADA É PRÓPRIA, E FIXA".
     Entram, fotografam, saem: tudo aqui é restaurado no `finally`. */
  const doused: THREE.Light[] = [];
  scene.traverse((node) => {
    const l = node as THREE.Light;
    if (l.isLight && l.visible) { l.visible = false; doused.push(l); }
  });

  /* NENHUMA DIRECIONAL — ver o item 1 do bloco da luz. O preenchimento é
     HEMISFÉRICO e quase neutro entre céu e chão: um "chão" escuro demais é o
     que fechava em preto a face de baixo da dobradiça e do varão, e essas peças
     são metade do que o cliente reconhece como a ferragem da traseira.

     ⚠️ `position` DE UMA HemisphereLight É UMA DIREÇÃO, não um ponto. O three
     normaliza o vetor da ORIGEM até `position` para achar o eixo céu→chão. Aqui
     estava `centerW + upW·4`, que é uma posição absoluta no mundo: com o
     conjunto engatado a 12 m da origem, o "céu" apontava para o lado. Ou seja o
     hemisférico iluminava cada face de um eixo diferente — parte da diferença
     que eu estava compensando por exposição. `upW` puro é a direção certa, e é
     o `up` DA FACE pela mesma razão que a câmera nasce da base do painel: o
     conjunto gira quando é engatado. */
  const fill = new THREE.HemisphereLight(0xffffff, 0xd6dade, FILL_INTENSITY);
  fill.position.copy(upW);
  scene.add(fill);

  const bg0 = scene.background;
  const fog0 = scene.fog;
  const env0 = scene.environment;
  const envI0 = scene.environmentIntensity;
  const envR0 = scene.environmentRotation.clone();
  scene.background = null;
  scene.fog = null;
  const env = benchEnvironment(rr);

  /* ---------------- O AMBIENTE GIRA COM A FACE ----------------
     O pedido é *"os 3 devem ter um mesmo nível de exposição"*, e sem isto ele é
     impossível de cumprir com um ambiente de CAIXA: o `RoomEnvironment` tem
     painéis emissivos em posições fixas, então a lateral do motorista o vê de
     um ângulo, a do passageiro do oposto e a traseira de um terceiro. Foi
     exatamente esse o relato — "esse lado está muito bom, mas esse está um
     pouco estourado" — com as duas laterais sob a MESMA luz declarada e a MESMA
     exposição.

     Girar o ambiente pelo azimute da face faz as três olharem para a mesma
     parede. A conta é uma linha: `atan2(outW.x, outW.z)` é o azimute do "para
     fora" da face, e desfazê-lo alinha todas ao mesmo referencial.

     E A ROTAÇÃO TEM DE IR NOS DOIS LUGARES: `scene.environmentRotation` vale
     para quem amostra `scene.environment`, e `material.envMapRotation` para
     quem tem `envMap` próprio — os mesmos materiais cujo cubemap é trocado
     logo abaixo. Uma só das duas deixaria metade do baú fora de fase com a
     outra metade, que é pior do que a assimetria original. */
  const envRot = new THREE.Euler(0, -Math.atan2(outW.x, outW.z), 0);
  if (env) {
    scene.environment = env;
    scene.environmentIntensity = ENV_GAIN;
    scene.environmentRotation.copy(envRot);
  }

  /* ---------------- O ENVMAP EXPLÍCITO TAMBÉM TEM DE SER TROCADO ----------
     Esta é a causa raiz de "os frames estão muito escuros", e ela não é de
     iluminação: é de contexto de WebGL.

     `models.refreshVehicleReflection()` prende em CADA material do veículo o
     cubemap da sonda local — `m.envMap = tex`, onde `tex` é o alvo de render de
     `captureReflectionProbe()`, assado no renderizador PRINCIPAL. Um material
     com `envMap` próprio IGNORA `scene.environment`; e a textura de um
     render-target não tem `source.data` para reenviar, então no renderizador
     deste snapshot ela amostra PRETO.

     Resultado: cantoneira, trilho, dobradiça, varão e fecho — tudo que é metal,
     ou seja tudo que o cliente chama de "o frame" — chegava sem nada para
     refletir. Levantar a luz não corrigia (metal quase não tem difusa), e foi
     por isso que a rodada anterior só conseguiu desenhá-los com uma direcional
     forte, que era justamente o que estourava a fita. Trocando o `envMap` pelo
     ambiente assado AQUI, o metal volta a ter sala para refletir e a direcional
     deixa de ser necessária.

     TROCA, nunca `null`: sair de "tem envMap" para "não tem" muda o define
     `USE_ENVMAP` e recompila o programa dos ~2 150 materiais, duas vezes por
     face. Textura por textura, o programa é o mesmo. */
  /* E O GANHO DE AMBIENTE DE CADA MATERIAL VAI JUNTO, cravado no mesmo valor.
     ---------------------------------------------------------------------
     `scene.environmentIntensity` NÃO alcança um material que tem `envMap`
     próprio; lá quem manda é `material.envMapIntensity`. E esse número não é
     estável: `models.applyProbeEnvGain()` o reescreve conforme a hora do dia,
     então o mesmo baú responderia à mesma luz de bancada de um jeito às três da
     tarde e de outro às onze da noite — que é precisamente o que este retrato
     não pode fazer.

     Então `scene.environmentIntensity` fica em 1 e o ganho passa a ser
     `ENV_GAIN` em TODO material, com ou sem `envMap` próprio. Um caminho só,
     um número só, e as três faces respondendo igual — que é o pedido ("os 3
     devem ter um mesmo nível"). */
  const envSwap: THREE.MeshStandardMaterial[] = [];
  const envWas = new Map<THREE.MeshStandardMaterial, THREE.Texture | null>();
  const seen = new Set<THREE.MeshStandardMaterial>();
  const rotWas = new Map<THREE.MeshStandardMaterial, THREE.Euler>();
  if (env) {
    (panel.parent ?? panel).traverse((node) => {
      const m = node as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const raw of mats) {
        const mat = raw as THREE.MeshStandardMaterial;
        if (!mat || seen.has(mat) || mat.envMapIntensity === undefined) continue;
        seen.add(mat);
        envSwap.push(mat);
        /* A TROCA de textura só onde já existe uma — sair de "tem envMap" para
           "não tem" mudaria o define `USE_ENVMAP` e recompilaria o programa de
           ~2 150 materiais, duas vezes por face. */
        if (mat.envMap && mat.envMap !== env) {
          envWas.set(mat, mat.envMap);
          mat.envMap = env;
        }
        if (mat.envMapRotation) {
          rotWas.set(mat, mat.envMapRotation.clone());
          mat.envMapRotation.copy(envRot);
        }
      }
    });
  }

  /* A ARTE fora do quadro nos dois passes: o palco a desenha viva, e
     fotografá-la junto a desenharia duas vezes.
     ---------------------------------------------------------------------
     A sobreposição de arte é sempre o mesmo objeto: um filho que COMPARTILHA a
     geometria do pai (ver `makeLiveryOverlay` em ./livery.ts). O que mudou é o
     ALCANCE da varredura. Ela olhava só `panel.children`, e desde que a arte
     passou a cobrir também as CALOTAS DE REBITE — que são uma malha irmã
     (`SIDE_L_RIVETS`), não filha da chapa — a arte do cliente entrava na foto
     pelos rebites. Sem arte nenhuma isso é invisível; com um logo aplicado, os
     pontinhos da emenda apareciam com pedaço do logo assado neles, e por baixo
     do logo vivo.

     Varre o IMPLEMENTO inteiro, e por isso é síncrona e restaurada no mesmo
     bloco: entre ocultar e restaurar não pode caber um quadro do renderizador
     principal, ou o caminhão pisca sem arte na tela do usuário.

     A geometria PRÓPRIA dos rebites fica — ela é relevo do painel e tem de
     aparecer na foto. Some só a camada de arte que veste esse relevo. */
  const hidden: THREE.Object3D[] = [];
  /* O CAVALO SAI DE CENA, e não é um caso especial da testeira: o retrato é do
     IMPLEMENTO, e a cabine nunca fez parte de nenhuma das quatro faces. Nas
     laterais e na traseira ela já ficava fora por acidente — a fatia de 30 cm
     do plano próximo não a alcançava —, e esse acidente deixa de valer na
     FRENTE, onde a cabine está encostada e a fatia teve de crescer para caber o
     Thermo King (ver `D_OUT`). Escondê-la é o que torna aquela fatia segura.
     Restaurado no mesmo `finally` que devolve as luzes e a arte. */
  for (const o of alsoHide) {
    if (o.visible) { o.visible = false; hidden.push(o); }
  }
  const root = panel.parent ?? panel;
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    const p = o.parent as THREE.Mesh | null;
    if (o.isMesh && p?.isMesh && o.geometry === p.geometry && o.visible) {
      o.visible = false;
      hidden.push(o);
    }
  });

  const grab = () => {
    const cnv = document.createElement('canvas');
    cnv.width = wPx; cnv.height = hPx;
    cnv.getContext('2d')?.drawImage(rr.domElement, 0, 0);
    return cnv;
  };

  let bgCanvas: HTMLCanvasElement, frontCanvas: HTMLCanvasElement;
  try {
    rr.render(scene, cam);
    bgCanvas = grab();

    /* Passe da FRENTE: a chapa vira depth-only — invisível no pixel, opaca
       para a oclusão, então o interior continua sem aparecer e a ferragem
       fica sozinha sobre alfa. A mesma técnica da bancada de renders. */
    const mat0 = panel.material;
    panel.material = invisible;
    try {
      rr.render(scene, cam);
      frontCanvas = grab();
    } finally {
      panel.material = mat0;
    }
  } finally {
    for (const o of hidden) o.visible = true;
    for (const l of doused) l.visible = true;
    for (const mat of envSwap) {
      const e = envWas.get(mat);
      if (e !== undefined) mat.envMap = e;
      const r = rotWas.get(mat);
      if (r) mat.envMapRotation.copy(r);
    }
    scene.remove(fill);
    scene.background = bg0;
    scene.fog = fog0;
    scene.environment = env0;
    scene.environmentIntensity = envI0;
    scene.environmentRotation.copy(envR0);
  }

  /* A FERRAGEM recortada na caixa da chapa: é o que o compositor da frente
     estica sobre a tela — mesma caixa, mesmo datum, registro exato. */
  const bx = Math.round(mSide * ppm);
  const by = Math.round(M_TOP * ppm);
  const bw = Math.max(1, Math.round(chapaW * ppm));
  const bh = Math.max(1, Math.round(chapaH * ppm));
  const crop = document.createElement('canvas');
  crop.width = bw; crop.height = bh;
  /* `willReadFrequently` NA CRIAÇÃO, e não na leitura: a opção vale para a
     PRIMEIRA chamada de `getContext` — as seguintes devolvem o mesmo contexto
     e ignoram o que for pedido. Sem ela o `getImageData` de
     `measurePaintRect()` puxa a superfície de volta da GPU a cada rebuild. */
  crop.getContext('2d', { willReadFrequently: true })
    ?.drawImage(frontCanvas, bx, by, bw, bh, 0, 0, bw, bh);

  /* O FUNDO VAI INTEIRO, SEM JANELA VAZADA — e é esta linha que muda a pilha
     do editor de lugar.
     ---------------------------------------------------------------------
     Antes daqui, o fundo era uma MOLDURA: a área branca era apagada e a
     imagem desenhada POR CIMA da arte (`.stage-panel::after`, z-index 25),
     herdando o contrato da foto estática. Isso obrigava o vazado a ser um
     RETÂNGULO — e um retângulo só pode ser aproximado da silhueta real da
     ferragem. Arte que cruzasse o trilho era cortada por uma reta em vez de
     desaparecer atrás do perfil, e a moldura ainda repintava a mesma ferragem
     que o plano da frente já desenhava, em escala de rasterização diferente:
     era a duplicação relatada.

     Agora o fundo é o que ele diz ser — o RETRATO do baú — e vai ATRÁS de
     tudo (ver `.ts-pw-behind` em core/studio.css). A arte é desenhada sobre a
     chapa fotografada e a oclusão fica por conta do plano da FRENTE, que tem
     a silhueta exata porque é o mesmo render. Um pixel, uma fonte. */
  const frame = bgCanvas;

  /* A ÁREA PINTÁVEL sai do recorte da frente, que é onde a ferragem está. */
  const paint = measurePaintRect(crop);

  return {
    /* O canvas do FUNDO viaja separado da estrutura: ele ainda vai ser
       codificado, e a codificação é assíncrona (ver `encodeBg`). Um campo
       `bg: ''` a ser preenchido depois seria um `FaceSnapshot` momentaneamente
       inválido circulando; um par diz a verdade sobre o que está pronto. */
    bgCanvas: frame,
    snap: {
      bg: '',
      front: crop,
      ar: wPx / hPx,
      box: { x: bx / wPx, y: by / hPx, w: bw / wPx, h: bh / hPx },
      paint,
    },
  };
}

/**
 * O DIAGNÓSTICO DA EXPOSIÇÃO — mediana e fração ceifada, por face.
 *
 * A exposição é o único número empírico deste arquivo, e até aqui cada ajuste
 * dela foi feito com os olhos e defendido com medições que moravam num script de
 * bancada (`checks-livery-registro.mjs`) que ninguém roda junto com o app. O
 * resultado previsível: as duas notas de calibração antigas se CONTRADIZIAM
 * sobre qual face era a mais clara, porque foram escritas em momentos diferentes
 * e nenhuma foi refeita quando a outra mudou. Foi este diagnóstico que aposentou
 * o `EXPOSURE_TRIM` por face — ver o bloco de `EXPOSURE`.
 *
 * Isto põe o número no console a cada retrato, ao lado da face que ele descreve.
 * Não corrige nada sozinho — mas transforma a próxima rodada de "acho que a
 * lateral está estourando" em "lateral 241, 8,3 % ceifado", que é uma frase que
 * se pode agir.
 *
 * SUBAMOSTRADO a cada 8 pixels nos dois eixos (1/64 dos pontos): a lateral tem
 * 1,5 M de pixels e a mediana de uma amostra de 24 k é indistinguível da mediana
 * exata para esta finalidade. O custo é ~1 ms por face.
 *
 * `CEIFADO` conta o pixel com os três canais em 250+, que é onde o ACES já não
 * separa mais nada — é a medida que a MEDIANA não dá, e é justamente a que
 * descreve o defeito da lateral frisada.
 */
function logExposure(key: SnapshotKey, cnv: HTMLCanvasElement) {
  const ctx = cnv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  let data: Uint8ClampedArray;
  try { data = ctx.getImageData(0, 0, cnv.width, cnv.height).data; } catch { return; }
  const hist = new Uint32Array(256);
  let n = 0, clipped = 0;
  for (let y = 0; y < cnv.height; y += 8) {
    for (let x = 0; x < cnv.width; x += 8) {
      const i = (y * cnv.width + x) * 4;
      /* Só o que É a foto: o quadro tem alfa 0 em volta da chapa, e contar o
         vazio como preto puxaria a mediana para baixo de forma diferente em cada
         face (a lateral tem margem lateral de 15 cm, a traseira de 3). */
      if (data[i + 3] < 24) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      hist[Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)]++;
      if (r >= 250 && g >= 250 && b >= 250) clipped++;
      n++;
    }
  }
  if (!n) return;
  let acc = 0, median = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n / 2) { median = v; break; } }
  console.info(`[livery] retrato ${key} · mediana ${median}`
    + ` · ceifado ${(100 * clipped / n).toFixed(1)} %`
    + ` · exposição ${EXPOSURE.toFixed(3)}`);
}

/** WebP quando o navegador dá (~6× menor); PNG na degradação do próprio
 *  `toBlob`. ASSÍNCRONO de propósito: a codificação sai da thread principal, e
 *  era ela — não os renders — que respondia pelo grosso dos 723 ms medidos. */
function encodeBg(cnv: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve) => {
    try {
      cnv.toBlob((b) => resolve(b ? URL.createObjectURL(b) : ''), 'image/webp', 0.88);
    } catch { resolve(''); }
  });
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Fotografa as três faces, UMA POR QUADRO.
 *
 * Chamada por `livery.attachOverlays()` — o único momento em que existem
 * chapas novas. Uma face sem chapa (bake sem branco) simplesmente não entra.
 *
 * ASSÍNCRONA, e as duas razões são a mesma queixa do usuário: adicionar uma
 * porta travava a página por ~2,9 s, dos quais ~0,7 s eram estas fotos. Os
 * renders em si são rápidos; o custo estava em codificar seis imagens em
 * base64 de forma síncrona. Agora a codificação é `toBlob` (fora da thread) e
 * cada face cede um quadro antes da seguinte, então o navegador continua
 * pintando — inclusive o próprio indicador de carregamento.
 *
 * `onFace` publica CADA face assim que ela fica pronta, em vez de esperar as
 * três: a lateral que o usuário está olhando aparece primeiro.
 */
export async function takeFaceSnapshots(
  scene: THREE.Scene, trailerRoot: THREE.Object3D,
  onFace: (key: SnapshotKey, snap: FaceSnapshot) => void,
  /** O que mais tem de sair de cena durante o disparo — hoje, o cavalo. */
  alsoHide: THREE.Object3D[] = [],
): Promise<void> {
  const names: Record<string, SnapshotKey> = {
    SIDE_L: 'left', SIDE_R: 'right', REAR: 'rear', FRONT: 'front',
  };
  const panels: [SnapshotKey, THREE.Mesh][] = [];
  trailerRoot.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    const key = names[o.name];
    if (key) panels.push([key, o]);
  });

  for (const [key, mesh] of panels) {
    /* O QUADRO CEDIDO VEM ANTES, e isso não é estilo.
       Quem chama é `attachOverlays()`, que roda no fim de um recorte de
       geometria de ~790 ms. Um `void refreshSnapshots()` executa
       SINCRONAMENTE até o primeiro `await` — ou seja, com o `await` no fim do
       laço, a primeira face era fotografada DENTRO da mesma tarefa do recorte
       e as duas somavam num bloqueio só. MEDIDO: 1 167 ms de maior quadro sem
       pintar, contra 791 do recorte sozinho. Cedendo antes, o navegador pinta
       entre as duas e nenhuma face divide tarefa com nada. */
    await nextFrame();
    try {
      const shot = snapFace(scene, mesh, alsoHide);
      if (!shot) continue;
      logExposure(key, shot.bgCanvas);
      shot.snap.bg = await encodeBg(shot.bgCanvas);
      onFace(key, shot.snap);
    } catch (e: unknown) {
      console.warn('[livery] snapshot da face', key, 'falhou —',
        e instanceof Error ? e.message : String(e));
    }
  }
}
