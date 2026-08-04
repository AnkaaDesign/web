/* Miniaturas 3D dos cards do seletor.
   ---------------------------------------------------------------------------
   Os cards de MODELO e de COR não mostram mais foto: mostram o cavalo mecânico
   renderizado de verdade, na cor que está selecionada. É o que faz o passo da
   cor funcionar — doze fotos de estúdio de doze cores não existem, e não
   existiriam para o próximo caminhão que entrar no catálogo.

   Como isto NÃO é feito, e por quê:
   - não usa o renderer do estúdio. Ele está no meio de um loop de render, com a
     câmera do usuário, o rig de luz do cenário e os uniformes de tinta
     COMPARTILHADOS por todos os materiais (vehicle/paint.ts): pintar doze cores
     ali significaria escrever doze vezes na tinta que está na tela. Este módulo
     tem contexto, cena, luz e materiais próprios, e não toca em nada do estúdio;
   - não renderiza em tempo real. Cada miniatura é UMA imagem, gerada uma vez e
     guardada como data URL. Um card é uma figura estática — foi o que foi
     pedido — e doze canvas vivos num overlay seriam doze loops de render
     brigando com o loop que importa, o do estúdio.

   Geometria: `preview` do cabs.json, senão `file`. O campo existe porque a
   Scania vem de um FBX de 46 MB (a fonte aprovada para o estúdio); baixar isso
   para desenhar um card de 220 px seria absurdo, então o manifesto aponta o
   .glb de 6 MB para ESTE uso. Uma cabine sem `preview` e sem .glb próprio
   simplesmente não tem miniatura: o card cai na foto do manifesto, que é o
   comportamento antigo, e não trava esperando 46 MB.

   Tudo aqui degrada para `null`. Sem WebGL, sem geometria, erro de rede — o
   card volta a ser o que era. Uma miniatura nunca pode ser o motivo de o
   seletor não abrir. */
import * as THREE from 'three';
import { loadGLB, state as vehicleState } from '../vehicle/models';
import { assetUrl } from '../catalog/catalog';
import type { PaintFinish } from '../vehicle/paint';

/* Tamanho do buffer. Um card de cor tem ~290 px de largura, e numa tela 2x isso
   já são 580 px de verdade — a primeira versão renderizava a 460 e o resultado
   era visivelmente mole. 960x660 dá folga para 2x com sobra e ainda cabe num
   webp de algumas dezenas de KB. */
/* 16:10 é a proporção da moldura do card (--ts-media-ratio em selector.css).
   Renderizar noutra proporção não corta nada — o CSS faz `contain` —, mas
   devolve faixa vazia dos dois lados, ou seja pixels gastos em nada. */
const W = 960, H = 600;

/* Direção da câmera em relação ao centro da cabine. Três quartos pela frente e
   BAIXO: o olho tem de ficar perto da linha do para-brisa, não acima do teto.
   O componente y é o único número delicado aqui — a 0.62 (a primeira tentativa)
   a câmera terminava ~1 m acima do teto e o card virava uma vista de cima, que
   é justamente o que não mostra a lataria. Em 0.30 a elevação fica em ~7°:
   ainda dá para ver que o veículo tem volume, e a lateral — que é onde a tinta
   aparece — ocupa o card.
   O +Z é a frente (vehicle/models.ts assenta a cabine ocupando [0, comprimento]
   com a dianteira no +Z). */
const VIEW_DIR = new THREE.Vector3(1.55, 0.30, 1.95).normalize();
const FOV = 30;

/* Tinta da miniatura — uma APROXIMAÇÃO deliberada de vehicle/paint.ts.
   O material de verdade injeta GLSL para flocos, flop e casca de laranja; nada
   disso resolve em 460x320, e arrastar aquele shader para cá arrastaria junto os
   uniformes compartilhados que este módulo existe para não tocar. O que
   importa no card é hierarquia: metálica é mais escura e mais reflexiva que a
   sólida, perolizada fica no meio com o verniz mais aberto. */
