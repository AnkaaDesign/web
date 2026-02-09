import * as React from "react";
import type { File as AnkaaFile } from "../../../types";
import { fileViewerService } from "../../../utils/file-viewer";
import type { FileViewerConfig } from "../../../utils/file-viewer";
import { FilePreview } from "./file-preview-modal";
import { VideoPlayer } from "./video-player";
import { PDFViewer } from "./pdf-viewer";
import { toast } from "sonner";

export interface FileViewerState {
  isImageModalOpen: boolean;
  isVideoModalOpen: boolean;
  isPdfModalOpen: boolean;
  currentFiles: AnkaaFile[];
  currentFileIndex: number;
  currentVideoFile: AnkaaFile | null;
  currentVideoUrl: string | null;
  currentPdfFile: AnkaaFile | null;
  currentPdfUrl: string | null;
}

export interface FileViewerProps {
  config?: FileViewerConfig;
  baseUrl?: string;
  onDownload?: (file: AnkaaFile, url: string) => void;
  onSecurityWarning?: (warnings: string[], file: AnkaaFile) => void;
}

/**
 * Global file viewer context and provider
 * Manages modal states and coordinates between different file viewing components
 */
export const FileViewerContext = React.createContext<{
  state: FileViewerState;
  actions: {
    openImageModal: (files: AnkaaFile[], initialIndex?: number) => void;
    closeImageModal: () => void;
    openVideoModal: (file: AnkaaFile, url: string) => void;
    closeVideoModal: () => void;
    openPdfModal: (file: AnkaaFile, url: string) => void;
    closePdfModal: () => void;
    viewFile: (file: AnkaaFile) => void;
    viewFiles: (files: AnkaaFile[], initialIndex: number) => void;
    downloadFile: (file: AnkaaFile) => void;
  };
} | null>(null);

