import { TASK_OBSERVATION_TYPE, TASK_STATUS } from "../constants";
import { TASK_OBSERVATION_TYPE_LABELS, TASK_STATUS_LABELS } from "../constants";
import type { Task } from "../types";
import { dateUtils } from "./date";
import { numberUtils } from "./number";

/**
 * Check if task status transition is valid
 */
export function isValidTaskStatusTransition(fromStatus: TASK_STATUS, toStatus: TASK_STATUS): boolean {
  const validTransitions: Record<TASK_STATUS, TASK_STATUS[]> = {
    [TASK_STATUS.PREPARATION]: [TASK_STATUS.WAITING_PRODUCTION, TASK_STATUS.CANCELLED],
    [TASK_STATUS.WAITING_PRODUCTION]: [TASK_STATUS.IN_PRODUCTION, TASK_STATUS.PREPARATION, TASK_STATUS.CANCELLED],
    [TASK_STATUS.IN_PRODUCTION]: [TASK_STATUS.COMPLETED, TASK_STATUS.WAITING_PRODUCTION, TASK_STATUS.CANCELLED],
    [TASK_STATUS.COMPLETED]: [], // Final state
    [TASK_STATUS.CANCELLED]: [], // Final state
  };

  return validTransitions[fromStatus]?.includes(toStatus) || false;
}

/**
 * Get task status label
 */
export function getTaskStatusLabel(status: TASK_STATUS): string {
  return TASK_STATUS_LABELS[status] || status;
}

/**
 * Get task status color
 */
export function getTaskStatusColor(status: TASK_STATUS): string {
  const colors: Record<TASK_STATUS, string> = {
    [TASK_STATUS.PREPARATION]: "orange",            // Orange - in preparation
    [TASK_STATUS.WAITING_PRODUCTION]: "gray",       // Gray - waiting for production
    [TASK_STATUS.IN_PRODUCTION]: "blue",            // Blue - in progress
    [TASK_STATUS.COMPLETED]: "green",               // Green - finished
    [TASK_STATUS.CANCELLED]: "red",                 // Red - cancelled
  };
  return colors[status] || "default";
}

/**
 * Get task status variant for badges
 */
export function getTaskStatusVariant(status: TASK_STATUS): "default" | "secondary" | "destructive" | "outline" {
  const variants: Record<TASK_STATUS, "default" | "secondary" | "destructive" | "outline"> = {
    [TASK_STATUS.PREPARATION]: "outline",
    [TASK_STATUS.WAITING_PRODUCTION]: "outline",
    [TASK_STATUS.IN_PRODUCTION]: "default",
    [TASK_STATUS.COMPLETED]: "secondary",
    [TASK_STATUS.CANCELLED]: "destructive",
  };
  return variants[status] || "default";
}

/**
 * Get task priority based on status
 */
export function getTaskPriority(status: TASK_STATUS): number {
  const priorities: Record<TASK_STATUS, number> = {
    [TASK_STATUS.IN_PRODUCTION]: 1,
    [TASK_STATUS.WAITING_PRODUCTION]: 2,
    [TASK_STATUS.PREPARATION]: 3,
    [TASK_STATUS.COMPLETED]: 4,
    [TASK_STATUS.CANCELLED]: 5,
  };
  return priorities[status] || 999;
}

/**
 * Get task progress percentage
 */
export function getTaskProgress(status: TASK_STATUS): number {
  const statusProgress: Record<TASK_STATUS, number> = {
    [TASK_STATUS.PREPARATION]: 0,
    [TASK_STATUS.WAITING_PRODUCTION]: 25,
    [TASK_STATUS.IN_PRODUCTION]: 50,
    [TASK_STATUS.COMPLETED]: 100,
    [TASK_STATUS.CANCELLED]: 0,
  };
  return statusProgress[status] || 0;
}

/**
 * Check if task is active
 */
