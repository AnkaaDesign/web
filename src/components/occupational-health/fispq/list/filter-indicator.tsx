import { FilterIndicators as StandardFilterIndicators } from "@/components/ui/filter-indicator";
import { IconSearch, IconFlask, IconAlertTriangle, IconShield, IconCalendarDue, IconFileTypePdf, IconCategory } from "@tabler/icons-react";

function renderFilterIcon(iconType?: string) {
  if (!iconType) return null;

  const iconProps = { className: "h-3 w-3" };

  switch (iconType) {
    case "search":
      return <IconSearch {...iconProps} />;
    case "flask":
      return <IconFlask {...iconProps} />;
    case "alert":
      return <IconAlertTriangle {...iconProps} />;
    case "shield":
      return <IconShield {...iconProps} />;
    case "calendar":
      return <IconCalendarDue {...iconProps} />;
    case "pdf":
      return <IconFileTypePdf {...iconProps} />;
    case "category":
      return <IconCategory {...iconProps} />;
    default:
      return null;
  }
}

interface FilterIndicatorsProps {
  filters: Array<{
    key: string;
    label: string;
    value: string;
    onRemove: () => void;
    iconType?: string;
  }>;
  onClearAll?: () => void;
  className?: string;
}

export function FilterIndicators({ filters, onClearAll, className }: FilterIndicatorsProps) {
  if (filters.length === 0) {
    return null;
  }

  const transformedFilters = filters.map((filter) => ({
    key: filter.key,
    label: filter.label,
    value: filter.value,
    onRemove: filter.onRemove,
    icon: filter.iconType ? renderFilterIcon(filter.iconType) : undefined,
  }));

  return <StandardFilterIndicators filters={transformedFilters} onClearAll={onClearAll} className={className} />;
}
