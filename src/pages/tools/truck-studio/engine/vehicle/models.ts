/* Manifest loading, model loading (cabs declaring format 'fbx-scania' come from
   the ORIGINAL FBX via FBXLoader with runtime material treatment; trailer +
   volvo = curated GLBs), cab switching, grounding, coupling. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { scene, onRig, invalidate } from '../scene/scene';
import {
  makePaintMaterial, forgetPaintMaterial, setPaint, isPaintMaterial,
} from './paint';
import { captureReflectionProbe } from '../scene/probe';
import { VEHICLES_DIR, DRACO_DECODER_DIR } from '../core/paths';
import { assetUrl } from '../catalog/catalog';
import type { Rig } from '../scene/presets';
import { TrailerRig, type TrailerDims } from './trailer-rig';
import {
  solveCoupling, findTractor, defaultsOf, FALLBACK_DEFAULTS,
  type TractorHitch, type HitchManifest, type CouplingSolution,
  type CouplingDefaults, type Profile,
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
   caminhão aponta para o -Z, então recuar (dar ré) é aumentar z. 22 = os 12 da
   primeira posição mais os 10 de recuo. */
export const RIG_PLACEMENT = { z: 22, yaw: Math.PI };

/** Liga (true) ou suspende (false) o lugar do conjunto no cenário. */
function setRigPlacement(on: boolean) {
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
const loader = new GLTFLoader().setDRACOLoader(draco);
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

/* ---------------- material / mesh setup ---------------- */
const GLASS_RE = /glass|vidro|windshield|window|winscreen|cristal|glazing/i;

/* ---------------- QUEM ACEITA TINTA, e por que não é mais só o nome --------
   `nome.includes('carpaint')` era uma verdade sobre TRÊS geometrias curadas —
   as de `models/vehicles/`, cujo bake RENOMEIA o corpo para `carpaint` porque
   ali o nome do material é FUNCIONAL (ver o cabeçalho de tools/iveco-bake).
   As 49 cabines de `models/trucks/` nunca passaram por esse renomeio: são rips
   SCS/ETS2 no padrão `<peça>_mat_<NNNN>_<textura-fonte>`, e a chapa pintável se
   chama `plain_grey`, `color` ou `carpaint*` conforme o ano do modelo.

   MEDIDO nos 49 arquivos: pelo nome, 26 deles não têm UM material de tinta —
   escolher uma cor não muda absolutamente nada — e entre os 23 restantes o
   casamento às vezes pega só a capa do retrovisor (DAF XF Euro6) ou só a saia
   lateral (Iveco Hi-Way).

   ENTÃO A PERGUNTA MUDA DE "COMO SE CHAMA" PARA "QUE SHADER É". Toda tinta de
   caminhão da SCS sai do exportador com a mesma assinatura, e ela sobrevive ao
   renomeio de qualquer pipeline: KHR_materials_clearcoat com fator 1, roughness
   0,089 e metalness 0,15 ou 0,55. Conferido contra os 49 arquivos: acerta 100%
   dos materiais que hoje casam por `carpaint` e encontra o equivalente exato
   nos 26 que não casavam nada.

   O nome CONTINUA valendo, em OU — este teste é um SUPERCONJUNTO do anterior,
   de propósito. Nada que pinta hoje deixa de pintar; o que era invisível passa
   a ser alcançado. Vidro fica de fora explicitamente: ele também pode sair com
   clearcoat, e pintar a janela seria pior que não pintar a lataria. */
const PAINT_ROUGHNESS = 0.089;
const PAINT_METALNESS = [0.15, 0.55];
const PAINT_TOL = 0.02;

/** A assinatura do shader de tinta da SCS, independente de como o bake nomeou. */
function looksLikeTruckPaint(m: THREE.Material): boolean {
  const p = m as THREE.MeshPhysicalMaterial;
  /* `clearcoat` só existe em MeshPhysicalMaterial — o GLTFLoader promove o
     material a Physical justamente quando a extensão está presente, então esta
     checagem é a leitura do KHR_materials_clearcoat depois do parse. */
  if (typeof p.clearcoat !== 'number' || p.clearcoat < 0.9) return false;
  if (Math.abs((p.roughness ?? 1) - PAINT_ROUGHNESS) > PAINT_TOL) return false;
  return PAINT_METALNESS.some((v) => Math.abs((p.metalness ?? 0) - v) <= PAINT_TOL);
}

/**
 * Este material recebe a tinta do configurador?
 *
 * `authored` (de `paintMaterials`, no brands.json) é EXCLUSIVO quando existe:
 * uma lista escrita à mão é a medição daquele bake específico e não pode ser
 * sobreposta por convenção nenhuma. E `[]` é uma declaração legítima — "esta
 * geometria não tem lataria pintável" —, não um pedido de padrão; por isso o
 * teste é a presença da lista, não o seu tamanho.
 */
export function isPaintableMaterial(
  m: THREE.Material | null | undefined, authored?: string[] | null,
): boolean {
  if (!m) return false;
  const name = (m.name || '').toLowerCase();
  if (GLASS_RE.test(name)) return false;
  if (authored) return authored.some((s) => name.includes(s.toLowerCase()));
  if (name.includes('carpaint')) return true;
  return looksLikeTruckPaint(m);
}

/** Todo nome de material sob uma raiz — o que um diagnóstico precisa para
 *  dizer, no console, como ESTE bake chama as coisas. */
function materialNamesOf(root: THREE.Object3D): string[] {
  const out = new Set<string>();
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.material) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (m) out.add(m.name || '(sem nome)');
    }
  });
  return [...out].sort();
}

