import { useState, useCallback } from "react";
import type { File as AnkaaFile } from "../types";

export interface UseFilePreviewOptions {
  baseUrl?: string;
  enableSwipeNavigation?: boolean;
  enablePinchZoom?: boolean;
  enableRotation?: boolean;
  showThumbnailStrip?: boolean;
  showImageCounter?: boolean;
}

export interface UseFilePreviewReturn {
  isOpen: boolean;
  currentFileIndex: number;
  files: AnkaaFile[];
  openPreview: (files: AnkaaFile[], initialIndex?: number) => void;
  closePreview: () => void;
  setCurrentFileIndex: (index: number) => void;
  nextFile: () => void;
  previousFile: () => void;
  openFilePreview: (file: AnkaaFile, allFiles?: AnkaaFile[]) => void;
}

/**
 * Hook for managing file preview modal state and navigation.
 *
 * @example
 * ```tsx
 * const filePreview = useFilePreview({
 *   baseUrl: 'http://localhost:3030',
 *   enableSwipeNavigation: true,
 *   showThumbnailStrip: true
 * });
 *
 * // Open preview for multiple files
 * const handleOpenGallery = () => {
 *   filePreview.openPreview(imageFiles, 0);
 * };
 *
 * // Open preview for single file
 * const handleOpenFile = (file: AnkaaFile, allFiles: AnkaaFile[]) => {
 *   filePreview.openFilePreview(file, allFiles);
 * };
 *
 * return (
 *   <>
 *     <FilePreviewModal
 *       files={filePreview.files}
 *       initialFileIndex={filePreview.currentFileIndex}
 *       open={filePreview.isOpen}
 *       onOpenChange={filePreview.closePreview}
 *       {...options}
 *     />
 *   </>
 * );
 * ```
 */
export function useFilePreview(_options: UseFilePreviewOptions = {}): UseFilePreviewReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [files, setFiles] = useState<AnkaaFile[]>([]);

  const openPreview = useCallback((newFiles: AnkaaFile[], initialIndex: number = 0) => {
    setFiles(newFiles);
    setCurrentFileIndex(Math.max(0, Math.min(initialIndex, newFiles.length - 1)));
    setIsOpen(true);
  }, []);

  const closePreview = useCallback(() => {
    setIsOpen(false);
    // Don't clear files immediately to allow for smooth closing animation
    setTimeout(() => {
      if (!isOpen) {
        setFiles([]);
        setCurrentFileIndex(0);
      }
    }, 300);
  }, [isOpen]);

  const setCurrentIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < files.length) {
        setCurrentFileIndex(index);
      }
    },
    [files.length],
  );

  const nextFile = useCallback(() => {
    setCurrentFileIndex((prev) => {
      const nextIndex = prev + 1;
      return nextIndex >= files.length ? 0 : nextIndex; // Loop to beginning
    });
  }, [files.length]);

  const previousFile = useCallback(() => {
    setCurrentFileIndex((prev) => {
      const prevIndex = prev - 1;
      return prevIndex < 0 ? files.length - 1 : prevIndex; // Loop to end
    });
  }, [files.length]);

  const openFilePreview = useCallback(
    (file: AnkaaFile, allFiles?: AnkaaFile[]) => {
      const filesToUse = allFiles || [file];
      const fileIndex = allFiles ? allFiles.findIndex((f) => f.id === file.id) : 0;
      openPreview(filesToUse, Math.max(0, fileIndex));
    },
    [openPreview],
  );

  return {
    isOpen,
    currentFileIndex,
    files,
    openPreview,
    closePreview,
    setCurrentFileIndex: setCurrentIndex,
    nextFile,
    previousFile,
    openFilePreview,
  };
}

/**
 * Utility functions for file preview
 */
export const filePreviewUtils = {
  /**
   * Filter files to only show previewable ones (images and EPS with thumbnails)
   */
  filterPreviewableFiles: (files: AnkaaFile[]): AnkaaFile[] => {
    return files.filter((file) => {
      const isImage = file.mimetype.startsWith("image/");
      const isEpsWithThumbnail = (file.mimetype.includes("postscript") || file.mimetype.includes("eps")) && !!file.thumbnailUrl;

      return isImage || isEpsWithThumbnail;
    });
  },

  /**
   * Find the original index of a file in the full file list when working with filtered files
   */
  findOriginalIndex: (file: AnkaaFile, originalFiles: AnkaaFile[]): number => {
    return originalFiles.findIndex((f) => f.id === file.id);
  },

  /**
   * Get navigation info for current file
   */
  getNavigationInfo: (currentIndex: number, totalFiles: number) => {
    const hasNext = totalFiles > 1;
    const hasPrevious = totalFiles > 1;
    const nextIndex = currentIndex + 1 >= totalFiles ? 0 : currentIndex + 1;
    const previousIndex = currentIndex - 1 < 0 ? totalFiles - 1 : currentIndex - 1;

    return {
      hasNext,
      hasPrevious,
      nextIndex,
      previousIndex,
      currentPosition: currentIndex + 1,
      totalFiles,
      isFirst: currentIndex === 0,
      isLast: currentIndex === totalFiles - 1,
    };
  },

  /**
   * Check if file can be previewed
   */
  canPreviewFile: (file: AnkaaFile): boolean => {
    const isImage = file.mimetype.startsWith("image/");
    const isEpsWithThumbnail = (file.mimetype.includes("postscript") || file.mimetype.includes("eps")) && !!file.thumbnailUrl;

    return isImage || isEpsWithThumbnail;
  },

  /**
   * Get file type for display purposes
   */
  getFileDisplayType: (file: AnkaaFile): string => {
    if (file.mimetype.startsWith("image/")) {
      return "Imagem";
    }

    if (file.mimetype === "application/pdf") {
      return "PDF";
    }

    if (file.mimetype.includes("postscript") || file.mimetype.includes("eps")) {
      return "EPS";
    }

    if (file.mimetype.includes("word")) {
      return "Documento Word";
    }

    if (file.mimetype.includes("excel") || file.mimetype.includes("spreadsheet")) {
      return "Planilha";
    }

    return "Arquivo";
  },
};
