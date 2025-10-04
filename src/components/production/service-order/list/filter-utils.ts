import type { ServiceOrderGetManyFormData } from "../../../../schemas";
import { formatDate } from "../../../../utils";
import { SERVICE_ORDER_STATUS, SERVICE_ORDER_STATUS_LABELS } from "../../../../constants";

export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
  itemId?: string; // For individual array item removal
  iconType?: string;
}

interface FilterUtilsOptions {
  services?: Array<{ id: string; description: string }>;
  tasks?: Array<{ id: string; name: string }>;
}

export function extractActiveFilters(
  filters: Partial<ServiceOrderGetManyFormData>,
  onRemoveFilter: (key: string, itemId?: string) => void,
  options: FilterUtilsOptions = {},
): FilterIndicator[] {
  const activeFilters: FilterIndicator[] = [];
  const { services = [], tasks = [] } = options;

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

  // Status filters (individual badges for each status)
  if (filters.status && Array.isArray(filters.status) && filters.status.length > 0) {
    filters.status.forEach((status: any) => {
      const label = SERVICE_ORDER_STATUS_LABELS[status as SERVICE_ORDER_STATUS] || status;
      activeFilters.push({
        key: `status-${status}`,
        label: "Status",
        value: label,
        iconType: "status",
        itemId: status,
        onRemove: () => onRemoveFilter("status", status),
      });
    });
  }

  // Service filters (individual badges for each service)
  if (filters.serviceIds && Array.isArray(filters.serviceIds) && filters.serviceIds.length > 0) {
    const selectedServices = services.filter((service) => filters.serviceIds?.includes(service.id));

    selectedServices.forEach((service) => {
      activeFilters.push({
        key: `serviceIds-${service.id}`,
        label: "Serviço",
        value: service.description,
        iconType: "service",
        itemId: service.id,
        onRemove: () => onRemoveFilter("serviceIds", service.id),
      });
    });
  }

  // Task filters (individual badges for each task)
  if (filters.taskIds && Array.isArray(filters.taskIds) && filters.taskIds.length > 0) {
    const selectedTasks = tasks.filter((task) => filters.taskIds?.includes(task.id));

    selectedTasks.forEach((task) => {
      activeFilters.push({
        key: `taskIds-${task.id}`,
        label: "Tarefa",
        value: task.name,
        iconType: "task",
        itemId: task.id,
        onRemove: () => onRemoveFilter("taskIds", task.id),
      });
    });
  }

  // Date filters
  if (filters.startedAt?.from || filters.startedAt?.to) {
    const from = filters.startedAt.from;
    const to = filters.startedAt.to;
    let value = "";

    if (from && to) {
      value = `${formatDate(from)} - ${formatDate(to)}`;
    } else if (from) {
      value = `≥ ${formatDate(from)}`;
    } else if (to) {
      value = `≤ ${formatDate(to)}`;
    }

    activeFilters.push({
      key: "startedAt",
      label: "Data início",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("startedAt"),
    });
  }

  if (filters.finishedAt?.from || filters.finishedAt?.to) {
    const from = filters.finishedAt.from;
    const to = filters.finishedAt.to;
    let value = "";

    if (from && to) {
      value = `${formatDate(from)} - ${formatDate(to)}`;
    } else if (from) {
      value = `≥ ${formatDate(from)}`;
    } else if (to) {
      value = `≤ ${formatDate(to)}`;
    }

    activeFilters.push({
      key: "finishedAt",
      label: "Data conclusão",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("finishedAt"),
    });
  }

  if (filters.createdAt?.gte || filters.createdAt?.lte) {
    const gte = filters.createdAt.gte;
    const lte = filters.createdAt.lte;
    let value = "";

    if (gte && lte) {
      value = `${formatDate(gte)} - ${formatDate(lte)}`;
    } else if (gte) {
      value = `≥ ${formatDate(gte)}`;
    } else if (lte) {
      value = `≤ ${formatDate(lte)}`;
    }

    activeFilters.push({
      key: "createdAt",
      label: "Data criação",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("createdAt"),
    });
  }

  if (filters.updatedAt?.gte || filters.updatedAt?.lte) {
    const gte = filters.updatedAt.gte;
    const lte = filters.updatedAt.lte;
    let value = "";

    if (gte && lte) {
      value = `${formatDate(gte)} - ${formatDate(lte)}`;
    } else if (gte) {
      value = `≥ ${formatDate(gte)}`;
    } else if (lte) {
      value = `≤ ${formatDate(lte)}`;
    }

    activeFilters.push({
      key: "updatedAt",
      label: "Data atualização",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("updatedAt"),
    });
  }

  return activeFilters;
}

export function createFilterRemover(currentFilters: Partial<ServiceOrderGetManyFormData>, onFilterChange: (filters: Partial<ServiceOrderGetManyFormData>) => void) {
  return (key: string, itemId?: string) => {
    const newFilters = { ...currentFilters };

    switch (key) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;
      case "status":
        if (itemId && Array.isArray(newFilters.status)) {
          // Remove specific status from array
          const filteredStatuses = newFilters.status.filter((status) => status !== itemId);
          if (filteredStatuses.length > 0) {
            newFilters.status = filteredStatuses;
          } else {
            delete newFilters.status;
          }
        } else {
          // Remove all statuses
          delete newFilters.status;
        }
        break;
      case "serviceIds":
        if (itemId && Array.isArray(newFilters.serviceIds)) {
          // Remove specific service from array
          const filteredServices = newFilters.serviceIds.filter((id) => id !== itemId);
          if (filteredServices.length > 0) {
            newFilters.serviceIds = filteredServices;
          } else {
            delete newFilters.serviceIds;
          }
        } else {
          // Remove all services
          delete newFilters.serviceIds;
        }
        break;
      case "taskIds":
        if (itemId && Array.isArray(newFilters.taskIds)) {
          // Remove specific task from array
          const filteredTasks = newFilters.taskIds.filter((id) => id !== itemId);
          if (filteredTasks.length > 0) {
            newFilters.taskIds = filteredTasks;
          } else {
            delete newFilters.taskIds;
          }
        } else {
          // Remove all tasks
          delete newFilters.taskIds;
        }
        break;
      case "startedAt":
        delete newFilters.startedAt;
        break;
      case "finishedAt":
        delete newFilters.finishedAt;
        break;
      case "createdAt":
        delete newFilters.createdAt;
        break;
      case "updatedAt":
        delete newFilters.updatedAt;
        break;
    }

    onFilterChange(newFilters);
  };
}
