import React from "react";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { IconSearch, IconClipboard, IconCalendar, IconArrowsSort } from "@tabler/icons-react";
import type { ServiceGetManyFormData } from "../../../../schemas";
import { formatDate } from "../../../../utils";

interface ServiceFilterIndicatorProps {
  filters: Partial<ServiceGetManyFormData>;
  searchingFor?: string;
  onRemoveFilter: (newFilters: Partial<ServiceGetManyFormData>, searchingFor?: string) => void;
}

export const ServiceFilterIndicator = ({ filters, searchingFor, onRemoveFilter }: ServiceFilterIndicatorProps) => {
  const activeFilters: Array<{
    key: string;
    label: string;
    value: string;
    onRemove: () => void;
    icon?: React.ReactNode;
  }> = [];

  // Search filter
  if (searchingFor) {
    activeFilters.push({
      key: "searchingFor",
      label: "Buscar",
      value: `"${searchingFor}"`,
      icon: <IconSearch className="h-3 w-3" />,
      onRemove: () => onRemoveFilter(filters, ""),
    });
  }

  // Order by filter (only show if not default)
  if (filters.orderBy) {
    const field = Object.keys(filters.orderBy)[0];
    const direction = filters.orderBy[field as keyof typeof filters.orderBy];

    // Only show if not the default ordering (description asc)
    if (!(field === "description" && direction === "asc")) {
      let orderLabel = "";
      if (field === "description") {
        orderLabel = direction === "asc" ? "Descrição (A-Z)" : "Descrição (Z-A)";
      } else if (field === "createdAt") {
        orderLabel = direction === "desc" ? "Data de Criação (Mais Recente)" : "Data de Criação (Mais Antiga)";
      } else if (field === "updatedAt") {
        orderLabel = direction === "desc" ? "Última Atualização (Mais Recente)" : "Última Atualização (Mais Antiga)";
      }

      if (orderLabel) {
        activeFilters.push({
          key: "orderBy",
          label: "Ordenação",
          value: orderLabel,
          icon: <IconArrowsSort className="h-3 w-3" />,
          onRemove: () => {
            const newFilters = { ...filters, orderBy: { description: "asc" } };
            onRemoveFilter(newFilters, searchingFor);
          },
        });
      }
    }
  }

  // Page size filter (only show if not default)
  if (filters.take && filters.take !== 20) {
    activeFilters.push({
      key: "take",
      label: "Itens por página",
      value: filters.take.toString(),
      icon: <IconClipboard className="h-3 w-3" />,
      onRemove: () => {
        const newFilters = { ...filters, take: 20 };
        onRemoveFilter(newFilters, searchingFor);
      },
    });
  }

  // Created date filter
  if (filters.createdAt) {
    const { gte, lte } = filters.createdAt;
    if (gte && lte) {
      activeFilters.push({
        key: "createdAt",
        label: "Criado em",
        value: `${formatDate(gte)} - ${formatDate(lte)}`,
        icon: <IconCalendar className="h-3 w-3" />,
        onRemove: () => {
          const newFilters = { ...filters };
          delete newFilters.createdAt;
          onRemoveFilter(newFilters, searchingFor);
        },
      });
    } else if (gte) {
      activeFilters.push({
        key: "createdAt",
        label: "Criado após",
        value: formatDate(gte),
        icon: <IconCalendar className="h-3 w-3" />,
        onRemove: () => {
          const newFilters = { ...filters };
          delete newFilters.createdAt;
          onRemoveFilter(newFilters, searchingFor);
        },
      });
    } else if (lte) {
      activeFilters.push({
        key: "createdAt",
        label: "Criado antes",
        value: formatDate(lte),
        icon: <IconCalendar className="h-3 w-3" />,
        onRemove: () => {
          const newFilters = { ...filters };
          delete newFilters.createdAt;
          onRemoveFilter(newFilters, searchingFor);
        },
      });
    }
  }

  // Updated date filter
  if (filters.updatedAt) {
    const { gte, lte } = filters.updatedAt;
    if (gte && lte) {
      activeFilters.push({
        key: "updatedAt",
        label: "Atualizado em",
        value: `${formatDate(gte)} - ${formatDate(lte)}`,
        icon: <IconCalendar className="h-3 w-3" />,
        onRemove: () => {
          const newFilters = { ...filters };
          delete newFilters.updatedAt;
          onRemoveFilter(newFilters, searchingFor);
        },
      });
    } else if (gte) {
      activeFilters.push({
        key: "updatedAt",
        label: "Atualizado após",
        value: formatDate(gte),
        icon: <IconCalendar className="h-3 w-3" />,
        onRemove: () => {
          const newFilters = { ...filters };
          delete newFilters.updatedAt;
          onRemoveFilter(newFilters, searchingFor);
        },
      });
    } else if (lte) {
      activeFilters.push({
        key: "updatedAt",
        label: "Atualizado antes",
        value: formatDate(lte),
        icon: <IconCalendar className="h-3 w-3" />,
        onRemove: () => {
          const newFilters = { ...filters };
          delete newFilters.updatedAt;
          onRemoveFilter(newFilters, searchingFor);
        },
      });
    }
  }

  const handleClearAll = () => {
    // Reset to default filters
    onRemoveFilter(
      {
        orderBy: { description: "asc" },
        take: 20,
      },
      "",
    );
  };

  return <FilterIndicators filters={activeFilters} onClearAll={handleClearAll} />;
};
