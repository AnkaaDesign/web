import QRCode, { type QRCodeErrorCorrectionLevel } from "qrcode";

// Cut-optimized QR code vectorization.
//
// Instead of emitting one <rect> per dark module (which produces hundreds of
// independent paths and wreaks havoc on plotters/cutters), we trace the outline
// of every connected region of dark modules and emit ONE closed polygon per
// region. Holes inside finder patterns become inner sub-paths with reversed
// winding so a non-zero / even-odd fill rule renders them correctly while a
// cutter follows them as natural inner cuts.
//
// All coordinates are integers in module units, which guarantees crisp 1:1
// modules and predictable plotter behaviour (no anti-aliasing artefacts).

export type QrPoint = [number, number];
export type QrPolygon = QrPoint[];

export interface QrVectorData {
  size: number;
  matrix: Uint8Array;
  polygons: QrPolygon[];
}

/** Build the raw QR matrix using the qrcode library. */
export function getQrMatrix(
  payload: string,
  errorCorrection: QRCodeErrorCorrectionLevel,
): { size: number; matrix: Uint8Array } {
  const qr = QRCode.create(payload, { errorCorrectionLevel: errorCorrection });
  return {
    size: qr.modules.size,
    matrix: qr.modules.data as unknown as Uint8Array,
  };
}

const isDark = (matrix: Uint8Array, size: number, r: number, c: number): boolean =>
  r >= 0 && r < size && c >= 0 && c < size && matrix[r * size + c] === 1;

/**
 * Trace the outline of every dark region as a closed polygon.
 *
 * Each unit edge between a dark cell and a non-dark cell is oriented so that
 * the dark side is on the right (i.e. the segments wind clockwise around
 * outer boundaries and counter-clockwise around holes, in screen-down
 * coordinates).
 *
 * At "saddle points" — corners where two diagonally-adjacent cells are dark
 * and the other two are light — four segments meet at the same vertex. To
 * keep the diagonally-touching dark cells as SEPARATE 4-connected components
 * (rather than letting the chain leak across the diagonal and produce a
 * slashed polygon), we apply the right-turn rule: from any incoming
 * direction, the chain prefers the outgoing segment that is a 90° clockwise
 * turn. At regular non-saddle points there is only one outgoing segment, so
 * the rule is trivially satisfied.
 *
 * Finally, collinear vertices are collapsed so a 10-module-wide run becomes
 * a single line segment instead of ten.
 */
export function traceContours(matrix: Uint8Array, size: number): QrPolygon[] {
  const startX: number[] = [];
  const startY: number[] = [];
  const endX: number[] = [];
  const endY: number[] = [];
  // Multiple segments can share a start point (saddle vertices have 2),
  // so the lookup table stores a list of segment indices per point.
  const startMap = new Map<number, number[]>();

  const pointKey = (x: number, y: number) => x * (size + 2) + y;

  const pushSeg = (sx: number, sy: number, ex: number, ey: number) => {
    const idx = startX.length;
    startX.push(sx);
    startY.push(sy);
    endX.push(ex);
    endY.push(ey);
    const key = pointKey(sx, sy);
    const list = startMap.get(key);
    if (list) list.push(idx);
    else startMap.set(key, [idx]);
  };

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isDark(matrix, size, r, c)) continue;

      // Top edge — dark below, walk left→right
      if (!isDark(matrix, size, r - 1, c)) pushSeg(c, r, c + 1, r);
      // Right edge — dark on left, walk top→bottom
      if (!isDark(matrix, size, r, c + 1)) pushSeg(c + 1, r, c + 1, r + 1);
      // Bottom edge — dark on top, walk right→left
      if (!isDark(matrix, size, r + 1, c)) pushSeg(c + 1, r + 1, c, r + 1);
      // Left edge — dark on right, walk bottom→top
      if (!isDark(matrix, size, r, c - 1)) pushSeg(c, r + 1, c, r);
    }
  }

  const used = new Uint8Array(startX.length);
  const polygons: QrPolygon[] = [];

  for (let i = 0; i < startX.length; i++) {
    if (used[i]) continue;

    const polygon: QrPolygon = [];
    let cursor: number | undefined = i;

    while (cursor !== undefined && !used[cursor]) {
      used[cursor] = 1;
      polygon.push([startX[cursor], startY[cursor]]);

      const ex = endX[cursor];
      const ey = endY[cursor];
      const candidates = startMap.get(pointKey(ex, ey));
      if (!candidates || candidates.length === 0) {
        cursor = undefined;
        break;
      }

      // Filter to unused candidates only
      let chosen: number | undefined;
      if (candidates.length === 1) {
        chosen = used[candidates[0]] ? undefined : candidates[0];
      } else {
        // Saddle (or otherwise multi-out) vertex — apply right-turn rule.
        // Incoming direction:
        const dInX = ex - startX[cursor];
        const dInY = ey - startY[cursor];
        // 90° clockwise rotation in screen-down coords: (x,y) → (-y,x)
        const rightX = -dInY;
        const rightY = dInX;
        for (const idx of candidates) {
          if (used[idx]) continue;
          const dOutX = endX[idx] - startX[idx];
          const dOutY = endY[idx] - startY[idx];
          if (dOutX === rightX && dOutY === rightY) {
            chosen = idx;
            break;
          }
        }
        if (chosen === undefined) {
          // Fallback: any unused outgoing (should not happen for valid grids)
          for (const idx of candidates) {
            if (!used[idx]) { chosen = idx; break; }
          }
        }
      }

      cursor = chosen;
    }

    if (polygon.length >= 3) polygons.push(simplifyCollinear(polygon));
  }

  return polygons;
}

