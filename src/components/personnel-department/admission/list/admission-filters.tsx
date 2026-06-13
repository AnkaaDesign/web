import { useState, useEffect, useCallback, useRef } from "react";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { getUsers } from "../../../../api-client";
import { ADMISSION_STATUS_LABELS } from "../../../../constants";
import { Combobox } from "@/components/ui/combobox";
import { IconFilter, IconProgressCheck, IconUser, IconCalendar } from "@tabler/icons-react";
import type { AdmissionGetManyFormData } from "../../../../schemas/admission";

interface AdmissionFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<AdmissionGetManyFormData>;
  onFilterChange: (filters: Partial<AdmissionGetManyFormData>) => void;
}

export function AdmissionFilters({ open, onOpenChange, filters, onFilterChange }: AdmissionFiltersProps) {
  // Cache ref for selected users in multiple mode
  const userCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());

  // Local state for immediate UI updates
  const [localFilters, setLocalFilters] = useState(filters);

  // Sync local state with URL filters when modal opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  // Get current values for multi-select components
  const selectedStatuses = localFilters.statuses || [];
  const selectedUsers = localFilters.userIds || [];
  const hireDateRange = (localFilters.where as any)?.hireDate as { gte?: Date; lte?: Date } | undefined;

  const handleApplyFilters = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleResetFilters = () => {
    onFilterChange({});
    setLocalFilters({});
    onOpenChange(false);
  };

  const handleStatusChange = (statuses: string[]) => {
    setLocalFilters({ ...localFilters, statuses: statuses.length > 0 ? statuses : undefined });
  };

  const handleUserChange = (userIds: string[]) => {
    setLocalFilters({ ...localFilters, userIds: userIds.length > 0 ? userIds : undefined });
  };

  const setHireDateRange = (range: { gte?: Date; lte?: Date } | undefined) => {
    const where = { ...(localFilters.where as any) };
    if (range && (range.gte || range.lte)) {
      where.hireDate = range;
    } else {
      delete where.hireDate;
    }
    setLocalFilters({ ...localFilters, where: Object.keys(where).length > 0 ? where : undefined });
  };

  // Status options (static, no async needed)
  const statusOptions = Object.entries(ADMISSION_STATUS_LABELS).map(([value, label]) => ({
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
        // Add to cache for multiple mode
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
      description="Filtre as admissões por status, colaborador e data de admissão"
      activeFilterCount={activeFilterCount}
      onApply={handleApplyFilters}
      onReset={handleResetFilters}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
    >
      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconProgressCheck className="h-4 w-4" />
          Status
        </Label>
        <Combobox
          mode="multiple"
          options={statusOptions}
          value={selectedStatuses}
          onValueChange={(value) => {
            const arr = Array.isArray(value) ? value : value ? [value] : [];
            handleStatusChange(arr);
          }}
          placeholder="Selecione os status"
          searchable={true}
          minSearchLength={0}
        />
      </div>

      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconUser className="h-4 w-4" />
          Colaborador
        </Label>
        <Combobox
          async={true}
          mode="multiple"
          queryKey={["users", "admission-filter"]}
          queryFn={queryUsers}
          initialOptions={[]}
          value={selectedUsers}
          onValueChange={(value) => {
            const arr = Array.isArray(value) ? value : value ? [value] : [];
            handleUserChange(arr);
          }}
          placeholder="Selecione os colaboradores"
          searchable={true}
          minSearchLength={0}
          pageSize={50}
          debounceMs={300}
        />
      </div>

      {/* Hire Date Range */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <IconCalendar className="h-4 w-4" />
          Data de Admissão
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
            <DateTimeInput
              mode="date"
              value={hireDateRange?.gte}
              onChange={(date) => {
                const dateValue = date instanceof Date ? date : null;
                setHireDateRange({
                  ...(dateValue && { gte: dateValue }),
                  ...(hireDateRange?.lte && { lte: hireDateRange.lte }),
                });
              }}
              hideLabel
              placeholder="Selecionar data inicial..."
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
            <DateTimeInput
              mode="date"
              value={hireDateRange?.lte}
              onChange={(date) => {
                const dateValue = date instanceof Date ? date : null;
                setHireDateRange({
                  ...(hireDateRange?.gte && { gte: hireDateRange.gte }),
                  ...(dateValue && { lte: dateValue }),
                });
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