/* O metalness é o número perigoso, e foi ele que deixou os cards "opacos": o
   three deriva `diffuseColor = diffuse * (1 - metalness)`, então cada ponto de
   metalness apaga pigmento. Com 0,26 as cores metálicas (prata, grafite, verde,
   os dois azuis) chegavam ao card lavadas, bem mais mortas do que a mesma tinta
   na cena. O valor aqui fica baixo de propósito — o brilho vem do verniz e do
   ambiente, não de fingir que a lataria é cromada. Mesma lógica do cap em
   vehicle/paint.ts, que trava metálica em 0,28 pelo mesmo motivo. */
const FINISH_MAT: Record<PaintFinish, { metalness: number; roughness: number; ccRough: number }> = {
  solid: { metalness: 0.0, roughness: 0.28, ccRough: 0.05 },
  metallic: { metalness: 0.15, roughness: 0.19, ccRough: 0.04 },
  pearl: { metalness: 0.09, roughness: 0.23, ccRough: 0.06 },
};

/* ---------------- recursos preguiçosos ---------------- */

interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  pmrem: THREE.PMREMGenerator;
  envRT: THREE.WebGLRenderTarget;
}

interface CabEntry {
  root: THREE.Object3D;
  /** os materiais de tinta desta cabine — recoloridos a cada render */
  paint: THREE.MeshPhysicalMaterial[];
  /**
   * Correção de enquadramento medida NA IMAGEM, uma vez por cabine (< 1 = a
   * câmera chega mais perto). Ver calibrate(): a caixa projetada ainda sobra
   * bastante sobre a silhueta de verdade, e o único jeito de saber quanto é
   * olhando os pixels. A silhueta não muda com a cor, então a medida vale para
   * as doze.
   */
  fit?: number;
}

let stage: Stage | null = null;
/** true depois de uma falha de contexto: não tenta de novo a cada card. */
let stageDead = false;

/* SOLTO PARA VALER — e por que isto NÃO é o `stageDead` acima.
   ---------------------------------------------------------------------------
   `stageDead` significa "este navegador não consegue construir um contexto";
   é decidido uma vez, em buildStage(), e nunca volta atrás. Esta flag significa
   outra coisa: "o estúdio saiu da rota, pare de desenhar". São estados
   independentes e juntá-los apagaria a diferença entre um erro permanente e um
   desmonte normal.

   A corrida que ela fecha: unmountStudio() chama disposePreviews(), que descarta
   a geometria em cache e faz forceContextLoss() no renderizador — mas um
   prewarmCabPreviews() em voo é uma FILA de doze `.then` encadeados, e os que
   ainda não rodaram vão rodar assim mesmo. O primeiro deles chama getStage(),
   que via `if (!stage) stage = buildStage()` alegremente abriria um contexto
   WebGL offscreen NOVO numa página que o usuário já deixou, para renderizar
   entradas cuja geometria acabou de ser liberada. Um contexto vivo e órfão ao
   lado do estúdio é justamente o que releaseStage() existe para não deixar
   acontecer.

   O IDLE NÃO ENTRA AQUI. releaseStage() também é chamado pelo timer de
   ociosidade, com a página montada e o seletor ainda podendo pedir miniatura —
   ali reconstruir o palco é o comportamento certo. Por isso a flag é levantada
   em disposePreviews(), não em releaseStage(). */
let released = false;

/* Um pedido de miniatura só chega pela UI montada (cabPreview, warmCabPreview,
   prewarmCabPreviews). Chegou um: a página está de pé de novo, e o palco pode
   voltar a ser construído sob demanda. */
function reacquire() { released = false; }

const cabs = new Map<string, CabEntry>();
const loadingCabs = new Map<string, Promise<CabEntry | null>>();

/** data URLs prontas, por `cabId|hex|finish`. É o que faz reabrir o seletor ser instantâneo. */
const shots = new Map<string, string>();
const pending = new Map<string, Promise<string | null>>();

/* Um render de cada vez. Todos compartilham UM canvas: dois renders
   concorrentes leriam o buffer um do outro. */
let chain: Promise<unknown> = Promise.resolve();

/* Solta o contexto WebGL quando ninguém pede miniatura há um tempo. As data
   URLs FICAM — elas são o cache que importa, e um segundo contexto vivo ao lado
   do estúdio é justamente o que não se quer segurar à toa. */
const IDLE_MS = 60000;
let idleTimer: ReturnType<typeof setTimeout> | null = null;

function touchIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { idleTimer = null; releaseStage(); }, IDLE_MS);
}

