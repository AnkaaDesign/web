import type { AirbrushingGetManyFormData } from "../../../../schemas";
import type { Task } from "../../../../types";
import { formatDate, formatCurrency } from "../../../../utils";
import { AIRBRUSHING_STATUS_LABELS, AIRBRUSHING_STATUS } from "../../../../constants";

export interface ActiveFilter {
  key: string;
  label: string;
  value: string;
  type: "default" | "boolean" | "date" | "array" | "price";
}

export interface FilterEntities {
  tasks: Task[];
}

/**
 * Extract active filters from the current filter state
 */
export function extractActiveFilters(filters: Partial<AirbrushingGetManyFormData>, entities: FilterEntities): ActiveFilter[] {
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

  // Status filter
  if (filters.status && filters.status.length > 0) {
    const statusLabels = filters.status.map((status: AIRBRUSHING_STATUS) => AIRBRUSHING_STATUS_LABELS[status]);
    const displayValue = statusLabels.length > 2 ? `${statusLabels.slice(0, 2).join(", ")}... (+${statusLabels.length - 2})` : statusLabels.join(", ");

    activeFilters.push({
      key: "status",
      label: "Status",
      value: displayValue,
      type: "array",
    });
  }

  // Price range filter
  if (filters.priceRange) {
    let priceRange = "";
    if (filters.priceRange.min !== undefined && filters.priceRange.max !== undefined) {
      priceRange = `${formatCurrency(filters.priceRange.min)} - ${formatCurrency(filters.priceRange.max)}`;
    } else if (filters.priceRange.min !== undefined) {
      priceRange = `Acima de ${formatCurrency(filters.priceRange.min)}`;
    } else if (filters.priceRange.max !== undefined) {
      priceRange = `Abaixo de ${formatCurrency(filters.priceRange.max)}`;
    }

    if (priceRange) {
      activeFilters.push({
        key: "priceRange",
        label: "Faixa de preço",
        value: priceRange,
        type: "price",
      });
    }
  }

  // Has start date filter
  if (filters.hasStartDate !== undefined) {
    activeFilters.push({
      key: "hasStartDate",
      label: "Data de início",
      value: filters.hasStartDate ? "Com data" : "Sem data",
      type: "boolean",
    });
  }

  // Has finish date filter
  if (filters.hasFinishDate !== undefined) {
    activeFilters.push({
      key: "hasFinishDate",
      label: "Data de finalização",
      value: filters.hasFinishDate ? "Com data" : "Sem data",
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
 * Create filter remover function for removing specific filters
 */
export function createFilterRemover(
  filters: Partial<AirbrushingGetManyFormData>,
  onFilterChange: (filters: Partial<AirbrushingGetManyFormData>) => void
): (key: string, value?: any) => void {
  return (key: string) => {
    const { [key]: _, ...rest } = filters as Record<string, any>;
    onFilterChange(rest as Partial<AirbrushingGetManyFormData>);
  };
}

/**
 * Get filter statistics for display
 */
export function getFilterStats(filters: Partial<AirbrushingGetManyFormData>) {
  let count = 0;

  if (filters.taskIds && filters.taskIds.length > 0) count++;
  if (filters.status && filters.status.length > 0) count++;
  if (filters.priceRange) count++;
  if (filters.hasStartDate !== undefined) count++;
  if (filters.hasFinishDate !== undefined) count++;
  if (filters.createdAt?.gte || filters.createdAt?.lte) count++;

  return { count };
}

/**
 * Check if any filters are active
 */
export function hasActiveFilters(filters: Partial<AirbrushingGetManyFormData>): boolean {
  return getFilterStats(filters).count > 0;
}

/**
 * Clear all filters
 */
export function clearAllFilters(): Partial<AirbrushingGetManyFormData> {
  return { limit: 40 }; // Keep only the limit
}