export const FileViewerProvider: React.FC<React.PropsWithChildren<FileViewerProps>> = ({ children, config, baseUrl, onDownload, onSecurityWarning }) => {
  const [state, setState] = React.useState<FileViewerState>({
    isImageModalOpen: false,
    isVideoModalOpen: false,
    isPdfModalOpen: false,
    currentFiles: [],
    currentFileIndex: 0,
    currentVideoFile: null,
    currentVideoUrl: null,
    currentPdfFile: null,
    currentPdfUrl: null,
  });

  const viewerConfig = React.useMemo(
    () => ({
      baseUrl,
      ...fileViewerService.configs.default,
      ...config,
    }),
    [config, baseUrl],
  );

  const actionsRef = React.useRef<any>(null);

  // Create actions without circular dependencies
  const openImageModal = React.useCallback((files: AnkaaFile[], initialIndex: number = 0) => {
    setState((prev) => ({
      ...prev,
      isImageModalOpen: true,
      currentFiles: files,
      currentFileIndex: initialIndex,
    }));
  }, []);

  const closeImageModal = React.useCallback(() => {
    setState((prev) => ({
      ...prev,
      isImageModalOpen: false,
      currentFiles: [],
      currentFileIndex: 0,
    }));
  }, []);

  const openVideoModal = React.useCallback((file: AnkaaFile, url: string) => {
    setState((prev) => ({
      ...prev,
      isVideoModalOpen: true,
      currentVideoFile: file,
      currentVideoUrl: url,
    }));
  }, []);

  const closeVideoModal = React.useCallback(() => {
    setState((prev) => ({
      ...prev,
      isVideoModalOpen: false,
      currentVideoFile: null,
      currentVideoUrl: null,
    }));
  }, []);

  const openPdfModal = React.useCallback((file: AnkaaFile, url: string) => {
    setState((prev) => ({
      ...prev,
      isPdfModalOpen: true,
      currentPdfFile: file,
      currentPdfUrl: url,
    }));
  }, []);

  const closePdfModal = React.useCallback(() => {
    setState((prev) => ({
      ...prev,
      isPdfModalOpen: false,
      currentPdfFile: null,
      currentPdfUrl: null,
    }));
  }, []);

  const downloadFile = React.useCallback((file: AnkaaFile) => {
    const urls = fileViewerService.generateFileUrls(file, viewerConfig.baseUrl);

    if (onDownload) {
      onDownload(file, urls.download);
    } else {
      // Default download
      const link = document.createElement("a");
      link.href = urls.download;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Download iniciado: ${file.filename}`);
    }
  }, [viewerConfig, onDownload]);

  const viewFile = React.useCallback((file: AnkaaFile) => {
    const action = fileViewerService.determineFileViewAction(file, viewerConfig);

    fileViewerService.executeFileViewAction(action, {
      onModalOpen: (component, _url, _targetFile) => {
        if (component === "image-modal") {
          openImageModal([file], 0);
        } else if (component === "video-player") {
          // Route videos to the unified FilePreview modal (which now supports inline video playback)
          openImageModal([file], 0);
        } else if (component === "pdf-viewer") {
          // Route PDFs to the FilePreview modal (which now supports inline PDF viewing)
          openImageModal([file], 0);
        }
      },
      onInlinePlayer: (_url, _targetFile) => {
        // For inline players, you might want to emit an event or use a callback
      },
      onDownload: (url, _targetFile) => {
        if (onDownload) {
          onDownload(file, url);
        }
      },
      onSecurityWarning: (warnings) => {
        if (onSecurityWarning) {
          onSecurityWarning(warnings, file);
        } else {
          // Default warning handling
          toast.warning(`Aviso de segurança: ${warnings.join(", ")}`, {
            description: `Arquivo: ${file.filename}`,
            duration: 5000,
          });
        }
      },
    });
  }, [viewerConfig, onDownload, onSecurityWarning, openImageModal, openVideoModal, openPdfModal]);

  const viewFiles = React.useCallback((files: AnkaaFile[], initialIndex: number) => {
    // Filter to only files that can be previewed in image modal
    const previewableFiles = files.filter(f => fileViewerService.canPreviewFile(f));

    if (previewableFiles.length === 0) {
      // No previewable files, try to download the first one
      if (files[initialIndex]) {
        downloadFile(files[initialIndex]);
      }
      return;
    }

    // Find the index of the initial file in the filtered array
    const targetFile = files[initialIndex];
    const adjustedIndex = previewableFiles.findIndex(f => f.id === targetFile?.id);
    const finalIndex = adjustedIndex >= 0 ? adjustedIndex : 0;

    // Open image modal with all previewable files
    openImageModal(previewableFiles, finalIndex);
  }, [downloadFile, openImageModal]);

  const actions = React.useMemo(
    () => ({
      openImageModal,
      closeImageModal,
      openVideoModal,
      closeVideoModal,
      openPdfModal,
      closePdfModal,
      viewFile,
      viewFiles,
      downloadFile,
    }),
    [openImageModal, closeImageModal, openVideoModal, closeVideoModal, openPdfModal, closePdfModal, viewFile, viewFiles, downloadFile],
  );

  actionsRef.current = actions;

  const contextValue = React.useMemo(
    () => ({
      state,
      actions,
    }),
    [state, actions],
  );

  return (
    <FileViewerContext.Provider value={contextValue}>
      {children}

      {/* Image Modal */}
      {state.isImageModalOpen && state.currentFiles.length > 0 && (
        <FilePreview
          files={state.currentFiles}
          initialFileIndex={state.currentFileIndex}
          open={state.isImageModalOpen}
          onOpenChange={(open) => {
            if (!open) actions.closeImageModal();
          }}
          baseUrl={viewerConfig.baseUrl}
        />
      )}

      {/* Video Modal */}
      {state.isVideoModalOpen && state.currentVideoFile && state.currentVideoUrl && (
        <VideoPlayer
          file={state.currentVideoFile}
          url={state.currentVideoUrl}
          open={state.isVideoModalOpen}
          onOpenChange={(open) => {
            if (!open) actions.closeVideoModal();
          }}
          mode="modal"
          onDownload={actions.downloadFile}
        />
      )}

      {/* PDF Modal */}
      {state.isPdfModalOpen && state.currentPdfFile && state.currentPdfUrl && (
        <PDFViewer
          file={state.currentPdfFile}
          url={state.currentPdfUrl}
          open={state.isPdfModalOpen}
          onOpenChange={(open) => {
            if (!open) actions.closePdfModal();
          }}
          mode={viewerConfig.pdfViewMode || "new-tab"}
          onDownload={actions.downloadFile}
          maxFileSize={viewerConfig.pdfMaxFileSize}
          showToolbar={true}
        />
      )}
    </FileViewerContext.Provider>
  );
};

/**
 * Hook to use the file viewer context
 */
export const useFileViewer = () => {
  const context = React.useContext(FileViewerContext);
  if (!context) {
    throw new Error("useFileViewer must be used within a FileViewerProvider");
  }
  return context;
};

/**
 * Hook for single file viewing without context
 */
export const useFileViewerStandalone = (config?: FileViewerConfig) => {
  const viewerConfig = React.useMemo(
    () => ({
      ...fileViewerService.configs.default,
      ...config,
    }),
    [config],
  );

  const viewFile = React.useCallback(
    (
      file: AnkaaFile,
      options: {
        onModalOpen?: (component: string, url: string, file?: AnkaaFile) => void;
        onInlinePlayer?: (url: string, file?: AnkaaFile) => void;
        onDownload?: (url: string, file?: AnkaaFile) => void;
        onSecurityWarning?: (warnings: string[]) => void;
      } = {},
    ) => {
      return fileViewerService.viewFile(file, viewerConfig, options);
    },
    [viewerConfig],
  );

  const canPreview = React.useCallback((file: AnkaaFile) => {
    return fileViewerService.canPreviewFile(file);
  }, []);

  const getFileAction = React.useCallback(
    (file: AnkaaFile) => {
      return fileViewerService.determineFileViewAction(file, viewerConfig);
    },
    [viewerConfig],
  );

  const downloadFile = React.useCallback(
    (file: AnkaaFile) => {
      const urls = fileViewerService.generateFileUrls(file, viewerConfig.baseUrl);
      const link = document.createElement("a");
      link.href = urls.download;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    [viewerConfig],
  );

  return {
    viewFile,
    canPreview,
    getFileAction,
    downloadFile,
    config: viewerConfig,
  };
};

/**
 * Simple file viewer button component
 */
export interface FileViewerButtonProps {
  file: AnkaaFile;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  config?: FileViewerConfig;
}

export const FileViewerButton: React.FC<FileViewerButtonProps> = ({ file, children, className, disabled = false, config }) => {
  const context = React.useContext(FileViewerContext);
  const standalone = useFileViewerStandalone(config);

  const handleClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (disabled) return;

      if (context) {
        context.actions.viewFile(file);
      } else {
        standalone.viewFile(file);
      }
    },
    [context, standalone, file, disabled],
  );

  return (
    <button onClick={handleClick} disabled={disabled} className={className} type="button">
      {children}
    </button>
  );
};

export default FileViewerProvider;
