import { useEffect, useRef, useState } from "react";
import { pdfjs } from "react-pdf";
import { IconLoader2 } from "@tabler/icons-react";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

type PDFDocumentProxy = Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
type PDFPageProxy = Awaited<ReturnType<PDFDocumentProxy["getPage"]>>;

/**
 * Affine transform matrix in PDF/CSS notation: [a, b, c, d, tx, ty]
 *
 *  | a  c  tx |
 *  | b  d  ty |
 *  | 0  0   1 |
 */
type Matrix = [number, number, number, number, number, number];

/**
 * Concatenate two affine transforms — equivalent to the matrix product m1 × m2.
 *
 * To convert a point from text-space to screen-space:
 *   screen = viewport.transform × item.transform × point
 * → combined = concatTransform(viewport.transform, item.transform)
 */
function concatTransform(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],  // a
    m1[1] * m2[0] + m1[3] * m2[1],  // b
    m1[0] * m2[2] + m1[2] * m2[3],  // c
    m1[1] * m2[2] + m1[3] * m2[3],  // d
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],  // tx
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],  // ty
  ];
}

interface PdfTextItem {
  str: string;
  transform: number[];
}

// ─── PageCanvas ──────────────────────────────────────────────────────────────

interface PageCanvasProps {
  page: PDFPageProxy;
  containerWidth: number;
}

function PageCanvas({ page, containerWidth }: PageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<ReturnType<PDFPageProxy["render"]> | null>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const textLayer = textLayerRef.current;
    if (!canvas || !textLayer || containerWidth <= 0) return;

    let cancelled = false;

    const run = async () => {
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;

      // Scale page to fill containerWidth exactly
      const baseVp = page.getViewport({ scale: 1 });
      const scale  = containerWidth / baseVp.width;
      const vp     = page.getViewport({ scale });

      setDims({ width: vp.width, height: vp.height });

      // ── Canvas (visual layer) ─────────────────────────────────────────────
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = vp.width  * dpr;
      canvas.height = vp.height * dpr;
      canvas.style.width  = `${vp.width}px`;
      canvas.style.height = `${vp.height}px`;

      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, vp.width, vp.height);

      renderTaskRef.current = page.render({ canvasContext: ctx, viewport: vp });
      try {
        await renderTaskRef.current.promise;
      } catch (e: any) {
        if (e?.name === "RenderingCancelledException") return;
      }

      if (cancelled) return;

      // ── Text layer (selection layer) ──────────────────────────────────────
      const textContent = await page.getTextContent();
      if (cancelled) return;

      // viewport.transform maps PDF user-space → CSS pixel-space.
      // For an upright A4 page at scale s it is: [s, 0, 0, −s, 0, pageH·s]
      const vt = vp.transform as Matrix;

      /**
       * Fraction of em-height above the baseline (ascenders).
       * pdfjs uses DEFAULT_FONT_ASCENT = 0.8 internally.
       */
      const ASCENT_FRAC = 0.8;

      interface SpanData {
        str: string;
        /** CSS left (px) */
        left: number;
        /** CSS top (px)  =  baseline_y − ascent */
        top: number;
        /**
         * Raw screen-Y of the glyph baseline (= tx[5] from the combined
         * transform).  Used ONLY for sorting — NOT for CSS positioning.
         *
         * Why baseline and not top?
         * Items on the same physical line share an identical baseline but may
         * have different font sizes → different ascents → different `top` values.
         * Sorting by `top` would wrongly split same-line items into separate
         * groups.  Sorting by `baseline` keeps them together regardless of size.
         */
        baseline: number;
        fontHeight: number;
        angle: number;
      }

      const spans: SpanData[] = [];

      for (const raw of textContent.items) {
        const item = raw as PdfTextItem;
        if (!item.str) continue;

        // Combined transform: text-space → screen-space
        const tx = concatTransform(vt, item.transform as Matrix);

        // Font height = magnitude of the y-column vector [c, d]
        // (the y-column tells us how a unit vector in text-space y maps to screen)
        const fontHeight = Math.hypot(tx[2], tx[3]);
        if (fontHeight < 1) continue;

        // Rotation angle of the text baseline (0° for standard horizontal text)
        const angle = Math.atan2(tx[1], tx[0]);

        // tx[4], tx[5] = screen position of the glyph origin = baseline-left.
        // CSS positions the element by its TOP-left corner, so we subtract the
        // ascent.  For rotated text the ascent vector also rotates.
        const ascent = fontHeight * ASCENT_FRAC;
        const left   = tx[4] + (angle !== 0 ? ascent * Math.sin(angle) : 0);
        const top    = tx[5] - (angle !== 0 ? ascent * Math.cos(angle) : ascent);

        spans.push({ str: item.str, left, top, baseline: tx[5], fontHeight, angle });
      }

      // ── Sort into visual reading order ────────────────────────────────────
      //
      // PDFs store text in arbitrary draw order (content-stream order).
      // Browser text-selection extends through DOM order, not visual order.
      // Without re-sorting, dragging the cursor jumps to visually unrelated text.
      //
      // Sort primary:   by BASELINE (tx[5]) — see SpanData.baseline comment above.
      // Sort secondary: left→right within each line.
      //
      // Line-grouping tolerance = 30 % of the MEDIAN font height.
      //   • Median (not mean) is robust against a few large headers skewing things.
      //   • 30 % is tight enough to separate adjacent lines (typical leading ≥ 120 %)
      //     but loose enough to absorb sub-pixel baseline jitter and minor super/
      //     subscript shifts that still belong to the same logical line.
      const sortedHeights = spans.map(s => s.fontHeight).sort((a, b) => a - b);
      const medianH = sortedHeights[Math.floor(sortedHeights.length / 2)] ?? 12;
      const tol = medianH * 0.3;

      spans.sort((a, b) => {
        const dBaseline = a.baseline - b.baseline;
        return Math.abs(dBaseline) > tol ? dBaseline : a.left - b.left;
      });

      // ── Append spans via DocumentFragment (single reflow) ─────────────────
      textLayer.innerHTML = "";
      const frag = document.createDocumentFragment();

      for (const s of spans) {
        const el = document.createElement("span");
        el.textContent = s.str;
        // cssText avoids repeated style-property writes / partial reflows.
        el.style.cssText =
          "position:absolute;" +
          `left:${s.left}px;` +
          `top:${s.top}px;` +
          `font-size:${s.fontHeight}px;` +
          "font-family:sans-serif;" +
          "line-height:1;" +
          "color:transparent;" +
          "white-space:pre;" +
          "cursor:text;" +
          "transform-origin:left top;" +
          (s.angle !== 0 ? `transform:rotate(${s.angle}rad);` : "") +
          "user-select:text;" +
          "-webkit-user-select:text;";
        frag.appendChild(el);
      }

      textLayer.appendChild(frag);
    };

    run();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [page, containerWidth]);

  return (
    // overflow:hidden here clips anything that genuinely exits the page area.
    <div style={{ position: "relative", width: dims.width || containerWidth, height: dims.height || 0, overflow: "hidden" }}>
      {/*
        pointer-events:none on the canvas ensures mouse events reach the text
        layer sitting on top of it; without this, the canvas absorbs mousedown
        before drag-selection can start.
      */}
      <canvas ref={canvasRef} style={{ display: "block", pointerEvents: "none" }} />
      <div
        ref={textLayerRef}
        style={{
          position: "absolute",
          inset: 0,
          // overflow:visible (not hidden!) so that ::selection highlights are
          // rendered at each span's actual CSS position.  With overflow:hidden,
          // any span whose computed left/top falls outside the inset box has its
          // highlight silently clipped — the text is still selected (DOM range
          // includes it) but the user sees no blue highlight, making it look
          // like the selection failed.
          overflow: "visible",
          userSelect: "text",
          WebkitUserSelect: "text",
        }}
      />
    </div>
  );
}