/**
 * Remove vertices that lie on the same straight line as their neighbours.
 * For a QR matrix this collapses long horizontal/vertical runs into a single
 * line segment per side, e.g. a 10-module wide run becomes a 1-segment side
 * instead of 10. Cuts the file size and the cutter's pen-up motion.
 */
function simplifyCollinear(points: QrPolygon): QrPolygon {
  const n = points.length;
  if (n < 3) return points;
  const out: QrPolygon = [];
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const cur = points[i];
    const next = points[(i + 1) % n];
    const dx1 = cur[0] - prev[0];
    const dy1 = cur[1] - prev[1];
    const dx2 = next[0] - cur[0];
    const dy2 = next[1] - cur[1];
    // Cross product — non-zero means a real corner
    if (dx1 * dy2 - dx2 * dy1 !== 0) out.push(cur);
  }
  return out;
}

/**
 * Convert a list of polygons into a single SVG `d` attribute. Each polygon
 * is a closed sub-path so the renderer (or plotter) draws/cuts them
 * sequentially.
 */
export function polygonsToSvgPath(polygons: QrPolygon[]): string {
  let out = "";
  for (const poly of polygons) {
    if (poly.length < 3) continue;
    const [x0, y0] = poly[0];
    out += `M${x0} ${y0}`;
    for (let i = 1; i < poly.length; i++) {
      const [x, y] = poly[i];
      out += `L${x} ${y}`;
    }
    out += "Z";
  }
  return out;
}

/**
 * Build a fully self-contained, plotter-ready SVG document. The output is
 * intentionally minimal: no XML prologue, no metadata, integer module
 * coordinates, `shape-rendering="crispEdges"` to disable anti-aliasing, and
 * a single `<path>` element with non-zero fill rule that handles holes via
 * winding direction.
 */
export function buildCutOptimizedSvg(
  polygons: QrPolygon[],
  size: number,
  margin: number = 1,
): string {
  const total = size + margin * 2;
  const d = polygonsToSvgPath(polygons);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" ` +
    `shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet">` +
    `<g transform="translate(${margin} ${margin})">` +
    `<path d="${d}" fill="#000000" fill-rule="nonzero" stroke="none"/>` +
    `</g>` +
    `</svg>`
  );
}

/**
 * Compute the signed area of a polygon. Positive in screen coordinates
 * (y-down) means the polygon winds clockwise — i.e. it is an outer boundary.
 * Negative means counter-clockwise — a hole.
 */
export function polygonSignedArea(poly: QrPolygon): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

/** End-to-end helper: payload + EC level → ready-to-render vector data. */
export function generateQrVector(
  payload: string,
  errorCorrection: QRCodeErrorCorrectionLevel,
): QrVectorData {
  const { size, matrix } = getQrMatrix(payload, errorCorrection);
  const polygons = traceContours(matrix, size);
  return { size, matrix, polygons };
}
