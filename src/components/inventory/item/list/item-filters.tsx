import { useState, useEffect } from "react";
import type { ItemGetManyFormData } from "../../../../schemas";
import { IconFilter, IconSearch, IconTag, IconTrendingUp, IconRuler, IconCalendar, IconX } from "@tabler/icons-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { STOCK_LEVEL } from "../../../../constants";

import { BasicFilters } from "./filters/basic-filters";
import { EntitySelectors } from "./filters/entity-selectors";
import { RangeFilters } from "./filters/range-filters";
import { DateFilters } from "./filters/date-filters";
import { MeasureFilters } from "./filters/measure-filters";

interface ItemFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<ItemGetManyFormData>;
  onFilterChange: (filters: Partial<ItemGetManyFormData>) => void;
}

interface FilterState {
  // Basic filters
  showInactive?: boolean;
  shouldAssignToUser?: boolean;
  stockLevels?: STOCK_LEVEL[];
  nearReorderPoint?: boolean;
  noReorderPoint?: boolean;

  // Entity filters
  categoryIds?: string[];
  brandIds?: string[];
  supplierIds?: string[];

  // Measure filters
  measureUnits?: string[];
  measureTypes?: string[];
  hasMeasures?: boolean;
  hasMultipleMeasures?: boolean;

  // Range filters
  quantityRange?: { min?: number; max?: number };
  totalPriceRange?: { min?: number; max?: number };
  taxRange?: { min?: number; max?: number };
  monthlyConsumptionRange?: { min?: number; max?: number };
  measureValueRange?: { min?: number; max?: number };

  // Date filters
  createdAtRange?: { gte?: Date; lte?: Date };
  updatedAtRange?: { gte?: Date; lte?: Date };
}

