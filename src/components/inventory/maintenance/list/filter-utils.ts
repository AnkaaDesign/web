import type { MaintenanceGetManyFormData } from "../../../../schemas";
import { MAINTENANCE_STATUS_LABELS, PRIORITY_TYPE_LABELS, MAINTENANCE_STATUS, PRIORITY_TYPE } from "../../../../constants";
import type { Item, Sector } from "../../../../types";

export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
  itemId?: string;
  iconType?: string;
}

export function extractActiveFilters(
  filters: Partial<MaintenanceGetManyFormData>,
  onRemoveFilter: (key: string, value?: any) => void,
  entities?: {
    items?: Item[];
    sectors?: Sector[];
  },
): FilterIndicator[] {
  const activeFilters: FilterIndicator[] = [];

  // Search filter
  if (filters.searchingFor) {
    activeFilters.push({
      key: "searchingFor",
      label: "Busca",
      value: filters.searchingFor,
      onRemove: () => onRemoveFilter("searchingFor"),
    });
  }

  // Item filter
  if (filters.itemIds && filters.itemIds.length > 0 && entities?.items) {
    const itemNames = filters.itemIds.map((id: string) => entities.items?.find((item) => item.id === id)?.name).filter(Boolean);
    if (itemNames.length > 0) {
      activeFilters.push({
        key: "itemIds",
        label: "Itens",
        value: itemNames.join(", "),
        onRemove: () => onRemoveFilter("itemIds"),
      });
    }
  } else if (filters.where?.itemId && entities?.items) {
    const item = entities.items.find((i) => i.id === filters.where!.itemId);
    if (item) {
      activeFilters.push({
        key: "itemId",
        label: "Item",
        value: item.name,
        onRemove: () => onRemoveFilter("itemId"),
      });
    }
  }

  // Sector filter
  if (filters.sectorIds && filters.sectorIds.length > 0 && entities?.sectors) {
    const sectorNames = filters.sectorIds.map((id: string) => entities.sectors?.find((sector) => sector.id === id)?.name).filter(Boolean);
    if (sectorNames.length > 0) {
      activeFilters.push({
        key: "sectorIds",
        label: "Setores",
        value: sectorNames.join(", "),
        onRemove: () => onRemoveFilter("sectorIds"),
      });
    }
  } else if (filters.where?.sectorId && entities?.sectors) {
    const sector = entities.sectors.find((s) => s.id === filters.where!.sectorId);
    if (sector) {
      activeFilters.push({
        key: "sectorId",
        label: "Setor",
        value: sector.name,
        onRemove: () => onRemoveFilter("sectorId"),
      });
    }
  }

  // Status filter
  if (filters.status && filters.status.length > 0) {
    const labels = filters.status.map((status: any) => MAINTENANCE_STATUS_LABELS[status as MAINTENANCE_STATUS] || status);
    activeFilters.push({
      key: "status",
      label: "Status",
      value: labels.join(", "),
      onRemove: () => onRemoveFilter("status"),
    });
  }

  // Priority filter
  if (filters.priority && filters.priority.length > 0) {
    const labels = filters.priority.map((priority: any) => PRIORITY_TYPE_LABELS[priority as PRIORITY_TYPE] || priority);
    activeFilters.push({
      key: "priority",
      label: "Prioridade",
      value: labels.join(", "),
      onRemove: () => onRemoveFilter("priority"),
    });
  }

  // Date filters
  if (filters.nextMaintenanceDate?.gte || filters.nextMaintenanceDate?.lte) {
    const startDate = filters.nextMaintenanceDate.gte ? new Date(filters.nextMaintenanceDate.gte).toLocaleDateString("pt-BR") : "";
    const endDate = filters.nextMaintenanceDate.lte ? new Date(filters.nextMaintenanceDate.lte).toLocaleDateString("pt-BR") : "";

    if (startDate && endDate) {
      activeFilters.push({
        key: "nextMaintenanceDate",
        label: "Próx. Manutenção entre",
        value: `${startDate} - ${endDate}`,
        onRemove: () => onRemoveFilter("nextMaintenanceDate"),
      });
    } else if (startDate) {
      activeFilters.push({
        key: "nextMaintenanceDate-gte",
        label: "Próx. Manutenção após",
        value: startDate,
        onRemove: () => onRemoveFilter("nextMaintenanceDate", "gte"),
      });
    } else if (endDate) {
      activeFilters.push({
        key: "nextMaintenanceDate-lte",
        label: "Próx. Manutenção até",
        value: endDate,
        onRemove: () => onRemoveFilter("nextMaintenanceDate", "lte"),
      });
    }
  }

  if (filters.lastMaintenanceDate?.gte || filters.lastMaintenanceDate?.lte) {
    const startDate = filters.lastMaintenanceDate.gte ? new Date(filters.lastMaintenanceDate.gte).toLocaleDateString("pt-BR") : "";
    const endDate = filters.lastMaintenanceDate.lte ? new Date(filters.lastMaintenanceDate.lte).toLocaleDateString("pt-BR") : "";

    if (startDate && endDate) {
      activeFilters.push({
        key: "lastMaintenanceDate",
        label: "Últ. Manutenção entre",
        value: `${startDate} - ${endDate}`,
        onRemove: () => onRemoveFilter("lastMaintenanceDate"),
      });
    } else if (startDate) {
      activeFilters.push({
        key: "lastMaintenanceDate-gte",
        label: "Últ. Manutenção após",
        value: startDate,
        onRemove: () => onRemoveFilter("lastMaintenanceDate", "gte"),
      });
    } else if (endDate) {
      activeFilters.push({
        key: "lastMaintenanceDate-lte",
        label: "Últ. Manutenção até",
        value: endDate,
        onRemove: () => onRemoveFilter("lastMaintenanceDate", "lte"),
      });
    }
  }

  return activeFilters;
}

