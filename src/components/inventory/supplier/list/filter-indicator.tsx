import React from "react";
import { FilterIndicators as StandardFilterIndicators, FilterIndicator as StandardFilterIndicator } from "@/components/ui/filter-indicator";
import {
  IconSearch,
  IconShoppingCart,
  IconMapPin,
  IconPackages,
  IconCalendarPlus,
  IconId,
  IconMail,
  IconWorld,
  IconPhone,
  IconBuilding,
  IconEye,
  IconChartBar,
} from "@tabler/icons-react";

function renderFilterIcon(iconType?: string) {
  if (!iconType) return null;

  const iconProps = { className: "h-3 w-3" };

  switch (iconType) {
    case "search":
      return <IconSearch {...iconProps} />;
    case "shopping-cart":
      return <IconShoppingCart {...iconProps} />;
    case "map-pin":
      return <IconMapPin {...iconProps} />;
    case "packages":
      return <IconPackages {...iconProps} />;
    case "calendar-plus":
      return <IconCalendarPlus {...iconProps} />;
    case "id":
      return <IconId {...iconProps} />;
    case "mail":
      return <IconMail {...iconProps} />;
    case "world":
      return <IconWorld {...iconProps} />;
    case "phone":
      return <IconPhone {...iconProps} />;
    case "building":
      return <IconBuilding {...iconProps} />;
    case "eye":
      return <IconEye {...iconProps} />;
    case "chart-bar":
      return <IconChartBar {...iconProps} />;
    default:
      return null;
  }
}

interface FilterIndicatorProps {
  label: string;
  value: string;
  onRemove: () => void;
  className?: string;
  iconType?: string;
}

export function FilterIndicator({ label, value, onRemove, className, iconType }: FilterIndicatorProps) {
  return <StandardFilterIndicator label={label} value={value} onRemove={onRemove} icon={iconType ? renderFilterIcon(iconType) : undefined} className={className} />;
}

interface FilterIndicatorsProps {
  filters: Array<{
    id: string;
    label: string;
    value: string | string[] | boolean | number;
    onRemove: () => void;
    icon?: React.ReactNode;
  }>;
  onClearAll?: () => void;
  className?: string;
}

export function FilterIndicators({ filters, onClearAll, className }: FilterIndicatorsProps) {
  if (filters.length === 0) {
    return null;
  }

  // Transform filters to match standardized component interface
  const transformedFilters = filters.map((filter) => ({
    key: filter.id,
    label: filter.label,
    value: Array.isArray(filter.value) ? filter.value.join(", ") : String(filter.value),
    onRemove: filter.onRemove,
    icon: filter.icon, // Use the icon directly from the filter object
  }));

  return <StandardFilterIndicators filters={transformedFilters} onClearAll={onClearAll} className={className} />;
}
