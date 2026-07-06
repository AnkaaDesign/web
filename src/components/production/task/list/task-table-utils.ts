import type { Task } from "../../../../types";
import { TASK_STATUS } from "../../../../constants";
import { getHoursBetween, isDateInPast } from "../../../../utils";

/**
 * Get the color class for a task row based on status and deadline
 * Following the obsolete app's proven color scheme with support for dark mode
 * @param task The task to get color for
 * @returns CSS class name for the row color
 */
export function getRowColorClass(task: Task): string {
  // Non-production tasks (PENDING, COMPLETED, CANCELLED, ON_HOLD) - lighter in light mode, darker in dark mode
  if (task.status !== TASK_STATUS.IN_PRODUCTION) {
    return "bg-muted/30 hover:bg-muted/50";
  }

  // Tasks with no deadline - lighter in light mode, darker in dark mode
  if (!task.term) {
    return "bg-muted/30 hover:bg-muted/50";
  }

  // Red for overdue
  if (isDateInPast(task.term)) {
    return "bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700";
  }

  // Calculate hours remaining
  const hoursRemaining = getHoursBetween(new Date(), task.term);

  // Green for more than 4 hours remaining
  if (hoursRemaining > 4) {
    return "bg-green-100 hover:bg-green-200 dark:bg-green-800 dark:hover:bg-green-700";
  } else {
    // Dark gold instead of amber-700 (which is orange-based → reads brown in dark mode)
    return "bg-amber-100 hover:bg-amber-200 dark:bg-[#8a6d12] dark:hover:bg-[#a5831a]";
  }
}
