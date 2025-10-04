import { FilterIndicators as StandardFilterIndicators, FilterIndicator as StandardFilterIndicator } from "@/components/ui/filter-indicator";
import {
  IconSearch,
  IconChartBar,
  IconUser,
  IconBuildingWarehouse,
  IconTruckDelivery,
  IconChecks,
  IconClock,
  IconPlayerStopFilled,
  IconPlayerPause,
  IconX as IconCancel,
  IconFileText,
  IconPalette,
  IconBrush,
  IconCurrencyDollar,
  IconReceipt,
  IconFileInvoice,
  IconCalendar,
  IconAlertTriangle,
  IconTarget,
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
    case "user":
      return <IconUser {...iconProps} />;
    case "building-warehouse":
      return <IconBuildingWarehouse {...iconProps} />;
    case "truck-delivery":
      return <IconTruckDelivery {...iconProps} />;
    case "checks":
      return <IconChecks {...iconProps} />;
    case "clock":
      return <IconClock {...iconProps} />;
    case "playstop-filled":
      return <IconPlayerStopFilled {...iconProps} />;
    case "pause":
      return <IconPlayerPause {...iconProps} />;
    case "cancel":
      return <IconCancel {...iconProps} />;
    case "file-text":
      return <IconFileText {...iconProps} />;
    case "palette":
      return <IconPalette {...iconProps} />;
    case "brush":
      return <IconBrush {...iconProps} />;
    case "currency-dollar":
      return <IconCurrencyDollar {...iconProps} />;
    case "receipt":
      return <IconReceipt {...iconProps} />;
    case "file-invoice":
      return <IconFileInvoice {...iconProps} />;
    case "calendar":
      return <IconCalendar {...iconProps} />;
    case "alert-triangle":
      return <IconAlertTriangle {...iconProps} />;
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

export function FilterIndicator({ label, value, onRemove, className, iconType }: FilterIndicatorProps) {
  return <StandardFilterIndicator label={label} value={value} onRemove={onRemove} icon={iconType ? renderFilterIcon(iconType) : undefined} className={className} />;
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

  return <StandardFilterIndicators filters={transformedFilters} onClearAll={onClearAll} className={className} />;
}

// Helper function to determine icon based on filter type
function getIconForFilter(key: string, value: any): React.ReactNode | undefined {
  switch (key) {
    case "searchingFor":
      return renderFilterIcon("search");
    case "status":
      if (value === "PENDING") return renderFilterIcon("clock");
      if (value === "IN_PRODUCTION") return renderFilterIcon("playstop-filled");
      if (value === "ON_HOLD") return renderFilterIcon("pause");
      if (value === "COMPLETED") return renderFilterIcon("checks");
      if (value === "CANCELLED") return renderFilterIcon("cancel");
      return renderFilterIcon("chart-bar");
    case "sectorIds":
      return renderFilterIcon("building-warehouse");
    case "customerIds":
      return renderFilterIcon("user");
    case "assigneeIds":
      return renderFilterIcon("user");
    case "truckIds":
      return renderFilterIcon("truck-delivery");
    case "isOverdue":
      return renderFilterIcon("alert-triangle");
    case "hasObservation":
      return renderFilterIcon("file-text");
    case "hasArtworks":
      return renderFilterIcon("palette");
    case "hasPaints":
      return renderFilterIcon("brush");
    case "hasCommissions":
      return renderFilterIcon("currency-dollar");
    case "hasNfe":
      return renderFilterIcon("file-invoice");
    case "hasReceipt":
      return renderFilterIcon("receipt");
    case "priceRange":
      return renderFilterIcon("currency-dollar");
    case "entryDateRange":
    case "termRange":
    case "startedDateRange":
    case "finishedDateRange":
    case "createdAtRange":
    case "updatedAtRange":
    case "createdAt":
    case "updatedAt":
      return renderFilterIcon("calendar");
    default:
      return renderFilterIcon("target");
  }
}
