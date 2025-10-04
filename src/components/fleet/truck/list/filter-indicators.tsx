import React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FilterIndicator } from "./filter-utils";
import {
  IconSearch,
  IconHome,
  IconMapPin,
  IconCar,
  IconClipboardList,
  IconTruck,
  IconIdCard,
  IconResizeHorizontal,
  IconResizeVertical,
  IconArrowsHorizontal,
  IconCalendar,
} from "@tabler/icons-react";

interface FilterIndicatorsProps {
  filters: FilterIndicator[];
  onClearAll: () => void;
  className?: string;
}

const getIcon = (iconType?: string) => {
  switch (iconType) {
    case "search":
      return <IconSearch className="h-3 w-3" />;
    case "home":
      return <IconHome className="h-3 w-3" />;
    case "map-pin":
      return <IconMapPin className="h-3 w-3" />;
    case "car":
      return <IconCar className="h-3 w-3" />;
    case "clipboard-list":
      return <IconClipboardList className="h-3 w-3" />;
    case "truck":
      return <IconTruck className="h-3 w-3" />;
    case "id-card":
      return <IconIdCard className="h-3 w-3" />;
    case "resize-horizontal":
      return <IconResizeHorizontal className="h-3 w-3" />;
    case "resize-vertical":
      return <IconResizeVertical className="h-3 w-3" />;
    case "arrows-horizontal":
      return <IconArrowsHorizontal className="h-3 w-3" />;
    case "calendar":
      return <IconCalendar className="h-3 w-3" />;
    default:
      return null;
  }
};

export function FilterIndicators({ filters, onClearAll, className }: FilterIndicatorsProps) {
  if (filters.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {filters.map((filter) => (
          <Badge key={filter.key} variant="secondary" className="flex items-center gap-2 px-2 py-1 text-xs font-normal">
            {getIcon(filter.iconType)}
            <span className="text-xs text-muted-foreground font-medium">{filter.label}:</span>
            <span className="font-medium">{filter.value}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 ml-1 hover:bg-transparent"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                filter.onRemove();
              }}
            >
              <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </Button>
          </Badge>
        ))}
      </div>
      {filters.length > 1 && (
        <Button variant="ghost" size="sm" className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground" onClick={onClearAll}>
          Limpar tudo
        </Button>
      )}
    </div>
  );
}
