import { useState, useEffect } from "react";
import type { TruckGetManyFormData } from "../../../../schemas";
import { IconFilter, IconTruck, IconHome, IconMapPin, IconCalendar, IconX } from "@tabler/icons-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TRUCK_MANUFACTURER } from "../../../../constants";

import { TruckBasicFilters } from "./filters/truck-basic-filters";
import { TruckEntitySelectors } from "./filters/truck-entity-selectors";
import { TruckRangeFilters } from "./filters/truck-range-filters";
import { TruckDateFilters } from "./filters/truck-date-filters";

interface TruckFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<TruckGetManyFormData>;
  onFilterChange: (filters: Partial<TruckGetManyFormData>) => void;
}

interface FilterState {
  // Basic filters
  hasGarage?: boolean;
  hasPosition?: boolean;
  isParked?: boolean;

  // Entity filters
  taskIds?: string[];
  garageIds?: string[];
  manufacturers?: TRUCK_MANUFACTURER[];
  plates?: string[];
  models?: string[];

  // Range filters
  xPositionRange?: { min?: number; max?: number };
  yPositionRange?: { min?: number; max?: number };

  // Date filters
  createdAt?: { gte?: Date; lte?: Date };
  updatedAt?: { gte?: Date; lte?: Date };
}

export function TruckFilters({ open, onOpenChange, filters, onFilterChange }: TruckFiltersProps) {
  const [filterState, setFilterState] = useState<FilterState>({});

  // Initialize state from props when dialog opens
  useEffect(() => {
    if (open) {
      setFilterState({
        hasGarage: filters.hasGarage,
        hasPosition: filters.hasPosition,
        isParked: filters.isParked,
        taskIds: filters.taskIds || [],
        garageIds: filters.garageIds || [],
        manufacturers: filters.manufacturers || [],
        plates: filters.plates || [],
        models: filters.models || [],
        xPositionRange: filters.xPositionRange,
        yPositionRange: filters.yPositionRange,
        createdAt: filters.createdAt,
        updatedAt: filters.updatedAt,
      });
    }
  }, [open, filters]);

  const updateFilter = (key: keyof FilterState, value: any) => {
    setFilterState((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    // Convert state to API format and remove undefined/empty values
    const apiFilters: Partial<TruckGetManyFormData> = {};

    // Basic filters
    if (filterState.hasGarage !== undefined) apiFilters.hasGarage = filterState.hasGarage;
    if (filterState.hasPosition !== undefined) apiFilters.hasPosition = filterState.hasPosition;
    if (filterState.isParked !== undefined) apiFilters.isParked = filterState.isParked;

    // Entity filters - only include non-empty arrays
    if (filterState.taskIds && filterState.taskIds.length > 0) apiFilters.taskIds = filterState.taskIds;
    if (filterState.garageIds && filterState.garageIds.length > 0) apiFilters.garageIds = filterState.garageIds;
    if (filterState.manufacturers && filterState.manufacturers.length > 0) apiFilters.manufacturers = filterState.manufacturers;
    if (filterState.plates && filterState.plates.length > 0) apiFilters.plates = filterState.plates;
    if (filterState.models && filterState.models.length > 0) apiFilters.models = filterState.models;

    // Range filters - only include if at least one bound is set
    if (filterState.xPositionRange && (filterState.xPositionRange.min !== undefined || filterState.xPositionRange.max !== undefined)) {
      apiFilters.xPositionRange = filterState.xPositionRange;
    }
    if (filterState.yPositionRange && (filterState.yPositionRange.min !== undefined || filterState.yPositionRange.max !== undefined)) {
      apiFilters.yPositionRange = filterState.yPositionRange;
    }

    // Date filters
    if (filterState.createdAt && (filterState.createdAt.gte || filterState.createdAt.lte)) {
      apiFilters.createdAt = filterState.createdAt;
    }
    if (filterState.updatedAt && (filterState.updatedAt.gte || filterState.updatedAt.lte)) {
      apiFilters.updatedAt = filterState.updatedAt;
    }

    onFilterChange(apiFilters);
    onOpenChange(false);
  };

  const handleClear = () => {
    setFilterState({});
    onFilterChange({});
    onOpenChange(false);
  };

  const getActiveFilterCount = () => {
    let count = 0;

    // Basic filters
    if (filterState.hasGarage !== undefined) count++;
    if (filterState.hasPosition !== undefined) count++;
    if (filterState.isParked !== undefined) count++;

    // Entity filters
    if (filterState.taskIds && filterState.taskIds.length > 0) count += filterState.taskIds.length;
    if (filterState.garageIds && filterState.garageIds.length > 0) count += filterState.garageIds.length;
    if (filterState.manufacturers && filterState.manufacturers.length > 0) count += filterState.manufacturers.length;
    if (filterState.plates && filterState.plates.length > 0) count += filterState.plates.length;
    if (filterState.models && filterState.models.length > 0) count += filterState.models.length;

    // Range filters
    if (filterState.xPositionRange && (filterState.xPositionRange.min !== undefined || filterState.xPositionRange.max !== undefined)) count++;
    if (filterState.yPositionRange && (filterState.yPositionRange.min !== undefined || filterState.yPositionRange.max !== undefined)) count++;

    // Date filters
    if (filterState.createdAt && (filterState.createdAt.gte || filterState.createdAt.lte)) count++;
    if (filterState.updatedAt && (filterState.updatedAt.gte || filterState.updatedAt.lte)) count++;

    return count;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros de Caminhões
            {getActiveFilterCount() > 0 && (
              <Badge variant="secondary" className="ml-2">
                {getActiveFilterCount()}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>Configure os filtros para refinar a pesquisa de caminhões</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="basic" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic" className="flex items-center gap-2">
                <IconTruck className="h-4 w-4" />
                Básico
              </TabsTrigger>
              <TabsTrigger value="entities" className="flex items-center gap-2">
                <IconHome className="h-4 w-4" />
                Entidades
              </TabsTrigger>
              <TabsTrigger value="ranges" className="flex items-center gap-2">
                <IconMapPin className="h-4 w-4" />
                Intervalos
              </TabsTrigger>
              <TabsTrigger value="dates" className="flex items-center gap-2">
                <IconCalendar className="h-4 w-4" />
                Datas
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto mt-4">
              <TabsContent value="basic" className="mt-0">
                <TruckBasicFilters
                  hasGarage={filterState.hasGarage}
                  hasPosition={filterState.hasPosition}
                  isParked={filterState.isParked}
                  onHasGarageChange={(value) => updateFilter("hasGarage", value)}
                  onHasPositionChange={(value) => updateFilter("hasPosition", value)}
                  onIsParkedChange={(value) => updateFilter("isParked", value)}
                />
              </TabsContent>

              <TabsContent value="entities" className="mt-0">
                <TruckEntitySelectors
                  taskIds={filterState.taskIds || []}
                  garageIds={filterState.garageIds || []}
                  manufacturers={filterState.manufacturers || []}
                  plates={filterState.plates || []}
                  models={filterState.models || []}
                  onTaskIdsChange={(value) => updateFilter("taskIds", value)}
                  onGarageIdsChange={(value) => updateFilter("garageIds", value)}
                  onManufacturersChange={(value) => updateFilter("manufacturers", value)}
                  onPlatesChange={(value) => updateFilter("plates", value)}
                  onModelsChange={(value) => updateFilter("models", value)}
                />
              </TabsContent>

              <TabsContent value="ranges" className="mt-0">
                <TruckRangeFilters
                  xPositionRange={filterState.xPositionRange}
                  yPositionRange={filterState.yPositionRange}
                  onXPositionRangeChange={(value) => updateFilter("xPositionRange", value)}
                  onYPositionRangeChange={(value) => updateFilter("yPositionRange", value)}
                />
              </TabsContent>

              <TabsContent value="dates" className="mt-0">
                <TruckDateFilters
                  createdAt={filterState.createdAt}
                  updatedAt={filterState.updatedAt}
                  onCreatedAtChange={(value) => updateFilter("createdAt", value)}
                  onUpdatedAtChange={(value) => updateFilter("updatedAt", value)}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <Separator />

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleClear} disabled={getActiveFilterCount() === 0}>
            <IconX className="h-4 w-4 mr-2" />
            Limpar Filtros
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleApply}>Aplicar Filtros</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
