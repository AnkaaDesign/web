import { useState, useEffect, useCallback } from "react";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox } from "@/components/ui/combobox";
import { IconFilter, IconProgress, IconCalendar, IconUser } from "@tabler/icons-react";
import { VACATION_STATUS_LABELS } from "../../../../constants";
import type { VacationGetManyFormData } from "../../../../schemas/vacation";
import type { User } from "../../../../types";
import { getUsers } from "../../../../api-client";
import { getConcessiveDateRange } from "./filter-utils";

interface VacationFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<VacationGetManyFormData>;
  onFilterChange: (filters: Partial<VacationGetManyFormData>) => void;
}

export function VacationFilters({ open, onOpenChange, filters, onFilterChange }: VacationFiltersProps) {
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  const selectedStatuses = localFilters.statuses || [];
  const selectedUserIds = localFilters.userIds || [];
  const dateRange = getConcessiveDateRange(localFilters);

  const handleApplyFilters = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleResetFilters = () => {
    onFilterChange({});
    setLocalFilters({});
    onOpenChange(false);
  };

  const handleStatusesChange = (statuses: string[]) => {
    setLocalFilters({ ...localFilters, statuses: statuses.length > 0 ? statuses : undefined });
  };

  const handleUsersChange = (userIds: string[]) => {
    setLocalFilters({ ...localFilters, userIds: userIds.length > 0 ? userIds : undefined });
  };

  const setDateRange = (range: { gte?: Date; lte?: Date } | undefined) => {
    const where = { ...((localFilters.where as any) || {}) };
    if (range && (range.gte || range.lte)) {
      where.concessiveEnd = range;
    } else {
      delete where.concessiveEnd;
    }
    setLocalFilters({
      ...localFilters,
      where: Object.keys(where).length > 0 ? where : undefined,
    });
  };

  const statusOptions = Object.entries(VACATION_STATUS_LABELS).map(([value, label]) => ({ value, label }));

  const queryUsers = useCallback(async (search: string, page: number = 1) => {
    const queryParams: any = {
      page,
      take: 50,
      orderBy: { name: "asc" },
      include: { position: true },
    };
    if (search && search.trim()) {
      queryParams.searchingFor = search.trim();
    }
    const response = await getUsers(queryParams);
    return {
      data: response.data || [],
      hasMore: response.meta?.hasNextPage || false,
    };
  }, []);

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
      description="Filtre as férias por colaborador, status e limite concessivo"
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
        <Combobox<User>
          mode="multiple"
          value={selectedUserIds}
          onValueChange={(value) => {
            const arr = Array.isArray(value) ? value : value ? [value] : [];
            handleUsersChange(arr);
          }}
          placeholder="Selecione os colaboradores"
          emptyText="Nenhum colaborador encontrado"
          searchPlaceholder="Buscar colaborador..."
          async={true}
          queryKey={["users", "vacation-filter-collaborator"]}
          queryFn={queryUsers}
          initialOptions={[]}
          getOptionLabel={(user) => user.name}
          getOptionValue={(user) => user.id}
          minSearchLength={0}
          pageSize={50}
          debounceMs={300}
          searchable={true}
        />
      </div>

      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconProgress className="h-4 w-4" />
          Status
        </Label>
        <Combobox
          mode="multiple"
          options={statusOptions}
          value={selectedStatuses}
          onValueChange={(value) => {
            const arr = Array.isArray(value) ? value : value ? [value] : [];
            handleStatusesChange(arr);
          }}
          placeholder="Selecione os status"
          searchable={true}
          minSearchLength={0}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <IconCalendar className="h-4 w-4" />
          Limite Concessivo
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
            <DateTimeInput
              mode="date"
              value={dateRange?.gte}
              onChange={(date) => {
                const dateValue = date instanceof Date ? date : null;
                setDateRange({
                  ...(dateValue && { gte: dateValue }),
                  ...(dateRange?.lte && { lte: dateRange.lte }),
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
              value={dateRange?.lte}
              onChange={(date) => {
                const dateValue = date instanceof Date ? date : null;
                setDateRange({
                  ...(dateRange?.gte && { gte: dateRange.gte }),
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
