/* Bancada de renderização dos cards do Truck Studio.
   ===========================================================================
   O QUE É. Uma cena three.js sem interface, dirigida de fora por Playwright
   (`shoot.mjs`), que produz as imagens de

       renders/trucks/<montadora>/<modelo>/<chassi>/<cor>.webp   960 x 600

   — o manifesto que `engine/catalog/renders.ts` consulta antes de montar
   qualquer URL de card.

   POR QUE UMA BANCADA PRÓPRIA, E NÃO UM PRINT DO ESTÚDIO. O estúdio monta um
   pátio: carreta engatada, cenário 3D, céu, chão, clima, HUD. Um card precisa
   do CAVALO, num fundo que o CSS do seletor desenha por baixo. Dirigir o app
   inteiro por 2.400 combinações também obrigaria a passar pelo seletor, pela
   cortina de carregamento e pelo engate a cada troca — três máquinas de estado
   entre o pipeline e o pixel.

   O QUE ELA NÃO REIMPLEMENTA, e é o ponto todo:

     vehicle/paint.ts          o shader de tinta, os uniformes e a conversão
                               receita → material. É o mesmo objeto que o app
                               usa; uma cor renderizada aqui é a cor que a cena
                               entrega.
     vehicle/material-setup.ts quem aceita tinta, quem projeta sombra, o
                               tratamento de vidro e de decalque.
     vehicle/coupling.ts       a normalização por dado do `hitch.json`
                               (orientYaw / groundY / centerX), medida por
                               vértice e não por caixa envolvente.
     scene/view.ts             `CARD_VIEW_DIR`, `FOV`, `TARGET_H` — a pose que
                               o card promete e `frameAll()` cumpre.
     scene/presets.ts          o preset `ciclorama`, que é a luz do cenário
                               "Estúdio" do seletor.

   O que É daqui, porque o app não tem equivalente: o ENQUADRAMENTO por
   silhueta (`frame()`), as três softboxes e o estúdio que a lataria REFLETE
   (`makeStudioEnvironment()`) — o pátio do estúdio não serve de ambiente para
   uma foto de produto.

   FUNDO TRANSPARENTE, por contrato. `catalog/renders.ts` diz: "fundo
   TRANSPARENTE — é `selector.css` quem desenha o halo e a sombra elíptica sob
   o card, e um fundo assado quebraria esse gradiente". Os 53 renders que
   existiam antes deste pipeline vinham com um fundo escuro assado, em
   desacordo com o próprio consumidor. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

import {
  setPaint, forgetPaintMaterial, makePaintMaterial, isPaintMaterial,
  type PaintFinish, type PaintPatch,
} from '@/pages/tools/truck-studio/engine/vehicle/paint';

/** Película assada no albedo da tinta, reconhecida pelo nome da textura — a
 *  mesma regra (e o mesmo porquê) de `BAKED_FINISH_RE` em vehicle/models.ts. */
const BAKED_FINISH_RE = /_assada$/i;
import {
  setupCommon, isPaintableMaterial, maskOnly,
} from '@/pages/tools/truck-studio/engine/vehicle/material-setup';
import {
  findTractor, normalizedRootOffset, type HitchManifest,
} from '@/pages/tools/truck-studio/engine/vehicle/coupling';
import { CARD_VIEW_DIR, FOV, TARGET_H } from '@/pages/tools/truck-studio/engine/scene/view';
import { LIGHT_PRESETS, RIG_BASE } from '@/pages/tools/truck-studio/engine/scene/presets';

/* ---------------- constantes de enquadramento ----------------
   Estes quatro números são o CONTRATO DE CONSISTÊNCIA entre as 52 geometrias:
   um card só pode ser comparado com o vizinho se os dois foram medidos com a
   mesma régua.

   Medidos nos 53 renders da leva anterior (`convert -fuzz 12% -trim`): a
   silhueta ocupava 533 a 540 px de altura num quadro de 600 (0,89), com o
   centro em x = 480,6 ± 6 e y = 282,6 ± 1,4 — ou seja, ela já era ajustada
   PELA ALTURA, deixando o comprimento correr (a largura ia de 686 a 834 px).
   Faz sentido: a altura de uma cabine varia pouco entre modelos, então ajustar
   por ela mantém a escala aparente igual; ajustar pela diagonal encolheria
   todo 6x2 em relação a todo 4x2. Ver `measureSilhouette()` para COMO a altura
   é medida, e por que não pela caixa envolvente. */
const FILL_H = 0.88;      // fração da ALTURA do quadro ocupada pela SILHUETA
const FILL_W_MAX = 0.94;  // teto de largura: um 6x4 comprido recua em vez de vazar
const CENTER_X = 0.500;   // centro horizontal alvo, em fração do quadro
const CENTER_Y = 0.480;   // centro vertical: um fio acima do meio, como na leva anterior

/** Tamanho de saída — TEM de bater com `RENDER_SIZE` de catalog/renders.ts. */
export const OUT_W = 960;
export const OUT_H = 600;

/** Supersampling. O renderizador aqui é software (llvmpipe/SwiftShader em
 *  headless), então o custo é linear em pixels; 2x é o ponto em que a borda do
 *  para-choque para de escadear sem dobrar o tempo de novo. */
const SSAA = 2;

/* ---------------- renderer ---------------- */
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  /* Obrigatório: o Playwright lê o canvas com `toDataURL()` DEPOIS do
     `render()`, e sem isto o buffer já foi apresentado e vem em branco. */
  preserveDrawingBuffer: true,
  powerPreference: 'high-performance',
});
renderer.setSize(OUT_W, OUT_H, false);
renderer.setPixelRatio(SSAA);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.setClearAlpha(0);

const scene = new THREE.Scene();
scene.background = null;                       // alfa 0 — ver o cabeçalho
const camera = new THREE.PerspectiveCamera(FOV, OUT_W / OUT_H, 0.1, 500);

/* ---------------- luz: o preset `ciclorama`, face `dia` ----------------
   Sem tween e sem relógio: um card é um instante. `RIG_BASE` primeiro porque
   as faces dos presets são PARCIAIS por construção (ver scene/presets.ts). */
const rig = { ...RIG_BASE, ...LIGHT_PRESETS.ciclorama.dia };

