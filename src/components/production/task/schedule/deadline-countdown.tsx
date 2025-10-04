import { useState, useEffect } from "react";

interface DeadlineCountdownProps {
  deadline: Date | string | null;
  isOverdue: boolean;
}

export function DeadlineCountdown({ deadline, isOverdue }: DeadlineCountdownProps) {
  const [timeDisplay, setTimeDisplay] = useState<string>("");

  useEffect(() => {
    if (!deadline) {
      setTimeDisplay("-");
      return;
    }

    const updateCountdown = () => {
      const now = new Date();
      const deadlineDate = new Date(deadline);

      // Calculate the difference in milliseconds
      const diffMs = Math.abs(deadlineDate.getTime() - now.getTime());

      // Convert to seconds, minutes, hours, and days
      const totalSeconds = Math.floor(diffMs / 1000);
      const days = Math.floor(totalSeconds / (24 * 60 * 60));
      const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
      const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
      const seconds = totalSeconds % 60;

      // Format as DD:HH:MM:SS
      const formattedTime = [days.toString().padStart(2, "0"), hours.toString().padStart(2, "0"), minutes.toString().padStart(2, "0"), seconds.toString().padStart(2, "0")].join(
        ":",
      );

      // Set display without prefix
      setTimeDisplay(formattedTime);
    };

    // Update immediately
    updateCountdown();

    // Update every second
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [deadline, isOverdue]);

  return (
    <span className={isOverdue ? "font-semibold text-red-600" : ""} title={isOverdue ? "Tempo excedido" : "Tempo restante"}>
      {timeDisplay}
    </span>
  );
}