/* ANISOTROPY ON EVERY SLOT, not only on the albedo.
   ---------------------------------------------------------------------------
   The flanks of a tractor-trailer are what the camera spends its whole orbit
   looking at edge-on, and a grazing angle is the one case where trilinear
   filtering collapses: the mip level chosen for the axis that is compressed in
   screen space blurs the axis that is not, along with it. `map` was already at
   8, so the ALBEDO stayed sharp down the length of the truck — but normalMap,
   roughnessMap and metalnessMap kept the default of 1, and those are the maps
   that carry the micro-detail the specular lobe is built from. The panel grain,
   the scuffing, the brushed direction on the rails: all of it smeared into a
   flat wash a few metres out while the paint under it stayed crisp.

   That is a LIGHTING difference, not a texture nicety, and it is a quality gain
   rather than an optimisation — it costs sampler bandwidth and nothing else.
   No `needsUpdate` is needed: this runs before the first render, so the textures
   have not been uploaded yet and the value is read at upload time. three clamps
   it to the device's own maximum there too, so 8 is a ceiling, never a demand. */
const TEXTURE_ANISOTROPY = 8;

/* SHADOW CASTERS ARE CHOSEN BY SIZE — and here is the arithmetic, so the number
   below survives the next person who reads it.
   ---------------------------------------------------------------------------
   The key light is a 3072² shadow map over a ±24 m ortho frustum (scene/scene.ts
   spells out why those two numbers are what they are): 3072 / 48 = 64 texels per
   metre, i.e. 1.56 cm per texel. It renders through PCFSoftShadowMap with
   `shadow.radius` running 2–12, so even at the TIGHTEST rig setting the filter
   kernel spans roughly five texels — about 7.8 cm — and every sample it averages
   is a sample of mostly-not-this-object.

   An occluder whose world diameter is smaller than that kernel therefore cannot
   put a visible shadow anywhere: whatever depth it writes is diluted below the
   quantisation of the filtered result before it can reach a pixel. Drawing it
   into the shadow map is pure cost with a provably empty output.

   MEASURED on trailer.glb by walking its node hierarchy and applying each node's
   world transform to its POSITION accessor bounds — 5852 nodes, 2151 of them
   carrying a mesh, 2157 three.js Mesh objects once multi-primitive meshes are
   split, 5.31 M triangles in total. At least 640 of those meshes come out under
   5 cm across, carrying 788 k triangles — 29.7 % of the meshes and 14.8 % of the
   triangles — and 483 of the 640 are literally named
   `stitch_result_stitch_all_parafusos_*`. "At least", because that measurement
   uses the diagonal of each primitive's local box as the sphere diameter, which
   is an UPPER bound on the radius `computeBoundingSphere()` actually derives
   from the vertices; the runtime figure can only be higher.

   So this removes ~640+ draw calls and ~0.79 M triangles from every shadow pass.
   "Every pass" is not "every frame" here: the renderer runs with
   `shadowMap.autoUpdate = false`, so it means every load, every scenario change,
   and every frame of a time-of-day drag — which is exactly where the frame time
   is already worst.

   5 cm sits below the 7.8 cm kernel with margin, so the cut is invisible by
   construction and not merely by inspection. `receiveShadow` stays TRUE on
   everything: a bolt is far too small to cast a shadow and exactly the right
   size to be sitting in the truck's. */
