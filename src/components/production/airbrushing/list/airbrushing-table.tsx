import React, { useCallback, useMemo, useState } from "react";
import { useAirbrushings, useAirbrushingMutations } from "../../../../hooks";
import type { Airbrushing } from "../../../../types";
import type { AirbrushingGetManyFormData } from "../../../../schemas";
import { StandardizedTable } from "@/components/ui/standardized-table";
import { cn } from "@/lib/utils";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { toast } from "sonner";
import { routes } from "../../../../constants";
import { useNavigate } from "react-router-dom";
import { IconSpray } from "@tabler/icons-react";
import { getAirbrushingTableColumns } from "./airbrushing-table-columns";
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

interface AirbrushingTableProps {
  className?: string;
  onRowClick?: (airbrushing: Airbrushing) => void;
  showSelectedOnly?: boolean;
  visibleColumns?: Set<string>;
  filters?: Partial<AirbrushingGetManyFormData>;
  onDataChange?: (data: { items: Airbrushing[]; totalRecords: number }) => void;
}

export function AirbrushingTable({ className, onRowClick, showSelectedOnly = false, visibleColumns = new Set(), filters = {}, onDataChange }: AirbrushingTableProps) {
  const navigate = useNavigate();

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    items: Airbrushing[];
    isBulk: boolean;
  } | null>(null);

  // Use URL state management for pagination and selection
  const {
    page,
    pageSize,
    selectedIds,
    sortConfigs,
    showSelectedOnly: showSelectedOnlyFromHook,
    setPage,
    setPageSize,
    toggleSelection,
    toggleSelectAll,
    toggleSort,
    getSortDirection,
    getSortOrder,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    selectionCount,
    resetSelection,
    removeFromSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Memoize include configuration to prevent re-renders
  const includeConfig = useMemo(
    () => ({
      task: {
        include: {
          customer: true,
          sector: true,
          user: true,
        },
      },
      receipts: true,
      nfes: true,
    }),
    [],
  );

  // Memoize query parameters to prevent infinite re-renders
  const queryParams = useMemo(() => {
    const params = {
      // When showSelectedOnly is true, don't apply filters
      ...(showSelectedOnly ? {} : filters),
      page: page + 1, // Convert 0-based to 1-based for API
      limit: pageSize,
      include: includeConfig,
      // Convert sortConfigs to orderBy format for API
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
      // When showSelectedOnly is true, only show selected items
      ...(showSelectedOnly &&
        selectedIds.length > 0 && {
          where: {
            id: { in: selectedIds },
          },
        }),
    };

    return params;
  }, [filters, page, pageSize, includeConfig, sortConfigs, showSelectedOnly, selectedIds]);

  // Use the airbrushings hook with memoized parameters
  const { data: response, isLoading, error } = useAirbrushings(queryParams);

  const airbrushings = response?.data || [];
  const totalPages = response?.meta ? Math.ceil(response.meta.totalRecords / pageSize) : 1;
  const totalRecords = response?.meta?.totalRecords || 0;

  // Mutations
  const { deleteAsync: deleteAirbrushing } = useAirbrushingMutations();

  // Notify parent component of data changes
  // Use a ref to track if we've already notified for this exact data
  const lastNotifiedDataRef = React.useRef<string>("");
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (onDataChange && isMountedRef.current) {
      // Create a unique key for the current data to detect real changes
      const dataKey = airbrushings.length > 0 ? `${totalRecords}-${airbrushings.map((airbrushing) => airbrushing.id).join(",")}` : `empty-${totalRecords}`;

      // Only notify if this exact data hasn't been notified yet
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ items: airbrushings, totalRecords });
      }
    }
  }, [airbrushings, totalRecords, onDataChange]);

  // Use prop if provided, otherwise use hook state
  const effectiveShowSelectedOnly = showSelectedOnly ?? showSelectedOnlyFromHook;

  // Get current page item IDs for selection
  const currentPageItemIds = useMemo(() => {
    return airbrushings.map((airbrushing) => airbrushing.id);
  }, [airbrushings]);

  // Selection handlers
  const allSelected = isAllSelected(currentPageItemIds);
  const partiallySelected = isPartiallySelected(currentPageItemIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageItemIds);
  };

  const handleSelectItem = (airbrushingId: string) => {
    toggleSelection(airbrushingId);
  };

  // Handle delete
  const handleDelete = useCallback(
    (airbrushing: Airbrushing, event?: React.MouseEvent) => {
      if (event) {
        event.stopPropagation();
      }

      setDeleteDialog({
        items: [airbrushing],
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
          await deleteAirbrushing(item.id);
          // Remove deleted ID from selection
          removeFromSelection([item.id]);
        }
        toast.success(deleteDialog.isBulk ? `${deleteDialog.items.length} airbrushings excluídos com sucesso` : "Airbrushing excluído com sucesso");
      } catch (error) {
        toast.error("Erro ao excluir airbrushing");
      } finally {
        setDeleteDialog(null);
      }
    }
  };

  // Handle edit
  const handleEdit = useCallback(
    (airbrushing: Airbrushing, event?: React.MouseEvent) => {
      if (event) {
        event.stopPropagation();
      }
      navigate(routes.production.airbrushings.edit(airbrushing.id));
    },
    [navigate],
  );

  // Handle view details
  const handleView = useCallback(
    (airbrushing: Airbrushing, event?: React.MouseEvent) => {
      if (event) {
        event.stopPropagation();
      }
      navigate(routes.production.airbrushings.details(airbrushing.id));
    },
    [navigate],
  );

  // Get table columns with proper selection handlers
  const columns = getAirbrushingTableColumns({
    selection: {},
    onRowSelection: handleSelectItem,
    onView: handleView,
    onEdit: handleEdit,
    onDelete: handleDelete,
  });

  // Filter columns based on visibility, but always show select and actions columns
  const visibleColumnsArray = columns.filter((col) => col.key === "select" || col.key === "actions" || visibleColumns.size === 0 || visibleColumns.has(col.key));

  return (
    <>
      <StandardizedTable
        columns={visibleColumnsArray}
        data={airbrushings}
        getItemKey={(airbrushing) => airbrushing.id}
        onRowClick={onRowClick}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        pageSize={pageSize}
        totalRecords={totalRecords}
        onPageSizeChange={(size) => setPageSize(size)}
        isLoading={isLoading}
        error={error ? "Erro ao carregar airbrushings" : undefined}
        emptyMessage="Nenhum airbrushing encontrado"
        emptyIcon={IconSpray}
        onSelectAll={handleSelectAll}
        itemTestIdPrefix="airbrushing"
        allSelected={allSelected}
        partiallySelected={partiallySelected}
        className={cn("h-full", className)}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir airbrushing</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk && deleteDialog.items.length > 1
                ? `Tem certeza que deseja excluir ${deleteDialog.items.length} airbrushings? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja excluir o airbrushing da tarefa "${deleteDialog?.items[0]?.task?.name || "N/A"}"? Esta ação não pode ser desfeita.`}
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
