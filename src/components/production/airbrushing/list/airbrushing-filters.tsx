import { useState, useEffect } from "react";
import { IconFilter } from "@tabler/icons-react";
import type { DateRange } from "react-day-picker";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { AirbrushingGetManyFormData } from "../../../../schemas";
import type { Task } from "../../../../types";
import { Badge } from "@/components/ui/badge";
import { AIRBRUSHING_STATUS, AIRBRUSHING_STATUS_LABELS, AIRBRUSHING_PAYMENT_STATUS, AIRBRUSHING_PAYMENT_STATUS_LABELS } from "../../../../constants";

interface AirbrushingFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<AirbrushingGetManyFormData>;
  onFilterChange: (filters: Partial<AirbrushingGetManyFormData>) => void;
  tasks: Task[];
}

interface FilterState {
  taskIds: string[];
  status: AIRBRUSHING_STATUS[];
  paymentStatuses: AIRBRUSHING_PAYMENT_STATUS[];
  priceMin?: number;
  priceMax?: number;
  createdAfter?: Date;
  createdBefore?: Date;
}

export function AirbrushingFilters({ open, onOpenChange, filters, onFilterChange, tasks }: AirbrushingFiltersProps) {
  const [localState, setLocalState] = useState<FilterState>({
    taskIds: [],
    status: [],
    paymentStatuses: [],
    priceMin: undefined,
    priceMax: undefined,
    createdAfter: undefined,
    createdBefore: undefined,
  });

  // Initialize local state from filters when dialog opens
  useEffect(() => {
    if (!open) return;

    setLocalState({
      taskIds: filters.taskIds || [],
      status: filters.status || [],
      paymentStatuses: filters.paymentStatuses || [],
      priceMin: filters.priceRange?.min,
      priceMax: filters.priceRange?.max,
      createdAfter: filters.createdAt?.gte,
      createdBefore: filters.createdAt?.lte,
    });
  }, [open, filters]);

  const handleApply = () => {
    const newFilters: Partial<AirbrushingGetManyFormData> = {
      ...filters,
    };

    // Task IDs
    if (localState.taskIds.length > 0) {
      newFilters.taskIds = localState.taskIds;
    } else {
      delete newFilters.taskIds;
    }

    // Status
    if (localState.status.length > 0) {
      newFilters.status = localState.status;
    } else {
      delete newFilters.status;
    }

    // Payment status
    if (localState.paymentStatuses.length > 0) {
      newFilters.paymentStatuses = localState.paymentStatuses;
    } else {
      delete newFilters.paymentStatuses;
    }

    // Price range
    if (localState.priceMin !== undefined || localState.priceMax !== undefined) {
      newFilters.priceRange = {};
      if (localState.priceMin !== undefined) {
        newFilters.priceRange.min = localState.priceMin;
      }
      if (localState.priceMax !== undefined) {
        newFilters.priceRange.max = localState.priceMax;
      }
    } else {
      delete newFilters.priceRange;
    }

    // Date range
    if (localState.createdAfter || localState.createdBefore) {
      newFilters.createdAt = {};
      if (localState.createdAfter) {
        newFilters.createdAt.gte = localState.createdAfter;
      }
      if (localState.createdBefore) {
        newFilters.createdAt.lte = localState.createdBefore;
      }
    } else {
      delete newFilters.createdAt;
    }

    onFilterChange(newFilters);
    setTimeout(() => onOpenChange(false), 0); // Use timeout to prevent state update conflicts
  };

  const handleReset = () => {
    setLocalState({
      taskIds: [],
      status: [],
      paymentStatuses: [],
      priceMin: undefined,
      priceMax: undefined,
      createdAfter: undefined,
      createdBefore: undefined,
    });
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (localState.taskIds.length > 0) count++;
    if (localState.status.length > 0) count++;
    if (localState.paymentStatuses.length > 0) count++;
    if (localState.priceMin !== undefined || localState.priceMax !== undefined) count++;
    if (localState.createdAfter || localState.createdBefore) count++;
    return count;
  };

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros de Aerografia"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Configure os filtros para visualizar aerografias específicas"
      activeFilterCount={getActiveFilterCount()}
      onApply={handleApply}
      onReset={handleReset}
      applyLabel="Aplicar filtros"
      resetLabel="Limpar todos"
    >
          <div className="space-y-3">
            <Label className="text-base font-medium">
              Status
              {localState.status.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {localState.status.length}
                </Badge>
              )}
            </Label>
            <Combobox
              mode="multiple"
              options={Object.values(AIRBRUSHING_STATUS).map((status) => ({
                value: status,
                label: AIRBRUSHING_STATUS_LABELS[status],
              }))}
              value={localState.status}
              onValueChange={(status: string | string[] | null | undefined) => {
                setLocalState((prev) => ({ ...prev, status: (Array.isArray(status) ? status : []) as AIRBRUSHING_STATUS[] }));
              }}
              placeholder="Selecionar status..."
              searchPlaceholder="Buscar status..."
              emptyText="Nenhum status encontrado"
              searchable={true}
              clearable={true}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">
              Status do Pagamento
              {localState.paymentStatuses.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {localState.paymentStatuses.length}
                </Badge>
              )}
            </Label>
            <Combobox
              mode="multiple"
              options={Object.values(AIRBRUSHING_PAYMENT_STATUS).map((paymentStatus) => ({
                value: paymentStatus,
                label: AIRBRUSHING_PAYMENT_STATUS_LABELS[paymentStatus],
              }))}
              value={localState.paymentStatuses}
              onValueChange={(paymentStatuses: string | string[] | null | undefined) => {
                setLocalState((prev) => ({ ...prev, paymentStatuses: (Array.isArray(paymentStatuses) ? paymentStatuses : []) as AIRBRUSHING_PAYMENT_STATUS[] }));
              }}
              placeholder="Selecionar status do pagamento..."
              searchPlaceholder="Buscar status do pagamento..."
              emptyText="Nenhum status encontrado"
              searchable={true}
              clearable={true}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">
              Tarefas
              {localState.taskIds.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {localState.taskIds.length}
                </Badge>
              )}
            </Label>
            <Combobox
              mode="multiple"
              options={tasks.map((task) => ({
                value: task.id,
                label: task.name,
              }))}
              value={localState.taskIds}
              onValueChange={(taskIds: string | string[] | null | undefined) => {
                setLocalState((prev) => ({ ...prev, taskIds: Array.isArray(taskIds) ? taskIds : [] }));
              }}
              placeholder="Selecionar tarefas..."
              searchPlaceholder="Buscar tarefas..."
              emptyText="Nenhuma tarefa encontrada"
              searchable={true}
              clearable={true}
            />
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium">Faixa de Preço</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Preço mínimo</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={localState.priceMin || ""}
                  onChange={(value: string | number | null) => {
                    setLocalState((prev) => ({
                      ...prev,
                      priceMin: value ? parseFloat(String(value)) : undefined,
                    }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Preço máximo</Label>
                <Input
                  type="number"
                  placeholder="999999.99"
                  value={localState.priceMax || ""}
                  onChange={(value: string | number | null) => {
                    setLocalState((prev) => ({
                      ...prev,
                      priceMax: value ? parseFloat(String(value)) : undefined,
                    }));
                  }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-base font-medium">Data de Criação</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                <DateTimeInput
                  mode="date"
                  value={localState.createdAfter}
                  onChange={(date: Date | DateRange | null) => {
                    setLocalState((prev) => ({
                      ...prev,
                      createdAfter: (date instanceof Date ? date : null) || undefined,
                    }));
                  }}
                  hideLabel
                  placeholder="Selecionar data inicial..."
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                <DateTimeInput
                  mode="date"
                  value={localState.createdBefore}
                  onChange={(date: Date | DateRange | null) => {
                    setLocalState((prev) => ({
                      ...prev,
                      createdBefore: (date instanceof Date ? date : null) || undefined,
                    }));
                  }}
                  hideLabel
                  placeholder="Selecionar data final..."
                />
              </div>
            </div>
          </div>

    </FilterDrawer>
  );
}
