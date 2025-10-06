import { useState, useEffect, useRef } from "react";
import { IconClock } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface TtlCountdownProps {
  /** TTL in seconds */
  ttl: number;
  /** Optional className for styling */
  className?: string;
  /** Threshold in seconds when the countdown should turn red (default: 30) */
  warningThreshold?: number;
}

/**
 * A performant countdown component for Redis TTL display
 *
 * Features:
 * - Updates every second
 * - Only re-renders itself (not the entire table row)
 * - Turns red when < warningThreshold seconds
 * - Shows "Expirado" when TTL reaches 0
 * - Smart formatting: "9m 45s" or "59s"
 */
export function TtlCountdown({
  ttl: initialTtl,
  className,
  warningThreshold = 30
}: TtlCountdownProps) {
  // Calculate the expiry time once when component mounts
  const expiryTimeRef = useRef(Date.now() + initialTtl * 1000);
  const [secondsRemaining, setSecondsRemaining] = useState(initialTtl);

  useEffect(() => {
    // Reset expiry time if initialTtl changes
    expiryTimeRef.current = Date.now() + initialTtl * 1000;
    setSecondsRemaining(initialTtl);

    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiryTimeRef.current - now) / 1000));
      setSecondsRemaining(remaining);

      // Stop the interval when expired
      if (remaining <= 0) {
        clearInterval(intervalId);
      }
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const intervalId = setInterval(updateCountdown, 1000);

    return () => clearInterval(intervalId);
  }, [initialTtl]);

  // Format the time display
  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return "Expirado";

    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const isWarning = secondsRemaining > 0 && secondsRemaining < warningThreshold;
  const isExpired = secondsRemaining <= 0;

  return (
    <div
      className={cn(
        "flex items-center gap-1 text-sm transition-colors",
        isExpired && "text-red-600 dark:text-red-400 font-semibold",
        isWarning && "text-orange-600 dark:text-orange-400 font-semibold",
        !isWarning && !isExpired && "text-muted-foreground",
        className
      )}
      title={isExpired ? "Chave expirada" : `${secondsRemaining} segundos restantes`}
    >
      <IconClock
        className={cn(
          "h-3 w-3 flex-shrink-0",
          isExpired && "animate-pulse"
        )}
      />
      <span className="font-mono">{formatTime(secondsRemaining)}</span>
    </div>
  );
}
