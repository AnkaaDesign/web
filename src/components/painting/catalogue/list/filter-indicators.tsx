import { FilterIndicators as StandardFilterIndicators, FilterIndicator as StandardFilterIndicator } from "@/components/ui/filter-indicator";

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
