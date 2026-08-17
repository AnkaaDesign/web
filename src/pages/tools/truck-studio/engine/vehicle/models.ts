/* Manifest loading, model loading (cabs declaring format 'fbx-scania' come from
   the ORIGINAL FBX via FBXLoader with runtime material treatment; trailer +
   volvo = curated GLBs), cab switching, grounding, coupling. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { scene, renderer, onRig, invalidate, frameAll, setVehicleFocus } from '../scene/scene';
import {
  makePaintMaterial, forgetPaintMaterial, setPaint, isPaintMaterial,
} from './paint';
import {
  setupCommon, setShadowCasters, isPaintableMaterial, materialNamesOf, maskOnly,
  textureAnisotropy, neutralizeBakedChroma,
} from './material-setup';
import { captureReflectionProbe } from '../scene/probe';
import { VEHICLES_DIR, DRACO_DECODER_DIR } from '../core/paths';
import { ktx2Loader, preloadKtx2 } from '../core/ktx2';
import { markShared } from './geometry-share';
import { prefetch } from '../core/prefetch';
import { assetUrl } from '../catalog/catalog';
import type { Rig } from '../scene/presets';
import { TrailerRig, type TrailerDims, type DoorSpec, type Face } from './trailer-rig';
import { RIB_FLAT_CENTER, TRAILER_ROOF_MESH } from './trailer-geometry';
import { TRIM_WIDTH } from './trailer-door';
import { swapTrailerWheels } from './wheels';
import { buildLandingGear, setLandingGearDown } from './landing-gear';
import {
  loadPlateManifest, attachCabPlate, detachCabPlate, attachTrailerPlate, placeTrailerPlate,
} from './license-plate';
import {
  solveCoupling, pickKingpinStation, findTractor, defaultsOf, FALLBACK_DEFAULTS,
  type TractorHitch, type HitchManifest, type CouplingSolution,
  type CouplingDefaults, type Profile, type ImplementHitch,
} from './coupling';

export { makePaintMaterial };
export type { TrailerDims };
export type { CouplingSolution };

/* Mensagem legível de um valor lançado — `catch (e)` é `unknown` sob strict. */
const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/* ---------------- types ---------------- */

/* ---------------- POR QUE `cabs.json` FOI APOSENTADO ----------------
   Ele indexava a geometria por um id de CABINE (`scania`, `volvo`, `daf`) e o
   catálogo apontava para esse id. Duas coisas erradas, e a segunda é grave:

   1. UMA INDIREÇÃO QUE NÃO PAGAVA POR SI. O manifesto de marcas já sabia qual
      arquivo queria; passar por um segundo manifesto para descobrir o mesmo
      caminho só criava um lugar a mais para os dois discordarem — e eles
      discordaram: `chassis[].file` do brands.json v2 não tinha nenhum `cab`
      correspondente, então a geometria simplesmente não ligava.

   2. GUARDAVA DADO DERIVADO. Os valores de `cabs.json` eram
      PÓS-NORMALIZAÇÃO: traziam assados por dentro o `CAB_FORWARD_GAP = 0.10` e
      a convenção "traseira da cabine em z=0". Isso os tornava inúteis para o
      desktop, que normaliza noutro ponto, e os invalidava a cada re-bake — sem
      erro nenhum, só um caminhão alguns centímetros fora do lugar.

   O QUE ENTROU NO LUGAR, e é a mesma forma nos dois apps:
     `chassis[].file`  → QUAL geometria (catalog/catalog.ts)
     `hitch.json`      → ONDE ela vai, em ESPAÇO CRU DO GLB

   `hitch.json` traz por tratora `orientYaw`, `groundY`, `centerX`, o bloco
   completo da quinta roda, `rearBody`, `axles`, `wheelMeshRegex` e `bbox` —
   mais uma impressão digital `sha256` do arquivo de origem, que é o que torna
   dado velho DETECTÁVEL em vez de silenciosamente errado.

   A junção entre os dois é o CAMINHO DO ARQUIVO (`tractors[*].sourceFile`), não
   um id: um id seria uma terceira coisa a manter em sincronia, e o caminho já é
   único por construção. */

/* O LADO CAVALO do contrato já é lido por `vehicle/coupling.ts`
   (`HitchManifest`, `findTractor()`, `defaultsOf()`), carregado em
   `state.hitch` mais abaixo. NÃO existe um segundo leitor de `hitch.json` neste
   arquivo: `findTractor(state.hitch, { file })` casa pelo `sourceFile`
   normalizado, que é exatamente a junção que o catálogo precisa. */

/** O que o carregador precisa saber para montar UMA geometria de cavalo. */
export interface CabDef {
  /** o próprio caminho do arquivo — a chave de identidade agora */
  id: string;
  name: string;
  /** caminho relativo a STUDIO_BASE; resolver com assetUrl() */
  file: string;
  /** 'fbx-scania' routes through FBXLoader + convertScaniaMaterials() */
  format?: string;
  /**
   * Geometria LEVE, só para as miniaturas dos cards (ui/preview.ts). Existe
   * porque `file` pode ser um FBX de dezenas de MB — a fonte aprovada para o
   * estúdio — e um card de 220 px não justifica esse download. Ausente numa
   * cabine que já é .glb: ali `file` serve para as duas coisas.
   */
  preview?: string;
  /** Override AUTORADO dos materiais que aceitam tinta neste bake, vindo do
   *  `brands.json`. `null` = não declarado → vale a detecção de
   *  `isPaintableMaterial()`. `[]` = "nenhum material aceita tinta". */
  paintMaterials?: string[] | null;
  /**
   * Direção da câmera da MINIATURA desta cabine (ui/preview.ts), no referencial
   * do modelo — mesmo eixo do VIEW_DIR de scene/view.ts, +Z na dianteira.
   * Ausente = usa o VIEW_DIR global, que é o caso normal.
   *
   * Existe porque o ângulo do card é um só para todas as cabines e a LEITURA
   * dele não é: um S-Way, mais largo e de lateral reta, aparece mais de perfil
   * que um FH no mesmo azimute. Isto NÃO afeta a abertura do estúdio, que segue
   * o VIEW_DIR global — o card é a promessa e a cena é a entrega, e afastar os
   * dois de propósito é uma decisão por veículo, não um acidente.
   */
  viewDir?: number[];
  wheelMeshRegex?: string;
  dims?: { height: number; length: number };
  /** kingpin plate: null → legacy trailer placement */
  fifthwheel?: { z?: number; topY?: number } | null;
  /** z of the cab's rearmost bodywork, for the no-overlap clamp */
  rearBodyZ?: number;
  /** filled by the HEAD probe: false = not exported yet */
  available?: boolean;
}

/** The subset of trailer_meta.json this module reads. */
export interface TrailerMeta {
  kingpin?: { zFromFront: number; plateBottomY?: number };
  outlineSide?: number[][];
  outlineRear?: number[][];
}

/** Everything loaded into the scene about the vehicle itself. */
export interface VehicleState {
  trailerMeta: TrailerMeta | null;
  cabGroup: THREE.Group;
  trailerGroup: THREE.Group;
  cab: THREE.Object3D | null;
  /** O CAMINHO do .glb em cena — a identidade da geometria carregada agora.
   *  Era o id de `cabs.json`; virou o arquivo, que é o que o catálogo aponta. */
  cabId: string | null;
  cabDef: CabDef | null;
  cabBox: THREE.Box3 | null;
  trailer: THREE.Object3D | null;
  /** O baú paramétrico. `null` num bake sem o material branco de fábrica — o
   *  implemento continua carregando, só não redimensiona (ver buildTrailerRig). */
  trailerRig: TrailerRig | null;
  /** captured after grounding, so placeTrailer() can re-derive from a fixed pose */
  trailerBase: { pos: THREE.Vector3; frontZ: number } | null;
  trailerBox?: THREE.Box3;
  /** metres from the front wall back to the tyre contact patch — the pivot the
   *  coupling pitch turns about. Constant for a given implement. */
  trailerPivotFromFront?: number;
  /** half the bogie's length. Pitching about the bogie centre sinks whichever
   *  end is downhill by this times sin(pitch); the placement compensates. */
  trailerTyreHalfSpan?: number;
  /** Thermo King unit (protrudes toward the cab) */
  tk: THREE.Object3D | null;
  tkDepth: number;
  /** Tamanho REAL da carcaça, medido depois da escala uniforme. Guardado porque
   *  `placeThermoKing()` rederiva a pose a cada medida e não pode remedir o
   *  produto — ele não muda de tamanho quando o baú muda. */
  tkSize?: THREE.Vector3;
  /** `topGap` do manifesto: metros entre a linha do teto e o topo da carcaça. */
  tkTopGap?: number;
  paintMats: THREE.Material[];
  /** 'both' paints the trailer panels too */
  paintTarget: 'cab' | 'both';
  /** `models/vehicles/hitch.json` — o lado CAVALO do contrato de engate. */
  hitch: HitchManifest | null;
  /** os `defaults` do manifesto, já com degradação campo a campo */
  hitchDefaults: CouplingDefaults;
  /**
   * A entrada da cabine corrente, com `rearProfile` MEDIDO do modelo carregado.
   * `null` numa cabine fora do manifesto → `placeTrailer()` cai no legado.
   */
  cabHitch: TractorHitch | null;
  /** A última solução de engate — a HUD e a sonda leem daqui. */
  coupled: CouplingSolution | null;
  trailerPaintMat: THREE.MeshPhysicalMaterial | null;
  /** front-wall paint overlays; `undefined` = not built yet, `[]` = none found */
  frontWalls?: THREE.Mesh[];
  frontWallMat?: THREE.MeshPhysicalMaterial;
  coupling: { z: number; y: number };
}

/** A mesh predicate, or a regex tested against the object's name. */
type MeshMatcher = RegExp | ((o: THREE.Mesh) => boolean);

/* The Blender-processed scania GLB was rejected by the user — the original FBX
   through three.js FBXLoader (like the old scania viewer) is the approved look.
   This stays the DEFAULT source for the 'fbx-scania' format; a cab may point at
   another .fbx of its own, which is what lets more cabs share this pipeline. */
const SCANIA_FBX = VEHICLES_DIR + 'scania.fbx';
const STEER_TIRE_OD = 1.015;   // m — real steer-tire outer diameter anchors the FBX scale

/* Legacy values used when manifests are not (yet) available. */
const LEGACY_TRAILER_FRONT_Z = 2.65;

/* NÃO existe mais uma lista de nomes padrão. Ela era `['carpaint']`, herdada do
   `cabs.json` aposentado, e a premissa embutida — "todo bake chama a lataria de
   carpaint" — só valia para as três geometrias curadas de `models/vehicles/`.
   Quem decide agora é `isPaintableMaterial()`, que pergunta pelo SHADER e não
   pelo nome; o nome continua valendo em OU, e a lista autorada por bake voltou
   a ser possível via `chassis[].paintMaterials` no brands.json. */
const DEFAULT_WHEEL_RE = 'tire|rim|pneu';

try { localStorage.removeItem('truckstudio.coupling.v1'); } catch { /* legacy key */ }

export const state: VehicleState = {
  trailerMeta: null,
  cabGroup: new THREE.Group(),
  trailerGroup: new THREE.Group(),
  cab: null, cabId: null, cabDef: null, cabBox: null,
  trailer: null, trailerRig: null,
  hitch: null, hitchDefaults: FALLBACK_DEFAULTS, cabHitch: null, coupled: null,
  trailerBase: null,                    // { pos, frontZ } captured after grounding
  tk: null, tkDepth: 0,                 // Thermo King unit (protrudes toward the cab)
  paintMats: [],
  paintTarget: 'cab',                   // 'cab' | 'both' (trailer panels painted too)
  trailerPaintMat: null,
  coupling: { z: 0, y: 0 },             // fixed: coupling is fully computed now
};
/* ---------------- onde o conjunto fica no cenário ----------------
   O caminhão não nasce mais na origem: ele fica 12 m adiante e virado 180°, ou
   seja sobre a faixa e apontando para a saída do pátio em vez de para o fundo
   dele. É a mesma pose do card do cenário — o estúdio e o thumbnail não podem
   mostrar coisas diferentes.

   POR QUE UM NÓ PAI, e não a posição dos dois grupos (que foi a primeira
   tentativa e quebrou): o assentamento e o engate — groundAndCenter(), o
   ancoramento em z de loadCab(), attachThermoKing() — medem caixas em ESPAÇO DE
   MUNDO e descontam o resultado de posições LOCAIS. Essa conta só fecha com o
   conjunto na origem. Com os grupos deslocados, cada medida voltava já com o
   deslocamento dentro e ele era descontado de novo; com o giro de 180° os eixos
   x/z ainda trocavam de sinal e o implemento ia parar longe do cavalo — medido:
   caixa do conjunto em z 17,8…36,7 em vez dos 5,8…24,6 esperados.

   Então o LUGAR mora aqui em cima, e é posto na identidade enquanto a conta
   roda (setRigPlacement(false) logo depois de cada download, restaurado no fim
   de placeTrailer, que é por onde todos os caminhos passam). Entre um e outro
   não existe quadro desenhado: as duas chamadas caem no mesmo trecho síncrono
   depois do await, então o conjunto nunca aparece na origem.

   O resto do motor não muda: focusOnRig(), frameAll() e a sonda de reflexo
   medem a caixa dos grupos, então a órbita e o probe acompanham sozinhos. */
export const rigGroup = new THREE.Group();
rigGroup.name = 'RIG';
/* z é medido no EIXO DA PISTA, não no sentido da cabine: com o giro de 180° o
   caminhão aponta para o -Z, então recuar (dar ré) é aumentar z. 4 = os 12 da
   primeira posição mais os 10 de recuo, menos 18 de avanço. */
export const RIG_PLACEMENT = { z: 4, yaw: Math.PI };
/** Estado corrente da colocação — ver o gancho no fim de setRigPlacement(). */
let placementOn = false;

/** Liga (true) ou suspende (false) o lugar do conjunto no cenário. */
function setRigPlacement(on: boolean) {
  const voltando = on && !placementOn;
  placementOn = on;
  rigGroup.position.set(0, 0, on ? RIG_PLACEMENT.z : 0);
  rigGroup.rotation.set(0, on ? RIG_PLACEMENT.yaw : 0, 0);
  /* rigGroup roda com `matrixAutoUpdate = false` (ver freezeMatrices), então a
     matriz local NÃO se recompõe sozinha: sem esta linha o updateWorldMatrix
     abaixo propagaria a colocação ANTERIOR para o conjunto inteiro — que é
     exatamente o erro de medida que o bloco acima desta função existe para
     evitar. Chamar updateMatrix() é inócuo quando a flag está ligada, então a
     ordem entre um e outro nunca importa. */
  rigGroup.updateMatrix();
  rigGroup.updateWorldMatrix(true, true);
  /* ⚠️ **É AQUI QUE AS LUZES PASSAM A TER ONDE MEDIR.** Todo caminho de carga
     suspende a colocação (`setRigPlacement(false)`), faz as contas de engate em
     espaço de mundo e restaura no fim. Antes desta linha ninguém avisava
     `lights.ts` de que o conjunto tinha ido para o lugar: as faces continuavam
     as da última medida — no pior caso as do espaço LOCAL —, e a régua de cor por
     fragmento passava a comparar mundo com local. Traseira laranja, letreiro do
     teto dourado, feixe do farol na escada da cabine.
     Só na SUBIDA da bandeira, para não remedir de graça nas três chamadas
     seguidas de `false` que uma carga faz. */
  if (voltando) invalidateVehicleLightBounds();
}

/* ---------------- static matrices ----------------
   A loaded root and everything under it is FURNITURE: the implement's ~5852
   nodes hold the pose the bake gave them and never move again relative to their
   root. With the default `matrixAutoUpdate` three still calls `updateMatrix()`
   on every one of them on every frame, recomposing a matrix out of a position,
   quaternion and scale that have not changed since the download finished.

   Freezing is safe here in a way it usually is not, and the reason is worth
   writing down: the flag controls ONLY whether the LOCAL matrix is recomposed
   from position/quaternion/scale. A frozen node whose `matrix` is already
   correct is a node that renders correctly.

   AN EARLIER VERSION OF THIS PARAGRAPH GAVE THE WRONG REASON, and the wrong
   reason has since stopped being true — which is why it is called out instead of
   quietly rewritten. It argued the freeze was safe because "the Scene root keeps
   `matrixAutoUpdate` on and dirties the whole graph from the top, so `force`
   reaches every node here regardless". `scene/scene.ts` now sets
   `scene.matrixAutoUpdate = false` (the scene is never transformed, and leaving
   it live forced a full `matrixWorld` cascade over ~5852 nodes every frame —
   the other half of the cost this freeze exists to remove). So there is no
   longer any top-down `force` to rely on.

   The freeze is still safe, for the STRONGER reason below — which held all
   along and is the one that actually carries it:

   WHOEVER WRITES position, rotation OR scale ON A FROZEN NODE MUST CALL
   updateMatrix(). `updateMatrix()` also sets `matrixWorldNeedsUpdate`, so the
   world matrix still propagates from that node down. In this module the writers
   are setRigPlacement(), placeTrailer() and groundAndCenter(), and all three do.
   Readers are unaffected: Box3.expandByObject(), bboxOfMatching() and frameAll()
   call updateWorldMatrix() themselves.

   TWO OBLIGATIONS THE FREEZE CREATES, both easy to trip over:

   1. REPARENTING A FROZEN NODE IS UNSAFE. `Object3D.add()` does not dirty the
      child, so a frozen node moved to a new parent keeps a world matrix derived
      from the old one until something calls updateMatrix() on it.
   2. `window.__studio` publishes `cabGroup`, `trailerGroup`, `cab` and
      `trailer`. A console user writing `.position` on any of them now has to
      call `.updateMatrix()` too, or nothing appears to happen.

   The failure mode is loud rather than subtle — the object simply does not move
   — which is the right way for something whose entire claim is "no visual
   change" to break. */
function freezeMatrices(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  root.traverse((o) => { o.matrixAutoUpdate = false; });
}

rigGroup.add(state.cabGroup, state.trailerGroup);
scene.add(rigGroup);
/* Os três nós que seguram o conjunto também não se mexem sozinhos: rigGroup só é
   escrito por setRigPlacement(), e os dois grupos ficam na identidade pela vida
   inteira da página. Congelados pelo mesmo motivo dos nós carregados, e
   setRigPlacement() carrega o updateMatrix() que o congelamento torna
   obrigatório. */
rigGroup.matrixAutoUpdate = false;
state.cabGroup.matrixAutoUpdate = false;
state.trailerGroup.matrixAutoUpdate = false;
setRigPlacement(true);

/* ---------------- loaders ----------------
   EVERY URL THAT LEAVES THIS MODULE GOES THROUGH assetUrl(), and it happens
   HERE instead of at the ~10 call sites. The asset tree is moving out of the web
   app's own `public/` and behind the API, which means assetUrl() stops being the
   pass-through it is today and starts prefixing an origin. A call site that
   still hands a bare `VEHICLES_DIR + 'trailer.glb'` to the loader would keep
   resolving against the site root and 404 the moment that lands, and there is no
   type error to catch it — these are strings, not imports.

   Putting it in the helper is safe because assetUrl() is IDEMPOTENT:
   assetUrl(assetUrl(x)) === assetUrl(x). That property is load-bearing rather
   than incidental, because scene/set.ts and scene/environment.ts call loadGLB()
   with URLs they have ALREADY resolved — double-prefixing has to be impossible,
   not merely unlikely.

   HOW it is guaranteed changed in 2026-08-03, and the difference matters if you
   ever touch assetUrl(). It used to fall out for free: `/` was one of the
   alternatives in ABSOLUTE_RE, so any already-resolved path was returned
   untouched. The move to the API removed that alternative — it HAD to, because a
   site-root path now points at the web origin, which no longer holds the tree.
   In the default same-origin configuration assetUrl()'s own output begins with
   `/studio-assets/v1`, i.e. exactly the shape that stopped being a pass-through,
   so the free version of the property died with it.

   What replaces it is an explicit test in assetUrl(): it strips a leading base
   prefix before re-adding one, so feeding it its own output is a no-op by
   construction rather than by regex accident. See the `BASE_REL` guard and the
   `POR QUE A IDEMPOTÊNCIA É CONTRATO` block in catalog/catalog.ts. Do not
   "simplify" that guard away on the grounds that the output is already
   absolute — under the same-origin default it is not. */
const draco = new DRACOLoader().setDecoderPath(DRACO_DECODER_DIR);
/* The 248 KB wasm decoder is fetched LAZILY on the first Draco-compressed
   primitive — that is, in the middle of parsing the first model, where the round
   trip has nothing to overlap with and lands squarely inside the user's wait.
   preload() moves that fetch to module evaluation, where it runs alongside the
   manifest reads and the HEAD probes and is paid for by nobody. If the decoder
   is unreachable the failure simply resurfaces on the first real Draco load,
   which is where it can be reported. */
draco.preload();

/* ---------------- KTX2, e a ORDEM DE DEPLOY INVERTIDA ----------------
   Este registro tem de estar NO AR **antes** de o primeiro `.glb` com
   `KHR_texture_basisu` ser publicado, e é o inverso da ordem de todo o resto
   do acervo.

   O motivo: para KTX2 dentro de um `.glb` a extensão entra em
   `extensionsRequired` — não há fonte de reserva declarada —, e o `GLTFLoader`
   **LANÇA** quando encontra uma extensão obrigatória sem carregador registrado.
   Um asset publicado antes do código não degrada em textura feia: quebra o
   carregamento inteiro, e com ele o estúdio.

   Hoje nenhum arquivo da árvore usa KTX2, então isto é inerte — e é exatamente
   por isso que ele entra AGORA, barato, em vez de junto com o primeiro asset.
   O `preload` é o irmão do `draco.preload()` acima, pelo mesmo motivo: sem ele
   os 527 kB do transcodificador seriam buscados no meio da primeira carga, onde
   a ida e volta não tem nada com que se sobrepor. Ver `core/ktx2.ts`. */
preloadKtx2(renderer);
const loader = new GLTFLoader()
  .setDRACOLoader(draco)
  .setKTX2Loader(ktx2Loader(renderer));
const fbxLoader = new FBXLoader();

/* ---------------- stall guard ----------------
   NOTHING in this engine had a deadline: no AbortController, no signal, no
   timeout anywhere. A download that FAILS rejects and the curtain comes down
   with a message, but a download that STALLS — socket open, bytes stopped —
   never settles at all, and the loading curtain stays up forever over a 286 MB
   implement with no way out but a reload.

   The clock below is an INACTIVITY clock, not a total budget, and that
   distinction is the whole design. The implement is 286 MB: a flat 90 s ceiling
   would abort a perfectly healthy download on any link slower than ~25 Mbps,
   which trades a real load away to catch a hypothetical one — exactly the trade
   this engine is not allowed to make. Every progress event re-arms the timer, so
   a slow-but-moving transfer runs as long as it needs and only true silence
   fails. The same window covers the parse: after the last progress event the
   decoder gets a full GEOMETRY_STALL_MS before anyone gives up on it.

   three's loaders take no signal, so the socket is not actually cancelled — the
   remaining bytes arrive into a promise nobody is waiting on any more. What this
   buys is a curtain that comes DOWN, with an explanation, instead of one that
   never does. */
const GEOMETRY_STALL_MS = 90_000;
const MANIFEST_TIMEOUT_MS = 15_000;

/** Último segmento da URL — um erro que chega à tela não pode ser um caminho. */
const fileLabel = (url: string) => (url.split(/[?#]/)[0].split('/').pop() || url);

/** Mensagem em português: estas rejeições sobem para a cortina de carregamento. */
const stallMessage = (what: string, ms: number) =>
  `Tempo esgotado ao carregar ${what}: ${Math.round(ms / 1000)} s sem resposta do `
  + 'servidor. Verifique a conexão e tente novamente.';

/**
 * Roda `run` sob um relógio de inatividade. `run` recebe um `ping` e deve
 * chamá-lo a cada sinal de vida (cada evento de progresso); cada ping rearma o
 * relógio do zero. Sem ping por `ms`, a promessa rejeita.
 */
function withTimeout<T>(
  run: (ping: () => void) => Promise<T>, ms: number, what: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;
    const stop = () => {
      settled = true;
      if (timer) { clearTimeout(timer); timer = null; }
    };
    const arm = () => {
      if (settled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { stop(); reject(new Error(stallMessage(what, ms))); }, ms);
    };
    arm();
    run(arm).then(
      (v) => { stop(); resolve(v); },
      (e: unknown) => { stop(); reject(e); },
    );
  });
}

export function loadGLB(url: string, onProgress?: (t: number) => void): Promise<THREE.Group> {
  const href = assetUrl(url);
  return withTimeout<THREE.Group>((ping) => new Promise((resolve, reject) => {
    loader.load(href,
      g => resolve(g.scene),
      /* ping() ANTES do teste de `e.total`: um servidor que não manda
         content-length continua provando que a conexão está viva. */
      e => { ping(); if (e.total && onProgress) onProgress(e.loaded / e.total); },
      () => reject(new Error('Falha ao carregar ' + href)));
  }), GEOMETRY_STALL_MS, fileLabel(href));
}

export function loadFBX(url: string, onProgress?: (t: number) => void): Promise<THREE.Group> {
  const href = assetUrl(url);
  return withTimeout<THREE.Group>((ping) => new Promise((resolve, reject) => {
    fbxLoader.load(href,
      root => resolve(root),
      e => { ping(); if (e.total && onProgress) onProgress(e.loaded / e.total); },
      (err: unknown) => reject(new Error('Falha ao carregar ' + href +
        (err ? ' — ' + errText(err) : ''))));
  }), GEOMETRY_STALL_MS, fileLabel(href));
}

/* ---------------- manifests ----------------
   A manifest is a few KB, so 15 s of silence is already a broken link — and
   unlike the geometry there is a real fallback waiting behind it (DEFAULT_CABS,
   the legacy coupling), which makes failing fast strictly better than waiting.
   This one really does abort: `fetch` takes a signal, three's loaders do not. */
async function fetchJSON(url: string) {
  const href = assetUrl(url);
  /* Detectado, não assumido: AbortSignal.timeout é Chrome 103 / Safari 16. Onde
     não existir, a busca fica sem prazo — que é exatamente o comportamento que
     esta linha substitui, nunca pior. */
  const signal = typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(MANIFEST_TIMEOUT_MS)
    : undefined;
  let r: Response;
  try {
    r = await fetch(href, { cache: 'no-cache', signal });
  } catch (e: unknown) {
    /* A DOMException de um sinal expirado diz "signal timed out", em inglês, e
       estas mensagens podem chegar ao usuário. */
    if ((e as { name?: string } | null)?.name === 'TimeoutError') {
      throw new Error(stallMessage(fileLabel(href), MANIFEST_TIMEOUT_MS));
    }
    throw e;
  }
  if (!r.ok) throw new Error(href + ' → ' + r.status);
  return r.json();
}

export async function loadManifests() {
  /* THE TWO MANIFESTS ARE INDEPENDENT, so they leave together.
     The chain used to be cabs.json → (await) → four HEAD probes → (await) →
     trailer_meta.json, three strictly serial waits on a cold boot. But
     trailer_meta.json describes the IMPLEMENT — the kingpin and the panel
     outlines — and nothing in it is read to decide anything about the cabs, so
     the only reason it went last is that it was written last. Firing both now
     saves two round trips on every boot, and on a mobile link two RTTs is a
     visible slice of the time before the curtain moves at all.

     Each request carries its OWN catch, attached at creation. That is not style:
     an awaited-later promise that rejects meanwhile is an unhandled rejection in
     the console (and a hard error under some CSP/report setups), and the whole
     point of this block is that a missing manifest is a normal, survivable
     state. The fallbacks below are exactly the ones the serial version had. */
  const metaReq: Promise<TrailerMeta | null> = fetchJSON(VEHICLES_DIR + 'trailer_meta.json')
    .catch((e: unknown) => {
      console.warn('[manifest] trailer_meta.json indisponível — engate legado + painéis retangulares.', errText(e));
      return null;
    });
  /* O TERCEIRO MANIFESTO — `plates.json`, onde a placa de licenciamento mora em
     cada cavalo. Disparado AQUI, junto com os outros dois, e AGUARDADO no fim
     desta função (não neste ponto).

     ⚠️ Por que aguardado, se ele não bloqueia nada: `attachCabPlate()` lê o
     manifesto de forma SÍNCRONA, no fim de `loadCab()`. Na prática os 16 kB de
     JSON chegam muito antes dos ~28 MB de geometria — mas "na prática" não é
     uma garantia, e o modo de falhar é o pior possível: um cavalo sem placa, sem
     erro nenhum, dependendo da rede. Como a requisição já está em voo desde esta
     linha, o `await` do fim custa zero no caso comum e transforma a ordem numa
     propriedade do código. `loadPlateManifest()` já traz o próprio `catch`. */
  const placasReq = loadPlateManifest();

  /* Já em voo desde o topo da função — este await normalmente não espera nada. */
  state.trailerMeta = await metaReq;

  /* O CONTRATO DE ENGATE. Um arquivo, um caminho relativo, os dois apps:
     `models/vehicles/hitch.json`, resolvido por `assetUrl()` como todo o resto.
     Ausência não é erro fatal — cai no engate legado e diz por quê. */
  try {
    state.hitch = await fetchJSON(VEHICLES_DIR + 'hitch.json') as HitchManifest;
    state.hitchDefaults = defaultsOf(state.hitch);
    const n = Object.keys(state.hitch?.tractors ?? {}).length;
    console.info('[engate] hitch.json —', n, 'cavalos ·',
      'folga', state.hitchDefaults.cabTrailerClearance, 'm ·',
      'inclinação máx', (state.hitchDefaults.maxCouplingPitchRad * 180 / Math.PI).toFixed(1) + '°');
    /* `implements` VAZIO é decisão, não pendência: o baú é paramétrico e um
       número congelado aqui estaria errado no primeiro resize. O lado do
       implemento sai de `TrailerRig.hitch`. Ver o cabeçalho de coupling.ts. */
  } catch (e: unknown) {
    console.warn('[engate] hitch.json indisponível —', errText(e),
      '· o engate cai no caminho legado (assentamento medido em cena).');
    state.hitch = null;
    state.hitchDefaults = FALLBACK_DEFAULTS;
  }
  /* Em voo desde o topo da função — este await normalmente não espera nada. */
  await placasReq;
  return state;
}

/**
 * Monta o descritor de carga de uma geometria de cavalo a partir do CAMINHO
 * dela, casando com `hitch.json` quando existir medição.
 *
 * O roteamento de FORMATO continua dirigido por dado, não por id: um `.fbx`
 * entra pelo FBXLoader + convertScaniaMaterials() + a âncora de escala pelo
 * pneu direcional. Era `format: 'fbx-scania'` declarado no `cabs.json`; agora sai
 * da EXTENSÃO do arquivo, que é a mesma informação sem um manifesto para
 * mantê-la. As quatro geometrias de produção herdadas não têm caminho especial:
 * `scania.fbx` entra pelo FBX porque termina em `.fbx`, e `volvo.glb` pelo GLB
 * porque termina em `.glb`.
 */
export function cabDefFor(
  file: string, name?: string, paintMaterials?: string[] | null,
): CabDef {
  /* UM leitor de `hitch.json` no engine, e ele é o de coupling.ts. `findTractor`
     casa pelo `sourceFile` NORMALIZADO (barras e `./` iniciais), que é a junção
     certa: o catálogo aponta para o arquivo, não para a chave legível
     (`daf-xd-4x2-sl`) do manifesto. */
  const hit = findTractor(state.hitch, { file });
  return {
    id: file,
    name: name || file.split('/').pop() || file,
    file,
    format: /\.fbx(\?|$)/i.test(file) ? 'fbx-scania' : undefined,
    /* VEM DE FORA, e `null` = "use a convenção". Era `DEFAULT_PAINT_MATERIALS`
       cravado aqui — e como esta é a ÚNICA fábrica de CabDef, isso tornava o
       campo INALCANÇÁVEL por dado: declarar `paintMaterials` no brands.json não
       tinha efeito nenhum, sem erro e sem aviso. O override por bake volta a
       existir, que é o que permite consertar por manifesto os poucos arquivos
       em que a assinatura do shader não basta. */
    paintMaterials: paintMaterials ?? null,
    wheelMeshRegex: DEFAULT_WHEEL_RE,
    /* A quinta roda MEDIDA ganha do assentamento por caixa. `plateTopY` e `z`
       são exatamente os dois números que o engate precisa, e vêm em espaço cru
       do arquivo — que é a diferença toda em relação ao `cabs.json`, cujos
       valores já vinham normalizados e portanto não sobreviviam a um re-bake. */
    fifthwheel: hit
      ? { z: hit.fifthWheel.z, topY: hit.fifthWheel.plateTopY }
      : null,
    available: true,
  };
}

/* ---------------- material / mesh setup ----------------
   MOVIDO para ./material-setup.ts em 2026-08-09 — ver o cabeçalho de lá.
   Os nomes continuam saindo DESTE módulo (reexport abaixo), então nada que
   importava `setupCommon`/`isPaintableMaterial` daqui precisou mudar. */
export { setupCommon, isPaintableMaterial } from './material-setup';
import { notarTransparenciaForcada } from './headlight-cover';
import { invalidateVehicleLightBounds, unregisterVehicleLights } from './lights';

/* App-side transparency audit: ONLY real glass may be transparent. Anything
   else flagged transparent (rip artifacts, loader quirks) is forced opaque.
   Complements the model-side fixes; logs every decision for verification. */
const GLASS_OK_RE = /glass|vidro|lente|windshield|window|winscreen|cristal|glazing|acrilic/i;

/* THE THIRD KIND OF TRANSPARENCY: a cut-out decal.
   ---------------------------------------------------------------------------
   This audit used to know two kinds — real glass, which stays transparent, and
   everything else, which is a rip artifact and is forced opaque. A marking whose
   shape lives in its texture's ALPHA is neither. Forcing it opaque does not make
   it look solid; it makes the whole QUAD render, so the mark arrives inside a
   rectangle of whatever the transparent pixels happen to carry.

   That is what was happening to the Ankaa mark on the mudflaps: the trailer's
   boot logged `FORÇADO OPACO: logo-ankaa` on every load. The mark is a 4-triangle
   quad with a cut-out texture, so it lost its cut-out and gained a plate.

   The right treatment is neither of the other two: keep the alpha, but resolve it
   with alphaTest instead of blending, so the decal still WRITES DEPTH and needs
   no sorting. `transparent` goes back to false for exactly that reason — with
   alphaTest the discarded fragments never reach the blend stage, and an opaque
   draw is what keeps the mark from flickering against the surface behind it. */
/* `trim` ENTROU E SAIU EM 2026-08-17. Fica registrado porque a tentação de
   acrescentá-lo de novo é grande, e o raciocínio que a justificava é sedutor e
   ERRADO.
   ---------------------------------------------------------------------------
   Relato, com foto de um FH vermelho: *"a separação entre a janela do motorista
   e aquela coberta por adesivo, onde fica a cama, sangra a cor um pouco"*. Daí
   `w_trim_*` foi acrescentado a esta lista, sob o argumento de que mover um
   material de "forçado opaco" para `alphaTest = 0.5` seria um NO-OP quando a
   textura não tem transparência de verdade.

   A premissa era falsa, e MEDIR as duas texturas derrubou o argumento inteiro:

     · `volvo-fh-2024 → w_trim_dif` (128×512): alfa 0 em 100% DOS TEXELS, com RGB
       útil (~[35, 29, 33], o preto da divisória). Alfa zero em toda a imagem não
       é opacidade — é a convenção SCS de usar o canal alfa como máscara de
       brilho. Sob `alphaTest = 0.5` NADA passa no teste e a divisória inteira é
       descartada, deixando à mostra o vermelho da cabine que está atrás;
     · `volvo-fh-2021 → detail_c` (1024²): 40,4% dos texels com alfa PARCIAL. O
       limiar binariza esse degradê e transforma o acabamento numa tela
       perfurada, com o vermelho aparecendo pelos furos.

   Ou seja: a mudança não corrigiu o sangramento, ela trocou "vaza um pouco de
   cor" por "a peça some / vira peneira" — que é o que a segunda foto mostrava.
   O tratamento certo para `w_trim` é o de baixo, FORÇADO OPACO: nestes dois
   bakes o alfa não é recorte, e honrá-lo é justamente o defeito.

   Se o sangramento original voltar a ser relatado, ele NÃO está aqui — sob
   opacidade forçada nenhuma cor de carroceria atravessa este material. Procure
   em outro lugar antes de mexer neste regex. */
const DECAL_OK_RE = /logo|marca|adesivo|decal|faixa-?3m|placa/i;

function auditTransparency(root: THREE.Object3D, label: string) {
  const glassOk: string[] = [], decals: string[] = [], forced: string[] = [];
  const seen = new Set<string>();
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || !m.transparent || seen.has(m.uuid)) continue;
      seen.add(m.uuid);
      if (GLASS_OK_RE.test(m.name || '')) {
        glassOk.push(`${m.name} (op ${(m.opacity ?? 1).toFixed(2)})`);
      } else if (DECAL_OK_RE.test(m.name || '')) {
        const std = m as THREE.MeshStandardMaterial;
        std.transparent = false;
        std.opacity = 1;
        std.depthWrite = true;
        std.alphaTest = Math.max(std.alphaTest || 0, 0.5);
        std.needsUpdate = true;
        decals.push(m.name || '(sem nome)');
      } else {
        /* ⚠️ AVISA ANTES DE FECHAR. A capa do farol dos Scania de cabine nova é
           `f_bumper_mat_0005_plastic_glossy` — nome nenhum de vidro —, então esta
           regra a fechava e o conjunto óptico ficava enterrado atrás de um painel
           opaco, aceso a 40 de radiância e invisível. Foi o relato *"a lanterna
           frontal tem feixe de luz, mas nao sai da lanterna frontal do cavalo em
           si, ela esta apagada"*. Quem reabre — e SÓ na janela do farol, medida —
           é `vehicle/headlight-cover.ts`; aqui o veredito não muda. */
        notarTransparenciaForcada(m);
        m.transparent = false;
        m.opacity = 1;
        m.depthWrite = true;
        m.needsUpdate = true;
        forced.push(m.name || '(sem nome)');
      }
    }
  });
  console.info(`[transparency:${label}] vidro ok:`,
    glassOk.length ? glassOk.join(', ') : 'nenhum',
    decals.length ? `· recorte por alphaTest: ${decals.join(', ')}` : '',
    forced.length ? `· FORÇADO OPACO: ${forced.join(', ')}` : '· nada forçado');
}

