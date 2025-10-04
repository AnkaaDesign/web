import { useState, useEffect, useCallback } from "react";

export interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isOverdue: boolean;
  formatted: string;
}

/**
 * Hook that provides a countdown timer to a specific deadline
 * Updates every second for real-time countdown
 */
export function useCountdown(deadline: Date | string | null): CountdownResult {
  const calculateTimeRemaining = useCallback((): CountdownResult => {
    if (!deadline) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        totalSeconds: 0,
        isOverdue: false,
        formatted: "00:00:00:00",
      };
    }

    const now = new Date();
    const target = typeof deadline === "string" ? new Date(deadline) : deadline;
    const diff = target.getTime() - now.getTime();

    const isOverdue = diff < 0;
    const absDiff = Math.abs(diff);

    const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);

    // Format as DD:HH:MM:SS
    const formatted = `${String(days).padStart(2, "0")}:${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    return {
      days,
      hours,
      minutes,
      seconds,
      totalSeconds: Math.floor(absDiff / 1000),
      isOverdue,
      formatted, // No negative sign for overdue
    };
  }, [deadline]);

  const [timeRemaining, setTimeRemaining] = useState<CountdownResult>(calculateTimeRemaining);

  useEffect(() => {
    // Update immediately
    setTimeRemaining(calculateTimeRemaining());

    // Update every second
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining());
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateTimeRemaining]);

  return timeRemaining;
}

/**
 * Get a human-readable string for the countdown
 */
export function getCountdownDisplay(countdown: CountdownResult): string {
  if (countdown.isOverdue) {
    if (countdown.days > 0) {
      return `${countdown.days}d ${countdown.hours}h atrasado`;
    } else if (countdown.hours > 0) {
      return `${countdown.hours}h ${countdown.minutes}m atrasado`;
    } else if (countdown.minutes > 0) {
      return `${countdown.minutes}m atrasado`;
    } else {
      return `${countdown.seconds}s atrasado`;
    }
  }

  if (countdown.days > 0) {
    return `${countdown.days}d ${countdown.hours}h`;
  } else if (countdown.hours > 0) {
    return `${countdown.hours}h ${countdown.minutes}m`;
  } else if (countdown.minutes > 0) {
    return `${countdown.minutes}m ${countdown.seconds}s`;
  } else {
    return `${countdown.seconds}s`;
  }
}
