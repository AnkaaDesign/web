import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { ItemCategoryGetManyFormData } from "../../../../../schemas";

interface CategoryFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<ItemCategoryGetManyFormData>;
  onFilterChange: (filters: Partial<ItemCategoryGetManyFormData>) => void;
}

export function CategoryFilters({ open, onOpenChange, filters, onFilterChange }: CategoryFiltersProps) {
  // Local state for form
  const [localFilters, setLocalFilters] = useState<Partial<ItemCategoryGetManyFormData>>({});

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
    const clearedFilters: Partial<ItemCategoryGetManyFormData> = {
      limit: filters.limit || 40,
    };
    setLocalFilters(clearedFilters);
  };

  const hasActiveFilters = () => {
    return !!(localFilters.where?.type || localFilters.createdAt?.gte || localFilters.createdAt?.lte);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[400px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Filtrar Categorias</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto grid gap-4 py-4">
          {/* Type filter - temporarily commented out until ITEM_TYPE is available */}
          {/* <div className="grid gap-2">
            <Label htmlFor="type">Tipo</Label>
            <Select
              value={localFilters.where?.type || "_all_types"}
              onValueChange={(value) => {
                if (value && value !== "_all_types") {
                  setLocalFilters({
                    ...localFilters,
                    where: { ...localFilters.where, type: value },
                  });
                } else {
                  const newWhere = { ...localFilters.where };
                  delete newWhere.type;
                  setLocalFilters({
                    ...localFilters,
                    where: Object.keys(newWhere).length > 0 ? newWhere : undefined,
                  });
                }
              }}
            >
              <SelectTrigger id="type">
                <SelectValue placeholder="Todos os tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all_types">Todos os tipos</SelectItem>
                {Object.values(ITEM_TYPE).map((type) => (
                  <SelectItem key={type} value={type}>
                    {ITEM_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div> */}

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
