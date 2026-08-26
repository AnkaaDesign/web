/* Renderer, scene, camera, controls, the procedural sky, the weather/time-of-day
   light rig, and the render loop.
   ---------------------------------------------------------------------------
   THIS MODULE IS THE ROOT OF THE ENGINE'S IMPORT GRAPH. KEEP IT ACYCLIC.

   Everything below module scope here RUNS AT IMPORT TIME: `new WebGLRenderer()`,
   the `$('canvas-holder')` DOM lookup, the mountSky() IIFE, the restore() IIFE
   and a resize(). So this module cannot tolerate a cycle — with one, a partially
   initialised binding is not a lint warning, it is a `ReferenceError` on boot,
   before a single pixel exists.

   The graph is acyclic today for exactly one reason: `vehicle/paint.ts` is a
   DEPENDENCY SINK. It imports `three` and nothing else — no `scene`, no
   `onFrame`, no `onRig` — and receives the only thing it needs from this module,
   the key light, BY INJECTION: we import `setKeyLight` FROM it and push. Adding
   `import { renderer } from '../scene/scene'` to paint.ts inverts that edge and
   closes the loop. Do not. The same rule already has a second instance:
   `weather.ts` needs `scene`, `camera` and the frame loop, so it registers
   through onFrame()/onRig() rather than being imported here (see the hooks
   section). If a module ever needs to be CALLED from here, give it a
   registration hook; do not import it.

   ---------------------------------------------------------------------------
   LIGHT RIG DESIGN

   One `key` DirectionalLight stands in for both sun and moon. It is NOT two
   lights that swap: `castShadow` is a shader program parameter
   (NUM_DIR_LIGHT_SHADOWS), so flipping it recompiles every material in the
   scene — the old sun/moon swap at night did exactly that. With a single key
   light, NUM_DIR_LIGHTS and NUM_DIR_LIGHT_SHADOWS are constant for the page's
   lifetime and "sun vs moon" becomes pure data (colour + intensity + angle).
   Shadow darkness is still fully controllable because r171 plumbs
   LightShadow.intensity through to the `shadowIntensity` uniform
   (getShadow() ends in `mix( 1.0, shadow, shadowIntensity )`), so "shadows
   almost off" under overcast is a tweenable float, never a boolean.

   Everything else about a preset is data too: light colours, sky gradient
   stops, fog, exposure, star/lamp state, ground wetness, rain. Presets
   crossfade over ~0.8 s through a generic snapshot lerp, so no preset needs
   hand-written transition code.

   The sky dome is a ShaderMaterial with three colour uniforms rather than
   baked vertex colours. The old version re-uploaded a ~2 000-float buffer
   attribute on every slider event and could only ever interpolate between two
   hard-coded gradients.

   Note on overcast: a CIE overcast sky is BRIGHTER AT THE ZENITH
   (L(θ) = L_zenith·(1+2cosθ)/3, so horizon ≈ 1/3 of zenith) — the opposite of
   a clear sky, where the zenith is deep blue and the horizon pale. The
   presets encode that flip; it is a large part of why each one reads
   differently. The near-horizon brightening people associate with overcast is
   aerosol haze, which is scene.fog's job, not the dome's.

   ---------------------------------------------------------------------------
   TIME OF DAY IS A CLOCK, NOT A SWITCH

   `sceneState.hour` runs 06:00 → 24:00 and is the authority; `timeOfDay` is
   DERIVED from it and kept only because the presets' two faces, envKey() and
   every caller that predates the clock still speak it. The hour produces three
   continuous numbers, all closed-form (see "the clock"):

     alt(h)  solar altitude, EL_MAX·sin(π·f) with f = (h − sunrise)/day length.
             SIGNED: it keeps going negative after sunset, which is what makes
             the night keep deepening instead of parking at the horizon.
     az(h)   a linear sweep of the key light's bearing, sunrise → sunset. The
             bearing convention is applyRig()'s; it is spelled out at AZ_RISE.
     n(h)    "nightness", a smoothstep of alt across the twilight band. It is
             the blend weight between a preset's `dia` and `noite` faces, so
             dusk is a crossfade of exactly the data the two-state version
             already had — no second lighting system, and everything derived
             (stars, lamp intensity, fog, exposure, wetness, the paint's
             glintBoost) crossfades with it for free.

   Nothing snaps at a threshold. The only discrete thing left in the day/night
   transition is SpotLight.visible on the lamp pool, which is a shader define;
   setLampsEnabled() gives it hysteresis so an hour slider parked on the edge
   cannot flip it back and forth.

   ---------------------------------------------------------------------------
   EXTERNAL ENVIRONMENTS (environment.ts)

   environment.ts can hand this module a photoreal HDRI. When it does, ONE
   module-level flag (`externalEnv`) flips and the procedural path stops writing
   `scene.background` / `scene.environment` — and ONLY those two. Everything
   else the rig drives (lights, fog, exposure, wetness, lamps, stars, the paint
   uniforms) keeps working exactly as before, so the preset buttons and the
   light sliders remain live over an HDRI. Every guarded assignment carries a
   `GUARD:` comment saying why. The flag is cleared by
   `setExternalEnvironment(null)`, which also rebuilds the procedural PMREM.

   ---------------------------------------------------------------------------
   WHAT THE 2026-08-03 CONTENT CUT TOOK OUT OF THIS FILE

   Three photo-backed environments (`rodovia`, `patio-logistico`, `urbano`) left
   the catalogue. Both survivors — `distrito-industrial` and `armazem` — stand on
   REAL MODELLED GEOMETRY (`set.glb`, owned by scene/set.ts), and that geometry
   IS the ground. Everything this module used to build in order to fake a floor
   under a photograph went with them: the ground-projected dome, the CG near-field
   band, the two-band radial dissolve, the macro variation, the shadow catcher
   and the 340 m procedural road strip. `setNearGround()`, `setGroundMaps()`,
   `setMacroVariation()`, `setShadowCatcher()` and `setRoadVisible()` DO NOT
   EXIST — if a comment elsewhere still names one, it is the comment that is
   wrong.

   Two things they left behind are still load-bearing, and both are documented at
   their own declaration rather than here:

   * the key light's shadow camera stays at ±24 m (SHADOW_HALF). It grew for a
     photographed floor and it is still right for a modelled one — a set's ground
     receives the truck's shadow across the whole yard, and a frustum that stops
     14 m from the origin cuts a dead-straight line across it.
   * the wetness bookkeeping (dryColors / dryRough / dryEnv / puddleSpec) is now
     fed by set.ts through registerGroundMaterials(), instead of being seeded
     with the procedural materials it was written for. See that function for why
     the old seeding left `Chuvoso` raining on a road that never darkened.

   ---------------------------------------------------------------------------
   THE LAMPS: A MODEL WHERE ONE FITS, A MAST WHERE NONE DOES

   `setLampModel()` swaps the fixture under each spot for a loaded GLB. The pool
   itself is untouched — same eight SpotLights, same single writer of their
   `visible` flag — and a missing or unreadable GLB keeps the built-in fixture,
   which is also what the assetless path shows.

   The built-in fixture is a properly modelled MOTORWAY MAST: a tapered lathe
   column on a door compartment, a cubic-Bezier outreach arm that leaves the
   column vertically and reaches the lantern horizontally, and a flat-glass
   cutoff luminaire with the lens on its underside. It is not a fallback of last
   resort — it is the DEFAULT fixture, and it was modelled because the only CC0
   street lamp available is a 3.87 m ornate cast-iron park lantern and
   stretching it to a 9 m motorway mounting height is exactly the artefact the
   user reported. Height is per-scene data with an inverse-square intensity
   compensation; see the street-lamp section for all of it.

   Neither shipped scenario currently draws it: both set `lamps.enabled: false`,
   because the industrial estate models its own poles and the warehouse lights
   itself with emissive strips on the shell. The pool and the mast stay because
   `lamps: null` means "the built-in row", not "none" — the next scene that wants
   street lighting and has no modelled poles gets it for free.
*/
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { setKeyLight, setPaintPixelScale } from '../vehicle/paint';
import { $ } from '../core/dom';
/* MÓDULO FOLHA, IMPORTADO NO TOPO — e a posição é o ponto, não o acaso. O
   renderer nasce no escopo deste módulo (ver a primeira linha do cabeçalho), e
   `pixelRatioCap` tem de estar respondido antes disso. `core/quality.ts` não
   importa nada do engine justamente para poder ser importado aqui sem fechar
   ciclo. */
import {
  getProfile, onQualityChange, onScaleChange, reportFrameTime,
  coldProfile, markColdApplied,
} from '../core/quality';
import {
  canvasTex, ctx2d, makePuddleCanvas,
} from './textures';
import { skyU, makeSkyDome, makeStars } from './sky';
import {
  setSeeThroughTarget, updateSeeThrough, getSeeThrough, takeSeeThroughShadowDirty,
} from './seethrough';
import { updateSkyBlend, hasSkyPair, getSkyBlend } from './skyblend';
import {
  setVehicleLightsLevel, getVehicleLights, setVehicleLightsRigRefresh,
} from '../vehicle/lights';
import { updateVehicleBeams, getVehicleBeams } from '../vehicle/beams';
import { getRetroreflective } from '../vehicle/retroreflect';
import { getHeadlightCover } from '../vehicle/headlight-cover';
import { getLampHalos } from '../vehicle/halo';
import {
  lampUnits, lampModelEmissive, makeLamps, applyLampLayout, setLampRigRefresh,
  getLampLensMat, getLampIntensityScale, getLampBeamGain, vehBeams,
  setSpotPool, activeSpotPool,
} from './lamps';
import {
  VIEW_DIR as CARD_VIEW_DIR, FOV as CARD_FOV, TARGET_H as CARD_TARGET_H,
} from './view';
import {
  LIGHT_PRESETS, RIG_BASE, COLOR_FIELDS, NUM_FIELDS, makeRig,
  /* `BACKDROPS` NÃO entra aqui: scene.ts não itera a lista, só resolve um id
     (`backdropOf`) e conhece o padrão. Ela é reexportada logo abaixo para o
     HUD, e reexportar não consome o binding — importá-la sem usar seria um
     `noUnusedLocals`. */
  DEFAULT_BACKDROP, backdropOf,
  kelvinTint, TEMP_NEUTRAL, TEMP_MIN, TEMP_MAX,
} from './presets';

/* Reusado a cada resolveRig() de estúdio — que roda por quadro durante um
   crossfade. Um THREE.Color novo por quadro é lixo por nada. */
const _tempTint = new THREE.Color();
import type { Rig, BackdropDef } from './presets';

/* Re-exported so the engine's public surface is unchanged by the split:
   environment.ts and ui/hud.ts import all of these from this module. */
export { LIGHT_PRESETS, PRESET_ORDER } from './presets';
/* Idem para os fundos do estúdio: ui/hud.ts monta as pastilhas a partir desta
   lista, e ele já importa tudo que é de luz DAQUI. Fazê-lo buscar metade em
   scene.ts e metade em presets.ts seria pedir que a UI conhecesse o corte
   interno do módulo de cena. */
export { BACKDROPS, DEFAULT_BACKDROP, backdropOf } from './presets';
export { TEMP_NEUTRAL, TEMP_MIN, TEMP_MAX } from './presets';
export type { BackdropDef } from './presets';
export { setLamps, setLampModel } from './lamps';
/* O ESTADO DO POOL DE POSTES, e por que ele é reexportado agora: `getLampInfo()`
   existia desde a extração de lamps.ts com um docstring dizendo
   "getEnvironmentObjects() reports this" — e NADA a chamava. Era diagnóstico
   morto. A rodada do layout `set` (o cenário traz a torre, nós trazemos a luz)
   tem uma pergunta que só se responde medindo — o refletor está DENTRO da
   luminária que ele acende? —, então ela vira porta de bancada. */
export { getLampInfo } from './lamps';

/* E `setLampSites`, pela mesma razão de porta de bancada — não porque alguém
   deva chamá-la de fora em produção.
   `tools/studio-bench/checks-postes-fantasma.mjs` precisa PRODUZIR o estado
   "o cenário não entregou torre nenhuma", que em produção nasce de um `set.glb`
   que falhou ou que não tem torre (scene/set.ts e scene/scenery.ts chamam
   exatamente `setLampSites(null, null)`). Sem esta linha o check só saberia
   observar o caminho feliz — e o defeito que ele trava mora justamente no
   outro. */
export { setLampSites } from './lamps';

export const holder = $('canvas-holder');

/* DEPTH PRECISION — why this is NOT a logarithmic buffer.
   ---------------------------------------------------------------------------
   The implement is a rip whose surfaces are stacked in MILLIMETRES: the
   conspicuity tape lies on the perimeter rail, the rail on the body skin, the
   rear tape on the bumper. Its viewer separates every coincident pair it can
   find (defight.js) by only ~1.5 mm, and validated that number with
   `logarithmicDepthBuffer: true` — which is what all eight rip viewers use.

   Turning it on here looks like the obvious fix and is a TRAP: a logarithmic
   buffer makes the fragment shader write gl_FragDepth, and a shader-written
   depth **silently disables the GPU's polygon offset**. This studio leans on
   polygonOffset for every decal it owns — the livery overlay, the front-wall
   paint overlay, the painted road markings — so the trade is: stop the model's
   own 1.5 mm pairs from fighting, and start the app's own decals fighting
   instead. Measured before reverting: log depth on, the flank overlay flickers.

   The linear buffer is kept and the RANGE is what got fixed instead. 24-bit
   depth resolves roughly z²·(far−near)/(near·far·2²⁴): at the old unbounded
   orbit that is millimetres at 100 m, which is what made whole components wink
   in and out. With setVehicleFocus() capping the orbit at ~25 m and `near` no
   longer allowed under 0.08, the same expression gives well under 0.1 mm — an
   order of magnitude finer than anything defight.js left coincident. */
export const renderer = new THREE.WebGLRenderer({
  /* DO PERFIL FRIO, e no nível Alto ele vale `true` — ou seja, esta linha faz
     exatamente o que `antialias: true` fazia antes, e é assim que se verifica
     que o teto não se mexeu.

     Ele é lido AQUI, no escopo de módulo, e é por isso que `core/quality.ts`
     não pode importar nada do engine: `antialias` é parâmetro de CONSTRUTOR e
     não há segunda chance. Trocá-lo depois exige um contexto novo — ver a nota
     de `applyQualityProfile()`.

     ⚠️ HOJE OS TRÊS NÍVEIS PEDEM `true`, e isso é uma conclusão medida, não uma
     omissão: esta cena é limitada por SHADER DE FRAGMENTO (um fragmento de
     lataria à noite custa ~2 800 ALU), e MSAA sombreia uma vez por PIXEL, não
     por amostra. Logo MSAA 4× a `renderScale` 0,65 desenha 0,88 M fragmentos
     com arestas boas, contra 2,07 M com arestas serrilhadas sem MSAA a 1,0 —
     mais barato no recurso dominante E mais bonito. O campo existe no perfil
     porque a conta pode virar noutro hardware, não porque ela já virou. */
  antialias: coldProfile().antialias,
  /* THE DISCRETE GPU, EXPLICITLY. Unset, this is `'default'`, and on a dual-GPU
     laptop `'default'` is where the browser is free to hand back the integrated
     adapter — which for a 9–10 M triangle scene with a 3072² shadow pass is the
     difference between 60 fps and a slideshow, for free. ui/preview.ts asks for
     `'low-power'` for exactly the symmetric reason: its thumbnails are twelve
     512² offscreen frames and do not deserve to spin up the dGPU. Only ever a
     HINT — a single-GPU machine ignores it, which is why nothing downstream may
     assume it took. */
  powerPreference: 'high-performance',
  /* NOT preserveDrawingBuffer. It was here for the screenshot, and it is not
     needed for one: scene/capture.ts calls `renderer.render()` and then
     `canvas.toBlob()` in the SAME task (encodePng's promise executor runs
     synchronously), so the buffer has not been composited and cleared yet and
     the readback is well defined without the flag. Keeping it costs an extra
     full-size buffer allocation plus a copy on every single present, forever,
     to serve a button pressed a handful of times a session. If capture ever
     grows an `await` between the render and the readback, this has to come
     back. */
});
/* O TETO DO DPR VEM DO PERFIL, e no nível Alto ele vale 2 — ou seja, esta linha
   faz exatamente o que `Math.min(devicePixelRatio, 2)` fazia antes do perfil
   existir, e é assim que se verifica que o teto não se mexeu. O custo de
   preenchimento escala com o QUADRADO deste número, o que faz dele o botão
   dominante de qualquer adaptação: entre um 4K a DPR 2 e um 1080p a DPR 1 há
   16× de pixels, decididos aqui. */
/* Idêntico ao `effectivePixelRatio()` lá embaixo, e escrito à mão aqui porque
   `renderScale` é um `let` declarado depois — chamá-lo daqui seria ler uma
   variável na zona morta temporal, que é a mesma armadilha de içamento que o
   bloco de `busyUntil` documenta. O valor é transitório de qualquer forma: o
   `resize()` do fim deste módulo roda no import e recalcula por este caminho. */
renderer.setPixelRatio(
  Math.min(devicePixelRatio, getProfile().pixelRatioCap) * getProfile().renderScale);
renderer.shadowMap.enabled = true;
/* ---- POR QUE NÃO É `PCFSoftShadowMap`, E O COMENTÁRIO QUE ESTAVA AQUI ----
   A linha dizia "shadow.radius only works with PCFSoft". É o contrário, e o
   preço era um controle inteiro do HUD que não fazia nada.

   O `getShadow()` do three (shadowmap_pars_fragment.glsl.js, r179) tem três
   ramos, e só DOIS leem `shadowRadius`:

     SHADOWMAP_TYPE_PCF        17 amostras espalhadas por ±shadowRadius texels
     SHADOWMAP_TYPE_PCF_SOFT   tent 3x3 de UM texel, `shadowRadius` não aparece
     SHADOWMAP_TYPE_VSM        borrão separável de raio `shadowRadius`

   MEDIDO na bancada antes da troca: varrer "Difusão da sombra" de 0,15 a 6
   mudava a luminância da parede, do sujeito e do piso em 0,0 / 0,0 / 0,0 —
   zero, nas três faixas. E não era só o controle do estúdio: `shadowRadius` é
   campo de preset, então os 2,0 do `ensolarado`, os 9,0 do `nublado` e os 12,0
   do `chuvoso` também nunca saíram do papel. Um dia nublado projetava a mesma
   sombra dura de um meio-dia de sol.

   PCF E NÃO VSM. O VSM borra o próprio mapa e por isso é o único que dá
   penumbra realmente larga, mas ele guarda MOMENTOS em vez de profundidade e
   vaza luz onde dois casters se sobrepõem — o que aqui é o par cavalo +
   implemento, o tempo inteiro. O raio é honesto: a 3072² sobre ±24 m são
   64 texels/m, então `radius` 2 é uma penumbra de 3 cm e `radius` 12 é de 19 cm.

   ⚠️ CORREÇÃO DE UM NÚMERO QUE ESTAVA AQUI. A linha dizia "PCF custa 17
   amostras contra as 9 do PCF_SOFT". Contadas no three r179
   (`shadowmap_pars_fragment.glsl.js`), o ramo PCF_SOFT tem 4 taps diretos +
   4 pares em `mix` + 1 `mix` aninhado de 4 = **16 taps**; o `1.0/9.0` que
   aparece no arquivo é PESO DE NORMALIZAÇÃO, não contagem. Ou seja PCF_SOFT
   custa 16 contra 17 — **ele não é um degrau intermediário de custo**, e ainda
   por cima ignora `shadow.radius`. Como barateamento ele não existe; quem
   precisa de barato precisa de `BasicShadowMap`, que é 1 tap.

   POR ISSO O TIPO PASSOU A VIR DO PERFIL FRIO. Ele continua sendo `#define` e
   continua recompilando a cena inteira — por isso é FRIO e só muda sob cortina,
   nunca pelo medidor. No nível Alto e Médio ele vale `PCFShadowMap`, exatamente
   como sempre valeu. */
renderer.shadowMap.type = coldProfile().shadowType === 'basic'
  ? THREE.BasicShadowMap : THREE.PCFShadowMap;
/* A partir daqui o contexto de GPU vivo REALMENTE tem a assinatura fria do
   nível — os dois parâmetros que não têm segunda chance já foram gastos. É
   isto que faz `coldPending()` responder `false` num boot limpo. */
markColdApplied();

/* THE SHADOW MAP IS NOT REDRAWN EVERY FRAME.
   ---------------------------------------------------------------------------
   The key light is DIRECTIONAL and its shadow camera is a fixed ortho box about
   the RIG (see placeKeyLight — it used to be about the origin, which is what cut
   the implement out of the map), so the depth map depends only on the light's
   angle, on the geometry and on where the rig sits — NOT on where the viewer is.
   Moving the box is itself an invalidation, and setVehicleFocus() pays it.
   Left on autoUpdate, three re-rendered
   every caster into a 3072² map on every single frame, which on this rig means
   drawing the whole vehicle TWICE per frame: the corrected implement alone is
   8.6 M triangles, so orbiting the camera — a thing that cannot change a single
   shadow texel — was costing a second full geometry pass. That is what made the
   scene feel like it "loads stuck and then works", and what made the time-of-day
   slider freeze under the thumb.

   The map is now marked dirty explicitly: applyRig() does it whenever the light
   pose changes (which covers the clock, the presets and every tween frame), and
   invalidateShadows() is for everything else that moves a caster — a model or
   set finishing its load, the Cabine/Implemento toggles, the coupling moving.
   Miss one and the symptom is a stale shadow, so the callers are deliberately
   few and all of them are load/visibility edges. */
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;

/* ---------------- ⚠️ O CONTADOR DE CHAMADAS MENTIA ----------------
   E mentia em TODO documento de desempenho deste projeto. `WebGLRenderer
   .render()` do three 0.179.1, nesta ordem exata (WebGLRenderer.js:1606/1612):

       shadowMap.render( shadowsArray, scene, camera );
       if ( this.info.autoReset === true ) this.info.reset();

   O contador é zerado DEPOIS do passe de sombra, logo
   `renderer.info.render.calls` NUNCA contou uma única chamada da sombra. E é
   esse o número que `getRenderStats()` publica, que o painel de Configurações
   mostra, e que o comentário de FRAME SCHEDULING logo abaixo cita como
   "~2200-2900 draw calls".

   Medido com o reset feito à mão (`GARGALO-2026-08-15.md` §1.1), num quadro de
   arrasto do `distrito-industrial`:

       nível   principal   sombra   TOTAL
       Alta      2 230      1 574   3 804
       Média     1 642      1 574   3 216
       Baixa     1 158      1 138   2 296

   Ou seja: todo orçamento de desempenho escrito aqui está 40 a 70 % abaixo do
   real, e uma otimização julgada por este número seria aprovada por um ganho
   que não é o dela.

   ⚠️ E COM `autoReset = false` TUDO PASSA A ACUMULAR — é a contrapartida, e ela
   é uma DECISÃO, não um efeito colateral. Sem o zeramento automático, toda
   renderização extra soma nos mesmos contadores: o reflexo do piso
   (`floor-reflection.ts`, que roda nos `drawHooks`, antes do render principal),
   a sonda (`probe.ts`, ~14 000 chamadas), a captura (`capture.ts`) e o PMREM da
   mistura de céus (`skyblend.ts`).

   O reset manual fica no TOPO do trecho de quadro DESENHADO, antes dos
   `drawHooks` (ver `startLoop()`), e a escolha é essa de propósito: `calls`
   passa a significar **tudo que este quadro submeteu**, que é exatamente o que
   a máquina paga. A alternativa — resetar imediatamente antes do
   `renderer.render()` — daria um número mais "limpo" e mais inútil, porque
   esconderia o reflexo do piso, que num quadro do cenário Estúdio é uma cena
   inteira a mais.

   Duas consequências a não confundir com defeito:
     · um quadro que calhe de conter uma sonda ou uma captura reporta um PICO
       legítimo de milhares de chamadas — é trabalho que aconteceu mesmo;
     · com o laço parado (`capture.ts` chama `stopLoop()`), ninguém zera, e os
       contadores acumulam até o próximo quadro desenhado. */
renderer.info.autoReset = false;

/* ---------------- A JANELA DE "NÃO APRENDA COM ISTO" ----------------
   Os primeiros quadros depois de uma carga são os mais caros da sessão e os
   menos representativos dela: o driver está compilando programas, subindo
   texturas e montando buffers de vértice. Um medidor de qualidade que os
   engolisse rebaixaria o nível toda vez que o usuário trocasse de caminhão ou
   de cenário — e voltaria a subir dez segundos depois, com a imagem mudando
   duas vezes à toa. É o pior comportamento possível, porque o que o usuário
   percebe é a IMAGEM MUDANDO, não o número de quadros.

   Tempo e não contagem de quadros: o que passa aqui é trabalho de DRIVER, e ele
   não anda no ritmo do rAF.

   DECLARADO AQUI EM CIMA, e não junto de `markBusy()` lá embaixo, por uma razão
   mecânica: `invalidateShadows()` é chamada durante a AVALIAÇÃO deste módulo, e
   uma `let` só existe a partir da linha dela. A função é içada, a variável não
   — o par declarado no fim daria `ReferenceError` na carga, e só em algumas
   ordens de importação, que é a pior classe de defeito que existe. */
let busyUntil = 0;
const BUSY_MS = 3000;

/** Diz ao medidor de qualidade para ignorar os próximos segundos. */
export function markBusy(ms = BUSY_MS) {
  busyUntil = Math.max(busyUntil, performance.now() + ms);
}

/** Redraw the shadow map on the next frame. Call after moving/showing a caster. */
export function invalidateShadows() {
  renderer.shadowMap.needsUpdate = true;
  /* UM CASTER SE MEXEU, e na esmagadora maioria das vezes isso quer dizer que
     algo acabou de CARREGAR — os chamadores são deliberadamente poucos e todos
     são bordas de carga/visibilidade (o próprio comentário acima diz isso). Ou
     seja, este é exatamente o lugar onde a janela de "não aprenda com isto" já
     está sendo aberta de graça, sem uma linha nova em nenhum chamador. */
  markBusy();
  /* A caster moved, so by definition the picture changed. Folding the repaint in
     here rather than asking every caller to pair the two is what makes the whole
     class of "invalidated the shadow, forgot the frame" bug unrepresentable —
     and it is what lets studio.ts's warmUp() cover every asynchronous model,
     set and probe load in the engine without a line of new wiring. */
  invalidate();
}
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
holder.appendChild(renderer.domElement);

/* ---------------- FRAME SCHEDULING: A DIRTY-DRIVEN LOOP ----------------
   In both shipped scenarios the steady-state scene is bit-for-bit identical from
   one frame to the next. Neither manifest turns the procedural dome on, rain is
   off unless `chuvoso` is picked, and nothing else in the graph animates — yet
   the loop redraws ~2200-2900 draw calls and ~9-10 M triangles sixty times a
   second to produce the same image. That is a hot GPU, a loud fan and a flat
   battery bought with nothing.

   So the loop is dirty-driven: draw when something changed, and when nothing
   has, don't. `invalidate()` is the signal, and it is EXPORTED because most of
   the things that change the picture live in other modules.

   A MISSED INVALIDATION IS A FROZEN SCREEN, which is far worse than a warm GPU.
   Two defences, both deliberate:

     * `invalidate()` marks INVALIDATE_FRAMES frames dirty, not one. A texture
       upload that lands the frame after the call, an off-by-one in the damping
       settle, a `needsUpdate` three defers to the next render — none of them can
       leave a stale image on screen. Three frames out of the sixty a second this
       used to spend is still ~95 % of the saving.
     * anything CONTINUOUS pins the loop on for as long as it runs: a preset
       crossfade, rain, the animated dome, OrbitControls damping still settling,
       autoRotate. See wantsFrame(), which is the whole predicate in one place.

   ---------------------------------------------------------------------------
   IT SHIPS ON — 2026-08-13. WHAT HAD TO BE TRUE FIRST, AND HOW IT WAS CHECKED.

   Every mutation point inside THIS file was always covered. What kept the flag
   off was the engine's OTHER modules, and the note that stood here listed three
   gaps that would have looked BROKEN, not merely stale. The three were closed
   one at a time, by whoever was in the neighbourhood, and nobody came back to
   flip the switch. Re-audited across all 59 modules before flipping:

     1. vehicle/livery.ts — the fabric plotting editor.  CLOSED at livery.ts's
        `after:render` handler, which calls `invalidate(3)` right after marking
        the three CanvasTextures. Three frames and not one, because the texture
        upload can land on the next.
     2. vehicle/models.ts `setPaintTarget()`.  CLOSED — it ends in `invalidate()`,
        deliberately AFTER the front-wall overlay swap so the repaint includes it.
     3. studio.ts `applyChoice()`'s colour-only fast path (`runColor`).  CLOSED
        in `applyColor()`, which is where BOTH paths meet — the note there says
        so explicitly, and that is why it is not in `runColor()`.

     4. THE FOURTH GAP, WHICH THAT LIST NEVER HAD. `ui/paint-panel.ts` drives
        `paint.setPaint()` on every slider drag and could not invalidate from
        inside: `vehicle/paint.ts` is a dependency SINK (it imports `three` and
        nothing else) and inverting that edge would close a cycle with this file
        and throw at boot. Fixed on the CALLER side, which is the only side that
        can: the panel imports `invalidate` from here, exactly as `hud.ts` and
        `chrome.ts` already do. Without this, dragging any control on "Ajuste da
        tinta" would change the uniforms and not the screen.

   AND ONE THING THAT WAS NOT AN INVALIDATION AT ALL — see `onDrawFrame` below.
   `cyclorama.ts` registered the floor-reflection pass, a full second render of
   the scene, as an `onFrame` hook; those run even on skipped frames, so the
   Estúdio scenario would have paid the whole continuous loop and collected none
   of the saving. That hook moved to the draw list.

   Nothing else in the engine is unreachable: every other external mutation
   either ends in a scene.ts setter (environment.ts, hud.ts, chrome.ts, lamps.ts,
   set.ts, trim.ts) or is awaited by studio.ts's runApply(), which finishes on
   warmUp() → invalidateShadows() → invalidate(). The HUD's own writes all land
   in `beginTween()`, which pins the loop through `tweenT` for the whole
   crossfade. `controls.autoRotate`, which chrome.ts writes directly with no
   wrapper, is read by wantsFrame() rather than pushed, so it needs no wiring.

   IF A CONTROL EVER LOOKS FROZEN, this flag is the first suspect and
   `__studio.lighting.setOnDemandRendering(false)` is the one-keystroke answer
   that tells you whether it is: if the control works with the loop continuous,
   what is missing is an `invalidate()` at whatever that control writes. */
const ON_DEMAND_RENDERING = true;

/* Live override for A/B-ing the two loops from the console
   (`__studio.lighting.setOnDemandRendering(true)`) without a rebuild. The
   constant above is what SHIPS; this is what is running. */
let onDemand = ON_DEMAND_RENDERING;

/** How many frames one invalidate() buys. See the belt-and-braces note above. */
const INVALIDATE_FRAMES = 3;
/* Seeded dirty so the very first frame after module load always draws, whatever
   the flag says. */
let dirtyFrames = INVALIDATE_FRAMES;

/**
 * Mark the picture as changed: the loop will draw the next few frames.
 *
 * Call it from ANYWHERE that mutates something the camera can see — a material,
 * a uniform, a transform, a visibility flag, `scene.background`, an exposure.
 * It is idempotent, allocation-free and costs one comparison, so calling it too
 * often is free and calling it too rarely freezes the screen. When in doubt,
 * call it.
 */
export function invalidate(frames = INVALIDATE_FRAMES) {
  if (frames > dirtyFrames) dirtyFrames = frames;
}

/** Swap the frame policy at runtime. Always leaves the screen repainted. */
export function setOnDemandRendering(v: boolean) {
  onDemand = !!v;
  invalidate();
}
export const isOnDemandRendering = () => onDemand;

/* DRAW SUSPENSION — for the windows where the scene graph is deliberately WRONG.
   ---------------------------------------------------------------------------
   warmLightPrograms() mounts the light configuration we are NOT about to render
   (the whole pool on, in daylight) so the driver compiles it now instead of
   under the user's thumb at dusk. That used to be safe for free: `renderer
   .compile()` is synchronous, so the flip and the restore lived in one task and
   no frame could ever be presented between them. `compileAsync` breaks exactly
   that guarantee — it yields, and the loop is running.

   A counter rather than a boolean so nested or overlapping suspensions cannot
   have one release re-enable drawing for the other. */
let drawSuspended = 0;

/**
 * Segura o laço enquanto o grafo estiver deliberadamente errado, e devolve a
 * função que solta.
 *
 * A alça pública do contador acima, para quem está FORA deste módulo — hoje
 * `applyColdQuality()` em studio.ts, que desapareia luzes, troca o filtro de
 * sombra e solta o cenário em três instruções seguidas. Sem isto o laço pode
 * apresentar um quadro no meio dessas três.
 *
 * ⚠️ SEMPRE EM `try/finally`, e a função devolvida é IDEMPOTENTE de propósito:
 * um contador que não volta a zero é uma viewport congelada para sempre, e o
 * sintoma (uma cena que parou de responder ao mouse) não aponta para cá.
 */
export function suspendDraw(): () => void {
  drawSuspended++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    drawSuspended--;
    /* Obrigatório: enquanto suspenso o laço não gastou invalidação nenhuma, e a
       cena pode ter mudado inteira no intervalo. */
    invalidate();
  };
}

/** Instante do fim do último `render()`, ou 0 quando a cadeia de quadros
 *  desenhados foi rompida (quadro pulado ou desenho suspenso).
 *
 *  Declarado aqui, no topo, e não junto do laço: `startLoop()` fecha sobre ele e
 *  os `return` do meio do laço o zeram, então ele é estado do MÓDULO, não da
 *  função — e um `let` içado para depois do primeiro leitor cairia na zona morta
 *  temporal, que é a armadilha que o bloco de `busyUntil` documenta. */
let lastDrawnAt = 0;

export const scene = new THREE.Scene();

/* THE SCENE ROOT DOES NOT DIRTY ITSELF, and this is the other half of
   models.ts's matrix freeze rather than a separate optimisation.
   ---------------------------------------------------------------------------
   `Object3D.updateMatrix()` sets `matrixWorldNeedsUpdate = true`
   UNCONDITIONALLY, and `updateMatrixWorld()` turns that into `force = true` for
   every descendant (three r179, Object3D.js:1126-1162). So a Scene left on the
   default `matrixAutoUpdate` recomposes its own identity matrix once per frame
   and then makes the renderer rebuild `matrixWorld` for EVERY node in the graph
   — ~5852 in the implement alone — however many of them have frozen their local
   matrix. Freezing the leaves without freezing the root removes the compose and
   leaves the whole multiply cascade standing.

   Safe because the Scene is never transformed: it sits at identity for the
   lifetime of the page, and nothing in the engine writes its position, rotation
   or scale (checked). `matrixWorldAutoUpdate` stays ON — that is the flag
   WebGLRenderer.render() tests before calling `scene.updateMatrixWorld()`, and
   turning it off would stop the traversal entirely instead of merely stopping it
   from forcing.

   THE INVARIANT THIS CREATES, and it is a graph-wide one, not a local one:

     a node's world matrix is refreshed only if IT or one of its ANCESTORS is
     dirty — so anything that moves must dirty itself.

   Everything already does, by two different routes, which is why this composes
   with the freeze instead of fighting it:

     * nodes that keep `matrixAutoUpdate` on — the lights, the sky dome, the
       stars, the haze shell, the lamp poles, the weather meshes, every overlay
       and prop added after a subtree was frozen — call `updateMatrix()` on
       themselves each traversal and dirty themselves for free.
     * frozen nodes are only ever moved through setRigPlacement(), placeTrailer()
       and groundAndCenter(), all of which pair the write with `updateMatrix()`
       (which dirties) or `updateWorldMatrix()` (which recomputes on the spot).

   The camera is not affected either way: it is not a child of the scene, and
   WebGLRenderer.render() updates it on its own line.

   The measurement paths are likewise independent — `Box3.expandByObject()` calls
   `updateWorldMatrix(false, false)` on every node it visits, so frameAll(),
   focusOnRig() and the probe read live numbers whether or not a frame has been
   drawn since the rig moved.

   WHAT BREAKS IT: reparenting a FROZEN node (`add()` does not dirty the child,
   so its world matrix would silently keep the old parent's transform), or
   writing `.position` on one from the console. Both are loud — the object
   renders in the wrong place — rather than subtle. */
scene.matrixAutoUpdate = false;

/* Held as a module-level instance rather than an anonymous literal: applyRig()
   mutates it in place, and setExternalEnvironment(null) has to be able to hand
   `scene.background` back to it after an HDRI (a Texture) has been released. */
const bgColor = new THREE.Color(0xb8d8f5);
scene.background = bgColor;
/* FogExp2 for every preset: switching fog TYPE would flip #define FOG_EXP2 and
   recompile everything, and exponential falloff is what sells near-field mist.
   density ≈ 1.978 / visibility_metres (98 % opaque at that distance). */
scene.fog = new THREE.FogExp2(0xb8d8f5, 0.0028);

/* A MESMA lente do card (30°, scene/view.ts) e não os 45° de antes: a distância
   que frameAll() calcula sai do meio-ângulo, então trocar a lente sem trocar a
   conta mudaria o enquadramento — as duas coisas andam juntas por construção.
   Uma grande-angular de 45° também incha a cabine de perto, que é o contrário do
   que uma foto de veículo faz. */
export const camera = new THREE.PerspectiveCamera(CARD_FOV, 1, 0.1, 600);
camera.position.set(14, 6, 18);   // semente; frameAll() reposiciona ao carregar

export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

