import React from "react";
import type { ExternalWithdrawalGetManyFormData } from "../../../../schemas";
import { IconSearch, IconCalendar, IconFileText, IconReceipt, IconTags, IconArrowBack } from "@tabler/icons-react";
import { EXTERNAL_WITHDRAWAL_STATUS, EXTERNAL_WITHDRAWAL_STATUS_LABELS, EXTERNAL_WITHDRAWAL_TYPE, EXTERNAL_WITHDRAWAL_TYPE_LABELS } from "../../../../constants";

export interface FilterIndicator {
  id: string;
  label: string;
  value: string | string[] | boolean | number;
  onRemove: () => void;
  icon?: React.ReactNode;
}

export const extractActiveFilters = (filters: Partial<ExternalWithdrawalGetManyFormData>, onRemoveFilter: (filterKey: string, value?: any) => void): FilterIndicator[] => {
  const activeFilters: FilterIndicator[] = [];

  // Search filter
  if (filters.searchingFor && filters.searchingFor.trim()) {
    activeFilters.push({
      id: "searchingFor",
      label: "Buscar",
      value: filters.searchingFor,
      icon: <IconSearch className="h-3 w-3" />,
      onRemove: () => onRemoveFilter("searchingFor"),
    });
  }

  // Status filter
  if (filters.statuses && filters.statuses.length > 0) {
    activeFilters.push({
      id: "statuses",
      label: "Status",
      value: filters.statuses.map((status: EXTERNAL_WITHDRAWAL_STATUS) => EXTERNAL_WITHDRAWAL_STATUS_LABELS[status]).join(", "),
      icon: <IconTags className="h-3 w-3" />,
      onRemove: () => onRemoveFilter("statuses"),
    });
  }

  // Type filter
  if (filters.types && filters.types.length > 0) {
    activeFilters.push({
      id: "types",
      label: "Tipo",
      value: filters.types.map((type: EXTERNAL_WITHDRAWAL_TYPE) => EXTERNAL_WITHDRAWAL_TYPE_LABELS[type]).join(", "),
      icon: <IconArrowBack className="h-3 w-3" />,
      onRemove: () => onRemoveFilter("types"),
    });
  }

  // Has NFe filter
  if (typeof filters.hasNfe === "boolean") {
    activeFilters.push({
      id: "hasNfe",
      label: "NFe",
      value: filters.hasNfe ? "Com NFe" : "Sem NFe",
      icon: <IconFileText className="h-3 w-3" />,
      onRemove: () => onRemoveFilter("hasNfe"),
    });
  }

  // Has receipt filter
  if (typeof filters.hasReceipt === "boolean") {
    activeFilters.push({
      id: "hasReceipt",
      label: "Recibo",
      value: filters.hasReceipt ? "Com recibo" : "Sem recibo",
      icon: <IconReceipt className="h-3 w-3" />,
      onRemove: () => onRemoveFilter("hasReceipt"),
    });
  }

  // Date filters
  if (filters.createdAt) {
    const { gte, lte } = filters.createdAt;
    let dateText = "";

    if (gte && lte) {
      dateText = `${gte.toLocaleDateString("pt-BR")} - ${lte.toLocaleDateString("pt-BR")}`;
    } else if (gte) {
      dateText = `A partir de ${gte.toLocaleDateString("pt-BR")}`;
    } else if (lte) {
      dateText = `Até ${lte.toLocaleDateString("pt-BR")}`;
    }

    if (dateText) {
      activeFilters.push({
        id: "createdAt",
        label: "Criado em",
        value: dateText,
        icon: <IconCalendar className="h-3 w-3" />,
        onRemove: () => onRemoveFilter("createdAt"),
      });
    }
  }

  if (filters.returnedAt) {
    const { gte, lte } = filters.returnedAt;
    let dateText = "";

    if (gte && lte) {
      dateText = `${gte.toLocaleDateString("pt-BR")} - ${lte.toLocaleDateString("pt-BR")}`;
    } else if (gte) {
      dateText = `A partir de ${gte.toLocaleDateString("pt-BR")}`;
    } else if (lte) {
      dateText = `Até ${lte.toLocaleDateString("pt-BR")}`;
    }

    if (dateText) {
      activeFilters.push({
        id: "returnedAt",
        label: "Devolvido em",
        value: dateText,
        icon: <IconCalendar className="h-3 w-3" />,
        onRemove: () => onRemoveFilter("returnedAt"),
      });
    }
  }

  return activeFilters;
};

export const createFilterRemover = (filters: Partial<ExternalWithdrawalGetManyFormData>, onFilterChange: (filters: Partial<ExternalWithdrawalGetManyFormData>) => void) => {
  return (filterKey: string) => {
    const newFilters = { ...filters };

    switch (filterKey) {
      case "searchingFor":
        delete newFilters.searchingFor;
        break;
      case "statuses":
        delete newFilters.statuses;
        break;
      case "types":
        delete newFilters.types;
        break;
      case "hasNfe":
        delete newFilters.hasNfe;
        break;
      case "hasReceipt":
        delete newFilters.hasReceipt;
        break;
      case "createdAt":
        delete newFilters.createdAt;
        break;
      case "returnedAt":
        delete newFilters.returnedAt;
        break;
      default:
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`Unknown filter key: ${filterKey}`);
        }
    }

    onFilterChange(newFilters);
  };
};
