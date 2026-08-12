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
import { scene, camera, invalidate, onFrame, onRig, getRig } from './scene';

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
const FADE_LO = 10.6, FADE_HI = 13.2;

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
  /* Proporções do perfil medido: vale largo, crista curta, rampas curtas. */
  const wValley = pitch * 0.42, wRamp = pitch * 0.14, wCrest = pitch * 0.30;
  const n = Math.ceil((halfZ * 2) / pitch);
  const z0 = -n * pitch * 0.5;

  const quad = (za: number, ya: number, zb: number, yb: number) => {
    /* Normal do segmento no plano (z,y), apontando para BAIXO. */
    const dz = zb - za, dy = yb - ya;
    const len = Math.hypot(dz, dy) || 1;
    const nx = 0, ny = -dz / len, nz = dy / len;
    const v = [
      [-halfX, ya, za], [halfX, ya, za], [halfX, yb, zb],
      [-halfX, ya, za], [halfX, yb, zb], [-halfX, yb, zb],
    ];
    for (const p of v) { pos.push(p[0], p[1], p[2]); nor.push(nx, ny, nz); }
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
  return g;
}

/** Uma caixa posicionada por centro e tamanho, já no referencial do grupo. */
function bar(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) {
  return new THREE.BoxGeometry(sx, sy, sz).translate(cx, cy, cz);
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

  /* Um painel no MEIO de cada vão entre vigas: nunca coincidente com a viga
     (onde ele ficaria escondido) e sempre no ritmo da estrutura. */
  const lanes: number[] = [];
  for (let i = -Math.ceil(HALF / pitch); i <= Math.ceil(HALF / pitch); i++) {
    const x = (i + 0.5) * pitch;
    if (Math.abs(x) < HALF) lanes.push(x);
  }

  const faces: THREE.BufferGeometry[] = [];
  const frames: THREE.BufferGeometry[] = [];
  for (const x of lanes) {
    faces.push(bar(x, bankY, 0, bankW, 0.06, bankLen));
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
  const capGeo = new THREE.CylinderGeometry(0.30, 0.30, 0.06, 14);
  const rodGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6);
  const body = new THREE.InstancedMesh(bodyGeo, housingMat!, rows.length);
  const cap = new THREE.InstancedMesh(capGeo, lensMat!, rows.length);
  const rod = new THREE.InstancedMesh(rodGeo, steelMat!, rows.length);
  const m = new THREE.Matrix4();
  rows.forEach((p, i) => {
    body.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z));
    cap.setMatrixAt(i, m.makeTranslation(p.x, p.y - 0.36, p.z));
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
  group.position.y = H;
  built = true;
}

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
   profundidade em 100 % dos quadros por um efeito que roda em quase nenhum. */
let faded = -1;

function applyFade() {
  if (!group.visible || !built) return;
  /* Altura ABSOLUTA da câmera: o piso do mundo é y=0 e a sala segue o rig só em
     x/z, então a faixa não precisa ser relativa ao grupo. */
  const k = 1 - THREE.MathUtils.smoothstep(camera.position.y, FADE_LO, FADE_HI);
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
  if (deckMat) deckMat.color.setHex(C_DECK).multiply(tint).multiplyScalar(lift);
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
  for (const m of materials) m.dispose();
  materials.length = 0;
  deckMat = steelMat = bankMat = lensMat = housingMat = null;
  built = false;
  group.visible = false;
  invalidate();
}
