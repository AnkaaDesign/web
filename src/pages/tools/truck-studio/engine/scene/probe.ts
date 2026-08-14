/* Local reflection probe — what the chrome actually reflects.
   ---------------------------------------------------------------------------
   `scene.environment` is the scenario's HDRI: a photograph of somewhere else,
   standing in for the rest of the map. Every `metalness: 1` surface on the
   vehicle mirrors it, so the implement reflects a horizon and a treeline while
   parked two metres from a warehouse wall that is right there in the scene. On a
   15 m rail the HDRI's horizon draws a hard line that slides as the camera moves,
   which is what kept reading as a rendering fault on the flank.

   An image-based environment cannot know about local geometry. The only thing
   that can is a render FROM the vehicle's position, which is what this is: one
   CubeCamera pass over the scene with the vehicle itself hidden, prefiltered
   through PMREM so roughness still blurs it correctly, then bound as `envMap` on
   the vehicle's own materials. `scene.environment` is left alone and keeps
   lighting everything else.

   WHAT IT COSTS, AND WHY THAT IS ACCEPTABLE. Six faces at 256² over the full
   scene, plus a PMREM bake. That is expensive per invocation and worthless per
   frame — a parked trailer's surroundings do not change — so it runs on the
   events that actually invalidate it: a new scenario, a new cab, the implement
   moving. Never in the render loop.

   THE VEHICLE MUST BE HIDDEN. A probe that can see the truck bakes the truck's
   own panels into the reflection, and the flank then mirrors itself — a white
   smear that looks exactly like the defect this replaces. Hidden, not moved: the
   camera sits inside the vehicle's own volume, and its near plane is set past the
   bodywork so nothing else nearby clips in.

   WHAT IT IS NOT. This is a single probe, captured once, from one point. It is a
   correct reflection only for a surface AT that point; a rail 7 m away reflects
   the world as seen from the middle of the trailer. For a vehicle configurator
   that is the right trade — it puts the real building in the metal instead of a
   photograph of a field, and no viewer is going to check the parallax. */
import * as THREE from 'three';
import { renderer, scene } from './scene';
import { getProfile } from '../core/quality';

/** Cube face resolution. 256 is plenty once PMREM has blurred it by roughness.
 *
 *  DO PERFIL, e FUNÇÃO em vez de constante porque o nível pode mudar no meio da
 *  sessão — um valor congelado no tempo de import entregaria para sempre o
 *  tamanho do nível em que a página abriu.
 *
 *  Por que ele vale um botão: esta sonda faz SEIS renderizações completas da
 *  cena mais um PMREM a cada troca de cenário ou de cavalo — da ordem de 14 000
 *  chamadas de desenho num único quadro. Nunca no laço, mas numa GPU integrada
 *  é um engasgo visível bem no momento em que o usuário está olhando. Cair para
 *  128 corta 75 % do preenchimento dessas seis passadas (a geometria continua a
 *  mesma), e o resultado passa por PMREM logo em seguida, que borra por
 *  rugosidade — é amostragem, não decisão visual. */
const probeSize = () => getProfile().probeSize;
/** Past the bodywork the camera sits inside, so the truck cannot clip in. */
const PROBE_NEAR = 2.5;
const PROBE_FAR = 400;

let rt: THREE.WebGLCubeRenderTarget | null = null;
let pmrem: THREE.PMREMGenerator | null = null;
let baked: THREE.Texture | null = null;

export interface ProbeOptions {
  /** World point to capture from — normally the middle of the rig. */
  at: THREE.Vector3;
  /** Hidden for the capture. The vehicle must not see itself. */
  hide: THREE.Object3D[];
}

/**
 * Capture the scene from `at` and return a prefiltered environment texture.
 * Returns null if the capture could not run; callers keep the HDRI in that case.
 *
 * The returned texture is owned here and disposed on the next call, so callers
 * must re-read it rather than hold it across refreshes.
 */
export function captureReflectionProbe(opts: ProbeOptions): THREE.Texture | null {
  try {
    /* O ALVO É CACHEADO E O TAMANHO É DO PERFIL, então o cache tem de conferir
       o tamanho — não só a existência. Sem a segunda condição, uma sessão que
       abrisse em Alta e caísse para Baixo continuaria sondando a 256² para
       sempre, e o botão pareceria não fazer nada (que é exatamente a classe de
       defeito que esta passagem existe para corrigir). Trocar de tamanho é raro:
       acontece na mudança de nível, não a cada sonda. */
    const side = probeSize();
    if (rt && rt.width !== side) { rt.dispose(); rt = null; }
    if (!rt) {
      rt = new THREE.WebGLCubeRenderTarget(side, { type: THREE.HalfFloatType });
    }
    if (!pmrem) {
      pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileCubemapShader();
    }
    const cam = new THREE.CubeCamera(PROBE_NEAR, PROBE_FAR, rt);
    cam.position.copy(opts.at);
    cam.updateMatrixWorld(true);

    const wasVisible = opts.hide.map((o) => o.visible);
    opts.hide.forEach((o) => { o.visible = false; });
    /* The shadow map is not re-rendered for the probe: it is the scene's own,
       already current, and six extra depth passes would double the cost for a
       difference no reflection at this resolution can carry. */
    const autoUpdate = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    try {
      cam.update(renderer, scene);
    } finally {
      renderer.shadowMap.autoUpdate = autoUpdate;
      opts.hide.forEach((o, i) => { o.visible = wasVisible[i]; });
    }

    const next = pmrem.fromCubemap(rt.texture).texture;
    /* Dispose AFTER the new bake exists: fromCubemap can throw on a lost context,
       and dropping the old one first would leave the vehicle with no environment
       at all rather than a stale but correct one. */
    if (baked && baked !== next) baked.dispose();
    baked = next;
    return baked;
  } catch (e: unknown) {
    console.warn('[probe] captura falhou — os metais seguem no HDRI.',
      e instanceof Error ? e.message : String(e));
    return null;
  }
}

/** Free everything. Called when the studio unmounts. */
export function disposeReflectionProbe() {
  baked?.dispose();
  baked = null;
  rt?.dispose();
  rt = null;
  pmrem?.dispose();
  pmrem = null;
}
