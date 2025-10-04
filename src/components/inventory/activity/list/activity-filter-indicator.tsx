import React from "react";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import {
  IconSearch,
  IconTrendingUp,
  IconTrendingDown,
  IconFileText,
  IconUser,
  IconCalculator,
  IconCalendar,
  IconUsers,
  IconPackage,
  IconTag,
  IconBuilding,
} from "@tabler/icons-react";
import type { ActivityGetManyFormData } from "../../../../schemas";
import { ACTIVITY_OPERATION_LABELS, ACTIVITY_REASON_LABELS, ACTIVITY_OPERATION } from "../../../../constants";
import { formatDate } from "../../../../utils";

interface ActivityFilterIndicatorProps {
  filters: Partial<ActivityGetManyFormData>;
  onRemoveFilter: (newFilters: Partial<ActivityGetManyFormData>) => void;
}

export const ActivityFilterIndicator = ({ filters, onRemoveFilter }: ActivityFilterIndicatorProps) => {
  const activeFilters: Array<{
    key: string;
    label: string;
    value: string;
    onRemove: () => void;
    icon?: React.ReactNode;
  }> = [];

  // Search filter
  if (filters.searchingFor) {
    activeFilters.push({
      key: "searchingFor",
      label: "Buscar",
      value: filters.searchingFor,
      icon: <IconSearch className="h-3 w-3" />,
      onRemove: () => {
        const newFilters = { ...filters };
        delete newFilters.searchingFor;
        onRemoveFilter(newFilters);
      },
    });
  }

  // Operations filters
  if (filters.operations?.length) {
    filters.operations.forEach((operation: string) => {
      const operationIcon = operation === ACTIVITY_OPERATION.INBOUND ? <IconTrendingUp className="h-3 w-3" /> : <IconTrendingDown className="h-3 w-3" />;

      activeFilters.push({
        key: `operation-${operation}`,
        label: "Operação",
        value: ACTIVITY_OPERATION_LABELS[operation as keyof typeof ACTIVITY_OPERATION_LABELS] || operation,
        icon: operationIcon,
        onRemove: () => {
          const newFilters = { ...filters };
          newFilters.operations = filters.operations?.filter((op: string) => op !== operation);
          if (!newFilters.operations?.length) {
            delete newFilters.operations;
          }
          onRemoveFilter(newFilters);
        },
      });
    });
  }

  // Reasons filters
  if (filters.reasons?.length) {
    filters.reasons.forEach((reason: string) => {
      activeFilters.push({
        key: `reason-${reason}`,
        label: "Motivo",
        value: ACTIVITY_REASON_LABELS[reason as keyof typeof ACTIVITY_REASON_LABELS] || reason,
        icon: <IconFileText className="h-3 w-3" />,
        onRemove: () => {
          const newFilters = { ...filters };
          newFilters.reasons = filters.reasons?.filter((r: string) => r !== reason);
          if (!newFilters.reasons?.length) {
            delete newFilters.reasons;
          }
          onRemoveFilter(newFilters);
        },
      });
    });
  }

  // User presence filter
  if (filters.hasUser !== undefined) {
    activeFilters.push({
      key: "hasUser",
      label: "Usuário",
      value: filters.hasUser ? "Com usuário" : "Sem usuário",
      icon: <IconUser className="h-3 w-3" />,
      onRemove: () => {
        const newFilters = { ...filters };
        delete newFilters.hasUser;
        onRemoveFilter(newFilters);
      },
    });
  }

  // Quantity range filter
  if (filters.quantityRange) {
    const { min, max } = filters.quantityRange;
    let value: string;
    if (min !== undefined && max !== undefined) {
      value = `${min} - ${max}`;
    } else if (min !== undefined) {
      value = `≥ ${min}`;
    } else if (max !== undefined) {
      value = `≤ ${max}`;
    } else {
      value = "";
    }

    if (value) {
      activeFilters.push({
        key: "quantityRange",
        label: "Quantidade",
        value,
        icon: <IconCalculator className="h-3 w-3" />,
        onRemove: () => {
          const newFilters = { ...filters };
          delete newFilters.quantityRange;
          onRemoveFilter(newFilters);
        },
      });
    }
  }

  // Date range filter
  if (filters.createdAt) {
    const { gte, lte } = filters.createdAt;
    let label: string;
    let value: string;

    if (gte && lte) {
      label = "Criado em";
      value = `${formatDate(gte)} - ${formatDate(lte)}`;
    } else if (gte) {
      label = "Criado após";
      value = formatDate(gte);
    } else if (lte) {
      label = "Criado antes";
      value = formatDate(lte);
    } else {
      label = "";
      value = "";
    }

    if (value) {
      activeFilters.push({
        key: "createdAt",
        label,
        value,
        icon: <IconCalendar className="h-3 w-3" />,
        onRemove: () => {
          const newFilters = { ...filters };
          delete newFilters.createdAt;
          onRemoveFilter(newFilters);
        },
      });
    }
  }

  // Users filter
  if (filters.userIds?.length) {
    activeFilters.push({
      key: "userIds",
      label: "Usuários",
      value: `${filters.userIds.length} selecionado(s)`,
      icon: <IconUsers className="h-3 w-3" />,
      onRemove: () => {
        const newFilters = { ...filters };
        delete newFilters.userIds;
        onRemoveFilter(newFilters);
      },
    });
  }

  // Items filter
  if (filters.itemIds?.length) {
    activeFilters.push({
      key: "itemIds",
      label: "Itens",
      value: `${filters.itemIds.length} selecionado(s)`,
      icon: <IconPackage className="h-3 w-3" />,
      onRemove: () => {
        const newFilters = { ...filters };
        delete newFilters.itemIds;
        onRemoveFilter(newFilters);
      },
    });
  }

  // Brands filter
  if (filters.brandIds?.length) {
    activeFilters.push({
      key: "brandIds",
      label: "Marcas",
      value: `${filters.brandIds.length} selecionada(s)`,
      icon: <IconTag className="h-3 w-3" />,
      onRemove: () => {
        const newFilters = { ...filters };
        delete newFilters.brandIds;
        onRemoveFilter(newFilters);
      },
    });
  }

  // Categories filter
  if (filters.categoryIds?.length) {
    activeFilters.push({
      key: "categoryIds",
      label: "Categorias",
      value: `${filters.categoryIds.length} selecionada(s)`,
      icon: <IconTag className="h-3 w-3" />,
      onRemove: () => {
        const newFilters = { ...filters };
        delete newFilters.categoryIds;
        onRemoveFilter(newFilters);
      },
    });
  }

  // Suppliers filter
  if (filters.supplierIds?.length) {
    activeFilters.push({
      key: "supplierIds",
      label: "Fornecedores",
      value: `${filters.supplierIds.length} selecionado(s)`,
      icon: <IconBuilding className="h-3 w-3" />,
      onRemove: () => {
        const newFilters = { ...filters };
        delete newFilters.supplierIds;
        onRemoveFilter(newFilters);
      },
    });
  }

  const handleClearAll = () => {
    onRemoveFilter({});
  };

  return <FilterIndicators filters={activeFilters} onClearAll={handleClearAll} />;
};
