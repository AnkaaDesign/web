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
import {
  scene, invalidate, invalidateShadows, setInteriorBounds, onFrame, onRig, getRig,
  controls,
} from './scene';

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
/** Chão além da parede-tangente, para a concordância não aparecer atrás do baú. */
const R_FILLET = 14;
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
     `/√2` porque a caixa é quadrada e a parede é redonda: o canto da caixa é o
     ponto mais distante do centro, e é ele que tem de caber. */
  HALF = Math.floor(((WALL_R - 2) / Math.SQRT2));
  MAX_Y = Math.max(8, CEIL_Y - 4);
  return true;
}

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

/** `albedo === 0` → sem sala: casca escondida, piso de sombra no lugar. */
function applyShellMode() {
  const bare = albedo <= 0;
  if (shell) shell.visible = !bare;
  /* O piso só é CONSTRUÍDO quando alguém escolhe o preto — quem nunca usar esse
     fundo não paga geometria nenhuma por ele. */
  if (bare) ensureFloor().visible = true;
  else if (floor) floor.visible = false;
  invalidateShadows();
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
  shellGeo = new THREE.LatheGeometry(buildProfile(), SEGMENTS);
  paintRamp();
  shell.geometry = shellGeo;
  old?.dispose();
  if (floor) {
    const g = floor.geometry;
    floor.geometry = new THREE.PlaneGeometry(R_FLOOR * 2, R_FLOOR * 2).rotateX(-Math.PI / 2);
    g.dispose();
  }
  invalidateShadows();
}

function build() {
  if (shell) return;

  shellGeo = new THREE.LatheGeometry(buildProfile(), SEGMENTS);
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
    /* O albedo é lido do rig ATUAL, e não esperado do próximo `onRig`.
       O gancho lá embaixo sai cedo enquanto a sala está escondida — que é o
       estado em cinco dos seis cenários —, então ao acender ela estaria pintada
       com o albedo da última vez em que esteve visível, ou com o 1 de fábrica
       numa primeira visita cujo fundo salvo é "Preto". Um quadro com o fundo
       errado ao trocar de cenário é exatamente o tipo de coisa que aparece na
       gravação e em mais lugar nenhum. */
    const want = Math.max(0, getRig()?.cycloramaAlbedo ?? 1);
    const modeChanged = (want <= 0) !== (albedo <= 0);
    if (modeChanged || Math.abs(want - albedo) >= ALBEDO_STEP) {
      albedo = want;
      if (albedo > 0) paintRamp();
    }
    /* SEMPRE, e não só quando mudou: acender a sala é o momento em que casca e
       piso entram na cena, e qual dos dois fica de pé é função do albedo
       corrente — inclusive quando ele é o mesmo de antes. */
    applyShellMode();
    lastX = NaN; lastZ = NaN; syncCenter();
  }
  invalidateShadows();
  invalidate();
}

/* O rig se move quando o implemento troca de medidas, e a sala tem de ir junto.
   O gancho é barato: duas comparações por quadro e nada mais enquanto o rig
   estiver parado, que é o caso em 100% dos quadros fora de uma troca. */
onFrame(syncCenter);

/* O FUNDO chega por aqui — ver a nota de `albedo`. `onRig` é disparado na
   inscrição e a cada quadro de crossfade, então a sala acompanha a escolha do
   usuário sem que scene.ts precise saber que este módulo existe.
   A guarda de `group.visible` é o que mantém isto grátis nos cinco cenários que
   não têm ciclorama: lá o gancho lê um número e volta. */
onRig((rig) => {
  if (!group.visible || !shellGeo) return;
  const want = Math.max(0, rig.cycloramaAlbedo);
  /* O ZERO É EXATO, e não "abaixo do passo": ele é um MODO (sem sala), não um
     valor baixo. Deixá-lo passar pelo filtro de ALBEDO_STEP faria a troca para
     preto depender de quão longe o fundo anterior estava — trocar de
     `cinza-escuro` (1,0) para preto entraria, e de um preto para outro não. */
  const modeChanged = (want <= 0) !== (albedo <= 0);
  if (!modeChanged && Math.abs(want - albedo) < ALBEDO_STEP) return;
  albedo = want;
  if (modeChanged) applyShellMode();
  if (albedo > 0) paintRamp();
  /* A sala é o que recebe a sombra do veículo, e o valor dela acabou de mudar —
     o mapa não muda, mas o quadro sim. */
  invalidate();
});

/** @returns {boolean} */
export const isCycloramaOn = () => group.visible;

/** Libera a geometria e o material. Chamado quando o estúdio solta a cena. */
export function disposeCyclorama() {
  if (shell) group.remove(shell);
  shellGeo?.dispose();
  shellMat?.dispose();
  shell = null; shellGeo = null; shellMat = null;
  if (floor) {
    group.remove(floor);
    floor.geometry.dispose();
    (floor.material as THREE.Material).dispose();
    floor = null;
  }
  group.visible = false;
  invalidate();
}