/* O IBL do card, e a razão de o RoomEnvironment ter saído.
   ---------------------------------------------------------------------------
   RECLAMAÇÃO: "a cor dos caminhões está opaca, muito diferente da cena, lá a cor
   é muito mais vívida." Estava certo, e a causa é a MESMA que o comentário da
   exposição aqui já tinha diagnosticado sem chegar até o fim: "o reflexo de uma
   sala branca por baixo de um verniz espelhado cobre o pigmento inteiro".

   O RoomEnvironment é uma caixa branca — paredes, teto E CHÃO. Num material com
   clearcoat 1 o verniz integra o hemisfério inteiro, e um hemisfério branco é
   uma folha de branco por cima da tinta. A resposta anterior foi baixar a
   exposição (1,35 → 1,12) e o ambiente (1,7 → 1,0): isso tira o estouro mas não
   devolve saturação nenhuma, porque escurecer branco dá CINZA. Daí "opaca" em vez
   de "lavada" — é o mesmo defeito uma volta depois.

   O estúdio não tem esse problema porque o céu dele não é branco: é um gradiente
   azul com metade INFERIOR ESCURA (o solo) e um sol pequeno e brilhante. O verniz
   então reflete azul em cima, escuro embaixo e um realce apertado — que é o que
   faz lataria ler como lataria — e o pigmento continua sendo a maior parte do
   que se vê. Este canvas é o mesmo equirect do buildSkyEnv() do scene.ts, com as
   cores do RIG_BASE, para o card ser a mesma tinta sob a mesma luz. */