export function isTaskActive(task: Task): boolean {
  return task.status === TASK_STATUS.IN_PRODUCTION || task.status === TASK_STATUS.WAITING_PRODUCTION;
}

/**
 * Check if task is completed
 */
export function isTaskCompleted(task: Task): boolean {
  return task.status === TASK_STATUS.COMPLETED;
}

/**
 * Check if task is cancelled
 */
export function isTaskCancelled(task: Task): boolean {
  return task.status === TASK_STATUS.CANCELLED;
}

/**
 * Check if task is on hold
 */
export function isTaskInPreparation(task: Task): boolean {
  return task.status === TASK_STATUS.PREPARATION;
}

/**
 * Check if task is overdue
 */
export function isTaskOverdue(task: Task): boolean {
  if (isTaskCompleted(task) || isTaskCancelled(task)) return false;
  if (!task.term) return false;

  return new Date() > new Date(task.term);
}

/**
 * Get task age in days
 */
export function getTaskAge(task: Task): number {
  const startDate = task.entryDate || task.createdAt;
  return dateUtils.getDaysAgo(startDate);
}

/**
 * Get task duration
 */
export function getTaskDuration(task: Task): number | null {
  if (!task.finishedAt) return null;
  const startDate = task.startedAt || task.entryDate || task.createdAt;
  return dateUtils.getDaysBetween(startDate, task.finishedAt);
}

/**
 * Get days until deadline (term)
 */
export function getDaysUntilDeadline(task: Task): number | null {
  if (!task.term) return null;
  if (isTaskCompleted(task) || isTaskCancelled(task)) return null;

  return dateUtils.getDaysBetween(new Date(), task.term);
}

/**
 * Format task identifier
 */
export function formatTaskIdentifier(task: Task): string {
  if (task.serialNumber) return task.serialNumber;
  if (task.truck?.plate) return task.truck.plate;
  return `#${task.id.slice(-6).toUpperCase()}`;
}

/**
 * Format task summary
 */
export function formatTaskSummary(task: Task): string {
  const identifier = formatTaskIdentifier(task);
  const customerName = task.customer?.fantasyName || "Cliente desconhecido";
  const status = getTaskStatusLabel(task.status);
  return `${identifier} - ${customerName} - ${status}`;
}

/**
 * Calculate task price from budget total
 */
export function calculateTaskPrice(task: Task): number {
  if (!task.budget) return 0;
  return task.budget.total || 0;
}

/**
 * Format task price from budget total
 */
export function formatTaskPrice(task: Task): string {
  if (!task.budget || !task.budget.total) return "Sem valor";
  const totalValue = calculateTaskPrice(task);
  return numberUtils.formatCurrency(totalValue);
}

/**
 * Group tasks by status
 */
export function groupTasksByStatus(tasks: Task[]): Record<TASK_STATUS, Task[]> {
  const groups = {} as Record<TASK_STATUS, Task[]>;

  // Initialize all statuses
  Object.values(TASK_STATUS).forEach((status) => {
    groups[status as TASK_STATUS] = [];
  });

  // Group tasks
  tasks.forEach((task) => {
    groups[task.status].push(task);
  });

  return groups;
}

/**
 * Group tasks by sector
 */
export function groupTasksBySector(tasks: Task[]): Record<string, Task[]> {
  return tasks.reduce(
    (groups, task) => {
      const sectorName = task.sector?.name || "Sem setor";
      if (!groups[sectorName]) {
        groups[sectorName] = [];
      }
      groups[sectorName].push(task);
      return groups;
    },
    {} as Record<string, Task[]>,
  );
}

/**
 * Group tasks by customer
 */
export function groupTasksByCustomer(tasks: Task[]): Record<string, Task[]> {
  return tasks.reduce(
    (groups, task) => {
      const customerName = task.customer?.fantasyName || "Sem cliente";
      if (!groups[customerName]) {
        groups[customerName] = [];
      }
      groups[customerName].push(task);
      return groups;
    },
    {} as Record<string, Task[]>,
  );
}

