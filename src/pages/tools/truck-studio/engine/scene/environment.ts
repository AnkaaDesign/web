/* Swappable photoreal environments: an HDRI sky + image-based lighting, a real
   3D set (scene/set.ts) for the ground and everything standing on it, an
   optional street-lamp model, and the light preset toggled to match.
   ---------------------------------------------------------------------------
   This module owns the POLICY (which asset, when to load it, what to cache,
   when to dispose). scene.ts owns the mechanism and exposes exactly the hooks
   needed: setExternalEnvironment / setExposureBase / setSkyDomeVisible /
   setLamps / setLampModel / setHorizonHaze / setHorizonTint /
   setInteriorBounds, plus its PMREMGenerator. set.ts owns the .glb and, with
   it, every ground texture in the scene.

   WHAT THIS MODULE STOPPED DOING (2026-08-03), because the shape of the file
   only makes sense against it. The catalogue used to carry three PHOTO-BACKED
   scenes — `rodovia`, `patio-logistico`, `urbano`: an equirect panorama plus a
   procedural CG floor, i.e. a ground-projected dome (GroundedSkybox), a
   two-band near field with its own 2k/4k shared PBR ground sets, scattered
   props, a shadow catcher and a camera-containment clamp. Those scenes were
   removed from the manifest and every one of those mechanisms went with them.
   The two that remain — `distrito-industrial` and `armazem` — stand on
   MODELLED geometry, and set.ts binds the set's own textures from
   `set.materials.<NAME>`, an entirely separate path: this file no longer
   downloads a ground texture at all. What is left is the HDRI → PMREM path,
   the per-environment LRU that owns those PMREMs, the optional lamp .glb,
   the validation of the manifest's `set` block, and one progress bar spanning
   the three.

   WHY THE PMREM IS USED FOR scene.background TOO (and not the raw equirect)

   1. No VRAM duplication. Assign a raw equirect to scene.background and three
      builds its OWN copy behind your back: WebGLCubeMaps renders it into a
      cube render target sized image.height, or — the moment
      backgroundBlurriness > 0 — WebGLCubeUVMaps builds a SECOND PMREM with its
      own generator. Hand it a texture that is already CubeUV and
      WebGLCubeUVMaps.get() returns it untouched.
   2. envDef.backgroundBlur would otherwise be silently ignored: blurriness is
      only sampled in the ENVMAP_TYPE_CUBE_UV branch of three's backgroundCube
      shader, which a plain cube texture never reaches.
   3. It lets us dispose the source .hdr immediately — a 2k HDR is ~16 MB of
      half-float that nothing would ever sample again. (buildSkyEnv() in
      scene.ts does the same with its canvas.)
   4. Sharpness is fine: PMREM mip 0 is image.width / 4 per cube face, so a 2k
      HDRI gives 512 px faces — and a hero render wants a slightly soft sky
      behind the truck anyway.

   VRAM: the PMREM render target is 3·cubeSize x 4·cubeSize half-float RGBA
   ≈ 25 MB for a 2k source, ≈ 100 MB for a 4k one. The engine is a singleton
   that outlives the React page (see studio.ts), so the cache is capped and every
   eviction disposes the render target, not just its texture.

   ---------------------------------------------------------------------------
   THE SET IS THE GROUND  (envDef.set — scene/set.ts)

   Both shipped scenes name a `set`: a Draco'd .glb with modelled asphalt,
   kerbs, painted lines, racking and buildings. Three consequences for this
   module, and they are the reason the file is as small as it is:

     a) NO PROCEDURAL FLOOR TO ARBITRATE AGAINST. There is no dome to project
        a photo's floor over the modelled asphalt, no disc to lay on top of it,
        no 340 m strip underneath it and no shadow catcher to double the
        truck's shadow — none of those mechanisms exist any more, so there are
        no guards here either.
     b) THE SET'S TEXTURES ARE NOT OURS. `set.materials` names files per
        MATERIAL NAME, and set.ts binds them against the material names it
        actually finds in the .glb (bindMaterials()). A material named in the
        manifest but absent from the .glb is silently never fetched — which is
        exactly what makes an unused entry there free rather than a 404.
     c) THE HDRI STAYS. It is still the sky and, more importantly, still the
        IBL the paint reflects. `armazem` is the counter-example that proves it
        is optional: `hdri: null`, lit only by its own emissive strips.

   The one asset this module still downloads besides the HDRI is `lamps.model`
   — see the lamp-model section — and the set .glb, which it delegates to
   applySet() and only folds into the progress bar.
*/
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import {
  pmrem, applyPreset, setTimeOfDay,
  setExternalEnvironment, setExposureBase,
  setSkyDomeVisible, setLamps, setLampModel,
  setHorizonHaze, setHorizonTint, setInteriorBounds,
} from './scene';
import { applySet, disposeSet, disposeSetTextures } from './set';
import type { SetDef, SetMaterialDef } from './set';
import { loadGLB } from '../vehicle/models';
import { assetUrl } from '../catalog/catalog';
import type { EnvironmentDef, RawBlock } from '../catalog/catalog';