/** Direção de uma luz a partir de azimute/elevação em graus, na convenção do
 *  rig do estúdio: azimute 0 = +Z (a frente do veículo), crescendo para +X. */
function dirFrom(azDeg: number, elDeg: number, dist: number) {
  const az = THREE.MathUtils.degToRad(azDeg), el = THREE.MathUtils.degToRad(elDeg);
  return new THREE.Vector3(
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
    Math.cos(el) * Math.cos(az),
  ).multiplyScalar(dist);
}

const key = new THREE.DirectionalLight(rig.keyColor, rig.keyIntensity);
key.castShadow = true;
key.shadow.mapSize.set(3072, 3072);
key.shadow.radius = rig.shadowRadius;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
scene.add(key, key.target);

/* O recorte: frio, do lado oposto ao da key, e é ele que separa a lataria do
   fundo agora que o fundo é transparente (o card desenha um gradiente escuro
   por baixo). Ver a nota do preset. */
const rim = new THREE.DirectionalLight(rig.rimColor, rig.rimIntensity);
scene.add(rim, rim.target);

/* HEMI E AMBIENTE CORTADOS PELA METADE em relação ao preset (0,32 -> 0,16 e
   0,09 -> 0,045). Não é uma discordância com o `ciclorama`: lá esses dois
   compensam um ambiente sem forma (a caixa branca do RoomEnvironment). Aqui o
   ambiente TEM forma — chão preto, painéis brancos — e ele já preenche a
   sombra na direção certa. Luz ambiente é justamente o termo que ACHATA: ela
   chega igual em toda face e come a diferença entre o lado da key e o lado do
   fill, que é a diferença que faz o quadro parecer fotografado. */
const hemi = new THREE.HemisphereLight(rig.hemiSky, rig.hemiGround, rig.hemiIntensity * 0.5);
const ambient = new THREE.AmbientLight(rig.ambientColor, rig.ambientIntensity * 0.5);
scene.add(hemi, ambient);
renderer.toneMappingExposure = rig.exposure;

/* ---------------- as três softboxes ----------------
   ESTA É A PARTE QUE FAZ O CARD PARECER FOTOGRAFIA, e ela não existe no rig do
   estúdio — lá a cena é um pátio, com sol e céu.

   POR QUE `RectAreaLight` E NÃO MAIS UMA DIRECIONAL. Uma luz direcional é um
   ponto no infinito: o realce especular que ela deixa no verniz é um PONTO.
   O que se vê na lataria de uma foto de estúdio é uma FAIXA — o reflexo do
   painel retangular, esticado ao longo da carroceria. É essa faixa que revela
   a forma (onde ela entorta, há um vinco) e é ela que faz o floco metálico e o
   verniz aparecerem, porque um realce alongado varre milhares de orientações
   de floco em vez de uma.

   O `RoomEnvironment` do preset já dá algo disso pelo IBL, mas é uma caixa
   branca fixa: o realce não tem POSIÇÃO em relação ao caminhão, então ele não
   acompanha a carroceria e não se pode apontar. Estas três acompanham.

   `RectAreaLight` NÃO projeta sombra (o LTC do three só resolve o termo
   direto) — é justamente por isso que a key direcional continua ali: ela é
   quem faz a auto-sombra que dá volume. As três abaixo são especular e
   modelagem, não sombra.

   O rig é o clássico de fotografia de carro, e cada uma tem um trabalho:

     TOPO   uma faixa longa e estreita sobre a linha do teto, quase na
            vertical do veículo. É o realce que corre da cabine até o
            para-lama traseiro e desenha o "ombro" da lataria.
     LADO   um painel grande no lado da câmera, baixo e inclinado para cima.
            Ele preenche o flanco e é o que separa uma porta de um estribo.
     KICKER um painel menor ATRÁS e do outro lado, mirando a traseira da
            cabine. É o contorno quente que descola o veículo do fundo.

   As intensidades são altas porque `RectAreaLight` no three é radiância por
   área e a área aqui é grande em metros; o que importa é a razão entre elas
   (~4 : 2 : 3) e o resultado sob a exposição do preset. */
RectAreaLightUniformsLib.init();

/* As INTENSIDADES BASE, antes do ganho. A razão entre elas (~4 : 2 : 3) é a
   receita; o nível é `LIGHT_GAIN`, e os dois são ajustados por caminhos
   diferentes de propósito — ver setLightGain(). */
const SOFT_TOP = 4.2, SOFT_SIDE = 2.0, SOFT_KICK = 3.0;

/* A KEY PERDEU METADE porque deixou de ser a única fonte. No `ciclorama` ela
   vale 3,4 e faz sozinha a modelagem inteira; aqui as três softboxes fazem a
   maior parte dela, e manter a key no valor cheio somava um segundo sol sobre
   um estúdio já iluminado. Ela continua sendo a ÚNICA que projeta sombra —
   RectAreaLight não projeta —, então baixá-la a zero tiraria o volume. */
const KEY_SHARE = 1.0;   /* a repartição real está em MIX.key */

/* O ambiente refletido, antes do ganho. Chegou a 1,15 na primeira versão, o
   que somado às softboxes é boa parte do +1,4 EV que estourou a lataria
   branca. 0,85 é o valor do próprio preset `ciclorama`. */
const ENV_BASE = 0.85;

const softTop = new THREE.RectAreaLight(0xffffff, SOFT_TOP, 1.6, 12);
const softSide = new THREE.RectAreaLight(0xfff4ea, SOFT_SIDE, 7.0, 3.2);
const softKick = new THREE.RectAreaLight(0xcddcf6, SOFT_KICK, 4.0, 2.6);
scene.add(softTop, softSide, softKick);

