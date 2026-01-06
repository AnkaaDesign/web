import * as React from "react";
import type { File as AnkaaFile } from "../../../types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  IconDownload,
  IconExternalLink,
  IconFileTypePdf,
  IconAlertCircle,
  IconLoader2,
  IconZoomIn,
  IconZoomOut,
  IconRefresh,
} from "@tabler/icons-react";
import { formatFileSize } from "../../../utils/file";

export interface PDFViewerProps {
  file: AnkaaFile;
  url: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "modal" | "new-tab" | "inline";
  onDownload?: (file: AnkaaFile) => void;
  maxFileSize?: number; // in bytes, default 50MB
  showToolbar?: boolean;
  className?: string;
}

interface PDFLoadState {
  status: "idle" | "loading" | "loaded" | "error";
  error?: string;
  supportsInlineViewing?: boolean;
}

/**
 * Check if browser supports native PDF viewing
 */
const checkBrowserPDFSupport = (): boolean => {
  // Check if running in browser
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  // Chrome, Edge, Firefox, Safari all support PDF viewing
  const hasNativePDFSupport =
    navigator.mimeTypes &&
    Array.from(navigator.mimeTypes).some((mimeType) => mimeType.type === "application/pdf");

  // Modern browsers support it even if not in mimeTypes
  const isModernBrowser =
    /Chrome|Firefox|Safari|Edge/.test(navigator.userAgent);

  return hasNativePDFSupport || isModernBrowser;
};

/**
 * Open PDF in new tab with proper headers
 */