/* WHERE THE IMPLEMENT'S BODY IS — and why this is not just the panel names.
   ---------------------------------------------------------------------------
   Three placements are measured off the body box, not off the whole object:
   the grounding/centring in loadTrailer(), the front-wall paint overlay, and the
   Thermo King mount. All three used the regex /^(SIDE_L|SIDE_R|REAR)$/, which is
   the merge-by-material bake's contract.

   An UNFLATTENED bake does not carry those three meshes — it keeps the rip's own
   2151 meshes and their node transforms. bboxOfMatching() then finds nothing and
   falls back to `setFromObject(root)`, the box of EVERYTHING. That box is a
   different object: it includes the mudflaps, the landing gear and — once the
   unit is attached — the Thermo King itself.

   Measured on the unflattened bake: body front wall z 1.945, whole-object max z
   2.773. So the mount plane was read 0.83 m too far forward and the unit was
   hung in mid-air ahead of the wall, which is exactly what Kennedy photographed;
   the same 0.83 m also went into `trailerBase.frontZ` and pushed the coupling
   off by the same amount.

   So the body is identified by what BOTH bakes agree on: the three named panels
   when they exist, otherwise the white-body material the panels were cut from.
   Falling back to the whole object is never right here, and this predicate
   removes that possibility.

   O NOME DO MATERIAL BRANCO ESTÁ EM `WHITE_BODY_SUB`, mais abaixo, e existe
   UMA vez: havia aqui um `WHITE_BODY_RE` com a mesma string, e duas cópias da
   mesma pergunta são duas chances de responder diferente. Quem pergunta "isto é
   carroceria?" chama `isBodyMesh()`, que já cuida da pintura. */

function bodyPanelPred(_root: THREE.Object3D): MeshMatcher {
  /* THE MATERIAL, NOT THE PANEL NAMES — in either bake.
     The named panels are only the OUTER SKIN cut out of the body; the roof cap
     and the frames stay behind on the joined mesh. Measuring the body by those
     names therefore reports a roof line ~0.21 m below the real one, and
     attachThermoKing() hangs the unit that much too low. That bit the moment
     buildLiveryPanels() started creating the same three names at runtime: the
     Thermo King dropped 21 cm on its own.
     Both bakes agree on the material — in the merged one the panels carry it too,
     so this predicate covers the skin AND the rest either way.

     E O INVISÍVEL NÃO CONTA. Desde que `TrailerBody` entrou, o branco de fábrica
     existe DUAS vezes na cena: as malhas originais, que ele apaga com
     `visible = false`, e a malha paramétrica que as substitui. As originais
     continuam com o material branco e continuam sendo varridas por
     `Box3.expandByObject()`, que não olha `visible` — então, sem este filtro, a
     caixa do baú voltaria sempre nas medidas DE FÁBRICA por mais que o usuário
     redimensionasse, e `trailerBase.frontZ` (o engate) e a montagem do Thermo
     King viriam junto. Um corpo escondido não é carroceria. */
  /* E O MATERIAL É O DE FÁBRICA, não o que está na malha agora — ver
     `factoryMaterials()`. Sem isso a caixa do baú volta VAZIA sempre que
     "pintar o implemento" está ligado, e com ela erram o engate, a altura em
     que o Thermo King pendura e o recorte das chapas de livery. */
  return (o: THREE.Mesh) => o.visible && isBodyMesh(o);
}

/* THE TYRES THAT CARRY THE TRAILER — not every mesh with "pneu" in its name.
   ---------------------------------------------------------------------------
   Grounding, the coupling pivot and the bogie half-span are all read off "the
   tyres", matched by /pneu|tire/i. On this implement that also catches
   `pneu-estepe-01/02`: the SPARE, stowed under the chassis 1.2 m behind the
   rear axle and hanging clear of the ground.

   Measured on the unflattened bake — running tyres z −10.53 … −6.52, spare
   z −12.05 … −10.83 — so including it stretched the bogie box rearward and gave
   `trailerTyreHalfSpan` 2.763 m instead of 2.005 m. placeTrailer() then adds
   `halfSpan · sin(pitch)` to put the bogie back on the ground after the nose-down
   pitch, and with the half-span 0.758 m too large that raise came out 8.7 mm too
   high. The trailer's lowest point measured 8.3 mm above the road: it was
   floating on exactly that error.

   So the running set is defined by CONTACT, not by name: of the tyre-ish meshes,
   keep those whose lowest point sits within TYRE_CONTACT_BAND of the lowest tyre
   point in the model. That is true of the bogie in any bake and false of a
   stowed spare, and it does not depend on the rip's naming. */
const TYRE_RE = /pneu|tire/i;
const TYRE_CONTACT_BAND = 0.05;   // m above the lowest tyre point

/* MEASURED FROM THE POSITION ATTRIBUTE, NEVER FROM A BOUNDING BOX.
   ---------------------------------------------------------------------------
   `Box3.setFromObject` takes the geometry's LOCAL box and transforms its eight
   corners. For anything whose node carries a rotation the result is the box of a
   rotated box — strictly larger than the real bounds, and there is no bound on
   how much larger. A tyre is the worst case here: a ~1.0 m disc only 0.3 m wide,
   sitting on a rip node with an arbitrary rotation.

   That is what was making the trailer hover. groundAndCenter() did
   `position.y -= wheels.min.y` with `wheels` from setFromObject, so it believed
   the tyres reached ~230 mm lower than they do and lifted the whole implement by
   that much. Measured by reading every tyre vertex instead: all twelve sit
   between 228.5 and 259.0 mm above the road, a 30 mm spread that is exactly the
   0.661° coupling pitch over the 2.5 m bogie — the wheels were never uneven, the
   ruler was.

   (I read the inflated boxes first and reported the wheels as sitting at twelve
   different heights. They do not. The playbook's rule — never measure these
   assets through a bounding box — is in it for this exact reason.) */
interface TyreMetrics {
  /** true lowest world-space vertex of the running tyres */
  minY: number;
  zMin: number;
  zMax: number;
  meshes: Set<THREE.Mesh>;
}

function runningTyres(root: THREE.Object3D): TyreMetrics | null {
  root.updateWorldMatrix(true, true);
  const v = new THREE.Vector3();
  const found: { mesh: THREE.Mesh; minY: number; zMin: number; zMax: number }[] = [];
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!(TYRE_RE.test(o.name) || mats.some((m) => !!m && TYRE_RE.test(m.name || '')))) return;
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    let minY = Infinity, zMin = Infinity, zMax = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (v.y < minY) minY = v.y;
      if (v.z < zMin) zMin = v.z;
      if (v.z > zMax) zMax = v.z;
    }
    if (Number.isFinite(minY)) found.push({ mesh: o, minY, zMin, zMax });
  });
  if (!found.length) {
    console.warn('[implemento] nenhum pneu encontrado — assentamento e engate ficam no fallback.');
    return null;
  }
  /* The bogie is what TOUCHES: a spare stowed under the chassis is a tyre by name
     and by material, and including it stretched the half-span from 2.006 m to
     2.763 m. Contact decides, so this holds in any bake and needs no naming. */
  const floor = Math.min(...found.map((e) => e.minY));
  const out: TyreMetrics = { minY: floor, zMin: Infinity, zMax: -Infinity, meshes: new Set() };
  let dropped = 0;
  for (const e of found) {
    if (e.minY > floor + TYRE_CONTACT_BAND) { dropped++; continue; }
    out.meshes.add(e.mesh);
    out.zMin = Math.min(out.zMin, e.zMin);
    out.zMax = Math.max(out.zMax, e.zMax);
  }
  console.info('[implemento] pneus de rolagem:', out.meshes.size, 'de', found.length,
    dropped ? `(${dropped} fora do plano de contato — estepe)` : '(nenhum descartado)',
    '· base', (floor * 1000).toFixed(1), 'mm · bogie z',
    out.zMin.toFixed(2), '…', out.zMax.toFixed(2));
  return out;
}

/**
 * Caixa de `subject`, medida POR VÉRTICE, no referencial de `frame`.
 *
 * POR QUE ISTO EXISTE, e por que `bboxOfMatching()` não serve onde ela é usada.
 * ---------------------------------------------------------------------------
 * `bboxOfMatching()` soma `Box3.expandByObject()`, que é a caixa alinhada aos
 * eixos de uma caixa alinhada aos eixos DO NÓ — estritamente maior que a real
 * assim que o nó tem rotação. Este módulo repete o aviso em cinco lugares e
 * mesmo assim `placeThermoKing()` caiu nele, porque o implemento ENGATADO tem
 * rotação: `applyRootPose()` escreve `rotation.x = pitchX`, a inclinação que o
 * solver de engate deriva da altura da quinta roda — ou seja, um número que
 * MUDA COM O CHASSI DO CAVALO.
 *
 * Medido: com o baú de ~14,7 m inclinado pelo engate, a `max.y` da caixa das
 * chapas laterais sobe cerca de (L/2)·sen θ — dezenas de milímetros — e some de
 * novo quando a inclinação muda. Era o suficiente para a unidade descolar da
 * travessa em uns chassis e encavalar em outros.
 *
 * Pior que o erro: as DUAS chamadas de `placeThermoKing()` viam poses
 * diferentes. `attachThermoKing()` chama com o conjunto já engatado e
 * INCLINADO; `setTrailerDims()` chama depois de zerar `t.rotation`, com o baú
 * PLANO. A mesma função, dois referenciais, dois resultados.
 *
 * Medir por vértice no referencial do implemento apaga as duas coisas de uma
 * vez: não há caixa de caixa, e a pose do conjunto — posição, giro de 180° e
 * inclinação de engate — deixa de entrar na conta por construção. É a mesma
 * doutrina de `TrailerRig.rigMatrixOf()` e de `measureFrontRailUnderside()`.
 */
function bboxInFrame(
  frame: THREE.Object3D, subject: THREE.Object3D, matcher?: MeshMatcher,
): THREE.Box3 {
  frame.updateWorldMatrix(true, true);
  subject.updateWorldMatrix(true, true);
  const inv = frame.matrixWorld.clone().invert();
  /* Mesma normalização de `bboxOfMatching()`: o filtro pode ser função ou
     regex de nome, e quem chama não deveria ter de saber qual. */
  const test = matcher === undefined
    ? null
    : (typeof matcher === 'function' ? matcher : (o: THREE.Mesh) => matcher.test(o.name));
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  subject.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    if (test && !test(o)) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(m));
  });
  return box;
}

function bboxOfMatching(root: THREE.Object3D, matcher: MeshMatcher) {
  const box = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  const test = typeof matcher === 'function' ? matcher : ((o: THREE.Mesh) => matcher.test(o.name));
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (o.isMesh && test(o)) box.expandByObject(o);
  });
  return box.isEmpty() ? new THREE.Box3().setFromObject(root) : box;
}

/** @param groundY exact lowest contact height, when the caller has measured it
 *  properly. Omitted → the wheel matcher's bounding box, which is only safe for
 *  wheels whose nodes are axis-aligned (see runningTyres()). */
function groundAndCenter(
  root: THREE.Object3D, bodyRe: MeshMatcher, wheelRe: MeshMatcher, groundY?: number,
) {
  const body = bboxOfMatching(root, bodyRe);
  const drop = groundY !== undefined ? groundY : bboxOfMatching(root, wheelRe).min.y;
  root.position.x -= (body.min.x + body.max.x) / 2;
  root.position.y -= drop;
  /* Explícito porque escrever `position` num nó congelado não recompõe nada
     sozinho (ver freezeMatrices). Hoje toda raiz que passa por aqui ainda está
     com `matrixAutoUpdate` ligado — o congelamento vem no fim da carga — e a
     chamada é inócua nesse caso; ela existe para que a ordem possa mudar sem
     levar junto um assentamento silenciosamente errado. */
  root.updateMatrix();
  root.updateWorldMatrix(true, true);
  return bboxOfMatching(root, bodyRe);
}

/* A cab built by cloning the cached original FBX (see loadFBXSource) SHARES its
   geometries and textures with the cache — and therefore with the other cab
   built from the same file. Freeing those here would blank both. Such a root is
   tagged `userData.tsSharedSource`, and for it disposal is narrowed to the
   materials, which convertScaniaMaterials() creates fresh per clone and which
   are nobody else's. Unregistering them from vehicle/paint.ts is the part that must
   never be skipped: a paint material left in that registry keeps receiving
   every setPaint() write for the rest of the session. */
/** Materiais que pertencem à CENA e não a uma chapa: sobrevivem ao descarte.
 *  DECLARADO AQUI, acima do primeiro consumidor: `disposeTree` passou a usá-lo
 *  (ver o ⚠️ lá dentro) e ele é um `const`, portanto em zona morta temporal se
 *  ficasse na posição antiga, ~2 700 linhas abaixo. O outro consumidor,
 *  `disposeLiveryPanels`, vem bem depois e enxerga daqui sem problema. */
const isSharedMat = (m: THREE.Material | null | undefined) =>
  !!m && (m === (state.trailerPaintMat as THREE.Material | null)
    || m === (state.frontWallMat as THREE.Material | null));

function disposeTree(root: THREE.Object3D) {
  /* ⚠️ AVISA O REGISTRO DE LUZES ANTES DE SOLTAR QUALQUER COISA. `lights.ts`
     parou de usar "não tem pai" como sinal de morte — entre `setupCommon()` e o
     `add()` no grupo a raiz fica destacada por alguns milissegundos, e um
     `applyRig()` nessa janela apagava o cavalo do registro para sempre. Quem
     sabe que uma raiz morreu é quem a mata, e é esta função. */
  unregisterVehicleLights(root);
  const shared = !!root.userData?.tsSharedSource;
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (o.geometry && !shared) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
      /* ⚠️ OS MATERIAIS DA CENA NÃO MORREM COM UMA RAIZ. `isSharedMat` é o mesmo
         guarda que `disposeLiveryPanels()` já aplica, e a assimetria entre as
         duas funções era uma armadilha ARMADA: hoje a única raiz VIVA que passa
         por aqui é a cabine, e `trailerPaintMat`/`frontWallMat` só existem sob
         `state.trailer` — então não dispara. No dia em que existir "trocar de
         implemento", a implementação óbvia (espelhar o que `loadCab` faz) chama
         isto sobre o baú e dispara os dois lados de uma vez: `forgetPaintMaterial`
         tira o material do registro e `dispose()` mata o programa — enquanto
         `state.trailerPaintMat` continua não-nulo apontando para o cadáver, e a
         guarda de criação é um teste de NULIDADE, que passa calada.
         O sintoma seria o baú parando de acompanhar a cor do cavalo. Dois testes
         de identidade por material é o preço de nunca descobrir isso em produção. */
      if (isSharedMat(m)) continue;
      forgetPaintMaterial(m);          // drop it from the paint registry too
      if (!shared) {
        for (const v of Object.values(m as unknown as Record<string, unknown>)) {
          if ((v as THREE.Texture)?.isTexture) (v as THREE.Texture).dispose();
        }
      }
      m.dispose();
    }
  });
}

/* The car-paint material itself lives in vehicle/paint.ts (three finish families,
   flakes, pearl colour travel, orange peel). This module only decides WHICH
   meshes get it. */
/* `CAB_FORWARD_GAP = 0.10` FOI APAGADO. Era um desengate deliberado de 100 mm
   aplicado a toda cabine — "cabs slightly forward of ideal kingpin" — e todo
   `fifthwheel.z` de `cabs.json` o carrega embutido, que é parte de por que
   aquele arquivo não podia ser lido por dois normalizadores diferentes. Se a
   cabine deve ficar adiantada na CENA, isso é `RIG_PLACEMENT`; dentro do engate
   é uma mentira sobre onde o pino trava. Ver o bloco em placeTrailer(). */

/* ---------------- wet vehicle ----------------
   In the rain the bodywork gets glossier, but its albedo must NOT be darkened:
   darkening is a POROSITY effect (water fills the pores of asphalt and soil so
   scattered light no longer escapes), and clearcoat, chrome and glass are not
   porous. Only roughness moves, and the shift is scaled by the material's own
   dry roughness — so tyres go 0.90 → 0.51 while chrome barely budges from
   0.12. That makes it safe to run blindly over any loaded GLB with no material
   tagging. Paint materials are skipped: they already sit at clearcoat 1.0. */
const dryRough = new WeakMap<THREE.Material, number>();

function applyVehicleWetness(w: number) {
  for (const root of [state.cab, state.trailer]) {
    if (!root) continue;
    root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const raw of mats) {
        const m = raw as THREE.MeshStandardMaterial;
        if (!m || isPaintMaterial(m) || typeof m.roughness !== 'number') continue;
        if (!dryRough.has(m)) dryRough.set(m, m.roughness);
        const dry = dryRough.get(m) as number;
        m.roughness = dry * (1 - w * 0.45 * dry);
      }
    });
  }
}

/* The rig hook fires once immediately on registration — which happens at module
   load, long before any GLB exists. So the target is remembered here and
   re-applied by loadCab()/loadTrailer() once there is geometry to apply it to;
   without that, booting straight into Chuvoso would leave the truck dry. */
let wetTarget = 0, wetApplied = -1;

export function reapplyVehicleWetness() {
  wetApplied = wetTarget;
  applyVehicleWetness(wetTarget);
}

onRig((rig: Rig) => {
  wetTarget = Math.min(1, Math.max(0, rig.wetness));
  /* A tween calls this every frame. Re-traversing the whole vehicle 50× for a
     change nobody can see is pure waste, so only move in visible steps — but
     always land exactly on a fully wet or fully dry endpoint. */
  const d = Math.abs(wetTarget - wetApplied);
  if (d === 0) return;
  if (d < 0.2 && wetTarget !== 0 && wetTarget !== 1) return;
  wetApplied = wetTarget;
  applyVehicleWetness(wetTarget);
});

/* ------- "Aplicar ao implemento": paint the trailer body too ------- */
const WHITE_BODY_SUB = 'cor_padrao_branco';   // trailer's white body material name

function isWhiteBodyMat(m: THREE.Material | null | undefined) {
  return !!m && (m.name || '').toLowerCase().includes(WHITE_BODY_SUB);
}

/* ---------------- O MATERIAL DE FÁBRICA DE UMA MALHA ----------------
   ⚠️ ESTA FUNÇÃO É A CORREÇÃO DE UM DEFEITO QUE COMIA O EDITOR INTEIRO, e o
   raciocínio dela vale para qualquer código futuro que queira reconhecer uma
   peça do baú pelo nome do material.

   O DEFEITO, medido em `tools/studio-bench/checks-porta2-diag-0813.mjs`:

     102ms  retrato#1 / 0 vãos / 1 malha SIDE_L / ocioso
     555ms  retrato#2 / 0 vãos / 1 malha SIDE_L / ocioso
     — clique "+ Adicionar porta" —
     3142ms retrato#2 / 1 vão  / 0 malhas SIDE_L / ocioso     ← as chapas SUMIRAM
     + "[livery] nenhuma malha do corpo branco — o editor de arte não terá onde
        pintar." e "[paint] front wall triangles not found"

   Ou seja: com "Pintar o implemento com a cor do cavalo" LIGADO, todo recorte
   de geometria (um vão de porta, uma altura, um comprimento) destruía as chapas
   de livery e não recriava nenhuma. O sintoma relatado foi *"adicionei uma
   segunda porta, ela foi adicionada no modelo 3d, mas não atualizou no
   livery"*, mas o estrago é maior: sem chapa não há arte no baú, não há retrato
   para o editor (o palco congela na última foto), não há parede dianteira
   pintável — e `bboxOfMatching(bodyPanelPred)` devolve uma caixa VAZIA, que é o
   que o engate e a montagem do Thermo King leem.

   A CAUSA é circular e por isso invisível na leitura: `trailerPanelMeshes()`
   casa a carroceria pelo material branco, e `setPaintTarget('both')` troca esse
   material por `carpaint` em todas elas. A partir daí NADA no arquivo consegue
   mais reconhecer a carroceria — inclusive as três funções que precisam
   reconhecê-la para RECRIAR as chapas. A pintura apagava a própria definição de
   "o que é carroceria".

   A RESPOSTA CERTA NÃO É casar também por `carpaint`: aquele material está
   igualmente no teto e na carcaça do Thermo King (ver `trailerPanelMeshes()`),
   e incluí-los na carroceria devolveria a caixa grande demais — exatamente o
   defeito que o cabeçalho de `bodyPanelPred()` documenta ter custado 0,83 m no
   engate. O que identifica a carroceria é o que ela ERA, e isso está guardado:
   `setPaintTarget()` escreve `userData.origMat` antes de trocar, e
   `vehicle/trim.ts` escreve `trimOrigMat` pelo mesmo motivo.

   A ORDEM DOS TRÊS IMPORTA. `origMat` primeiro porque é o de fábrica de
   verdade; `trimOrigMat` depois porque `applyTrim()` roda DEPOIS de
   `setPaintTarget()` e, numa peça que segue o corpo, o que ele guardou já é a
   tinta do baú; o material corrente por último, que é o caso normal de quem
   nunca foi pintado. */
function factoryMaterials(o: THREE.Mesh): (THREE.Material | null)[] {
  const raw = (o.userData.origMat ?? o.userData.trimOrigMat ?? o.material) as
    THREE.Material | THREE.Material[] | null | undefined;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/** A malha É chapa de carroceria — pintada ou não. Ver `factoryMaterials()`. */
const isBodyMesh = (o: THREE.Mesh) => factoryMaterials(o).some(isWhiteBodyMat);

/* Paint set: the named livery panels only. The rest of the white body is ONE
   joined mesh (opt_Cor_padrao_branco…: front wall + roof + trim + frames all
   in a single geometry — verified by bbox enumeration), so the FRONT WALL is
   handled separately by extracting its triangles into a paint overlay; see
   buildFrontWallOverlay(). Frames/rails/posts stay on the original material. */
const TK_PAINT_SUB = 'tk-housing-white';   // Thermo King housing joins the paint set

/* O material branco de fábrica do implemento. TUDO que sai do bake com ele é
   chapa de carroceria: as duas laterais, a traseira, a FRENTE e o TETO.
   O nome vem do próprio .glb — ver os 38 materiais do bake. */
const BODY_WHITE_MAT = 'cor_padrao_branco';

/* Peças que carregam o branco de carroceria mas NÃO são carroceria vista: o
   forro interno do teto e a parede interna. Pintá-las não aparece em lugar
   nenhum e só gasta uma troca de material por malha. */
const BODY_INTERIOR_RE = /-interno|_interno|interna/i;

function trailerPanelMeshes() {
  const out: THREE.Mesh[] = [];
  if (state.trailer) {
    state.trailer.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh) return;
      /* As três chapas RECORTADAS pelo bake, que já vêm com nome próprio —
         e os REBITES das emendas junto: no baú real eles são pintados com a
         chapa (pedido de 2026-08-11). Soleira e arremate ficam de fora, como
         o trilho galvanizado que eles arrematam. */
      if (/^(SIDE_L|SIDE_R|REAR|FRONT|SIDE_[LR]_RIVETS)$/.test(o.name)) { out.push(o); return; }
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (mats.some((m) => m && (m.name || '').toLowerCase().includes(TK_PAINT_SUB))) {
        out.push(o); return;
      }
      /* FRENTE E TETO, por MATERIAL e não por geometria.
         ---------------------------------------------------------------------
         A frente já tinha um caminho próprio — buildFrontWallOverlay(), que
         extrai a pele da parede por profundidade e desenha uma cópia por cima
         com polygonOffset. Aquilo foi escrito para um bake em que a carroceria
         branca era UMA malha unida; o bake que roda hoje tem 2151 malhas
         separadas, e o teto (`teto-externo_Cor_padrao_branco(metalBranco)_0`)
         nunca esteve em lista nenhuma. Resultado: com "pintar implemento"
         ligado, as laterais e a traseira mudavam de cor e a frente e o teto
         continuavam brancos.
         Casar pelo MATERIAL resolve os dois de uma vez e não depende de a
         geometria estar unida, recortada ou nomeada de um jeito específico —
         só de o bake continuar chamando o branco de fábrica pelo mesmo nome. */
      if (BODY_INTERIOR_RE.test(o.name)) return;
      /* PELO MATERIAL DE FÁBRICA, e não pelo corrente. A malha do corpo
         paramétrico já está com `carpaint` quando este laço roda pela SEGUNDA
         vez (todo `setTrailerDims()` reaplica o alvo da tinta), e casar pelo
         corrente a deixava de fora do conjunto: ela continuava pintada por
         inércia, mas qualquer troca de cor a partir dali só alcançava as
         chapas recortadas. Ver `factoryMaterials()`. */
      if (factoryMaterials(o).some(
        (m) => m && (m.name || '').toLowerCase().includes(BODY_WHITE_MAT))) {
        out.push(o);
      }
    });
  }
  return out;
}

/* Extract the front-wall surface from the joined white-body mesh and mirror it
   into a paint overlay (a child of the source, so it inherits every transform)
   with polygonOffset. The source mesh data is never modified.

   WHY IT USED TO MISS THE WALL — the old pass 2 kept only triangles whose FULL
   y-extent sat inside a band [bodyBottomY+0.05, wallTop-0.25]. But this wall is
   low-poly: its frontmost skin is essentially four big quads spanning
   y 1.452 → 4.172. Both cuts reject the same quads (1.452 < 1.482 below,
   4.172 > 3.958 above), so every triangle carrying visible area was thrown
   away. What survived was the INNER wall sheet 0.11 m further back, which meant
   the overlay was being drawn inside the trailer — a gap polygonOffset cannot
   bridge. Measured: 701 tris kept, covering 0.16 m² of a 4.23 m² wall = 3.8 %.

   THE FIX — the correct discriminator is DEPTH, not height. Take the frontmost
   z reached by any outward-facing candidate and keep only triangles that stay
   within a thin skin of it. Measured with SKIN = 0.05: 1630 tris, 10.32 m²,
   100 % coverage. (0.02 misses a second sheet 9 mm back; ≥0.12 starts pulling
   in the hidden inner sheet again.) The face-normal test also becomes abs(),
   since ~0.2 % of these ripped triangles are wound backwards. */
const FRONT_WALL_SKIN = 0.05;

