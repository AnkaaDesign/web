import { useState, useEffect, useCallback } from "react";
import { IconFilter, IconCalendarEvent, IconUser, IconProgressCheck, IconCalendar, IconStethoscope } from "@tabler/icons-react";

import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";

import { getUsers } from "../../../../api-client";
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS } from "../../../../constants";
import type { LeaveListFilters } from "./types";

interface LeaveFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<LeaveListFilters>;
  onFilterChange: (filters: Partial<LeaveListFilters>) => void;
}

export function LeaveFilters({ open, onOpenChange, filters, onFilterChange }: LeaveFiltersProps) {
  // Local state for immediate UI updates
  const [localFilters, setLocalFilters] = useState(filters);

  // Sync local state with URL filters when modal opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  const selectedTypes = localFilters.types || [];
  const selectedStatuses = localFilters.statuses || [];
  const selectedUsers = localFilters.userIds || [];

  const handleApplyFilters = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleResetFilters = () => {
    onFilterChange({});
    setLocalFilters({});
    onOpenChange(false);
  };

  // Static options
  const typeOptions = Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => ({ value, label }));
  const statusOptions = Object.entries(LEAVE_STATUS_LABELS).map(([value, label]) => ({ value, label }));
  const returnExamOptions = [
    { value: "true", label: "Obrigatório" },
    { value: "false", label: "Não obrigatório" },
  ];

  // Async query function for users
  const queryUsers = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page,
        take: 50,
      };

      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getUsers(queryParams);
      const users = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      return {
        data: users.map((user) => ({ value: user.id, label: user.name })),
        hasMore,
      };
    } catch (error) {
      console.error("Error fetching users:", error);
      return { data: [], hasMore: false };
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
      description="Filtre os afastamentos por tipo, status, colaborador, data de início e exame de retorno"
      activeFilterCount={activeFilterCount}
      onApply={handleApplyFilters}
      onReset={handleResetFilters}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
    >
      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconCalendarEvent className="h-4 w-4" />
          Tipo de Afastamento
        </Label>
        <Combobox
          mode="multiple"
          options={typeOptions}
          value={selectedTypes}
          onValueChange={(value) => {
            const arr = Array.isArray(value) ? value : value ? [value] : [];
            setLocalFilters({ ...localFilters, types: arr.length > 0 ? arr : undefined });
          }}
          placeholder="Selecione os tipos"
          searchable={true}
          minSearchLength={0}
        />
      </div>

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
            setLocalFilters({ ...localFilters, statuses: arr.length > 0 ? arr : undefined });
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
          queryKey={["users", "leave-filters"]}
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
          <IconStethoscope className="h-4 w-4" />
          Exame de Retorno
        </Label>
        <Combobox
          mode="single"
          options={returnExamOptions}
          value={typeof localFilters.returnExamRequired === "boolean" ? String(localFilters.returnExamRequired) : undefined}
          onValueChange={(value) => {
            setLocalFilters({
              ...localFilters,
              returnExamRequired: value === "true" ? true : value === "false" ? false : undefined,
            });
          }}
          placeholder="Selecione uma opção"
          searchable={false}
          clearable={true}
        />
      </div>

      {/* Start Date Range */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <IconCalendar className="h-4 w-4" />
          Data de Início
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
            <DateTimeInput
              mode="date"
              value={localFilters.startDate?.gte}
              onChange={(date) => {
                const dateValue = date instanceof Date ? date : null;
                if (!dateValue && !localFilters.startDate?.lte) {
                  setLocalFilters({ ...localFilters, startDate: undefined });
                } else {
                  setLocalFilters({
                    ...localFilters,
                    startDate: {
                      ...(dateValue && { gte: dateValue }),
                      ...(localFilters.startDate?.lte && { lte: localFilters.startDate.lte }),
                    },
                  });
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
              value={localFilters.startDate?.lte}
              onChange={(date) => {
                const dateValue = date instanceof Date ? date : null;
                if (!dateValue && !localFilters.startDate?.gte) {
                  setLocalFilters({ ...localFilters, startDate: undefined });
                } else {
                  setLocalFilters({
                    ...localFilters,
                    startDate: {
                      ...(localFilters.startDate?.gte && { gte: localFilters.startDate.gte }),
                      ...(dateValue && { lte: dateValue }),
                    },
                  });
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
