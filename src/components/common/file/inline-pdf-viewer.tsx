import * as React from "react";
import { pdfjs } from "react-pdf";
import { IconLoader2, IconAlertTriangle, IconDownload } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  detectScaleFrom,
  readPageGeometry,
  type PageGeometry,
  type ScaleDetection,
} from "@/lib/layout-dimensions";
import {
  layoutDimensionsService,
  type LayoutPlan,
} from "@/api-client/layoutDimensions";
import {
  PdfMeasureOverlay,
  type CommittedMeasurement,
  type PlannedDimensionEntry,
} from "./pdf-measure-overlay";

/**
 * Ferramentas do desenho.
 *
 * `cotas` é o cotador: o arquivo abre pronto e um clique num adesivo mostra as
 * medidas dele. `regua` é a medição livre, dois cliques entre duas retas. São
 * coisas diferentes e por isso não dividem o mesmo nome.
 */
export type LayoutTool = "off" | "cotas" | "regua";

import { VENDOR_ASSETS } from '@/config/assets';
// Configure PDF.js worker
// Use .js extension instead of .mjs to avoid MIME type issues (browsers may reject .mjs with application/octet-stream)
pdfjs.GlobalWorkerOptions.workerSrc = VENDOR_ASSETS.pdfWorker;

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
  measurements?: CommittedMeasurement[];
  onMeasurementCommit?: (measurement: CommittedMeasurement) => void;
  /** Escala descoberta no arquivo (ou o padrão da casa, quando ele não traz cota). */
  onScaleDetected?: (detection: ScaleDetection) => void;
  /**
   * O caminhão da tarefa. Quando vem, o cotador roda sozinho assim que o
   * arquivo carrega — não há botão a apertar.
   *
   * É o caminhão e não os painéis porque quem resolve as medidas é a API: o
   * `ImplementMeasure` guarda METRO e o cotador trabalha em centímetro, e essa
   * conversão passou a existir num lugar só.
   */
  layoutTruckId?: string;
  /** Id do arquivo aberto — a API cota pelo arquivo, não pela URL. */
  fileId?: string;
  /** Ferramenta ativa sobre o desenho. */
  layoutTool?: LayoutTool;
  /** Resultado do cotador, para a tela que hospeda o visualizador. */
  onLayoutResult?: (result: LayoutPlan | null) => void;
  /** Item cujas cotas estão à mostra; `null` mostra só os contornos. */
  selectedItemIndex?: number | null;
  onSelectItem?: (index: number | null) => void;
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
      measurements,
      onMeasurementCommit,
      onScaleDetected,
      layoutTruckId,
      fileId,
      layoutTool = "off",
      onLayoutResult,
      selectedItemIndex = null,
      onSelectItem,
    },
    ref
  ) => {
    const [numPages, setNumPages] = React.useState<number>(0);
    const [internalPageNumber, setInternalPageNumber] = React.useState<number>(1);
    const [internalScale, setInternalScale] = React.useState<number>(1.0);
    const [internalRotation, setInternalRotation] = React.useState<number>(0);
    const [loading, setLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<string | null>(null);
    const [geometry, setGeometry] = React.useState<PageGeometry | null>(null);
    const [detection, setDetection] = React.useState<ScaleDetection | null>(null);
    const [layout, setLayout] = React.useState<LayoutPlan | null>(null);
    const [layoutBusy, setLayoutBusy] = React.useState(false);
    const onLayoutResultRef = React.useRef(onLayoutResult);
    onLayoutResultRef.current = onLayoutResult;

    // Use external values if provided, otherwise use internal state
    const scale = externalScale ?? internalScale;
    const rotation = externalRotation ?? internalRotation;
    const pageNumber = externalPageNumber ?? internalPageNumber;

    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const measureModeRef = React.useRef(layoutTool !== "off");
    measureModeRef.current = layoutTool !== "off";
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

    /**
     * Zoom ancorado no cursor.
     *
     * A página vive num contêiner de rolagem, então aumentar a escala sozinha
     * mantém fixo o canto superior esquerdo — quem estava olhando o rodapé de um
     * caminhão de 15 m ia parar no teto. Guardando onde o ponteiro está e
     * corrigindo a rolagem na proporção do zoom, o ponto sob o cursor continua
     * sob o cursor, que é o que todo visualizador de mapa faz.
     */
    const pointerRef = React.useRef<{ x: number; y: number } | null>(null);
    const prevScaleRef = React.useRef(scale);
    React.useLayoutEffect(() => {
      const el = containerRef.current;
      const previous = prevScaleRef.current;
      prevScaleRef.current = scale;
      if (!el || previous === scale || !previous) return;
      const rect = el.getBoundingClientRect();
      const anchor = pointerRef.current;
      // sem ponteiro sobre a página (atalho de teclado, botão da barra), o
      // âncora é o centro do que está à vista
      const ax = anchor ? anchor.x - rect.left : rect.width / 2;
      const ay = anchor ? anchor.y - rect.top : rect.height / 2;
      const ratio = scale / previous;
      el.scrollLeft = (el.scrollLeft + ax) * ratio - ax;
      el.scrollTop = (el.scrollTop + ay) * ratio - ay;
    }, [scale]);
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
      // Medindo, o arrasto é do ímã: puxar a página tiraria a mira do lugar.
      if (measureModeRef.current) return;

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

    /**
     * A geometria é lida aqui; as COTAS vêm da API.
     *
     * As duas coisas moravam neste efeito, e a doutrina inteira — o que é um
     * adesivo, de que borda se mede, onde a linha de cota assenta — rodava no
     * navegador. Portar isso para o celular criaria uma segunda cópia em Dart,
     * com os ~40 limiares calibrados de novo no braço e sem bancada de
     * regressão; e duas cópias divergem. A divergência apareceria do pior jeito
     * possível: dois números diferentes para o mesmo adesivo, um no celular do
     * aplicador e outro na tela do projetista.
     *
     * Agora o servidor calcula e os dois clientes desenham. Provado no acervo
     * inteiro: 231 de 231 arquivos com itens, cotas e avisos idênticos byte a
     * byte ao que este arquivo produzia sozinho.
     *
     * A geometria continua sendo lida aqui porque a RÉGUA é interativa e o
     * pdf.js já está carregado — o ímã precisa responder ao dedo, não à rede. É
     * o mesmo leitor que a API usa; ela o serve em `/layout-dimensions/:id/snap`
     * para o celular, que não tem pdf.js nenhum.
     */
    React.useEffect(() => {
      if (loading || layoutTool === "off") return;
      let cancelled = false;
      const run = async () => {
        const pdfDoc = pdfDocRef.current;
        if (!pdfDoc) return;
        setLayoutBusy(true);
        try {
          const page = await pdfDoc.getPage(pageNumber);
          // A régua fica DE PÉ mesmo que o cotador engasgue numa face
          // patológica (MAR & RIO: 156 peças fundidas num envelopamento só).
          // Ler primeiro, cotar depois: se a cotagem falhar — ou se a rede cair
          // —, o operador ainda mede na mão.
          const geo = await readPageGeometry(page, { rotation });
          if (cancelled) return;
          const text = await page.getTextContent();
          if (cancelled) return;
          const found = detectScaleFrom(geo, text.items);
          setGeometry(geo);
          setDetection(found);
          onScaleDetected?.(found);
          if (!layoutTruckId || !fileId) {
            setLayout(null);
            onLayoutResultRef.current?.(null);
            return;
          }
          const dto = await layoutDimensionsService.get(fileId, {
            truckId: layoutTruckId,
            page: pageNumber,
            rotation,
          });
          if (cancelled) return;
          const plan: LayoutPlan = { ...dto, geometry: geo };
          setDetection(plan.detectedScale);
          setLayout(plan);
          onScaleDetected?.(plan.detectedScale);
          onLayoutResultRef.current?.(plan);
        } catch (err) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[InlinePdfViewer] Não foi possível cotar o layout:", err);
          }
          if (!cancelled) {
            setLayout(null);
            onLayoutResultRef.current?.(null);
          }
        } finally {
          if (!cancelled) setLayoutBusy(false);
        }
      };
      run();
      return () => {
        cancelled = true;
      };
    }, [layoutTruckId, fileId, layoutTool, pageNumber, rotation, loading, onScaleDetected]);

    /**
     * Um item, um plano de cotas.
     *
     * O clique repetido já alternou entre o plano da doutrina e um espelhado —
     * e a alternância era o defeito, não o recurso: o mesmo adesivo dava dois
     * pares de números conforme quantas vezes se clicasse nele, e o aplicador
     * não tinha como saber qual dos dois colar. A borda de referência é a que a
     * doutrina escolhe, sempre; quando ela não tem número a dar (a peça está
     * colada nela), o próprio plano já mede pela borda oposta.
     */
    const handleSelectItem = React.useCallback(
      (index: number | null) => {
        onSelectItem?.(index);
      },
      [onSelectItem],
    );

    /** As cotas do item escolhido, cada uma com a face de onde veio. */
    const plannedEntries = React.useMemo<PlannedDimensionEntry[]>(() => {
      if (!layout || selectedItemIndex === null) return [];
      // uma cota deduplicada explica mais de um item: "Alimentando" e "Saúde"
      // assentam na mesma altura e dividem a mesma cota vertical
      const mine = (d: (typeof layout.dimensions)[number]) =>
        d.targetIndex === selectedItemIndex || !!d.alsoTargets?.includes(selectedItemIndex);
      return layout.dimensions
        .filter(mine)
        .map((dimension) => {
          const item = layout.items[dimension.targetIndex ?? -1];
          const face = layout.faces[item?.faceIndex ?? 0];
          return face
            ? { dimension, scale: { ptPerCm: face.ptPerCm, panelPt: face.panelPt } }
            : null;
        })
        .filter((e): e is PlannedDimensionEntry => e !== null);
    }, [layout, selectedItemIndex]);

    const selectable = React.useMemo(
      () =>
        layout?.items.map((item) => ({
          index: item.index,
          // o clique cai na tinta; o quadro desenhado é o que a COTA referencia
          bbox: item.bbox,
          drawBox: item.alignedBoxPt,
          // O contorno já vem enxuto: um envelopamento cru tem ~25 mil pontos
          // (MAR & RIO: 299 polígonos) e desenhar esse caminho SVG a cada
          // repintura congelava a aba. Quem apara agora é o servidor, no mesmo
          // orçamento de 3 mil pontos — e o celular ganha de graça.
          outline: item.outlinePt,
        })) ?? [],
      [layout],
    );

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
          onPointerMove={(event) => {
            pointerRef.current = { x: event.clientX, y: event.clientY };
            handlePanPointerMove(event);
          }}
          onPointerLeave={() => {
            pointerRef.current = null;
          }}
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
              {/*
                Sem margem reservada. A cota do quadro externo mora 10 cm além
                da face, e a face já fica bem dentro da página — a margem branca
                do PDF vale ~90 cm de face, então o anel cabe no papel e o SVG
                simplesmente transborda por cima dela. Reservar espaço aqui
                engordava o item, estourava a altura do contêiner e o
                `safe center` caía para o topo: a página descia 61 px ao ligar
                as Medidas, e voltava ao centro ao desligar.
              */}
              <div className="relative">
                <canvas ref={canvasRef} className="shadow-2xl rounded-lg block select-none" style={{ background: "white" }} draggable={false} />
                {layoutTool !== "off" && geometry && detection && (
                  <PdfMeasureOverlay
                    geometry={geometry}
                    zoom={scale}
                    ptPerCm={detection.ptPerCm}
                    faceScales={layout?.faces.map((f) => ({ ptPerCm: f.ptPerCm, panelPt: f.panelPt }))}
                    measurements={measurements ?? []}
                    onCommit={(m) => onMeasurementCommit?.(m)}
                    plan={plannedEntries}
                    selectable={layoutTool === "cotas" ? selectable : undefined}
                    selectedIndex={selectedItemIndex}
                    onSelect={handleSelectItem}
                    mode={layoutTool === "cotas" ? "select" : "measure"}
                  />
                )}
                {layoutBusy && (
                  <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
                    lendo o desenho…
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

InlinePdfViewer.displayName = "InlinePdfViewer";

export default InlinePdfViewer;
