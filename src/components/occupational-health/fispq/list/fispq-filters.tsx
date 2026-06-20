import { useState, useEffect, useCallback } from "react";
import { IconFilter, IconShield, IconAlertTriangle, IconFlask, IconCategory, IconFileTypePdf, IconCalendarDue } from "@tabler/icons-react";

import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { getItemCategories } from "../../../../api-client";
import { FISPQ_STATUS_LABELS, GHS_SIGNAL_WORD_LABELS, GHS_PICTOGRAM_LABELS } from "../../../../constants";
import type { FispqFilters } from "./filter-utils";

interface FispqFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: FispqFilters;
  onFilterChange: (filters: FispqFilters) => void;
}

const EXPIRING_OPTIONS = [
  { value: "0", label: "Já vencidas" },
  { value: "30", label: "Vencendo em 30 dias" },
  { value: "60", label: "Vencendo em 60 dias" },
  { value: "90", label: "Vencendo em 90 dias" },
];

export function FispqFiltersComponent({ open, onOpenChange, filters, onFilterChange }: FispqFiltersProps) {
  // Local state for immediate UI updates
  const [localFilters, setLocalFilters] = useState<FispqFilters>(filters);

  // Sync local state with URL filters when modal opens
  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [open, filters]);

  const selectedStatuses = (localFilters.statuses as string[]) || [];
  const selectedSignalWords = (localFilters.signalWords as string[]) || [];
  const selectedPictograms = (localFilters.pictograms as string[]) || [];
  const selectedCategoryIds = (localFilters.categoryIds as string[]) || [];

  const handleApplyFilters = () => {
    onFilterChange(localFilters);
    onOpenChange(false);
  };

  const handleResetFilters = () => {
    onFilterChange({});
    setLocalFilters({});
    onOpenChange(false);
  };

  const statusOptions = Object.entries(FISPQ_STATUS_LABELS).map(([value, label]) => ({ value, label }));
  const signalWordOptions = Object.entries(GHS_SIGNAL_WORD_LABELS).map(([value, label]) => ({ value, label }));
  const pictogramOptions = Object.entries(GHS_PICTOGRAM_LABELS).map(([value, label]) => ({ value, label }));

  // Async query function for categories
  const queryCategories = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page,
        take: 50,
      };

      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getItemCategories(queryParams);
      const categories = response.data || [];

      return {
        data: categories.map((category) => ({ value: category.id, label: category.name })),
        hasMore: response.meta?.hasNextPage || false,
      };
    } catch (error) {
      console.error("Error fetching categories:", error);
      return { data: [], hasMore: false };
    }
  }, []);

  const toArray = (value: string | string[] | undefined | null): string[] => (Array.isArray(value) ? value : value ? [value] : []);

  // Count active filters
  const activeFilterCount = Object.entries(localFilters).filter(([key, value]) => {
    if (key === "page" || key === "limit" || key === "itemsPerPage" || key === "orderBy" || key === "sortOrder") return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
    if (key === "hasPdf") return value === false;
    return value !== undefined && value !== null && value !== "";
  }).length;

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Filtros Avançados"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Filtre as FISPQs por status, advertência, pictograma, categoria e vencimento"
      activeFilterCount={activeFilterCount}
      onApply={handleApplyFilters}
      onReset={handleResetFilters}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
    >
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
          <IconAlertTriangle className="h-4 w-4" />
          Palavra de advertência
        </Label>
        <Combobox
          mode="multiple"
          options={signalWordOptions}
          value={selectedSignalWords}
          onValueChange={(value) => setLocalFilters({ ...localFilters, signalWords: toArray(value).length > 0 ? toArray(value) : undefined })}
          placeholder="Selecione as advertências"
          searchable={true}
          minSearchLength={0}
        />
      </div>

      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconFlask className="h-4 w-4" />
          Pictogramas
        </Label>
        <Combobox
          mode="multiple"
          options={pictogramOptions}
          value={selectedPictograms}
          onValueChange={(value) => setLocalFilters({ ...localFilters, pictograms: toArray(value).length > 0 ? toArray(value) : undefined })}
          placeholder="Selecione os pictogramas"
          searchable={true}
          minSearchLength={0}
        />
      </div>

      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconCategory className="h-4 w-4" />
          Categoria
        </Label>
        <Combobox
          async={true}
          mode="multiple"
          queryKey={["item-categories", "fispq-filter"]}
          queryFn={queryCategories}
          initialOptions={[]}
          value={selectedCategoryIds}
          onValueChange={(value) => setLocalFilters({ ...localFilters, categoryIds: toArray(value).length > 0 ? toArray(value) : undefined })}
          placeholder="Selecione as categorias"
          searchable={true}
          minSearchLength={0}
          pageSize={50}
          debounceMs={300}
        />
      </div>

      <div>
        <Label className="flex items-center gap-2 mb-2">
          <IconCalendarDue className="h-4 w-4" />
          Vencimento
        </Label>
        <Combobox
          mode="single"
          options={EXPIRING_OPTIONS}
          value={localFilters.expiringInDays != null ? String(localFilters.expiringInDays) : undefined}
          onValueChange={(value) =>
            setLocalFilters({ ...localFilters, expiringInDays: typeof value === "string" && value !== "" ? Number(value) : undefined })
          }
          placeholder="Selecione o vencimento"
          searchable={false}
          clearable
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
        <Label htmlFor="fispq-only-without-pdf" className="flex items-center gap-2 cursor-pointer">
          <IconFileTypePdf className="h-4 w-4" />
          Somente sem PDF
        </Label>
        <Switch
          id="fispq-only-without-pdf"
          checked={localFilters.hasPdf === false}
          onCheckedChange={(checked) => setLocalFilters({ ...localFilters, hasPdf: checked ? false : undefined })}
        />
      </div>
    </FilterDrawer>
  );
}