/* ---------------- A INÉRCIA DA ÓRBITA ERA CONTADA EM QUADROS ----------------
   ⚠️ ISTO É UM DEFEITO DE RESPOSTA, NÃO DE DESEMPENHO — e é a resposta direta ao
   relato *"não sinto fluida a movimentação da câmera"*. Ele não some quando o
   quadro fica mais barato; ele PIORA quando o quadro fica mais caro, o que é a
   pior combinação possível, porque disfarça de "está lento" uma coisa que não é.

   O mecanismo está no `update()` do OrbitControls r179 (linhas 615-704), e não
   depende de interpretação:

       spherical.theta      += sphericalDelta.theta * dampingFactor;
       sphericalDelta.theta *= ( 1 - dampingFactor );

   `dampingFactor` é aplicado POR CHAMADA de `update()`, ou seja POR QUADRO. O
   ÂNGULO TOTAL entregue é o mesmo em qualquer taxa (é uma série geométrica que
   soma 1) — o que muda é EM QUANTO TEMPO. A resposta da câmera é inversamente
   proporcional aos quadros por segundo. Simulado sobre a fórmula acima, com um
   arrasto de 0,02 rad numa órbita de 24 m, o tempo até 90 % do giro pedido:

       120 fps   317 ms          20 fps   1 900 ms
        60 fps   633 ms          30 fps   1 267 ms
        45 fps   844 ms

   Ou seja: a máquina que cai para 30 fps não fica só com metade dos quadros,
   ela fica com uma câmera que leva o DOBRO do tempo para chegar onde o ponteiro
   mandou. É por isso que "cair às vezes para menos de 60 fps" é sentido como
   arrasto pastoso e não como engasgo.

   A CORREÇÃO é a mesma que o laço já faz para o giro de apresentação e pelo
   mesmo argumento (ver o bloco do `dt` em `controls.update()`): o fator deixa de
   ser por quadro e passa a ser função do RELÓGIO.

       f(dt) = 1 − (1 − f₆₀)^(dt·60)

   ⚠️ A 60 fps ISTO DEVOLVE `f₆₀` EXATAMENTE. A troca é bit a bit invisível na
   máquina que já está boa; ela só age onde havia defeito. Simulado com a
   correção: 622 a 650 ms até 90 % do giro em TODAS as taxas de 20 a 120 fps.

   E ela ainda encurta a cauda no lugar certo: a 30 fps a inércia assenta em 34
   quadros em vez de 56, ou seja o laço sob demanda para de desenhar antes.

   ---------------------------------------------------------------------------
   ⚠️ E SE, MESMO A 60 fps, A CÂMERA CONTINUAR PARECENDO SOLTA — É ESTE NÚMERO,
   E SÓ ELE. A correção acima conserta a DEPENDÊNCIA da taxa de quadros; ela não
   toca no quanto de inércia foi AUTORADO, que é `AMORTECIMENTO_60` e mais nada.
   E o valor de hoje é pesado: 0,06 põe a câmera a 633 ms de onde o ponteiro
   mandou, mesmo com a máquina folgada. Isso é dois terços de segundo de atraso
   entre a mão e a imagem — que é uma escolha legítima (dá peso de "câmera de
   estúdio sobre trilho"), mas é também a descrição literal de "não sinto
   fluida".

   A tabela, para quem for girar o botão — mesma simulação, tempo até 90 % do
   giro, agora igual em qualquer taxa:

       0,06 (hoje)   633 ms       0,15   250 ms
       0,10          367 ms       0,25   150 ms

   Não mexido aqui de propósito: é decisão de PRODUTO, não de desempenho, e uma
   mudança de tato de câmera tem de ser vista rodando antes de virar padrão. */
/* ⚠️ MUTÁVEL, e SÓ pela afordance de console de `setOrbitDamping()`, logo abaixo.
   Era `const` até 2026-08-16. O valor é o TATO da câmera e é decisão de produto
   que só se toma OLHANDO, com o mouse na mão — não escolhendo um número no
   escuro. A tabela, agora que o fator é função do relógio e não do quadro:

       0,06 → 633 ms   peso de câmera de estúdio sobre trilho
       0,10 → 367 ms   ainda desliza, mas responde
       0,15 → 250 ms   parece colada na mão
       0,25 → 150 ms   seca; some o deslize macio do fim do movimento

   (milissegundos até a câmera chegar a 90 % de onde o ponteiro mandou.) */
let AMORTECIMENTO_60 = 0.06;

/**
 * Reescreve `dampingFactor` para o `dt` deste quadro. Ver o bloco acima.
 *
 * ⚠️ SEMPRE IMEDIATAMENTE ANTES de `controls.update(dt)`, e nos DOIS laços (o
 * vivo e o offline) — são espelhos um do outro por contrato.
 *
 * `drainControlsInertia()` de `record.ts` chama `update(0)` duzentas vezes sem
 * passar por aqui, e isso continua certo: ela roda com o fator que o último
 * quadro deixou, que é o que ela sempre fez.
 */
function sincronizarAmortecimento(dt: number) {
  /* O `dt` já vem limitado a 0,1 s pelo laço; o `clamp` é contra um chamador
     futuro, porque um fator ≥ 1 faria a órbita saltar o giro inteiro num quadro
     e um fator ≤ 0 a congelaria para sempre. */
  const d = THREE.MathUtils.clamp(dt, 1 / 480, 0.1);
  controls.dampingFactor = 1 - Math.pow(1 - AMORTECIMENTO_60, d * 60);
}
controls.dampingFactor = AMORTECIMENTO_60;

/** O tato atual da órbita — o fator que valeria a 60 fps. */
export const orbitDamping = () => AMORTECIMENTO_60;

/**
 * Muda o tato da câmera AO VIVO, para ser decidido olhando.
 *
 *     __studio.lighting.setOrbitDamping(0.12)
 *
 * ⚠️ NÃO É PERSISTIDO, DE PROPÓSITO. É botão de experimento: um tato de câmera
 * que sobrevive a um F5 é indistinguível de um defeito para a próxima pessoa que
 * abrir o estúdio nesta máquina. Se um valor graduar, ele graduta virando a
 * constante nova, com o número na tabela acima.
 *
 * ⚠️ E `drainControlsInertia()` (`scene/record.ts`) chama `update(0)` duzentas
 * vezes SEM passar por `sincronizarAmortecimento()`, então ela drena com o fator
 * que o último quadro deixou. Mexer nisto no meio de uma gravação muda como a
 * inércia é drenada — inofensivo para um botão de experimento, e é por isso que
 * ele é só um botão de experimento.
 *
 * Os limites não são números no escuro: abaixo de 0,02 o assentamento passa de
 * 2 s e a câmera lê como QUEBRADA em vez de pesada; acima de 0,6 a expressão já
 * se aproxima de 1 num `dt` pequeno, ou seja um salto seco, e some o peso que o
 * valor de fábrica compra.
 */
export function setOrbitDamping(f: number) {
  AMORTECIMENTO_60 = THREE.MathUtils.clamp(f, 0.02, 0.6);
  controls.dampingFactor = AMORTECIMENTO_60;
  invalidate(30);
  return AMORTECIMENTO_60;
}

controls.maxPolarAngle = Math.PI / 2 - 0.02;      // never orbit below the horizon
/* Belt and braces over the `controls.update()` return value the loop already
   reads. In r179 the two are the same signal — 'change' is dispatched from
   exactly two places, inside update() and inside reset(), and reset() calls
   update() straight afterwards — so this is redundant TODAY. It is here because
   the loop's version is an implementation detail of a library that can add a
   third dispatch site in any minor release, and the failure mode of missing one
   is a frozen viewport rather than an exception.
   Wrapped, not passed by reference: the listener receives an Event, which would
   land in invalidate()'s `frames` parameter and make the comparison NaN-false —
   i.e. a listener that silently does nothing. */
controls.addEventListener('change', () => invalidate());

const CAM_MIN_Y = 0.15;                            // pan guard: camera stays above ground

/* ---------------- frame / rig hooks ----------------
   weather.ts registers here instead of scene.ts importing it, which would be a
   cycle (weather needs `scene`, `camera` and the render loop). */
const frameHooks: ((dt: number) => void)[] = [];
const rigHooks: ((rig: Rig) => void)[] = [];
export function onFrame(fn: (dt: number) => void) { frameHooks.push(fn); }

/* ---------------- ganchos de QUADRO DESENHADO ----------------
   `onFrame()` roda SEMPRE, inclusive no quadro que o laço decidiu pular, e a
   nota do laço explica por quê: os ganchos de lá são grampos (a caixa do
   interior, a expulsão da carroceria, a casca de bruma seguindo a câmera) e um
   estado que eles não puderam corrigir seria um estado que o PRÓXIMO quadro
   desenhado renderiza errado. Aquela nota também diz o que aquilo pressupõe:
   *"são umas poucas operações de vetor, não uma chamada de desenho"*.

   O REFLEXO DO PISO QUEBRA ESSA PREMISSA, e quebra em grande estilo: ele é uma
   SEGUNDA PASSADA COMPLETA da cena (`floor-reflection.ts` →
   `renderer.render(scene, reflector)`), registrada como gancho de quadro por
   `cyclorama.ts`. Custo medido pelo próprio arquivo: 14,1 fps. Num laço sob
   demanda ele rodaria sessenta vezes por segundo com a cena parada, para
   preencher um alvo que ninguém vai amostrar — ou seja, o cenário Estúdio
   pagaria o preço inteiro do laço contínuo e não receberia nenhuma das
   economias. A flag pareceria ligada e não estaria.

   Daí a segunda lista. Um gancho aqui roda DEPOIS de `applyAvoidance()` e
   `tuneShadowSpan()` — a câmera já está na posição verdadeira, que é o que um
   reflexo precisa — e IMEDIATAMENTE ANTES do `renderer.render()` do laço, que é
   o que garante que o alvo é preenchido no MESMO quadro em que o piso o lê. Um
   reflexo de um quadro atrás, num giro, é um borrão; já foi medido e recusado.

   A REGRA, para quem for registrar o próximo: se o gancho DESENHA, ele é
   `onDrawFrame`. Se ele CORRIGE ESTADO, é `onFrame`. */
const drawHooks: ((dt: number) => void)[] = [];
export function onDrawFrame(fn: (dt: number) => void) { drawHooks.push(fn); }

/* ---------------- ganchos de SOBREPOSIÇÃO ----------------
   A TERCEIRA lista, e ela existe porque as outras duas correm ANTES do
   `renderer.render()` — o que é exatamente o que um carimbo não pode fazer.

     `onFrame`      corrige ESTADO. Roda até em quadro pulado.
     `onDrawFrame`  DESENHA para um alvo próprio (o reflexo do piso), e tem de
                    terminar antes de a cena ser desenhada, para o piso lê-lo no
                    mesmo quadro.
     `onOverlay`    compõe POR CIMA do quadro já pronto.

   ⚠️ QUEM ENTRA AQUI ESCREVE NO BUFFER JÁ COMPOSTO, e é isso que o torna a
   única porta para algo que precise estar NO PIXEL DO ARQUIVO — overlay de DOM
   nunca é composto no canvas, e um canvas 2D intermediário custaria uma cópia de
   quadro inteiro por quadro (ver o cabeçalho de `scene/record.ts`). Hoje o único
   assinante é a VINHETA de encerramento do vídeo (`scene/outro.ts`) — e o
   primeiro foi uma marca d'água que existiu por algumas horas no mesmo dia e foi
   substituída por ela.

   ⚠️ E QUEM ENTRA AQUI É RESPONSÁVEL PELO `autoClear`. Um segundo `render()` com
   a bandeira ligada — que é o padrão — LIMPA o buffer e joga fora a cena que
   acabou de ser desenhada, sem erro nenhum. O assinante guarda e devolve.

   Chamados nos DOIS sítios de desenho (o laço vivo e `renderOfflineFrame`),
   porque as duas gravações possíveis passam cada uma por um deles: o caminho
   offline desenha à mão, e a reserva em tempo real lê o canvas que o laço
   compôs. Uma marca que só existisse num dos dois faria alguns vídeos saírem
   sem ela — e o usuário não teria como saber qual caminho a máquina dele pegou. */
const overlayHooks: ((dt: number) => void)[] = [];
export function onOverlay(fn: (dt: number) => void) { overlayHooks.push(fn); }
export function onRig(fn: (rig: Rig) => void) {
  rigHooks.push(fn);
  /* Fired immediately so a late subscriber is not one preset change behind —
     and that first call can change the picture (weather.ts sizes its rain field
     here, models.ts its wetness and probe gain), so it is an invalidation. */
  if (rigCur) { fn(rigCur); invalidate(); }
}

/* ---------------- light rig ---------------- */
const key = new THREE.DirectionalLight(0xffefe1, 3.1);
key.castShadow = true;                             // permanently — never toggled

/* SHADOW COVERAGE vs RESOLUTION — the one number that had to move for the
   ground-projected environments.
     before  2048² over ±14 m  →  2048 / 28 = 73.1 texels/m  (1.37 cm/texel)
     after   3072² over ±24 m  →  3072 / 48 = 64.0 texels/m  (1.56 cm/texel)
   ±14 was chosen when the only receiver was a procedural plane whose shadow
   nobody looked at past the truck. A photographed ground is different: the
   shadow IS the contact, and a frustum that stops 14 m from the origin cuts a
   dead-straight line across the photo. An 18 m tractor-trailer already spans
   ±9; at the `dourado` sun elevation (8°) a 4 m cab throws its shadow ~28 m,
   so only ±37 would clip nothing at all. ±24 holds the whole rig plus the near
   two thirds of the worst-case shadow — the part inside the frame — and the
   catcher below is clamped to match so the two never disagree.
   The density had to be bought back: 2048² over ±24 would be 42.7 texels/m,
   a 42 % loss on the one thing this pass exists to fix. 3072² costs 21 MB more
   depth target (16.8 → 37.7 MB) and gives away only 12 %, which PCF
   (shadow.radius runs 2–12 texels) blurs past anyway. Clamped to the device
   limit; three would clamp it too, but silently, and then these numbers would
   be a lie. */
const SHADOW_HALF = 24;
/* O PASSO LARGO, e por que ele precisou existir.
   ---------------------------------------------------------------------------
   Com ±24 m nenhuma CONSTRUÇÃO do cenário jamais entrou no mapa: a mais próxima
   do foco no Distrito Industrial está a 39 m. O relato — "nenhuma construção ou
   árvore tem sombra" — não era defeito de `castShadow`, de material nem de
   receptor; era a caixa. Medido na bancada, com um cubo de controle posto no
   lugar do caminhão: ele projeta uma sombra impecável, e o galpão ao lado, com
   a mesma bandeira, não projeta nada.

   ±60 m cobre o miolo edificado do cenário (galpões, contêineres, cerca, a
   linha de árvores) e custa 3,9 cm/texel contra 1,56 — e não ±90, que foi
   testado junto e entrega praticamente a mesma imagem por 5,9 cm/texel.

   NÃO É FIXO, e é aqui que o raciocínio do bloco acima continua valendo: a
   densidade de perto é o produto. O passo largo só entra quando a câmera se
   afasta o bastante para as construções estarem em quadro — e aí o caminhão
   ocupa uma fração da tela, onde 3,9 cm/texel não se lê. Ver `tuneShadowSpan()`. */
const SHADOW_HALF_WIDE = 60;
/* O bias VIVE EM UNIDADES DE TEXEL, e esta é a armadilha que custou três
   rodadas de bancada: alargar a caixa sem escalar os dois números apaga TODAS
   as sombras, inclusive a do caminhão. A 11° de elevação do `ensolarado` o
   contato é rasantíssimo, e um `normalBias` de 2 cm que valia 1,3 texel a ±24 m
   vale 0,34 a ±60 — a sombra vaza por baixo do próprio objeto (peter-panning) e
   some. Foi por isso que as primeiras tentativas de alargar pareceram provar
   que "alargar não adianta". Adianta; só não sozinho. */
const SHADOW_BIAS = -0.0004;
const SHADOW_NORMAL_BIAS = 0.02;
/* 3072 no nível Alto — o mesmo número de sempre, e ele continua sendo aparado
   pelo `maxTextureSize` do adaptador dentro de `getProfile()`. O TIPO do mapa
   (`PCFShadowMap`) NÃO entra no perfil: ele é `#define` e trocá-lo recompilaria
   a cena inteira, que é o engasgo que a adaptação automática existe para
   evitar. O tamanho é só realocação de alvo, e por isso é trocável a quente —
   ver `applyQualityProfile()`. */
const SHADOW_MAP_SIZE = Math.min(getProfile().shadowMapSize,
  renderer.capabilities.maxTextureSize || 3072);
/* O LADO VIVO do mapa, que não é a constante acima: `applyQualityProfile()`
   realoca o alvo quando o nível muda, e o bias precisa saber disso — ver
   `shadowTexelScale()`. A constante continua sendo o valor de ABERTURA; esta é
   o estado. */
let shadowMapSide = SHADOW_MAP_SIZE;
/* A resolução em que `SHADOW_BIAS` e `SHADOW_NORMAL_BIAS` foram calibrados. Não
   é `SHADOW_MAP_SIZE` — essa depende do nível em que a página abriu, e usá-la
   como referência faria a calibração significar coisas diferentes conforme o
   nível de abertura, que é o mesmo defeito de outra forma. */
const SHADOW_BIAS_REF_SIZE = 3072;
key.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
key.shadow.camera.left = -SHADOW_HALF; key.shadow.camera.right = SHADOW_HALF;
key.shadow.camera.top = SHADOW_HALF; key.shadow.camera.bottom = -SHADOW_HALF;
/* near 4 → 1. The light orbits at r = 26 and the ortho box now reaches 24 m
   toward it, so ground directly under a low sun sits 26 − 24·cos(el) ≈ 2.2 m
   from the light — in front of a near plane of 4, which drops it out of the
   shadow test entirely. An ortho depth range is linear, so 1..90 instead of
   4..90 widens it by 3.5 % and the existing bias values keep their meaning. */
key.shadow.camera.near = 1; key.shadow.camera.far = 90;

/* ---------------- O BIAS, E O SEGUNDO FATOR QUE FALTAVA ----------------
   O bloco de `SHADOW_BIAS` acima já explica que o bias VIVE EM UNIDADES DE
   TEXEL e que alargar a caixa sem escalar os dois números apaga todas as
   sombras. `setShadowSpan()` respeitava isso — mas só metade.

   O TAMANHO DO TEXEL TEM DOIS FATORES, e só um estava sendo compensado:

       metros por texel = (2 · meia-caixa) / lado_do_mapa

   `setShadowSpan()` escalava por `half / SHADOW_HALF`, ou seja pelo NUMERADOR.
   O denominador — o lado do mapa — passou a variar quando o perfil de qualidade
   ganhou `shadowMapSize`, e ninguém escalou por ele. Consequência medida na
   aritmética: descer de 3072² para 1024² triplica os metros por texel, então um
   `normalBias` de 2 cm que valia 1,3 texel passa a valer 0,43 — e 0,43 texel é
   exatamente o regime de peter-panning que este bloco existe para evitar.

   Ou seja: **o nível Baixo provavelmente já vinha vazando a sombra por baixo do
   próprio objeto**, e o sintoma (sombra que descola do pneu) seria lido como
   "a qualidade baixa é feia" em vez de "o bias está errado". Composto com o
   passo largo de ±60 m o fator chegava a 1/9.

   Os dois fatores se multiplicam, e esta é a única função que os escreve. */
function applyShadowBias() {
  const k = (shadowHalf / SHADOW_HALF) * (SHADOW_BIAS_REF_SIZE / shadowMapSide);
  key.shadow.bias = SHADOW_BIAS * k;
  key.shadow.normalBias = SHADOW_NORMAL_BIAS * k;
}
key.shadow.radius = 2;
scene.add(key, key.target);

/* ---- ONDE A CAIXA DE SOMBRA FICA CENTRADA, e por que ela não podia ficar na
   ORIGEM.
   ---------------------------------------------------------------------------
   O bloco acima raciocina inteiro em "distância da origem" — "a frustum that
   stops 14 m from the origin", "±24 holds the whole rig". Isso pressupõe que o
   conjunto MORA na origem, e ele não mora: `vehicle/models.ts` declara
   `RIG_PLACEMENT = { z: 22, yaw: π }` e `setRigPlacement(true)` põe o `rigGroup`
   a 22 m em Z, girado 180° (12 m da primeira posição + 10 de recuo). O solver de
   engate entrega a garganta da quinta roda na origem do rig, e com o giro o
   caminhão aponta para −Z: o cavalo ocupa mais ou menos z 16…22 e o implemento
   cresce de 22 para trás, até z ≈ 36 num baú de 14,7 m.

   Com a caixa de ±24 m centrada na origem, o corte cai em z = 24 — ou seja,
   dentro dos dois primeiros metros do baú. O cavalo está inteiro dentro do
   frustum e projeta; o implemento fica quase todo FORA e não projeta nada. É o
   relato, literal: "somente o cavalo faz sombra, o trailer não". E não é um
   defeito de `castShadow`, de material nem de receptor — nada disso é
   consultado para geometria que a câmera de sombra não enxerga.

   A correção é mover a caixa para o conjunto, não alargá-la: dobrar
   `SHADOW_HALF` para cobrir a origem E o rig custaria 4× a área do mapa (de
   64 para 32 texels/m no mesmo 3072², que é a densidade que o bloco acima
   comprou de volta de propósito) para iluminar 22 m de pátio vazio.

   Como uma luz DIRECIONAL só lê `position − target` para sombrear, transladar
   os dois juntos não muda um pixel de iluminação — muda apenas de onde a
   câmera ortográfica olha. Quem informa o centro é `setVehicleFocus()`, que já
   recebe a caixa do conjunto medida DEPOIS do engate (`focusOnRig()` em
   studio.ts) e já é seguida de `invalidateShadows()`. */
const KEY_ORBIT_R = 26;
/** Meia-caixa de sombra em vigor. Ver `tuneShadowSpan()`. */
let shadowHalf = SHADOW_HALF;
/* PRIMEIRA ESCRITA DO BIAS, e ela tem de ficar AQUI e não lá em cima junto do
   resto do rig: `applyShadowBias()` lê `shadowHalf`, e um `let` lido antes da
   própria declaração é zona morta temporal. A função é declaração hoisted, o
   estado não — a mesma armadilha de içamento que o bloco de `busyUntil`
   documenta, e a razão de esta linha existir separada. */
applyShadowBias();
/* A DISTÂNCIA DA LUZ TAMBÉM É FUNÇÃO DA CAIXA, e esta foi a terceira peça.
   ---------------------------------------------------------------------------
   A ortográfica de sombra nasce NA POSIÇÃO da luz e mede `near`/`far` dali. Com
   a luz a 26 m do foco, um galpão a 40 m DO LADO DO SOL fica ATRÁS do plano da
   luz — distância negativa, fora de near/far, nunca entra no mapa de
   profundidade por mais que se alargue a caixa. Recuar é de graça para a
   ILUMINAÇÃO, porque uma direcional só lê `position − target` (é o mesmo
   argumento que já autoriza transladar luz e alvo juntos, acima); só muda de
   onde a câmera de sombra olha.

   3,4 × a meia-caixa põe a luz fora de qualquer canto dela com folga, e o piso
   de `KEY_ORBIT_R` preserva exatamente a geometria de fábrica no passo fechado. */
const keyDistance = () => Math.max(KEY_ORBIT_R, shadowHalf * 3.4);
/** Direção UNITÁRIA do alvo para a luz. É ela que sombreia, não `key.position`
 *  — que a partir daqui carrega o deslocamento do conjunto somado. */
const _keyDir = new THREE.Vector3(0, 1, 0);
/** Centro da caixa de sombra, em mundo. Origem enquanto não há conjunto. */
const _shadowFocus = new THREE.Vector3();

/** Repõe luz e alvo em torno de `_shadowFocus`, preservando `_keyDir`. */
function placeKeyLight() {
  key.position.copy(_keyDir).multiplyScalar(keyDistance()).add(_shadowFocus);
  key.target.position.copy(_shadowFocus);
  /* A câmera de sombra lê `light.matrixWorld` e `light.target.matrixWorld`, não
     `position`. Os dois nós ficaram FORA do congelamento de `models.ts` e
     recompõem sozinhos no `updateMatrixWorld()` da cena — mas essa passagem só
     acontece no `render()`, e quem chama isto de fora do laço (setVehicleFocus)
     marca o mapa como sujo no mesmo instante. Escrever aqui é o que garante que
     o passe de sombra desse quadro já use a pose nova. */
  key.updateMatrixWorld(true);
  key.target.updateMatrixWorld(true);
}

/* ---- A TROCA DE PASSO DA CAIXA DE SOMBRA ----
   As três grandezas — meia-caixa, distância da luz e bias — TÊM de andar
   juntas; é a lição das rodadas de bancada que precederam isto, em que mexer
   numa só sempre pareceu provar que o conserto não funcionava. Esta é a única
   função que as escreve.

   `radius` NÃO entra aqui de propósito: ele é do preset (`applyRig` escreve
   `rig.shadowRadius` a cada clima) e é medido em TEXELS, então a maciez em
   metros já acompanha a caixa sozinha. Escrevê-lo aqui criaria um segundo dono
   do mesmo campo — exatamente o defeito que o bloco do `envMapIntensity` na
   molhagem documenta. */
function setShadowSpan(half: number) {
  if (half === shadowHalf) return;
  shadowHalf = half;
  const cam = key.shadow.camera;
  cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
  /* `far` cobre a luz recuada MAIS a caixa inteira; `near` fica em 1 pelo mesmo
     motivo de sempre (o chão sob sol rasante encosta no plano próximo). */
  cam.far = keyDistance() * 2 + half * 2;
  cam.updateProjectionMatrix();
  /* DELEGADO, e não escrito aqui: o bias tem DOIS fatores (a meia-caixa e o
     lado do mapa) e escrever um deles neste ponto foi exatamente o que deixou o
     outro esquecido quando o perfil de qualidade ganhou `shadowMapSize`. Um
     dono só. */
  applyShadowBias();
  placeKeyLight();
  renderer.shadowMap.needsUpdate = true;
  invalidate();
}

/* HISTERESE, e ela não é enfeite: cada troca de passo custa um passe de sombra
   inteiro sobre o cenário, e um limiar seco faria a órbita repintar o mapa a
   cada quadro em que o usuário passeasse em cima dele. A banda morta de 6 m é
   larga o bastante para o arrasto normal não a atravessar de ida e volta.

   O critério é a distância da câmera ao FOCO, não o cenário em si: perto, o
   produto é o contato do pneu no chão e nada mais cabe no quadro; longe, o
   caminhão vira uma fração da tela e quem manda na leitura é o distrito. O
   estúdio (ciclorama) nunca sai do passo fechado porque a órbita lá não chega
   a 30 m — e é o que preserva bit a bit o que já estava aprovado. */
const SHADOW_STEP_OUT = 30;
const SHADOW_STEP_IN = 24;
function tuneShadowSpan() {
  const d = camera.position.distanceTo(_shadowFocus);
  if (shadowHalf === SHADOW_HALF) { if (d > SHADOW_STEP_OUT) setShadowSpan(SHADOW_HALF_WIDE); }
  else if (d < SHADOW_STEP_IN) setShadowSpan(SHADOW_HALF);
}

/* cool counter-light from behind: separates the bodywork from the sky and
   gives the metallic flanks something to catch */
const rim = new THREE.DirectionalLight(0xbfd6ff, 0.35);
scene.add(rim);

/* sky/ground bounce + a floor of ambient so nothing is ever pure black */
const hemi = new THREE.HemisphereLight(0x8fb8f0, 0x514c44, 0.35);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0x6f7d90, 0.10);
scene.add(ambient);




/* ---------------- céu e postes ----------------
   O QUE ERA "road environment" ATÉ 2026-08-03. Este bloco construía, no load do
   módulo, um plano de grama de 700 m, duas orlas de brita e uma faixa de asfalto
   procedurais — o chão dos cenários que eram uma FOTO equirretangular com CG por
   baixo. Esses cenários saíram do catálogo, e todo cenário que restou traz
   geometria de verdade (`set.glb`), que É o chão: os planos procedurais ficaram
   permanentemente invisíveis (`setSetGround(true)` os desligava em todo apply) e
   foram removidos.

   O que sobrou aqui é o que nunca dependeu daquilo: o domo de céu procedural, as
   estrelas e a fileira de postes. */
/* Escritos por `mountSky()` no load do módulo, antes que qualquer leitor exista
   — daí a asserção de atribuição definida em vez de `| null`. */
let skyDome!: THREE.Mesh;
let starsMesh!: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
let lampGroup!: THREE.Group;
/* construído uma vez, no primeiro preset molhado; ver puddleSpec */
let puddleCanvas: HTMLCanvasElement | null = null;

(function mountSky() {
  skyDome = makeSkyDome();
  scene.add(skyDome);
  starsMesh = makeStars();
  scene.add(starsMesh);

  /* Os postes penduram na CENA, não num grupo de estrada. Deixaram de ser
     mobiliário de via no momento em que o pátio precisou de poste sem via. */
  lampGroup = makeLamps();
  scene.add(lampGroup);
  applyLampLayout();
})();


/* O ALBEDO SECO de cada material de chão, para a molhagem ser reversível.
   ---------------------------------------------------------------------------
   VAZIO NO LOAD DO MÓDULO, e isso é a correção de 2026-08-03. Até aqui estes
   três mapas eram semeados com os materiais procedurais (asfalto, grama, orlas
   e as duas faixas do near ground) — que deixaram de ser desenhados quando os
   cenários viraram geometria de verdade. O resultado é que `Chuvoso` continuava
   soltando chuva e ondulação, mas sobre um chão que NUNCA escurecia: os únicos
   materiais registrados eram invisíveis, e o chão real do set jamais entrava
   aqui, porque o único caminho que registrava material novo — resnapshotGround()
   — só era chamado de setGroundMaps()/setNearGround(), as duas funções do
   caminho de foto que morreu junto.

   Agora quem registra é o próprio dono do chão: set.ts chama
   registerGroundMaterials() logo depois de bindMaterials(), com o material e a
   família de superfície de cada um. */
const dryColors = new Map<THREE.MeshStandardMaterial, THREE.Color>();

/* Dry end of the roughness lerp, per material. applyWetness() used to hard-code
   0.95; it is a Map now for exactly one reason: setGroundMaps() has to raise it
   to 1.0 when a real roughnessMap takes over, because three MULTIPLIES the
   map's green channel by material.roughness and 0.95 would quietly shave 5 %
   off an authored map. Seeded with 0.95 everywhere so behaviour is unchanged
   until an environment overrides it. */
const dryRough = new Map<THREE.MeshStandardMaterial, number>();

/* O reflexo de ambiente do material COM TEMPO SECO. Existe pelo mesmo motivo de
   dryColors e dryRough: applyWetness() é chamada de novo a cada mudança de clima
   e a cada troca de cenário, então ela tem de partir de um estado guardado em
   vez de assumir um. Sem isto, o valor de fábrica (1) vencia o do manifesto do
   cenário. Materiais que entram depois (o chão do set) são registrados em
   resnapshotGround(), que roda DEPOIS de bindMaterials. */
const dryEnv = new Map<THREE.MeshStandardMaterial, number>();

/* Roughness map to fall back to when the road is DRY. null for the procedural
   asphalt (it has none); an environment's PBR roughness map otherwise. Without
   this the first dry preset after a wet one would throw the PBR map away —
   applyWetness() unconditionally assigned `null`. */
/* Value typed nullable only because prepGroundTex() returns `Texture | null`;
   nothing ever stores a null here (the caller has already tested the texture). */
const baseRoughMap = new Map<THREE.MeshStandardMaterial, THREE.Texture | null>();

/* Last wetness applied. Kept because applyRig() only runs during a tween: after
   setGroundMaps() swaps a material's albedo we must replay the wetness right
   away or a wet road sits there showing a dry albedo until the next preset
   change. */
let curWetness = 0;

/* Wet asphalt is NOT a Fresnel/F0 change — water's F0 is 0.020, LOWER than
   asphalt's 0.04. It is (a) a large albedo drop, because water fills the pores
   and light that enters no longer scatters back out, and (b) a roughness
   collapse. The dramatic grazing-angle brightening comes for free from the
   F0→F90 term three already computes. Practitioners ship a diffuse multiplier
   around 0.2–0.3; we use 0.25 on the road, less on grass and gravel.

   These were four hard-coded set() calls until the near ground arrived with two
   more materials whose SURFACE TYPE is manifest data (a yard is concrete, a
   verge is grass). Table + Map, seeded to exactly the numbers that were
   inlined, so nothing about the procedural road changed. `rough: null` means
   "this surface has no wet roughness collapse" — grass does not become a
   mirror. */
/* `rough: null` is a real member of the type, not an absent field — see above. */
interface WetProfile { mul: number; rough: number | null; }
/* CHOVE NA CENA INTEIRA, e ate 2026-08-11 chovia so no chao.
   ---------------------------------------------------------------------------
   Duas lacunas, e as duas vinham da mesma premissa — "uma parede nao faz poca",
   que e verdade e nao era a pergunta:

   1. AS CONSTRUCOES NUNCA MOLHAVAM. `surfaceOf()` devolvia null para tudo que
      nao casasse com GROUND_NAME_RE, e um material sem familia nem chega a
      `registerGroundMaterials`. No `Chuvoso` o parque industrial inteiro ficava
      seco por baixo de chuva forte, com a rua espelhando ao lado — que e a
      leitura de cenario de papelao, e nenhum ajuste no chao a corrige.
   2. A GRAMA MOLHAVA SO DE COR. `rough: null` deixava a rugosidade intocada, e
      grama encharcada e justamente o que ganha brilho: a lamina fica coberta de
      um filme de agua e devolve o ceu na rasante. So escurecer 28 % da a
      leitura de "grama de outra especie", nao de grama molhada.

   `built` e a familia nova, e e deliberadamente CONTIDA: 0.86 de multiplicador
   contra 0.25 do asfalto. Parede molha e escorre — o que a chuva lhe faz e
   sobretudo um brilho de filme, nao um encharcado. Errar para o escuro aqui
   custa a cena inteira, porque sao 200 mil triangulos de fachada. */
const WET_PROFILE = {
  asphalt: { mul: 0.25, rough: 0.42 },
  concrete: { mul: 0.35, rough: 0.50 },
  gravel: { mul: 0.45, rough: 0.60 },
  dirt: { mul: 0.50, rough: 0.66 },
  /* 0.72 -> 0.66 e rugosidade 0.74: a grama escurece um pouco mais e passa a
     ter filme. NAO desce mais que isso — grama e o unico chao com geometria
     implicita (o tufo esta no normal map), e uma rugosidade de asfalto ali
     acende um realce especular por tufo que le como plastico. */
  grass: { mul: 0.66, rough: 0.74 },
  built: { mul: 0.86, rough: 0.68 },
} satisfies Record<string, WetProfile>;
/** The surface kinds a manifest may name; the keys of WET_PROFILE. */
type NearSurface = keyof typeof WET_PROFILE;
const wetProfile = new Map<THREE.MeshStandardMaterial, WetProfile>();

/* Materials that take the PUDDLE MASK while wet, and the tiling each one needs
   for it. Estes sao tambem os UNICOS materiais cujo `.roughnessMap` a
   applyWetness escreve; o resto e ligado por bindMaterials(). Dois donos do
   mesmo slot dariam corrida.

   PUDDLE_SPAN — A POCA TEM ESCALA PROPRIA, e nao a do ladrilho do material.
   ---------------------------------------------------------------------------
   Era `spec.u = spec.v = rep`, ou seja a mascara herdava o ladrilho do chao: no
   asfalto do Distrito isso e 6 m, e as 90 pocas do canvas repetiam INTEIRAS,
   iguais, de 6 em 6 metros nos dois eixos. Medido na propria mascara: 423 das
   512 colunas com agua, agrupadas em quatro bandas — porque 78 % das pocas
   eram presas as fracoes de `RUTS`, que sao as trilhas de pneu de um ladrilho
   que E a seccao da pista no asfalto PROCEDURAL. Num cenario com `set` o
   ladrilho e um quadrado de 6 m e essas quatro fracoes nao correspondem a
   trilha nenhuma: sobra um pente listrado, repetido. Era essa a leitura de
   "as pocas sao muito padrao e repetitivas".

   O PERIODO TEM DE FICAR ACIMA DA CELULA, e este numero ja foi ao valor errado
   uma vez — vale a pena o porque, porque o raciocinio que o levou la e
   plausivel e esta errado.

   Quem tira a periodicidade e o ladrilhamento estocastico de set.ts, e ele so
   descorrelata ENTRE celulas: dentro de uma celula a textura ladrilha
   normalmente. Dai a deducao "entao o periodo tem de ser IGUAL a celula, senao
   ou a poca e picotada na fronteira ou a mascara repete dentro da celula". Foi
   posto em 1 por causa dela, e o resultado no app foi PIOR em todo o lado,
   inclusive no patio, que ja estava aprovado.

   O que a deducao nao pesa e que os dois defeitos NAO CUSTAM O MESMO. Uma poca
   cortada na fronteira de uma celula tem borda suave (os pesos vao ao cubo, a
   mistura e estreita) e le-se como poca com forma estranha; uma mascara que
   repete DENTRO da celula le-se como grade, que e a queixa original. Entre
   picotar e repetir, picota-se.

   3.5 da 21 m no asfalto, 28 m no patio e 14 m na grama, contra celulas de
   7,8/9,6/4,8 m — ou seja periodo ~2,9x a celula em todos, que e a proporcao
   validada no patio. Mexer aqui sem mexer em uBreakCell muda essa proporcao. */
const PUDDLE_SPAN = 3.5;
interface PuddleSpec { u: number; v: number; ox: number; tex: THREE.CanvasTexture | null; }
const puddleSpec = new Map<THREE.MeshStandardMaterial, PuddleSpec>();

function applyWetness(w: number) {
  curWetness = w;
  for (const [m, prof] of wetProfile) {
    const dry = dryColors.get(m);
    if (!dry) continue;
    /* NOTE m.color is a DERIVED value: it is recomputed from dryColors on every
       call, never read back. Anything that wants to change a ground albedo has
       to write dryColors — see resnapshotGround(). */
    m.color.copy(dry).multiplyScalar(1 - w * (1 - prof.mul));
    if (prof.rough !== null && prof.rough !== undefined) {
      m.roughness = THREE.MathUtils.lerp(dryRough.get(m) ?? 0.95, prof.rough, w);
    }
    /* RELATIVO ao valor seco do material, nunca absoluto.
       `= 1 + w*0.35` era a linha, e com tempo seco (w = 0) ela escrevia
       EXATAMENTE 1 em cima de qualquer coisa que o cenário tivesse pedido —
       incluindo o `envIntensity` do chão do set (0.20 no concreto, 0.28 no
       asfalto do Distrito Industrial). Era um segundo dono do mesmo slot, e é a
       explicação de "o chão está muito reflexivo" ter sobrevivido a duas
       reduções no manifesto: o manifesto aplicava, e a chuva — mesmo a zero —
       apagava logo em seguida. A molhagem continua fazendo o que fazia (+35% no
       encharcado); ela só não decide mais o valor seco. */
    m.envMapIntensity = (dryEnv.get(m) ?? 1) * (1 + w * 0.35);
  }

  /* The puddle roughnessMap is attached only while wet. Adding/removing a map
     flips USE_ROUGHNESSMAP and compiles one extra program for these ground
     materials — a few milliseconds, once, on an explicit preset change, and
     cached from then on. Worth it: without a mask the whole road becomes
     uniformly mirror-smooth, which reads as ice, not rain. */
  const wantMap = w > 0.02;
  if (wantMap && !puddleCanvas) puddleCanvas = makePuddleCanvas();
  for (const [m, spec] of puddleSpec) {
    if (wantMap && !spec.tex) {
      /* One canvas, one THREE.CanvasTexture per consumer: the two surfaces need
         different repeat/offset transforms and a Texture owns exactly one. */
      /* non-null: the `wantMap` gate three lines up is what builds it. */
      spec.tex = canvasTex(puddleCanvas!, spec.u, spec.v, THREE.NoColorSpace);
      spec.tex.offset.set(spec.ox, 0);
    }
    /* Dry falls back to the ENVIRONMENT's roughness map when there is one, not
       to null. Water filling the pores is exactly why it is correct for the
       puddle mask to win while wet. */
    const target = wantMap ? spec.tex : (baseRoughMap.get(m) || null);
    if (m.roughnessMap !== target) {
      m.roughnessMap = target;
      m.needsUpdate = true;
    }
  }
  /* Ground albedo/roughness/envMapIntensity just moved. Covers the two callers
     that do NOT come through applyRig(): resnapshotGround() and, through it,
     registerGroundMaterials() when set.ts finishes binding a scenario's floor. */
  invalidate();
}

