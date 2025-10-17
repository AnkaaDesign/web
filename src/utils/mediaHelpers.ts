import { MediaItem, MediaType } from '../types/media';

/**
 * Utility functions for media handling
 */

/**
 * Check if a URL is a valid image
 */
export const isValidImageUrl = (url: string): boolean => {
  const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg|ico)$/i;
  return imageExtensions.test(url);
};

/**
 * Check if a URL is a valid video
 */
export const isValidVideoUrl = (url: string): boolean => {
  const videoExtensions = /\.(mp4|webm|ogg|mov|avi|mkv|flv)$/i;
  return videoExtensions.test(url);
};

/**
 * Detect media type from URL
 */
export const detectMediaType = (url: string): MediaType | null => {
  if (isValidImageUrl(url)) return 'image';
  if (isValidVideoUrl(url)) return 'video';
  return null;
};

/**
 * Get file extension from URL
 */
export const getFileExtension = (url: string): string => {
  const match = url.match(/\.([^./?#]+)(?:[?#]|$)/i);
  return match ? match[1].toLowerCase() : '';
};

/**
 * Format file size to human readable format
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Format duration to MM:SS or HH:MM:SS
 */
export const formatDuration = (seconds: number): string => {
  if (!isFinite(seconds) || seconds < 0) return '00:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Create a thumbnail from a video element
 */
export const createVideoThumbnail = (
  videoUrl: string,
  timeInSeconds: number = 1
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.currentTime = timeInSeconds;

    video.addEventListener('loadeddata', () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    });

    video.addEventListener('error', () => {
      reject(new Error('Failed to load video'));
    });

    video.src = videoUrl;
  });
};

/**
 * Download a file from URL
 */
export const downloadFile = async (
  url: string,
  filename?: string
): Promise<void> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || `download-${Date.now()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download failed:', error);
    throw error;
  }
};

/**
 * Preload image
 */
export const preloadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

/**
 * Preload multiple images
 */
export const preloadImages = (urls: string[]): Promise<HTMLImageElement[]> => {
  return Promise.all(urls.map(preloadImage));
};

/**
 * Get image dimensions
 */
export const getImageDimensions = (
  url: string
): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = url;
  });
};

/**
 * Get video dimensions and duration
 */
export const getVideoMetadata = (
  url: string
): Promise<{ width: number; height: number; duration: number }> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.addEventListener('loadedmetadata', () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
      });
    });
    video.addEventListener('error', reject);
    video.src = url;
  });
};

/**
 * Convert File to MediaItem
 */
export const fileToMediaItem = async (file: File): Promise<MediaItem> => {
  const url = URL.createObjectURL(file);
  const type = file.type.startsWith('image/') ? 'image' : 'video';

  let metadata: any = {
    size: file.size,
    format: file.type,
    createdAt: new Date(),
  };

  try {
    if (type === 'image') {
      const dimensions = await getImageDimensions(url);
      metadata = { ...metadata, ...dimensions };
    } else {
      const videoMetadata = await getVideoMetadata(url);
      metadata = { ...metadata, ...videoMetadata };
    }
  } catch (error) {
    console.error('Failed to get media metadata:', error);
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    url,
    title: file.name,
    ...metadata,
  };
};

/**
 * Convert multiple Files to MediaItems
 */
export const filesToMediaItems = (files: File[]): Promise<MediaItem[]> => {
  return Promise.all(files.map(fileToMediaItem));
};

/**
 * Calculate zoom level to fit image in container
 */
export const calculateFitZoom = (
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number
): number => {
  const widthRatio = containerWidth / imageWidth;
  const heightRatio = containerHeight / imageHeight;
  return Math.min(widthRatio, heightRatio, 1);
};

/**
 * Clamp a value between min and max
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

/**
 * Check if device supports touch
 */
export const isTouchDevice = (): boolean => {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  );
};

/**
 * Check if browser supports fullscreen
 */
export const supportsFullscreen = (): boolean => {
  return !!(
    document.fullscreenEnabled ||
    (document as any).webkitFullscreenEnabled ||
    (document as any).mozFullScreenEnabled ||
    (document as any).msFullscreenEnabled
  );
};

/**
 * Request fullscreen for element
 */
export const requestFullscreen = (element: HTMLElement): Promise<void> => {
  if (element.requestFullscreen) {
    return element.requestFullscreen();
  } else if ((element as any).webkitRequestFullscreen) {
    return (element as any).webkitRequestFullscreen();
  } else if ((element as any).mozRequestFullScreen) {
    return (element as any).mozRequestFullScreen();
  } else if ((element as any).msRequestFullscreen) {
    return (element as any).msRequestFullscreen();
  }
  return Promise.reject(new Error('Fullscreen not supported'));
};

/**
 * Exit fullscreen
 */
export const exitFullscreen = (): Promise<void> => {
  if (document.exitFullscreen) {
    return document.exitFullscreen();
  } else if ((document as any).webkitExitFullscreen) {
    return (document as any).webkitExitFullscreen();
  } else if ((document as any).mozCancelFullScreen) {
    return (document as any).mozCancelFullScreen();
  } else if ((document as any).msExitFullscreen) {
    return (document as any).msExitFullscreen();
  }
  return Promise.reject(new Error('Fullscreen not supported'));
};

/**
 * Check if element is in fullscreen
 */
export const isFullscreen = (): boolean => {
  return !!(
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement
  );
};

/**
 * Get optimal thumbnail size
 */
export const getOptimalThumbnailSize = (
  originalWidth: number,
  originalHeight: number,
  maxSize: number = 200
): { width: number; height: number } => {
  const aspectRatio = originalWidth / originalHeight;

  if (originalWidth > originalHeight) {
    return {
      width: maxSize,
      height: Math.round(maxSize / aspectRatio),
    };
  } else {
    return {
      width: Math.round(maxSize * aspectRatio),
      height: maxSize,
    };
  }
};

/**
 * Generate unique ID for media items
 */
export const generateMediaId = (): string => {
  return `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Validate media URL
 */
export const isValidMediaUrl = (url: string): boolean => {
  try {
    new URL(url);
    return isValidImageUrl(url) || isValidVideoUrl(url);
  } catch {
    return false;
  }
};

/**
 * Get media MIME type from extension
 */
export const getMimeType = (filename: string): string => {
  const ext = getFileExtension(filename);
  const mimeTypes: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    ico: 'image/x-icon',
    // Videos
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogg: 'video/ogg',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    mkv: 'video/x-matroska',
    flv: 'video/x-flv',
  };

  return mimeTypes[ext] || 'application/octet-stream';
};

