import { useEffect, useRef, useState } from "react";
import { pdfjs } from "react-pdf";
import { IconLoader2 } from "@tabler/icons-react";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

type PDFDocumentProxy = Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
type PDFPageProxy = Awaited<ReturnType<PDFDocumentProxy["getPage"]>>;

type Matrix = [number, number, number, number, number, number];

/** Multiply two PDF transform matrices: result = m1 * m2 */
function multiplyTransform(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  dir: string;
}

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
      // Cancel any in-flight render
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }

      const baseViewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / baseViewport.width;
      const viewport = page.getViewport({ scale });

      setDims({ width: viewport.width, height: viewport.height });

      // Canvas rendering
      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.scale(dpr, dpr);
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, viewport.width, viewport.height);

      renderTaskRef.current = page.render({ canvasContext: ctx, viewport });

      try {
        await renderTaskRef.current.promise;
      } catch (err: any) {
        if (err?.name === "RenderingCancelledException") return;
      }

      if (cancelled) return;

      // Text layer — transparent selectable spans positioned over the canvas
      const textContent = await page.getTextContent();
      if (cancelled) return;

      textLayer.innerHTML = "";

      const viewportTransform = viewport.transform as Matrix;

      for (const rawItem of textContent.items) {
        const item = rawItem as TextItem;
        if (!item.str) continue;

        const tx = multiplyTransform(viewportTransform, item.transform as Matrix);

        // Font height = magnitude of the y-axis column vector
        const fontHeight = Math.hypot(tx[2], tx[3]);
        if (fontHeight < 1) continue;

        // Horizontal scale ratio (text may be wider/narrower than a square em)
        const fontWidth = Math.hypot(tx[0], tx[1]);
        const scaleX = fontWidth / fontHeight;

        // Rotation angle (0 for standard horizontal text)
        const angle = Math.atan2(tx[1], tx[0]);

        // tx[4], tx[5] is the origin of the text glyph in screen space.
        // PDF glyph origin = bottom-left; CSS origin = top-left, so subtract fontHeight.
        const x = tx[4];
        const y = tx[5] - fontHeight;

        const span = document.createElement("span");
        span.textContent = item.str;

        const transform =
          angle !== 0
            ? `rotate(${angle}rad) scaleX(${scaleX})`
            : scaleX !== 1
              ? `scaleX(${scaleX})`
              : "";

        Object.assign(span.style, {
          position: "absolute",
          left: `${x}px`,
          top: `${y}px`,
          fontSize: `${fontHeight}px`,
          fontFamily: "sans-serif",
          lineHeight: "1",
          color: "transparent",
          whiteSpace: "pre",
          cursor: "text",
          transformOrigin: "left top",
          transform: transform || "none",
          userSelect: "text",
          WebkitUserSelect: "text",
        });

        textLayer.appendChild(span);
      }
    };

    run();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [page, containerWidth]);

  return (
    <div style={{ position: "relative", width: dims.width || containerWidth, height: dims.height || 0 }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />
      <div
        ref={textLayerRef}
        aria-hidden={false}
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          userSelect: "text",
          WebkitUserSelect: "text",
        }}
      />
    </div>
  );
}

export interface PdfPageRendererProps {
  url: string;
  className?: string;
}

/**
 * Renders all pages of a PDF inline using pdfjs canvas rendering.
 * Each page has a transparent text layer on top for text selection/copy.
 * No iframes, no browser-specific hacks, consistent across all browsers.
 */
export function PdfPageRenderer({ url, className }: PdfPageRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [containerWidth, setContainerWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track container width via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load PDF and extract all page proxies
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

    return () => {
      cancelled = true;
    };
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
