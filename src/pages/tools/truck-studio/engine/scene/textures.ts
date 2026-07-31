/* Procedural ground textures: the studio's zero-asset fallback surfaces.
   -------------------------------------------------------------------------
   Each canvas is built on first use and is what the scene shows when an
   environment supplies no PBR set of its own. Split out of scene.ts because
   these are pure functions of nothing — the one part of the scene module that
   can be read and tuned without a renderer in the room. */
import * as THREE from 'three';

/* Every generator below draws into an offscreen canvas. getContext('2d') is
   typed nullable because it returns null when the canvas already holds a
   context of a DIFFERENT kind — impossible here, since these canvases are
   created one line earlier and handed to nobody. Asserting once beats ~60
   `!` at the draw calls, and throwing beats returning null: a missing context
   is a dead studio either way, and this way it says so. Exported because
   scene.ts's buildSkyEnv() builds a canvas the same way. */
export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d');
  if (!g) throw new Error('[truck-studio] canvas 2D context unavailable');
  return g;
}

/* ---------------- procedural textures ---------------- */
export function canvasTex(
  c: HTMLCanvasElement, repX: number, repY: number, colorSpace?: THREE.ColorSpace,
) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = colorSpace === undefined ? THREE.SRGBColorSpace : colorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repX, repY);
  t.anisotropy = 8;
  return t;
}

/* wheel-track positions, shared by the asphalt wear and the puddle mask */
const RUTS = [0.16, 0.37, 0.63, 0.84];

export function makeAsphaltCanvas(withLines: boolean) {
  const S = 1024;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = ctx2d(c);
  g.fillStyle = '#2c2e31';
  g.fillRect(0, 0, S, S);
  /* multi-octave speckle */
  for (const [n, s, a] of [[26000, 1.5, 0.5], [9000, 3, 0.28], [2200, 6, 0.16]]) {
    for (let i = 0; i < n; i++) {
      const v = 30 + Math.random() * 46;
      g.fillStyle = `rgba(${v},${v},${v + 3},${a})`;
      g.fillRect(Math.random() * S, Math.random() * S, s, s);
    }
  }
  /* faint cracks */
  g.strokeStyle = 'rgba(12,13,15,.35)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 22; i++) {
    g.beginPath();
    let x = Math.random() * S, y = Math.random() * S;
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 90; y += Math.random() * 70; g.lineTo(x, y); }
    g.stroke();
  }
  if (withLines) {
    /* tire-wear darkening: two wheel tracks per lane */
    for (const u of RUTS) {
      const x = u * S;
      const grad = g.createLinearGradient(x - 46, 0, x + 46, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.5, 'rgba(0,0,0,.20)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(x - 46, 0, 92, S);
    }
    /* crisp lane markings */
    g.fillStyle = '#ece9df';
    for (let y = 0; y < S; y += 256) g.fillRect(S / 2 - 7, y, 14, 128);   // dashed center
    g.fillRect(30, 0, 12, S);                                             // edge lines
    g.fillRect(S - 42, 0, 12, S);
  }
  return c;
}

/* Puddle mask, used as a roughnessMap when the road is wet: water pools in the
   wheel-track depressions, so most blobs are pinned to the ruts. three reads
   the GREEN channel only and MULTIPLIES it by material.roughness, so white
   means "as rough as the material says" (damp film) and dark means mirror. */
export function makePuddleCanvas() {
  const S = 512;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = ctx2d(c);
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, S, S);
  const blob = (x: number, y: number, rx: number, ry: number, rot: number) => {
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, 'rgba(20,20,20,1)');
    grad.addColorStop(0.62, 'rgba(20,20,20,.92)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.scale(rx, ry);
    g.fillStyle = grad;
    g.beginPath(); g.arc(0, 0, 1, 0, 7); g.fill();
    g.restore();
  };
  for (let i = 0; i < 90; i++) {
    /* ~78 % of puddles sit in a rut; the rest are scattered */
    const inRut = Math.random() < 0.78;
    const x = inRut
      ? RUTS[(Math.random() * RUTS.length) | 0] * S + (Math.random() - 0.5) * 34
      : Math.random() * S;
    const y = Math.random() * S;
    const rx = 10 + Math.random() * 26;
    const ry = rx * (2.2 + Math.random() * 2.6);      // elongated along the road
    /* draw three times so blobs wrap across the seam in both axes */
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
      if (Math.abs(x + dx - S / 2) > S || Math.abs(y + dy - S / 2) > S) continue;
      blob(x + dx, y + dy, rx, ry, 0);
    }
  }
  return c;
}