/* ---------------- o que a lataria REFLETE ----------------
   O preset pede `env: 'room'`, e o `RoomEnvironment` do three é de fato uma
   caixa com painéis retangulares — é dele que vem o realce alongado de softbox
   que um céu em gradiente não tem. Mas ele é uma caixa BRANCA, e uma caixa
   branca é o pior ambiente possível para verniz automotivo: o que uma lataria
   polida mostra é o AMBIENTE, e um ambiente uniforme aparece como cinza
   uniforme. Foi isso que deixou a primeira leva "chapada" — sem a linha de
   horizonte que separa o que reflete céu do que reflete chão, uma porta é uma
   mancha e um vinco não existe.

   Então o ambiente é construído aqui, e ele é o MESMO estúdio que as luzes
   descrevem: chão escuro, paredes escuras, e três painéis brancos nas posições
   das três softboxes. As duas coisas têm de concordar — se a luz vem de cima e
   o reflexo não, o verniz denuncia o CG na hora.

   O que cada peça faz na imagem final:
     CHÃO ESCURO      a metade de baixo de qualquer superfície vertical fica
                      escura. É a linha de horizonte no meio da porta, e é ela
                      que dá a leitura de "chapa polida" em vez de "plástico".
     PAREDE GRADIENTE mais clara em cima, quase preta embaixo: o degradê
                      contínuo que corre pela lateral quando a forma vira.
     PAINÉIS          os realces retangulares alongados — o que faz o floco
                      metálico e o `clearcoat` aparecerem.

   `fromScene` com blur 0.02 (e não 0.04): menos borrão preserva a borda dos
   painéis, e é a BORDA do reflexo que lê como brilho especular. */
function makeStudioEnvironment(roomGlow: number, panelPower: number): THREE.Scene {
  const s = new THREE.Scene();

  /* A SALA É UM GRADIENTE, e não uma caixa de cor chapada.
     ------------------------------------------------------------------------
     A primeira versão usava um `BoxGeometry` com `emissive: 0x0d0f12` e
     `emissiveIntensity` como botão de brilho. Medido: varrer essa intensidade
     de 0,12 a 3,2 mudou a metálica de p50 57 para 58 — nada. O motivo é
     aritmético: a cor emissiva é quase preta, e preto vezes vinte e seis
     continua preto. O botão existia e não controlava coisa alguma.

     E o brilho DESTA superfície é o que decide como uma tinta metálica
     aparece. Com `metalness` perto de 0,9 o three anula a difusa
     (`diffuseColor = diffuse * (1 - metalness)`), então hemi, ambiente e luz
     direta praticamente não a alcançam — o que ela mostra é o ambiente
     refletido. Na CENA do aplicativo isso funciona porque há céu, chão e
     pátio: 360° de meio-tom para refletir. Aqui havia uma caixa preta, e
     espelho apontado para o preto dá preto — daí "as laterais ficam muito
     longe na coloração".

     O gradiente resolve as duas coisas de uma vez: claro em cima (a metálica
     tem o que refletir), escuro embaixo (a LINHA DE HORIZONTE no meio da
     porta, que é a leitura de chapa polida). Uma caixa branca uniforme — o
     `RoomEnvironment` do three — dá a primeira e não dá a segunda. */
  const g = document.createElement('canvas');
  g.width = 4;
  g.height = 256;
  const gc = g.getContext('2d')!;
  const grad = gc.createLinearGradient(0, 0, 0, 256);
  const lo = Math.round(6 * roomGlow), hi = Math.round(150 * roomGlow);
  const mid = Math.round(74 * roomGlow);
  grad.addColorStop(0.00, `rgb(${hi},${hi},${Math.min(255, hi + 8)})`);   // teto
  grad.addColorStop(0.48, `rgb(${mid},${mid},${mid + 4})`);               // parede
  grad.addColorStop(0.52, `rgb(${Math.round(mid * 0.35)},${Math.round(mid * 0.35)},${Math.round(mid * 0.37)})`);
  grad.addColorStop(1.00, `rgb(${lo},${lo},${lo})`);                      // chão
  gc.fillStyle = grad;
  gc.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(g);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;

  const room = new THREE.Mesh(
    new THREE.SphereGeometry(30, 24, 32),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide }),
  );
  s.add(room);

  const panel = (w: number, h: number, x: number, y: number, z: number,
    rx: number, ry: number, power: number, tint: number) => {
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({
        color: 0x000000, emissive: new THREE.Color(tint), emissiveIntensity: power,
        side: THREE.DoubleSide,
      }),
    );
    p.position.set(x, y, z);
    p.rotation.set(rx, ry, 0);
    s.add(p);
  };
  /* As três, nas mesmas direções das RectAreaLight de placeLights(): elas são
     o REALCE (a faixa alongada no verniz); o gradiente acima é o CORPO da
     reflexão. */
  panel(4, 30, 2, 9, 0, Math.PI / 2, 0, 9 * panelPower, 0xffffff);        // topo
  panel(26, 9, 13, 1.5, 2, 0, -Math.PI / 2, 5 * panelPower, 0xfff2e6);    // lado
  panel(12, 7, -12, 4, -12, 0, Math.PI / 2.6, 6 * panelPower, 0xd6e4ff);  // kicker
  return s;
}


/** Brilho atual das PAREDES do estúdio refletido. Guardado porque reconstruir
 *  o PMREM custa ~200 ms e só vale a pena quando ele de fato muda — o laço de
 *  calibração varre dezenas de combinações por segundo nas outras dimensões. */
let roomBrightness = -1;
let panelPower = -1;

function rebuildEnvironment(roomGlow: number, power: number) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = makeStudioEnvironment(roomGlow, power);
  scene.environment?.dispose();
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  pmrem.dispose();
  envScene.traverse((n) => {
    const o = n as THREE.Mesh;
    if (o.isMesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); }
  });
  roomBrightness = roomGlow;
  panelPower = power;
}

/* ---------------- NÃO existe chão nesta cena ----------------
   Houve um `ShadowMaterial` aqui, e ele saiu por duas razões que apontam para
   o mesmo lugar:

   1. O CARD JÁ TEM SOMBRA. `catalog/renders.ts` diz, sobre o fundo
      transparente: "é `selector.css` quem desenha o halo e a SOMBRA ELÍPTICA
      sob o card". Assar uma segunda sombra empilha duas — e as duas com
      direções diferentes, porque a de CSS é simétrica e a do rig vem da key a
      138°.
   2. A key está a 46° de elevação, então a sombra projetada é tão comprida
      quanto o caminhão é alto (~4 m). Ela saía pela borda esquerda do quadro
      em TODAS as geometrias. Enquadrar para caber nela encolheria o caminhão
      em troca de mostrar um borrão.

   O mapa de sombra CONTINUA ligado, e isso não é contradição: sem chão ainda
   há auto-sombra — a cabine sobre o chassi, o defletor sobre o tanque, o
   para-lama sobre o pneu. É ela que dá volume; a do chão é decoração que o
   CSS já faz melhor. */

