import { useEffect, useRef, useState } from "react";
import { pdfjs } from "react-pdf";
import { IconLoader2 } from "@tabler/icons-react";

// TextLayer is exported by pdfjs-dist (a transitive dep via react-pdf).
// We access it through the pdfjs namespace to avoid adding pdfjs-dist as a
// direct dependency and to guarantee version alignment.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TextLayer = (pdfjs as any).TextLayer as new (params: {
  textContentSource: ReturnType<PDFPageProxy["streamTextContent"]> | Awaited<ReturnType<PDFPageProxy["getTextContent"]>>;
  container: HTMLElement;
  viewport: ReturnType<PDFPageProxy["getViewport"]>;
}) => { render(): Promise<void>; cancel(): void; readonly textDivs: HTMLElement[] };

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

type PDFDocumentProxy = Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
type PDFPageProxy = Awaited<ReturnType<PDFDocumentProxy["getPage"]>>;

/**
 * Inject the minimum CSS for the pdfjs text layer.
 *
 * KEY FACTS about pdfjs v5 TextLayer positioning (from reading the source):
 *
 *   • span.style.left  = `${(100 * left  / pageWidth).toFixed(2)}%`
 *   • span.style.top   = `${(100 * top   / pageHeight).toFixed(2)}%`
 *   • span.style.fontSize = `calc(var(--total-scale-factor) * Npx)`
 *   • span.style.transform = `scaleX(N)` (to match PDF advance width)
 *
 * The `%` positions are relative to the container's OWN dimensions.
 * `--total-scale-factor` MUST be set on the container (= viewport.scale) or
 * all font sizes default to the browser built-in (~16 px), inflating every
 * span's hit box and making clicks land on wrong spans.
 *
 * We use class `.pdf-text-layer` (not pdfjs's `.textLayer`) to avoid the
 * viewer CSS's `overflow:clip` which silently hides ::selection highlights.
 */
