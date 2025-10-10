import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IconFilter, IconX, IconCheck } from "@tabler/icons-react";
import type { UserGetManyFormData } from "../../../../schemas";
import { useUsers, useSectors, usePositions } from "../../../../hooks";
import { USER_STATUS } from "../../../../constants";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

// Extended filters with UI-only fields for payroll
interface PayrollFiltersData extends Partial<UserGetManyFormData> {
  year?: number;
  months?: string[];
  performanceLevels?: number[];
  excludeUserIds?: string[]; // New field for excluding users
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
    where: { status: { not: USER_STATUS.DISMISSED } }, // Only non-dismissed users for payroll
    limit: 100, // Max 100 due to API limit
  });

  const { data: sectorsData } = useSectors({
    orderBy: { name: "asc" },
    limit: 100, // Max 100 due to API limit
  });

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

  const { data: positionsData } = usePositions({
    orderBy: { name: "asc" },
    include: { remunerations: true },
    limit: 100, // Max 100 due to API limit
  });

  // Reset local filters when modal opens and set defaults if needed
  useEffect(() => {
    if (open) {
      // If no year/month selected, default to current year/month (with 26th cutoff)
      if (!filters.year && (!filters.months || filters.months.length === 0)) {
        const now = new Date();
        const currentDay = now.getDate();
        let currentYear = now.getFullYear();
        let currentMonth = now.getMonth() + 1; // 1-indexed

        // If today is after the 26th, default to NEXT month
        if (currentDay > 26) {
          currentMonth += 1;
          if (currentMonth > 12) {
            currentMonth = 1;
            currentYear += 1;
          }
        }

        setLocalFilters({
          ...filters,
          year: currentYear,
          months: [String(currentMonth).padStart(2, '0')],
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

  // Count total active filters
  const totalActiveFilters =
    (localFilters.year ? 1 : 0) +
    (localFilters.months?.length || 0) +
    (localFilters.userIds?.length || 0) +
    (localFilters.excludeUserIds?.length || 0) +
    (localFilters.sectorIds?.length || 0) +
    (localFilters.positionIds?.length || 0) +
    (localFilters.performanceLevels?.length || 0);

  const handleApply = () => {
    onApplyFilters(localFilters);
  };

  const handleClear = () => {
    setLocalFilters({});
  };

  // Quick period selection helpers
  const handleCurrentMonth = () => {
    const now = new Date();
    const currentDay = now.getDate();
    let currentYear = now.getFullYear();
    let currentMonth = now.getMonth() + 1; // 1-indexed

    // If today is after the 26th, "current month" means NEXT month
    // because the period from 26th onwards belongs to next month's payroll
    if (currentDay > 26) {
      currentMonth += 1;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear += 1;
      }
    }

    setLocalFilters({
      ...localFilters,
      year: currentYear,
      months: [String(currentMonth).padStart(2, '0')]
    });
  };

  const handleCurrentYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const allMonths = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

    setLocalFilters({
      ...localFilters,
      year: currentYear,
      months: allMonths
    });
  };

  const handleLastThreeMonths = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    const months = [];
    for (let i = 2; i >= 0; i--) {
      const monthDate = new Date(currentYear, currentMonth - i);
      months.push(String(monthDate.getMonth() + 1).padStart(2, '0'));
    }

    setLocalFilters({
      ...localFilters,
      year: currentYear,
      months: months
    });
  };

  const handlePerformanceLevelChange = (level: number, checked: boolean) => {
    const currentLevels = localFilters.performanceLevels || [];
    if (checked) {
      setLocalFilters({
        ...localFilters,
        performanceLevels: [...currentLevels, level],
      });
    } else {
      setLocalFilters({
        ...localFilters,
        performanceLevels: currentLevels.filter((l) => l !== level),
      });
    }
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
            {/* Period Section */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Período</Label>

              {/* Quick Selection Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCurrentMonth}
                >
                  Mês Atual
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleLastThreeMonths}
                >
                  Últimos 3 Meses
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCurrentYear}
                >
                  Ano Atual
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Ano</Label>
                  <Combobox
                    value={localFilters.year?.toString() || ""}
                    onValueChange={(year) => {
                      const newYear = year ? parseInt(year) : undefined;
                      setLocalFilters({
                        ...localFilters,
                        year: newYear,
                        // Clear months when year changes
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
                    placeholder="Selecione o ano..."
                    searchable={false}
                    clearable
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Meses</Label>
                  <Combobox
                    mode="multiple"
                    value={localFilters.months || []}
                    onValueChange={(months) => setLocalFilters({ ...localFilters, months })}
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
                  />
                  {localFilters.months && localFilters.months.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {localFilters.months.length} mês{localFilters.months.length !== 1 ? "es" : ""} selecionado{localFilters.months.length !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Cálculo do período: dia 26 do mês anterior até dia 25 do mês selecionado.
              </p>
            </div>

            <Separator />

            {/* Collaborators Section - Include */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Incluir Colaboradores</Label>
              <Combobox
                mode="multiple"
                options={
                  usersData?.data?.map((user) => ({
                    value: user.id,
                    label: user.name,
                    sublabel: [user.position?.name, user.sector?.name, user.payrollNumber ? `Nº Folha: ${user.payrollNumber}` : null]
                      .filter(Boolean)
                      .join(" • "),
                  })) || []
                }
                value={localFilters.userIds || []}
                onValueChange={(ids) => {
                  // Clear exclude list if selecting include list
                  setLocalFilters({ ...localFilters, userIds: ids, excludeUserIds: [] });
                }}
                placeholder="Selecione colaboradores para incluir..."
                searchPlaceholder="Buscar colaboradores..."
                emptyText="Nenhum colaborador encontrado"
                disabled={localFilters.excludeUserIds && localFilters.excludeUserIds.length > 0}
              />
              {localFilters.userIds && localFilters.userIds.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {localFilters.userIds.length} colaborador{localFilters.userIds.length !== 1 ? "es" : ""} selecionado{localFilters.userIds.length !== 1 ? "s" : ""} para incluir
                </div>
              )}
            </div>

            <Separator />

            {/* Collaborators Section - Exclude */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Excluir Colaboradores</Label>
              <Combobox
                mode="multiple"
                options={
                  usersData?.data?.map((user) => ({
                    value: user.id,
                    label: user.name,
                    sublabel: [user.position?.name, user.sector?.name, user.payrollNumber ? `Nº Folha: ${user.payrollNumber}` : null]
                      .filter(Boolean)
                      .join(" • "),
                  })) || []
                }
                value={localFilters.excludeUserIds || []}
                onValueChange={(ids) => {
                  // Clear include list if selecting exclude list
                  setLocalFilters({ ...localFilters, excludeUserIds: ids, userIds: [] });
                }}
                placeholder="Selecione colaboradores para excluir..."
                searchPlaceholder="Buscar colaboradores..."
                emptyText="Nenhum colaborador encontrado"
                disabled={localFilters.userIds && localFilters.userIds.length > 0}
              />
              {localFilters.excludeUserIds && localFilters.excludeUserIds.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {localFilters.excludeUserIds.length} colaborador{localFilters.excludeUserIds.length !== 1 ? "es" : ""} selecionado{localFilters.excludeUserIds.length !== 1 ? "s" : ""} para excluir
                </div>
              )}
              {localFilters.excludeUserIds && localFilters.excludeUserIds.length > 0 && (
                <div className="text-xs text-yellow-600 dark:text-yellow-500 mt-2">
                  ⚠️ Os colaboradores selecionados serão excluídos da folha de pagamento
                </div>
              )}
            </div>

            <Separator />

            {/* Sectors Section */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Setores</Label>
              <Combobox
                mode="multiple"
                options={
                  sectorsData?.data?.map((sector) => ({
                    value: sector.id,
                    label: sector.name,
                    sublabel: "",
                  })) || []
                }
                value={localFilters.sectorIds || []}
                onValueChange={(ids) => setLocalFilters({ ...localFilters, sectorIds: ids })}
                placeholder="Selecione setores..."
                searchPlaceholder="Buscar setores..."
                emptyText="Nenhum setor encontrado"
              />
              {localFilters.sectorIds && localFilters.sectorIds.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {localFilters.sectorIds.length} setor{localFilters.sectorIds.length !== 1 ? "es" : ""} selecionado{localFilters.sectorIds.length !== 1 ? "s" : ""}
                </div>
              )}
            </div>

            <Separator />

            {/* Positions Section */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Cargos</Label>
              <Combobox
                mode="multiple"
                options={
                  positionsData?.data?.map((position) => ({
                    value: position.id,
                    label: position.name,
                    sublabel: position.remuneration ? `Remuneração: R$ ${position.remuneration.toFixed(2)}` : "",
                  })) || []
                }
                value={localFilters.positionIds || []}
                onValueChange={(ids) => setLocalFilters({ ...localFilters, positionIds: ids })}
                placeholder="Selecione cargos..."
                searchPlaceholder="Buscar cargos..."
                emptyText="Nenhum cargo encontrado"
              />
              {localFilters.positionIds && localFilters.positionIds.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {localFilters.positionIds.length} cargo{localFilters.positionIds.length !== 1 ? "s" : ""} selecionado{localFilters.positionIds.length !== 1 ? "s" : ""}
                </div>
              )}
            </div>

            <Separator />

            {/* Performance Levels Section */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Níveis de Performance</Label>
              <Combobox
                mode="multiple"
                options={[
                  { value: "0", label: "Nível 0" },
                  { value: "1", label: "Nível 1" },
                  { value: "2", label: "Nível 2" },
                  { value: "3", label: "Nível 3" },
                  { value: "4", label: "Nível 4" },
                  { value: "5", label: "Nível 5" },
                ]}
                value={(localFilters.performanceLevels || []).map(String)}
                onValueChange={(levels) => {
                  const numericLevels = levels.map(Number);
                  setLocalFilters({ ...localFilters, performanceLevels: numericLevels });
                }}
                placeholder="Selecione níveis..."
                searchPlaceholder="Buscar níveis..."
                emptyText="Nenhum nível encontrado"
              />
              {localFilters.performanceLevels && localFilters.performanceLevels.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {localFilters.performanceLevels.length} nível{localFilters.performanceLevels.length !== 1 ? "eis" : ""} selecionado{localFilters.performanceLevels.length !== 1 ? "s" : ""}
                </div>
              )}
            </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleClear} className="flex-1">
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