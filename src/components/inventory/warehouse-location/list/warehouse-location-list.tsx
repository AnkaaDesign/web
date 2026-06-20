import { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useBatchDeleteWarehouseLocations } from "../../../../hooks";
import type { WarehouseLocation } from "../../../../types";
import type { WarehouseLocationGetManyInput } from "../../../../schemas";
import { routes, WAREHOUSE_LOCATION_TYPE, WAREHOUSE_LOCATION_TYPE_LABELS } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { WarehouseLocationTable } from "./warehouse-location-table";
import { WarehouseLocationFilters } from "./warehouse-location-filters";
import { FilterIndicators } from "@/components/ui/filter-indicator";
import { IconFilter, IconCircleCheck, IconCategory, IconMapPin } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface WarehouseLocationListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function WarehouseLocationList({ className }: WarehouseLocationListProps) {
  const navigate = useNavigate();
  const batchDeleteMutation = useBatchDeleteWarehouseLocations();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ locations: WarehouseLocation[]; isBulk: boolean } | null>(null);

  const deserializeFilters = useCallback((params: URLSearchParams): Partial<WarehouseLocationGetManyInput> => {
    const filters: Partial<WarehouseLocationGetManyInput> = {};

    const isActive = params.get("isActive");
    if (isActive !== null) {
      filters.isActive = isActive === "true";
    }

    const types = params.get("types");
    if (types) {
      try {
        const arr = JSON.parse(types);
        if (Array.isArray(arr) && arr.length > 0) {
          const valid = arr.filter((t) => Object.values(WAREHOUSE_LOCATION_TYPE).includes(t));
          if (valid.length > 0) filters.types = valid;
        }
      } catch {
        // ignore
      }
    }

    const sections = params.get("sections");
    if (sections) {
      try {
        const arr = JSON.parse(sections);
        if (Array.isArray(arr) && arr.length > 0) filters.sections = arr;
      } catch {
        // ignore
      }
    }

    return filters;
  }, []);

  const serializeFilters = useCallback((filters: Partial<WarehouseLocationGetManyInput>): Record<string, string> => {
    const params: Record<string, string> = {};
    if (typeof filters.isActive === "boolean") params.isActive = String(filters.isActive);
    if (filters.types?.length) params.types = JSON.stringify(filters.types);
    if (filters.sections?.length) params.sections = JSON.stringify(filters.sections);
    return params;
  }, []);

  const {
    filters,
    setFilters,
    searchingFor,
    displaySearchText,
    setSearch,
    clearAllFilters,
    queryFilters: baseQueryFilters,
    hasActiveFilters,
  } = useTableFilters<WarehouseLocationGetManyInput>({
    defaultFilters: {
      limit: DEFAULT_PAGE_SIZE,
    },
    searchDebounceMs: 500,
    searchParamName: "search",
    serializeToUrl: serializeFilters,
    deserializeFromUrl: deserializeFilters,
    excludeFromUrl: ["limit", "orderBy"],
  });

  const queryFilters = useMemo(() => {
    const { orderBy: _, ...filterWithoutOrderBy } = baseQueryFilters;
    return {
      ...filterWithoutOrderBy,
      limit: DEFAULT_PAGE_SIZE,
    };
  }, [baseQueryFilters]);

  const handleFilterChange = useCallback(
    (newFilters: Partial<WarehouseLocationGetManyInput>) => {
      const { orderBy: _, ...filtersWithoutOrderBy } = newFilters;
      setFilters(filtersWithoutOrderBy);
    },
    [setFilters],
  );

  const onRemoveFilter = useCallback(
    (key: keyof WarehouseLocationGetManyInput) => {
      setFilters((prev) => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    },
    [setFilters],
  );

  // Build active filter badges.
  const activeFilters = useMemo(() => {
    const arr: Array<{ key: string; label: string; value: string; onRemove: () => void; icon?: React.ReactNode }> = [];

    if (searchingFor) {
      arr.push({ key: "searchingFor", label: "Buscar", value: searchingFor, onRemove: () => setSearch(""), icon: <IconFilter className="h-3 w-3" /> });
    }

    if (typeof filters.isActive === "boolean") {
      arr.push({
        key: "isActive",
        label: "Status",
        value: filters.isActive ? "Ativos" : "Inativos",
        onRemove: () => onRemoveFilter("isActive"),
        icon: <IconCircleCheck className="h-3 w-3" />,
      });
    }

    if (filters.types && filters.types.length > 0) {
      (filters.types as WAREHOUSE_LOCATION_TYPE[]).forEach((type) => {
        arr.push({
          key: `types-${type}`,
          label: "Tipo",
          value: WAREHOUSE_LOCATION_TYPE_LABELS[type],
          onRemove: () => {
            const next = (filters.types as WAREHOUSE_LOCATION_TYPE[]).filter((t) => t !== type);
            setFilters((prev) => ({ ...prev, types: next.length > 0 ? next : undefined }));
          },
          icon: <IconCategory className="h-3 w-3" />,
        });
      });
    }

    if (filters.sections && filters.sections.length > 0) {
      filters.sections.forEach((section) => {
        arr.push({
          key: `sections-${section}`,
          label: "Setor",
          value: section,
          onRemove: () => {
            const next = (filters.sections ?? []).filter((s) => s !== section);
            setFilters((prev) => ({ ...prev, sections: next.length > 0 ? next : undefined }));
          },
          icon: <IconMapPin className="h-3 w-3" />,
        });
      });
    }

    return arr;
  }, [filters, searchingFor, onRemoveFilter, setFilters, setSearch]);

  const handleBulkEdit = (locations: WarehouseLocation[]) => {
    if (locations.length === 1) {
      navigate(routes.inventory.warehouseLocations.edit(locations[0].id));
    }
  };

  const handleBulkDelete = (locations: WarehouseLocation[]) => {
    setDeleteDialog({ locations, isBulk: locations.length > 1 });
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;
    try {
      const ids = deleteDialog.locations.map((l) => l.id);
      await batchDeleteMutation.mutateAsync({ warehouseLocationIds: ids });
      setDeleteDialog(null);
    } catch (error) {
      // Error handled by api-client interceptor
    }
  };

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            ref={searchInputRef}
            value={displaySearchText}
            onChange={setSearch}
            placeholder="Buscar por nome, setor, código..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)}>
              <IconFilter className="h-4 w-4" />
              <span>
                Filtros
                {hasActiveFilters ? ` (${activeFilters.length})` : ""}
              </span>
            </Button>
          </div>
        </div>

        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={clearAllFilters} className="px-1 py-1" />}

        <div className="flex-1 min-h-0 overflow-auto">
          <WarehouseLocationTable onEdit={handleBulkEdit} onDelete={handleBulkDelete} filters={queryFilters} className="h-full" />
        </div>
      </CardContent>

      <WarehouseLocationFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog && (
                <>
                  Tem certeza que deseja deletar {deleteDialog.isBulk ? `${deleteDialog.locations.length} localizações` : "esta localização"}?
                  <br />
                  <strong>Esta ação não pode ser desfeita.</strong>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
