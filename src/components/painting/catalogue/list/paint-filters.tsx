import React, { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Combobox } from "@/components/ui/combobox";
import { IconFilter, IconPaint, IconTag, IconBrush, IconTruck, IconSparkles, IconX, IconColorPicker } from "@tabler/icons-react";
import type { PaintGetManyFormData } from "../../../../schemas";
import { PAINT_FINISH, PAINT_FINISH_LABELS, TRUCK_MANUFACTURER, TRUCK_MANUFACTURER_LABELS } from "../../../../constants";
import { usePaintTypes, usePaintBrands } from "../../../../hooks";
import { AdvancedColorPicker } from "../../form/advanced-color-picker";

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
    if (localFilters.hasFormulas !== undefined) count++;
    if (localFilters.similarColor && localFilters.similarColor !== "#000000") count++;
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
    setLocalFilters((prev) => {
      // Remove the key if value is undefined, null, or empty string
      if (value === undefined || value === null || value === "") {
        const { [key as string]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [key]: value,
      };
    });
  };

  // Apply filters
  const handleApply = () => {
    // Clean up the filters before applying
    const cleanedFilters = { ...localFilters };

    // CRITICAL: Remove similarColor if it's empty, undefined, or the default black color
    if (!cleanedFilters.similarColor || cleanedFilters.similarColor === "#000000" || cleanedFilters.similarColor === "") {
      delete cleanedFilters.similarColor;
      delete cleanedFilters.similarColorThreshold;
    }

    // Remove any empty string values
    Object.keys(cleanedFilters).forEach((key) => {
      const typedKey = key as Extract<keyof PaintGetManyFormData, string>;
      const value = cleanedFilters[typedKey];
      if (value === "" || value === null || value === undefined) {
        delete cleanedFilters[typedKey];
      }
    });


    onFilterChange(cleanedFilters);
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
  const selectedManufacturers = localFilters.manufacturers || [];
  const selectedPaintTypeIds = localFilters.paintTypeIds || [];
  const hasFormulas = localFilters.hasFormulas ?? undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
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
          </SheetTitle>
          <SheetDescription>Configure os filtros para refinar o catálogo de tintas.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
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

            {/* Has Formulas */}
            <div className="flex items-center justify-between">
              <Label htmlFor="hasFormulas" className="flex items-center gap-2">
                <IconSparkles className="h-4 w-4" />
                Apenas com fórmulas
              </Label>
              <Switch id="hasFormulas" checked={hasFormulas === true} onCheckedChange={(checked) => handleChange("hasFormulas", checked ? true : undefined)} />
            </div>

            {/* Color Similarity Filter */}
            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="similarColor" className="flex items-center gap-2">
                  <IconColorPicker className="h-4 w-4" />
                  Filtrar por Similaridade de Cor
                </Label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <AdvancedColorPicker
                      color={localFilters.similarColor || "#000000"}
                      onChange={(color) => handleChange("similarColor", color)}
                      popoverSide="left"
                      popoverAlign="start"
                    />
                  </div>
                  {localFilters.similarColor && localFilters.similarColor !== "#000000" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleChange("similarColor", undefined)}
                      className="shrink-0"
                    >
                      <IconX className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {localFilters.similarColor && localFilters.similarColor !== "#000000" && (
                <div className="space-y-2">
                  <Label htmlFor="similarColorThreshold" className="flex items-center justify-between">
                    <span>Limiar de Similaridade</span>
                    <span className="text-sm text-muted-foreground">{localFilters.similarColorThreshold || 15}</span>
                  </Label>
                  <Slider
                    id="similarColorThreshold"
                    min={0}
                    max={100}
                    step={1}
                    value={[localFilters.similarColorThreshold || 15]}
                    onValueChange={(values) => handleChange("similarColorThreshold", values[0])}
                    className="w-full"
                  />
                </div>
              )}
            </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={handleClearAll} className="flex-1">
              <IconX className="h-4 w-4 mr-2" />
              Limpar Tudo
            </Button>
            <Button onClick={handleApply} className="flex-1">Aplicar Filtros</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