/* Re-baseline the dry albedo of materials whose maps were just swapped, then
   replay the current wetness so the visual state is consistent immediately.
   Callers MUST have written the intended DRY colour first: snapshotting a
   currently-wet m.color would bake the wet multiplier into dryColors forever
   and every later wet preset would multiply against it again. */
function resnapshotGround(mats: THREE.MeshStandardMaterial[]) {
  for (const m of mats) {
    dryColors.set(m, m.color.clone());
    /* O reflexo seco entra JUNTO com a cor seca. Um material que chega aqui
       acabou de ser configurado pelo cenário (set.ts→bindMaterials), então o que
       ele tem agora É o valor seco — e é o que a molhagem tem de modular em vez
       de substituir. */
    dryEnv.set(m, m.envMapIntensity);
    dryRough.set(m, m.roughness);
  }
  applyWetness(curWetness);
}

/** Uma família de superfície conhecida por WET_PROFILE. */
export type GroundSurface = NearSurface;

/** O que set.ts entrega por material de chão do cenário. */
export interface GroundMatEntry {
  mat: THREE.MeshStandardMaterial;
  /** família de molhagem; `road: true` marca quem recebe a máscara de poça */
  surface: GroundSurface;
  road?: boolean;
  /** metros cobertos por [u, v] do material, para casar a poça com o ladrilho */
  tile?: [number, number];
}

/**
 * REGISTRA O CHÃO DO CENÁRIO NO SISTEMA DE MOLHAGEM.
 *
 * Chamado por set.ts DEPOIS de bindMaterials(), quando cada material já está com
 * os valores do manifesto — que é exatamente o estado "seco" que a chuva tem de
 * modular. Chamar antes gravaria os padrões do three como valor seco e o
 * cenário perderia o próprio `envIntensity`/`roughness` na primeira chuva.
 *
 * Substitui o registro anterior por completo: os materiais do cenário que saiu
 * já foram descartados, e mantê-los aqui vazaria material morto para dentro de
 * `applyWetness`, que percorre este mapa todo quadro de tween.
 */
export function registerGroundMaterials(entries: GroundMatEntry[]) {
  /* Solta a máscara de poça do cenário anterior antes de perder a referência —
     é uma CanvasTexture por consumidor, e ninguém mais a alcança depois daqui. */
  for (const spec of puddleSpec.values()) if (spec.tex) spec.tex.dispose();
  wetProfile.clear();
  puddleSpec.clear();
  dryColors.clear();
  dryRough.clear();
  dryEnv.clear();
  baseRoughMap.clear();

  const mats: THREE.MeshStandardMaterial[] = [];
  for (const e of entries) {
    if (!e || !e.mat) continue;
    wetProfile.set(e.mat, WET_PROFILE[e.surface] || WET_PROFILE.concrete);
    /* O mapa de rugosidade do cenário é o estado SECO ao qual a poça volta.
       Sem isto, o primeiro preset seco depois de um molhado jogaria fora o mapa
       autorado — applyWetness() atribuiria `null`. */
    if (e.mat.roughnessMap) baseRoughMap.set(e.mat, e.mat.roughnessMap);
    if (e.road) {
      /* A poça tem escala própria — ver PUDDLE_SPAN. O `repeat` do material
         entra só como referência do que é um ladrilho neste chão. */
      const [u, v] = e.tile || [1, 1];
      puddleSpec.set(e.mat,
        { u: u / PUDDLE_SPAN, v: v / PUDDLE_SPAN, ox: 0, tex: null });
    }
    mats.push(e.mat);
  }
  /* Fotografa o seco e reproduz a molhagem corrente na hora: trocar de cenário
     no meio de `Chuvoso` tem de entregar o chão já molhado, não seco até o
     próximo tween. */
  resnapshotGround(mats);
}



/* ---------------- the clock ----------------
   A continuous 06:00 → 24:00 time of day. Everything here is closed-form: no
   state, no per-frame integration, so any hour can be asked for in any order (a
   slider drag, a restored blob, an environment switch) and always gives the
   same answer.

   The sun is a plain circular arc, not an ephemeris. A real solar position
   wants a date, a latitude and the equation of time, and would then be accurate
   about something nobody can check from inside a truck configurator. What has
   to be true is the READ: the sun comes up low in the east, climbs, crosses,
   drops back to the horizon in the west and keeps going down — and the light's
   colour, height and the whole scene follow it without a seam. */
export const HOUR_MIN = 6, HOUR_MAX = 24;

/* Sunrise and sunset are the horizon crossings; their midpoint is solar noon,
   which lands on exactly 12:00 — what a user expects the middle of the slider
   to be. A 12.8 h day is a low-latitude, barely-seasonal one (Brazil). */
const SUNRISE_H = 5.6, SUNSET_H = 18.4;
const DAY_SPAN = SUNSET_H - SUNRISE_H;

/* Altitude at solar noon. Deliberately above every preset's authored keyEl (the
   highest is chuvoso's 68) so the top of the clock is the top of the range
   rather than a value some preset already sits at. */
const EL_MAX = 72;

/* THE AZIMUTH CONVENTION, read off applyRig() rather than assumed. There the
   key light is placed at
       ( r·cos(el)·sin(az), r·sin(el), r·cos(el)·cos(az) )
   and aims at the origin, so keyAz is a COMPASS BEARING with +Z as north:
       0° → +Z      90° → +X      180° → −Z      270° → −X
   increasing clockwise seen from above. Calling +X east makes 80 → 280 a
   monotonic ENE → due south → WNW sweep, i.e. east to west, which is the one
   this module wants.
   Cross-checked against the authored data rather than trusting the arithmetic:
   `dourado` — the golden-hour preset — puts its sun at 285°, and NIGHT_CLEAR
   puts the moon at 300°. This sweep reaches both just after sunset, which is
   when those presets are meant to be looking. Sweeping the other way (80 → 0 →
   280) would hit 285/300 at DAWN and put the sun due north at midday, i.e. it
   would be a sun that rises in the west. */
const AZ_RISE = 80, AZ_SET = 280;

/* Below the horizon the key light becomes the moon. It is the same light — that
   is this module's central decision — so it stays on the same bearing track and
   only its height is re-floated, from the horizon back up to roughly
   NIGHT_CLEAR's authored 48°. The crossover is a smoothstep on the sun's
   altitude that does not open until the sun is properly gone (−2°), so the low
   warm rake at sunset is not cut short by the moon lifting early. */
const EL_FLOOR = 3, EL_NIGHT = 46;
const MOON_LO = -26, MOON_HI = -2;

/* Twilight band, in degrees of solar altitude. Wider than the real civil and
   nautical bands (−6° / −12°) on purpose: the sun here sweeps 5.6°/h, and the
   brief is a dusk that visibly takes from ~17:00 to ~19:30, not an accurate
   one. Puts n = 0.04 at 17:30, 0.38 at 18:00, 0.66 at 18:24 and 1 by 19:20. */
const NIGHT_ALT = -14, DAY_ALT = 22;

/* Low-sun reddening band: full strength with the sun just above the horizon,
   gone by the time it is a third of the way up. */
const GOLD_LO = -10, GOLD_HI = 2, GOLD_FADE_LO = 3, GOLD_FADE_HI = 26;

/* Canonical hours for the two legacy faces. Chosen so setTimeOfDay() still
   produces EXACTLY the old rigs: n(12:00) is 0 (alt 72, past DAY_ALT) and
   n(21:30) is 1 (alt −49.6, past NIGHT_ALT), so 'dia' is the undiluted `dia`
   face and 'noite' the undiluted `noite` face, to the bit. */
/** The two legacy faces, and the only values `sceneState.timeOfDay` ever holds. */
type TimeOfDay = 'dia' | 'noite';
const TOD_HOUR = { dia: 12, noite: 21.5 };

const smooth = THREE.MathUtils.smoothstep;
const dayFraction = (h: number) => (h - SUNRISE_H) / DAY_SPAN;

/** Solar altitude in degrees. SIGNED — negative once the sun is down. */
function sunAltitude(h: number) { return EL_MAX * Math.sin(Math.PI * dayFraction(h)); }

/** Day↔night blend weight: 0 = undiluted `dia` face, 1 = undiluted `noite`. */
function nightnessAt(h: number) { return 1 - smooth(sunAltitude(h), NIGHT_ALT, DAY_ALT); }

/* ---------------------------------------------------------------------------
   A TRAVESSIA DOS DOIS PLATES DE CÉU — a segunda banda de crepúsculo, e por que
   ela não é `nightness` (2026-08-24)

   `scene/skyblend.ts` dissolve o plate de dia no de noite. Até aqui o peso saía
   de `pesoDe(nightness) = smoothstep(nightness, 0,25…0,95)`, e as duas
   saturações se somavam:

       nightness satura em alt −14°  ⇒  19:20
       a curva satura em n = 0,95    ⇒  **18:55**

   Ou seja: **toda a travessia acontecia entre 17:45 e 18:55, e de 19:00 a 24:00
   o céu era bit-a-bit o mesmo.** Medido no controle de hora, que anda de 0,25 em
   0,25 sobre 06:00–24:00: 5 paradas de 72 carregavam a mudança inteira e 20
   paradas não mudavam nada. É o relato "a transição depois das 19:00 não é
   suave" — e ele está certo por inteiro, porque depois das 19:00 não havia
   transição, e a de antes era um degrau de 0,08 para 1,00 em quatro paradas.

   O CONSERTO É A ENTRADA, NÃO A CURVA. `nightness` é um campo saturado: ele
   existe para atravessar as duas FACES de preset (`dia`/`noite`) e não tem
   nada a dizer sobre o que acontece com o sol a −40°. Mas o sol continua
   descendo — a −70,6° à meia-noite — e é ele quem sabe a hora de verdade. Então
   o peso passa a sair da ALTITUDE, com banda própria.

   ⚠️⚠️ A PRIMEIRA TENTATIVA DESTA BANDA ERRADA — +12°…−30°, E O DONO A REPROVOU
   NA FOTO, com uma frase que diz exatamente o que aconteceu:

       *"mesmo estando escuro ainda mostra nuvens, por isso pedi outra hdri,
        um realmente de noite"*

   E a leitura dele estava meio certa e meio errada, de um jeito que só o render
   separa. **O plate de noite NÃO tem nuvem** — é céu azul-escuro limpo, com lua
   e estrelas; renderizado sozinho a `mix = 1` não há uma única nuvem nele. As
   nuvens da foto são do plate de **DIA**, que é um POENTE com cúmulo iluminado
   por baixo. Espalhar a travessia até −30° deixava **44 % do plate de dia no ar
   às 19:00**, e 44 % de um poente encoberto é um céu encoberto.

   ⚠️ **A LIÇÃO É SOBRE O ACOPLAMENTO, e ela não é óbvia:** neste par não existe
   plate de crepúsculo. O lado "dia" é um POENTE ESTÁTICO — o sol dele está
   sempre a +4,7°, as nuvens dele estão sempre acesas por baixo. Logo **todo peso
   residual do lado de dia é literalmente uma foto de poente sobreposta à noite**,
   e ele não desbota sozinho: `backgroundIntensity` escala os DOIS lados por
   igual, então escurecer não apaga a nuvem, só a deixa mais escura. Não há
   janela em que "meio a meio" leia como crepúsculo — leia como poente com
   estrela. **A travessia tem de ACABAR quando a noite começa, e o que pode ser
   espalhado é só o caminho até lá.**

   ---------------------------------------------------------------------------
   A BANDA, e ela foi escolhida por RENDER e não por gosto. Quatro candidatas
   foram compostas fora do navegador (o mesmo `mix()` do shader, o mesmo
   `lerp(1, 0,22, n)` de `applyRig()`, o mesmo ACES) e olhadas às 18:00, 18:30,
   19:00, 19:30, 20:00 e 21:00:

   | banda | 18:00 | 18:30 | 19:00 | veredito |
   |---|---|---|---|---|
   | `n` 0,25…0,95 (a original) | 0,083 | 0,770 | 1,000 | a noite chega, mas num degrau |
   | +12°…−30° (a 1ª tentativa) | 0,038 | 0,252 | **0,556** | ⚠️ **44 % de poente às 19:00 — a foto do dono** |
   | **+10°…−12°** | **0,049** | 0,552 | **0,988** | **as duas coisas ao mesmo tempo** |
   | +6°…−34° | 0,000 | 0,100 | 0,370 | pior ainda: a noite só chega às 20:00 |

   ⚠️ **E O LIMITE DE CIMA NÃO É FOLGA: ele é a trava da lua.** O cabeçalho de
   `skyblend.ts` mede o motivo — o pico do plate de noite é 55 633 (a lua, três
   texels) contra 33 do sol domado do `_puresky` de dia. Qualquer peso não
   desprezível antes de o poente ceder crava um ponto branco num céu laranja. Os
   +10° entregam **0,049 às 18:00**, contra os 0,083 da curva original: a banda
   nova não afrouxa aquela trava, ela aperta.

   ---------------------------------------------------------------------------
   ⚠️ E A SUAVIDADE NÃO VEM DAQUI — VEM DO PASSO DO CONTROLE.

   É a parte que a 1ª tentativa errou de alvo. A travessia tem de caber entre o
   sol a +10° (17:50) e a −12° (19:15): **uma hora e vinte de relógio**, e não há
   como alargar isso sem pôr poente dentro da noite. Com o passo de **0,25 h** que
   o controle tinha, essa janela são **quatro paradas** — e quatro paradas para ir
   de 0 a 1 são saltos de 0,25 por definição, faça-se a curva que se fizer.

   O que muda a experiência é o passo: `ui/hud.ts` passou a oferecer **5 minutos**
   (`1/12`), e aí a MESMA janela vira dezesseis paradas. Medido sobre a varredura
   inteira, o maior salto entre paradas vizinhas:

       curva original, passo 0,25 h    0,363
       curva original, passo 5 min     0,129
       **esta banda,   passo 5 min     0,100**

   Ou seja a suavidade é 3,6× melhor que o estado original **e** a noite continua
   chegando às 19:00. Quem for mexer na banda tem de olhar as duas colunas: uma
   banda mais larga melhora o salto e paga em nuvem. */
const SKY_DAY_ALT = 10, SKY_NIGHT_ALT = -12;

/** O peso do plate de NOITE em `scene/skyblend.ts`, 0..1. */
function skyMixAt(h: number) { return 1 - smooth(sunAltitude(h), SKY_NIGHT_ALT, SKY_DAY_ALT); }

/** Low-sun reddening weight, before the nightness/cloud damping in resolveRig. */
function goldenAt(h: number) {
  const alt = sunAltitude(h);
  return smooth(alt, GOLD_LO, GOLD_HI) * (1 - smooth(alt, GOLD_FADE_LO, GOLD_FADE_HI));
}

/** Key-light geometry for an hour: az wrapped into [0, 360), el clamped into
 *  the same 2..85 the manual "altura" control offers, so the clock can never
 *  hand the sliders a value they cannot express. */
function sunAngles(h: number) {
  const alt = sunAltitude(h);
  const el = THREE.MathUtils.lerp(
    Math.max(alt, EL_FLOOR), EL_NIGHT, 1 - smooth(alt, MOON_LO, MOON_HI));
  const az = AZ_RISE + (AZ_SET - AZ_RISE) * dayFraction(h);
  return { az: ((az % 360) + 360) % 360, el: THREE.MathUtils.clamp(el, 2, 85) };
}

/* Both faces of a preset, merged over RIG_BASE and converted to Colors once.
   resolveRig() runs on every slider event and the hour slider fires ~60x/s;
   rebuilding these from object spreads each time would allocate two rigs (26
   THREE.Colors) per event for data that only ever changes when a preset is
   EDITED, which it never is at runtime. Entries are read-only: lerpRig() writes
   only its destination. */
const faceCache = new Map<string, { day: Rig; night: Rig }>();
function presetFaces(id: string) {
  let f = faceCache.get(id);
  if (!f) {
    const p = LIGHT_PRESETS[id] || LIGHT_PRESETS.ensolarado;
    f = {
      day: makeRig({ ...RIG_BASE, ...(p.dia || {}) }),
      night: makeRig({ ...RIG_BASE, ...(p.noite || p.dia || {}) }),
    };
    faceCache.set(id, f);
  }
  return f;
}

/* A low sun goes orange because a long atmospheric path scatters the blue end
   out of it. That is geometry, not weather, so it belongs to the clock and
   applies to every outdoor preset — which is exactly what makes 18:00 under
   `ensolarado` a warm low sun instead of a straight fade from white to moon
   blue. Without it "warm low sun → blue hour → night" would just be
   "white → blue". */
const GOLDEN = new THREE.Color(0xff9a4e);

/* The only value ever handed to resolveRig()/envKey() is `sceneState` itself,
   so its shape is exactly LIGHT_DEFAULTS' — declared here rather than duplicated
   because the defaults object IS the schema. */
type SceneState = typeof LIGHT_DEFAULTS;

/* preset[dia] and preset[noite] crossfaded by the clock, the low-sun tint on
   top of that, then the user's own az/el/brightness. */
function resolveRig(st: SceneState) {
  const id = LIGHT_PRESETS[st.preset] ? st.preset : 'ensolarado';
  const faces = presetFaces(id);
  const n = nightnessAt(st.hour);
  /* Allocated for its shape only — lerpRig() covers every NUM_FIELD and every
     COLOR_FIELD, which together are all of RIG_BASE. */
  const rig = makeRig(RIG_BASE);
  lerpRig(rig, faces.day, faces.night, n);

  if (LIGHT_PRESETS[id].solar !== false) {
    /* Damped by nightness (past sunset there is no sun left to redden, and
       tinting an already-blue rig orange would just make it muddy) and by
       cloudiness (a deck thick enough to kill the sun's disc kills its colour
       with it — `nublado` and `chuvoso` stay grey at dusk, as they should). */
    const g = goldenAt(st.hour) * (1 - n)
      * (1 - 0.65 * THREE.MathUtils.clamp(rig.cloudiness, 0, 1));
    /* Publicado no rig ANTES do corte de 0,002, para que o campo seja sempre o
       peso verdadeiro desta hora e não "o peso, quando alguém o usou". Quem o lê
       é gradePlateColor(), na bruma medida — ver RIG_BASE.golden. */
    rig.golden = g;
    if (g > 0.002) {
      rig.keyColor.lerp(GOLDEN, 0.85 * g);
      rig.skyHaloColor.lerp(GOLDEN, 0.70 * g);
      rig.skyHorizon.lerp(GOLDEN, 0.75 * g);
      rig.skyMid.lerp(GOLDEN, 0.25 * g);
      /* fog and bg together: they are the same haze seen at two distances, and
         letting them drift apart is what makes a horizon seam. */
      rig.fogColor.lerp(GOLDEN, 0.50 * g);
      rig.bgColor.lerp(GOLDEN, 0.50 * g);
    }
  }

  rig.keyAz = st.az;
  rig.keyEl = st.el;
  rig.keyIntensity *= st.brightness;

  /* AS LUZES DO VEÍCULO, PELO RELÓGIO. Um motorista acende o farol pela hora e
     pelo hábito, não quando o sol cruza −3° — e neste cenário o sol se põe às
     18,4 h, então amarrar isto a `nightness` deixaria as lanternas em um quarto
     de brilho justamente às 18:00. A rampa de 36 minutos de relógio lê como
     alguém acendendo; instantâneo estalaria. Ver vehicle/lights.ts. */
  /* E TAMBÉM PELA INTENSIDADE DA CENA, a pedido: *"quando a intensidade da luz da
     cena do studio estiver abaixo de 20% tambem deve acender as lanternas"*.
     É a mesma leitura de operação que justifica o relógio — o que acende um farol
     é ESTAR ESCURO, e no estúdio escurecer é baixar a chave, não adiantar o
     ponteiro. As duas rampas entram por MÁXIMO e não por soma: às 21:00 com a
     chave no talo as lanternas já estão a pleno, e somar as levaria a 2 (o clamp
     de `setVehicleLightsLevel()` cortaria, mas o `vehLights` do rig é lido por
     `lampsWanted()` e por `beams.ts`, e um valor fora de 0..1 vazando por ali é o
     tipo de coisa que aparece meses depois).
     A rampa é 0,20 → 0,08 e não um degrau em 0,20: um corte seco estalaria no
     meio do arrasto do controle, que é exatamente o que a rampa do relógio existe
     para evitar. */
  const escuro = 1 - THREE.MathUtils.smoothstep(
    st.brightness, VEH_LIGHTS_DIM_FULL, VEH_LIGHTS_DIM_ON);
  rig.vehLights = Math.max(
    THREE.MathUtils.smoothstep(st.hour, VEH_LIGHTS_ON, VEH_LIGHTS_FULL), escuro);

  /* O PESO DO PLATE DE NOITE. Campo do rig pelo mesmo motivo que os dois acima:
     atravessa `lerpRig()` de graça, então um salto de hora (`setTimeOfDay`) vira
     crossfade em vez de estalo. Ver `skyMixAt()` para a banda e para por que ela
     não é `nightness`. */
  rig.skyMix = skyMixAt(st.hour);

  /* ---- A CAMADA DE ESTÚDIO ----
     Só nos presets marcados `studio: true` (hoje, só o `ciclorama`). Ela entra
     AQUI, no fim de resolveRig(), e não em applyRig(), por três consequências
     que saem de graça: o resultado atravessa `lerpRig()` — então trocar de fundo
     é um crossfade e não um salto —, entra no `envKey()` do cache de IBL pela
     mesma porta que todo o resto, e chega aos assinantes de `onRig()`, que é
     como cyclorama.ts fica sabendo do albedo novo sem ninguém importá-lo.

     São MULTIPLICADORES sobre o que o preset autorou, nunca valores absolutos:
     o `ciclorama` foi calibrado por medição (ver o cabeçalho dele), e um
     controle que substituísse aqueles números jogaria a calibração fora no
     primeiro arrasto. Com multiplicador, o meio da faixa É o preset. */
  if (LIGHT_PRESETS[id].studio) {
    const bd = backdropOf(st.backdrop);
    rig.cycloramaAlbedo = bd.albedo;
    /* O PISO E O REFLEXO SÃO CAMPOS PRÓPRIOS, e não `albedo` reaproveitado —
       ver o bloco de medição em BACKDROPS. */
    rig.cycloramaFloor = bd.floor;
    rig.cycloramaGloss = bd.gloss;
    rig.exposure *= bd.exposure;
    /* O fundo e a névoa andam JUNTOS — são a mesma coisa vista a duas
       distâncias, e deixá-los divergir é o que produz uma emenda no horizonte
       (a mesma razão já anotada no bloco dourado logo acima). As bandas do céu
       vão junto porque, num cenário sem sala, o domo é o que sobra de fundo. */
    rig.bgColor.setHex(bd.bg);
    rig.fogColor.setHex(bd.bg);
    rig.skyTop.setHex(bd.bg);
    rig.skyMid.setHex(bd.bg);
    rig.skyHorizon.setHex(bd.bg);
    /* O RECORTE é a única luz que ainda desenha um contorno quando figura e
       fundo têm o mesmo valor, então ele carrega DOIS fatores: o do fundo (que
       sobe sozinho no claro) e o do usuário. */
    rig.rimIntensity *= bd.rim * st.rim;
    /* O PREENCHIMENTO é hemi + ambiente movidos como um só. São a chapa branca
       do outro lado e a luz que chega igual em toda face: separá-los em dois
       controles daria ao usuário dois jeitos de achatar a mesma imagem. */
    rig.hemiIntensity *= st.fill;
    rig.ambientIntensity *= st.fill;
    /* E O AMBIENTE ENTRA JUNTO, que é a correção do relato de que o controle
       "quase não altera nada".
       MEDIDO: varrer o Preenchimento de 0 a 5 movia o sujeito de 182,9 para
       187,7 — QUATRO NÍVEIS E MEIO em 255, na faixa inteira do controle. A
       conta explica: hemi 0,32 e ambiente 0,09 contra uma chave de 3,4 é 12 %
       do rig, e o termo que faltava é maior que os dois juntos —
       `scene.environmentIntensity` vale 0,82 e sozinho responde por 17 níveis
       no sujeito e 49 no piso (medido apagando-o).
       Fisicamente é o mesmo termo: o preenchimento de um estúdio NÃO é uma
       lâmpada, é a luz que a sala inteira devolve, e num renderizador isso é o
       IBL. Um controle de preenchimento que não move o IBL move 12 % do
       preenchimento.
       A curva é `0,25 + 0,75·f^0,75`: em 1 ela vale 1,000 por construção (o
       preset calibrado fica intacto), em 0 sobra 0,25 — não zero, senão o
       verniz perde o realce e a tinta deixa de ser julgável — e em 5 chega a
       2,76, que é a "extravasada" que o relato pediu. */
    rig.envIntensity *= 0.25 + 0.75 * Math.pow(Math.max(0, st.fill), 0.75);
    /* A DIFUSÃO da sombra é o que lê como "tamanho da softbox" — o único
       parâmetro do rig que fala de tamanho de fonte de luz. */
    rig.shadowRadius *= st.softness;
    /* TEMPERATURA: a CHAVE e o PREENCHIMENTO, nunca o recorte.
       Num set real a key e a chapa de rebatimento são a MESMA lâmpada vista de
       dois lados, então esfriar uma e não a outra seria fisicamente estranho. O
       recorte é o kicker — uma segunda fonte, autorada fria de propósito para
       separar a lataria do fundo —, e arrastá-lo junto apagaria a única
       dominante deliberada da cena. Ver o cabeçalho do preset `ciclorama`.
       Multiplica, não substitui: em 6500 K o multiplicador é (1,1,1) exato e
       isto é uma operação nula, o que mantém o neutro do preset intacto. */
    if (st.temp !== TEMP_NEUTRAL) {
      kelvinTint(st.temp, _tempTint);
      rig.keyColor.multiply(_tempTint);
      rig.hemiSky.multiply(_tempTint);
      rig.ambientColor.multiply(_tempTint);
    }
  }
  return rig;
}

/* The geometry a preset authors for a face. Only reachable now through the
   `solar: false` branch of syncSunToHour() — for every other preset the clock
   owns az/el and resolveRig() overwrites both. */
function presetDefaults(id: string, tod: TimeOfDay) {
  const preset = LIGHT_PRESETS[id] || LIGHT_PRESETS.ensolarado;
  const face = { ...RIG_BASE, ...(preset[tod] || preset.dia || {}) };
  return { az: face.keyAz, el: face.keyEl };
}

/* MANUAL OVERRIDE POLICY — the HUD has a time slider AND separate "altura" and
   "posição" controls, and all three drive the same two numbers, so one side has
   to yield. The rule, in full:

     * Moving the CLOCK owns the sun. setHourOfDay() re-derives az and el and
       clears both flags. The time slider always wins, because it is the
       headline control and a clock that cannot move the sun is broken.
     * Touching altura or posição PINS THAT AXIS. setLightParams({ el }) marks
       el user-owned and nothing re-derives it until the clock next moves (or
       the preset changes). Per-axis, so pinning the height still lets the hour
       sweep the bearing.
     * A preset change clears both, because it re-derives from the clock too.

   The alternative — the hour permanently respecting a pinned angle — was
   rejected: the flags would become invisible sticky state, and the first user
   who nudged "altura" and forgot would find the time slider dead from then on.
   The cost of this choice is that the HUD must repaint those two controls after
   an hour change; hud.ts does. */
function syncSunToHour() {
  const preset = LIGHT_PRESETS[sceneState.preset] || LIGHT_PRESETS.ensolarado;
  const a = preset.solar === false
    ? presetDefaults(sceneState.preset, sceneState.timeOfDay)
    : sunAngles(sceneState.hour);
  if (!sceneState.azManual) sceneState.az = a.az;
  if (!sceneState.elManual) sceneState.el = a.el;
}

/* Write the clock and re-derive the binary face from it. `timeOfDay` is never
   set directly any more: resolveRig() has stopped reading it, but envKey(),
   presetDefaults() and every pre-clock caller still do, and hud.ts lights its
   sun/moon end-caps from it. The flip lands where the crossfade is half done
   (altitude 4°, i.e. 05:50 and 18:10). */
function setHourInternal(h: number) {
  const n = +h;
  sceneState.hour = Number.isFinite(n)
    ? THREE.MathUtils.clamp(n, HOUR_MIN, HOUR_MAX)
    : TOD_HOUR.dia;
  sceneState.timeOfDay = nightnessAt(sceneState.hour) >= 0.5 ? 'noite' : 'dia';
}

/* ---------------- state ----------------
   The clock added three fields (`hour`, `azManual`, `elManual`) and the key did
   NOT move with them. That is a deliberate call, not an oversight: the schema
   change is purely additive and restore() already validates and clamps every
   field independently, so a v3 blob written before the clock existed still
   boots — it simply has no `hour`, and its `timeOfDay` picks the canonical one
   (see restore(), which also explains why its az/el are not trusted). Bumping
   to a v4 would have thrown away everyone's saved preset and brightness to
   solve a problem the validating reader already solves. v1 and v2 predate that
   discipline and stay purged. */
/* v4 porque o preset de abertura mudou para `dourado`: um estado v3 gravado
   traz `preset: 'ensolarado'` e sobrescreveria o novo padrão em silêncio: quem
   já abriu o estúdio uma vez nunca veria a mudança. Aposentar a chave é o que
   faz o padrão novo valer para todo mundo, e é o mesmo movimento que v1→v2. */
/* v5 porque a hora de abertura mudou de 12:00 para 17:45 (ver OPEN_HOUR): um
   estado v4 gravado traz `hour: 12` e sobrescreveria o novo padrão em silêncio —
   quem já abriu o estúdio uma vez nunca veria a luz nova. É o mesmo motivo que
   aposentou v3 quando o preset de abertura virou `dourado`. */
const SCENE_KEY = 'truckstudio.scene.v5';
for (const old of ['truckstudio.scene.v1', 'truckstudio.scene.v2', 'truckstudio.scene.v3',
  'truckstudio.scene.v4']) {
  try { localStorage.removeItem(old); } catch (_) { /* ignore */ }
}

/* `dourado` e não `ensolarado` como padrão: sol a 8° de elevação, chave
   0xffbb81 contra um recorte frio (rim 0x9fb7e8) e halo forte no horizonte — é
   luz RASANTE, e é ela que faz a lataria mostrar o que a tinta tem. Sol a pino
   bate quase perpendicular à chapa: a casca de laranja some, o floco não
   cintila e o flop do perolizado não tem raspagem para aparecer. O preset
   continua trocável no HUD; o que muda aqui é só com o que a página ABRE. */

/* A HORA DE ABERTURA É 17:45, e não mais o meio-dia.
   Antes o `dourado` sozinho dava a cara rasante enquanto o relógio ficava em
   12:00 — o preset pintava a luz de dourada, mas a GEOMETRIA continuava de sol a
   pino. Sombra curta debaixo do veículo, nada de rastro comprido no chão, e a
   mistura dia/noite (nightnessAt) em zero: dourado no tom, meio-dia na forma.
   Com o relógio em 17:45 as duas coisas passam a concordar. Nesta latitude
   (SUNRISE_H 5.6 / SUNSET_H 18.4) a conta dá:
       sunAltitude(17.75) ≈ 11.4°   → sol baixo, sombra longa e rasante
       sunAngles(17.75).az ≈ 269.8° → oeste, contra os ~285° que o `dourado` já
                                      trazia autorado, então o preset e o relógio
                                      apontam para o mesmo lado
       nightnessAt(17.75) ≈ 0.21    → um fio de anoitecer no céu, ainda dia
       goldenAt(17.75)    ≈ 0.70    → avermelhamento de sol baixo quase cheio
   `az`/`el` seguem DERIVADOS de `hour` (os flags manuais continuam falsos), e é
   por isso que basta mudar a hora: sunAngles() reposiciona a chave sozinha. */
export const OPEN_HOUR = 17.75;

/* A HORA EM QUE AS LUZES DO VEÍCULO ACENDEM, e a hora em que estão cheias.
   Pedido do dono do produto: *"faca com que elas acendam a partir das 18:00"*.
   O 18,6 é a rampa — 36 minutos de relógio, dois passos e meio do controle. */
const VEH_LIGHTS_ON = 18.0, VEH_LIGHTS_FULL = 18.6;
/* A chave da cena: apagadas de 20 % para cima, a pleno no FIM DO CURSO.
   ⚠️ 0,15 e não 0,08 porque **o controle não chega a 8 %**: o cursor de
   intensidade do HUD anda de 15 % a 250 % do preset (ver hud.ts). Uma rampa que
   só fechasse abaixo do mínimo alcançável deixaria as lanternas em meia-luz no
   ponto mais escuro que o usuário consegue pedir — e o pedido é que ali elas
   estejam acesas. */
const VEH_LIGHTS_DIM_ON = 0.20, VEH_LIGHTS_DIM_FULL = 0.15;

export const LIGHT_DEFAULTS = {
  preset: 'dourado', timeOfDay: 'dia' as TimeOfDay, hour: OPEN_HOUR,
  /* az/el are DERIVED from `hour`; these are just what the clock says at 17:45.
     They stop being derived the moment one of the flags below goes true — see
     syncSunToHour() for the full override policy. */
  az: sunAngles(OPEN_HOUR).az, el: sunAngles(OPEN_HOUR).el, brightness: 1,
  azManual: false, elManual: false,
  /* ---- estúdio ----
     Lidos só pelos presets `studio: true` (ver a camada em resolveRig). Ficam
     NESTE objeto, e não numa segunda chave de localStorage, pelo mesmo motivo
     que ui/hud.ts dá para não persistir a luz duas vezes: duas fontes de verdade
     para o mesmo estado exigem uma ordem de boot que decida qual ganha.

     E a CHAVE NÃO SOBE PARA v6. O bloco acima explica a regra — restore() valida
     e limita cada campo em separado, então um blob v5 sem estes três campos
     entra com os defaults e funciona. Subir a versão jogaria fora o preset, a
     hora e o brilho de todo mundo para resolver um problema que o leitor
     validante já resolve. É a mesma decisão que manteve v3 quando o relógio
     entrou. */
  backdrop: DEFAULT_BACKDROP,
  /** preenchimento (hemi + ambiente), como fração do que o preset autorou */
  fill: 1,
  /** recorte (rim), idem */
  rim: 1,
  /** difusão da sombra (o "tamanho da softbox"), idem */
  softness: 1,
  /** temperatura de cor em Kelvin; 6500 = neutro exato, e é o padrão */
  temp: TEMP_NEUTRAL,
};
export const sceneState = { ...LIGHT_DEFAULTS };

/* `| 0` because 0 is the "no timer pending" sentinel the two readers below test
   for; a handle is whatever setTimeout returns in this build. */
let saveTimer: ReturnType<typeof setTimeout> | 0 = 0;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(flushSave, 400);          // sliders must not hammer localStorage
}
export function flushSave() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; }
  try {
    localStorage.setItem(SCENE_KEY, JSON.stringify({ v: 4, ...sceneState }));
  } catch (_) { /* ignore */ }
}
addEventListener('pagehide', flushSave);
addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });

/* ---------------- environment maps ----------------
   A gradient-sky IBL, one per preset+time. This matters far beyond looks: the
   moment puddle roughness drops to 0.05 the road becomes a mirror, and with
   the old RoomEnvironment it would mirror a white studio box. The canvas is
   equirectangular and deliberately CLOUDLESS — the PMREM mip chain destroys
   high-frequency detail for irradiance anyway, and a blurry reflection cannot
   be told from a gradient. */
/* Exported so environment.ts can PMREM its HDRIs through the SAME generator: a
   second PMREMGenerator on one renderer duplicates the whole blur/lod-plane
   scratch setup for nothing. */
export const pmrem = new THREE.PMREMGenerator(renderer);

/* THE CACHE HOLDS RENDER TARGETS, NOT TEXTURES, and that is the difference
   between this being disposable and not. `pmrem.fromEquirectangular()` returns a
   WebGLRenderTarget; keeping only its `.texture` — which is what this did —
   leaves the framebuffer and its colour attachment allocated with no handle left
   to free them. environment.ts's disposeEntry() makes the same point about its
   own HDRI targets, and for the same reason.

   BOUNDED, because the engine is a singleton that outlives the React page: with
   six presets x (ENV_NIGHT_STEPS + 1) keys plus 'room' the ceiling is ~25 live
   PMREM chains, and a 512x256 equirect bakes to a 128 cube at ~1.5 MB, so a user
   who explores the presets across the clock accumulates tens of megabytes that
   are never released for the rest of the browser session. Eight entries is the
   working set of one exploration session — a preset and its dusk band, plus the
   one before it — and a miss is a canvas draw plus one PMREM bake, i.e. the
   10-40 ms this module already schedules behind a 380 ms debounce. */
/* 8 → 12 quando o estúdio ganhou IBL próprio: a chave dele carrega fundo,
   temperatura E pose da chave (ver envKey), então uma sessão de ajuste visita
   bem mais entradas que os seis presets do céu. Doze cadeias de 1,5 MB são
   18 MB — o mesmo custo de duas texturas de lataria — e a alternativa é reassar
   um PMREM toda vez que o usuário volta uma pastilha atrás. */
const ENV_CACHE_MAX = 12;
const envCache = new Map<string, THREE.WebGLRenderTarget>();

/* ---------------- external environment (environment.ts) ----------------
   `externalEnv` is THE flag. Non-null ⇒ a photoreal HDRI owns scene.background
   and scene.environment and the procedural path must not write either one.
   Nothing else changes: lights, fog, exposure, wetness, lamps and the paint
   uniforms stay under the rig's control so the presets and sliders keep
   working over the photo. */
let externalEnv: THREE.Texture | null = null;          // PMREM texture bound to scene.environment
let externalBg: THREE.Texture | null = null;           // texture bound to scene.background
let extEnvIntensity = 1;         // envDef.envIntensity
let exposureBase = 1;            // envDef.exposure, composed with rig.exposure
let skyDomeOn = true;            // procedural dome (and therefore the stars)

