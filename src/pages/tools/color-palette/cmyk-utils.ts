/** CMYK ↔ RGB color conversion utilities for the True Color System */

export function cmykToRgb(c: number, m: number, y: number, k: number): [number, number, number] {
  const C = c / 100;
  const M = m / 100;
  const Y = y / 100;
  const K = k / 100;
  return [
    Math.round(255 * (1 - C) * (1 - K)),
    Math.round(255 * (1 - M) * (1 - K)),
    Math.round(255 * (1 - Y) * (1 - K)),
  ];
}

export function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const K = 1 - Math.max(R, G, B);
  if (K >= 0.999) return [0, 0, 0, 100];
  return [
    Math.round(((1 - R - K) / (1 - K)) * 100),
    Math.round(((1 - G - K) / (1 - K)) * 100),
    Math.round(((1 - B - K) / (1 - K)) * 100),
    Math.round(K * 100),
  ];
}

/** CMYK representation of a color with K capped at 55%, redistributing excess into CMY. */
export function rgbToCmykCap55(r: number, g: number, b: number): [number, number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255;
  const kCanonical = 1 - Math.max(R, G, B);
  const kCapped = Math.min(kCanonical, 0.55);
  const denom = 1 - kCapped;
  if (denom < 0.001) return [100, 100, 100, 55];
  return [
    Math.max(0, Math.min(100, Math.round(((1 - R - kCapped) / denom) * 100))),
    Math.max(0, Math.min(100, Math.round(((1 - G - kCapped) / denom) * 100))),
    Math.max(0, Math.min(100, Math.round(((1 - B - kCapped) / denom) * 100))),
    Math.round(kCapped * 100),
  ];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  if (d !== 0) {
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(max * 100)];
}

export function isLightColor(r: number, g: number, b: number): boolean {
  // WCAG relative luminance (sRGB gamma-corrected). Threshold 0.179 is the
  // perceptual crossover: above it, a black overlay has more contrast than white.
  const linearize = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b) > 0.179;
}

/** Build array of values from 0..max by step that fall within [min, max] filter */
export function buildRange(step: number, filterMin: number, filterMax: number): number[] {
  const arr: number[] = [];
  const maxValue = Math.floor(100 / step) * step;
  for (let v = 0; v <= maxValue; v += step) {
    if (v >= filterMin && v <= filterMax) arr.push(v);
  }
  return arr;
}

export function cellId(y: number, k: number, c: number, m: number): string {
  return `y${y}|k${k}|c${c}|m${m}`;
}

export function parseCellId(id: string): { y: number; k: number; c: number; m: number } | null {
  const match = id.match(/^y(\d+)\|k(\d+)\|c(\d+)\|m(\d+)$/);
  if (!match) return null;
  return { y: +match[1], k: +match[2], c: +match[3], m: +match[4] };
}

/**
 * Parse a color string (hex, rgb, cmyk, hsl) into an RGB tuple.
 * Returns null if the input can't be parsed.
 */
export function parseColorToRgb(input: string): [number, number, number] | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  // HEX: #RGB, #RRGGBB, RGB, RRGGBB
  const hexMatch = s.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }

  // rgb(r, g, b)
  const rgbMatch = s.match(/^rgb\s*\(\s*(\d{1,3})\s*[,/\s]\s*(\d{1,3})\s*[,/\s]\s*(\d{1,3})\s*\)$/);
  if (rgbMatch) return [Math.min(255, +rgbMatch[1]), Math.min(255, +rgbMatch[2]), Math.min(255, +rgbMatch[3])];

  // cmyk(c, m, y, k) — convert to RGB
  const cmykMatch = s.match(
    /^(?:cmyk\s*\(\s*)?(\d{1,3})%?\s*[,/\s]\s*(\d{1,3})%?\s*[,/\s]\s*(\d{1,3})%?\s*[,/\s]\s*(\d{1,3})%?\s*\)?$/,
  );
  if (cmykMatch) {
    return cmykToRgb(Math.min(100, +cmykMatch[1]), Math.min(100, +cmykMatch[2]), Math.min(100, +cmykMatch[3]), Math.min(100, +cmykMatch[4]));
  }

  // hsl(h, s%, l%)
  const hslMatch = s.match(/^hsl\s*\(\s*(\d{1,3})\s*[,/\s]\s*(\d{1,3})%?\s*[,/\s]\s*(\d{1,3})%?\s*\)$/);
  if (hslMatch) return hslToRgb(+hslMatch[1], +hslMatch[2], +hslMatch[3]);

  // Bare 3 numbers → RGB
  const threeMatch = s.match(/^(\d{1,3})\s*[,/\s]\s*(\d{1,3})\s*[,/\s]\s*(\d{1,3})$/);
  if (threeMatch) return [Math.min(255, +threeMatch[1]), Math.min(255, +threeMatch[2]), Math.min(255, +threeMatch[3])];

  return null;
}

/**
 * Find the grid cell (C, M, Y, K) whose displayed RGB is closest to the target RGB.
 * Brute-force search across all K/Y levels and C/M steps.
 */
export function findClosestCell(
  targetR: number,
  targetG: number,
  targetB: number,
  step: number,
  kLevels: number[],
  yLevels: number[],
): { c: number; m: number; y: number; k: number } {
  let bestDist = Infinity;
  let best = { c: 0, m: 0, y: 0, k: kLevels[0] };
  const maxVal = Math.floor(100 / step) * step;

  for (const k of kLevels) {
    for (const y of yLevels) {
      for (let c = 0; c <= maxVal; c += step) {
        for (let m = 0; m <= maxVal; m += step) {
          const [r, g, b] = cmykToRgb(c, m, y, k);
          const dist = (r - targetR) ** 2 + (g - targetG) ** 2 + (b - targetB) ** 2;
          if (dist < bestDist) {
            bestDist = dist;
            best = { c, m, y, k };
            if (dist === 0) return best; // exact match
          }
        }
      }
    }
  }
  return best;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
