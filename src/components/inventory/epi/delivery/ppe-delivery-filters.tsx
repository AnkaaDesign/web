import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { IconFilter, IconX, IconTruck, IconUser, IconPackage, IconCalendarEvent, IconCalendarPlus } from "@tabler/icons-react";
import { getUsers, getItems } from "../../../../api-client";
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

  // Create stable caches for fetched data
  const itemsCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());
  const usersCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());

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

  // Async query function for items
  const queryItems = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
        where: { category: { type: ITEM_CATEGORY_TYPE.PPE } },
      };

      // Only add searchingFor if there's a search term
      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getItems(queryParams);
      const items = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      // Convert items to options format and add to cache
      const options = items.map((item) => {
        const option = {
          value: item.id,
          label: `${item.name}${item.uniCode ? ` (${item.uniCode})` : ""}`,
        };
        itemsCacheRef.current.set(item.id, option);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      console.error("Error fetching items:", error);
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  // Async query function for users
  const queryUsers = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
      };

      // Only add searchingFor if there's a search term
      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getUsers(queryParams);
      const users = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      // Convert users to options format and add to cache
      const options = users.map((user) => {
        const option = {
          value: user.id,
          label: user.name,
        };
        usersCacheRef.current.set(user.id, option);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      console.error("Error fetching users:", error);
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  // Get initial options from cache for selected IDs
  const initialItemOptions = useMemo(() => {
    if (!localState.itemIds?.length) return [];
    return localState.itemIds
      .map(id => itemsCacheRef.current.get(id))
      .filter((opt): opt is { label: string; value: string } => opt !== undefined);
  }, [localState.itemIds]);

  const initialUserOptions = useMemo(() => {
    if (!localState.userIds?.length) return [];
    return localState.userIds
      .map(id => usersCacheRef.current.get(id))
      .filter((opt): opt is { label: string; value: string } => opt !== undefined);
  }, [localState.userIds]);

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
              async={true}
              queryKey={["items-filter-delivery"]}
              queryFn={queryItems}
              initialOptions={initialItemOptions}
              mode="multiple"
              value={localState.itemIds || []}
              onValueChange={(value) => setLocalState((prev) => ({ ...prev, itemIds: value }))}
              placeholder="Selecione itens..."
              emptyText="Nenhum item encontrado"
              searchPlaceholder="Buscar itens..."
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
            />
          </div>

          {/* User Filter */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconUser className="h-4 w-4" />
              Usuários
            </Label>
            <Combobox
              async={true}
              queryKey={["users-filter-delivery"]}
              queryFn={queryUsers}
              initialOptions={initialUserOptions}
              mode="multiple"
              value={localState.userIds || []}
              onValueChange={(value) => setLocalState((prev) => ({ ...prev, userIds: value }))}
              placeholder="Selecione usuários..."
              emptyText="Nenhum usuário encontrado"
              searchPlaceholder="Buscar usuários..."
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
            />
          </div>

          {/* Scheduled Date Range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconCalendarEvent className="h-4 w-4" />
              Data Programada
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
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
                  hideLabel
                  placeholder="Selecionar data inicial..."
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
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
                  hideLabel
                  placeholder="Selecionar data final..."
                />
              </div>
            </div>
          </div>

          {/* Actual Delivery Date Range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconCalendarPlus className="h-4 w-4" />
              Data de Entrega Real
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
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
                  hideLabel
                  placeholder="Selecionar data inicial..."
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
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
                  hideLabel
                  placeholder="Selecionar data final..."
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-6 pt-4 border-t">
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