// ─── PdfPageRenderer (public API) ────────────────────────────────────────────

export interface PdfPageRendererProps {
  url: string;
  className?: string;
}

/**
 * Renders every page of a remote PDF inline via pdfjs canvas rendering.
 * A transparent, correctly-ordered text layer sits on top of each canvas
 * so that text can be selected and copied without any browser-specific hacks.
 */
export function PdfPageRenderer({ url, className }: PdfPageRendererProps) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const [pages, setPages]               = useState<PDFPageProxy[]>([]);
  const [containerWidth, setContainerWidth] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  // Measure available width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      if (w > 0) setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fetch & parse PDF
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPages([]);

    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = new Uint8Array(await res.arrayBuffer());
        if (cancelled) return;

        const pdfDoc = await pdfjs.getDocument({
          data,
          cMapUrl: "https://unpkg.com/pdfjs-dist@5.4.296/cmaps/",
          cMapPacked: true,
        }).promise;
        if (cancelled) return;

        const loaded: PDFPageProxy[] = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          loaded.push(await pdfDoc.getPage(i));
          if (cancelled) return;
        }

        setPages(loaded);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Erro ao carregar PDF");
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  return (
    <div ref={containerRef} className={className} style={{ background: "white" }}>
      {loading && (
        <div className="flex items-center justify-center py-12">
          <IconLoader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}
      {error && (
        <p className="text-center text-sm text-gray-500 py-8">{error}</p>
      )}
      {!loading && !error && containerWidth > 0 && pages.map((page, i) => (
        <div key={i} style={{ borderTop: i > 0 ? "1px solid #e5e7eb" : undefined }}>
          <PageCanvas page={page} containerWidth={containerWidth} />
        </div>
      ))}
    </div>
  );
}
