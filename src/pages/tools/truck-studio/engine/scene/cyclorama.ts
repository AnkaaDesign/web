/* Ciclorama — o "set" procedural do cenário Estúdio.
   -------------------------------------------------------------------------
   POR QUE ESTE ARQUIVO EXISTE. O cenário `estudio` era o único sem bloco `set`,
   e o manifesto justificava isso dizendo que "o fundo É o gradiente neutro do
   preset". Medido no app, essa premissa não se sustenta: a câmera de uma foto de
   veículo olha praticamente na horizontal, então ela só enxerga a FAIXA DO
   HORIZONTE do domo procedural — as três bandas do céu (topo/meio/horizonte)
   ficam todas fora do quadro. O resultado medido foi um fundo de luminância
   110,2 / 110,1 / 110,1 / 110,1 / 110,5 do topo à base: liso ao ponto de não ter
   gradiente nenhum. Um domo de céu não consegue produzir gradiente vertical num
   enquadramento horizontal, por construção.

   E havia um segundo buraco maior: sem `set`, o cenário não tinha CHÃO. O
   maquinário de `shadowCatcher` foi arrancado do engine em 2026-08-03 junto com
   os cenários só-HDRI, então o caminhão ficava literalmente flutuando num vazio
   cinza, sem sombra de contato e sem nada que o separasse do fundo.

   Este módulo devolve as duas coisas com ZERO byte de download, que era a
   propriedade que fazia o cenário Estúdio valer a pena: uma sala de ciclorama
   gerada em código.

   A FORMA É UMA SALA FECHADA, NÃO UM FUNDO. Um "sweep" plano só funciona se a
   câmera ficar dentro de um arco estreito, e aqui a órbita é de 360°. Então o
   perfil (piso → concordância → parede → concordância → teto) é varrido ao longo
   do contorno inteiro: de qualquer ângulo o que se vê é piso, curva e parede,
   sem emenda, sem quina e sem borda de geometria entrando no quadro.

   O CONTORNO É UM QUADRADO, e já foi um círculo — ver o bloco "A SALA É
   QUADRADA" lá embaixo, que registra por que mudou e como a varredura funciona.

   Fechar o TETO não é capricho. Ele faz três trabalhos:
     1. tapa o domo de céu, que senão apareceria pelo vão acima da parede;
     2. é o difusor de cima — a superfície clara que devolve luz nas horizontais
        do caminhão (capô, teto da cabine, teto do baú), que é o que impede um
        veículo escuro de virar silhueta;
     3. dá conteúdo à SONDA DE REFLEXO. Este é o ponto que conserta a queixa de
        "está alterando mais o cavalo do que o implemento": os 48 materiais do
        implemento carregam um `envMap` explícito (o cubemap da sonda, capturado
        da cena VISÍVEL), enquanto os 95 materiais do cavalo não carregam nenhum
        e portanto amostram `scene.environment` — o RoomEnvironment. Com a cena
        visível sendo um vazio cinza chapado, o cavalo refletia uma sala de
        estúdio e o implemento refletia o nada: duas respostas diferentes à mesma
        luz. Uma sala neutra fechada faz a captura da sonda voltar a PARECER o
        RoomEnvironment que o cavalo já reflete, e as duas respostas convergem.

   NEUTRALIDADE É REQUISITO, NÃO ESTÉTICA. Todo cinza aqui tem R=G=B exatamente.
   Esta é a cena em que se julga uma tinta; qualquer dominante (e o preset antigo
   tinha uma azulada, 0x60646b = 96/100/107) é uma mentira sobre a cor que o
   cliente vai receber. */
import * as THREE from 'three';
import {
  scene, camera, invalidate, invalidateShadows, setInteriorBounds, onFrame, onDrawFrame, onRig, getRig,
  controls, vehicleFootprint,
} from './scene';
import { setStudioCeiling, sizeStudioCeiling, disposeStudioCeiling } from './ceiling';
import {
  installFloorReflection, uninstallFloorReflection, renderFloorReflection,
  disposeFloorReflection, setFloorReflectionAmount, setFloorReflectionFade,
  setFloorContact,
} from './floor-reflection';
import { getProfile } from '../core/quality';

/* ---------------- medidas, em metros ----------------
   O conjunto cavalo + implemento tem ~19 m de comprimento e ~4 m de altura, e a
   órbita do estúdio chega a ~25 m do centro. Todo número abaixo sai dessas três
   medidas, não de gosto. */

/* ---------------- A SALA SEGUE A ÓRBITA, E NÃO O CONTRÁRIO ----------------
   ESTE BLOCO ERA UM CONJUNTO DE CONSTANTES E ESSA ERA A CAUSA DE DOIS DEFEITOS
   RELATADOS DE UMA VEZ: *"o estúdio parece muito pequeno"* e *"a câmera toda
   hora fica reposicionando sozinha"*.

   Eram o MESMO bug. As constantes antigas (meia-caixa 30 m, parede a 50 m) foram
   dimensionadas quando `setVehicleFocus()` limitava a órbita em `2,6 · r` — uns
   25 m para este conjunto, e o cabeçalho antigo dizia isso com todas as letras.
   Depois disso a lente da cena passou a abrir em 30° e `maxDistance` virou
   `max(2,6 · r, openingDistance(r) · 1,15)`, que num rig de 19 m dá ~38 m.

   O resultado é uma BRIGA POR QUADRO, e ela é exatamente o que o usuário vê:

     · o OrbitControls põe a câmera onde a roda do mouse pediu, até 38 m;
     · o gancho de `setInteriorBounds()` a puxa de volta para dentro de 30 m;
     · no quadro seguinte o OrbitControls recompõe a órbita a partir da posição
       corrigida, e recomeça.

   Ou seja: a câmera se reposiciona sozinha porque duas regras discordam sobre
   onde ela pode estar. E "parece pequeno" é a outra metade da mesma coisa — a
   parede fica dentro do alcance útil da órbita.

   A CORREÇÃO NÃO É UM NÚMERO MAIOR, é uma DERIVAÇÃO. A sala passa a ser medida a
   partir do limite de órbita que scene.ts publica (`controls.maxDistance`), com
   folga; quando o rig muda de tamanho — outro implemento, outra medida — ela
   acompanha. Um número cravado aqui volta a divergir na próxima vez que alguém
   mexer na lente, e a próxima vez não vem com aviso. */

/** Folga entre o alcance máximo da órbita e a parede. A câmera nunca pode
 *  encostar no fundo: a 1 m dele o gradiente vira um borrão chapado. */
const WALL_CLEARANCE = 14;

/* ---------------- O RAIO DA CONCORDÂNCIA ERA 14 m, E ERA O DEFEITO ----------
   Este número respondia por *"a emenda parece estranha, até parece que não tem
   parede"*, e a resposta é literal: NÃO SE VIA PAREDE NENHUMA.

   A conta. Com 14 m de raio, a curva vai de r = 46 m até r = 60 m no chão e de
   y = 0 até y = 14 m na vertical. A parede RETA só começa aos 14 m de altura.
   Uma câmera de foto de veículo fica a 2–7 m do chão e olha praticamente na
   horizontal, então o campo dela do fundo termina bem antes disso: tudo que
   entrava no quadro era concordância. Um estúdio inteiro feito de uma única
   superfície curva não tem parede, não tem quina e não tem junta — ele tem um
   degradê. Era o degradê que o olho recusava.

   E havia um segundo efeito, mais sutil e mais importante: UMA CURVA MATA A
   INFORMAÇÃO DE LUZ. A chave é uma direcional, que não cai com a distância;
   sobre quatro planos verticais com orientações diferentes ela devolve quatro
   valores diferentes, e é exatamente essa diferença — mais a linha onde dois
   deles se encontram — que o cérebro lê como "sala". Sobre uma superfície de
   revolução ela devolve uma rampa contínua, sem nenhuma quebra. Não adianta
   escurecer, clarear ou texturizar: não havia o que ler.

   3 m é a medida de um ciclorama de verdade (um estúdio real usa 1 a 2 m; aqui
   sobe um pouco porque a sala tem 114 m de vão e a curva precisa acompanhar a
   escala). Com ela a parede reta começa aos 3 m — abaixo da linha do teto da
   cabine — e passa a ocupar o quadro inteiro atrás do veículo.

   O comentário anterior justificava os 14 m dizendo que era "chão além da
   parede-tangente, para a concordância não aparecer atrás do baú". A premissa
   estava certa e a conclusão invertida: a concordância aparecer atrás do baú é
   o que dá pé à sala. O que não pode aparecer é a QUINA VIVA — e disso cuida a
   própria concordância, que continua existindo. */