function skyIBL(): THREE.Texture {
  const W = 256, H = 128;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const horizon = H * 0.5;

  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#1f5fc4');          // RIG_BASE.skyTop
  sky.addColorStop(0.70, '#4d93e8');       // skyMid em skyMidPos 0.30
  sky.addColorStop(1, '#b8d8f5');          // skyHorizon
  g.fillStyle = sky;
  g.fillRect(0, 0, W, horizon);

  /* Metade de baixo escura: é ela que impede o verniz de devolver branco por
     baixo da cabine, e é a diferença que mais aparece no card. */
  const ground = g.createLinearGradient(0, horizon, 0, H);
  ground.addColorStop(0, '#b8d8f5');
  ground.addColorStop(0.10, '#514c44');    // RIG_BASE.hemiGround
  ground.addColorStop(1, '#514c44');
  g.fillStyle = ground;
  g.fillRect(0, horizon, W, H - horizon);

  /* O disco do sol, na MESMA direção da key acima (az 38, el 52). Um gradiente
     liso não reflete nada — o brilho de uma pintura é lido da NITIDEZ do que ela
     reflete, não de um número de roughness —, então o núcleo apertado é o que
     separa "tinta automotiva" de "plástico colorido". */
  const sx = (38 / 360) * W;
  const sy = (0.5 - (52 / 180)) * H;
  for (const dx of [-W, 0, W]) {             // costura do equirect
    g.save();
    g.setTransform(1, 0, 0, 1, dx, 0);
    const halo = g.createRadialGradient(sx, sy, 0, sx, sy, 34);
    halo.addColorStop(0, 'rgba(255,255,255,0.55)');
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, W, H);
    const core = g.createRadialGradient(sx, sy, 0, sx, sy, 7);
    core.addColorStop(0, 'rgba(255,255,255,1)');
    core.addColorStop(0.55, 'rgba(255,255,255,0.92)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = core;
    g.fillRect(0, 0, W, H);
    g.restore();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

function buildStage(): Stage | null {
  if (stageDead) return null;
  try {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      /* toDataURL lê o buffer DEPOIS do render(); sem isto o navegador tem
         permissão de já ter limpado o backbuffer e a imagem sai preta ou vazia. */
      preserveDrawingBuffer: true,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(1);            // o tamanho já é o tamanho final
    renderer.setSize(W, H, false);
    renderer.setClearAlpha(0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    /* Exposição e ambiente andam juntos e são o que decide se a tinta LÊ.
       Medido nos próprios cards: com exposição 1,35 e ambiente 1,7 o amarelo
       #f0b31c (240,179,28) chegava a (242,223,137) — quase branco, e é essa
       lavagem que dá a impressão de cor "opaca", não a falta de luz. O reflexo
       de uma sala branca por baixo de um verniz espelhado cobre o pigmento
       inteiro; a resposta é MENOS ambiente, não mais luz. */
    /* A MESMA de RIG_BASE.exposure. Ver skyIBL() logo abaixo para por que a
       exposição parou de ser a alavanca contra a lavagem. */
    renderer.toneMappingExposure = 1.05;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const skyTex = skyIBL();
    const envRT = pmrem.fromEquirectangular(skyTex);
    skyTex.dispose();                     // o PMREM já copiou; o canvas não serve mais
    scene.environment = envRT.texture;    // só ilumina; o fundo continua transparente

    /* O SOL DO PRESET `ensolarado`, não uma luz branca inventada: RIG_BASE
       autora keyColor 0xffefe1 / keyIntensity 3.1 em az 38 / el 52, e o card
       promete no próprio subtítulo ser "o modelo escolhido, renderizado naquela
       cor". A geometria vem da mesma conta do applyRig(). */
    const key = new THREE.DirectionalLight(0xffefe1, 3.1);
    const AZ = 38 * Math.PI / 180, EL = 52 * Math.PI / 180;
    key.position.set(
      6 * Math.cos(EL) * Math.sin(AZ), 6 * Math.sin(EL), 6 * Math.cos(EL) * Math.cos(AZ));
    scene.add(key);
    /* rim e hemi do mesmo RIG_BASE (0xbfd6ff a 0.35, hemi 0x8fb8f0/0x514c44 a
       0.35). O hemi de chão ESCURO é metade do conserto: era 0x9aa4b2 aqui, um
       cinza claro, e a saia da cabine devolvia esse cinza por baixo do verniz. */
    const rim = new THREE.DirectionalLight(0xbfd6ff, 0.35);
    rim.position.set(-4.2, 2.6, -3.0);
    scene.add(rim);
    scene.add(new THREE.HemisphereLight(0x8fb8f0, 0x514c44, 0.35));
    scene.add(new THREE.AmbientLight(0x6f7d90, 0.10));

    const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 200);
    scene.add(camera);

    return { renderer, scene, camera, pmrem, envRT };
  } catch (e: unknown) {
    stageDead = true;
    console.warn('[truck-studio] miniaturas 3D indisponíveis (WebGL falhou) — os cards seguem com foto.',
      e instanceof Error ? e.message : String(e));
    return null;
  }
}

function getStage(): Stage | null {
  /* Antes do `if (!stage)`: é exatamente a construção sob demanda que não pode
     acontecer depois do desmonte. */
  if (released) return null;
  if (!stage) stage = buildStage();
  return stage;
}

/* ---------------- geometria ---------------- */

/** A fonte de geometria LEVE desta cabine, ou null se não houver uma. */
function previewSource(cabId: string): string | null {
  const def = vehicleState.byId[cabId];
  if (!def) return null;
  if (def.preview) return def.preview;
  /* Um .fbx nunca serve de miniatura: é a fonte pesada do estúdio (46 MB na
     Scania) e exigiria o FBXLoader e o tratamento de material inteiro só para
     desenhar um card. Sem `preview` declarado, esta cabine não tem miniatura. */
  if (/\.fbx(\?|$)/i.test(def.file || '')) return null;
  return def.file || null;
}

/** @returns {boolean} true se vale a pena pedir miniatura desta cabine. */
export function hasCabPreview(cabId: string | null | undefined): boolean {
  return !!cabId && !stageDead && !!previewSource(cabId);
}

/* Materiais de tinta da miniatura: mesmo critério do estúdio (o nome do
   material bate com `paintMaterials` do cabs.json), materiais NOVOS porque
   estes vão ser recoloridos a cada render e não podem ser os do estúdio. */
function installPaint(root: THREE.Object3D, subs: string[]): THREE.MeshPhysicalMaterial[] {
  const made: THREE.MeshPhysicalMaterial[] = [];
  const cache = new Map<string, THREE.MeshPhysicalMaterial>();
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const rep = mats.map((raw) => {
      const m = raw as THREE.MeshStandardMaterial;
      const name = (m?.name || '').toLowerCase();
      if (!m || !subs.some((s) => name.includes(s))) return m;
      const hit = cache.get(m.uuid);
      if (hit) return hit;
      const paint = new THREE.MeshPhysicalMaterial({
        name: m.name,
        color: new THREE.Color('#b9bec6'),
        /* OS NÚMEROS DO ESTÚDIO, não outros parecidos — makePaintMaterial() em
           vehicle/paint.ts. Estavam em 0.26 / 0.20 aqui, e os dois puxavam
           contra a cor: metalness 0.26 apaga 26 % do albedo difuso (é ele que
           carrega o pigmento) e devolve isso como especular tingido, e roughness
           0.20 concentra esse especular numa folha brilhante por cima. Sob a
           caixa branca do RoomEnvironment o resultado era cinza; foi por isso
           que o card nunca bateu com a cena, mesmo com a mesma cor. */
        metalness: 0.1,
        roughness: 0.34,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        /* Geometria de rip tem winding arbitrário — FrontSide descarta faces
           voltadas para dentro e a lataria fica vazada. Mesma decisão (e mesmo
           motivo) de makePaintMaterial() em vehicle/paint.ts. */
        side: THREE.DoubleSide,
      });
      /* 1.3, o mesmo do estúdio. Estava em 1.0 para conter a lavagem da sala
         branca; com o céu de skyIBL() no lugar dela o ambiente já não é o
         inimigo do pigmento — é o que dá o reflexo azul e o realce do sol. */
      paint.envMapIntensity = 1.3;
      cache.set(m.uuid, paint);
      made.push(paint);
      return paint;
    });
    o.material = Array.isArray(o.material) ? rep : rep[0];
  });
  return made;
}

