import { useState, useEffect } from "react";
import { IconFilter, IconX } from "@tabler/icons-react";
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
import { Switch } from "@/components/ui/switch";
import { useSectors, useCustomers, useUsers } from "../../../../hooks";
import type { TaskGetManyFormData } from "../../../../schemas";
import { TASK_STATUS } from "../../../../constants";
import { formatCurrency } from "../../../../utils";

interface TaskHistoryFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<TaskGetManyFormData>;
  onFilterChange: (filters: Partial<TaskGetManyFormData>) => void;
}

export function TaskHistoryFilters({ open, onOpenChange, filters, onFilterChange }: TaskHistoryFiltersProps) {
  // Load data for selectors
  const { data: sectorsData } = useSectors({ orderBy: { name: "asc" } });
  const { data: customersData } = useCustomers({ orderBy: { fantasyName: "asc" } });
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

  // Status filter state - check if current filters include pending/in-production tasks
  const [includeInProgressTasks, setIncludeInProgressTasks] = useState(() => {
    const currentStatuses = filters.status || [];
    return currentStatuses.includes(TASK_STATUS.PENDING) || currentStatuses.includes(TASK_STATUS.IN_PRODUCTION);
  });

  // Reset local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalFilters({ ...filters });
      setPriceMin(filters.priceRange?.from?.toString() || "");
      setPriceMax(filters.priceRange?.to?.toString() || "");

      const currentStatuses = filters.status || [];
      setIncludeInProgressTasks(currentStatuses.includes(TASK_STATUS.PENDING) || currentStatuses.includes(TASK_STATUS.IN_PRODUCTION));
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

    // Handle status filter
    if (includeInProgressTasks) {
      updatedFilters.status = [TASK_STATUS.COMPLETED, TASK_STATUS.PENDING, TASK_STATUS.IN_PRODUCTION, TASK_STATUS.ON_HOLD];
    } else {
      updatedFilters.status = [TASK_STATUS.COMPLETED];
    }

    onFilterChange(updatedFilters);
    onOpenChange(false);
  };

  // Handle clear filters
  const handleClear = () => {
    setLocalFilters({});
    setPriceMin("");
    setPriceMax("");
    setIncludeInProgressTasks(false);
  };

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
          {/* Status Filter Switch */}
          <div className="space-y-2">
            <Label>Status das Tarefas</Label>
            <div className="flex items-center space-x-2">
              <Switch id="include-in-progress" checked={includeInProgressTasks} onCheckedChange={setIncludeInProgressTasks} />
              <Label htmlFor="include-in-progress" className="text-sm">
                Incluir tarefas pendentes e em produção
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              {includeInProgressTasks ? "Mostrando tarefas finalizadas, pendentes, em produção e em espera" : "Mostrando apenas tarefas finalizadas"}
            </p>
          </div>

          {/* Date Range Filter - Finished Date */}
          <div className="space-y-2">
            <Label>Data de Finalização</Label>
            <DateTimeInput
              mode="date-range"
              value={
                localFilters.finishedDateRange
                  ? {
                      from: localFilters.finishedDateRange.from as Date | undefined,
                      to: localFilters.finishedDateRange.to as Date | undefined,
                    }
                  : undefined
              }
              onChange={(range) => {
                if (range && typeof range === "object" && "from" in range && (range.from || range.to)) {
                  setLocalFilters({
                    ...localFilters,
                    finishedDateRange: {
                      from: range.from || undefined,
                      to: range.to || undefined,
                    },
                  });
                } else {
                  const { finishedDateRange, ...rest } = localFilters;
                  setLocalFilters(rest);
                }
              }}
              placeholder="Selecionar período de finalização"
              numberOfMonths={2}
            />
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
                })) || []
              }
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

          {/* Price Range */}
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
