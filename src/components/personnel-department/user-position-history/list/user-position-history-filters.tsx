import { useState, useEffect, useCallback, useRef } from "react";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { getPositions, getUsers } from "../../../../api-client";
import { POSITION_CHANGE_REASON_LABELS } from "../../../../constants";
import { Combobox } from "@/components/ui/combobox";
import { IconFilter, IconUser, IconBriefcase, IconTag, IconCalendar } from "@tabler/icons-react";
import type { UserPositionHistoryGetManyFormData } from "../../../../schemas/user-position-history";

interface UserPositionHistoryFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<UserPositionHistoryGetManyFormData>;
  onFilterChange: (filters: Partial<UserPositionHistoryGetManyFormData>) => void;
}

export function UserPositionHistoryFilters({ open, onOpenChange, filters, onFilterChange }: UserPositionHistoryFiltersProps) {
  // Cache refs for selected items in multiple mode
  const userCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());
  const positionCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());

  // Local state for immediate UI updates
  const [localFilters, setLocalFilters] = useState(filters);

  // Sync local state with URL filters when modal opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  // Get current values for multi-select components
  const selectedUsers = localFilters.userIds || [];
  const selectedPositions = localFilters.positionIds || [];
  const selectedReasons = localFilters.reasons || [];

  const handleApplyFilters = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleResetFilters = () => {
    onFilterChange({});
    setLocalFilters({});
    onOpenChange(false);
  };

  // Reason options (static, no async needed)
  const reasonOptions = Object.entries(POSITION_CHANGE_REASON_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  // Async query function for users
  const queryUsers = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
      };

      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getUsers(queryParams);
      const users = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = users.map((user) => {
        const option = {
          value: user.id,
          label: user.name,
        };
        userCacheRef.current.set(user.id, option);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error fetching users:", error);
      }
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  // Async query function for positions
  const queryPositions = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
      };

      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getPositions(queryParams);
      const positions = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = positions.map((position) => {
        const option = {
          value: position.id,
          label: position.name,
        };
        positionCacheRef.current.set(position.id, option);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error fetching positions:", error);
      }
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  // Count active filters
  const activeFilterCount = Object.entries(localFilters).filter(([key, value]) => {
    if (key === "page" || key === "limit" || key === "itemsPerPage" || key === "orderBy" || key === "sortOrder") return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
    return value !== undefined && value !== null && value !== "";
  }).length;

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros Avançados"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Filtre o histórico por colaborador, cargo, motivo, período e vigência"
      activeFilterCount={activeFilterCount}
      onApply={handleApplyFilters}
      onReset={handleResetFilters}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
    >
      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconUser className="h-4 w-4" />
          Colaborador
        </Label>
        <Combobox
          async={true}
          mode="multiple"
          queryKey={["users"]}
          queryFn={queryUsers}
          initialOptions={[]}
          value={selectedUsers}
          onValueChange={(value) => {
            const arr = Array.isArray(value) ? value : value ? [value] : [];
            setLocalFilters({ ...localFilters, userIds: arr.length > 0 ? arr : undefined });
          }}
          placeholder="Selecione os colaboradores"
          searchable={true}
          minSearchLength={0}
          pageSize={50}
          debounceMs={300}
        />
      </div>

      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconBriefcase className="h-4 w-4" />
          Cargo
        </Label>
        <Combobox
          async={true}
          mode="multiple"
          queryKey={["positions"]}
          queryFn={queryPositions}
          initialOptions={[]}
          value={selectedPositions}
          onValueChange={(value) => {
            const arr = Array.isArray(value) ? value : value ? [value] : [];
            setLocalFilters({ ...localFilters, positionIds: arr.length > 0 ? arr : undefined });
          }}
          placeholder="Selecione os cargos"
          searchable={true}
          minSearchLength={0}
          pageSize={50}
          debounceMs={300}
        />
      </div>

      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconTag className="h-4 w-4" />
          Motivo
        </Label>
        <Combobox
          mode="multiple"
          options={reasonOptions}
          value={selectedReasons}
          onValueChange={(value) => {
            const arr = Array.isArray(value) ? value : value ? [value] : [];
            setLocalFilters({ ...localFilters, reasons: arr.length > 0 ? arr : undefined });
          }}
          placeholder="Selecione os motivos"
          searchable={true}
          minSearchLength={0}
        />
      </div>

      {/* Período (data de início) */}
      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconCalendar className="h-4 w-4" />
          Período (início)
        </Label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
            <DateTimeInput
              mode="date"
              value={localFilters.startedAtRange?.gte}
              onChange={(date) => {
                const dateValue = date instanceof Date ? date : null;
                if (!dateValue && !localFilters.startedAtRange?.lte) {
                  const { startedAtRange, ...rest } = localFilters;
                  setLocalFilters(rest);
                } else {
                  setLocalFilters({
                    ...localFilters,
                    startedAtRange: {
                      ...(dateValue && { gte: dateValue }),
                      ...(localFilters.startedAtRange?.lte && { lte: localFilters.startedAtRange.lte }),
                    },
                  });
                }
              }}
              hideLabel
              placeholder="Data inicial..."
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
            <DateTimeInput
              mode="date"
              value={localFilters.startedAtRange?.lte}
              onChange={(date) => {
                const dateValue = date instanceof Date ? date : null;
                if (!dateValue && !localFilters.startedAtRange?.gte) {
                  const { startedAtRange, ...rest } = localFilters;
                  setLocalFilters(rest);
                } else {
                  setLocalFilters({
                    ...localFilters,
                    startedAtRange: {
                      ...(localFilters.startedAtRange?.gte && { gte: localFilters.startedAtRange.gte }),
                      ...(dateValue && { lte: dateValue }),
                    },
                  });
                }
              }}
              hideLabel
              placeholder="Data final..."
            />
          </div>
        </div>
      </div>

      {/* Current only */}
      <div className="flex items-center justify-between rounded-lg border border-border p-3">
        <div>
          <Label htmlFor="filter-is-current" className="cursor-pointer">
            Apenas vigentes
          </Label>
          <p className="text-xs text-muted-foreground mt-1">Mostrar somente o cargo atual de cada colaborador</p>
        </div>
        <Switch
          id="filter-is-current"
          checked={localFilters.isCurrent === true}
          onCheckedChange={(checked) => setLocalFilters({ ...localFilters, isCurrent: checked === true ? true : undefined })}
        />
      </div>
    </FilterDrawer>
  );
}
