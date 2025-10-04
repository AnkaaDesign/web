import { FilterIndicators as StandardFilterIndicators, FilterIndicator as StandardFilterIndicator } from "@/components/ui/filter-indicator";
import { IconSearch, IconTags, IconCalendar, IconFileText, IconReceipt, IconCheck, IconX } from "@tabler/icons-react";

function renderFilterIcon(iconType?: string) {
  if (!iconType) return null;

  const iconProps = { className: "h-3 w-3" };

  switch (iconType) {
    case "search":
      return <IconSearch {...iconProps} />;
    case "tags":
      return <IconTags {...iconProps} />;
    case "calendar":
      return <IconCalendar {...iconProps} />;
    case "file-text":
      return <IconFileText {...iconProps} />;
    case "receipt":
      return <IconReceipt {...iconProps} />;
    case "check":
      return <IconCheck {...iconProps} />;
    case "x":
      return <IconX {...iconProps} />;
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
    value: String(filter.value || ""),
    onRemove: filter.onRemove,
    icon: filter.icon,
  }));

  return <StandardFilterIndicators filters={transformedFilters} onClearAll={onClearAll} className={className} />;
}
