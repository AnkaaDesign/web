import { useState, useCallback } from 'react';
import type { MediaItem } from '../../types/media';

interface UseMediaViewerReturn {
  isOpen: boolean;
  currentIndex: number;
  openViewer: (index?: number) => void;
  closeViewer: () => void;
  setCurrentIndex: (index: number) => void;
}

/**
 * Hook for managing media viewer state
 * @param items - Array of media items
 * @returns Media viewer state and controls
 */
export const useMediaViewer = (items: MediaItem[]): UseMediaViewerReturn => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const openViewer = useCallback((index: number = 0) => {
    if (index >= 0 && index < items.length) {
      setCurrentIndex(index);
      setIsOpen(true);
    }
  }, [items.length]);

  const closeViewer = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    currentIndex,
    openViewer,
    closeViewer,
    setCurrentIndex,
  };
};
