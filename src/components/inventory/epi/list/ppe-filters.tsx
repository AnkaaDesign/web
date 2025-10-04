import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { IconFilter, IconX, IconShield, IconBrandApple, IconCalendarPlus } from "@tabler/icons-react";
import { useItemBrands } from "../../../../hooks";
import type { ItemGetManyFormData } from "../../../../schemas";
import { PPE_TYPE, PPE_TYPE_LABELS, ITEM_CATEGORY_TYPE } from "../../../../constants";

interface PpeFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<ItemGetManyFormData>;
  onFilterChange: (filters: Partial<ItemGetManyFormData>) => void;
}

interface FilterState {
  // Brand filters
  brandIds?: string[];

  // PPE type filter
  ppeType?: string[];

  // Date range filters
  createdAtRange?: { gte?: Date; lte?: Date };
}

export function PpeFilters({ open, onOpenChange, filters, onFilterChange }: PpeFiltersProps) {
  const [localState, setLocalState] = useState<FilterState>({});

  // Fetch brands for filters
  const { data: brandsData } = useItemBrands({
    orderBy: { name: "asc" },
    limit: 100,
  });

  // Initialize local state when dialog opens
  useEffect(() => {
    if (!open) return;

    setLocalState({
      brandIds: filters.brandIds || [],
      ppeType: filters.ppeType || [],
      createdAtRange: filters.createdAt,
    });
  }, [open]);

  const handleApply = () => {
    // Build the filters object from local state
    const newFilters: Partial<ItemGetManyFormData> = {
      limit: filters.limit,
      orderBy: filters.orderBy,
      include: filters.include,
      page: 1, // Reset to first page when applying filters
      where: {
        category: {
          type: ITEM_CATEGORY_TYPE.PPE,
        },
      },
    };

    // Add non-empty filters
    if (localState.brandIds?.length) {
      newFilters.brandIds = localState.brandIds;
    }

    if (localState.ppeType?.length) {
      newFilters.ppeType = localState.ppeType as PPE_TYPE[];
    }

    // Date range filters
    if (localState.createdAtRange?.gte || localState.createdAtRange?.lte) {
      newFilters.createdAt = localState.createdAtRange;
    }

    onFilterChange(newFilters);
    onOpenChange(false);
  };

  const handleReset = () => {
    const resetFilters: Partial<ItemGetManyFormData> = {
      limit: filters.limit || 40,
      orderBy: filters.orderBy || { name: "asc" },
      where: {
        category: {
          type: ITEM_CATEGORY_TYPE.PPE,
        },
      },
    };
    setLocalState({});
    onFilterChange(resetFilters);
    setTimeout(() => {
      onOpenChange(false);
    }, 0);
  };

  // Count active filters
  const countActiveFilters = () => {
    let count = 0;
    if (localState.brandIds?.length) count++;
    if (localState.ppeType?.length) count++;
    if (localState.createdAtRange?.gte || localState.createdAtRange?.lte) count++;
    return count;
  };

  const activeFilterCount = countActiveFilters();

  // Transform data for comboboxes
  const brandOptions =
    brandsData?.data?.map((brand) => ({
      value: brand.id,
      label: brand.name,
    })) || [];

  const ppeTypeOptions = Object.entries(PPE_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[70vh] max-h-[700px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            EPIs - Filtros
            {activeFilterCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="ml-2 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors" onClick={handleReset}>
                      {activeFilterCount}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Clique para limpar todos os filtros</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </DialogTitle>
          <DialogDescription>Configure filtros para refinar sua pesquisa de EPIs</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-8 py-4">
          {/* Brand Filter */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconBrandApple className="h-4 w-4" />
              Marcas
            </Label>
            <Combobox
              mode="multiple"
              options={brandOptions}
              value={localState.brandIds || []}
              onValueChange={(value) => setLocalState((prev) => ({ ...prev, brandIds: value }))}
              placeholder="Selecione marcas..."
              emptyText="Nenhuma marca encontrada"
              searchPlaceholder="Buscar marcas..."
            />
            {localState.brandIds && localState.brandIds.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localState.brandIds.length} marca{localState.brandIds.length !== 1 ? "s" : ""} selecionada{localState.brandIds.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* PPE Type Filter */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconShield className="h-4 w-4" />
              Tipos de EPI
            </Label>
            <Combobox
              mode="multiple"
              options={ppeTypeOptions}
              value={localState.ppeType || []}
              onValueChange={(value) => setLocalState((prev) => ({ ...prev, ppeType: value }))}
              placeholder="Selecione tipos de EPI..."
              emptyText="Nenhum tipo encontrado"
              searchPlaceholder="Buscar tipos..."
            />
            {localState.ppeType && localState.ppeType.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localState.ppeType.length} tipo{localState.ppeType.length !== 1 ? "s" : ""} selecionado{localState.ppeType.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Created At Date Range */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconCalendarPlus className="h-4 w-4" />
              Data de Criação
            </Label>
            <DateTimeInput
              mode="date-range"
              value={{
                from: localState.createdAtRange?.gte,
                to: localState.createdAtRange?.lte,
              }}
              onChange={(range) => {
                if (range?.from || range?.to) {
                  setLocalState((prev) => ({
                    ...prev,
                    createdAtRange: {
                      gte: range?.from,
                      lte: range?.to,
                    },
                  }));
                } else {
                  setLocalState((prev) => ({ ...prev, createdAtRange: undefined }));
                }
              }}
              placeholder="Selecione o período"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReset} className="flex items-center gap-2">
            <IconX className="h-4 w-4" />
            Limpar Tudo
          </Button>
          <Button onClick={handleApply}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
