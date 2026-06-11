import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import type { DateRange } from "react-day-picker";
import { Combobox } from "@/components/ui/combobox";
import { IconFilter, IconUser, IconPackage, IconCalendarEvent, IconClock, IconToggleLeft } from "@tabler/icons-react";
import { getUsers, getItems } from "../../../../api-client";
import type { PpeDeliveryScheduleGetManyFormData } from "../../../../schemas";
import { SCHEDULE_FREQUENCY, SCHEDULE_FREQUENCY_LABELS } from "../../../../constants";

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
        // PPE identity = item.ppeType != null (capability-fields contract).
        where: { ppeType: { not: null } },
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
        where: { isActive: true },
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
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Agendamentos de EPI - Filtros"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Configure filtros para refinar sua pesquisa de agendamentos de EPI"
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
              async={true}
              queryKey={["items-filter-schedule"]}
              queryFn={queryItems}
              initialOptions={initialItemOptions}
              mode="multiple"
              value={localState.itemIds || []}
              onValueChange={(value) => setLocalState((prev) => ({ ...prev, itemIds: Array.isArray(value) ? value : value ? [value] : [] }))}
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
              onValueChange={(value) => setLocalState((prev) => ({ ...prev, userIds: Array.isArray(value) ? value : value ? [value] : [] }))}
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
              onValueChange={(value) => setLocalState((prev) => ({ ...prev, frequency: Array.isArray(value) ? value : value ? [value] : [] }))}
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
