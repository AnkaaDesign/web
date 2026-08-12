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

/* Puddle mask, used as a roughnessMap when the ground is wet. three reads the
   GREEN channel only and MULTIPLIES it by material.roughness, so white means
   "as rough as the material says" (damp film) and dark means mirror.

   ÁGUA NÃO É CARIMBO — POR QUE ISTO DEIXOU DE SER 90 ELIPSES.
   ---------------------------------------------------------------------------
   O que havia: 90 elipses de gradiente radial, `rot` SEMPRE 0, com 78 % delas
   presas a quatro frações fixas (`RUTS`). Três defeitos medidos na própria
   máscara, e os três aparecem como "as poças são muito padrão e repetitivas":

   1. TODA POÇA ERA A MESMA POÇA. Mesmo gradiente, mesma razão de eixos, nunca
      girada. O olho reconhece a forma na primeira e depois só a reencontra.
   2. AS QUATRO CALHAS VIRARAM UM PENTE. As frações de `RUTS` são as trilhas de
      pneu de um ladrilho que É a secção da pista — verdade no asfalto
      PROCEDURAL, falso num cenário com `set`, onde o ladrilho é um quadrado.
      Medido: 423 das 512 colunas com água, em quatro bandas verticais.
   3. NÃO ERA POÇA, ERA DILÚVIO. Somando as áreas, as 90 elipses cobriam mais de
      duas vezes o ladrilho: a pista inteira era espelho com listras claras no
      meio, e não uma pista com poças.

   O que há agora: um CAMPO DE ALTURA, que é o que decide onde água fica parada
   na vida real. fBm periódico de quatro oitavas, anisotrópico (a grade é mais
   grossa ao longo de v, então a lâmina se alonga na direção da via, como
   escorrimento), mais um segundo campo bem largo que faz umas zonas alagarem
   mais que outras. A água é o que está ABAIXO de um nível.

   E O NÍVEL SAI DA COBERTURA, NÃO DE UM PALPITE. `COVER` diz quanto do chão
   fica com água e o limiar é o quantil correspondente do próprio campo — um
   histograma, não um número mágico. Mexer na forma do ruído não muda mais a
   quantidade de água por acidente, que era o modo de falha do carimbo.

   TILEÁVEL POR CONSTRUÇÃO: a rede de cada oitava é indexada em módulo, então
   não há costura e não é preciso desenhar três vezes para atravessar a borda.
   O que impede o ladrilho de se ver é o ladrilhamento estocástico de set.ts —
   a máscara entra como `roughnessMap` e passa pela mesma `tsTiled()`. */
const PUDDLE_COVER = 0.16;   // fração do chão com lâmina de água
const PUDDLE_EDGE = 0.042;   // largura da orla molhada, em unidades do campo

export function makePuddleCanvas() {
  const S = 512;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = ctx2d(c);

  /* Semeado, e não `Math.random`: esta máscara é um ASSET. Com o gerador global
     ela mudava a cada carregamento, e "está diferente do print que te mandei"
     é uma pergunta impossível de responder. */
  let seed = 0x9e3779b9 | 0;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /* Uma oitava: rede aleatória de gx × gy amostrada com suavização de Hermite.
     Os índices são tomados em módulo — é isso que fecha a costura. */
  const octave = (gx: number, gy: number) => {
    const lat = new Float32Array(gx * gy);
    for (let i = 0; i < lat.length; i++) lat[i] = rnd();
    const out = new Float32Array(S * S);
    for (let y = 0; y < S; y++) {
      const fy = (y / S) * gy, y0 = Math.floor(fy), ty = fy - y0;
      const uy = ty * ty * (3 - 2 * ty);
      const ra = (y0 % gy) * gx, rb = ((y0 + 1) % gy) * gx;
      for (let x = 0; x < S; x++) {
        const fx = (x / S) * gx, x0 = Math.floor(fx), tx = fx - x0;
        const ux = tx * tx * (3 - 2 * tx);
        const xa = x0 % gx, xb = (x0 + 1) % gx;
        const a = lat[ra + xa] * (1 - ux) + lat[ra + xb] * ux;
        const b = lat[rb + xa] * (1 - ux) + lat[rb + xb] * ux;
        out[y * S + x] = a * (1 - uy) + b * uy;
      }
    }
    return out;
  };

  const fbm = (gx: number, gy: number, oct: number) => {
    const acc = new Float32Array(S * S);
    let amp = 1, norm = 0;
    for (let o = 0; o < oct; o++) {
      const f = octave(gx << o, gy << o);
      for (let i = 0; i < acc.length; i++) acc[i] += amp * f[i];
      norm += amp; amp *= 0.5;
    }
    for (let i = 0; i < acc.length; i++) acc[i] /= norm;
    return acc;
  };

  /* gy < gx: menos células ao longo de v, logo a feição fica ESTICADA nessa
     direção — que é a da via. É o único resquício de "a água segue a pista", e
     agora é anisotropia do campo em vez de quatro colunas fixas.

     6 x 3 EM QUATRO OITAVAS, e chegou a ser 3 x 2 em três. A troca foi feita
     junto com PUDDLE_SPAN = 1 e as duas juntas pioraram a cena — ver o bloco de
     PUDDLE_SPAN em scene.ts. Com o período de volta em 3.5 ladrilhos, a lâmina
     maior daqui mede ~1/6 do período: 3,5 m no asfalto, 4,7 m no pátio, 2,3 m
     na grama. Mexer nesta malha sem mexer no PUDDLE_SPAN muda o tamanho da poça
     em metros, porque quem converte fração em metro é ele. */
  const h = fbm(6, 3, 4);
  const zone = fbm(2, 2, 2);
  for (let i = 0; i < h.length; i++) h[i] += 0.09 * (zone[i] - 0.5) * 2;

  /* Limiar por COBERTURA: histograma de 1024 caixas e acumulado até COVER. */
  const BINS = 1024;
  const hist = new Int32Array(BINS);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < h.length; i++) { if (h[i] < lo) lo = h[i]; if (h[i] > hi) hi = h[i]; }
  const span = Math.max(1e-6, hi - lo);
  for (let i = 0; i < h.length; i++) {
    hist[Math.min(BINS - 1, ((h[i] - lo) / span * BINS) | 0)]++;
  }
  const alvo = PUDDLE_COVER * h.length;
  let acc = 0, bin = 0;
  while (bin < BINS - 1 && acc + hist[bin] < alvo) { acc += hist[bin]; bin++; }
  const lim = lo + (bin / BINS) * span;

  const img = g.createImageData(S, S);
  const d = img.data;
  for (let i = 0; i < h.length; i++) {
    const t = Math.min(1, Math.max(0, (h[i] - (lim - PUDDLE_EDGE)) / PUDDLE_EDGE));
    /* 20 = espelho (a água preenche o poro), 255 = a rugosidade do material. */
    const v = 255 - (1 - t) * 235;
    const k = i * 4;
    d[k] = d[k + 1] = d[k + 2] = v;
    d[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
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