/* ---------------- carregador ----------------
   Mesmo par GLTFLoader+DRACOLoader do app; o decodificador é servido pelo
   próprio servidor de bancada, a partir de `web/public/vendor/draco/`. */
const draco = new DRACOLoader().setDecoderPath('/vendor/draco/');
const loader = new GLTFLoader().setDRACOLoader(draco);

/* ---------------- estado ---------------- */
let hitch: HitchManifest | null = null;
let current: THREE.Group | null = null;
let currentBox = new THREE.Box3();

/** Descarta a cabine anterior por inteiro — geometria, textura e material.
 *  Sem isto, 52 geometrias seguidas somariam ~10 GB de buffers vivos. */
function disposeCurrent() {
  if (!current) return;
  scene.remove(current);
  current.traverse((n) => {
    const o = n as THREE.Mesh;
    if (!o.isMesh) return;
    o.geometry?.dispose();
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m) continue;
      if (isPaintMaterial(m)) forgetPaintMaterial(m);
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap',
        'aoMap', 'emissiveMap', 'alphaMap'] as const) {
        (m as unknown as Record<string, THREE.Texture | null>)[k]?.dispose();
      }
      m.dispose();
    }
  });
  current = null;
}

/* ---------------- enquadramento ----------------
   Duas grandezas, resolvidas separadamente porque não interagem:

   DISTÂNCIA decide a escala. A extensão projetada de um corpo rígido é
   proporcional a 1/d, então uma razão medida corrige a distância direto.

   MIRA decide a posição no quadro. Fixada a distância, deslocar a câmera E o
   alvo pelo mesmo vetor translada a projeção sem mudar escala nem ângulo —
   então o erro de centro vira um deslocamento nos eixos `right`/`up` da
   câmera, medido em fração do quadro e convertido pela altura do frustum.

   A MEDIDA É A SILHUETA EM PIXELS, e não a caixa envolvente projetada.
   Começou pela caixa, que é determinística e não custa render nenhum — e o
   resultado ficou pequeno demais e, pior, INCONSISTENTE: a caixa é 3D, então
   o que ela projeta são os cantos EXTREMOS dela, e num corpo comprido visto a
   52° de azimute o canto superior-traseiro e o inferior-dianteiro caem muito
   além da silhueta. O excesso cresce com o comprimento do veículo, então um
   6x4 saía visivelmente menor que um 4x2 do mesmo modelo — exatamente a
   inconsistência que este pipeline existe para não ter. Medido: caixa a 88 %
   da altura entregava caminhão a ~66 %, e a diferença entre 4x2 e 6x4 do
   mesmo modelo passava de 6 %.

   O custo é de 3 renders por GEOMETRIA (não por imagem), a 1/4 da resolução e
   sem sombra — desprezível ao lado das dezenas de cores que vêm depois. É
   também o que a leva anterior fazia, e o que `scene/view.ts` descreve em
   `calibrate()`. */

/** Buffer de calibração: 1/4 de lado = 1/16 dos pixels. Sobra de resolução
 *  para medir uma silhueta com meio por cento de erro. */
const CAL_W = OUT_W / 4, CAL_H = OUT_H / 4;
const cal = document.createElement('canvas');
cal.width = CAL_W; cal.height = CAL_H;
const calCtx = cal.getContext('2d', { alpha: true, willReadFrequently: true })!;

/** Extensão e centro da silhueta, em fração do quadro. `null` = quadro vazio
 *  (nenhum pixel opaco) — acontece se a câmera abrir do lado errado. */
