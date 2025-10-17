/**
 * Media viewer related type definitions
 */

export type MediaType = 'image' | 'video';

export interface MediaItem {
  id: string;
  type: MediaType;
  url: string;
  thumbnail?: string;
  title?: string;
  alt?: string;
  width?: number;
  height?: number;
  size?: number;
  format?: string;
  createdAt?: string | Date;
  metadata?: Record<string, any>;
}

export interface MediaViewerState {
  isOpen: boolean;
  currentIndex: number;
  zoom: number;
  rotation: number;
  position: { x: number; y: number };
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
}

export interface VideoPlayerState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  playbackRate: number;
}

export interface ImageViewerState {
  zoom: number;
  rotation: number;
  position: { x: number; y: number };
  isDragging: boolean;
  filters?: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
  };
}

export interface MediaViewerCallbacks {
  onOpen?: (index: number) => void;
  onClose?: () => void;
  onChange?: (index: number) => void;
  onDownload?: (item: MediaItem) => void;
  onError?: (error: Error, item: MediaItem) => void;
  onLoad?: (item: MediaItem) => void;
}

export interface MediaGalleryOptions {
  enableKeyboard?: boolean;
  enableTouch?: boolean;
  enableZoom?: boolean;
  enableRotation?: boolean;
  enableDownload?: boolean;
  showThumbnails?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  closeOnBackdropClick?: boolean;
  maxZoom?: number;
  minZoom?: number;
  zoomStep?: number;
}
