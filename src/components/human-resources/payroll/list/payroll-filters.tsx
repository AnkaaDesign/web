import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { IconFilter, IconX, IconCheck, IconBuilding, IconBriefcase, IconUserCheck } from "@tabler/icons-react";
import type { UserGetManyFormData } from "../../../../schemas";
import { useUsers, useSectors, usePositions } from "../../../../hooks";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { getCurrentPayrollPeriod } from "../../../../utils";

// Extended filters with UI-only fields for payroll
interface PayrollFiltersData extends Partial<UserGetManyFormData> {
  year?: number;
  months?: string[];
  sectorIds?: string[];
  positionIds?: string[];
  userIds?: string[];
}

interface PayrollFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: PayrollFiltersData;
  onApplyFilters: (filters: PayrollFiltersData) => void;
}

export function PayrollFilters({ open, onOpenChange, filters, onApplyFilters }: PayrollFiltersProps) {
  // Local state for filter values
  const [localFilters, setLocalFilters] = useState<PayrollFiltersData>(filters);

  // Load entities for selectors
  const { data: usersData } = useUsers({
    orderBy: { name: "asc" },
    include: { position: true, sector: true },
    where: {
      // Only active users with payroll number
      isActive: true,
      payrollNumber: { not: null },
    },
    limit: 100, // Max 100 due to API limit
  });

  const { data: sectorsData } = useSectors({
    orderBy: { name: "asc" },
    limit: 100, // Max 100 due to API limit
  });

  // Get default sector IDs - show all sectors by default
  // Previously filtered to only PRODUCTION/WAREHOUSE/LEADER which was hiding users in other sectors
  const defaultSectorIds = useMemo(() => {
    return []; // Empty array = show all sectors
  }, []);

  const { data: positionsData } = usePositions({
    orderBy: { name: "asc" },
    include: { remunerations: true },
    limit: 100, // Max 100 due to API limit
  });

  // Reset local filters when modal opens and set defaults if needed
  useEffect(() => {
    if (open) {
      // If no year/month selected, default to current period using 5th day rule
      if (!filters.year && (!filters.months || filters.months.length === 0)) {
        const { year, month } = getCurrentPayrollPeriod();

        setLocalFilters({
          ...filters,
          year: year,
          months: [String(month).padStart(2, '0')],
          // Set default sectors if not already set
          sectorIds: filters.sectorIds || defaultSectorIds
        });
      } else {
        setLocalFilters({
          ...filters,
          // Set default sectors if not already set
          sectorIds: filters.sectorIds || defaultSectorIds
        });
      }
    }
  }, [open, filters, defaultSectorIds]);

  // Filter users based on selected sectors and positions
  const filteredUsers = useMemo(() => {
    let filtered = usersData?.data || [];

    // Filter by selected sectors
    if (localFilters.sectorIds && localFilters.sectorIds.length > 0) {
      filtered = filtered.filter(user =>
        user.sectorId && localFilters.sectorIds!.includes(user.sectorId)
      );
    }

    // Filter by selected positions
    if (localFilters.positionIds && localFilters.positionIds.length > 0) {
      filtered = filtered.filter(user =>
        user.positionId && localFilters.positionIds!.includes(user.positionId)
      );
    }

    return filtered;
  }, [usersData?.data, localFilters.sectorIds, localFilters.positionIds]);

  // Count total active filters
  const totalActiveFilters = useMemo(() => {
    let count = 0;
    if (localFilters.sectorIds && localFilters.sectorIds.length > 0) count++;
    if (localFilters.positionIds && localFilters.positionIds.length > 0) count++;
    if (localFilters.userIds && localFilters.userIds.length > 0) count++;
    return count;
  }, [localFilters]);

  const handleApply = () => {
    onApplyFilters(localFilters);
  };

  const handleClear = () => {
    // Get current period using 5th day rule
    const { year, month } = getCurrentPayrollPeriod();

    setLocalFilters({
      year: year,
      months: [String(month).padStart(2, '0')],
      sectorIds: [],
      positionIds: [],
      userIds: [],
    });
  };

  // Handle filter changes with user list clearing
  const handleSectorsChange = (selectedIds: string[]) => {
    setLocalFilters(prev => ({
      ...prev,
      sectorIds: selectedIds,
      // Clear users when sector changes
      userIds: [],
    }));
  };

  const handlePositionsChange = (selectedIds: string[]) => {
    setLocalFilters(prev => ({
      ...prev,
      positionIds: selectedIds,
      // Clear users when position changes
      userIds: [],
    }));
  };

  const handleUsersChange = (selectedIds: string[]) => {
    setLocalFilters(prev => ({
      ...prev,
      userIds: selectedIds,
      // Clear sector and position filters when specific users are selected
      // This allows viewing users regardless of their sector/position
      sectorIds: selectedIds.length > 0 ? [] : prev.sectorIds,
      positionIds: selectedIds.length > 0 ? [] : prev.positionIds,
    }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter size={20} />
            Filtros de Folha de Pagamento
            {totalActiveFilters > 0 && (
              <Badge variant="secondary" className="ml-2">
                {totalActiveFilters} {totalActiveFilters === 1 ? "ativo" : "ativos"}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>Configure os filtros para refinar a visualização da folha de pagamento.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Year and Month Selection */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Ano e Mês</Label>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <Combobox
                  value={localFilters.year?.toString() || ""}
                  onValueChange={(year) => {
                    const yearValue = Array.isArray(year) ? year[0] : year;
                    const newYear = yearValue ? parseInt(yearValue) : undefined;
                    setLocalFilters({
                      ...localFilters,
                      year: newYear,
                      months: newYear ? localFilters.months : undefined
                    });
                  }}
                  options={(() => {
                    const years: ComboboxOption[] = [];
                    const currentYear = new Date().getFullYear();
                    // Show current year and 3 years behind
                    for (let i = 0; i <= 3; i++) {
                      const year = currentYear - i;
                      years.push({
                        value: year.toString(),
                        label: year.toString(),
                      });
                    }
                    return years;
                  })()}
                  placeholder="Ano..."
                  searchable={false}
                  clearable={false}
                />
              </div>
              <div className="col-span-2">
                <Combobox
                  mode="multiple"
                  value={localFilters.months || []}
                  onValueChange={(months) => setLocalFilters({ ...localFilters, months: Array.isArray(months) ? months : months ? [months] : undefined })}
                  options={[
                    { value: "01", label: "Janeiro" },
                    { value: "02", label: "Fevereiro" },
                    { value: "03", label: "Março" },
                    { value: "04", label: "Abril" },
                    { value: "05", label: "Maio" },
                    { value: "06", label: "Junho" },
                    { value: "07", label: "Julho" },
                    { value: "08", label: "Agosto" },
                    { value: "09", label: "Setembro" },
                    { value: "10", label: "Outubro" },
                    { value: "11", label: "Novembro" },
                    { value: "12", label: "Dezembro" },
                  ]}
                  placeholder={localFilters.year ? "Selecione os meses..." : "Selecione um ano primeiro"}
                  searchPlaceholder="Buscar meses..."
                  emptyText="Nenhum mês encontrado"
                  disabled={!localFilters.year}
                  searchable={true}
                  clearable={false}
                  hideDefaultBadges={true}
                />
              </div>
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
              options={sectorsData?.data?.map(sector => ({
                value: sector.id,
                label: sector.name,
              })) || []}
              value={localFilters.sectorIds || []}
              onValueChange={(value) => handleSectorsChange(Array.isArray(value) ? value : value ? [value] : [])}
              className="w-full"
              searchable={true}
              clearable={true}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {localFilters.sectorIds?.length || 0} setor(es) selecionado(s)
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
              options={positionsData?.data?.map(position => ({
                value: position.id,
                label: position.name,
              })) || []}
              value={localFilters.positionIds || []}
              onValueChange={(value) => handlePositionsChange(Array.isArray(value) ? value : value ? [value] : [])}
              className="w-full"
              searchable={true}
              clearable={true}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {localFilters.positionIds?.length || 0} cargo(s) selecionado(s)
            </p>
          </div>

          {/* Users Filter Section */}
          <div>
            <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
              <IconUserCheck size={16} />
              Filtrar por Colaboradores
            </Label>
            <Combobox
              mode="multiple"
              placeholder="Todos os colaboradores"
              emptyText="Nenhum colaborador encontrado"
              searchPlaceholder="Buscar colaboradores..."
              options={filteredUsers.map(user => ({
                value: user.id,
                label: `${user.name}${user.sector?.name ? ` (${user.sector.name})` : ''}`,
              }))}
              value={localFilters.userIds || []}
              onValueChange={(value) => handleUsersChange(Array.isArray(value) ? value : value ? [value] : [])}
              className="w-full"
              searchable={true}
              clearable={true}
              disabled={filteredUsers.length === 0}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {localFilters.userIds?.length || 0} colaborador(es) selecionado(s)
              {(localFilters.sectorIds && localFilters.sectorIds.length > 0) || (localFilters.positionIds && localFilters.positionIds.length > 0)
                ? ` de ${filteredUsers.length} disponível(is)`
                : ''
              }
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-6 pt-4 border-t">
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