const SHADOW_CASTER_MIN_M = 0.05;

const _casterSphere = new THREE.Sphere();

/**
 * Decide quem projeta sombra, pelo tamanho em ESPAÇO DE MUNDO.
 *
 * A medida tem de ser em MUNDO, nunca na geometria local, e não é teoria: a
 * Scania chega do FBXLoader nas unidades da rip e é reescalada por ~1/100 na
 * raiz (ver loadScaniaOriginal), e o próprio implemento traz nós com escala de
 * maior eixo indo de 0,0012 a 1,0022 — três ordens de grandeza dentro do mesmo
 * arquivo. Um diâmetro local aqui não erraria por pouco: ele diria que um
 * parafuso tem metros.
 */
function setShadowCasters(root: THREE.Object3D) {
  /* setupCommon() roda ANTES de a raiz entrar no grupo dela, e os carregadores
     deixam `matrixWorld` por escrever (o GLTFLoader compõe `matrix` e para por
     aí). Sem esta linha toda esfera abaixo voltaria medida pela identidade.
     Solta do grafo, "mundo" é o espaço da própria raiz — que é onde a escala da
     raiz vive, e é essa a escala que importa. */
  root.updateMatrixWorld(true);
  /* O computeBoundingSphere() abaixo não é trabalho NOVO: o three já o faria,
     preguiçosamente, na primeira vez que o frustum testasse cada malha — ou
     seja, no primeiro quadro. Fazê-lo aqui só o move para dentro da cortina de
     carregamento, onde ninguém está olhando o contador de quadros. E ele lê o
     atributo de posição, não o índice, então continua correto depois de
     buildLiveryPanels() reescrever índices (os vértices ficam onde estão). */
  let cast = 0, skip = 0;
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    o.receiveShadow = true;
    const g = o.geometry;
    if (!g) { o.castShadow = false; return; }
    if (!g.boundingSphere) g.computeBoundingSphere();
    const bs = g.boundingSphere;
    /* Geometria degenerada ou com NaN: continua projetando. A falha barata é uma
       chamada de desenho desperdiçada; a cara é uma sombra que sumiu. */
    if (!bs || !Number.isFinite(bs.radius)) { o.castShadow = true; cast++; return; }
    /* Sphere.applyMatrix4 escala o raio pelo maior fator de escala da matriz —
       é a conversão para mundo que interessa aqui. */
    const diameter = _casterSphere.copy(bs).applyMatrix4(o.matrixWorld).radius * 2;
    o.castShadow = diameter >= SHADOW_CASTER_MIN_M;
    if (o.castShadow) cast++; else skip++;
  });
  if (skip) {
    console.info('[sombra] emissores:', cast, '· descartados', skip,
      `(< ${SHADOW_CASTER_MIN_M * 100} cm — abaixo do filtro PCF de ~7,8 cm)`);
  }
}

export function setupCommon(root: THREE.Object3D) {
  setShadowCasters(root);
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const raw of mats) {
      if (!raw) continue;
      /* The GLBs and the FBX rip both arrive as MeshStandard/MeshPhysical, so
         the PBR slots below always exist; `Material` is just the widest type
         `Mesh.material` can be declared as. */
      const m = raw as THREE.MeshStandardMaterial;
      m.envMapIntensity = 1.35;
      for (const tex of [m.map, m.normalMap, m.roughnessMap, m.metalnessMap]) {
        if (tex) tex.anisotropy = TEXTURE_ANISOTROPY;
      }
      const isGlass = GLASS_RE.test(m.name || '');
      if (isGlass) {
        m.transparent = true;
        m.depthWrite = false;
        m.roughness = Math.min(m.roughness ?? 1, 0.12);
        o.renderOrder = Math.max(o.renderOrder, 20);   // glass last, over the body
      } else if (m.transparent) {
        if ((m.opacity ?? 1) >= 0.99 && !m.alphaMap) {
          // Body panels / decals wrongly flagged transparent: keep texture alpha
          // (alphaTest) but WRITE depth — depthWrite=false here is what made the
          // cab look foggy/blurred (interior blending through the shell).
          m.depthWrite = true;
          m.alphaTest = Math.max(m.alphaTest || 0, 0.02);
        } else {
          m.depthWrite = false;
          /* A genuinely see-through surface that does NOT write depth has to be
             drawn after everything it covers, and GLASS_RE alone does not find
             them all: the trailer's rear lamp cover is `lente-sinaleita-traseira`
             — no "glass"/"vidro" in the name — so it kept renderOrder 0 while the
             marker-lamp cover beside it (`vidro-lanternas-pisca`) got 20. Two
             covers on the same lamp cluster, sorted into different passes, is
             what made the rear lamps flicker between angles. The rule that
             matters is the one about DEPTH, not about the word in the name: no
             depth write ⇒ draw last. */
          o.renderOrder = Math.max(o.renderOrder, 20);
        }
      }
    }
  });
}

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
   removes that possibility. */
