import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Combobox } from "@/components/ui/combobox";
import { IconFilter, IconBriefcase, IconBuilding, IconX } from "@tabler/icons-react";
import { usePositions, useSectors } from "../../../hooks";
import { USER_STATUS } from "../../../constants";
import type { UserGetManyFormData } from "../../../schemas";

interface PerformanceLevelFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<UserGetManyFormData>;
  onFilterChange: (filters: Partial<UserGetManyFormData>) => void;
}

interface FilterState {
  performanceMin: number;
  performanceMax: number;
  positionIds: string[];
  sectorIds: string[];
}

export function PerformanceLevelFilters({
  open,
  onOpenChange,
  filters,
  onFilterChange,
}: PerformanceLevelFiltersProps) {
  // Load entity data
  const { data: positionsData } = usePositions({ orderBy: { name: "asc" }, limit: 100 });
  const { data: sectorsData } = useSectors({ orderBy: { name: "asc" }, limit: 100 });

  const positions = positionsData?.data || [];
  const sectors = sectorsData?.data || [];

  // Get default sector IDs (production, warehouse, leader privileges)
  const defaultSectorIds = useMemo(() => {
    if (!sectorsData?.data) return [];

    return sectorsData.data
      .filter(sector =>
        sector.privilege === 'PRODUCTION' ||
        sector.privilege === 'WAREHOUSE' ||
        sector.privilege === 'LEADER'
      )
      .map(sector => sector.id);
  }, [sectorsData?.data]);

  // Create options for comboboxes with memoization
  const positionOptions = useMemo(() =>
    positions.map((position) => ({
      value: position.id,
      label: position.name,
    })), [positions]);

  const sectorOptions = useMemo(() =>
    sectors.map((sector) => ({
      value: sector.id,
      label: sector.name,
    })), [sectors]);

  // Local filter state - initialize with defaults
  const [localState, setLocalState] = useState<FilterState>({
    performanceMin: 0,
    performanceMax: 5,
    positionIds: [],
    sectorIds: defaultSectorIds, // Set default sectors on initialization
  });

  // Keep track of last filters to avoid unnecessary updates
  const lastFiltersRef = useRef<string>("");

  // Initialize from filters when dialog opens
  useEffect(() => {
    if (!open) return;

    // Create a stable string representation of filters
    const currentFiltersStr = JSON.stringify(filters.where);

    // Only process if filters have actually changed
    if (lastFiltersRef.current === currentFiltersStr) return;
    lastFiltersRef.current = currentFiltersStr;

    const where = filters.where || {};

    // Extract performance level range
    let perfMin = 0;
    let perfMax = 5;
    if (where.performanceLevel && typeof where.performanceLevel === 'object') {
      if ('gte' in where.performanceLevel) perfMin = where.performanceLevel.gte || 0;
      if ('lte' in where.performanceLevel) perfMax = where.performanceLevel.lte || 5;
    }

    // Extract position IDs
    let posIds: string[] = [];
    if (where.positionId) {
      if (typeof where.positionId === 'object' && 'in' in where.positionId) {
        posIds = where.positionId.in || [];
      } else if (typeof where.positionId === 'string') {
        posIds = [where.positionId];
      }
    }

    // Extract sector IDs
    let secIds: string[] = [];
    if (where.sectorId) {
      if (typeof where.sectorId === 'object' && 'in' in where.sectorId) {
        secIds = where.sectorId.in || [];
      } else if (typeof where.sectorId === 'string') {
        secIds = [where.sectorId];
      }
    }

    // Use defaults if no sectors are specified
    if (secIds.length === 0) {
      secIds = defaultSectorIds;
    }

    setLocalState({
      performanceMin: perfMin,
      performanceMax: perfMax,
      positionIds: posIds,
      sectorIds: secIds,
    });
  }, [open, filters.where, defaultSectorIds]);

  // Handle position selection change
  const handlePositionChange = useCallback((positions: string[]) => {
    setLocalState(prev => ({
      ...prev,
      positionIds: positions
    }));
  }, []);

  // Handle sector selection change
  const handleSectorChange = useCallback((sectors: string[]) => {
    setLocalState(prev => ({
      ...prev,
      sectorIds: sectors
    }));
  }, []);

  // Handle performance level change
  const handlePerformanceChange = useCallback(([min, max]: number[]) => {
    setLocalState(prev => ({
      ...prev,
      performanceMin: min,
      performanceMax: max
    }));
  }, []);

  // Reset filters
  const handleReset = useCallback(() => {
    setLocalState({
      performanceMin: 0,
      performanceMax: 5,
      positionIds: [],
      sectorIds: [],
    });

    // Also apply reset immediately to clear filters from the parent
    const resetFilters: Partial<UserGetManyFormData> = {
      ...filters,
      where: {
        // Preserve existing where conditions except the ones we're resetting
        ...filters.where,
        isActive: true,
        performanceLevel: undefined,
        positionId: undefined,
        sectorId: undefined
      }
    };

    onFilterChange(resetFilters);
  }, [filters, onFilterChange]);

  // Apply filters with memoization to prevent unnecessary updates
  const handleApply = useCallback(() => {
    const newFilters: Partial<UserGetManyFormData> = {
      ...filters,
      where: {
        // Preserve existing where conditions
        ...filters.where,

        // Always filter to show only active users by default
        isActive: true,

        // Add performance level filter if not default
        ...(localState.performanceMin > 0 || localState.performanceMax < 5) && {
          performanceLevel: {
            ...(localState.performanceMin > 0) && { gte: localState.performanceMin },
            ...(localState.performanceMax < 5) && { lte: localState.performanceMax }
          }
        },

        // Add position filter if selected
        ...(localState.positionIds.length > 0) && {
          positionId: localState.positionIds.length === 1
            ? localState.positionIds[0]
            : { in: localState.positionIds }
        },

        // Add sector filter if selected
        ...(localState.sectorIds.length > 0) && {
          sectorId: localState.sectorIds.length === 1
            ? localState.sectorIds[0]
            : { in: localState.sectorIds }
        }
      }
    };

    // Only call if filters actually changed
    const currentFiltersStr = JSON.stringify(filters);
    const newFiltersStr = JSON.stringify(newFilters);

    if (currentFiltersStr !== newFiltersStr) {
      onFilterChange(newFilters);
    }
    onOpenChange(false);
  }, [filters, localState, onFilterChange, onOpenChange]);

  // Count active filters
  const activeFilterCount =
    (localState.performanceMin > 0 || localState.performanceMax < 5 ? 1 : 0) +
    (localState.positionIds.length > 0 ? 1 : 0) +
    (localState.sectorIds.length > 0 ? 1 : 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount} {activeFilterCount === 1 ? "ativo" : "ativos"}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Filtre usuários por nível de desempenho, cargo e setor
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Performance Level Filter */}
          <div className="space-y-3">
            <Label>Nível de Desempenho</Label>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Mínimo: {localState.performanceMin}</span>
                <span>Máximo: {localState.performanceMax}</span>
              </div>
              <Slider
                value={[localState.performanceMin, localState.performanceMax]}
                onValueChange={handlePerformanceChange}
                min={0}
                max={5}
                step={1}
                className="w-full"
              />
            </div>
          </div>

          <Separator />

          {/* Position Filter */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <IconBriefcase className="h-4 w-4" />
              Cargos
            </Label>
            <Combobox
              mode="multiple"
              options={positionOptions}
              value={localState.positionIds}
              onValueChange={handlePositionChange}
              placeholder="Selecione os cargos"
              emptyText="Nenhum cargo encontrado"
              searchPlaceholder="Buscar cargos..."
              searchable={true}
              clearable={true}
              hideDefaultBadges={true}
            />
          </div>

          <Separator />

          {/* Sector Filter */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <IconBuilding className="h-4 w-4" />
              Setores
            </Label>
            <Combobox
              mode="multiple"
              options={sectorOptions}
              value={localState.sectorIds}
              onValueChange={handleSectorChange}
              placeholder="Selecione os setores"
              emptyText="Nenhum setor encontrado"
              searchPlaceholder="Buscar setores..."
              searchable={true}
              clearable={true}
              hideDefaultBadges={true}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              <IconX className="h-4 w-4 mr-2" />
              Limpar filtros
            </Button>
            <Button onClick={handleApply} className="flex-1">
              Aplicar filtros
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}