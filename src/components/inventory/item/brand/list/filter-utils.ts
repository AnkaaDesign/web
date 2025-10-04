import type { ItemBrandGetManyFormData } from "../../../../../schemas";

export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
}

export function extractActiveFilters(filters: Partial<ItemBrandGetManyFormData>, onRemoveFilter: (key: string, value?: any) => void): FilterIndicator[] {
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

  // Date filters
  if (filters.createdAt?.gte || filters.createdAt?.lte) {
    const startDate = filters.createdAt.gte ? new Date(filters.createdAt.gte).toLocaleDateString("pt-BR") : "";
    const endDate = filters.createdAt.lte ? new Date(filters.createdAt.lte).toLocaleDateString("pt-BR") : "";

    if (startDate && endDate) {
      activeFilters.push({
        key: "createdAt",
        label: "Criado entre",
        value: `${startDate} - ${endDate}`,
        onRemove: () => onRemoveFilter("createdAt"),
      });
    } else if (startDate) {
      activeFilters.push({
        key: "createdAt-gte",
        label: "Criado após",
        value: startDate,
        onRemove: () => onRemoveFilter("createdAt", "gte"),
      });
    } else if (endDate) {
      activeFilters.push({
        key: "createdAt-lte",
        label: "Criado até",
        value: endDate,
        onRemove: () => onRemoveFilter("createdAt", "lte"),
      });
    }
  }

  return activeFilters;
}

export function createFilterRemover(currentFilters: Partial<ItemBrandGetManyFormData>, onFilterChange: (filters: Partial<ItemBrandGetManyFormData>) => void) {
  return (key: string, value?: any) => {
    const newFilters = { ...currentFilters };

    switch (key) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;

      case "createdAt":
        if (value === "gte" && newFilters.createdAt) {
          delete newFilters.createdAt.gte;
          if (!newFilters.createdAt.lte) {
            delete newFilters.createdAt;
          }
        } else if (value === "lte" && newFilters.createdAt) {
          delete newFilters.createdAt.lte;
          if (!newFilters.createdAt.gte) {
            delete newFilters.createdAt;
          }
        } else {
          delete newFilters.createdAt;
        }
        break;
    }

    onFilterChange(newFilters);
  };
}
