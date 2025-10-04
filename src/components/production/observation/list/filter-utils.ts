import type { ObservationGetManyFormData } from "../../../../schemas";
import type { Task } from "../../../../types";
import { formatDate } from "../../../../utils";

export interface ActiveFilter {
  key: string;
  label: string;
  value: string;
  type: "default" | "boolean" | "date" | "array";
}

export interface FilterEntities {
  tasks: Task[];
}

/**
 * Extract active filters from the current filter state
 */
export function extractActiveFilters(filters: Partial<ObservationGetManyFormData>, entities: FilterEntities): ActiveFilter[] {
  const activeFilters: ActiveFilter[] = [];

  // Task IDs filter
  if (filters.taskIds && filters.taskIds.length > 0) {
    const taskNames = filters.taskIds
      .map((id: string) => entities.tasks.find((task) => task.id === id)?.name)
      .filter(Boolean)
      .slice(0, 3); // Show max 3 task names

    const displayValue = taskNames.length < filters.taskIds.length ? `${taskNames.join(", ")}... (+${filters.taskIds.length - taskNames.length})` : taskNames.join(", ");

    activeFilters.push({
      key: "taskIds",
      label: "Tarefas",
      value: displayValue,
      type: "array",
    });
  }

  // Has files filter
  if (filters.hasFiles !== undefined) {
    activeFilters.push({
      key: "hasFiles",
      label: "Com arquivos",
      value: filters.hasFiles ? "Sim" : "Não",
      type: "boolean",
    });
  }

  // Created date range filter
  if (filters.createdAt?.gte || filters.createdAt?.lte) {
    let dateRange = "";
    if (filters.createdAt.gte && filters.createdAt.lte) {
      dateRange = `${formatDate(filters.createdAt.gte)} - ${formatDate(filters.createdAt.lte)}`;
    } else if (filters.createdAt.gte) {
      dateRange = `Após ${formatDate(filters.createdAt.gte)}`;
    } else if (filters.createdAt.lte) {
      dateRange = `Antes de ${formatDate(filters.createdAt.lte)}`;
    }

    activeFilters.push({
      key: "createdAt",
      label: "Data de criação",
      value: dateRange,
      type: "date",
    });
  }

  return activeFilters;
}

/**
 * Create filter remover functions for each active filter
 */
export function createFilterRemover(filters: Partial<ObservationGetManyFormData>, onFilterChange: (filters: Partial<ObservationGetManyFormData>) => void) {
  return {
    taskIds: () => {
      const { taskIds, ...rest } = filters;
      onFilterChange(rest);
    },
    hasFiles: () => {
      const { hasFiles, ...rest } = filters;
      onFilterChange(rest);
    },
    createdAt: () => {
      const { createdAt, ...rest } = filters;
      onFilterChange(rest);
    },
  };
}

/**
 * Get filter statistics for display
 */
export function getFilterStats(filters: Partial<ObservationGetManyFormData>) {
  let count = 0;

  if (filters.taskIds && filters.taskIds.length > 0) count++;
  if (filters.hasFiles !== undefined) count++;
  if (filters.createdAt?.gte || filters.createdAt?.lte) count++;

  return { count };
}

/**
 * Check if any filters are active
 */
export function hasActiveFilters(filters: Partial<ObservationGetManyFormData>): boolean {
  return getFilterStats(filters).count > 0;
}

/**
 * Clear all filters
 */
export function clearAllFilters(): Partial<ObservationGetManyFormData> {
  return { limit: 40 }; // Keep only the limit
}
