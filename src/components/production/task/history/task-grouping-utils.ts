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
 * Groups by name similarity - serial number distance is no longer a requirement
 */
function shouldGroupTasks(
  task1: Task,
  task2: Task,
  similarityThreshold: number = 0.95
): boolean {
  // Check name similarity - if names are similar enough, group regardless of serial number
  const nameSimilarity = stringSimilarity(task1.name, task2.name);
  return nameSimilarity >= similarityThreshold;
}

export interface TaskGroup {
  type: 'single' | 'group-first' | 'group-collapsed' | 'group-last';
  task?: Task;
  groupId?: string;
  collapsedTasks?: Task[];
  totalCount?: number;
}

/**
 * Find all tasks that should be grouped with a given task based on name similarity
 */
function findSimilarTasks(
  targetTask: Task,
  tasks: Task[],
  usedIndices: Set<number>,
  similarityThreshold: number
): { task: Task; index: number }[] {
  const similar: { task: Task; index: number }[] = [];

  for (let i = 0; i < tasks.length; i++) {
    if (usedIndices.has(i)) continue;

    const task = tasks[i];
    if (shouldGroupTasks(targetTask, task, similarityThreshold)) {
      similar.push({ task, index: i });
    }
  }

  return similar;
}

/**
 * Sort tasks by serial number (numeric extraction)
 */
function sortBySerialNumber(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const numA = parseSerialNumber(getIdentificador(a));
    const numB = parseSerialNumber(getIdentificador(b));

    if (numA === null && numB === null) return 0;
    if (numA === null) return 1;
    if (numB === null) return -1;

    return numA - numB;
  });
}

/**
 * Group tasks with similar names regardless of serial number distance
 * Returns an array of TaskGroup objects that can be rendered
 */
export function groupSequentialTasks(
  tasks: Task[],
  minGroupSize: number = 3,
  similarityThreshold: number = 0.95
): TaskGroup[] {
  if (tasks.length === 0) return [];

  const result: TaskGroup[] = [];
  const usedIndices = new Set<number>();

  // Process tasks in original order, but find ALL similar tasks for each
  for (let i = 0; i < tasks.length; i++) {
    if (usedIndices.has(i)) continue;

    const currentTask = tasks[i];

    // Find all tasks similar to this one (including itself)
    const similarTasks = findSimilarTasks(currentTask, tasks, usedIndices, similarityThreshold);

    // Mark all found tasks as used
    similarTasks.forEach(({ index }) => usedIndices.add(index));

    // Sort the group by serial number
    const groupTasks = sortBySerialNumber(similarTasks.map(s => s.task));

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
    } else {
      // Not enough tasks to form a group, add them individually
      for (const task of groupTasks) {
        result.push({
          type: 'single',
          task,
        });
      }
    }
  }

  return result;
}
