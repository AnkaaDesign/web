import type { MedicalExamGetManyFormData } from "@/schemas/medical-exam";
import { formatDate } from "../../../../utils";
import {
  MEDICAL_EXAM_TYPE_LABELS,
  MEDICAL_EXAM_STATUS_LABELS,
  MEDICAL_EXAM_RESULT_LABELS,
} from "../../../../constants";
import type { MEDICAL_EXAM_TYPE, MEDICAL_EXAM_STATUS, MEDICAL_EXAM_RESULT } from "../../../../constants";

export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
  itemId?: string;
  iconType?: string;
}

interface FilterUtilsOptions {
  users?: Array<{ id: string; name: string }>;
}

function formatDateRange(range: { gte?: Date; lte?: Date }): string {
  const { gte, lte } = range;
  if (gte && lte) return `${formatDate(gte)} - ${formatDate(lte)}`;
  if (gte) return `≥ ${formatDate(gte)}`;
  if (lte) return `≤ ${formatDate(lte)}`;
  return "";
}

export function extractActiveFilters(
  filters: Partial<MedicalExamGetManyFormData>,
  onRemoveFilter: (key: string, itemId?: string) => void,
  options: FilterUtilsOptions = {},
): FilterIndicator[] {
  const activeFilters: FilterIndicator[] = [];
  const { users = [] } = options;

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

  // Type filters
  if (filters.types && Array.isArray(filters.types) && filters.types.length > 0) {
    filters.types.forEach((type: string) => {
      activeFilters.push({
        key: `types-${type}`,
        label: "Tipo",
        value: MEDICAL_EXAM_TYPE_LABELS[type as MEDICAL_EXAM_TYPE] || type,
        iconType: "user",
        itemId: type,
        onRemove: () => onRemoveFilter("types", type),
      });
    });
  }

  // Status filters
  if (filters.statuses && Array.isArray(filters.statuses) && filters.statuses.length > 0) {
    filters.statuses.forEach((status: string) => {
      activeFilters.push({
        key: `statuses-${status}`,
        label: "Status",
        value: MEDICAL_EXAM_STATUS_LABELS[status as MEDICAL_EXAM_STATUS] || status,
        iconType: "shield",
        itemId: status,
        onRemove: () => onRemoveFilter("statuses", status),
      });
    });
  }

  // Result filters
  if (filters.results && Array.isArray(filters.results) && filters.results.length > 0) {
    filters.results.forEach((result: string) => {
      activeFilters.push({
        key: `results-${result}`,
        label: "Resultado",
        value: MEDICAL_EXAM_RESULT_LABELS[result as MEDICAL_EXAM_RESULT] || result,
        iconType: "shield-check",
        itemId: result,
        onRemove: () => onRemoveFilter("results", result),
      });
    });
  }

  // User filters
  if (filters.userIds && Array.isArray(filters.userIds) && filters.userIds.length > 0) {
    filters.userIds.forEach((userId: string) => {
      const user = users.find((u) => u.id === userId);
      activeFilters.push({
        key: `userIds-${userId}`,
        label: "Colaborador",
        value: user?.name || "Colaborador",
        iconType: "user",
        itemId: userId,
        onRemove: () => onRemoveFilter("userIds", userId),
      });
    });
  }

  // Scheduled date range
  if (filters.scheduledAt?.gte || filters.scheduledAt?.lte) {
    activeFilters.push({
      key: "scheduledAt",
      label: "Agendado para",
      value: formatDateRange(filters.scheduledAt),
      iconType: "calendar",
      onRemove: () => onRemoveFilter("scheduledAt"),
    });
  }

  // Exam date range
  if (filters.examDate?.gte || filters.examDate?.lte) {
    activeFilters.push({
      key: "examDate",
      label: "Data do Exame",
      value: formatDateRange(filters.examDate),
      iconType: "calendar",
      onRemove: () => onRemoveFilter("examDate"),
    });
  }

  return activeFilters;
}

export function createFilterRemover(
  currentFilters: Partial<MedicalExamGetManyFormData>,
  onFilterChange: (filters: Partial<MedicalExamGetManyFormData>) => void,
) {
  return (key: string, itemId?: string) => {
    const newFilters: any = { ...currentFilters };

    const removeFromArray = (field: "types" | "statuses" | "results" | "userIds") => {
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
      case "types":
        removeFromArray("types");
        break;
      case "statuses":
        removeFromArray("statuses");
        break;
      case "results":
        removeFromArray("results");
        break;
      case "userIds":
        removeFromArray("userIds");
        break;
      case "scheduledAt":
        delete newFilters.scheduledAt;
        break;
      case "examDate":
        delete newFilters.examDate;
        break;
    }

    onFilterChange(newFilters);
  };
}
