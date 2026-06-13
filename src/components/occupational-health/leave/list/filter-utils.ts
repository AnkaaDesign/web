import { LEAVE_TYPE, LEAVE_STATUS, LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS } from "../../../../constants";
import { formatDate } from "../../../../utils";
import type { LeaveListFilters } from "./types";

export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
  itemId?: string;
  iconType?: string;
}

interface FilterUtilsOptions {
  users?: Array<{ id: string; name: string }>;
}

export function extractActiveFilters(filters: Partial<LeaveListFilters>, onRemoveFilter: (key: string, itemId?: string) => void, options: FilterUtilsOptions = {}): FilterIndicator[] {
  const activeFilters: FilterIndicator[] = [];
  const { users = [] } = options;

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
  if (filters.types && Array.isArray(filters.types) && filters.types.length > 0) {
    filters.types.forEach((type: string) => {
      activeFilters.push({
        key: `types-${type}`,
        label: "Tipo",
        value: LEAVE_TYPE_LABELS[type as LEAVE_TYPE] || type,
        iconType: "calendar",
        itemId: type,
        onRemove: () => onRemoveFilter("types", type),
      });
    });
  }

  // Status filters (individual badges)
  if (filters.statuses && Array.isArray(filters.statuses) && filters.statuses.length > 0) {
    filters.statuses.forEach((status: string) => {
      activeFilters.push({
        key: `statuses-${status}`,
        label: "Status",
        value: LEAVE_STATUS_LABELS[status as LEAVE_STATUS] || status,
        iconType: "shield",
        itemId: status,
        onRemove: () => onRemoveFilter("statuses", status),
      });
    });
  }

  // User filters (individual badges)
  if (filters.userIds && Array.isArray(filters.userIds) && filters.userIds.length > 0) {
    const selectedUsers = users.filter((user) => filters.userIds?.includes(user.id));

    selectedUsers.forEach((user) => {
      activeFilters.push({
        key: `userIds-${user.id}`,
        label: "Colaborador",
        value: user.name,
        iconType: "user",
        itemId: user.id,
        onRemove: () => onRemoveFilter("userIds", user.id),
      });
    });
  }

  // Return exam required filter
  if (typeof filters.returnExamRequired === "boolean") {
    activeFilters.push({
      key: "returnExamRequired",
      label: "Exame de Retorno",
      value: filters.returnExamRequired ? "Obrigatório" : "Não obrigatório",
      iconType: "shield-check",
      onRemove: () => onRemoveFilter("returnExamRequired"),
    });
  }

  // Start date range filter
  if (filters.startDate?.gte || filters.startDate?.lte) {
    const gte = filters.startDate.gte;
    const lte = filters.startDate.lte;
    let value = "";

    if (gte && lte) {
      value = `${formatDate(gte)} - ${formatDate(lte)}`;
    } else if (gte) {
      value = `≥ ${formatDate(gte)}`;
    } else if (lte) {
      value = `≤ ${formatDate(lte)}`;
    }

    activeFilters.push({
      key: "startDate",
      label: "Data de Início",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("startDate"),
    });
  }

  return activeFilters;
}

export function createFilterRemover(currentFilters: Partial<LeaveListFilters>, onFilterChange: (filters: Partial<LeaveListFilters>) => void) {
  return (key: string, itemId?: string) => {
    const newFilters = { ...currentFilters };

    switch (key) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;
      case "types":
        if (itemId && Array.isArray(newFilters.types)) {
          const filtered = newFilters.types.filter((type) => type !== itemId);
          if (filtered.length > 0) {
            newFilters.types = filtered;
          } else {
            delete newFilters.types;
          }
        } else {
          delete newFilters.types;
        }
        break;
      case "statuses":
        if (itemId && Array.isArray(newFilters.statuses)) {
          const filtered = newFilters.statuses.filter((status) => status !== itemId);
          if (filtered.length > 0) {
            newFilters.statuses = filtered;
          } else {
            delete newFilters.statuses;
          }
        } else {
          delete newFilters.statuses;
        }
        break;
      case "userIds":
        if (itemId && Array.isArray(newFilters.userIds)) {
          const filtered = newFilters.userIds.filter((id) => id !== itemId);
          if (filtered.length > 0) {
            newFilters.userIds = filtered;
          } else {
            delete newFilters.userIds;
          }
        } else {
          delete newFilters.userIds;
        }
        break;
      case "returnExamRequired":
        delete newFilters.returnExamRequired;
        break;
      case "startDate":
        delete newFilters.startDate;
        break;
    }

    onFilterChange(newFilters);
  };
}
