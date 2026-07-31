/* High-resolution capture — what the "Baixar imagem" button actually downloads.

   WHY THIS MODULE EXISTS. The obvious implementation is one line:

       a.href = renderer.domElement.toDataURL('image/png');

   and that is what this used to be. The problem is not the encoding — PNG is
   lossless — it is the SIZE. That call reads back the on-screen drawing buffer,
   whose dimensions are fixed by two lines in scene.ts: `setSize(w, h)` with the
   holder's CSS size, and `setPixelRatio(min(devicePixelRatio, 2))`. So the
   exported file came out at *holder size x DPR, capped at 2x* — roughly
   1500x900 on a 1080p desktop monitor, and never more than 2x even on a 4K
   panel. Same code, half the pixels depending on the display: which is why the
   export could look acceptable on a laptop and mushy on a desktop.

   So the fix is to render ONE off-screen frame at a higher resolution, read
   that back, and put everything exactly as it was. Nothing here changes the
   studio's steady-state cost: every knob this file turns is restored in the
   `finally`, and the oversized buffer is handed back to the driver the moment
   `resize()` runs. The studio idles at exactly the weight it did before.

   THE FOUR THINGS THAT MAKE IT CORRECT, none of them optional:

   1. `setSize(w, h, false)` — updateStyle FALSE. The canvas keeps its CSS size
      and only the backing store grows, so the page does not reflow and the
      viewport does not visibly resize under the user.

   2. Both axes scale by the same factor, so the camera's aspect is unchanged
      and the framing of the export is exactly the framing on screen. No camera
      state is touched at all.

   3. The render loop is STOPPED around the whole operation. The encode is
      async, and a loop left running would re-render the scene at the capture
      size for as long as the encode takes — burning a 12-megapixel frame every
      16 ms — and would be racing the readback for the same buffer.

   4. `toBlob`, never `toDataURL`. A 12 MP PNG as base64 is a string tens of
      megabytes long, and browsers cap the size of a `data:` URL a download can
      point at. An object URL has neither problem, and `toBlob` also lets the
      engine encode off the main thread.

   THE SHADOW MAP is the one thing that does not scale by itself. It is a fixed
   3072^2 depth target (SHADOW_MAP_SIZE in scene.ts), so at 3x the shadows would
   stay exactly as coarse while the geometry around them got three times
   sharper — the softness would read as a defect rather than as PCF. It is
   therefore bumped for the capture frame and put back afterwards. This is the
   expensive part of the operation (a 4096^2 depth target is ~67 MB, and the
   restore pays for a second reallocation), which is why it is capped and why
   the caller is expected to have an overlay up.

   WHAT IS DELIBERATELY NOT DONE: the environment map is left alone. The near
   band picks its 4k/2k variant by distance (environment.ts), and asking for a
   sharper one mid-capture means a network fetch and a PMREM re-bake — seconds
   of wait and a lot of memory for something that is behind the truck and
   already blurred by the tone mapping. */
import { renderer, scene, camera, holder, resize, getKeyLight, startLoop, stopLoop } from './scene';
import { root } from '../core/dom';

/** How much sharper than the screen the export is, before the clamps below. */
const DEFAULT_SCALE = 3;

/* Ceiling on the exported image, in pixels. 16 MP is ~5300x3000 — a generous
   print size — and is the number that keeps this safe on the weak integrated
   GPUs this studio also has to run on. The default framebuffer is multisampled
   (`antialias: true`), so the driver allocates several bytes per pixel per
   sample here; asking for a 3x buffer on a 2560-wide window with no ceiling is
   how a capture turns into a lost WebGL context, which would take the whole
   studio down rather than merely failing to save a file. */
const MAX_PIXELS = 16e6;

/* Ceiling on the boosted shadow map. 4096^2 is one doubling of the steady-state
   3072^2 and already ~67 MB of depth target; 8192^2 would be 268 MB for a
   difference PCF blurs past anyway (see the SHADOW_MAP_SIZE note in scene.ts,
   which made the same trade in the other direction). */
const MAX_SHADOW = 4096;

export interface CaptureResult {
  blob: Blob;
  /** the exported image's real pixel dimensions, after every clamp */
  width: number;
  height: number;
  /** what the scale actually resolved to — may be below the one requested */
  scale: number;
}

export interface CaptureOptions {
  /** upscale factor to aim for; clamped against the GPU and MAX_PIXELS */
  scale?: number;
  /** bump the shadow map to match the higher resolution. Default true. */
  sharpenShadows?: boolean;
}

