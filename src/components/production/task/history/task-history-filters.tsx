import { useState, useEffect, useMemo } from "react";
import { IconFilter, IconX, IconChecklist, IconCalendar, IconBuilding } from "@tabler/icons-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import { useSectors, useCustomers } from "../../../../hooks";
import type { TaskGetManyFormData } from "../../../../schemas";
import { TASK_STATUS_LABELS, SECTOR_PRIVILEGES } from "../../../../constants";
import { formatDate } from "../../../../utils";
import { getBonusPeriodStart, getBonusPeriodEnd } from "../../../../utils/bonus";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";

interface TaskHistoryFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<TaskGetManyFormData>;
  onFilterChange: (filters: Partial<TaskGetManyFormData>) => void;
  canViewPrice?: boolean;
  /** When true, hides the status filter (for non-admin/financial users) */
  canViewStatusFilter?: boolean;
}

export function TaskHistoryFilters({ open, onOpenChange, filters, onFilterChange, canViewPrice: _canViewPrice = false, canViewStatusFilter = true }: TaskHistoryFiltersProps) {
  // Load data for selectors
  const { data: sectorsData } = useSectors({
    orderBy: { name: "asc" },
    privilege: SECTOR_PRIVILEGES.PRODUCTION
  });
  const { data: customersData } = useCustomers({ orderBy: { fantasyName: "asc" }, include: { logo: true } });

  // Local state for filters
  const [localFilters, setLocalFilters] = useState<Partial<TaskGetManyFormData>>({
    ...filters,
  });

  // Year and month state
  const [selectedYear, setSelectedYear] = useState<number | undefined>(undefined);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);

  // Generate year options (current year and 3 years back)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i <= 3; i++) {
      const year = currentYear - i;
      years.push({
        value: year.toString(),
        label: year.toString(),
      });
    }
    return years;
  }, []);

  // Month options
  const monthOptions = [
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
  ];

  // Reset local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalFilters({ ...filters });
      setSelectedYear(undefined);
      setSelectedMonths([]);
    }
  }, [open, filters]);

  // Handle apply filters
  const handleApply = () => {
    const updatedFilters = { ...localFilters };

    // Handle year and month period (26th to 25th cycle)
    if (selectedYear && selectedMonths.length > 0) {
      // Convert year and months to date range using bonus period logic
      const monthNumbers = selectedMonths.map(m => parseInt(m));
      const minMonth = Math.min(...monthNumbers);
      const maxMonth = Math.max(...monthNumbers);

      // Start date: 26th of the previous month of the earliest selected month
      const fromDate = getBonusPeriodStart(selectedYear, minMonth);

      // End date: 25th of the latest selected month
      const toDate = getBonusPeriodEnd(selectedYear, maxMonth);

      updatedFilters.finishedDateRange = {
        from: fromDate,
        to: toDate,
      };
    }

    onFilterChange(updatedFilters);
    onOpenChange(false);
  };

  // Handle clear filters
  const handleClear = () => {
    setLocalFilters({});
    setSelectedYear(undefined);
    setSelectedMonths([]);
  };

  // Status options
  const statusOptions = Object.entries(TASK_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros do Histórico
          </SheetTitle>
          <SheetDescription>
            Filtre as tarefas por status, data, setor, cliente e mais
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status Filter - only visible to admin/commercial/financial users */}
          {canViewStatusFilter && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IconChecklist className="h-4 w-4" />
                Status das Tarefas
              </Label>
              <Combobox
                mode="multiple"
                options={statusOptions}
                value={localFilters.status || []}
                onValueChange={(value) => {
                  const arr = Array.isArray(value) ? value : (value ? [value] : []);
                  setLocalFilters({ ...localFilters, status: arr.length > 0 ? arr : undefined });
                }}
                placeholder="Selecione os status"
                searchable={true}
                minSearchLength={0}
              />
            </div>
          )}

          {/* Sector Filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IconBuilding className="h-4 w-4" />
              Setores
            </Label>
            <Combobox
              mode="multiple"
              placeholder="Selecione os setores"
              emptyText="Nenhum setor encontrado"
              value={localFilters.sectorIds || []}
              onValueChange={(value) => {
                const arr = Array.isArray(value) ? value : (value ? [value] : []);
                setLocalFilters({ ...localFilters, sectorIds: arr });
              }}
              options={
                sectorsData?.data?.map((sector) => ({
                  value: sector.id,
                  label: sector.name,
                })) || []
              }
            />
          </div>

          {/* Customer Filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IconBuilding className="h-4 w-4" />
              Razão Social
            </Label>
            <Combobox
              mode="multiple"
              placeholder="Selecione os clientes"
              emptyText="Nenhum cliente encontrado"
              value={localFilters.customerIds || []}
              onValueChange={(value) => {
                const arr = Array.isArray(value) ? value : (value ? [value] : []);
                setLocalFilters({ ...localFilters, customerIds: arr });
              }}
              options={
                customersData?.data?.map((customer) => ({
                  value: customer.id,
                  label: customer.corporateName || customer.fantasyName,
                  logo: customer.logo,
                })) || []
              }
              renderOption={(option, _isSelected) => (
                <div className="flex items-center gap-3 w-full">
                  <CustomerLogoDisplay
                    logo={(option as any).logo}
                    customerName={option.label}
                    size="sm"
                    shape="rounded"
                    className="flex-shrink-0"
                  />
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="font-medium truncate">{option.label}</div>
                  </div>
                </div>
              )}
            />
          </div>

          {/* Date Range Filter - Finished Date */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <IconCalendar className="h-4 w-4" />
              Data de Finalização
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                <DateTimeInput
                  mode="date"
                  value={localFilters.finishedDateRange?.from as Date | undefined}
                  onChange={(dateOrRange) => {
                    const date = dateOrRange && typeof dateOrRange === 'object' && 'from' in dateOrRange ? dateOrRange.from : dateOrRange;
                    if (!date && !localFilters.finishedDateRange?.to) {
                      const { finishedDateRange, ...rest } = localFilters;
                      setLocalFilters(rest);
                    } else {
                      setLocalFilters({
                        ...localFilters,
                        finishedDateRange: {
                          ...(date && { from: date }),
                          ...(localFilters.finishedDateRange?.to && { to: localFilters.finishedDateRange.to }),
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
                  value={localFilters.finishedDateRange?.to as Date | undefined}
                  onChange={(dateOrRange) => {
                    const date = dateOrRange && typeof dateOrRange === 'object' && 'from' in dateOrRange ? dateOrRange.to : dateOrRange;
                    if (!date && !localFilters.finishedDateRange?.from) {
                      const { finishedDateRange, ...rest } = localFilters;
                      setLocalFilters(rest);
                    } else {
                      setLocalFilters({
                        ...localFilters,
                        finishedDateRange: {
                          ...(localFilters.finishedDateRange?.from && { from: localFilters.finishedDateRange.from }),
                          ...(date && { to: date }),
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

          {/* Year and Month Period Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IconCalendar className="h-4 w-4" />
              Período
            </Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <Combobox
                  value={selectedYear?.toString() || ""}
                  onValueChange={(year) => {
                    const yearStr = Array.isArray(year) ? year[0] : year;
                    const newYear = yearStr ? parseInt(yearStr) : undefined;
                    setSelectedYear(newYear);
                    if (!newYear) {
                      setSelectedMonths([]);
                    }
                  }}
                  options={yearOptions}
                  placeholder="Ano..."
                  searchable={false}
                  clearable={true}
                />
              </div>
              <div className="col-span-2">
                <Combobox
                  mode="multiple"
                  value={selectedMonths}
                  onValueChange={(months) => {
                    const arr = Array.isArray(months) ? months : (months ? [months] : []);
                    setSelectedMonths(arr);
                  }}
                  options={monthOptions}
                  placeholder={selectedYear ? "Selecione os meses..." : "Selecione um ano primeiro"}
                  searchPlaceholder="Buscar meses..."
                  emptyText="Nenhum mês encontrado"
                  disabled={!selectedYear}
                  searchable={true}
                  clearable={true}
                />
              </div>
            </div>
            {selectedMonths.length > 0 && (() => {
              const monthNumbers = selectedMonths.map(m => parseInt(m));
              const minMonth = Math.min(...monthNumbers);
              const maxMonth = Math.max(...monthNumbers);

              const fromDate = getBonusPeriodStart(selectedYear!, minMonth);
              const toDate = getBonusPeriodEnd(selectedYear!, maxMonth);

              return (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {selectedMonths.length} mês{selectedMonths.length !== 1 ? "es" : ""} selecionado{selectedMonths.length !== 1 ? "s" : ""}
                  </p>
                  <Badge variant="secondary" className="text-xs font-normal">
                    Finalizado: De {formatDate(fromDate)} até {formatDate(toDate)}
                  </Badge>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={handleClear} className="flex-1">
            <IconX className="h-4 w-4 mr-2" />
            Limpar Filtros
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Aplicar Filtros
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