const R_FILLET = 3;
/** Piso mínimo, para um rig pequeno não gerar uma sala apertada. */
const MIN_WALL_R = 50;

/** Raio da parede, do piso plano, e o resto do perfil — recalculados a cada
 *  mudança de órbita por `sizeRoom()`. */
let WALL_R = MIN_WALL_R;
let R_FLOOR = MIN_WALL_R - R_FILLET;
let WALL_TOP = 18;
let R_CEIL = 12;
let CEIL_Y = 30;
/** Meia-caixa de órbita, em torno do RIG. Derivada da parede, nunca o contrário. */
let HALF = 30;
let MAX_Y = 20;

/**
 * Redimensiona a sala para conter a órbita corrente com folga.
 *
 * @returns true se alguma medida mudou o bastante para valer um rebuild.
 */
function sizeRoom(): boolean {
  /* O alcance da órbita É o requisito. `maxDistance` pode vir `Infinity` antes
     do primeiro `setVehicleFocus()`; aí o mínimo responde. */
  const reach = Number.isFinite(controls.maxDistance) ? controls.maxDistance : 0;
  const wall = Math.max(MIN_WALL_R, Math.ceil((reach + WALL_CLEARANCE) / 5) * 5);
  if (Math.abs(wall - WALL_R) < 1) return false;
  WALL_R = wall;
  R_FLOOR = WALL_R - R_FILLET;
  /* A parede sobe proporcionalmente ao vão: uma sala larga e baixa lê como
     garagem, não como estúdio. 0,36 mantém a proporção da sala original
     (18 m de parede para 50 m de raio). */
  WALL_TOP = Math.round(WALL_R * 0.36);
  R_CEIL = Math.round(WALL_R * 0.24);
  CEIL_Y = WALL_TOP + R_CEIL;
  /* A CAIXA DE ÓRBITA VEM DA PAREDE, com a folga descontada — é isto que acaba
     com a briga: ela deixa de poder ser menor que `maxDistance`.
     O `/√2` que havia aqui SAIU JUNTO COM A SALA REDONDA: ele existia porque uma
     caixa quadrada inscrita num cilindro tem o canto como ponto mais distante do
     centro, e era o canto que tinha de caber. Agora a sala também é quadrada e
     alinhada à mesma caixa, então a folga é direta — e a caixa cresce de ±41 m
     para ±58 m, que é o espaço que a sala redonda cobrava e não usava. */
  HALF = WALL_R - 2;
  MAX_Y = Math.max(8, CEIL_Y - 4);
  return true;
}

/* ---------------- A SALA É QUADRADA, E A PLANTA É A DO TETO ----------------
   ELA ERA UMA `LatheGeometry` — o mesmo perfil revolvido 360°. A forma redonda
   resolvia bem um problema real (não há quina para a câmera achar, de nenhum
   azimute), mas ela passou a brigar com o teto: a grelha de vigas é uma malha
   RETANGULAR, e uma grelha retangular dentro de um cilindro deixa a planta da
   sala em desacordo com a planta da estrutura — o olho lê as duas e não fecha.

   O QUE SUBSTITUI A REVOLUÇÃO: o mesmo perfil, varrido ao longo do CONTORNO de
   um quadrado em vez de em torno de um eixo. Cada ponto do perfil traz uma
   distância ao eixo, que aqui vira o MEIO-LADO do quadrado daquele anel:

     · `o = 0` (o pé da concordância) é o quadrado de meio-lado `R_FLOOR`;
     · `o = R_FILLET` (a parede) é o quadrado de meio-lado `WALL_R`;
     · `o < 0` (a laje da casca, que fecha rumo ao centro) encolhe o quadrado até
       ele degenerar no ponto central — exatamente o polo que a revolução tinha.

   O RAIO DE CANTO É FIXO EM PLANTA, e essa é a correção do primeiro desenho.
   Antes o canto era o OFFSET de um quadrado, e o offset de um quadrado arredonda
   o canto pela própria distância: no pé da parede o raio dava 14 m. Sobre uma
   sala de 120 m isso é um canto tão macio que, com o gradiente por cima, a sala
   deixava de ter quina nenhuma — o relato foi exatamente esse, *"não parece ter
   quinas nas paredes"*. Com o raio constante, os quatro cantos verticais
   desenham uma linha reta do piso ao teto, que é o que diz ao olho que a sala é
   uma CAIXA.

   Ele não é zero, e também não é capricho: uma quina viva num fundo sem emenda
   vira um risco preto de um pixel em toda foto tirada na diagonal — que é o
   defeito que o ciclorama existe para não ter. 3 m é o menor raio que ainda
   sombreia progressivamente em vez de saltar. */

/** Raio dos quatro cantos verticais, em planta e em metros. */
const CORNER_R = 3;
/** Amostras por lado reto do contorno. */
const SIDE_SEGS = 22;
/** Amostras por canto. 12 não mostra faceta nem no reflexo do cromado. */
const CORNER_SEGS = 12;
/** Total de amostras de um anel do contorno. */
const RING = 4 * (SIDE_SEGS + CORNER_SEGS);

/**
 * Um ponto do contorno de um anel cujo meio-lado é `R_FLOOR + o`.
 *
 * A ordem percorrida é lado +X, canto +X+Z, lado +Z, canto −X+Z, … — fechada, de
 * modo que a amostra `RING` é a amostra `0` e a costura some.
 */
function ringXZ(o: number, i: number, out: THREE.Vector2): THREE.Vector2 {
  const h = Math.max(0, R_FLOOR + o);
  /* O canto não pode ser maior que o meio-lado, senão os quatro arcos se
     atravessam — o que só acontece no fim do fechamento da laje, onde o anel já
     está a menos de 3 m do centro. */
  const c = Math.min(CORNER_R, h);
  const s = h - c;
  const per = SIDE_SEGS + CORNER_SEGS;
  const q = Math.floor(i / per) % 4;
  const j = i % per;
  if (j < SIDE_SEGS) {
    const t = -s + (2 * s * j) / SIDE_SEGS;
    if (q === 0) return out.set(h, t);
    if (q === 1) return out.set(-t, h);
    if (q === 2) return out.set(-h, -t);
    return out.set(t, -h);
  }
  const a = ((j - SIDE_SEGS) / CORNER_SEGS + q) * (Math.PI / 2);
  const cx = q === 0 || q === 3 ? s : -s;
  const cz = q === 0 || q === 1 ? s : -s;
  return out.set(cx + Math.cos(a) * c, cz + Math.sin(a) * c);
}

/**
 * Varre o perfil ao longo do contorno e devolve a casca.
 *
 * O perfil chega em coordenadas de RAIO (a mesma forma que a `LatheGeometry`
 * consumia, e a mesma que `buildProfile()` continua produzindo); aqui ele é lido
 * como deslocamento `r − R_FLOOR`, que é o que a varredura precisa.
 */