/* Assenta a cabine na origem: centro em XZ, base em y=0. A câmera é enquadrada
   a partir da caixa depois disso, então o modelo pode vir de onde vier. */
function center(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return;
  const c = box.getCenter(new THREE.Vector3());
  root.position.x -= c.x;
  root.position.z -= c.z;
  root.position.y -= box.min.y;
  root.updateMatrixWorld(true);
}

function loadCabForPreview(cabId: string): Promise<CabEntry | null> {
  const cached = cabs.get(cabId);
  if (cached) return Promise.resolve(cached);
  const inflight = loadingCabs.get(cabId);
  if (inflight) return inflight;

  const src = previewSource(cabId);
  if (!src) return Promise.resolve(null);

  const def = vehicleState.byId[cabId];
  const subs = (def?.paintMaterials || ['carpaint']).map((s) => s.toLowerCase());

  const job = loadGLB(assetUrl(src))
    .then((root) => {
      center(root);
      const entry: CabEntry = { root, paint: installPaint(root, subs) };
      cabs.set(cabId, entry);
      return entry;
    })
    .catch((e: unknown) => {
      console.warn('[truck-studio] miniatura de "' + cabId + '" indisponível — o card segue com foto.',
        e instanceof Error ? e.message : String(e));
      return null;
    })
    .finally(() => { loadingCabs.delete(cabId); });

  loadingCabs.set(cabId, job);
  return job;
}

/* ---------------- render ---------------- */

/* Quanto a CAIXA projetada ocupa, em NDC (1 = borda a borda). É só o ponto de
   partida: a silhueta de verdade é bem menor que a caixa, e quem acerta isso
   depois é calibrate(), medindo os pixels. */
const FILL = 0.94;
const _corner = new THREE.Vector3();

/* Enquadra pela CAIXA PROJETADA, não pela esfera que a contém.
   A esfera é a conta fácil e estava custando metade do card: um cavalo mecânico
   é comprido e estreito, então a esfera que o envolve tem quase o raio do
   comprimento — e enquadrar por ela deixava o caminhão ocupando ~44% da largura
   da imagem, com todo o resto vazio. Como o card depois ainda faz `contain`, o
   desperdício aparecia como "resolução ruim": os pixels estavam lá, só não
   estavam no veículo.
   Então: parte-se da esfera (garante que nada fica de fora), projetam-se os 8
   cantos da caixa e corrige-se a distância pela sobra medida. Duas voltas —
   a projeção não é linear na distância, mas converge rápido, e a segunda volta
   já entrega erro abaixo de 1%. */
