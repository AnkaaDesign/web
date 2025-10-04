import React from "react";
import { FilterIndicators as StandardFilterIndicators } from "@/components/ui/filter-indicator";
import { IconSearch, IconTrendingUp, IconTrendingDown, IconFileText, IconUsers, IconUser, IconPackage, IconCalculator, IconCalendar } from "@tabler/icons-react";

export interface FilterIndicator {
  label: string;
  value: string;
  onRemove: () => void;
  icon?: React.ReactNode;
  iconType?: "search" | "trending-up" | "trending-down" | "file-text" | "users" | "user" | "package" | "calculator" | "calendar";
}

interface FilterIndicatorsProps {
  filters: FilterIndicator[];
  onClearAll: () => void;
  className?: string;
}

// Icon mapping function
const getIconForType = (iconType?: string): React.ReactNode => {
  switch (iconType) {
    case "search":
      return <IconSearch className="h-3 w-3" />;
    case "trending-up":
      return <IconTrendingUp className="h-3 w-3" />;
    case "trending-down":
      return <IconTrendingDown className="h-3 w-3" />;
    case "file-text":
      return <IconFileText className="h-3 w-3" />;
    case "users":
      return <IconUsers className="h-3 w-3" />;
    case "user":
      return <IconUser className="h-3 w-3" />;
    case "package":
      return <IconPackage className="h-3 w-3" />;
    case "calculator":
      return <IconCalculator className="h-3 w-3" />;
    case "calendar":
      return <IconCalendar className="h-3 w-3" />;
    default:
      return undefined;
  }
};

export function FilterIndicators({ filters, onClearAll, className }: FilterIndicatorsProps) {
  if (filters.length === 0) return null;

  // Transform the existing interface to match the standardized component
  const transformedFilters = filters.map((filter, index) => ({
    key: `${filter.label}-${index}`,
    label: filter.label,
    value: filter.value,
    onRemove: filter.onRemove,
    icon: filter.icon || getIconForType(filter.iconType),
  }));

  return <StandardFilterIndicators filters={transformedFilters} onClearAll={onClearAll} className={className} />;
}