/* Cache granularity for the procedural IBL along the clock. buildSkyEnv() reads
   the rig, and the rig is now a continuous crossfade, so keying the cache on
   `dia`/`noite` as before would snap every reflection at one instant halfway
   through dusk — the single place in the transition where a snap is visible,
   since the road is a mirror the moment it is wet. Four steps of nightness is
   the compromise. It cannot be per-frame: each entry is a canvas plus a full
   PMREM mip chain (~1.5 MB for a 512x256 equirect on a 128 cube), and only the
   dusk band ever builds more than one entry per preset.

   DO NOT LOWER THIS TO SAVE MEMORY. Coarser steps put the snap back, which is
   the artefact the whole scheme exists to remove; the number of entries is
   ENV_CACHE_MAX's problem and it is solved there, by eviction. */
const ENV_NIGHT_STEPS = 3;

function envKey(st: SceneState) {
  const p = LIGHT_PRESETS[st.preset];
  /* O ESTÚDIO TEM CHAVE PRÓPRIA, e ela é a lista do que buildStudioEnv() de
     fato desenha: fundo, temperatura e a POSE da chave. O que NÃO entra é o
     Preenchimento — ele mora em `scene.environmentIntensity`, ou seja escala a
     mesma textura em vez de mudá-la — nem a Intensidade da chave, que só abre o
     halo. Pôr qualquer um dos dois aqui trocaria um multiplicador de graça por
     uma reassadura de PMREM a cada quadro de arrasto.
     A pose é QUANTIZADA em 30° de azimute e 15° de altura: mais fino faria o
     cache girar durante um arrasto do dial, e mais grosso deixaria o realce do
     cromado parado enquanto a sombra anda. */
  if (p?.studio) {
    const az = Math.round((((st.az % 360) + 360) % 360) / 30) % 12;
    return 'studio:' + st.backdrop
      + ':k' + Math.round(st.temp / 600)
      + ':a' + az
      + ':e' + Math.round(st.el / 15)
      + ':n' + Math.round(nightnessAt(st.hour) * ENV_NIGHT_STEPS);
  }
  if (p && p.env === 'room') return 'room';
  return st.preset + ':n' + Math.round(nightnessAt(st.hour) * ENV_NIGHT_STEPS);
}

/* A smooth gradient reflects as nothing, which is exactly why a clearcoat over
   one reads as dull plastic rather than paint: gloss is perceived from the
   SHARPNESS OF WHAT IT REFLECTS, not from a roughness number. So this env
   deliberately carries hard structure — a crisp horizon line (the strongest
   single cue in any real car photograph), a bright near-horizon band, a tight
   sun core, and a few soft cloud bands to break up the sky. */
function buildSkyEnv(rig: Rig) {
  const W = 512, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = ctx2d(c);
  const hex = (col: THREE.Color) => '#' + col.getHexString(THREE.SRGBColorSpace);
  const horizonY = H * 0.5;

  /* sky: zenith → mid → horizon */
  const grad = g.createLinearGradient(0, 0, 0, horizonY);
  grad.addColorStop(0, hex(rig.skyTop));
  grad.addColorStop(THREE.MathUtils.clamp(1 - rig.skyMidPos, 0.05, 0.95), hex(rig.skyMid));
  grad.addColorStop(1, hex(rig.skyHorizon));
  g.fillStyle = grad;
  g.fillRect(0, 0, W, horizonY);

  /* cloud banding: horizontal streaks, brightest near the horizon. Low
     frequency on purpose — PMREM's mip chain would erase fine detail, but
     broad bands survive into the blurrier mips and give a moving reflection. */
  if (rig.cloudiness > 0.05) {
    g.globalAlpha = 0.10 + 0.16 * rig.cloudiness;
    for (let i = 0; i < 7; i++) {
      const y = horizonY * (0.16 + 0.80 * Math.pow(i / 7, 0.7));
      const h = horizonY * (0.02 + 0.05 * (1 - i / 7));
      g.fillStyle = i % 2 ? hex(rig.skyTop) : hex(rig.skyHorizon);
      g.fillRect(0, y, W, h);
    }
    g.globalAlpha = 1;
  }

  /* bright band hugging the horizon */
  const band = g.createLinearGradient(0, horizonY * 0.80, 0, horizonY);
  band.addColorStop(0, 'rgba(255,255,255,0)');
  band.addColorStop(1, `rgba(255,255,255,${(0.16 + 0.22 * (1 - rig.cloudiness)).toFixed(3)})`);
  g.fillStyle = band;
  g.fillRect(0, horizonY * 0.80, W, horizonY * 0.20);

  /* ground half, darker — the sky/ground step at horizonY stays a HARD edge */
  const gg = g.createLinearGradient(0, horizonY, 0, H);
  gg.addColorStop(0, hex(rig.skyHorizon));
  gg.addColorStop(0.10, hex(rig.hemiGround));
  gg.addColorStop(1, hex(rig.hemiGround));
  g.fillStyle = gg;
  g.fillRect(0, horizonY, W, H - horizonY);

  /* key light: a tight core inside a broad halo. Under overcast (skyDisc 0) it
     collapses to just the broad patch, which is what a cloudy sky actually
     shows where the sun is. */
  const az = rig.keyAz * Math.PI / 180, el = rig.keyEl * Math.PI / 180;
  const sx = ((((az / (Math.PI * 2)) % 1) + 1) % 1) * W;
  const sy = (0.5 - el / Math.PI) * H;
  const halo = rig.skyDisc > 0.2 ? 70 : 130;
  const core = rig.skyDisc > 0.2 ? 13 : 0;
  g.save();
  for (const dx of [-W, 0, W]) {                   // wrap across the seam
    g.setTransform(1, 0, 0, 1, dx, 0);
    const hg = g.createRadialGradient(sx, sy, 0, sx, sy, halo);
    hg.addColorStop(0, `rgba(255,255,255,${Math.min(0.75, 0.20 + rig.keyIntensity * 0.14).toFixed(3)})`);
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hg;
    g.fillRect(0, 0, W, H);
    if (core > 0) {
      const cg = g.createRadialGradient(sx, sy, 0, sx, sy, core);
      cg.addColorStop(0, 'rgba(255,255,255,1)');
      cg.addColorStop(0.55, 'rgba(255,255,255,0.92)');
      cg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = cg;
      g.fillRect(0, 0, W, H);
    }
  }
  g.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const rt = pmrem.fromEquirectangular(tex);
  tex.dispose();
  /* The TARGET, not `rt.texture` — see the note at envCache. */
  return rt;
}

/* ===========================================================================
   O IBL DO ESTÚDIO — uma FOTOGRAFIA EQUIRRETANGULAR DA PRÓPRIA SALA
   ===========================================================================
   O QUE ELE SUBSTITUI, E POR QUE. `envKey()` devolvia `'room'` para todo preset
   `env: 'room'`, e `'room'` é o `RoomEnvironment` do addon do three: uma caixa
   BRANCA com painéis emissivos, assada uma vez e reusada para sempre. Ela era o
   ambiente do ciclorama em TODAS as combinações — mesmo cubemap no fundo preto e
   no fundo branco, a 2200 K e a 9000 K, com a chave a leste ou a oeste.

   MEDIDO (checks-estudio-diag.mjs, apagando `scene.environmentIntensity`): esse
   ambiente fixo vale 27 níveis de luminância na parede, 17 no sujeito e 49 no
   piso. É mais do que a faixa INTEIRA do controle de Preenchimento (4,8) e mais
   do que a do Recorte no sujeito (7,8). Ou seja: o maior termo de luz do
   cenário era o único que nenhum controle alcançava — e é essa a razão física
   de o relato ser *"as cores não refletem no cenário"*. A pastilha repintava a
   parede e o chão, e o que a lataria REFLETIA continuava sendo uma caixa branca
   de estúdio genérico.

   A REGRA DESTE DESENHO: o ambiente é uma FOTO DA SALA QUE ESTÁ NA TELA. Não
   uma aproximação de energia, não uma caixa de estúdio: os mesmos valores que o
   ciclorama, o piso e o teto entregam ao quadro, escritos num equirretangular.
   Segue-se de graça tudo o que faltava — o fundo branco devolve luz de fundo
   branco, 2800 K esquenta o que o verniz reflete, e mover a chave move o realce
   no cromado.

   O QUE ELE DESENHA, de baixo para cima:

     · o PISO, do nadir até o horizonte;
     · a PAREDE, uma rampa de valor com o ponto mais escuro na altura do
       veículo — a mesma forma da tabela de cyclorama.ts;
     · os QUATRO PLANOS da sala, por uma modulação de cos(4·azimute). Uma sala
       quadrada devolve quatro valores diferentes, e é essa diferença que o olho
       (e o cromado) leem como "sala" em vez de "gradiente";
     · as BARRAS DO TETO, cada uma como o ARCO que ela realmente subtende — ver
       o bloco delas abaixo. São elas que dão à tinta o realce alongado de
       softbox que o RoomEnvironment dava por acidente e no lugar errado;
     · a SOFTBOX DA CHAVE, um RETÂNGULO em (keyAz, keyEl). Retângulo e não
       disco: a forma do realce especular É a forma da fonte, e é por isso que
       um verniz fotografado em estúdio tem risco reto e não bolinha;
     · a CHAPA DE PREENCHIMENTO, do outro lado, baixa e larga.

   POR QUE NÃO A SONDA (scene/probe.ts), que capturaria a sala de verdade: ela
   custa seis faces em resolução cheia sobre 6 M de triângulos mais um PMREM, e
   teria de rodar a cada clique de pastilha. Este canvas custa 256×128 pixels
   desenhados em 2D e cabe no mesmo cache LRU do céu procedural.

   Ele NÃO importa scene/cyclorama.ts nem scene/ceiling.ts — a seta é a
   contrária (os dois importam este arquivo). Tudo que ele precisa saber chega
   pelo RIG: `cycloramaAlbedo`, `cycloramaFloor`, `keyColor` (já tingido pela
   temperatura em resolveRig), `keyAz`/`keyEl` e `hemiIntensity`. */

/** Uma radiância linear + um matiz → a string de preenchimento do canvas 2D. */
const _envTint = new THREE.Color();
function envInk(level: number, tint: THREE.Color, alpha = 1) {
  /* Só o MATIZ da luz entra; o VALOR é o `level`, que descreve a superfície.
     Sem a normalização, uma chave a 0xccd9f2 escureceria a sala 20 % só por ser
     azulada — e a mesma sala sob duas temperaturas mudaria de brilho em vez de
     mudar de cor. */
  _envTint.copy(tint);
  const m = Math.max(_envTint.r, _envTint.g, _envTint.b) || 1;
  const enc = (v: number) => {
    const x = THREE.MathUtils.clamp((v * level) / m, 0, 1);
    return Math.round(255 * (x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055));
  };
  return `rgba(${enc(_envTint.r)},${enc(_envTint.g)},${enc(_envTint.b)},${alpha})`;
}

/* AS MEDIDAS DA SALA QUE O IBL PRECISA CONHECER, em metros e do ponto de vista
   de quem está no meio dela — a altura do olho de uma foto de veículo.
   Elas ESPELHAM scene/ceiling.ts (laje a 14 m, vãos de 16,2 m, barras de 3,6 m
   de largura e 61 m de comprimento) e são repetidas aqui em vez de importadas
   porque scene.ts não pode depender de scene/**: os dois módulos do teto
   importam ESTE. Uma divergência aqui não quebra nada — ela só desafina o
   realce em relação ao teto que se vê —, e é por isso que a repetição paga. */
const IBL_ROOM = {
  /** altura da laje acima do olho */
  ceil: 12,
  /** meia-largura da grelha de barras */
  half: 34,
  /** passo entre barras */
  pitch: 16.2,
  /** largura de uma barra */
  bankW: 3.6,
};