export function createFilterRemover(currentFilters: Partial<MaintenanceGetManyFormData>, onFilterChange: (filters: Partial<MaintenanceGetManyFormData>) => void) {
  return (key: string, value?: any) => {
    const newFilters = { ...currentFilters };

    switch (key) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;

      case "itemIds":
        delete newFilters.itemIds;
        break;

      case "itemId":
        if (newFilters.where) {
          delete newFilters.where.itemId;
          if (Object.keys(newFilters.where).length === 0) {
            delete newFilters.where;
          }
        }
        break;

      case "sectorIds":
        delete newFilters.sectorIds;
        break;

      case "sectorId":
        if (newFilters.where) {
          delete newFilters.where.sectorId;
          if (Object.keys(newFilters.where).length === 0) {
            delete newFilters.where;
          }
        }
        break;

      case "status":
        delete newFilters.status;
        break;

      case "priority":
        delete newFilters.priority;
        break;

      case "nextMaintenanceDate":
        if (value === "gte" && newFilters.nextMaintenanceDate) {
          delete newFilters.nextMaintenanceDate.gte;
          if (!newFilters.nextMaintenanceDate.lte) {
            delete newFilters.nextMaintenanceDate;
          }
        } else if (value === "lte" && newFilters.nextMaintenanceDate) {
          delete newFilters.nextMaintenanceDate.lte;
          if (!newFilters.nextMaintenanceDate.gte) {
            delete newFilters.nextMaintenanceDate;
          }
        } else {
          delete newFilters.nextMaintenanceDate;
        }
        break;

      case "lastMaintenanceDate":
        if (value === "gte" && newFilters.lastMaintenanceDate) {
          delete newFilters.lastMaintenanceDate.gte;
          if (!newFilters.lastMaintenanceDate.lte) {
            delete newFilters.lastMaintenanceDate;
          }
        } else if (value === "lte" && newFilters.lastMaintenanceDate) {
          delete newFilters.lastMaintenanceDate.lte;
          if (!newFilters.lastMaintenanceDate.gte) {
            delete newFilters.lastMaintenanceDate;
          }
        } else {
          delete newFilters.lastMaintenanceDate;
        }
        break;
    }

    onFilterChange(newFilters);
  };
}