const openPDFInNewTab = (url: string, filename: string) => {
  if (typeof window === "undefined") return;

  // Create a link and trigger it
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  // Set download attribute to suggest filename but browser will show PDF viewer
  link.setAttribute("data-filename", filename);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * PDF Viewer Component
 *
 * Supports three modes:
 * 1. modal - Opens PDF in a modal dialog with iframe viewer
 * 2. new-tab - Opens PDF in a new browser tab (default and recommended)
 * 3. inline - Embeds PDF viewer inline (not in a modal)
 */
export const PDFViewer: React.FC<PDFViewerProps> = ({
  file,
  url,
  open,
  onOpenChange,
  mode = "new-tab",
  onDownload,
  maxFileSize = 50 * 1024 * 1024, // 50MB default
  showToolbar = true,
  className,
}) => {
  const [loadState, setLoadState] = React.useState<PDFLoadState>({
    status: "idle",
    supportsInlineViewing: undefined,
  });
  const [zoom, setZoom] = React.useState(100);
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  // Check browser support on mount
  React.useEffect(() => {
    const supportsInlineViewing = checkBrowserPDFSupport();
    setLoadState((prev) => ({
      ...prev,
      supportsInlineViewing,
    }));
  }, []);

  // Auto-open in new tab if that's the mode
  React.useEffect(() => {
    if (mode === "new-tab" && open) {
      openPDFInNewTab(url, file.filename);
      // Close the modal immediately since we opened in new tab
      setTimeout(() => onOpenChange(false), 100);
    }
  }, [mode, open, url, file.filename, onOpenChange]);

  // Validate file size
  const isFileTooLarge = file.size > maxFileSize;
  const fileSizeWarning = isFileTooLarge
    ? `File is ${formatFileSize(file.size)}. Files larger than ${formatFileSize(maxFileSize)} may not load properly.`
    : null;

  const handleDownload = () => {
    if (onDownload) {
      onDownload(file);
    } else {
      // Default download
      const link = document.createElement("a");
      link.href = url.replace("/serve/", "/download/");
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleOpenInNewTab = () => {
    openPDFInNewTab(url, file.filename);
  };

  const handleIframeLoad = () => {
    setLoadState({
      status: "loaded",
      supportsInlineViewing: loadState.supportsInlineViewing,
    });
  };

  const handleIframeError = () => {
    setLoadState({
      status: "error",
      error: "Failed to load PDF. Your browser may not support inline PDF viewing.",
      supportsInlineViewing: false,
    });
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 25, 50));
  };

  const handleResetZoom = () => {
    setZoom(100);
  };

  const handleRefresh = () => {
    if (iframeRef.current) {
      setLoadState((prev) => ({ ...prev, status: "loading" }));
      iframeRef.current.src = iframeRef.current.src;
    }
  };

  // For new-tab mode, we don't render anything (or show a brief message)
  if (mode === "new-tab") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconFileTypePdf className="h-5 w-5 text-red-500" />
              Opening PDF
            </DialogTitle>
            <DialogDescription>
              The PDF is opening in a new browser tab...
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
            <IconLoader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              If the PDF doesn't open, check your browser's popup blocker settings.
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleOpenInNewTab} className="flex-1">
              <IconExternalLink className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button variant="outline" onClick={handleDownload} className="flex-1">
              <IconDownload className="h-4 w-4 mr-2" />
              Download Instead
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Inline viewer component (used in both modal and inline modes)
  const ViewerContent = (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Toolbar */}
      {showToolbar && (
        <div className="flex items-center justify-between gap-2 p-3 border-b bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            <IconFileTypePdf className="h-5 w-5 text-red-500 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-medium truncate">{file.filename}</h3>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Zoom controls */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomOut}
              disabled={zoom <= 50}
              className="h-8 w-8"
              title="Zoom out"
            >
              <IconZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
              {zoom}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              className="h-8 w-8"
              title="Zoom in"
            >
              <IconZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleResetZoom}
              className="h-8 w-8"
              title="Reset zoom"
            >
              <IconRefresh className="h-4 w-4" />
            </Button>

            {/* Actions */}
            <div className="w-px h-6 bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenInNewTab}
              className="h-8 w-8"
              title="Open in new tab"
            >
              <IconExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              className="h-8 w-8"
              title="Download PDF"
            >
              <IconDownload className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Warnings */}
      {fileSizeWarning && (
        <Alert className="m-3 mb-0">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">{fileSizeWarning}</AlertDescription>
        </Alert>
      )}

      {!loadState.supportsInlineViewing && loadState.supportsInlineViewing !== undefined && (
        <Alert variant="destructive" className="m-3 mb-0">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Your browser doesn't support inline PDF viewing. Please download the file or open it in a new tab.
          </AlertDescription>
        </Alert>
      )}

      {/* PDF Viewer */}
      <div className="flex-1 relative bg-muted/20 overflow-hidden">
        {loadState.status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
            <div className="flex flex-col items-center gap-2">
              <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading PDF...</p>
            </div>
          </div>
        )}

        {loadState.status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="max-w-md text-center space-y-4">
              <IconAlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Failed to Load PDF</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {loadState.error || "An error occurred while loading the PDF."}
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={handleRefresh}>
                  <IconRefresh className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button variant="outline" onClick={handleOpenInNewTab}>
                  <IconExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
                <Button onClick={handleDownload}>
                  <IconDownload className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </div>
        )}

        {loadState.supportsInlineViewing !== false && (
          <iframe
            ref={iframeRef}
            src={`${url}#toolbar=0&navpanes=0&view=FitH&zoom=${zoom}`}
            className="w-full h-full border-0"
            title={file.filename}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            style={{
              opacity: loadState.status === "loaded" ? 1 : 0,
              transition: "opacity 0.3s ease-in-out",
            }}
          />
        )}

        {loadState.supportsInlineViewing === false && loadState.status !== "error" && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="max-w-md text-center space-y-4">
              <IconFileTypePdf className="h-12 w-12 text-red-500 mx-auto" />
              <div>
                <h3 className="text-lg font-semibold mb-2">PDF Preview Unavailable</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Your browser doesn't support inline PDF viewing. Please open the PDF in a new tab or download it.
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={handleOpenInNewTab}>
                  <IconExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
                <Button onClick={handleDownload}>
                  <IconDownload className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Render based on mode
  if (mode === "inline") {
    return ViewerContent;
  }

  // Modal mode
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] p-0 gap-0">
        {ViewerContent}
      </DialogContent>
    </Dialog>
  );
};

export default PDFViewer;
