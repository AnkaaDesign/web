import { useEffect, useState, useRef, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';

export interface BackupProgressData {
  backupId: string;
  progress: number;
  filesProcessed?: number;
  totalFiles?: number;
  timestamp?: number;
  rate?: number;
  status?: string;
  completed?: boolean;
  processedBytes?: number;
  estimatedSize?: number;
}

interface UseBackupProgressOptions {
  onComplete?: (data: BackupProgressData) => void;
  onError?: (error: Error) => void;
  interpolate?: boolean;
  token?: string; // Authentication token for WebSocket connection
}

/**
 * Hook for real-time backup progress tracking via WebSocket
 * Provides smooth progress interpolation between updates
 */
export function useBackupProgress(
  backupId: string | null,
  options: UseBackupProgressOptions = {}
) {
  const { onComplete, onError, interpolate = true, token } = options;

  const [progress, setProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [progressData, setProgressData] = useState<BackupProgressData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const animationRef = useRef<number>();
  const lastUpdateTime = useRef<number>(Date.now());
  const lastProgress = useRef<number>(0);

  // Smooth animation function
  const animateProgress = useCallback((targetProgress: number, duration: number = 500) => {
    if (!interpolate) {
      setDisplayProgress(targetProgress);
      return;
    }

    const start = displayProgress;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const percent = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeInOutQuad = (t: number) =>
        t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      const easedPercent = easeInOutQuad(percent);
      const currentProgress = start + (targetProgress - start) * easedPercent;

      setDisplayProgress(currentProgress);

      if (percent < 1 && currentProgress < targetProgress) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    animate();
  }, [displayProgress, interpolate]);

  // Calculate estimated progress based on rate
  const estimateProgress = useCallback(() => {
    if (!progressData?.rate || progressData.completed) return;

    const now = Date.now();
    const timeSinceUpdate = now - lastUpdateTime.current;

    // Estimate based on rate (files per second)
    if (progressData.totalFiles && progressData.filesProcessed) {
      const estimatedFilesProcessed =
        progressData.filesProcessed + (progressData.rate * (timeSinceUpdate / 1000));
      const estimatedProgress = Math.min(
        95, // Cap at 95% until we get confirmation
        (estimatedFilesProcessed / progressData.totalFiles) * 100
      );

      if (estimatedProgress > displayProgress) {
        setDisplayProgress(estimatedProgress);
      }
    }
  }, [progressData, displayProgress]);

  // Connect to WebSocket
  useEffect(() => {
    if (!backupId) return;

    const socketUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const socket = io(`${socketUrl}/backup-progress`, {
      auth: token ? { token } : undefined,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Connected to backup progress WebSocket');
      }
      setIsConnected(true);
      setError(null);

      // Subscribe to backup progress
      socket.emit('subscribe', { backupId });
    });

    socket.on('disconnect', () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Disconnected from backup progress WebSocket');
      }
      setIsConnected(false);
    });

    socket.on('progress', (data: BackupProgressData) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Progress update:', data);
      }

      // Update state
      setProgressData(data);
      setProgress(data.progress);

      // Update timing
      lastUpdateTime.current = data.timestamp || Date.now();
      lastProgress.current = data.progress;

      // Animate to new progress
      animateProgress(data.progress);

      // Handle completion
      if (data.completed || data.progress === 100) {
        setDisplayProgress(100);
        onComplete?.(data);
      }
    });

    socket.on('error', (err: any) => {
      if (process.env.NODE_ENV !== 'production') {
        console.error('WebSocket error:', err);
      }
      const error = new Error(err.message || 'WebSocket connection error');
      setError(error);
      onError?.(error);
    });

    // Set up interpolation interval if enabled
    let intervalId: NodeJS.Timeout;
    if (interpolate) {
      intervalId = setInterval(estimateProgress, 100);
    }

    // Cleanup
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      if (socket.connected) {
        socket.emit('unsubscribe', { backupId });
        socket.disconnect();
      }

      socketRef.current = null;
    };
  }, [backupId, animateProgress, estimateProgress, interpolate, onComplete, onError, token]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    if (socketRef.current && !socketRef.current.connected) {
      socketRef.current.connect();
    }
  }, []);

  // Get estimated time remaining
  const getEstimatedTimeRemaining = useCallback(() => {
    if (!progressData?.rate || !progressData.totalFiles || !progressData.filesProcessed) {
      return null;
    }

    const remainingFiles = progressData.totalFiles - progressData.filesProcessed;
    const secondsRemaining = remainingFiles / progressData.rate;

    return {
      seconds: Math.round(secondsRemaining),
      formatted: formatTime(secondsRemaining),
    };
  }, [progressData]);

  return {
    // Progress values
    progress,
    displayProgress,

    // Detailed data
    progressData,
    filesProcessed: progressData?.filesProcessed || 0,
    totalFiles: progressData?.totalFiles || 0,
    rate: progressData?.rate || 0,

    // Status
    isConnected,
    isCompleted: progressData?.completed || progress === 100,
    error,

    // Functions
    reconnect,
    getEstimatedTimeRemaining,

    // Formatted values
    formattedRate: progressData?.rate
      ? `${Math.round(progressData.rate)} files/sec`
      : null,
    percentage: `${Math.round(displayProgress)}%`,
  };
}

// Helper function to format time
function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (minutes < 60) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes}m`;
}

export default useBackupProgress;