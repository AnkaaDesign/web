import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Loader2,
  AlertCircle,
  Share2,
  Info,
  SkipBack,
  SkipForward,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MediaItem, MediaGalleryOptions } from '@/types/media';
import {
  formatDuration,
  downloadFile,
  requestFullscreen,
  exitFullscreen,
  isFullscreen,
} from '@/utils/mediaHelpers';

interface MediaViewerEnhancedProps {
  items: MediaItem[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  options?: MediaGalleryOptions;
  onItemChange?: (index: number, item: MediaItem) => void;
  onDownload?: (item: MediaItem) => void;
  onShare?: (item: MediaItem) => void;
}

/**
 * Enhanced media viewer with advanced features
 */
export const MediaViewerEnhanced: React.FC<MediaViewerEnhancedProps> = ({
  items,
  initialIndex = 0,
  isOpen,
  onClose,
  options = {},
  onItemChange,
  onDownload,
  onShare,
}) => {
  const {
    enableKeyboard = true,
    enableTouch = true,
    enableZoom = true,
    enableRotation = true,
    enableDownload = true,
    showThumbnails = true,
    autoPlay = false,
    loop = false,
    closeOnBackdropClick = true,
    maxZoom = 4,
    minZoom = 0.5,
    zoomStep = 0.5,
  } = options;

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Image viewer state
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Video player state
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const thumbnailsRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });

  const currentItem = items[currentIndex];
  const isImage = currentItem?.type === 'image';
  const isVideo = currentItem?.type === 'video';

  // Reset state when changing items
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    setIsPlaying(autoPlay);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackRate(1);
    setShowInfo(false);
  }, [currentIndex, autoPlay]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen || !enableKeyboard) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case ' ':
          e.preventDefault();
          if (isVideo) togglePlayPause();
          break;
        case '+':
        case '=':
          if (isImage && enableZoom) handleZoomIn();
          break;
        case '-':
          if (isImage && enableZoom) handleZoomOut();
          break;
        case 'r':
        case 'R':
          if (isImage && enableRotation) handleRotate();
          break;
        case 'f':
        case 'F':
          if (isVideo) toggleFullscreen();
          break;
        case 'i':
        case 'I':
          setShowInfo((prev) => !prev);
          break;
        case 'd':
        case 'D':
          if (enableDownload) handleDownload();
          break;
        case '0':
          if (isImage) {
            setZoom(1);
            setPosition({ x: 0, y: 0 });
          }
          break;
        case 'Home':
          goToIndex(0);
          break;
        case 'End':
          goToIndex(items.length - 1);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    enableKeyboard,
    currentIndex,
    isVideo,
    isPlaying,
    enableZoom,
    enableRotation,
    enableDownload,
    items.length,
  ]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Notify parent component of item changes
  useEffect(() => {
    if (onItemChange && currentItem) {
      onItemChange(currentIndex, currentItem);
    }
  }, [currentIndex, currentItem, onItemChange]);

  // Scroll thumbnail into view
  useEffect(() => {
    if (thumbnailsRef.current) {
      const thumbnail = thumbnailsRef.current.children[currentIndex] as HTMLElement;
      if (thumbnail) {
        thumbnail.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [currentIndex]);

  // Navigation functions
  const goToNext = useCallback(() => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else if (loop) {
      setCurrentIndex(0);
    }
  }, [currentIndex, items.length, loop]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else if (loop) {
      setCurrentIndex(items.length - 1);
    }
  }, [currentIndex, items.length, loop]);

  const goToIndex = useCallback((index: number) => {
    if (index >= 0 && index < items.length) {
      setCurrentIndex(index);
    }
  }, [items.length]);

  // Image viewer functions
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + zoomStep, maxZoom));
  }, [zoomStep, maxZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - zoomStep, minZoom));
  }, [zoomStep, minZoom]);

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      if (onDownload) {
        onDownload(currentItem);
      } else {
        await downloadFile(
          currentItem.url,
          currentItem.title || `media-${currentItem.id}`
        );
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, [currentItem, onDownload]);

  const handleShare = useCallback(() => {
    if (onShare) {
      onShare(currentItem);
    } else if (navigator.share) {
      navigator.share({
        title: currentItem.title || 'Media',
        url: currentItem.url,
      }).catch((error) => console.log('Share failed:', error));
    }
  }, [currentItem, onShare]);

  // Image dragging for panning
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (zoom > 1) {
        setIsDragging(true);
        setDragStart({
          x: e.clientX - position.x,
          y: e.clientY - position.y,
        });
      }
    },
    [zoom, position]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging && zoom > 1) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart, zoom]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (isImage && enableZoom && e.ctrlKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          handleZoomIn();
        } else {
          handleZoomOut();
        }
      }
    },
    [isImage, enableZoom, handleZoomIn, handleZoomOut]
  );

  // Touch support for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enableTouch) return;
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  }, [enableTouch]);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enableTouch) return;
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
      const deltaTime = Date.now() - touchStartRef.current.time;

      // Swipe detection
      if (Math.abs(deltaX) > 50 && deltaY < 50 && deltaTime < 300) {
        if (deltaX > 0) {
          goToPrevious();
        } else {
          goToNext();
        }
      }
    },
    [enableTouch, goToNext, goToPrevious]
  );

  // Video player functions
  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (videoRef.current) {
      const newMuted = !isMuted;
      videoRef.current.muted = newMuted;
      setIsMuted(newMuted);
    }
  }, [isMuted]);

  const handleSeek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const skipBackward = useCallback(() => {
    handleSeek(Math.max(0, currentTime - 10));
  }, [currentTime, handleSeek]);

  const skipForward = useCallback(() => {
    handleSeek(Math.min(duration, currentTime + 10));
  }, [currentTime, duration, handleSeek]);

  const handlePlaybackRateChange = useCallback((rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (isFullscreen()) {
        await exitFullscreen();
        setIsVideoFullscreen(false);
      } else if (videoRef.current) {
        await requestFullscreen(videoRef.current);
        setIsVideoFullscreen(true);
      }
    } catch (error) {
      console.error('Fullscreen failed:', error);
    }
  }, []);

  const handleVideoTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handleVideoLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoading(false);
      if (autoPlay) {
        videoRef.current.play();
      }
    }
  }, [autoPlay]);

  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
    if (loop && currentIndex === items.length - 1) {
      goToIndex(0);
    } else if (currentIndex < items.length - 1) {
      goToNext();
    }
  }, [loop, currentIndex, items.length, goToIndex, goToNext]);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  // Auto-hide controls for video
  useEffect(() => {
    if (isVideo && isPlaying) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    } else {
      setShowControls(true);
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isVideo, isPlaying]);

  const handleMouseMoveInViewer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying && isVideo) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying, isVideo]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnBackdropClick && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnBackdropClick, onClose]
  );

  if (!isOpen) return null;

  const canNavigateNext = loop || currentIndex < items.length - 1;
  const canNavigatePrev = loop || currentIndex > 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
      onMouseMove={handleMouseMoveInViewer}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleBackdropClick}
      onWheel={handleWheel}
    >
      {/* Header */}
      <div
        className={cn(
          'absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-4 transition-all duration-300',
          !showControls && isVideo && isPlaying && 'opacity-0 pointer-events-none'
        )}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-white text-sm font-medium bg-white/10 px-3 py-1 rounded-full">
              {currentIndex + 1} / {items.length}
            </span>
            {currentItem.title && (
              <span className="text-white/90 text-sm font-medium">
                {currentItem.title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isImage && enableZoom && (
              <>
                <button
                  onClick={handleZoomOut}
                  className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors disabled:opacity-30"
                  title="Zoom Out (-)"
                  disabled={zoom <= minZoom}
                >
                  <ZoomOut className="w-5 h-5" />
                </button>
                <span className="text-white text-sm min-w-[4rem] text-center bg-white/10 px-2 py-1 rounded">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors disabled:opacity-30"
                  title="Zoom In (+)"
                  disabled={zoom >= maxZoom}
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
              </>
            )}
            {isImage && enableRotation && (
              <button
                onClick={handleRotate}
                className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                title="Rotate (R)"
              >
                <RotateCw className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setShowInfo(!showInfo)}
              className={cn(
                'p-2 text-white hover:bg-white/20 rounded-lg transition-colors',
                showInfo && 'bg-white/20'
              )}
              title="Info (I)"
            >
              <Info className="w-5 h-5" />
            </button>
            {navigator.share && (
              <button
                onClick={handleShare}
                className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                title="Share"
              >
                <Share2 className="w-5 h-5" />
              </button>
            )}
            {enableDownload && (
              <button
                onClick={handleDownload}
                className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                title="Download (D)"
              >
                <Download className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
              title="Close (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Info Panel */}
      {showInfo && currentItem && (
        <div className="absolute top-20 right-4 z-20 bg-black/90 backdrop-blur-sm text-white p-4 rounded-lg max-w-sm">
          <h3 className="font-semibold mb-2">{currentItem.title || 'Untitled'}</h3>
          <div className="text-sm space-y-1 text-white/80">
            <p>Type: {currentItem.type}</p>
            {currentItem.width && currentItem.height && (
              <p>Dimensions: {currentItem.width} × {currentItem.height}</p>
            )}
            {currentItem.size && (
              <p>Size: {(currentItem.size / 1024 / 1024).toFixed(2)} MB</p>
            )}
            {isVideo && duration > 0 && (
              <p>Duration: {formatDuration(duration)}</p>
            )}
          </div>
        </div>
      )}

      {/* Main content area */}
      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Navigation buttons */}
        {items.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              disabled={!canNavigatePrev}
              className={cn(
                'absolute left-4 z-10 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-all',
                'disabled:opacity-0 disabled:pointer-events-none',
                !showControls && isVideo && isPlaying && 'opacity-0'
              )}
              title="Previous (Arrow Left)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={goToNext}
              disabled={!canNavigateNext}
              className={cn(
                'absolute right-4 z-10 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-all',
                'disabled:opacity-0 disabled:pointer-events-none',
                !showControls && isVideo && isPlaying && 'opacity-0'
              )}
              title="Next (Arrow Right)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-2" />
              <p className="text-white text-sm">Loading...</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <AlertCircle className="w-16 h-16 text-red-500" />
            <p className="text-white text-lg">Failed to load media</p>
            <button
              onClick={() => {
                setHasError(false);
                setIsLoading(true);
              }}
              className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Image viewer */}
        {isImage && !hasError && (
          <div
            className={cn(
              'relative max-w-full max-h-full transition-transform duration-200',
              isDragging && 'cursor-grabbing',
              zoom > 1 && 'cursor-grab'
            )}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              ref={imageRef}
              src={currentItem.url}
              alt={currentItem.alt || currentItem.title || 'Media'}
              className="max-w-full max-h-[calc(100vh-200px)] object-contain select-none"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                transition: isDragging ? 'none' : 'transform 0.2s ease-out',
              }}
              onLoad={handleImageLoad}
              onError={handleError}
              draggable={false}
            />
          </div>
        )}

        {/* Video viewer */}
        {isVideo && !hasError && (
          <div className="relative max-w-full max-h-full">
            <video
              ref={videoRef}
              src={currentItem.url}
              className="max-w-full max-h-[calc(100vh-200px)] object-contain"
              onLoadedMetadata={handleVideoLoadedMetadata}
              onTimeUpdate={handleVideoTimeUpdate}
              onEnded={handleVideoEnded}
              onError={handleError}
              onClick={togglePlayPause}
              loop={loop}
            />

            {/* Video controls overlay */}
            <div
              className={cn(
                'absolute inset-0 flex items-center justify-center transition-opacity duration-300',
                (showControls || !isPlaying) ? 'opacity-100' : 'opacity-0'
              )}
            >
              {!isPlaying && !isLoading && (
                <button
                  onClick={togglePlayPause}
                  className="p-6 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                >
                  <Play className="w-12 h-12 text-white" />
                </button>
              )}
            </div>

            {/* Video controls bar */}
            <div
              className={cn(
                'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-6 transition-all duration-300',
                !showControls && isPlaying && 'opacity-0 pointer-events-none'
              )}
            >
              {/* Progress bar */}
              <div className="mb-4">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg"
                />
                <div className="flex justify-between text-white text-xs mt-2">
                  <span>{formatDuration(currentTime)}</span>
                  <span>{formatDuration(duration)}</span>
                </div>
              </div>

              {/* Control buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlayPause}
                  className="p-2.5 text-white hover:bg-white/20 rounded-lg transition-colors"
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </button>

                <button
                  onClick={skipBackward}
                  className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                  title="Skip Back 10s"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  onClick={skipForward}
                  className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                  title="Skip Forward 10s"
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleMute}
                    className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? (
                      <VolumeX className="w-5 h-5" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>

                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-24 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                  />
                </div>

                <div className="relative ml-auto">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className={cn(
                      'p-2 text-white hover:bg-white/20 rounded-lg transition-colors',
                      showSettings && 'bg-white/20'
                    )}
                    title="Settings"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                  {showSettings && (
                    <div className="absolute bottom-full right-0 mb-2 bg-black/90 backdrop-blur-sm rounded-lg p-2 min-w-[120px]">
                      <div className="text-white text-xs font-semibold mb-1 px-2">Playback Speed</div>
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                        <button
                          key={rate}
                          onClick={() => {
                            handlePlaybackRateChange(rate);
                            setShowSettings(false);
                          }}
                          className={cn(
                            'w-full text-left px-3 py-1.5 text-sm text-white hover:bg-white/20 rounded transition-colors',
                            playbackRate === rate && 'bg-white/20'
                          )}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={toggleFullscreen}
                  className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                  title={isVideoFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
                >
                  {isVideoFullscreen ? (
                    <Minimize className="w-5 h-5" />
                  ) : (
                    <Maximize className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {items.length > 1 && showThumbnails && (
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent transition-all duration-300',
            !showControls && isVideo && isPlaying && 'opacity-0 pointer-events-none'
          )}
          style={{ paddingBottom: isVideo ? '140px' : '20px' }}
        >
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div
              ref={thumbnailsRef}
              className="flex gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent pb-2"
            >
              {items.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => goToIndex(index)}
                  className={cn(
                    'flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden transition-all relative',
                    'hover:ring-2 hover:ring-white/50',
                    currentIndex === index
                      ? 'ring-2 ring-white scale-110 shadow-lg'
                      : 'ring-1 ring-white/20 opacity-60 hover:opacity-100'
                  )}
                >
                  {item.type === 'image' ? (
                    <img
                      src={item.thumbnail || item.url}
                      alt={item.title || `Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                      <Play className="w-6 h-6 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
