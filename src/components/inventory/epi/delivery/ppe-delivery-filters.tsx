import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { IconFilter, IconX, IconTruck, IconUser, IconPackage, IconCalendarEvent, IconCalendarPlus } from "@tabler/icons-react";
import { useUsers, useItems } from "../../../../hooks";
import type { PpeDeliveryGetManyFormData } from "../../../../schemas";
import { PPE_DELIVERY_STATUS, PPE_DELIVERY_STATUS_LABELS, ITEM_CATEGORY_TYPE } from "../../../../constants";

interface PpeDeliveryFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<PpeDeliveryGetManyFormData>;
  onFilterChange: (filters: Partial<PpeDeliveryGetManyFormData>) => void;
}

interface FilterState {
  // Status filters
  status?: string[];

  // Entity filters
  itemIds?: string[];
  userIds?: string[];

  // Date range filters
  scheduledDateRange?: { gte?: Date; lte?: Date };
  actualDeliveryDateRange?: { gte?: Date; lte?: Date };
}

export function PpeDeliveryFilters({ open, onOpenChange, filters, onFilterChange }: PpeDeliveryFiltersProps) {
  const [localState, setLocalState] = useState<FilterState>({});

  // Fetch data for filters
  const { data: usersData } = useUsers({ orderBy: { name: "asc" } });
  const { data: itemsData } = useItems({
    where: { category: { type: ITEM_CATEGORY_TYPE.PPE } },
    orderBy: { name: "asc" },
  });

  // Initialize local state when dialog opens
  useEffect(() => {
    if (!open) return;

    setLocalState({
      status: filters.status || [],
      itemIds: filters.itemIds || [],
      userIds: filters.userIds || [],
      scheduledDateRange: filters.scheduledDateRange,
      actualDeliveryDateRange: filters.actualDeliveryDateRange,
    });
  }, [open]);

  const handleApply = () => {
    // Build the filters object from local state
    const newFilters: Partial<PpeDeliveryGetManyFormData> = {
      limit: filters.limit,
      orderBy: filters.orderBy,
      include: filters.include,
      page: 1, // Reset to first page when applying filters
    };

    // Add non-empty filters
    if (localState.status?.length) {
      newFilters.status = localState.status as PPE_DELIVERY_STATUS[];
    }

    if (localState.itemIds?.length) {
      newFilters.itemIds = localState.itemIds;
    }

    if (localState.userIds?.length) {
      newFilters.userIds = localState.userIds;
    }

    // Date range filters
    if (localState.scheduledDateRange?.gte || localState.scheduledDateRange?.lte) {
      newFilters.scheduledDateRange = localState.scheduledDateRange;
    }

    if (localState.actualDeliveryDateRange?.gte || localState.actualDeliveryDateRange?.lte) {
      newFilters.actualDeliveryDateRange = localState.actualDeliveryDateRange;
    }

    onFilterChange(newFilters);
    onOpenChange(false);
  };

  const handleReset = () => {
    const resetFilters: Partial<PpeDeliveryGetManyFormData> = {
      limit: filters.limit || 40,
      orderBy: filters.orderBy || { scheduledDate: "desc" },
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
    if (localState.itemIds?.length) count++;
    if (localState.userIds?.length) count++;
    if (localState.scheduledDateRange?.gte || localState.scheduledDateRange?.lte) count++;
    if (localState.actualDeliveryDateRange?.gte || localState.actualDeliveryDateRange?.lte) count++;
    return count;
  };

  const activeFilterCount = countActiveFilters();

  // Transform data for comboboxes
  const itemOptions =
    itemsData?.data?.map((item) => ({
      value: item.id,
      label: `${item.name}${item.uniCode ? ` (${item.uniCode})` : ""}`,
    })) || [];

  const userOptions =
    usersData?.data?.map((user) => ({
      value: user.id,
      label: user.name,
    })) || [];

  const statusOptions = Object.entries(PPE_DELIVERY_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Entregas de EPI - Filtros
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
          <SheetDescription>Configure filtros para refinar sua pesquisa de entregas de EPI</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status Filter */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconTruck className="h-4 w-4" />
              Status
            </Label>
            <Combobox
              mode="multiple"
              options={statusOptions}
              value={localState.status || []}
              onValueChange={(value) => setLocalState((prev) => ({ ...prev, status: value }))}
              placeholder="Selecione status..."
              emptyText="Nenhum status encontrado"
              searchPlaceholder="Buscar status..."
            />
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
              onValueChange={(value) => setLocalState((prev) => ({ ...prev, itemIds: value }))}
              placeholder="Selecione itens..."
              emptyText="Nenhum item encontrado"
              searchPlaceholder="Buscar itens..."
            />
          </div>

          {/* User Filter */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconUser className="h-4 w-4" />
              Usuários
            </Label>
            <Combobox
              mode="multiple"
              options={userOptions}
              value={localState.userIds || []}
              onValueChange={(value) => setLocalState((prev) => ({ ...prev, userIds: value }))}
              placeholder="Selecione usuários..."
              emptyText="Nenhum usuário encontrado"
              searchPlaceholder="Buscar usuários..."
            />
          </div>

          {/* Scheduled Date Range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconCalendarEvent className="h-4 w-4" />
              Data Programada
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DateTimeInput
                mode="date"
                value={localState.scheduledDateRange?.gte}
                onChange={(date: Date | null) => {
                  if (!date && !localState.scheduledDateRange?.lte) {
                    setLocalState((prev) => ({ ...prev, scheduledDateRange: undefined }));
                  } else {
                    setLocalState((prev) => ({
                      ...prev,
                      scheduledDateRange: {
                        ...(date && { gte: date }),
                        ...(localState.scheduledDateRange?.lte && { lte: localState.scheduledDateRange.lte }),
                      },
                    }));
                  }
                }}
                label="De"
                placeholder="Selecionar data inicial..."
              />
              <DateTimeInput
                mode="date"
                value={localState.scheduledDateRange?.lte}
                onChange={(date: Date | null) => {
                  if (!date && !localState.scheduledDateRange?.gte) {
                    setLocalState((prev) => ({ ...prev, scheduledDateRange: undefined }));
                  } else {
                    setLocalState((prev) => ({
                      ...prev,
                      scheduledDateRange: {
                        ...(localState.scheduledDateRange?.gte && { gte: localState.scheduledDateRange.gte }),
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

          {/* Actual Delivery Date Range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconCalendarPlus className="h-4 w-4" />
              Data de Entrega Real
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DateTimeInput
                mode="date"
                value={localState.actualDeliveryDateRange?.gte}
                onChange={(date: Date | null) => {
                  if (!date && !localState.actualDeliveryDateRange?.lte) {
                    setLocalState((prev) => ({ ...prev, actualDeliveryDateRange: undefined }));
                  } else {
                    setLocalState((prev) => ({
                      ...prev,
                      actualDeliveryDateRange: {
                        ...(date && { gte: date }),
                        ...(localState.actualDeliveryDateRange?.lte && { lte: localState.actualDeliveryDateRange.lte }),
                      },
                    }));
                  }
                }}
                label="De"
                placeholder="Selecionar data inicial..."
              />
              <DateTimeInput
                mode="date"
                value={localState.actualDeliveryDateRange?.lte}
                onChange={(date: Date | null) => {
                  if (!date && !localState.actualDeliveryDateRange?.gte) {
                    setLocalState((prev) => ({ ...prev, actualDeliveryDateRange: undefined }));
                  } else {
                    setLocalState((prev) => ({
                      ...prev,
                      actualDeliveryDateRange: {
                        ...(localState.actualDeliveryDateRange?.gte && { gte: localState.actualDeliveryDateRange.gte }),
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
