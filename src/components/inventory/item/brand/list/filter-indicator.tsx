import React from "react";
import { FilterIndicators as StandardFilterIndicators } from "@/components/ui/filter-indicator";

export interface FilterIndicator {
  label: string;
  value: string;
  onRemove: () => void;
  icon?: React.ReactNode;
}

interface FilterIndicatorsProps {
  filters: FilterIndicator[];
  onClearAll: () => void;
  className?: string;
}

export function FilterIndicators({ filters, onClearAll, className }: FilterIndicatorsProps) {
  if (filters.length === 0) return null;

  // Transform the existing interface to match the standardized component
  const transformedFilters = filters.map((filter, index) => ({
    key: `${filter.label}-${index}`,
    label: filter.label,
    value: filter.value,
    onRemove: filter.onRemove,
    icon: filter.icon,
  }));

  return <StandardFilterIndicators filters={transformedFilters} onClearAll={onClearAll} className={className} />;
}
