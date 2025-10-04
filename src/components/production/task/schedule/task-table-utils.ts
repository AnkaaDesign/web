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
  // Non-production tasks (PENDING, COMPLETED, CANCELLED, ON_HOLD) use neutral gray
  if (task.status !== TASK_STATUS.IN_PRODUCTION) {
    return "bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700";
  }

  // Tasks with no deadline use neutral gray
  if (!task.term) {
    return "bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700";
  }

  // Check if task is overdue
  const isOverdue = task.isOverdue ?? isDateInPast(task.term);
  if (isOverdue) {
    return "bg-red-200 hover:bg-red-300 dark:bg-red-900/50 dark:hover:bg-red-900/60";
  }

  // Calculate hours remaining for active production tasks
  const hoursRemaining = task.hoursRemaining ?? getHoursBetween(new Date(), task.term);

  if (hoursRemaining > 4) {
    return "bg-green-200 hover:bg-green-300 dark:bg-green-900/50 dark:hover:bg-green-900/60";
  } else {
    return "bg-orange-200 hover:bg-orange-300 dark:bg-orange-900/50 dark:hover:bg-orange-900/60";
  }
}