function measureSilhouette(): { w: number; h: number; cx: number; cy: number } | null {
  const before = renderer.getPixelRatio();
  renderer.setPixelRatio(CAL_W / OUT_W);
  renderer.render(scene, camera);
  calCtx.clearRect(0, 0, CAL_W, CAL_H);
  calCtx.drawImage(canvas, 0, 0, CAL_W, CAL_H);
  renderer.setPixelRatio(before);

  const d = calCtx.getImageData(0, 0, CAL_W, CAL_H).data;
  let x0 = CAL_W, x1 = -1, y0 = CAL_H, y1 = -1;
  for (let y = 0; y < CAL_H; y++) {
    for (let x = 0; x < CAL_W; x++) {
      /* Limiar alto de propósito: a borda de um pixel reamostrado tem alfa
         baixo e não é geometria. 24/255 tira a franja sem comer a antena. */
      if (d[(y * CAL_W + x) * 4 + 3] < 24) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  return {
    w: (x1 - x0 + 1) / CAL_W, h: (y1 - y0 + 1) / CAL_H,
    cx: (x0 + x1 + 1) / 2 / CAL_W, cy: (y0 + y1 + 1) / 2 / CAL_H,
  };
}

const _dir = new THREE.Vector3();
const _target = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3();

function frame() {
  const size = currentBox.getSize(new THREE.Vector3());
  const centre = currentBox.getCenter(new THREE.Vector3());

  /* A mira é a MEIA-ALTURA da caixa, não o topo dela: mirar acima do meio
     inclina a câmera para baixo e devolve por outro caminho a vista de cima
     que `CARD_VIEW_DIR` tirou. `TARGET_H` é do próprio app. */
  _target.set(centre.x, currentBox.min.y + size.y * TARGET_H, centre.z);
  _dir.copy(CARD_VIEW_DIR);

  /* As luzes ANTES da calibração: a silhueta é medida no alfa do quadro
     renderizado, então tem de haver luz — um quadro preto ainda tem alfa, mas
     um material com `alphaTest` não escreveria nada. */
  const r = size.length() * 0.5;
  placeLights(centre, r);

  let dist = size.length() * 2.2;              // chute inicial generoso
  /* Escala e centro na MESMA passada: as duas correções são independentes
     (uma mexe na distância, a outra translada mira e câmera juntas), então
     convergem em conjunto. Quatro passadas; medido, a terceira já fica dentro
     de 0,3 % em altura e 0,2 % em centro nas 52 geometrias. */
  for (let i = 0; i < 4; i++) {
    camera.position.copy(_target).addScaledVector(_dir, dist);
    camera.lookAt(_target);
    camera.updateProjectionMatrix();
    const e = measureSilhouette();
    if (!e) break;
    const fh = 2 * dist * Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
    const fw = fh * camera.aspect;
    _right.setFromMatrixColumn(camera.matrixWorld, 0);
    _up.setFromMatrixColumn(camera.matrixWorld, 1);
    /* O alvo anda no sentido do erro: se a silhueta está à direita do alvo, a
       mira vai para a direita. O Y da imagem é invertido em relação ao `up`
       da câmera, daí o sinal. */
    _target.addScaledVector(_right, (e.cx - CENTER_X) * fw)
      .addScaledVector(_up, -(e.cy - CENTER_Y) * fh);
    /* Ajusta pela ALTURA e recua se a LARGURA estourar — ver FILL_H/FILL_W_MAX. */
    const need = Math.max(e.h / FILL_H, e.w / FILL_W_MAX);
    if (Number.isFinite(need) && need > 0) dist *= need;
  }
  camera.position.copy(_target).addScaledVector(_dir, dist);
  camera.lookAt(_target);
  camera.updateProjectionMatrix();
}

/** Key e rim dimensionadas PELO VEÍCULO. Um frustum de sombra fixo ou
 *  desperdiça resolução num 4x2 ou corta a traseira de um 6x4. */
function placeLights(centre: THREE.Vector3, r: number) {
  key.position.copy(centre).add(dirFrom(lightAim.keyAz, lightAim.keyEl, r * 3.2));
  key.target.position.copy(centre);
  key.target.updateMatrixWorld();
  const cam = key.shadow.camera as THREE.OrthographicCamera;
  cam.left = -r * 1.25; cam.right = r * 1.25;
  cam.top = r * 1.25; cam.bottom = -r * 1.25;
  cam.near = 0.1; cam.far = r * 8;
  cam.updateProjectionMatrix();

  rim.position.copy(centre).add(dirFrom(lightAim.keyAz + 165, 24, r * 3));
  rim.target.position.copy(centre);
  rim.target.updateMatrixWorld();

  /* As softboxes são postas NO REFERENCIAL DO VEÍCULO, e é isso que as torna
     repetíveis: a frente é sempre +Z (garantido por `orientYaw` do hitch.json)
     e o lado da câmera é sempre +X (`CARD_VIEW_DIR` olha por ali). Então
     "painel no flanco do motorista, um pouco à frente do eixo dianteiro" é a
     mesma frase geométrica nas 52 geometrias, e o realce cai no mesmo lugar da
     lataria em todas.

     As dimensões escalam com `size` — não com `r` — porque o que tem de casar
     é o COMPRIMENTO do painel com o comprimento do veículo: uma faixa fixa de
     12 m corre até o fim de um 4x2 e para no meio de um 6x4.

     `lookAt` DEPOIS de `position`: o RectAreaLight emite pela face −Z local, e
     o three só recalcula a matriz na renderização. */
  const box = currentBox;
  const len = box.max.z - box.min.z;
  const hgt = box.max.y - box.min.y;
  const wid = box.max.x - box.min.x;

  softTop.width = wid * 0.55;
  softTop.height = len * 1.15;
  softTop.position.set(centre.x + wid * 0.35, box.max.y + hgt * 0.85, centre.z);
  softTop.lookAt(centre.x, box.min.y + hgt * 0.55, centre.z);

  softSide.width = len * 0.95;
  softSide.height = hgt * 0.85;
  {
    const d = dirFrom(lightAim.sideAz, 16, Math.max(wid, len) * 1.5);
    softSide.position.set(centre.x + d.x, box.min.y + hgt * 0.62, centre.z + d.z);
    softSide.lookAt(centre.x, box.min.y + hgt * 0.5, centre.z);
  }

  /* O kicker fica atrás do OMBRO oposto: entra pela quina traseira e sai pela
     aresta do teto e do defletor, que é o contorno que separa a cabine do
     fundo escuro do card. */
  softKick.width = len * 0.5;
  softKick.height = hgt * 0.7;
  softKick.position.set(box.min.x - wid * 1.3, box.min.y + hgt * 0.9, box.min.z - len * 0.55);
  softKick.lookAt(centre.x, box.min.y + hgt * 0.62, centre.z);

  renderer.shadowMap.needsUpdate = true;
}

/* ---------------- carregar uma cabine ---------------- */

export interface LoadReport {
  file: string;
  /** materiais que passaram a receber a tinta do configurador */
  painted: string[];
  /** true quando o `hitch.json` tinha entrada para este arquivo */
  normalized: boolean;
  /** dimensões em metros, depois da normalização */
  size: [number, number, number];
}

async function loadCab(
  file: string, chassisId: string, modelId: string,
  /**
   * `chassis[].paintMaterials` / `models[].paintMaterials` do brands.json, já
   * resolvido pelo chamador (é o que `paintMaterialsOf()` faz no app).
   *
   * `[]` NÃO é o mesmo que `null`, e a diferença é o S-Way 480 Metallica: `[]`
   * declara que NENHUM material desta geometria aceita tinta, e é assim que a
   * película M72 escapa do motor de tinta. Como `makePaintMaterial()` preserva
   * o `map` de origem, pintar essa carroceria multiplicaria a arte pela cor
   * escolhida — adesivos em tons de vermelho sobre um caminhão vermelho.
   */
  paintMaterials: string[] | null,
): Promise<LoadReport> {
  disposeCurrent();
  const gltf = await loader.loadAsync('/studio-assets/v1/' + file);
  const root = gltf.scene as THREE.Group;

  /* MESMO preparo do app: sombra por tamanho em mundo, anisotropia em todos os
     slots, vidro e decalque tratados. */
  setupCommon(root);

  /* Normalização POR DADO. `findTractor` casa pelo par {id, file} do jeito que
     `models.ts` casa, e `normalizedRootOffset` devolve a translação que, com
     `rotation.y = orientYaw`, põe o veículo com as rodas em y=0, centrado em x
     e com a frente em +Z. Sem entrada no manifesto (os rígidos), cai para uma
     caixa envolvente — pior, mas nunca um caminhão enterrado no chão. */
  const entry = findTractor(hitch, { id: `${modelId}-${chassisId}`, file });
  let normalized = false;
  if (entry) {
    root.rotation.set(0, entry.orientYaw, 0);
    const off = normalizedRootOffset(entry);
    root.position.set(off.x, off.y, off.z);
    normalized = true;
  } else {
    /* SEM ENTRADA NO MANIFESTO: os RÍGIDOS (Scania R 2016 6x2t e VW Titan).
       `findTractor()` devolve `null` sem `fifthWheel`, e isso é correto — um
       caminhão de carroceria não tem prato, então ele não é um cavalo para
       efeito de engate. Mas ele ainda precisa ficar EM PÉ e VIRADO PARA A
       FRENTE no card.

       `orientYaw = π` e não 0. O `_comment` do hitch.json registra a convenção
       do bake: "os 56 saem do exportador Blender com a FRENTE em -Z e o estudio
       usa +Z". Ela vale para a rip inteira, inclusive para as duas que não
       entraram no manifesto — e era ela que faltava aqui: com yaw 0 os dois
       rígidos apareciam de perfil e virados ao contrário, enquanto as outras 48
       apareciam em três quartos. Lado a lado no seletor isso lê como "este
       modelo está quebrado", que é a queixa que este render existe para não
       provocar.

       O resto (assentar no chão, centrar em x) sai da CAIXA, que é a
       aproximação certa quando não há medição por vértice: pior que o
       manifesto, e ainda assim um caminhão em pé. */
    root.rotation.set(0, Math.PI, 0);
    root.position.set(0, 0, 0);
    root.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(root);
    const c = b.getCenter(new THREE.Vector3());
    root.position.set(-c.x, -b.min.y, -c.z);
  }
  root.updateMatrixWorld(true);

  /* Troca dos materiais de lataria pela tinta automotiva — o MESMO teste de
     `isPaintableMaterial()` e a MESMA `makePaintMaterial()` do app, INCLUSIVE a
     regra do mapa assado.
     Esta nota dizia o contrário ("preservando `m.map`: é ele que carrega a
     película do S-Way Metallica"), e era verdade enquanto a película fosse um
     modelo à parte que nunca chegava a ser pintado. Ela virou ACABAMENTO do
     S-Way 480 (ver `ModelDef.finishes`), então o mesmo arquivo agora responde
     pelas duas coisas: com tinta, o mapa `*_assada` não pode atravessar, senão
     o card neutro do modelo sai com a arte da edição limitada — que foi
     exatamente o que este bloco produziu na primeira rodada. */
  const painted: string[] = [];
  const cache = new Map<string, THREE.Material>();
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const rep = mats.map((raw) => {
      const m = raw as THREE.MeshStandardMaterial;
      if (!isPaintableMaterial(m, paintMaterials)) return m;
      const hit = cache.get(m.uuid);
      if (hit) return hit;
      /* Mesma regra do app (vehicle/models.ts): mapa só atravessa como MÁSCARA
         onde a geometria depende do alfa dele. */
      const src = m.alphaTest > 0
        ? (maskOnly(m.map) ?? m.map)
        : (BAKED_FINISH_RE.test(m.map?.name || '') ? null : m.map);
      const paint = makePaintMaterial(m.color, src);
      paint.name = m.name;
      cache.set(m.uuid, paint);
      painted.push(m.name || '(sem nome)');
      return paint;
    });
    o.material = Array.isArray(o.material) ? rep : rep[0];
  });

  scene.add(root);
  current = root;
  currentBox = new THREE.Box3().setFromObject(root);
  frame();

  const s = currentBox.getSize(new THREE.Vector3());
  return {
    file, painted, normalized,
    size: [+s.x.toFixed(3), +s.y.toFixed(3), +s.z.toFixed(3)],
  };
}

