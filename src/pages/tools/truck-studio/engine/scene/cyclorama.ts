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
   perfil (piso → concordância → parede → concordância → teto) é revolvido em
   torno de Y: de qualquer ângulo o que se vê é piso, curva e parede, sem emenda,
   sem quina e sem borda de geometria entrando no quadro.

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
import { scene, invalidate, invalidateShadows, setInteriorBounds, onFrame } from './scene';

/* ---------------- medidas, em metros ----------------
   O conjunto cavalo + implemento tem ~19 m de comprimento e ~4 m de altura, e a
   órbita do estúdio chega a ~25 m do centro. Todo número abaixo sai dessas três
   medidas, não de gosto. */

/** Meia-caixa de órbita, EM TORNO DO RIG (ver CENTRO, abaixo). A sala tem de
 *  conter esta caixa inteira, senão a câmera atravessa a parede e o usuário vê o
 *  ciclorama por fora, que é um saco cinza.
 *  Não dava para deixar a órbita solta: `setVehicleFocus()` calcula
 *  `maxDistance` como 2,6x o raio do rig, e num conjunto cavalo + carreta isso
 *  mede 54,7 m — medido no app, não estimado. Uma sala que contivesse 54,7 m em
 *  todas as direções teria 130 m de vão e 60 m de pé-direito para fotografar um
 *  veículo de 19 m, e aí o fundo fica tão longe que volta a não ter gradiente. */
const HALF = 30;
const MAX_Y = 20;

/** Raio do piso plano. Deixa ~18 m de chão além da ponta do implemento, que é o
 *  que impede a concordância de aparecer atrás do baú num plano aberto. */
const R_FLOOR = 36;
/** Raio da concordância piso→parede. Grande de propósito: é ela que faz o fundo
 *  ser "sem emenda". Abaixo de ~8 m a curva vira uma quina visível. */
const R_FILLET = 14;
/** Onde a parede vertical termina e começa a concordância do teto. */
const WALL_TOP = 18;
/** Raio da concordância parede→teto. */
const R_CEIL = 12;

const WALL_R = R_FLOOR + R_FILLET;          // 50 m — a parede fica aqui
const CEIL_Y = WALL_TOP + R_CEIL;           // 30 m — altura do teto plano

/* Confere a folga: o canto mais distante da caixa de órbita está a
   sqrt(30² + 30²) = 42,4 m do centro, contra 50 m de parede. */

/** Gomos da revolução. 96 não mostra faceta nem no reflexo do cromado. */
const SEGMENTS = 96;

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
const RAMP: Array<[y: number, v: number]> = [
  [0.0, 0.043],   // piso sob o veículo — a poça de luz que apoia o pneu
  [0.5, 0.045],   // piso afastado, leve clareada: dá leitura de superfície
  [4.0, 0.036],   // ALTURA DO VEÍCULO: o fundo tem de ficar abaixo da lataria
  [11.0, 0.029],  // parede baixa — o ponto mais escuro do quadro
  [18.0, 0.035],  // parede alta, subindo de volta rumo ao difusor
  [25.0, 0.075],
  [30.0, 0.115],  // teto = difusor
];

function rampAt(y: number): number {
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
   `LatheGeometry` revolve uma polilinha (x = raio, y = altura) em torno de Y. O
   perfil é subdividido bem mais do que a forma exige porque as cores de vértice
   moram nos VÉRTICES: com poucos anéis a rampa vira degrau. */
function buildProfile(): THREE.Vector2[] {
  const p: THREE.Vector2[] = [];

  /* piso, do centro à borda */
  const FLOOR_RINGS = 10;
  for (let i = 0; i <= FLOOR_RINGS; i++) {
    p.push(new THREE.Vector2((R_FLOOR * i) / FLOOR_RINGS, 0));
  }

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
let shellGeo: THREE.LatheGeometry | null = null;
let shellMat: THREE.MeshStandardMaterial | null = null;

function build() {
  if (shell) return;

  shellGeo = new THREE.LatheGeometry(buildProfile(), SEGMENTS);

  /* rampa de valor nos vértices */
  const pos = shellGeo.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const v = rampAt(pos.getY(i));
    col[i * 3] = v; col[i * 3 + 1] = v; col[i * 3 + 2] = v;   // neutro exato
  }
  shellGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));

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

function syncCenter() {
  if (!group.visible) return;
  const rig = scene.getObjectByName('RIG');
  if (!rig) return;
  const x = rig.position.x, z = rig.position.z;
  if (x === lastX && z === lastZ) return;      // só quando muda de verdade
  lastX = x; lastZ = z;
  group.position.set(x, 0, z);                 // y=0: o piso é o piso do mundo
  group.updateMatrixWorld(true);
  /* A caixa de órbita anda junto. É daqui e não de environment.ts porque só
     este módulo sabe onde a sala está — e environment.ts foi instruído a não
     chamar `setInteriorBounds()` no cenário de estúdio justamente para não
     sobrescrever esta com uma caixa centrada na origem. */
  setInteriorBounds({ halfX: HALF, halfZ: HALF, minY: 0.5, maxY: MAX_Y, centerX: x, centerZ: z });
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
  if (on) { lastX = NaN; lastZ = NaN; syncCenter(); }
  invalidateShadows();
  invalidate();
}

/* O rig se move quando o implemento troca de medidas, e a sala tem de ir junto.
   O gancho é barato: duas comparações por quadro e nada mais enquanto o rig
   estiver parado, que é o caso em 100% dos quadros fora de uma troca. */
onFrame(syncCenter);

/** @returns {boolean} */
export const isCycloramaOn = () => group.visible;

/** Libera a geometria e o material. Chamado quando o estúdio solta a cena. */
export function disposeCyclorama() {
  if (shell) group.remove(shell);
  shellGeo?.dispose();
  shellMat?.dispose();
  shell = null; shellGeo = null; shellMat = null;
  group.visible = false;
  invalidate();
}
