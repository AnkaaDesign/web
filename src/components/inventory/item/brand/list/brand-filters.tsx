import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { IconFilter, IconX } from "@tabler/icons-react";
import type { ItemBrandGetManyFormData } from "../../../../../schemas";

interface BrandFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<ItemBrandGetManyFormData>;
  onFilterChange: (filters: Partial<ItemBrandGetManyFormData>) => void;
}

export function BrandFilters({ open, onOpenChange, filters, onFilterChange }: BrandFiltersProps) {
  // Local state for form
  const [localFilters, setLocalFilters] = useState<Partial<ItemBrandGetManyFormData>>({});

  // Sync local state with prop filters when dialog opens
  useEffect(() => {
    if (open) {
      setLocalFilters({ ...filters });
    }
  }, [open, filters]);

  const handleApply = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleClear = () => {
    const clearedFilters: Partial<ItemBrandGetManyFormData> = {
      limit: filters.limit || 40,
    };
    setLocalFilters(clearedFilters);
  };

  const hasActiveFilters = () => {
    return !!(localFilters.createdAt?.gte || localFilters.createdAt?.lte);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            <SheetTitle>Filtrar Marcas</SheetTitle>
          </div>
          <SheetDescription>
            Configure os filtros para refinar a lista de marcas
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Created date range */}
          <div className="grid gap-2">
            <Label>Data de criação</Label>
            <DateTimeInput
              mode="date-range"
              value={localFilters.createdAt}
              onChange={(range) => {
                setLocalFilters({
                  ...localFilters,
                  createdAt: range,
                });
              }}
              placeholder="Selecione o período"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t mt-6">
          <Button variant="outline" onClick={handleClear} disabled={!hasActiveFilters()} className="flex-1">
            <IconX className="h-4 w-4 mr-2" />
            Limpar
          </Button>
          <Button onClick={handleApply} className="flex-1">Aplicar Filtros</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