/**
 * Sort tasks by priority
 */
export function sortTasksByPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const priorityA = getTaskPriority(a.status);
    const priorityB = getTaskPriority(b.status);
    return priorityA - priorityB;
  });
}

/**
 * Sort tasks by deadline
 */
export function sortTasksByDeadline(tasks: Task[], order: "asc" | "desc" = "asc"): Task[] {
  return [...tasks].sort((a, b) => {
    if (!a.term && !b.term) return 0;
    if (!a.term) return 1;
    if (!b.term) return -1;

    const dateA = new Date(a.term).getTime();
    const dateB = new Date(b.term).getTime();
    return order === "asc" ? dateA - dateB : dateB - dateA;
  });
}

/**
 * Filter overdue tasks
 */
export function filterOverdueTasks(tasks: Task[]): Task[] {
  return tasks.filter(isTaskOverdue);
}

/**
 * Filter tasks by date range
 */
export function filterTasksByDateRange(tasks: Task[], startDate: Date, endDate: Date): Task[] {
  return tasks.filter((task) => {
    const taskDate = task.entryDate || task.createdAt;
    return new Date(taskDate) >= startDate && new Date(taskDate) <= endDate;
  });
}

/**
 * Calculate task statistics
 */
export function calculateTaskStats(tasks: Task[]) {
  const total = tasks.length;
  const byStatus = groupTasksByStatus(tasks);

  const statusCounts = Object.entries(byStatus).reduce(
    (acc, [status, taskList]) => {
      acc[status as TASK_STATUS] = taskList.length;
      return acc;
    },
    {} as Record<TASK_STATUS, number>,
  );

  const active = tasks.filter(isTaskActive).length;
  const completed = tasks.filter(isTaskCompleted).length;
  const cancelled = tasks.filter(isTaskCancelled).length;
  const preparation = tasks.filter(isTaskInPreparation).length;
  const overdue = tasks.filter(isTaskOverdue).length;

  const completionRate = total > 0 ? (completed / total) * 100 : 0;

  return {
    total,
    statusCounts,
    active,
    completed,
    cancelled,
    preparation,
    overdue,
    completionRate: Math.round(completionRate),
  };
}

export function getTaskObservationTypeLabel(type: TASK_OBSERVATION_TYPE): string {
  return TASK_OBSERVATION_TYPE_LABELS[type] || type;
}

/**
 * Validation result for service order checks
 */
export interface ServiceOrderValidationResult {
  isValid: boolean;
  errorMessage?: string;
  incompleteOrders?: Array<{ id: string; name: string; status: string }>;
}

/**
 * Validate that all service orders for a task are finished
 * Used before allowing a LEADER to mark a task as COMPLETED
 *
 * @param task - The task to validate
 * @returns Validation result with error details if any service orders are incomplete
 */
export function validateAllServiceOrdersCompleted(task: Task): ServiceOrderValidationResult {
  // Check if task has service orders
  if (!task.serviceOrders || task.serviceOrders.length === 0) {
    // No service orders to validate - task can be finished
    return { isValid: true };
  }

  // Find incomplete service orders
  const incompleteOrders = task.serviceOrders.filter((order: any) => {
    // Service order statuses: PENDING, IN_PROGRESS, COMPLETED, CANCELLED
    // Only COMPLETED orders are considered finished
    return order.status !== 'COMPLETED';
  });

  if (incompleteOrders.length > 0) {
    const orderNames = incompleteOrders
      .map((order: any) => order.name || `OS #${order.id}`)
      .join(', ');

    return {
      isValid: false,
      errorMessage: `Não é possível finalizar a tarefa. As seguintes ordens de serviço ainda não foram concluídas: ${orderNames}`,
      incompleteOrders: incompleteOrders.map((order: any) => ({
        id: order.id,
        name: order.name || `OS #${order.id}`,
        status: order.status,
      })),
    };
  }

  // All service orders are completed
  return { isValid: true };
}