function buildFrontWallOverlay() {
  if (state.frontWalls !== undefined || !state.trailer) return;
  state.frontWalls = [];
  /* A CHAPA `FRONT` APOSENTA ESTE CAMINHO — quando ela existe.
     ---------------------------------------------------------------------
     Este overlay foi escrito para um bake em que a testeira era um punhado de
     triângulos dentro da malha branca unida: ele os copiava para uma cópia por
     cima, com bias de profundidade, só para poder pintá-la. Desde
     2026-08-13 `buildLiveryPanels()` RECORTA a testeira numa malha própria —
     os triângulos saem da origem, e a malha nova é pintada e plotada como
     qualquer outra chapa.

     Se ele continuasse rodando, encontraria a parede JÁ VAZIA (os triângulos
     migraram) e no melhor caso desenharia nada; no pior, uma segunda superfície
     coplanar com a chapa nova, que é o "marrom lamacento" que
     `buildLiveryPanels()` documenta. Sair cedo é a resposta certa, e o
     caminho fica inteiro para o bake sem corpo branco recortável. */
  let hasFrontPanel = false;
  state.trailer.traverse((node) => {
    const o = node as THREE.Mesh;
    if (o.isMesh && o.name === 'FRONT') hasFrontPanel = true;
  });
  if (hasFrontPanel) return;
  const sideBox = bboxOfMatching(state.trailer, bodyPanelPred(state.trailer));
  const zLim = sideBox.max.z - 0.5;                  // generous front slab
  const sources: THREE.Mesh[] = [];
  state.trailer.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || panelNameRe().test(o.name)) return;
    /* Mesmo motivo de buildLiveryPanels(): as chapas brancas originais seguem
       na cena, só escondidas por `TrailerBody`. Extrair a parede dianteira de
       uma delas desenharia a tinta na altura de fábrica. */
    if (!o.visible) return;
    /* Idem `buildLiveryPanels()`: o material de FÁBRICA. Com a tinta ligada,
       casar pelo corrente devolvia "[paint] front wall triangles not found" e a
       testeira deixava de ser pintável no bake que não a recorta. */
    if (isBodyMesh(o)) sources.push(o);
  });
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  const wa = new THREE.Vector3(), wb = new THREE.Vector3(), wc = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3();
  for (const src of sources) {
    src.updateWorldMatrix(true, false);
    const g = src.geometry;
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    if (!pos || !nor) {
      console.warn('[paint] front wall: source lacks position/normal —', src.name);
      continue;
    }
    const index = g.index ? g.index.array : null;
    const triCount = Math.floor((index ? index.length : pos.count) / 3);
    /* pass 1: candidates = inside the front slab AND lying in the wall plane
       (|n·z| ≥ 0.5). Track the frontmost z any candidate reaches. */
    const candidates: number[] = [];
    let srcFrontZ = -Infinity;
    for (let t = 0; t < triCount; t++) {
      const i0 = index ? index[t * 3] : t * 3;
      const i1 = index ? index[t * 3 + 1] : t * 3 + 1;
      const i2 = index ? index[t * 3 + 2] : t * 3 + 2;
      va.fromBufferAttribute(pos, i0); wa.copy(va).applyMatrix4(src.matrixWorld);
      if (wa.z < zLim) continue;
      vb.fromBufferAttribute(pos, i1); wb.copy(vb).applyMatrix4(src.matrixWorld);
      vc.fromBufferAttribute(pos, i2); wc.copy(vc).applyMatrix4(src.matrixWorld);
      if (wb.z < zLim || wc.z < zLim) continue;
      e1.subVectors(wb, wa); e2.subVectors(wc, wa);
      fn.crossVectors(e1, e2).normalize();
      if (Math.abs(fn.z) < 0.5) continue;
      candidates.push(i0, i1, i2);
      srcFrontZ = Math.max(srcFrontZ, wa.z, wb.z, wc.z);
    }
    /* pass 2: the OUTER skin only. Anything set back from srcFrontZ is either
       the wall's interior face or internal structure, and painting it would put
       colour inside the box. */
    const zKeep = srcFrontZ - FRONT_WALL_SKIN;
    const keepPos: number[] = [], keepNor: number[] = [];
    for (let c = 0; c < candidates.length; c += 3) {
      const i0 = candidates[c], i1 = candidates[c + 1], i2 = candidates[c + 2];
      va.fromBufferAttribute(pos, i0); wa.copy(va).applyMatrix4(src.matrixWorld);
      vb.fromBufferAttribute(pos, i1); wb.copy(vb).applyMatrix4(src.matrixWorld);
      vc.fromBufferAttribute(pos, i2); wc.copy(vc).applyMatrix4(src.matrixWorld);
      if (Math.min(wa.z, wb.z, wc.z) < zKeep) continue;
      keepPos.push(va.x, va.y, va.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z);
      for (const i of [i0, i1, i2]) {
        keepNor.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      }
    }
    if (!keepPos.length) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(keepPos), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(keepNor), 3));
    if (!state.frontWallMat) {
      state.frontWallMat = makePaintMaterial();
      state.frontWallMat.name = 'carpaint';
      adoptProbeMaterial(state.frontWallMat);      // idem — ver adoptProbeMaterial()
      /* CONSTANT bias, no slope term. This overlay really is coincident with the
         wall it is cut from — unlike the livery panels, whose triangles are moved
         out — so it needs a bias to win the depth test. But `polygonOffsetFactor`
         is SLOPE-SCALED: sighting along the front at a grazing angle it grows
         without bound and the paint bleeds out over the inox corner posts and the
         Thermo King's frame beside it, which is what Kennedy saw leaking on the
         nose. `units` is the constant term and a few of them are all a coplanar
         pair ever needs, so factor goes to 0 and the leak with it. */
      state.frontWallMat.polygonOffset = true;
      state.frontWallMat.polygonOffsetFactor = 0;
      state.frontWallMat.polygonOffsetUnits = -4;
    }
    const overlay = new THREE.Mesh(geo, state.frontWallMat);
    overlay.renderOrder = 1;
    overlay.visible = false;
    overlay.castShadow = false;                      // the source already does
    src.add(overlay);
    state.frontWalls.push(overlay);
    console.info('[paint] front wall overlay:', keepPos.length / 9, 'tris from', src.name,
      '(expect ~1630)');
  }
  if (!state.frontWalls.length) console.warn('[paint] front wall triangles not found');
}

/* Every paint material — cab, trailer body, front wall — is registered with
   vehicle/paint.ts and driven from the same parameter set, so a "sync" is just a
   re-apply of the current params. */
export function syncTrailerPaintFromCab() {
  setPaint({});
}

/* ---------------------------------------------------------------------------
   O QUE A FUSÃO POR MATERIAL NÃO PODE ENCOSTAR — a metade deste arquivo

   `vehicle/merge.ts` assa mil malhas numa por material e guarda a REFERÊNCIA do
   material no instante da fusão. Isso é gratuito para quem lê o material (o
   livery escreve `CanvasTexture` nele, `vehicle/lights.ts` decide por fragmento
   pela posição de mundo — os dois sobrevivem sem uma linha de mudança) e é fatal
   para quem TROCA `mesh.material` depois. É exatamente o que `setPaintTarget()`
   faz em toda malha de `trailerPanelMeshes()` ao ligar "pintar o implemento".

   Então tudo que pode virar tinta fica de fora dos baldes:

     · o BRANCO DE CARROCERIA (`cor_padrao_branco`) — as duas laterais, a
       traseira, a testeira e o teto;
     · `tk-housing-white`, a chapa do Thermo King, que entra no mesmo conjunto;
     · `carpaint*`, que é o material que a tinta PÕE no lugar — uma malha que já
       esteja pintada quando a fusão rodar tem de ficar igualmente de fora, ou
       desligar a tinta a deixaria colorida para sempre dentro do balde;
     · as chapas RECORTADAS por nome (`SIDE_L`, `SIDE_R`, `REAR`, `FRONT` e os
       rebites das emendas) e a malha do teto paramétrico. Elas são recriadas do
       zero a cada `setTrailerDims()`, e além disso `livery-snapshot.ts` fotografa
       cada uma isoladamente — as duas coisas exigem que continuem sendo malhas
       de verdade, com nome.

   A lista sai DAQUI e não de `merge.ts` pelo mesmo motivo que a de `trim.ts` sai
   de lá: é aqui que estes nomes são verdade. Quem junta as duas é `studio.ts`, a
   raiz de composição. Uma segunda cópia divergiria no primeiro re-bake — e o
   sintoma seria a chapa do baú parando de aceitar cor, que é o defeito que
   `factoryMaterials()` acima documenta ter custado o editor inteiro. */
export const PAINT_MERGE_EXCLUSIONS: {
  materials: { re: RegExp; label: string }[];
  meshes: { re: RegExp; label: string }[];
} = {
  materials: [
    { re: new RegExp(WHITE_BODY_SUB, 'i'), label: 'pintura: chapa de carroceria' },
    { re: new RegExp(TK_PAINT_SUB, 'i'), label: 'pintura: chapa de carroceria' },
    { re: /carpaint/i, label: 'pintura: chapa de carroceria' },
  ],
  meshes: [
    { re: /^(SIDE_L|SIDE_R|REAR|FRONT|SIDE_[LR]_RIVETS)$/, label: 'pintura: chapa de carroceria' },
    { re: new RegExp(`^${TRAILER_ROOF_MESH}$`), label: 'pintura: chapa de carroceria' },
  ],
};

/* Quem quiser corrigir o material de alguma peça DEPOIS de setPaintTarget().
   Mesmo desenho — e mesmo motivo — de `onTrailerPanelsRebuilt()`: quem reage é
   `vehicle/trim.ts`, que já importa ESTE módulo, e uma importação de volta
   fecharia um ciclo. Um assinante, e ele se inscreve.

   POR QUE O ACABAMENTO TEM DE VIR DEPOIS, e não antes: setPaintTarget('both')
   escreve `state.trailerPaintMat` em TODA malha de `trailerPanelMeshes()`, e o
   TETO e a carcaça do THERMO KING estão nessa lista (o primeiro pelo material
   branco de carroceria, o segundo por `tk-housing-white`). Uma peça com cor
   própria que fosse aplicada antes seria sobrescrita pela cor do baú no mesmo
   quadro — e o defeito só apareceria ao trocar "pintar o implemento". */
type PaintTargetListener = () => void;
const paintTargetListeners: PaintTargetListener[] = [];
export function onPaintTargetApplied(cb: PaintTargetListener) {
  paintTargetListeners.push(cb);
  return () => {
    const i = paintTargetListeners.indexOf(cb);
    if (i >= 0) paintTargetListeners.splice(i, 1);
  };
}

export function setPaintTarget(mode: 'cab' | 'both') {
  state.paintTarget = mode === 'both' ? 'both' : 'cab';
  const meshes = trailerPanelMeshes();
  buildFrontWallOverlay();
  if (state.paintTarget === 'both') {
    if (!state.trailerPaintMat) {
      state.trailerPaintMat = makePaintMaterial();
      state.trailerPaintMat.name = 'carpaint';
      /* NO polygonOffset here. It was added when buildLiveryPanels() duplicated
         the skin — painting swapped the bias away and the flank flickered between
         white and the chosen colour. The panels are now CUT OUT of the body
         instead, so there is no second surface, and a bias on the paint would
         only make it fight the perimeter rail below it. The overlay for the front
         wall still needs one; see frontWallMat. */
    }
    /* ⚠️ FORA DO `if`, e a diferença é um defeito real de reincidência.
       -----------------------------------------------------------------------
       NASCEU DEPOIS DA SONDA — sem isto o implemento pintado reflete o HDRI cru
       enquanto a cabine reflete a vizinhança, e uma tinta preta sai cinza no baú
       e preta no cavalo. Esse relato já aconteceu uma vez (ver o bloco de
       `adoptProbeMaterial`), e a correção morava DENTRO da criação — ou seja,
       valia uma vez na vida do material.

       O buraco: com "pintar o implemento" DESLIGADO, este material não está em
       malha nenhuma, então `refreshVehicleReflection()` não o alcança (ela
       percorre `state.cab` e `state.trailer`). Se nesse meio-tempo a sonda for
       reconstruída — `releaseScene()` depois de 60 s fora da rota, ou uma troca
       de nível que mude o tamanho dela —, o alvo antigo é descartado. Religar a
       caixa depois disso reusa o material com um `envMap` apontando para um
       render target morto: baú escuro e chapado ao lado de um cavalo correto.

       `adoptProbeMaterial()` é documentadamente idempotente, então chamá-la a
       cada `setPaintTarget('both')` custa uma atribuição e fecha a janela. */
    adoptProbeMaterial(state.trailerPaintMat);
    for (const mesh of meshes) {
      /* O ORIGINAL É O DE FÁBRICA, e `mesh.material` pode não ser ele.
         `vehicle/trim.ts` pinta teto e Thermo King com uma tinta PRÓPRIA e
         guarda o de fábrica em `trimOrigMat`. Ligar "pintar o implemento" com o
         teto já colorido gravava a TINTA DO TETO como "original" — e a partir
         dali não havia mais como voltar ao branco: desligar a caixa restaurava
         a cor do teto achando que restaurava a chapa. */
      if (!mesh.userData.origMat) {
        mesh.userData.origMat = mesh.userData.trimOrigMat ?? mesh.material;
      }
      mesh.material = state.trailerPaintMat;
    }
    for (const w of state.frontWalls || []) w.visible = true;
  } else {
    // restore via stored refs — matching by material would miss meshes whose
    // material was already swapped (e.g. the Thermo King housing)
    if (state.trailer) {
      state.trailer.traverse((node) => {
        const o = node as THREE.Mesh;
        if (o.isMesh && o.userData.origMat) o.material = o.userData.origMat;
      });
    }
    for (const w of state.frontWalls || []) w.visible = false;
  }

  /* As peças de acabamento com cor própria recuperam a delas — ver o cabeçalho
     de onPaintTargetApplied(). Antes do invalidate(), porque elas trocam
     material e o quadro tem de sair com o resultado final. */
  for (const cb of paintTargetListeners) cb();

  /* Trocar o alvo da tinta troca MATERIAL em malhas que já estão na cena, sem
     passar por nenhum carregamento — então nada mais avisaria o laço
     sob demanda de que o quadro mudou. É o gap #2 da lista em scene.ts.
     Chamado no fim porque o overlay da parede dianteira também é refeito
     acima, e um invalidate() antes dele perderia esse desenho. */
  invalidate();
}

/* ============================================================
   O QUE FICA EM CENA: o conjunto, só o cavalo, ou só o implemento
   ============================================================
   Pedido de 2026-08-13: *"deve ter uma opção para esconder o cavalo e mostrar
   somente o implemento, e vice-versa"*.

   Isto JÁ EXISTIU, como dois checkboxes na topbar, e foi removido com ela — a
   nota em `core/template.ts` registra o porquê e ela continua certa: eram um
   atalho de depuração ("some com a cabine"), duas caixas independentes que
   podiam apagar as duas metades ao mesmo tempo e deixar a tela vazia sem nada
   dizendo por quê.

   O que volta é outra coisa: UM estado com TRÊS valores, que por construção
   nunca esconde tudo, e que mora no card de configurações junto das outras
   decisões sobre o produto. Um implemento é vendido sozinho — a foto do baú sem
   cavalo é material de catálogo, não um modo de depuração.

   POR QUE NOS GRUPOS e não nos modelos: `state.cab` e `state.trailer` são
   trocados a cada carga, e uma escolha escrita neles se perderia na próxima
   troca de caminhão. Os grupos são permanentes (criados na avaliação deste
   módulo), então a escolha sobrevive — e `applyVehicleView()` é chamada de novo
   depois de cada carga só para o caso de alguém ter mexido no `visible` de um
   grupo por outro caminho.

   NÃO É PERSISTIDA na escolha do catálogo, e é deliberado: é um estado de
   OLHAR, não de produto. Um `Choice` gravado com "só o implemento" abriria o
   estúdio, na sessão seguinte, sem o caminhão — e o usuário procuraria o
   caminhão, não a opção. */
export type VehicleView = 'both' | 'cab' | 'trailer';

let vehicleView: VehicleView = 'both';

export const getVehicleView = (): VehicleView => vehicleView;

/** Escreve a escolha corrente nos dois grupos. Idempotente. */
export function applyVehicleView() {
  state.cabGroup.visible = vehicleView !== 'trailer';
  state.trailerGroup.visible = vehicleView !== 'cab';
  /* E A PATOLA ACOMPANHA, porque ela é a mesma decisão vista de outro ângulo:
     "só o implemento" é um semirreboque DESENGATADO, e um semirreboque
     desengatado está apoiado no pé, não pendurado no ar. Ver
     `vehicle/landing-gear.ts` — o baú NÃO se mexe; a perna telescópica é que
     desce os 301 mm que faltam do chão.

     AQUI e não em `setVehicleView()`: esta função também roda depois de cada
     carga de veículo (`runApply()` em studio.ts), e é lá que a patola do
     implemento recém-montado precisa nascer na pose certa. */
  setLandingGearDown(vehicleView === 'trailer');
  invalidate();
}

/**
 * A CÂMERA PASSA A ORBITAR A METADE QUE FICOU, e não o conjunto.
 *
 * `frameAll()` já ignora grupo invisível ao medir a caixa, então o
 * enquadramento sozinho já vinha certo. O que NÃO vinha era a ÓRBITA: quem
 * define o centro do giro, o alcance de zoom, a coleira do pan e a caixa da
 * qual a câmera é expulsa é `setVehicleFocus()`, e ela continuava recebendo a
 * caixa do conjunto inteiro (`focusOnRig()` em studio.ts, chamada no fim de cada
 * carga). Com "só o implemento", o centro do giro ficava no ENGATE — a uns 9 m
 * do baú — e girar a cena fazia o implemento varrer a tela em torno de um ponto
 * vazio, com o zoom limitado pelo raio de um conjunto que não está mais lá.
 *
 * Aqui a caixa é a do que está VISÍVEL, e as duas coisas andam juntas por
 * construção. Vive em models.ts, e não em studio.ts como `focusOnRig()`, porque
 * quem muda a vista é este módulo — uma segunda cópia da regra em studio.ts
 * discordaria desta na primeira mudança.
 */
function frameVisible() {
  const box = new THREE.Box3();
  for (const g of [state.cabGroup, state.trailerGroup]) {
    if (g.visible) box.expandByObject(g);
  }
  if (box.isEmpty()) return;
  frameAll([state.cabGroup, state.trailerGroup]);
  setVehicleFocus(box);
}

/**
 * Mostra o conjunto, só o cavalo ou só o implemento.
 *
 * Devolve o modo EFETIVO, que pode não ser o pedido: esconder o cavalo num
 * estúdio que não tem implemento carregado deixaria a tela vazia, e uma tela
 * vazia não é uma resposta — é a aparência de um app quebrado. Quem chama usa o
 * retorno para redesenhar o controle, e assim o botão volta sozinho para onde
 * ele realmente está em vez de mentir.
 */
export function setVehicleView(mode: VehicleView): VehicleView {
  const want: VehicleView = mode === 'cab' || mode === 'trailer' ? mode : 'both';
  const ok = want === 'both'
    || (want === 'cab' ? !!state.cab : !!state.trailer);
  vehicleView = ok ? want : 'both';
  applyVehicleView();
  /* SÓ AQUI, e não em `applyVehicleView()`: aquela também roda depois de cada
     carga de veículo, onde `runApply()` já enquadra e já chama `focusOnRig()` —
     um segundo enquadramento no meio da cortina brigaria com o dele. Este é o
     caminho da ESCOLHA do usuário, e a escolha é que pede a câmera nova. */
  frameVisible();
  return vehicleView;
}

/* ---------------- Scania: original FBX + old-viewer material treatment ----- */
/* FINISH table from the proven old scania viewer: name substring → [metal, rough] */
const SCANIA_FINISH = [
  ['carpaint', 0.90, 0.32], ['chrome', 1.00, 0.06], ['mirror', 1.00, 0.02],
  ['rim', 1.00, 0.18], ['mattemetal', 0.75, 0.50], ['tire', 0.00, 0.90],
  ['black', 0.05, 0.55], ['interior', 0.00, 0.75],
  ['red', 0.00, 0.45], ['blue', 0.00, 0.45], ['yellow', 0.00, 0.45], ['pink', 0.00, 0.45],
];
const SCANIA_GLASS = { clearglass: 0.22, windowglass: 0.32, redglass: 0.55, orangeglass: 0.60 };
const SCANIA_DEFAULT_FINISH = [0.20, 0.60];

function firstMatName(o: THREE.Mesh) {
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  return ((m && m.name) || '').toLowerCase();
}

/* Cor base dos METAIS da rip, corrigida.
   ---------------------------------------------------------------------------
   O letreiro SCANIA da grade saía PRETO. A causa não é iluminação: em
   `metalness: 1` o three faz `specularColor = mix(0.04, diffuseColor, metalness)`
   e ZERA o difuso — ou seja, a cor base deixa de ser tinta e passa a ser o
   FILTRO do reflexo. O material `chrome` da rip veio com cor 0,06 (quase preto),
   então ele refletia 6% do céu: um espelho pintado de preto.

   Os escalares vieram capturados do jogo original, onde o mesmo material era
   lido por outro pipeline. Medido nesta cabine: chrome 0,06, mirror (0,21 0,36
   0,30 — um espelho VERDE) e rim 0,11. Nenhum dos três é uma superfície que
   existe.

   Os números abaixo são refletâncias reais: cromado polido devolve ~90% do que
   recebe, um espelho ~95%, e uma liga de alumínio usinada ~70%. É a mesma
   doutrina que applyTrailerFinish() aplica às lentes das lanternas — a diferença
   é que lá o erro era metalness demais, e aqui é cor de menos. */
const SCANIA_METAL_TINT: [sub: string, r: number, g: number, b: number][] = [
  ['chrome', 0.90, 0.90, 0.90],
  ['mirror', 0.95, 0.95, 0.95],
  ['rim', 0.70, 0.70, 0.72],
];

function convertScaniaMaterials(root: THREE.Object3D) {
  const cache = new Map<string, THREE.Material>();
  const convert = (raw: THREE.Material): THREE.Material => {
    const src = raw as THREE.MeshStandardMaterial;
    if (!src) return src;
    const hit = cache.get(src.uuid);
    if (hit) return hit;
    const name = (src.name || '').toLowerCase();
    let out: THREE.Material;
    if (name.includes('carpaint')) {
      out = makePaintMaterial(src.color, src.map);   // automotive flake paint
      out.name = src.name;
      /* NÃO fixar envMapIntensity aqui: virou parâmetro de tinta
         (PaintParams.envMapIntensity) e quem manda nele é applyToMaterials(),
         que roda a cada setPaint(). O 1.3 que morava nesta linha reescrevia o
         ajuste gravado da cor toda vez que uma cabine era convertida. */
      cache.set(src.uuid, out);
      return out;
    }
    const glassKey = Object.keys(SCANIA_GLASS).find(k => name.includes(k));
    if (glassKey) {
      out = new THREE.MeshStandardMaterial({
        name: src.name, color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
        metalness: 0, roughness: 0.08,
        transparent: true, opacity: SCANIA_GLASS[glassKey as keyof typeof SCANIA_GLASS],
      });
      out.depthWrite = false;
    } else {
      let found: [number, number] | null = null;
      for (const [sub, met, rou] of SCANIA_FINISH) {
        if (name.includes(sub as string)) { found = [met as number, rou as number]; break; }
      }
      const [met, rou] = found || SCANIA_DEFAULT_FINISH;
      out = new THREE.MeshStandardMaterial({
        name: src.name, color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
        map: src.map || null, normalMap: src.normalMap || null,
        metalness: met, roughness: rou,
      });
      /* Só onde NÃO há mapa: um metal texturizado já traz a variação dele, e
         sobrescrever a cor apagaria a textura inteira. */
      if (!src.map) {
        for (const [sub, r, g, b] of SCANIA_METAL_TINT) {
          if (!name.includes(sub)) continue;
          (out as THREE.MeshStandardMaterial).color.setRGB(r, g, b);
          break;
        }
      }
      const om = (out as THREE.MeshStandardMaterial).map;
      if (om) { om.colorSpace = THREE.SRGBColorSpace; om.anisotropy = textureAnisotropy(); }
    }
    (out as THREE.MeshStandardMaterial).envMapIntensity = 1.3;
    cache.set(src.uuid, out);
    return out;
  };
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(convert) : convert(o.material);
    /* Otimista de propósito: loadCab() sempre roda setupCommon() sobre esta raiz
       depois, e é lá que setShadowCasters() decide quem realmente projeta. */
    o.castShadow = true;
    o.receiveShadow = true;
  });
}

function meshesWhere(root: THREE.Object3D, pred: (o: THREE.Mesh) => boolean) {
  const out: THREE.Mesh[] = [];
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (o.isMesh && pred(o)) out.push(o);
  });
  return out;
}

/* ---------------- cached FBX source ----------------
   /models/vehicles/scania.fbx is 46 MB, and BOTH the `scania` and the `daf` cab are built
   from it: without a cache, every switch between them re-downloads and re-parses
   the whole file. So the parsed root is kept here, keyed by URL, and each load
   gets a clone(true).

   The ownership rules that make that clone safe — all four matter:

   1. The cached root is PRISTINE. It is never added to the scene, never
      material-converted, never scaled or grounded. Even the very first load
      hands out a clone, so there is ONE rule for every cab instead of a special
      first case that would later have to be remembered.
   2. Object3D.clone() shares GEOMETRY and TEXTURES by reference — exactly what
      we want, it is the whole saving — and it shares MATERIALS too, which we do
      NOT want. convertScaniaMaterials() fixes that on the spot: it rebuilds
      every material of the clone into a brand-new instance (its dedupe Map is
      per call), so each cab ends up with its own paint materials registered in
      state.paintMats. Painting the DAF therefore cannot repaint the Scania.
   3. Because geometry and textures are shared, a clone must NOT be disposed the
      normal way. It carries `userData.tsSharedSource`, which disposeTree()
      honours by dropping only the per-clone materials.
   4. The PROMISE is cached, not the resolved root, so kicking off scania and daf
      at the same time still downloads once.

   SkinnedMesh is the one thing Object3D.clone() genuinely cannot copy (the bones
   are cloned but the skeleton is not rebound — that is what SkeletonUtils.clone
   exists for). This rip is static bodywork, but if that ever changes the cache
   disables itself instead of rendering a collapsed mesh. */
const fbxSourceCache = new Map<string, Promise<THREE.Group>>();

async function loadFBXSource(url: string, onProgress?: (t: number) => void): Promise<THREE.Group> {
  let pending = fbxSourceCache.get(url);
  if (!pending) {
    pending = loadFBX(url, onProgress).then(root => {
      /* strip baked lights/cameras from the rip — done ONCE here, on the
         pristine root, so every clone comes out already clean */
      const kill: THREE.Object3D[] = [];
      root.traverse((o) => {
        if ((o as THREE.Light).isLight || (o as THREE.Camera).isCamera) kill.push(o);
      });
      kill.forEach((o) => o.parent && o.parent.remove(o));
      let skinned = false;
      root.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true; });
      if (skinned) {
        console.warn('[fbx] ' + url + ' contém SkinnedMesh — cache desativado '
          + '(clone não reassocia o esqueleto).');
        fbxSourceCache.delete(url);
      }
      return root;
    });
    // a failed load must not be remembered, or the cab could never be retried
    pending.catch(() => fbxSourceCache.delete(url));
    fbxSourceCache.set(url, pending);
  }
  const source = await pending;
  /* Identity, not just presence: if the entry was dropped (skinned, or a failed
     load that has since been retried), THIS root is ours alone and must be
     handed over untagged so disposeTree() frees it normally. */
  if (fbxSourceCache.get(url) !== pending) return source;
  if (onProgress) onProgress(1);   // a cache hit downloads nothing: close the bar
  try {
    const clone = source.clone(true);
    clone.userData.tsSharedSource = true;
    return clone;
  } catch (e) {
    /* Never let the optimisation be the thing that stops the studio booting:
       give up the cache for this URL and fall back to the old behaviour of one
       fresh download per load. */
    console.warn('[fbx] clone falhou — cache desativado para ' + url, e);
    fbxSourceCache.delete(url);
    return source;
  }
}

/* `def` is the cab definition, so the file comes from the manifest and the logs
   name the cab that is actually loading (scania and daf share this pipeline). */
async function loadScaniaOriginal(def: CabDef, onProgress?: (t: number) => void) {
  const tag = def?.id || 'scania';
  const root = await loadFBXSource(assetUrl(def?.file || SCANIA_FBX), onProgress);

  convertScaniaMaterials(root);

  const rig = new THREE.Group();
  rig.add(root);
  /* the rig is what ends up in state.cab, so carry the "shares geometry with the
     FBX cache" flag up to it — that is the level disposeTree() inspects */
  rig.userData.tsSharedSource = !!root.userData?.tsSharedSource;
  rig.updateWorldMatrix(true, true);

  /* uniform scale anchored on the steer tires: median tire-mesh bounding
     diameter (vertical) → 1.015 m */
  const tires = meshesWhere(root, o => firstMatName(o).includes('tire'));
  if (tires.length) {
    const ds = tires
      .map((m) => new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()).y)
      .filter((d) => d > 1e-9)
      .sort((a, b) => a - b);
    const d = ds[Math.floor(ds.length / 2)];
    if (d) rig.scale.setScalar(STEER_TIRE_OD / d);
    console.info(`[${tag}] tire meshes:`, tires.length, 'median OD:', d, '→ scale', (STEER_TIRE_OD / d).toFixed(5));
  } else {
    console.warn(`[${tag}] no tire-material meshes found — FBX left unscaled!`);
  }
  rig.updateWorldMatrix(true, true);

  /* orient front to +Z: longest horizontal axis = length; front detected via
     the WHEEL_*F empties (front wheels sit at the grille end) */
  const box = new THREE.Box3().setFromObject(rig);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const axis = size.x > size.z ? 'x' : 'z';
  const fronts: THREE.Vector3[] = [];
  root.traverse((o) => {
    if (/wheel[_ ]?[lr]f/i.test(o.name) || /wheel[_ ]?f[lr]/i.test(o.name)) {
      fronts.push(o.getWorldPosition(new THREE.Vector3()));
    }
  });
  let dir: number;
  if (fronts.length) {
    const avg = fronts.reduce((a, p) => a + p[axis as 'x' | 'z'], 0) / fronts.length;
    dir = Math.sign(avg - center[axis as 'x' | 'z']) || 1;
  } else {
    dir = -1;   // source vehicle faces -Y in Blender terms; verified empirically
    console.warn(`[${tag}] WHEEL_*F empties not found — fallback orientation`);
  }
  let yaw = 0;
  if (axis === 'z') yaw = dir > 0 ? 0 : Math.PI;
  else yaw = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
  if (yaw) rig.rotation.y = yaw;
  rig.updateWorldMatrix(true, true);
  console.info(`[${tag}] axis:`, axis, 'frontDir:', dir, 'yaw:', (yaw * 180 / Math.PI) + '°',
    'wheelF nodes:', fronts.length);
  return rig;
}

/* ---------------- cab ----------------
   WHY A GENERATION COUNTER WHEN applyQueue ALREADY SERIALISES.
   ---------------------------------------------------------------------------
   loadCab() and loadTrailer() both do their scene surgery AFTER their await —
   remove the current object, dispose it, add the new one — with nothing in
   between checking that they are still the load the studio wants. Today that is
   safe only because studio.ts funnels every caller through `applyQueue`, one
   promise chain. But `applyChoice` is ALSO published on `window.__studio` as a
   documented console affordance, and a call from there is a second entry point
   into the same chain in the same tick. Two loads in flight then race on
   `state.cab`: the slower one wins the assignment and the faster one's object is
   left inside cabGroup, drawn, undisposed and unreachable.

   The token is deliberately the same shape scene/set.ts already uses
   (`token !== loading`) — one pattern for "a newer request has superseded me"
   across the engine. A superseded load disposes what it downloaded and returns
   quietly; it never throws, because being superseded is not an error and the
   caller is awaiting it inside a Promise.all that must not fail. */
let cabGen = 0;
let trailerGen = 0;

/**
 * Carrega a geometria de um cavalo A PARTIR DO CAMINHO DO ARQUIVO.
 *
 * `id` é o caminho (`models/trucks/daf_xd_6x4t_sl.glb`), não mais um id de
 * `cabs.json` — ver a nota de aposentadoria no topo do arquivo.
 *
 * FALHA ALTO quando não há arquivo. O caminho antigo caía na primeira cabine
 * disponível do manifesto, o que significava desenhar um Scania quando o
 * usuário pediu um DAF e escrever "geometria provisória" numa linha de estado
 * que ninguém lê. Um caminhão errado apresentado como certo é pior do que um
 * erro: o cliente aprova a arte sobre a lataria de outra montadora.
 */