function frame(cam: THREE.PerspectiveCamera, root: THREE.Object3D, fit = 1) {
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return;
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const target = box.getCenter(new THREE.Vector3());
  /* Meia altura, não acima dela: mirar acima do meio inclina a câmera para
     baixo e devolve por outro caminho a vista de cima que VIEW_DIR tirou. */
  target.y = box.min.y + (box.max.y - box.min.y) * 0.48;

  let dist = sphere.radius / Math.sin((FOV * Math.PI) / 360);

  const place = () => {
    cam.position.copy(target).addScaledVector(VIEW_DIR, dist);
    /* near/far a cada volta: eles dependem da distância que acabou de mudar, e
       um near maior que a frente do caminhão o cortaria ao meio. */
    cam.near = Math.max(0.05, dist - sphere.radius * 2);
    cam.far = dist + sphere.radius * 4;
    cam.updateProjectionMatrix();
    cam.lookAt(target);
    cam.updateMatrixWorld(true);
  };

  for (let pass = 0; pass < 2; pass++) {
    place();
    let extent = 0;
    for (let i = 0; i < 8; i++) {
      _corner.set(
        i & 1 ? box.max.x : box.min.x,
        i & 2 ? box.max.y : box.min.y,
        i & 4 ? box.max.z : box.min.z,
      ).project(cam);
      extent = Math.max(extent, Math.abs(_corner.x), Math.abs(_corner.y));
    }
    if (!Number.isFinite(extent) || extent <= 0.01) break;   // degenerado: fica na esfera
    dist *= extent / FILL;
  }
  /* A correção medida na imagem (calibrate), quando já existe para esta cabine. */
  dist *= fit;
  place();
}

/* Quanto a silhueta deve ocupar do eixo mais apertado, e a faixa que já conta
   como enquadrado. Abaixo de 1 com folga de propósito: um caminhão encostando
   na borda do card lê como recorte, não como enquadramento — e a sombra que o
   CSS projeta embaixo dele precisa de onde cair. */
const FIT_TARGET = 0.90;
const FIT_MIN = 0.84, FIT_MAX = 0.94;

/* Mede a silhueta REAL na imagem recém-renderizada: a fração do eixo mais
   apertado que ela ocupa (0..1), ou null se não deu para medir.
   Por que não basta a caixa: uma AABB vista de três quartos projeta os cantos
   de trás para FORA da silhueta, e ainda inclui espelhos, defletor e antena —
   partes finas que esticam a caixa sem preencher nada. Medido: a caixa dizia
   0.94 e o caminhão desenhado ocupava 0.55 da largura. A diferença é card vazio,
   e card vazio aparece como "resolução ruim", porque os pixels estão lá, só não
   estão no veículo.
   A leitura é feita num 2D reduzido (a escala não muda uma razão) e uma vez por
   cabine — a silhueta não depende da cor. */
const CAL_W = 192, CAL_H = 132;
let calCanvas: HTMLCanvasElement | null = null;

function measureSilhouette(src: HTMLCanvasElement): number | null {
  if (!calCanvas) {
    calCanvas = document.createElement('canvas');
    calCanvas.width = CAL_W;
    calCanvas.height = CAL_H;
  }
  const ctx = calCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, CAL_W, CAL_H);
  ctx.drawImage(src, 0, 0, CAL_W, CAL_H);

  let data: Uint8ClampedArray;
  try { data = ctx.getImageData(0, 0, CAL_W, CAL_H).data; }
  catch { return null; }                    // canvas "sujo" — segue sem correção

  let minX = CAL_W, maxX = -1, minY = CAL_H, maxY = -1;
  for (let i = 3, p = 0; i < data.length; i += 4, p++) {
    /* 40 e não 0: o downscale espalha um halo quase transparente em volta da
       silhueta, e contá-lo devolveria a moldura inteira como "ocupada". */
    if (data[i] < 40) continue;
    const x = p % CAL_W, y = (p / CAL_W) | 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (maxX < 0) return null;                // nada desenhado
  const used = Math.max((maxX - minX + 1) / CAL_W, (maxY - minY + 1) / CAL_H);
  return used > 0.05 ? used : null;         // medida sem sentido: não mexe
}