/* ---------------- tipos ----------------
   O manifesto chega tipado de catalog.ts, mas os blocos que ele repassa crus
   (`set`, `lamps`) são RawBlock: é ESTE módulo que os valida, então tudo que
   sai deles entra como `unknown` e só vira número/string depois de passar por
   num()/path(). Os tipos que este módulo constrói a partir do bloco `set`
   moram em set.ts (SetDef/SetMaterialDef) — nada aqui duplica o contrato do
   catálogo. */

const rgbeLoader = new RGBELoader();

/* O manifesto tem 2 cenários, então na prática nada é despejado — a LRU existe
   para que um manifesto editado à mão com 20 cenas não coma um gigabyte de VRAM
   pelo resto da sessão. O teto continua em 3 (e não em 2) de propósito: é uma
   folga, não uma contagem, e baixá-lo para o tamanho exato do catálogo faria a
   próxima cena adicionada despejar em toda troca. */
const MAX_CACHE = 3;

/* SÓ o PMREM. Os outros cinco campos (`sky`, `bg`, `ground`, `near`, `macro`)
   saíram em 2026-08-03 com o domo projetado e a faixa próxima: o equirect cru
   só existia para o domo amostrar, o `bg` era a foto do domo, e os três de chão
   apontavam para o cache compartilhado de conjuntos PBR que já não existe. As
   texturas do set são de set.ts, que tem o próprio descarte
   (disposeSetTextures). */
interface CacheEntry {
  rt: THREE.WebGLRenderTarget | null;
}
/** @type {Map<string, CacheEntry>} */
const cache = new Map<string, CacheEntry>();

let current: EnvironmentDef | null = null;        // the applied envDef
let seq = 0;               // guards against an out-of-order double apply

const num = (v: unknown, d: number) => (Number.isFinite(+(v as number)) ? +(v as number) : d);
const path = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/* ---------------- progress ----------------
   Weighted, because the assets differ by an order of magnitude in size and an
   unweighted bar would sit at 20 % for the whole HDRI and then jump.

   ONE UNIT ≈ ONE MEGABYTE ON THE WIRE, measured from what is actually shipped
   in public/: a 2k .hdr is 5.8 MB, a set .glb 3,5-7,4 MB, and one of the PBR
   maps a set material names ~1.2 MB on average. Keeping the ratios in bytes is
   what makes the bar move at a roughly constant rate instead of stalling on the
   biggest file. Anything already resident gets weight 0 at the call site — a
   request that never happens must not be able to hold the bar back.

   THREE CLASSES, one per thing that is still downloaded:
     W_HDRI    the equirect .hdr.
     W_SET_GLB the set .glb. Ver a nota em applyEnvironment() sobre por que ele
               é ESTIMADO e não medido, e W_MAP para cada mapa que os materiais
               do set nomeiam (baixados por set.ts, reportados por
               applySet()).
     W_PROP    o .glb do poste: um modelo autocontido, com as texturas
               embutidas e Draco. MEDIDO na leva de props que existia até
               2026-08-03: 11,2 MB em 15 assets — média 0,75, mediana 0,69,
               extremos 0,25 e 2,18 (um jogo de postes com seis mapas 1k). 0,9
               fica do lado pesado da distribuição porque um poste É um dos
               assets mais pesados daquela leva. */
