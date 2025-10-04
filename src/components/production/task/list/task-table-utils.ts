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
  // Non-production tasks (PENDING, COMPLETED, CANCELLED, ON_HOLD) use neutral gray
  if (task.status !== TASK_STATUS.IN_PRODUCTION) {
    return "bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700";
  }

  // Tasks with no deadline use neutral gray
  if (!task.term) {
    return "bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700";
  }

  // Red for overdue
  if (isDateInPast(task.term)) {
    return "bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/40";
  }

  // Calculate hours remaining
  const hoursRemaining = getHoursBetween(new Date(), task.term);

  // Green for more than 4 hours remaining
  if (hoursRemaining > 4) {
    return "bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/40";
  } else {
    // Orange for 0-4 hours remaining
    return "bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/30 dark:hover:bg-orange-900/40";
  }
}
