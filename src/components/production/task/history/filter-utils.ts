import type { TaskGetManyFormData } from "../../../../schemas";
import { formatDate, formatCurrency } from "../../../../utils";
import { TASK_STATUS, TASK_STATUS_LABELS } from "../../../../constants";

export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
  itemId?: string; // For individual array item removal
  iconType?: string;
}

interface FilterUtilsOptions {
  sectors?: Array<{ id: string; name: string }>;
  customers?: Array<{ id: string; fantasyName: string }>;
  users?: Array<{ id: string; name: string }>;
  /** When true, status filter tags will not be displayed */
  hideStatusTags?: boolean;
  /** Default status filter - when current filter matches this, don't show badge */
  defaultStatus?: TASK_STATUS[];
}

export function extractActiveFilters(
  filters: Partial<TaskGetManyFormData>,
  onRemoveFilter: (key: string, itemId?: string) => void,
  options: FilterUtilsOptions = {},
): FilterIndicator[] {
  const activeFilters: FilterIndicator[] = [];
  const { sectors = [], customers = [], users = [], hideStatusTags = false, defaultStatus = [TASK_STATUS.COMPLETED] } = options;

  // Search filter - handle both search and searchingFor for backward compatibility
  const searchValue = (filters as any).search || filters.searchingFor;
  if (searchValue) {
    activeFilters.push({
      key: "search",
      label: "Buscar",
      value: searchValue,
      iconType: "search",
      onRemove: () => onRemoveFilter("search"),
    });
  }

  // Status filter - show individual badges for each status (only if not hidden)
  // Don't show badge if status matches the default (like user table behavior)
  if (!hideStatusTags && filters.status && filters.status.length > 0) {
    // Check if current status filter matches the default
    const isDefaultStatus =
      filters.status.length === defaultStatus.length &&
      filters.status.every((s: TASK_STATUS) => defaultStatus.includes(s));

    // Only show status badges if NOT the default status
    if (!isDefaultStatus) {
      filters.status.forEach((status: TASK_STATUS) => {
        // Only show badge if it's a valid status with a label
        const statusLabel = TASK_STATUS_LABELS[status];
        if (statusLabel) {
          activeFilters.push({
            key: `status-${status}`,
            label: "Status",
            value: statusLabel,
            iconType: "checklist",
            itemId: status,
            onRemove: () => onRemoveFilter("status", status),
          });
        }
      });
    }
  }

  // Entity filters - Sectors (individual badges for each sector)
  if (filters.sectorIds && Array.isArray(filters.sectorIds) && filters.sectorIds.length > 0) {
    filters.sectorIds.forEach((id: string) => {
      const sector = sectors.find((s) => s.id === id);
      activeFilters.push({
        key: `sectorIds-${id}`,
        label: "Setor",
        value: sector ? sector.name : `ID: ${id}`,  // Show ID if name not found
        iconType: "building",
        itemId: id,
        onRemove: () => onRemoveFilter("sectorIds", id),
      });
    });
  }

  // Entity filters - Customers (individual badges for each customer)
  if (filters.customerIds && Array.isArray(filters.customerIds) && filters.customerIds.length > 0) {
    filters.customerIds.forEach((id: string) => {
      const customer = customers.find((c) => c.id === id);
      activeFilters.push({
        key: `customerIds-${id}`,
        label: "Cliente",
        value: customer ? customer.fantasyName : `ID: ${id}`,  // Show ID if name not found
        iconType: "user",
        itemId: id,
        onRemove: () => onRemoveFilter("customerIds", id),
      });
    });
  }

  // Entity filters - Users/Assignees (individual badges for each user)
  if (filters.assigneeIds && Array.isArray(filters.assigneeIds) && filters.assigneeIds.length > 0) {
    filters.assigneeIds.forEach((id: string) => {
      const user = users.find((u) => u.id === id);
      activeFilters.push({
        key: `assigneeIds-${id}`,
        label: "Finalizado por",
        value: user ? user.name : `ID: ${id}`,  // Show ID if name not found
        iconType: "user-check",
        itemId: id,
        onRemove: () => onRemoveFilter("assigneeIds", id),
      });
    });
  }

  // Date range filters
  if (filters.finishedDateRange?.from || filters.finishedDateRange?.to) {
    const parts = [];
    if (filters.finishedDateRange.from) parts.push(`De: ${formatDate(filters.finishedDateRange.from)}`);
    if (filters.finishedDateRange.to) parts.push(`Até: ${formatDate(filters.finishedDateRange.to)}`);
    activeFilters.push({
      key: "finishedDateRange",
      label: "Finalizado",
      value: parts.join(" "),
      iconType: "calendar",
      onRemove: () => onRemoveFilter("finishedDateRange"),
    });
  }

  if (filters.entryDateRange?.from || filters.entryDateRange?.to) {
    const parts = [];
    if (filters.entryDateRange.from) parts.push(`De: ${formatDate(filters.entryDateRange.from)}`);
    if (filters.entryDateRange.to) parts.push(`Até: ${formatDate(filters.entryDateRange.to)}`);
    activeFilters.push({
      key: "entryDateRange",
      label: "Entrada",
      value: parts.join(" "),
      iconType: "calendar",
      onRemove: () => onRemoveFilter("entryDateRange"),
    });
  }

  if (filters.termRange?.from || filters.termRange?.to) {
    const parts = [];
    if (filters.termRange.from) parts.push(`De: ${formatDate(filters.termRange.from)}`);
    if (filters.termRange.to) parts.push(`Até: ${formatDate(filters.termRange.to)}`);
    activeFilters.push({
      key: "termRange",
      label: "Prazo",
      value: parts.join(" "),
      iconType: "calendar",
      onRemove: () => onRemoveFilter("termRange"),
    });
  }

  if (filters.startedDateRange?.from || filters.startedDateRange?.to) {
    const parts = [];
    if (filters.startedDateRange.from) parts.push(`De: ${formatDate(filters.startedDateRange.from)}`);
    if (filters.startedDateRange.to) parts.push(`Até: ${formatDate(filters.startedDateRange.to)}`);
    activeFilters.push({
      key: "startedDateRange",
      label: "Iniciado",
      value: parts.join(" "),
      iconType: "calendar",
      onRemove: () => onRemoveFilter("startedDateRange"),
    });
  }

  // Price range filter
  if (filters.priceRange?.from !== undefined || filters.priceRange?.to !== undefined) {
    const parts = [];
    if (filters.priceRange.from !== undefined) parts.push(`Min: ${formatCurrency(filters.priceRange.from)}`);
    if (filters.priceRange.to !== undefined) parts.push(`Max: ${formatCurrency(filters.priceRange.to)}`);
    activeFilters.push({
      key: "priceRange",
      label: "Valor",
      value: parts.join(" - "),
      iconType: "currency-dollar",
      onRemove: () => onRemoveFilter("priceRange"),
    });
  }

  // Boolean filters
  if (filters.hasSector) {
    activeFilters.push({
      key: "hasSector",
      label: "Tem Setor",
      value: "Sim",
      iconType: "building",
      onRemove: () => onRemoveFilter("hasSector"),
    });
  }

  if (filters.hasCustomer) {
    activeFilters.push({
      key: "hasCustomer",
      label: "Tem Cliente",
      value: "Sim",
      iconType: "user",
      onRemove: () => onRemoveFilter("hasCustomer"),
    });
  }

  if (filters.hasAssignee) {
    activeFilters.push({
      key: "hasAssignee",
      label: "Tem Responsável",
      value: "Sim",
      iconType: "user-check",
      onRemove: () => onRemoveFilter("hasAssignee"),
    });
  }

  if (filters.hasTruck) {
    activeFilters.push({
      key: "hasTruck",
      label: "Tem Caminhão",
      value: "Sim",
      iconType: "truck",
      onRemove: () => onRemoveFilter("hasTruck"),
    });
  }

  if (filters.hasObservation) {
    activeFilters.push({
      key: "hasObservation",
      label: "Tem Observação",
      value: "Sim",
      iconType: "message",
      onRemove: () => onRemoveFilter("hasObservation"),
    });
  }

  if (filters.hasArtworks) {
    activeFilters.push({
      key: "hasArtworks",
      label: "Tem Arte",
      value: "Sim",
      iconType: "palette",
      onRemove: () => onRemoveFilter("hasArtworks"),
    });
  }

  if (filters.hasPaints) {
    activeFilters.push({
      key: "hasPaints",
      label: "Tem Tintas",
      value: "Sim",
      iconType: "paint-brush",
      onRemove: () => onRemoveFilter("hasPaints"),
    });
  }

  if (filters.hasCommissions) {
    activeFilters.push({
      key: "hasCommissions",
      label: "Tem Comissões",
      value: "Sim",
      iconType: "cash",
      onRemove: () => onRemoveFilter("hasCommissions"),
    });
  }

  if (filters.hasServiceOrders) {
    activeFilters.push({
      key: "hasServiceOrders",
      label: "Tem Serviços",
      value: "Sim",
      iconType: "tool",
      onRemove: () => onRemoveFilter("hasServiceOrders"),
    });
  }

  return activeFilters;
}

