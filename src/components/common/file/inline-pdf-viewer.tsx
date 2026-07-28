import * as React from "react";
import { pdfjs } from "react-pdf";
import { IconLoader2, IconAlertTriangle, IconDownload } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Configure PDF.js worker
// Use .js extension instead of .mjs to avoid MIME type issues (browsers may reject .mjs with application/octet-stream)
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

type PDFDocumentProxy = Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>;
type RenderTask = ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]>;

export interface InlinePdfViewerProps {
  url: string;
  filename?: string;
  onLoadSuccess?: (numPages: number) => void;
  onLoadError?: (error: Error) => void;
  onDownload?: () => void;
  className?: string;
  maxHeight?: string;
  // External control props
  scale?: number;
  rotation?: number;
  pageNumber?: number;
  onPageChange?: (page: number) => void;
  // Callback when fit scale is calculated - provides the optimal scale to fit the PDF in the viewport
  onFitScaleCalculated?: (fitScale: number, pageWidth: number, pageHeight: number) => void;
}

export interface InlinePdfViewerRef {
  numPages: number;
  pageNumber: number;
  scale: number;
  rotation: number;
  zoomIn: () => void;
  zoomOut: () => void;
  rotate: () => void;
  resetZoom: () => void;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
}

export const InlinePdfViewer = React.forwardRef<InlinePdfViewerRef, InlinePdfViewerProps>(
  (
    {
      url,
      filename: _filename,
      onLoadSuccess,
      onLoadError,
      onDownload,
      className,
      maxHeight = "calc(100vh - 200px)",
      scale: externalScale,
      rotation: externalRotation,
      pageNumber: externalPageNumber,
      onPageChange,
      onFitScaleCalculated,
    },
    ref
  ) => {
    const [numPages, setNumPages] = React.useState<number>(0);
    const [internalPageNumber, setInternalPageNumber] = React.useState<number>(1);
    const [internalScale, setInternalScale] = React.useState<number>(1.0);
    const [internalRotation, setInternalRotation] = React.useState<number>(0);
    const [loading, setLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<string | null>(null);

    // Use external values if provided, otherwise use internal state
    const scale = externalScale ?? internalScale;
    const rotation = externalRotation ?? internalRotation;
    const pageNumber = externalPageNumber ?? internalPageNumber;

    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const pdfDocRef = React.useRef<PDFDocumentProxy | null>(null);
    const renderTaskRef = React.useRef<RenderTask | null>(null);
    const onFitScaleCalculatedRef = React.useRef(onFitScaleCalculated);

    // Keep the ref updated with the latest callback
    React.useEffect(() => {
      onFitScaleCalculatedRef.current = onFitScaleCalculated;
    }, [onFitScaleCalculated]);

    // Control functions
    const zoomIn = React.useCallback(() => {
      setInternalScale((prev) => Math.min(prev + 0.25, 3));
    }, []);

    const zoomOut = React.useCallback(() => {
      setInternalScale((prev) => Math.max(prev - 0.25, 0.5));
    }, []);

    const rotate = React.useCallback(() => {
      setInternalRotation((prev) => (prev + 90) % 360);
    }, []);

    const resetZoom = React.useCallback(() => {
      setInternalScale(1);
    }, []);

    const goToPage = React.useCallback(
      (page: number) => {
        const newPage = Math.max(1, Math.min(page, numPages));
        setInternalPageNumber(newPage);
        onPageChange?.(newPage);
      },
      [numPages, onPageChange]
    );

    const nextPage = React.useCallback(() => {
      goToPage(pageNumber + 1);
    }, [pageNumber, goToPage]);

    const prevPage = React.useCallback(() => {
      goToPage(pageNumber - 1);
    }, [pageNumber, goToPage]);

    // Expose controls via ref
    React.useImperativeHandle(
      ref,
      () => ({
        numPages,
        pageNumber,
        scale,
        rotation,
        zoomIn,
        zoomOut,
        rotate,
        resetZoom,
        goToPage,
        nextPage,
        prevPage,
      }),
      [numPages, pageNumber, scale, rotation, zoomIn, zoomOut, rotate, resetZoom, goToPage, nextPage, prevPage]
    );

    // ------------------------------------------------------------------
    // Drag-to-pan
    // ------------------------------------------------------------------
    // The page lives in a native scroll container, so panning is just
    // scroll manipulation — that keeps scrollbars, wheel and keyboard in sync.
    const panRef = React.useRef<{ id: number; startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);
    const [isPanning, setIsPanning] = React.useState(false);
    const [canPan, setCanPan] = React.useState(false);

    // Recompute whether there is anything to pan whenever the render changes.
    React.useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      const check = () => setCanPan(el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
      check();
      const observer = new ResizeObserver(check);
      observer.observe(el);
      const canvas = canvasRef.current;
      if (canvas) observer.observe(canvas);
      return () => observer.disconnect();
    }, [scale, rotation, pageNumber, loading]);

    const handlePanPointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      // Touch keeps native momentum scrolling.
      if (e.pointerType === "touch") return;
      if (e.button !== 0) return;

      const el = containerRef.current;
      if (!el) return;
      if (el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight) return;

      panRef.current = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop,
      };
      el.setPointerCapture(e.pointerId);
      setIsPanning(true);
      e.preventDefault();
    }, []);

    const handlePanPointerMove = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      const session = panRef.current;
      const el = containerRef.current;
      if (!session || !el || session.id !== e.pointerId) return;

      el.scrollLeft = session.scrollLeft - (e.clientX - session.startX);
      el.scrollTop = session.scrollTop - (e.clientY - session.startY);
    }, []);

    const handlePanPointerEnd = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      const session = panRef.current;
      if (!session || session.id !== e.pointerId) return;

      panRef.current = null;
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      setIsPanning(false);
    }, []);

    // Load PDF document
    React.useEffect(() => {
      let cancelled = false;

      const loadPdf = async () => {
        try {
          setLoading(true);
          setError(null);

          // Cancel any previous render task
          if (renderTaskRef.current) {
            renderTaskRef.current.cancel();
            renderTaskRef.current = null;
          }

          const loadingTask = pdfjs.getDocument({
            url,
            docBaseUrl: undefined,
            cMapUrl: "https://unpkg.com/pdfjs-dist@5.4.296/cmaps/",
            cMapPacked: true,
          });

          const pdfDoc = await loadingTask.promise;

          if (cancelled) return;

          pdfDocRef.current = pdfDoc;
          setNumPages(pdfDoc.numPages);
          setLoading(false);
          onLoadSuccess?.(pdfDoc.numPages);

          // Calculate fit scale based on first page dimensions and container
          if (onFitScaleCalculatedRef.current && containerRef.current) {
            try {
              const firstPage = await pdfDoc.getPage(1);
              const viewport = firstPage.getViewport({ scale: 1, rotation: 0 });
              const pageWidth = viewport.width;
              const pageHeight = viewport.height;

              // Get container dimensions
              const container = containerRef.current;
              const containerWidth = container.clientWidth - 32; // Account for padding
              const containerHeight = container.clientHeight - 32;

              // Calculate scale factors for both dimensions
              const scaleX = containerWidth / pageWidth;
              const scaleY = containerHeight / pageHeight;

              // Use the smaller scale to ensure the page fits entirely
              const fitScale = Math.min(scaleX, scaleY, 2); // Cap at 2x max

              onFitScaleCalculatedRef.current(fitScale, pageWidth, pageHeight);
            } catch (err) {
              // Fallback if we can't calculate fit scale
              if (process.env.NODE_ENV !== 'production') {
                console.warn("[InlinePdfViewer] Could not calculate fit scale:", err);
              }
            }
          }
        } catch (err) {
          if (cancelled) return;
          if (process.env.NODE_ENV !== 'production') {
            console.error("[InlinePdfViewer] Error loading PDF:", err);
          }
          setError("Erro ao carregar o PDF");
          setLoading(false);
          onLoadError?.(err as Error);
        }
      };

      loadPdf();

      return () => {
        cancelled = true;
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }
      };
    }, [url]); // Removed onFitScaleCalculated from dependencies to prevent unnecessary reloads

    // Render current page
    React.useEffect(() => {
      let cancelled = false;

      const renderPage = async () => {
        const pdfDoc = pdfDocRef.current;
        const canvas = canvasRef.current;

        if (!pdfDoc || !canvas || loading) return;

        try {
          // Cancel any previous render task
          if (renderTaskRef.current) {
            renderTaskRef.current.cancel();
            renderTaskRef.current = null;
          }

          const page = await pdfDoc.getPage(pageNumber);

          if (cancelled) return;

          const viewport = page.getViewport({
            scale,
            rotation,
          });

          // Set canvas dimensions
          const context = canvas.getContext("2d");
          if (!context) return;

          // Use device pixel ratio for sharp rendering
          const pixelRatio = window.devicePixelRatio || 1;
          canvas.width = viewport.width * pixelRatio;
          canvas.height = viewport.height * pixelRatio;
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;

          // Scale context for sharp rendering
          context.scale(pixelRatio, pixelRatio);

          // Clear canvas with white background
          context.fillStyle = "white";
          context.fillRect(0, 0, viewport.width, viewport.height);

          const renderContext = {
            canvasContext: context,
            viewport,
            canvas,
          };

          renderTaskRef.current = page.render(renderContext);
          await renderTaskRef.current.promise;
        } catch (err: any) {
          if (cancelled || err?.name === "RenderingCancelledException") return;
          if (process.env.NODE_ENV !== 'production') {
            console.error("[InlinePdfViewer] Error rendering page:", err);
          }
          setError("Erro ao renderizar página do PDF");
        }
      };

      renderPage();

      return () => {
        cancelled = true;
      };
    }, [pageNumber, scale, rotation, loading, numPages]);

    return (
      <div className={cn("flex flex-col items-center w-full h-full", className)}>
        {/* PDF Container */}
        <div
          ref={containerRef}
          className={cn("relative overflow-auto rounded-lg w-full h-full", canPan && (isPanning ? "cursor-grabbing" : "cursor-grab"))}
          style={{ maxHeight }}
          onPointerDown={handlePanPointerDown}
          onPointerMove={handlePanPointerMove}
          onPointerUp={handlePanPointerEnd}
          onPointerCancel={handlePanPointerEnd}
        >
          {/* Loading State */}
          {loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm rounded-lg">
              <IconLoader2 className="h-12 w-12 text-white animate-spin mb-4" />
              <span className="text-white text-sm">Carregando PDF...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="flex flex-col items-center justify-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-8 max-w-md">
                <IconAlertTriangle className="h-16 w-16 text-yellow-400" />
                <div className="text-center">
                  <h3 className="text-white text-lg font-medium mb-2">Erro ao carregar PDF</h3>
                  <p className="text-white/70 text-sm mb-4">{error}</p>
                  {onDownload && (
                    <Button
                      variant="outline"
                      onClick={onDownload}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      <IconDownload className="h-4 w-4 mr-2" />
                      Baixar arquivo
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PDF Canvas */}
          {!loading && !error && (
            <div
              className="min-h-full min-w-full flex p-4"
              style={{
                // `safe center` centres the page while it fits, but falls back to
                // start-alignment once it overflows. Plain `center` would push the
                // page's top/left edge outside the scrollable area, making the
                // overflowing part unreachable by scrolling or dragging.
                justifyContent: "safe center",
                alignItems: "safe center",
                width: "max-content",
              }}
            >
              <canvas ref={canvasRef} className="shadow-2xl rounded-lg block select-none" style={{ background: "white" }} draggable={false} />
            </div>
          )}
        </div>
      </div>
    );
  }
);

InlinePdfViewer.displayName = "InlinePdfViewer";

export default InlinePdfViewer;