let cssInjected = false;
function ensureTextLayerCss() {
  if (cssInjected || typeof document === "undefined") return;
  cssInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    .pdf-text-layer {
      position: absolute;
      inset: 0;
      overflow: visible;
      opacity: 1;
      line-height: 1;
      -webkit-text-size-adjust: none;
      forced-color-adjust: none;
      user-select: text;
      -webkit-user-select: text;
    }
    .pdf-text-layer :is(span, br) {
      color: transparent;
      position: absolute;
      white-space: pre;
      cursor: text;
      transform-origin: 0% 0%;
      user-select: text;
      -webkit-user-select: text;
    }
    .pdf-text-layer > :not(.markedContent),
    .pdf-text-layer .markedContent span:not(.markedContent) {
      z-index: 1;
    }
    .pdf-text-layer span.markedContent {
      top: 0;
      height: 0;
    }
    .pdf-text-layer span[role="img"] {
      user-select: none;
      -webkit-user-select: none;
      cursor: default;
    }
    .pdf-text-layer :is(span, br)::selection {
      background-color: rgba(0, 0, 255, 0.25);
      color: transparent;
    }
    .pdf-text-layer :is(span, br)::-moz-selection {
      background-color: rgba(0, 0, 255, 0.25);
      color: transparent;
    }
  `;
  document.head.appendChild(style);
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
  const textLayerInstanceRef = useRef<ReturnType<typeof TextLayer> | null>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    ensureTextLayerCss();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const textLayerEl = textLayerRef.current;
    if (!canvas || !textLayerEl || containerWidth <= 0) return;

    let cancelled = false;

    const run = async () => {
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      textLayerInstanceRef.current?.cancel();
      textLayerInstanceRef.current = null;

      // ── Viewport ──────────────────────────────────────────────────────────
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

      // ── Text layer ────────────────────────────────────────────────────────
      //
      // Pre-filter text content before handing it to TextLayer.
      //
      // Why: government PDFs (NFS-e, DANFE, boleto) embed authentication URLs
      // and other metadata as text items whose PDF coordinates land on top of
      // visible form labels.  We strip two categories:
      //   1. Items whose string contains a URL scheme — these are almost never
      //      the text the user wants to select and they reliably cause overlap.
      //   2. Items whose screen-space width exceeds 50 % of the page — long
      //      base64 blobs, certificate hashes, etc.
      const rawContent = await page.getTextContent();
      if (cancelled) return;

      const filteredContent = {
        ...rawContent,
        items: rawContent.items.filter((raw) => {
          if (!("str" in raw) || !("width" in raw)) return true;
          const item = raw as { str: string; width: number };
          // Remove authentication URLs — these appear in NFS-e / boleto PDFs as
          // invisible text items whose PDF coordinates overlap visible form labels.
          if (/https?:\/\//.test(item.str)) return false;
          // Remove truly full-page items (base64 blobs, certificate hashes).
          // 90 % threshold: preserves headers, titles and long descriptions that
          // legitimately span most of the page; only strips pathological outliers.
          if (item.width * scale > containerWidth * 0.9) return false;
          return true;
        }),
      };

      textLayerEl.innerHTML = "";

      // ── CRITICAL: set --total-scale-factor ───────────────────────────────
      //
      // pdfjs v5 TextLayer sets every span's font-size as:
      //   calc(var(--total-scale-factor) * <N>px)
      // where <N> is the font height in PDF user-space units.
      //
      // Without this variable the browser falls back to the inherited font
      // size (~16 px), inflating every span's hit-box.  A URL span that
      // should be 8 px tall becomes 16 px and overhangs adjacent labels —
      // that is why clicking on "DADE:" was selecting the authentication URL.
      //
      // The correct value is viewport.scale = containerWidth / pageWidth.
      // (pdfjs uses `--total-scale-factor` so the same HTML can be re-scaled
      // by updating one CSS variable rather than touching every inline style.)
      textLayerEl.style.setProperty("--total-scale-factor", String(scale));
      // Used by setLayerDimensions when CSS `round()` is supported:
      textLayerEl.style.setProperty("--scale-round-x", "1px");
      textLayerEl.style.setProperty("--scale-round-y", "1px");

      const tl = new TextLayer({
        textContentSource: filteredContent,
        container: textLayerEl,
        viewport: vp,
      });
      textLayerInstanceRef.current = tl;

      try {
        await tl.render();
      } catch (e: any) {
        if (e?.name === "AbortException") return;
      }

      if (cancelled) return;

      // ── Post-render: visual sort + z-index ───────────────────────────────
      //
      // pdfjs renders spans in PDF content-stream order, which is often not
      // visual reading order.  Browser selection extends in DOM order, so
      // drag-selection across lines can jump to unrelated text.
      //
      // Fix 1 — re-sort all leaf spans into visual reading order (top-to-bottom,
      //   left-to-right).  style.left/top are percentage strings like "15.23%";
      //   parseFloat correctly extracts the number for comparison.
      //
      // Fix 2 — assign z-index inversely by string length so short labels
      //   ("DADE:", "R$") win hit-tests over long strings that might partially
      //   overlap them after filtering.
      const leafSpans = Array.from(
        textLayerEl.querySelectorAll<HTMLElement>("span:not(.markedContent)")
      );

      // Sort by visual position
      const LINE_TOLERANCE = 1.0; // % of page height; spans within this are "same line"
      leafSpans.sort((a, b) => {
        const aTop  = parseFloat(a.style.top)  || 0;
        const bTop  = parseFloat(b.style.top)  || 0;
        const aLeft = parseFloat(a.style.left) || 0;
        const bLeft = parseFloat(b.style.left) || 0;
        const dy = aTop - bTop;
        return Math.abs(dy) > LINE_TOLERANCE ? dy : aLeft - bLeft;
      });
      // Re-append in sorted order (moves spans to top-level if nested in markedContent)
      for (const span of leafSpans) textLayerEl.appendChild(span);

      // Assign z-index by length: short labels on top
      for (const span of leafSpans) {
        const len = (span.textContent ?? "").length;
        span.style.zIndex =
          len <= 3  ? "6" :
          len <= 10 ? "5" :
          len <= 25 ? "3" :
          len <= 50 ? "2" : "1";
      }
    };

    run();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      textLayerInstanceRef.current?.cancel();
      textLayerInstanceRef.current = null;
    };
  }, [page, containerWidth]);

  return (
    <div style={{ position: "relative", width: dims.width || containerWidth, height: dims.height || 0, overflow: "hidden" }}>
      <canvas ref={canvasRef} style={{ display: "block", pointerEvents: "none" }} />
      <div ref={textLayerRef} className="pdf-text-layer" />
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
 * A transparent, correctly-positioned text layer sits on top of each canvas
 * so that text can be selected and copied.
 */
export function PdfPageRenderer({ url, className }: PdfPageRendererProps) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const [pages, setPages]               = useState<PDFPageProxy[]>([]);
  const [containerWidth, setContainerWidth] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

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
