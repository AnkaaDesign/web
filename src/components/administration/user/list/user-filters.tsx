import { useState, useEffect, useCallback, useRef } from "react";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { getPositions, getSectors } from "../../../../api-client";
import { CONTRACT_TYPE_LABELS, CONTRACT_STATUS_LABELS, EMPLOYEE_TYPE_LABELS } from "../../../../constants";
import { Combobox } from "@/components/ui/combobox";
import { IconFilter, IconUser, IconBriefcase, IconBuilding, IconCalendar, IconEye, IconActivity, IconId } from "@tabler/icons-react";
import type { UserGetManyFormData } from "../../../../schemas";

interface UserFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<UserGetManyFormData>;
  onFilterChange: (filters: Partial<UserGetManyFormData>) => void;
}

export function UserFilters({ open, onOpenChange, filters, onFilterChange }: UserFiltersProps) {
  // Cache refs for selected items in multiple mode
  const positionCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());
  const sectorCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());

  // Local state for immediate UI updates
  const [localFilters, setLocalFilters] = useState(filters);

  // Sync local state with URL filters when modal opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  // Get current values for multi-select components
  const selectedContractTypes = localFilters.contractTypes || [];
  const selectedContractStatuses = localFilters.contractStatuses || [];
  const selectedEmployeeTypes = localFilters.employeeTypes || [];
  const selectedPositions = localFilters.positionId || [];
  const selectedSectors = localFilters.sectorId || [];

  // "Exibir" tri-state derived from isActive: true → Ativos, false → Demitidos, undefined → Todos.
  const exibirValue = localFilters.isActive === true ? "active" : localFilters.isActive === false ? "dismissed" : "all";

  const handleApplyFilters = () => {
    // Apply all filters at once using the external callback
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleResetFilters = () => {
    // Reset using the external callback
    onFilterChange({});
    setLocalFilters({});
    onOpenChange(false);
  };

  const handleContractTypeChange = (contractTypes: string[]) => {
    setLocalFilters({ ...localFilters, contractTypes: contractTypes.length > 0 ? (contractTypes as any) : undefined });
  };

  const handleContractStatusChange = (contractStatuses: string[]) => {
    setLocalFilters({ ...localFilters, contractStatuses: contractStatuses.length > 0 ? (contractStatuses as any) : undefined });
  };

  const handleEmployeeTypeChange = (employeeTypes: string[]) => {
    setLocalFilters({ ...localFilters, employeeTypes: employeeTypes.length > 0 ? (employeeTypes as any) : undefined });
  };

  const handleExibirChange = (value: string) => {
    // active → isActive:true; dismissed → isActive:false; all → omit isActive.
    if (value === "active") setLocalFilters({ ...localFilters, isActive: true });
    else if (value === "dismissed") setLocalFilters({ ...localFilters, isActive: false });
    else {
      const { isActive: _removed, ...rest } = localFilters;
      setLocalFilters(rest);
    }
  };

  // Dismissal/admission date ranges now live on the related current EmploymentContract.
  // We read/write them through the `where.currentContract.is` relation filter
  // (terminationDate = dismissal, exp1EndAt = first experience-period end).
  const currentContractIs = ((localFilters.where as any)?.currentContract?.is ?? {}) as {
    terminationDate?: { gte?: Date; lte?: Date };
    exp1EndAt?: { gte?: Date; lte?: Date };
  };
  const dismissedRange = currentContractIs.terminationDate ?? {};
  const exp1EndRange = currentContractIs.exp1EndAt ?? {};

  const writeCurrentContractDate = (
    field: "terminationDate" | "exp1EndAt",
    range: { gte?: Date; lte?: Date },
  ) => {
    const nextIs: any = { ...currentContractIs };
    const cleaned: { gte?: Date; lte?: Date } = {
      ...(range.gte && { gte: range.gte }),
      ...(range.lte && { lte: range.lte }),
    };
    if (cleaned.gte || cleaned.lte) {
      nextIs[field] = cleaned;
    } else {
      delete nextIs[field];
    }

    const nextWhere: any = { ...(localFilters.where as any) };
    if (Object.keys(nextIs).length > 0) {
      nextWhere.currentContract = { is: nextIs };
    } else {
      delete nextWhere.currentContract;
    }

    setLocalFilters({
      ...localFilters,
      where: Object.keys(nextWhere).length > 0 ? nextWhere : undefined,
    });
  };

  const setDismissedRange = (range: { gte?: Date; lte?: Date }) => writeCurrentContractDate("terminationDate", range);
  const setExp1EndRange = (range: { gte?: Date; lte?: Date }) => writeCurrentContractDate("exp1EndAt", range);

  const handlePositionChange = (positions: string[]) => {
    setLocalFilters({ ...localFilters, positionId: positions.length > 0 ? positions : undefined });
  };

  const handleSectorChange = (sectors: string[]) => {
    setLocalFilters({ ...localFilters, sectorId: sectors.length > 0 ? sectors : undefined });
  };

  // Contract type options (static, no async needed)
  const contractTypeOptions = Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const contractStatusOptions = Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const employeeTypeOptions = Object.entries(EMPLOYEE_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const exibirOptions = [
    { value: "active", label: "Ativos" },
    { value: "dismissed", label: "Desligados" },
    { value: "all", label: "Todos" },
  ];

  // Async query function for positions
  const queryPositions = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
      };

      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getPositions(queryParams);
      const positions = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = positions.map((position) => {
        const option = {
          value: position.id,
          label: position.name,
        };
        // Add to cache for multiple mode
        positionCacheRef.current.set(position.id, option);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      console.error("Error fetching positions:", error);
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  // Async query function for sectors
  const querySectors = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
      };

      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getSectors(queryParams);
      const sectors = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = sectors.map((sector) => {
        const option = {
          value: sector.id,
          label: sector.name,
        };
        // Add to cache for multiple mode
        sectorCacheRef.current.set(sector.id, option);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      console.error("Error fetching sectors:", error);
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  // Count active filters
  const activeFilterCount = Object.entries(localFilters).filter(([key, value]) => {
    if (key === "page" || key === "limit" || key === "itemsPerPage" || key === "orderBy" || key === "sortOrder") return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
    return value !== undefined && value !== null && value !== "";
  }).length;

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros Avançados"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Filtre os usuários por tipo de contrato, cargo, setor, datas de nascimento, demissão e contratação"
      activeFilterCount={activeFilterCount}
      onApply={handleApplyFilters}
      onReset={handleResetFilters}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
    >
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <IconEye className="h-4 w-4" />
                Exibir
              </Label>
              <Combobox
                mode="single"
                options={exibirOptions}
                value={exibirValue}
                onValueChange={(value) => handleExibirChange(typeof value === "string" ? value : "all")}
                placeholder="Selecione quais colaboradores exibir"
                searchable={false}
                clearable={false}
              />
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-2">
                <IconActivity className="h-4 w-4" />
                Situação
              </Label>
              <Combobox
                mode="multiple"
                options={contractStatusOptions}
                value={selectedContractStatuses}
                onValueChange={(value) => {
                  const arr = Array.isArray(value) ? value : (value ? [value] : []);
                  handleContractStatusChange(arr);
                }}
                placeholder="Selecione as situações"
                searchable={true}
                minSearchLength={0}
              />
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-2">
                <IconUser className="h-4 w-4" />
                Modalidade
              </Label>
              <Combobox
                mode="multiple"
                options={contractTypeOptions}
                value={selectedContractTypes}
                onValueChange={(value) => {
                  const arr = Array.isArray(value) ? value : (value ? [value] : []);
                  handleContractTypeChange(arr);
                }}
                placeholder="Selecione as modalidades de contrato"
                searchable={true}
                minSearchLength={0}
              />
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-2">
                <IconId className="h-4 w-4" />
                Categoria
              </Label>
              <Combobox
                mode="multiple"
                options={employeeTypeOptions}
                value={selectedEmployeeTypes}
                onValueChange={(value) => {
                  const arr = Array.isArray(value) ? value : (value ? [value] : []);
                  handleEmployeeTypeChange(arr);
                }}
                placeholder="Selecione as categorias"
                searchable={true}
                minSearchLength={0}
              />
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-2">
                <IconBriefcase className="h-4 w-4" />
                Cargo
              </Label>
              <Combobox
                async={true}
                mode="multiple"
                queryKey={["positions"]}
                queryFn={queryPositions}
                initialOptions={[]}
                value={selectedPositions}
                onValueChange={(value) => {
                  const arr = Array.isArray(value) ? value : (value ? [value] : []);
                  handlePositionChange(arr);
                }}
                placeholder="Selecione os cargos"
                searchable={true}
                minSearchLength={0}
                pageSize={50}
                debounceMs={300}
              />
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-2">
                <IconBuilding className="h-4 w-4" />
                Setor
              </Label>
              <Combobox
                async={true}
                mode="multiple"
                queryKey={["sectors"]}
                queryFn={querySectors}
                initialOptions={[]}
                value={selectedSectors}
                onValueChange={(value) => {
                  const arr = Array.isArray(value) ? value : (value ? [value] : []);
                  handleSectorChange(arr);
                }}
                placeholder="Selecione os setores"
                searchable={true}
                minSearchLength={0}
                pageSize={50}
                debounceMs={300}
              />
            </div>

            <div className="space-y-6">
              {/* Birth Date Range */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <IconCalendar className="h-4 w-4" />
                  Data de Nascimento
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                    <DateTimeInput
                      mode="date"
                      value={localFilters.birth?.gte}
                      onChange={(date) => {
                        const dateValue = date instanceof Date ? date : null;
                        if (!dateValue && !localFilters.birth?.lte) {
                          setLocalFilters({ ...localFilters, birth: undefined });
                        } else {
                          setLocalFilters({
                            ...localFilters,
                            birth: {
                              ...(dateValue && { gte: dateValue }),
                              ...(localFilters.birth?.lte && { lte: localFilters.birth.lte }),
                            },
                          });
                        }
                      }}
                      hideLabel
                      placeholder="Selecionar data inicial..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                    <DateTimeInput
                      mode="date"
                      value={localFilters.birth?.lte}
                      onChange={(date) => {
                        const dateValue = date instanceof Date ? date : null;
                        if (!dateValue && !localFilters.birth?.gte) {
                          setLocalFilters({ ...localFilters, birth: undefined });
                        } else {
                          setLocalFilters({
                            ...localFilters,
                            birth: {
                              ...(localFilters.birth?.gte && { gte: localFilters.birth.gte }),
                              ...(dateValue && { lte: dateValue }),
                            },
                          });
                        }
                      }}
                      hideLabel
                      placeholder="Selecionar data final..."
                    />
                  </div>
                </div>
              </div>

              {/* Dismissed Date Range — maps onto the current EmploymentContract's
                  terminationDate via the currentContract relation filter. */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <IconCalendar className="h-4 w-4" />
                  Data de Demissão
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                    <DateTimeInput
                      mode="date"
                      value={dismissedRange.gte}
                      onChange={(date) => {
                        const dateValue = date instanceof Date ? date : null;
                        setDismissedRange({ ...dismissedRange, gte: dateValue ?? undefined });
                      }}
                      hideLabel
                      placeholder="Selecionar data inicial..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                    <DateTimeInput
                      mode="date"
                      value={dismissedRange.lte}
                      onChange={(date) => {
                        const dateValue = date instanceof Date ? date : null;
                        setDismissedRange({ ...dismissedRange, lte: dateValue ?? undefined });
                      }}
                      hideLabel
                      placeholder="Selecionar data final..."
                    />
                  </div>
                </div>
              </div>

              {/* Exp1 End Date Range — maps onto the current EmploymentContract's
                  exp1EndAt via the currentContract relation filter. */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <IconCalendar className="h-4 w-4" />
                  Data de Contratação
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                    <DateTimeInput
                      mode="date"
                      value={exp1EndRange.gte}
                      onChange={(date) => {
                        const dateValue = date instanceof Date ? date : null;
                        setExp1EndRange({ ...exp1EndRange, gte: dateValue ?? undefined });
                      }}
                      hideLabel
                      placeholder="Selecionar data inicial..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                    <DateTimeInput
                      mode="date"
                      value={exp1EndRange.lte}
                      onChange={(date) => {
                        const dateValue = date instanceof Date ? date : null;
                        setExp1EndRange({ ...exp1EndRange, lte: dateValue ?? undefined });
                      }}
                      hideLabel
                      placeholder="Selecionar data final..."
                    />
                  </div>
                </div>
              </div>
            </div>
    </FilterDrawer>
  );
}
