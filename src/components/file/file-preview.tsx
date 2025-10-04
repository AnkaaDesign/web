import * as React from "react";
import { IconArrowLeft, IconArrowRight, IconX, IconZoomIn, IconZoomOut, IconDownload, IconExternalLink, IconVectorBezier } from "@tabler/icons-react";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { File as AnkaaFile } from "../../types";
import { isImageFile, getFileUrl, getFileThumbnailUrl, formatFileSize, getFileExtension } from "../../utils";

const isEpsFile = (file: AnkaaFile): boolean => {
  const epsMimeTypes = ["application/postscript", "application/x-eps", "application/eps", "image/eps", "image/x-eps"];
  return epsMimeTypes.includes(file.mimetype.toLowerCase());
};

export interface FilePreviewProps {
  files: AnkaaFile[];
  initialFileIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseUrl?: string;
}

export function FilePreview({ files, initialFileIndex = 0, open, onOpenChange, baseUrl = "" }: FilePreviewProps) {
  const [currentIndex, setCurrentIndex] = React.useState(initialFileIndex);
  const [zoom, setZoom] = React.useState(1);
  const [fitZoom, setFitZoom] = React.useState(1);
  const [imageLoading, setImageLoading] = React.useState(true);
  const imageRef = React.useRef<HTMLImageElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Filter images and EPS files with thumbnails for gallery navigation
  const imageFiles = React.useMemo(
    () => files.map((file, index) => ({ file, originalIndex: index })).filter(({ file }) => isImageFile(file) || (isEpsFile(file) && file.thumbnailUrl)),
    [files],
  );

  const currentFile = files[currentIndex];
  const isCurrentFileImage = currentFile && isImageFile(currentFile);
  const isCurrentFileEps = currentFile && isEpsFile(currentFile);
  const isCurrentFilePreviewable = isCurrentFileImage || (isCurrentFileEps && currentFile.thumbnailUrl);

  // Find current image index within image files
  const currentImageIndex = React.useMemo(() => {
    if (!isCurrentFilePreviewable) return -1;
    return imageFiles.findIndex(({ originalIndex }) => originalIndex === currentIndex);
  }, [currentIndex, imageFiles, isCurrentFilePreviewable]);

  const totalImages = imageFiles.length;

  React.useEffect(() => {
    setCurrentIndex(initialFileIndex);
  }, [initialFileIndex]);

  React.useEffect(() => {
    setZoom(fitZoom);
    setImageLoading(true);
  }, [currentIndex, fitZoom]);

  // Update image dimensions when zoom changes
  React.useEffect(() => {
    if (imageRef.current && fitZoom > 0) {
      const img = imageRef.current;
      const baseWidth = img.naturalWidth * fitZoom;
      const baseHeight = img.naturalHeight * fitZoom;

      img.style.width = `${baseWidth}px`;
      img.style.height = `${baseHeight}px`;
    }
  }, [zoom, fitZoom]);

  const handlePrevious = React.useCallback(() => {
    if (!isCurrentFilePreviewable || totalImages <= 1) return;

    const prevImageIndex = currentImageIndex > 0 ? currentImageIndex - 1 : totalImages - 1;
    setCurrentIndex(imageFiles[prevImageIndex].originalIndex);
  }, [isCurrentFilePreviewable, currentImageIndex, totalImages, imageFiles]);

  const handleNext = React.useCallback(() => {
    if (!isCurrentFilePreviewable || totalImages <= 1) return;

    const nextImageIndex = currentImageIndex < totalImages - 1 ? currentImageIndex + 1 : 0;
    setCurrentIndex(imageFiles[nextImageIndex].originalIndex);
  }, [isCurrentFilePreviewable, currentImageIndex, totalImages, imageFiles]);

  const handleZoomIn = React.useCallback(() => {
    setZoom((prev) => Math.min(prev * 1.5, fitZoom * 5));
  }, [fitZoom]);

  const handleZoomOut = React.useCallback(() => {
    setZoom((prev) => Math.max(prev / 1.5, Math.max(fitZoom * 0.5, 0.25)));
  }, [fitZoom]);

  const handleResetZoom = React.useCallback(() => {
    setZoom(fitZoom);
  }, [fitZoom]);

  // Keyboard navigation
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
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange, handlePrevious, handleNext, handleZoomIn, handleZoomOut, handleResetZoom]);

  const handleImageLoad = () => {
    setImageLoading(false);

    // Calculate optimal zoom to fit image in container
    if (imageRef.current && containerRef.current) {
      const img = imageRef.current;
      const container = containerRef.current;

      // Get available space considering fixed UI elements
      const topPadding = 80; // Header space
      const bottomPadding = totalImages > 1 ? 80 : 20; // Thumbnail strip or minimal padding
      const sidePadding = 40; // Side padding

      const availableWidth = container.clientWidth - sidePadding;
      const availableHeight = container.clientHeight - topPadding - bottomPadding;

      // Calculate scale to fit both width and height
      const scaleX = availableWidth / img.naturalWidth;
      const scaleY = availableHeight / img.naturalHeight;
      const optimalScale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%

      // Apply the calculated dimensions to the image
      const scaledWidth = img.naturalWidth * optimalScale;
      const scaledHeight = img.naturalHeight * optimalScale;

      img.style.width = `${scaledWidth}px`;
      img.style.height = `${scaledHeight}px`;

      setFitZoom(optimalScale);
      setZoom(optimalScale);
    }
  };

  const handleDownload = () => {
    if (!currentFile) return;

    const downloadUrl = `${baseUrl}/files/${currentFile.id}/download`;
    window.open(downloadUrl, "_blank");
  };

  const handleOpenPDF = () => {
    if (!currentFile) return;

    const fileUrl = getFileUrl(currentFile, baseUrl);
    window.open(fileUrl, "_blank");
  };

  if (!currentFile) return null;

  const isPDF = getFileExtension(currentFile.filename).toLowerCase() === "pdf";
  const isEPS = isCurrentFileEps;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay className="bg-black/90 backdrop-blur-sm" />
      <DialogContent className="max-w-[100vw] max-h-[100vh] w-full h-full p-0 border-0 bg-transparent shadow-none" aria-describedby="file-preview-description">
        <div className="relative w-full h-full">
          {/* Fixed Header - Always visible */}
          <div className="fixed top-4 left-4 right-4 z-[100] flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-3 bg-black/80 backdrop-blur-md rounded-lg px-4 py-2 pointer-events-auto border border-white/10">
              <span className="text-white font-medium text-sm truncate max-w-xs">{currentFile.filename}</span>
              <span className="text-white/70 text-xs">{formatFileSize(currentFile.size)}</span>
              {isCurrentFilePreviewable && totalImages > 1 && (
                <span className="text-white/70 text-xs">
                  {currentImageIndex + 1} de {totalImages}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 pointer-events-auto">
              {/* Zoom Controls for Images and EPS with thumbnails */}
              {isCurrentFilePreviewable && (
                <div className="flex items-center gap-1 bg-black/80 backdrop-blur-md rounded-lg p-1 border border-white/10">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-white hover:bg-white/20 transition-colors"
                    onClick={handleZoomOut}
                    disabled={zoom <= Math.max(fitZoom * 0.5, 0.25)}
                  >
                    <IconZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-white text-xs px-2 min-w-16 text-center font-mono">{Math.round((zoom / fitZoom) * 100)}%</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 transition-colors" onClick={handleZoomIn} disabled={zoom >= fitZoom * 5}>
                    <IconZoomIn className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-1 bg-black/80 backdrop-blur-md rounded-lg p-1 border border-white/10">
                {isPDF && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 transition-colors" onClick={handleOpenPDF} title="Abrir PDF">
                    <IconExternalLink className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 transition-colors" onClick={handleDownload} title="Baixar arquivo">
                  <IconDownload className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 transition-colors" onClick={() => onOpenChange(false)}>
                  <IconX className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Fixed Navigation Arrows - Always visible */}
          {isCurrentFilePreviewable && totalImages > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="fixed left-4 top-1/2 -translate-y-1/2 z-[90] h-12 w-12 rounded-full bg-black/80 backdrop-blur-md text-white hover:bg-white/20 border border-white/10 transition-colors"
                onClick={handlePrevious}
                disabled={totalImages <= 1}
              >
                <IconArrowLeft className="h-6 w-6" />
                <span className="sr-only">Imagem anterior</span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="fixed right-4 top-1/2 -translate-y-1/2 z-[90] h-12 w-12 rounded-full bg-black/80 backdrop-blur-md text-white hover:bg-white/20 border border-white/10 transition-colors"
                onClick={handleNext}
                disabled={totalImages <= 1}
              >
                <IconArrowRight className="h-6 w-6" />
                <span className="sr-only">Próxima imagem</span>
              </Button>
            </>
          )}

          {/* Image Container - Full viewport with proper constraints */}
          <div
            ref={containerRef}
            className="absolute inset-0 flex items-center justify-center overflow-hidden"
            style={{
              paddingTop: "80px",
              paddingBottom: totalImages > 1 ? "80px" : "20px",
              paddingLeft: "20px",
              paddingRight: "20px",
            }}
            onClick={zoom > fitZoom ? handleResetZoom : undefined}
          >
            {isCurrentFilePreviewable ? (
              <>
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm rounded-lg z-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
                  </div>
                )}
                <img
                  ref={imageRef}
                  src={
                    isCurrentFileEps && currentFile.thumbnailUrl
                      ? currentFile.thumbnailUrl.startsWith("http")
                        ? currentFile.thumbnailUrl
                        : `/api/files/thumbnail/${currentFile.id}?size=large`
                      : getFileUrl(currentFile, baseUrl)
                  }
                  alt={currentFile.filename}
                  className={cn(
                    "transition-transform duration-200 cursor-pointer rounded-lg shadow-2xl",
                    zoom > fitZoom && "cursor-zoom-out",
                    isCurrentFileEps && "border-2 border-indigo-400",
                  )}
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: "center center",
                    display: "block",
                  }}
                  onLoad={handleImageLoad}
                  onClick={zoom === fitZoom ? handleZoomIn : handleResetZoom}
                  draggable={false}
                />
              </>
            ) : isPDF ? (
              <div className="flex flex-col items-center justify-center gap-4 bg-white/10 backdrop-blur-sm rounded-lg p-8 max-w-md">
                <div className="text-6xl">📄</div>
                <div className="text-center">
                  <h3 className="text-white text-lg font-medium mb-2">{currentFile.filename}</h3>
                  <p className="text-white/70 text-sm mb-4">
                    Documento PDF <span className="font-enhanced-unicode">•</span> {formatFileSize(currentFile.size)}
                  </p>
                  <Button variant="outline" onClick={handleOpenPDF} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                    <IconExternalLink className="h-4 w-4 mr-2" />
                    Abrir PDF
                  </Button>
                </div>
              </div>
            ) : isEPS && !currentFile.thumbnailUrl ? (
              <div className="flex flex-col items-center justify-center gap-4 bg-white/10 backdrop-blur-sm rounded-lg p-8 max-w-md">
                <IconVectorBezier className="h-16 w-16 text-indigo-400" />
                <div className="text-center">
                  <h3 className="text-white text-lg font-medium mb-2">{currentFile.filename}</h3>
                  <p className="text-white/70 text-sm mb-4">
                    Arquivo EPS <span className="font-enhanced-unicode">•</span> {formatFileSize(currentFile.size)}
                  </p>
                  <p className="text-white/60 text-xs mb-4">Visualização não disponível</p>
                  <Button variant="outline" onClick={handleDownload} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                    <IconDownload className="h-4 w-4 mr-2" />
                    Baixar arquivo
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 bg-white/10 backdrop-blur-sm rounded-lg p-8 max-w-md">
                <div className="text-6xl">📎</div>
                <div className="text-center">
                  <h3 className="text-white text-lg font-medium mb-2">{currentFile.filename}</h3>
                  <p className="text-white/70 text-sm mb-4">{formatFileSize(currentFile.size)}</p>
                  <Button variant="outline" onClick={handleDownload} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                    <IconDownload className="h-4 w-4 mr-2" />
                    Baixar arquivo
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Fixed Thumbnail strip - Always visible */}
          {isCurrentFilePreviewable && totalImages > 1 && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[80]">
              <div className="flex items-center gap-2 bg-black/80 backdrop-blur-md rounded-lg p-2 max-w-[90vw] overflow-x-auto border border-white/10">
                {imageFiles.map(({ file, originalIndex }, index) => {
                  const isActive = originalIndex === currentIndex;
                  return (
                    <button
                      key={file.id}
                      onClick={() => setCurrentIndex(originalIndex)}
                      className={cn(
                        "relative flex-shrink-0 w-12 h-12 rounded-md overflow-hidden border-2 transition-all bg-black/20",
                        isActive ? "border-white shadow-lg" : "border-transparent hover:border-white/50",
                      )}
                    >
                      <img
                        src={getFileThumbnailUrl(file, "small", baseUrl) || getFileUrl(file, baseUrl)}
                        alt={`Thumbnail ${index + 1}`}
                        className="absolute inset-0 w-full h-full object-contain transition-opacity duration-200"
                        loading="lazy"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div id="file-preview-description" className="sr-only">
          Visualizador de arquivo. Use as setas do teclado para navegar, + e - para zoom, 0 para resetar zoom, ESC para fechar.
        </div>
      </DialogContent>
    </Dialog>
  );
}
