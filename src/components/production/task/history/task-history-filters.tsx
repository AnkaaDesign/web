import { useState, useEffect } from "react";
import { IconFilter, IconX, IconChecklist } from "@tabler/icons-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import { useSectors, useCustomers, useUsers } from "../../../../hooks";
import type { TaskGetManyFormData } from "../../../../schemas";
import { TASK_STATUS, TASK_STATUS_LABELS } from "../../../../constants";
import { formatCurrency } from "../../../../utils";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import type { Customer } from "../../../../types";

interface TaskHistoryFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<TaskGetManyFormData>;
  onFilterChange: (filters: Partial<TaskGetManyFormData>) => void;
  canViewPrice?: boolean;
}

export function TaskHistoryFilters({ open, onOpenChange, filters, onFilterChange, canViewPrice = true }: TaskHistoryFiltersProps) {
  // Load data for selectors
  const { data: sectorsData } = useSectors({ orderBy: { name: "asc" } });
  const { data: customersData } = useCustomers({ orderBy: { fantasyName: "asc" }, include: { logo: true } });
  const { data: usersData } = useUsers({
    orderBy: { name: "asc" },
    where: {
      // Only show users who have created tasks
      createdTasks: {
        some: {
          status: "COMPLETED",
        },
      },
    },
  });

  // Local state for filters
  const [localFilters, setLocalFilters] = useState<Partial<TaskGetManyFormData>>({
    ...filters,
  });

  // Price range state
  const [priceMin, setPriceMin] = useState(filters.priceRange?.from?.toString() || "");
  const [priceMax, setPriceMax] = useState(filters.priceRange?.to?.toString() || "");

  // Reset local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalFilters({ ...filters });
      setPriceMin(filters.priceRange?.from?.toString() || "");
      setPriceMax(filters.priceRange?.to?.toString() || "");
    }
  }, [open, filters]);

  // Handle apply filters
  const handleApply = () => {
    const updatedFilters = { ...localFilters };

    // Handle price range
    if (priceMin || priceMax) {
      updatedFilters.priceRange = {
        ...(priceMin && { from: parseFloat(priceMin) }),
        ...(priceMax && { to: parseFloat(priceMax) }),
      };
    } else {
      delete updatedFilters.priceRange;
    }

    onFilterChange(updatedFilters);
    onOpenChange(false);
  };

  // Handle clear filters
  const handleClear = () => {
    setLocalFilters({});
    setPriceMin("");
    setPriceMax("");
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
          {/* Status Filter */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IconChecklist className="h-4 w-4" />
              Status das Tarefas
            </Label>
            <Combobox
              mode="multiple"
              options={statusOptions}
              value={localFilters.status || []}
              onValueChange={(value: string[]) => setLocalFilters({ ...localFilters, status: value.length > 0 ? value : undefined })}
              placeholder="Selecione os status"
              searchable={true}
              minSearchLength={0}
            />
          </div>

          {/* Date Range Filter - Finished Date */}
          <div className="space-y-3">
            <div className="text-sm font-medium">Data de Finalização</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                <DateTimeInput
                  mode="date"
                  value={localFilters.finishedDateRange?.from as Date | undefined}
                  onChange={(date: Date | null) => {
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
                  onChange={(date: Date | null) => {
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

          {/* Sector Filter */}
          <div className="space-y-2">
            <Label>Setores</Label>
            <Combobox
              mode="multiple"
              placeholder="Selecione os setores"
              emptyText="Nenhum setor encontrado"
              value={localFilters.sectorIds || []}
              onValueChange={(value: string[]) => setLocalFilters({ ...localFilters, sectorIds: value })}
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
            <Label>Clientes</Label>
            <Combobox
              mode="multiple"
              placeholder="Selecione os clientes"
              emptyText="Nenhum cliente encontrado"
              value={localFilters.customerIds || []}
              onValueChange={(value: string[]) => setLocalFilters({ ...localFilters, customerIds: value })}
              options={
                customersData?.data?.map((customer) => ({
                  value: customer.id,
                  label: customer.fantasyName,
                  logo: customer.logo,
                })) || []
              }
              renderOption={(option, isSelected) => (
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

          {/* User Filter - Who completed the task */}
          <div className="space-y-2">
            <Label>Finalizado por</Label>
            <Combobox
              mode="multiple"
              placeholder="Selecione os usuários"
              emptyText="Nenhum usuário encontrado"
              value={localFilters.assigneeIds || []}
              onValueChange={(value: string[]) => setLocalFilters({ ...localFilters, assigneeIds: value })}
              options={
                usersData?.data?.map((user) => ({
                  value: user.id,
                  label: user.name,
                })) || []
              }
            />
          </div>

          {/* Price Range - Only for Admin and Leader */}
          {canViewPrice && (
            <div className="space-y-2">
              <Label>Faixa de Valor</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Mínimo</Label>
                  <Input type="number" placeholder="0,00" value={priceMin} onChange={(value) => setPriceMin(value as string)} min="0" step="0.01" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">Máximo</Label>
                  <Input type="number" placeholder="0,00" value={priceMax} onChange={(value) => setPriceMax(value as string)} min="0" step="0.01" />
                </div>
              </div>
              {(priceMin || priceMax) && (
                <p className="text-sm text-muted-foreground">
                  {priceMin && priceMax
                    ? `Entre ${formatCurrency(Number(priceMin))} e ${formatCurrency(Number(priceMax))}`
                    : priceMin
                      ? `Acima de ${formatCurrency(Number(priceMin))}`
                      : `Até ${formatCurrency(Number(priceMax))}`}
                </p>
              )}
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
            Aplicar Filtros
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