export async function loadCab(
  id: string, onProgress?: (t: number) => void, paintMaterials?: string[] | null,
) {
  if (!id) {
    throw new Error('Este chassi não declara geometria (`file`) no catálogo —'
      + ' nada a carregar. Confira `chassis[].file` em brands.json.');
  }
  const def = cabDefFor(id, undefined, paintMaterials);
  const mine = ++cabGen;
  const cab = def.format === 'fbx-scania'
    ? await loadScaniaOriginal(def, onProgress)
    : await loadGLB(assetUrl(def.file), onProgress);
  /* Uma cabine mais nova já saiu na frente: descarta esta em vez de empilhar
     duas no cabGroup. disposeTree() respeita `tsSharedSource`, então largar um
     clone do FBX cacheado não apaga a geometria da cabine que ficou. */
  if (mine !== cabGen) { disposeTree(cab); return def; }

  setRigPlacement(false);       // assentamento e ancoragem em z medem o mundo; ver rigGroup
  if (state.cab) {
    /* ⚠️ A PLACA SAI ANTES DA CABINE MORRER. `disposeTree()` varre a raiz
       inteira e libera material E TEXTURA de tudo que encontra — e os dois
       materiais da placa são COMPARTILHADOS entre a placa do cavalo e a do
       implemento, criados uma vez na primeira cabine. Deixá-la pendurada aqui
       fazia a primeira troca de caminhão descartar a arte de 178 kB que a placa
       do BAÚ ainda está usando, e a segunda placa nasceria de um material
       morto. Não é hipótese: é a mesma armadilha que `tsSharedSource` existe
       para desviar no clone do FBX, três linhas acima. */
    detachCabPlate();
    state.cabGroup.remove(state.cab);
    disposeTree(state.cab);
  }
  setupCommon(cab);
  auditTransparency(cab, def.id);            // only glass may be transparent
  state.cabGroup.add(cab);
  /* NORMALIZAÇÃO A PARTIR DE DADO, quando existe entrada no manifesto.
     ------------------------------------------------------------------------
     `orientYaw` / `groundY` / `centerX` saem de `hitch.json`, medidos uma vez
     por vértice e carimbados com o `sha256` dos bytes. Não há caixa envolvente
     no caminho — é ela que fazia cada rip pairar de 0 a 230 mm conforme a
     rotação dos nós de roda, e é ela que a antiga heurística de orientação por
     centroide também consultava.

     A POSE não é escrita aqui: quem a escreve é `placeTrailer()`, porque a
     âncora do conjunto é a garganta do acoplador e a cabine é que anda até ela.
     Aqui só se mede o que depende da malha — o perfil da traseira. */
  const hitchEntry = findTractor(state.hitch, { id: def.id, file: def.file });
  if (hitchEntry) {
    /* Medido com a raiz na IDENTIDADE: aí o mundo é o espaço CRU do GLB, que é
       o referencial em que o manifesto fala, e `N()` faz a rotação e as duas
       translações de uma vez. Medir com a raiz já girada obrigaria a desfazer
       `centerX` no sinal certo — uma chance a mais de errar por nada. */
    cab.rotation.set(0, 0, 0);
    cab.position.set(0, 0, 0);
    cab.updateWorldMatrix(true, true);
    const perfis = measureCabRearProfiles(cab, hitchEntry);
    hitchEntry.rearProfile = perfis.wide;
    hitchEntry.rearProfiles = perfis.ladder;
    state.cabHitch = hitchEntry;
    const fw = hitchEntry.fifthWheel;
    console.info('[engate] cavalo', hitchEntry.id, '· quinta roda z', fw.z.toFixed(4),
      'prato', fw.plateTopY.toFixed(4), `(${((fw.plateTopY - hitchEntry.groundY) * 1000).toFixed(0)} mm do solo)`,
      '·', fw.method ?? '?', fw.confidence ?? '?',
      fw.needsManualReview ? `· ⚠ ±${((fw.uncertaintyM ?? 0) * 1000).toFixed(0)} mm` : '');
  } else {
    state.cabHitch = null;
    const wheelRe = new RegExp(def.wheelMeshRegex || 'tire|rim|pneu', 'i');
    // FBX mesh names may not carry wheel words — match material names too
    const wheelPred = (o: THREE.Mesh) => wheelRe.test(o.name) || wheelRe.test(firstMatName(o));
    const box = groundAndCenter(cab, /./, wheelPred);
    cab.position.z -= box.min.z;             // legado: traseira em z=0 → ocupa [0, length]
    cab.updateWorldMatrix(true, true);
  }

  state.cab = cab;
  state.cabId = id;
  state.cabDef = def;
  state.cabBox = bboxOfMatching(cab, /./);
  /* A cabine mudou de tamanho e de ponto de engate: o conjunto se refaz agora,
     e não na próxima coisa que por acaso chamar `placeTrailer()`. */
  placeTrailer();

  const authored = def.paintMaterials ?? null;
  const painted: string[] = [];
  const neutralized: string[] = [];
  // GLB cabs (volvo): upgrade the paint materials to automotive flake paint
  if (def.format !== 'fbx-scania') {
    const cache = new Map<string, THREE.Material>();
    cab.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const rep = mats.map((raw) => {
        const m = raw as THREE.MeshStandardMaterial;
        if (isPaintableMaterial(m, authored)) {
          const cached = cache.get(m.uuid);
          if (cached) return cached;
          /* O MAPA ASSADO NÃO ATRAVESSA A TINTA. `makePaintMaterial()` preserva
             o `map` de origem de propósito — nas cabines normais ele carrega
             vinco, junta e sujeira, e a tinta multiplica por cima. No bake do
             S-Way Metallica ele carrega A PELÍCULA, e multiplicar tinta por
             película devolvia a arte em tons da cor escolhida (foi o que
             obrigou aquele modelo a declarar `paintMaterials: []`).
             Sem o mapa, o mesmo arquivo pinta liso — e é isso que permite ao
             Metallica ser um ACABAMENTO do S-Way 480 em vez de um modelo à
             parte. Ver `ModelDef.finishes`. */
          /* O mapa só atravessa quando a GEOMETRIA depende dele. `alphaTest`
             marca exatamente esse caso — as tomadas de ar, cuja colmeia é o
             alfa da textura —, e aí ele passa como MÁSCARA, sem o desenho.
             Fora isso, tinta assada não atravessa tinta. */
          const src = m.alphaTest > 0
            ? (maskOnly(m.map) ?? m.map)
            : (BAKED_FINISH_RE.test(m.map?.name || '') ? null : m.map);
          const paint = makePaintMaterial(m.color, src);
          paint.name = m.name;
          cache.set(m.uuid, paint);
          painted.push(m.name || '(sem nome)');
          return paint;
        }
        /* NÃO pintou. Se for peça estrutural que a rip assou com a cor do
           caminhão de origem (longarina, farol), o croma sai agora — senão
           tirá-la da tinta devolveria a grade laranja de 2026-08-09. A função é
           idempotente, então material compartilhado entre malhas conta uma vez
           só. Ver `NEVER_BODY_RE` em material-setup.ts. */
        if (neutralizeBakedChroma(m)) neutralized.push(m.name || '(sem nome)');
        return m;
      });
      o.material = Array.isArray(o.material) ? rep : rep[0];
    });
  }
  /* `state.paintMats` era preenchido por uma SEGUNDA varredura e nunca lido por
     ninguém — o registro vivo de tinta é o Set de vehicle/paint.ts, alimentado
     por makePaintMaterial(). Passa a guardar os nomes que ACABARAM de ser
     trocados, que é o que um diagnóstico precisa, e a varredura extra sai. */
  state.paintMats = [];

  /* DIZER EM VOZ ALTA, no CARREGAMENTO. Um bake sem lataria pintável é, do lado
     do usuário, indistinguível de um clique perdido — e era exatamente esse o
     buraco: o único aviso vivia no atalho de troca-de-cor, então escolher
     caminhão e cor de uma vez (o fluxo normal do seletor) falhava calado. O log
     lista os nomes do arquivo justamente para não ser preciso abrir o .glb. */
  if (def.format !== 'fbx-scania') {
    if (neutralized.length) {
      console.info(`[tinta] ${def.file} · croma de origem removido de ${neutralized.length}:`,
        neutralized.join(', '));
    }
    if (painted.length) {
      console.info(`[tinta] ${def.file} · ${painted.length} material(is):`,
        painted.join(', '), authored ? '(lista autorada)' : '(por detecção)');
    } else {
      console.warn(`[tinta] NENHUM material de tinta em ${def.file}`
        + ' — a cabine NÃO vai mudar de cor.'
        + (authored ? ' A lista autorada em `chassis[].paintMaterials` não casou nada.' : '')
        + ' Materiais que este arquivo declara:', materialNamesOf(cab).join(', '));
    }
  }
  /* A PLACA DIANTEIRA, no sítio que `plates.json` declara para ESTE arquivo.
     ------------------------------------------------------------------------
     Depois da tinta e ANTES de `reapplyVehicleWetness()`: o material da placa é
     criado aqui, na primeira cabine, e a molhagem vale sobre MATERIAIS — montar
     depois dela deixaria a placa seca num pátio molhado até a próxima troca.
     E antes de `freezeMatrices()`, que é a regra de toda peça que muda de pai
     (ver o ⚠️ do cabeçalho de `landing-gear.ts`).

     O manifesto pode não ter chegado ainda: `loadPlateManifest()` sai junto com
     os outros dois em `loadManifests()`, que é sempre muito antes da geometria
     de um cavalo, mas quem chega primeiro não é garantido por construção. Sem
     manifesto a cabine fica sem placa e o console diz por quê — ausência de
     placa é degradação, não erro. */
  attachCabPlate(cab, def.file);

  /* Newly created paint materials register themselves with vehicle/paint.ts, so a
     re-apply pushes the CURRENT parameters onto them — the imported colour is
     never used, and a cab swap keeps whatever the user had configured. */
  setPaint({});
  reapplyVehicleWetness();     // a freshly loaded cab starts dry otherwise
  placeTrailer();
  /* E A UNIDADE REASSENTA. Trocar de cavalo muda a altura da quinta roda, logo
     a inclinação de engate que `applyRootPose()` escreve no implemento — era
     por aí que o Thermo King saía do lugar "conforme o chassi". Desde que
     `placeThermoKing()` resolve tudo no referencial do IMPLEMENTO (ver
     `bboxInFrame`), o resultado não depende mais dessa pose e esta chamada é
     redundante por construção. Ela fica assim mesmo: é idempotente, custa duas
     varreduras de caixa numa troca de cabine que já refaz o engate inteiro, e é
     o que torna "a unidade segue o implemento" uma garantia do CÓDIGO em vez de
     uma propriedade que alguém precisa reprovar a cada mudança. */
  placeThermoKing();
  syncTrailerPaintFromCab();   // keep painted trailer in step after a cab switch
  /* Pose final — daqui em diante a cabine é mobília. placeTrailer() acabou de
     repor a colocação do conjunto, então as matrizes de mundo estão certas no
     instante em que são congeladas. */
  freezeMatrices(cab);
  return def;
}

/* ---------------- what the GLB cannot carry ----------------
   The implement is baked out of the rip viewer's live scene
   (`viewer/src/exportTrailer.js`), and that bake loses three things, because
   glTF has no field for any of them:

     polygonOffset   — the viewer gives every DECAL −4/−4, so a marking lying on
                       the surface it belongs to always wins the depth test.
     envMapIntensity — authored per material family in the viewer's materials.js
                       (0.5 on the clear lamp covers, 0.3 on rubber). glTF drops
                       it, three defaults it to 1, and setupCommon() then raises
                       EVERYTHING to 1.35.
     depthWrite      — re-derived by setupCommon() from `transparent`.

   The third is already handled. The first two are restored here, and the reason
   they have to be is the rear lamps: the studio was rendering a 0.06-opacity
   cover at 1.35 env under a sunlit HDRI, which laid a white sheen over the red
   plate behind it and turned the whole cluster milky — the same failure the
   viewer's own comments describe ("washed the red lamp lenses out to pink") and
   solved with these numbers.

   Matched on MATERIAL NAME because that is the one thing the bake preserves
   exactly: the exporter merges by material and names each mesh `opt_<material>`. */
const TRAILER_DECAL_RE = /faixa-?3m|logo-ankaa/i;
/* Clear covers over a coloured plate: low env, or they veil what is under them. */
const TRAILER_LENS_RE = /lente|vidro-lanterna/i;
/* Everything else in a lamp cluster: coloured plates, LED strips, reflectors.
   These are lit surfaces, not mirrors — 1.35 blows their colour out to white. */
const TRAILER_LAMP_RE = /lanterna|led-|painel-curva|sinaleira|sinaleita/i;
/* Rubber scatters nearly everything it does not absorb; at full env strength the
   seals and mudflaps mirror the sky and read as polished plastic. */
const TRAILER_RUBBER_RE = /^borracha|aparabarro|^pneu/i;
/* Large mill-finish members: rails, posts, frame. Every one is
   `metalness: 1`, so each is a mirror of the environment until told otherwise.

   TRÊS NOMES SAÍRAM DAQUI EM 2026-08-12, e cada um por um motivo diferente:

     `^inox` e `metal-pouco-polido`   são a FERRAGEM — dobradiça, varão, trava,
                                      a chapa da marca na traseira. Ver
                                      `splitTrailerHardware()`: o bake dá um
                                      material só a três famílias que não têm o
                                      mesmo acabamento, e quem as separa é a
                                      MEDIDA, não o nome.
     `metal-claro`                    não é membro estrutural nenhum: são as
                                      duas chapas da caixa de cozinha. Ver
                                      `BOX_SHELL_RE`.

   O `$` nas duas âncoras que sobraram é o que impede os clones de voltarem para
   este ramo — `inox-ferragem__polido` não casa `^inox-ferragem$`, e é essa
   diferença de uma letra que faz a divisão valer. */
const TRAILER_STRUCT_METAL_RE =
  /galvanizado|estrutura-principal|^aro-rodas|^inox-ferragem$|^metal-pouco-polido$/i;

/* ---------------- A FERRAGEM DE INOX, separada do trilho de usinagem --------
   Pedido de produto (2026-08-12): "todas essas dobradiças, varão, travas da
   traseira e também aquela placa com o recorte Ankaa devem ser inox, inclusive
   da lateral".

   ELAS JÁ ERAM `inox-ferragem`. O que as fazia ler como chapa branca fosca era
   o bloco acima: `TRAILER_STRUCT_METAL_RE` casava `^inox` e forçava
   `roughness ≥ 0.62` em tudo o que casasse. O piso está certo para o que ele
   foi escrito — o trilho de 14,5 m que corre o flanco é galvanizado de
   usinagem, ACETINADO, e o bloco lá em cima registra a medição que provou isso.
   Só que o mesmo material carrega as duas coisas.

   MEDIDO no `trailer.glb`: 1 158 malhas em `inox-ferragem` + `metal-pouco-
   polido`, e a distribuição do vão em Z é BIMODAL, sem nada no meio:

     1 131 malhas   z-span < 0,50 m   ferragem (dobradiça, varão, trava, tala,
                                      cabeçote, guia, parafuso, a placa da
                                      traseira com 810 × 230 × 54 mm)
        27 malhas   z-span ≥ 2,58 m   trilho (2 × capping strip de 14,55 m,
                                      4 × friso de flanco de 14,47 m,
                                      11 × proteção de piso de 14,32 m,
                                      10 × cantoneira de teto de 2,58…3,00 m)

   Um corte em 2,0 m cai no meio de um vazio de 2,08 m — não é um limiar
   escolhido, é o único lugar onde ele cabe. E é em Z de propósito: o defeito
   que o piso de 0,62 existe para tapar é o horizonte do ambiente desenhando
   uma linha ao longo de uma peça que corre o COMPRIMENTO do baú. O varão tem
   2,49 m e passa por aqui como ferragem porque ele corre em Y — 25 mm em Z.

   A caixa é a de `Box3.applyMatrix4()`, ou seja a caixa de uma caixa girada,
   estritamente maior que a real. Aqui isso não custa nada: os números acima
   foram medidos pelo mesmo método conservador, então o vazio de 2,08 m já é o
   vazio do pior caso. */
const STAINLESS_FAMILY_RE = /^inox-ferragem$|^metal-pouco-polido$/i;
/** O sufixo do clone polido. Duplo sublinhado como `__porta` em
 *  `trailer-geometry.ts`, e pelo mesmo motivo: `metal-galvanizado-polido` e
 *  `plastico-cinza-polido` terminam em `-polido` com UM traço e não podem cair
 *  no ramo do inox por homonímia. */
const STAINLESS_SUFFIX = '__polido';
const TRAILER_STAINLESS_RE = /__polido$/;
/** …e o da ferragem que é da CAIXA, que não é inox — ver `BOX_HARDWARE_*`. */
const BOX_HW_SUFFIX = '__caixa';
const BOX_HARDWARE_RE = /__caixa$/;
/** Acima disto em Z a peça é trilho, não ferragem. Ver a medição acima. */
const STAINLESS_RAIL_Z = 2.0;
/**
 * A rugosidade do inox: **0,30 — o escalar do próprio bake.**
 *
 * `inox-ferragem` chega do rip com `metalness 1, roughness 0.3`, que é
 * exatamente um inox escovado; era o piso de 0,62 que o apagava. Aplicado como
 * TETO (`Math.min`) e não como atribuição, porque `metal-pouco-polido` — as
 * quatro travas de porta — chega com 1,0 e precisa descer até aqui, enquanto
 * um bake futuro que declarasse 0,2 continuaria mais polido do que este número
 * manda, que é o que "o bake sabe da própria peça" significa.
 */
const STAINLESS_ROUGHNESS = 0.30;

/**
 * Os dois nós que o bake dá à caixa de cozinha.
 *
 * Exportado porque `vehicle/trim.ts` casa a MESMA peça (é ele quem oferece
 * "Caixa de ferramentas" no card de acabamentos) e duas cópias de "como se acha
 * a caixa" divergiriam no primeiro re-bake. `#Caixa-Ferrmantas-modelo-1padrao`
 * é o nó-pai das 79 peças e `caixa-plastico-ferramentas` é a bandeja interna.
 */
export const TRAILER_BOX_NODE_RE = /caixa-ferrmantas|caixa-plastico-ferramentas/i;

/** O nó ou algum ancestral dele casa, parando na raiz do implemento. */
function underTrailerNode(o: THREE.Object3D, root: THREE.Object3D, re: RegExp): boolean {
  for (let n: THREE.Object3D | null = o; n; n = n.parent) {
    if (re.test(n.name || '')) return true;
    if (n === root) break;
  }
  return false;
}

/**
 * Divide o material único da ferragem nas TRÊS famílias que ele carrega.
 *
 * O bake tem um `inox-ferragem` só e três acabamentos dentro dele:
 *
 *   TRILHO      z ≥ 2 m         fica com o material original e com o acetinado
 *                               de usinagem que `TRAILER_STRUCT_METAL_RE` dá.
 *   CAIXA       dentro do nó    a ferragem da caixa de cozinha NÃO é inox — na
 *               da caixa        foto de catálogo ela é preta, do mesmo tom do
 *                               quadro. Vira `…__caixa`.
 *   FERRAGEM    o resto         dobradiça, varão, trava, a chapa da traseira.
 *                               Vira `…__polido`.
 *
 * A ordem dos testes importa: a caixa é decidida ANTES do tamanho, porque a
 * ferragem dela também é pequena e cairia no inox por não ser trilho.
 *
 * RODA ANTES DE `buildTrailerRig()`, e isso é contrato, não preferência:
 * `TrailerBody` extrai o kit da porta lateral no construtor
 * (`extractDoorKit()`) e guarda a REFERÊNCIA do material de cada peça. Uma
 * divisão feita depois trocaria o material das malhas da traseira e deixaria o
 * kit apontando para o material velho — a porta lateral sairia fosca enquanto a
 * traseira brilha, que é justamente o "inclusive da lateral" do pedido.
 *
 * Os valores dos clones são escritos por `applyTrailerFinish()`, que roda
 * depois: aqui só se decide QUEM é quem. Como o kit guarda o mesmo objeto, a
 * correção de lá o alcança sem que este arquivo precise saber dela.
 */
function splitTrailerHardware(root: THREE.Object3D): void {
  root.updateWorldMatrix(true, true);
  const toLocal = root.matrixWorld.clone().invert();
  const clones = new Map<string, THREE.Material>();
  const m4 = new THREE.Matrix4();
  const box = new THREE.Box3();
  let polished = 0, boxed = 0, rails = 0;

  const variantOf = (m: THREE.Material, suffix: string): THREE.Material => {
    const key = m.uuid + suffix;
    let c = clones.get(key);
    if (!c) {
      c = m.clone();
      c.name = (m.name || 'inox') + suffix;
      clones.set(key, c);
    }
    return c;
  };

  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((m) => !!m && STAINLESS_FAMILY_RE.test(m.name || ''))) return;

    let suffix: string;
    if (underTrailerNode(o, root, TRAILER_BOX_NODE_RE)) {
      suffix = BOX_HW_SUFFIX; boxed++;
    } else {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      if (!bb) return;
      box.copy(bb).applyMatrix4(m4.multiplyMatrices(toLocal, o.matrixWorld));
      if (box.max.z - box.min.z >= STAINLESS_RAIL_Z) { rails++; return; }
      suffix = STAINLESS_SUFFIX; polished++;
    }
    const swap = (m: THREE.Material | null) =>
      (m && STAINLESS_FAMILY_RE.test(m.name || '') ? variantOf(m, suffix) : m);
    o.material = Array.isArray(o.material)
      ? o.material.map(swap) as THREE.Material[]
      : swap(o.material) as THREE.Material;
  });

  console.info('[ferragem] dividida —', polished, 'malhas de inox ·',
    boxed, 'da caixa ·', rails, `de trilho intocadas (z ≥ ${STAINLESS_RAIL_Z} m) ·`,
    clones.size, 'material(is) clonado(s):',
    [...clones.values()].map((m) => m.name).join(', ') || '(nenhum)');
}

/* ---------------- A CAIXA DE COZINHA É ESCURA ----------------
   Pedido de produto (2026-08-12), com a foto de catálogo da Resfri Ar como
   referência: "a parte frontal dessa caixa de cozinha deve ser preta" e, na
   volta, "não deve ser um preto puro, e a ferragem também deve ser um cinza bem
   escuro quase preto, como na referência".

   O bake entrega a caixa com a FOLHA branca, e a folha é a face inteira que se
   vê do lado de fora. Quem a carrega são dois materiais, e nenhum dos dois é
   usado em mais nada no implemento — MEDIDO:

     plastico-cinza-polido   1 malha    a FOLHA (1 332 tri, 1 030 × 581 mm,
                                        27 mm de espessura, na face de fora)
     metal-claro             2 malhas   o lábio inferior corrido (1 142 mm) e o
                                        forro de 1 mm por dentro da folha

   Estar sozinhos é o que torna o casamento por nome seguro aqui, e é por isso
   que as âncoras são `^…$`: qualquer parente futuro do nome fica de fora até
   alguém medir de novo.

   OS DOIS TONS, E DE ONDE SAIU CADA UM
   ---------------------------------------------------------------------------
   Amostrado na própria foto de catálogo (média 3×3, sRGB):

     folha, face frontal   #535353 … #858585   (média #5b5b5a)
     montante do quadro    #141414
     cantoneira iluminada  #52504c
     strap da dobradiça    #000000
     trava inferior        #383838

   A leitura que importa não é o valor absoluto — é uma foto de estúdio, o pixel
   traz a luz junto —, é a RELAÇÃO: a folha é um cinza escuro nitidamente mais
   claro que a ferragem e o quadro, que são quase pretos. Foi exatamente essa
   diferença que a primeira rodada perdeu ao pintar a folha com o preto do
   quadro, e é o que o segundo pedido corrige.

   A FERRAGEM NÃO É ESCOLHIDA: é o `baseColorFactor` de `caixa-estrutura-preta`,
   o quadro da própria caixa — #1d1f22 em sRGB, que já é o "cinza bem escuro
   quase preto" pedido. Copiar o vizinho é o que garante que ferragem e quadro
   saiam na mesma tinta sem ninguém arbitrar um hex.

   A FOLHA, essa, é DECISÃO DE APARÊNCIA e fica registrada como tal: #3b3b3d,
   ~3,2× o quadro em luz linear, que é a ordem de grandeza que a foto mostra
   entre a face da folha e o montante. Um número, não uma escala de outro. */
const BOX_SHELL_RE = /^plastico-cinza-polido$|^metal-claro$/i;
/** A folha: #3b3b3d em sRGB, LINEAR como o glTF declara `baseColorFactor`. */
const BOX_SHELL_COLOR: [number, number, number] = [0.043735, 0.043735, 0.046665];
/**
 * A ferragem da caixa: o `baseColorFactor` de `caixa-estrutura-preta`, cru.
 *
 * Ela chega aqui vinda de `inox-ferragem` (metalness 1), e a metalicidade TEM
 * de cair: num condutor a cor base tinge o REFLEXO em vez de ser albedo, então
 * um #1d1f22 metálico não é uma peça preta — é um espelho escuro, e num tom
 * tão baixo ele lê como buraco. Aço pintado é dielétrico, e é isso que a foto
 * mostra: strap fosco, sem estrutura de reflexo.
 */
const BOX_HARDWARE_COLOR: [number, number, number] = [0.012286, 0.013702, 0.015996];
/** O acabamento das duas: fosco de tinta, sem a menor pretensão de espelho. */
const BOX_PAINT_METALNESS = 0;
const BOX_PAINT_ROUGHNESS = 0.44;
/* A RODA DO FH16 NÃO É RIP DO IMPLEMENTO — e por isso nada aqui pode encostar
   nela.
   ---------------------------------------------------------------------------
   Tudo neste bloco existe para consertar o que o rip do IMPLEMENTO mente sobre
   os próprios materiais: uma lente de lanterna que se declara metal, uma
   longarina que se declara espelho, uma borracha que espelha o céu. A roda
   trazida por `vehicle/wheels.ts` vem do MESMO bake das cabines do catálogo,
   já é dielétrica (`metalness 0`), já tem cor e normal próprios, e no cavalo é
   renderizada exatamente como `setupCommon()` a deixa: `envMapIntensity` 1.35.

   Passar o corte de borracha nela era o defeito relatado — "o pneu continua
   muito preto, enquanto o do Volvo é levemente acinzentado". Os dois pneus são
   O MESMO ASSET e a MESMA textura; o que mudava era o ambiente, 1.35 no cavalo
   contra 0.3 no implemento. Num dielétrico que passa o dia na sombra do baú o
   ambiente é quase toda a luz que ele recebe, então 4,5x menos ambiente é a
   diferença entre borracha e silhueta preta.

   A ironia é que o nome foi escolhido para casar: `pneu-fh16` casa `^pneu` em
   TRAILER_RUBBER_RE, e o bake documentava isso como se fosse a intenção certa.
   Era o contrário — a regra da borracha é um remendo para material errado, e
   aplicá-la a material CERTO só estraga.

   O sufixo `.001` entra porque o exportador do Blender desambigua nomes
   repetidos: o disco e o cubo da roda avulsa saem como `roda-disco-fh16.001` e
   `roda-cubo-fh16.001`. */
const FH16_WHEEL_RE = /-fh16(\.\d+)?$/i;

/* PELÍCULA ASSADA DENTRO DO ALBEDO DA TINTA — reconhecida pelo nome da TEXTURA.
   ---------------------------------------------------------------------------
   Quem preparou o `iveco_metallica_4x2.glb` assou a arte da edição limitada nos
   próprios materiais de tinta e batizou cada imagem com o sufixo: os dezesseis
   `*_carpaint_color` chegam com `map` = `*_carpaint_color_assada`, enquanto no
   rip de fábrica (confira no Volvo) `carpaint_color` vem SEM textura nenhuma.

   O marcador é o nome da textura, e não uma lista no manifesto, porque ele
   viaja DENTRO do asset: uma lista em JSON pode dessincronizar de um re-bake
   sem que nada reclame, e o sintoma seria a película voltando por baixo da
   tinta — exatamente o defeito que isto existe para fechar.

   As máscaras de grade (`*_colmeia`) NÃO casam, e não podem casar: elas são o
   alfa que vaza a colmeia, e derrubá-las transformaria a grade numa chapa. */
const BAKED_FINISH_RE = /_assada$/i;

function applyTrailerFinish(root: THREE.Object3D) {
  const seen = new Set<string>();
  const log: string[] = [];
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const raw of mats) {
      const m = raw as THREE.MeshStandardMaterial;
      if (!m || seen.has(m.uuid)) continue;
      seen.add(m.uuid);
      const name = m.name || '';
      /* Material autorado, não material do rip — ver `FH16_WHEEL_RE`. Sai com o
         1.35 de `setupCommon()`, que é o que o cavalo mostra na roda idêntica. */
      if (FH16_WHEEL_RE.test(name)) { log.push(`${name}: intocado (roda autorada)`); continue; }
      if (TRAILER_DECAL_RE.test(name)) {
        /* The geometry is right — the bake now quantises positions on one
           scene-wide grid, so a decal 0.2 mm proud stays proud. This is the belt
           to that braces: a depth bias costs nothing and covers the case where
           the grid and the gap are the same size. */
        m.polygonOffset = true;
        m.polygonOffsetFactor = -4;
        m.polygonOffsetUnits = -4;
        log.push(`${name}: decal −4/−4`);
      }
      if (TRAILER_LENS_RE.test(name)) {
        m.envMapIntensity = 0.5;
        log.push(`${name}: env 0.5`);
      } else if (TRAILER_LAMP_RE.test(name)) {
        /* A LAMP LENS IS A DIELECTRIC, and the rip says otherwise.
           `painel-curva-led-vermelho` — the red plate of the rear cluster —
           arrives with metalness 0.718 and roughness 0.098, straight out of the
           library's captured scalars. On a METAL the base colour tints the
           REFLECTION instead of being albedo, so under the rip viewer's dim grey
           room that plate reads as deep red, and under this studio's sunlit HDRI
           the very same numbers mirror the sky and the whole cluster goes milky
           pink. That is the one the rear lamps were failing on, and no amount of
           env trimming reaches it: measured at env 0.5, 0.85 and 0.4 the lens was
           still white — because it was reflecting the SUN, not the environment.

           The viewer's own rule already says what to do here ("authored metalness
           wins over the captured scalar — paint is a dielectric"); it simply never
           had to author this one, because its room hid the fault. So: metalness 0,
           and a floor under roughness, since 0.098 on a dielectric is still a
           mirror at grazing angles — met 0 alone, with the roughness left at
           0.098, renders as washed as before. Moulded polycarbonate is not a
           mirror. Verified by render against the viewer's own lamp. */
        m.metalness = 0;
        m.roughness = Math.max(m.roughness ?? 0, 0.32);
        m.envMapIntensity = 0.85;
        log.push(`${name}: dielétrico, rug ≥0.32, env 0.85`);
      } else if (TRAILER_STRUCT_METAL_RE.test(name)) {
        /* THE HORIZON IN THE RAIL — Kennedy's own diagnosis, and it is right.
           These are `metalness: 1` surfaces: what you see on them is not their
           colour, it is the ENVIRONMENT. The studio's environment is a
           photographic HDRI standing in for the rest of the map, and a
           panorama's dominant feature is a hard horizon line. Run that across a
           15 m rail and you get a bright/dark split that slides along the rail as
           the camera moves — which reads exactly like a rendering bug, and is
           what kept coming back on the flank frame no matter what geometry was
           corrected.

           The honest fix is not to mirror less environment but to stop being a
           mirror: mill-finish galvanised steel and structural aluminium are
           SATIN. The rip's captured scalars say otherwise for the same reason
           they said the lamp lens was a metal — the capture is unreliable about
           this exact property.

           So the roughness gets a floor, which spreads the horizon into a
           gradient no edge can be read off. Where a roughnessMap drives the
           response the scalar is only a multiplier and the floor cannot bite, so
           those get their environment turned down instead — same effect on the
           reflected horizon, and it is the only lever left.

           This does NOT put the nearby scenery into the reflection; nothing here
           can, short of a reflection probe. It stops the sky's horizon from
           drawing a line on the truck, which is the visible half of the problem.

           HOW MATTE: these flank members are not stainless, so they should barely
           reflect at all. They stay `metalness: 1` — they ARE metal, and a
           dielectric would read as painted plastic — but they get a high
           roughness floor and very little environment, which is what a matte mill
           finish actually looks like. */
        const mapDriven = !!m.roughnessMap;
        if (!mapDriven) m.roughness = Math.max(m.roughness ?? 0, 0.62);
        /* ROUGHNESS is the lever, not the environment — and cutting the
           environment to 0.18/0.28 (which is what this used to do) was wrong.
           These are `metalness: 1`, so their diffuse term is ZERO: every photon
           they show comes from the sun or from the environment. The flank rail
           lives in the body's own shadow all day, so starving its environment
           left it with nothing. Measured on the rail band (y 1.42–1.50, above the
           3M tape and below the skin), against a white panel reading ~218:

             env 0.18/0.28 → 78.6 at 07h, 88.5 at 13h, 179.0 at 18h
             env 1.0       → 152.1        155.4        204.2

           A galvanised rail beside white paint is not 2.5× darker than it, and it
           does not triple in brightness when the sun swings — that swing is what
           Kennedy reported. The high roughness floor above is what keeps it satin
           instead of a mirror, and it does that job without starving it.

           The reason the cut existed at all — the HDRI's horizon drawing a hard
           line along the rail — went away with scene/probe.ts: a local capture has
           no horizon to draw. */
        m.envMapIntensity = 1.0;
        log.push(`${name}: rug ≥0.62, env 1.0`);
      } else if (TRAILER_STAINLESS_RE.test(name)) {
        /* O INOX, e ele é o RAMO CURTO de propósito: nada aqui contraria o
           rip, só se deixa de apagar o que ele já dizia. `metalness: 1` é
           reafirmado porque o teto de rugosidade sozinho não salvaria um bake
           que declarasse a peça dielétrica, e um inox dielétrico lê como
           plástico cinza — o defeito exato que o bloco das lanternas descreve,
           ao contrário.

           E O TETO MORDE MESMO COM `roughnessMap`, ao contrário do PISO do
           ramo acima — a assimetria é do multiplicador, não de gosto. Com mapa,
           o escalar MULTIPLICA o canal verde: um piso de 0,62 não pode ser
           imposto (levantar o multiplicador acima de 1 estoura o mapa e some
           com a variação dele), mas um teto de 0,30 é exatamente "o mesmo mapa,
           três vezes mais polido" — o desenho escovado sobrevive, a peça deixa
           de ser fosca. Isto não é hipotético: `metal-pouco-polido`, que são as
           QUATRO travas de porta do pedido, é a única desta família com
           `metallicRoughnessTexture`, e a primeira rodada as deixou em
           roughness 1 justamente por pular o mapa. */
        m.metalness = 1;
        m.roughness = Math.min(m.roughness ?? 1, STAINLESS_ROUGHNESS);
        m.envMapIntensity = 1.0;
        log.push(`${name}: inox, rug ≤${STAINLESS_ROUGHNESS}, env 1.0`);
      } else if (BOX_HARDWARE_RE.test(name) || BOX_SHELL_RE.test(name)) {
        /* LINEAR, e é a mesma conversão que o GLTFLoader faz ao ler
           `baseColorFactor`. Passar o hex por `setHex()` levaria o número por
           sRGB e entregaria um cinza ~4× mais claro do que o do quadro ao
           lado — visível justamente onde folha e quadro se encostam. */
        const hw = BOX_HARDWARE_RE.test(name);
        m.color.setRGB(...(hw ? BOX_HARDWARE_COLOR : BOX_SHELL_COLOR),
          THREE.LinearSRGBColorSpace);
        m.metalness = BOX_PAINT_METALNESS;
        m.roughness = BOX_PAINT_ROUGHNESS;
        m.envMapIntensity = 1.0;
        log.push(`${name}: ${hw ? 'ferragem da caixa' : 'folha da caixa'}`);
      } else if (TRAILER_RUBBER_RE.test(name)) {
        m.envMapIntensity = 0.3;
        log.push(`${name}: env 0.3`);
      }
      m.needsUpdate = true;
    }
  });
  console.info('[implemento] acabamento restaurado —', log.length ? log.join(' · ') : 'nada casou (VERIFICAR: os nomes de material mudaram?)');
}

