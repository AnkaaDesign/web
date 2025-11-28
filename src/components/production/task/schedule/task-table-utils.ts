import { TASK_STATUS } from "../../../../constants";
import { isDateInPast, getHoursBetween } from "../../../../utils";
import type { Task } from "../../../../types";

interface TaskWithDeadlineInfo extends Task {
  isOverdue?: boolean;
  hoursRemaining?: number | null;
}

/**
 * Get the appropriate color class for a task row based on its status and deadline
 * Following the obsolete app's proven color scheme with support for dark mode:
 * - Neutral gray: Non-production tasks or tasks without deadline
 * - Green: IN_PRODUCTION with more than 4 hours remaining
 * - Orange: IN_PRODUCTION with 0-4 hours remaining
 * - Red: Overdue tasks (past deadline)
 */
export function getRowColorClass(task: TaskWithDeadlineInfo): string {
  // Non-production tasks (PENDING, COMPLETED, CANCELLED, ON_HOLD) - lighter in light mode, darker in dark mode
  if (task.status !== TASK_STATUS.IN_PRODUCTION) {
    return "bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700";
  }

  // Tasks with no deadline - lighter in light mode, darker in dark mode
  if (!task.term) {
    return "bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-800 dark:hover:bg-neutral-700";
  }

  // Check if task is overdue
  const isOverdue = task.isOverdue ?? isDateInPast(task.term);
  if (isOverdue) {
    return "bg-red-200 hover:bg-red-300 dark:bg-red-800 dark:hover:bg-red-700";
  }

  // Calculate hours remaining for active production tasks
  const hoursRemaining = task.hoursRemaining ?? getHoursBetween(new Date(), task.term);

  if (hoursRemaining > 4) {
    return "bg-green-200 hover:bg-green-300 dark:bg-green-800 dark:hover:bg-green-700";
  } else {
    return "bg-amber-200 hover:bg-amber-300 dark:bg-amber-700 dark:hover:bg-amber-600";
  }
}
