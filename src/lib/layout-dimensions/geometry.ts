/**
 * Leitura da geometria vetorial de uma página de PDF.
 *
 * O layout que o projetista entrega é vetorial: cada adesivo é um caminho, e o
 * contorno da face é um retângulo. Ler os caminhos dá o extremo EXATO de cada
 * peça — nada de rasterizar e caçar pixel, que erra na borda e engasga em
 * arquivo de 15 metros.
 *
 * Coordenadas: tudo sai em pt da página com origem no canto superior esquerdo e
 * y para baixo, que é como o visualizador desenha. A composição é
 * `viewport.transform ∘ pilha de CTM`.
 */

import type { Matrix, PageGeometry, Pt, Rect, RGB, VectorObject } from "./types";

/** Códigos de operador do pdf.js que interessam (estáveis desde a v3). */
const OP = {
  save: 10,
  restore: 11,
  transform: 12,
  stroke: 20,
  closeStroke: 21,
  fill: 22,
  eoFill: 23,
  fillStroke: 24,
  eoFillStroke: 25,
  closeFillStroke: 26,
  closeEOFillStroke: 27,
  endPath: 28,
  clip: 29,
  eoClip: 30,
  setStrokeRGBColor: 58,
  setFillRGBColor: 59,
  setLineWidth: 2,
  paintImageXObject: 85,
  paintInlineImageXObject: 86,
  paintImageMaskXObject: 83,
  constructPath: 91,
} as const;

export function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export function apply(m: Matrix, x: number, y: number): Pt {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

/** Escala média da matriz — serve para converter espessura de traço. */
function matrixScale(m: Matrix): number {
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
}

export function emptyRect(): Rect {
  return { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
}

export function growRect(r: Rect, p: Pt): void {
  if (p.x < r.x0) r.x0 = p.x;
  if (p.y < r.y0) r.y0 = p.y;
  if (p.x > r.x1) r.x1 = p.x;
  if (p.y > r.y1) r.y1 = p.y;
}

export function isRectValid(r: Rect): boolean {
  return r.x1 >= r.x0 && r.y1 >= r.y0;
}

export function rectWidth(r: Rect): number {
  return r.x1 - r.x0;
}

export function rectHeight(r: Rect): number {
  return r.y1 - r.y0;
}

export function rectArea(r: Rect): number {
  return Math.max(0, rectWidth(r)) * Math.max(0, rectHeight(r));
}

/**
 * Achata um cúbico em segmentos de reta. O passo é escolhido pelo tamanho da
 * corda: curva pequena vira 4 pedaços, curva de metros vira 24 — o suficiente
 * para o extremo não escorregar mais que décimo de milímetro.
 */
function flattenCubic(out: Pt[], p0: Pt, p1: Pt, p2: Pt, p3: Pt): void {
  const chord =
    Math.hypot(p3.x - p0.x, p3.y - p0.y) +
    Math.hypot(p1.x - p0.x, p1.y - p0.y) +
    Math.hypot(p2.x - p1.x, p2.y - p1.y) +
    Math.hypot(p3.x - p2.x, p3.y - p2.y);
  const steps = Math.min(24, Math.max(4, Math.ceil(chord / 6)));
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    const u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
}

/** Decodifica os segmentos empacotados que o pdf.js entrega em `constructPath`. */
function decodePath(segments: ArrayLike<number>[], ctm: Matrix): Pt[][] {
  const polys: Pt[][] = [];
  let current: Pt[] = [];
  let cursor: Pt = { x: 0, y: 0 };
  const push = (p: Pt) => {
    current.push(p);
    cursor = p;
  };
  const close = () => {
    if (current.length > 1) polys.push(current);
    current = [];
  };
  for (const seg of segments) {
    let i = 0;
    while (i < seg.length) {
      const cmd = seg[i];
      if (cmd === 0) {
        close();
        push(apply(ctm, seg[i + 1], seg[i + 2]));
        i += 3;
      } else if (cmd === 1) {
        push(apply(ctm, seg[i + 1], seg[i + 2]));
        i += 3;
      } else if (cmd === 2) {
        const p1 = apply(ctm, seg[i + 1], seg[i + 2]);
        const p2 = apply(ctm, seg[i + 3], seg[i + 4]);
        const p3 = apply(ctm, seg[i + 5], seg[i + 6]);
        flattenCubic(current, cursor, p1, p2, p3);
        cursor = p3;
        i += 7;
      } else if (cmd === 3) {
        if (current.length > 1) {
          current.push({ ...current[0] });
          polys.push(current);
          current = [];
        } else {
          current = [];
        }
        i += 1;
      } else {
        i += 1; // operador desconhecido: pula sem quebrar o resto
      }
    }
  }
  close();
  return polys;
}

/**
 * O pdf.js normaliza a cor para string CSS (`"#rrggbb"`) na lista de
 * operadores; versões mais antigas entregavam a tripla ou o inteiro empacotado.
 * Aceitar as três formas evita depender da versão exata do pacote.
 */
function toRGB(args: unknown): RGB | null {
  if (typeof args === "string") {
    const hex = args.trim();
    if (/^#[0-9a-f]{6}$/i.test(hex)) {
      return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
      ];
    }
    const m = hex.match(/rgba?\(([^)]+)\)/i);
    if (m) {
      const parts = m[1].split(",").map((v) => Number(v.trim()));
      if (parts.length >= 3 && parts.every((v) => Number.isFinite(v))) {
        return [Math.round(parts[0]), Math.round(parts[1]), Math.round(parts[2])];
      }
    }
    return null;
  }
  if (typeof args === "number") {
    return [(args >> 16) & 0xff, (args >> 8) & 0xff, args & 0xff];
  }
  if (Array.isArray(args) && args.length >= 3) {
    const [r, g, b] = args as number[];
    const scale = r <= 1 && g <= 1 && b <= 1 ? 255 : 1;
    return [Math.round(r * scale), Math.round(g * scale), Math.round(b * scale)];
  }
  return null;
}

