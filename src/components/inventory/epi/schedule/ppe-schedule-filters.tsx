import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { IconFilter, IconX, IconUser, IconPackage, IconCalendarEvent, IconClock, IconToggleLeft } from "@tabler/icons-react";
import { getUsers, getItems } from "../../../../api-client";
import type { PpeDeliveryScheduleGetManyFormData } from "../../../../schemas";
import { SCHEDULE_FREQUENCY, SCHEDULE_FREQUENCY_LABELS, ITEM_CATEGORY_TYPE } from "../../../../constants";

interface PpeScheduleFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<PpeDeliveryScheduleGetManyFormData>;
  onFilterChange: (filters: Partial<PpeDeliveryScheduleGetManyFormData>) => void;
}

interface FilterState {
  // Entity filters
  itemIds?: string[];
  userIds?: string[];

  // Frequency filter
  frequency?: string[];

  // Active filter
  isActive?: boolean;

  // Date range filters
  nextRunRange?: { from?: Date; to?: Date };
}

export function PpeScheduleFilters({ open, onOpenChange, filters, onFilterChange }: PpeScheduleFiltersProps) {
  const [localState, setLocalState] = useState<FilterState>({});

  // Create stable caches for fetched data
  const itemsCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());
  const usersCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());

  // Initialize local state when dialog opens
  useEffect(() => {
    if (!open) return;

    setLocalState({
      itemIds: filters.itemIds || [],
      userIds: filters.userIds || [],
      frequency: filters.frequency || [],
      isActive: filters.isActive,
      nextRunRange: filters.nextRunRange
        ? { from: filters.nextRunRange.gte, to: filters.nextRunRange.lte }
        : undefined,
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
    const newFilters: Partial<PpeDeliveryScheduleGetManyFormData> = {
      limit: filters.limit,
      orderBy: filters.orderBy,
      include: filters.include,
      page: 1, // Reset to first page when applying filters
    };

    // Add non-empty filters
    if (localState.itemIds?.length) {
      newFilters.itemIds = localState.itemIds;
    }

    if (localState.userIds?.length) {
      newFilters.userIds = localState.userIds;
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
    const resetFilters: Partial<PpeDeliveryScheduleGetManyFormData> = {
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
    if (localState.userIds?.length) count++;
    if (localState.frequency?.length) count++;
    if (localState.isActive !== undefined) count++;
    if (localState.nextRunRange?.from || localState.nextRunRange?.to) count++;
    return count;
  };

  const activeFilterCount = countActiveFilters();

  // Transform data for comboboxes
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
            Agendamentos de EPI - Filtros
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
          <SheetDescription>Configure filtros para refinar sua pesquisa de agendamentos de EPI</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Item Filter */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <IconPackage className="h-4 w-4" />
              Itens
            </Label>
            <Combobox
              async={true}
              queryKey={["items-filter-schedule"]}
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
              queryKey={["users-filter-schedule"]}
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
                onCheckedChange={(checked) => setLocalState((prev) => ({ ...prev, isActive: checked ? true : undefined }))}
              />
              <Label htmlFor="activeOnly" className="text-sm font-normal">
                Apenas agendamentos ativos
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="inactiveOnly"
                checked={localState.isActive === false}
                onCheckedChange={(checked) => setLocalState((prev) => ({ ...prev, isActive: checked ? false : undefined }))}
              />
              <Label htmlFor="inactiveOnly" className="text-sm font-normal">
                Apenas agendamentos inativos
              </Label>
            </div>
          </div>

          {/* Next Delivery Date Range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconCalendarEvent className="h-4 w-4" />
              Próxima Entrega
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                <DateTimeInput
                  mode="date"
                  value={localState.nextRunRange?.from}
                  onChange={(date: Date | null) => {
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
                  onChange={(date: Date | null) => {
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

          {/* Action Buttons */}
          <div className="flex gap-2 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={handleReset} className="flex-1 flex items-center gap-2">
              <IconX className="h-4 w-4" />
              Limpar Tudo
            </Button>
            <Button onClick={handleApply} className="flex-1">Aplicar</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
