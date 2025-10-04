import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { IconFilter, IconX } from "@tabler/icons-react";
import { Separator } from "@/components/ui/separator";

interface FilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children?: React.ReactNode;
  dateRange?: {
    from: Date;
    to: Date;
  };
  onDateRangeChange?: (range: { from: Date; to: Date }) => void;
  onClearFilters?: () => void;
  showDateRange?: boolean;
}

export function FilterDrawer({
  open,
  onOpenChange,
  title = "Filtros",
  children,
  dateRange,
  onDateRangeChange,
  onClearFilters,
  showDateRange = true
}: FilterDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            {title}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {showDateRange && dateRange && onDateRangeChange && (
            <div className="space-y-2">
              <Label>Período</Label>
              <DateRangePicker
                value={dateRange}
                onChange={onDateRangeChange}
                className="w-full"
              />
            </div>
          )}

          {children}

          {onClearFilters && (
            <>
              <Separator />
              <Button
                variant="outline"
                onClick={onClearFilters}
                className="w-full"
              >
                <IconX className="mr-2 h-4 w-4" />
                Limpar Filtros
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Filter trigger button component
export function FilterTrigger({ onClick, filterCount = 0 }: { onClick: () => void; filterCount?: number }) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="gap-2"
    >
      <IconFilter className="h-4 w-4" />
      Filtros
      {filterCount > 0 && (
        <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
          {filterCount}
        </span>
      )}
    </Button>
  );
}