/* ---------------- reflexo local ----------------
   Prende o cubemap da sonda como `envMap` nos materiais do VEÍCULO INTEIRO —
   cavalo e implemento —, para que o que o metal espelha seja a cena em que ele
   está e não o HDRI do cenário. Em three, um `envMap` explícito tem precedência
   sobre `scene.environment`, então isto é um override por material e o resto da
   cena continua intocado.

   Aplicado ao veículo TODO e não só aos metais óbvios: um dielétrico quase não
   muda (seu termo de ambiente é uma borda de Fresnel fraca), e escolher um
   subconjunto deixaria duas peças vizinhas espelhando dois mundos diferentes,
   que é um artefato pior do que o que se está consertando.

   As intensidades que applyTrailerFinish() e setupCommon() escrevem NÃO são
   alteradas aqui. Elas foram escolhidas para impedir o horizonte do HDRI de
   desenhar uma linha no flanco; uma captura local não tem esse horizonte.

   ------------------------------------------------------------------------
   POR QUE O CAVALO ENTROU AQUI (2026-08-08). Até esta data a sonda valia só
   para `state.trailer`, e essa era a assimetria que o dono do produto relatou
   como "está alterando mais o cavalo do que o implemento". Medido na cena viva:
   48/48 materiais do implemento carregavam `envMap` explícito e 0/95 do cavalo
   carregavam — as duas metades amostravam AMBIENTES DIFERENTES por construção,
   e nenhum ajuste de luz fecha isso, porque a diferença não está na luz.

   A correção NÃO foi tirar o `envMap` do implemento, e isso foi decidido por
   medida, não por gosto. Quem depende da sonda é o cenário de FORA: as barras
   estruturais (`inox-ferragem`, `metal-*`, 1156 malhas) são `metalness: 1` com
   `envMapIntensity` 1.0, ou seja, tudo o que elas mostram é o ambiente. Esse
   1.0 só existe PORQUE a captura local não tem horizonte — antes da sonda o
   valor era 0.18/0.28, cortado justamente para esconder a linha do horizonte do
   HDRI correndo pelo estrado de 15 m (ver o bloco TRAILER_STRUCT_METAL_RE).
   Devolver essas barras para `scene.environment` mantendo 1.0 traria a linha de
   volta em intensidade cheia — regressão dupla no `distrito-industrial`, que
   está fora de escopo para mudança de aparência.

   Então a sonda é a fonte melhor, e o que faltava era ela cobrir as duas
   metades. Isto não inventa desenho novo: `scene/probe.ts` sempre disse "ligado
   como `envMap` nos materiais DO VEÍCULO", a função sempre se chamou
   `refreshVehicleReflection`, o ponto de captura sempre foi o centro do
   conjunto (cavalo + implemento) e a captura sempre escondeu OS DOIS grupos —
   ou seja, o cubemap já era válido para o cavalo. Só a aplicação parou no meio.

   ------------------------------------------------------------------------
   A SONDA NÃO VÊ O RELÓGIO, E ERA POR ISSO QUE O IMPLEMENTO BRILHAVA À NOITE.
   Duas faltas que se somavam, ambas consequência da frase lá em cima — "um
   `envMap` explícito tem precedência sobre `scene.environment`":

     1. Tem precedência sobre `scene.environmentIntensity` também. Esse uniform
        é a ÚNICA coisa que leva a gradação dia-para-noite aos reflexos
        (applyRig() o leva a lerp(1, 0.40, nightness) sob um HDRI), e um
        material com `envMap` próprio não é multiplicado por ele — só pelo seu
        `envMapIntensity`. Assim toda superfície do implemento mantinha
        refletividade de meio-dia à meia-noite.
     2. Rodava uma vez por escolha e nunca mais, então o CONTEÚDO era uma
        captura do cenário na hora em que o modelo tivesse carregado.

   As duas se resolvem por UM escalar contínuo — ver applyProbeEnvGain() abaixo
   para por que ele é uma RAZÃO de `scene.environmentIntensity` e não uma nova
   captura. Com o cavalo dentro do mesmo mapa, esse escalar passa a reger as
   duas metades pela mesma lei, que é o ponto todo desta mudança.

   SOBRE O NÍVEL, e é uma diferença real: um material sem `envMap` recebia
   `envMapIntensity × scene.environmentIntensity`; com a sonda ele recebe só
   `envMapIntensity × f`. Isso NÃO é uma intensidade perdida. `environmentIntensity`
   existe para AJUSTAR um HDRI arbitrário — que está em unidades da foto — ao rig
   da cena. A sonda não precisa desse ajuste: ela é um render da cena já
   iluminada, nas unidades do próprio framebuffer. Multiplicar de novo seria
   contar o encaixe duas vezes. Por isso a base registrada é o `envMapIntensity`
   autorado, cru, para as duas metades. */
/** Authored envMapIntensity per implement material — the value the tracking gain
 *  multiplies. Read back through the map so a re-capture never compounds. */
let probeBase = new Map<THREE.MeshStandardMaterial, number>();
/** `scene.environmentIntensity` at the instant the live cubemap was captured. */
let probeEnvIntensity = 1;
/**
 * O cubemap da última captura, guardado — e este é o conserto de um defeito que
 * só aparecia com tinta ESCURA.
 *
 * `refreshVehicleReflection()` percorre `state.cab` e `state.trailer` e liga a
 * sonda a todo material que encontrar NAQUELE INSTANTE. Mas nem todo material de
 * tinta existe naquele instante: `state.trailerPaintMat`, `state.frontWallMat` e
 * os `carpaint-<peça>` de `vehicle/trim.ts` nascem PREGUIÇOSOS, no primeiro
 * clique que os pede — sempre depois da captura. Eles ficavam então sem `envMap`
 * próprio e caíam em `scene.environment`, que é o HDRI CRU do céu, multiplicado
 * pelo `envMapIntensity` de 1,3 da tinta.
 *
 * A sonda é um render da vizinhança REAL (asfalto, galpões, sombra); o HDRI é o
 * céu inteiro. Com uma tinta clara a diferença passa; com uma tinta PRETA
 * metálica, em que a difusa é zerada e o que se vê é só reflexo, ela é a
 * diferença entre preto e cinza — que foi exatamente o relato: *"apliquei a cor
 * do cavalo, que é preto, ela ficou meio que cinza"*, com a cabine preta ao lado
 * do implemento cinza na mesma foto. As duas metades tinham a mesma receita e
 * ambientes diferentes.
 */
let probeTex: THREE.Texture | null = null;

/**
 * A intensidade AUTORADA de cada material adotado, guardada para sempre.
 *
 * `probeBase` é RECONSTRUÍDO a cada captura, e um material que não estivesse
 * pendurado em malha nenhuma naquele instante cai fora dele — é o caso exato de
 * `trailerPaintMat` com "pintar o implemento" desligado. Sem esta segunda
 * tabela, a próxima adoção leria `envMapIntensity` já multiplicado pelo ganho da
 * noite anterior e o assaria dentro da base, compondo um pouco mais a cada ida e
 * volta da caixa. WeakMap porque a chave é o material: quando ele morre, a
 * entrada vai junto.
 */
const authoredEnvIntensity = new WeakMap<THREE.Material, number>();

/**
 * Adota um material RECÉM-CRIADO na sonda corrente.
 *
 * Chamado por quem cria material de tinta fora do ciclo de carga — ver o bloco
 * de `probeTex`. Idempotente: a base sai de `authoredEnvIntensity`, então
 * chamá-la dez vezes dá o mesmo resultado que chamá-la uma.
 */
export function adoptProbeMaterial(m: THREE.Material | null | undefined) {
  if (!probeTex || !m) return;
  const mat = m as THREE.MeshStandardMaterial;
  if (mat.envMapIntensity === undefined) return;
  const base = authoredEnvIntensity.get(mat) ?? mat.envMapIntensity;
  authoredEnvIntensity.set(mat, base);
  probeBase.set(mat, base);
  if (mat.envMap !== probeTex) { mat.envMap = probeTex; mat.needsUpdate = true; }
  mat.envMapIntensity = base * (scene.environmentIntensity / (probeEnvIntensity || 1));
}

/* THE IMPLEMENT MUST NOT LAG THE WORLD. The first version of this fix
   re-captured the probe a quarter-second after the slider settled, which is
   worse than the bug it replaced: every other surface in the scene tracked the
   clock per frame while the implement waited and then SNAPPED — Kennedy read it
   immediately as "o trailer demora mais que o resto do mundo". A discrete event
   cannot be made smooth by tuning its delay.

   So there is no clock-driven re-capture at all. Instead the gain is the RATIO
   of `scene.environmentIntensity` now to its value when the cube was shot.
   `scene.environmentIntensity` is the single number applyRig() drives for every
   other material's environment term, so multiplying by that ratio makes the
   implement's response curve IDENTICAL to the cab's and to the set's — not
   approximately, exactly, and on the same frame. Free: it is a uniform.

   What it costs is content: at 21:00 the cube is still a picture taken at
   whatever hour the model loaded at, dimmed. That is day-for-night, which is the
   doctrine this engine already applies to a projected dome (see the plate note
   in environment.ts) and it holds here for the same reason plus one more — the
   probe is a 256² PMREM, so by the time any surface rough enough to matter
   samples it, what survives is level and broad colour, not content. Uniform
   scaling also keeps the bright parts bright relative to the dark ones, which is
   what makes a graded day plate read as moonlight instead of as a flat wash.

   The probe is still re-captured on the events that genuinely invalidate it — a
   new scenario, a new cab, the implement moving — because those already redraw
   the whole frame and no pop is visible inside them. */
function applyProbeEnvGain() {
  if (!probeBase.size) return;
  const f = scene.environmentIntensity / (probeEnvIntensity || 1);
  for (const [m, base] of probeBase) m.envMapIntensity = base * f;
}

/* applyRig() writes scene.environmentIntensity and only THEN runs the rig hooks,
   so this reads the value for the frame being applied, not the previous one. */
onRig(applyProbeEnvGain);

/* ---- TROCAR O FUNDO DO ESTÚDIO INVALIDA A SONDA ----
   O bloco acima lista os eventos que RE-CAPTURAM: novo cenário, nova cabine,
   implemento movido. Faltava o mais óbvio do ciclorama: mudar a COR DA SALA.

   O ganho por razão de `environmentIntensity` não cobre este caso, e é
   importante entender por quê: ele escala o cubo antigo, ou seja mantém uma
   foto da sala CINZA e a clareia. Mas a mudança que uma pastilha de fundo faz
   não é de nível, é de CONTEÚDO — a sala inteira em volta do veículo trocou de
   valor, e o que a lataria reflete é a sala. Sem uma captura nova, escolher
   "Branco" deixava o implemento espelhando um estúdio cinza um pouco mais
   claro. É a metade da queixa "as cores não refletem no cenário" que sobrou
   depois de o IBL do estúdio (scene.ts) resolver a outra.

   COM ATRASO, E É OBRIGATÓRIO. A captura são seis faces sobre a cena inteira
   mais um PMREM, e `onRig` dispara a cada quadro dos 0,8 s de crossfade — sem o
   debounce isto seriam ~48 capturas por clique. O disparo cai DEPOIS de a
   rampa assentar, que é também quando a sala que ele vai fotografar é a final. */
let backdropSeen = NaN;
let probeTimer: ReturnType<typeof setTimeout> | 0 = 0;

onRig((rig) => {
  /* A assinatura do fundo em um número. `cycloramaAlbedo` sozinho não bastaria:
     o piso tem multiplicador próprio desde a recalibração das pastilhas. */
  const sig = rig.cycloramaAlbedo * 8 + rig.cycloramaFloor;
  if (!Number.isFinite(backdropSeen)) { backdropSeen = sig; return; }
  if (Math.abs(sig - backdropSeen) < 0.02) return;
  backdropSeen = sig;
  if (probeTimer) clearTimeout(probeTimer);
  probeTimer = setTimeout(() => {
    probeTimer = 0;
    /* Só onde há sala. Nos cinco cenários sem ciclorama estes campos ficam no
       valor de fábrica e nunca se mexem, então este caminho não é alcançado —
       mas a guarda é o que garante que continue assim se algum dia forem. */
    if (state.cab || state.trailer) refreshVehicleReflection();
  }, 900);
});

export function refreshVehicleReflection() {
  const trailer = state.trailer;
  /* Basta UMA das metades: o cavalo também amostra a sonda agora, então uma
     cena só com cabine ainda tem o que corrigir. */
  if (!trailer && !state.cab) return;
  const rig = new THREE.Box3();
  rig.expandByObject(state.trailerGroup);
  if (state.cab) rig.expandByObject(state.cabGroup);
  if (rig.isEmpty()) return;
  const at = rig.getCenter(new THREE.Vector3());

  const tex = captureReflectionProbe({
    at,
    /* The vehicle cannot be in its own reflection. Both groups, so the trailer
       does not mirror the cab's back panel at point-blank range either. */
    hide: [state.cabGroup, state.trailerGroup],
  });
  if (!tex) return;
  probeTex = tex;

  const seen = new Set<string>();
  /* Reconstruído em vez de mutado: uma troca de cabine ou de implemento descarta
     materiais, e um Map com chave neles seguraria viva toda geração. As bases
     são trazidas do mapa que sai quando o material sobrevive — ler
     envMapIntensity do material aqui leria o ganho de noite ANTERIOR e o
     assaria dentro, compondo um pouco mais a cada nova captura. */
  const next = new Map<THREE.MeshStandardMaterial, number>();
  const bind = (root: THREE.Object3D | null) => {
    let n = 0;
    if (!root) return n;
    root.traverse((node) => {
      const o = node as THREE.Mesh;
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const raw of mats) {
        const m = raw as THREE.MeshStandardMaterial;
        if (!m || seen.has(m.uuid)) continue;
        seen.add(m.uuid);
        m.envMap = tex;
        m.needsUpdate = true;
        next.set(m, probeBase.get(m) ?? m.envMapIntensity);
        n++;
      }
    });
    return n;
  };
  /* AS DUAS METADES. O `seen` é compartilhado de propósito: cavalo e implemento
     podem compartilhar material (o mesmo material de tinta, por exemplo), e
     contá-lo duas vezes só inflaria o número do log. */
  const nCab = bind(state.cab);
  const nTrailer = bind(trailer);
  const n = nCab + nTrailer;
  probeBase = next;
  /* A captura aconteceu sob o rig ATUAL, então a radiância dela já carrega o
     nível de ambiente desta hora: o ganho é 1 até o relógio andar. */
  probeEnvIntensity = scene.environmentIntensity || 1;
  applyProbeEnvGain();
  console.info('[probe] reflexo local aplicado a', n, 'materiais do veículo —',
    nCab, 'do cavalo +', nTrailer, 'do implemento · captura em',
    at.toArray().map((v) => +v.toFixed(2)).join(', '),
    '· envIntensity', probeEnvIntensity.toFixed(3));
}

/* ---------------- livery panels, built at load ----------------
   `livery.attachOverlays()` looks for meshes named SIDE_L / SIDE_R / REAR and
   hangs a canvas-textured overlay on each, sampling through TEXCOORD_1. Those
   three meshes are a contract of the MERGE-BY-MATERIAL bake — the exporter cuts
   them out of the white body and writes the livery UV itself.

   An UNFLATTENED bake has no such meshes: it keeps the rip's own hierarchy, which
   is precisely why it renders correctly (mirrored nodes keep the transforms three
   compensates for). So on that asset the editor painted nothing at all — there
   was nothing named for the overlay to attach to.

   Rather than force one bake or the other, the panels are cut here, at load, by
   the SAME rule the exporter uses: depth from the body's extreme face, not height
   and not the face normal. The flank is corrugated, so a band has to clear the
   whole rib (crest at 1.2986, next sheet inboard at 1.2409 — 40 mm takes the rib
   and stops short of the inner wall); the rear keeps a normal test because the
   door frame's returns face sideways and are not painted.

   THE TRIANGLES ARE MOVED, NOT COPIED. The first version of this added the panels
   on top of the skin they were cut from and held them in front with polygonOffset,
   the way buildFrontWallOverlay() does. That is wrong here, and exportTrailer.js
   says so in its own contract: the panels "must NOT also remain in the joined body
   mesh — the studio swaps their material to car paint, and a duplicate underneath
   would show through". It does: painted red, the flank's bottom band came out a
   muddy brown that snapped back to red when the camera moved a few degrees, which
   is two coplanar surfaces trading the depth test. A depth bias cannot fix a
   duplicate, it can only decide which of the two wins this frame.
   So each source mesh has its own index rebuilt without the triangles that left.
   Only the geometries that actually lost triangles are touched, and a geometry
   shared by several meshes is cloned first so the others keep theirs. */
const LIVERY_SKIN_SIDE = 0.04;
const LIVERY_SKIN_REAR = 0.10;
/**
 * A fatia da TESTEIRA que vira chapa de arte. **50 mm.**
 *
 * A quarta face nasceu em 2026-08-13, a pedido: *"precisa adicionar um livery da
 * frontal, ao lado do livery da traseira"*. Ela já era pintável — a frente
 * entrava em `trailerPanelMeshes()` pelo material branco, e antes disso por
 * `buildFrontWallOverlay()` — mas não tinha onde receber DESENHO, que é outra
 * coisa: pintar é trocar o material da malha, plotar exige `uv1` e uma malha
 * própria para a sobreposição de arte pendurar.
 *
 * O número é o `FRONT_WALL_SKIN` do overlay, e a igualdade não é coincidência:
 * é a mesma pele, medida da mesma forma, e lá ela foi verificada em 1 630
 * triângulos cobrindo 100 % da parede (0,02 perde uma segunda folha 9 mm atrás;
 * ≥0,12 começa a puxar a parede INTERNA de volta). Aqui ela vale como fatia a
 * partir de `box.max.z` em vez de a partir do z mais avançado por malha, o que é
 * a mesma coisa: a parede dianteira É a face de maior z do corpo branco.
 */
const LIVERY_SKIN_FRONT = 0.05;

/* ---------------- as CHAPAS da lateral: remonte e rebites ----------------
   A lateral não é uma chapa única de 14,7 m: é uma sequência de chapas
   verticais REMONTADAS — a da frente cobre a de trás por alguns centímetros, a
   borda da aba desenha uma linha vertical sutil, e uma coluna de rebites prende
   a emenda no rebaixo de cada friso. As fotos de referência (2026-08-11)
   mostram exatamente isso: o vinco em "S" da aba acompanhando o perfil e um
   rebite por rebaixo.

   O PASSO É 1 000 mm, MEDIDO — não os "cerca de 120 cm" do relato. O próprio
   bake diz onde as emendas ficam: os montantes internos da lateral
   (`metal-estrutura-principal-padrao`) estão em u 1033 + k·1000, e os PARES de
   rebite do trilho inferior repetem no mesmo passo (inventário 2026-08-11,
   `tools/livery-render/inv.mjs`). Emenda fora desse passo deixaria rebite sem
   montante por trás — o tipo de mentira que uma foto de perto denuncia.

   A grade é PRESA À FRENTE, como tudo neste baú (`mapZ` prende a testeira; o
   comprimento cresce para trás): a primeira emenda fica a um metro cheio da
   ponta dianteira da chapa e o resto marcha para trás de metro em metro.
   Esticar o baú acrescenta chapas na traseira — as existentes não andam.

   O REMONTE é geometria, não textura: as chapas de livery são recortadas a
   cada resize, então deslocar vértices aqui recalcula tudo de graça — e a
   `LiveryUV` (u = z, v = y) nem percebe o degrau em x, o que é exatamente o
   comportamento do vinil de verdade aplicado por cima de uma emenda. A arte
   corre contínua; a emenda aparece por SOMBREAMENTO, porque as normais da
   parede da borda são inclinadas junto com o degrau. */
const PLATE_PITCH = 1.0;
/**
 * Distância da ponta DIANTEIRA da chapa à PRIMEIRA emenda.
 *
 * ERA 620,2 mm — a cota do primeiro montante interno do bake, que punha cada
 * emenda em cima de um montante (eles correm a 620,2 + k·1000 mm da testeira).
 * O efeito colateral era a sequência MEDIDA em 2026-08-11:
 *
 *     620 | 1000 | 1000 | … | 1036        (frente → trás, baú de fábrica)
 *
 * ou seja uma chapa PARTIDA de 620 mm logo na testeira e as inteiras marchando
 * dali para trás. Foi o que o Kennedy reprovou com print: "estão começando as
 * inteiras na parte de trás, e a parte quebrada, caso tenha, fica na frente —
 * deveria ser o contrário". A fábrica assenta chapa inteira a partir da
 * testeira e corta a última; agora a grade faz isso, e a sobra cai na traseira.
 *
 * O PREÇO, anotado de propósito para quem vier depois: o passo da chapa é
 * IGUAL ao passo do montante, então deslocar a fase em 380 mm tira TODAS as
 * emendas de cima dos montantes de uma vez — a coluna de rebites da emenda
 * deixa de ter montante atrás dela. É uma troca deliberada a pedido de quem
 * fabrica o implemento, não uma medida que se perdeu.
 */
const PLATE_FROM_FRONT = PLATE_PITCH;
/** Altura do degrau do remonte. Não é a chapa nua (0,8 mm): a borda da aba
 *  leva a DOBRA (o hem), e é ela que a foto de referência mostra saltada —
 *  2,2 mm é o que faz o "S" da emenda aparecer a 3 m como aparece no baú. */
const PLATE_T = 0.0022;
/** Largura da aba que cobre a chapa de trás — ~30 mm MEDIDOS nas fotos de
 *  referência do usuário (2026-08-11), não os 45 estimados antes. */
const PLATE_LAP = 0.030;
/** Largura da parede da borda. É ela que desenha a linha vertical. */
const PLATE_DROP = 0.0018;
/** Sem emenda a menos disto de uma ponta do painel. */
const PLATE_END_CLEAR = 0.30;

/** As emendas de um painel, em z LOCAL, da grade presa à frente. */
function plateSeams(zFront: number, zRear: number): number[] {
  const out: number[] = [];
  for (let s = zFront - PLATE_FROM_FRONT; s > zRear + PLATE_END_CLEAR; s -= PLATE_PITCH) {
    if (s < zFront - PLATE_END_CLEAR) out.push(+s.toFixed(4));
  }
  return out;
}

/**
 * O perfil do remonte em um z: deslocamento para FORA e a inclinação dd/dz.
 *
 * REMONTAR É INCLINAR A CHAPA INTEIRA — correção de 2026-08-11, com print:
 * a primeira versão levantava só uma aba de 30 mm na borda, e isso lia como
 * um calombo correndo o baú ("essa elevação"). Na chapa real o pé dianteiro
 * assenta na estrutura e a borda traseira CAVALGA a chapa seguinte: a chapa
 * toda sobe linearmente de 0 a T ao longo do metro (0,13° — invisível como
 * inclinação) e devolve os 2,2 mm numa parede curta na emenda, que é a única
 * linha que o olho vê. Contínuo de propósito: salto abriria fresta na malha.
 */
function plateProfile(
  z: number, seams: number[], zFront: number,
): { d: number; slope: number } {
  /* A parede da borda, logo ATRÁS de cada emenda. */
  for (const s of seams) {
    if (z >= s - PLATE_DROP && z < s) {
      const f = (z - (s - PLATE_DROP)) / PLATE_DROP;
      return { d: PLATE_T * f, slope: PLATE_T / PLATE_DROP };
    }
  }
  /* O miolo da chapa: acha as bordas do painel dela e interpola. `seams` vem
     em ordem decrescente (da frente para trás). */
  let front = zFront;
  let rear = Number.NEGATIVE_INFINITY;
  for (const s of seams) {
    if (s > z) front = s;                  // a última emenda ainda à frente
    else { rear = s; break; }
  }
  const span = isFinite(rear) ? front - rear : PLATE_PITCH;
  const d = Math.min(PLATE_T, Math.max(0, PLATE_T * ((front - z) / Math.max(span, 0.2))));
  return { d, slope: 0 };
}

/**
 * Recorta a sopa de triângulos de um painel nos planos das emendas e aplica o
 * remonte: x anda `d(z)` para fora, e a normal inclina em z por `−dd/dz`.
 *
 * O recorte vem ANTES do deslocamento porque `d(z)` é linear POR TRECHO: com
 * vértice em cada quebra, deslocar vértices reproduz a função exatamente — sem
 * recorte, um triângulo de 3 m atravessando a emenda interpolaria o degrau ao
 * longo dele inteiro e a linha viraria um borrão de 3 m.
 */
function applyPlateLap(
  k: { p: number[]; n: number[]; u: number[] }, sgnOut: number, seams: number[],
  holes: { y0: number; y1: number; z0: number; z1: number }[] = [],
) {
  if (!seams.length) return;
  /* A FOLHA DA PORTA É UMA CHAPA SÓ — pedido de 2026-08-12: "tire também a
     emenda da porta, a folha da porta é uma folha única".
   *
   * Ela é o pedaço da própria pele que saiu do vão (ver `doorsOf()` em
   * trailer-geometry.ts), então migra para o painel de livery junto com a
   * parede e vinha levando o remonte inteiro — emenda e degrau atravessando a
   * folha. Numa porta real não há emenda: é uma chapa recortada.
   *
   * O teste é o VÃO, e ele basta: a parede foi cortada ali, então a única
   * geometria de pele dentro do retângulo do vão é a folha. E ela mora com
   * 94,4 mm de folga (`DOOR_REVEAL`) das bordas dele, então nenhum triângulo
   * fica meio dentro — não há descontinuidade para tratar, o marco é a quebra
   * física entre as duas chapas. */
  const inDoor = (y: number, z: number) =>
    holes.some((h) => z > h.z0 && z < h.z1 && y > h.y0 && y < h.y1);
  /* Só as duas quebras da parede de cada emenda: com a inclinação correndo a
     chapa INTEIRA, `d` é linear entre emendas e a interpolação dos vértices
     originais já a reproduz exata — não há mais aba nem rampa para recortar. */
  const cuts: number[] = [];
  for (const s of seams) cuts.push(s - PLATE_DROP, s);

  /* Limites da sopa: a frente é o datum da grade, e os envelopes zeram o
     remonte onde a chapa é PRESA — atrás da cantoneira (topo), atrás do
     trilho (pé) e sob o montante traseiro. Era a chapa "ultrapassando o frame
     metálico" do relato: 2,2 mm para fora exatamente onde um perfil de poucos
     milímetros deveria cobri-la. */
  let yLo = Infinity, yHi = -Infinity, zLo = Infinity, zHi = -Infinity;
  for (let i = 0; i < k.p.length; i += 3) {
    const y = k.p[i + 1], z = k.p[i + 2];
    if (y < yLo) yLo = y;
    if (y > yHi) yHi = y;
    if (z < zLo) zLo = z;
    if (z > zHi) zHi = z;
  }
  const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
  /* Rampas LONGAS (17-18 cm): o desvanecimento curto de 5 cm criava um vinco
     horizontal na borda do envelope (~130-180 mm do pe) que lia como "a linha
     continua" (print 2026-08-11). Espalhado, o gradiente e invisivel. */
  const envAt = (y: number, z: number) =>
    inDoor(y, z) ? 0
      : clamp01((y - yLo - 0.13) / 0.17)
        * clamp01((yHi - 0.21 - y) / 0.18)
        * clamp01((z - zLo) / 0.15);

  type V = [number, number, number, number, number, number, number, number]; // p3 n3 uv2
  const lerp = (a: V, b: V, t: number): V =>
    a.map((v, i) => v + (b[i] - v) * t) as V;

  /* Sutherland–Hodgman contra cada plano z = c, dos dois lados. Polígonos
     convexos continuam convexos; o leque no fim triangula. */
  const clip = (poly: V[], c: number, keepBelow: boolean): V[] => {
    const out: V[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const da = keepBelow ? c - a[2] : a[2] - c;
      const db = keepBelow ? c - b[2] : b[2] - c;
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) out.push(lerp(a, b, da / (da - db)));
    }
    return out;
  };

  cuts.sort((a, b) => a - b);
  const p2: number[] = [], n2: number[] = [], u2: number[] = [];
  const tris = k.p.length / 9;
  for (let t = 0; t < tris; t++) {
    let polys: V[][] = [[0, 1, 2].map((j) => [
      k.p[t * 9 + j * 3], k.p[t * 9 + j * 3 + 1], k.p[t * 9 + j * 3 + 2],
      k.n[t * 9 + j * 3], k.n[t * 9 + j * 3 + 1], k.n[t * 9 + j * 3 + 2],
      k.u[t * 6 + j * 2], k.u[t * 6 + j * 2 + 1],
    ] as V)];
    /* Só os planos que ATRAVESSAM este triângulo: quase toda a chapa mora no
       miolo de alguma placa e não cruza emenda nenhuma — cortá-la contra os
       ~56 planos das 14 emendas seria pagar o recorte inteiro para não mudar
       nada. */
    const zMin = Math.min(k.p[t * 9 + 2], k.p[t * 9 + 5], k.p[t * 9 + 8]);
    const zMax = Math.max(k.p[t * 9 + 2], k.p[t * 9 + 5], k.p[t * 9 + 8]);
    /* E a folha não é recortada nem em vértice: com `envAt` zerada ali o corte
       já não deixaria degrau nenhum, mas uma chapa única também não tem por que
       ganhar uma fileira de vértices no meio. */
    const yMin = Math.min(k.p[t * 9 + 1], k.p[t * 9 + 4], k.p[t * 9 + 7]);
    const yMax = Math.max(k.p[t * 9 + 1], k.p[t * 9 + 4], k.p[t * 9 + 7]);
    const whole = holes.some((h) => zMin >= h.z0 && zMax <= h.z1
      && yMin >= h.y0 && yMax <= h.y1);
    for (const c of whole ? [] : cuts) {
      if (c <= zMin || c >= zMax) continue;
      const next: V[][] = [];
      for (const poly of polys) {
        const lo = clip(poly, c, true);
        const hi = clip(poly, c, false);
        if (lo.length >= 3) next.push(lo);
        if (hi.length >= 3) next.push(hi);
      }
      polys = next;
    }
    for (const poly of polys) {
      /* O trecho do polígono decide a inclinação — avaliada no CENTROIDE,
         porque as bordas estão exatamente sobre as quebras. */
      const zc = poly.reduce((s, v) => s + v[2], 0) / poly.length;
      const yc = poly.reduce((s, v) => s + v[1], 0) / poly.length;
      const slope = plateProfile(zc, seams, zHi).slope * envAt(yc, zc);
      const disp = poly.map((v) => {
        const { d } = plateProfile(
          /* z do vértice, puxado 1 µm para o centroide: um vértice NA quebra
             pertence aos dois trechos, e é o do seu polígono que vale. */
          v[2] + Math.sign(zc - v[2]) * 1e-6, seams, zHi);
        const dv = d * envAt(v[1], v[2]);
        const nx = v[3], ny = v[4];
        let nz = v[5];
        if (slope > 0.05) {
          nz -= slope * Math.abs(nx);
          const l = Math.hypot(nx, ny, nz) || 1;
          return [v[0] + sgnOut * dv, v[1], v[2], nx / l, ny / l, nz / l, v[6], v[7]] as V;
        }
        return [v[0] + sgnOut * dv, v[1], v[2], nx, ny, nz, v[6], v[7]] as V;
      });
      for (let i = 1; i + 1 < disp.length; i++) {
        for (const v of [disp[0], disp[i], disp[i + 1]]) {
          p2.push(v[0], v[1], v[2]);
          n2.push(v[3], v[4], v[5]);
          u2.push(v[6], v[7]);
        }
      }
    }
  }
  k.p = p2; k.n = n2; k.u = u2;
}

/**
 * A coluna de rebites de cada emenda — um por REBAIXO de friso, como nas
 * fotos. Os rebaixos são MEDIDOS na própria sopa: histograma do x mais
 * externo por faixa de 2 mm de altura; rebaixo é onde a superfície recua mais
 * de 2,5 mm da crista. Nada de perfil teórico: é a chapa que acabou de ser
 * recortada que diz onde ela é funda.
 */