/* Promisified toBlob. `toBlob` reports failure by handing back null rather than
   by throwing, and the one thing that must not happen is a rejected promise
   skipping the caller's restore path — so every failure mode arrives here as a
   plain null and the caller decides. */
function encodePng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

/**
 * What the requested scale survives as, once the GPU's limits and MAX_PIXELS
 * have had their say. Never returns less than 1: a capture must never come out
 * SMALLER than what is on screen, which is what a naive clamp would do on a
 * window already wider than the device's maximum renderbuffer.
 */
function resolveScale(w: number, h: number, want: number): number {
  const caps = renderer.capabilities;
  const gl = renderer.getContext();
  /* MAX_RENDERBUFFER_SIZE is the limit that actually applies to the drawing
     buffer, and it is not always the same as MAX_TEXTURE_SIZE; take whichever
     is smaller, and fall back to the texture limit if the query comes back
     empty (some drivers report 0 for parameters they do not implement). */
  const rbMax = Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)) || caps.maxTextureSize;
  const edgeMax = Math.max(1, Math.min(rbMax, caps.maxTextureSize));
  const byEdge = Math.min(edgeMax / w, edgeMax / h);
  const byArea = Math.sqrt(MAX_PIXELS / (w * h));
  return Math.max(1, Math.min(want, byEdge, byArea));
}

/**
 * Render one frame at up to `scale`x the viewport and hand back a PNG blob.
 *
 * BLOCKING: the oversized render happens synchronously on the main thread and
 * can take a few hundred milliseconds. Callers must put an overlay up and let
 * the browser PAINT it — two animation frames — before awaiting this, or the
 * indicator will not appear until the work it is announcing is already over.
 *
 * The scene is left exactly as it was found, including after a failure.
 */
export async function captureViewport(opts: CaptureOptions = {}): Promise<CaptureResult> {
  const w = holder.clientWidth;
  const h = holder.clientHeight;
  /* A detached or collapsed holder is a normal state here (route change, Ankaa's
     sidebar animating), and it is also the one case where the restore below
     could not put the renderer back — resize() bails on a zero-sized holder. So
     refuse the capture outright rather than half-perform it. */
  if (!w || !h) throw new Error('O viewport está sem tamanho.');

  const scale = resolveScale(w, h, Math.max(1, opts.scale ?? DEFAULT_SCALE));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));

  const key = getKeyLight();
  const prevRatio = renderer.getPixelRatio();
  /* .clone(), not a reference: mapSize is a live Vector2 that we are about to
     mutate in place, so holding the object would "save" the new value. */
  const prevShadow = key.shadow.mapSize.clone();
  const wantShadow = Math.min(
    MAX_SHADOW,
    renderer.capabilities.maxTextureSize,
    Math.round(prevShadow.x * scale),
  );
  const bumpShadow = opts.sharpenShadows !== false && wantShadow > prevShadow.x;

  stopLoop();
  try {
    /* three sizes a shadow map once and caches the render target, so changing
       mapSize alone does nothing. Disposing and nulling it is the documented way
       to force the reallocation on the next render. */
    if (bumpShadow) {
      key.shadow.mapSize.set(wantShadow, wantShadow);
      key.shadow.map?.dispose();
      key.shadow.map = null;
    }

    /* Pixel ratio to 1 and the whole multiplier expressed in setSize: the two
       compose, so leaving a DPR of 2 in place would silently double the request
       again and blow past both clamps above. */
    renderer.setPixelRatio(1);
    renderer.setSize(outW, outH, false);
    renderer.render(scene, camera);

    const blob = await encodePng(renderer.domElement);
    if (!blob) throw new Error('O navegador não conseguiu codificar a imagem.');
    return { blob, width: outW, height: outH, scale };
  } finally {
    /* Order matters. The shadow map goes back FIRST so that the normal-size
       render below is what pays for its reallocation — that hitch then happens
       while the caller's overlay is still up, instead of as a dropped frame the
       moment the scene comes back to life. */
    if (bumpShadow) {
      key.shadow.mapSize.copy(prevShadow);
      key.shadow.map?.dispose();
      key.shadow.map = null;
    }
    renderer.setPixelRatio(prevRatio);
    resize();
    renderer.render(scene, camera);
    /* Only resume if the studio is still on the page. unmountStudio() stops the
       loop and detaches `root`, and a capture in flight across that route change
       would otherwise restart a loop nobody can see and nobody will ever stop —
       it would render for the rest of the browser session. The next
       mountStudio() calls startLoop() itself. */
    if (root.isConnected) startLoop();
  }
}
