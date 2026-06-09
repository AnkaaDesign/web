import { useState, useEffect } from "react";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { DateRange } from "react-day-picker";
import { IconFilter } from "@tabler/icons-react";
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

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtrar Categorias"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Configure os filtros para refinar os resultados da listagem"
      onApply={handleApply}
      onReset={handleClear}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar"
    >
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
      <div className="space-y-3">
        <div className="text-sm font-medium">Data de criação</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
            <DateTimeInput
              mode="date"
              value={localFilters.createdAt?.gte}
              onChange={(date: Date | DateRange | null) => {
                if (date && !(date instanceof Date)) return;
                if (!date && !localFilters.createdAt?.lte) {
                  setLocalFilters({
                    ...localFilters,
                    createdAt: undefined,
                  });
                } else {
                  setLocalFilters({
                    ...localFilters,
                    createdAt: {
                      ...(date && { gte: date }),
                      ...(localFilters.createdAt?.lte && { lte: localFilters.createdAt.lte }),
                    },
                  });
                }
              }}
              hideLabel
              placeholder="Selecionar data inicial..."
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
            <DateTimeInput
              mode="date"
              value={localFilters.createdAt?.lte}
              onChange={(date: Date | DateRange | null) => {
                if (date && !(date instanceof Date)) return;
                if (!date && !localFilters.createdAt?.gte) {
                  setLocalFilters({
                    ...localFilters,
                    createdAt: undefined,
                  });
                } else {
                  setLocalFilters({
                    ...localFilters,
                    createdAt: {
                      ...(localFilters.createdAt?.gte && { gte: localFilters.createdAt.gte }),
                      ...(date && { lte: date }),
                    },
                  });
                }
              }}
              hideLabel
              placeholder="Selecionar data final..."
            />
          </div>
        </div>
      </div>
    </FilterDrawer>
  );
}