/* ---------------- API dirigida de fora ----------------
   Playwright chama estes quatro métodos e mais nada. Todos devolvem valor
   serializável: um `THREE.*` atravessando a ponte viraria `{}`. */

export interface RigApi {
  init(): Promise<{ tractors: number }>;
  load(file: string, chassisId: string, modelId: string,
    paintMaterials: string[] | null): Promise<LoadReport>;
  /** Aplica uma cor e devolve `data:image/webp;base64,…` — 960x600, com alfa. */
  shoot(paint: PaintPatch | null): Promise<string>;
  /** A EXPOSIÇÃO do quadro atual, medida. Ver `measure()`. */
  measure(minLum?: number): Exposure;
  /** Multiplica TODA a luz da cena. Ver `setLightGain()`. */
  setLightGain(g: number): number;
  /** Nível E proporção — o que `tune.mjs` varre. Ver `setMix()`. */
  setMix(m: Mix): number;
}

/** Histograma de luminância do veículo — o que `tune.mjs` lê. */
export interface Exposure {
  /** pixels do veículo considerados (alfa > 0,5 e acima de `minLum`) */
  px: number;
  /** % com algum canal >= 254: luz que virou papel branco */
  clip: number;
  /** % abaixo de 16: sombra que virou buraco preto — o outro extremo do clip */
  crush: number;
  /* O QUARTIL DE BAIXO ENTROU DEPOIS, e o motivo é o mesmo erro duas vezes:
     a primeira calibração mediu só a lataria clara (L > 90) e acertou o alvo
     dela enquanto enterrava chassi, pneu, grade e todo o lado da sombra. "Bem
     exposto" é um intervalo, não um ponto — sem p10/p25 o laço não enxerga o
     lado escuro e otimiza contra metade da imagem. */
  p10: number; p25: number;
  p50: number; p90: number; p99: number; max: number;
}

/**
 * Mede a exposição do último quadro renderizado.
 *
 * POR QUE ISTO EXISTE, e não é diagnóstico de sobra. A primeira versão do rig
 * com softbox saiu com a lataria branca em p50 = 226 e p90 = 242 — os dois no
 * topo 5 % da escala, com QUATRO níveis entre eles. Na foto de catálogo do
 * FH16 (mesma medida, mesmo recorte de luminância) os mesmos números são 143 e
 * 203, ou seja sessenta níveis de separação. Uma lataria sem separação não é
 * "clara demais": ela perdeu a forma, porque forma é a diferença entre o lado
 * da key e o lado do fill.
 *
 * E isso NÃO se ajusta no olho num pipeline de meia hora. Medir aqui, dentro
 * da página, fecha o laço em segundos: `tune.mjs` varre o ganho, lê estes
 * números e escolhe o que cai no alvo. Os valores que estão em `LIGHT_GAIN`
 * saíram desse laço, não de um chute.
 *
 * `minLum` recorta a LATARIA CLARA: um caminhão tem pneu, grade e chassi
 * pretos, e a mediana do veículo inteiro mede a proporção entre eles, não a
 * exposição da tinta. 90 é onde o preto do pneu acaba.
 */
