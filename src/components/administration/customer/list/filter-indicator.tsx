import { FilterIndicators as StandardFilterIndicators, FilterIndicator as StandardFilterIndicator } from "@/components/ui/filter-indicator";
import { IconSearch, IconTags, IconMapPin, IconBuilding, IconCheck, IconX, IconCalendar, IconPhoto, IconClipboardList, IconBriefcase } from "@tabler/icons-react";

function renderFilterIcon(iconType?: string) {
  if (!iconType) return null;

  const iconProps = { className: "h-3 w-3" };

  switch (iconType) {
    case "search":
      return <IconSearch {...iconProps} />;
    case "tags":
      return <IconTags {...iconProps} />;
    case "map-pin":
      return <IconMapPin {...iconProps} />;
    case "building":
      return <IconBuilding {...iconProps} />;
    case "check":
      return <IconCheck {...iconProps} />;
    case "x":
      return <IconX {...iconProps} />;
    case "calendar":
      return <IconCalendar {...iconProps} />;
    case "photo":
      return <IconPhoto {...iconProps} />;
    case "image":
      return <IconPhoto {...iconProps} />;
    case "clipboard-list":
      return <IconClipboardList {...iconProps} />;
    case "briefcase":
      return <IconBriefcase {...iconProps} />;
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

  // Transform filters to match standardized component interface
  const transformedFilters = filters.map((filter) => ({
    key: filter.key,
    label: filter.label,
    value: filter.value,
    onRemove: filter.onRemove,
    icon: filter.iconType ? renderFilterIcon(filter.iconType) : undefined,
  }));

  return <StandardFilterIndicators filters={transformedFilters} onClearAll={onClearAll} className={className} />;
}
