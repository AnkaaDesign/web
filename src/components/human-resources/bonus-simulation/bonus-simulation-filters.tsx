import React, { useState, useEffect, useMemo } from "react";
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
import { Combobox } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import {
  IconFilter,
  IconCheck,
  IconX,
  IconBuilding,
  IconUsers,
  IconBriefcase,
  IconUserCheck,
  IconUserMinus,
} from "@tabler/icons-react";
import { useUsers, usePositions } from "../../../hooks";
import { USER_STATUS } from "../../../constants";

interface BonusSimulationFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: {
    sectorIds: string[];
    positionIds: string[];
    includeUserIds: string[];
    excludeUserIds: string[];
    showOnlyEligible: boolean;
  };
  onApply: (filters: any) => void;
  onReset: () => void;
  sectors: Array<{ id: string; name: string }>;
}

export function BonusSimulationFilters({
  open,
  onOpenChange,
  filters,
  onApply,
  onReset,
  sectors
}: BonusSimulationFiltersProps) {
  const [localFilters, setLocalFilters] = useState(filters);

  // Fetch positions
  const { data: positionsData } = usePositions({
    orderBy: { name: "asc" },
    limit: 100
  });

  const positions = positionsData?.data || [];

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
    if (localFilters.sectorIds.length > 0) {
      filtered = filtered.filter(user =>
        user.sectorId && localFilters.sectorIds.includes(user.sectorId)
      );
    }

    // Filter by selected positions
    if (localFilters.positionIds.length > 0) {
      filtered = filtered.filter(user =>
        user.positionId && localFilters.positionIds.includes(user.positionId)
      );
    }

    return filtered;
  }, [allUsers, localFilters.sectorIds, localFilters.positionIds]);

  // Sync local filters when modal opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  // Count active filters
  const totalActiveFilters = useMemo(() => {
    let count = 0;
    if (localFilters.sectorIds.length > 0) count++;
    if (localFilters.positionIds.length > 0) count++;
    if (localFilters.includeUserIds.length > 0) count++;
    if (localFilters.excludeUserIds.length > 0) count++;
    if (!localFilters.showOnlyEligible) count++; // Showing all users is a filter
    return count;
  }, [localFilters]);

  // Check if user has manually applied filters
  const hasManualFilters =
    localFilters.sectorIds.length > 0 ||
    localFilters.positionIds.length > 0 ||
    localFilters.includeUserIds.length > 0 ||
    localFilters.excludeUserIds.length > 0;

  // Handle input changes
  const handleSectorsChange = (selectedIds: string[]) => {
    setLocalFilters(prev => ({
      ...prev,
      sectorIds: selectedIds,
      // Clear include/exclude users when sector changes as they may no longer be valid
      includeUserIds: [],
      excludeUserIds: [],
      // Disable "only eligible" when manual filters are applied
      showOnlyEligible: selectedIds.length === 0 ? prev.showOnlyEligible : false
    }));
  };

  const handlePositionsChange = (selectedIds: string[]) => {
    setLocalFilters(prev => ({
      ...prev,
      positionIds: selectedIds,
      // Clear include/exclude users when position changes as they may no longer be valid
      includeUserIds: [],
      excludeUserIds: [],
      // Disable "only eligible" when manual filters are applied
      showOnlyEligible: selectedIds.length === 0 ? prev.showOnlyEligible : false
    }));
  };

  const handleIncludeUsersChange = (selectedIds: string[]) => {
    setLocalFilters(prev => ({
      ...prev,
      includeUserIds: selectedIds,
      // Disable "only eligible" when manual filters are applied
      showOnlyEligible: selectedIds.length === 0 ? prev.showOnlyEligible : false
    }));
  };

  const handleExcludeUsersChange = (selectedIds: string[]) => {
    setLocalFilters(prev => ({
      ...prev,
      excludeUserIds: selectedIds,
      // Disable "only eligible" when manual filters are applied
      showOnlyEligible: selectedIds.length === 0 ? prev.showOnlyEligible : false
    }));
  };

  const handleShowOnlyEligibleChange = (checked: boolean) => {
    if (checked) {
      // When turning ON, clear all other filters
      setLocalFilters(prev => ({
        ...prev,
        sectorIds: [],
        positionIds: [],
        includeUserIds: [],
        excludeUserIds: [],
        showOnlyEligible: true
      }));
    } else {
      setLocalFilters(prev => ({ ...prev, showOnlyEligible: false }));
    }
  };

  const handleClear = () => {
    const clearedFilters = {
      sectorIds: [],
      positionIds: [],
      includeUserIds: [],
      excludeUserIds: [],
      showOnlyEligible: true, // Default to showing only eligible
    };
    setLocalFilters(clearedFilters);
  };

  const handleApply = () => {
    onApply(localFilters);
    onOpenChange(false);
  };

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
            Filtros de Simulação
            {totalActiveFilters > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totalActiveFilters} {totalActiveFilters === 1 ? 'ativo' : 'ativos'}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Configure os filtros para personalizar a simulação de bonificação
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
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
              value={localFilters.sectorIds}
              onValueChange={handleSectorsChange}
              className="w-full"
              searchable={true}
              clearable={true}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {localFilters.sectorIds.length || 0} setor(es) selecionado(s)
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
              value={localFilters.positionIds}
              onValueChange={handlePositionsChange}
              className="w-full"
              searchable={true}
              clearable={true}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {localFilters.positionIds.length || 0} cargo(s) selecionado(s)
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
              value={localFilters.includeUserIds}
              onValueChange={handleIncludeUsersChange}
              className="w-full"
              searchable={true}
              clearable={true}
              disabled={filteredUsers.length === 0}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {localFilters.includeUserIds.length || 0} usuário(s) incluído(s)
              {(localFilters.sectorIds.length > 0 || localFilters.positionIds.length > 0) &&
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
              value={localFilters.excludeUserIds}
              onValueChange={handleExcludeUsersChange}
              className="w-full"
              searchable={true}
              clearable={true}
              disabled={filteredUsers.length === 0}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {localFilters.excludeUserIds.length || 0} usuário(s) excluído(s)
              {(localFilters.sectorIds.length > 0 || localFilters.positionIds.length > 0) &&
                ` de ${filteredUsers.length} disponível(is)`
              }
            </p>
          </div>

          {/* Only Eligible Users Switch */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex flex-col gap-1">
              <Label htmlFor="only-eligible" className="text-sm font-medium cursor-pointer">
                Apenas Usuários Elegíveis
              </Label>
              <p className="text-xs text-muted-foreground">
                {hasManualFilters
                  ? 'Ativar irá limpar os outros filtros'
                  : 'Mostrar apenas usuários com bônus maior que zero'
                }
              </p>
            </div>
            <Switch
              id="only-eligible"
              checked={localFilters.showOnlyEligible}
              onCheckedChange={handleShowOnlyEligibleChange}
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
