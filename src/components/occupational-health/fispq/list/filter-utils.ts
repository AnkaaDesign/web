import type { FispqGetManyFormData } from "@/schemas/fispq";
import {
  FISPQ_STATUS_LABELS,
  GHS_SIGNAL_WORD_LABELS,
  GHS_PICTOGRAM_CODE_LABELS,
} from "../../../../constants";
import type { FISPQ_STATUS, GHS_SIGNAL_WORD, GHS_PICTOGRAM } from "../../../../constants";

// UI filter shape — extends the API getMany convenience filters with two
// UI-only toggles (hasPdf / categoryIds) that are translated into `where` by
// the list component before querying.
export interface FispqFilters extends Partial<FispqGetManyFormData> {
  searchingFor?: string;
  statuses?: string[];
  signalWords?: string[];
  pictograms?: string[];
  itemIds?: string[];
  categoryIds?: string[];
  expiringInDays?: number;
  /** true → only records without a PDF attached. */
  hasPdf?: boolean;
}

export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
  itemId?: string;
  iconType?: string;
}

interface FilterUtilsOptions {
  categories?: Array<{ id: string; name: string }>;
}

export function extractActiveFilters(
  filters: FispqFilters,
  onRemoveFilter: (key: string, itemId?: string) => void,
  options: FilterUtilsOptions = {},
): FilterIndicator[] {
  const activeFilters: FilterIndicator[] = [];
  const { categories = [] } = options;

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

  // Status filters
  if (filters.statuses && Array.isArray(filters.statuses) && filters.statuses.length > 0) {
    filters.statuses.forEach((status: string) => {
      activeFilters.push({
        key: `statuses-${status}`,
        label: "Status",
        value: FISPQ_STATUS_LABELS[status as FISPQ_STATUS] || status,
        iconType: "shield",
        itemId: status,
        onRemove: () => onRemoveFilter("statuses", status),
      });
    });
  }

  // Signal word filters
  if (filters.signalWords && Array.isArray(filters.signalWords) && filters.signalWords.length > 0) {
    filters.signalWords.forEach((signalWord: string) => {
      activeFilters.push({
        key: `signalWords-${signalWord}`,
        label: "Advertência",
        value: GHS_SIGNAL_WORD_LABELS[signalWord as GHS_SIGNAL_WORD] || signalWord,
        iconType: "alert",
        itemId: signalWord,
        onRemove: () => onRemoveFilter("signalWords", signalWord),
      });
    });
  }

  // Pictogram filters
  if (filters.pictograms && Array.isArray(filters.pictograms) && filters.pictograms.length > 0) {
    filters.pictograms.forEach((pictogram: string) => {
      activeFilters.push({
        key: `pictograms-${pictogram}`,
        label: "Pictograma",
        value: GHS_PICTOGRAM_CODE_LABELS[pictogram as GHS_PICTOGRAM] || pictogram,
        iconType: "alert",
        itemId: pictogram,
        onRemove: () => onRemoveFilter("pictograms", pictogram),
      });
    });
  }

  // Category filters
  if (filters.categoryIds && Array.isArray(filters.categoryIds) && filters.categoryIds.length > 0) {
    filters.categoryIds.forEach((categoryId: string) => {
      const category = categories.find((c) => c.id === categoryId);
      activeFilters.push({
        key: `categoryIds-${categoryId}`,
        label: "Categoria",
        value: category?.name || "Categoria",
        iconType: "category",
        itemId: categoryId,
        onRemove: () => onRemoveFilter("categoryIds", categoryId),
      });
    });
  }

  // Only without PDF
  if (filters.hasPdf === false) {
    activeFilters.push({
      key: "hasPdf",
      label: "Documento",
      value: "Somente sem PDF",
      iconType: "pdf",
      onRemove: () => onRemoveFilter("hasPdf"),
    });
  }

  // Expiring in N days
  if (typeof filters.expiringInDays === "number") {
    activeFilters.push({
      key: "expiringInDays",
      label: "Vencimento",
      value: filters.expiringInDays === 0 ? "Vencidas" : `Vencendo em ${filters.expiringInDays} dias`,
      iconType: "calendar",
      onRemove: () => onRemoveFilter("expiringInDays"),
    });
  }

  return activeFilters;
}

export function createFilterRemover(currentFilters: FispqFilters, onFilterChange: (filters: FispqFilters) => void) {
  return (key: string, itemId?: string) => {
    const newFilters: any = { ...currentFilters };

    const removeFromArray = (field: "statuses" | "signalWords" | "pictograms" | "categoryIds" | "itemIds") => {
      if (itemId && Array.isArray(newFilters[field])) {
        const filtered = newFilters[field].filter((value: string) => value !== itemId);
        if (filtered.length > 0) {
          newFilters[field] = filtered;
        } else {
          delete newFilters[field];
        }
      } else {
        delete newFilters[field];
      }
    };

    switch (key) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;
      case "statuses":
        removeFromArray("statuses");
        break;
      case "signalWords":
        removeFromArray("signalWords");
        break;
      case "pictograms":
        removeFromArray("pictograms");
        break;
      case "categoryIds":
        removeFromArray("categoryIds");
        break;
      case "itemIds":
        removeFromArray("itemIds");
        break;
      case "hasPdf":
        delete newFilters.hasPdf;
        break;
      case "expiringInDays":
        delete newFilters.expiringInDays;
        break;
    }

    onFilterChange(newFilters);
  };
}
