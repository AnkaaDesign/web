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
    return "bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700";
  }

  // Tasks with no deadline - lighter in light mode, darker in dark mode
  if (!task.term) {
    return "bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700";
  }

  // Red for overdue
  if (isDateInPast(task.term)) {
    return "bg-red-200 hover:bg-red-300 dark:bg-red-800 dark:hover:bg-red-700";
  }

  // Calculate hours remaining
  const hoursRemaining = getHoursBetween(new Date(), task.term);

  // Green for more than 4 hours remaining
  if (hoursRemaining > 4) {
    return "bg-green-200 hover:bg-green-300 dark:bg-green-800 dark:hover:bg-green-700";
  } else {
    // Orange for 0-4 hours remaining
    return "bg-amber-200 hover:bg-amber-300 dark:bg-amber-700 dark:hover:bg-amber-600";
  }
}