/**
 * Sort media items by various criteria
 */
export const sortMediaItems = (
  items: MediaItem[],
  sortBy: 'title' | 'date' | 'size' | 'type' = 'date',
  order: 'asc' | 'desc' = 'asc'
): MediaItem[] => {
  const sorted = [...items].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'title':
        comparison = (a.title || '').localeCompare(b.title || '');
        break;
      case 'date':
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        comparison = dateA - dateB;
        break;
      case 'size':
        comparison = (a.size || 0) - (b.size || 0);
        break;
      case 'type':
        comparison = a.type.localeCompare(b.type);
        break;
    }

    return order === 'asc' ? comparison : -comparison;
  });

  return sorted;
};

/**
 * Filter media items by type
 */
export const filterMediaByType = (
  items: MediaItem[],
  type?: MediaType
): MediaItem[] => {
  if (!type) return items;
  return items.filter((item) => item.type === type);
};

/**
 * Search media items
 */
export const searchMediaItems = (
  items: MediaItem[],
  query: string
): MediaItem[] => {
  const lowercaseQuery = query.toLowerCase();
  return items.filter(
    (item) =>
      item.title?.toLowerCase().includes(lowercaseQuery) ||
      item.alt?.toLowerCase().includes(lowercaseQuery) ||
      item.id.toLowerCase().includes(lowercaseQuery)
  );
};