const W_HDRI = 6, W_MAP = 1.2;
/* O .glb do set: 3,5 MB (armazem) a 7,4 MB (distrito), contra os 5,8 MB que
   valem W_HDRI = 6. */
const W_SET_GLB = 6;
const W_PROP = 0.9;

function makeTracker(weights: number[], onProgress: (p: number) => void) {
  const total = weights.reduce((a: number, b: number) => a + b, 0);
  const done = weights.map(() => 0);
  const emit = () => {
    if (!total) { onProgress(1); return; }
    let s = 0;
    for (let i = 0; i < weights.length; i++) s += done[i] * weights[i];
    onProgress(Math.max(0, Math.min(1, s / total)));
  };
  return {
    /* monotonic: a loader that reports total=0 then completes must not make the
       bar go backwards */
    set(i: number, f: number) { done[i] = Math.max(done[i], Math.min(1, f)); emit(); },
    emit,
  };
}

/* Content-Length is missing whenever the response is gzip/br-encoded, which is
   the normal case for a .hdr served by Vite — then lengthComputable is false
   and we simply hold until the load callback fires. */
const fraction = (e: ProgressEvent) => (e && e.lengthComputable && e.total ? e.loaded / e.total : 0);

/* ---------------- loading ---------------- */

/* Every loader in this module RESOLVES with null on failure instead of
   rejecting: a missing HDRI has to degrade to the procedural sky, never to a
   black screen, and a missing lamp .glb to the procedural primitives. */
function loadHdr(url: string, onProg: (e: ProgressEvent) => void): Promise<THREE.DataTexture | null> {
  return new Promise(resolve => {
    rgbeLoader.load(url, tex => resolve(tex), onProg, err => {
      console.warn('[truck-studio] HDRI não carregou, usando céu procedural: ' + url, err);
      resolve(null);
    });
  });
}

/* O `loadTex()` que ficava aqui saiu com o campo próximo (2026-08-03): o único
   consumidor que restava era a `backgroundImage` do domo projetado. Quem carrega
   textura hoje é set.ts, que tem o próprio loader com o espaço de cor, o
   `repeat` e o descarte do set. */

/**
 * DataTexture equirect → render target PMREM.
 *
 * O parâmetro `keep` saiu junto com o domo projetado (2026-08-03): ele existia
 * porque o GroundedSkybox amostrava o equirect DIRETO, então quem chamava
 * precisava dizer "ainda preciso desta textura". Sem domo, nada mais lê o
 * equirect depois do PMREM, e ele é sempre descartado aqui.
 */
function toPmrem(tex: THREE.Texture): THREE.WebGLRenderTarget | null {
  try {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const w = (tex.image && tex.image.width) || 0;
    if (w > 2048) {
      /* cubeSize = width/4, e o alvo é 3·cubeSize x 4·cubeSize meio-float RGBA
         — 4k na entrada são ~100 MB de saída, POR ambiente em cache. */
      console.warn('[truck-studio] HDRI de ' + w + 'px: considere 2k para o web (VRAM do PMREM cresce com o quadrado).');
    }
    const rt = pmrem.fromEquirectangular(tex);
    tex.dispose();               // nada amostra o equirect depois disto
    return rt;
  } catch (err) {
    console.warn('[truck-studio] falha ao gerar o PMREM do HDRI', err);
    try { tex.dispose(); } catch (_) { /* ignore */ }
    return null;
  }
}

