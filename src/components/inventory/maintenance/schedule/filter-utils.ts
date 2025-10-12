import type { MaintenanceScheduleGetManyFormData } from "../../../../schemas";
import { SCHEDULE_FREQUENCY_LABELS, SCHEDULE_FREQUENCY } from "../../../../constants";
import type { Item } from "../../../../types";

export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
}

export function extractActiveFilters(
  filters: Partial<MaintenanceScheduleGetManyFormData>,
  onRemoveFilter: (key: string, value?: any) => void,
  entities?: {
    items?: Item[];
  }
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
    const itemNames = filters.itemIds
      .map((id: any) => entities.items?.find((item) => item.id === id)?.name)
      .filter(Boolean);
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

  // Frequency filter
  if (filters.frequency && filters.frequency.length > 0) {
    const labels = filters.frequency.map((freq: any) => {
      const typedFreq = freq as SCHEDULE_FREQUENCY;
      return SCHEDULE_FREQUENCY_LABELS[typedFreq] || freq;
    });
    activeFilters.push({
      key: "frequency",
      label: "Frequência",
      value: labels.join(", "),
      onRemove: () => onRemoveFilter("frequency"),
    });
  }

  // Active filter
  if (filters.isActive !== undefined) {
    activeFilters.push({
      key: "isActive",
      label: "Status",
      value: filters.isActive ? "Apenas ativos" : "Apenas inativos",
      onRemove: () => onRemoveFilter("isActive"),
    });
  }

  // Date filters
  if (filters.nextRunRange?.gte || filters.nextRunRange?.lte) {
    const startDate = filters.nextRunRange.gte
      ? new Date(filters.nextRunRange.gte).toLocaleDateString("pt-BR")
      : "";
    const endDate = filters.nextRunRange.lte
      ? new Date(filters.nextRunRange.lte).toLocaleDateString("pt-BR")
      : "";

    if (startDate && endDate) {
      activeFilters.push({
        key: "nextRunRange",
        label: "Próxima execução entre",
        value: `${startDate} - ${endDate}`,
        onRemove: () => onRemoveFilter("nextRunRange"),
      });
    } else if (startDate) {
      activeFilters.push({
        key: "nextRunRange-gte",
        label: "Próxima execução após",
        value: startDate,
        onRemove: () => onRemoveFilter("nextRunRange", "gte"),
      });
    } else if (endDate) {
      activeFilters.push({
        key: "nextRunRange-lte",
        label: "Próxima execução até",
        value: endDate,
        onRemove: () => onRemoveFilter("nextRunRange", "lte"),
      });
    }
  }

  return activeFilters;
}

export function createFilterRemover(
  setFilters: React.Dispatch<React.SetStateAction<Partial<MaintenanceScheduleGetManyFormData>>>
) {
  return (key: string, value?: any) => {
    setFilters((currentFilters) => {
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

        case "frequency":
          delete newFilters.frequency;
          break;

        case "isActive":
          delete newFilters.isActive;
          break;

        case "nextRunRange":
          if (value === "gte" && newFilters.nextRunRange) {
            delete newFilters.nextRunRange.gte;
            if (!newFilters.nextRunRange.lte) {
              delete newFilters.nextRunRange;
            }
          } else if (value === "lte" && newFilters.nextRunRange) {
            delete newFilters.nextRunRange.lte;
            if (!newFilters.nextRunRange.gte) {
              delete newFilters.nextRunRange;
            }
          } else {
            delete newFilters.nextRunRange;
          }
          break;
      }

      return newFilters;
    });
  };
}
