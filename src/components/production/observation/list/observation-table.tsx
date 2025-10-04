import React, { useCallback, useMemo, useState } from "react";
import { useObservations, useObservationMutations } from "../../../../hooks";
import type { Observation } from "../../../../types";
import type { ObservationGetManyFormData } from "../../../../schemas";
import { StandardizedTable } from "@/components/ui/standardized-table";
import type { StandardizedColumn } from "@/components/ui/standardized-table";
import { IconNotes } from "@tabler/icons-react";
import { useTableState } from "@/hooks/use-table-state";
import { toast } from "sonner";
import { routes } from "../../../../constants";
import { useNavigate } from "react-router-dom";
import { createObservationColumns } from "./observation-table-columns";
import { cn } from "@/lib/utils";
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

interface ObservationTableProps {
  className?: string;
  onRowClick?: (observation: Observation) => void;
  showSelectedOnly?: boolean;
  visibleColumns?: Set<string>;
  query: ObservationGetManyFormData;
}

export function ObservationTable({ className, onRowClick, showSelectedOnly = false, visibleColumns = new Set(), query }: ObservationTableProps) {
  const navigate = useNavigate();

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    items: Observation[];
    isBulk: boolean;
  } | null>(null);

  // Get table state for selection and pagination
  const {
    page,
    pageSize,
    setPage,
    setPageSize,
    selectedIds,
    setSelectedIds,
    toggleSelection: _toggleSelection,
    deselectAll,
    selectionCount,
    showSelectedOnly: showSelectedOnlyFromHook,
  } = useTableState();

  // Build query with pagination
  const paginatedQuery = useMemo(
    () => ({
      ...query,
      page: page + 1, // Convert 0-based to 1-based for API
      limit: pageSize,
    }),
    [query, page, pageSize],
  );

  // Fetch observations
  const { data: response, isLoading, error } = useObservations(paginatedQuery);
  const observations = response?.data || [];
  const totalRecords = response?.meta?.totalRecords || 0;

  // Mutations
  const { deleteAsync: deleteObservation } = useObservationMutations();

  // Convert selectedIds array to selection object for compatibility
  const selection = useMemo(() => {
    const selectionObj: Record<string, boolean> = {};
    selectedIds.forEach((id: string) => {
      selectionObj[id] = true;
    });
    return selectionObj;
  }, [selectedIds]);

  // Use prop if provided, otherwise use hook state
  const effectiveShowSelectedOnly = showSelectedOnly ?? showSelectedOnlyFromHook;

  // Filter observations if showing selected only
  const displayedObservations = useMemo(() => {
    if (effectiveShowSelectedOnly && selectionCount > 0) {
      return observations.filter((observation: Observation) => selection[observation.id]);
    }
    return observations;
  }, [observations, effectiveShowSelectedOnly, selectionCount, selection]);

  // Handle row selection
  const handleRowSelection = useCallback(
    (observationId: string, selected: boolean) => {
      if (selected) {
        const newSelectedIds = [...selectedIds, observationId];
        setSelectedIds(newSelectedIds);
      } else {
        const newSelectedIds = selectedIds.filter((id: string) => id !== observationId);
        setSelectedIds(newSelectedIds);
      }
    },
    [selectedIds, setSelectedIds],
  );

  // Handle select all
  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        const newSelectedIds = displayedObservations.map((observation: Observation) => observation.id);
        setSelectedIds(newSelectedIds);
      } else {
        deselectAll();
      }
    },
    [displayedObservations, setSelectedIds, deselectAll],
  );

  // Handle delete
  const handleDelete = useCallback(
    (observation: Observation, event?: React.MouseEvent) => {
      if (event) {
        event.stopPropagation();
      }

      setDeleteDialog({
        items: [observation],
        isBulk: false,
      });
    },
    [],
  );

  // Confirm delete
  const confirmDelete = async () => {
    if (deleteDialog) {
      try {
        for (const item of deleteDialog.items) {
          await deleteObservation(item.id);
        }
        toast.success(deleteDialog.isBulk ? `${deleteDialog.items.length} observações excluídas com sucesso` : "Observação excluída com sucesso");
      } catch (error) {
        toast.error("Erro ao excluir observação");
      } finally {
        setDeleteDialog(null);
      }
    }
  };

  // Handle edit
  const handleEdit = useCallback(
    (observation: Observation, event?: React.MouseEvent) => {
      if (event) {
        event.stopPropagation();
      }
      navigate(routes.production.observations.edit(observation.id));
    },
    [navigate],
  );

  // Handle view details
  const handleView = useCallback(
    (observation: Observation, event?: React.MouseEvent) => {
      if (event) {
        event.stopPropagation();
      }
      navigate(routes.production.observations.details(observation.id));
    },
    [navigate],
  );

  // Define table columns using the factory function
  const columns: StandardizedColumn<Observation>[] = createObservationColumns({
    selection,
    onRowSelection: handleRowSelection,
    onEdit: handleEdit,
    onDelete: handleDelete,
    onView: handleView,
  });

  // Filter columns based on visibility
  const visibleColumnsArray = columns.filter((col: StandardizedColumn<Observation>) => visibleColumns.size === 0 || visibleColumns.has(col.key));

  // Check if all current page items are selected
  const allCurrentPageSelected = displayedObservations.length > 0 && displayedObservations.every((observation: Observation) => selection[observation.id]);

  return (
    <>
      <StandardizedTable
        columns={visibleColumnsArray}
        data={displayedObservations}
        getItemKey={(observation: Observation) => observation.id}
        onRowClick={onRowClick}
        currentPage={page} // Convert to 0-based for StandardizedTable
        totalPages={Math.ceil(totalRecords / pageSize)}
        onPageChange={setPage}
        pageSize={pageSize}
        totalRecords={totalRecords}
        onPageSizeChange={(size: number) => setPageSize(size)}
        isLoading={isLoading}
        error={error ? "Erro ao carregar observações" : undefined}
        emptyMessage="Nenhuma observação encontrada"
        emptyIcon={IconNotes}
        onSelectAll={() => handleSelectAll(!allCurrentPageSelected)}
        allSelected={allCurrentPageSelected}
        partiallySelected={false}
        className={cn("h-full", className)}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir observação</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk && deleteDialog.items.length > 1
                ? `Tem certeza que deseja excluir ${deleteDialog.items.length} observações? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja excluir a observação "${deleteDialog?.items[0]?.description.substring(0, 50)}..."? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
