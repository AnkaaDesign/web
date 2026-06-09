import { useState, useEffect } from "react";
import type { DateRange } from "react-day-picker";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import {
  IconFilter,
  IconPackage,
  IconCalendarEvent,
  IconClock,
  IconToggleLeft,
} from "@tabler/icons-react";
import { useItems } from "../../../../hooks";
import type { MaintenanceScheduleGetManyFormData } from "../../../../schemas";
import { SCHEDULE_FREQUENCY, SCHEDULE_FREQUENCY_LABELS } from "../../../../constants";

interface MaintenanceScheduleFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<MaintenanceScheduleGetManyFormData>;
  onFilterChange: (filters: Partial<MaintenanceScheduleGetManyFormData>) => void;
}

interface FilterState {
  // Entity filters
  itemIds?: string[];

  // Frequency filter
  frequency?: string[];

  // Active filter
  isActive?: boolean;

  // Date range filters
  nextRunRange?: { from?: Date; to?: Date };
}

export function MaintenanceScheduleFilters({
  open,
  onOpenChange,
  filters,
  onFilterChange,
}: MaintenanceScheduleFiltersProps) {
  const [localState, setLocalState] = useState<FilterState>({});

  // Fetch data for filters
  const { data: itemsData } = useItems({
    orderBy: { name: "asc" },
  });

  // Initialize local state when dialog opens
  useEffect(() => {
    if (!open) return;

    setLocalState({
      itemIds: filters.itemIds || [],
      frequency: filters.frequency || [],
      isActive: filters.isActive,
      nextRunRange: filters.nextRunRange
        ? { from: filters.nextRunRange.gte, to: filters.nextRunRange.lte }
        : undefined,
    });
  }, [open]);

  const handleApply = () => {
    // Build the filters object from local state
    const newFilters: Partial<MaintenanceScheduleGetManyFormData> = {
      limit: filters.limit,
      orderBy: filters.orderBy,
      include: filters.include,
      page: 1, // Reset to first page when applying filters
    };

    // Add non-empty filters
    if (localState.itemIds?.length) {
      newFilters.itemIds = localState.itemIds;
    }

    if (localState.frequency?.length) {
      newFilters.frequency = localState.frequency as SCHEDULE_FREQUENCY[];
    }

    // Active filter
    if (localState.isActive !== undefined) {
      newFilters.isActive = localState.isActive;
    }

    // Date range filters - convert DateRange to API format
    if (localState.nextRunRange?.from || localState.nextRunRange?.to) {
      newFilters.nextRunRange = {
        gte: localState.nextRunRange.from,
        lte: localState.nextRunRange.to,
      };
    }

    onFilterChange(newFilters);
    onOpenChange(false);
  };

  const handleReset = () => {
    const resetFilters: Partial<MaintenanceScheduleGetManyFormData> = {
      limit: filters.limit || 40,
      orderBy: filters.orderBy || { nextRun: "asc" },
    };
    setLocalState({});
    onFilterChange(resetFilters);
    setTimeout(() => {
      onOpenChange(false);
    }, 0);
  };

  // Count active filters
  const countActiveFilters = () => {
    let count = 0;
    if (localState.itemIds?.length) count++;
    if (localState.frequency?.length) count++;
    if (localState.isActive !== undefined) count++;
    if (localState.nextRunRange?.from || localState.nextRunRange?.to) count++;
    return count;
  };

  const activeFilterCount = countActiveFilters();

  // Transform data for comboboxes
  const itemOptions =
    itemsData?.data?.map((item) => ({
      value: item.id,
      label: `${item.name}${item.uniCode ? ` (${item.uniCode})` : ""}`,
    })) || [];

  const frequencyOptions = Object.entries(SCHEDULE_FREQUENCY_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Agendamentos de Manutenção - Filtros"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Configure filtros para refinar sua pesquisa de agendamentos de manutenção"
      activeFilterCount={activeFilterCount}
      onApply={handleApply}
      onReset={handleReset}
      applyLabel="Aplicar"
      resetLabel="Limpar Tudo"
    >
          {/* Item Filter */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconPackage className="h-4 w-4" />
              Itens
            </Label>
            <Combobox
              mode="multiple"
              options={itemOptions}
              value={localState.itemIds || []}
              onValueChange={(value) => setLocalState((prev) => ({ ...prev, itemIds: Array.isArray(value) ? value : [] }))}
              placeholder="Selecione itens..."
              emptyText="Nenhum item encontrado"
              searchPlaceholder="Buscar itens..."
            />
          </div>

          {/* Frequency Filter */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconClock className="h-4 w-4" />
              Frequência
            </Label>
            <Combobox
              mode="multiple"
              options={frequencyOptions}
              value={localState.frequency || []}
              onValueChange={(value) => setLocalState((prev) => ({ ...prev, frequency: Array.isArray(value) ? value : [] }))}
              placeholder="Selecione frequências..."
              emptyText="Nenhuma frequência encontrada"
              searchPlaceholder="Buscar frequências..."
            />
          </div>

          {/* Active Filter */}
          <div className="grid gap-4">
            <Label className="flex items-center gap-2">
              <IconToggleLeft className="h-4 w-4" />
              Status do Agendamento
            </Label>

            <Combobox
              mode="single"
              value={localState.isActive === true ? "active" : localState.isActive === false ? "inactive" : "all"}
              onValueChange={(value) =>
                setLocalState((prev) => ({
                  ...prev,
                  isActive: value === "active" ? true : value === "inactive" ? false : undefined,
                }))
              }
              options={[
                { value: "all", label: "Todos" },
                { value: "active", label: "Apenas agendamentos ativos" },
                { value: "inactive", label: "Apenas agendamentos inativos" },
              ]}
              placeholder="Selecione..."
              searchable={false}
            />
          </div>

          {/* Next Run Date Range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconCalendarEvent className="h-4 w-4" />
              Próxima Execução
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                <DateTimeInput
                  mode="date"
                  value={localState.nextRunRange?.from}
                  onChange={(date: Date | DateRange | null) => {
                    if (date && !(date instanceof Date)) return;
                    if (!date && !localState.nextRunRange?.to) {
                      setLocalState((prev) => ({ ...prev, nextRunRange: undefined }));
                    } else {
                      setLocalState((prev) => ({
                        ...prev,
                        nextRunRange: {
                          ...(date && { from: date }),
                          ...(localState.nextRunRange?.to && { to: localState.nextRunRange.to }),
                        },
                      }));
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
                  value={localState.nextRunRange?.to}
                  onChange={(date: Date | DateRange | null) => {
                    if (date && !(date instanceof Date)) return;
                    if (!date && !localState.nextRunRange?.from) {
                      setLocalState((prev) => ({ ...prev, nextRunRange: undefined }));
                    } else {
                      setLocalState((prev) => ({
                        ...prev,
                        nextRunRange: {
                          ...(localState.nextRunRange?.from && { from: localState.nextRunRange.from }),
                          ...(date && { to: date }),
                        },
                      }));
                    }
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