/* Ajusta o enquadramento desta cabine olhando o resultado, e deixa a última
   volta na tela como a imagem boa.
   Iterativo e não uma conta só: aproximar a câmera NÃO aumenta a silhueta na
   mesma proporção (a projeção é perspectiva), então uma correção única calculada
   como "quero 0.90, tenho 0.55" passa do ponto — na primeira tentativa passou, e
   o caminhão saiu encostando nas quatro bordas. Duas ou três medidas convergem,
   e isto roda UMA vez por cabine: as outras onze cores herdam o fator. */
function calibrate(entry: CabEntry, st: Stage): number {
  let fit = 1;
  for (let pass = 0; pass < 3; pass++) {
    const used = measureSilhouette(st.renderer.domElement);
    if (used == null) break;
    if (used >= FIT_MIN && used <= FIT_MAX) break;
    /* Passo limitado: uma medida estranha (um mesh gigante invisível, um
       recorte) não pode enfiar a câmera dentro do caminhão nem jogá-la longe. */
    fit *= Math.min(1.35, Math.max(0.72, used / FIT_TARGET));
    frame(st.camera, entry.root, fit);
    st.renderer.render(st.scene, st.camera);
  }
  return fit;
}

/* WebP com alfa custa ~1/4 de um PNG do mesmo tamanho, e são doze cores vezes
   quantos modelos o catálogo tiver morando em memória. Se o motor não codificar
   webp, toDataURL devolve um PNG com outro prefixo — daí a checagem em vez de
   confiar no argumento. */
function encode(canvas: HTMLCanvasElement): string {
  const webp = canvas.toDataURL('image/webp', 0.95);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
}

function drawShot(entry: CabEntry, hex: string, finish: PaintFinish): string | null {
  const st = getStage();
  if (!st) return null;

  const look = FINISH_MAT[finish] || FINISH_MAT.solid;
  const col = new THREE.Color(hex);
  for (const m of entry.paint) {
    m.color.copy(col);
    m.metalness = look.metalness;
    m.roughness = look.roughness;
    m.clearcoatRoughness = look.ccRough;
    m.needsUpdate = true;
  }

  st.scene.add(entry.root);
  try {
    frame(st.camera, entry.root, entry.fit ?? 1);
    st.renderer.render(st.scene, st.camera);
    /* Primeira miniatura desta cabine: acerta o enquadramento olhando o
       resultado e guarda o fator. As outras onze cores já saem prontas. */
    if (entry.fit === undefined) entry.fit = calibrate(entry, st);
    return encode(st.renderer.domElement);
  } finally {
    /* Sai da cena SEMPRE: a próxima miniatura pode ser de outra cabine, e duas
       cabines na mesma cena sairiam as duas no card. */
    st.scene.remove(entry.root);
  }
}

/**
 * A miniatura desta cabine nesta cor. Resolve com uma data URL, ou com null
 * quando não há como gerar uma (sem WebGL, sem geometria leve, erro de rede) —
 * nesse caso o card mantém a imagem do manifesto.
 *
 * Renders são serializados: chamar isto para doze cores de uma vez é o uso
 * previsto, e elas vão pingando na tela conforme ficam prontas.
 *
 * @param {string} cabId id em models/cabs.json
 * @param {string} hex   cor base sRGB
 * @param {'solid'|'metallic'|'pearl'} finish
 * @returns {Promise<string|null>}
 */
export function cabPreview(cabId: string, hex: string, finish: PaintFinish): Promise<string | null> {
  reacquire();
  const key = cabId + '|' + hex + '|' + finish;
  const done = shots.get(key);
  if (done) return Promise.resolve(done);
  const inflight = pending.get(key);
  if (inflight) return inflight;
  if (!hasCabPreview(cabId)) return Promise.resolve(null);

  const job = chain
    /* Primeira checagem: os doze `.then` desta fila são encadeados de uma vez, e
       os que ainda não rodaram vão rodar depois do desmonte. Sem isto cada um
       deles ainda dispararia o download da geometria da cabine e deixaria a
       entrada em `cabs` — geometria nova, adquirida DEPOIS de releaseStage(), que
       ninguém mais vai liberar. */
    .then(() => (released ? null : loadCabForPreview(cabId)))
    .then((entry) => {
      /* Segunda checagem, e a que fecha a janela estreita: `entry` pode ter sido
         resolvida ANTES do desmonte e chegar aqui DEPOIS dele, apontando para
         geometria que releaseStage() já descartou. getStage() dentro de
         drawShot() devolveria null e o card cairia na foto de qualquer jeito;
         sair aqui evita percorrer a cena com malhas mortas para chegar à mesma
         resposta. */
      if (released || !entry) return null;
      const url = drawShot(entry, hex, finish);
      if (url) shots.set(key, url);
      touchIdle();
      return url;
    })
    .catch((e: unknown) => {
      console.warn('[truck-studio] miniatura falhou', e instanceof Error ? e.message : String(e));
      return null;
    })
    .finally(() => { pending.delete(key); });

  pending.set(key, job);
  /* A corrente segue mesmo se ESTE render falhar — um erro não pode parar a
     fila inteira de miniaturas. */
  chain = job.catch(() => null);
  return job;
}

