import type { PaintBrandGetManyFormData } from "../../../../schemas";
import { formatDate } from "../../../../utils";

export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
  itemId?: string; // For individual array item removal
  iconType?: string;
}

interface FilterUtilsOptions {
  // Add options for related entities when/if needed
  // Paint brand filters are simpler, mainly search and date filters
}

export function extractActiveFilters(
  filters: Partial<PaintBrandGetManyFormData>,
  onRemoveFilter: (key: string, itemId?: string) => void,
  _options: FilterUtilsOptions = {},
): FilterIndicator[] {
  const activeFilters: FilterIndicator[] = [];

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

  // Name filter
  if (filters.names && filters.names.length > 0) {
    filters.names.forEach((name, _index) => {
      activeFilters.push({
        key: "names",
        label: "Nome",
        value: name,
        itemId: name,
        iconType: "tag",
        onRemove: () => onRemoveFilter("names", name),
      });
    });
  }

  // Boolean filters for related entities
  if (filters.hasPaints !== undefined) {
    activeFilters.push({
      key: "hasPaints",
      label: "Com tintas",
      value: filters.hasPaints ? "Sim" : "Não",
      iconType: "brush",
      onRemove: () => onRemoveFilter("hasPaints"),
    });
  }

  if (filters.hasComponentItems !== undefined) {
    activeFilters.push({
      key: "hasComponentItems",
      label: "Com componentes",
      value: filters.hasComponentItems ? "Sim" : "Não",
      iconType: "components",
      onRemove: () => onRemoveFilter("hasComponentItems"),
    });
  }

  // Date filters
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

export function createFilterRemover(currentFilters: Partial<PaintBrandGetManyFormData>, onFilterChange: (filters: Partial<PaintBrandGetManyFormData>) => void) {
  return (key: string, itemId?: string) => {
    const newFilters = { ...currentFilters };
    const newWhere = { ...newFilters.where };

    switch (key) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;
      case "names":
        if (itemId && newFilters.names) {
          newFilters.names = newFilters.names.filter((name) => name !== itemId);
          if (newFilters.names.length === 0) {
            delete newFilters.names;
          }
        } else {
          delete newFilters.names;
        }
        break;
      case "hasPaints":
        delete newFilters.hasPaints;
        break;
      case "hasComponentItems":
        delete newFilters.hasComponentItems;
        break;
      case "createdAt":
        delete newFilters.createdAt;
        break;
      case "updatedAt":
        delete newFilters.updatedAt;
        break;
    }

    // Update where clause
    if (Object.keys(newWhere).length === 0) {
      delete newFilters.where;
    } else {
      newFilters.where = newWhere;
    }

    onFilterChange(newFilters);
  };
}