/* THE GRASS BLADES ARE GONE, and this canvas (or, when an environment supplies
   one, a real 2k grass PBR set) is what carries grass now.

   What was here: 4200 instanced 0.42 x 0.32 m double-sided quads with a
   canvas-drawn blade texture and `alphaTest: 0.45`, scattered from x = ±7.2 out
   to ±55 m. The user's verdict on it was "the grass are terrible", and every
   reason is structural rather than a tuning problem:

     * SCALE. From the default camera (~24 m out) a 0.42 m quad is about 1.5
       screen pixels. Sub-pixel geometry is not grass, it is green noise.
     * ALIASING. alphaTest is a hard cutout with no coverage blending, so every
       one of those 1.5 px quads crawls on every camera move. That crawl was
       the single most "CG" thing in the frame.
     * NO LIGHTING. A vertical double-sided quad has a horizontal normal, so
       under any sun above ~30° it receives almost no key light and reads as a
       flat green sticker lying on the ground.
     * NO CONTACT. InstancedMesh defaults castShadow to false and nothing set
       it, so 4200 objects stood on the ground casting nothing.
     * DENSITY. 4200 quads over ~13 000 m² is 0.3 per m². Real grass at a
       truck's viewing distance is a TEXTURE, and a 2k albedo+normal+AO at a
       3 m tile is ~460 000 texels per tile against 0.3 quads.

   Doing it properly means a card atlas, wind, an LOD cross-fade and shadow
   casting — a hair-system project that would still lose to a good tiled PBR at
   5–30 m, which is the only distance this configurator is ever viewed from.
   So: deleted, not retextured. `setNearGround()` + macro variation is the
   replacement, and this canvas remains the zero-asset fallback. */
export function makeGrassCanvas() {
  const S = 512;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = ctx2d(c);
  g.fillStyle = '#3d5f2a';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = ['rgba(70,107,47,.35)', 'rgba(54,84,38,.4)', 'rgba(96,124,58,.3)', 'rgba(120,134,70,.22)'][i % 4];
    g.beginPath();
    g.ellipse(Math.random() * S, Math.random() * S, 25 + Math.random() * 70, 15 + Math.random() * 45, Math.random() * 3, 0, 7);
    g.fill();
  }
  const shades = ['#4c7a33', '#557f2f', '#6b8f3a', '#2f4a20', '#7f9a4a', '#40651f'];
  for (let i = 0; i < 26000; i++) {
    g.fillStyle = shades[(Math.random() * shades.length) | 0];
    g.globalAlpha = 0.45;
    g.fillRect(Math.random() * S, Math.random() * S, 1.2, 2 + Math.random() * 3);
  }
  g.globalAlpha = 1;
  return c;
}

export function makeGravelCanvas() {
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = ctx2d(c);
  g.fillStyle = '#6b6257';
  g.fillRect(0, 0, S, S);
  const shades = ['#7a7164', '#5c544a', '#8a8274', '#4e463d', '#9a927f'];
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = shades[(Math.random() * shades.length) | 0];
    g.globalAlpha = 0.6;
    const s = 1 + Math.random() * 3;
    g.fillRect(Math.random() * S, Math.random() * S, s, s);
  }
  g.globalAlpha = 1;
  return c;
}

/* Two blob scales, each stamped on a ±S lattice so the canvas tiles without a
   seam. Value noise would be more elegant and much more code for a 256²
   texture built once at boot. */
export function makeMacroCanvas() {
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = ctx2d(c);
  g.fillStyle = '#808080';                // mid grey ⇒ neutral multiplier
  g.fillRect(0, 0, S, S);
  const blob = (x: number, y: number, r: number, v: number, a: number) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(${v},${v},${v},${a})`);
    grad.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  for (const [n, rmin, rspan, alpha] of [[14, 70, 60, 0.50], [40, 22, 38, 0.32]]) {
    for (let i = 0; i < n; i++) {
      const x = Math.random() * S, y = Math.random() * S;
      const r = rmin + Math.random() * rspan;
      const v = Math.random() < 0.5 ? 22 : 232;
      for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) blob(x + dx, y + dy, r, v, alpha);
    }
  }
  return c;
}
