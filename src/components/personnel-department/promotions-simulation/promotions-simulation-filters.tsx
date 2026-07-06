import { useState, useEffect, useMemo } from "react";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import {
  IconFilter,
  IconBuilding,
  IconBriefcase,
  IconUserCheck,
  IconUserMinus,
  IconCoin,
} from "@tabler/icons-react";
import { useUsers, usePositions } from "../../../hooks";
import { CONTRACT_STATUS, EMPLOYEE_TYPE } from "../../../constants";

interface PromotionsSimulationFiltersProps {
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

export function PromotionsSimulationFilters({
  open,
  onOpenChange,
  filters,
  onApply,
  onReset: _onReset,
  sectors
}: PromotionsSimulationFiltersProps) {
  const [localFilters, setLocalFilters] = useState(filters);

  // Fetch positions
  const { data: positionsData } = usePositions({
    orderBy: { name: "asc" },
    limit: 100
  });

  const positions = positionsData?.data || [];

  // Fetch all active CLT users for the user filters
  const { data: allUsersData } = useUsers({
    include: { position: true, sector: true },
    where: {
      currentEmployeeType: EMPLOYEE_TYPE.CLT,
      currentContractStatus: CONTRACT_STATUS.ACTIVE,
      secullumEmployeeId: { not: null }, // Only users registered in Secullum
    },
    orderBy: { name: "asc" },
    limit: 100, // API maximum limit
  });

  const allUsers = allUsersData?.data || [];

  // Filter users based on selected sectors and positions
  const filteredUsers = useMemo(() => {
    let filtered = allUsers;

    if (localFilters.sectorIds.length > 0) {
      filtered = filtered.filter(user =>
        user.sectorId && localFilters.sectorIds.includes(user.sectorId)
      );
    }

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
    if (localFilters.showOnlyEligible) count++; // Showing only bonus-eligible is a filter
    return count;
  }, [localFilters]);

  const handleSectorsChange = (selectedIds: string[]) => {
    setLocalFilters(prev => ({
      ...prev,
      sectorIds: selectedIds,
      includeUserIds: [],
      excludeUserIds: [],
    }));
  };

  const handlePositionsChange = (selectedIds: string[]) => {
    setLocalFilters(prev => ({
      ...prev,
      positionIds: selectedIds,
      includeUserIds: [],
      excludeUserIds: [],
    }));
  };

  const handleIncludeUsersChange = (selectedIds: string[]) => {
    setLocalFilters(prev => ({ ...prev, includeUserIds: selectedIds }));
  };

  const handleExcludeUsersChange = (selectedIds: string[]) => {
    setLocalFilters(prev => ({ ...prev, excludeUserIds: selectedIds }));
  };

  const handleShowOnlyEligibleChange = (checked: boolean) => {
    setLocalFilters(prev => ({ ...prev, showOnlyEligible: checked }));
  };

  const handleClear = () => {
    setLocalFilters({
      sectorIds: [],
      positionIds: [],
      includeUserIds: [],
      excludeUserIds: [],
      showOnlyEligible: false, // Promotions view shows all active collaborators by default
    });
  };

  const handleApply = () => {
    onApply(localFilters);
    onOpenChange(false);
  };

  const sectorOptions = sectors.map(sector => ({
    value: sector.id,
    label: sector.name,
  }));

  const positionOptions = positions.map(position => ({
    value: position.id,
    label: position.name,
  }));

  const userOptions = filteredUsers.map(user => ({
    value: user.id,
    label: `${user.name}${user.sector?.name ? ` (${user.sector.name})` : ''}`,
  }));

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros de Simulação"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Configure os filtros para personalizar a simulação de promoções"
      activeFilterCount={totalActiveFilters}
      onApply={handleApply}
      onReset={handleClear}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
    >
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
              onValueChange={(value) => handleSectorsChange(Array.isArray(value) ? value : value ? [value] : [])}
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
              onValueChange={(value) => handlePositionsChange(Array.isArray(value) ? value : value ? [value] : [])}
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
              onValueChange={(value) => handleIncludeUsersChange(Array.isArray(value) ? value : value ? [value] : [])}
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
              onValueChange={(value) => handleExcludeUsersChange(Array.isArray(value) ? value : value ? [value] : [])}
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

          {/* Only Bonus-Eligible Users */}
          <div>
            <Label htmlFor="only-eligible" className="text-sm font-medium mb-1.5 block flex items-center gap-2">
              <IconCoin size={16} />
              Apenas Elegíveis a Bônus
            </Label>
            <p className="text-xs text-muted-foreground mb-3">
              Mostrar apenas colaboradores com cargo bonificável e desempenho maior que zero
            </p>
            <Combobox
              mode="single"
              value={localFilters.showOnlyEligible ? "yes" : "no"}
              onValueChange={(value) => handleShowOnlyEligibleChange(value === "yes")}
              options={[
                { value: "no", label: "Todos os colaboradores" },
                { value: "yes", label: "Apenas elegíveis a bônus" },
              ]}
              placeholder="Selecione..."
              searchable={false}
            />
          </div>
    </FilterDrawer>
  );
}
