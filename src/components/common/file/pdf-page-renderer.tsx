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
}) => { render(): Promise<void>; cancel(): void };

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

type PDFDocumentProxy = Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
type PDFPageProxy = Awaited<ReturnType<PDFDocumentProxy["getPage"]>>;

/**
 * Inject the minimum CSS that pdfjs TextLayer needs.
 *
 * Why not import pdfjs-dist/web/pdf_viewer.css?
 *   • It ships `overflow:clip` on .textLayer, which silently hides ::selection
 *     highlights for any span that sits outside the clipping box.
 *   • Importing the full viewer CSS brings in hundreds of rules we don't need.
 *
 * What we inject here is the structural minimum, with overflow:visible so every
 * span's highlight is always visible regardless of position.
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
      overflow: visible;    /* must NOT be clip/hidden — kills ::selection highlights */
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
  const textLayerInstanceRef = useRef<TextLayer | null>(null);
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
      // Cancel previous tasks
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      textLayerInstanceRef.current?.cancel();
      textLayerInstanceRef.current = null;

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

      // ── Text layer (selection layer) using official pdfjs TextLayer ───────
      //
      // Using pdfjs's own TextLayer instead of manual span positioning because:
      //   • It uses the exact same font-metric ascent tables that pdfjs uses
      //     when rendering glyphs — so spans land precisely under their glyphs.
      //   • It handles writing-mode, RTL, ligatures, and composite fonts.
      //   • It produces DOM order that matches visual reading order (pdfjs
      //     sorts internally).
      //
      // The class "pdf-text-layer" (not pdfjs's "textLayer") prevents the
      // viewer CSS's `overflow:clip` from hiding ::selection highlights.
      textLayerEl.innerHTML = "";

      const tl = new TextLayer({
        textContentSource: page.streamTextContent(),
        container: textLayerEl,
        viewport: vp,
      });
      textLayerInstanceRef.current = tl;

      try {
        await tl.render();
      } catch (e: any) {
        // AbortException is thrown when cancel() is called — not an error
        if (e?.name === "AbortException") return;
      }

      if (cancelled) return;

      // ── Post-process: prevent wide spans from occluding short labels ──────
      //
      // Some government PDFs (e.g. NFS-e) embed authentication URLs as text
      // items whose PDF coordinates happen to land on top of visible form
      // labels ("DADE:", "Valor:", etc.).  These URL spans are much wider than
      // a typical label — they cover 70 %+ of the page width — so they
      // intercept mouse-hit-tests before the short label span underneath can.
      //
      // Fix: after render, measure every span's screen width.  Any span wider
      // than 70 % of the container gets z-index:0, pushing it behind normal
      // content spans (z-index:1 from our CSS).  The URL remains selectable
      // wherever it doesn't overlap other content, but labels on top of it
      // are no longer shadowed.
      const containerRect = textLayerEl.getBoundingClientRect();
      if (containerRect.width > 0) {
        for (const div of tl.textDivs) {
          if (div.getBoundingClientRect().width > containerRect.width * 0.7) {
            (div as HTMLElement).style.zIndex = "0";
          }
        }
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
    // overflow:hidden clips anything genuinely exiting the page area (e.g. a
    // mis-positioned annotation), but the text layer itself is overflow:visible
    // so ::selection highlights on its spans are never clipped.
    <div style={{ position: "relative", width: dims.width || containerWidth, height: dims.height || 0, overflow: "hidden" }}>
      {/*
        pointer-events:none on the canvas lets mouse events reach the text
        layer on top; without this the canvas absorbs mousedown before
        drag-selection can start.
      */}
      <canvas ref={canvasRef} style={{ display: "block", pointerEvents: "none" }} />
      <div
        ref={textLayerRef}
        className="pdf-text-layer"
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
 * A transparent, correctly-positioned text layer (via pdfjs's own TextLayer
 * class) sits on top of each canvas so that text can be selected and copied.
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
