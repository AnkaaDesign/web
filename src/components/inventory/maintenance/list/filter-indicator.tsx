import { FilterIndicators as StandardFilterIndicators } from "@/components/ui/filter-indicator";
import {
  IconSearch,
  IconCircleDot,
  IconClock,
  IconClockPause,
  IconAlertTriangle,
  IconPackage,
  IconCalendar,
  IconCalendarPlus,
  IconCalendarCheck,
  IconTool,
} from "@tabler/icons-react";
import type { FilterIndicator } from "./filter-utils";

const getIcon = (iconType?: string) => {
  switch (iconType) {
    case "search":
      return <IconSearch className="h-3 w-3" />;
    case "circle-dot":
      return <IconCircleDot className="h-3 w-3" />;
    case "clock":
      return <IconClock className="h-3 w-3" />;
    case "clock-pause":
      return <IconClockPause className="h-3 w-3" />;
    case "alert-triangle":
      return <IconAlertTriangle className="h-3 w-3" />;
    case "package":
      return <IconPackage className="h-3 w-3" />;
    case "calendar":
      return <IconCalendar className="h-3 w-3" />;
    case "calendar-plus":
      return <IconCalendarPlus className="h-3 w-3" />;
    case "calendar-edit":
      return <IconCalendarCheck className="h-3 w-3" />;
    case "tool":
      return <IconTool className="h-3 w-3" />;
    default:
      return null;
  }
};

interface FilterIndicatorsProps {
  filters: FilterIndicator[];
  onClearAll: () => void;
  className?: string;
}

export function FilterIndicators({ filters, onClearAll, className }: FilterIndicatorsProps) {
  if (filters.length === 0) return null;

  // Transform filters to match standardized component interface
  const transformedFilters = filters.map((filter, index) => ({
    key: `${filter.key}-${filter.itemId || index}`,
    label: filter.label,
    value: filter.value,
    onRemove: filter.onRemove,
    icon: getIcon(filter.iconType),
  }));

  return <StandardFilterIndicators filters={transformedFilters} onClearAll={onClearAll} className={className} />;
}
