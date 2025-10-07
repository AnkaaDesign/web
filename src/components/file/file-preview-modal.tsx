import * as React from "react";
import {
  IconArrowLeft,
  IconArrowRight,
  IconX,
  IconZoomIn,
  IconZoomOut,
  IconDownload,
  IconExternalLink,
  IconVectorBezier,
  IconRotateClockwise,
  IconRotate2,
  IconMaximize,
} from "@tabler/icons-react";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { File as AnkaaFile } from "../../types";
import { isImageFile, isVideoFile, getFileUrl, getFileThumbnailUrl, formatFileSize, getFileExtension } from "../../utils";

// Types for touch gestures and zoom
interface TouchState {
  startDistance: number;
  startScale: number;
  startX: number;
  startY: number;
  touches: React.TouchList;
}

interface SwipeState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  isSwiping: boolean;
  swipeDirection: "left" | "right" | null;
}

// EPS file detection utility
const isEpsFile = (file: AnkaaFile): boolean => {
  const epsMimeTypes = ["application/postscript", "application/x-eps", "application/eps", "image/eps", "image/x-eps"];
  return epsMimeTypes.includes(file.mimetype.toLowerCase());
};

// Check if file can be previewed (images, videos, or EPS with thumbnails)
const isPreviewableFile = (file: AnkaaFile): boolean => {
  return isImageFile(file) || isVideoFile(file) || (isEpsFile(file) && !!file.thumbnailUrl);
};

export interface FilePreviewModalProps {
  files: AnkaaFile[];
  initialFileIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseUrl?: string;
  enableSwipeNavigation?: boolean;
  enablePinchZoom?: boolean;
  enableRotation?: boolean;
  showThumbnailStrip?: boolean;
  showImageCounter?: boolean;
}