function buildStudioEnv(rig: Rig) {
  const W = 256, H = 128;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = ctx2d(c);
  const tint = rig.keyColor;
  const albedo = Math.max(0, rig.cycloramaAlbedo);
  const floorMul = Math.max(0, rig.cycloramaFloor);

  /* Direção → pixel, na MESMA convenção de buildSkyEnv(): u percorre o azimute
     e v vai do zênite (0) ao nadir (H). */
  const px = (azDeg: number) => ((((azDeg / 360) % 1) + 1) % 1) * W;
  const py = (elDeg: number) => (0.5 - elDeg / 180) * H;

  /* ---- 1. a rampa vertical: piso, concordância, parede, laje ----
     Os valores são RADIÂNCIA LINEAR e são os alvos de tela da tabela de
     BACKDROPS convertidos de volta: 120/255 de sRGB ≈ 0,18 linear no piso,
     50/255 ≈ 0,032 na parede à altura do veículo. */
  const wallLow = 0.030 * albedo;        // altura do veículo — o ponto mais escuro
  const wallHigh = 0.052 * albedo;       // subindo rumo ao difusor
  const floorLvl = 0.150 * floorMul;
  /* A laje é escura POR DESENHO (ceiling.ts a autora em 0x191919), e ela clareia
     um pouco com o fundo porque um ciclorama branco devolve luz nela. */
  const deck = 0.010 + 0.005 * albedo;

  const ramp = g.createLinearGradient(0, 0, 0, H);
  ramp.addColorStop(0.00, envInk(deck, tint));
  ramp.addColorStop(0.28, envInk(deck, tint));            // teto, até ~50° de elevação
  ramp.addColorStop(0.36, envInk(wallHigh, tint));        // alto da parede
  ramp.addColorStop(0.50, envInk(wallLow, tint));         // horizonte = altura do veículo
  ramp.addColorStop(0.56, envInk(0.060 * albedo, tint));  // concordância, o ricochete do piso
  ramp.addColorStop(0.70, envInk(floorLvl, tint));
  ramp.addColorStop(1.00, envInk(floorLvl * 0.92, tint)); // sob os pés, um respiro
  g.fillStyle = ramp;
  g.fillRect(0, 0, W, H);

  /* ---- 2. os quatro planos ----
     ±9 % em cos(4·az), centrado nas quinas. É pouco de propósito: o que se quer
     é que um cromado girando encontre QUATRO faces e três quinas, não que a sala
     fique listrada. Só na metade de cima — o piso é um plano só. */
  for (let x = 0; x < W; x++) {
    const k = Math.cos((x / W) * 8 * Math.PI);
    if (Math.abs(k) < 0.02) continue;
    g.fillStyle = k > 0 ? 'rgba(255,255,255,' + (0.09 * k).toFixed(3) + ')'
      : 'rgba(0,0,0,' + (0.09 * -k).toFixed(3) + ')';
    g.fillRect(x, 0, 1, H * 0.56);
  }

  /* ---- 3. AS BARRAS DO TETO, cada uma como o arco que ela subtende ----
     Uma barra é uma reta `x = xi` a `ceil` metros de altura, correndo em z. De
     quem está no meio da sala, a direção para o ponto (xi, ceil, z) tem

         elevação = atan(ceil / √(xi² + z²))      azimute = atan2(xi, z)

     e conforme z corre de −L a +L o par descreve um ARCO: ele nasce no
     horizonte de um lado, sobe até `atan(ceil/|xi|)` bem em cima e desce no
     horizonte do outro. É essa a assinatura de um teto de estúdio num
     equirretangular, e é ela que um verniz devolve como risco comprido —
     "o realce alongado de softbox" que o cabeçalho do preset `ciclorama` pede.
     Desenhar duas faixas horizontais no lugar seria mais barato e daria o
     realce ERRADO: um risco que não se encurva não pertence a um teto.

     A largura do traço cai com a distância porque é ângulo, não metro. */
  const bankLevel = 0.90;
  const lanes: number[] = [];
  for (let i = -4; i <= 4; i++) {
    const x = (i + 0.5) * IBL_ROOM.pitch;
    if (Math.abs(x) < IBL_ROOM.half) lanes.push(x);
  }
  g.save();
  g.lineCap = 'round';
  for (const xi of lanes) {
    for (const pass of [0, 1]) {
      /* Duas passadas: um halo largo e fraco, e o núcleo. Sem o halo a barra
         vira um risco duro que o PMREM transforma em serrilhado nos níveis
         borrados. */
      g.strokeStyle = envInk(bankLevel, tint, pass ? 1 : 0.35);
      let prevX = NaN, prevY = 0;
      for (let s = 0; s <= 48; s++) {
        const z = -IBL_ROOM.half + (2 * IBL_ROOM.half * s) / 48;
        const flat = Math.hypot(xi, z);
        const d = Math.hypot(flat, IBL_ROOM.ceil);
        const el = Math.atan2(IBL_ROOM.ceil, flat) * 180 / Math.PI;
        const az = Math.atan2(xi, z) * 180 / Math.PI;
        const x = px(az), y = py(el);
        /* A largura angular da barra, em pixels do canvas (W pixels = 360°). */
        const wdeg = (IBL_ROOM.bankW / d) * 180 / Math.PI;
        g.lineWidth = Math.max(1, (wdeg / 360) * W) * (pass ? 1 : 2.6);
        /* O salto de azimute na costura do canvas quebraria o traço numa
           horizontal atravessando a imagem inteira. */
        if (!Number.isNaN(prevX) && Math.abs(x - prevX) < W * 0.5) {
          g.beginPath();
          g.moveTo(prevX, prevY);
          g.lineTo(x, y);
          g.stroke();
        }
        prevX = x; prevY = y;
      }
    }
  }
  g.restore();

  /* ---- 4. a SOFTBOX DA CHAVE ----
     Um retângulo de bordas macias em (keyAz, keyEl), LARGO E BAIXO: é o formato
     que se usa para um veículo de 19 m, e é a forma dele que o verniz devolve
     como risco reto.

     ELE É PEQUENO, E A PRIMEIRA VERSÃO NÃO ERA — este bloco é a correção de um
     defeito que a bancada fotografou. Com um halo de raio `bw · 2,4 · 1,9` a
     partir de 46° de elevação, a "softbox" cobria do zênite até abaixo do
     horizonte, ou seja era uma nuvem clara em metade da esfera. O piso, com
     `roughness` 0,22, resolve o ambiente quase como espelho na direção rasante:
     o resultado na tela foi um BORRÃO BRANCO SATURADO no chão diante da cabine,
     de borda dura — exatamente o artefato que o comentário de
     `envMapIntensity` no piso descreve para o RoomEnvironment, reintroduzido
     pela porta da frente.

     Uma softbox de estúdio subtende 20 a 30 graus, não 150. E o núcleo fica em
     0,85 e não em 1,0: um canvas de 8 bits satura em 1,0, e uma fonte saturada
     perde a borda — é ela que faz o realce ter FORMA em vez de virar mancha.
     `keyIntensity` abre só o halo, porque é isso que uma fonte mais forte faz
     numa foto: o núcleo já está no teto do formato. */
  {
    const cx = px(rig.keyAz), cy = py(rig.keyEl);
    const bw = W * 0.072, bh = H * 0.048;
    const halo = 1 + 0.35 * THREE.MathUtils.clamp(rig.keyIntensity / 3.4 - 1, 0, 2);
    g.save();
    for (const dx of [-W, 0, W]) {                 // a costura de azimute
      g.setTransform(1, 0, 0, 1, dx, 0);
      const hg = g.createRadialGradient(cx, cy, bw * 0.5, cx, cy, bw * 1.9 * halo);
      hg.addColorStop(0, envInk(0.30, tint, 0.45));
      hg.addColorStop(1, envInk(0.30, tint, 0));
      g.fillStyle = hg;
      g.fillRect(0, 0, W, H);
      g.fillStyle = envInk(0.85, tint, 0.45);
      g.fillRect(cx - bw * 0.68, cy - bh * 0.68, bw * 1.36, bh * 1.36);
      g.fillStyle = envInk(0.85, tint);
      g.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
    }
    g.restore();
  }

  /* ---- 5. a CHAPA DE PREENCHIMENTO ----
     Do outro lado da chave, baixa e bem maior que a softbox: é uma parede de
     isopor, não uma lâmpada. Ela segue `hemiIntensity`, que é o que o controle
     de Preenchimento move — então baixar o preenchimento fecha a sombra também
     no que a lataria REFLETE, e não só no que ela recebe.

     Ela ficou em 18 % da largura do canvas (65°, uma chapa de 8 m a 7 m) contra
     os 30 % da primeira versão. Pelo mesmo motivo da softbox, e com um agravante
     próprio: a 18° de elevação ela cai EM CHEIO na direção de espelho de uma
     câmera de foto de veículo, que é a que menos perdoa uma fonte grande
     demais. */
  {
    const fill = THREE.MathUtils.clamp(rig.hemiIntensity / 0.32, 0, 4);
    if (fill > 0.02) {
      const cx = px(rig.keyAz + 180), cy = py(22);
      g.save();
      for (const dx of [-W, 0, W]) {
        g.setTransform(1, 0, 0, 1, dx, 0);
        const fg = g.createRadialGradient(cx, cy, 0, cx, cy, W * 0.18);
        fg.addColorStop(0, envInk(0.20 * Math.min(1.8, fill), rig.hemiSky, 0.80));
        fg.addColorStop(1, envInk(0.20 * Math.min(1.8, fill), rig.hemiSky, 0));
        g.fillStyle = fg;
        g.fillRect(0, 0, W, H);
      }
      g.restore();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  const rt = pmrem.fromEquirectangular(tex);
  tex.dispose();
  return rt;
}

/* Insert-or-touch, then evict from the front. A Map iterates in insertion order,
   so delete-then-set is the whole LRU. Never frees the one currently bound to
   `scene.environment`: that would leave the renderer sampling a released target,
   which is a black scene rather than a stale one. */
function cacheEnv(k: string, rt: THREE.WebGLRenderTarget) {
  envCache.delete(k);
  envCache.set(k, rt);
  while (envCache.size > ENV_CACHE_MAX) {
    const oldest = envCache.keys().next().value!;
    const victim = envCache.get(oldest)!;
    envCache.delete(oldest);
    if (victim !== rt && victim.texture !== scene.environment) victim.dispose();
  }
}

/**
 * Free every cached procedural IBL except the one on screen.
 *
 * Not called from the render path — this is deferred-teardown material (o dono
 * é `releaseScene()` em studio.ts). Safe at any time: a later refreshEnvironment() simply
 * misses and rebakes, which is the same 10-40 ms a first visit to that preset
 * already pays.
 */
export function releaseProceduralEnvCache() {
  for (const [k, rt] of [...envCache]) {
    if (rt.texture === scene.environment) continue;
    rt.dispose();
    envCache.delete(k);
  }
}

let envTimer: ReturnType<typeof setTimeout> | 0 = 0;   // 0 = nothing pending
function refreshEnvironment(rig: Rig, immediate: boolean) {
  /* GUARD: an external HDRI owns scene.environment. Returning here does two
     things — it stops the assignment below from stealing it back on every
     preset/slider change, and it skips building a procedural PMREM (a canvas +
     a full mip-chain blur) that would never be bound. setExternalEnvironment
     (null) calls this again with immediate=true to rebuild whatever the rig
     needs at the moment the HDRI is released. */
  if (externalEnv) return;
  const k = envKey(sceneState);
  const run = () => {
    envTimer = 0;
    const hit = envCache.get(k);
    if (hit) {
      scene.environment = hit.texture;
      cacheEnv(k, hit);                              // a hit is a use: refresh the LRU
      invalidate();
      return;
    }
    let rt: THREE.WebGLRenderTarget;
    if (k.startsWith('studio:')) {
      rt = buildStudioEnv(rig);
    } else if (k === 'room') {
      /* RoomEnvironment is a whole Scene — a lathe of BoxGeometries, two
         MeshStandardMaterials and a PointLight — built for one purpose: to be
         PHOTOGRAPHED by the PMREM. Nothing samples it afterwards, and dropping it
         on the floor leaked every one of those buffers for the tab's lifetime.
         The addon ships its own dispose() (it walks the tree and frees each
         geometry and material once); call it the moment the bake is done. */
      const room = new RoomEnvironment();
      try {
        rt = pmrem.fromScene(room, 0.04);
      } finally {
        room.dispose();
      }
    } else {
      rt = buildSkyEnv(rig);
    }
    /* Bind BEFORE caching: cacheEnv() refuses to evict whatever `scene
       .environment` currently points at, and the thing it must never evict is
       the one we just built. */
    scene.environment = rt.texture;
    cacheEnv(k, rt);
    invalidate();
  };
  if (immediate) { if (envTimer) { clearTimeout(envTimer); envTimer = 0; } run(); return; }
  if (envTimer) clearTimeout(envTimer);
  /* 380 ms, não 120, E um quadro cedido antes de assar.
     ---------------------------------------------------------------------------
     `run()` faz `pmrem.fromEquirectangular()` — 10 a 40 ms de thread principal
     travada — e este caminho só é alcançado quando NÃO há HDRI externo, que é
     precisamente o caso do `armazem` (`hdri: null`). Com 120 ms, arrastar o
     controle de hora disparava e cancelava o timer sem parar e, ao soltar,
     entregava a travada 120 ms DEPOIS: tarde demais para o usuário associar ao
     que fez, o que faz parecer defeito e não trabalho.

     380 ms é longo o bastante para nunca disparar durante um arrasto contínuo.
     O rAF extra garante que o quadro com a luz nova seja APRESENTADO antes de a
     thread travar — sem ele, o assado e a atualização visual competem pelo
     mesmo quadro e o usuário vê a travada antes de ver o resultado. */
  envTimer = setTimeout(() => { requestAnimationFrame(() => run()); }, 380);
}

/* ---------------- tween ---------------- */
/* All three are written by beginTween(), and the restore() IIFE at the foot of
   this module calls it once at module load — before any exported entry point,
   any hook and the first frame. Definite assignment rather than `| null` keeps
   updateLighting()'s hot path free of guards for a state no reader can reach;
   the one place the pre-assignment value is observed is beginTween()'s own
   `if (!rigCur)`, which reads `undefined` there exactly as it read `null`. */
let rigCur!: Rig, rigFrom!: Rig, rigTo!: Rig;
let tweenT = 1, tweenDur = 0.8;

const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/* shortest-arc degree lerp, so 350° → 10° goes through 0, not backwards */
function lerpDeg(a: number, b: number, t: number) {
  let d = ((b - a + 540) % 360) - 180;
  return a + d * t;
}

function lerpRig(dst: Rig, a: Rig, b: Rig, t: number) {
  for (const k of NUM_FIELDS) {
    dst[k] = k === 'keyAz' ? lerpDeg(a[k], b[k], t) : a[k] + (b[k] - a[k]) * t;
  }
  /* Colours lerp in linear-sRGB (THREE.Color already stores linear when colour
     management is on) because these are radiometric quantities. Never lerpHSL:
     blue-grey → orange would swing the hue through green. */
  for (const k of COLOR_FIELDS) dst[k].copy(a[k]).lerp(b[k], t);
}

const _dirW = new THREE.Vector3();
const _dirV = new THREE.Vector3();
const _keyCol = new THREE.Color();
const _tintGraded = new THREE.Color();

/* DAY-FOR-NIGHT FOR A MEASURED PLATE COLOUR.
   `set.horizonColor` is the HDRI's own horizon band, measured off the plate in
   LINEAR LIGHT AT MIDDAY — see the horizonNote in environments.json, which
   documents the measurement and is right about it. What it could not know is
   that the value was then treated as a constant: setHorizonTint() pinned fog and
   the haze shell to it at every hour, while the sky behind them was being folded
   down by the backgroundIntensity guard below.

   That is the whole "o HDR no modo escuro não está bom". At 21:00 over
   `distrito-industrial` the plate renders at min(1, 0.35) * 0.06 ≈ 0.021 of its
   daylight radiance and the haze went on painting linear 0.102/0.124/0.050 at
   0.7 alpha — roughly FIVE TIMES brighter than the photograph it is supposed to
   be dissolving into, in a midday olive. The night sky was not the HDRI at all;
   it was the haze shell, and the fog was washing the far end of the set the same
   colour.

   So the tint gets the same grade as the plate, which is also exactly the grade
   environment.ts applies to a projected dome — one formula, three consumers, and
   they can no longer drift:
     * min(1, envIntensity) — the environment sets the level and the preset only
       MODULATES it; a bright preset must not over-drive a photograph.
     * a 6 % floor at full night. Stylised, not physical (moonlit is ~1e-5 of
       sunlit); it keeps the horizon legible as a silhouette instead of a hole.
     * the Purkinje cooling, so a dimmed day plate reads as night rather than as
       underexposed day.
   At noon n = 0 and envIntensity = 1, so k = 1 and this is the identity — the
   daylight look is untouched, by construction. */
function gradePlateColor(out: THREE.Color, src: THREE.Color, rig: Rig) {
  const n = THREE.MathUtils.clamp(rig.nightness, 0, 1);
  const k = Math.min(1, Math.max(0, rig.envIntensity)) * (1 - 0.94 * n);
  out.setRGB(
    src.r * k * (1 - 0.18 * n),
    src.g * k * (1 - 0.10 * n),
    src.b * k,
  );
  /* E O MESMO AVERMELHAMENTO DE SOL BAIXO QUE resolveRig() DÁ AO rig.fogColor.
     Sem esta linha o bloco acima só cobria o eixo da NOITE, e o buraco era
     exatamente a faixa que o usuário relatou: às 18/19 h `nightnessAt` ainda é
     baixo (o sol só se põe às 18,4 h), então a grade de noite é quase a
     identidade — enquanto goldenAt já vale ~0,7 e a névoa do preset já está
     laranja. A cor medida ficava sozinha em pé no matiz do meio-dia.

     O mesmo 0,50 do fogColor, e pela razão que aquele comentário dá: névoa e
     bruma são a mesma coisa vista a duas distâncias, e deixá-las divergir é o
     que faz emenda no horizonte. */
  const g = THREE.MathUtils.clamp(rig.golden, 0, 1);
  if (g > 0.002) out.lerp(GOLDEN, 0.50 * g);
  return out;
}

/* ---- MODO ARRASTO DO MAPA DE SOMBRA ----
   `shadowMap.autoUpdate = false` (linha 251) já resolveu METADE do problema: o
   mapa parou de ser redesenhado quando só a CÂMERA se move. O que ficou de fora
   é o caso em que a LUZ se move — que é exatamente "aplicar uma configuração de
   iluminação", e é onde o travamento aparece.

   A conta: applyRig() roda a cada quadro de tween (0,8 s ≈ 48 quadros) e a cada
   evento `input` do controle de hora (~60/s). Cada quadro sujo redesenha TODO
   caster dentro de ±24 m num alvo de profundidade de 3072² — o set, mais as
   2151 malhas do implemento, mais a cabine. É a geometria inteira desenhada
   DUAS vezes por quadro, ~18 M de triângulos.

   A correção NÃO baixa a qualidade do resultado: enquanto o usuário arrasta,
   redesenha a cada 4º quadro; assim que ele solta, o quadro seguinte redesenha
   em cheio, na resolução cheia. O que se perde é sombra defasada em ~50 ms
   DURANTE o arrasto, e o que se ganha é o arrasto responder. */
let scrubUntil = 0;
let shadowFrame = 0;
/* "Um applyRig() pulou o redesenho e ninguém o repôs ainda."
   O bloco acima promete que "assim que ele solta, o quadro seguinte redesenha em
   cheio" — e não redesenhava. applyRig() só roda por evento do controle ou por
   quadro de tween, então o ÚLTIMO applyRig de um arrasto é quase sempre um dos
   pulados: o mapa fica até três quadros de luz atrasado, e fica assim para
   sempre, porque nada chama applyRig depois que o dedo sai. Um bool paga a
   promessa; o laço o cobra quando a janela do arrasto expira. */
let shadowStale = false;

/* ---- MODO ARRASTO DA SOMBRA, SEGUNDO DONO: A DISSOLVÊNCIA DO ATRAVESSAR ----
   O bloco acima estrangula a sombra do arrasto do RELÓGIO. Este estrangula a do
   ATRAVESSAR, e é o mesmo padrão disparado por outro evento — por isso mora aqui
   colado, e não numa segunda máquina em seethrough.ts.

   ⚠️ O DIAGNÓSTICO (`GARGALO-2026-08-15.md` §1.2) É MEDIDO. Com uma armadilha
   get/set em `needsUpdate` sobre 90 quadros de arrasto no `distrito-industrial`,
   o passe de sombra era reassado em **90 de 90 quadros no nível Alta (100 %)** e
   70 de 90 no Média, e o culpado era uma linha: `escrever()` de seethrough.ts
   marcava o mapa a cada passo de dissolvência de cada prédio. Custo medido numa
   RX 570: **+6,06 ms (Alta), +5,31 ms (Média), +4,02 ms (Baixa)** por quadro —
   perto de metade do quadro, gasto redesenhando uma sombra que mudou 1 %.

   Não é decisão visual: a dissolvência de um prédio muda a sombra dele de forma
   gradual e a 60 Hz; reassar a 12–20 Hz é invisível e devolve metade do quadro.

   AS DUAS PONTAS DA CORREÇÃO, e nenhuma delas sozinha resolve:
     · seethrough.ts parou de PEDIR o que não muda nada (quem não projeta
       sombra, e passo de rampa abaixo de 1/8);
     · daqui para baixo, o que sobra é estrangulado por `shadowRefreshHz` do
       perfil e a dívida é COBRADA quando a janela expira, exatamente como
       `shadowStale` faz para o relógio.

   ⚠️ A DÍVIDA TEM DE SER PAGA, E É POR ISSO QUE ELA SEGURA O LAÇO. Se a
   dissolvência terminar dentro da janela estrangulada e ninguém pedir a
   reassadura depois, o prédio fica com a sombra do estado anterior — o defeito
   que o pedido existe para não ter. O laço sob demanda torna isso concreto:
   `updateSeeThrough()` devolve false assim que a rampa assenta, e sem uma
   invalidação a viewport pararia de desenhar com a dívida em aberto. Enquanto
   houver dívida, o laço pede quadro. */
let seeShadowDebt = false;
/** Antes deste instante, a dívida do atravessar espera. `performance.now()`. */
let seeShadowNextAt = 0;

/**
 * Teto de reassaduras por segundo sob mudança contínua, do perfil de qualidade.
 *
 * ⚠️ LEITURA COM RESERVA, E A RESERVA É O NÍVEL ALTO. O campo é do AGENTE 3 e
 * pode ainda não existir na tabela quando este arquivo for lido (as duas
 * mudanças correm em paralelo). Cair no valor do nível mais PESADO é a reserva
 * segura: ela pode deixar desempenho na mesa, nunca imagem errada. O contrário
 * — presumir 8 Hz — daria ao nível Alto uma sombra mais defasada do que o dono
 * do perfil autorizou, e o defeito apareceria como "a sombra arrasta", que é
 * indistinguível de bug.
 */
function shadowRefreshHz() {
  const hz = (getProfile() as { shadowRefreshHz?: number }).shadowRefreshHz;
  return hz && hz > 0 ? hz : 20;
}

/* ---- QUANTAS REASSADURAS DE FATO ACONTECERAM ----
   O número que PROVA o estrangulamento, e o único honesto: contar as escritas em
   `needsUpdate` contaria pedidos, não assados — e um pedido que chega com a
   bandeira já em true não custa nada. Aqui se carimba o instante em que o passe
   REALMENTE vai rodar (ver `startLoop()`), e a janela deslizante de 1 s devolve
   a taxa observada em hertz, direto, sem divisão.

   Com o laço parado ou ocioso ele cai para 0 sozinho, que é a leitura certa: não
   houve reassadura nenhuma. */
const reassaduras: number[] = [];
function podarReassaduras(t: number) {
  while (reassaduras.length && t - reassaduras[0] > 1000) reassaduras.shift();
}

/** Sinaliza que a luz está sendo arrastada AGORA. Ver o bloco acima. */
export function beginLightScrub() {
  scrubUntil = performance.now() + 220;
  /* Deliberately WIDER than one invalidation, and it is the shadow settle that
     needs it: the drag's last applyRig() is almost always one of the skipped
     ones, so the frame that repays it (see shadowStale, in the loop) can only
     happen AFTER this 220 ms window expires. 30 frames is half a second at
     60 Hz — comfortably past it — and it costs nothing on a control the user
     has their finger on. */
  invalidate(30);
}

function applyRig(rig: Rig) {
  /* A luz vai se mexer, então o mapa de profundidade está velho. Este é o
     caminho quente — todo quadro de tween cai aqui. */
  shadowFrame++;
  if (performance.now() > scrubUntil || (shadowFrame & 3) === 0) {
    renderer.shadowMap.needsUpdate = true;
    shadowStale = false;
  } else {
    shadowStale = true;
  }
  const azr = rig.keyAz * Math.PI / 180;
  const elr = rig.keyEl * Math.PI / 180;
  const r = KEY_ORBIT_R;
  /* O piso de 1,0 m em Y é o mesmo de sempre — ele impede o sol rasante de
     entrar por baixo do chão —, só que agora aplicado à direção antes de ela ser
     escalada e deslocada. Em r = 26 os dois são o mesmo número. */
  _keyDir.set(
    r * Math.cos(elr) * Math.sin(azr),
    Math.max(1.0, r * Math.sin(elr)),
    r * Math.cos(elr) * Math.cos(azr)
  ).normalize();
  placeKeyLight();
  key.color.copy(rig.keyColor);
  key.intensity = Math.max(0, rig.keyIntensity);
  key.shadow.intensity = THREE.MathUtils.clamp(rig.shadowIntensity, 0, 1);
  key.shadow.radius = Math.max(0.5, rig.shadowRadius);

  /* O RECORTE FICA DO OUTRO LADO DA CHAVE, e a ALTURA dele agora é do preset.
     Ela era cravada — `y = 14` sobre um raio de 22·cos(0,6) = 18,15, ou seja
     37,6° — e é isso que `rimEl: 38` reproduz. Ver o bloco de `rimEl` em
     presets.ts para a medição que a tirou daqui. */
  const rimEl = rig.rimEl * Math.PI / 180;
  const rimAz = azr + Math.PI * 0.78;
  const rimR = 22;
  rim.position.set(
    rimR * Math.cos(rimEl) * Math.sin(rimAz),
    rimR * Math.sin(rimEl),
    rimR * Math.cos(rimEl) * Math.cos(rimAz),
  );
  rim.color.copy(rig.rimColor);
  rim.intensity = Math.max(0, rig.rimIntensity);

  hemi.color.copy(rig.hemiSky);
  hemi.groundColor.copy(rig.hemiGround);
  hemi.intensity = Math.max(0, rig.hemiIntensity);
  ambient.color.copy(rig.ambientColor);
  ambient.intensity = Math.max(0, rig.ambientIntensity);

  /* Fog is deliberately NOT guarded: it has to keep tweening toward the rig's
     colour even under an HDRI, or the ground plane fading out meets the photo's
     horizon in a hard seam. Matching the haze is the whole trick. */
  /* `scene.fog` is typed `Fog | FogExp2 | null`; it is assigned one FogExp2 at
     module load (see the note there) and never replaced. */
  const fog = scene.fog as THREE.FogExp2;
  /* The measured tint is a DAYLIGHT sample and has to be graded to the hour —
     see gradePlateColor(). rig.fogColor needs no such treatment: it is preset
     data with a `noite` face and the clock already crossfaded it. */
  const tint = horizonTint ? gradePlateColor(_tintGraded, horizonTint, rig) : null;
  fog.color.copy(tint || rig.fogColor);
  fog.density = Math.max(0, rig.fogDensity);

  /* The haze IS the fog, continued into the sky — so it tracks the same tweened
     colour, every frame, or the two would diverge mid-crossfade and put the
     seam back exactly where it was removed. */
  if (hazeMesh) {
    (hazeMesh.material as THREE.MeshBasicMaterial).color.copy(tint || rig.fogColor);
  }

  /* GUARD: the colour is kept current either way (so releasing the HDRI
     restores the right sky instantly), but while one is up we must not bind it
     — every frame of a tween would repaint the photo as a flat colour. */
  bgColor.copy(rig.bgColor);
  if (!externalEnv) scene.background = bgColor;

  /* GUARD: with an HDRI the env def sets the absolute level and the preset only
     MODULATES it, so a "noite" rig over a daylight HDRI still darkens the
     reflections. The visible background is clamped to at most the env def's
     level: a bright preset (chuvoso, envIntensity 1.45) must not blow out a
     photograph the way it may over-drive a synthetic gradient. */
  if (externalEnv) {
    const k = Math.max(0, rig.envIntensity);
    /* O PAR DE CÉUS ANDA AQUI, no único lugar por onde toda entrada pública de
       luz passa (ver o comentário de invalidate() no fim desta função). É de
       graça quando não há par, e quando há, o fundo atravessa liso e o PMREM é
       reassado por taxa — scene/skyblend.ts. */
    const comPar = hasSkyPair();
    /* `rig.skyMix` e NÃO `rig.nightness`: a mistura tem banda própria, mais larga
       e mais tardia, porque `nightness` satura às 19:20 e o relógio vai até
       24:00. Ver `skyMixAt()`. E é o valor do RIG — ou seja o já tweenado —,
       nunca `skyMixAt(sceneState.hour)`: applyRig roda por quadro de tween, e ler
       a hora aqui faria a mistura saltar enquanto todo o resto atravessa. */
    if (comPar) updateSkyBlend(rig.skyMix);
    /* NIGHT OVER A DAYLIGHT PHOTOGRAPH.
       Every HDRI in the acervo was shot in daylight, and the preset system has
       no way to make a photograph set. Before this, midnight left
       backgroundIntensity at the rig's 0.35 while exposure ROSE to 1.45 — net
       ~0.53 against noon's ~1.10, i.e. the "night" sky was rendering at half
       the brightness of noon, with lit cumulus in it. That is the "24:00 não
       fica noite" bug: the lights went out, the sky did not.

       So `nightness` (already tweened 0→1 by the clock, orthogonal to weather)
       drives the photo down on its own axis. Two different floors because the
       two do different jobs:

       BG 0.06 — the visible sky. 0.35 * 0.06 * 1.52 exposure ≈ 0.03 scene-
       referred, which ACES renders as a dark blue-grey that still holds the
       cloud structure. Scaling is UNIFORM, so bright cumulus stay brighter than
       the sky behind them and read as moonlit cloud rather than as a flat wash.
       A real night sky is ~1e-4 of day; 0.03 is the film-convention version,
       and going lower just makes an unreadable black hole.

       ENV 0.40 — the reflections. Deliberately far milder: this term is also
       doing half the LIGHTING of the truck, and taking it to the background's
       floor leaves black paint with no form. 0.35 * 0.40 = 0.14 keeps a dim sky
       in the clearcoat while the lamps (240-295 cd) take over as the key.

       COM PAR DE CÉUS OS DOIS PISOS SUBIREM, e não é afrouxamento: os 0,06/0,40
       existem para fazer uma FOTO DE DIA passar por noite, e essa é a premissa
       que o par derruba. O plate de noite já tem um terço da luminância média do
       de dia (0,310 contra 0,717 — medido), já é azul (B/R 1,46 contra 1,40) e
       já tem lua e estrela no lugar de cúmulo iluminado, ou seja: o conteúdo é
       que faz a leitura de noite, não o multiplicador.

       Somar os dois esmagamentos daria 0,06 x 0,43 = 0,026 do céu de dia — um
       buraco preto onde deveria haver céu, e o oposto do defeito que se está
       consertando. Os números novos recompõem o produto: 0,22 x 0,43 = 0,095 de
       fundo (contra 0,043 de antes, mas agora com estrutura de noite) e
       0,55 x 0,43 = 0,24 de reflexo (contra 0,40, mais escuro de propósito —
       quem virou a chave são as luminárias, e o brilho do céu no verniz tem de
       ceder para elas aparecerem). */
    const nf = THREE.MathUtils.clamp(rig.nightness, 0, 1);
    const pisoEnv = comPar ? 0.55 : 0.40;
    const pisoBg = comPar ? 0.22 : 0.06;
    scene.environmentIntensity = extEnvIntensity * k * THREE.MathUtils.lerp(1, pisoEnv, nf);
    scene.backgroundIntensity = extEnvIntensity * Math.min(1, k) * THREE.MathUtils.lerp(1, pisoBg, nf);
  } else {
    scene.environmentIntensity = Math.max(0, rig.envIntensity);
  }

  /* exposureBase is the ENVIRONMENT's exposure. It composes with the preset's
     instead of replacing it, so the presets keep their relative spread and the
     brightness slider keeps its full range on top of any photo. */
  renderer.toneMappingExposure = Math.max(0.05, rig.exposure * exposureBase);

  skyU.uTop.value.copy(rig.skyTop);
  skyU.uMid.value.copy(rig.skyMid);
  skyU.uHor.value.copy(rig.skyHorizon);
  skyU.uMidPos.value = rig.skyMidPos;
  skyU.uBias.value = Math.max(0.05, rig.skyBias);
  skyU.uHaloColor.value.copy(rig.skyHaloColor);
  skyU.uHalo.value = Math.max(0, rig.skyHalo);
  skyU.uDisc.value = Math.max(0, rig.skyDisc);
  skyU.uCloud.value = THREE.MathUtils.clamp(rig.cloudiness, 0, 1);
  /* `_keyDir`, não `key.position.normalize()`: desde que a caixa de sombra
     acompanha o conjunto, a POSIÇÃO da luz carrega o deslocamento do rig e
     normalizá-la daria uma direção de sol errada (e dependente de onde o
     caminhão está). Ver placeKeyLight(). */
  _dirW.copy(_keyDir);
  skyU.uKeyDir.value.copy(_dirW);

  if (starsMesh) {
    starsMesh.material.opacity = THREE.MathUtils.clamp(rig.starOpacity, 0, 1);
    /* no dome ⇒ no procedural stars: they sit at r=332 and would float in front
       of an HDRI sky that already has its own (or a daylit sky that has none) */
    starsMesh.visible = skyDomeOn && rig.starOpacity > 0.01;
  }
  /* THE LENS READS AS THE SOURCE. Both halves are driven, not just the level:
     the emissive COLOUR follows `lampColor`, so `estudio`'s cold LED shows a
     cold lens and every other preset a sodium-warm one, instead of one fixed
     amber that contradicts the pool of light on the ground. */
  const lampE = Math.max(0, rig.lampEmissive);
  const lampLensMat = getLampLensMat();
  if (lampLensMat) {
    lampLensMat.emissive.copy(rig.lampColor);
    lampLensMat.emissiveIntensity = lampE;
  }
  /* Emissives a loaded fixture brought with it, taken over by
     prepareLampModel() so a lens authored "always on" does not glow at noon.
     Their own colour is left alone — that is the model author's choice — and
     only the level follows the clock, at half strength because a textured lens
     is already carrying its own brightness. */
  for (const mat of lampModelEmissive.keys()) mat.emissiveIntensity = lampE * 0.5;
  for (const u of lampUnits) {
    u.spot.color.copy(rig.lampColor);
    /* Units the layout parked (manifest `count` below the fixed pool, or lamps
       off for this environment) are darkened HERE, through intensity — a plain
       uniform. Doing it by flipping SpotLight.visible would be a shader define
       and a full recompile on every environment change. setLamps() only ever
       sets the flag; this stays the single writer of the value.
       lampIntensityScale is the (h/LAMP_HEIGHT)² inverse-square compensation
       for a per-scene mounting height; it is 1 at the authored height. */
    u.spot.intensity = u.active
      ? Math.max(0, rig.lampIntensity) * getLampIntensityScale() * getLampBeamGain()
      : 0;
  }

  /* AS LUZES DO CAVALO E DO IMPLEMENTO. Um número por material emissivo de
     lâmpada, e o módulo é quem sabe quais são — ver vehicle/lights.ts. */
  setVehicleLightsLevel(rig.vehLights);
  /* E OS FEIXES, na mesma linha e com o mesmo número, porque são a mesma coisa
     vista dos dois lados: `lights.ts` acende a LENTE e `beams.ts` põe a poça de
     luz no chão. Depois, nunca antes — beams.ts lê as lâmpadas já medidas. */
  updateVehicleBeams(rig.vehLights);

  applyWetness(THREE.MathUtils.clamp(rig.wetness, 0, 1));

  /* the paint shader reads the key light from these uniforms rather than
     directionalLights[0] — that index depends on three's internal
     shadow-casters-first sort and would silently follow the wrong light */
  _dirV.copy(_dirW).transformDirection(camera.matrixWorldInverse);
  _keyCol.copy(key.color).multiplyScalar(key.intensity);
  setKeyLight(_dirV, _keyCol, rig.glintBoost);

  for (const fn of rigHooks) fn(rig);

  /* THE broadest invalidation in the module: everything the rig owns — key/rim/
     hemi/ambient, fog, background, exposure, the sky uniforms, the lamps, the
     wetness, the paint's view-space key — was just written. Every public setter
     in this file reaches here through beginTween(), so covering applyRig()
     covers the whole lighting API in one place. */
  invalidate();
}

/* Discrete state cannot be interpolated, so: grow early, shrink late. The lamp
   SpotLights come on the instant a transition to night starts, and only switch
   off once a transition away from night has fully finished — a mid-tween flip
   would be a visible pop AND a shader recompile at the worst moment.

   HYSTERESIS, and the clock is why it is needed. `lampIntensity` used to take
   one of two authored values; it is now a continuous function of the hour, so a
   slider parked on a single threshold would flip NUM_SPOT_LIGHTS on every
   pointer event — a recompile of every material in the scene, per event, for as
   long as the user jiggles. Two levels a factor of four apart turn that into
   one crossing. The ON level is low deliberately: at 6 of a night preset's ~95
   the lamps are still too dim to see, so the flag is always thrown while the
   result is invisible and the ramp the user actually watches is `intensity`,
   which applyRig() writes as a plain uniform.

   This remains the SINGLE writer of SpotLight.visible. */
const LAMP_ON_LEVEL = 6, LAMP_OFF_LEVEL = 1.5;
/* E O VEÍCULO TAMBÉM PEDE O POOL, desde que os feixes dele moram nele. Sem esta
   segunda condição o preset `ciclorama` — que autora `lampIntensity: 0` — deixaria
   as catorze `SpotLight` fora da cena e o farol do caminhão não iluminaria nada às
   21 h, embora a lente estivesse acesa. O limiar é baixo (0,02 de `vehLights`, ou
   seja poucos segundos depois das 18:00) pela mesma razão que o dos postes: a
   bandeira tem de ser jogada enquanto o resultado ainda é invisível, para que o
   que o usuário vê subir seja `intensity`, que é uniforme e não recompila nada. */
const VEH_BEAM_ON_LEVEL = 0.02;
/* Seeded true to match SpotLight's own construction default, or the first call
   would short-circuit as a no-op and leave the whole pool lit in a daylit
   scene. */
let lampsOn = true;

/** Does this rig want the pool live, given where the pool already is? */
function lampsWanted(intensity: number, vehLights = 0) {
  if (vehLights > VEH_BEAM_ON_LEVEL) return true;
  return lampsOn ? intensity > LAMP_OFF_LEVEL : intensity > LAMP_ON_LEVEL;
}

function setLampsEnabled(on: boolean) {
  if (on === lampsOn) return;
  lampsOn = on;
  for (const u of lampUnits) {
    if (u.spot.visible !== on) u.spot.visible = on;
  }
  /* AS CATORZE JUNTAS. Os seis feixes do veículo moram no mesmo pool exatamente
     para que a contagem seja binária: deixá-los fora deste laço criaria um
     terceiro valor de NUM_SPOT_LIGHTS (8) e, com ele, uma terceira configuração
     de shader que `warmLightPrograms()` não pré-compila — o travamento no
     controle de hora voltaria pela porta dos fundos.

     ⚠️ E CONTINUA BINÁRIO COM O POOL POR NÍVEL, porque o pool não esconde: ele
     DESAPAREIA (ver `setSpotPool()` em lamps.ts). Escrever `visible` numa
     `SpotLight` que não tem pai é inofensivo — `traverseVisible()` nunca chega
     nela —, então este laço continua sendo o mesmo em qualquer pool e as duas
     configurações da sessão continuam sendo 0 e `activeSpotPool()`. */
  for (const s of vehBeams) {
    if (s.visible !== on) s.visible = on;
  }
  invalidate();
}

/**
 * Ajusta o pool de `SpotLight` ao que o nível de qualidade vigente pede.
 *
 * FRIO E SÓ SOB CORTINA. Mexer aqui move `NUM_SPOT_LIGHTS`, que é chave de cache
 * de programa de TODO material da cena — é o mesmo engasgo que
 * `warmLightPrograms()` existe para pagar adiantado, e por isso quem chama tem
 * de estar atrás da cortina e tem de rodar `warmLightPrograms()` depois: as duas
 * configurações a pré-compilar acabaram de mudar.
 *
 * Chamado por `studio.ts` dentro de `applyColdQuality()`, e por mais ninguém.
 * O boot não precisa dele — `makeLamps()` já nasce no pool do nível.
 *
 * @returns true se a contagem mudou de fato (ou seja, se há o que recompilar).
 */
export function applyColdSpotPool(): boolean {
  const want = coldProfile().spotPool;
  if (want === activeSpotPool()) return false;
  setSpotPool(want);
  /* E ESTA FUNÇÃO CONTINUA SENDO O DONO DA BANDEIRA. As luzes que acabaram de
     voltar ao grafo trazem o `visible` de quando saíram; sem esta reconciliação
     um pool que cresce à noite entraria com faróis apagados até a próxima
     travessia de 18:00. `setLampsEnabled()` sai cedo quando o estado não mudou,
     então não dá para delegar a ele. */
  for (const u of lampUnits) u.spot.visible = lampsOn;
  for (const s of vehBeams) s.visible = lampsOn;
  invalidate();
  return true;
}

/**
 * Troca o filtro do mapa de sombra (`pcf` ↔ `basic`) — o outro botão frio que
 * dá para aplicar sem contexto novo.
 *
 * ⚠️ **`shadowMap.type` É UM `#define`, E O THREE NÃO INVALIDA NADA SOZINHO.**
 * O tipo entra na chave de cache do programa, mas `WebGLRenderer` só remonta um
 * programa quando o MATERIAL se diz sujo — trocar o campo e não varrer a cena
 * deixa toda superfície já compilada amostrando a sombra pelo filtro ANTIGO, em
 * silêncio, até que alguma outra coisa marque aquele material. Daí a varredura
 * abaixo, que é cara (centenas de materiais recompilando) e é exatamente por
 * isso que isto é FRIO e mora sob a cortina.
 *
 * O ganho que ela compra é o maior por fragmento do engine: `basic` é 1 tap
 * contra os 17 do PCF, ~20 % do sampler de um UHD 630. O custo, dito por
 * inteiro, está em `core/quality.ts` — a borda da sombra vira uma escada de um
 * texel e `shadow.radius` deixa de existir.
 *
 * @returns true se o tipo mudou de fato.
 */
export function applyColdShadowType(): boolean {
  const want = coldProfile().shadowType === 'basic'
    ? THREE.BasicShadowMap : THREE.PCFShadowMap;
  if (renderer.shadowMap.type === want) return false;
  renderer.shadowMap.type = want;
  scene.traverse((o) => {
    const mats = (o as THREE.Mesh).material;
    if (!mats) return;
    if (Array.isArray(mats)) { for (const m of mats) m.needsUpdate = true; }
    else mats.needsUpdate = true;
  });
  /* O mapa em si não muda de forma, mas o que o LÊ mudou — e com
     `autoUpdate = false` ninguém redesenha nada sem pedir. */
  renderer.shadowMap.needsUpdate = true;
  invalidate();
  return true;
}

/**
 * Compile BOTH light configurations now, so the hour slider never has to.
 *
 * THE STALL ON THE TIME SLIDER IS A SHADER RECOMPILE, and this is where it comes
 * from. setLampsEnabled() flips SpotLight.visible on the whole pool at the
 * day↔night crossing; WebGLRenderer gathers lights with traverseVisible(), so
 * that moves NUM_SPOT_LIGHTS 0↔14 — ou 0↔6 no nível Médio, e nada no Baixo; ver
 * a guarda de pool zero logo abaixo — which is part of the program CACHE KEY of
 * every material in the scene. Crossing dusk therefore recompiles the set (a
 * 176k-triangle industrial estate), the implement's ~50 materials and the cab,
 * synchronously, in the middle of a pointer drag. It is a once-per-session cost
 * because three then caches the programs by that key: the second crossing is
 * free. So the fix is not to make it cheaper, it is to pay for it where a wait
 * is expected.
 *
 * Kennedy's call, and it is the right one for a configurator: "prefiro ter um
 * pouco mais de tempo de carregamento no início do que ter esse travamento na
 * mudança do slider."
 *
 * Must run with every material already in the scene — studio.ts calls it after
 * the set, the cab, the implement and the paint are all mounted. Restoring the
 * flag afterwards matters: this is a warm-up, not a state change, and
 * setLampsEnabled() remains the single writer of SpotLight.visible.
 *
 * AWAITABLE, and callers should await it. It used to be two synchronous
 * `renderer.compile()` calls, each of which blocks the main thread for the
 * whole compile AND the whole driver link with the full scene mounted; r179's
 * `compileAsync` hands the link back to the driver's parallel compiler
 * (KHR_parallel_shader_compile) and polls, so the curtain's progress bar can
 * still animate through it. The synchronous call stays as the fallback for a
 * driver without the extension. The returned promise is what keeps the loading
 * curtain over the work — resolve it before lifting the curtain or the stall
 * simply moves to the first visible frame, which is the bug this exists to fix.
 */
export async function warmLightPrograms(): Promise<void> {
  /* ---- POOL ZERO: NÃO HÁ SEGUNDA CONFIGURAÇÃO, E ESPERAR POR ELA SERIA
     ESPERAR POR NADA ----
     No nível Baixo `coldProfile().spotPool` é 0 e `setSpotPool()` desapareou as
     catorze luzes. `NUM_SPOT_LIGHTS` é 0 nas duas pontas da bandeira, ou seja
     inverter `lampsOn` produz exatamente a MESMA chave de programa: a primeira
     `compilePrograms()` compilaria a cena inteira de novo por nada e, num driver
     sem `KHR_parallel_shader_compile` ou numa aba que o usuário acabou de trocar,
     seguraria a cortina pelos 8 s inteiros do `COMPILE_TIMEOUT_MS` — o pior caso
     justamente no hardware mais fraco, que é quem cai no pool 0.
     Uma passada só, então: a configuração que vai ser desenhada. */
  if (activeSpotPool() === 0) {
    try { await compilePrograms(); } catch (_) { /* ignore */ }
    invalidate();
    return;
  }
  const was = lampsOn;
  /* The scene is about to be deliberately wrong for as long as the compile
     takes, and unlike the old synchronous compile() that window now contains
     real frames. See drawSuspended. */
  drawSuspended++;
  try {
    setLampsEnabled(!was);
    await compilePrograms();
  } catch (err) {
    console.warn('[truck-studio] pré-compilação da configuração de luz alternativa falhou'
      + ' — a primeira passagem por 18:00 pode engasgar.', err);
  } finally {
    /* Restored only after the await settles, which is the point: three gathers
       lights with traverseVisible() inside compile(), so the alternative pool
       has to be MOUNTED for the duration of that call. */
    setLampsEnabled(was);
    drawSuspended--;
    invalidate();
  }
  /* And the configuration we are actually about to render, so the first frame
     after the loader is not a compile either. */
  try { await compilePrograms(); } catch (_) { /* ignore */ }
  invalidate();
}

/* EVERY WAIT HERE IS BOUNDED — the same discipline, and the same 8 s, as
   studio.ts's warmUp(). A backgrounded tab does not fire requestAnimationFrame,
   and three's parallel-compile polling stalls with it, so a bare `await` would
   hang the loading curtain forever if the user switched tab mid-load. Warming up
   is an optimisation; it is never allowed to be why the studio fails to open. */
const COMPILE_TIMEOUT_MS = 8000;

function compilePrograms(): Promise<unknown> {
  /* Feature-detected rather than assumed: `compileAsync` is r152+, and this is
     the one place a three downgrade would turn into a silent hang instead of a
     type error. */
  const r = renderer as THREE.WebGLRenderer & {
    compileAsync?: (s: THREE.Object3D, c: THREE.Camera) => Promise<unknown>;
  };
  if (typeof r.compileAsync !== 'function') {
    renderer.compile(scene, camera);
    return Promise.resolve();
  }
  return Promise.race([
    r.compileAsync(scene, camera),
    new Promise<void>((res) => setTimeout(res, COMPILE_TIMEOUT_MS)),
  ]);
}

function beginTween(animate: boolean) {
  const next = resolveRig(sceneState);
  if (!rigCur) {
    rigCur = next;
    rigFrom = makeRig(RIG_BASE);
    rigTo = next;
    tweenT = 1;
    setLampsEnabled(lampsWanted(next.lampIntensity, next.vehLights));
    applyRig(rigCur);
    refreshEnvironment(rigCur, true);
    return;
  }
  rigTo = next;
  if (!animate) {
    lerpRig(rigCur, next, next, 1);
    tweenT = 1;
    setLampsEnabled(lampsWanted(next.lampIntensity, next.vehLights));
    applyRig(rigCur);
  } else {
    rigFrom = makeRig(RIG_BASE);
    lerpRig(rigFrom, rigCur, rigCur, 1);        // snapshot the current pose
    tweenT = 0;
    if (lampsWanted(next.lampIntensity, next.vehLights)) setLampsEnabled(true);   // grow early
  }
  refreshEnvironment(next, false);
  /* Redundant on every branch — applyRig() already invalidated, and the animated
     branch will be held open by isTransitioning() — but this is the funnel every
     public lighting entry point passes through, so it is the cheapest place to
     be sure. */
  invalidate();
}

export const isTransitioning = () => tweenT < 1;
export const getRig = () => rigCur;
export const getKeyLight = () => key;

/* Called once per frame from the render loop; the ONLY writer to three objects. */
export function updateLighting(dt: number) {
  skyU.uTime.value += dt;
  if (tweenT < 1) {
    tweenT = Math.min(1, tweenT + dt / tweenDur);
    lerpRig(rigCur, rigFrom, rigTo, easeInOutCubic(tweenT));
    applyRig(rigCur);
    if (tweenT >= 1) setLampsEnabled(lampsWanted(rigTo.lampIntensity, rigTo.vehLights));   // shrink late
  } else if (rigCur) {
    /* the paint uniforms are VIEW space, so they must refresh as the camera
       orbits even when the rig itself is static */
    _dirW.copy(_keyDir);          // ver a nota em applyRig(): NÃO é key.position
    _dirV.copy(_dirW).transformDirection(camera.matrixWorldInverse);
    _keyCol.copy(key.color).multiplyScalar(key.intensity);
    setKeyLight(_dirV, _keyCol, rigCur.glintBoost);
  }
}

/* ---------------- public API ---------------- */

/**
 * Move the clock. 6 = 06:00, 24 = midnight; fractional hours are fine (the HUD
 * uses quarters) and out-of-range values are clamped rather than rejected.
 *
 * This re-derives the key light's az/el from the new hour and CLEARS both
 * manual overrides — see syncSunToHour() for the full policy — and re-derives
 * `sceneState.timeOfDay`, so every pre-clock consumer stays coherent.
 *
 * Defaults to NOT animating, for the same reason setLightParams() does: this is
 * a slider, and a 0.8 s crossfade would trail the thumb.
 *
 * @param {number} h
 * @param {{animate?: boolean}} [opts]
 */
export function setHourOfDay(h: number, opts?: { animate?: boolean }) {
  setHourInternal(h);
  sceneState.azManual = false;
  sceneState.elManual = false;
  syncSunToHour();
  beginTween(!!(opts && opts.animate));
  save();
  return sceneState;
}

/** @returns {number} the current hour, HOUR_MIN..HOUR_MAX */
export function getHourOfDay() { return sceneState.hour; }

/** 0 = full day, 1 = full night: the weight the two preset faces crossfade on
 *  and, through the rig, the weight behind the stars, the lamps and the fog. */
export function getNightness() { return nightnessAt(sceneState.hour); }

/** O peso do plate de NOITE na dissolvência dos dois céus, 0..1 — a banda LARGA,
 *  que é a de `skyMixAt()` e não a de `nightness`. Quem chama é
 *  `scene/environment.ts`, ao montar o par: a primeira mistura tem de nascer na
 *  hora vigente, ou o cenário abre com o céu errado por um quadro. */
export function getSkyMix() { return skyMixAt(sceneState.hour); }

/**
 * Weather. NIGHT IS A WEATHER-ORTHOGONAL AXIS — that is what lets "overcast at
 * night" and "raining at dawn" both exist and look right — so a preset change
 * does NOT move the clock. It keeps the hour, re-derives the sun from it, and
 * therefore also drops any az/el the user had pinned (a new preset is a new
 * look; carrying a hand-aimed light into it is not what anyone means by picking
 * "Chuvoso"). `estudio` opts out with `solar: false` and gets its authored
 * studio geometry back instead.
 *
 * The consequence worth stating: picking "Dourado" at 12:00 gives golden
 * COLOURS with a midday sun, not a sunset. If you want the sunset, move the
 * clock — that is what it is for. Having the preset yank the time slider would
 * make the headline control feel like it was fighting the user.
 */
export function applyPreset(id: string, opts?: { animate?: boolean }) {
  if (!LIGHT_PRESETS[id]) id = 'ensolarado';
  sceneState.preset = id;
  sceneState.azManual = false;
  sceneState.elManual = false;
  sceneState.brightness = 1;
  syncSunToHour();
  beginTween(!opts || opts.animate !== false);
  save();
  return sceneState;
}

/**
 * The pre-clock binary control, kept working for every caller that still speaks
 * it (environment.ts applies `envDef.timeOfDay` through it). It is now a
 * shortcut for two canonical hours, chosen so the resulting rig is EXACTLY the
 * one this function produced before the clock existed: n(12:00) = 0 and
 * n(21:30) = 1, so 'dia' is the undiluted `dia` face and 'noite' the undiluted
 * `noite` face. Like the hour slider it re-derives az/el and clears the manual
 * overrides, which is what it did before too.
 */
export function setTimeOfDay(tod: TimeOfDay, opts?: { animate?: boolean }) {
  setHourInternal(tod === 'noite' ? TOD_HOUR.noite : TOD_HOUR.dia);
  sceneState.azManual = false;
  sceneState.elManual = false;
  syncSunToHour();
  beginTween(!opts || opts.animate !== false);
  save();
  return sceneState;
}

/* az / el / brightness. Defaults to NOT animating: a slider drag has to track
   the thumb, and tweening would lag behind the pointer.
   az and el are the clock's outputs, so writing one PINS THAT AXIS against the
   clock until the hour next moves (or the preset changes) — syncSunToHour()
   documents why the pin is deliberately not permanent. Non-finite input is
   dropped rather than propagated: a NaN here reaches key.position and takes the
   whole render with it. */
export function setLightParams(
  p: { az?: number; el?: number; brightness?: number }, opts?: { animate?: boolean },
) {
  if (p.az !== undefined && Number.isFinite(+p.az)) {
    sceneState.az = +p.az;
    sceneState.azManual = true;
  }
  if (p.el !== undefined && Number.isFinite(+p.el)) {
    sceneState.el = +p.el;
    sceneState.elManual = true;
  }
  if (p.brightness !== undefined && Number.isFinite(+p.brightness)) {
    sceneState.brightness = +p.brightness;
  }
  beginTween(!!(opts && opts.animate));
  save();
  return sceneState;
}


/* ---------------- os controles de ESTÚDIO ----------------
   A luz de uma sala de estúdio não tem hora do dia nem clima — tem fundo, chave,
   preenchimento, recorte e difusão. São conceitos DIFERENTES dos de uma cena
   externa, e é por isso que o HUD troca de face em vez de acrescentar mais
   linhas: "Hora do dia" num ciclorama é um controle que não pode significar
   nada.

   O QUE **NÃO** GANHOU CONTROLE, e de propósito: a COR da chave. Esta é a cena
   em que se julga uma tinta, e o preset a autora em R=G=B exato justamente para
   não mentir sobre a cor que o cliente vai receber (ver o cabeçalho do
   `ciclorama`). Um seletor de cor de luz aqui seria a primeira coisa a
   invalidar o cenário inteiro. Quem quiser luz colorida tem os cenários
   externos e o ciclo do dia. */

/** As faixas dos três multiplicadores. FONTE ÚNICA — restore() e ui/hud.ts
 *  leem daqui, e um limite escrito duas vezes é um limite que diverge. */
/* AS FAIXAS FORAM ABERTAS DEPOIS DE UM RELATO, e o relato é o argumento:
   *"os controles de iluminação do estúdio estão muito sutis — pra ficar ideal o
   preenchimento está no máximo, e eu gostaria de poder dar uma extravasada"*.

   Um controle cujo IDEAL é o batente está mal dimensionado por definição: ele
   não oferece escolha, oferece um degrau. O erro foi tratar o valor autorado
   como o CENTRO da faixa — o `ciclorama` é calibrado para uma foto de catálogo
   sóbria, e uma faixa simétrica em torno dele só permite ficar mais sóbrio.

   Agora o autorado (1,0) fica no PRIMEIRO QUARTO e o resto é folga para exagerar
   de propósito. O mínimo continua sendo zero de verdade — "sem preenchimento" e
   "sem recorte" são posições legítimas, e são elas que dão a foto de contraste
   duro. */
export const STUDIO_RANGE = {
  /** preenchimento: de só-chave a completamente chapado */
  fill: [0, 5] as const,
  /** recorte: de nenhum a um contorno declaradamente exagerado */
  rim: [0, 5] as const,
  /** difusão da sombra: de contato duro a softbox de parede inteira */
  softness: [0.15, 6] as const,
  /** temperatura de cor, em Kelvin. 6500 é neutro exato — ver kelvinTint(). */
  temp: [TEMP_MIN, TEMP_MAX] as const,
};

/** Este preset é uma sala de estúdio? É o que decide a face do HUD. */
export const isStudioPreset = (id?: string | null): boolean =>
  !!LIGHT_PRESETS[id || sceneState.preset]?.studio;

export interface StudioParams {
  backdrop?: string;
  fill?: number;
  rim?: number;
  softness?: number;
  /** Kelvin. `TEMP_NEUTRAL` (6500) não tinge nada. */
  temp?: number;
}

/**
 * Fundo e as três luzes do estúdio.
 *
 * MESMA POLÍTICA DE ANIMAÇÃO de setLightParams(), e pelo mesmo motivo: um
 * arrasto de controle deslizante tem de acompanhar o polegar, e um tween ficaria
 * atrás dele. A exceção é o FUNDO, que é uma chave discreta e não um arrasto —
 * as quatro pastilhas são um crossfade, exatamente como as de clima. É por isso
 * que a decisão de animar é tomada por CAMPO e não pelo chamador.
 */
export function setStudioParams(p: StudioParams, opts?: { animate?: boolean }) {
  const clamp = (v: number, [lo, hi]: readonly [number, number]) =>
    THREE.MathUtils.clamp(v, lo, hi);
  let discrete = false;
  if (p.backdrop !== undefined) {
    const bd = backdropOf(p.backdrop);
    discrete = discrete || bd.id !== sceneState.backdrop;
    sceneState.backdrop = bd.id;
  }
  if (p.fill !== undefined && Number.isFinite(+p.fill)) {
    sceneState.fill = clamp(+p.fill, STUDIO_RANGE.fill);
  }
  if (p.rim !== undefined && Number.isFinite(+p.rim)) {
    sceneState.rim = clamp(+p.rim, STUDIO_RANGE.rim);
  }
  if (p.softness !== undefined && Number.isFinite(+p.softness)) {
    sceneState.softness = clamp(+p.softness, STUDIO_RANGE.softness);
  }
  if (p.temp !== undefined && Number.isFinite(+p.temp)) {
    sceneState.temp = clamp(+p.temp, STUDIO_RANGE.temp);
  }
  beginTween(opts?.animate ?? discrete);
  save();
  return getStudioParams();
}

export function getStudioParams(): Required<StudioParams> & { def: BackdropDef } {
  return {
    backdrop: sceneState.backdrop,
    fill: sceneState.fill,
    rim: sceneState.rim,
    softness: sceneState.softness,
    temp: sceneState.temp,
    def: backdropOf(sceneState.backdrop),
  };
}

/**
 * Show/hide the procedural gradient dome. An HDRI background is drawn by
 * WebGLBackground with depthTest off, so the dome (a BackSide sphere at r=340
 * that DOES write depth) would hide it completely — this is what makes an HDRI
 * visible at all. The stars follow the dome, see the guard in applyRig().
 * @param {boolean} v
 */
export function setSkyDomeVisible(v: boolean) {
  skyDomeOn = !!v;
  if (skyDome) skyDome.visible = skyDomeOn;
  if (starsMesh && !skyDomeOn) starsMesh.visible = false;
  if (starsMesh && skyDomeOn && rigCur) starsMesh.visible = rigCur.starOpacity > 0.01;
  invalidate();
}

/* ---------------- horizon haze ----------------
   THE SEAM BETWEEN 3D AND PHOTOGRAPH, AND WHY FOG ALONE CANNOT CLOSE IT.

   three.js does not fog `scene.background`. Geometry recedes into `fogColor`;
   the HDRI behind it stays at full contrast whatever the fog is doing. So a 3D
   set always ends in a visible line: fogged ground on one side, crisp
   photograph on the other. Raising fogDensity does not help — it fogs the only
   half that was already fogged.

   This is the missing half: a shell that fogs the SKY. An inverted sphere just
   inside the far plane, painted `fogColor`, opaque at the horizon and fading to
   nothing by ~24° elevation. It is transparent, so it draws after the opaque
   pass and over the background; it is at 570 m with depthWrite off, so every
   piece of real geometry occludes it correctly.

   The two halves then MEET at the same colour: ground fades to fogColor going
   out, sky fades to fogColor coming down, and the horizon stops being an edge.

   It pays for the night as well. `fogColor` at night is 0x141d2e, so the lower
   sky darkens with the scene instead of staying a lit daytime photograph —
   which is the other half of the "24:00 não fica noite" fix in applyRig(). */
const HAZE_R = 570;                    // camera.far is 600 — must sit inside it
let hazeMesh: THREE.Mesh | null = null;

/* ---------------- horizon tint ----------------
   WHERE THE HAZE COLOUR COMES FROM WHEN A PHOTOGRAPH IS THE SKY.

   The haze above closes the seam by painting the lower sky in `fogColor`, so
   that fogged ground and fogged sky meet at one colour. That argument is only
   true if `fogColor` IS the colour the sky has at the horizon — and under an
   HDRI it is not. `fogColor` is PRESET data, authored for the procedural dome:
   `ensolarado` inherits RIG_BASE's 0xb8d8f5, a pale sky blue.

   Measured against what it was actually being painted over — the horizon band
   of `rodovia/sky.hdr`, the panorama `distrito-industrial` uses — the two are
   not close:

     preset fogColor 0xb8d8f5    linear 0.487 0.708 0.947   pale blue
     HDRI horizon    0x5a633f    linear 0.102 0.124 0.050   olive green

   Five times too bright and the opposite hue. At `haze: 0.8` that is a pale
   ribbon laid across a green field: the "faixa cinza que não faz sentido". No
   amount of retuning `strength`, `low` or `high` can fix a colour, and turning
   the haze down only trades the ribbon back for the hard seam it exists to
   remove.

   So an environment may declare the tone its own horizon actually has, and it
   overrides `fogColor` for the two surfaces that have to agree with the
   photograph — `scene.fog` and the haze shell. Everything else the preset
   drives is untouched: this is a match to a specific plate, not a lighting
   change, and `bgColor` in particular must keep tracking the preset because it
   is what shows when the HDRI is released.

   It is authored rather than sampled at load. Sampling is what the rip viewer
   does and it is the more self-maintaining answer, but `loadHdr()` hands the
   DataTexture straight to PMREM and drops it, so reading it back means keeping
   a 16 MB float buffer alive per environment for one colour. One measured hex
   in the manifest, with the measurement written down beside it, buys the same
   thing for nothing. */
let horizonTint: THREE.Color | null = null;

/**
 * Pin fog and horizon haze to a measured colour, or `null` to hand both back to
 * the preset. Takes effect on the next applyRig(), which is every frame of a
 * tween and at least once per environment change.
 * @param {number | string | null} c hex (0x5a633f) or css string, sRGB
 */
export function setHorizonTint(c: number | string | null) {
  invalidate();
  if (c === null || c === undefined || c === '') {
    horizonTint = null;
    return;
  }
  horizonTint = new THREE.Color(c as THREE.ColorRepresentation);
}
const hazeU = {
  uLow: { value: -0.10 },              // sin(elev) at which haze is full
  uHigh: { value: 0.40 },              // sin(elev) at which haze is gone (~24°)
  uStrength: { value: 0 },             // 0 = off; set by setHorizonHaze()
};

function makeHaze(): THREE.Mesh {
  /* MeshBasicMaterial + onBeforeCompile rather than a ShaderMaterial: this way
     the haze keeps three's own tonemapping_fragment and colorspace_fragment, so
     it is graded by ACES exactly like the fogged geometry it has to match. A
     hand-written ShaderMaterial would have to reproduce both chunks and would
     drift from them on the next three upgrade. */
  const mat = new THREE.MeshBasicMaterial({
    color: 0xb8d8f5, side: THREE.BackSide,
    transparent: true, depthWrite: false, fog: false,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uLow = hazeU.uLow;
    shader.uniforms.uHigh = hazeU.uHigh;
    shader.uniforms.uStrength = hazeU.uStrength;
    shader.vertexShader = 'varying vec3 vHazeDir;\n' + shader.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvHazeDir = position;');
    /* Injected after <map_fragment> on purpose: that chunk exists in every
       three version this project has seen, where the name of the final output
       chunk (output_fragment → opaque_fragment) has changed twice. */
    shader.fragmentShader =
      'varying vec3 vHazeDir;\nuniform float uLow;\nuniform float uHigh;\nuniform float uStrength;\n'
      + shader.fragmentShader.replace('#include <map_fragment>',
        '#include <map_fragment>\n\tdiffuseColor.a *= (1.0 - smoothstep(uLow, uHigh, normalize(vHazeDir).y)) * uStrength;');
  };
  const m = new THREE.Mesh(new THREE.SphereGeometry(HAZE_R, 32, 20), mat);
  m.name = 'ts-haze';
  m.frustumCulled = false;             // it is always around the camera
  m.renderOrder = 10;                  // after the set, before the HUD sprites
  return m;
}

/**
 * Turn the horizon haze on or off.
 * @param {null | {strength?: number, low?: number, high?: number}} opts
 *        `strength` 0..1 scales the whole effect (1 = fully opaque at the
 *        horizon). null removes it.
 */
export function setHorizonHaze(opts: null | { strength?: number; low?: number; high?: number }) {
  invalidate();
  if (!opts) {
    hazeU.uStrength.value = 0;
    if (hazeMesh) hazeMesh.visible = false;
    return;
  }
  if (!hazeMesh) {
    hazeMesh = makeHaze();
    scene.add(hazeMesh);
    /* Keeps the shell centred on the camera so the horizon stays at the
       horizon: at 570 m a 60 m dolly would otherwise tilt the fade by ~6°. */
    frameHooks.push(() => {
      if (hazeMesh) hazeMesh.position.set(camera.position.x, 0, camera.position.z);
    });
  }
  hazeMesh.visible = true;
  hazeU.uStrength.value = THREE.MathUtils.clamp(
    Number.isFinite(+opts.strength!) ? +opts.strength! : 1, 0, 1);
  if (Number.isFinite(+opts.low!)) hazeU.uLow.value = +opts.low!;
  if (Number.isFinite(+opts.high!)) hazeU.uHigh.value = +opts.high!;
  /* Same source of truth as applyRig(), which repaints this on the next frame
     anyway — but a scenery change can mount the shell while the rig is idle, and
     one frame of an ungraded midday olive over a night scene is exactly the
     artefact gradePlateColor() exists to remove. */
  if (rigCur) {
    (hazeMesh.material as THREE.MeshBasicMaterial).color.copy(
      horizonTint ? gradePlateColor(_tintGraded, horizonTint, rigCur) : rigCur.fogColor);
  }
}

/* ---------------- interior confinement ----------------
   Keep the camera inside a closed set.

   The cutaway (single-sided inward shell) means a camera OUTSIDE the warehouse
   sees straight in — useful, but it also means the orbit can drift out into a
   240 m grey apron and look back at a building with no far wall, which reads as
   broken. With the shed now 69 x 124 m there is no reason to ever leave: the
   truck can be framed from anywhere inside.

   Clamped in a frame hook rather than through OrbitControls' own limits because
   `maxDistance` is a radius about the target and this is a BOX — a radius large
   enough to see down the 124 m length would also let the camera through the
   69 m wall. */
let interiorBox: { hx: number; hz: number; cx: number; cz: number; minY: number; maxY: number } | null = null;
let interiorHooked = false;

/**
 * Confine the camera (and its orbit target) to a box, in world metres.
 * @param {null | {halfX:number, halfZ:number, minY:number, maxY:number}} b
 */
export function setInteriorBounds(
  b: null | {
    halfX: number; halfZ: number; minY: number; maxY: number;
    /* CENTRO DA CAIXA, opcional, padrão a origem do mundo.
       Existe porque o RIG não fica na origem: ele está em (0, 0, 22) e o
       conjunto ocupa z de 17,9 a 35,7. Para os dois cenários com `set` isso
       nunca importou — as caixas deles são grandes e folgadas o bastante
       (armazém: halfZ 62) para conter o rig deslocado —, mas uma sala gerada em
       código e centrada NO VEÍCULO (scene/cyclorama.ts) precisa de uma caixa
       centrada no mesmo lugar, senão a câmera é proibida de passar por trás do
       implemento. Omitir os dois campos reproduz exatamente o comportamento
       anterior, que é o que os cenários existentes fazem. */
    centerX?: number; centerZ?: number;
  },
) {
  interiorBox = b ? {
    hx: Math.max(1, b.halfX), hz: Math.max(1, b.halfZ),
    cx: b.centerX ?? 0, cz: b.centerZ ?? 0,
    minY: b.minY, maxY: Math.max(b.minY + 0.5, b.maxY),
  } : null;
  /* The clamp runs in a frame hook, so a new box only bites on the next drawn
     frame — which under the dirty loop is a frame that has to be asked for. */
  invalidate();
  if (!interiorBox || interiorHooked) return;
  interiorHooked = true;
  frameHooks.push(() => {
    const k = interiorBox;
    if (!k) return;
    const c = THREE.MathUtils.clamp;
    camera.position.set(
      c(camera.position.x, k.cx - k.hx, k.cx + k.hx),
      c(camera.position.y, k.minY, k.maxY),
      c(camera.position.z, k.cz - k.hz, k.cz + k.hz));
    /* The target too, or a clamped camera orbiting a target outside the box
       would swing along the wall instead of around the truck. */
    controls.target.set(
      c(controls.target.x, k.cx - k.hx, k.cx + k.hx),
      c(controls.target.y, k.minY, k.maxY),
      c(controls.target.z, k.cz - k.hz, k.cz + k.hz));
  });
}

/* ---------------- vehicle focus ----------------
   The subject of this studio is ONE object. Until now nothing said so: the
   orbit had no distance limits at all, and the only thing bounding a pan was
   the set's interior box — 60 x 58 m for the distrito — so the rig could be
   pushed to a speck in the corner of a yard, which is not a view of a truck.

   Three limits, all derived from the rig's own size so they follow a change of
   implement:

   * ORBIT RANGE. minDistance keeps the camera off the bodywork, maxDistance
     keeps the rig filling the frame. At 45° vertical FOV a 18 m rig needs
     ~12 m to fit its length, so 2.6 r (~25 m) is a wide establishing shot and
     anything beyond it is just a smaller truck.
   * TARGET LEASH. OrbitControls bounds the camera about the target but nothing
     bounds the TARGET, and panning drags it freely — that is the actual
     mechanism by which the truck leaves the frame. It is now tied to a sphere
     around the rig centre: enough to recompose, never enough to lose it.
   * BODY EJECTION. minDistance is a SPHERE about the target, which cannot
     express "outside a 15 m long box": a radius small enough to let you near
     the flank also lets you sit inside the van from the front. So the camera is
     pushed back out of the bodywork every frame, on whichever of X/Z is nearer.
     Never on Y — ejecting downwards would put the camera under the floor. */
let vehicleFocus: {
  c: THREE.Vector3; box: THREE.Box3; r: number;
  /** A MIRA de frameAll(), guardada — ver o porquê em setVehicleFocus(). */
  aim: THREE.Vector3;
} | null = null;
let vehicleFocusHooked = false;
/* minDistance, as a fraction of the rig radius. Estava em 0.30, que num rig de
   ~18 m deixava a câmera chegar a ~2.8 m do centro — perto o bastante para o
   enquadramento virar um close de painel de porta, sem veículo reconhecível na
   tela e com a distorção de perspectiva esticando a lataria. Foi para 0.40
   (~3.7 m) e de lá para 0.60 (~5.5 m), a pedido, com o mesmo argumento uma
   escala acima: *"diminuir o zoom in máximo, está muito alto"*.

   POR QUE O NÚMERO SUBIU DE NOVO, e por que ele não é uma questão de gosto: a
   câmera abre em CARD_FOV = 30°, ou seja uma TELEOBJETIVA. Quanto mais longa a
   lente, mais perto o mesmo enquadramento acontece — a distância mínima que
   ainda mostra "um caminhão" cresce junto. O 0.40 tinha sido calibrado quando a
   lente era de 45° e sobreviveu à troca sem ser recalculado; em 30° ele deixa a
   câmera entrar em cima da chapa. Em 0.60 o limite ainda encosta o suficiente
   para inspecionar um detalhe da arte (um logo de 40 cm ocupa meia tela) e
   nunca vira um close sem referência.

   E ELE VALE PARA A METADE, NÃO SÓ PARA O CONJUNTO: `r` é o raio da caixa em
   FOCO, e desde 2026-08-13 essa caixa é a do que está visível (só o cavalo, só
   o implemento). Como a fração é da caixa, o limite acompanha — um implemento
   sozinho tem raio menor e deixa chegar proporcionalmente mais perto, que é o
   certo.

   Não é o único limitador: FOCUS_SKIN empurra a câmera para fora da carroceria
   todo quadro, porque minDistance é uma ESFERA e não sabe dizer "fora de uma
   caixa de 15 m" (ver o cabeçalho acima).

   E SUBIU UMA TERCEIRA VEZ, 0.60 -> 0.80, pelo mesmo relato de 2026-08-13:
   *"precisa diminuir o zoom in máximo, está chegando muito perto do caminhão"*.
   O que o número significa em imagem, num conjunto de 19 m (r ~9,5 m) e com a
   lente de 30° com que a cena abre:

       0.60 · r = 5,7 m   ⇒  4,3 m de altura no quadro  (o baú e pouco mais)
       0.80 · r = 7,6 m   ⇒  4,1 m … 5,8 m de altura    (o baú com folga em cima
                              e embaixo, ainda lendo o texto de uma plotagem)

   Continua perto o bastante para conferir um detalhe da arte — um logotipo de
   40 cm ocupa ~1/10 da altura da tela, ou seja ~100 px num monitor de 1080 —,
   e deixa de ser um close de chapa sem referência de veículo.

   E UMA QUARTA VEZ, 0.80 -> 1.00, com o relato repetido (*"o zoom in máximo
   continua extremamente alto"*) e o diagnóstico corrigido: este número não era
   o que estava governando. Ver `FOCUS_SKIN` logo abaixo — é ele que decide a
   distância até a LATARIA, e ele subiu junto. Este aqui passa a valer 1,00 · r
   (~9,5 m num conjunto de 19 m, ~5,1 m de altura no quadro) para que o limite
   ESFÉRICO também deixe de permitir um close com a mira centrada. */
const FOCUS_MIN_F = 1.00;   // minDistance, as a fraction of the rig radius
/* maxDistance, idem — mas agora é um PISO, não a palavra final: ver o
   Math.max() em setVehicleFocus(). O 2.60 foi calculado para uma lente de 45°
   (é o que o cabeçalho acima ainda descreve); a câmera passou a abrir em
   CARD_FOV = 30, e uma teleobjetiva precisa de MAIS distância para enquadrar o
   mesmo conjunto. O resultado era frameAll() pousar a câmera em ~3.9 r e o
   clamp do OrbitControls puxá-la de volta para 2.6 r no primeiro quadro: a cena
   abria mais fechada do que a pose do card, e não havia como afastar. */
const FOCUS_MAX_F = 2.60;
/* Folga de afastamento ALÉM da pose de abertura. Sem ela o limite de órbita
   coincidiria com a distância de abertura e a roda do mouse não teria para onde
   ir no sentido de afastar.
   1.35 -> 1.15: a 1,35 o afastamento máximo passava de 48 m num conjunto de
   19 m, e lá o caminhão já era um detalhe no meio do pátio — o set foi autorado
   para uma órbita bem mais curta (ver setNote em environments.json). 1.15 ainda
   dá curso de roda para afastar além da abertura, que é a razão de este número
   existir, sem deixar a órbita sair do pátio útil. */
const OPEN_ZOOM_OUT = 1.15;
const FOCUS_PAN_F = 0.28;   // how far the target may be panned off centre
/* Folga mantida FORA da carroceria — e é ELE, não `minDistance`, quem responde
   "quão perto do caminhão dá para chegar".
   ---------------------------------------------------------------------------
   `minDistance` é uma esfera em volta da MIRA, e a mira pode ser arrastada
   `FOCUS_PAN_F · r` (uns 2,7 m num conjunto de 19 m) para cima da lataria. Com
   a mira encostada num flanco, "a 7,6 m da mira" pode ser a centímetros da
   chapa — e o que finalmente segura a câmera é esta expulsão da caixa. Por isso
   subir só `FOCUS_MIN_F` não resolveu o relato: ele mudou o raio da esfera e
   não o que estava governando.
   0,45 → 1,50 m. A 1,5 m, com a lente de 30° com que a cena abre, o quadro tem
   0,80 m de altura — ainda um detalhe (um logotipo de 40 cm ocupa meia tela),
   mas com a chapa inteira em foco em vez de a lente atravessando o friso. */
const FOCUS_SKIN = 1.50;    // metres of clearance kept outside the bodywork
const _fv = new THREE.Vector3();

/**
 * Lock the orbit to a rig. Pass null to release it (no limits).
 *
 * É TAMBÉM O DONO DO CENTRO DA CAIXA DE SOMBRA, e não por conveniência: esta é
 * a única função do engine que recebe a caixa do conjunto INTEIRO já engatado e
 * já colocado no cenário (`focusOnRig()` em studio.ts a chama depois do engate,
 * e emenda `invalidateShadows()` logo em seguida). Ver o bloco de
 * `placeKeyLight()` para o que a caixa centrada na origem estava cortando fora.
 */
/**
 * A PEGADA DO CONJUNTO NO CHÃO — (centro x, centro z, meio-lado x, meio-lado z),
 * em metros de mundo. `null` enquanto não há veículo.
 *
 * Existe para a OCLUSÃO DE CONTATO do piso do estúdio (scene/floor-reflection.ts,
 * chamada por scene/cyclorama.ts). O mapa de sombra cobre a luz DIRECIONAL, e
 * era só isso que escurecia o chão sob a carreta; o hemi, o ambiente e o IBL
 * chegavam embaixo dela com a força que têm no meio da sala. Numa foto de
 * estúdio esses três são a maior parte da luz do piso, e é justamente a falta
 * deles debaixo do veículo que o olho lê como CONTATO. Sem isso o caminhão
 * flutua, que é o que as fotos da bancada mostravam.
 *
 * Sai daqui e não de vehicle/models.ts porque `vehicleFocus` já é a caixa do
 * conjunto medida DEPOIS do engate, e é ela que a sombra e a órbita já usam:
 * uma segunda medição seria uma segunda verdade sobre onde o caminhão está.
 */
export function vehicleFootprint(): { cx: number; cz: number; hx: number; hz: number } | null {
  const f = vehicleFocus;
  if (!f) return null;
  const b = f.box;
  return {
    cx: (b.min.x + b.max.x) / 2,
    cz: (b.min.z + b.max.z) / 2,
    hx: (b.max.x - b.min.x) / 2,
    hz: (b.max.z - b.min.z) / 2,
  };
}

export function setVehicleFocus(box: THREE.Box3 | null) {
  /* Same reason as setInteriorBounds(): the ejection runs in a frame hook. */
  invalidate();
  if (!box || box.isEmpty()) {
    vehicleFocus = null;
    controls.minDistance = 0;
    controls.maxDistance = Infinity;
    /* Sem conjunto, a caixa volta para a origem — é onde o cenário está. */
    _shadowFocus.set(0, 0, 0);
    setSeeThroughTarget(null);
    placeKeyLight();
    renderer.shadowMap.needsUpdate = true;
    return;
  }
  const c = box.getCenter(new THREE.Vector3());
  /* Só X e Z. A altura fica no CHÃO de propósito: o alcance vertical do
     `near/far` foi dimensionado para uma luz a 26 m de um alvo no nível do
     solo, e subir o alvo para o meio da carroceria (~2 m) empurraria o plano
     próximo para dentro do próprio caminhão sob sol alto. */
  _shadowFocus.set(c.x, 0, c.z);
  placeKeyLight();
  renderer.shadowMap.needsUpdate = true;
  const r = Math.max(2, box.getSize(new THREE.Vector3()).length() / 2);
  /* Quem atravessa protege ESTE volume — mesma caixa, mesmo instante em que a
     caixa de sombra é recentrada. A CAIXA, e não centro-e-raio: o teste é de
     silhueta em tela, e uma esfera de 9,5 m em volta de um conjunto de 19 × 2,6
     × 4 m tem oito metros de ar em cima do teto e dos lados — quem julgasse pela
     esfera apagaria o galpão que passa ACIMA do caminhão. Ver seethrough.ts. */
  setSeeThroughTarget(box);
  /* A MIRA, e ela NÃO é `c`. frameAll() mira a 48 % da altura da caixa
     (CARD_TARGET_H) e não no centro geométrico — mirar no meio inclina a câmera
     para baixo e devolve por outro caminho a vista de cima que VIEW_DIR tirou
     (ver view.ts). Guardar aqui é o que permite ao giro de apresentação
     RECENTRAR exatamente onde "enquadrar" recentraria, em vez de inventar um
     segundo centro que discordaria dele em alguns centímetros.
     Medida na caixa CRUA: `box` não foi tocado — o `FOCUS_SKIN` abaixo é
     aplicado num clone. */
  const aim = c.clone();
  aim.y = box.min.y + (box.max.y - box.min.y) * CARD_TARGET_H;
  vehicleFocus = { c, box: box.clone().expandByScalar(FOCUS_SKIN), r, aim };
  controls.minDistance = r * FOCUS_MIN_F;
  /* O limite de afastamento nunca pode ficar aquém da própria pose de abertura,
     senão o clamp do OrbitControls desfaz frameAll() no primeiro quadro. Num
     viewport estreito o meio-ângulo apertado é o HORIZONTAL, e a distância de
     abertura passa de 6 r — por isso o piso sai de openingDistance() (que lê o
     aspecto corrente) e não de mais uma constante. */
  controls.maxDistance = Math.max(r * FOCUS_MAX_F, openingDistance(r) * OPEN_ZOOM_OUT);
  if (vehicleFocusHooked) return;
  vehicleFocusHooked = true;
  frameHooks.push(() => {
    const f = vehicleFocus;
    if (!f) return;
    _fv.subVectors(controls.target, f.c);
    const lim = f.r * FOCUS_PAN_F;
    if (_fv.lengthSq() > lim * lim) {
      _fv.setLength(lim);
      controls.target.copy(f.c).add(_fv);
    }
    const p = camera.position, b = f.box;
    if (p.x > b.min.x && p.x < b.max.x && p.y > b.min.y && p.y < b.max.y &&
        p.z > b.min.z && p.z < b.max.z) {
      const outX = Math.min(p.x - b.min.x, b.max.x - p.x);
      const outZ = Math.min(p.z - b.min.z, b.max.z - p.z);
      /* IMEDIATA, e não amortecida. Uma versão desta função empurrava a câmera
         uma fração do caminho por quadro, para a saída não ser um salto — e o
         resultado foi a câmera ENTRAR no caminhão, que é a única coisa que esta
         guarda existe para impedir. Duas razões, e as duas condenam qualquer
         suavização aqui:

         * ela é o ÚNICO obstáculo entre a órbita e o interior da carroceria.
           `minDistance` é 0,40 r — uns 3,8 m — medidos a partir da MIRA, que
           fica no meio de um conjunto de 19 m: dar zoom até o limite já põe o
           olho dentro da cabine, e é esta expulsão que o tira de lá. Amortecida,
           passam-se uns dez quadros lá dentro a cada vez;
         * ela DISPUTA com o OrbitControls. Cada quadro ele recompõe a órbita a
           partir da posição que encontrar, então um empurrão de 28% por quadro é
           simplesmente refeito pelo arrasto do usuário no quadro seguinte —
           arrastando contra a lataria dá para ficar dentro dela indefinidamente.

         O desvio das construções (setCameraObstacles, abaixo) pode ser suave
         porque é uma preferência de enquadramento; isto é uma parede. */
      if (outX <= outZ) p.x = (p.x - b.min.x < b.max.x - p.x) ? b.min.x : b.max.x;
      else p.z = (p.z - b.min.z < b.max.z - p.z) ? b.min.z : b.max.z;
    }
  });
}

/* ---------------- o GIRO DE APRESENTAÇÃO ----------------
   O botão "girar" existia como uma linha em ui/chrome.ts:

       controls.autoRotate = !controls.autoRotate;

   e é essa linha que produz os três defeitos relatados — "nem sempre está no
   centro", "as duas pontas nem sempre dentro da cena". Nenhum deles é do
   OrbitControls; os três são consequências de ligar o giro sem MUDAR DE MODO.

   1. ELE ORBITA EM VOLTA DA MIRA, E A MIRA ANDA. `FOCUS_PAN_F` (0,28 · r) é uma
      coleira, não uma âncora: dentro dela o botão direito arrasta a mira uns
      três metros para o lado. Um giro em torno de uma mira deslocada é uma
      órbita excêntrica — o caminhão varre a tela em vez de girar no lugar. Por
      isso ligar o giro RECENTRA a mira e CONGELA o pan enquanto ele roda.

   2. O ZOOM PRÓXIMO CORTA AS PONTAS. `minDistance` é 0,40 · r (~3,7 m num
      conjunto de 19 m), e é assim de propósito: é o que permite chegar perto
      para conferir a arte. Só que a 3,7 m um conjunto de 19 m não cabe em
      nenhum azimute, e girar de lá varre nariz e traseira para fora do quadro.
      Então o giro impõe um PISO de distância — e o piso não é um número novo, é
      `openingDistance(f.r)`, exatamente a mesma conta que frameAll() usa para
      pousar a câmera. Consequência: quem não deu zoom não vê nada se mexer, e
      quem deu vê a câmera recuar até o enquadramento de abertura.
      A ESFERA É INDEPENDENTE DE ORIENTAÇÃO, então esse piso vale nos 360°: não
      existe azimute em que o conjunto caiba pior do que na conta.

   3. AS DUAS CORREÇÕES SÃO SUAVIZADAS, e aqui a suavização é permitida — ao
      contrário da expulsão da carroceria lá em cima, que tem de ser imediata.
      A diferença é o que cada uma é: aquela é uma PAREDE (a câmera não pode
      estar dentro do baú, nem por um quadro), esta é uma PREFERÊNCIA DE
      ENQUADRAMENTO. Um salto de três metros ao apertar "girar" leria como
      defeito.

   POR QUE `controls.update(dt)` PASSOU A RECEBER O dt (ver o laço lá embaixo):
   sem argumento, o OrbitControls avança o giro por QUADRO
   (`2π/60/60 · autoRotateSpeed`), não por segundo — a 30 fps o caminhão gira
   pela metade da velocidade. Com o dt, o giro passa a ser função do RELÓGIO. A
   60 fps nada muda (as duas fórmulas dão o mesmo), então isto não é um ajuste
   de gosto: é a correção que torna `turntablePeriod()` uma promessa em vez de
   uma estimativa — e é dela que a gravação de "uma volta completa" depende. */

/** Velocidade de fábrica. Período = 60/velocidade → 50 s por volta. */
const TURN_SPEED_DEFAULT = 1.2;
/** Constante de tempo da recentragem e do recuo, em segundos. */
const TURN_EASE_TAU = 0.20;
/** Abaixo disto a correção acabou; sem o encaixe ela persegue o alvo para sempre. */
const TURN_SNAP = 1e-4;

const _turnV = new THREE.Vector3();
let turnPanWas = true;
let turnDampWas = true;
let turnHooked = false;
/** Radianos acumulados desde que o giro foi ligado. Com SINAL. */
let turnTravel = 0;
let turnLastAz = 0;

export interface TurntableOptions {
  /**
   * `autoRotateSpeed` do three. Negativo inverte o sentido. Período em segundos
   * = 60 / |velocidade|. Ausente = mantém a atual.
   */
  speed?: number;
  /**
   * `false` desliga o amortecimento enquanto o giro roda.
   *
   * Serve a UM caso e só a ele: uma gravação de volta completa. Com damping, o
   * início e o fim do giro são acelerados e desacelerados, então o primeiro e o
   * último quadro não coincidem e o vídeo não fecha o laço. Fora de uma
   * gravação o damping FICA — ele é o que faz o arrasto manual ter inércia, e
   * tirá-lo mudaria o tato de toda a órbita.
   */
  damping?: boolean;
}

function turntableFrame(dt: number) {
  if (!controls.autoRotate) return;

  /* O quanto já girou, medido no ÂNGULO e não no relógio. Um contador de tempo
     mentiria em toda aba que perde quadros — e é justamente numa gravação, com
     a GPU ocupada, que perder quadros é comum. O desembrulho de ±π é obrigatório:
     `getAzimuthalAngle()` volta em (-π, π] e a passagem pela descontinuidade
     somaria uma volta inteira de uma vez. */
  const az = controls.getAzimuthalAngle();
  let d = az - turnLastAz;
  if (d > Math.PI) d -= 2 * Math.PI;
  else if (d < -Math.PI) d += 2 * Math.PI;
  turnTravel += d;
  turnLastAz = az;

  const f = vehicleFocus;
  if (!f) return;
  /* Suavização exponencial com o dt de verdade: a correção anda igual a 30 e a
     60 fps, ao contrário de um `lerp(0.1)` por quadro. */
  const k = 1 - Math.exp(-dt / TURN_EASE_TAU);

  if (!controls.target.equals(f.aim)) {
    controls.target.lerp(f.aim, k);
    if (controls.target.distanceToSquared(f.aim) < TURN_SNAP) controls.target.copy(f.aim);
  }

  const floor = openingDistance(f.r);
  _turnV.subVectors(camera.position, controls.target);
  const dist = _turnV.length();
  if (dist > 1e-6 && dist < floor - TURN_SNAP) {
    _turnV.setLength(dist + (floor - dist) * k);
    camera.position.copy(controls.target).add(_turnV);
  }
}

/**
 * Liga ou desliga o giro de apresentação.
 *
 * É o ÚNICO dono de `controls.autoRotate`. Escrever a flag direto ainda
 * funciona — `wantsFrame()` a lê e o laço passa a desenhar —, mas pula a
 * recentragem, o congelamento do pan e o piso de distância, ou seja devolve
 * exatamente os três defeitos que esta função existe para consertar.
 *
 * Idempotente: chamar com o mesmo estado só aplica a velocidade.
 */
export function setTurntable(on: boolean, opts: TurntableOptions = {}) {
  const speed = opts.speed;
  if (typeof speed === 'number' && Number.isFinite(speed) && speed !== 0) {
    controls.autoRotateSpeed = speed;
  } else if (!controls.autoRotateSpeed) {
    controls.autoRotateSpeed = TURN_SPEED_DEFAULT;
  }

  const want = !!on;
  if (want === controls.autoRotate) { invalidate(); return; }
  controls.autoRotate = want;

  if (want) {
    /* Guardados para serem DEVOLVIDOS, e não presumidos: o pan pode já estar
       desligado por outro motivo no dia em que houver um, e restaurar para um
       `true` cravado religaria algo que ninguém pediu. */
    turnPanWas = controls.enablePan;
    turnDampWas = controls.enableDamping;
    controls.enablePan = false;
    if (opts.damping === false) controls.enableDamping = false;
    turnTravel = 0;
    turnLastAz = controls.getAzimuthalAngle();
    if (!turnHooked) { turnHooked = true; frameHooks.push(turntableFrame); }
  } else {
    controls.enablePan = turnPanWas;
    controls.enableDamping = turnDampWas;
  }
  invalidate();
}

export const isTurntable = () => controls.autoRotate;

/** Radianos girados desde que o giro foi ligado. Com sinal; 2π é uma volta. */
export const turntableTravel = () => turnTravel;

/** Segundos por volta na velocidade atual. `Infinity` com o giro parado. */
export const turntablePeriod = () =>
  (controls.autoRotateSpeed ? 60 / Math.abs(controls.autoRotateSpeed) : Infinity);

/**
 * Ajusta a velocidade PELO PERÍODO — que é como um vídeo pensa ("uma volta em
 * 12 segundos"), e não como o three pensa. O sentido é preservado.
 */
export function setTurntablePeriod(seconds: number) {
  const s = Number(seconds);
  if (!Number.isFinite(s) || s <= 0) return;
  const sign = controls.autoRotateSpeed < 0 ? -1 : 1;
  controls.autoRotateSpeed = sign * (60 / s);
}

/* ---------------- desvio das construções ----------------
   O PROBLEMA. Acima há três limites: a caixa do interior (setInteriorBounds), a
   coleira da mira e a expulsão da carroceria. NENHUM DELES SABE ONDE ESTÃO OS
   PRÉDIOS — a caixa do interior é o PERÍMETRO do pátio, e dentro dele há
   galpões, tanques e contêineres que a órbita atravessa como se fossem ar.

   Isso não incomodava enquanto a órbita era curta. O set foi autorado contra
   ela: "os galpões de doca vêm de x 32 para x 26 ... o limite é a órbita do
   estúdio, que com maxDistance 2,6 r chega a ~25 m do caminhão, então mais perto
   que isso é uma parede dentro da câmera" (environments.json, setNote). Com a
   lente de 30° a pose de abertura pousa em ~3,9 r e maxDistance virou
   openingDistance(r) * 1.35 — perto de 50 m num conjunto de 19 m. A órbita
   alcança o que o set supôs inalcançável.

   POR QUE O TESTE É DE TRIÂNGULO E NÃO DE CAIXA. Esta é a terceira versão, e as
   duas anteriores morreram na mesma pedra: usavam a caixa envolvente de cada
   malha. Neste set isso NÃO FUNCIONA, e a razão é a organização do .glb — as
   malhas são agrupadas por ATLAS DE MATERIAL, não por prédio (ver setNoteOld em
   environments.json: "Container = ferrugem", "MetalTrim = guarda-corpos,
   escadas, passarelas de tanques e vasos"). Uma malha é o conjunto de TODAS as
   peças daquele atlas espalhadas pelo pátio, e a caixa dela é o volume que as
   envolve, quase todo ar. Medido sobre a geometria de verdade, com célula de
   2 m:

       malha `Container` em x[22,6..51,8] z[9,7..44,2], 24 m de altura,
       a 22,6 m do caminhão — a caixa MAIS PRÓXIMA de todas —
       tem 0,115 de ocupação real. 88,5% dela é pátio vazio.

   O efeito na tela era exatamente a queixa: a câmera parada em pátio aberto,
   com o prédio à VISTA e não na frente, e a correção disparando. Medido em 2000
   direções: a caixa acusava obstrução em 38,8% delas, a geometria real em 14,0%
   — 34,2% de FALSO POSITIVO, mais de uma direção em três.

   Com raycast de triângulo o falso positivo deixa de existir por construção:
   quem responde é a superfície do tanque, não o ar em volta dele. O custo
   medido é 0,356 ms por raio contra os 201 mil triângulos do cenário inteiro,
   uma vez por quadro e só quando a câmera se move — cabe folgado no orçamento
   de um quadro.

   E A CORREÇÃO NÃO É A POSIÇÃO VERDADEIRA DA CÂMERA. O OrbitControls é o dono
   da órbita; escrever a posição corrigida de volta nele apagaria o afastamento
   que o usuário pediu e — pior — faria o arrasto DISPUTAR com a correção, que
   foi como a versão de expulsão travava a câmera. Então a posição verdadeira é
   guardada, a corrigida é escrita só para desenhar, e no topo do quadro seguinte
   a verdadeira volta ANTES de controls.update(), que assim nunca a vê.

   ---- QUARTA VERSÃO: O GATILHO SEMPRE ESTEVE CERTO. A RESPOSTA É QUE NÃO ----

   As três versões anteriores discutiram QUANDO desviar. Medido sobre o
   distrito-industrial de verdade — os 201.202 triângulos sólidos que
   collectSolids() entrega, 5.190 poses de órbita dentro da caixa do interior —
   o gatilho não é o problema:

     · a correção dispara em 7,7% da órbita alcançável;
     · nessas poses o caminhão está 100% tapado em 370 de 401, medido lançando
       60 raios da câmera para pontos espalhados na caixa do conjunto;
     · falso positivo de verdade (menos de 25% do caminhão tapado): 1 em 401.

   Ou seja: quando ela dispara, há mesmo um galpão na frente. O que estava errado
   é O QUE ELA FAZIA. Encolher a distância tirava 9,1 m na mediana e até 22 m de
   uma órbita de 36 a 49 m — quase metade do afastamento — e isso não é "desviar
   de um prédio", é reenquadrar o caminhão inteiro sem ninguém ter pedido. Era
   exatamente essa a queixa: "me dá um zoom in extremo".

   E A APROXIMAÇÃO NUNCA FOI NECESSÁRIA. Nas mesmas poses em que a correção
   dispara, SUBIR a câmera — mesmo azimute, MESMA DISTÂNCIA — limpa a linha de
   visada em 266 de 266, com 10° de subida na mediana, 22° no p90 e 30° no pior
   caso. Não existe uma só pose neste cenário em que encolher a órbita seja a
   única saída. (Girar também resolveria, com 12° na mediana, mas o azimute é o
   eixo que o usuário está arrastando: corrigir ali é disputar com a mão dele.
   A altura é o eixo livre.)

   Então a ordem inverteu. PRIMEIRO SOBE — ganha altura e olha por cima do
   telhado, que é o que uma câmera de cinema faz e o que preserva o
   enquadramento. Só se a subida bater no teto é que a distância encolhe, e agora
   limitada a CUT_MAX_F da órbita, para nunca mais virar um salto. */
const BLOCK_SKIN = 0.6;      // metros de folga entre a lente e a construção
const BLOCK_MIN_D = 1.0;     // metros — piso absoluto quando não há rig em foco

/* A SUBIDA, que agora é a resposta principal.
   RISE_STEP é o passo do rastreio quadro a quadro. RISE_MAX 32° cobre com folga
   o pior caso medido (30°); RISE_ELEV_MAX impede que a soma vire uma vista de
   cima — o enquadramento que VIEW_DIR (scene/view.ts) existe para evitar, e que
   não mostra a lataria. */
const RISE_STEP = 2.5;
const RISE_MAX = 32;
const RISE_ELEV_MAX = 62;
/* Quando a visada passa de livre para bloqueada, um passo por quadro levaria
   ~13 quadros só para DECIDIR a altura — 0,2 s raspando a parede. A transição é
   rara (só na quina do galpão), então ali vale pagar uma varredura grossa de uma
   vez; no regime permanente volta a ser um passo por quadro. */
const RISE_PROBE_STEPS = 6;
/* Assimétrico, e pelo mesmo motivo do recuo: a quina de um galpão é uma
   descontinuidade, então entrar tem de ser rápido; sair devagar, senão sair de
   trás do prédio devolve a câmera num pulo. */
const RISE_IN = 0.20;
const RISE_OUT = 0.45;
/* Ao APROXIMAR — que agora só acontece com a subida no teto. 0,12 s espalha a
   correção por ~7 quadros. */
const AVOID_IN = 0.12;
/* Ao DEVOLVER a distância: lento de propósito, mesma razão. */
const AVOID_OUT = 0.38;
/* TETO DA APROXIMAÇÃO, como fração da órbita. É o número que impede o "zoom in
   extremo" de voltar por qualquer caminho: acima de ~30% o usuário deixa de ler
   como ajuste e passa a ler como zoom. */
const CUT_MAX_F = 0.30;

let obstacles: THREE.Object3D[] = [];
const _rc = new THREE.Raycaster();

/**
 * Declara a geometria SÓLIDA do cenário — aquela que a câmera não pode
 * atravessar. Chamado por scene/set.ts a cada troca de cenário; `null` libera.
 *
 * São as malhas em si, e não caixas: ver o cabeçalho acima para por que a caixa
 * envolvente não serve neste set.
 */
/** Estado de quem atravessa e da mistura de céus, para o console e a bancada. */
export { getSeeThrough };
export { getSkyBlend };
/** Estado das luzes do veículo, para o console e para a bancada. */
export { getVehicleLights, getVehicleBeams, getRetroreflective, getHeadlightCover };
/** O derrame aditivo das lanternas. Ver vehicle/halo.ts. */
export { getLampHalos };

export function setCameraObstacles(_list: THREE.Object3D[] | null) {
  /* O DESVIO ESTÁ DESLIGADO, e esta linha é o interruptor.
     -------------------------------------------------------------------------
     A órbita não foge mais das construções: ela ATRAVESSA, e quem fica entre a
     lente e o veículo é dissolvido por `seethrough.ts`. Decisão do dono do
     produto, e ela tem uma razão de cenário além da de câmera — enquanto a
     câmera desviava, o cenário precisava ser autorado para não atrapalhar, que
     é a origem do vão de 130 m na fileira de postes deste set.

     A lista continua CHEGANDO (set.ts a monta e a passa) e o maquinário abaixo
     continua inteiro e testado; o que não acontece é ele ser alimentado, e com
     `obstacles` vazio `hitAlong()` devolve Infinity e `applyAvoidance()` é um
     no-op de duas comparações. Religar é trocar esta linha por
     `list && list.length ? list.slice() : []`.

     Nada aqui liga ou desliga o atravessar: quem sabe se o cenário tem o que
     dissolver é `seethrough.ts`, que monta a própria lista por MALHA e por
     ALTURA — este `list` é uma coleta por família de material, que é justamente
     o recorte que deixava a faixa da pista entrar. */
  obstacles = [];
  /* O recuo E a subida suavizados eram medidos contra o cenário que saiu. */
  avoidCut = NaN; cutTarget = 0;
  riseNow = NaN; riseTarget = 0; wasBlocked = false;
  releaseAvoidance();
  _rayFrom.set(NaN, NaN, NaN);
  _rayTo.set(NaN, NaN, NaN);
  invalidate();
}

/**
 * Distância em que o raio SAI da caixa do veículo, partindo da mira (que está
 * dentro dela). É o piso do recuo: abaixo disto a câmera está DENTRO da
 * carroceria.
 *
 * O piso não pode ser `controls.minDistance`: minDistance é o raio de uma
 * ESFERA em torno da mira — 0,40 r, uns 4 m num conjunto de 19 m — e a mira
 * fica no MEIO do veículo, então 4 m ao longo do comprimento ainda é a cabine
 * por dentro. Contra uma caixa a conta certa é a saída do raio.
 */
function bodyExitDistance(dx: number, dy: number, dz: number) {
  const f = vehicleFocus;
  if (!f) return 0;
  const b = f.box, o = controls.target;
  let t = Infinity;
  if (dx > 1e-6) t = Math.min(t, (b.max.x - o.x) / dx);
  else if (dx < -1e-6) t = Math.min(t, (b.min.x - o.x) / dx);
  if (dy > 1e-6) t = Math.min(t, (b.max.y - o.y) / dy);
  else if (dy < -1e-6) t = Math.min(t, (b.min.y - o.y) / dy);
  if (dz > 1e-6) t = Math.min(t, (b.max.z - o.z) / dz);
  else if (dz < -1e-6) t = Math.min(t, (b.min.z - o.z) / dz);
  return Number.isFinite(t) && t > 0 ? t : 0;
}

let avoidApplied = false;
let avoidCut = NaN;                           // recuo suavizado, em metros
let cutTarget = 0;                            // recuo que o rastreio quer, em metros
let riseNow = NaN;                            // subida suavizada, em graus
let riseTarget = 0;                           // subida que o rastreio quer, em graus
let wasBlocked = false;                       // para detectar a TRANSIÇÃO livre→tapado
const _avoidTrue = new THREE.Vector3();       // onde o OrbitControls pôs a câmera
const _avoidShown = new THREE.Vector3();      // o que foi escrito para desenhar
const _avoidDir = new THREE.Vector3();
const _riseDir = new THREE.Vector3();         // _avoidDir girada para cima
const _riseAxis = new THREE.Vector3();
const _UP = new THREE.Vector3(0, 1, 0);
/* O raycast é a única parte cara disto, e uma cena parada (ou girando só a
   chuva) não muda nem a mira nem a câmera. Guardar a POSE em vez do resultado de
   um raio só é o que permite lançar vários (a busca da altura) sem pagar por
   eles num quadro em que ninguém mexeu na câmera. */
const _rayFrom = new THREE.Vector3(NaN, NaN, NaN);
const _rayTo = new THREE.Vector3(NaN, NaN, NaN);

/** Devolve a posição verdadeira, se a correção deste quadro ainda estiver de pé. */
function releaseAvoidance() {
  if (!avoidApplied) return;
  avoidApplied = false;
  /* SÓ desfaz se a câmera continuar exatamente onde applyAvoidance() a deixou.
     No intervalo entre um quadro e outro qualquer um pode reposicioná-la —
     frameAll() no botão "enquadrar", capture.ts, o console — e restaurar por
     cima disso desfaria a pose de quem mandou, um quadro depois. */
  if (camera.position.distanceToSquared(_avoidShown) < 1e-8) {
    camera.position.copy(_avoidTrue);
  }
}

/**
 * `_avoidDir` girada `deg` para CIMA, em torno do eixo horizontal perpendicular
 * a ela. Resultado em `_riseDir`.
 *
 * @returns false quando a direção já está vertical demais para ter esse eixo —
 *   aí não existe "subir" e o chamador fica com a direção original.
 */
function raisedDir(deg: number) {
  _riseDir.copy(_avoidDir);
  if (deg <= 1e-4) return true;
  /* cross(dir, up) e não cross(up, dir): com dir = +Z o primeiro dá -X, e girar
     +Z em torno de -X por um ângulo positivo leva a direção para CIMA. Trocar a
     ordem desce a câmera para dentro do chão, silenciosamente. */
  _riseAxis.crossVectors(_avoidDir, _UP);
  const l = _riseAxis.length();
  if (l < 1e-4) return false;
  _riseAxis.divideScalar(l);
  _riseDir.applyAxisAngle(_riseAxis, deg * Math.PI / 180).normalize();
  return true;
}

/** Primeira superfície sólida entre a mira e `dist` na direção `dir`, ou Infinity. */
function hitAlong(dir: THREE.Vector3, dist: number) {
  if (!obstacles.length) return Infinity;
  _rc.set(controls.target, dir);
  _rc.near = 0;
  /* Além da câmera não interessa: encurtar o alcance descarta cedo toda malha
     mais distante que ela, que é a maior economia disponível aqui. */
  _rc.far = dist;
  const hits = _rc.intersectObjects(obstacles, false);
  return hits.length ? hits[0].distance : Infinity;
}

/**
 * Decide QUANTO subir e, só no que sobrar, quanto aproximar. Escreve
 * `riseTarget` / `cutTarget`; a suavização é de quem chama.
 *
 * Custo em raios: 2 no regime livre, ~3 no regime tapado, até 8 no quadro da
 * transição. A 0,356 ms por raio isso é 0,7 ms num quadro comum — a mesma ordem
 * do raio único da versão anterior, porque o caro aqui nunca foi a quantidade de
 * raios e sim rodá-los num quadro em que nada mexeu (ver o cache da pose).
 */
function trackAvoidance(trueDist: number, floor: number) {
  if (trueDist <= floor) { riseTarget = 0; cutTarget = 0; wasBlocked = false; return; }

  const elev = Math.asin(THREE.MathUtils.clamp(_avoidDir.y, -1, 1)) * 180 / Math.PI;
  /* TETO DA SUBIDA. Além de RISE_MAX e da vista-de-cima, a caixa do interior
     também limita: subir levanta a câmera, e passar de `maxY` faria o gancho de
     confinamento puxá-la de volta no quadro seguinte — a correção brigaria com o
     clamp e a câmera tremeria na altura. Resolver aqui, no ângulo, é exato: o
     raio horizontal só ENCOLHE ao subir, então x/z nunca podem ser violados. */
  let elevCeil = RISE_ELEV_MAX;
  if (interiorBox) {
    const room = (interiorBox.maxY - controls.target.y) / trueDist;
    elevCeil = Math.min(elevCeil,
      Math.asin(THREE.MathUtils.clamp(room, -1, 1)) * 180 / Math.PI);
  }
  const ceiling = Math.max(0, Math.min(RISE_MAX, elevCeil - elev));

  /** distância do primeiro sólido com a câmera subida `deg`; Infinity = livre */
  const probe = (deg: number) => (raisedDir(deg) ? hitAlong(_riseDir, trueDist) : 0);

  let want = Math.min(riseTarget, ceiling);
  let hit = probe(want);

  if (hit >= trueDist) {
    /* Livre onde estamos. Tenta DEVOLVER um passo de altura — é o que faz a
       câmera descer sozinha depois que o galpão sai da frente, em vez de ficar
       presa lá em cima pelo resto da sessão. */
    if (want > 0 && probe(Math.max(0, want - RISE_STEP)) >= trueDist) {
      want = Math.max(0, want - RISE_STEP);
    }
    riseTarget = want;
    cutTarget = 0;
    wasBlocked = false;
    return;
  }

  if (!wasBlocked) {
    /* TRANSIÇÃO: varredura grossa, uma vez, para achar a altura de uma tacada. */
    want = ceiling;
    for (let i = 1; i <= RISE_PROBE_STEPS; i++) {
      const deg = ceiling * i / RISE_PROBE_STEPS;
      if (probe(deg) >= trueDist) { want = deg; break; }
    }
  } else {
    want = Math.min(ceiling, want + RISE_STEP);
  }
  wasBlocked = true;
  riseTarget = want;

  /* O que a subida não resolveu — e só isso — vira aproximação, com teto. */
  hit = probe(want);
  if (hit >= trueDist) { cutTarget = 0; return; }
  const allowed = Math.min(trueDist, Math.max(floor, hit - BLOCK_SKIN));
  cutTarget = Math.min(trueDist - allowed, trueDist * CUT_MAX_F);
}

/* ---------------- suspender o desvio ----------------
   NUMA VOLTA COMPLETA O DESVIO É UM ARTEFATO, e fora dela não é. `distrito-
   industrial` tem galpões espalhados pelo pátio; numa órbita de 360° a câmera
   passa por trás de vários, e a correção sobe e aproxima a cada um. Parado ou
   arrastando à mão isso é uma melhoria de enquadramento — evita a parede na
   frente do caminhão. Numa volta gravada vira uma oscilação de altura com o
   período dos prédios, que é a coisa mais visível de um vídeo de 20 segundos.

   NÃO É `setCameraObstacles(null)`, e isto é deliberado. A lista de obstáculos é
   de scene/set.ts, que a escreve a cada troca de cenário; zerá-la daqui
   obrigaria a gravação a guardar e devolver um estado de OUTRO módulo — e a
   errar quando o cenário trocasse no meio (a devolução restauraria a lista do
   cenário anterior). Uma suspensão é um flag nosso sobre um estado que continua
   sendo de quem sempre foi. */
let avoidSuspended = false;

/**
 * Pausa o desvio das construções sem tocar na lista de obstáculos.
 *
 * Sempre em par, com o `false` num `finally`. Soltar força um novo raio no
 * quadro seguinte: a câmera pode ter dado a volta inteira e parado exatamente
 * onde estava, e sem isto o teste de "nada se moveu" concluiria que a correção
 * já está certa — quando ela acabou de ser zerada pela suspensão.
 */
export function suspendAvoidance(on: boolean) {
  avoidSuspended = !!on;
  if (!avoidSuspended) { _rayFrom.set(NaN, NaN, NaN); _rayTo.set(NaN, NaN, NaN); }
  invalidate();
}

/**
 * Encolhe a distância da câmera até caber antes da primeira construção.
 * Roda DEPOIS dos frameHooks (que são os donos da posição verdadeira) e a
 * correção FICA APLICADA até o topo do quadro seguinte — é isso que faz um
 * `renderer.render()` de fora do laço, como o de capture.ts, sair igual ao que
 * estava na tela.
 */
function applyAvoidance(dt: number) {
  const trueDist = camera.position.distanceTo(controls.target);
  if (trueDist < 1e-3) return;
  _avoidDir.subVectors(camera.position, controls.target).divideScalar(trueDist);

  /* O PISO DO RECUO: nenhuma construção justifica pôr a câmera dentro da
     carroceria. Sai da saída do raio na caixa do veículo, com a mesma folga que
     a expulsão usa; minDistance entra como piso esférico de reserva. */
  const floor = Math.max(
    bodyExitDistance(_avoidDir.x, _avoidDir.y, _avoidDir.z) + BLOCK_SKIN,
    controls.minDistance, BLOCK_MIN_D);

  /* SUSPENSO: os alvos vão a zero e a suavização abaixo — que continua rodando —
     desfaz a correção com a mesma constante de tempo com que a aplicou. É por
     isso que suspender não dá salto, e é por isso que a suspensão age AQUI e não
     desligando `applyAvoidance` inteiro: sair pela porta de cima deixaria a
     correção CONGELADA no valor em que estava. */
  if (avoidSuspended) {
    cutTarget = 0; riseTarget = 0; wasBlocked = false;
  } else if (!_rayFrom.equals(controls.target) || !_rayTo.equals(camera.position)) {
    /* Nada se moveu ⇒ os ALVOS são os mesmos e nenhum raio precisa ser lançado; a
       suavização abaixo continua andando com o relógio. É o que torna o custo do
       raycast proporcional ao MOVIMENTO e não ao tempo: uma cena parada com a
       chuva ligada continua desenhando quadros e não paga nada por eles. */
    _rayFrom.copy(controls.target);
    _rayTo.copy(camera.position);
    trackAvoidance(trueDist, floor);
  }

  /* O QUE É SUAVIZADO SÃO AS CORREÇÕES, NÃO A POSE. Amortecer a distância em si
     faz a câmera PERSEGUIR o próprio zoom: com a órbita livre a distância
     desejada muda a cada volta da roda e a suavizada chega 0,38 s depois, então
     afastar viraria um elástico mesmo sem construção nenhuma por perto.
     Amortecendo o RECUO e a SUBIDA (ambos zero com o caminho livre) a órbita
     livre passa exatamente como se isto não existisse. */
  if (!Number.isFinite(riseNow)) riseNow = riseTarget;
  else {
    const tau = riseTarget > riseNow ? RISE_IN : RISE_OUT;
    riseNow += (riseTarget - riseNow) * (1 - Math.exp(-Math.max(dt, 1e-4) / tau));
  }
  if (!Number.isFinite(avoidCut)) avoidCut = cutTarget;
  else {
    const tau = cutTarget > avoidCut ? AVOID_IN : AVOID_OUT;
    avoidCut += (cutTarget - avoidCut) * (1 - Math.exp(-Math.max(dt, 1e-4) / tau));
  }
  if (avoidCut < 0) avoidCut = 0;
  const maxCut = trueDist - floor;
  if (avoidCut > maxCut) avoidCut = Math.max(0, maxCut);
  if (riseNow < 0) riseNow = 0;

  /* ANTES do retorno curto: enquanto a suavização não assentou há movimento na
     tela que nenhuma outra condição de wantsFrame() enxerga — a órbita não
     mudou, o rig não mudou. */
  if (Math.abs(cutTarget - avoidCut) > 0.01 || Math.abs(riseTarget - riseNow) > 0.05) {
    invalidate();
  }

  if (avoidCut < 0.01 && riseNow < 0.05) return;   // livre, ou a um triz disso
  _avoidTrue.copy(camera.position);
  raisedDir(riseNow);
  camera.position.copy(controls.target).addScaledVector(_riseDir, trueDist - avoidCut);
  if (camera.position.y < CAM_MIN_Y) camera.position.y = CAM_MIN_Y;
  _avoidShown.copy(camera.position);
  avoidApplied = true;
}

/**
 * Hand scene.background / scene.environment over to a photoreal HDRI (or take
 * them back). This is the ONLY writer of the `externalEnv` flag; every place
 * that would otherwise assign those two properties checks it.
 *
 * @param {THREE.Texture|null} tex  PMREM'd equirect for scene.environment
 * @param {{background?: THREE.Texture, rotation?: number,
 *          blurriness?: number, intensity?: number}} [opts]
 *        `background` defaults to `tex` (see environment.ts for why binding the
 *        PMREM to both is the cheap option). `rotation` is radians about +Y and
 *        is applied to BOTH scene.backgroundRotation and
 *        scene.environmentRotation so what you see and what the paint reflects
 *        stay in register.
 *
 * The texture belongs to the caller: this module never disposes it.
 */
export function setExternalEnvironment(
  tex: THREE.Texture | null,
  opts?: {
    background?: THREE.Texture; rotation?: number;
    blurriness?: number; intensity?: number;
  },
) {
  const o = opts || {};
  const num = (v: number | undefined, d: number) => (Number.isFinite(+v!) ? +v! : d);

  externalEnv = tex || null;
  externalBg = externalEnv ? (o.background || externalEnv) : null;
  extEnvIntensity = externalEnv ? Math.max(0, num(o.intensity, 1)) : 1;

  if (externalEnv) {
    scene.environment = externalEnv;
    scene.background = externalBg;
    const rot = num(o.rotation, 0);
    /* r163+ rotates the map at sampling time — no texture re-encoding, no
       second copy, and it can be changed per frame if we ever want to. */
    scene.environmentRotation.set(0, rot, 0);
    scene.backgroundRotation.set(0, rot, 0);
    /* backgroundBlurriness only does anything for a CubeUV (PMREM) texture:
       the raw-equirect path never reaches the ENVMAP_TYPE_CUBE_UV branch of
       three's backgroundCube shader. */
    scene.backgroundBlurriness = THREE.MathUtils.clamp(num(o.blurriness, 0), 0, 1);
  } else {
    scene.environmentRotation.set(0, 0, 0);
    scene.backgroundRotation.set(0, 0, 0);
    scene.backgroundBlurriness = 0;
    scene.backgroundIntensity = 1;
    scene.background = bgColor;                  // hand the Color instance back
    if (rigCur) refreshEnvironment(rigCur, true);   // rebuild the procedural IBL
    else scene.environment = null;
  }
  /* Re-drive the guarded values (intensities, background) from the live rig
     right now — applyRig() is otherwise only called during a tween. */
  if (rigCur) applyRig(rigCur);
  else invalidate();          // no rig yet: applyRig() did not cover us
}

/**
 * Environment-level exposure multiplier. Composes with the preset's
 * `rig.exposure` rather than replacing it, so switching scene does not flatten
 * the difference between Ensolarado and Chuvoso.
 * @param {number} v
 */
export function setExposureBase(v: number) {
  const n = +v;
  exposureBase = THREE.MathUtils.clamp(Number.isFinite(n) ? n : 1, 0.05, 8);
  if (rigCur) renderer.toneMappingExposure = Math.max(0.05, rigCur.exposure * exposureBase);
  invalidate();
}




/* Close the lamp seam: lamps.ts calls this after setLamps()/setLampModel() so a
   unit it just parked or re-fitted picks up the current rig pose immediately
   instead of staying lit until the next preset change. */
setLampRigRefresh(() => { if (rigCur) applyRig(rigCur); });
/* E o mesmo para as LUZES DO VEÍCULO: redimensionar o implemento move as duas
   faces de que a cor de cada lanterna depende, e `TrailerRig.set()` não passa por
   applyRig() nenhum. Sem este gatilho a carreta alongada ficaria com as lanternas
   traseiras âmbar até a próxima mudança de hora. Mesmo padrão de lamps.ts, pela
   mesma razão: quem escreve é applyRig(), e applyRig() só roda em tween. */
setVehicleLightsRigRefresh(() => { if (rigCur) applyRig(rigCur); });

/* The persisted blob, as WRITTEN — nothing here is trusted; restore() validates
   and clamps every field. Widened where a hand edit could plausibly land
   (`hour` as a string), which is what the validators already handle. */
export interface SavedScene {
  preset?: string;
  timeOfDay?: string;
  hour?: number | string | null;
  az?: number | string | null;
  el?: number | string | null;
  brightness?: number | string | null;
  azManual?: boolean;
  elManual?: boolean;
  /* Ausentes num blob v5, e é assim que tem de ser: ver a nota de "a chave NÃO
     sobe para v6" em LIGHT_DEFAULTS. */
  backdrop?: string;
  fill?: number | string | null;
  rim?: number | string | null;
  softness?: number | string | null;
  temp?: number | string | null;
}

/** O estado da luz como ele seria GRAVADO agora. */
export const sceneStateSnapshot = (): SavedScene => ({ ...sceneState });

/**
 * Escreve um blob de luz sobre `sceneState`, validando e limitando CADA campo.
 *
 * UM LEITOR, DOIS CHAMADORES, e é essa a razão de esta função existir em vez de
 * o corpo abaixo continuar dentro da IIFE de boot: o segundo chamador é o
 * arquivo de projeto (`project/document.ts`), e um projeto aberto tem de
 * atravessar exatamente a mesma validação que um blob de `localStorage` — senão
 * são duas definições do que "uma cena válida" quer dizer, e a que não é
 * exercitada todo dia é a que fica errada. É a mesma disciplina que
 * `livery-doc.ts` aplica ao hidratador das telas de plotagem.
 *
 * @param opts.animate anima a transição (o boot não anima: não há de onde vir).
 * @param opts.persist grava de volta no `localStorage`. Falso no boot — reescrever
 *   no carregamento o que se acabou de ler não acrescenta nada —, verdadeiro
 *   quando quem escreveu foi um projeto, que É uma mudança de estado.
 */
export function restoreSceneState(
  saved: SavedScene | null | undefined,
  opts: { animate?: boolean; persist?: boolean } = {},
) {
  let s = saved;
  if (!s || typeof s !== 'object') s = {};
  /* Stale or hand-edited state must never throw: validate and clamp every
     field, or fall back to the default. */
  const num = (v: number | string | null | undefined, d: number, lo: number, hi: number) => {
    if (v === null || v === undefined || v === '') return d;
    const n = +v;
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  /* `s.preset!` only asserts the index is a string: an absent preset misses
     LIGHT_PRESETS exactly as an unknown one does, and both fall to the default. */
  sceneState.preset = LIGHT_PRESETS[s.preset!] ? s.preset! : LIGHT_DEFAULTS.preset;
  /* The clock is the authority and `timeOfDay` is derived from it, so a blob
     written before the clock existed migrates the only way round that works:
     its binary face picks the canonical hour, and setHourInternal() derives
     `timeOfDay` straight back out. */
  const legacy = s.hour === undefined || s.hour === null;
  setHourInternal(num(
    s.hour, s.timeOfDay === 'noite' ? TOD_HOUR.noite : TOD_HOUR.dia,
    HOUR_MIN, HOUR_MAX));
  /* A legacy blob's az/el carry no record of whether a user chose them or a
     preset default did, so they are not trusted and the clock re-derives both.
     Losing a hand-set sun angle once is the right trade against resurrecting a
     preset default under a model that no longer produces it — and az/el are one
     drag away in the HUD, whereas a light stuck at an angle nothing explains is
     the kind of state that gets reported as a rendering bug. */
  sceneState.azManual = !legacy && s.azManual === true;
  sceneState.elManual = !legacy && s.elManual === true;
  /* Teto 6 e não 2,5: a face de estúdio do HUD vai até 600 % (ver
     BRIGHT_MAX_STUDIO), e um limite de restauração menor que o alcance do
     controle silenciosamente rebaixaria a luz de quem gravou uma cena forte —
     um estado que volta diferente de como foi deixado, sem nada dizendo por quê. */
  sceneState.brightness = num(s.brightness, 1, 0.15, 6);
  /* Estúdio. `backdropOf()` já cai no padrão para um id desconhecido, então um
     blob v5 (que não tem o campo) e um blob com um fundo que foi renomeado
     seguem o mesmo caminho — que é o que "validar cada campo em separado"
     quer dizer. As faixas são as mesmas de STUDIO_RANGE, a fonte única. */
  sceneState.backdrop = backdropOf(s.backdrop).id;
  sceneState.fill = num(s.fill, 1, STUDIO_RANGE.fill[0], STUDIO_RANGE.fill[1]);
  sceneState.rim = num(s.rim, 1, STUDIO_RANGE.rim[0], STUDIO_RANGE.rim[1]);
  sceneState.softness = num(s.softness, 1, STUDIO_RANGE.softness[0], STUDIO_RANGE.softness[1]);
  sceneState.temp = num(s.temp, TEMP_NEUTRAL, TEMP_MIN, TEMP_MAX);
  syncSunToHour();
  if (sceneState.azManual) sceneState.az = num(s.az, sceneState.az, 0, 360);
  if (sceneState.elManual) sceneState.el = num(s.el, sceneState.el, 2, 85);
  beginTween(!!opts.animate);
  if (opts.persist) save();
  return sceneState;
}

(function restore() {
  let s: SavedScene | null = null;
  try { s = JSON.parse(localStorage.getItem(SCENE_KEY) as string); } catch (_) { /* ignore */ }
  restoreSceneState(s);
})();

/* ---------------- framing / resize / loop ---------------- */
/**
 * A pose da câmera AGORA, normalizada pelo tamanho do que está enquadrado.
 *
 * Existe para fechar o laço do enquadramento padrão. `frameAll()` posiciona a
 * câmera por três multiplicadores sobre a diagonal da caixa do conjunto, e
 * acertar esses três olhando uma captura de tela é adivinhação. Com isto o
 * caminho vira: gire até gostar, chame `__studio.lighting.getCameraPose()`, e
 * cole os números de volta em `frameAll()` — eles JÁ estão na unidade certa,
 * porque são divididos pela mesma diagonal que ele multiplica.
 *
 * `dist` e `elevationDeg` vão junto por serem o que se lê num print: a que
 * distância e de que altura. `azimuthDeg` é 0 no +Z (a frente da cabine).
 */
export function getCameraPose() {
  const box = new THREE.Box3();
  for (const g of scene.children) if (g.visible) box.expandByObject(g);
  const size = box.isEmpty() ? 1 : box.getSize(new THREE.Vector3()).length();
  const t = controls.target;
  const d = new THREE.Vector3().subVectors(camera.position, t);
  const flat = Math.hypot(d.x, d.z);
  return {
    /* Os três multiplicadores de frameAll(), prontos para colar. */
    fx: +(d.x / size).toFixed(4),
    fy: +(d.y / size).toFixed(4),
    fz: +(d.z / size).toFixed(4),
    dist: +d.length().toFixed(2),
    elevationDeg: +(Math.atan2(d.y, flat) * 180 / Math.PI).toFixed(1),
    azimuthDeg: +(Math.atan2(d.x, d.z) * 180 / Math.PI).toFixed(1),
    target: { x: +t.x.toFixed(2), y: +t.y.toFixed(2), z: +t.z.toFixed(2) },
    size: +size.toFixed(2),
    aspect: +camera.aspect.toFixed(3),
  };
}

/** Distância de abertura para uma esfera envolvente de raio `r`: `raio / sin` do
 *  meio-ângulo APERTADO — vertical num viewport deitado, horizontal num
 *  estreito. É a mesma conta de preview.ts, e existe como função porque dois
 *  lugares dependem do MESMO número: frameAll(), que pousa a câmera nele, e
 *  setVehicleFocus(), que precisa garantir que o limite de órbita comporta a
 *  pose — do contrário um desfaz o outro no primeiro quadro. */
function openingDistance(r: number) {
  const vHalf = camera.fov * Math.PI / 360;
  const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
  return r / Math.sin(Math.min(vHalf, hHalf));
}

/* VIEW_DIR ESTÁ NO EIXO DO VEÍCULO, E A CENA GIRA O VEÍCULO.
   ---------------------------------------------------------------------------
   `VIEW_DIR` é escrito no referencial do MODELO — "+Z é a frente" (ver
   view.ts), então o +X dele é o lado do MOTORISTA e o três-quartos que ele
   descreve é dianteiro. O card (ui/preview.ts) renderiza o veículo na origem,
   sem giro nenhum, e por isso o vê exatamente assim.

   O estúdio não: `RIG_PLACEMENT` (vehicle/models.ts) põe o conjunto 22 m
   adiante e VIRADO 180°, para ele apontar para a saída do pátio em vez do fundo
   dele. Somar VIEW_DIR ao centro em MUNDO, como se fazia aqui, ignora esse
   giro — e com yaw = π o mundo +X/+Z cai no -X/-Z do veículo, ou seja no lado
   do PASSAGEIRO e por trás. A cena abria espelhada em relação ao card que o
   usuário tinha acabado de clicar.

   Então a direção é levada para o referencial do conjunto antes de ser usada.
   Só o YAW: uma inclinação qualquer que o nó viesse a ter é da CARROCERIA, e
   herdar isso rodaria o horizonte. Com o conjunto na origem (yaw 0) a conta é a
   identidade, que é o comportamento antigo — nada muda no card nem em cena
   sem cenário. */
const _poseUp = new THREE.Vector3(0, 1, 0);
const _poseQ = new THREE.Quaternion();
const _poseE = new THREE.Euler();
const _poseYaw = new THREE.Quaternion();
const _poseP = new THREE.Vector3();
const _poseS = new THREE.Vector3();
const _poseDir = new THREE.Vector3();

/** VIEW_DIR do card, girado para o referencial em que o conjunto está posto. */
function openingDir(groups: THREE.Object3D[]) {
  _poseYaw.identity();
  for (const g of groups) {
    if (!g.visible) continue;
    /* frameAll() já chamou expandByObject() nestes nós, que atualiza a matriz de
       mundo — mas openingDir() é chamada por quem quiser, e uma matriz velha aqui
       devolveria o lado errado sem qualquer sintoma. */
    g.updateWorldMatrix(true, false);
    g.matrixWorld.decompose(_poseP, _poseQ, _poseS);
    _poseE.setFromQuaternion(_poseQ, 'YXZ');
    _poseYaw.setFromAxisAngle(_poseUp, _poseE.y);
    break;
  }
  return _poseDir.copy(CARD_VIEW_DIR).applyQuaternion(_poseYaw);
}

/* A ABERTURA DO ESTÚDIO É A POSE DO CARD.
   VIEW_DIR, FOV e TARGET_H vêm de ui/preview.ts — o mesmo três-quartos pela
   frente, a mesma elevação de ~7° e a mesma mira a 48% da altura da caixa. O
   card é o que o usuário clicou; abrir noutro ângulo faz parecer que veio parar
   noutro veículo.
   A distância sai da ESFERA que envolve a caixa, e não de multiplicadores sobre
   a diagonal: é a mesma conta de preview.ts (`raio / sin(meio-fov)`), a única
   que garante enquadrar o conjunto inteiro venha ele cavalo sozinho ou com
   implemento. O que preview.ts tem a mais — calibrate(), que mede a silhueta em
   pixels e reaproxima — fica de fora de propósito: aqui a moldura é o viewport
   do usuário, que muda de forma, e uma folga em volta é o que deixa girar sem
   raspar o veículo na borda no primeiro arrasto.
   O AJUSTE PELO ASPECTO some junto com o `k` que existia aqui: a conta antiga
   corrigia a distância por um palpite (1.35/aspect); esta pergunta qual dos dois
   meios-ângulos — vertical ou horizontal — é o apertado, e usa ele. Num viewport
   deitado quem limita é a altura; num estreito, a largura. */
export function frameAll(groups: THREE.Object3D[]) {
  const box = new THREE.Box3();
  for (const g of groups) if (g.visible) box.expandByObject(g);
  if (box.isEmpty()) return;
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const target = box.getCenter(new THREE.Vector3());
  target.y = box.min.y + (box.max.y - box.min.y) * CARD_TARGET_H;
  controls.target.copy(target);

  const dist = openingDistance(sphere.radius);

  camera.position.copy(target).addScaledVector(openingDir(groups), dist);
  if (camera.position.y < CAM_MIN_Y) camera.position.y = CAM_MIN_Y;
  /* A correção suavizada é sobre a órbita ANTERIOR. Sem zerá-la, uma pose de
     abertura ampla nasceria encolhida (e agora também LEVANTADA) e iria se
     assentando ao longo do AVOID_OUT/RISE_OUT — que são lentos de propósito, e
     aqui apareceriam como a cena "respirando" ao carregar ou a cada clique em
     enquadrar. */
  avoidCut = NaN; cutTarget = 0;
  riseNow = NaN; riseTarget = 0; wasBlocked = false;
  camera.far = Math.max(dist + sphere.radius * 4, 700);   // sky dome inside the frustum
  camera.updateProjectionMatrix();               // near is managed per-frame in the loop
  /* frameAll() does NOT call controls.update(), and damping is on, so the camera
     coasts into the new pose over several frames. One dirty frame would land it
     part of the way there and stop. The damping-settle term in wantsFrame()
     carries the rest, but seeding a handful here means the settle is never
     waiting on the first of them. */
  invalidate(8);
}

/* Ankaa: the studio can be detached from the page (route change) or resized by
   the app chrome (sidebar collapse), so a zero-sized holder is a normal state —
   resizing to 0×0 would drop the drawing buffer and divide the aspect by zero.
   mountStudio() re-runs this and keeps a ResizeObserver on the holder. */
/* ---------------- A RESOLUÇÃO EFETIVA, NUM LUGAR SÓ ----------------
   `min(dpr, cap) · escala`, e a multiplicação é o conserto.

   O QUE ESTAVA ERRADO. Havia só o TETO: `min(devicePixelRatio, cap)`, com o cap
   valendo 2 / 1,5 / 1 por nível. Num monitor a `devicePixelRatio` 1 — que é a
   esmagadora maioria dos desktops, e é o hardware que esta passagem existe para
   atender — `min(1, 2)`, `min(1, 1.5)` e `min(1, 1)` são o MESMO número. O
   botão que o próprio perfil chamava de dominante ("o custo de preenchimento
   escala com o QUADRADO disto") era inerte exatamente onde precisava agir, e o
   rótulo do HUD prometia "Resolução 1×" como se fosse uma redução.

   POR QUE DENTRO DO `pixelRatio` E NÃO EM `setSize(w·s, h·s, false)`. As duas
   funcionam; esta não tem consumidor a consertar. `setSize(w, h)` continua
   escrevendo o CSS certo (com `updateStyle:false` o estilo da chamada ANTERIOR
   fica de pé, e um recolhimento de sidebar deixaria o canvas com tamanho velho);
   `camera.aspect` é indiferente porque a escala se cancela; e
   `floor-reflection.ts` dimensiona o alvo dele por `getSize() × getPixelRatio()`,
   ou seja acompanha de graça.

   POR QUE A ESCALA É VARIÁVEL DE MÓDULO. Ela tem de ser lida por `resize()` E
   por `applyQualityProfile()`, senão um dos dois apaga o outro em silêncio: o
   `ResizeObserver` do holder chama `resize()` a cada recolhimento de sidebar, e
   uma troca de nível chama `applyQualityProfile()`. `record.ts` também desfaz o
   buffer de gravação chamando `resize()`, e isso compõe corretamente com uma
   variável de módulo — e seria clobberado por qualquer escrita direta. */
let renderScale = getProfile().renderScale;

/** O `pixelRatio` que o renderer deve ter agora. Um lugar só, por desenho. */
const effectivePixelRatio = () =>
  Math.min(devicePixelRatio, getProfile().pixelRatioCap) * renderScale;

/* ---------------- O FLOCO É ANCORADO AO PIXEL QUE O OLHO VÊ ----------------
   ⚠️ ISTO ESTAVA ESCRITO COMO DEVER E NÃO EXISTIA COMO CÓDIGO. `vehicle/paint.ts`
   avisa, no bloco de `renderScale`: *"Quem mexer aqui tem de alimentar
   `uPxScale` com o inverso, ou o floco metálico muda de tamanho aparente junto
   com a escala"*. O único chamador de `setPaintPixelScale()` em todo o engine
   era `scene/capture.ts`. Ou seja: **a escala de render nunca alimentou o
   floco**, e o grão da lataria mudava sozinho toda vez que o nível de qualidade
   trocava ou que o controlador dinâmico dava um degrau — no meio de um arrasto,
   que é exatamente quando o usuário está olhando a tinta.

   A REGRA, e ela é uma só para os três casos (tela, gravação e captura):

       uPxScale = altura do BUFFER  /  altura da imagem que o olho vê

   `fwidth()` mede o pixel do buffer; multiplicar por essa razão devolve o
   "mundo por pixel" da imagem final, que é a referência com que o floco foi
   autorado. Os três casos caem na mesma conta:

     · tela a `renderScale` 0,72 → buffer menor → razão < 1 → o floco escolhe
       uma oitava mais FINA e compensa o pixel gordo;
     · gravação forçada a 1080p sobre um viewport de 720 → razão 1,5 → o floco
       para de virar chuvisco de alta frequência (que é, de quebra, o pior caso
       possível para o codec de vídeo — ver `scene/record.ts`);
     · captura em 7680 → razão ~4,8 → é o caso que `capture.ts` já resolvia
       sozinho, e continua resolvendo com o piso de 1 dele.

   A referência é `clientHeight × devicePixelRatio` — os pixels FÍSICOS que o
   painel realmente acende — e não `effectivePixelRatio()`: esta última carrega
   `renderScale` e o teto do perfil, e usá-la aqui faria a razão dar 1 sempre,
   que é precisamente o defeito. */
function anchorPaintPixel() {
  const ref = holder.clientHeight * (window.devicePixelRatio || 1);
  const buf = renderer.domElement.height;
  if (ref > 0 && buf > 0) setPaintPixelScale(buf / ref);
}

/** Reancora o floco depois que ALGUÉM DE FORA mexeu no buffer — hoje só
 *  `scene/record.ts`, que força 1080p/1440p sobre o canvas visível. */
export function reanchorPaintPixel() { anchorPaintPixel(); }

/* ---------------- A ESCALA É APLICADA NO INÍCIO DO QUADRO ----------------
   ⚠️ E NÃO NO GANCHO, e esta é a correção de uma PISCADA relatada.

   O caminho errado, que é o óbvio: `onScaleChange` aplica na hora. Só que quem
   dispara o gancho é o controlador dinâmico, dentro de `reportFrameTime()` —
   que o laço chama **depois** do `render()`. A sequência resultante é:

     quadro N:  render()  →  medidor  →  setScale  →  setSize
                                                       ↑ o canvas é LIMPO aqui
     …o compositor apresenta o quadro N…              ← e o que ele apresenta
                                                        é o buffer em branco
     quadro N+1: desenha no buffer novo

   Ou seja: escrever em `canvas.width` descarta o conteúdo, e entre esse
   descarte e o próximo desenho existe uma apresentação. O resultado é um flash
   branco de um quadro a cada degrau de resolução — e como o controlador tem
   cadência de ~1 s, ele aparece como "está dando umas piscadas às vezes",
   exatamente o relato.

   O gancho passa a só ANOTAR. Quem aplica é o laço, no topo da iteração, antes
   dos ganchos e do `render()` — assim a realocação e o desenho acontecem no
   MESMO quadro e não há apresentação entre os dois.

   Corolário para quem for mexer: qualquer coisa que realoque o drawing buffer
   tem de entrar por aqui. `resize()` é a exceção legítima — ele responde a um
   evento do DOM, fora do laço, e ali o navegador já está reapresentando de
   qualquer forma. */
let pendingScale: number | null = null;
onScaleChange((s) => { pendingScale = s; invalidate(); });

/** Aplica a escala anotada, se houver. Chamado do topo do laço. */
function flushPendingScale() {
  if (pendingScale === null) return;
  renderScale = pendingScale;
  pendingScale = null;
  const w = holder.clientWidth, h = holder.clientHeight;
  if (!w || !h) return;
  renderer.setPixelRatio(effectivePixelRatio());
  renderer.setSize(w, h);
  /* O buffer mudou de tamanho ⇒ o pixel do floco mudou de tamanho. */
  anchorPaintPixel();
  /* O buffer novo nasce em branco e ESTE quadro é quem o preenche — mas a
     sombra vive num alvo próprio, que a realocação não toca. */
}

export function resize() {
  const w = holder.clientWidth, h = holder.clientHeight;
  if (!w || !h) return;
  /* RE-APPLIED, not just set once at module load. `devicePixelRatio` is a
     PER-DISPLAY property: drag the window from a 1x panel to a 2x one and the
     value changes under a renderer that sampled it exactly once, at import.
     The symptom is a canvas rendered at half resolution on the retina screen (or
     at double cost on the cheap one) with nothing in the console. setSize()
     multiplies by whatever the ratio currently is, so this has to come first.
     Cheap by construction: three's setPixelRatio() early-outs on an unchanged
     value, so the common case is one comparison. */
  renderer.setPixelRatio(effectivePixelRatio());
  renderer.setSize(w, h);
  anchorPaintPixel();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  /* A resized drawing buffer is a BLANK drawing buffer. Under the dirty loop,
     skipping this is a white viewport that stays white. */
  invalidate();
}
window.addEventListener('resize', resize);
resize();

/* ---------------- DEFERRED TEARDOWN ----------------
   ~500 MB of GPU memory outlives the route, and that is on purpose — up to a
   point.

   The engine is a deliberate singleton (studio.ts's header says so): unmounting
   detaches the DOM and stops the loop but keeps the WebGL context, the hundreds
   of megabytes of downloaded geometry and every baked PMREM alive, so coming
   back to the route is instant instead of pulling the whole implement down
   again. That is why disposeEnvironments(), disposeReflectionProbe() and
   disposeSetTextures() exist and are called from nowhere: wiring them into
   unmountStudio() would throw exactly that away.

   The answer is neither "free it on unmount" nor "never free it" — it is a
   DEADLINE. Leaving the route starts a timer; coming back cancels it. A user
   flicking to another page and back pays nothing; a user who left for good stops
   pinning half a gigabyte of VRAM for the rest of the browser session.

   O MECANISMO NÃO MORA MAIS AQUI, E A REMOÇÃO É A DECISÃO — não um esquecimento.
   ---------------------------------------------------------------------------
   Havia aqui um `scheduleIdleRelease(fn, ms)` / `cancelIdleRelease()` /
   `isIdleReleasePending()`, exportados e **sem um único chamador em toda a
   árvore** (conferido em `web/src` e em `web/tools`). O argumento de projeto
   escrito acima — "o mecanismo mora aqui porque scene.ts é o módulo que todo
   mundo já alcança" — não sobreviveu ao contato com o problema: a política
   (quais descartadores, em que ordem, e com que escolha reaplicar depois) é tão
   inseparável do timer que `studio.ts` acabou escrevendo o timer junto com ela
   — `RELEASE_MS`, `releaseTimer`, `cancelRelease()`, `releaseScene()` e
   `releasedChoice`, armados em `unmountStudio()` e cancelados em
   `mountStudio()`.

   Ou seja: o caminho ADOTADO é o de studio.ts, e ele é melhor por uma razão que
   a versão genérica não tinha como ter — `releaseScene()` sabe adiar enquanto
   `queueDepth > 0` e sabe guardar a escolha para reconstruir. Um agendador que
   só recebe um `fn` não sabe nem uma coisa nem outra.

   Fica registrado para que a próxima pessoa não reescreva o genérico achando
   que ele falta. Se algum dia um SEGUNDO dono precisar do mesmo prazo, é de
   studio.ts que se extrai — não daqui. */

/* ---------------- instrumentation ----------------
   `renderer.info` is free (three keeps these counters whether or not anyone
   reads them) and, until now, read by nobody — so there was no way to answer
   "how many draw calls is this scene actually costing" without opening a
   profiler. It is the number every decision in this file is argued from.

   `frame` is in here for the dirty loop specifically: it is the only way to tell
   a correctly idle renderer from a frozen one. Watch it across a few seconds of
   an untouched viewport — flat is on-demand working, climbing at 60/s is the
   loop still running flat out.

   ⚠️ E ELE MENTIA — ver o bloco de `info.autoReset` no topo deste arquivo. O
   `calls` daqui contava só o passe principal porque o three zera o contador
   DEPOIS do passe de sombra; desde 2026-08-15 o zeramento é manual e o número é
   o total submetido. Três campos novos saem daqui, e nenhum campo antigo mudou
   de nome — o HUD e a bancada leem desta função:

     calls                 total do quadro (principal + sombra + drawHooks)
     shadowCalls           quanto disso é sombra, por diferença de amostras
     shadowCallsEstimated  true enquanto faltar uma das duas amostras
     shadowRefreshHz       reassaduras OBSERVADAS no último segundo

   O último é o que prova o estrangulamento da §6.1 do diagnóstico: era 60 (uma
   por quadro de arrasto) e tem de ficar no teto do perfil. */
/* As duas amostras do split, escritas pelo laço. `-1` = ainda não medida. */
let callsSemSombra = -1;
let callsComSombra = -1;

/* ---------------- A PAREDE, REPARTIDA EM QUATRO ----------------
   ⚠️ ESTE BLOCO EXISTE PORQUE OS DOIS NÚMEROS QUE HAVIA NÃO RESPONDIAM A
   PERGUNTA. O painel mostrava

       parede 36,86 ms  ·  submissão 3,93 ms

   e o comentário do próprio handle dizia a única leitura possível: *"parede
   muito maior = limitado por CPU FORA do `render()` OU por espera de vsync"*.
   As duas hipóteses pedem consertos OPOSTOS — a primeira manda cortar trabalho
   de JavaScript, a segunda manda cortar trabalho de placa — e nenhuma medição
   deste projeto sabia separá-las. Otimizar sem separá-las é apostar.

   Quatro carimbos de `performance.now()` no laço bastam, e a soma dos quatro
   canais é a parede por construção:

     fora        fim do `render()` anterior → `requestAnimationFrame` deste
                 quadro. É TUDO que o engine NÃO executa: composição, entrega do
                 quadro anterior, eventos e DOM da interface, coleta de lixo, e a
                 espera do vsync. Uma placa saturada aparece AQUI, no bloqueio do
                 swap, e nunca dentro do `render()`.
     laço        rAF → antes dos `drawHooks`. CPU pura nossa: `controls.update`,
                 as guardas de câmera, `updateLighting`, todos os `frameHooks`,
                 `applyAvoidance`, `tuneShadowSpan` e `updateSeeThrough`.
     ganchos     os `drawHooks`. Separado do anterior porque é lá que mora o
                 REFLEXO DO PISO, que é uma cena inteira a mais — juntá-lo ao
                 laço esconderia a única segunda passada completa do engine
                 dentro de um número chamado "CPU".
     submissão   o `renderer.render()` do laço, principal + sombra.

   COMO LER, e é para isto que os quatro existem:

     · `fora` domina e os outros três são pequenos  → é PLACA (ou vsync). O botão
       é `renderScale`, a resolução do mapa de sombra, o reflexo do piso.
     · `laço` domina                                → é JavaScript por quadro. O
       botão é contagem de objetos, não resolução.
     · `ganchos` domina                             → é o reflexo do piso, e ele
       tem interruptor próprio no perfil (`floorReflection`).
     · `submissão` domina                           → é contagem de CHAMADAS de
       desenho, que é o gargalo que a fusão por material atacou.

   ⚠️ `fora` NÃO É DESPERDÍCIO. Numa máquina folgada ele É o quadro: o laço
   termina em 2 ms e espera 14 ms pelo vsync. Um `fora` grande com os outros três
   pequenos e a taxa em 60 fps é a leitura de uma cena SAUDÁVEL. O que denuncia é
   `fora` grande com a taxa BAIXA — aí a espera não é vsync, é a placa.

   RELAÇÃO COM OS DOIS NÚMEROS ANTIGOS, para quem estiver lendo o painel:

       frameTimeEma()   ==  parede
       submitTimeEma()  ==  ganchos + submissao

   A segunda igualdade é de 2026-08-16 e é um CONSERTO — ver o ⚠️ de `submitMs`
   no laço. Antes ela valia só `submissao`, e no cenário Estúdio isso deixava uma
   cena inteira (o reflexo do piso) fora de um número que existe justamente para
   dizer quanto de trabalho o quadro submeteu.

   Mesmas travas de `reportFrameTime()`, e de propósito: mesmo `busy`, mesmo teto
   de 400 ms, mesmo α. Os cinco números têm de descrever a MESMA população, senão
   a repartição não fecha com a parede que o painel mostra ao lado. */
const REPART_ALPHA = 0.1;
const reparticao = { parede: 0, fora: 0, laco: 0, ganchos: 0, submissao: 0 };

function amostrarReparticao(parede: number, fora: number, laco: number,
  ganchos: number, submissao: number, ocupado: boolean) {
  if (ocupado || !Number.isFinite(parede) || parede <= 0 || parede > 400) return;
  const e = (v: number, x: number) => (v ? v + (x - v) * REPART_ALPHA : x);
  reparticao.parede = e(reparticao.parede, parede);
  reparticao.fora = e(reparticao.fora, fora);
  reparticao.laco = e(reparticao.laco, laco);
  reparticao.ganchos = e(reparticao.ganchos, ganchos);
  reparticao.submissao = e(reparticao.submissao, submissao);
}

export function getRenderStats() {
  const { render, memory, programs } = renderer.info;
  /* A diferença só é publicada quando as DUAS amostras existem e a com-sombra é
     de fato a maior — o contrário só pode vir de deriva entre os dois quadros
     (mudou o corte de frustum, entrou um LOD) e publicá-lo seria inventar um
     número negativo de chamadas de sombra. */
  const temSplit = callsSemSombra >= 0 && callsComSombra > callsSemSombra;
  podarReassaduras(performance.now());
  return {
    frame: render.frame,
    /* ⚠️ AGORA É O TOTAL DE VERDADE — passe principal MAIS passe de sombra, mais
       tudo que os `drawHooks` submeteram neste quadro. Ver `info.autoReset`. Até
       2026-08-15 este campo relatava só o passe principal, e todo orçamento
       escrito neste projeto saiu 40 a 70 % baixo por causa disso. */
    calls: render.calls,
    /** Quanto do `calls` acima é passe de sombra. Estimativa por diferença. */
    shadowCalls: temSplit ? callsComSombra - callsSemSombra : 0,
    /** true = ainda não há as duas amostras; `shadowCalls` não vale nada. */
    shadowCallsEstimated: !temSplit,
    /** Reassaduras do mapa de sombra no último segundo — a taxa OBSERVADA. */
    shadowRefreshHz: reassaduras.length,
    triangles: render.triangles,
    lines: render.lines,
    points: render.points,
    geometries: memory.geometries,
    textures: memory.textures,
    programs: programs ? programs.length : 0,
    /* Not from renderer.info — this module's own procedural IBL cache, which is
       the one pool of VRAM here that grows with USE rather than with content. */
    envCacheSize: envCache.size,
    /**
     * A REPARTIÇÃO DO QUADRO em ms — ver o bloco A PAREDE, REPARTIDA EM QUATRO.
     *
     * `fora + laco + ganchos + submissao === parede`, por construção. Zeros
     * significam "ainda não houve dois quadros desenhados consecutivos fora de
     * uma janela ocupada", que é um estado legítimo numa cena parada.
     *
     * Cópia e não a referência viva: o consumidor é um painel que lê a cada meio
     * segundo, e entregar o objeto do laço deixaria os cinco números mudando por
     * baixo de quem estivesse formatando.
     */
    frameSplit: { ...reparticao },
  };
}

const clock = new THREE.Clock();

/**
 * Is something still MOVING, as opposed to merely having moved?
 *
 * The whole predicate in one place, so there is exactly one list to audit when a
 * new animated source appears. Every term is a continuous source: while any of
 * them is true the loop draws unconditionally, which is what keeps the dirty
 * loop from ever having to guess how long an animation lasts.
 *
 *   tweenT < 1        a preset/hour crossfade, ~0.8 s of lerped rig per change.
 *   rig.rain          weather.ts's rain and ripples advance their own uTime from
 *                     the frame hook. Read off the RIG rather than asking
 *                     weather.ts, which would invert an import edge (see the
 *                     acyclicity note at the top) — and `rig.rain` is the exact
 *                     value weather.ts clamps into its own `amount`, so the two
 *                     cannot drift. The 0.02 threshold is weather.ts's own.
 *   the dome          skyU.uTime scrolls the cloud fbm. The shader's cloud
 *                     branch is itself gated on `uCloud > 0.01`, so the same
 *                     test here is not a tolerance, it is the identical
 *                     condition: below it the dome is provably static and uTime
 *                     changes nothing. That is what makes BOTH shipped scenarios
 *                     idle — `armazem` has no HDRI and therefore does show the
 *                     procedural dome, but its `estudio` preset is cloudiness 0.
 *   autoRotate        o giro de apresentação. Lido da flag em vez de empurrado:
 *                     setTurntable() é o dono dela, mas escrevê-la direto
 *                     também funciona, e um termo que LÊ não tem como ser
 *                     esquecido por quem escreve.
 *   framePins         uma gravação de vídeo em curso — ver pinFrames() abaixo.
 */
function wantsFrame(): boolean {
  if (tweenT < 1) return true;
  if (rigCur && rigCur.rain > 0.02) return true;
  if (skyDome && skyDome.visible && skyU.uCloud.value > 0.01) return true;
  if (framePins > 0) return true;
  return controls.autoRotate;
}

/* ---------------- o PINO DE QUADROS ----------------
   Uma gravação lê o canvas COMPOSTO (`captureStream`), não a cena — então um
   quadro que o laço decide não desenhar é um quadro que o vídeo grava repetido.
   Com uma cena parada e `onDemand` ligado isso não é "algum" quadro: é a
   gravação inteira congelada no primeiro.

   O caso "cena parada" é REAL e não teórico: uma gravação livre, com o usuário
   pensando antes de arrastar, ou uma cena cujo preset já fundiu e sem chuva
   nem nuvem. Nenhum outro termo de wantsFrame() cobre isso, porque nenhum
   deles é sobre QUEM ESTÁ OLHANDO — e uma gravação é exatamente isso.

   ESTE PINO PASSOU A SEGURAR PESO EM 2026-08-13. Ele foi escrito quando
   `ON_DEMAND_RENDERING` ainda era `false` — ou seja, quando o laço desenhava
   sempre e o pino não mudava nada —, justamente para que a gravação continuasse
   correta no dia em que a flag virasse, em vez de `record.ts` presumir o valor
   da época e o defeito aparecer um ano depois. A flag virou; sem este pino, uma
   gravação de cena parada seria o primeiro quadro repetido do começo ao fim.

   CONTADOR, e não booleano, pelo mesmo motivo de `drawSuspended`: dois pinos
   simultâneos (uma gravação e o que vier depois) não podem se desfazer um ao
   outro no primeiro que soltar. */
let framePins = 0;

/**
 * Segura o laço desenhando enquanto algo estiver LENDO os quadros.
 *
 * Sempre em par: `pinFrames(true)` … `pinFrames(false)`, e o `false` num
 * `finally`. Um pino vazado deixa a GPU quente para sempre.
 */
export function pinFrames(on: boolean) {
  if (on) framePins++;
  else if (framePins > 0) framePins--;
  invalidate();
}


/* ---------------- APLICAR O PERFIL A QUENTE ----------------
   Chamado quando o nível muda — pela escolha do usuário ou pelo medidor. Tudo
   aqui é botão QUENTE: nenhuma destas linhas recompila um shader, e é essa
   propriedade que torna a adaptação automática segura. A prova é por
   construção: `setPixelRatio` e `setSize` mexem no buffer, `mapSize` realoca um
   alvo, e `anisotropy` é estado de amostrador. Nenhum é `#define`.

   O que NÃO está aqui, e não pode estar: `antialias` (parâmetro de construtor),
   `NUM_SPOT_LIGHTS` (chave de cache de programa) e `shadowMap.type` (`#define`).

   A ANISOTROPIA NÃO É REAPLICADA às texturas já carregadas, e isso é uma
   escolha, não um esquecimento: varrer todo material do veículo e do cenário
   marcando `needsUpdate` forçaria um reupload de ~200 texturas no meio de um
   arrasto — exatamente o engasgo que se está tentando evitar. O valor novo vale
   para o que carregar DEPOIS (troca de caminhão, troca de cenário), que é
   quando ele custa zero. Quem mudou de nível vê a mudança na resolução e na
   sombra na hora, e na anisotropia no próximo carregamento. */
function applyQualityProfile() {
  const p = getProfile();
  /* AS AMOSTRAS DO SPLIT MORREM COM O NÍVEL. Elas são uma diferença entre dois
     quadros, e o LOD e a vegetação mudam a contagem do passe principal em
     centenas de chamadas — casar a amostra "sem sombra" do Alto com a "com
     sombra" do Baixo daria um `shadowCalls` NEGATIVO ou absurdo. Ver
     `getRenderStats()`. */
  callsSemSombra = -1;
  callsComSombra = -1;
  /* A escala vem junto do teto — ver `effectivePixelRatio()`. Sem ela esta
     função apagaria a escala corrente toda vez que o nível mudasse, e o
     controlador dinâmico só a recuperaria no próximo degrau. */
  renderScale = p.renderScale;
  renderer.setPixelRatio(effectivePixelRatio());
  const w = holder.clientWidth, h = holder.clientHeight;
  if (w && h) renderer.setSize(w, h);
  anchorPaintPixel();

  const size = Math.min(p.shadowMapSize, renderer.capabilities.maxTextureSize || 3072);
  if (key.shadow.mapSize.x !== size) {
    key.shadow.mapSize.set(size, size);
    shadowMapSide = size;
    /* O BIAS ANDA COM O MAPA. Esta linha é o conserto do defeito descrito em
       `applyShadowBias()`: realocar o alvo muda os metros por texel, e um bias
       calibrado para 3072² vale um terço de texel a 1024² — a sombra vaza por
       baixo do objeto e some. A versão anterior desta função escrevia `mapSize`
       e não tocava no bias. */
    applyShadowBias();
    /* O alvo VELHO tem de morrer, senão o three continua a desenhar no de antes
       e o `mapSize` novo não sai do papel. `dispose()` no mapa faz o renderer
       realocar no próximo passe de sombra. */
    key.shadow.map?.dispose();
    key.shadow.map = null;
    renderer.shadowMap.needsUpdate = true;
  }
  invalidate();
}
onQualityChange(applyQualityProfile);

/* ---------------- O QUADRO OFFLINE — a gravação a 60 fps travados ----------
   Existe porque `MediaRecorder` carimba cada quadro pelo RELÓGIO DE PAREDE: uma
   máquina que desenha a 12 fps produz, por definição, um vídeo de 12 fps. Não
   há bitrate nem codec que conserte isso — é a natureza da API.

   A saída é desacoplar o vídeo do tempo real. Aqui o mundo anda por um `dt`
   FORNECIDO (1/60 s), não pelo `clock`, e quem consome o quadro (WebCodecs, em
   `scene/record.ts`) o carimba com o timestamp que o `dt` implica. O render pode
   levar 300 ms por quadro numa integrada: o vídeo continua saindo com 60 quadros
   por segundo de vídeo, perfeitamente liso. O preço é a espera, e é um preço que
   o dono aceitou explicitamente — *"mesmo que tenha que ter um loading enorme"*.

   ⚠️⚠️ ESTA FUNÇÃO É UM ESPELHO DO CORPO DE `startLoop()` E AS DUAS TÊM DE
   ANDAR JUNTAS. Não foi possível fatorar uma da outra sem desmontar o laço vivo,
   que é código medido e recém-consertado. Quem mexer numa confira a outra. O que
   ela DELIBERADAMENTE não faz, e por quê:

     · `clock.getDelta()` — o `dt` é do chamador; é o ponto inteiro do arquivo;
     · o laço sob demanda (`draw`, `dirtyFrames`, `drawSuspended`) — offline
       TODO quadro é desenhado, senão faltaria quadro no vídeo;
     · `reportFrameTime()` — alimentar o medidor com quadros offline (que são
       lentos de propósito, no perfil de TETO e em 1080p) faria o adaptador
       concluir que a máquina é fraca e derrubar o nível DEPOIS da gravação;
     · `flushPendingScale()` — o tamanho do buffer é do gravador aqui, e deixar o
       controlador de escala mexer nele no meio do vídeo mudaria a resolução da
       faixa no ar;
     · o ESTRANGULAMENTO da sombra — offline não há fps a proteger, então toda
       dívida é paga no mesmo quadro. Um vídeo com sombra defasada é um defeito
       permanente, não um engasgo passageiro. */
export function renderOfflineFrame(dt: number) {
  releaseAvoidance();
  /* `controls.update(dt)` é quem move o giro de apresentação (`autoRotate`), e é
     por ele receber o `dt` que "uma volta em N segundos" é promessa e não
     estimativa — ver o bloco no laço. Com `dt` fixo em 1/60, a volta fecha no
     mesmo ângulo sempre, em qualquer máquina. É isso que faz a emenda do laço de
     vídeo ser exata. */
  /* Com `dt` fixo em 1/60 esta linha devolve exatamente `AMORTECIMENTO_60`, ou
     seja o vídeo sai idêntico ao que saía. Ela está aqui porque o espelho tem de
     ser espelho: o dia em que `record.ts` gravar a 30 fps de vídeo, a inércia
     tem de andar pelo relógio dele. */
  sincronizarAmortecimento(dt);
  controls.update(dt);
  if (camera.position.y < CAM_MIN_Y) camera.position.y = CAM_MIN_Y;
  if (controls.target.y < 0.05) controls.target.y = 0.05;
  const dist = camera.position.distanceTo(controls.target);
  const near = THREE.MathUtils.clamp(dist / 40, 0.08, 0.5);
  if (Math.abs(near - camera.near) > near * 0.15) {
    camera.near = near;
    camera.updateProjectionMatrix();
  }

  updateLighting(dt);
  for (const fn of frameHooks) fn(dt);
  applyAvoidance(dt);
  tuneShadowSpan();
  updateSeeThrough(camera, dt);
  /* Toda dívida de sombra é quitada AQUI, sem janela: ver o cabeçalho. */
  if (takeSeeThroughShadowDirty() || seeShadowDebt || shadowStale) {
    renderer.shadowMap.needsUpdate = true;
    seeShadowDebt = false;
    shadowStale = false;
  }
  for (const fn of drawHooks) fn(dt);
  renderer.render(scene, camera);
  /* DEPOIS do render, e é o ponto: ver `onOverlay`. */
  for (const fn of overlayHooks) fn(dt);
}

export function stopLoop() {
  renderer.setAnimationLoop(null);
  /* A cadeia se rompe junto com o laço: remontar depois de uma troca de rota não
     pode entregar ao medidor o intervalo entre a última rota e esta. */
  lastDrawnAt = 0;
}

export function startLoop() {
  /* A mount must always paint, whatever the studio was doing when it was
     detached — and capture.ts restarts the loop after a screenshot, where the
     restored viewport is the frame that has to land. */
  invalidate();
  renderer.setAnimationLoop(() => {
    /* O PRIMEIRO DOS QUATRO CARIMBOS — ver A PAREDE, REPARTIDA EM QUATRO, junto
       de `getRenderStats()`. Antes de qualquer trabalho: o que está ANTES dele é
       navegador, compositor e espera de vsync, e é justamente a fatia que o
       engine não executa e que ninguém tinha como separar. */
    const tRaf = performance.now();
    /* PRIMEIRA COISA DO QUADRO, e a posição é o conserto — ver o bloco de
       `flushPendingScale()`. Realocar o drawing buffer o limpa, então a
       realocação tem de acontecer no mesmo quadro que o desenho, nunca depois
       dele. */
    flushPendingScale();
    /* A backgrounded tab returns one huge dt, which would complete every tween
       in a single frame (a visible jump) and teleport the rain field. */
    const dt = Math.min(clock.getDelta(), 0.1);
    /* ANTES de controls.update(): o desvio das construções deixa a câmera numa
       posição ENCOLHIDA para desenhar, e o OrbitControls lê `camera.position`
       para saber onde a órbita está. Sem desfazer a correção aqui ele a leria
       como se fosse a que o usuário pediu e a incorporaria — a aproximação
       forçada por um galpão viraria permanente, e o arrasto passaria a disputar
       com ela (foi assim que a versão por expulsão travava a câmera). */
    releaseAvoidance();
    /* Returns true while the camera is still being transformed — a drag, inertia
       from `enableDamping`, a zoom, autoRotate. This is the ONLY signal that
       says "damping has not settled yet", and it is why the dirty loop does not
       need to know how long inertia takes.

       COM O `dt`, E NÃO SEM. É o único uso que o OrbitControls faz do argumento:
       sem ele o giro automático avança `2π/60/60 · autoRotateSpeed` POR QUADRO,
       ou seja meia velocidade a 30 fps e o dobro a 120. Com ele o giro passa a
       ser função do relógio, e é isso que torna `turntablePeriod()` — "uma volta
       em N segundos" — uma promessa em vez de uma estimativa. A 60 fps as duas
       fórmulas dão exatamente o mesmo número, então nada muda no caso comum.
       O `dt` já vem limitado a 0,1 s lá em cima, então uma aba que volta do
       segundo plano não teleporta o giro. */
    /* ⚠️ ANTES do `update()`, e é o conserto de *"não sinto fluida a
       movimentação da câmera"* — ver o bloco A INÉRCIA DA ÓRBITA ERA CONTADA EM
       QUADROS. A 60 fps não muda um bit. */
    sincronizarAmortecimento(dt);
    if (controls.update(dt)) invalidate();
    // hard floor guard — right-click panning can otherwise drag under the ground
    if (camera.position.y < CAM_MIN_Y) camera.position.y = CAM_MIN_Y;
    if (controls.target.y < 0.05) controls.target.y = 0.05;
    // dynamic near plane: close-ups must not slice geometry (near ~0.03 when
    // zoomed in), while far views keep depth precision (near grows with range)
    const dist = camera.position.distanceTo(controls.target);
    /* `near` is the dominant term in depth resolution — halving it halves the
       precision everywhere. The old floor of 0.03 was sized for a camera that
       could be anywhere; setVehicleFocus() now keeps it at least ~2.9 m from
       the rig centre, so nothing is ever within 0.08 m of the lens and the
       floor can rise. That alone is a 2.7x gain on every millimetre-scale
       clearance in the implement. */
    const near = THREE.MathUtils.clamp(dist / 40, 0.08, 0.5);
    if (Math.abs(near - camera.near) > near * 0.15) {
      camera.near = near;
      camera.updateProjectionMatrix();
      invalidate();
    }
    /* Decided BEFORE updateLighting(), which is what closes a finishing tween:
       the frame that takes tweenT from 0.98 to 1.0 is a frame that has to be
       drawn, and asking afterwards would skip it. */
    const draw = !onDemand || dirtyFrames > 0 || wantsFrame();

    updateLighting(dt);
    for (const fn of frameHooks) fn(dt);
    /* Hooks run even on a skipped frame: they are clamps (the interior box, the
       body ejection, the haze shell following the camera) and a state they were
       not allowed to correct would be a state the NEXT drawn frame renders wrong.
       They are a few vector ops, not a draw call. */

    /* DEPOIS dos hooks: eles são os donos da posição verdadeira (a caixa do
       interior, a expulsão da carroceria), e corrigir antes deles seria corrigir
       uma posição que ainda vai mudar. Roda também em quadro pulado — a
       suavização anda com o RELÓGIO, e pular a atualização faria a correção
       saltar de uma vez quando o desenho voltasse. */
    applyAvoidance(dt);
    /* Também depois dos hooks, e pela mesma razão: o passo da caixa de sombra e
       o túnel de transparência são função da posição da câmera, e a posição só
       é verdadeira aqui. */
    tuneShadowSpan();
    if (updateSeeThrough(camera, dt)) invalidate();
    /* A sombra de quem está sendo atravessado dissolve junto (ver o bloco A
       SOMBRA SAI COM O OBJETO em seethrough.ts), e o mapa de sombra deste engine
       só se redesenha quando alguém pede.

       ⚠️ O PEDIDO VIRA DÍVIDA, NÃO REASSADURA. Era aqui que estava a tempestade
       medida em `GARGALO-2026-08-15.md` §1.2 — 90 de 90 quadros de arrasto. Ver
       o bloco de `seeShadowDebt`: quem paga é o trecho de quadro desenhado, no
       ritmo de `shadowRefreshHz`. */
    if (takeSeeThroughShadowDirty()) seeShadowDebt = true;
    /* E ENQUANTO A DÍVIDA EXISTIR, O LAÇO NÃO PODE DORMIR. `updateSeeThrough()`
       devolve false no quadro em que a rampa assenta, e é justamente esse quadro
       que costuma ficar devendo — sem isto a viewport pararia de desenhar com a
       sombra do estado anterior no ar. A corrente se mantém sozinha enquanto a
       dívida durar (no máximo 1/`shadowRefreshHz`, ~7 quadros no nível Baixa) e
       se rompe assim que ela é paga.

       ⚠️ DOIS QUADROS E NÃO UM, e a razão é a ORDEM dentro do laço: esta linha
       roda ANTES do `dirtyFrames--` lá embaixo, então um `invalidate(1)` seria
       gasto pelo próprio quadro que o levantou e a cadeia desenharia um quadro
       sim, um não. Com 2 sobra exatamente um, que é o que mantém a corrente
       contínua até a janela expirar. */
    if (seeShadowDebt) invalidate(2);

    /* Checked AFTER the hooks and BEFORE the dirty counter is spent: a frame
       skipped because the scene graph is deliberately wrong must not consume the
       invalidation that was asking for a correct one. */
    /* A CADEIA DE QUADROS DESENHADOS SE ROMPE AQUI, e é isto que torna a régua
       de tempo de parede honesta sob um laço sob demanda: o próximo quadro
       desenhado não terá antecessor imediato, então ele não gera amostra. Sem
       esta linha, uma cena parada por meio minuto entregaria "30 000 ms por
       quadro" ao medidor no instante em que alguém encostasse no mouse. */
    if (drawSuspended > 0) { lastDrawnAt = 0; return; }
    if (!draw) { lastDrawnAt = 0; return; }
    if (dirtyFrames > 0) dirtyFrames--;
    /* Pay the deferred shadow refresh a light scrub skipped — see shadowStale.
       Here rather than in applyRig() because "the drag is over" is a fact about
       the CLOCK, and applyRig() has stopped being called by the time it is
       true. */
    if (shadowStale && performance.now() > scrubUntil) {
      renderer.shadowMap.needsUpdate = true;
      shadowStale = false;
    }

    /* ---- A DÍVIDA DA DISSOLVÊNCIA, COBRADA NO RITMO DO PERFIL ----
       Depois de `shadowStale` de propósito: se o relógio já mandou reassar, a
       dissolvência viaja de carona e não gasta a própria janela. */
    const agora = performance.now();
    if (seeShadowDebt && agora >= seeShadowNextAt) {
      renderer.shadowMap.needsUpdate = true;
      seeShadowDebt = false;
    }

    /* ---- O PASSE DE SOMBRA VAI RODAR NESTE QUADRO? ----
       ⚠️ LIDO AQUI, ANTES DOS `drawHooks`, E A POSIÇÃO É A CORREÇÃO. O reflexo
       do piso renderiza a cena inteira de dentro de um `drawHook`, e
       `WebGLShadowMap.render()` só sai cedo quando `autoUpdate` E `needsUpdate`
       são AMBOS falsos — ou seja, a passada do reflexo ASSA o mapa e LIMPA a
       bandeira, e o render principal reusa (é a economia que floor-reflection.ts
       documenta). Ler depois dos hooks acharia `false` num quadro que assou. */
    const assaSombra = renderer.shadowMap.needsUpdate;
    if (assaSombra) {
      /* Qualquer reassadura serve à dissolvência, venha de onde vier — de um
         `applyRig()`, de uma carga, do passo da caixa. Zerar a dívida aqui é o
         que impede o estrangulamento de pedir uma segunda varredura por cima de
         uma que acabou de acontecer. */
      seeShadowDebt = false;
      seeShadowNextAt = agora + 1000 / shadowRefreshHz();
      podarReassaduras(agora);
      reassaduras.push(agora);
    }

    /* O CONTADOR ZERA AQUI — ver o bloco de `info.autoReset` lá em cima. Antes
       dos `drawHooks` para que `calls` signifique tudo que este quadro submeteu,
       reflexo do piso incluído. */
    renderer.info.reset();
    /* SEGUNDO CARIMBO: fecha o trecho de CPU pura do laço (controles, guardas,
       luz, `frameHooks`, desvio, caixa de sombra, atravessar) e abre o dos
       ganchos de desenho — onde mora o reflexo do piso, que é uma cena inteira a
       mais. Separá-los é o ponto: os dois eram "o que não é render()". */
    const tPre = performance.now();
    /* Só agora, e nunca antes do `return` acima: o que está aqui DESENHA. Ver a
       nota de `onDrawFrame`. */
    for (const fn of drawHooks) fn(dt);
    const t0 = performance.now();
    renderer.render(scene, camera);
    /* DENTRO da janela medida, e de propósito: uma sobreposição é submissão como
       qualquer outra, e `info.autoReset` é `false` neste renderizador (ver o
       bloco lá em cima), então a chamada dela SOMA ao contador em vez de zerá-lo.
       O diagnóstico continua dizendo tudo que o quadro submeteu. */
    for (const fn of overlayHooks) fn(dt);
    const t1 = performance.now();
    /* ---- AS DUAS AMOSTRAS QUE DÃO O SPLIT PRINCIPAL × SOMBRA ----
       Não há contador separado do passe de sombra em lugar nenhum do three, e o
       total já contém os dois. Mas quem controla `needsUpdate` é este laço, então
       ele SABE se o passe rodou — e a diferença entre a última contagem de um
       quadro que assou e a do último que não assou é a estimativa honesta.

       ⚠️ É ESTIMATIVA E ESTÁ ROTULADA COMO TAL (`shadowCallsEstimated` enquanto
       faltar uma das duas amostras). As duas medições vêm de quadros diferentes,
       e entre eles a câmera pode ter movido o suficiente para o corte de frustum
       mudar a contagem do passe principal. A ordem de grandeza é o que importa,
       e ela bate com a bancada: Alta 2 230 + 1 574, Média 1 642 + 1 574, Baixa
       1 158 + 1 138.

       O `busyUntil` é a mesma trava do medidor de quadro, e pela mesma razão:
       numa janela de carga há sonda, PMREM e compilação somando milhares de
       chamadas ao total, e uma amostra tirada de lá envenenaria a diferença. */
    if (agora >= busyUntil) {
      if (assaSombra) callsComSombra = renderer.info.render.calls;
      else callsSemSombra = renderer.info.render.calls;
    }
    /* ---------------- O MEDIDOR DO PERFIL DE QUALIDADE ----------------
       AQUI E EM NENHUM OUTRO LUGAR, porque é depois do `return` do laço sujo —
       ou seja **só em quadro DESENHADO**. Um quadro pulado custa ~0 ms;
       alimentá-lo faria a média despencar com a cena parada, e o adaptador
       concluiria que a máquina é um foguete justamente quando ela não está
       fazendo nada.

       ---------------------------------------------------------------------
       A RÉGUA MUDOU (2026-08-14), E ESTA É A CORREÇÃO QUE FAZ O RESTO VALER

       Até aqui o medidor passava `performance.now() - t0`, ou seja SÓ o
       `render()`, com o argumento de que "o que está fora dele é trabalho de
       CPU que não muda com o perfil". **A premissa é falsa exatamente no
       hardware que o perfil existe para atender**, e por duas vias:

         · numa máquina limitada por CPU o que domina está FORA do `render()` —
           `updateSeeThrough()` percorre ~650 objetos 60×/s (e roda até em
           quadro pulado), mais a submissão de ~2 400 chamadas e o passe de
           sombra. O medidor não via nada disso;
         · `performance.now()` em volta do `render()` mede SUBMISSÃO, não
           execução. Com `setAnimationLoop` preso ao vsync, uma GPU saturada
           deixa o bloqueio no swap, fora do `render()`. O medidor lia "está
           tudo bem" numa máquina a 20 fps.

       A régua honesta é o tempo de PAREDE entre dois quadros desenhados
       CONSECUTIVOS: ela inclui CPU, GPU, compositor e swap, que é o que a
       pessoa na frente da tela sente.

       ⚠️ O PRIMEIRO DOS DOIS ARGUMENTOS ACIMA ESTAVA CERTO NA CONCLUSÃO E
       ERRADO NO CULPADO (medido em 2026-08-16). `updateSeeThrough()` sobre esta
       cena custa **0,011 ms**, não milissegundos — a prova e o método estão no
       bloco ⚠️⚠️ ESTE MÓDULO NÃO É O GARGALO, em `scene/seethrough.ts`. A
       premissa "o medidor não via nada disso" continua valendo; o exemplo
       escolhido para ilustrá-la é que não pesava.
       É essa confusão que a REPARTIÇÃO EM QUATRO existe para não deixar
       acontecer de novo: parede e submissão sozinhas nunca disseram QUEM está
       consumindo a diferença, e três otimizações deste projeto foram escolhidas
       adivinhando. Ver A PAREDE, REPARTIDA EM QUATRO, junto de
       `getRenderStats()`.

       ⚠️ **CONSECUTIVOS é a palavra que carrega a correção.** Sob o laço sob
       demanda, o intervalo entre um quadro desenhado e o próximo pode conter
       minutos de cena parada — e passar isso como tempo de quadro seria uma
       mentira ainda maior que a anterior, na direção oposta. Por isso
       `lastDrawnAt` é ZERADO em todo quadro que não desenha (ver o `return` de
       `!draw` acima), e a amostra só sai quando o quadro anterior também
       desenhou.

       O tempo de submissão continua sendo medido e continua sendo enviado, mas
       como SEGUNDO canal: comparado com o de parede, ele é o que distingue
       "limitado por GPU/submissão" de "limitado por CPU fora do render" — e
       essa é a diferença entre baixar resolução (que resolve o primeiro) e
       baixar contagem de objetos (que é a única coisa que resolve o segundo).

       O `busy` é a trava contra aprender a coisa errada. Todos os termos são
       picos CONHECIDOS: uma gravação em curso (`framePins`), um crossfade de
       preset (`tweenT`), e a janela de carga que `warmUp()` marca. Adaptar em
       cima de um pico conhecido faria o nível cair toda vez que o usuário
       trocasse de caminhão — que é o momento em que ele mais está olhando. */
    const wall = lastDrawnAt ? t1 - lastDrawnAt : 0;
    /* A FATIA QUE O ENGINE NÃO EXECUTA: do fim do `render()` anterior até o rAF
       deste quadro. Ela só existe quando houve quadro anterior desenhado, pela
       mesma razão que `wall` — ver `lastDrawnAt`. */
    const fora = lastDrawnAt ? tRaf - lastDrawnAt : 0;
    lastDrawnAt = t1;
    /* UM SÓ predicado de "não aprenda com isto" para os dois medidores: se a
       amostra não serve para adaptar, ela também não serve para o painel dizer
       onde está o gargalo. */
    const ocupado = framePins > 0 || tweenT < 1 || performance.now() < busyUntil;
    amostrarReparticao(wall, fora, tPre - tRaf, t0 - tPre, t1 - t0, ocupado);
    /* ---- ⚠️ `submitMs` VAI DE `tPre`, E NÃO DE `t0` ----
       O canal de submissão do medidor contava só a linha final, e no cenário
       Estúdio isso o fazia errar por uma CENA INTEIRA: o reflexo do piso é uma
       segunda passada completa (`cyclorama.ts` → `floor-reflection.ts`) e ela
       roda num `drawHook`, ou seja entre `tPre` e `t0`. A razão parede ÷
       submissão — que é como se lê "limitado por GPU" contra "limitado por CPU
       fora do render()" — vinha inflada por ela, e um diagnóstico de GPU tirado
       no Estúdio podia ser só isso.

       ⚠️ A INCOERÊNCIA ERA COM O CONTADOR AO LADO, e é ela que fecha o
       argumento: `renderer.info.reset()` JÁ foi movido para antes dos
       `drawHooks` de propósito, justamente para que `calls` signifique "tudo que
       este quadro submeteu, reflexo do piso incluído" (ver o bloco de
       `info.autoReset`). O painel mostrava as duas medidas lado a lado
       descrevendo populações DIFERENTES. Agora não.

       POR QUE NÃO SOMAR `floorReflectionCost()` NO LUGAR — a outra saída
       possível, e ela é pior por duas razões independentes:
         · **fecharia um ciclo de importação.** `floor-reflection.ts` e
           `cyclorama.ts` importam ESTE módulo; importar qualquer um deles daqui
           é o `ReferenceError` na carga que o cabeçalho deste arquivo abre
           dizendo que não pode existir. Sairia caro: um gancho de injeção só
           para contabilidade;
         · **não generaliza.** Seria um caso especial para UM gancho. O próximo
           `drawHook` que submetesse trabalho voltaria a ficar de fora, e o
           defeito reapareceria com outro nome. Medir a JANELA cobre todos.

       O que se perde é nada: a repartição acima continua separando `ganchos` de
       `submissao`, então quem quiser saber quanto do quadro é o reflexo do piso
       lê `frameSplit.ganchos` — que existe exatamente para isso.

       ⚠️ E ISTO NÃO MEXE NO CONTROLADOR. `submitMs` alimenta só `emaSubmit`, que
       é DIAGNÓSTICO; os portões de escala e de nível decidem por `wallMs` e pelo
       piso de vsync (ver O PISO DE VSYNC em `core/quality.ts`). Conferido antes
       de mexer, porque o conserto da catraca de mão única mora do outro lado
       desta mesma chamada. */
    reportFrameTime(wall, t1 - tPre, ocupado);
  });
}
