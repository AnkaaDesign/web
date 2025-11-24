import type { CutGetManyFormData } from "../../../../schemas";
import { CUT_STATUS_LABELS, CUT_TYPE_LABELS, CUT_ORIGIN_LABELS } from "../../../../constants";

// Special value for tasks without a sector
const UNDEFINED_SECTOR_VALUE = "__UNDEFINED__";

export interface FilterTag {
  key: string;
  label: string;
  value: any;
  displayValue: string;
  onRemove: () => void;
}

// Helper to create filter remover function
export const createFilterRemover = (
  filters: Partial<CutGetManyFormData>,
  onFilterChange: (filters: Partial<CutGetManyFormData>) => void,
) => {
  return (key: string, value?: any) => {
    const newFilters = { ...filters };

    switch (key) {
      // Status filter (array in where clause)
      case "status":
        if (newFilters.where?.status && value) {
          const currentStatuses = (newFilters.where.status as any).in || [];
          const updatedStatuses = currentStatuses.filter((s: string) => s !== value);

          if (updatedStatuses.length === 0) {
            delete newFilters.where.status;
          } else {
            newFilters.where.status = { in: updatedStatuses } as any;
          }

          // Clean up empty where
          if (Object.keys(newFilters.where || {}).length === 0) {
            delete newFilters.where;
          }
        }
        break;

      // Type filter (array in where clause)
      case "type":
        if (newFilters.where?.type && value) {
          const currentTypes = (newFilters.where.type as any).in || [];
          const updatedTypes = currentTypes.filter((t: string) => t !== value);

          if (updatedTypes.length === 0) {
            delete newFilters.where.type;
          } else {
            newFilters.where.type = { in: updatedTypes } as any;
          }

          // Clean up empty where
          if (Object.keys(newFilters.where || {}).length === 0) {
            delete newFilters.where;
          }
        }
        break;

      // Origin filter
      case "origin":
        if (newFilters.where?.origin) {
          delete newFilters.where.origin;

          // Clean up empty where
          if (Object.keys(newFilters.where || {}).length === 0) {
            delete newFilters.where;
          }
        }
        break;

      // Date range filters
      case "createdAt":
        delete newFilters.createdAt;
        break;

      // Sector filter (through task relationship)
      case "sector":
        if (newFilters.where?.task?.sectorId) {
          delete newFilters.where.task;
          // Clean up empty where
          if (Object.keys(newFilters.where || {}).length === 0) {
            delete newFilters.where;
          }
        }
        // Handle OR clause for combined undefined + specific sectors
        if (newFilters.where?.OR) {
          delete newFilters.where.OR;
          if (Object.keys(newFilters.where || {}).length === 0) {
            delete newFilters.where;
          }
        }
        break;

      default:
        break;
    }

    onFilterChange(newFilters);
  };
};

// Helper to build filter tags from active filters
export const buildFilterTags = (
  filters: Partial<CutGetManyFormData>,
  onFilterChange: (filters: Partial<CutGetManyFormData>) => void,
): FilterTag[] => {
  const tags: FilterTag[] = [];
  const removeFilter = createFilterRemover(filters, onFilterChange);

  // Status filters
  const statuses = (filters.where?.status as any)?.in || [];
  statuses.forEach((status: string) => {
    tags.push({
      key: "status",
      label: "Status",
      value: status,
      displayValue: CUT_STATUS_LABELS[status as keyof typeof CUT_STATUS_LABELS] || status,
      onRemove: () => removeFilter("status", status),
    });
  });

  // Type filters
  const types = (filters.where?.type as any)?.in || [];
  types.forEach((type: string) => {
    tags.push({
      key: "type",
      label: "Tipo",
      value: type,
      displayValue: CUT_TYPE_LABELS[type as keyof typeof CUT_TYPE_LABELS] || type,
      onRemove: () => removeFilter("type", type),
    });
  });

  // Origin filter
  if (filters.where?.origin) {
    const origin = filters.where.origin;
    tags.push({
      key: "origin",
      label: "Origem",
      value: origin,
      displayValue: CUT_ORIGIN_LABELS[origin as keyof typeof CUT_ORIGIN_LABELS] || String(origin),
      onRemove: () => removeFilter("origin"),
    });
  }

  // Sector filter (through task relationship)
  // Check for direct task.sectorId filter
  if (filters.where?.task?.sectorId !== undefined) {
    if (filters.where.task.sectorId === null) {
      tags.push({
        key: "sector",
        label: "Setor",
        value: UNDEFINED_SECTOR_VALUE,
        displayValue: "Indefinido (sem setor)",
        onRemove: () => removeFilter("sector"),
      });
    } else if ((filters.where.task.sectorId as any)?.in) {
      tags.push({
        key: "sector",
        label: "Setor",
        value: (filters.where.task.sectorId as any).in,
        displayValue: `${(filters.where.task.sectorId as any).in.length} setor(es)`,
        onRemove: () => removeFilter("sector"),
      });
    }
  }
  // Check for OR clause (undefined + specific sectors combined)
  if (filters.where?.OR) {
    tags.push({
      key: "sector",
      label: "Setor",
      value: "mixed",
      displayValue: "Múltiplos setores",
      onRemove: () => removeFilter("sector"),
    });
  }

  // Created date range
  if (filters.createdAt?.gte || filters.createdAt?.lte) {
    const formatDate = (date: Date) => {
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date);
    };

    let displayValue = "";
    if (filters.createdAt.gte && filters.createdAt.lte) {
      displayValue = `${formatDate(filters.createdAt.gte)} - ${formatDate(filters.createdAt.lte)}`;
    } else if (filters.createdAt.gte) {
      displayValue = `Após ${formatDate(filters.createdAt.gte)}`;
    } else if (filters.createdAt.lte) {
      displayValue = `Antes de ${formatDate(filters.createdAt.lte)}`;
    }

    tags.push({
      key: "createdAt",
      label: "Data de criação",
      value: filters.createdAt,
      displayValue,
      onRemove: () => removeFilter("createdAt"),
    });
  }

  return tags;
};