export function FilePreviewModal({
  files,
  initialFileIndex = 0,
  open,
  onOpenChange,
  baseUrl = "",
  enableSwipeNavigation = true,
  enablePinchZoom = true,
  enableRotation = true,
  showThumbnailStrip = true,
  showImageCounter = true,
}: FilePreviewModalProps) {
  // State management
  const [currentIndex, setCurrentIndex] = React.useState(initialFileIndex);
  const [zoom, setZoom] = React.useState(1);
  const [fitZoom, setFitZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [imageLoading, setImageLoading] = React.useState(true);
  const [imageError, setImageError] = React.useState(false);
  const [panX, setPanX] = React.useState(0);
  const [panY, setPanY] = React.useState(0);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  // Touch and gesture states
  const [touchState, setTouchState] = React.useState<TouchState | null>(null);
  const [swipeState, setSwipeState] = React.useState<SwipeState | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  // Refs
  const imageRef = React.useRef<HTMLImageElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const modalRef = React.useRef<HTMLDivElement>(null);

  // Filter previewable files and maintain mapping to original indices
  const previewableFiles = React.useMemo(() => files.map((file, index) => ({ file, originalIndex: index })).filter(({ file }) => isPreviewableFile(file)), [files]);

  const currentFile = files[currentIndex];
  const isCurrentFilePreviewable = currentFile && isPreviewableFile(currentFile);

  // Find current image index within previewable files
  const currentImageIndex = React.useMemo(() => {
    if (!isCurrentFilePreviewable) return -1;
    return previewableFiles.findIndex(({ originalIndex }) => originalIndex === currentIndex);
  }, [currentIndex, previewableFiles, isCurrentFilePreviewable]);

  const totalImages = previewableFiles.length;

  // Reset states when file changes
  React.useEffect(() => {
    setZoom(fitZoom);
    setRotation(0);
    setPanX(0);
    setPanY(0);
    setImageLoading(true);
    setImageError(false);
  }, [currentIndex, fitZoom]);

  // Initialize current index
  React.useEffect(() => {
    setCurrentIndex(initialFileIndex);
  }, [initialFileIndex]);

  // Navigation functions
  const handlePrevious = React.useCallback(() => {
    if (!isCurrentFilePreviewable || totalImages <= 1) return;

    const prevImageIndex = currentImageIndex > 0 ? currentImageIndex - 1 : totalImages - 1;
    setCurrentIndex(previewableFiles[prevImageIndex].originalIndex);
  }, [isCurrentFilePreviewable, currentImageIndex, totalImages, previewableFiles]);

  const handleNext = React.useCallback(() => {
    if (!isCurrentFilePreviewable || totalImages <= 1) return;

    const nextImageIndex = currentImageIndex < totalImages - 1 ? currentImageIndex + 1 : 0;
    setCurrentIndex(previewableFiles[nextImageIndex].originalIndex);
  }, [isCurrentFilePreviewable, currentImageIndex, totalImages, previewableFiles]);

  // Zoom functions
  const handleZoomIn = React.useCallback(() => {
    setZoom((prev) => Math.min(prev * 1.5, fitZoom * 10));
  }, [fitZoom]);

  const handleZoomOut = React.useCallback(() => {
    setZoom((prev) => Math.max(prev / 1.5, Math.max(fitZoom * 0.1, 0.1)));
  }, [fitZoom]);

  const handleResetZoom = React.useCallback(() => {
    setZoom(fitZoom);
    setPanX(0);
    setPanY(0);
  }, [fitZoom]);

  const handleFitToScreen = React.useCallback(() => {
    handleResetZoom();
  }, [handleResetZoom]);

  // Rotation functions
  const handleRotateRight = React.useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const handleRotateLeft = React.useCallback(() => {
    setRotation((prev) => (prev - 90 + 360) % 360);
  }, []);

  // Fullscreen toggle
  const handleToggleFullscreen = React.useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Image load handler
  const handleImageLoad = React.useCallback(() => {
    setImageLoading(false);
    setImageError(false);

    if (imageRef.current && containerRef.current) {
      const img = imageRef.current;
      const container = containerRef.current;

      // Calculate available space
      const headerHeight = 80;
      const thumbnailStripHeight = showThumbnailStrip && totalImages > 1 ? 80 : 0;
      const padding = 40;

      const availableWidth = container.clientWidth - padding;
      const availableHeight = container.clientHeight - headerHeight - thumbnailStripHeight - padding;

      // Calculate optimal scale considering rotation
      let imgWidth = img.naturalWidth;
      let imgHeight = img.naturalHeight;

      // Swap dimensions for 90° or 270° rotation
      if (rotation === 90 || rotation === 270) {
        [imgWidth, imgHeight] = [imgHeight, imgWidth];
      }

      const scaleX = availableWidth / imgWidth;
      const scaleY = availableHeight / imgHeight;
      const optimalScale = Math.min(scaleX, scaleY, 1);

      setFitZoom(optimalScale);
      setZoom(optimalScale);
    }
  }, [rotation, showThumbnailStrip, totalImages]);

  const handleImageError = React.useCallback(() => {
    setImageLoading(false);
    setImageError(true);
  }, []);

  // Touch event handlers for mobile support
  const handleTouchStart = React.useCallback(
    (e: React.TouchEvent) => {
      const touches = e.touches;

      if (touches.length === 2 && enablePinchZoom) {
        // Multi-touch zoom
        const touch1 = touches[0];
        const touch2 = touches[1];
        const distance = Math.sqrt(Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2));

        setTouchState({
          startDistance: distance,
          startScale: zoom,
          startX: (touch1.clientX + touch2.clientX) / 2,
          startY: (touch1.clientY + touch2.clientY) / 2,
          touches,
        });
      } else if (touches.length === 1 && enableSwipeNavigation) {
        // Single touch for swipe navigation
        const touch = touches[0];
        setSwipeState({
          startX: touch.clientX,
          startY: touch.clientY,
          currentX: touch.clientX,
          currentY: touch.clientY,
          isSwiping: false,
          swipeDirection: null,
        });
      }
    },
    [zoom, enablePinchZoom, enableSwipeNavigation],
  );

  const handleTouchMove = React.useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault(); // Prevent scrolling
      const touches = e.touches;

      if (touches.length === 2 && touchState && enablePinchZoom) {
        // Handle pinch zoom
        const touch1 = touches[0];
        const touch2 = touches[1];
        const distance = Math.sqrt(Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2));

        const scale = (distance / touchState.startDistance) * touchState.startScale;
        const clampedScale = Math.max(fitZoom * 0.1, Math.min(scale, fitZoom * 10));
        setZoom(clampedScale);
      } else if (touches.length === 1 && swipeState && enableSwipeNavigation) {
        // Handle swipe navigation
        const touch = touches[0];
        const deltaX = touch.clientX - swipeState.startX;
        const deltaY = touch.clientY - swipeState.startY;
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);

        // Determine if this is a horizontal swipe
        if (absDeltaX > 20 && absDeltaX > absDeltaY * 2) {
          const direction = deltaX > 0 ? "right" : "left";
          setSwipeState((prev) =>
            prev
              ? {
                  ...prev,
                  currentX: touch.clientX,
                  currentY: touch.clientY,
                  isSwiping: true,
                  swipeDirection: direction,
                }
              : null,
          );
        } else if (zoom > fitZoom) {
          // Handle pan when zoomed
          setPanX((prev) => prev + (touch.clientX - (swipeState.currentX || touch.clientX)));
          setPanY((prev) => prev + (touch.clientY - (swipeState.currentY || touch.clientY)));
          setSwipeState((prev) =>
            prev
              ? {
                  ...prev,
                  currentX: touch.clientX,
                  currentY: touch.clientY,
                }
              : null,
          );
        }
      }
    },
    [touchState, swipeState, fitZoom, zoom, enablePinchZoom, enableSwipeNavigation],
  );

  const handleTouchEnd = React.useCallback(() => {
    if (swipeState && swipeState.isSwiping && enableSwipeNavigation) {
      const deltaX = swipeState.currentX - swipeState.startX;
      const absDeltaX = Math.abs(deltaX);

      // Trigger navigation if swipe distance is significant
      if (absDeltaX > 100) {
        if (deltaX > 0 && totalImages > 1) {
          handlePrevious();
        } else if (deltaX < 0 && totalImages > 1) {
          handleNext();
        }
      }
    }

    setTouchState(null);
    setSwipeState(null);
    setIsDragging(false);
  }, [swipeState, totalImages, handlePrevious, handleNext, enableSwipeNavigation]);

  // Mouse wheel zoom for desktop
  const handleWheel = React.useCallback(
    (e: React.WheelEvent) => {
      if (!isCurrentFilePreviewable) return;

      e.preventDefault();
      const delta = e.deltaY;

      if (delta < 0) {
        handleZoomIn();
      } else {
        handleZoomOut();
      }
    },
    [isCurrentFilePreviewable, handleZoomIn, handleZoomOut],
  );

  // Keyboard navigation and shortcuts
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "Escape":
          onOpenChange(false);
          break;
        case "ArrowLeft":
          event.preventDefault();
          handlePrevious();
          break;
        case "ArrowRight":
          event.preventDefault();
          handleNext();
          break;
        case "=":
        case "+":
          event.preventDefault();
          handleZoomIn();
          break;
        case "-":
          event.preventDefault();
          handleZoomOut();
          break;
        case "0":
          event.preventDefault();
          handleResetZoom();
          break;
        case "f":
        case "F":
          event.preventDefault();
          handleFitToScreen();
          break;
        case "r":
        case "R":
          if (enableRotation) {
            event.preventDefault();
            if (event.shiftKey) {
              handleRotateLeft();
            } else {
              handleRotateRight();
            }
          }
          break;
        case "F11":
          event.preventDefault();
          handleToggleFullscreen();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    open,
    onOpenChange,
    handlePrevious,
    handleNext,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleFitToScreen,
    handleRotateLeft,
    handleRotateRight,
    handleToggleFullscreen,
    enableRotation,
  ]);

  // Download handler
  const handleDownload = React.useCallback(() => {
    if (!currentFile) return;

    const downloadUrl = `${baseUrl}/files/${currentFile.id}/download`;
    window.open(downloadUrl, "_blank");
  }, [currentFile, baseUrl]);

  // External open handler for PDFs
  const handleOpenExternal = React.useCallback(() => {
    if (!currentFile) return;

    const fileUrl = getFileUrl(currentFile, baseUrl);
    window.open(fileUrl, "_blank");
  }, [currentFile, baseUrl]);

  if (!currentFile) return null;

  const isPDF = getFileExtension(currentFile.filename).toLowerCase() === "pdf";
  const isEPS = isEpsFile(currentFile);
  const isVideo = isVideoFile(currentFile);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay className={cn("bg-black/95 backdrop-blur-md transition-all duration-300", isFullscreen && "bg-black")} />
      <DialogContent
        ref={modalRef}
        className={cn("max-w-[100vw] max-h-[100vh] w-full h-full p-0 border-0 bg-transparent shadow-none transition-all duration-300", isFullscreen && "max-w-none max-h-none")}
        aria-describedby="file-preview-description"
      >
        <div className="relative w-full h-full">
          {/* Fixed Header - Always visible */}
          <div
            className={cn(
              "fixed top-4 left-4 right-4 z-[100] flex items-center justify-between pointer-events-none transition-all duration-300",
              isFullscreen && "top-2 left-2 right-2",
            )}
          >
            <div className="flex items-center gap-3 bg-black/90 backdrop-blur-xl rounded-xl px-4 py-3 pointer-events-auto border border-white/20 shadow-2xl">
              <span className="text-white font-medium text-sm truncate max-w-xs">{currentFile.filename}</span>
              <span className="text-white/70 text-xs">{formatFileSize(currentFile.size)}</span>
              {isCurrentFilePreviewable && totalImages > 1 && showImageCounter && (
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-xs">
                  {currentImageIndex + 1} de {totalImages}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              {/* Zoom and Tools for Images */}
              {isCurrentFilePreviewable && (
                <div className="flex items-center gap-1 bg-black/90 backdrop-blur-xl rounded-xl p-1 border border-white/20 shadow-2xl">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-white hover:bg-white/20 transition-colors"
                    onClick={handleZoomOut}
                    disabled={zoom <= Math.max(fitZoom * 0.1, 0.1)}
                    title="Diminuir zoom (-)"
                  >
                    <IconZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-white text-xs px-3 min-w-20 text-center font-mono bg-white/10 rounded py-1">{Math.round((zoom / fitZoom) * 100)}%</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-white hover:bg-white/20 transition-colors"
                    onClick={handleZoomIn}
                    disabled={zoom >= fitZoom * 10}
                    title="Aumentar zoom (+)"
                  >
                    <IconZoomIn className="h-4 w-4" />
                  </Button>
                  <div className="w-px h-6 bg-white/20 mx-1" />
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/20 transition-colors" onClick={handleFitToScreen} title="Ajustar à tela (F)">
                    <IconMaximize className="h-4 w-4" />
                  </Button>
                  {enableRotation && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-white hover:bg-white/20 transition-colors"
                        onClick={handleRotateLeft}
                        title="Girar à esquerda (Shift+R)"
                      >
                        <IconRotate2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-white hover:bg-white/20 transition-colors"
                        onClick={handleRotateRight}
                        title="Girar à direita (R)"
                      >
                        <IconRotateClockwise className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-1 bg-black/90 backdrop-blur-xl rounded-xl p-1 border border-white/20 shadow-2xl">
                {isPDF && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/20 transition-colors" onClick={handleOpenExternal} title="Abrir PDF">
                    <IconExternalLink className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/20 transition-colors" onClick={handleDownload} title="Baixar arquivo">
                  <IconDownload className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-white hover:bg-white/20 transition-colors" onClick={() => onOpenChange(false)} title="Fechar (ESC)">
                  <IconX className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Navigation Arrows */}
          {isCurrentFilePreviewable && totalImages > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "fixed left-4 top-1/2 -translate-y-1/2 z-[90] h-14 w-14 rounded-full",
                  "bg-black/90 backdrop-blur-xl text-white hover:bg-white/20",
                  "border border-white/20 shadow-2xl transition-all duration-200",
                  "hover:scale-110 active:scale-95",
                  isFullscreen && "left-2",
                )}
                onClick={handlePrevious}
                disabled={totalImages <= 1}
                title="Imagem anterior (←)"
              >
                <IconArrowLeft className="h-6 w-6" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "fixed right-4 top-1/2 -translate-y-1/2 z-[90] h-14 w-14 rounded-full",
                  "bg-black/90 backdrop-blur-xl text-white hover:bg-white/20",
                  "border border-white/20 shadow-2xl transition-all duration-200",
                  "hover:scale-110 active:scale-95",
                  isFullscreen && "right-2",
                )}
                onClick={handleNext}
                disabled={totalImages <= 1}
                title="Próxima imagem (→)"
              >
                <IconArrowRight className="h-6 w-6" />
              </Button>
            </>
          )}

          {/* Image Container */}
          <div
            ref={containerRef}
            className={cn("absolute inset-0 flex items-center justify-center overflow-hidden transition-all duration-300", isDragging && "cursor-grabbing")}
            style={{
              paddingTop: isFullscreen ? "60px" : "100px",
              paddingBottom: showThumbnailStrip && totalImages > 1 ? "100px" : "20px",
              paddingLeft: "20px",
              paddingRight: "20px",
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
          >
            {isCurrentFilePreviewable ? (
              isVideo ? (
                <div className="w-full max-w-5xl mx-auto">
                  <video
                    key={currentFile.id}
                    controls
                    autoPlay={false}
                    className="w-full rounded-lg shadow-2xl"
                    style={{
                      maxHeight: "80vh",
                    }}
                    onLoadStart={() => setImageLoading(false)}
                    onError={() => {
                      setImageError(true);
                      setImageLoading(false);
                    }}
                  >
                    <source src={getFileUrl(currentFile, baseUrl)} type={currentFile.mimetype} />
                    Seu navegador não suporta a reprodução de vídeo.
                  </video>
                </div>
              ) : (
                <>
                  {imageLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm rounded-xl z-10">
                      <div className="animate-spin rounded-full h-12 w-12 border-2 border-white border-t-transparent mb-4" />
                      <span className="text-white text-sm">Carregando imagem...</span>
                    </div>
                  )}

                  {imageError ? (
                    <div className="flex flex-col items-center justify-center gap-4 bg-white/10 backdrop-blur-sm rounded-xl p-8 max-w-md">
                      <div className="text-6xl">⚠️</div>
                      <div className="text-center">
                        <h3 className="text-white text-lg font-medium mb-2">Erro ao carregar imagem</h3>
                        <p className="text-white/70 text-sm mb-4">Não foi possível carregar a imagem.</p>
                        <Button variant="outline" onClick={handleDownload} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                          <IconDownload className="h-4 w-4 mr-2" />
                          Baixar arquivo
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <img
                      ref={imageRef}
                      src={
                        isEPS && currentFile.thumbnailUrl
                          ? currentFile.thumbnailUrl.startsWith("http")
                            ? currentFile.thumbnailUrl
                            : `${baseUrl || (typeof window !== 'undefined' && (window as any).__ANKAA_API_URL__) || ''}/files/thumbnail/${currentFile.id}?size=large`
                          : getFileUrl(currentFile, baseUrl)
                      }
                      alt={currentFile.filename}
                      className={cn(
                        "transition-all duration-200 rounded-lg shadow-2xl select-none",
                        zoom > fitZoom ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                        isEPS && "ring-2 ring-indigo-400 ring-opacity-60",
                      )}
                      style={{
                        transform: `
                          scale(${zoom / fitZoom})
                          rotate(${rotation}deg)
                          translate(${panX}px, ${panY}px)
                        `,
                        transformOrigin: "center center",
                        maxWidth: "none",
                        maxHeight: "none",
                        width: `${100 * fitZoom}%`,
                        height: "auto",
                      }}
                      onLoad={handleImageLoad}
                      onError={handleImageError}
                      onClick={zoom === fitZoom ? handleZoomIn : handleResetZoom}
                      draggable={false}
                      onMouseDown={() => setIsDragging(true)}
                      onMouseUp={() => setIsDragging(false)}
                    />
                  )}
                </>
              )
            ) : isPDF ? (
              <div className="flex flex-col items-center justify-center gap-6 bg-white/10 backdrop-blur-sm rounded-xl p-8 max-w-md">
                <div className="text-8xl">📄</div>
                <div className="text-center">
                  <h3 className="text-white text-xl font-medium mb-3">{currentFile.filename}</h3>
                  <p className="text-white/70 text-sm mb-6">Documento PDF • {formatFileSize(currentFile.size)}</p>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={handleOpenExternal} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                      <IconExternalLink className="h-4 w-4 mr-2" />
                      Abrir PDF
                    </Button>
                    <Button variant="outline" onClick={handleDownload} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                      <IconDownload className="h-4 w-4 mr-2" />
                      Baixar
                    </Button>
                  </div>
                </div>
              </div>
            ) : isEPS && !currentFile.thumbnailUrl ? (
              <div className="flex flex-col items-center justify-center gap-6 bg-white/10 backdrop-blur-sm rounded-xl p-8 max-w-md">
                <IconVectorBezier className="h-20 w-20 text-indigo-400" />
                <div className="text-center">
                  <h3 className="text-white text-xl font-medium mb-3">{currentFile.filename}</h3>
                  <p className="text-white/70 text-sm mb-2">Arquivo EPS • {formatFileSize(currentFile.size)}</p>
                  <p className="text-white/60 text-xs mb-6">Visualização não disponível</p>
                  <Button variant="outline" onClick={handleDownload} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                    <IconDownload className="h-4 w-4 mr-2" />
                    Baixar arquivo
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-6 bg-white/10 backdrop-blur-sm rounded-xl p-8 max-w-md">
                <div className="text-8xl">📎</div>
                <div className="text-center">
                  <h3 className="text-white text-xl font-medium mb-3">{currentFile.filename}</h3>
                  <p className="text-white/70 text-sm mb-6">{formatFileSize(currentFile.size)}</p>
                  <Button variant="outline" onClick={handleDownload} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                    <IconDownload className="h-4 w-4 mr-2" />
                    Baixar arquivo
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Thumbnail Strip */}
          {isCurrentFilePreviewable && totalImages > 1 && showThumbnailStrip && (
            <div className={cn("fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] transition-all duration-300", isFullscreen && "bottom-2")}>
              <div className="flex items-center gap-3 bg-black/90 backdrop-blur-xl rounded-xl p-3 max-w-[90vw] overflow-x-auto border border-white/20 shadow-2xl">
                {previewableFiles.map(({ file, originalIndex }, index) => {
                  const isActive = originalIndex === currentIndex;
                  const isLoaded = !imageLoading || originalIndex !== currentIndex;

                  return (
                    <button
                      key={file.id}
                      onClick={() => setCurrentIndex(originalIndex)}
                      className={cn(
                        "relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all duration-200",
                        "bg-black/30 hover:scale-105 active:scale-95",
                        isActive ? "border-white shadow-lg shadow-white/25 scale-105" : "border-white/30 hover:border-white/60",
                      )}
                      title={`${file.filename} (${index + 1}/${totalImages})`}
                    >
                      {isLoaded ? (
                        <img
                          src={getFileThumbnailUrl(file, "small", baseUrl) || getFileUrl(file, baseUrl)}
                          alt={`Miniatura ${index + 1}`}
                          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-200"
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border border-white border-t-transparent" />
                        </div>
                      )}

                      {isActive && <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Swipe Indicator */}
          {swipeState && swipeState.isSwiping && enableSwipeNavigation && (
            <div className="fixed inset-0 pointer-events-none z-[70] flex items-center justify-center">
              <div
                className={cn(
                  "flex items-center gap-2 bg-black/80 backdrop-blur-md rounded-lg px-4 py-2 text-white text-sm",
                  "transition-all duration-200",
                  swipeState.swipeDirection === "left" && "animate-pulse",
                  swipeState.swipeDirection === "right" && "animate-pulse",
                )}
              >
                {swipeState.swipeDirection === "left" && (
                  <>
                    <IconArrowLeft className="h-4 w-4" />
                    <span>Próxima imagem</span>
                  </>
                )}
                {swipeState.swipeDirection === "right" && (
                  <>
                    <IconArrowRight className="h-4 w-4" />
                    <span>Imagem anterior</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Screen Reader Description */}
        <div id="file-preview-description" className="sr-only">
          Visualizador de arquivos com suporte a navegação por teclado e gestos. Use as setas para navegar entre imagens, + e - para zoom, 0 para resetar zoom, F para ajustar à
          tela, R para rotacionar, ESC para fechar.
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Export enhanced version to replace existing file-preview
export { FilePreviewModal as FilePreview };
