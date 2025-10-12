import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import {
  IconFilter,
  IconX,
  IconPackage,
  IconCalendarEvent,
  IconClock,
  IconToggleLeft,
} from "@tabler/icons-react";
import { useItems } from "../../../../hooks";
import type { MaintenanceScheduleGetManyFormData } from "../../../../schemas";
import { SCHEDULE_FREQUENCY, SCHEDULE_FREQUENCY_LABELS } from "../../../../constants";
import { type DateRange } from "react-day-picker";

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
  nextRunRange?: DateRange;
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

    // Convert API date range format to DateRange format
    const convertToDateRange = (apiRange?: { gte?: Date; lte?: Date }): DateRange | undefined => {
      if (!apiRange) return undefined;
      return {
        from: apiRange.gte,
        to: apiRange.lte,
      };
    };

    setLocalState({
      itemIds: filters.itemIds || [],
      frequency: filters.frequency || [],
      isActive: filters.isActive,
      nextRunRange: convertToDateRange(filters.nextRunRange),
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Agendamentos de Manutenção - Filtros
            {activeFilterCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="secondary"
                      className="ml-2 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      onClick={handleReset}
                    >
                      {activeFilterCount}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Clique para limpar todos os filtros</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </SheetTitle>
          <SheetDescription>
            Configure filtros para refinar sua pesquisa de agendamentos de manutenção
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
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
              onValueChange={(value) => setLocalState((prev) => ({ ...prev, itemIds: value }))}
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
              onValueChange={(value) => setLocalState((prev) => ({ ...prev, frequency: value }))}
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

            <div className="flex items-center space-x-2">
              <Checkbox
                id="activeOnly"
                checked={localState.isActive === true}
                onCheckedChange={(checked) =>
                  setLocalState((prev) => ({ ...prev, isActive: checked ? true : undefined }))
                }
              />
              <Label htmlFor="activeOnly" className="text-sm font-normal">
                Apenas agendamentos ativos
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="inactiveOnly"
                checked={localState.isActive === false}
                onCheckedChange={(checked) =>
                  setLocalState((prev) => ({ ...prev, isActive: checked ? false : undefined }))
                }
              />
              <Label htmlFor="inactiveOnly" className="text-sm font-normal">
                Apenas agendamentos inativos
              </Label>
            </div>
          </div>

          {/* Next Run Date Range */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconCalendarEvent className="h-4 w-4" />
              Próxima Execução
            </Label>
            <DateTimeInput
              mode="date-range"
              value={localState.nextRunRange}
              onChange={(range) => setLocalState((prev) => ({ ...prev, nextRunRange: range }))}
              placeholder="Selecione o período"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-1 flex items-center gap-2"
            >
              <IconX className="h-4 w-4" />
              Limpar Tudo
            </Button>
            <Button onClick={handleApply} className="flex-1">
              Aplicar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