/**
 * A miniatura JÁ pronta, sem disparar render nenhum. É o que evita o card
 * piscar: quem já tem imagem em cache pinta na primeira volta.
 * @returns {string|null}
 */
export function peekCabPreview(cabId: string, hex: string, finish: PaintFinish): string | null {
  return shots.get(cabId + '|' + hex + '|' + finish) || null;
}

/** Baixa a geometria da cabine antes de alguém pedir a primeira miniatura. */
export function warmCabPreview(cabId: string | null | undefined) {
  reacquire();
  if (!cabId || !hasCabPreview(cabId)) return;
  chain = chain.then(() => (released ? null : loadCabForPreview(cabId))).catch(() => null);
}

/**
 * Renderiza a paleta INTEIRA desta cabine agora e devolve quando terminar.
 *
 * O passo da cor abre com um card por cor, e cada card só pedia a miniatura ao
 * ser montado — então clicar em "Trocar" mostrava três placeholders listrados
 * com as iniciais do nome enquanto os renders saíam em fila. Kennedy: "prefiro
 * que o loading inicial seja maior do que ele ter um load quando clico para
 * mudar a cor." Mesma regra que levou warmLightPrograms() para dentro do loader,
 * e pelo mesmo motivo: o usuário aceita esperar onde já está esperando.
 *
 * As data URLs ficam em `shots`, que releaseStage() NÃO limpa — o contexto WebGL
 * pode ser solto por ociosidade sem que isto precise rodar de novo.
 *
 * Nunca lança e nunca rejeita: uma miniatura é enfeite, e o estúdio não pode
 * deixar de montar porque um card não renderizou.
 */
export function prewarmCabPreviews(
  cabId: string | null | undefined,
  palette: { hex: string; finish: PaintFinish }[],
  onProgress?: (f: number) => void,
): Promise<void> {
  reacquire();
  if (!cabId || !hasCabPreview(cabId) || !palette.length) {
    if (onProgress) onProgress(1);
    return Promise.resolve();
  }
  /* Serializado pela própria `chain` de cabPreview() — um canvas só, dois
     renders concorrentes leriam o buffer um do outro. Como é serial, contar
     quantos terminaram É a fração: doze renders + doze toDataURL() a 960x600
     levam de meio a dois segundos, e sem este relato eles são parte do trecho
     em que a barra não se mexia. */
  let done = 0;
  const tick = () => {
    done++;
    if (onProgress) onProgress(done / palette.length);
  };
  return Promise.all(palette.map((c) =>
    cabPreview(cabId, c.hex, c.finish).then(tick, tick)))
    .then(() => undefined)
    .catch(() => undefined);
}

/* Solta contexto, texturas e geometria. As data URLs continuam: são leves perto
   de um contexto WebGL, e são o motivo de reabrir o seletor não custar nada. */
function releaseStage() {
  for (const entry of cabs.values()) {
    entry.root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (o.isMesh) o.geometry?.dispose();
    });
    for (const m of entry.paint) m.dispose();
  }
  cabs.clear();
  if (!stage) return;
  stage.envRT.dispose();
  stage.pmrem.dispose();
  stage.renderer.dispose();
  stage.renderer.forceContextLoss();
  stage = null;
}

/** Libera o contexto agora (o estúdio saiu da rota). Idempotente. */
export function disposePreviews() {
  /* Antes de releaseStage(), para que nada que rode dentro dele — ou logo depois
     dele, num `.then` já agendado — consiga reabrir um contexto. Ver `released`. */
  released = true;
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  releaseStage();
}
