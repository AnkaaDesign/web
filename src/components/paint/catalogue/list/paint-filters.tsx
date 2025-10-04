import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/ui/combobox";
import { IconFilter, IconPalette, IconPaint, IconTag, IconBrush, IconTruck, IconSparkles, IconX } from "@tabler/icons-react";
import type { PaintGetManyFormData } from "../../../../schemas";
import { PAINT_FINISH, COLOR_PALETTE, PAINT_FINISH_LABELS, COLOR_PALETTE_LABELS, TRUCK_MANUFACTURER, TRUCK_MANUFACTURER_LABELS } from "../../../../constants";
import { usePaintTypes, usePaintBrands } from "../../../../hooks";

interface PaintFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<PaintGetManyFormData>;
  onFilterChange: (filters: Partial<PaintGetManyFormData>) => void;
}

export function PaintFilters({ open, onOpenChange, filters, onFilterChange }: PaintFiltersProps) {
  // Load paint types and paint brands
  const { data: paintTypesData } = usePaintTypes({ orderBy: { name: "asc" } });
  const { data: paintBrandsData } = usePaintBrands({ orderBy: { name: "asc" } });

  // Local state for form
  const [localFilters, setLocalFilters] = useState<Partial<PaintGetManyFormData>>(filters);

  // Count active filters
  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (localFilters.paintTypeIds?.length) count++;
    if (localFilters.paintBrandIds?.length) count++;
    if (localFilters.finishes?.length) count++;
    if (localFilters.manufacturers?.length) count++;
    if (localFilters.palettes?.length) count++;
    if (localFilters.hasFormulas !== undefined) count++;
    return count;
  }, [localFilters]);

  // Sync localFilters with parent filters when modal opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  // Handle filter changes
  const handleChange = (key: keyof PaintGetManyFormData, value: unknown) => {
    setLocalFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Apply filters
  const handleApply = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  // Reset filters
  const handleReset = () => {
    const resetFilters: Partial<PaintGetManyFormData> = {
      limit: filters.limit,
    };
    setLocalFilters(resetFilters);
    onFilterChange(resetFilters);
    onOpenChange(false);
  };

  // Clear all filters (for the clear all button)
  const handleClearAll = () => {
    const clearedFilters: Partial<PaintGetManyFormData> = {
      limit: filters.limit,
    };
    setLocalFilters(clearedFilters);
  };

  // Get selected values
  const selectedFinishes = localFilters.finishes || [];
  const selectedPaintBrandIds = localFilters.paintBrandIds || [];
  const selectedPalettes = localFilters.palettes || [];
  const selectedManufacturers = localFilters.manufacturers || [];
  const selectedPaintTypeIds = localFilters.paintTypeIds || [];
  const hasFormulas = localFilters.hasFormulas ?? undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[70vh] max-h-[700px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Tintas - Filtros
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
          <DialogDescription>Configure os filtros para refinar o catálogo de tintas.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1">
          <div className="space-y-8 pb-4">
            {/* Paint Type */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconPaint className="h-4 w-4" />
                Tipos de Tinta
              </Label>
              <Combobox
                options={
                  paintTypesData?.data?.map((type) => ({
                    value: type.id,
                    label: type.name,
                  })) || []
                }
                value={selectedPaintTypeIds}
                onValueChange={(values) => handleChange("paintTypeIds", values)}
                placeholder="Selecione os tipos"
                mode="multiple"
                searchable={true}
                clearable={true}
                emptyText="Nenhum tipo encontrado"
                searchPlaceholder="Pesquisar tipos..."
              />
            </div>

            {/* Paint Brands */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconTag className="h-4 w-4" />
                Marcas
              </Label>
              <Combobox
                options={
                  paintBrandsData?.data?.map((brand) => ({
                    value: brand.id,
                    label: brand.name,
                  })) || []
                }
                value={selectedPaintBrandIds}
                onValueChange={(values) => handleChange("paintBrandIds", values)}
                placeholder="Selecione as marcas"
                mode="multiple"
                searchable={true}
                clearable={true}
                emptyText="Nenhuma marca encontrada"
                searchPlaceholder="Pesquisar marcas..."
              />
            </div>

            {/* Finishes */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconBrush className="h-4 w-4" />
                Acabamentos
              </Label>
              <Combobox
                options={Object.values(PAINT_FINISH).map((finish) => ({
                  value: finish,
                  label: PAINT_FINISH_LABELS[finish] || finish,
                }))}
                value={selectedFinishes}
                onValueChange={(values) => handleChange("finishes", values)}
                placeholder="Selecione os acabamentos"
                mode="multiple"
                searchable={true}
                clearable={true}
                emptyText="Nenhum acabamento encontrado"
                searchPlaceholder="Pesquisar acabamentos..."
              />
            </div>

            {/* Manufacturers */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconTruck className="h-4 w-4" />
                Montadoras
              </Label>
              <Combobox
                options={Object.values(TRUCK_MANUFACTURER).map((manufacturer) => ({
                  value: manufacturer,
                  label: TRUCK_MANUFACTURER_LABELS[manufacturer] || manufacturer,
                }))}
                value={selectedManufacturers}
                onValueChange={(values) => handleChange("manufacturers", values)}
                placeholder="Selecione as montadoras"
                mode="multiple"
                searchable={true}
                clearable={true}
                emptyText="Nenhuma montadora encontrada"
                searchPlaceholder="Pesquisar montadoras..."
              />
            </div>

            {/* Color Palettes */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconPalette className="h-4 w-4" />
                Paletas de Cores
              </Label>
              <Combobox
                options={Object.values(COLOR_PALETTE).map((palette) => ({
                  value: palette,
                  label: COLOR_PALETTE_LABELS[palette] || palette,
                }))}
                value={selectedPalettes}
                onValueChange={(values) => handleChange("palettes", values)}
                placeholder="Selecione as paletas"
                mode="multiple"
                searchable={true}
                clearable={true}
                emptyText="Nenhuma paleta encontrada"
                searchPlaceholder="Pesquisar paletas..."
              />
            </div>

            {/* Has Formulas */}
            <div className="flex items-center justify-between">
              <Label htmlFor="hasFormulas" className="flex items-center gap-2">
                <IconSparkles className="h-4 w-4" />
                Apenas com fórmulas
              </Label>
              <Switch id="hasFormulas" checked={hasFormulas === true} onCheckedChange={(checked) => handleChange("hasFormulas", checked ? true : undefined)} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-4">
          <Button variant="outline" onClick={handleClearAll} className="flex items-center gap-2">
            <IconX className="h-4 w-4" />
            Limpar Tudo
          </Button>
          <Button onClick={handleApply}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