/**
 * Mede as fileiras de rebite na sopa AINDA SEM REMONTE — a ordem importa: a
 * inclinacao da chapa mexe em x ate 2,2 mm, da grandeza do proprio relevo do
 * friso, e medir depois dela contamina a regua de profundidade (a rodada que
 * mediu numa janela estreita pos-remonte achou ZERO fileiras: a pele extrudada
 * quase nao tem vertice fora dos planos de corte).
 *
 * Com a sopa intacta, a amostra e o painel INTEIRO: o x mais externo por faixa
 * de 2 mm de altura e denso e limpo. As alturas saem da regua publica do rig
 * (`floorY + skirtHeight + k*pitch`), e o CENTRO de cada rebaixo e medido
 * rebaixo a rebaixo — um `valeH` unico deixava rebite encostado na borda da
 * parte lisa ("ainda nao estao perfeitamente nos centros", com print).
 */
function measureValeRows(
  k: { p: number[]; n: number[] }, sgnOut: number,
): { rows: { y: number; d: number }[]; yMin: number; yMax: number } {
  const BIN = 0.002;
  const outer = new Map<number, number>();
  let yMin = Infinity, yMax = -Infinity;
  for (let i = 0; i < k.p.length; i += 3) {
    const x = k.p[i], y = k.p[i + 1];
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
    /* SO a pele que olha para o LADO: nas pontas o painel enrola para o
       montante e essa curva, vista por altura, poe x de CRISTA em todo
       rebaixo — foi o que derrubou 45 fileiras para 7. O wrap olha para ±z;
       o friso olha para ±x. */
    if (Math.abs(k.n[i]) < 0.7) continue;
    const bin = Math.round(y / BIN);
    const d = sgnOut * x;
    if (!(d <= (outer.get(bin) ?? -Infinity))) outer.set(bin, d);
  }
  const rows: { y: number; d: number }[] = [];
  if (!outer.size) return { rows, yMin, yMax };
  const crest = Math.max(...outer.values());


  /* FORMULA FECHADA, sem deteccao — o fim de uma saga medida em quatro
     rodadas (2026-08-11): a sopa PRE-remonte e ESPARSA (391 bins em 1390;
     vertice so nas quebras de perfil — o bin do centro da lisa NEM EXISTE),
     entao qualquer detector de contiguidade ou de plano oscila entre pares,
     buracos e zero. Os quatro numeros necessarios ja foram MEDIDOS
     (checks-perfil.mjs): a lisa de ~27 mm fica centrada a `RIB_FLAT_CENTER` de
     cada passo da grade do rig, no plano crista − 5,3 mm. O rebuild ladrilha a
     MESMA unidade, entao a fase vale em qualquer altura. A constante mora em
     `trailer-geometry.ts` porque a ferragem da porta traseira assenta na MESMA
     regua (`trailer-bake-fixes.ts`) — e um segundo numero por perto foi
     exatamente o que pos aquela peca em cima da crista. */
  const prof = state.trailerRig?.profile ?? null;
  if (prof && prof.ribCount) {
    const row0 = prof.floorY + prof.skirtHeight;
    const dFlat = crest - 0.0053;
    /* n = −1 INCLUSO (prints do usuário, 2026-08-11): o último friso de baixo
       da chapa — o rebaixo ANTERIOR a row0, centro a row0 − 6,7 mm ≈ +168 mm
       do pé, logo acima do trilho — ficava sem rebite porque o laço nascia em
       n = 0. O guarda de yMin + 0,14 continua filtrando o que cair no trilho
       (n = −2 daria +115 mm). */
    for (let n = -1; ; n++) {
      const y = row0 + RIB_FLAT_CENTER + n * prof.pitch;
      if (y > yMax - 0.20) break;
      if (y < yMin + 0.14) continue;
      rows.push({ y, d: dFlat });
    }
  }
  return { rows, yMin, yMax };
}

/**
 * Faixa em z que uma PORTA proíbe à coluna de rebites da emenda.
 *
 * PEDIDO DO KENNEDY, 2026-08-12, com print: "a porta não deve ter rebites, e
 * quando uma fileira de rebite for pegar no frame metálico da porta, não deve
 * ser gerada".
 *
 * As duas frases viram UMA regra, e é uma regra só de Z: todo rebite de uma
 * coluna divide o z da emenda que o gerou (`oz = sSeam + 12 mm`), então ou a
 * coluna inteira cai sobre a porta ou nenhum rebite dela encosta nela. Não há
 * caso intermediário para tratar — e uma coluna que atravessasse a folha,
 * cortada só no trecho do vão, deixaria dois cotocos de rebite colados no
 * marco, que é justamente o que o print reprova.
 *
 * A faixa é o VÃO (`hole`, que já inclui o recuo do marco) mais a moldura
 * galvanizada (`TRIM_WIDTH`) e o raio da calota, para que nem a borda da
 * cabeça toque o arremate.
 */
const RIVET_DOME_R = 0.009;
function seamHitsDoor(z: number, holes: { z0: number; z1: number }[]): boolean {
  const pad = TRIM_WIDTH + RIVET_DOME_R;
  return holes.some((h) => z >= h.z0 - pad && z <= h.z1 + pad);
}

function addPlateRivets(
  _trailer: THREE.Object3D, panel: THREE.Mesh,
  vales: { rows: { y: number; d: number }[]; yMin: number; yMax: number },
  sgnOut: number, seams: number[], holes: { z0: number; z1: number }[] = [],
): { y: number; d: number }[] {
  const { rows, yMin, yMax } = vales;
  /* A emenda continua desenhada onde a porta está — é chapa, e a chapa passa
     por trás do marco. O que some é só a COLUNA DE REBITES. */
  const live = seams.filter((s) => !seamHitsDoor(s + 0.012, holes));
  if (!live.length || !rows.length) return [];

  /* A cabeça: calota de 17 mm, achatada, apontada para fora. O material é o
     `inox-ferragem` do próprio bake — o rebite tem de envelhecer junto com a
     ferragem, não com a tinta. */
  /* MATERIAL PROPRIO, NUNCA CLONE DO BAKE — licao de 2026-08-11: os clones
     de `inox-ferragem`/galvanizado carregam junto os ganchos de shader que o
     acabamento/tinta pendura nos materiais do bake, e um gancho cujo uniform
     ninguem vincula compila no renderer da bancada e falha no do app — 644
     rebites presentes na cena do Kennedy e nenhum no quadro. Um material
     autocontido nao tem essa classe de defeito. */
  const mat = new THREE.MeshStandardMaterial({
    color: 0xd7dadd, metalness: 0.85, roughness: 0.3,
  });
  mat.name = 'livery-rebite';

  /* A CABECA PASSA DA CRISTA — medido na sessao do Kennedy (2026-08-11): com
     calota de 3,4 mm o apex ficava vale + 6,2 mm, 1 mm ABAIXO do plano das
     cristas (relevo 5,2 mm) — visivel de frente (a bancada fotografa
     ortogonal) e ENGOLIDO pelas cristas em qualquer vista obliqua, que e como
     o estudio e usado. Calota de ~5 mm poe o apex ~2,5 mm acima da crista,
     como nas fotos de referencia. */
  const dome = new THREE.SphereGeometry(0.009, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.rotateZ(sgnOut > 0 ? -Math.PI / 2 : Math.PI / 2);
  dome.scale(0.58, 1, 1);

  /* GEOMETRIA FUNDIDA, nao InstancedMesh — decisao de 2026-08-11, com prova:
     na sessao do Kennedy (Firefox, RX 570) as 644 instancias existiam na cena
     (contadas pelo console) e NENHUMA chegava ao quadro, com warning de
     `drawElementsInstanced` no console. 644 calotas x ~60 tris ~= 40 k
     triangulos — nada numa cena de 5,4 M — e a malha unica tem caixa real,
     culling correto e zero caminho especial de driver. */
  const bPos = dome.getAttribute('position') as THREE.BufferAttribute;
  const bNor = dome.getAttribute('normal') as THREE.BufferAttribute;
  const bIdx = dome.getIndex() as THREE.BufferAttribute;
  const vc = bPos.count, ic = bIdx.count;
  const total = live.length * rows.length;
  const P = new Float32Array(vc * 3 * total);
  const Nn = new Float32Array(vc * 3 * total);
  const I = new (vc * total > 65535 ? Uint32Array : Uint16Array)(ic * total);
  const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
  let n = 0;
  for (const sSeam of live) {
    for (const r of rows) {
      /* Sobre a borda que cavalga, 12 mm a frente da emenda; a cabeca assenta
         no fundo do rebaixo mais a inclinacao local da chapa (os envelopes
         zeram o remonte perto do trilho e da cantoneira). */
      const env = clamp01((r.y - yMin - 0.13) / 0.05)
        * clamp01((yMax - 0.21 - r.y) / 0.06);
      const ox = sgnOut * (r.d + PLATE_T * env + 0.0006);
      const oy = r.y;
      const oz = sSeam + 0.012;
      for (let v = 0; v < vc; v++) {
        const o3 = (n * vc + v) * 3;
        P[o3] = bPos.getX(v) + ox;
        P[o3 + 1] = bPos.getY(v) + oy;
        P[o3 + 2] = bPos.getZ(v) + oz;
        Nn[o3] = bNor.getX(v);
        Nn[o3 + 1] = bNor.getY(v);
        Nn[o3 + 2] = bNor.getZ(v);
      }
      for (let i = 0; i < ic; i++) I[n * ic + i] = bIdx.getX(i) + n * vc;
      n++;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
  geo.setIndex(new THREE.BufferAttribute(I, 1));
  /* A LIVERYUV DA CHAPA, ESTENDIDA ÀS CALOTAS — pedido de 2026-08-12: "as
     logos aplicadas na lateral também devem ser aplicadas nos rebites, não
     apenas nas chapas". É o que um adesivo faz: ele é aplicado por cima da
     emenda e das cabeças, e a arte continua por elas sem quebra.
   *
   * A normalização é a da CHAPA, nunca a da própria calota — `addLiveryUV()`
   * normaliza pela caixa da geometria que recebe, e uma calota tem 18 mm: a
   * arte inteira caberia dentro de cada rebite. Por isso a caixa vem do painel,
   * e o resto é a MESMA fórmula (u cresce com +z só na esquerda, v conta do
   * teto). Se `addLiveryUV()` mudar, isto muda junto.
   *
   * As posições já estão no espaço do painel — `panel.add(inst)` sem
   * deslocamento —, então não há conversão nenhuma pelo caminho. */
  const pg = panel.geometry as THREE.BufferGeometry;
  pg.computeBoundingBox();
  const pb = pg.boundingBox;
  if (pb) {
    const spanZ = Math.max(1e-6, pb.max.z - pb.min.z);
    const spanY = Math.max(1e-6, pb.max.y - pb.min.y);
    const left = sgnOut < 0;
    const uv = new Float32Array(vc * total * 2);
    for (let i = 0; i < vc * total; i++) {
      const y = P[i * 3 + 1], z = P[i * 3 + 2];
      uv[i * 2] = left ? (z - pb.min.z) / spanZ : (pb.max.z - z) / spanZ;
      uv[i * 2 + 1] = (pb.max.y - y) / spanY;
    }
    geo.setAttribute('uv1', new THREE.BufferAttribute(uv, 2));
  }
  const inst = new THREE.Mesh(geo, mat);
  inst.name = panel.name + '_RIVETS';
  inst.userData.rivets = total;
  inst.castShadow = true;
  panel.add(inst);
  return rows;
}

/* A SOLEIRA (LIVERY_SILL_[LR]) FOI APOSENTADA — diff bake-cru × runtime,
 * 2026-08-11. O trailer.glb de PRODUÇÃO é IDÊNTICO ao local (sha256
 * 59c890bd…07e0), então a base "perfeita" do print do usuário é o próprio
 * bake — e a sonda crua (scratchpad prod-compare/baseprobe.ts, par de
 * tools/studio-bench/checks-base-corner-diff.mjs) mediu que abaixo do pé do
 * trilho (−102 rel. piso) o bake NÃO TEM geometria nenhuma até o chassi a
 * ~821 mm: o vão aberto É o visual de produção (lê como sombra do chassi).
 * Trilho (−102..+107), fita 3M (−71..−22) e pele (pé −20, visível de +108)
 * do runtime registram 1:1 com o cru; a soleira era a ÚNICA divergência.
 *
 * Na vista baixa do canto traseiro (print 2, o "buraco preto no canto"), o
 * fan oblíquo (ψ25/45°, subindo 15/30 %) morria numa PLACA CHAPADA a 30 mm
 * onde o bake mostra o chassi modulado a 130..620 mm e a lanterna lateral
 * (@5..20, z +150..250 do fim) — o buraco era o CONTRASTE entre a placa e a
 * janela final descoberta (inset de 72,8 mm até o marco, medido pelo agente
 * do canto: o trilho termina 72,8 mm antes da traseira e 42,2 mm antes da
 * frente). SEM a soleira, fatias horizontais e fan ficam IDÊNTICOS ao bake,
 * banda a banda. Se uma "risca preta" voltar a incomodar, MEDIR primeiro:
 * o slot aberto é o estado aprovado de produção — a resposta não é uma placa
 * nova (histórico completo deste bloco no git; o hem de 14 mm caiu pelo
 * mesmo motivo, ver checks-base-align 2026-08-11). O regex de limpeza do
 * rebuild mantém LIVERY_SILL_[LR] de propósito, para matar soleiras de
 * builds anteriores vivas na mesma sessão. */

/** A grade corrente, para o editor 2D desenhar as MESMAS emendas e rebites —
 *  ver `livery-structure.ts`. Distâncias em metros; `seamsFromFront` medido da
 *  ponta dianteira do painel, `rivetRowsFromBottom` do pé da chapa. */
export interface PlateGrid {
  pitch: number;
  lap: number;
  seamsFromFront: number[];
  rivetRowsFromBottom: number[];
}
let plateGrid: PlateGrid | null = null;
export const getPlateGrid = (): PlateGrid | null => plateGrid;

/** The exporter's layout, vertex for vertex — see exportTrailer.js addLiveryUV.
 *  v runs DOWNWARDS because the CanvasTexture is built with flipY = false; u runs
 *  the way each panel reads from outside, which is mirrored between the flanks.
 *  Get either backwards and the artwork is a legible mirror image. */
/** As chapas de arte, pelos nomes de malha que o resto do engine casa.
 *
 *  `ROOF` NÃO É RECORTADO — e é a única da lista que não é. O teto já tem malha
 *  própria desde que `TrailerBody.rebuild()` passou a escrevê-lo num buffer
 *  separado (`TRAILER_ROOF`, ver vehicle/trim.ts), justamente para poder trocar
 *  de material sozinho. Recortá-lo do corpo de novo não acharia nada: os
 *  triângulos já saíram de lá. O que ele precisa para virar livery é só `uv1`, e
 *  é o que `tagRoofLiveryUV()` faz. */
export type LiveryPanelName = 'SIDE_L' | 'SIDE_R' | 'REAR' | 'FRONT' | 'ROOF';
const LIVERY_PANEL_NAMES: LiveryPanelName[] = ['SIDE_L', 'SIDE_R', 'REAR', 'FRONT'];
/** `^(SIDE_L|SIDE_R|REAR|FRONT)$` — uma fonte só para os cinco lugares que o
 *  testam. Nova a cada uso porque um literal com `g` guardaria `lastIndex`. */
const panelNameRe = () => /^(SIDE_L|SIDE_R|REAR|FRONT)$/;

function addLiveryUV(geo: THREE.BufferGeometry, key: LiveryPanelName) {
  geo.computeBoundingBox();
  const b = geo.boundingBox as THREE.Box3;
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const spanX = Math.max(1e-6, b.max.x - b.min.x);
  const spanY = Math.max(1e-6, b.max.y - b.min.y);
  const spanZ = Math.max(1e-6, b.max.z - b.min.z);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    /* A TESTEIRA CORRE AO CONTRÁRIO DA TRASEIRA, e é o mesmo motivo que faz as
       duas laterais correrem em sentidos opostos: `u` cresce no sentido em que
       a face é LIDA DE FORA. Quem olha a traseira está atrás do baú e vê o +X à
       esquerda dele; quem olha a testeira está na frente e vê o +X à direita.
       Igualar as duas sairia com o desenho da frente espelhado no baú, e o
       espelho de um texto é o defeito que ninguém percebe no editor. */
    /* O TETO É A ÚNICA FACE HORIZONTAL, e as duas coordenadas dele saem do
       plano XZ — `y` não entra em nada.
       ---------------------------------------------------------------------
       O quadro é o de quem olha o baú DE CIMA, com a traseira à esquerda e a
       dianteira à direita, que é o mesmo sentido da SIDE_L.

       ⚠️ ESTA LINHA DIZIA "a lateral do MOTORISTA (SIDE_L)", E ESTAVA ERRADA.
       A SIDE_L sai do MENOR x; com a frente no +Z, o lado esquerdo do veículo é
       o +X, ou seja a SIDE_R. Logo a SIDE_L é o lado do PASSAGEIRO, e o teto
       compartilha o sentido de leitura DELE, não o do motorista. O erro não
       estava na geometria — o `u` do teto continua o mesmo — mas o comentário
       era a origem documental do rótulo trocado que o dono do produto relatou
       (ver `SIDE_LABEL` em vehicle/livery.ts).
       Se um dia o teto tiver de acompanhar o motorista, o que muda é este `u`
       para `(b.max.z − z)/spanZ` — e isso INVERTE a arte de teto já salva, então
       é decisão de produto, não arrumação. Fixada a leitura, `v` está determinado e não é escolha: com a
       lente apontando para −Y e o +Z indo para a direita da tela, o para-cima
       da tela é o +X (regra da mão direita). Como `v` cresce para BAIXO — a
       CanvasTexture é construída com flipY = false —, ele tem de correr de
       `max.x` para `min.x`. Trocar o sinal aqui espelha o desenho no teto, e o
       espelho de um texto visto de cima é o defeito que só aparece na foto
       aérea, depois de a película estar aplicada. */
    if (key === 'ROOF') {
      uv[i * 2] = (z - b.min.z) / spanZ;
      uv[i * 2 + 1] = (b.max.x - x) / spanX;
      continue;
    }
    uv[i * 2] = key === 'SIDE_L' ? (z - b.min.z) / spanZ
      : key === 'SIDE_R' ? (b.max.z - z) / spanZ
        : key === 'FRONT' ? (x - b.min.x) / spanX
          : (b.max.x - x) / spanX;
    uv[i * 2 + 1] = (b.max.y - y) / spanY;
  }
  geo.setAttribute('uv1', new THREE.BufferAttribute(uv, 2));
}

/**
 * Dá `uv1` ao TETO, para ele poder receber arte como as outras quatro faces.
 *
 * Ele não passa por `buildLiveryPanels()` — não há o que recortar, a malha já
 * existe (ver `LiveryPanelName`). O que ele precisa é da mesma normalização de
 * 0 a 1 sobre a caixa dele, e de que ela seja REFEITA a cada reconstrução: o
 * corpo paramétrico reescreve a geometria do teto a cada mudança de medida, e
 * um `uv1` da medida anterior mapearia a arte sobre um retângulo que não existe
 * mais — o logotipo escorregaria para fora do baú a cada centímetro digitado.
 *
 * Idempotente e barato: um `Float32Array` do tamanho do teto, uma vez por
 * recorte, no mesmo passo em que as outras quatro chapas são recortadas.
 */
export function tagRoofLiveryUV(trailer: THREE.Object3D) {
  trailer.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || o.name !== TRAILER_ROOF_MESH) return;
    const g = o.geometry as THREE.BufferGeometry;
    if (!g?.attributes?.position?.count) return;
    addLiveryUV(g, 'ROOF');
  });
}

function buildLiveryPanels(trailer: THREE.Object3D) {
  let already = false;
  trailer.traverse((node) => {
    const o = node as THREE.Mesh;
    if (o.isMesh && panelNameRe().test(o.name)) already = true;
  });
  /* Bake fundido traz as chapas prontas — e SEM grade de emendas, então quem
     leu a grade do implemento anterior não pode continuar acreditando nela. */
  if (already) { plateGrid = null; return; }

  const sources: THREE.Mesh[] = [];
  trailer.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    /* `visible` FILTRA, e é o que faz o recorte sair do corpo PARAMÉTRICO.
       `TrailerBody` não apaga as malhas brancas originais — ele as esconde. Se
       elas entrassem aqui, o passo 1 mediria a caixa do baú de fábrica (é ela
       que fica mais larga em Z quando o baú encurta, e mais baixa quando ele
       sobe), os limiares de 40 mm cairiam no lugar errado e os painéis sairiam
       recortados de uma geometria que ninguém vê. */
    if (!o.visible) return;
    /* PELO MATERIAL DE FÁBRICA. Com "pintar o implemento" ligado o corpo está
       com `carpaint`, e casar pelo material CORRENTE não achava nada: cada
       recorte destruía as chapas e não recriava nenhuma. Ver
       `factoryMaterials()`, que é onde a medição do defeito está. */
    if (isBodyMesh(o)) sources.push(o);
  });
  if (!sources.length) {
    console.warn('[livery] nenhuma malha do corpo branco — o editor de arte não terá onde pintar.');
    return;
  }

  trailer.updateWorldMatrix(true, true);
  const toLocal = trailer.matrixWorld.clone().invert();
  const prepared = sources.map((m) => {
    const mat = toLocal.clone().multiply(m.matrixWorld);
    return { mesh: m, mat, nrm: new THREE.Matrix3().getNormalMatrix(mat) };
  });

  /* Pass 1 — the body's own extents, read from the POSITION ATTRIBUTE. A bounding
     box here would be the rotated-box-of-a-box again, and these thresholds are
     40 mm wide. */
  const v = new THREE.Vector3();
  const box = new THREE.Box3();
  for (const p of prepared) {
    const pos = p.mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(p.mat));
  }

  const keep: Record<LiveryPanelName, { p: number[]; n: number[]; u: number[] }> = {
    SIDE_L: { p: [], n: [], u: [] }, SIDE_R: { p: [], n: [], u: [] },
    REAR: { p: [], n: [], u: [] }, FRONT: { p: [], n: [], u: [] },
    /* Declarado e NUNCA preenchido: o laço abaixo só escreve nas quatro chaves
       que ele classifica, e `LIVERY_PANEL_NAMES` (que é quem cria as malhas)
       não tem ROOF. O teto não é recortado — ver `tagRoofLiveryUV()`. */
    ROOF: { p: [], n: [], u: [] },
  };
  const a = new THREE.Vector3(), b2 = new THREE.Vector3(), c = new THREE.Vector3();
  const na = new THREE.Vector3(), nb = new THREE.Vector3(), nc = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3();

  /* One entry per source mesh that lost triangles: the ordinals to drop. */
  const removals = new Map<THREE.Mesh, Set<number>>();
  /* How many meshes reference each geometry — a shared one must be cloned before
     its index is rewritten, or a sibling loses triangles it still needs. */
  const geomUsers = new Map<THREE.BufferGeometry, number>();
  for (const p of prepared) {
    geomUsers.set(p.mesh.geometry, (geomUsers.get(p.mesh.geometry) || 0) + 1);
  }

  for (const p of prepared) {
    const g = p.mesh.geometry;
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    if (!nor) continue;
    /* uv0 comes ALONG, per vertex. The panel wears the body's own material, whose
       roughnessMap and metalnessMap read uv0 — the first version wrote zeros here
       and the whole panel then sampled a single texel while the body around it
       sampled the real maps. That seam is a band of slightly different finish
       along the flank, and it vanished the moment the implement was painted,
       because car paint has no such maps. Kennedy reported exactly that: wrong in
       white, right in colour. */
    const uvs = g.attributes.uv;
    const idx = g.index ? g.index.array : null;
    const tri = Math.floor((idx ? idx.length : pos.count) / 3);
    for (let t = 0; t < tri; t++) {
      const i0 = idx ? idx[t * 3] : t * 3, i1 = idx ? idx[t * 3 + 1] : t * 3 + 1, i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
      a.fromBufferAttribute(pos, i0).applyMatrix4(p.mat);
      b2.fromBufferAttribute(pos, i1).applyMatrix4(p.mat);
      c.fromBufferAttribute(pos, i2).applyMatrix4(p.mat);
      let where: LiveryPanelName | null = null;
      const minX = Math.min(a.x, b2.x, c.x);
      const maxX = Math.max(a.x, b2.x, c.x);
      /* SÓ O SLAB, e a hipótese descartada fica registrada: suspeitou-se que
         as três tiras corridas a 1083/1868/2673 mm (mapprobe, seção F) eram
         DOBRAS da pele excluídas por mergulharem além dos 40 mm — e que a
         fronteira era a "linha horizontal" do relato. MEDIDO no app
         (checks-livery.mjs, footprint 2026-08-11): as tiras têm x constante a
         66 mm da crista — são FITAS DE RECOBRIMENTO das emendas de curso,
         atrás de uma pele que o corpo paramétrico reconstrói CONTÍNUA. Não
         tocam a crista, nenhum critério de "encostar" as pega, e não devem
         mesmo entrar: ficam invisíveis atrás da chapa. Um critério extra aqui
         seria um no-op hoje e um risco de capturar returns de porta amanhã. */
      if (minX >= box.max.x - LIVERY_SKIN_SIDE) where = 'SIDE_R';
      else if (maxX <= box.min.x + LIVERY_SKIN_SIDE) where = 'SIDE_L';
      if (!where && Math.max(a.z, b2.z, c.z) <= box.min.z + LIVERY_SKIN_REAR) {
        e1.subVectors(b2, a); e2.subVectors(c, a);
        fn.crossVectors(e1, e2).normalize();
        /* abs(): ~0.2 % of these ripped triangles are wound backwards, so the
           sign of the face normal proves nothing about which way it faces. */
        if (Math.abs(fn.z) >= 0.7) where = 'REAR';
      }
      /* A TESTEIRA, pela mesma regra da traseira invertida: fatia rente à face
         de MAIOR z e o mesmo teste de normal. O teste de normal não é opcional
         aqui — a testeira leva os montantes de canto e o retorno das laterais
         dentro da fatia, e eles olham para o lado. Sem ele a chapa da frente
         sairia com as duas quinas dobradas para dentro dela.
         O TETO passa longe deste teste: ele atravessa o baú inteiro em z, então
         o `minZ` dele nunca alcança a fatia; e a normal dele é +Y. */
      if (!where && Math.min(a.z, b2.z, c.z) >= box.max.z - LIVERY_SKIN_FRONT) {
        e1.subVectors(b2, a); e2.subVectors(c, a);
        fn.crossVectors(e1, e2).normalize();
        if (Math.abs(fn.z) >= 0.7) where = 'FRONT';
      }
      if (!where) continue;
      na.fromBufferAttribute(nor, i0).applyMatrix3(p.nrm).normalize();
      nb.fromBufferAttribute(nor, i1).applyMatrix3(p.nrm).normalize();
      nc.fromBufferAttribute(nor, i2).applyMatrix3(p.nrm).normalize();
      const k = keep[where];
      k.p.push(a.x, a.y, a.z, b2.x, b2.y, b2.z, c.x, c.y, c.z);
      k.n.push(na.x, na.y, na.z, nb.x, nb.y, nb.z, nc.x, nc.y, nc.z);
      if (uvs) {
        k.u.push(uvs.getX(i0), uvs.getY(i0), uvs.getX(i1), uvs.getY(i1), uvs.getX(i2), uvs.getY(i2));
      } else {
        k.u.push(0, 0, 0, 0, 0, 0);
      }
      let rm = removals.get(p.mesh);
      if (!rm) { rm = new Set(); removals.set(p.mesh, rm); }
      rm.add(t);
    }
  }

  /* Take the moved triangles OUT of the meshes they came from. Index-only
     surgery: the vertices stay where they are (unreferenced ones cost a little
     memory and nothing else), so nothing else that reads these geometries is
     disturbed. */
  let strippedMeshes = 0, strippedTris = 0;
  for (const [mesh, drop] of removals) {
    const g0 = mesh.geometry;
    const src = g0.index ? g0.index.array : null;
    const total = Math.floor((src ? src.length : g0.attributes.position.count) / 3);
    const keepIdx: number[] = [];
    for (let t = 0; t < total; t++) {
      if (drop.has(t)) continue;
      keepIdx.push(
        src ? src[t * 3] : t * 3,
        src ? src[t * 3 + 1] : t * 3 + 1,
        src ? src[t * 3 + 2] : t * 3 + 2,
      );
    }
    const g = (geomUsers.get(g0) || 1) > 1 ? g0.clone() : g0;
    if (g !== g0) mesh.geometry = g;
    const Arr = g.attributes.position.count > 65535 ? Uint32Array : Uint16Array;
    g.setIndex(new THREE.BufferAttribute(new Arr(keepIdx), 1));
    g.clearGroups();
    strippedMeshes++;
    strippedTris += drop.size;
  }

  /* AS EMENDAS DE CHAPA, antes de a sopa virar geometria — ver o bloco
     "as CHAPAS da lateral" acima. A grade é presa à FRENTE do painel, então é
     medida na própria sopa de cada lado; a traseira não tem emenda (as folhas
     das portas são chapas inteiras). */
  const seamsOf: Partial<Record<'SIDE_L' | 'SIDE_R', number[]>> = {};
  const valesOf: Partial<Record<'SIDE_L' | 'SIDE_R',
    { rows: { y: number; d: number }[]; yMin: number; yMax: number }>> = {};
  /* OS VÃOS DE PORTA, UMA VEZ SÓ. Duas coisas os consultam — o remonte (a
     folha é chapa única) e a coluna de rebites (nem na folha nem no marco) —,
     e as duas têm de ver o MESMO retângulo. Vêm do `TrailerBody`, que é quem os
     abriu: recalculá-los aqui seria uma segunda verdade sobre onde a porta
     está, e ela divergiria no primeiro clamp de comprimento. */
  const holesOf = (key: 'SIDE_L' | 'SIDE_R') =>
    state.trailerRig?.body.getDoorHoles(key === 'SIDE_R' ? 'right' : 'left') ?? [];
  let gridFront = 0;
  for (const key of ['SIDE_L', 'SIDE_R'] as const) {
    const k = keep[key];
    if (!k.p.length) continue;
    let zLo = Infinity, zHi = -Infinity;
    for (let i = 2; i < k.p.length; i += 3) {
      if (k.p[i] < zLo) zLo = k.p[i];
      if (k.p[i] > zHi) zHi = k.p[i];
    }
    const seams = plateSeams(zHi, zLo);
    seamsOf[key] = seams;
    /* As fileiras de rebite saem da sopa INTACTA — ver measureValeRows(). */
    valesOf[key] = measureValeRows(k, key === 'SIDE_R' ? 1 : -1);
    applyPlateLap(k, key === 'SIDE_R' ? 1 : -1, seams, holesOf(key));
    if (key === 'SIDE_L') gridFront = zHi;
  }

  const srcMat = (Array.isArray(sources[0].material) ? sources[0].material[0] : sources[0].material) as THREE.MeshStandardMaterial;
  const report: string[] = [];
  plateGrid = null;
  for (const key of LIVERY_PANEL_NAMES) {
    const k = keep[key];
    if (!k.p.length) { report.push(`${key}: VAZIO`); continue; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(k.p), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(k.n), 3));
    /* The SOURCE uv0, carried through — see the note where it is collected. */
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(k.u), 2));
    addLiveryUV(geo, key);
    /* No polygonOffset, and that is the point: these triangles no longer exist
       anywhere else, so there is nothing to win a depth test against. A bias here
       would only pull the panel over the RAIL that runs along its bottom edge. */
    const mat = srcMat.clone();
    mat.name = srcMat.name;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = key;
    mesh.castShadow = true;                    // it IS the skin now, not an overlay
    mesh.receiveShadow = true;
    trailer.add(mesh);
    /* Os rebites da emenda, um por rebaixo — e a grade publicada para o editor
       2D desenhar as MESMAS emendas nas MESMAS alturas. Só as LATERAIS têm
       emenda de curso: traseira e testeira são chapa inteira. */
    if (key === 'SIDE_L' || key === 'SIDE_R') {
      const seams = seamsOf[key] ?? [];
      const sgn = key === 'SIDE_R' ? 1 : -1;
      const rows = addPlateRivets(trailer, mesh,
        valesOf[key] ?? { rows: [], yMin: 0, yMax: 0 }, sgn, seams, holesOf(key));
      if (key === 'SIDE_L' && seams.length) {
        let yLo = Infinity;
        for (let i = 1; i < k.p.length; i += 3) if (k.p[i] < yLo) yLo = k.p[i];
        plateGrid = {
          pitch: PLATE_PITCH, lap: PLATE_LAP,
          seamsFromFront: seams.map((s) => +(gridFront - s).toFixed(4)),
          rivetRowsFromBottom: rows.map((r) => +(r.y - yLo).toFixed(4)),
        };
      }
    }
    report.push(`${key}: ${k.p.length / 9} tris`);
  }
  console.info('[livery] chapas recortadas do corpo —', report.join(' · '),
    `· ${strippedTris} triângulos removidos de ${strippedMeshes} malhas de origem`,
    plateGrid ? `· ${plateGrid.seamsFromFront.length + 1} chapas de ${PLATE_PITCH} m` : '');
}

