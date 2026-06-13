import type { TerminationGetManyFormData } from "../../../../schemas/termination";
import {
  TERMINATION_TYPE,
  TERMINATION_TYPE_LABELS,
  TERMINATION_STATUS,
  TERMINATION_STATUS_LABELS,
} from "../../../../constants";
import { formatDate } from "../../../../utils";

export interface TerminationFilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
  itemId?: string;
  iconType?: string;
}

/** Reads the terminationDate range stored under where.terminationDate. */
export function getTerminationDateRange(filters: Partial<TerminationGetManyFormData>): { gte?: Date; lte?: Date } | undefined {
  const range = (filters.where as any)?.terminationDate;
  if (!range || (!range.gte && !range.lte)) return undefined;
  return range;
}

export function extractActiveFilters(filters: Partial<TerminationGetManyFormData>, onRemoveFilter: (key: string, itemId?: string) => void): TerminationFilterIndicator[] {
  const activeFilters: TerminationFilterIndicator[] = [];

  // Search filter
  if (filters.searchingFor) {
    activeFilters.push({
      key: "searchingFor",
      label: "Buscar",
      value: filters.searchingFor,
      iconType: "search",
      onRemove: () => onRemoveFilter("searchingFor"),
    });
  }

  // Type filters (individual badges)
  if (Array.isArray(filters.types) && filters.types.length > 0) {
    filters.types.forEach((type: string) => {
      activeFilters.push({
        key: `type-${type}`,
        label: "Tipo",
        value: TERMINATION_TYPE_LABELS[type as TERMINATION_TYPE] || type,
        iconType: "user",
        itemId: type,
        onRemove: () => onRemoveFilter("types", type),
      });
    });
  }

  // Status filters (individual badges)
  if (Array.isArray(filters.statuses) && filters.statuses.length > 0) {
    filters.statuses.forEach((status: string) => {
      activeFilters.push({
        key: `status-${status}`,
        label: "Status",
        value: TERMINATION_STATUS_LABELS[status as TERMINATION_STATUS] || status,
        iconType: "shield",
        itemId: status,
        onRemove: () => onRemoveFilter("statuses", status),
      });
    });
  }

  // Termination date range
  const range = getTerminationDateRange(filters);
  if (range) {
    const gte = range.gte ? formatDate(range.gte) : "...";
    const lte = range.lte ? formatDate(range.lte) : "...";
    activeFilters.push({
      key: "terminationDate",
      label: "Data da Rescisão",
      value: `${gte} - ${lte}`,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("terminationDate"),
    });
  }

  return activeFilters;
}

export function createFilterRemover(currentFilters: Partial<TerminationGetManyFormData>, onFilterChange: (filters: Partial<TerminationGetManyFormData>) => void) {
  return (key: string, itemId?: string) => {
    const newFilters: Partial<TerminationGetManyFormData> = { ...currentFilters };

    switch (key) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;
      case "types":
        if (itemId && Array.isArray(newFilters.types)) {
          const remaining = newFilters.types.filter((type: string) => type !== itemId);
          if (remaining.length > 0) {
            newFilters.types = remaining;
          } else {
            delete newFilters.types;
          }
        } else {
          delete newFilters.types;
        }
        break;
      case "statuses":
        if (itemId && Array.isArray(newFilters.statuses)) {
          const remaining = newFilters.statuses.filter((status: string) => status !== itemId);
          if (remaining.length > 0) {
            newFilters.statuses = remaining;
          } else {
            delete newFilters.statuses;
          }
        } else {
          delete newFilters.statuses;
        }
        break;
      case "terminationDate": {
        const where = { ...((newFilters.where as any) || {}) };
        delete where.terminationDate;
        if (Object.keys(where).length === 0) {
          delete newFilters.where;
        } else {
          newFilters.where = where;
        }
        break;
      }
    }

    onFilterChange(newFilters);
  };
}
