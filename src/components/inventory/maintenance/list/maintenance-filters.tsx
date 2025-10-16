import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { IconFilter, IconX, IconClock, IconPackage, IconCircleCheck, IconCalendarEvent, IconCalendarPlus } from "@tabler/icons-react";
import { useItems } from "../../../../hooks";
import type { MaintenanceGetManyFormData } from "../../../../schemas";
import { MAINTENANCE_STATUS_LABELS, SCHEDULE_FREQUENCY_LABELS } from "../../../../constants";

interface MaintenanceFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<MaintenanceGetManyFormData>;
  onFilterChange: (filters: Partial<MaintenanceGetManyFormData>) => void;
}

interface FilterState {
  // Status filters
  status?: string[];

  // Frequency filter
  frequency?: string[];

  // Item filter
  itemIds?: string[];

  // Date range filters
  nextRunRange?: { gte?: Date; lte?: Date };
  createdAtRange?: { gte?: Date; lte?: Date };
}

export function MaintenanceFilters({ open, onOpenChange, filters, onFilterChange }: MaintenanceFiltersProps) {
  const [localState, setLocalState] = useState<FilterState>({});

  // Fetch items for item filter
  const { data: itemsData } = useItems({
    orderBy: { name: "asc" },
    limit: 40,
  });

  // Initialize local state when dialog opens
  useEffect(() => {
    if (!open) return;

    setLocalState({
      status: filters.status || [],
      frequency: filters.frequency || [],
      itemIds: filters.itemIds || [],
      nextRunRange: filters.nextRunRange,
      createdAtRange: filters.createdAt,
    });
  }, [open, filters]);

  const handleApply = () => {
    // Build the filters object from local state
    const newFilters: Partial<MaintenanceGetManyFormData> = {
      limit: filters.limit,
      orderBy: filters.orderBy,
      include: filters.include,
      page: 1, // Reset to first page when applying filters
    };

    // Add non-empty filters
    if (localState.status?.length) {
      newFilters.status = localState.status;
    }

    if (localState.frequency?.length) {
      newFilters.frequency = localState.frequency;
    }

    if (localState.itemIds?.length) {
      newFilters.itemIds = localState.itemIds;
    }

    // Date range filters
    if (localState.nextRunRange?.gte || localState.nextRunRange?.lte) {
      newFilters.nextRunRange = localState.nextRunRange;
    }

    if (localState.createdAtRange?.gte || localState.createdAtRange?.lte) {
      newFilters.createdAt = localState.createdAtRange;
    }

    onFilterChange(newFilters);
    onOpenChange(false);
  };

  const handleReset = () => {
    const resetFilters: Partial<MaintenanceGetManyFormData> = {
      limit: filters.limit || 40,
      orderBy: filters.orderBy || { statusOrder: "asc", nextRun: "asc" },
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
    if (localState.status?.length) count++;
    if (localState.frequency?.length) count++;
    if (localState.itemIds?.length) count++;
    if (localState.nextRunRange?.gte || localState.nextRunRange?.lte) count++;
    if (localState.createdAtRange?.gte || localState.createdAtRange?.lte) count++;
    return count;
  };

  const activeFilterCount = countActiveFilters();

  // Transform data for comboboxes
  const itemOptions =
    itemsData?.data?.map((item) => ({
      value: item.id,
      label: `${item.name} ${item.uniCode ? `(${item.uniCode})` : ""}`,
    })) || [];

  const statusOptions = Object.entries(MAINTENANCE_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const frequencyOptions = Object.entries(SCHEDULE_FREQUENCY_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Manutenções - Filtros
            {activeFilterCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="ml-2 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors" onClick={handleReset}>
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
          <SheetDescription>Configure filtros para refinar sua pesquisa de manutenções</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status Filter */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconCircleCheck className="h-4 w-4" />
              Status
            </Label>
            <Combobox
              mode="multiple"
              options={statusOptions}
              value={localState.status || []}
              onValueChange={(value) => setLocalState((prev) => ({ ...prev, status: value as string[] }))}
              placeholder="Selecione status..."
              emptyText="Nenhum status encontrado"
              searchPlaceholder="Buscar status..."
              searchable={true}
            />
            {localState.status && localState.status.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localState.status.length} status selecionado{localState.status.length !== 1 ? "s" : ""}
              </div>
            )}
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
              onValueChange={(value) => setLocalState((prev) => ({ ...prev, frequency: value as string[] }))}
              placeholder="Selecione frequências..."
              emptyText="Nenhuma frequência encontrada"
              searchPlaceholder="Buscar frequências..."
              searchable={true}
            />
            {localState.frequency && localState.frequency.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localState.frequency.length} frequência{localState.frequency.length !== 1 ? "s" : ""} selecionada{localState.frequency.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

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
              onValueChange={(value) => setLocalState((prev) => ({ ...prev, itemIds: value as string[] }))}
              placeholder="Selecione itens..."
              emptyText="Nenhum item encontrado"
              searchPlaceholder="Buscar itens..."
              searchable={true}
            />
            {localState.itemIds && localState.itemIds.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {localState.itemIds.length} item{localState.itemIds.length !== 1 ? "s" : ""} selecionado{localState.itemIds.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* Next Run Date Range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconCalendarEvent className="h-4 w-4" />
              Próxima Manutenção
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DateTimeInput
                mode="date"
                value={localState.nextRunRange?.gte}
                onChange={(date: Date | null) => {
                  if (!date && !localState.nextRunRange?.lte) {
                    setLocalState((prev) => ({ ...prev, nextRunRange: undefined }));
                  } else {
                    setLocalState((prev) => ({
                      ...prev,
                      nextRunRange: {
                        ...(date && { gte: date }),
                        ...(localState.nextRunRange?.lte && { lte: localState.nextRunRange.lte }),
                      },
                    }));
                  }
                }}
                label="De"
                placeholder="Selecionar data inicial..."
              />
              <DateTimeInput
                mode="date"
                value={localState.nextRunRange?.lte}
                onChange={(date: Date | null) => {
                  if (!date && !localState.nextRunRange?.gte) {
                    setLocalState((prev) => ({ ...prev, nextRunRange: undefined }));
                  } else {
                    setLocalState((prev) => ({
                      ...prev,
                      nextRunRange: {
                        ...(localState.nextRunRange?.gte && { gte: localState.nextRunRange.gte }),
                        ...(date && { lte: date }),
                      },
                    }));
                  }
                }}
                label="Até"
                placeholder="Selecionar data final..."
              />
            </div>
          </div>

          {/* Created At Date Range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconCalendarPlus className="h-4 w-4" />
              Data de Criação
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DateTimeInput
                mode="date"
                value={localState.createdAtRange?.gte}
                onChange={(date: Date | null) => {
                  if (!date && !localState.createdAtRange?.lte) {
                    setLocalState((prev) => ({ ...prev, createdAtRange: undefined }));
                  } else {
                    setLocalState((prev) => ({
                      ...prev,
                      createdAtRange: {
                        ...(date && { gte: date }),
                        ...(localState.createdAtRange?.lte && { lte: localState.createdAtRange.lte }),
                      },
                    }));
                  }
                }}
                label="De"
                placeholder="Selecionar data inicial..."
              />
              <DateTimeInput
                mode="date"
                value={localState.createdAtRange?.lte}
                onChange={(date: Date | null) => {
                  if (!date && !localState.createdAtRange?.gte) {
                    setLocalState((prev) => ({ ...prev, createdAtRange: undefined }));
                  } else {
                    setLocalState((prev) => ({
                      ...prev,
                      createdAtRange: {
                        ...(localState.createdAtRange?.gte && { gte: localState.createdAtRange.gte }),
                        ...(date && { lte: date }),
                      },
                    }));
                  }
                }}
                label="Até"
                placeholder="Selecionar data final..."
              />
            </div>
          </div>
          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              <IconX className="h-4 w-4 mr-2" />
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
