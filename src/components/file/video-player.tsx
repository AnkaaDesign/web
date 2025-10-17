import * as React from "react";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { IconX, IconDownload, IconPlayerPlay, IconPlayerPause, IconVolume, IconVolumeOff, IconMaximize, IconMinimize } from "@tabler/icons-react";
import type { File as AnkaaFile } from "../../types";
import { formatFileSize } from "../../utils/file";

export interface VideoPlayerProps {
  file: AnkaaFile;
  url: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  mode?: "modal" | "inline";
  className?: string;
  onDownload?: (file: AnkaaFile) => void;
}

/**
 * Video player component that supports both modal and inline modes
 * Handles video playback with custom controls and proper error handling
 */
export function VideoPlayer({ file, url, open = true, onOpenChange, mode = "modal", className, onDownload }: VideoPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isMuted, setIsMuted] = React.useState(false);
  const [volume, setVolume] = React.useState(1);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [showControls, setShowControls] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const controlsTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls after inactivity
  const handleMouseMove = React.useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  }, [isPlaying]);

  // Video event handlers
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoading(false);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error("Video playback error:", e);
    setError("Erro ao carregar o vídeo. Verifique se o formato é suportado.");
    setIsLoading(false);
  };

  const handleCanPlay = () => {
    setIsLoading(false);
  };

  // Control functions
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (!isFullscreen) {
        if (videoRef.current.requestFullscreen) {
          videoRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    }
  };

  // Format time for display
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Keyboard controls
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open || mode !== "modal") return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "Escape":
          if (onOpenChange) onOpenChange(false);
          break;
        case "ArrowLeft":
          e.preventDefault();
          handleSeek(Math.max(0, currentTime - 10));
          break;
        case "ArrowRight":
          e.preventDefault();
          handleSeek(Math.min(duration, currentTime + 10));
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    };

    if (mode === "modal") {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, mode, currentTime, duration, onOpenChange]);

  // Fullscreen change handler
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleDownloadClick = () => {
    if (onDownload) {
      onDownload(file);
    } else {
      // Default download behavior
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const VideoControls = () => (
    <div
      className={cn(
        "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 transition-opacity duration-300",
        showControls || !isPlaying ? "opacity-100" : "opacity-0",
      )}
    >
      {/* Progress Bar */}
      <div className="mb-3">
        <div className="relative">
          <div className="h-1 bg-white/30 rounded-full">
            <div className="h-1 bg-white rounded-full transition-all duration-150" style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} />
          </div>
          <input
            type="range"
            min="0"
            max={duration}
            value={currentTime}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="absolute inset-0 w-full h-1 opacity-0 cursor-pointer"
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <Button variant="ghost" size="icon" onClick={togglePlay} className="h-8 w-8 text-white hover:bg-white/20" disabled={!!error || isLoading}>
            {isPlaying ? <IconPlayerPause className="h-4 w-4" /> : <IconPlayerPlay className="h-4 w-4" />}
          </Button>

          {/* Volume */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleMute} className="h-6 w-6 text-white hover:bg-white/20">
              {isMuted || volume === 0 ? <IconVolumeOff className="h-3 w-3" /> : <IconVolume className="h-3 w-3" />}
            </Button>
            <input type="range" min="0" max="1" step="0.1" value={isMuted ? 0 : volume} onChange={(e) => handleVolumeChange(Number(e.target.value))} className="w-16 h-1" />
          </div>

          {/* Time */}
          <span className="text-white text-sm font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Download */}
          <Button variant="ghost" size="icon" onClick={handleDownloadClick} className="h-8 w-8 text-white hover:bg-white/20" title="Baixar vídeo">
            <IconDownload className="h-4 w-4" />
          </Button>

          {/* Fullscreen */}
          {mode === "modal" && (
            <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="h-8 w-8 text-white hover:bg-white/20">
              {isFullscreen ? <IconMinimize className="h-4 w-4" /> : <IconMaximize className="h-4 w-4" />}
            </Button>
          )}

          {/* Close (modal only) */}
          {mode === "modal" && onOpenChange && (
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-8 w-8 text-white hover:bg-white/20">
              <IconX className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  const VideoElement = () => (
    <div
      className="relative w-full h-full bg-black rounded-lg overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => !isPlaying || setShowControls(false)}
    >
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent" />
            <span className="text-white text-sm">Carregando vídeo...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center text-white max-w-md p-4">
            <div className="text-6xl mb-4">❌</div>
            <h3 className="text-lg font-medium mb-2">Erro no Player</h3>
            <p className="text-sm text-white/70 mb-4">{error}</p>
            <Button variant="outline" onClick={handleDownloadClick} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <IconDownload className="h-4 w-4 mr-2" />
              Baixar arquivo
            </Button>
          </div>
        </div>
      )}

      {/* Video element */}
      <video
        ref={videoRef}
        src={url}
        className="w-full h-full object-contain"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        onPause={handlePause}
        onError={handleError}
        onCanPlay={handleCanPlay}
        onClick={togglePlay}
        preload="metadata"
      />

      {/* Controls overlay */}
      <VideoControls />

      {/* File info overlay (top) */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 transition-opacity duration-300",
          showControls || !isPlaying ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white font-medium text-sm truncate max-w-xs">{file.filename}</span>
            <span className="text-white/70 text-xs">{formatFileSize(file.size)}</span>
          </div>
        </div>
      </div>
    </div>
  );

  if (mode === "inline") {
    return (
      <Card className={cn("w-full", className)}>
        <CardContent className="p-0">
          <div className="aspect-video">
            <VideoElement />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Modal mode
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay className="bg-black/90 backdrop-blur-sm" />
      <DialogContent className="max-w-[90vw] max-h-[90vh] w-full h-full p-0 border-0 bg-transparent shadow-none" aria-describedby="video-player-description">
        <div className="w-full h-full max-w-4xl max-h-[80vh] mx-auto my-auto">
          <VideoElement />
        </div>

        <div id="video-player-description" className="sr-only">
          Player de vídeo. Use espaço para pausar/reproduzir, setas esquerda/direita para navegar, M para silenciar, F para tela cheia, ESC para fechar.
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default VideoPlayer;
