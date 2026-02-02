import React, { useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Representative } from "@/types/representative";
import type { RepresentativeGetManyFormData } from "@/types/representative";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { RepresentativeTable } from "./representative-table";
import { IconFilter } from "@tabler/icons-react";
import { RepresentativeFilters } from "./representative-filters";
import { FilterIndicators } from "./filter-indicator";
import { cn } from "@/lib/utils";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { useTableState } from "@/hooks/use-table-state";
import { useTableFilters } from "@/hooks/use-table-filters";
import { representativeService } from "@/services/representativeService";
import { useToast } from "@/hooks/use-toast";
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
import { REPRESENTATIVE_ROLE_LABELS } from "@/types/representative";

interface RepresentativeListProps {
  className?: string;
  customerId?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function RepresentativeList({ className, customerId }: RepresentativeListProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State
  const [tableData, setTableData] = useState<{
    representatives: Representative[];
    totalRecords: number;
  }>({ representatives: [], totalRecords: 0 });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{
    items: Representative[];
    isBulk: boolean;
  } | null>(null);
  const [displaySearchText, setDisplaySearchText] = useState("");

  // Table state
  const {
    searchingFor,
    selectionCount,
    showSelectedOnly,
    setSearch,
    toggleShowSelectedOnly,
    clearAllFilters,
  } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
  });

  // Filters
  const { filters, updateFilters, clearFilters, activeFilterCount } = useTableFilters<
    Partial<RepresentativeGetManyFormData>
  >({
    defaultFilters: customerId ? { customerId } : {},
    deserializer: (params) => {
      const filters: Partial<RepresentativeGetManyFormData> = {};

      // Parse role filter
      const role = params.get("role");
      if (role) filters.role = role as any;

      // Parse status filter
      const isActive = params.get("isActive");
      if (isActive !== null) {
        filters.isActive = isActive === "true";
      }

      // Keep customerId if it was provided
      if (customerId) {
        filters.customerId = customerId;
      }

      return filters;
    },
    serializer: (filters) => {
      const params = new URLSearchParams();

      if (filters.role) params.set("role", filters.role);
      if (filters.isActive !== undefined) params.set("isActive", String(filters.isActive));

      return params;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 1) {
        return representativeService.delete(ids[0]);
      } else {
        return representativeService.batchDelete(ids);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["representatives"] });
      toast({
        title: "Sucesso",
        description: deleteDialog?.isBulk
          ? "Representantes excluídos com sucesso"
          : "Representante excluído com sucesso",
      });
      setDeleteDialog(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao excluir representante(s)",
        variant: "destructive",
      });
    },
  });

  // Callbacks
  const handleTableDataChange = useCallback((data: {
    representatives: Representative[];
    totalRecords: number;
  }) => {
    setTableData(data);
  }, []);

  const handleBulkEdit = useCallback((representatives: Representative[]) => {
    if (representatives.length === 1) {
      navigate(`/representatives/${representatives[0].id}/edit`);
    } else {
      // For now, we don't have batch edit for representatives
      // Could implement later if needed
      toast({
        title: "Informação",
        description: "Edição em lote não disponível para representantes",
      });
    }
  }, [navigate, toast]);

  const handleBulkDelete = useCallback((representatives: Representative[]) => {
    setDeleteDialog({
      items: representatives,
      isBulk: representatives.length > 1
    });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteDialog) return;
    const ids = deleteDialog.items.map(rep => rep.id);
    deleteMutation.mutate(ids);
  }, [deleteDialog, deleteMutation]);

  const handleUpdatePassword = useCallback((representative: Representative) => {
    navigate(`/representatives/${representative.id}/password`);
  }, [navigate]);

  // Filter removal handler
  const onRemoveFilter = useCallback((key: string, value?: any) => {
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
        value: REPRESENTATIVE_ROLE_LABELS[filters.role],
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
              setDisplaySearchText(value);
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
          <RepresentativeTable
            filters={filters}
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
      <RepresentativeFilters
        open={showFilterModal}
        onOpenChange={setShowFilterModal}
        filters={filters}
        onFiltersChange={updateFilters}
        onClearFilters={clearFilters}
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
                ? `Tem certeza que deseja deletar ${deleteDialog.items.length} representantes? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja deletar o representante "${deleteDialog?.items[0]?.name}"? Esta ação não pode ser desfeita.`}
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