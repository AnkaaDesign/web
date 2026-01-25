import type { Task } from "../../../../types";

/**
 * Calculate similarity between two strings using a simple algorithm
 * Returns a value between 0 (completely different) and 1 (identical)
 */
function stringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (!str1 || !str2) return 0;

  // Normalize strings: lowercase and trim
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;

  // Use Levenshtein distance for fuzzy matching
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1;

  const distance = levenshteinDistance(s1, s2);
  return (longer.length - distance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Parse serial number to extract numeric part
 * Handles formats like: "37057", "RHF3D61", "EQX9C19", etc.
 */
function parseSerialNumber(serialNumber: string | null | undefined): number | null {
  if (!serialNumber) return null;

  // Try to extract trailing digits
  const match = serialNumber.match(/(\d+)$/);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Try to extract any digits
  const allDigits = serialNumber.match(/\d+/);
  if (allDigits) {
    return parseInt(allDigits[0], 10);
  }

  return null;
}

/**
 * Get the IDENTIFICADOR value for a task (serial number or truck plate)
 */
function getIdentificador(task: Task): string {
  return task.serialNumber || task.truck?.plate || "";
}

/**
 * Check if two tasks should be grouped together
 */
function shouldGroupTasks(
  task1: Task,
  task2: Task,
  similarityThreshold: number = 0.8
): boolean {
  // Check name similarity
  const nameSimilarity = stringSimilarity(task1.name, task2.name);
  if (nameSimilarity < similarityThreshold) return false;

  // Check if serial numbers are sequential
  const id1 = getIdentificador(task1);
  const id2 = getIdentificador(task2);

  const num1 = parseSerialNumber(id1);
  const num2 = parseSerialNumber(id2);

  if (num1 === null || num2 === null) return false;

  // Check if numbers are sequential (difference of 1)
  return Math.abs(num1 - num2) === 1;
}

export interface TaskGroup {
  type: 'single' | 'group-first' | 'group-collapsed' | 'group-last';
  task?: Task;
  groupId?: string;
  collapsedTasks?: Task[];
  totalCount?: number;
}

/**
 * Group sequential tasks with similar names
 * Returns an array of TaskGroup objects that can be rendered
 */
export function groupSequentialTasks(
  tasks: Task[],
  minGroupSize: number = 3,
  similarityThreshold: number = 0.8
): TaskGroup[] {
  if (tasks.length === 0) return [];

  const result: TaskGroup[] = [];
  let i = 0;

  while (i < tasks.length) {
    const currentTask = tasks[i];
    const groupTasks: Task[] = [currentTask];

    // Look ahead to find sequential tasks
    let j = i + 1;
    while (j < tasks.length) {
      const nextTask = tasks[j];
      const lastTaskInGroup = groupTasks[groupTasks.length - 1];

      if (shouldGroupTasks(lastTaskInGroup, nextTask, similarityThreshold)) {
        groupTasks.push(nextTask);
        j++;
      } else {
        break;
      }
    }

    // If we found a group of minGroupSize or more, create a collapsible group
    if (groupTasks.length >= minGroupSize) {
      const firstTask = groupTasks[0];
      const lastTask = groupTasks[groupTasks.length - 1];
      const middleTasks = groupTasks.slice(1, -1);
      const groupId = `group-${firstTask.id}`;

      // First task
      result.push({
        type: 'group-first',
        task: firstTask,
        groupId,
        totalCount: groupTasks.length,
      });

      // Collapsed row representing middle tasks
      result.push({
        type: 'group-collapsed',
        groupId,
        collapsedTasks: middleTasks,
        totalCount: groupTasks.length,
      });

      // Last task
      result.push({
        type: 'group-last',
        task: lastTask,
        groupId,
        totalCount: groupTasks.length,
      });

      i = j; // Skip past the grouped tasks
    } else {
      // Not enough tasks to form a group, add them individually
      for (const task of groupTasks) {
        result.push({
          type: 'single',
          task,
        });
      }
      i = j;
    }
  }

  return result;
}
