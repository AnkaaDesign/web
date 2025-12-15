import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Airbrushing } from "../../../../types";
import { routes } from "../../../../constants";
import { useAuth } from "../../../../hooks/useAuth";
import { canEditAirbrushings, canDeleteAirbrushings, shouldShowInteractiveElements } from "@/utils/permissions/entity-permissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  IconChevronUp,
  IconChevronDown,
  IconAlertTriangle,
  IconEdit,
  IconTrash,
  IconSelector,
  IconSpray,
  IconEye,
  IconCheck,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { useAirbrushingMutations, useAirbrushings } from "../../../../hooks";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import type { AirbrushingGetManyFormData } from "../../../../schemas";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { createAirbrushingColumns } from "./airbrushing-table-columns";
import type { AirbrushingColumn } from "./airbrushing-table-columns";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
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
import { toast } from "sonner";
import { SetStatusModal } from "./set-status-modal";

interface AirbrushingTableProps {
  visibleColumns: Set<string>;
  className?: string;
  filters?: Partial<AirbrushingGetManyFormData>;
  onDataChange?: (data: { items: Airbrushing[]; totalRecords: number }) => void;
}

export function AirbrushingTable({ visibleColumns, className, filters = {}, onDataChange }: AirbrushingTableProps) {
  const navigate = useNavigate();
  const { delete: deleteAirbrushing, update: updateAirbrushing } = useAirbrushingMutations();

  // Permission checks
  const { user, isLoading: isAuthLoading } = useAuth();
  const canEdit = user ? canEditAirbrushings(user) : false;
  const canDelete = user ? canDeleteAirbrushings(user) : false;
  const showInteractive = user ? shouldShowInteractiveElements(user, 'airbrushing') : false;

  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Use URL state management for pagination and selection
  const {
    page,
    pageSize,
    selectedIds,
    sortConfigs,
    showSelectedOnly,
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
    handleRowClick: handleRowClickSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Memoize include configuration to prevent re-renders
  const includeConfig = React.useMemo(
    () => ({
      task: {
        include: {
          customer: true,
          sector: true,
          user: true,
        },
      },
      receipts: true,
      invoices: true,
      artworks: true,
    }),
    [],
  );

  // Memoize query parameters to prevent infinite re-renders
  const queryParams = React.useMemo(() => {
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

  // Notify parent component of data changes
  const lastNotifiedDataRef = React.useRef<string>("");
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (onDataChange && isMountedRef.current) {
      const dataKey = airbrushings.length > 0 ? `${totalRecords}-${airbrushings.map((item) => item.id).join(",")}` : `empty-${totalRecords}`;

      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ items: airbrushings, totalRecords });
      }
    }
  }, [airbrushings, totalRecords, onDataChange]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: Airbrushing[];
    isBulk: boolean;
  } | null>(null);

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    items: Airbrushing[];
    isBulk: boolean;
  } | null>(null);

  // Status change modal state
  const [statusModal, setStatusModal] = useState<{
    items: Airbrushing[];
  } | null>(null);

  // Use viewport boundary checking hook
  
  // Define all available columns
  const allColumns: AirbrushingColumn[] = createAirbrushingColumns();

  // Filter columns based on visibility
  const columns = allColumns.filter((col) => visibleColumns.has(col.key));

  // Get current page item IDs for selection
  const currentPageItemIds = React.useMemo(() => {
    return airbrushings.map((item) => item.id);
  }, [airbrushings]);

  // Selection handlers
  const allSelected = isAllSelected(currentPageItemIds);
  const partiallySelected = isPartiallySelected(currentPageItemIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageItemIds);
  };

  const handleSelectItem = (itemId: string, event?: React.MouseEvent) => {
    handleRowClickSelection(itemId, currentPageItemIds, event?.shiftKey || false);
  };

  const renderSortIndicator = (columnKey: string) => {
    const sortDirection = getSortDirection(columnKey);
    const sortOrder = getSortOrder(columnKey);

    return (
      <div className="inline-flex items-center ml-1">
        {sortDirection === null && <IconSelector className="h-4 w-4 text-muted-foreground" />}
        {sortDirection === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
        {sortDirection === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
        {sortOrder !== null && sortConfigs.length > 1 && <span className="text-xs ml-0.5">{sortOrder + 1}</span>}
      </div>
    );
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, airbrushing: Airbrushing) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if clicked item is part of selection
    const isItemSelected = isSelected(airbrushing.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isItemSelected) {
      // Show bulk actions for all selected items
      const selectedItemsList = airbrushings.filter((i) => isSelected(i.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: selectedItemsList,
        isBulk: true,
      });
    } else {
      // Show actions for just the clicked item
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        items: [airbrushing],
        isBulk: false,
      });
    }
  };

  const handleView = () => {
    if (contextMenu && contextMenu.items.length === 1) {
      navigate(routes.production.airbrushings.details(contextMenu.items[0].id));
      setContextMenu(null);
    }
  };

  const handleEdit = () => {
    if (contextMenu && contextMenu.items.length === 1) {
      navigate(routes.production.airbrushings.edit(contextMenu.items[0].id));
      setContextMenu(null);
    }
  };

  const handleDelete = () => {
    if (contextMenu) {
      setDeleteDialog({
        items: contextMenu.items,
        isBulk: contextMenu.isBulk && contextMenu.items.length > 1,
      });
      setContextMenu(null);
    }
  };

  const handleSetStatus = () => {
    if (contextMenu) {
      setStatusModal({
        items: contextMenu.items,
      });
      setContextMenu(null);
    }
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (deleteDialog) {
      try {
        for (const item of deleteDialog.items) {
          await deleteAirbrushing(item.id);
          removeFromSelection([item.id]);
        }
      } catch (error) {
        // Error handled by API client
      } finally {
        setDeleteDialog(null);
      }
    }
  };

  // Confirm status change
  const confirmStatusChange = async (status: string) => {
    if (statusModal) {
      try {
        for (const item of statusModal.items) {
          await updateAirbrushing({ id: item.id, data: { status } });
        }
        removeFromSelection(statusModal.items.map(i => i.id));
      } catch (error) {
        // Error handled by API client
      } finally {
        setStatusModal(null);
      }
    }
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <>
      <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
        {/* Fixed Header Table */}
        <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
          <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
            <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
              <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                {/* Selection column */}
                {showInteractive && (
                  <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                    <div className="flex items-center justify-center h-full w-full px-2">
                      <Checkbox
                        checked={allSelected}
                        indeterminate={partiallySelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all items"
                        disabled={isLoading || airbrushings.length === 0}
                      />
                    </div>
                  </TableHead>
                )}

                {/* Data columns */}
                {columns.map((column) => (
                  <TableHead key={column.key} className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0", column.className)}>
                    {column.sortable ? (
                      <button
                        onClick={() => toggleSort(column.key)}
                        className={cn(
                          "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent",
                          column.align === "center" && "justify-center",
                          column.align === "right" && "justify-end",
                          !column.align && "justify-start",
                        )}
                        disabled={isLoading || airbrushings.length === 0}
                      >
                        <TruncatedTextWithTooltip text={column.header} />
                        {renderSortIndicator(column.key)}
                      </button>
                    ) : (
                      <div
                        className={cn(
                          "flex items-center h-full min-h-[2.5rem] px-4 py-2",
                          column.align === "center" && "justify-center text-center",
                          column.align === "right" && "justify-end text-right",
                          !column.align && "justify-start text-left",
                        )}
                      >
                        <TruncatedTextWithTooltip text={column.header} />
                      </div>
                    )}
                  </TableHead>
                ))}

                {/* Scrollbar spacer - only show if not overlay scrollbar */}
                {!isOverlay && (
                  <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0"></TableHead>
                )}
              </TableRow>
            </TableHeader>
          </Table>
        </div>

        {/* Scrollable Body Table */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
          <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
            <TableBody>
              {error ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="p-0">
                    <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                      <IconAlertTriangle className="h-8 w-8 mb-4" />
                      <div className="text-lg font-medium mb-2">Não foi possível carregar os airbrushings</div>
                      <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : airbrushings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="p-0">
                    <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                      <IconSpray className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <div className="text-lg font-medium mb-2">Nenhum airbrushing encontrado</div>
                      {filters && Object.keys(filters).length > 1 ? (
                        <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                      ) : (
                        <div className="text-sm mb-4">Comece cadastrando seu primeiro airbrushing.</div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                airbrushings.map((airbrushing, index) => {
                  const itemIsSelected = isSelected(airbrushing.id);

                  return (
                    <TableRow
                      key={airbrushing.id}
                      data-state={itemIsSelected ? "selected" : undefined}
                      className={cn(
                        "cursor-pointer transition-colors border-b border-border",
                        // Alternating row colors
                        index % 2 === 1 && "bg-muted/10",
                        // Hover state that works with alternating colors
                        "hover:bg-muted/20",
                        // Selected state overrides alternating colors
                        itemIsSelected && "bg-muted/30 hover:bg-muted/40",
                      )}
                      onClick={() => navigate(routes.production.airbrushings.details(airbrushing.id))}
                      onContextMenu={(e) => handleContextMenu(e, airbrushing)}
                    >
                      {/* Selection checkbox */}
                      {showInteractive && (
                        <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                          <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => { e.stopPropagation(); handleSelectItem(airbrushing.id, e); }}>
                            <Checkbox
                              checked={itemIsSelected}
                              onCheckedChange={() => handleSelectItem(airbrushing.id)}
                              aria-label={`Select ${airbrushing.task?.name || airbrushing.id}`}
                              data-checkbox
                            />
                          </div>
                        </TableCell>
                      )}

                      {/* Data columns */}
                      {columns.map((column) => (
                        <TableCell
                          key={column.key}
                          className={cn(
                            column.className,
                            "p-0 !border-r-0",
                            column.align === "center" && "text-center",
                            column.align === "right" && "text-right",
                            column.align === "left" && "text-left",
                            !column.align && "text-left",
                          )}
                        >
                          <div className="px-4 py-2">{column.accessor(airbrushing)}</div>
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        <div className="px-4 border-l border-r border-b border-border rounded-b-lg bg-muted/50">
          <SimplePaginationAdvanced
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            pageSize={pageSize}
            totalItems={totalRecords}
            pageSizeOptions={[20, 40, 60, 100]}
            onPageSizeChange={setPageSize}
            showPageSizeSelector={true}
            showGoToPage={true}
            showPageInfo={true}
          />
        </div>

        {/* Context Menu */}
        <DropdownMenu open={!!contextMenu} onOpenChange={(open) => !open && setContextMenu(null)}>
          <PositionedDropdownMenuContent
        position={contextMenu}
        isOpen={!!contextMenu}
        className="w-56 ![position:fixed]"
        onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {contextMenu?.isBulk && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{contextMenu.items.length} itens selecionados</div>}

            {!contextMenu?.isBulk && (
              <DropdownMenuItem onClick={handleView}>
                <IconEye className="mr-2 h-4 w-4" />
                Ver detalhes
              </DropdownMenuItem>
            )}

            {!contextMenu?.isBulk && canEdit && (
              <DropdownMenuItem onClick={handleEdit}>
                <IconEdit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
            )}

            {!contextMenu?.isBulk && canEdit && <DropdownMenuSeparator />}

            {canEdit && (
              <DropdownMenuItem onClick={handleSetStatus}>
                <IconCheck className="mr-2 h-4 w-4" />
                {contextMenu?.isBulk && contextMenu.items.length > 1 ? "Alterar status" : "Alterar status"}
              </DropdownMenuItem>
            )}

            {(canEdit || canDelete) && <DropdownMenuSeparator />}

            {canDelete && (
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <IconTrash className="mr-2 h-4 w-4" />
                {contextMenu?.isBulk && contextMenu.items.length > 1 ? "Deletar selecionados" : "Deletar"}
              </DropdownMenuItem>
            )}
          </PositionedDropdownMenuContent>
        </DropdownMenu>
      </div>

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

      {/* Status Change Modal */}
      {statusModal && (
        <SetStatusModal
          open={!!statusModal}
          onOpenChange={(open) => !open && setStatusModal(null)}
          airbrushings={statusModal.items}
          onConfirm={confirmStatusChange}
        />
      )}
    </>
  );
}