function measure(minLum = 0): Exposure {
  ctx.clearRect(0, 0, OUT_W, OUT_H);
  ctx.drawImage(canvas, 0, 0, OUT_W, OUT_H);
  const d = ctx.getImageData(0, 0, OUT_W, OUT_H).data;
  const lum: number[] = [];
  let clip = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    if (L < minLum) continue;
    lum.push(L);
    if (d[i] >= 254 || d[i + 1] >= 254 || d[i + 2] >= 254) clip++;
  }
  if (!lum.length) {
    return { px: 0, clip: 0, crush: 0, p10: 0, p25: 0, p50: 0, p90: 0, p99: 0, max: 0 };
  }
  lum.sort((a, b) => a - b);
  const q = (p: number) => lum[Math.floor(p * (lum.length - 1))];
  let dark = 0;
  for (const v of lum) { if (v < 16) dark++; else break; }
  return {
    px: lum.length, clip: (100 * clip) / lum.length,
    crush: (100 * dark) / lum.length,
    p10: q(0.10), p25: q(0.25),
    p50: q(0.5), p90: q(0.9), p99: q(0.99), max: lum[lum.length - 1],
  };
}

/**
 * Multiplica TODA a luz da cena por `g` — as sete fontes e o ambiente juntos.
 *
 * Um ganho ÚNICO, e não sete botões, porque o que estava errado era o NÍVEL e
 * não a proporção: a razão entre key, softbox, rim e ambiente é a receita do
 * `ciclorama` mais as três softboxes, e ela é o que dá a modelagem. Mexer nas
 * proporções para corrigir exposição desmonta a modelagem junto.
 */
function setLightGain(g: number) {
  return setMix({ ...MIX, gain: g });
}

/**
 * A RECEITA INTEIRA — o nível E a proporção.
 *
 * A proporção precisou virar parâmetro porque o primeiro laço de calibração
 * provou que o nível sozinho não resolvia: varrendo o ganho de 1,0 a 0,12, a
 * SEPARAÇÃO da lataria branca (p90 − p50) ficou entre 5 e 12 em TODOS eles,
 * contra 60 da foto de referência. Ou seja — a lataria não estava só clara
 * demais, ela estava lisa: iluminada por sete fontes de sete direções mais um
 * ambiente claro, toda face recebia a mesma quantidade de luz e a diferença
 * entre o lado da key e o lado do fill não existia.
 *
 * Baixar o ganho move o histograma inteiro para baixo. Só mexer na PROPORÇÃO
 * abre o histograma.
 */
export interface Mix {
  gain: number;
  key: number; top: number; side: number; kick: number;
  rimF: number; hemiF: number; ambF: number; env: number;
  /** brilho das paredes do estúdio refletido */
  room: number;
  /**
   * AZIMUTE E ELEVAÇÃO DA KEY, em graus, no referencial do veículo (0° = +Z =
   * a frente). São parâmetro, e não o `keyAz`/`keyEl` do preset, porque a
   * direção é o que de fato abre o histograma — ver o cabeçalho de `MIX`.
   */
  keyAz: number; keyEl: number;
  /** azimute do painel LATERAL, mesma convenção. */
  sideAz: number;
  /**
   * RADIÂNCIA DOS PAINÉIS DO ESTÚDIO REFLETIDO — o que produz o REALCE, e não
   * a iluminação.
   *
   * A distinção é o que fechou a calibração. Difusa e especular vêm de fontes
   * diferentes e querem coisas opostas: a difusa quer fonte grande e fraca
   * (corpo em meio-tom, sem estouro), a especular quer fonte pequena e MUITO
   * brilhante (o realce que bate em 250 e desenha o vinco). Baixando tudo
   * junto — que foi a primeira tentativa — o corpo desceu para 144 e o realce
   * desceu com ele, para 187. A foto de referência tem corpo em 143 E realce
   * em 250.
   */
  panel: number;
}

function setMix(m: Mix) {
  const g = m.gain;
  key.intensity = rig.keyIntensity * m.key * KEY_SHARE * g;
  rim.intensity = rig.rimIntensity * m.rimF * g;
  hemi.intensity = rig.hemiIntensity * m.hemiF * g;
  ambient.intensity = rig.ambientIntensity * m.ambF * g;
  softTop.intensity = SOFT_TOP * m.top * g;
  softSide.intensity = SOFT_SIDE * m.side * g;
  softKick.intensity = SOFT_KICK * m.kick * g;
  scene.environmentIntensity = ENV_BASE * m.env * g;
  if (m.room !== roomBrightness || m.panel !== panelPower) {
    rebuildEnvironment(m.room, m.panel);
  }
  lightAim = m;
  if (current) placeLights(currentBox.getCenter(new THREE.Vector3()),
    currentBox.getSize(new THREE.Vector3()).length() * 0.5);
  return g;
}

/** A mira viva das luzes — lida por `placeLights()`, escrita por `setMix()`. */
let lightAim: Mix;

/* O ENCODER É O DO NAVEGADOR.
   O Chromium codifica WebP com canal alfa nativamente, então a imagem sai do
   `toDataURL` já no formato em que é servida. O caminho alternativo — PNG aqui
   e `cwebp` lá fora — atravessaria ~2,3 MB de base64 por imagem pela ponte do
   Playwright, escreveria um temporário e ainda somaria uma dependência de
   sistema que esta máquina não tem instalada.
   0,92 está acima do ponto em que o degradê do verniz começa a formar bandas;
   medido contra a leva anterior, a imagem sai na mesma ordem de tamanho. */
const WEBP_QUALITY = 0.92;

/* O REDUTOR. `toDataURL` codifica o BUFFER, não o tamanho em CSS — com
   `setPixelRatio(2)` ele devolveria 1920x1200. A redução para 960x600 é o que
   converte o supersampling em antialiasing de verdade: cada pixel de saída é a
   média de quatro amostras, o que também apaga o serrilhado do floco metálico,
   que nenhum MSAA alcança (ele nasce dentro do fragment shader).
   `imageSmoothingQuality: 'high'` pede ao Skia o reamostrador bom; sem ele o
   Chromium usa bilinear e joga fora metade do ganho. */
