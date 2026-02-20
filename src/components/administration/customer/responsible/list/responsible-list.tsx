import { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { routes } from "@/constants";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Responsible } from "@/types/responsible";
import type { ResponsibleGetManyFormData } from "@/types/responsible";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { ResponsibleTable } from "./responsible-table";
import { IconFilter } from "@tabler/icons-react";
import { ResponsibleFilters } from "./responsible-filters";
import { FilterIndicators } from "./filter-indicator";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { ResponsibleExport } from "./responsible-export";
import { createResponsibleColumns, DEFAULT_VISIBLE_COLUMNS } from "./responsible-columns";
import { cn } from "@/lib/utils";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableState } from "@/hooks/common/use-table-state";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { responsibleService } from "@/services/responsibleService";
import { useToast } from "@/hooks/common/use-toast";
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
import { RESPONSIBLE_ROLE_LABELS } from "@/types/responsible";

interface ResponsibleListProps {
  className?: string;
  companyId?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function ResponsibleList({ className, companyId }: ResponsibleListProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State
  const [tableData, setTableData] = useState<{
    responsibles: Responsible[];
    totalRecords: number;
  }>({ responsibles: [], totalRecords: 0 });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    items: Responsible[];
    isBulk: boolean;
  } | null>(null);

