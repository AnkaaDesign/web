import type { PaintProductionGetManyFormData } from "../../../../schemas";
import { formatDate } from "../../../../utils";
import { PAINT_FINISH_LABELS, PAINT_BRAND_LABELS, PAINT_FINISH, PAINT_BRAND } from "../../../../constants";

export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
  itemId?: string; // For individual array item removal
  iconType?: string;
}

interface FilterUtilsOptions {
  paintTypes?: Array<{ id: string; name: string }>;
  paintBrands?: Array<{ id: string; name: string }>;
}

export function extractActiveFilters(
  filters: Partial<PaintProductionGetManyFormData>,
  onRemoveFilter: (key: string, itemId?: string) => void,
  options: FilterUtilsOptions = {},
): FilterIndicator[] {
  const activeFilters: FilterIndicator[] = [];
  const { paintTypes = [], paintBrands = [] } = options;

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

  // Paint Type filters - individual badges for each type
  if (filters.paintTypeIds && filters.paintTypeIds.length > 0) {
    const selectedTypes = paintTypes.filter((type) => filters.paintTypeIds?.includes(type.id));

    selectedTypes.forEach((type: { id: string; name: string }) => {
      activeFilters.push({
        key: `paintTypeIds-${type.id}`,
        label: "Tipo de Tinta",
        value: type.name,
        iconType: "flask",
        itemId: type.id,
        onRemove: () => onRemoveFilter("paintTypeIds", type.id),
      });
    });
  }

  // Paint Finish filters - individual badges for each finish
  if (filters.paintFinishes && filters.paintFinishes.length > 0) {
    filters.paintFinishes.forEach((finish: PAINT_FINISH) => {
      const label = PAINT_FINISH_LABELS[finish as keyof typeof PAINT_FINISH_LABELS] || finish;
      activeFilters.push({
        key: `paintFinishes-${finish}`,
        label: "Acabamento",
        value: label,
        iconType: "brush",
        itemId: finish,
        onRemove: () => onRemoveFilter("paintFinishes", finish),
      });
    });
  }

  // Paint Brand filters (legacy enum) - individual badges for each brand
  if (filters.paintBrands && filters.paintBrands.length > 0) {
    filters.paintBrands.forEach((brand: PAINT_BRAND) => {
      const label = PAINT_BRAND_LABELS[brand as keyof typeof PAINT_BRAND_LABELS] || brand;
      activeFilters.push({
        key: `paintBrands-${brand}`,
        label: "Marca",
        value: label,
        iconType: "tags",
        itemId: brand,
        onRemove: () => onRemoveFilter("paintBrands", brand),
      });
    });
  }

  // Paint Brand filters (entity-based) - individual badges for each brand
  if (filters.paintBrandIds && filters.paintBrandIds.length > 0) {
    const selectedBrands = paintBrands.filter((brand) => filters.paintBrandIds?.includes(brand.id));

    selectedBrands.forEach((brand: { id: string; name: string }) => {
      activeFilters.push({
        key: `paintBrandIds-${brand.id}`,
        label: "Marca",
        value: brand.name,
        iconType: "tags",
        itemId: brand.id,
        onRemove: () => onRemoveFilter("paintBrandIds", brand.id),
      });
    });
  }

  // Volume range filter
  if (filters.volumeRange?.min !== undefined || filters.volumeRange?.max !== undefined) {
    const min = filters.volumeRange.min;
    const max = filters.volumeRange.max;
    let value = "";

    if (min !== undefined && max !== undefined) {
      value = `${min}L - ${max}L`;
    } else if (min !== undefined) {
      value = `≥ ${min}L`;
    } else if (max !== undefined) {
      value = `≤ ${max}L`;
    }

    activeFilters.push({
      key: "volumeRange",
      label: "Volume",
      value,
      iconType: "droplet",
      onRemove: () => onRemoveFilter("volumeRange"),
    });
  }

  // Production date filter
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
      label: "Data de Produção",
      value,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("createdAt"),
    });
  }

  return activeFilters;
}

export function createFilterRemover(currentFilters: Partial<PaintProductionGetManyFormData>, onFilterChange: (filters: PaintProductionGetManyFormData) => void) {
  return (key: string, itemId?: string) => {
    const newFilters = { ...currentFilters };

    switch (key) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;
      case "paintTypeIds":
        if (itemId && Array.isArray(newFilters.paintTypeIds)) {
          // Remove specific paint type from array
          const filteredTypes = newFilters.paintTypeIds.filter((id) => id !== itemId);
          if (filteredTypes.length > 0) {
            newFilters.paintTypeIds = filteredTypes;
          } else {
            delete newFilters.paintTypeIds;
          }
        } else {
          // Remove all paint types
          delete newFilters.paintTypeIds;
        }
        break;
      case "paintFinishes":
        if (itemId && Array.isArray(newFilters.paintFinishes)) {
          // Remove specific finish from array
          const filteredFinishes = newFilters.paintFinishes.filter((finish) => finish !== itemId);
          if (filteredFinishes.length > 0) {
            newFilters.paintFinishes = filteredFinishes;
          } else {
            delete newFilters.paintFinishes;
          }
        } else {
          // Remove all finishes
          delete newFilters.paintFinishes;
        }
        break;
      case "paintBrands":
        if (itemId && Array.isArray(newFilters.paintBrands)) {
          // Remove specific brand from array
          const filteredBrands = newFilters.paintBrands.filter((brand) => brand !== itemId);
          if (filteredBrands.length > 0) {
            newFilters.paintBrands = filteredBrands;
          } else {
            delete newFilters.paintBrands;
          }
        } else {
          // Remove all brands
          delete newFilters.paintBrands;
        }
        break;
      case "paintBrandIds":
        if (itemId && Array.isArray(newFilters.paintBrandIds)) {
          // Remove specific brand from array
          const filteredBrandIds = newFilters.paintBrandIds.filter((id) => id !== itemId);
          if (filteredBrandIds.length > 0) {
            newFilters.paintBrandIds = filteredBrandIds;
          } else {
            delete newFilters.paintBrandIds;
          }
        } else {
          // Remove all brand IDs
          delete newFilters.paintBrandIds;
        }
        break;
      case "volumeRange":
        delete newFilters.volumeRange;
        break;
      case "createdAt":
        delete newFilters.createdAt;
        break;
    }

    onFilterChange(newFilters as PaintProductionGetManyFormData);
  };
}