const WHITE_BODY_RE = /cor_padrao_branco/i;

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
  return (o: THREE.Mesh) => {
    if (!o.visible) return false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    return mats.some((m) => !!m && WHITE_BODY_RE.test(m.name || ''));
  };
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
function disposeTree(root: THREE.Object3D) {
  const shared = !!root.userData?.tsSharedSource;
  root.traverse((node) => {
    const o = node as THREE.Mesh;
    if (o.geometry && !shared) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
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
      /* As três chapas RECORTADAS pelo bake, que já vêm com nome próprio. */
      if (/^(SIDE_L|SIDE_R|REAR)$/.test(o.name)) { out.push(o); return; }
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
      if (mats.some((m) => m && (m.name || '').toLowerCase().includes(BODY_WHITE_MAT))) {
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
  const sideBox = bboxOfMatching(state.trailer, bodyPanelPred(state.trailer));
  const zLim = sideBox.max.z - 0.5;                  // generous front slab
  const sources: THREE.Mesh[] = [];
  state.trailer.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || /^(SIDE_L|SIDE_R|REAR)$/.test(o.name)) return;
    /* Mesmo motivo de buildLiveryPanels(): as chapas brancas originais seguem
       na cena, só escondidas por `TrailerBody`. Extrair a parede dianteira de
       uma delas desenharia a tinta na altura de fábrica. */
    if (!o.visible) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some(isWhiteBodyMat)) sources.push(o);
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
    for (const mesh of meshes) {
      if (!mesh.userData.origMat) mesh.userData.origMat = mesh.material;
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

  /* Trocar o alvo da tinta troca MATERIAL em malhas que já estão na cena, sem
     passar por nenhum carregamento — então nada mais avisaria o laço
     sob demanda de que o quadro mudou. É o gap #2 da lista em scene.ts.
     Chamado no fim porque o overlay da parede dianteira também é refeito
     acima, e um invalidate() antes dele perderia esse desenho. */
  invalidate();
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
      if (om) { om.colorSpace = THREE.SRGBColorSpace; om.anisotropy = TEXTURE_ANISOTROPY; }
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
    hitchEntry.rearProfile = measureCabRearProfile(cab, hitchEntry);
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
          const paint = makePaintMaterial(m.color, m.map);
          paint.name = m.name;
          cache.set(m.uuid, paint);
          painted.push(m.name || '(sem nome)');
          return paint;
        }
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
  /* Newly created paint materials register themselves with vehicle/paint.ts, so a
     re-apply pushes the CURRENT parameters onto them — the imported colour is
     never used, and a cab swap keeps whatever the user had configured. */
  setPaint({});
  reapplyVehicleWetness();     // a freshly loaded cab starts dry otherwise
  placeTrailer();
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
/* Large mill-finish members: rails, posts, frame, hardware. Every one is
   `metalness: 1`, so each is a mirror of the environment until told otherwise. */
const TRAILER_STRUCT_METAL_RE = /galvanizado|estrutura-principal|^inox|metal-pouco-polido|metal-claro|^aro-rodas/i;

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

/** The exporter's layout, vertex for vertex — see exportTrailer.js addLiveryUV.
 *  v runs DOWNWARDS because the CanvasTexture is built with flipY = false; u runs
 *  the way each panel reads from outside, which is mirrored between the flanks.
 *  Get either backwards and the artwork is a legible mirror image. */
function addLiveryUV(geo: THREE.BufferGeometry, key: 'SIDE_L' | 'SIDE_R' | 'REAR') {
  geo.computeBoundingBox();
  const b = geo.boundingBox as THREE.Box3;
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const spanX = Math.max(1e-6, b.max.x - b.min.x);
  const spanY = Math.max(1e-6, b.max.y - b.min.y);
  const spanZ = Math.max(1e-6, b.max.z - b.min.z);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    uv[i * 2] = key === 'SIDE_L' ? (z - b.min.z) / spanZ
      : key === 'SIDE_R' ? (b.max.z - z) / spanZ
        : (b.max.x - x) / spanX;
    uv[i * 2 + 1] = (b.max.y - y) / spanY;
  }
  geo.setAttribute('uv1', new THREE.BufferAttribute(uv, 2));
}

function buildLiveryPanels(trailer: THREE.Object3D) {
  let already = false;
  trailer.traverse((node) => {
    const o = node as THREE.Mesh;
    if (o.isMesh && /^(SIDE_L|SIDE_R|REAR)$/.test(o.name)) already = true;
  });
  if (already) return;                         // merged bake: the exporter did it

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
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.some((m) => !!m && WHITE_BODY_RE.test(m.name || ''))) sources.push(o);
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

  const keep: Record<'SIDE_L' | 'SIDE_R' | 'REAR', { p: number[]; n: number[]; u: number[] }> = {
    SIDE_L: { p: [], n: [], u: [] }, SIDE_R: { p: [], n: [], u: [] }, REAR: { p: [], n: [], u: [] },
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
      let where: 'SIDE_L' | 'SIDE_R' | 'REAR' | null = null;
      if (Math.min(a.x, b2.x, c.x) >= box.max.x - LIVERY_SKIN_SIDE) where = 'SIDE_R';
      else if (Math.max(a.x, b2.x, c.x) <= box.min.x + LIVERY_SKIN_SIDE) where = 'SIDE_L';
      if (!where && Math.max(a.z, b2.z, c.z) <= box.min.z + LIVERY_SKIN_REAR) {
        e1.subVectors(b2, a); e2.subVectors(c, a);
        fn.crossVectors(e1, e2).normalize();
        /* abs(): ~0.2 % of these ripped triangles are wound backwards, so the
           sign of the face normal proves nothing about which way it faces. */
        if (Math.abs(fn.z) >= 0.7) where = 'REAR';
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

  const srcMat = (Array.isArray(sources[0].material) ? sources[0].material[0] : sources[0].material) as THREE.MeshStandardMaterial;
  const report: string[] = [];
  for (const key of ['SIDE_L', 'SIDE_R', 'REAR'] as const) {
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
    report.push(`${key}: ${k.p.length / 9} tris`);
  }
  console.info('[livery] chapas recortadas do corpo —', report.join(' · '),
    `· ${strippedTris} triângulos removidos de ${strippedMeshes} malhas de origem`);
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

/** Materiais que pertencem à CENA e não a uma chapa: sobrevivem ao descarte. */
const isSharedMat = (m: THREE.Material | null | undefined) =>
  !!m && (m === (state.trailerPaintMat as THREE.Material | null)
    || m === (state.frontWallMat as THREE.Material | null));

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
    if (o.isMesh && /^(SIDE_L|SIDE_R|REAR)$/.test(o.name)) doomed.push(o);
  });
  for (const panel of doomed) {
    panel.traverse((node) => {
      const o = node as THREE.Mesh;
      if (o === panel || !o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      for (const m of mats) if (!isSharedMat(m)) { forgetPaintMaterial(m); m.dispose(); }
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
  const bodyGeo = rig.body.mesh.geometry as THREE.BufferGeometry;
  bodyGeo.setIndex(null);
  bodyGeo.clearGroups();

  const dims = rig.set(patch);

  /* 3. As chapas antigas saem, as novas são recortadas do corpo novo. A ordem
        importa duas vezes: buildLiveryPanels() desiste se já achar uma malha
        SIDE_L/SIDE_R/REAR, e as chapas antigas carregam o mesmo material branco
        das de origem — deixadas na cena, entrariam como fonte do próprio
        recorte. */
  disposeLiveryPanels(t);
  disposeFrontWallOverlays();
  buildLiveryPanels(t);

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

  invalidate();
  console.info('[baú] redimensionado —',
    `${dims.length.toFixed(3)} × ${dims.height.toFixed(3)} m ·`,
    rig.ribs.count, 'frisos · testeira z', box.max.z.toFixed(3));
  return dims;
}

/** Volta o baú às medidas de fábrica. */
export function resetTrailerDims(): TrailerDims | null {
  const rig = state.trailerRig;
  return rig ? setTrailerDims({ height: rig.base.height, length: rig.base.length }) : null;
}

/* ---------------- trailer ---------------- */
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
  /* O BAÚ PARAMÉTRICO ENTRA AQUI — depois do assentamento (as duas metades
     medem em espaço de mundo e esta é a pose de referência de toda medida
     posterior), antes do acabamento e do recorte das chapas. Ver
     buildTrailerRig() para o porquê de cada uma dessas duas fronteiras. */
  buildTrailerRig(trailer);
  applyTrailerFinish(trailer);               // AFTER setupCommon: it overrides env 1.35
  /* After grounding, before studio.ts calls livery.attachOverlays(). */
  buildLiveryPanels(trailer);
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
  await attachThermoKing();   // optional — skips gracefully if the GLB is absent
  reapplyVehicleWetness();
  /* DEPOIS do Thermo King: ele entra como filho do implemento, então congelar
     antes deixaria a unidade recompondo a matriz dela a cada quadro e — pior —
     fora da varredura, o que faria a intenção do congelamento mentir sobre o
     que está congelado. */
  freezeMatrices(trailer);
  return trailer;
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
 * A face de BAIXO da travessa que fecha o topo da testeira, em espaço de mundo.
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
  /* O FILTRO é local (é lá que `z1` significa alguma coisa); a ALTURA que sai
     daqui é de MUNDO, porque é em mundo que `placeThermoKing()` resolve a pose
     e o implemento pode estar engatado, girado e inclinado. Por isso os dois
     vetores: um vértice, dois referenciais, nenhuma conversão no fim. */
  const loc = new THREE.Vector3();
  const wld = new THREE.Vector3();
  let bestTop = -Infinity, bestUnder: number | null = null;
  trailer.traverse((node) => {
    const o = node as THREE.Mesh;
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    if (state.tk && (o === state.tk || !!state.tk.getObjectById(o.id))) return;   // a unidade não se mede
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some((m) => !!m && FRONT_RAIL_MAT_RE.test(m.name || ''))) return;
    const pos = o.geometry.attributes.position;
    let n = 0, wLo = Infinity, wHi = -Infinity, xLo = Infinity, xHi = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      wld.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      loc.copy(wld).applyMatrix4(inv);
      if (loc.z < zMin) continue;
      n++;
      if (wld.y < wLo) wLo = wld.y; if (wld.y > wHi) wHi = wld.y;
      if (loc.x < xLo) xLo = loc.x; if (loc.x > xHi) xHi = loc.x;
    }
    if (!n || xLo > -0.5 || xHi < 0.5) return;        // tem de atravessar o centro
    if (wHi > bestTop) { bestTop = wHi; bestUnder = wLo; }
  });
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
  const sideBox = bboxOfMatching(trailer, bodyPanelPred(trailer));
  if (sideBox.isEmpty()) return;
  /* Caixa da unidade na pose ATUAL: o rip não tem a origem no centro, então é
     ela que diz onde as faces estão em relação à origem do nó. */
  const b = new THREE.Box3().setFromObject(tk);
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
  /* Deslocamento pedido, em MUNDO. */
  const move = new THREE.Vector3(
    (sideBox.min.x + sideBox.max.x) / 2 - (b.min.x + b.max.x) / 2,   // centrada em X
    top - b.max.y,                                                   // topo sob o teto
    sideBox.max.z - b.min.z,                                         // costas rentes à parede
  );
  /* Mundo → local pela parte LINEAR da matriz do implemento (a diferença entre
     dois pontos elimina a translação), porque `position` mora no pai. Sem
     isso, um implemento engatado — girado 180° e inclinado — receberia o
     deslocamento no referencial errado. */
  trailer.updateWorldMatrix(true, false);
  const o0 = trailer.worldToLocal(new THREE.Vector3());
  const o1 = trailer.worldToLocal(move.clone());
  tk.position.add(o1.sub(o0));
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

function measureCabRearProfile(cab: THREE.Object3D, h: TractorHitch): Profile {
  cab.updateWorldMatrix(true, true);
  const cos = Math.cos(h.orientYaw), sin = Math.sin(h.orientYaw);
  const v = new THREE.Vector3();
  const bands = new Map<number, number>();
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
      const b = Math.floor(ny / REAR_PROFILE_BAND);
      const cur = bands.get(b);
      if (cur === undefined || nz < cur) bands.set(b, nz);
    }
  });
  return [...bands.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([b, z]) => ({ y: (b + 0.5) * REAR_PROFILE_BAND, z }));
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
  const hi = state.trailerRig ? state.trailerRig.hitch : null;

  if (ht && hi && cab && t) {
    const sol = solveCoupling(ht, hi, state.hitchDefaults, {
      tkDepth: state.tkDepth || 0,
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
}

let legacyWarnedFor: string | null = null;