const out2d = document.createElement('canvas');
out2d.width = OUT_W;
out2d.height = OUT_H;
const ctx = out2d.getContext('2d', { alpha: true })!;
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

const api: RigApi = {
  measure,
  setLightGain,
  setMix,
  async init() {
    const r = await fetch('/studio-assets/v1/models/vehicles/hitch.json', { cache: 'no-cache' });
    hitch = (await r.json()) as HitchManifest;
    return { tractors: Object.keys(hitch.tractors || {}).length };
  },

  load: loadCab,

  async shoot(paint) {
    /* `null` = NEUTRO: a lataria sem tinta escolhida. Não é "sem material de
       tinta" — é o mesmo material com um cinza claro de referência, que é o
       que a leva anterior mostrava e o que `NEUTRAL_COLOR_ID` significa em
       catalog/renders.ts. */
    setPaint(paint ?? {
      finish: 'solid' as PaintFinish,
      color: '#d8dade',
      flakeColor: null,
      pearlFlip: null,
    });
    renderer.render(scene, camera);
    ctx.clearRect(0, 0, OUT_W, OUT_H);
    ctx.drawImage(canvas, 0, 0, OUT_W, OUT_H);
    return out2d.toDataURL('image/webp', WEBP_QUALITY);
  },
};

/* A RECEITA DE LUZ, calibrada por medida — ver `measure()` e `tune.mjs`.
   ---------------------------------------------------------------------------
   ALVO: a lataria clara (luminância > 90) da foto de catálogo do Volvo FH16,
   que é a referência que o projeto já tinha — p50 = 143, p90 = 203, ou seja
   SESSENTA níveis de separação dentro do branco.

   Os números abaixo saíram do laço de `tune.mjs`, e a ordem em que foram
   descobertos importa para quem for mexer:

   1. A primeira versão com softbox media p50 = 226 / p90 = 242 — separação de
      QUATRO níveis. Varrer o GANHO de 1,0 a 0,12 moveu o histograma inteiro
      para baixo e a separação ficou entre 5 e 12 em todos os pontos. Nível não
      era o problema.
   2. O problema era a PROPORÇÃO: sete fontes de sete direções mais um ambiente
      claro entregam a mesma luz a toda face, e "forma" é justamente a
      diferença entre o lado da key e o lado do fill.
   3. Os dois maiores achatadores, medidos um a um: o painel do LADO DA CÂMERA
      (7 x 3,2 m apontado para o flanco visível — um refletor frontal desse
      tamanho apaga sombra por definição) e o BRILHO DAS PAREDES do estúdio
      refletido, que chegava com `emissiveIntensity` 0,55 numa caixa que
      envolve o veículo inteiro.

   Daí a receita: o painel de TOPO domina, o do lado vira um preenchimento
   fraco, as paredes escurecem, e hemi/ambiente — que chegam iguais em toda
   face — quase somem. */
const MIX: Mix = {
  /* O NÍVEL. Três levas para chegar aqui, e as duas primeiras erraram por
     medir só metade do histograma:
       leva 1  veículo inteiro p50 191, lataria 242/245 — estourada.
       leva 2  calibrada só contra a lataria clara: acertou 155/173 nela e
               derrubou o veículo inteiro para 87 — escura demais, com chassi e
               grade sumindo.
       leva 3  alvo nos DOIS lados: inteiro ~141-158, lataria ~209/221, clip 0.
       leva 4  a sala refletida virou um GRADIENTE cinza (era uma caixa quase
               preta) e o ambiente subiu um passo. Foi o que finalmente alcançou
               as METÁLICAS, e a razão é que elas quase não têm difusa: com
               `metalness` perto de 0,9 o three anula `diffuseColor`, então
               hemi, ambiente e luz direta não as tocam — o que elas mostram é o
               ambiente REFLETIDO. Na cena do aplicativo isso já funcionava
               porque lá há céu, chão e pátio; aqui havia preto.
               NÃO se mexeu em `vehicle/paint.ts`: o comportamento de tinta do
               app está aprovado, e o defeito era do ambiente deste rig. */
  gain: 0.42,
  /* A KEY VEM PARA A FRENTE. 138° é do preset `ciclorama`, autorado para a
     CENA, onde a câmera orbita; no card ela é fixa em az 38°, e a 138° a key
     fica ATRÁS do veículo — a face frontal, que é metade do que o card mostra,
     recebia só difusa. Medido: 25°/52° é o par que mais abre o histograma. */
  keyAz: 25, keyEl: 52, sideAz: 90,
  /* A FOCAL, CONTIDA. Ela é a única que projeta sombra (RectAreaLight não
     projeta), então zerá-la tiraria o volume; mas com as três softboxes
     fazendo a modelagem, o valor cheio do preset somava um segundo sol. */
  key: 0.38,
  top: 0.75,     // a dominante: a faixa que corre pela linha do teto
  side: 0.22,    // preenchimento, não refletor — um painel grande de frente
                 // apaga sombra por definição
  kick: 0.60,    // o contorno que descola do fundo escuro do card
  rimF: 1.00,
  /* A LUZ AMBIENTE DE ESTÚDIO. Estes três chegaram a ser cortados a 0,30/0,25
     do preset, com o argumento de que ambiente ACHATA — o que é verdade, e foi
     longe demais: a sombra do lado do fill virou massa sem desenho e o veículo
     inteiro caiu para p50 87. Hemi e ambiente SÃO a chapa branca do outro lado
     de um estúdio; sem eles não existe estúdio, existe holofote. */
  hemiF: 1.50,
  ambF: 1.30,
  env: 1.35,
  /* A SALA DEIXOU DE SER PRETO ABSOLUTO. Com o gradiente novo, 1,5 põe o teto
     em ~rgb(225), a parede em ~rgb(111) e o chão em ~rgb(9): um cinza escuro de
     estúdio, não uma caixa preta. É o que dá à tinta METÁLICA alguma coisa para
     refletir — medido no `Silver Grey`, o veículo sai de p50 50 para 69 e a
     branca de 157 para 170, sem estouro. */
  room: 1.50,
  panel: 1.00,
};
setMix(MIX);

/* A ponte. `shoot.mjs` espera exatamente este nome. */
(window as unknown as { __rig: RigApi }).__rig = api;
(window as unknown as { __rigReady: boolean }).__rigReady = true;
