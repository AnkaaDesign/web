import type { ItemCategoryGetManyFormData } from "../../../../../schemas";
// import { ITEM_TYPE_LABELS } from "../../../../../constants";

export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
}

export function extractActiveFilters(filters: Partial<ItemCategoryGetManyFormData>, onRemoveFilter: (key: string, value?: any) => void): FilterIndicator[] {
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

  // Type filter - temporarily disabled until ITEM_TYPE_LABELS is available
  // if (filters.where?.type) {
  //   activeFilters.push({
  //     key: 'type',
  //     label: 'Tipo',
  //     value: ITEM_TYPE_LABELS[filters.where.type] || filters.where.type,
  //     onRemove: () => onRemoveFilter('type'),
  //   });
  // }

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

export function createFilterRemover(currentFilters: Partial<ItemCategoryGetManyFormData>, onFilterChange: (filters: Partial<ItemCategoryGetManyFormData>) => void) {
  return (key: string, value?: any) => {
    const newFilters = { ...currentFilters };

    switch (key) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;

      case "type":
        if (newFilters.where) {
          delete newFilters.where.type;
          if (Object.keys(newFilters.where).length === 0) {
            delete newFilters.where;
          }
        }
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