export function createFilterRemover(currentFilters: Partial<TaskGetManyFormData>, onFilterChange: (filters: Partial<TaskGetManyFormData>) => void) {
  return (key: string, itemId?: string) => {
    const newFilters = { ...currentFilters };

    switch (key) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;
      case "status":
        if (itemId && Array.isArray(newFilters.status)) {
          // Remove specific status from array
          const filteredStatuses = newFilters.status.filter((s) => s !== itemId);
          if (filteredStatuses.length > 0) {
            newFilters.status = filteredStatuses;
          } else {
            // If no statuses left, reset to default (COMPLETED only)
            newFilters.status = [TASK_STATUS.COMPLETED];
          }
        } else {
          // Remove all statuses and reset to default
          newFilters.status = [TASK_STATUS.COMPLETED];
        }
        break;
      case "sectorIds":
        if (itemId && Array.isArray(newFilters.sectorIds)) {
          // Remove specific sector from array
          const filteredSectors = newFilters.sectorIds.filter((id) => id !== itemId);
          if (filteredSectors.length > 0) {
            newFilters.sectorIds = filteredSectors;
          } else {
            delete newFilters.sectorIds;
          }
        } else {
          // Remove all sectors
          delete newFilters.sectorIds;
        }
        break;
      case "customerIds":
        if (itemId && Array.isArray(newFilters.customerIds)) {
          // Remove specific customer from array
          const filteredCustomers = newFilters.customerIds.filter((id) => id !== itemId);
          if (filteredCustomers.length > 0) {
            newFilters.customerIds = filteredCustomers;
          } else {
            delete newFilters.customerIds;
          }
        } else {
          // Remove all customers
          delete newFilters.customerIds;
        }
        break;
      case "assigneeIds":
        if (itemId && Array.isArray(newFilters.assigneeIds)) {
          // Remove specific user from array
          const filteredUsers = newFilters.assigneeIds.filter((id) => id !== itemId);
          if (filteredUsers.length > 0) {
            newFilters.assigneeIds = filteredUsers;
          } else {
            delete newFilters.assigneeIds;
          }
        } else {
          // Remove all users
          delete newFilters.assigneeIds;
        }
        break;
      case "finishedDateRange":
        delete newFilters.finishedDateRange;
        break;
      case "entryDateRange":
        delete newFilters.entryDateRange;
        break;
      case "termRange":
        delete newFilters.termRange;
        break;
      case "startedDateRange":
        delete newFilters.startedDateRange;
        break;
      case "priceRange":
        delete newFilters.priceRange;
        break;
      case "hasSector":
        delete newFilters.hasSector;
        break;
      case "hasCustomer":
        delete newFilters.hasCustomer;
        break;
      case "hasAssignee":
        delete newFilters.hasAssignee;
        break;
      case "hasTruck":
        delete newFilters.hasTruck;
        break;
      case "hasObservation":
        delete newFilters.hasObservation;
        break;
      case "hasArtworks":
        delete newFilters.hasArtworks;
        break;
      case "hasPaints":
        delete newFilters.hasPaints;
        break;
      case "hasCommissions":
        delete newFilters.hasCommissions;
        break;
      case "hasServiceOrders":
        delete newFilters.hasServiceOrders;
        break;
    }

    onFilterChange(newFilters);
  };
}