export function ItemFilters({ open, onOpenChange, filters, onFilterChange }: ItemFiltersProps) {
  const [localState, setLocalState] = useState<FilterState>({});

  // Initialize local state from filters only when dialog opens
  useEffect(() => {
    if (!open) return;

    const where = filters.where || {};
    setLocalState({
      showInactive: filters.showInactive,
      shouldAssignToUser: where.shouldAssignToUser,
      stockLevels: filters.stockLevels as STOCK_LEVEL[] | undefined,
      nearReorderPoint: filters.nearReorderPoint,
      noReorderPoint: filters.noReorderPoint,
      categoryIds: filters.categoryIds ? (Array.isArray(filters.categoryIds) ? filters.categoryIds : [filters.categoryIds]) : where.categoryId ? [where.categoryId as string] : [],
      brandIds: filters.brandIds ? (Array.isArray(filters.brandIds) ? filters.brandIds : [filters.brandIds]) : where.brandId ? [where.brandId as string] : [],
      supplierIds: filters.supplierIds ? (Array.isArray(filters.supplierIds) ? filters.supplierIds : [filters.supplierIds]) : where.supplierId ? [where.supplierId as string] : [],
      measureUnits: filters.measureUnits || [],
      measureTypes: filters.measureTypes || [],
      hasMeasures: filters.hasMeasures,
      hasMultipleMeasures: filters.hasMultipleMeasures,
      quantityRange: filters.quantityRange,
      totalPriceRange: filters.totalPriceRange,
      taxRange: filters.taxRange,
      monthlyConsumptionRange: filters.monthlyConsumptionRange,
      measureValueRange: filters.measureValueRange,
      createdAtRange: filters.createdAt,
      updatedAtRange: filters.updatedAt,
    });
  }, [open]); // Only depend on 'open' to avoid re-initializing when filters change

  const handleApply = () => {
    // Build the filters object from local state
    const newFilters: Partial<ItemGetManyFormData> = {
      limit: filters.limit,
      orderBy: filters.orderBy,
      // Add showInactive filter
      ...(localState.showInactive && { showInactive: true }),
      // Add stock levels array filter
      ...(localState.stockLevels && localState.stockLevels.length > 0 && { stockLevels: localState.stockLevels }),
      ...(localState.nearReorderPoint && { nearReorderPoint: true }),
      ...(localState.noReorderPoint && { noReorderPoint: true }),
      quantityRange: localState.quantityRange,
      totalPriceRange: localState.totalPriceRange,
      taxRange: localState.taxRange,
      monthlyConsumptionRange: localState.monthlyConsumptionRange,
      measureValueRange: localState.measureValueRange,
      createdAt: localState.createdAtRange,
      updatedAt: localState.updatedAtRange,
    };

    // Build where clause
    const where: any = {};

    // Basic boolean filters - include both true and false values
    if (typeof localState.shouldAssignToUser === "boolean") where.shouldAssignToUser = localState.shouldAssignToUser;

    // Entity filters - these go at the root level, not in where clause
    if (localState.categoryIds && localState.categoryIds.length > 0) {
      newFilters.categoryIds = localState.categoryIds;
    }
    if (localState.brandIds && localState.brandIds.length > 0) {
      newFilters.brandIds = localState.brandIds;
    }
    if (localState.supplierIds && localState.supplierIds.length > 0) {
      newFilters.supplierIds = localState.supplierIds;
    }

    // Add measure units to the main filters (not in where clause)
    if (localState.measureUnits && localState.measureUnits.length > 0) {
      newFilters.measureUnits = localState.measureUnits;
    }
    if (localState.measureTypes && localState.measureTypes.length > 0) {
      newFilters.measureTypes = localState.measureTypes;
    }
    if (localState.hasMeasures) {
      newFilters.hasMeasures = localState.hasMeasures;
    }
    if (localState.hasMultipleMeasures) {
      newFilters.hasMultipleMeasures = localState.hasMultipleMeasures;
    }

    if (Object.keys(where).length > 0) {
      newFilters.where = where;
    }

    // Apply filters first, then close dialog with a small delay to avoid ref issues
    onFilterChange(newFilters);
    // Use setTimeout to ensure filter changes are processed before dialog closes
    setTimeout(() => {
      onOpenChange(false);
    }, 0);
  };

  const handleReset = () => {
    const resetFilters: Partial<ItemGetManyFormData> = {
      limit: filters.limit || 40,
      orderBy: filters.orderBy || { name: "asc" },
    };
    setLocalState({});
    onFilterChange(resetFilters);
    // Use setTimeout to ensure filter changes are processed before dialog closes
    setTimeout(() => {
      onOpenChange(false);
    }, 0);
  };

  // Count active filters
  const countActiveFilters = () => {
    let count = 0;
    if (localState.showInactive) count++;
    if (typeof localState.shouldAssignToUser === "boolean") count++;
    if (localState.stockLevels && localState.stockLevels.length > 0) count += localState.stockLevels.length;
    if (localState.nearReorderPoint) count++;
    if (localState.noReorderPoint) count++;
    if (localState.categoryIds?.length) count++;
    if (localState.brandIds?.length) count++;
    if (localState.supplierIds?.length) count++;
    if (localState.measureUnits?.length) count++;
    if (localState.measureTypes?.length) count++;
    if (localState.hasMeasures) count++;
    if (localState.hasMultipleMeasures) count++;
    if (localState.quantityRange?.min || localState.quantityRange?.max) count++;
    if (localState.totalPriceRange?.min || localState.totalPriceRange?.max) count++;
    if (localState.taxRange?.min || localState.taxRange?.max) count++;
    if (localState.monthlyConsumptionRange?.min || localState.monthlyConsumptionRange?.max) count++;
    if (localState.measureValueRange?.min || localState.measureValueRange?.max) count++;
    if (localState.createdAtRange?.gte || localState.createdAtRange?.lte) count++;
    if (localState.updatedAtRange?.gte || localState.updatedAtRange?.lte) count++;
    return count;
  };

  const activeFilterCount = countActiveFilters();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5 text-muted-foreground" />
            Itens - Filtros
            {activeFilterCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                onClick={handleReset}
                title="Clique para limpar todos os filtros"
              >
                {activeFilterCount}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>Configure filtros para refinar a pesquisa de itens</DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs defaultValue="basic" className="flex flex-col flex-1 overflow-hidden">
            <TabsList className="grid w-full grid-cols-5 flex-shrink-0">
              <TabsTrigger value="basic" className="flex items-center gap-2">
                <IconSearch className="h-4 w-4" />
                Básico
              </TabsTrigger>
              <TabsTrigger value="entities" className="flex items-center gap-2">
                <IconTag className="h-4 w-4" />
                Entidades
              </TabsTrigger>
              <TabsTrigger value="ranges" className="flex items-center gap-2">
                <IconTrendingUp className="h-4 w-4" />
                Intervalos
              </TabsTrigger>
              <TabsTrigger value="measures" className="flex items-center gap-2">
                <IconRuler className="h-4 w-4" />
                Medidas
              </TabsTrigger>
              <TabsTrigger value="dates" className="flex items-center gap-2">
                <IconCalendar className="h-4 w-4" />
                Datas
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden mt-4">
              <TabsContent value="basic" className="h-full overflow-auto space-y-8 p-4">
                <BasicFilters
                  showInactive={localState.showInactive}
                  onShowInactiveChange={(value: any) => setLocalState((prev: any) => ({ ...prev, showInactive: value }))}
                  shouldAssignToUser={localState.shouldAssignToUser}
                  onShouldAssignToUserChange={(value: any) => setLocalState((prev: any) => ({ ...prev, shouldAssignToUser: value }))}
                  stockLevels={localState.stockLevels}
                  onStockLevelsChange={(value: any) => setLocalState((prev: any) => ({ ...prev, stockLevels: value }))}
                  nearReorderPoint={localState.nearReorderPoint}
                  onNearReorderPointChange={(value: any) => setLocalState((prev: any) => ({ ...prev, nearReorderPoint: value }))}
                  noReorderPoint={localState.noReorderPoint}
                  onNoReorderPointChange={(value: any) => setLocalState((prev: any) => ({ ...prev, noReorderPoint: value }))}
                />
              </TabsContent>

              <TabsContent value="entities" className="h-full overflow-auto space-y-8 p-4">
                <EntitySelectors
                  categoryIds={localState.categoryIds || []}
                  onCategoryIdsChange={(ids: any) => setLocalState((prev: any) => ({ ...prev, categoryIds: ids }))}
                  brandIds={localState.brandIds || []}
                  onBrandIdsChange={(ids: any) => setLocalState((prev: any) => ({ ...prev, brandIds: ids }))}
                  supplierIds={localState.supplierIds || []}
                  onSupplierIdsChange={(ids: any) => setLocalState((prev: any) => ({ ...prev, supplierIds: ids }))}
                />
              </TabsContent>

              <TabsContent value="measures" className="h-full overflow-auto space-y-8 p-4">
                <MeasureFilters
                  measureUnits={localState.measureUnits || []}
                  onMeasureUnitsChange={(units: any) => setLocalState((prev: any) => ({ ...prev, measureUnits: units }))}
                  measureTypes={localState.measureTypes || []}
                  onMeasureTypesChange={(types: any) => setLocalState((prev: any) => ({ ...prev, measureTypes: types }))}
                  hasMeasures={localState.hasMeasures}
                  onHasMeasuresChange={(value: any) => setLocalState((prev: any) => ({ ...prev, hasMeasures: value }))}
                  hasMultipleMeasures={localState.hasMultipleMeasures}
                  onHasMultipleMeasuresChange={(value: any) => setLocalState((prev: any) => ({ ...prev, hasMultipleMeasures: value }))}
                />
              </TabsContent>

              <TabsContent value="ranges" className="h-full overflow-auto space-y-8 p-4">
                <RangeFilters
                  quantityRange={localState.quantityRange}
                  onQuantityRangeChange={(range: any) => setLocalState((prev: any) => ({ ...prev, quantityRange: range }))}
                  totalPriceRange={localState.totalPriceRange}
                  onTotalPriceRangeChange={(range: any) => setLocalState((prev: any) => ({ ...prev, totalPriceRange: range }))}
                  taxRange={localState.taxRange}
                  onTaxRangeChange={(range: any) => setLocalState((prev: any) => ({ ...prev, taxRange: range }))}
                  monthlyConsumptionRange={localState.monthlyConsumptionRange}
                  onMonthlyConsumptionRangeChange={(range: any) => setLocalState((prev: any) => ({ ...prev, monthlyConsumptionRange: range }))}
                  measureValueRange={localState.measureValueRange}
                  onMeasureValueRangeChange={(range: any) => setLocalState((prev: any) => ({ ...prev, measureValueRange: range }))}
                />
              </TabsContent>

              <TabsContent value="dates" className="h-full overflow-auto space-y-8 p-4">
                <DateFilters
                  createdAtRange={localState.createdAtRange}
                  onCreatedAtRangeChange={(range: any) => setLocalState((prev: any) => ({ ...prev, createdAtRange: range }))}
                  updatedAtRange={localState.updatedAtRange}
                  onUpdatedAtRangeChange={(range: any) => setLocalState((prev: any) => ({ ...prev, updatedAtRange: range }))}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <Separator className="mt-auto" />

        <DialogFooter className="gap-2 flex-shrink-0">
          <Button variant="outline" onClick={handleReset}>
            <IconX className="h-4 w-4 mr-2" />
            Limpar todos
          </Button>
          <Button onClick={handleApply}>
            Aplicar filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