/* ---------------- baú paramétrico ----------------
   O núcleo mora em ./trailer-geometry.ts (o BRANCO) e ./trailer-assembly.ts (o
   resto do baú), costurados por ./trailer-rig.ts. Aqui fica só o que é do ciclo
   de vida do implemento: quando construir, e o que precisa ser REFEITO depois de
   cada mudança de medida.

   O QUE UM RESIZE INVALIDA, e por quê:

   1. AS TRÊS CHAPAS DE LIVERY. buildLiveryPanels() não é um filtro sobre a
      geometria viva: ele COPIA triângulos para malhas novas e os REMOVE das de
      origem. Essas cópias guardam posições de vértice, então no instante em que
      o corpo muda de altura ou de comprimento elas viram um fantasma do baú
      antigo — e a LiveryUV delas foi normalizada pelos limites antigos, então a
      arte também sairia fora de escala. Não há como corrigi-las no lugar; a
      única resposta honesta é jogá-las fora e recortar de novo.

   2. O ÍNDICE DA MALHA BRANCA. A remoção do item 1 é feita reescrevendo o índice
      da geometria de origem. `TrailerBody.rebuild()` troca os ATRIBUTOS e não
      mexe no índice — então um índice sobrevivente apontaria para ordinais de
      uma malha que não existe mais (contagem de vértices diferente a cada
      número de frisos). Por isso ele é zerado ANTES do rebuild, e não depois.

   3. A PAREDE DIANTEIRA PINTADA. buildFrontWallOverlay() extrai a pele da
      parede e desenha uma cópia coincidente por cima. Coincidente com a parede
      ANTIGA, quando a altura muda.

   4. A CAIXA DO BAÚ — `trailerBox` e `trailerBase.frontZ`. placeTrailer() põe o
      pino-rei sobre a quinta roda medindo a partir da parede dianteira. O
      comprimento cresce PARA TRÁS de propósito (ver `mapZ` em
      trailer-geometry.ts), mas a testeira ainda avança alguns milímetros com o
      esticamento em Z das peças que atravessam o vão, e o engate tem de saber.

   O que NÃO é refeito, e é decisão: `trailerPivotFromFront` não é remedido a
   partir dos pneus. A rodagem não se mexe — só a parede de referência anda — e
   um novo `runningTyres()` custaria uma varredura de todos os vértices dos doze
   pneus para chegar ao mesmo número que a subtração dá de graça. */

/** Ouvintes do "os painéis foram recortados de novo". Existe porque
 *  vehicle/livery.ts importa ESTE módulo: a dependência inversa fecharia um
 *  ciclo, então quem quiser reagir se inscreve. studio.ts é o único assinante,
 *  e reata as sobreposições de arte nas chapas novas. */
type PanelListener = (trailer: THREE.Object3D) => void;
const panelListeners: PanelListener[] = [];
export function onTrailerPanelsRebuilt(cb: PanelListener) {
  panelListeners.push(cb);
  return () => { const i = panelListeners.indexOf(cb); if (i >= 0) panelListeners.splice(i, 1); };
}

/* ---------------- O GUARDA DA GEOMETRIA ----------------
   Quem tiver derivado alguma coisa da MALHARIA do implemento — e hoje há um
   único cliente, `vehicle/merge.ts`, que assa os triângulos de mil peças em
   baldes por material — precisa soltar essa derivação ANTES de `setTrailerDims()`
   e refazê-la DEPOIS.

   POR QUE "ANTES", e não um simples aviso no fim: `TrailerBody.rebuild()`
   REGENERA o corpo branco e `TrailerAssembly.set()` TRANSFORMA a ferragem da
   região do baú, peça por peça, lendo `.visible` e caixas de mundo pelo caminho.
   Um derivado que ainda estivesse de pé nesse instante seria (a) medido como se
   fosse geometria de origem e (b) deixado com os triângulos da medida anterior —
   um baú do tamanho novo com a ferragem do tamanho velho assada por dentro.

   POR QUE UM GUARDA E NÃO UMA CHAMADA DIRETA: `vehicle/merge.ts` é importado por
   este módulo? Não — é o contrário do que parece. Ele é FOLHA de política (ver o
   bloco `MergePolicy` lá): quem sabe onde ficam a caixa de cozinha, o Thermo
   King e o branco de carroceria é `studio.ts`, a raiz de composição. Uma chamada
   daqui para lá teria de duplicar essa política; um guarda deixa quem a possui
   registrar o par suspende/retoma e não cria dependência nenhuma.

   O contrato é de UM guarda, não de uma lista: ele devolve a função de retomar,
   e é isso que torna impossível esquecer de refazer — o `finally` abaixo a
   chama. Registrar um segundo substitui o primeiro, de propósito: dois donos de
   "solte tudo antes do rebuild" seria uma ordem de execução implícita entre
   eles, que é a classe de defeito que este arquivo já paga caro em outros
   lugares. */
export type GeometryGuard = () => (() => void);
let geometryGuard: GeometryGuard | null = null;

/** Registra (ou remove, com `null`) o guarda. Ver o bloco acima. */
export function setGeometryGuard(g: GeometryGuard | null) { geometryGuard = g; }


/**
 * Devolve à GPU as três chapas recortadas — e as sobreposições de arte que
 * `livery.attachOverlays()` pendurou nelas.
 *
 * A sobreposição COMPARTILHA a geometria da chapa (é o mesmo painel, com outro
 * material e outra ordem de render), então a geometria é liberada UMA vez, aqui
 * no dono. O material da sobreposição, esse sim, é dela: um por painel, criado
 * a cada `attachOverlays()`. Sem liberá-lo, cada resize deixaria três programas
 * de shader e três `MeshStandardMaterial` vivos para sempre — o vazamento que
 * um redimensionamento contínuo transforma em minutos de sessão.
 *
 * A CanvasTexture NÃO é liberada: ela é das telas do editor, vive fora daqui, e
 * `Material.dispose()` não a leva junto — que é exatamente o comportamento que
 * torna isto seguro.
 */
function disposeLiveryPanels(trailer: THREE.Object3D) {
  const doomed: THREE.Mesh[] = [];
  trailer.traverse((node) => {
    const o = node as THREE.Mesh;
    if (o.isMesh && /^(SIDE_L|SIDE_R|REAR|FRONT|LIVERY_SILL_[LR]|LIVERY_HEM_[LR])$/.test(o.name)) doomed.push(o);
  });
  for (const panel of doomed) {
    panel.traverse((node) => {
      const o = node as THREE.Mesh;
      if (o === panel || !o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      for (const m of mats) if (!isSharedMat(m)) { forgetPaintMaterial(m); m.dispose(); }
      /* E o material ORIGINAL de um filho pintado (o rebite guarda o inox em
         `origMat` quando a tinta assume) — sem isto ele vazaria por resize. */
      const om = o.userData?.origMat as THREE.Material | undefined;
      if (om && !isSharedMat(om)) { forgetPaintMaterial(om); om.dispose(); }
      /* A sobreposição de arte COMPARTILHA a geometria da chapa (liberada
         abaixo, no dono); os rebites da emenda têm a própria calota e ela
         morreria órfã a cada resize sem esta linha. */
      if (o.geometry && o.geometry !== panel.geometry) o.geometry.dispose();
    });
    panel.clear();                       // solta as sobreposições antes do resto
    panel.geometry.dispose();
    /* Com "pintar implemento" ligado, `material` é o material de tinta
       COMPARTILHADO e o clone branco da chapa está guardado em `origMat`.
       Liberar o compartilhado apagaria a tinta da cabine junto. */
    const own = [panel.material, panel.userData.origMat as THREE.Material | undefined];
    for (const m of own) {
      const list = Array.isArray(m) ? m : (m ? [m] : []);
      for (const one of list) if (!isSharedMat(one)) { forgetPaintMaterial(one); one.dispose(); }
    }
    panel.removeFromParent();
  }
}

/** Idem para a parede dianteira. `frontWallMat` é compartilhado e fica. */
function disposeFrontWallOverlays() {
  for (const w of state.frontWalls || []) {
    w.geometry.dispose();
    w.removeFromParent();
  }
  state.frontWalls = undefined;          // `undefined` = "reconstruir", ver a guarda
}

/**
 * Constrói o baú paramétrico sobre o implemento recém-assentado.
 *
 * Roda ANTES de applyTrailerFinish() de propósito: `TrailerBody` CLONA o
 * material branco de fábrica, e um clone tirado depois do acabamento não teria
 * recebido nenhuma das correções que aquela função aplica por nome. Construído
 * antes, o clone já está pendurado no `root` quando a varredura passa e recebe o
 * mesmo tratamento que o original teria recebido.
 *
 * E antes de buildLiveryPanels(), pelo motivo que dá nome a tudo isto: as
 * chapas de livery têm de ser recortadas do corpo PARAMÉTRICO. Recortadas do
 * original, elas seriam a única parte do baú que não redimensiona.
 *
 * Falhar aqui não é fatal. Um bake sem o material branco de fábrica continua
 * carregando, pintando e exportando imagem — só não redimensiona.
 */
function buildTrailerRig(trailer: THREE.Object3D) {
  try {
    /* QUAIS GEOMETRIAS SÃO MOLDE — e tem de ser AQUI, antes de `new TrailerRig`.
       O construtor do rig chama `applyBakeFixes()`, que é o PRIMEIRO a escrever
       dentro da malharia carregada; `TrailerAssembly` vem logo depois e congela
       `piece.base`. Marcar depois de qualquer um dos dois transformaria uma
       geometria JÁ MODIFICADA em molde, e a modificação vazaria para as irmãs
       na primeira vez que uma delas clonasse.

       Com o `trailer.glb` de hoje isto não encontra quase nada (a maior família
       tem 6 malhas, e são as rodas). Ele existe para o acervo DEDUPLICADO, em
       que até 104 malhas dividem uma geometria — ver `vehicle/geometry-share.ts`
       e `tools/studio-assets/dedup-cargas.mjs`. Custa uma varredura de nós. */
    const compartilhadas = markShared(trailer);
    if (compartilhadas) console.info('[baú] geometria compartilhada —', compartilhadas,
      'malhas dividem um molde; a escrita clona (ver geometry-share.ts)');

    const rig = new TrailerRig(trailer);
    state.trailerRig = rig;
    const p = rig.profile;
    console.info('[baú] paramétrico —', p.shells, 'cascas ·', p.ribbedShells, 'frisada(s) ·',
      p.ribCount, 'frisos a', (p.pitch * 1000).toFixed(1), 'mm · base',
      `${p.base.length.toFixed(3)} × ${p.base.height.toFixed(3)} × ${p.base.width.toFixed(3)} m`,
      '· conjunto', rig.assembly.stats.parts, 'peças de', rig.assembly.stats.meshes, 'malhas');
  } catch (e: unknown) {
    state.trailerRig = null;
    console.warn('[baú] geometria paramétrica indisponível —', errText(e),
      '· o implemento carrega, mas não redimensiona.');
  }
}

/** As medidas correntes do baú, ou `null` se este bake não redimensiona. */
export function getTrailerDims(): TrailerDims | null {
  return state.trailerRig ? state.trailerRig.current : null;
}

/**
 * A ÚNICA porta de entrada do redimensionamento. Devolve as medidas EFETIVAS —
 * a altura é ajustada para fechar um número inteiro de frisos, então o que sai
 * raramente é idêntico ao que entrou.
 *
 * A sequência abaixo não é arbitrária; cada passo depende do anterior.
 */
export function setTrailerDims(patch: { height?: number; length?: number }): TrailerDims | null {
  const rig = state.trailerRig;
  const t = state.trailer;
  const base = state.trailerBase;
  if (!rig || !t || !base) return null;

  /* 0. QUEM DERIVOU DA MALHARIA SOLTA AGORA — ver O GUARDA DA GEOMETRIA. Tem de
        ser a PRIMEIRA linha do corpo: os passos 1 a 3 leem `.visible` e caixas
        de mundo de todo o implemento, e um derivado de pé seria medido junto.

        SEM `try/finally`, e é decisão: se algum passo abaixo lançar, o derivado
        fica SOLTO. Esse é o estado degradado certo — a imagem continua completa
        (as malhas de origem estão todas visíveis) e o que se perde é velocidade.
        O contrário — refazer a fusão sobre uma geometria que acabou de falhar no
        meio do rebuild — assaria o estado rasgado dentro dos baldes. */
  const retomarGeometria = geometryGuard ? geometryGuard() : null;

  /* 1. DE VOLTA À POSE DE CARGA, e o `rigGroup` à identidade.
     `TrailerAssembly.set()` decide em ESPAÇO DE MUNDO ("esta peça encosta no
     teto?", "está sob o piso?") contra números medidos no construtor, que rodou
     com o implemento assentado na origem. Chamá-lo com o conjunto engatado, 12 m
     adiante e girado 180°, compararia coordenadas de dois referenciais
     diferentes — e a inclinação do engate ainda somaria uma rotação em X que
     nenhuma dessas regras prevê. placeTrailer(), no fim, devolve tudo. */
  setRigPlacement(false);
  t.rotation.set(0, 0, 0);               // yaw também: `placeTrailer()` escreve os três
  t.position.copy(base.pos);
  t.updateMatrix();                      // nó congelado; ver freezeMatrices()
  t.updateWorldMatrix(true, true);
  /* É NESTA POSE que `TrailerRig.set()` vai remedir as âncoras de engate (pino,
     chapa e manchas de contato do bogie). Se a linha acima não voltasse o
     implemento à pose de carga, o acessor mediria uma geometria inclinada e
     deslocada 12 m — e o engate seguinte fecharia sobre números de outro
     referencial, sem erro nenhum para denunciar. */

  /* 2. O ÍNDICE VELHO MORRE ANTES DO REBUILD. Ele é o resíduo do recorte
        anterior e aponta para uma contagem de vértices que está prestes a
        mudar. Depois do rebuild já seria tarde: a malha passaria um quadro
        indexando lixo. */
  for (const m of [rig.body.mesh, rig.body.roof]) {
    const g = m.geometry as THREE.BufferGeometry;
    g.setIndex(null);
    g.clearGroups();
  }

  const dims = rig.set(patch);

  /* 3. As chapas antigas saem, as novas são recortadas do corpo novo. A ordem
        importa duas vezes: buildLiveryPanels() desiste se já achar uma malha
        SIDE_L/SIDE_R/REAR, e as chapas antigas carregam o mesmo material branco
        das de origem — deixadas na cena, entrariam como fonte do próprio
        recorte. */
  disposeLiveryPanels(t);
  disposeFrontWallOverlays();
  buildLiveryPanels(t);
  /* E o TETO ganha o `uv1` dele no mesmo passo — a geometria dele acabou de ser
     reescrita por `rig.set()`. Ver `tagRoofLiveryUV()`. */
  tagRoofLiveryUV(t);

  /* 4. O Thermo King pendura na parede dianteira a uma folga fixa abaixo do
        teto, e a parede acabou de mudar de altura. Ele não faz parte do
        `TrailerAssembly` (entrou na cena depois dele), então é aqui que
        acompanha — e acompanha REMEDINDO a parede, não somando um delta.

        O que havia aqui era `tk.position.y += rig.roofDelta() − roofBefore`, e
        ele tinha três problemas de uma vez: só corrigia Y (a testeira também
        avança alguns milímetros com o esticamento em Z, e a unidade ficava
        descolada dela), acumulava o resíduo de cada resize sem nunca
        reancorar, e dependia de `roofDelta()` prever exatamente onde a chapa
        foi parar em vez de perguntar. `placeThermoKing()` resolve as três
        coordenadas contra a caixa recém-medida do corpo, então é idempotente e
        a unidade fica rente à parede em qualquer medida. O TAMANHO dela não
        entra na conta: é produto físico e não cresce com a caixa. */
  placeThermoKing();

  /* 4b. A PLACA TRASEIRA acompanha a porta. O comprimento cresce PARA TRÁS
        (`mapZ()` comportamento `front`), então o para-choque — e com ele a
        placa — anda o resize inteiro. Mesma doutrina do passo 4: REMEDIR o
        para-choque, nunca somar um delta. Ver `placeTrailerPlate()`. */
  placeTrailerPlate(t);

  /* 5. A caixa do baú, rederivada da geometria nova — é o que o engate lê. */
  const box = bboxOfMatching(t, bodyPanelPred(t));
  if (state.trailerPivotFromFront !== undefined) {
    /* A rodagem não andou; só a parede de referência. O braço do engate é a
       distância entre as duas, então a correção é a diferença, exata. */
    state.trailerPivotFromFront += box.max.z - base.frontZ;
  }
  state.trailerBox = box;
  state.trailerBase = { pos: base.pos.clone(), frontZ: box.max.z };

  /* 6. As chapas novas nasceram com `matrixAutoUpdate` ligado; o resto do
        implemento está congelado desde o fim de loadTrailer(). Recongelar iguala
        as duas metades — e tem de vir antes de placeTrailer(), que é quem
        recompõe a pose sob essa regra. */
  freezeMatrices(t);
  placeTrailer();

  /* 7. Tinta e molhagem por último, porque valem sobre MALHAS: as três chapas
        que acabaram de nascer não estão em registro nenhum. Reafirmar o alvo
        corrente repinta as novas e reconstrói a parede dianteira que o passo 3
        descartou. */
  setPaintTarget(state.paintTarget);
  reapplyVehicleWetness();

  /* 8. E a arte volta para cima delas — ver onTrailerPanelsRebuilt(). */
  for (const cb of panelListeners) cb(t);

  /* 9. E O DERIVADO VOLTA — depois de TUDO, inclusive do `setPaintTarget()` do
        passo 7 e dos ouvintes do passo 8: quem funde por material guarda a
        referência do material no instante da fusão, e refazê-la antes da tinta
        assar a chapa branca dentro do balde. Ver O GUARDA DA GEOMETRIA. */
  retomarGeometria?.();

  invalidate();
  console.info('[baú] redimensionado —',
    `${dims.length.toFixed(3)} × ${dims.height.toFixed(3)} m ·`,
    rig.ribs.count, 'frisos · testeira z', box.max.z.toFixed(3));
  return dims;
}

/**
 * As portas laterais de uma face — a porta BOA, e a única que o editor deve usar.
 *
 * Ela não faz nada de novo: guarda a lista no rig e delega a
 * `setTrailerDims({})`, que é a sequência de oito passos logo acima. Isso é o
 * PONTO, não preguiça. Recortar um vão reescreve os atributos do corpo branco
 * inteiro, exatamente como mudar a altura — e todo o resto da sequência vale
 * igual: o índice velho tem de morrer antes (passo 2), as chapas de livery têm
 * de ser descartadas e recortadas de novo (passo 3, senão os triângulos que
 * migraram para SIDE_L/SIDE_R voltam ao corpo e as duas cópias disputam o
 * z-buffer), a caixa do baú tem de ser rederivada (passo 5) e a arte tem de ser
 * reatada (passo 8).
 *
 * `rig.setDoors()` cru existe e reconstrói na hora — serve ao console e à
 * sonda, onde não há chapa recortada para desencontrar. Do editor, ele é a
 * porta errada.
 *
 * O patch VAZIO é deliberado: nenhuma medida muda, e `TrailerBody.set({})`
 * reconstrói assim mesmo. Escrever aqui uma cópia das medidas correntes daria
 * na mesma e abriria a chance de elas serem lidas de um lugar defasado.
 */
export function setTrailerDoors(face: Face, doors: DoorSpec[]): TrailerDims | null {
  const rig = state.trailerRig;
  if (!rig) return null;
  rig.stageDoors(face, doors);
  const dims = setTrailerDims({});
  /* A SONDA DE REFLEXO É RELIGADA AQUI, e sem isto a porta espelhava outro
     mundo. `refreshVehicleReflection()` prende o cubemap local como `envMap`
     nos materiais que encontra NAS MALHAS do veículo — e as malhas da porta
     (marco, moldura, ferragem `__porta`) só passam a existir neste momento.
     Criadas depois da captura do load, ficavam sem `envMap` explícito e caíam
     em `scene.environment`: o HDRI cru, com horizonte e sem o próprio caminhão
     — "o inox da porta está refletindo o HDR em vez dos modelos 3D". Religar
     também as inscreve em `probeBase`, então a gradação dia-noite passa a
     valer para elas como para o resto do conjunto. */
  refreshVehicleReflection();
  return dims;
}

/** Volta o baú às medidas de fábrica. */
export function resetTrailerDims(): TrailerDims | null {
  const rig = state.trailerRig;
  return rig ? setTrailerDims({ height: rig.base.height, length: rig.base.length }) : null;
}

/* ---------------- trailer ---------------- */

/**
 * Começa a baixar o implemento e os dois acessórios dele, sem montar nada.
 *
 * O ÚNICO PREFETCH DO ENGINE QUE NÃO É ESPECULATIVO, e por isso o de maior
 * retorno: `runApply()` carrega o implemento em TODO boot (`if (first)
 * weights.trailer = 150`), então estes bytes vão ser pedidos daqui a alguns
 * segundos de qualquer forma. Chamado assim que os manifestos respondem — com o
 * usuário ainda no primeiro card do seletor —, os 31 MB descem POR BAIXO da
 * escolha inteira em vez de depois dela.
 *
 * MORA AQUI, e não em studio.ts, porque os três nomes de arquivo são deste
 * módulo. `WHEEL_ASSET` em particular NÃO pode ser repetido em lugar nenhum: o
 * `_v2` é uma correção documentada e `wheel_fh16.glb` está queimado (ver a nota
 * dele). Um prefetch que aquecesse o arquivo errado seria o dobro do download
 * com zero acerto de cache, e sem sintoma nenhum.
 *
 * Os dois `*_meta.json` e o `hitch.json` ficam de FORA de propósito: são
 * kilobytes, `loadManifests()` já os pediu, e a rota de manifesto responde
 * `no-cache` — enfileirá-los só tiraria uma vaga das duas de `MAX_IN_FLIGHT`.
 */
export function prefetchTrailerAssets(): void {
  prefetch([
    VEHICLES_DIR + 'trailer.glb',
    VEHICLES_DIR + WHEEL_ASSET,
    VEHICLES_DIR + 'thermoking.glb',
  ], 'trailer');
}

export async function loadTrailer(onProgress?: (t: number) => void) {
  const mine = ++trailerGen;
  const trailer = await loadGLB(VEHICLES_DIR + 'trailer.glb', onProgress);
  /* Mesma guarda de loadCab(), mesmo motivo — ver a nota lá. Aqui ela é ainda
     mais barata de errar: loadTrailer() não remove um implemento anterior, então
     duas cargas concorrentes deixariam DOIS implementos dentro do trailerGroup,
     um deles invisível ao resto do módulo. */
  if (mine !== trailerGen) { disposeTree(trailer); return state.trailer; }
  setRigPlacement(false);       // a conta abaixo é em espaço de mundo; ver rigGroup
  setupCommon(trailer);
  state.trailerGroup.add(trailer);
  /* Measured BEFORE grounding: membership is decided by which tyres share the
     contact plane, and translating the whole trailer cannot change that. */
  const tyres = runningTyres(trailer);
  const tyreSet = tyres ? tyres.meshes : new Set<THREE.Mesh>();
  const box = groundAndCenter(trailer, bodyPanelPred(trailer),
    (o: THREE.Mesh) => tyreSet.has(o), tyres ? tyres.minY : undefined);
  auditTransparency(trailer, 'trailer');     // glass blends, decals alphaTest
  /* A FERRAGEM SE DIVIDE AQUI — inox, caixa e trilho —, e a posição é
     contrato: o construtor de `TrailerBody` (dentro de buildTrailerRig) extrai
     o kit da porta lateral e guarda a referência do material de cada peça.
     Dividir depois deixaria a lateral com o material velho. Ver
     `splitTrailerHardware()`. */
  splitTrailerHardware(trailer);
  /* O BAÚ PARAMÉTRICO ENTRA AQUI — depois do assentamento (as duas metades
     medem em espaço de mundo e esta é a pose de referência de toda medida
     posterior), antes do acabamento e do recorte das chapas. Ver
     buildTrailerRig() para o porquê de cada uma dessas duas fronteiras. */
  buildTrailerRig(trailer);
  applyTrailerFinish(trailer);               // AFTER setupCommon: it overrides env 1.35
  /* After grounding, before studio.ts calls livery.attachOverlays(). */
  buildLiveryPanels(trailer);
  tagRoofLiveryUV(trailer);
  state.trailer = trailer;
  /* Remedida DEPOIS do baú paramétrico: `box` veio de groundAndCenter(), que
     rodou sobre as chapas originais — as mesmas que `TrailerBody` acabou de
     esconder. Nas medidas de fábrica as duas caixas coincidem, e é justamente
     por isso que trocar agora é barato: o engate passa a ler a geometria que
     ele vai continuar lendo depois do primeiro resize, em vez de uma que só
     valia até ele. */
  const bodyBox = state.trailerRig ? bboxOfMatching(trailer, bodyPanelPred(trailer)) : box;
  state.trailerBase = { pos: trailer.position.clone(), frontZ: bodyBox.max.z };
  state.trailerBox = bodyBox;
  /* Where the tyres meet the ground, measured back from the front wall. The
     coupling pitch (see placeTrailer) turns about this, so it has to be taken
     from the base pose — before any placement moves the trailer along Z.
     The BOGIE, not every tyre: see runningTyres(). */
  if (tyres) {
    state.trailerPivotFromFront = box.max.z - (tyres.zMin + tyres.zMax) / 2;
    state.trailerTyreHalfSpan = (tyres.zMax - tyres.zMin) / 2;
  }
  placeTrailer();
  await attachFh16Wheels(trailer);   // optional — a roda original fica se faltar
  await attachThermoKing();   // optional — skips gracefully if the GLB is absent
  reapplyVehicleWetness();
  /* A PATOLA GANHA UM GRUPO — depois das rodas (o plano de contato sai do ponto
     mais baixo do implemento, e `attachFh16Wheels()` acabou de trocar a rodagem
     inteira) e ANTES do congelamento, porque mudar um nó de pai depois dele é
     justamente a armadilha que o bloco de `freezeMatrices()` documenta.
     Ver `vehicle/landing-gear.ts`. */
  buildLandingGear(trailer);
  /* A PLACA TRASEIRA — no para-choque, MEDIDO. Depois da patola (as duas
     disputam a mesma janela de "antes do congelamento") e depois do Thermo King,
     pela mesma razão dele: o que entra na árvore depois de `freezeMatrices()`
     nasce fora da varredura e recompõe matriz a cada quadro.
     Ver `vehicle/license-plate.ts`. */
  attachTrailerPlate(trailer);
  /* DEPOIS do Thermo King: ele entra como filho do implemento, então congelar
     antes deixaria a unidade recompondo a matriz dela a cada quadro e — pior —
     fora da varredura, o que faria a intenção do congelamento mentir sobre o
     que está congelado. */
  freezeMatrices(trailer);
  /* E a pose corrente é reescrita no grupo recém-criado: quem estava olhando só
     o implemento troca de caminhão e o novo tem de nascer com o pé no chão. */
  setLandingGearDown(vehicleView === 'trailer');
  return trailer;
}

/* ---------------- rodagem do FH16 ----------------
   O porquê da troca e toda a geometria estão em `vehicle/wheels.ts`; aqui fica
   só o ciclo de carga, que é o mesmo do Thermo King: opcional, com guarda de
   concorrência e degradação silenciosa para "fica como estava".

   DUAS DIFERENÇAS em relação ao Thermo King, e as duas são deliberadas:

   1. NÃO mexe em `setRigPlacement`. `swapTrailerWheels()` resolve a pose em
      mundo e converte para o local do implemento no fim — o mesmo contrato de
      `placeThermoKing()` —, então ele vale com o conjunto engatado, girado e
      inclinado. É o que permite chamá-lo DEPOIS de `placeTrailer()` sem
      devolver o rig para a origem, e portanto sem a janela em que um quadro
      poderia mostrar o caminhão no meio do pátio.
   2. O acabamento é aplicado ao ASSET, não ao implemento. `applyTrailerFinish()`
      já rodou lá em cima, antes de esta roda existir; sem esta chamada o pneu
      novo ficaria com o `envMapIntensity` 1.35 que `setupCommon()` põe em tudo,
      espelhando o céu como plástico polido. O nome `pneu-fh16` foi escolhido no
      bake justamente para casar `^pneu` em `TRAILER_RUBBER_RE`.

   A raiz do asset NÃO é descartada no caminho feliz: `clone(true)` compartilha
   geometria e material com ela, e um `disposeTree()` levaria junto os buffers
   que as oito cópias estão usando. */
/** `_v2` E NÃO `wheel_fh16.glb`, e o motivo é um erro que já custou uma rodada.
 *
 *  A primeira bake saiu com a roda montada ao contrário (o disco enterrado para
 *  dentro do rodado) e ficou servida por uma hora antes de ser corrigida. A
 *  correção foi publicada SOBRESCREVENDO o arquivo — e `/studio-assets/v1/` sai
 *  da API com `Cache-Control: public, max-age=31536000, immutable`. Todo
 *  navegador que abriu o estúdio naquela janela ficou com a roda torta presa
 *  por um ano, sem cache-buster nenhum para puxar: o URL É a promessa de que os
 *  bytes não mudam, e a promessa foi quebrada.
 *
 *  Por isso o nome novo. `wheel_fh16.glb` está QUEIMADO — não reaproveitar,
 *  nem para uma bake correta: existem clientes com a versão errada colada
 *  naquele URL. Toda bake seguinte ganha o próximo sufixo (ou uma árvore `vN`),
 *  que é a regra escrita em `tools/wheel-bake/README.md` e no cabeçalho do
 *  mount em `api/src/main.ts`. */
const WHEEL_ASSET = 'wheel_fh16_v2.glb';

async function attachFh16Wheels(trailer: THREE.Object3D) {
  const mine = trailerGen;
  let asset: THREE.Group;
  try {
    asset = await loadGLB(VEHICLES_DIR + WHEEL_ASSET);
  } catch (e: unknown) {
    console.warn('[rodas]', WHEEL_ASSET, 'indisponível — a rodagem original fica.',
      errText(e));
    return;
  }
  if (mine !== trailerGen) { disposeTree(asset); return; }
  setupCommon(asset);
  applyTrailerFinish(asset);
  if (!swapTrailerWheels(trailer, asset)) disposeTree(asset);
}

/* ---------------- Thermo King refrigeration unit ----------------
   Attached as a child of the trailer root: follows coupling moves and hides
   with the Implemento toggle. Back mounting face sits flush on the front-wall
   plane, centered on X, top ~0.15 m below the trailer roof line. */
export async function attachThermoKing() {
  /* Lido, não incrementado: esta unidade pertence ao implemento que estava
     carregado quando a função começou. Se um loadTrailer() novo passar por aqui
     no meio dos dois awaits abaixo, esta unidade não tem mais em que se montar. */
  const mine = trailerGen;
  let meta: { dims?: unknown; widthFrac?: unknown; topGap?: unknown } | null = null;
  try { meta = await fetchJSON(VEHICLES_DIR + 'thermoking_meta.json'); } catch { /* optional */ }
  let tk: THREE.Group;
  try {
    tk = await loadGLB(VEHICLES_DIR + 'thermoking.glb');
  } catch (e: unknown) {
    console.warn('[tk] thermoking.glb indisponível —', errText(e));
    return;
  }
  if (mine !== trailerGen || !state.trailer) { disposeTree(tk); return; }
  setRigPlacement(false);       // idem: medidas de mundo daqui para baixo
  setupCommon(tk);
  auditTransparency(tk, 'thermoking');       // only glass may be transparent

  /* ---- TAMANHO: o do PRODUTO, e ESCALA ÚNICA ----
     `thermoking_meta.json` traz `dims` — 2,03 x 1,68 x 0,796 m, a carcaça
     SLXi real, e o próprio manifesto diz que o rip já sai nessa proporção
     ("Scaled to real width 2.03 m (uniform; rip proportions give H/D as
     logged)"). O código anterior LIA `dims` e não a usava para nada além do
     log: ele espremia a profundidade para 0,53 m fixos e depois esticava X e Y
     juntos até a largura virar `widthFrac` da largura do BAÚ. Resultado
     medido no app, com este mesmo GLB:

         bbox aplicada  2,16 x 1,79 x 0,53      dims do manifesto  2,03 x 1,68 x 0,796

     ou seja 6,4 % maior nos dois eixos da frente e 33 % mais rasa — e, pior,
     a razão entre os eixos mudou, o que é justamente o que não se pode fazer
     com a fotografia de um produto real. Ela também deixava de ser uma medida
     absoluta: `widthFrac` amarra a unidade à largura do baú, então a carcaça
     PASSARIA A CRESCER se a caixa crescesse. A classificação de nós é
     explícita quanto a isso — a unidade de refrigeração mantém o tamanho real
     e apenas TRANSLADA.

     Então: um fator UNIFORME, tirado da largura declarada. Os outros dois
     eixos saem da proporção do rip, e o log confere os três contra `dims`
     para que uma divergência apareça em vez de passar calada.
     `widthFrac` fica só como degradação para um manifesto sem `dims`. */
  const readNum = (v: unknown, d: number, lo: number, hi: number) =>
    Number.isFinite(+(v as number)) ? Math.min(hi, Math.max(lo, +(v as number))) : d;
  const dims = (meta?.dims && typeof meta.dims === 'object' ? meta.dims : null) as
    { w?: number; h?: number; d?: number } | null;

  const trailerRoot = state.trailer as THREE.Object3D;
  const bodyW = (() => {
    const bb = bboxOfMatching(trailerRoot, bodyPanelPred(trailerRoot));
    return bb.max.x - bb.min.x;
  })();
  {
    const raw = new THREE.Box3().setFromObject(tk);
    const rawW = raw.max.x - raw.min.x;
    const wantW = dims && Number.isFinite(+(dims.w as number)) && +(dims.w as number) > 0
      ? +(dims.w as number)
      : bodyW * readNum(meta?.widthFrac, 0.83, 0.4, 1);
    if (rawW > 1e-6) {
      const s = wantW / rawW;
      tk.scale.multiplyScalar(s);           // UNIFORME: o produto não se deforma
      tk.updateWorldMatrix(true, true);
    }
  }

  /* Refeito AGORA porque setupCommon() mediu esta unidade antes do bloco de
     escala acima, e o corte de emissores de sombra é uma medida absoluta em
     metros: um alvo de 5 cm num modelo que ainda vai encolher (ou crescer) é uma
     pergunta respondida cedo demais. Idempotente — só reescreve as flags. */
  setShadowCasters(tk);

  const b = new THREE.Box3().setFromObject(tk);      // measured, not assumed
  state.tkSize = b.getSize(new THREE.Vector3());
  state.tkTopGap = readNum(meta?.topGap, 0.23, 0, 1);
  state.tkDepth = state.tkSize.z;                    // extends cab-clearance clamp
  trailerRoot.add(tk);
  state.tk = tk;
  placeThermoKing();
  const got = state.tkSize;
  console.info('[tk] attached — bbox',
    [got.x, got.y, got.z].map((v) => +v.toFixed(3)).join(' x '),
    dims ? '· meta ' + [dims.w, dims.h, dims.d].join(' x ') : '· (sem meta: escala por widthFrac)',
    '· topGap', state.tkTopGap.toFixed(3));
  placeTrailer();                                    // re-clamp with tk depth
}

/** Ferragem estrutural da testeira — o critério é o MATERIAL, não o nome do nó. */
const FRONT_RAIL_MAT_RE = /ferragem|estrutura/i;
/** Profundidade da faixa, medida da testeira para trás, onde a travessa cabe. */
const FRONT_RAIL_BAND = 0.15;

/**
 * A face de BAIXO da travessa que fecha o topo da testeira, NO REFERENCIAL DO
 * IMPLEMENTO.
 *
 * `null` quando não há peça que sirva — e aí `placeThermoKing()` volta para o
 * recuo do teto em vez de inventar uma altura.
 *
 * O que qualifica: ferragem, na faixa da testeira, ATRAVESSANDO A LINHA DE
 * CENTRO. O último teste é o que separa a travessa dos montantes de canto e das
 * lanternas — todos eles são ferragem na mesma faixa, e todos vivem nas bordas.
 * Entre as candidatas ganha a de topo mais alto, que é a do teto.
 *
 * Por vértice, e não por `Box3.setFromObject`: a caixa de um nó girado é a
 * caixa de uma caixa girada, e aqui o erro entraria direto na altura da
 * unidade. É a mesma regra do resto deste módulo.
 */
function measureFrontRailUnderside(trailer: THREE.Object3D): number | null {
  const rig = state.trailerRig;
  if (!rig) return null;
  trailer.updateWorldMatrix(true, true);
  /* Os limiares (`z1`) vivem no referencial do implemento; os vértices, não.
     Traz-se o vértice para lá, que é o mesmo contrato de `TrailerRig`. */
  const inv = trailer.matrixWorld.clone().invert();
  const zMin = rig.profile.z1 - FRONT_RAIL_BAND;
  /* FILTRO E ALTURA, os dois LOCAIS. A altura saía em MUNDO porque era em mundo
     que `placeThermoKing()` resolvia a pose — e era justamente aí que a
     inclinação de engate entrava na conta: a mesma travessa dava um Y de mundo
     diferente para cada altura de quinta roda, ou seja, para cada chassi de
     cavalo. Agora as duas pontas falam o referencial do implemento e a pose do
     conjunto não tem por onde vazar. Os dois vetores continuam porque o vértice
     ainda precisa passar pelo mundo para chegar ao local. */
  const loc = new THREE.Vector3();
  const wld = new THREE.Vector3();
  let bestTop = -Infinity, bestUnder: number | null = null;
  let baldes = 0;
  trailer.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    if (state.tk && (o === state.tk || !!state.tk.getObjectById(o.id))) return;   // a unidade não se mede
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((m) => !!m && FRONT_RAIL_MAT_RE.test(m.name || ''))) return;
    /* ⚠️ UM BALDE DE FUSÃO NÃO É UMA PEÇA, E ESTA MEDIDA SÓ FAZ SENTIDO POR PEÇA.
       -----------------------------------------------------------------------
       Daqui para baixo a regra é "o topo mais alto ganha, e o que vale é a face
       de BAIXO DELE". Ela pressupõe que uma malha seja uma peça. `merge.ts`
       assa os triângulos de centenas de peças do mesmo material numa malha só e
       esconde as origens — e aí `wHi` continua sendo o topo da travessa (é a
       peça mais alta do balde) enquanto `wLo` passa a ser o ponto mais baixo de
       TODA a ferragem da testeira, que é o estrado.

       Medido (`checks-tk-troca-0816.mjs`, Scania R 2009 4x2): a mesma travessa
       dá face de baixo em 4093,9 mm pela peça e 1539,0 mm pelo balde
       `FUSAO__inox-ferragem__b3` — 2554,9 mm de erro, que a unidade herdava
       inteiro numa troca de cavalo.

       O CONTRATO CERTO é não medir com a fusão de pé, e quem o cumpre é
       `runApply()` em `studio.ts` (ver A FUSÃO SAI DE PÉ ANTES DA CABINE). Este
       filtro é o cinto: se alguém medir mesmo assim, o resultado é `null` — a
       degradação DOCUMENTADA, que devolve o recuo fixo de `topGap` — e não um
       número plausível e errado por dois metros e meio.

       Por `userData.tsMergeBand`, e não por importar `merge.ts`: este módulo é
       anterior a ele na composição, e o campo já é o contrato que
       `material-setup.ts` usa pela mesma razão. */
    if (o.userData?.tsMergeBand !== undefined) { baldes++; return; }
    const pos = o.geometry.attributes.position;
    let n = 0, wLo = Infinity, wHi = -Infinity, xLo = Infinity, xHi = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      wld.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      loc.copy(wld).applyMatrix4(inv);
      if (loc.z < zMin) continue;
      n++;
      if (loc.y < wLo) wLo = loc.y; if (loc.y > wHi) wHi = loc.y;
      if (loc.x < xLo) xLo = loc.x; if (loc.x > xHi) xHi = loc.x;
    }
    if (!n || xLo > -0.5 || xHi < 0.5) return;        // tem de atravessar o centro
    if (wHi > bestTop) { bestTop = wHi; bestUnder = wLo; }
  });
  if (bestUnder === null && baldes) {
    console.warn('[tk] a travessa da testeira foi medida com a FUSÃO DE PÉ —',
      baldes, 'balde(s) de ferragem no caminho e nenhuma peça visível.',
      'A unidade cai no recuo fixo de topGap. Solte a fusão antes de medir'
      + ' (ver A FUSÃO SAI DE PÉ ANTES DA CABINE, em studio.ts).');
  }
  return bestUnder;
}

