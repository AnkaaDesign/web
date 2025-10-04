import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[400px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Filtrar Marcas</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto grid gap-4 py-4">
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

        <DialogFooter>
          <Button variant="outline" onClick={handleClear} disabled={!hasActiveFilters()}>
            Limpar
          </Button>
          <Button onClick={handleApply}>Aplicar Filtros</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