function sweepProfile(profile: THREE.Vector2[]): THREE.BufferGeometry {
  const rings = profile.length;
  const pos = new Float32Array(rings * RING * 3);
  const p = new THREE.Vector2();
  let k = 0;
  for (let r = 0; r < rings; r++) {
    const o = profile[r].x - R_FLOOR;
    const y = profile[r].y;
    for (let i = 0; i < RING; i++) {
      ringXZ(o, i, p);
      pos[k++] = p.x; pos[k++] = y; pos[k++] = p.y;
    }
  }
  const idx: number[] = [];
  for (let r = 0; r < rings - 1; r++) {
    for (let i = 0; i < RING; i++) {
      const a = r * RING + i;
      const b = r * RING + ((i + 1) % RING);
      const c = a + RING;
      const d = b + RING;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ---------------- a rampa de valor ----------------
   O GRADIENTE VERTICAL É AUTORADO, não é consequência da luz. Luz direcional não
   atenua com distância, então uma parede lisa iluminada por key + fill sai com
   valor quase constante — que é exatamente o "vazio chapado" que este módulo
   existe para eliminar. A rampa vai no COLOR_0 e o shader a multiplica no albedo.

   Os valores são albedo linear, e a escolha central é esta: a parede na altura do
   VEÍCULO (y ≈ 0..4 m) tem de ficar mais ESCURA que a lataria de um caminhão
   branco, senão o branco não se separa do fundo — foi essa colagem que o dono do
   produto leu como "opaco, esbranquiçado". Medido antes: fundo em luminância 110
   contra uma carreta em 141, ou seja 31 níveis de separação num quadro que vai a
   255. Um estúdio de verdade abre bem mais que isso.

   O teto é o oposto: o mais claro da rampa, porque ele é o difusor. Ele quase
   nunca entra no quadro num enquadramento de veículo, mas está em metade do
   hemisfério que a sonda captura.

   OS NÚMEROS SÃO MEDIDOS, NÃO ESCOLHIDOS. Foram levantados varrendo o albedo do
   ciclorama e lendo os pixels do próprio app com `gl.readPixels`, mascarando
   cavalo, implemento e fundo em separado (renderiza-se três vezes escondendo um
   grupo de cada vez; o que muda é a silhueta daquele grupo).

   O achado que fixou a escala: a luminância do implemento BRANCO é praticamente
   INSENSÍVEL à luz — mediana 170 em todas as varreduras, e 194 a 199 ao longo de
   uma variação de 3x na intensidade da key. Um branco já está no ombro da curva
   ACES, então não dá para separar o veículo do fundo subindo a luz: só dá
   BAIXANDO O FUNDO. Medido com o restante do rig fixo (mediana da lataria branca
   presa em 170 em todas as linhas):

     escala do albedo   fundo (mediana)   topo → base   separação branco − fundo
          1.00                137           79 → 143              33
          0.75                120           67 → 125              50
          0.55                103           56 → 108              67
          0.40                 88           47 →  93              82
          0.28                 75           39 →  80              95

   0.50 é o valor adotado: fundo por volta de 95..100, separação ~74, e o
   gradiente vertical ainda com ~50 níveis do topo à base — que é o "gradiente
   suave" que faz o fundo ler como ciclorama de papel e não como recorte.
   Empurrar mais para baixo abre mais separação, mas começa a fechar o fundo em
   preto e um cavalo escuro perde o contorno contra ele.

   Por isso os valores abaixo são tão baixos: eles não descrevem "papel cinza",
   descrevem quanto de albedo sobra depois de uma key que NÃO tem queda com a
   distância. Uma direcional entrega a mesma irradiância no fundo e no veículo —
   num estúdio real o fundo está longe da fonte e cai por 1/d². O albedo baixo é
   o análogo honesto dessa queda. */
/* AS DUAS PRIMEIRAS LINHAS MUDARAM QUANDO O PISO SAIU DA CASCA, e a razão é que
   elas descreviam outra superfície. `[0, 0.043]` e `[0.5, 0.045]` eram o PISO —
   "a poça de luz que apoia o pneu" — de volta quando o piso plano fazia parte
   deste mesmo perfil. Hoje o piso é malha e material próprios (ver FLOOR_GAIN),
   e o que sobrou em y = 0 é o PÉ DA CONCORDÂNCIA.

   Deixá-las como estavam produziu um defeito relatado: *"por que as quinas do
   chão com a parede ficam escuras?"*. O piso subiu 3,6 vezes e o pé da parede
   ficou no valor antigo, então nascia um rodapé escuro em todo o perímetro — e
   nos cantos, onde duas faixas se encontram, ele lia como sujeira.

   O pé da parede agora CASA com o piso e cai daí para cima. Isso é o que uma
   concordância de ciclorama faz na vida real: ela recebe a luz que ricocheteia
   do chão, então é a parte mais clara do fundo, e escurece conforme sobe e vai
   ficando vertical. A medição que importa — `[4.0, 0.036]`, a altura em que o
   fundo tem de ficar abaixo da lataria — está INTOCADA, e é dela para cima que a
   tabela de separação figura/fundo abaixo continua valendo.

   A PRIMEIRA LINHA É A JUNTA, e ela é mais escura que a segunda de propósito —
   ver SEAM_BAND. Duas superfícies que se tocam têm uma fresta que recebe menos
   luz de todas as direções, e é esse fio escuro que diz ao olho que uma encosta
   na outra em vez de estar sobreposta a ela. Ele é escrito nos dois lados: aqui,
   nos primeiros 45 cm da concordância, e em `paintGloss()`, no último metro do
   piso. De um lado só ele viraria degrau. */
const RAMP: Array<[y: number, v: number]> = [
  [0.0, 0.090],   // A JUNTA: a oclusão de contato, do lado da parede
  [0.45, 0.132],  // logo acima dela, o pico da luz que ricocheteia do piso
  [1.6, 0.068],   // a queda dessa luz, dentro da curva
  [4.0, 0.036],   // ALTURA DO VEÍCULO: o fundo tem de ficar abaixo da lataria
  [11.0, 0.029],  // parede baixa — o ponto mais escuro do quadro
  [18.0, 0.035],  // parede alta, subindo de volta rumo ao difusor
  [25.0, 0.075],
  [30.0, 0.115],  // teto = difusor
];

/* ---------------- O PISO DE CONCRETO POLIDO ----------------
   O pedido — *"o chão bem claro e reflexivo"* — não é um ajuste da rampa acima,
   é outra superfície. A rampa descreve PAPEL DE CICLORAMA: fosca, escura de
   propósito, existindo para não competir com a lataria. Um piso de estúdio é o
   contrário disso em três eixos ao mesmo tempo — mais claro, liso, e com um
   reflexo que carrega o próprio sujeito.

   POR QUE O PISO NÃO PODE SIMPLESMENTE HERDAR A RAMPA. Se ele ficasse no valor
   0,043 do y = 0, um reflexo somado por cima cairia sobre um cinza quase preto e
   o resultado leria como poça d'água num asfalto, não como concreto encerado. O
   ganho abaixo o põe onde a foto de referência o põe: claramente acima do pé da
   parede, e na mesma vizinhança de valor do meio do ciclorama.

   ELE CONTINUA SEGUINDO A PASTILHA DE FUNDO — o valor abaixo é multiplicado pelo
   mesmo `albedo` da rampa —, então "Branco" clareia o piso junto e "Preto" o
   apaga inteiro (nesse modo ele nem existe: quem fica é o piso de sombra).

   O VALOR CASA COM O PÉ DA RAMPA, de propósito: `RAMP[0]` foi reautorado para
   0,128 justamente para encontrar este número na linha em que as duas malhas se
   tocam. Um piso claro contra um pé de parede escuro produz um rodapé, e um
   rodapé numa sala sem emenda é a costura que ela existe para não ter.

   A QUEDA PERTO DA PAREDE é só um respiro — 12 % nos últimos metros, e não a
   descida inteira que havia antes. Ela existe porque a luz do estúdio está sobre
   o sujeito e não sobre o fundo, então o chão junto à parede recebe menos; mais
   que isso e volta a virar rodapé. */
const FLOOR_ALBEDO = 0.132;
/** Quanto o piso cede junto à parede, e a partir de que fração do meio-lado. */
const FLOOR_FADE = 0.12;
const FLOOR_FADE_FROM = 0.72;

/* ---------------- A EMENDA, E POR QUE ELA PRECISA DE UMA LINHA ----------------
   Duas superfícies que se encontram no mundo real NUNCA se encontram num valor
   só: há oclusão de contato — a fresta entre elas recebe menos luz de todas as
   direções, e o olho usa esse escurecimento estreito para ler que uma coisa
   ENCOSTA na outra. Sem ele, piso e parede parecem duas imagens sobrepostas, que
   é a leitura de "está faltando alguma coisa nas emendas".

   Ela é ESTREITA de propósito, e essa é a diferença para o rodapé que existia
   antes: 1,4 m de faixa numa sala de 92 m é uma linha, não uma banda. Um
   escurecimento largo lê como sujeira; um estreito lê como junta.

   Ela é escrita nos DOIS lados da junta — no último metro do piso e no primeiro
   metro da concordância — porque uma oclusão de contato de um lado só é um
   degrau, e degrau é exatamente o que a junta não pode ter. */
const SEAM_BAND = 1.4;
const SEAM_DEPTH = 0.30;

/* ---------------- O CONCRETO NÃO É UMA CHAPA ----------------
   Um piso polido de verdade tem manchas: a talocha deixa marcas em arco, o
   polimento abre mais em umas faixas que em outras, e a laje foi lançada em
   panos que curaram em tons ligeiramente diferentes. Um cinza rigorosamente
   uniforme de 92 m é a coisa que mais denuncia uma cena gerada.

   Duas oitavas de seno cruzado sobre METROS DE MUNDO, com períodos que não
   fecham dentro da sala (~46 m e ~13 m). Não é ruído de verdade e não precisa
   ser: o que se pede dele é quebrar a uniformidade, não desenhar concreto — e
   ele é por VÉRTICE, ou seja custa zero por fragmento e nenhuma textura, que é a
   propriedade que faz este cenário valer a pena.

   ±5 %: acima disso vira nuvem e a cena deixa de ser neutra para julgar tinta. */
const FLOOR_MOTTLE = 0.05;

function mottle(x: number, z: number): number {
  return Math.sin(x * 0.137 + z * 0.089) * Math.cos(z * 0.113 - x * 0.071) * 0.62
    + Math.sin(x * 0.481 - z * 0.377) * 0.38;
}

/* A ESCALA DA RAMPA, escolhida pelo usuário na pastilha de "Fundo".
   ---------------------------------------------------------------------------
   1 = a rampa exatamente como está escrita acima, que é o estúdio de hoje. Os
   quatro valores possíveis moram em `BACKDROPS` (scene/presets.ts), junto do
   raciocínio de por que um fundo claro precisa de mais recorte e menos
   exposição.

   ELE CHEGA AQUI PELO RIG, e não por uma chamada. `cycloramaAlbedo` é um campo
   de `RIG_BASE`, então ele atravessa `lerpRig()` como qualquer outro número: a
   troca de fundo é um crossfade de 0,8 s de graça, e este módulo não precisa ser
   importado por scene.ts — o que fecharia um ciclo, já que ele importa scene. */
let albedo = 1;
/* O PISO E O REFLEXO TÊM MULTIPLICADORES PRÓPRIOS, e a razão está medida no
   bloco de `BACKDROPS` (scene/presets.ts): com um número só para as duas
   superfícies, `Cinza claro` e `Branco` entregavam o piso em 245 e 255 de
   luminância — saturado, sem reflexo, sem sombra e sem laje. Papel fosco e
   concreto polido com termo especular somado não podem ser escalados juntos.
   Chegam pelo rig, exatamente como o albedo, e por isso também atravessam o
   crossfade de 0,8 s de graça. */
let floorMul = 1;
let glossMul = 1;

/* Abaixo disto não se reconstrói. Durante um crossfade `onRig` dispara a cada
   quadro, e reescrever ~1 200 vértices 48 vezes para uma diferença que ninguém
   vê é trabalho puro. 1,5 % da faixa é bem menor do que o passo entre duas
   pastilhas vizinhas (a menor razão é 1,00 → 2,80), então nenhuma troca é
   perdida — o que se perde são os degraus intermediários do tween, e para uma
   rampa de albedo isso significa que o fundo assenta em dois ou três saltos
   suaves em vez de sessenta idênticos. */
const ALBEDO_STEP = 0.015;

/* A rampa foi medida numa sala de 30 m de pé-direito, e a sala agora acompanha a
   órbita (ver `sizeRoom`). As duas metades dela NÃO escalam do mesmo jeito, e
   confundi-las estragaria justamente o que ela foi medida para dar:

   · até ~11 m os valores são ABSOLUTOS. Eles descrevem a relação com o VEÍCULO —
     "aos 4 m o fundo tem de ficar abaixo da lataria" —, e um caminhão continua
     tendo 4 m numa sala de 30 ou de 60 m. Escalar esta metade jogaria fora a
     separação figura/fundo que a tabela de medições existe para garantir.
   · daí para cima os valores são a subida rumo ao difusor do teto, e essa é
     PROPORCIONAL ao pé-direito: numa sala mais alta o clareamento tem de
     acontecer mais devagar, ou o teto começa dentro do quadro. */
const RAMP_REF_CEIL = 30;
const RAMP_PIVOT = 11;

function rampAt(y: number): number {
  const v = rampBase(remapY(y));
  return v * albedo;
}

/** Altura real → altura no referencial em que a rampa foi medida. */
function remapY(y: number): number {
  if (y <= RAMP_PIVOT || CEIL_Y <= RAMP_PIVOT) return y;
  const k = (RAMP_REF_CEIL - RAMP_PIVOT) / (CEIL_Y - RAMP_PIVOT);
  return RAMP_PIVOT + (y - RAMP_PIVOT) * k;
}

function rampBase(y: number): number {
  if (y <= RAMP[0][0]) return RAMP[0][1];
  const last = RAMP[RAMP.length - 1];
  if (y >= last[0]) return last[1];
  for (let i = 1; i < RAMP.length; i++) {
    const [y1, v1] = RAMP[i];
    if (y > y1) continue;
    const [y0, v0] = RAMP[i - 1];
    const t = (y - y0) / (y1 - y0);
    /* smoothstep: uma rampa linear deixa marca visível em cada ponto de
       controle, e numa superfície lisa e grande o olho acha essa quina. */
    return v0 + (v1 - v0) * (t * t * (3 - 2 * t));
  }
  return last[1];
}

/* ---------------- perfil ----------------
   Uma polilinha (x = distância ao eixo, y = altura), varrida por `sweepProfile()`
   ao longo do contorno quadrado. O perfil é subdividido bem mais do que a forma
   exige porque as cores de vértice moram nos VÉRTICES: com poucos anéis a rampa
   vira degrau. */
function buildProfile(): THREE.Vector2[] {
  const p: THREE.Vector2[] = [];

  /* O PISO PLANO SAIU DAQUI. Ele é uma malha própria — ver `makeGlossGeometry()`
     — porque deixou de compartilhar material com a casca: a casca é papel de
     ciclorama (`roughness` 0,97) e o piso é concreto polido, com reflexo planar.
     Dois materiais numa casca só seria grupo de índices dependente da ordem do
     perfil, ou seja um acoplamento que quebraria em silêncio na próxima vez que
     alguém mexesse nos anéis.

     O perfil começa, então, EXATAMENTE na tangente da concordância (r = R_FLOOR,
     y = 0), e o piso passa por baixo dela com folga. Nos primeiros centímetros
     além de R_FLOOR a concordância ainda está a menos de 1 cm do chão, então o
     piso fica ABAIXO dela — não há coplanaridade e não há vão. */
  p.push(new THREE.Vector2(R_FLOOR, 0));

  /* concordância piso→parede: quarto de círculo, centro em (R_FLOOR, R_FILLET) */
  const FILLET_RINGS = 18;
  for (let i = 1; i <= FILLET_RINGS; i++) {
    const a = (Math.PI / 2) * (i / FILLET_RINGS);
    p.push(new THREE.Vector2(
      R_FLOOR + R_FILLET * Math.sin(a),
      R_FILLET - R_FILLET * Math.cos(a),
    ));
  }

  /* parede reta */
  const WALL_RINGS = 8;
  for (let i = 1; i <= WALL_RINGS; i++) {
    p.push(new THREE.Vector2(WALL_R, R_FILLET + ((WALL_TOP - R_FILLET) * i) / WALL_RINGS));
  }

  /* concordância parede→teto: centro em (WALL_R - R_CEIL, WALL_TOP) */
  const CEIL_RINGS = 12;
  for (let i = 1; i <= CEIL_RINGS; i++) {
    const a = (Math.PI / 2) * (i / CEIL_RINGS);
    p.push(new THREE.Vector2(
      WALL_R - R_CEIL + R_CEIL * Math.cos(a),
      WALL_TOP + R_CEIL * Math.sin(a),
    ));
  }

  /* teto, da borda ao centro */
  const CEIL_INNER = WALL_R - R_CEIL;
  const TOP_RINGS = 6;
  for (let i = 1; i <= TOP_RINGS; i++) {
    p.push(new THREE.Vector2(CEIL_INNER * (1 - i / TOP_RINGS), CEIL_Y));
  }

  return p;
}

/* ---------------- estado ---------------- */
const group = new THREE.Group();
group.name = 'ts-ciclorama';
group.visible = false;
scene.add(group);

let shell: THREE.Mesh | null = null;
let shellGeo: THREE.BufferGeometry | null = null;
let shellMat: THREE.MeshStandardMaterial | null = null;

/* ---------------- o piso "sem sala" ----------------
   O fundo PRETO (`albedo: 0` em BACKDROPS) não é uma sala escura: é a AUSÊNCIA
   de sala. A casca some e a cor de limpeza — preta — vira o fundo. O pedido é
   que a luz fique só no cavalo e no implemento, e uma superfície de fundo, por
   mais escura que seja, sempre recebe alguma.

   O que NÃO pode sumir junto é a sombra de contato: sem chão o veículo flutua, e
   um caminhão flutuando sobre preto lê como recorte mal feito. `ShadowMaterial`
   é o único material do three que escreve SÓ a máscara de sombra — onde não há
   sombra ele não desenha nada, então ele dá o apoio sem devolver o fundo.

   Ele é irmão do plano de `scene/capture.ts`, e os dois existem separados de
   propósito: aquele vive DURANTE uma captura de recorte e some depois; este é
   estado de cena, e fica de pé enquanto o fundo preto estiver escolhido. */
let floor: THREE.Mesh | null = null;

function ensureFloor(): THREE.Mesh {
  if (floor) return floor;
  const geo = new THREE.PlaneGeometry(R_FLOOR * 2, R_FLOOR * 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShadowMaterial({ opacity: 0.5 });
  mat.name = 'CICLORAMA_PISO';
  floor = new THREE.Mesh(geo, mat);
  floor.name = 'ciclorama-piso';
  floor.receiveShadow = true;
  floor.castShadow = false;
  floor.matrixAutoUpdate = false;
  floor.updateMatrix();
  group.add(floor);
  return floor;
}

/* ---------------- o piso de verdade ----------------
   ELE USA O MESMO `ringXZ()` DA CASCA, em anéis concêntricos do centro até a
   borda. Não é elegância: é a única forma de a junta fechar por CONSTRUÇÃO. Um
   `PlaneGeometry` quadrado — que foi a primeira versão — tem quina viva em
   (R_FLOOR, R_FLOOR), enquanto o pé da parede tem ali um canto concordado de
   3 m; a quina do piso ficava 1,2 m ADIANTE do pé da parede e atravessava para
   fora dela, aparecendo como um triângulo de piso nascendo atrás do rodapé nos
   quatro cantos. Com o mesmo contorno, a borda do piso é exatamente o pé da
   parede em todo ponto.

   A FOLGA além de `R_FLOOR` é o que fecha o resto da junta. A concordância sobe
   por um quarto de círculo de raio `R_FILLET`; a 0,35 m da tangente ela está a
   apenas 2 cm do chão, então esse pedaço do piso passa POR BAIXO dela e some.
   Sem a folga, um erro de meio milímetro entre as duas malhas abriria uma linha
   do fundo do mundo bem na base da parede.

   ELA ENCOLHEU JUNTO COM O RAIO. Com a concordância de 14 m, 0,6 m de folga
   ficavam a 1,3 cm de altura; com 3 m de raio, os mesmos 0,6 m já estariam a
   6 cm — uma fresta em que se enxerga a beirada do piso por baixo, de câmera
   rasante. As duas medidas andam juntas por construção. */
const FLOOR_OVERLAP = 0.35;
/** Anéis do centro à borda. Só existem para carregar a clareada nos vértices. */
const FLOOR_RINGS = 40;

/**
 * Onde fica o anel `t` ∈ [0,1], como fração do meio-lado.
 *
 * Metade linear, metade adensada na BORDA. A junta com a parede é uma faixa de
 * 1,4 m sobre um piso de 92 m, e um passo uniforme de 1,2 m a desenharia com um
 * anel — ou seja, como um degrau. A metade linear é o que impede o centro de
 * ficar grosseiro demais para a variação da laje.
 */
const ringAt = (t: number) => 0.55 * t + 0.45 * (1 - (1 - t) * (1 - t));

let gloss: THREE.Mesh | null = null;
let glossGeo: THREE.BufferGeometry | null = null;
let glossMat: THREE.MeshStandardMaterial | null = null;

function makeGlossGeometry(): THREE.BufferGeometry {
  const outer = R_FLOOR + FLOOR_OVERLAP;
  const pos = new Float32Array((FLOOR_RINGS + 1) * RING * 3);
  const p = new THREE.Vector2();
  let k = 0;
  for (let r = 0; r <= FLOOR_RINGS; r++) {
    /* Anel 0 é o centro (meio-lado zero) e o anel N é a borda — ver `ringAt`. */
    const o = outer * ringAt(r / FLOOR_RINGS) - R_FLOOR;
    for (let i = 0; i < RING; i++) {
      ringXZ(o, i, p);
      pos[k++] = p.x; pos[k++] = 0; pos[k++] = p.y;
    }
  }
  const idx: number[] = [];
  for (let r = 0; r < FLOOR_RINGS; r++) {
    for (let i = 0; i < RING; i++) {
      const a = r * RING + i;
      const b = r * RING + ((i + 1) % RING);
      idx.push(a, b, a + RING, b, b + RING, a + RING);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  /* Normal constante para cima: `computeVertexNormals()` gastaria uma varredura
     para descobrir o que já se sabe, e num plano ele ainda erraria nos
     triângulos degenerados do anel central. */
  const nor = new Float32Array(pos.length);
  for (let i = 1; i < nor.length; i += 3) nor[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return g;
}

/** Escreve a clareada do piso. Mesmo contrato de `paintRamp()`. */
function paintGloss() {
  if (!glossGeo) return;
  const pos = glossGeo.getAttribute('position');
  const col = glossGeo.getAttribute('color') as THREE.BufferAttribute | undefined;
  const arr = col ? (col.array as Float32Array) : new Float32Array(pos.count * 3);
  const bright = FLOOR_ALBEDO * floorMul;
  const d0 = R_FLOOR * FLOOR_FADE_FROM;
  for (let i = 0; i < pos.count; i++) {
    /* DISTÂNCIA DE CHEBYSHEV, e não euclidiana: o que a clareada tem de
       acompanhar é o PÉ DA PAREDE, e ele é um quadrado. Com o raio euclidiano a
       banda escura chegaria ao meio dos lados antes de chegar aos cantos, e o
       resultado seria uma mancha redonda desenhada num piso quadrado — visível
       justamente onde o piso é mais claro. */
    const x = pos.getX(i), z = pos.getZ(i);
    const d = Math.max(Math.abs(x), Math.abs(z));
    const t = THREE.MathUtils.smoothstep(d, d0, R_FLOOR);
    /* A oclusão de contato entra por ÚLTIMO e multiplica: ela é sombra, não
       albedo, e sombra não se soma à variação da laje. */
    const seam = 1 - SEAM_DEPTH * THREE.MathUtils.smoothstep(d, R_FLOOR - SEAM_BAND, R_FLOOR);
    const v = bright * (1 - FLOOR_FADE * t) * (1 + FLOOR_MOTTLE * mottle(x, z)) * seam;
    arr[i * 3] = v; arr[i * 3 + 1] = v; arr[i * 3 + 2] = v;   // neutro exato
  }
  if (col) col.needsUpdate = true;
  else glossGeo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}

/** `albedo === 0` → sem sala: casca escondida, piso de sombra no lugar. */
function applyShellMode() {
  const bare = albedo <= 0;
  if (shell) shell.visible = !bare;
  if (gloss) gloss.visible = !bare;
  /* O piso só é CONSTRUÍDO quando alguém escolhe o preto — quem nunca usar esse
     fundo não paga geometria nenhuma por ele. */
  if (bare) ensureFloor().visible = true;
  else if (floor) floor.visible = false;
  /* O TETO SAI JUNTO COM A CASCA, e esta linha faltava.
     "Preto é SEM SALA, não sala escura" é o pedido inteiro do fundo preto (ver
     BACKDROPS), e a sala não é só a parede: a foto do fundo preto mostrava
     laje, vigas, os painéis acesos e quatro dezenas de spots pendurados no
     vazio. Um teto de galpão flutuando sobre nada não é "a luz só no cavalo e
     no trailer" — é a sala inteira menos as paredes.
     A luz não muda com isso: ceiling.ts nunca iluminou nem projetou sombra (ver
     o cabeçalho dele). O que sai da cena é geometria e emissivo — e o que o
     verniz continua refletindo são as barras do IBL do estúdio, que
     buildStudioEnv() desenha porque num limbo preto as softboxes existem, só
     não aparecem no quadro. */
  setStudioCeiling(!bare);
  /* NO MODO PRETO O REFLEXO SAI JUNTO, e não porque ele ficaria feio: o piso que
     fica de pé é `ShadowMaterial`, que não tem para onde receber o termo. Zerar
     a força também dispensa a passada de renderização inteira — ver o gancho de
     quadro lá embaixo. */
  setFloorReflectionAmount(bare ? 0 : glossMul);
  invalidateShadows();
}

/* Lê o rig e repinta o que mudou. UM caminho para as duas portas de entrada —
   o gancho `onRig` e o acender da sala —, porque a segunda esquecia
   `paintGloss()`: entrar no cenário com um fundo salvo repintava a parede e
   deixava o PISO com o albedo da visita anterior. Era metade literal do relato
   "as cores não refletem no piso, só nas paredes".
   @returns true se alguma coisa foi repintada. */
function syncBackdrop(rig: { cycloramaAlbedo: number; cycloramaFloor: number; cycloramaGloss: number },
  force: boolean): boolean {
  const wantA = Math.max(0, rig.cycloramaAlbedo);
  const wantF = Math.max(0, rig.cycloramaFloor);
  const wantG = Math.max(0, rig.cycloramaGloss);
  /* O ZERO É EXATO, e não "abaixo do passo": ele é um MODO (sem sala), não um
     valor baixo. Deixá-lo passar pelo filtro de ALBEDO_STEP faria a troca para
     preto depender de quão longe o fundo anterior estava — trocar de
     `cinza-escuro` (1,0) para preto entraria, e de um preto para outro não. */
  const modeChanged = (wantA <= 0) !== (albedo <= 0);
  const moved = Math.abs(wantA - albedo) >= ALBEDO_STEP
    || Math.abs(wantF - floorMul) >= ALBEDO_STEP
    || Math.abs(wantG - glossMul) >= ALBEDO_STEP;
  if (!force && !modeChanged && !moved) return false;
  albedo = wantA; floorMul = wantF; glossMul = wantG;
  if (modeChanged || force) applyShellMode();
  else setFloorReflectionAmount(albedo <= 0 ? 0 : glossMul);
  if (albedo > 0) { paintRamp(); paintGloss(); }
  return true;
}

/* Reescreve as cores de vértice a partir da rampa e do albedo corrente.
   ---------------------------------------------------------------------------
   Um `Float32Array` de ~3 600 floats e um `needsUpdate` — NENHUMA geometria é
   reconstruída. A forma da sala não depende do fundo: o que muda é só quanta
   luz cada anel devolve. Fosse um rebuild de `LatheGeometry`, trocar de fundo
   custaria uma realocação de buffer de GPU por clique. */
function paintRamp() {
  if (!shellGeo) return;
  const pos = shellGeo.getAttribute('position');
  const col = shellGeo.getAttribute('color') as THREE.BufferAttribute | undefined;
  const arr = col ? (col.array as Float32Array) : new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const v = rampAt(pos.getY(i));
    arr[i * 3] = v; arr[i * 3 + 1] = v; arr[i * 3 + 2] = v;   // neutro exato
  }
  if (col) col.needsUpdate = true;
  else shellGeo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}

/* Refaz a casca com o perfil corrente. Chamado por `build()` e sempre que
   `sizeRoom()` disser que a sala mudou de tamanho — o que acontece quando o
   implemento troca de medidas e a órbita cresce com ele.
   Um `LatheGeometry` de ~1 200 vértices; refazê-lo é barato e acontece uma vez
   por mudança de rig, não por quadro. */
function rebuildShell() {
  if (!shell) return;
  const old = shellGeo;
  shellGeo = sweepProfile(buildProfile());
  paintRamp();
  shell.geometry = shellGeo;
  old?.dispose();
  if (gloss) {
    const g = glossGeo;
    glossGeo = makeGlossGeometry();
    paintGloss();
    gloss.geometry = glossGeo;
    g?.dispose();
  }
  if (floor) {
    const g = floor.geometry;
    floor.geometry = new THREE.PlaneGeometry(R_FLOOR * 2, R_FLOOR * 2).rotateX(-Math.PI / 2);
    g.dispose();
  }
  invalidateShadows();
}

function build() {
  if (shell) return;

  shellGeo = sweepProfile(buildProfile());
  paintRamp();

  shellMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,          // o valor vem inteiro do COLOR_0
    vertexColors: true,
    roughness: 0.97,          // papel/tinta fosca de ciclorama, não piso polido
    metalness: 0,
    /* DoubleSide porque a câmera fica DENTRO da superfície revolvida. O three
       inverte a normal para faces de trás no próprio shader (gl_FrontFacing), o
       que mantém a iluminação correta sem depender do sentido do enrolamento —
       e o sentido do enrolamento de um `LatheGeometry` muda com o perfil. */
    side: THREE.DoubleSide,
    /* Baixo de propósito. Este é o único objeto grande da cena, então integrar o
       ambiente inteiro nele devolveria luz demais para o próprio ambiente e o
       cinza viraria leitoso — a mesma armadilha já documentada no `armazem`.
       0.10 e não 0.25: medido com o albedo zerado, a casca ainda renderizava a
       41,7 de luminância só de especular do RoomEnvironment. Num fundo cujo alvo
       inteiro é ~100, quarenta desses vindos de brilho ambiente é um verniz — e
       verniz é exatamente o que um ciclorama de papel não tem. */
    envMapIntensity: 0.10,
  });
  shellMat.name = 'CICLORAMA';

  shell = new THREE.Mesh(shellGeo, shellMat);
  shell.name = 'ciclorama-shell';
  /* Recebe, nunca projeta: a sombra que importa é a do veículo no piso, e uma
     sala fechada projetando sobre si mesma só gasta o mapa de sombra. */
  shell.receiveShadow = true;
  shell.castShadow = false;
  shell.matrixAutoUpdate = false;
  shell.updateMatrix();
  group.add(shell);

  glossGeo = makeGlossGeometry();
  paintGloss();
  glossMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,          // o valor vem inteiro do COLOR_0
    vertexColors: true,
    /* CONCRETO ENCERADO, e não vidro. Uma `roughness` mais baixa transformaria o
       reflexo planar num espelho e o piso deixaria de ter superfície: o que se
       veria seria um segundo caminhão de cabeça para baixo, com a borda dura, e
       é aí que o olho lê "cena de videogame". 0,22 é o ponto em que o realce
       especular do RoomEnvironment ainda se abre em faixa — e o borrão por
       distância do reflexo (ver floor-reflection.ts) faz o resto. */
    roughness: 0.22,
    /* ZERO. Concreto polido é dielétrico; a metalicidade tingiria o reflexo pela
       cor do piso e mataria o termo difuso, que é justamente o que faz o chão
       ficar CLARO em vez de ficar preto-espelhado. */
    metalness: 0,
    /* Acima da casca (0,10), mas BEM abaixo do 0,55 da primeira versão. O
       `scene.environment` do estúdio é o `RoomEnvironment`, uma caixa com
       painéis emissivos; num piso a 0,22 de rugosidade ele não devolve "brilho
       difuso", devolve os PAINÉIS — manchas claras e escuras do tamanho da sala,
       que foi o que o dono do produto viu como um borrão branco num canto e
       cunhas escuras nos outros. O reflexo planar é quem tem de carregar o que
       está na cena; o que fica aqui é só o assentamento geral do verniz. */
    envMapIntensity: 0.22,
    side: THREE.FrontSide,
  });
  glossMat.name = 'CICLORAMA_PISO_POLIDO';
  installFloorReflection(glossMat);

  gloss = new THREE.Mesh(glossGeo, glossMat);
  gloss.name = 'ciclorama-piso-polido';
  gloss.receiveShadow = true;
  gloss.castShadow = false;
  gloss.matrixAutoUpdate = false;
  gloss.updateMatrix();
  group.add(gloss);
}

/* ---------------- centro: o RIG, não a origem do mundo ----------------
   MEDIDO: o grupo `RIG` fica em (0, 0, 22) e o conjunto ocupa z de 17,9 a 35,7.
   Uma sala centrada na origem do mundo deixaria a traseira do implemento
   praticamente encostada na parede, e a caixa de órbita — que
   `setInteriorBounds()` mede a partir da ORIGEM — proibiria a câmera de passar
   por trás do baú (z máximo 30 contra uma traseira em 35,7).
   Então a sala e a caixa seguem o rig. É lido do grafo por nome, e não
   importado de vehicle/models.ts, porque scene/** não depende de vehicle/**. */
let lastX = NaN, lastZ = NaN;

/* ---------------- a pegada do veículo, para a oclusão de contato ----------
   Ela NÃO segue o centro da sala: a sala anda com o `RIG` (um nó), e a pegada é
   a CAIXA do conjunto — que muda quando o implemento é redimensionado sem o nó
   sair do lugar. Por isso vira uma comparação própria.
   Quatro comparações de número por quadro, sobre valores que `setVehicleFocus()`
   já mantém em cache: nada é medido aqui. */
let lastFoot = '';

function syncContact() {
  const f = vehicleFootprint();
  if (!f) {
    if (lastFoot === '') return;
    lastFoot = '';
    setFloorContact(0, 0, 0, 0);
    invalidate();
    return;
  }
  const sig = `${f.cx.toFixed(2)},${f.cz.toFixed(2)},${f.hx.toFixed(2)},${f.hz.toFixed(2)}`;
  if (sig === lastFoot) return;
  lastFoot = sig;
  setFloorContact(f.cx, f.cz, f.hx, f.hz);
  invalidate();
}

function syncCenter() {
  if (!group.visible) return;
  syncContact();
  const rig = scene.getObjectByName('RIG');
  if (!rig) return;
  /* A SALA É REMEDIDA ANTES DO CENTRO, e o teste dela vem primeiro no `||`:
     trocar as medidas do implemento muda `maxDistance` sem mexer na posição do
     rig, e um `return` antecipado pela comparação de x/z deixaria a sala do
     tamanho antigo — que é a briga entre a órbita e a caixa que este bloco
     existe para acabar. */
  const resized = sizeRoom();
  if (resized) rebuildShell();
  const x = rig.position.x, z = rig.position.z;
  if (!resized && x === lastX && z === lastZ) return;
  lastX = x; lastZ = z;
  group.position.set(x, 0, z);                 // y=0: o piso é o piso do mundo
  group.updateMatrixWorld(true);
  /* A caixa de órbita anda junto. É daqui e não de environment.ts porque só
     este módulo sabe onde a sala está — e environment.ts foi instruído a não
     chamar `setInteriorBounds()` no cenário de estúdio justamente para não
     sobrescrever esta com uma caixa centrada na origem. */
  setInteriorBounds({ halfX: HALF, halfZ: HALF, minY: 0.5, maxY: MAX_Y, centerX: x, centerZ: z });
  /* O TETO É DIMENSIONADO DAQUI pelo mesmo motivo que a caixa de órbita é: só
     este módulo sabe onde a sala está e quanto ela mede, e um segundo módulo
     medindo a mesma coisa por conta própria é a receita para os dois
     divergirem. `scene/ceiling.ts` não importa este arquivo — o dado desce, e a
     dependência é de mão única. */
  sizeStudioCeiling({ floorR: R_FLOOR, ceilY: CEIL_Y, centerX: x, centerZ: z });
  /* Onde o brilho do piso morre, em coordenadas de MUNDO — o shader não tem como
     saber que a sala andou junto com o rig. A faixa começa bem antes da junta
     (metade do último terço) porque um reflexo que só apaga no rodapé ainda
     desenha a parede espelhada logo antes dele. */
  setFloorReflectionFade(x, z, R_FLOOR * 0.80, R_FLOOR - SEAM_BAND * 0.4);
  invalidateShadows();
  invalidate();
}

/**
 * Liga ou desliga a sala de ciclorama.
 * Ligada, ela também passa a mandar na caixa de órbita — ver `syncCenter()`.
 * @param {boolean} on
 */
export function setCyclorama(on: boolean) {
  if (on) build();
  group.visible = on;
  if (on) {
    /* O TETO ACENDE COM A SALA — mas quem o acende é `applyShellMode()`, dentro
       de syncBackdrop(): uma laje escura no alto sem a casca clara atrás dela
       não lê como teto, lê como recorte, e no fundo PRETO não há casca nenhuma
       atrás dela. A chamada incondicional que havia aqui era o que punha o
       galpão de pé no meio do limbo preto.

       O fundo é lido do rig ATUAL, e não esperado do próximo `onRig`. O gancho
       lá embaixo sai cedo enquanto a sala está escondida — que é o estado em
       cinco dos seis cenários —, então ao acender ela estaria pintada com o
       fundo da última vez em que esteve visível, ou com o de fábrica numa
       primeira visita cujo fundo salvo é "Preto". Um quadro com o fundo errado
       ao trocar de cenário é exatamente o tipo de coisa que aparece na gravação
       e em mais lugar nenhum.

       `force`: acender a sala é o momento em que casca, piso e teto entram na
       cena, e quais deles ficam de pé é função do fundo corrente — inclusive
       quando ele é o mesmo de antes. */
    const rig = getRig();
    syncBackdrop({
      cycloramaAlbedo: rig?.cycloramaAlbedo ?? 1,
      cycloramaFloor: rig?.cycloramaFloor ?? 1,
      cycloramaGloss: rig?.cycloramaGloss ?? 1,
    }, true);
    lastX = NaN; lastZ = NaN; syncCenter();
  } else {
    setStudioCeiling(false);
  }
  invalidateShadows();
  invalidate();
}

/* O rig se move quando o implemento troca de medidas, e a sala tem de ir junto.
   O gancho é barato: duas comparações por quadro e nada mais enquanto o rig
   estiver parado, que é o caso em 100% dos quadros fora de uma troca. */
onFrame(syncCenter);

/* ---------------- a passada de reflexo ----------------
   AQUI, E NÃO DENTRO DE floor-reflection.ts, porque quem sabe se há piso é este
   módulo: a sala pode estar apagada (cinco dos seis cenários), pode estar no
   modo preto (piso de sombra, sem material para receber o termo) e pode ainda
   nem ter sido construída. Um gancho lá dentro teria de perguntar as três coisas
   a este arquivo por importação inversa.

   OS GANCHOS DE QUADRO RODAM ANTES do `renderer.render()` do laço — é isso que
   torna este o lugar certo e não uma coincidência: o alvo do reflexo fica pronto
   no mesmo quadro em que o piso vai lê-lo. Um reflexo desenhado depois seria o
   quadro anterior, e num giro isso é um borrão de um quadro de atraso.

   `onDrawFrame` E NÃO `onFrame`, e a diferença passou a valer dinheiro quando o
   laço virou sob demanda. Este gancho é a única SEGUNDA PASSADA COMPLETA da
   cena que o engine tem — 14,1 fps, medidos em `floor-reflection.ts`. Em
   `onFrame` ele rodaria também nos quadros que o laço decide não desenhar, ou
   seja sessenta vezes por segundo com a cena parada, preenchendo um alvo que
   ninguém vai amostrar: o cenário Estúdio pagaria o laço contínuo inteiro sem
   receber nenhuma economia dele. A lista de desenho roda no mesmo ponto do
   quadro (depois da câmera estar na pose verdadeira, antes do `render()` do
   laço), só que apenas quando há quadro. */
onDrawFrame(() => {
  if (!group.visible || !gloss || !gloss.visible) return;
  /* O NÍVEL BAIXO NÃO PAGA A SEGUNDA PASSADA. É o item mais caro do cenário
     mais caro — 14,1 fps medidos, mais 96,7 MB de VRAM no alvo (dos quais ~79
     são o buffer `samples: 4`), o que faz dela o segundo maior item de memória
     da cena inteira, atrás só dos conjuntos de chão.

     Lido por quadro em vez de empurrado por `onQualityChange` porque um termo
     que LÊ não tem como ficar dessincronizado de quem escreve.

     ⚠️ A COMPARAÇÃO É CONTRA `'off'`, E TEM DE SER EXPLÍCITA. O campo era
     `boolean` e virou `'full' | 'lod' | 'off'` quando o degrau intermediário
     entrou. Um `if (!getProfile().floorReflection)` continua COMPILANDO com o
     tipo novo e passa a estar sempre errado, porque `'off'` é uma string não
     vazia e portanto truthy — o nível Baixo pagaria a passada inteira
     silenciosamente, e nenhum verificador de tipos acusaria. Se este campo
     ganhar um quarto estado, é esta linha que se lê primeiro. */
  if (getProfile().floorReflection === 'off') return;
  renderFloorReflection(camera, group.position.y, gloss);
});

/* O FUNDO chega por aqui — ver a nota de `albedo`. `onRig` é disparado na
   inscrição e a cada quadro de crossfade, então a sala acompanha a escolha do
   usuário sem que scene.ts precise saber que este módulo existe.
   A guarda de `group.visible` é o que mantém isto grátis nos cinco cenários que
   não têm ciclorama: lá o gancho lê um número e volta. */
onRig((rig) => {
  if (!group.visible || !shellGeo) return;
  /* A sala é o que recebe a sombra do veículo, e o valor dela acabou de mudar —
     o mapa não muda, mas o quadro sim. */
  if (syncBackdrop(rig, false)) invalidate();
});

/** @returns {boolean} */
export const isCycloramaOn = () => group.visible;

/* O reflexo é a única coisa cara desta sala, e a alça para ligá-lo e desligá-lo
   sai por aqui — não por floor-reflection.ts — porque é este módulo que o
   console e a bancada já alcançam. É com ela que o custo dele é MEDIDO (o A/B de
   fps em tools/studio-bench/checks-estudio.mjs). */
export {
  setFloorReflection, isFloorReflectionOn, setFloorReflectionScale,
  floorReflectionTarget,
} from './floor-reflection';

/**
 * Desenha a passada de reflexo do piso para uma câmera que NÃO é a do laço.
 *
 * Existe por causa de `scene/capture.ts`: ele renderiza em ladrilhos, com uma
 * CÓPIA da câmera e o laço parado, então o alvo do reflexo estaria congelado no
 * último quadro vivo — e o sintoma seria uma foto em que o piso reflete um
 * enquadramento que não é o da foto. Chamar isto uma vez antes do mosaico, com a
 * câmera da captura e ANTES do primeiro `setViewOffset()`, resolve os dezesseis
 * ladrilhos de uma vez: a matriz de textura descreve o quadro inteiro, e cada
 * ladrilho só amostra o pedaço dela que lhe cabe.
 *
 * @returns {boolean} false se não havia piso a refletir — quem chama ignora.
 */
export function renderCycloramaReflection(cam: THREE.PerspectiveCamera): boolean {
  if (!group.visible || !gloss || !gloss.visible) return false;
  /* SEM O GATE DO PERFIL DE QUALIDADE, e a ausência é o ponto — não um
     esquecimento. Este é o caminho da CAPTURA, e a regra do perfil (ver o
     cabeçalho de `core/quality.ts`) é que a imagem baixada sai sempre no teto:
     um PC fraco pode ter uma vista 3D sem reflexo e ainda assim baixar a mesma
     foto que o PC bom baixa, só demorando mais para gerá-la. O gancho de quadro
     lá em cima, que é o que o usuário ARRASTA, é o único que consulta o nível. */
  renderFloorReflection(cam, group.position.y, gloss);
  return true;
}

/** Libera a geometria e o material. Chamado quando o estúdio solta a cena. */
export function disposeCyclorama() {
  if (shell) group.remove(shell);
  shellGeo?.dispose();
  shellMat?.dispose();
  shell = null; shellGeo = null; shellMat = null;
  if (gloss) group.remove(gloss);
  glossGeo?.dispose();
  if (glossMat) uninstallFloorReflection(glossMat);
  glossMat?.dispose();
  gloss = null; glossGeo = null; glossMat = null;
  disposeFloorReflection();
  disposeStudioCeiling();
  if (floor) {
    group.remove(floor);
    floor.geometry.dispose();
    (floor.material as THREE.Material).dispose();
    floor = null;
  }
  group.visible = false;
  invalidate();
}