/**
 * Assenta a unidade na parede dianteira, na medida CORRENTE do baú.
 *
 * REDERIVADA, nunca acumulada. O caminho anterior somava `position.y += dRoof`
 * a cada resize e não tocava em X nem em Z: a unidade seguia a linha do teto
 * por um delta calculado, e qualquer resíduo — o do próprio `roofDelta()`, o
 * avanço de alguns milímetros que a testeira ganha com o esticamento em Z —
 * ficava somado para sempre, resize após resize. Medir a parede e resolver as
 * três coordenadas de uma vez custa uma caixa e elimina a deriva por
 * construção: a unidade fica encostada, centrada e na altura certa em qualquer
 * medida, e chamar isto duas vezes seguidas dá o mesmo resultado.
 *
 * A unidade é filha do implemento e o implemento pode estar engatado (girado
 * 180° e inclinado), então a pose é resolvida em MUNDO e convertida para local
 * no fim — que é o mesmo contrato de `attachThermoKing()`.
 */
export function placeThermoKing() {
  const tk = state.tk, trailer = state.trailer;
  if (!tk || !trailer || !state.tkSize) return;
  /* AS DUAS CAIXAS NO REFERENCIAL DO IMPLEMENTO — ver `bboxInFrame()` para o
     que a versão em mundo estava somando junto. Em resumo: o implemento
     engatado carrega a inclinação que o solver deriva da altura da quinta roda,
     ou seja um giro que MUDA COM O CHASSI DO CAVALO, e caixa-de-caixa-girada
     transformava esse giro em dezenas de milímetros de deslocamento da
     unidade. Medido no referencial do baú, nada disso existe: a pose do
     conjunto some da conta e a unidade acompanha o implemento por construção,
     que é o que se pede dela. */
  const sideBox = bboxInFrame(trailer, trailer, bodyPanelPred(trailer));
  if (sideBox.isEmpty()) return;
  /* Caixa da unidade no MESMO referencial: o rip não tem a origem no centro,
     então é ela que diz onde as faces estão em relação à origem do nó. */
  const b = bboxInFrame(trailer, tk);
  if (b.isEmpty()) return;
  /* ALTURA — ENCOSTADA NA TRAVESSA, e a travessa é MEDIDA.
     -----------------------------------------------------------------------
     Era `sideBox.max.y − topGap`, um recuo fixo de 230 mm da linha do teto, e
     ele deixava a unidade 155 mm abaixo da travessa metálica que fecha o topo
     da testeira — em TODA altura de baú (medido no app em 2,19 / 2,51 / 2,78 /
     3,10 / 3,41 / 4,00 m: −154,8 a −155,7 mm). É esse vão que se vê de cima.

     A travessa não é um número: é a peça de ferragem da testeira que atravessa
     a linha de centro, e ela ACOMPANHA a altura — a face de baixo dela ficou
     em `roofY − 94,9 mm` nas seis medidas, com 0,8 mm de variação em 1,8 m de
     curso. Então medi-la a cada reconstrução é o que faz o alinhamento seguir
     o baú, em vez de um segundo `topGap` fixo que só estaria certo na medida
     de fábrica.

     NÃO existe recorte na parede para encaixar a unidade — o relevo da
     testeira é de milímetros, não de centímetros. Encostar na travessa é o que
     a geometria oferece, e é a metade acionável do pedido. */
  const rail = measureFrontRailUnderside(trailer);
  const wantTop = rail ?? (sideBox.max.y - (state.tkTopGap ?? 0.23));
  /* A carcaça tem 1,68 m e não encolhe, então num baú baixo a regra acima
     sozinha empurraria a base ABAIXO do piso (medido: −34 mm num baú de
     1,876 m, ou seja a unidade entrando no estrado). Como o produto é físico,
     o que cede é a altura de encosto, não o tamanho: a base encosta no piso e
     a unidade sobe o quanto faltar. */
  const top = Math.max(wantTop, sideBox.min.y + (b.max.y - b.min.y));
  /* Deslocamento pedido, JÁ no referencial do implemento — e é aí que a
     conversão de mundo para local deixa de existir. `tk` é filho do implemento,
     então `tk.position` mora exatamente neste referencial: somar é a operação
     inteira. A versão anterior resolvia em mundo e convertia pela parte linear
     da matriz do pai; a conversão estava correta, o referencial da MEDIDA é que
     não estava. */
  const move = new THREE.Vector3(
    (sideBox.min.x + sideBox.max.x) / 2 - (b.min.x + b.max.x) / 2,   // centrada em X
    top - b.max.y,                                                   // topo sob a travessa
    sideBox.max.z - b.min.z,                                         // costas rentes à parede
  );
  tk.position.add(move);
  tk.updateMatrix();
  tk.updateMatrixWorld(true);
}

/* ===========================================================================
   O ENGATE.
   ---------------------------------------------------------------------------
   O QUE FOI APAGADO AQUI, e por quê — para ninguém trazer de volta.

   1. `fifthwheelTopY = 1.151` fixo para todos os modelos (era do desktop, em
      `src/main.ts` e `src/studio/loader.ts`). Dava `lift = 1,151 − 1,2418 =
      −0,0908` em TODO caminhão.
   2. `Math.max(0, lift)`. Descartava o caso negativo — os mesmos 91 mm — antes
      de usá-lo, e o resultado era uma lâmina de luz do dia entre a chapa e o
      acoplador que nenhum valor de manifesto conseguia fechar.
   3. `frontZ = Math.min(frontZ, rearBodyZ − 0,15)`. Escorregava o implemento
      para trás em SILÊNCIO quando a folga não fechava — desengatava o pino sem
      dizer nada. Agora a folga é medida por PERFIL e a falha é RELATADA.
   4. `Box3.setFromObject` no caminho de posicionamento (`groundModel()` do
      desktop, `groundAndCenter()` daqui). A caixa de um nó girado é a caixa de
      uma caixa girada: o implemento pairava ~230 mm por causa disso.
   5. `LEGACY_TRAILER_FRONT_Z` e `CAB_FORWARD_GAP = 0,10` no caminho principal.
      O segundo era um desengate deliberado de 100 mm aplicado a toda cabine, e
      todo `z` de `cabs.json` o carrega embutido. Se a cabine deve ficar
      adiantada no cenário, isso é `RIG_PLACEMENT`, não uma mentira dentro do
      engate.

   O que entra no lugar: `vehicle/coupling.ts` — um solver PURO, sem `three` e
   sem `@/`, exercitado pela sonda headless sobre os 53 cavalos. Ele devolve
   pose para as DUAS metades, e esta função é a única que as escreve.
   =========================================================================== */

/**
 * Perfil da traseira do CAVALO, medido no modelo carregado, no referencial
 * NORMALIZADO (contato em y = 0, linha de centro em x = 0, frente em +Z).
 *
 * Por que não sai de `hitch.json`: o `rearBody.z` de lá é `bbox.max.z`, a ponta
 * do CHASSI — 1,6 m ATRÁS da quinta roda. Usá-lo como datum de folga empurraria
 * o implemento 2,4 m para trás em todo modelo. E `rearBody.profile` é `null` em
 * todas as 53 entradas. O manifesto tem os números que não mudam; este aqui muda
 * com a malha carregada, então é medido.
 *
 * Bandas de 100 mm, e cada uma guarda o z MÍNIMO (o mais traseiro) daquela
 * altura. É o perfil que um escalar não expressa: longarina, parede do leito e
 * defletor de teto ficam em z diferentes em alturas diferentes.
 */
const REAR_PROFILE_BAND = 0.10;

/**
 * A ESCADA DE LARGURAS, em meia-largura (m). Ver `TractorHitch.rearProfiles`.
 *
 * Os dois degraus que fazem trabalho hoje são o de 1,05 m — que cobre o Thermo
 * King (1,996 m de largura, meia 0,998) sem alcançar a asa, que começa por
 * volta de 1,0 — e o mais largo, que é a testeira. Os outros existem para que a
 * escolha continue certa se a unidade ou o baú mudarem de medida: `profileFor()`
 * toma o primeiro degrau que ainda cobre o obstáculo, e um degrau a mais só
 * torna a resposta mais justa. São cinco varreduras na mesma passada de
 * vértices, então o custo é uma comparação a mais por vértice, não uma leitura
 * a mais da malha.
 */
const REAR_PROFILE_WIDTHS = [0.75, 1.05, 1.20, 1.35, 1.60] as const;

function measureCabRearProfiles(
  cab: THREE.Object3D, h: TractorHitch,
): { wide: Profile; ladder: { halfWidth: number; profile: Profile }[] } {
  cab.updateWorldMatrix(true, true);
  const cos = Math.cos(h.orientYaw), sin = Math.sin(h.orientYaw);
  const v = new THREE.Vector3();
  /* Um mapa por degrau, mais o largo no fim. */
  const bands = REAR_PROFILE_WIDTHS.map(() => new Map<number, number>());
  const wide = new Map<number, number>();
  cab.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.visible) return;
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      /* N(p, h) — a mesma normalização do solver, aplicada vértice a vértice.
         Nenhuma caixa envolvente entra aqui. */
      const dx = v.x - h.centerX;
      const ny = v.y - h.groundY;
      const nz = -dx * sin + v.z * cos;
      /* O x NORMALIZADO, que faltava: sem ele não há como perguntar "o que está
         atrás DENTRO desta largura", e a asa entrava na conta do Thermo King. */
      const nx = dx * cos + v.z * sin;
      const ax = Math.abs(nx);
      const b = Math.floor(ny / REAR_PROFILE_BAND);
      const cur = wide.get(b);
      if (cur === undefined || nz < cur) wide.set(b, nz);
      for (let k = 0; k < REAR_PROFILE_WIDTHS.length; k++) {
        if (ax > REAR_PROFILE_WIDTHS[k]) continue;
        const m = bands[k];
        const c = m.get(b);
        if (c === undefined || nz < c) m.set(b, nz);
      }
    }
  });
  const toProfile = (m: Map<number, number>): Profile => [...m.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([b, z]) => ({ y: (b + 0.5) * REAR_PROFILE_BAND, z }));
  return {
    wide: toProfile(wide),
    ladder: REAR_PROFILE_WIDTHS
      .map((halfWidth, k) => ({ halfWidth, profile: toProfile(bands[k]) }))
      /* Um degrau que não pegou vértice nenhum não é "sem obstáculo": é uma
         medida que não existe, e devolvê-la daria folga infinita. */
      .filter((s) => s.profile.length > 0),
  };
}

/** Escreve a pose normalizada de uma raiz. Congelada: `updateMatrix()` é lei. */
function applyRootPose(
  root: THREE.Object3D, p: { yaw: number; x: number; y: number; z: number; pitchX?: number },
) {
  root.rotation.set(p.pitchX ?? 0, p.yaw, 0);
  root.position.set(p.x, p.y, p.z);
  root.updateMatrix();
  root.updateWorldMatrix(true, true);
}

/**
 * Aparafusa o pino-rei no furo que ESTE cavalo pede, e devolve o lado
 * implemento já remedido.
 *
 * A chapa do baú é furada para duas posições, 800 mm entre elas. Quem decide é
 * `pickKingpinStation()`, em `coupling.ts`, sobre a geometria dos dois lados —
 * e a razão de a escolha existir está no cabeçalho de lá. Aqui só há a
 * ORQUESTRAÇÃO, que tem três exigências e nenhuma delas é opcional:
 *
 *  1. **A fusão tem de estar solta.** `vehicle/merge.ts` assa os triângulos das
 *     origens num balde por material e esconde as origens; mover uma origem com
 *     o balde de pé não muda um pixel — o pino ficaria no lugar velho na
 *     imagem e no lugar novo na medida, que é o pior dos dois mundos. O guarda
 *     de geometria (`setGeometryGuard`) é o mesmo par solta/refaz que
 *     `setTrailerDims()` usa, e ele é reentrante por construção: chamado com a
 *     fusão já solta, `mergeMode()` devolve `off` e o retomar não faz nada.
 *
 *  2. **Na POSE DE CARGA.** A remedição no fim de `setKingpinStation()` compara
 *     vértices contra `profile.z0/z1/floorY`, que vivem no referencial da raiz.
 *     Com o conjunto engatado — `rigGroup` a 22 m, girado 180° e com a
 *     inclinação de engate em X — a janela de busca não pega vértice nenhum e a
 *     âncora volta `null` em silêncio. É a mesma armadilha que `rigMatrixOf()`
 *     documenta, e a saída é a mesma de `setTrailerDims()`: desfazer a pose,
 *     medir, e deixar `placeTrailer()` refazê-la logo abaixo.
 *
 *  3. **Só quando MUDA.** A comparação é um número contra outro e roda em todo
 *     `placeTrailer()`; o caminho caro só abre na troca de cavalo.
 */
/**
 * ⚠️ PORTÃO DE IMPLANTAÇÃO — TEMPORÁRIO, e a única coisa provisória deste
 * conserto.
 *
 * O mecanismo é geral: `pickKingpinStation()` decide por CAVALO, sobre a
 * geometria dos dois lados, e a conta fecha nas 47 cabines do catálogo (a
 * varredura está em `tools/trailer-bench/pinprobe.mjs`). O que este portão faz é
 * segurar a mudança em UM cavalo enquanto ela é avaliada no olho — 45 das 47
 * cabines mudam de furo, e trocar todas de uma vez tira a referência de
 * comparação de quem está olhando.
 *
 * PARA LIBERAR A FROTA: troque por `null`. Não há mais nada a fazer — nenhum
 * caminho depende deste recorte, e as cabines de fora dele passam por
 * `restoreMetaKingpinStation()`, que devolve o pino ao furo do bake.
 *
 * O id é o do manifesto (`hitch.json`), que é `<modelId>-<chassisId>`, então o
 * recorte é por prefixo de montadora ou de modelo: `/^volvo-fh-2021\b/` pega os
 * três chassis daquele cavalo, `/^(volvo|scania)-/` pega duas montadoras.
 */
const KINGPIN_STATION_ROLLOUT: RegExp | null = null;

function applyKingpinStation(ht: TractorHitch, hi: ImplementHitch): ImplementHitch {
  const rig = state.trailerRig;
  const stations = hi.kingpinStations ?? [];
  if (!rig || stations.length < 2) return hi;

  /* Fora do recorte, o pino VOLTA — e essa é a metade que não pode faltar. Sem
     ela, escolher um FH 2021 (que manda o pino para o furo traseiro) e em
     seguida qualquer outro cavalo deixaria o pino no furo novo com a conta feita
     no antigo: 800 mm de engate no vazio, e nada para reclamar. */
  if (KINGPIN_STATION_ROLLOUT && !KINGPIN_STATION_ROLLOUT.test(ht.id)) {
    restoreMetaKingpinStation();
    return rig.hitch ?? hi;
  }

  const pick = pickKingpinStation(ht, hi, stations, state.hitchDefaults, {
    tkDepth: state.tkDepth || 0,
    tkHalfWidth: state.tkSize ? state.tkSize.x / 2 : undefined,
  });
  if (!pick) return hi;

  if (pick.reason === 'nenhum-cabe') {
    console.warn('[engate] nenhum furo da chapa fecha a folga mínima com',
      ht.id, '— fica o de maior folga,', (pick.gap * 1000).toFixed(0), 'mm.');
  }
  if (!moveKingpinTo(pick.z)) return hi;

  console.info('[engate] furo de pino escolhido para', ht.id, '· z', pick.z.toFixed(4),
    '· balanço', pick.overhang.toFixed(3), 'm · folga', (pick.gap * 1000).toFixed(0), 'mm ·',
    pick.ranked.map((r) => `${r.z.toFixed(3)}=${(r.gap * 1000).toFixed(0)}mm`).join(' '));
  return rig.hitch ?? hi;
}

/**
 * Devolve o pino ao furo que `trailer_meta.json` mede — o mais DIANTEIRO, que é
 * onde o bake o deixou.
 *
 * Existe por causa do engate LEGADO, e é uma correção de ESTADO VAZADO, não um
 * detalhe: o caminho legado posiciona o implemento por `kingpin.zFromFront` do
 * manifesto, uma CONSTANTE de 0,879 m. Ela descreve o furo dianteiro e não tem
 * como saber que o pino andou. Sem esta linha, escolher um Volvo (que manda o
 * pino para o furo traseiro) e em seguida um `vw-constellation` (que não tem
 * entrada em `hitch.json`) deixaria o implemento 800 mm fora do lugar — com o
 * pino desenhado num furo e a conta feita no outro, e nada para reclamar.
 *
 * A alternativa seria o legado medir o pino em vez de ler a constante. Não é
 * este o lugar de refazê-lo: ele existe para as cabines sem manifesto e a saída
 * de verdade para elas é ENTRAR no manifesto.
 */
function restoreMetaKingpinStation(): void {
  const rig = state.trailerRig;
  const stations = rig?.kingpinStations ?? [];
  if (!rig || stations.length < 2) return;
  const frente = stations.reduce((a, b) => (b.z > a.z ? b : a));
  moveKingpinTo(frente.z);
}

/**
 * A ORQUESTRAÇÃO da troca de furo — o que `TrailerRig.setKingpinStation()` exige
 * do chamador, num lugar só. São três exigências e nenhuma é opcional:
 *
 *  1. **A fusão tem de estar solta.** `vehicle/merge.ts` assa os triângulos das
 *     origens num balde por material e esconde as origens; mover uma origem com
 *     o balde de pé não muda um pixel — o pino ficaria no lugar velho na imagem
 *     e no lugar novo na medida, que é o pior dos dois mundos. O guarda de
 *     geometria (`setGeometryGuard`) é o mesmo par solta/refaz de
 *     `setTrailerDims()`, e ele é reentrante por construção: chamado com a fusão
 *     já solta, `mergeMode()` devolve `off` e o retomar não faz nada.
 *
 *  2. **Na POSE DE CARGA.** A remedição no fim de `setKingpinStation()` compara
 *     vértices contra `profile.z0/z1/floorY`, que vivem no referencial da raiz.
 *     Com o conjunto engatado — `rigGroup` a 22 m, girado 180° e com a
 *     inclinação de engate em X — a janela de busca não pega vértice nenhum e a
 *     âncora volta `null` em silêncio. É a mesma armadilha que `rigMatrixOf()`
 *     documenta, e a saída é a de `setTrailerDims()`: desfazer a pose, medir, e
 *     deixar `placeTrailer()` refazê-la logo abaixo. Por isso esta função só
 *     pode ser chamada de dentro de `placeTrailer()`.
 *
 *  3. **Só quando MUDA.** A comparação é um número contra outro e roda em todo
 *     `placeTrailer()`; o caminho caro só abre na troca de cavalo.
 */
function moveKingpinTo(z: number): boolean {
  const rig = state.trailerRig;
  const t = state.trailer;
  const base = state.trailerBase;
  if (!rig || !t || !base) return false;
  const cur = rig.kingpinStationZ;
  if (cur === null || Math.abs(z - cur) < 1e-4) return false;

  const retomarGeometria = geometryGuard ? geometryGuard() : null;
  try {
    setRigPlacement(false);
    t.rotation.set(0, 0, 0);
    t.position.copy(base.pos);
    t.updateMatrix();
    t.updateWorldMatrix(true, true);
    return rig.setKingpinStation(z);
  } finally {
    retomarGeometria?.();
  }
}

/**
 * Resolve e aplica o engate. Fim de TODO caminho que mexe no conjunto — carga
 * de cabine, de implemento, do Thermo King e resize —, e por isso é aqui que o
 * lugar do conjunto no cenário volta a valer (ver `rigGroup`), inclusive nas
 * saídas antecipadas: sair daqui com o conjunto na origem deixaria o caminhão
 * no lugar errado até a próxima carga.
 *
 * O nome ficou `placeTrailer` porque é o que os chamadores conhecem, mas ela
 * posiciona AS DUAS metades: a âncora do conjunto é a garganta do acoplador, e
 * quem a leva até a origem é o cavalo.
 */
export function placeTrailer() {
  const t = state.trailer;
  const cab = state.cab;
  const ht = state.cabHitch;
  let hi = state.trailerRig ? state.trailerRig.hitch : null;

  /* O FURO DE PINO É ESCOLHIDO ANTES DE RESOLVER, e é a primeira decisão do
     engate porque é a única que muda a GEOMETRIA.

     A condição é a MESMA do `if` abaixo, de propósito: `applyKingpinStation()`
     desfaz a pose do conjunto para medir e conta com quem a refaça. Entrar aqui
     num caso em que o bloco abaixo não roda deixaria o implemento parado na pose
     de carga — o caminhão no lugar errado até a próxima carga, que é exatamente
     o que o cabeçalho de `placeTrailer()` avisa. */
  if (ht && hi && cab && t) hi = applyKingpinStation(ht, hi);

  if (ht && hi && cab && t) {
    const sol = solveCoupling(ht, hi, state.hitchDefaults, {
      tkDepth: state.tkDepth || 0,
      tkHalfWidth: state.tkSize ? state.tkSize.x / 2 : undefined,
      /* Reporta e MANTÉM O ENGATE. Recuar o implemento por causa de folga é
         desengatar o pino — o defeito que este módulo existe para apagar. */
      onClearanceFail: 'report',
    });
    state.coupled = sol;

    applyRootPose(cab, sol.tractor);
    /* Os controles manuais de engate estão zerados e continuam existindo como
       ajuste EXPLÍCITO do usuário; entram por fora da solução, nunca dentro. */
    applyRootPose(t, {
      ...sol.implement,
      y: sol.implement.y + state.coupling.y,
      z: sol.implement.z + state.coupling.z,
    });

    for (const r of sol.reports) {
      const say = r.kind === 'low-confidence' ? console.info : console.warn;
      say('[engate]', r.message);
    }
    setRigPlacement(true);
    return;
  }

  /* DEGRADAÇÃO — só para cabine sem entrada em `hitch.json` (as quatro do
     `cabs.json` antigo). Não é o caminho principal e diz que não é: acopla pelo
     par `cabs.json` + `trailer_meta.json`, que vivem no referencial pós-
     `groundAndCenter` e só valem para aquelas quatro. */
  /* A SOLUÇÃO ANTERIOR MORRE AQUI. Ela é de OUTRO caminhão: sair daqui com ela
     de pé faz a HUD, a sonda e qualquer verificação lerem o engate do modelo
     passado como se fosse o deste. Foi assim que uma varredura no app mostrou
     seis chassis "resolvidos" que nunca tinham passado pelo solver. */
  state.coupled = null;
  if (!t || !state.trailerBase) { setRigPlacement(true); return; }
  /* O pino volta ao furo do manifesto ANTES da conta legada, que o lê de uma
     constante e não teria como saber que ele andou. Ver `restoreMetaKingpinStation()`. */
  restoreMetaKingpinStation();
  /* Uma vez POR CABINE, não uma vez por página: com um único `legacyWarned`
     global a segunda cabine sem manifesto caía no legado em silêncio. */
  if (legacyWarnedFor !== state.cabId) {
    legacyWarnedFor = state.cabId;
    console.warn('[engate] sem entrada em hitch.json para', state.cabId,
      '— engate LEGADO (cabs.json + trailer_meta.json). Sem teste de perfil,',
      'sem teste de varredura, e a inclinação usa o bogie medido por malha.');
  }
  const kp = state.trailerMeta?.kingpin;
  const fw = state.cabDef?.fifthwheel;
  let frontZ = LEGACY_TRAILER_FRONT_Z, lift = 0;
  if (kp && fw && typeof fw.z === 'number') {
    frontZ = fw.z + kp.zFromFront;
    if (typeof fw.topY === 'number' && typeof kp.plateBottomY === 'number') {
      lift = fw.topY - kp.plateBottomY;
    }
  }
  t.rotation.x = 0;                       // re-derivado abaixo; nunca acumula
  t.position.copy(state.trailerBase.pos);
  t.position.z += (frontZ + state.coupling.z) - state.trailerBase.frontZ;
  /* Sem `Math.max(0, …)`: o caso negativo vira INCLINAÇÃO logo abaixo, e é
     exatamente ele que produzia os 91 mm de vão. */
  t.position.y += (lift >= 0 ? lift : 0) + state.coupling.y;

  const halfSpan = state.trailerTyreHalfSpan ?? 0;
  const arm = (state.trailerPivotFromFront ?? 0) - (kp?.zFromFront ?? 0);
  const armEff = arm - halfSpan;
  if (lift < -0.001 && armEff > state.hitchDefaults.minPitchArm) {
    const theta = Math.asin(THREE.MathUtils.clamp(
      -lift / armEff, 0, Math.sin(state.hitchDefaults.maxCouplingPitchRad)));
    const pivotZ = (frontZ + state.coupling.z) - (state.trailerPivotFromFront as number);
    const p0 = t.position.clone();
    const pivot = new THREE.Vector3(p0.x, 0, pivotZ);      // y = 0: a mancha de contato
    const local = pivot.clone().sub(p0);
    t.rotation.x = theta;
    const moved = local.applyMatrix4(new THREE.Matrix4().makeRotationX(theta)).add(p0);
    t.position.add(pivot.sub(moved));
    t.position.y += halfSpan * Math.sin(theta);            // bogie de volta ao chão
  } else if (lift < -0.001) {
    t.position.y += lift;
    console.warn('[engate] braço curto no caminho legado: o casamento do pino virou queda de',
      (lift * 1000).toFixed(0), 'mm.');
  }
  t.updateMatrix();
  t.updateWorldMatrix(true, true);
  setRigPlacement(true);
  /* A PATOLA REAGE À POSE, e é aqui que a pose acaba de mudar.
     A queda dela é resolvida em espaço de MUNDO (ver A QUEDA É MEDIDA NO MUNDO
     em `vehicle/landing-gear.ts`) porque a INCLINAÇÃO de engate escrita logo
     acima vale 54 mm de altura sob a patola — e essa inclinação muda com a
     cabine (a altura da quinta roda é por bake) e com todo `setTrailerDims()`.
     Sem esta linha, a chapa ficaria correta até a primeira troca de caminhão e
     depois nasceria enterrada, sem nada avisar. Não faz nada antes de
     `buildLandingGear()` ter rodado. */
  setLandingGearDown(vehicleView === 'trailer');
}

let legacyWarnedFor: string | null = null;
