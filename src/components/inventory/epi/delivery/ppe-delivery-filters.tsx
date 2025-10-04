import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] h-[70vh] max-h-[700px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
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
          </DialogTitle>
          <DialogDescription>Configure filtros para refinar sua pesquisa de entregas de EPI</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-8 py-4">
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
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconCalendarEvent className="h-4 w-4" />
              Data Programada
            </Label>
            <DateTimeInput
              mode="date-range"
              value={{
                from: localState.scheduledDateRange?.gte,
                to: localState.scheduledDateRange?.lte,
              }}
              onChange={(range) => {
                if (range?.from || range?.to) {
                  setLocalState((prev) => ({
                    ...prev,
                    scheduledDateRange: {
                      ...(range.from && { gte: range.from }),
                      ...(range.to && { lte: range.to }),
                    },
                  }));
                } else {
                  setLocalState((prev) => ({ ...prev, scheduledDateRange: undefined }));
                }
              }}
              placeholder="Selecione o período"
            />
          </div>

          {/* Actual Delivery Date Range */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconCalendarPlus className="h-4 w-4" />
              Data de Entrega Real
            </Label>
            <DateTimeInput
              mode="date-range"
              value={{
                from: localState.actualDeliveryDateRange?.gte,
                to: localState.actualDeliveryDateRange?.lte,
              }}
              onChange={(range) => {
                if (range?.from || range?.to) {
                  setLocalState((prev) => ({
                    ...prev,
                    actualDeliveryDateRange: {
                      ...(range.from && { gte: range.from }),
                      ...(range.to && { lte: range.to }),
                    },
                  }));
                } else {
                  setLocalState((prev) => ({ ...prev, actualDeliveryDateRange: undefined }));
                }
              }}
              placeholder="Selecione o período"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleReset} className="flex items-center gap-2">
            <IconX className="h-4 w-4" />
            Limpar Tudo
          </Button>
          <Button onClick={handleApply}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
