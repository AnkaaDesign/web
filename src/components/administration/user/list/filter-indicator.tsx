import { FilterIndicators as StandardFilterIndicators, FilterIndicator as StandardFilterIndicator } from "@/components/ui/filter-indicator";
import { IconSearch, IconUser, IconBriefcase, IconBuilding, IconShield, IconCurrencyDollar, IconShieldCheck, IconKey, IconCalendar } from "@tabler/icons-react";

function renderFilterIcon(iconType?: string) {
  if (!iconType) return null;

  const iconProps = { className: "h-3 w-3" };

  switch (iconType) {
    case "search":
      return <IconSearch {...iconProps} />;
    case "user":
      return <IconUser {...iconProps} />;
    case "briefcase":
      return <IconBriefcase {...iconProps} />;
    case "building":
      return <IconBuilding {...iconProps} />;
    case "shield":
      return <IconShield {...iconProps} />;
    case "currency-dollar":
      return <IconCurrencyDollar {...iconProps} />;
    case "shield-check":
      return <IconShieldCheck {...iconProps} />;
    case "key":
      return <IconKey {...iconProps} />;
    case "calendar":
      return <IconCalendar {...iconProps} />;
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