/* ---------------- modelo do poste ----------------
   A fileira procedural de postes (scene/lamps.ts) desenha primitivas — mastro,
   braço e luminária — a menos que o cenário nomeie um `.glb` em `lamps.model`.
   Quando nomeia, é ESTE módulo que baixa a geometria e entrega o Object3D
   pronto; lamps.ts mede, escala e orienta o que receber.

   POR QUE UM CARREGADOR PRÓPRIO, e não o cache de props que existia aqui até
   2026-08-03: aquele cache era uma LRU compartilhada com o scatter, com
   catálogo (`props.json`), contagem de falhas, política de despejo e pinos de
   cena — tudo dimensionado para as centenas de instâncias que o scatter
   espalhava. O scatter saiu junto com os cenários de foto, e sobrou UM modelo,
   trocado no máximo uma vez por cenário. Uma promessa memoizada por URL faz o
   mesmo trabalho sem nada daquilo.

   Nunca lança: um poste que não baixa degrada para as primitivas procedurais,
   que é exatamente o que um cenário sem `lamps.model` já usa. */
const lampModels = new Map<string, Promise<THREE.Object3D | null>>();

function loadLampModel(url: string,
  onProgress?: (f: number) => void): Promise<THREE.Object3D | null> {
  const hit = lampModels.get(url);
  if (hit) return hit;
  const p = loadGLB(url, onProgress)
    .then(root => (root as THREE.Object3D) || null)
    .catch((err: unknown) => {
      console.warn('[truck-studio] modelo de poste não carregou', url, err);
      /* Memoizar a FALHA também: sem isso, cada troca de cenário tentaria de
         novo o mesmo 404 e seguraria a barra de progresso por nada. */
      return null;
    });
  lampModels.set(url, p);
  return p;
}

/* ---------------- cache ---------------- */

function disposeEntry(entry: CacheEntry | null | undefined) {
  if (!entry) return;
  /* dispose the RENDER TARGET, not just rt.texture — the texture alone leaves
     the framebuffer and its attachment allocated.
     É a única coisa que uma entrada possui: o PMREM foi gerado a partir de um
     equirect que toPmrem() já descartou, e as texturas do set pertencem a
     set.ts. */
  if (entry.rt) entry.rt.dispose();
}

function touch(id: string, entry: CacheEntry) {
  cache.delete(id);
  cache.set(id, entry);                       // Map keeps insertion order = LRU
  while (cache.size > MAX_CACHE) {
    /* `!`: o laço só roda com size > MAX_CACHE ≥ 1, então há sempre uma chave. */
    const oldest = cache.keys().next().value!;
    /* never evict what is on screen */
    if (oldest === id || (current && oldest === current.id)) break;
    disposeEntry(cache.get(oldest));
    cache.delete(oldest);
  }
}

/** Release every cached PMREM and every texture the set holds, and return the
 *  scene to procedural. */
export function disposeEnvironments() {
  setExternalEnvironment(null);
  setHorizonHaze(null);
  /* O tint sai junto com a névoa que ele colore — deixá-lo ligado tingiria a
     névoa do próximo cenário com o horizonte deste. */
  setHorizonTint(null);
  disposeSet();
  /* A fileira procedural de postes sai da cena antes de qualquer descarte de
     geometria: as luminárias são clones que COMPARTILHAM a geometria do modelo
     carregado, e descartar uma que ainda está montada renderiza lixo. */
  setLampModel(null);                 // null ⇒ volta às primitivas procedurais
  setLamps(null);                     // null ⇒ a fileira embutida
  for (const entry of cache.values()) disposeEntry(entry);
  cache.clear();
  /* Seguro aqui e em nenhum outro lugar: todo material que ainda podia apontar
     para uma destas acabou de receber o mapa procedural de volta nas chamadas
     acima. Cargas em voo NÃO são canceladas — elas resolvem para um cache de
     set já vazio, que é exatamente um cache frio. */
  disposeSetTextures();
  current = null;
}

/* ---------------- apply ---------------- */

/**
 * Valida o bloco `set` do manifesto.
 *
 * Mesma disciplina dos outros blocos crus deste módulo: catalog.ts repassa o
 * objeto sem olhar, e é AQUI que ele vira dado tipado. Um `set` sem `url` é
 * tratado como ausente — degradar para HDRI sem geometria é sempre melhor do
 * que abortar a troca de ambiente.
 *
 * @returns {SetDef|null}
 */
