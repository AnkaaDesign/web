import { useState, useEffect, useCallback } from "react";
import { IconFilter, IconStethoscope, IconShield, IconClipboardCheck, IconUser, IconCalendar } from "@tabler/icons-react";

import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { getUsers } from "../../../../api-client";
import {
  MEDICAL_EXAM_TYPE_LABELS,
  MEDICAL_EXAM_STATUS_LABELS,
  MEDICAL_EXAM_RESULT_LABELS,
} from "../../../../constants";
import type { MedicalExamGetManyFormData } from "@/schemas/medical-exam";

interface MedicalExamFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<MedicalExamGetManyFormData>;
  onFilterChange: (filters: Partial<MedicalExamGetManyFormData>) => void;
}

export function MedicalExamFilters({ open, onOpenChange, filters, onFilterChange }: MedicalExamFiltersProps) {
  // Local state for immediate UI updates
  const [localFilters, setLocalFilters] = useState<Partial<MedicalExamGetManyFormData>>(filters);

  // Sync local state with URL filters when modal opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  const selectedTypes = (localFilters.types as string[]) || [];
  const selectedStatuses = (localFilters.statuses as string[]) || [];
  const selectedResults = (localFilters.results as string[]) || [];
  const selectedUserIds = (localFilters.userIds as string[]) || [];

  const handleApplyFilters = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleResetFilters = () => {
    onFilterChange({});
    setLocalFilters({});
    onOpenChange(false);
  };

  const typeOptions = Object.entries(MEDICAL_EXAM_TYPE_LABELS).map(([value, label]) => ({ value, label }));
  const statusOptions = Object.entries(MEDICAL_EXAM_STATUS_LABELS).map(([value, label]) => ({ value, label }));
  const resultOptions = Object.entries(MEDICAL_EXAM_RESULT_LABELS).map(([value, label]) => ({ value, label }));

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

      return {
        data: users.map((user) => ({ value: user.id, label: user.name })),
        hasMore: response.meta?.hasNextPage || false,
      };
    } catch (error) {
      console.error("Error fetching users:", error);
      return { data: [], hasMore: false };
    }
  }, []);

  const toArray = (value: string | string[] | undefined | null): string[] => (Array.isArray(value) ? value : value ? [value] : []);

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
      description="Filtre os exames por tipo, status, resultado, colaborador e datas"
      activeFilterCount={activeFilterCount}
      onApply={handleApplyFilters}
      onReset={handleResetFilters}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
    >
      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconStethoscope className="h-4 w-4" />
          Tipo de Exame
        </Label>
        <Combobox
          mode="multiple"
          options={typeOptions}
          value={selectedTypes}
          onValueChange={(value) => setLocalFilters({ ...localFilters, types: toArray(value).length > 0 ? toArray(value) : undefined })}
          placeholder="Selecione os tipos"
          searchable={true}
          minSearchLength={0}
        />
      </div>

      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconShield className="h-4 w-4" />
          Status
        </Label>
        <Combobox
          mode="multiple"
          options={statusOptions}
          value={selectedStatuses}
          onValueChange={(value) => setLocalFilters({ ...localFilters, statuses: toArray(value).length > 0 ? toArray(value) : undefined })}
          placeholder="Selecione os status"
          searchable={true}
          minSearchLength={0}
        />
      </div>

      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconClipboardCheck className="h-4 w-4" />
          Resultado
        </Label>
        <Combobox
          mode="multiple"
          options={resultOptions}
          value={selectedResults}
          onValueChange={(value) => setLocalFilters({ ...localFilters, results: toArray(value).length > 0 ? toArray(value) : undefined })}
          placeholder="Selecione os resultados"
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
          queryKey={["users", "medical-exam-filter"]}
          queryFn={queryUsers}
          initialOptions={[]}
          value={selectedUserIds}
          onValueChange={(value) => setLocalFilters({ ...localFilters, userIds: toArray(value).length > 0 ? toArray(value) : undefined })}
          placeholder="Selecione os colaboradores"
          searchable={true}
          minSearchLength={0}
          pageSize={50}
          debounceMs={300}
        />
      </div>

      <div className="space-y-6">
        {/* Scheduled Date Range */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <IconCalendar className="h-4 w-4" />
            Agendado para
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
              <DateTimeInput
                mode="date"
                value={localFilters.scheduledAt?.gte}
                onChange={(date) => {
                  const dateValue = date instanceof Date ? date : null;
                  if (!dateValue && !localFilters.scheduledAt?.lte) {
                    setLocalFilters({ ...localFilters, scheduledAt: undefined });
                  } else {
                    setLocalFilters({
                      ...localFilters,
                      scheduledAt: {
                        ...(dateValue && { gte: dateValue }),
                        ...(localFilters.scheduledAt?.lte && { lte: localFilters.scheduledAt.lte }),
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
                value={localFilters.scheduledAt?.lte}
                onChange={(date) => {
                  const dateValue = date instanceof Date ? date : null;
                  if (!dateValue && !localFilters.scheduledAt?.gte) {
                    setLocalFilters({ ...localFilters, scheduledAt: undefined });
                  } else {
                    setLocalFilters({
                      ...localFilters,
                      scheduledAt: {
                        ...(localFilters.scheduledAt?.gte && { gte: localFilters.scheduledAt.gte }),
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

        {/* Exam Date Range */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <IconCalendar className="h-4 w-4" />
            Data do Exame
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
              <DateTimeInput
                mode="date"
                value={localFilters.examDate?.gte}
                onChange={(date) => {
                  const dateValue = date instanceof Date ? date : null;
                  if (!dateValue && !localFilters.examDate?.lte) {
                    setLocalFilters({ ...localFilters, examDate: undefined });
                  } else {
                    setLocalFilters({
                      ...localFilters,
                      examDate: {
                        ...(dateValue && { gte: dateValue }),
                        ...(localFilters.examDate?.lte && { lte: localFilters.examDate.lte }),
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
                value={localFilters.examDate?.lte}
                onChange={(date) => {
                  const dateValue = date instanceof Date ? date : null;
                  if (!dateValue && !localFilters.examDate?.gte) {
                    setLocalFilters({ ...localFilters, examDate: undefined });
                  } else {
                    setLocalFilters({
                      ...localFilters,
                      examDate: {
                        ...(localFilters.examDate?.gte && { gte: localFilters.examDate.gte }),
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
      </div>
    </FilterDrawer>
  );
}
