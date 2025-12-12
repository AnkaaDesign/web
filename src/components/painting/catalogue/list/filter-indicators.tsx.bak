import { FilterIndicators as StandardFilterIndicators, FilterIndicator as StandardFilterIndicator } from "@/components/ui/filter-indicator";
import { IconSearch, IconTags, IconPaint, IconBrush, IconTruck, IconHash, IconFlask, IconCalendar } from "@tabler/icons-react";

function renderFilterIcon(iconType?: string) {
  if (!iconType) return null;

  const iconProps = { className: "h-3 w-3" };

  switch (iconType) {
    case "search":
      return <IconSearch {...iconProps} />;
    case "paint":
      return <IconPaint {...iconProps} />;
    case "brush":
      return <IconBrush {...iconProps} />;
    case "tags":
      return <IconTags {...iconProps} />;
    case "truck":
      return <IconTruck {...iconProps} />;
    case "hash":
      return <IconHash {...iconProps} />;
    case "flask":
      return <IconFlask {...iconProps} />;
    case "calendar":
      return <IconCalendar {...iconProps} />;
    default:
      return null;
  }
}

export interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
  icon?: React.ReactNode;
}

interface FilterIndicatorsProps {
  filters: FilterIndicator[];
  onClearAll?: () => void;
  className?: string;
}

export function FilterIndicators({ filters, onClearAll, className }: FilterIndicatorsProps) {
  if (filters.length === 0) {
    return null;
  }

  // Transform filters to match standardized component interface
  const transformedFilters = filters.map((filter) => ({
    key: filter.key,
    label: filter.label,
    value: filter.value,
    onRemove: filter.onRemove,
    icon: filter.icon,
  }));

  return <StandardFilterIndicators filters={transformedFilters} onClearAll={onClearAll} className={className} />;
}

export function FilterIndicator({ label, value, onRemove, icon, className }: { label: string; value: string; onRemove: () => void; icon?: React.ReactNode; className?: string }) {
  return <StandardFilterIndicator label={label} value={value} onRemove={onRemove} icon={icon} className={className} />;
}