function resolveSet(envDef: EnvironmentDef): SetDef | null {
  const raw = envDef.set;
  if (!raw || typeof raw !== 'object') return null;
  const url = path((raw as RawBlock).url);
  if (!url) return null;

  const out: SetDef = { url };

  const rot = (raw as RawBlock).rotationY;
  if (typeof rot === 'number' && isFinite(rot)) out.rotationY = rot;
  if ((raw as RawBlock).interior === true) out.interior = true;

  const b = (raw as RawBlock).bounds;
  if (b && typeof b === 'object') {
    const bb = b as RawBlock;
    const f = (k: string, d: number) => (Number.isFinite(+(bb[k] as number)) ? +(bb[k] as number) : d);
    out.bounds = { halfX: f('halfX', 20), halfZ: f('halfZ', 20), minY: f('minY', 1), maxY: f('maxY', 10) };
  }

  const mats = (raw as RawBlock).materials;
  if (mats && typeof mats === 'object') {
    const bound: Record<string, SetMaterialDef> = {};
    for (const [name, v] of Object.entries(mats as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const m = v as RawBlock;
      const def: SetMaterialDef = {};
      for (const k of ['diffuse', 'rough', 'normal', 'ao'] as const) {
        const p = path(m[k]);
        if (p) def[k] = p;
      }
      /* `repeat` é repetição UV final, não metros por tile: o build autora UV
         em metros/`uv_scale`, então quem escolhe o tamanho do ladrilho é o
         manifesto e a conta já vem feita. 0 ou negativo cairia num
         RepeatWrapping degenerado, daí o piso. */
      if (typeof m.repeat === 'number' && m.repeat > 0) def.repeat = m.repeat;
      if (Array.isArray(m.tintRgb) && m.tintRgb.length === 3 &&
        m.tintRgb.every((n) => typeof n === 'number' && isFinite(n))) {
        def.tintRgb = m.tintRgb as [number, number, number];
      }
      if (typeof m.roughness === 'number') def.roughness = Math.min(1, Math.max(0, m.roughness));
      if (typeof m.metalness === 'number') def.metalness = Math.min(1, Math.max(0, m.metalness));
      /* ESTES TRÊS FALTAVAM, e o `envIntensity` faltava desde sempre.
         Esta função é uma LISTA BRANCA: campo do manifesto que não é copiado
         aqui não chega em set.ts e some sem erro nenhum. `envIntensity` foi
         escrito no manifesto, comentado, medido e BAIXADO DUAS VEZES
         perseguindo "o chão está muito reflexivo" — e nenhuma das duas vezes
         chegou ao material, porque morria nesta linha que não existia. É o
         mesmo modo de falha que catalog.ts documenta em warnDroppedKeys().
         `normalScale` e `macro` entram junto porque são a outra metade da
         mesma correção (relevo que quebra o especular, e variação macro que
         quebra o ladrilho). */
      if (typeof m.envIntensity === 'number' && m.envIntensity >= 0) {
        def.envIntensity = m.envIntensity;
      }
      if (typeof m.normalScale === 'number' && isFinite(m.normalScale)) {
        def.normalScale = m.normalScale;
      }
      const mac = m.macro as RawBlock | undefined;
      if (mac && typeof mac === 'object'
        && typeof mac.scale === 'number' && mac.scale > 0
        && typeof mac.amount === 'number') {
        def.macro = { scale: mac.scale, amount: Math.min(1, Math.max(0, mac.amount)) };
      }
      bound[name] = def;
    }
    if (Object.keys(bound).length) out.materials = bound;
  }
  return out;
}

function applyToScene(envDef: EnvironmentDef, entry: CacheEntry,
  lampModel: THREE.Object3D | null, onSetProgress?: (f: number) => void) {
  const hasHdri = !!(entry && entry.rt);

  /* A 3D SET IS THE WHOLE NEAR FIELD, AND THAT IS THE POINT.
     `set` (scene/set.ts) brings real modelled ground, kerbs, painted lines and
     buildings. Every SIMULATION of those used to have to be turned off here or
     it rendered THROUGH the real thing — the grounded dome projected the
     photo's floor over the modelled asphalt, the near band laid a 32 m disc on
     top of it, the procedural strip sat at y=-0.01 under everything and the
     shadow catcher doubled the truck's shadow against the set's own ground. In
     2026-08-03 all four were deleted along with the photo-backed scenes, so
     there is nothing left to guard against and no guards below.
     The HDRI stays: it is still the sky and, more importantly, still the IBL
     the paint reflects. */
  const setDef = resolveSet(envDef);

  /* O CÉU PROCEDURAL só aparece quando não há HDRI para desenhar. `armazem` é
     exatamente esse caso (`hdri: null`): a casca fechada esconde o domo, mas ele
     continua sendo o fundo de qualquer fresta. Com HDRI, quem manda é o
     manifesto — e os dois cenários atuais trazem `showSkyDome: false`. */
  setSkyDomeVisible(hasHdri ? envDef.showSkyDome === true : true);

  /* ---- GEOMETRIA REAL: o modelo do poste, depois o set ----
     ANTES de setLamps(), que distribui o pool: lamps.ts escala e orienta a
     luminária pela altura do próprio modelo, então o layout precisa rodar contra
     a geometria que ele vai de fato mover. `null` ⇒ mantém as primitivas
     procedurais, que é para onde um download quebrado degrada. */
  setLampModel(lampModel || null);

  /* Todo cenário ganha postes, inclusive o pátio: `null` é "a fileira embutida",
     não "nenhum", e quem não quer nenhum escreve `"lamps": { "enabled": false }`.
     Os SPOTLIGHTS são um pool fixo de 8 que setLampsEnabled() liga por
     dia/noite — isto aqui só move geometria, então é barato chamar por troca. */
  setLamps(envDef.lamps ? { ...envDef.lamps } : null);

  /* O SET É O CHÃO — não há mais plano procedural para arbitrar contra ele, que
     é por que `setSetGround()` deixou de existir. Nunca rejeita: applySet()
     engole a falha de rede e devolve false, e o cenário degrada para HDRI sem
     geometria em vez de abortar a troca. */
  /* Only for a set, and only over a photograph: the seam this hides is the one
     between the set's modelled ground and the HDRI behind it. With the
     procedural gradient dome there is nothing to hide — it already ends in the
     fog colour. `interior` opts out too: a warehouse has a roof, so hazing its
     horizon would put a band of fog across the far wall. */
  setHorizonHaze(setDef && hasHdri && !setDef.interior
    ? { strength: num((envDef.set as RawBlock)?.haze, 1) }
    : null);
  /* And the COLOUR that haze is painted in. The preset's fogColor is authored
     for the procedural sky and has no relationship to a given panorama's
     horizon (see setHorizonTint), so a scene standing against a photograph may
     name the tone its own plate actually has. Set together with the haze and
     cleared together with it: a scene without a set has no seam to match, and
     leaving the previous plate's tint on would tint the next one's fog.
     Read off `set.horizonColor` — it belongs to the same block as `haze`,
     which is the other half of the same knob. */
  setHorizonTint(setDef && hasHdri && !setDef.interior
    ? (((envDef.set as RawBlock)?.horizonColor as string | number) ?? null)
    : null);
  /* Confine the orbit for a closed set. Unconditional, including with null:
     leaving the previous scene's box in place would trap the camera in a
     34 x 62 m cage in the middle of a 1.2 km industrial estate. */
  setInteriorBounds(setDef && setDef.bounds ? setDef.bounds : null);
  const setP = setDef ? applySet(setDef, onSetProgress)
    : Promise.resolve(disposeSet()).then(() => { if (onSetProgress) onSetProgress(1); return false; });


  const rot = num(envDef.envRotation, 0);

  if (hasHdri) {
    /* `!`: `hasHdri` É `!!(entry && entry.rt)` — o tsc não propaga a narrowing
       através do booleano intermediário. */
    const tex = entry.rt!.texture;
    setExternalEnvironment(tex, {
      background: tex,
      rotation: rot,
      blurriness: num(envDef.backgroundBlur, 0),
      intensity: num(envDef.envIntensity, 1),
    });
  } else {
    setExternalEnvironment(null);
  }

  setExposureBase(num(envDef.exposure, 1));

  /* timeOfDay BEFORE preset: applyPreset() derives its default sun az/el from
     the CURRENT sceneState.timeOfDay, so the other order would hand a night
     preset the daytime sun angles.
     animate:false for both — an environment switch happens behind the selector
     overlay, and a 0.8 s crossfade between two unrelated rigs (plus a second
     beginTween cancelling the first mid-flight) reads as a glitch, not a
     transition. Note this also resets az/el/brightness to the preset defaults:
     the environment dictates the light rig, so the sidebar sliders must be
     re-read from sceneState afterwards.
     It is also what drives the rig hook that colours the dome, so the dome
     picks up its envIntensity on this call, not a frame later. */
  setTimeOfDay(envDef.timeOfDay === 'noite' ? 'noite' : 'dia', { animate: false });
  applyPreset(envDef.preset, { animate: false });

  current = envDef;
  /* O set é o único trabalho assíncrono que sobrou aqui. applyEnvironment() só
     pode dizer "pronto" depois que ele estiver na cena. */
  return setP.then(() => undefined);
}

/**
 * Apply a map/environment definition: load + cache its HDRI as a PMREM, load
 * its optional street-lamp .glb, bind scene.background / scene.environment,
 * mount the 3D set (which brings its own ground textures), toggle the
 * procedural sky dome and the street lamps, and apply the light preset + time
 * of day + exposure.
 *
 * Never rejects: a 404 or a decode error degrades to the procedural
 * environment (which needs zero downloaded assets) and resolves. Every
 * downgrade is independent — a dead lamp model falls back to the procedural
 * pole, a dead set .glb leaves the HDRI lighting an empty stage, and a dead
 * HDRI falls back to the procedural sky but still leaves the set standing.
 *
 * @param {Object} envDef            an entry from catalog.ts's `environments`
 * @param {(p:number)=>void} [onProgress]  0..1
 * @returns {Promise<Object|null>}   the applied envDef
 */
export async function applyEnvironment(envDef: EnvironmentDef | null | undefined,
  onProgress?: (p: number) => void): Promise<EnvironmentDef | null> {
  if (!envDef || typeof envDef !== 'object') return current;

  const token = ++seq;
  const report = typeof onProgress === 'function' ? onProgress : () => { };
  report(0);

  const id = String(envDef.id || 'env');
  const hdriPath = path(envDef.hdri);

  let entry = cache.get(id) || null;
  let cacheable = true;               // false only for a freshly FAILED HDRI

  /* FORA do bloco `!entry`: o modelo do poste tem cache próprio, por URL, então
     uma entrada de AMBIENTE residente não diz nada sobre ele. Resolver de novo
     é de graça no acerto (consulta ao Map, sem await) e correto no erro. */
  const lampUrl = envDef.lamps ? path(envDef.lamps.model) : null;
  const lampHref = lampUrl ? assetUrl(lampUrl) : null;

  /* Layout dos slots: 0 HDRI, 1 modelo do poste, 2 set. O que já está residente
     pesa 0 — uma requisição que nunca acontece não pode segurar a barra.
     Eram 2..N mapas de chão avulsos entre o HDRI e o poste até 2026-08-03; o
     `ground` do manifesto nomeia hoje um TIPO e nenhum arquivo, e quem baixa
     textura de chão é set.ts, contado no slot do set. */
  const HDRI_SLOT = 0, LAMP_SLOT = 1, SET_SLOT = 2;
  /* PESO DO SET, e por que ele é estimado em vez de medido. O tamanho real só é
     conhecido depois do HEAD/GET, e pedir um HEAD por cenário para acertar a
     barra custaria um round trip antes de qualquer byte útil. A estimativa sai
     do que o manifesto JÁ diz: um `.glb` de set roda entre 3,5 e 7,4 MB, e cada
     material nomeado traz até quatro mapas de ~1,4 MB. Errar aqui deixa a barra
     irregular; não errar a ORDEM é o que importa, e essa é exata.
     SUPERESTIMA de propósito quando um material do manifesto não existe no
     .glb: set.ts só baixa os mapas dos materiais que ele ACHA na cena
     (bindMaterials), então um `DIRT_WORN` que sobrou no manifesto conta aqui e
     não é baixado. O efeito é a barra chegar em 100 % um pouco cedo, que é o
     lado certo de errar. */
  const setDefForWeight = resolveSet(envDef);
  const setMapCount = setDefForWeight && setDefForWeight.materials
    ? Object.values(setDefForWeight.materials).reduce((n, m) =>
      n + (m.diffuse ? 1 : 0) + (m.rough ? 1 : 0) + (m.normal ? 1 : 0) + (m.ao ? 1 : 0), 0)
    : 0;
  const weights = [
    (!entry && hdriPath) ? W_HDRI : 0,
    (lampHref && !lampModels.has(lampHref)) ? W_PROP : 0,
    setDefForWeight ? (W_SET_GLB + setMapCount * W_MAP) : 0,
  ];
  const track = makeTracker(weights, report);

  /* Compile the equirect→cubeUV shader while the bytes are still in flight;
     it is a few ms of stall otherwise, right when the first frame lands. */
  if (!entry && hdriPath) { try { pmrem.compileEquirectangularShader(); } catch (_) { /* ignore */ } }

  /* HDRI e modelo do poste em PARALELO — são independentes, e o pequeno pega
     carona de graça. */
  const [hdr, lampObj] = await Promise.all([
    (!entry && hdriPath)
      ? loadHdr(assetUrl(hdriPath), e => track.set(HDRI_SLOT, fraction(e)))
        .then(t => { track.set(HDRI_SLOT, 1); return t; })
      : Promise.resolve(null),
    /* loadGLB() reporta uma FRAÇÃO, não um ProgressEvent — sem fraction() aqui. */
    lampHref
      ? loadLampModel(lampHref, f => track.set(LAMP_SLOT, f))
        .then(o => { track.set(LAMP_SLOT, 1); return o; })
      : Promise.resolve(null),
  ]);

  if (!entry) {
    /* O equirect cru só sobrevivia para o domo projetado amostrar direto; sem
       domo, toPmrem() o descarta nos dois caminhos (sucesso e falha) e não há
       nada a soltar aqui. */
    entry = { rt: hdr ? toPmrem(hdr) : null };

    /* Do NOT cache a FAILED HDRI: caching it would make one dropped packet
       permanent for the whole session (the engine outlives the React page), and
       the user's only recourse would be a full reload. A successful load, or an
       environment that never wanted an HDRI, is cached even if a newer apply
       has already overtaken us — the bytes are decoded either way. */
    cacheable = !hdriPath || !!entry.rt;
    if (cacheable) touch(id, entry);
  }

  /* A second applyEnvironment() started while we were awaiting — it owns the
     scene now. Bailing here is what keeps a fast double-click from binding the
     older HDRI on top of the newer one. */
  if (token !== seq) {
    /* uncached + superseded ⇒ nothing will ever reference these again */
    if (!cacheable) disposeEntry(entry);
    return current;
  }

  /* AGUARDADO, para applyEnvironment() continuar significando "a cena está
     visualmente pronta" — e agora ela realmente está: applySet() só resolve com
     as texturas de chão decodificadas.

     `report(1)` ficava ACIMA deste await até 2026-08-03, e era metade da barra
     mentindo: o ambiente declarava 100% e só então baixava 29 MB de set. No
     `armazem` era pior — sem HDRI (`hdri: null`) e sem modelo de poste, o
     tracker nascia com TODOS os pesos zerados menos o do set, resolvia no mesmo
     tick e entregava a fatia inteira do ambiente em t≈0. */
  const setP = applyToScene(envDef, entry, lampObj, f => track.set(SET_SLOT, f));
  if (setP) await setP;
  report(1);
  return current;
}

/** @returns {Object|null} the envDef last applied */
export function getCurrentEnvironment() {
  return current;
}

