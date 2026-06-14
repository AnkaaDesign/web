import type { VacationGetManyFormData } from "../../../../schemas/vacation";
import { VACATION_STATUS, VACATION_STATUS_LABELS } from "../../../../constants";
import { formatDate } from "../../../../utils";

export interface VacationFilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
  itemId?: string;
  iconType?: string;
}

/** Reads the concessiveEnd range stored under where.concessiveEnd. */
export function getConcessiveDateRange(filters: Partial<VacationGetManyFormData>): { gte?: Date; lte?: Date } | undefined {
  const range = (filters.where as any)?.concessiveEnd;
  if (!range || (!range.gte && !range.lte)) return undefined;
  return range;
}

export function extractActiveFilters(
  filters: Partial<VacationGetManyFormData> & { userNames?: Record<string, string> },
  onRemoveFilter: (key: string, itemId?: string) => void,
): VacationFilterIndicator[] {
  const activeFilters: VacationFilterIndicator[] = [];

  if (filters.searchingFor) {
    activeFilters.push({
      key: "searchingFor",
      label: "Buscar",
      value: filters.searchingFor,
      iconType: "search",
      onRemove: () => onRemoveFilter("searchingFor"),
    });
  }

  if (Array.isArray(filters.statuses) && filters.statuses.length > 0) {
    filters.statuses.forEach((status: string) => {
      activeFilters.push({
        key: `status-${status}`,
        label: "Status",
        value: VACATION_STATUS_LABELS[status as VACATION_STATUS] || status,
        iconType: "shield",
        itemId: status,
        onRemove: () => onRemoveFilter("statuses", status),
      });
    });
  }

  if (Array.isArray(filters.userIds) && filters.userIds.length > 0) {
    filters.userIds.forEach((userId: string) => {
      activeFilters.push({
        key: `user-${userId}`,
        label: "Colaborador",
        value: filters.userNames?.[userId] || userId,
        iconType: "user",
        itemId: userId,
        onRemove: () => onRemoveFilter("userIds", userId),
      });
    });
  }

  const range = getConcessiveDateRange(filters);
  if (range) {
    const gte = range.gte ? formatDate(range.gte) : "...";
    const lte = range.lte ? formatDate(range.lte) : "...";
    activeFilters.push({
      key: "concessiveEnd",
      label: "Limite Concessivo",
      value: `${gte} - ${lte}`,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("concessiveEnd"),
    });
  }

  return activeFilters;
}

export function createFilterRemover(currentFilters: Partial<VacationGetManyFormData>, onFilterChange: (filters: Partial<VacationGetManyFormData>) => void) {
  return (key: string, itemId?: string) => {
    const newFilters: Partial<VacationGetManyFormData> = { ...currentFilters };

    switch (key) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;
      case "statuses":
        if (itemId && Array.isArray(newFilters.statuses)) {
          const remaining = newFilters.statuses.filter((status: string) => status !== itemId);
          if (remaining.length > 0) newFilters.statuses = remaining;
          else delete newFilters.statuses;
        } else {
          delete newFilters.statuses;
        }
        break;
      case "userIds":
        if (itemId && Array.isArray(newFilters.userIds)) {
          const remaining = newFilters.userIds.filter((id: string) => id !== itemId);
          if (remaining.length > 0) newFilters.userIds = remaining;
          else delete newFilters.userIds;
        } else {
          delete newFilters.userIds;
        }
        break;
      case "concessiveEnd": {
        const where = { ...((newFilters.where as any) || {}) };
        delete where.concessiveEnd;
        if (Object.keys(where).length === 0) delete newFilters.where;
        else newFilters.where = where;
        break;
      }
    }

    onFilterChange(newFilters);
  };
}
