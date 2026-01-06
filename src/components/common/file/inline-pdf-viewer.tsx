import * as React from "react";
import { pdfjs } from "react-pdf";
import { IconLoader2, IconAlertTriangle, IconDownload } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

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
      filename,
      onLoadSuccess,
      onLoadError,
      onDownload,
      className,
      maxHeight = "calc(100vh - 200px)",
      scale: externalScale,
      rotation: externalRotation,
      pageNumber: externalPageNumber,
      onPageChange,
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
            cMapUrl: "https://unpkg.com/pdfjs-dist@5.4.296/cmaps/",
            cMapPacked: true,
          });

          const pdfDoc = await loadingTask.promise;

          if (cancelled) return;

          pdfDocRef.current = pdfDoc;
          setNumPages(pdfDoc.numPages);
          setLoading(false);
          onLoadSuccess?.(pdfDoc.numPages);
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
    }, [url]);

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
          className="relative overflow-auto rounded-lg w-full h-full"
          style={{ maxHeight }}
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
              className="min-h-full min-w-full flex justify-center p-4"
              style={{
                alignItems: scale <= 1 ? 'center' : 'flex-start',
              }}
            >
              <canvas ref={canvasRef} className="shadow-2xl rounded-lg block" style={{ background: "white" }} />
            </div>
          )}
        </div>
      </div>
    );
  }
);

InlinePdfViewer.displayName = "InlinePdfViewer";

export default InlinePdfViewer;
