import {
  FilterIndicators as StandardFilterIndicators,
  FilterIndicator as StandardFilterIndicator,
} from "@/components/ui/filter-indicator";
import {
  IconSearch,
  IconScissors,
  IconChartBar,
  IconTarget,
  IconCalendar,
} from "@tabler/icons-react";
import type { FilterTag } from "./filter-utils";

function renderFilterIcon(iconType?: string) {
  if (!iconType) return null;

  const iconProps = { className: "h-3 w-3" };

  switch (iconType) {
    case "search":
      return <IconSearch {...iconProps} />;
    case "chart-bar":
      return <IconChartBar {...iconProps} />;
    case "scissors":
      return <IconScissors {...iconProps} />;
    case "calendar":
      return <IconCalendar {...iconProps} />;
    case "target":
      return <IconTarget {...iconProps} />;
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

export function FilterIndicator({
  label,
  value,
  onRemove,
  className,
  iconType,
}: FilterIndicatorProps) {
  return (
    <StandardFilterIndicator
      label={label}
      value={value}
      onRemove={onRemove}
      icon={iconType ? renderFilterIcon(iconType) : undefined}
      className={className}
    />
  );
}

interface FilterIndicatorsProps {
  filters: FilterTag[];
  onClearAll: () => void;
  className?: string;
}

export function FilterIndicators({ filters, onClearAll, className }: FilterIndicatorsProps) {
  if (filters.length === 0) {
    return null;
  }

  // Transform filters to match standardized component interface
  const transformedFilters = filters.map((filter, index) => ({
    key: `${filter.key}-${filter.value}-${index}`,
    label: filter.label,
    value: filter.displayValue,
    onRemove: filter.onRemove,
    icon: getIconForFilter(filter.key, filter.value),
  }));

  return (
    <StandardFilterIndicators
      filters={transformedFilters}
      onClearAll={onClearAll}
      className={className}
    />
  );
}

// Helper function to determine icon based on filter type
function getIconForFilter(key: string, _value: any): React.ReactNode | undefined {
  switch (key) {
    case "searchingFor":
      return renderFilterIcon("search");
    case "status":
      return renderFilterIcon("chart-bar");
    case "type":
      return renderFilterIcon("scissors");
    case "origin":
      return renderFilterIcon("target");
    case "createdAt":
      return renderFilterIcon("calendar");
    default:
      return renderFilterIcon("target");
  }
}
