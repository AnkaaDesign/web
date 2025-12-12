import { formatDate, formatRelativeTime } from "../../utils";
import { TruncatedTextWithTooltip } from "./truncated-text-with-tooltip";

interface DateDisplayProps {
  date: Date | null | undefined;
  /** Number of hours before showing actual date instead of relative time. Default is 24. */
  hoursThreshold?: number;
  /** Whether to show time along with date when showing actual date */
  showTime?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show tooltip with full date/time when hovering */
  showTooltip?: boolean;
}

/**
 * Displays a date in a user-friendly format:
 * - Shows relative time (e.g., "há 3 horas") if less than threshold hours
 * - Shows actual date if more than threshold hours
 * - Never shows both formats together
 */
export function DateDisplay({ date, hoursThreshold = 24, showTime = false, className, showTooltip = true }: DateDisplayProps) {
  if (!date) {
    return <span className={className}>-</span>;
  }

  const dateObj = date;

  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    return <span className={className}>Data inválida</span>;
  }

  // Calculate the difference in milliseconds
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffHours = Math.abs(diffMs) / (1000 * 60 * 60);

  // Determine what to display
  const displayText =
    diffHours < hoursThreshold
      ? formatRelativeTime(dateObj)
      : showTime
        ? `${formatDate(dateObj)} às ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(dateObj)}`
        : formatDate(dateObj);

  // If showing tooltip, always show the full date/time
  if (showTooltip) {
    const tooltipText = `${formatDate(dateObj)} às ${new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(dateObj)}`;

    return <TruncatedTextWithTooltip text={displayText} tooltipText={tooltipText} className={className} />;
  }

  return <span className={className}>{displayText}</span>;
}
