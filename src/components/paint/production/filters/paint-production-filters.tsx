import React, { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { IconFilter, IconX, IconColorSwatch, IconBrush, IconTag, IconCalendar, IconFlask } from "@tabler/icons-react";
import { usePaintTypes } from "../../../../hooks";
import { PAINT_FINISH, PAINT_FINISH_LABELS, PAINT_BRAND, PAINT_BRAND_LABELS } from "../../../../constants";
import type { PaintProductionGetManyFormData } from "../../../../schemas";

interface PaintProductionFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: PaintProductionGetManyFormData;
  onFiltersChange: (filters: PaintProductionGetManyFormData) => void;
}

export function PaintProductionFilters({ open, onOpenChange, filters, onFiltersChange }: PaintProductionFiltersProps) {
  const { data: paintTypesData } = usePaintTypes({ orderBy: { name: "asc" }, limit: 100 });

  const [localFilters, setLocalFilters] = useState<PaintProductionGetManyFormData>(filters);

  // Count active filters
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (localFilters.paintTypeIds?.length) count++;
    if (localFilters.paintFinishes?.length) count++;
    if (localFilters.paintBrands?.length) count++;
    if (localFilters.createdAt?.gte || localFilters.createdAt?.lte) count++;
    if (localFilters.volumeRange?.min !== undefined || localFilters.volumeRange?.max !== undefined) count++;
    return count;
  }, [localFilters]);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleApply = () => {
    onFiltersChange(localFilters);
    onOpenChange(false);
  };

  const handleClear = () => {
    const clearedFilters: PaintProductionGetManyFormData = {
      limit: filters.limit || 20,
      orderBy: filters.orderBy || { createdAt: "desc" },
      include: filters.include,
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  // Transform data for comboboxes
  const paintTypeOptions =
    paintTypesData?.data?.map((paintType) => ({
      value: paintType.id,
      label: paintType.name,
    })) || [];

  const finishOptions = Object.values(PAINT_FINISH).map((finish) => ({
    value: finish,
    label: PAINT_FINISH_LABELS[finish],
  }));

  const brandOptions = Object.values(PAINT_BRAND).map((brand) => ({
    value: brand,
    label: PAINT_BRAND_LABELS[brand],
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Produção de Tintas - Filtros
            {activeFilterCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="ml-2 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors" onClick={handleClear}>
                      {activeFilterCount}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Clique para limpar todos os filtros</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </SheetTitle>
          <SheetDescription>Configure os filtros para refinar sua pesquisa de produções de tinta</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Paint Type Filter */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconColorSwatch className="h-4 w-4" />
              Tipos de Tinta
            </Label>
            <Combobox
              options={paintTypeOptions}
              value={localFilters.paintTypeIds || []}
              onValueChange={(value) =>
                setLocalFilters({
                  ...localFilters,
                  paintTypeIds: Array.isArray(value) && value.length > 0 ? value : undefined,
                })
              }
              placeholder="Selecione tipos de tinta..."
              emptyText="Nenhum tipo de tinta encontrado"
              searchPlaceholder="Buscar tipos de tinta..."
              mode="multiple"
              searchable={true}
              clearable={true}
            />
            {localFilters.paintTypeIds && localFilters.paintTypeIds.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localFilters.paintTypeIds.length} tipo{localFilters.paintTypeIds.length !== 1 ? "s" : ""} selecionado{localFilters.paintTypeIds.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Paint Finish Filter */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconBrush className="h-4 w-4" />
              Acabamentos
            </Label>
            <Combobox
              options={finishOptions}
              value={localFilters.paintFinishes || []}
              onValueChange={(value) =>
                setLocalFilters({
                  ...localFilters,
                  paintFinishes: Array.isArray(value) && value.length > 0 ? value : undefined,
                })
              }
              placeholder="Selecione acabamentos..."
              emptyText="Nenhum acabamento encontrado"
              searchPlaceholder="Buscar acabamentos..."
              mode="multiple"
              searchable={true}
              clearable={true}
            />
            {localFilters.paintFinishes && localFilters.paintFinishes.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localFilters.paintFinishes.length} acabamento{localFilters.paintFinishes.length !== 1 ? "s" : ""} selecionado{localFilters.paintFinishes.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Paint Brand Filter */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconTag className="h-4 w-4" />
              Marcas
            </Label>
            <Combobox
              options={brandOptions}
              value={localFilters.paintBrands || []}
              onValueChange={(value) =>
                setLocalFilters({
                  ...localFilters,
                  paintBrands: Array.isArray(value) && value.length > 0 ? value : undefined,
                })
              }
              placeholder="Selecione marcas..."
              emptyText="Nenhuma marca encontrada"
              searchPlaceholder="Buscar marcas..."
              mode="multiple"
              searchable={true}
              clearable={true}
            />
            {localFilters.paintBrands && localFilters.paintBrands.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localFilters.paintBrands.length} marca{localFilters.paintBrands.length !== 1 ? "s" : ""} selecionada{localFilters.paintBrands.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Production Date Range */}
          <div className="space-y-3">
            <div className="text-sm font-medium flex items-center gap-2">
              <IconCalendar className="h-4 w-4" />
              Data de Produção
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DateTimeInput
                mode="date"
                context="generic"
                value={localFilters.createdAt?.gte}
                onChange={(date: Date | null) => {
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
                label="De"
                placeholder="Selecionar data inicial..."
              />
              <DateTimeInput
                mode="date"
                context="generic"
                value={localFilters.createdAt?.lte}
                onChange={(date: Date | null) => {
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
                label="Até"
                placeholder="Selecionar data final..."
              />
            </div>
          </div>

          {/* Volume Range */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconFlask className="h-4 w-4" />
              Volume (Litros)
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Volume mín.</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Volume mínimo"
                  value={localFilters.volumeRange?.min ?? ""}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      volumeRange: {
                        ...localFilters.volumeRange,
                        min: e.target.value ? parseFloat(e.target.value) : undefined,
                      },
                    })
                  }
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Volume máx.</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="Volume máximo"
                  value={localFilters.volumeRange?.max ?? ""}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      volumeRange: {
                        ...localFilters.volumeRange,
                        max: e.target.value ? parseFloat(e.target.value) : undefined,
                      },
                    })
                  }
                  className="text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClear} className="flex-1 flex items-center gap-2">
            <IconX className="h-4 w-4" />
            Limpar Tudo
          </Button>
          <Button onClick={handleApply} className="flex-1">Aplicar</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