interface PageLike {
  getViewport(params: { scale: number; rotation?: number }): {
    width: number;
    height: number;
    transform: number[];
  };
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
}

/**
 * Percorre a lista de operadores mantendo a pilha gráfica e devolve um objeto
 * por caminho pintado.
 */
export async function readPageGeometry(
  page: PageLike,
  options: { rotation?: number; maxObjects?: number } = {},
): Promise<PageGeometry> {
  const maxObjects = options.maxObjects ?? 40000;
  const viewport = page.getViewport({ scale: 1, rotation: options.rotation });
  const base = viewport.transform as Matrix;
  const list = await page.getOperatorList();

  const objects: VectorObject[] = [];
  const stack: { ctm: Matrix; fill: RGB | null; stroke: RGB | null; lineWidth: number }[] = [];
  let ctm: Matrix = base;
  let fill: RGB | null = null;
  let stroke: RGB | null = null;
  let lineWidth = 1;
  let pending: { polys: Pt[][]; paint: number } | null = null;

  const emit = (paint: number) => {
    if (!pending) return;
    const isClip = paint === OP.clip || paint === OP.eoClip || paint === OP.endPath;
    const isStroke =
      paint === OP.stroke ||
      paint === OP.closeStroke ||
      paint === OP.fillStroke ||
      paint === OP.eoFillStroke ||
      paint === OP.closeFillStroke ||
      paint === OP.closeEOFillStroke;
    const isFill =
      paint === OP.fill ||
      paint === OP.eoFill ||
      paint === OP.fillStroke ||
      paint === OP.eoFillStroke ||
      paint === OP.closeFillStroke ||
      paint === OP.closeEOFillStroke;
    const bbox = emptyRect();
    for (const poly of pending.polys) for (const p of poly) growRect(bbox, p);
    if (isRectValid(bbox) && objects.length < maxObjects) {
      objects.push({
        index: objects.length,
        op: isClip ? "clip" : isFill && isStroke ? "fillStroke" : isFill ? "fill" : "stroke",
        bbox,
        outline: pending.polys,
        fill: isFill ? fill : null,
        stroke: isStroke ? stroke : null,
        lineWidth: lineWidth * matrixScale(ctm),
      });
    }
    pending = null;
  };

  for (let i = 0; i < list.fnArray.length; i += 1) {
    const fn = list.fnArray[i];
    const args = list.argsArray[i] as unknown[];
    switch (fn) {
      case OP.save:
        stack.push({ ctm, fill, stroke, lineWidth });
        break;
      case OP.restore: {
        const prev = stack.pop();
        if (prev) ({ ctm, fill, stroke, lineWidth } = prev);
        break;
      }
      case OP.transform:
        ctm = multiply(ctm, args as unknown as Matrix);
        break;
      case OP.setFillRGBColor:
        fill = toRGB(args.length === 1 ? args[0] : args);
        break;
      case OP.setStrokeRGBColor:
        stroke = toRGB(args.length === 1 ? args[0] : args);
        break;
      case OP.setLineWidth:
        lineWidth = Number(args[0]) || 0;
        break;
      case OP.constructPath: {
        const paint = Number(args[0]);
        const segments = (args[1] as ArrayLike<number>[]) ?? [];
        pending = { polys: decodePath(segments, ctm), paint };
        emit(paint);
        break;
      }
      case OP.paintImageXObject:
      case OP.paintInlineImageXObject:
      case OP.paintImageMaskXObject: {
        // A imagem ocupa o quadrado unitário do espaço corrente.
        const corners = [apply(ctm, 0, 0), apply(ctm, 1, 0), apply(ctm, 1, 1), apply(ctm, 0, 1)];
        const bbox = emptyRect();
        for (const c of corners) growRect(bbox, c);
        if (objects.length < maxObjects) {
          objects.push({
            index: objects.length,
            op: "image",
            bbox,
            outline: [[...corners, corners[0]]],
            fill: null,
            stroke: null,
            lineWidth: 0,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  return { width: viewport.width, height: viewport.height, objects };
}