  // Table state for selection only
  const {
    selectionCount,
    showSelectedOnly,
    toggleShowSelectedOnly,
  } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
  });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "responsible-list-visible-columns",
    DEFAULT_VISIBLE_COLUMNS
  );

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createResponsibleColumns(), []);

  // Custom deserializer for responsible filters
  const deserializeResponsibleFilters = useCallback((params: URLSearchParams): Partial<ResponsibleGetManyFormData> => {
    const filters: Partial<ResponsibleGetManyFormData> = {};

    // Parse role filter
    const role = params.get("role");
    if (role) filters.role = role as any;

    // Parse status filter
    const isActive = params.get("isActive");
    if (isActive !== null) {
      filters.isActive = isActive === "true";
    }

    // Keep companyId if it was provided
    if (companyId) {
      filters.companyId = companyId;
    }

    return filters;
  }, [companyId]);

  // Custom serializer for responsible filters
  const serializeResponsibleFilters = useCallback((filters: Partial<ResponsibleGetManyFormData>): Record<string, string> => {
    const params: Record<string, string> = {};

    if (filters.role) params.role = filters.role;
    if (filters.isActive !== undefined) params.isActive = String(filters.isActive);

    return params;
  }, []);

  // Use the unified table filters hook (like customer-list does)
  const {
    filters,
    setFilters: updateFilters,
    searchingFor,
    displaySearchText,
    setSearch,
    clearAllFilters,
  } = useTableFilters<Partial<ResponsibleGetManyFormData>>({
    defaultFilters: companyId ? { companyId } : {},
    searchDebounceMs: 500,
    searchParamName: "search",
    serializeToUrl: serializeResponsibleFilters,
    deserializeFromUrl: deserializeResponsibleFilters,
    excludeFromUrl: ["companyId"],
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 1) {
        return responsibleService.delete(ids[0]);
      } else {
        return responsibleService.batchDelete(ids);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["responsibles"] });
      toast({
        title: "Sucesso",
        description: deleteDialog?.isBulk
          ? "Responsáveis excluídos com sucesso"
          : "Responsável excluído com sucesso",
      });
      setDeleteDialog(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao excluir responsável(is)",
        variant: "error",
      });
    },
  });

  // Callbacks
  const handleTableDataChange = useCallback((data: {
    responsibles: Responsible[];
    totalRecords: number;
  }) => {
    setTableData(data);
  }, []);

  const handleBulkEdit = useCallback((responsibles: Responsible[]) => {
    if (responsibles.length === 1) {
      navigate(routes.responsibles.edit(responsibles[0].id));
    } else {
      // For now, we don't have batch edit for responsibles
      // Could implement later if needed
      toast({
        title: "Informação",
        description: "Edição em lote não disponível para responsáveis",
      });
    }
  }, [navigate, toast]);

  const handleBulkDelete = useCallback((responsibles: Responsible[]) => {
    setDeleteDialog({
      items: responsibles,
      isBulk: responsibles.length > 1
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteDialog) return;
    const ids = deleteDialog.items.map(resp => resp.id);
    deleteMutation.mutate(ids);
  }, [deleteDialog, deleteMutation]);

  const handleUpdatePassword = useCallback((responsible: Responsible) => {
    navigate(routes.responsibles.password(responsible.id));
  }, [navigate]);

  // Filter removal handler
  const onRemoveFilter = useCallback((key: string, _value?: any) => {
    if (key === "searchingFor") {
      setSearch("");
    } else if (key === "role") {
      const { role, ...rest } = filters;
      updateFilters(rest);
    } else if (key === "isActive") {
      const { isActive, ...rest } = filters;
      updateFilters(rest);
    }
  }, [filters, updateFilters, setSearch]);

  // Extract active filters for display
  const activeFilters = useMemo(() => {
    const items: Array<{
      id: string;
      label: string;
      value?: string;
      onRemove: () => void;
      iconType?: string;
    }> = [];

    // Add search filter
    if (searchingFor) {
      items.push({
        id: "searchingFor",
        label: "Busca",
        value: searchingFor,
        onRemove: () => onRemoveFilter("searchingFor"),
        iconType: "search",
      });
    }

    // Add role filter
    if (filters.role) {
      items.push({
        id: "role",
        label: "Função",
        value: RESPONSIBLE_ROLE_LABELS[filters.role],
        onRemove: () => onRemoveFilter("role"),
      });
    }

    // Add status filter
    if (filters.isActive !== undefined) {
      items.push({
        id: "isActive",
        label: "Status",
        value: filters.isActive ? "Ativo" : "Inativo",
        onRemove: () => onRemoveFilter("isActive"),
      });
    }

    return items;
  }, [filters, searchingFor, onRemoveFilter]);

  // Count active filters (excluding search)
  const activeFilterCountWithoutSearch = useMemo(() => {
    let count = 0;
    if (filters.role) count++;
    if (filters.isActive !== undefined) count++;
    return count;
  }, [filters]);

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            ref={searchInputRef}
            value={displaySearchText}
            onChange={(value) => {
              setSearch(value);
            }}
            placeholder="Buscar por nome, telefone, email..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ShowSelectedToggle
              showSelectedOnly={showSelectedOnly}
              onToggle={toggleShowSelectedOnly}
              selectionCount={selectionCount}
            />
            <Button
              variant={activeFilterCountWithoutSearch > 0 ? "default" : "outline"}
              size="default"
              onClick={() => setShowFilterModal(true)}
              className="group"
            >
              <IconFilter className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-foreground">
                Filtros
                {activeFilterCountWithoutSearch > 0 ? ` (${activeFilterCountWithoutSearch})` : ""}
              </span>
            </Button>
            <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
            <ResponsibleExport filters={filters} currentResponsibles={tableData.responsibles} totalRecords={tableData.totalRecords} visibleColumns={visibleColumns} />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && (
          <FilterIndicators
            filters={activeFilters.map((filter) => ({
              key: filter.id,
              label: filter.label,
              value: filter.value,
              onRemove: filter.onRemove,
              iconType: filter.iconType,
            }))}
            onClearAll={clearAllFilters}
            className="px-1 py-1"
          />
        )}

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <ResponsibleTable
            filters={filters}
            visibleColumns={visibleColumns}
            onEdit={handleBulkEdit}
            onDelete={handleBulkDelete}
            onUpdatePassword={handleUpdatePassword}
            onDataChange={handleTableDataChange}
            className="h-full"
            searchTerm={searchingFor}
          />
        </div>
      </CardContent>

      {/* Filters Modal */}
      <ResponsibleFilters
        open={showFilterModal}
        onOpenChange={setShowFilterModal}
        filters={filters}
        onFiltersChange={updateFilters}
        onClearFilters={clearAllFilters}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteDialog}
        onOpenChange={(open) => !open && setDeleteDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk
                ? `Tem certeza que deseja deletar ${deleteDialog.items.length} responsáveis? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja deletar o responsável "${deleteDialog?.items[0]?.name}"? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
