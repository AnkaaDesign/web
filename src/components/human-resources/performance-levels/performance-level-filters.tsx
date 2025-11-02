import { useState, useEffect, useMemo, useCallback } from "react";
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
import { Combobox } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import {
  IconFilter,
  IconCheck,
  IconX,
  IconBuilding,
  IconBriefcase,
  IconUserCheck,
  IconUserMinus,
  IconChartBar,
} from "@tabler/icons-react";
import { useUsers, usePositions, useSectors } from "../../../hooks";
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
  sectorIds: string[];
  positionIds: string[];
  includeUserIds: string[];
  excludeUserIds: string[];
  showOnlyBonifiable: boolean;
}

export function PerformanceLevelFilters({
  open,
  onOpenChange,
  filters,
  onFilterChange,
}: PerformanceLevelFiltersProps) {
  // Fetch positions
  const { data: positionsData } = usePositions({
    orderBy: { name: "asc" },
    limit: 100
  });

  const positions = positionsData?.data || [];

  // Fetch sectors
  const { data: sectorsData } = useSectors({
    orderBy: { name: "asc" },
    limit: 100
  });

  const sectors = sectorsData?.data || [];

  // Local filter state
  const [localState, setLocalState] = useState<FilterState>({
    performanceMin: 0,
    performanceMax: 5,
    sectorIds: [],
    positionIds: [],
    includeUserIds: [],
    excludeUserIds: [],
    showOnlyBonifiable: true, // Default to showing only bonifiable positions
  });

  // Fetch all active contracted users for the user filters
  const { data: allUsersData } = useUsers({
    include: { position: true, sector: true },
    where: {
      status: USER_STATUS.CONTRACTED, // Only contracted users (not dismissed, not inactive)
    },
    orderBy: { name: "asc" },
    limit: 100, // API maximum limit
  });

  const allUsers = allUsersData?.data || [];

  // Filter users based on selected sectors and positions
  const filteredUsers = useMemo(() => {
    let filtered = allUsers;

    // Filter by selected sectors
    if (localState.sectorIds.length > 0) {
      filtered = filtered.filter(user =>
        user.sectorId && localState.sectorIds.includes(user.sectorId)
      );
    }

    // Filter by selected positions
    if (localState.positionIds.length > 0) {
      filtered = filtered.filter(user =>
        user.positionId && localState.positionIds.includes(user.positionId)
      );
    }

    return filtered;
  }, [allUsers, localState.sectorIds, localState.positionIds]);

  // Sync local filters when modal opens
  useEffect(() => {
    if (!open) return;

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

    // Extract user filters (include/exclude)
    let includeIds: string[] = [];
    let excludeIds: string[] = [];

    // Check for custom user filters in where clause
    if (where.id) {
      if (typeof where.id === 'object') {
        if ('in' in where.id) {
          includeIds = (where.id.in as string[]) || [];
        } else if ('notIn' in where.id) {
          excludeIds = (where.id.notIn as string[]) || [];
        }
      }
    }

    // Extract bonifiable filter
    let showBonifiable = true;
    if (where.position?.is?.bonifiable !== undefined) {
      showBonifiable = where.position.is.bonifiable === true;
    }

    setLocalState({
      performanceMin: perfMin,
      performanceMax: perfMax,
      sectorIds: secIds,
      positionIds: posIds,
      includeUserIds: includeIds,
      excludeUserIds: excludeIds,
      showOnlyBonifiable: showBonifiable,
    });
  }, [open, filters.where]);

  // Count active filters
  const totalActiveFilters = useMemo(() => {
    let count = 0;
    if (localState.performanceMin > 0 || localState.performanceMax < 5) count++;
    if (localState.sectorIds.length > 0) count++;
    if (localState.positionIds.length > 0) count++;
    if (localState.includeUserIds.length > 0) count++;
    if (localState.excludeUserIds.length > 0) count++;
    if (!localState.showOnlyBonifiable) count++; // Showing all users is a filter
    return count;
  }, [localState]);

  // Handle input changes
  const handleSectorsChange = (selectedIds: string[]) => {
    setLocalState(prev => ({
      ...prev,
      sectorIds: selectedIds,
      // Clear include/exclude users when sector changes as they may no longer be valid
      includeUserIds: [],
      excludeUserIds: []
    }));
  };

  const handlePositionsChange = (selectedIds: string[]) => {
    setLocalState(prev => ({
      ...prev,
      positionIds: selectedIds,
      // Clear include/exclude users when position changes as they may no longer be valid
      includeUserIds: [],
      excludeUserIds: []
    }));
  };

  const handleIncludeUsersChange = (selectedIds: string[]) => {
    setLocalState(prev => ({ ...prev, includeUserIds: selectedIds }));
  };

  const handleExcludeUsersChange = (selectedIds: string[]) => {
    setLocalState(prev => ({ ...prev, excludeUserIds: selectedIds }));
  };

  const handlePerformanceChange = ([min, max]: number[]) => {
    setLocalState(prev => ({
      ...prev,
      performanceMin: min,
      performanceMax: max
    }));
  };

  const handleShowOnlyBonifiableChange = (checked: boolean) => {
    setLocalState(prev => ({ ...prev, showOnlyBonifiable: checked }));
  };

  const handleClear = () => {
    const clearedFilters: FilterState = {
      performanceMin: 0,
      performanceMax: 5,
      sectorIds: [],
      positionIds: [],
      includeUserIds: [],
      excludeUserIds: [],
      showOnlyBonifiable: true, // Default to showing only bonifiable
    };
    setLocalState(clearedFilters);
  };

  const handleApply = useCallback(() => {
    const newWhere: any = {
      // Preserve existing where conditions (especially status: CONTRACTED)
      ...filters.where,
      status: USER_STATUS.CONTRACTED, // Always filter to CONTRACTED users
    };

    // Add performance level filter if not default
    if (localState.performanceMin > 0 || localState.performanceMax < 5) {
      newWhere.performanceLevel = {
        ...(localState.performanceMin > 0) && { gte: localState.performanceMin },
        ...(localState.performanceMax < 5) && { lte: localState.performanceMax }
      };
    } else {
      delete newWhere.performanceLevel;
    }

    // Add sector filter if selected
    if (localState.sectorIds.length > 0) {
      newWhere.sectorId = localState.sectorIds.length === 1
        ? localState.sectorIds[0]
        : { in: localState.sectorIds };
    } else {
      delete newWhere.sectorId;
    }

    // Add position filter if selected
    if (localState.positionIds.length > 0) {
      newWhere.positionId = localState.positionIds.length === 1
        ? localState.positionIds[0]
        : { in: localState.positionIds };
    } else {
      delete newWhere.positionId;
    }

    // Add bonifiable filter
    if (localState.showOnlyBonifiable) {
      newWhere.position = {
        is: {
          bonifiable: true
        }
      };
    } else {
      // Remove position filter if not filtering by bonifiable
      if (!newWhere.positionId) {
        delete newWhere.position;
      }
    }

    // Handle user inclusion (if specified, only show these users)
    if (localState.includeUserIds.length > 0) {
      newWhere.id = { in: localState.includeUserIds };
    } else if (localState.excludeUserIds.length > 0) {
      // Handle user exclusion
      newWhere.id = { notIn: localState.excludeUserIds };
    } else {
      delete newWhere.id;
    }

    const newFilters: Partial<UserGetManyFormData> = {
      ...filters,
      where: newWhere
    };

    onFilterChange(newFilters);
    onOpenChange(false);
  }, [filters, localState, onFilterChange, onOpenChange]);

  // Prepare sector options
  const sectorOptions = sectors.map(sector => ({
    value: sector.id,
    label: sector.name,
  }));

  // Prepare position options
  const positionOptions = positions.map(position => ({
    value: position.id,
    label: position.name,
  }));

  // Prepare user options (filtered by sector/position selection)
  const userOptions = filteredUsers.map(user => ({
    value: user.id,
    label: `${user.name}${user.sector?.name ? ` (${user.sector.name})` : ''}`,
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros
            {totalActiveFilters > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totalActiveFilters} {totalActiveFilters === 1 ? 'ativo' : 'ativos'}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Configure os filtros para personalizar a visualização
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Performance Level Filter */}
          <div>
            <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
              <IconChartBar size={16} />
              Nível de Desempenho
            </Label>
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

          {/* Sector Filter Section */}
          <div>
            <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
              <IconBuilding size={16} />
              Filtrar por Setores
            </Label>
            <Combobox
              mode="multiple"
              placeholder="Todos os setores"
              emptyText="Nenhum setor encontrado"
              searchPlaceholder="Buscar setores..."
              options={sectorOptions}
              value={localState.sectorIds}
              onValueChange={handleSectorsChange}
              className="w-full"
              searchable={true}
              clearable={true}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {localState.sectorIds.length || 0} setor(es) selecionado(s)
            </p>
          </div>

          {/* Position Filter Section */}
          <div>
            <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
              <IconBriefcase size={16} />
              Filtrar por Cargos
            </Label>
            <Combobox
              mode="multiple"
              placeholder="Todos os cargos"
              emptyText="Nenhum cargo encontrado"
              searchPlaceholder="Buscar cargos..."
              options={positionOptions}
              value={localState.positionIds}
              onValueChange={handlePositionsChange}
              className="w-full"
              searchable={true}
              clearable={true}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {localState.positionIds.length || 0} cargo(s) selecionado(s)
            </p>
          </div>

          {/* Include Specific Users Section */}
          <div>
            <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
              <IconUserCheck size={16} />
              Incluir Apenas os Usuários
            </Label>
            <Combobox
              mode="multiple"
              placeholder="Todos os usuários"
              emptyText="Nenhum usuário encontrado"
              searchPlaceholder="Buscar usuários..."
              options={userOptions}
              value={localState.includeUserIds}
              onValueChange={handleIncludeUsersChange}
              className="w-full"
              searchable={true}
              clearable={true}
              disabled={filteredUsers.length === 0}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {localState.includeUserIds.length || 0} usuário(s) incluído(s)
              {(localState.sectorIds.length > 0 || localState.positionIds.length > 0) &&
                ` de ${filteredUsers.length} disponível(is)`
              }
            </p>
          </div>

          {/* User Exclusion Section */}
          <div>
            <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
              <IconUserMinus size={16} />
              Excluir Usuários Específicos
            </Label>
            <Combobox
              mode="multiple"
              placeholder="Nenhuma exclusão"
              emptyText="Nenhum usuário encontrado"
              searchPlaceholder="Buscar usuários..."
              options={userOptions}
              value={localState.excludeUserIds}
              onValueChange={handleExcludeUsersChange}
              className="w-full"
              searchable={true}
              clearable={true}
              disabled={filteredUsers.length === 0}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {localState.excludeUserIds.length || 0} usuário(s) excluído(s)
              {(localState.sectorIds.length > 0 || localState.positionIds.length > 0) &&
                ` de ${filteredUsers.length} disponível(is)`
              }
            </p>
          </div>

          {/* Only Bonifiable Positions Switch */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex flex-col gap-1">
              <Label htmlFor="only-bonifiable" className="text-sm font-medium cursor-pointer">
                Apenas Cargos Bonificáveis
              </Label>
              <p className="text-xs text-muted-foreground">
                Mostrar apenas usuários com cargos elegíveis para bônus
              </p>
            </div>
            <Switch
              id="only-bonifiable"
              checked={localState.showOnlyBonifiable}
              onCheckedChange={handleShowOnlyBonifiableChange}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleClear}
              className="flex-1"
              disabled={totalActiveFilters === 0}
            >
              <IconX className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
            <Button onClick={handleApply} className="flex-1">
              <IconCheck className="h-4 w-4 mr-2" />
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
