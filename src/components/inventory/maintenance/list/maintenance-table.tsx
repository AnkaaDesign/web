import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Maintenance } from "../../../../types";
import { routes, MAINTENANCE_STATUS } from "../../../../constants";
import { useAuth } from "../../../../hooks/useAuth";
import { canEditMaintenance, canDeleteMaintenance, shouldShowInteractiveElements } from "@/utils/permissions/entity-permissions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  IconChevronUp,
  IconChevronDown,
  IconRefresh,
  IconCheck,
  IconEdit,
  IconTrash,
  IconSelector,
  IconAlertTriangle,
  IconPlayerPlay,
  IconTool,
  IconPlus,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useMaintenanceMutations, useMaintenances, useFinishMaintenance, useBatchFinishMaintenances, useBatchStartMaintenances } from "../../../../hooks";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import type { MaintenanceGetManyFormData } from "../../../../schemas";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { createMaintenanceColumns } from "./maintenance-table-columns";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";

interface MaintenanceTableProps {
  visibleColumns: Set<string>;
  className?: string;
  onEdit?: (maintenances: Maintenance[]) => void;
  onMarkAsFinished?: (maintenances: Maintenance[]) => void;
  onDelete?: (maintenances: Maintenance[]) => void;
  filters?: Partial<MaintenanceGetManyFormData>;
  onDataChange?: (data: { items: Maintenance[]; totalRecords: number }) => void;
}

export function MaintenanceTable({ visibleColumns, className, onEdit, onMarkAsFinished, onDelete, filters = {}, onDataChange }: MaintenanceTableProps) {
  const navigate = useNavigate();
  const { update } = useMaintenanceMutations();
  const finishMutation = useFinishMaintenance();
  const batchFinishMutation = useBatchFinishMaintenances();
  const batchStartMutation = useBatchStartMaintenances();

  // Permission checks
  const { user, isLoading: isAuthLoading } = useAuth();
  const canEdit = user ? canEditMaintenance(user) : false;
  const canDelete = user ? canDeleteMaintenance(user) : false;
  const showInteractive = user ? shouldShowInteractiveElements(user, 'maintenance') : false;

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
    resetSelection: _resetSelection,
    removeFromSelection: _removeFromSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
    defaultSort: [
      { column: "status", direction: "asc" }, // PENDING comes first
      { column: "scheduledFor", direction: "desc" }, // Then by date (newest first)
    ],
  });

  // Prepare query parameters
  const queryFilters: Partial<MaintenanceGetManyFormData> = {
    // When showSelectedOnly is true, don't apply filters
    ...(showSelectedOnly ? {} : filters),
    page: page + 1, // Convert 0-based to 1-based for API
    limit: pageSize,
    orderBy: convertSortConfigsToOrderBy(sortConfigs),
    include: {
      item: {
        include: {
          brand: true,
          category: true,
        },
      },
      lastRunMaintenance: true,
    },
  };

  // Filter to show only selected items if enabled
  if (showSelectedOnly && selectedIds.length > 0) {
    queryFilters.where = {
      id: { in: selectedIds },
    };
  }

  // Fetch data
  const { data, isLoading, error, refetch } = useMaintenances(queryFilters);

  // Update parent component with current data
  React.useEffect(() => {
    if (data?.data && onDataChange) {
      onDataChange({
        items: data.data,
        totalRecords: data.meta?.totalRecords || 0,
      });
    }
  }, [data, onDataChange]);

  const maintenances = data?.data || [];
  const totalPages = data?.meta ? Math.ceil(data.meta.totalRecords / pageSize) : 1;
  const totalRecords = data?.meta?.totalRecords || 0;

  // Get visible columns based on selection
  const columns = createMaintenanceColumns();
  const visibleColumnConfigs = columns.filter((col) => visibleColumns.has(col.key));

  // Row actions
  const handleRowClick = (maintenance: Maintenance) => {
    navigate(routes.inventory.maintenance.details(maintenance.id));
  };

  const handleStartAction = async (maintenances: Maintenance[]) => {
    try {
      if (maintenances.length === 1) {
        await update({
          id: maintenances[0].id,
          data: {
            status: MAINTENANCE_STATUS.IN_PROGRESS,
          },
        });
      } else {
        // Use batch start endpoint for multiple maintenances
        await batchStartMutation.mutateAsync({
          maintenanceIds: maintenances.map((m) => m.id),
          include: {
            item: true,
          },
        });
      }
      refetch();
    } catch (error: any) {
      // Error will be handled by API client
      console.error("Error starting maintenance:", error);
    }
  };

  const handleMarkAsFinishedAction = async (maintenances: Maintenance[]) => {
    try {
      if (maintenances.length === 1) {
        // Use the finish endpoint for single maintenance to properly handle next schedule creation
        await finishMutation.mutateAsync({
          id: maintenances[0].id,
          include: {
            item: true,
            lastMaintenanceRun: true,
          },
        });
      } else {
        // Use batch finish endpoint for multiple maintenances
        await batchFinishMutation.mutateAsync({
          maintenanceIds: maintenances.map((m) => m.id),
          include: {
            item: true,
            lastMaintenanceRun: true,
          },
        });
      }

      if (onMarkAsFinished) {
        onMarkAsFinished(maintenances);
      }
      refetch();
    } catch (error: any) {
      // Error will be handled by API client
      console.error("Error finishing maintenance:", error);
    }
  };

  // Get current page maintenance IDs for selection
  const currentPageMaintenanceIds = React.useMemo(() => {
    return maintenances.map((maintenance) => maintenance.id);
  }, [maintenances]);

  // Selection handlers
  const allSelected = isAllSelected(currentPageMaintenanceIds);
  const partiallySelected = isPartiallySelected(currentPageMaintenanceIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageMaintenanceIds);
  };

  const handleSelectMaintenance = (maintenanceId: string) => {
    toggleSelection(maintenanceId);
  };

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    maintenances: Maintenance[];
    isBulk: boolean;
  } | null>(null);

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, maintenance: Maintenance) => {
    e.preventDefault();
    e.stopPropagation();

    const isMaintenanceSelected = isSelected(maintenance.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isMaintenanceSelected) {
      const selectedMaintenancesList = maintenances.filter((m) => isSelected(m.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        maintenances: selectedMaintenancesList,
        isBulk: true,
      });
    } else {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        maintenances: [maintenance],
        isBulk: false,
      });
    }
  };

  const handleEdit = () => {
    if (contextMenu && onEdit) {
      onEdit(contextMenu.maintenances);
      setContextMenu(null);
    }
  };

  const handleDelete = async () => {
    if (contextMenu && onDelete) {
      onDelete(contextMenu.maintenances);
      setContextMenu(null);
    }
  };

  const handleStart = async () => {
    if (contextMenu) {
      await handleStartAction(contextMenu.maintenances);
      setContextMenu(null);
    }
  };

  const handleMarkAsFinished = async () => {
    if (contextMenu) {
      await handleMarkAsFinishedAction(contextMenu.maintenances);
      setContextMenu(null);
    }
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className={cn("rounded-lg flex flex-col", className)}>
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-x-auto">
        <Table className={cn("min-w-[1000px] [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {/* Selection column */}
              {showInteractive && (
                <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                  <div className="flex items-center justify-center h-full w-full px-2">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all maintenances"
                      className={cn("h-4 w-4", partiallySelected && "data-[state=checked]:bg-muted data-[state=checked]:text-muted-foreground")}
                      disabled={isLoading || maintenances.length === 0}
                    />
                  </div>
                </TableHead>
              )}

              {/* Data columns */}
              {visibleColumnConfigs.map((column) => (
                <TableHead key={column.key} className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs p-0 bg-muted !border-r-0", column.className)}>
                  {column.sortable ? (
                    <button
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent",
                        column.align === "center" && "justify-center",
                        column.align === "right" && "justify-end",
                        column.align === "left" && "justify-start",
                        !column.align && "justify-start",
                      )}
                      disabled={isLoading || maintenances.length === 0}
                    >
                      <TruncatedTextWithTooltip text={column.header} />
                      <div className="inline-flex items-center ml-1">
                        {getSortDirection(column.key) === null && <IconSelector className="h-4 w-4 text-muted-foreground" />}
                        {getSortDirection(column.key) === "asc" && <IconChevronUp className="h-4 w-4 text-foreground" />}
                        {getSortDirection(column.key) === "desc" && <IconChevronDown className="h-4 w-4 text-foreground" />}
                        {getSortOrder(column.key) !== null && sortConfigs.length > 1 && <span className="text-xs ml-0.5">{getSortOrder(column.key)! + 1}</span>}
                      </div>
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

              {/* Scrollbar spacer */}
              {!isOverlay && (
                <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0"></TableHead>
              )}
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Scrollable Body Table */}
      <div className="flex-1 overflow-auto border-l border-r border-border">
        <Table className={cn("min-w-[1000px] [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={visibleColumnConfigs.length + 1} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <IconRefresh className="h-4 w-4 mr-2 animate-spin" />
                    Carregando...
                  </div>
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={visibleColumnConfigs.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconAlertTriangle className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">Não foi possível carregar as manutenções</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : maintenances.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumnConfigs.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconTool className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhuma manutenção encontrada</div>
                    {filters && Object.keys(filters).length > 1 ? (
                      <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                    ) : (
                      <>
                        <div className="text-sm mb-4">Comece cadastrando a primeira manutenção.</div>
                        <Button onClick={() => navigate(routes.inventory.maintenance.create)} variant="outline">
                          <IconPlus className="h-4 w-4 mr-2" />
                          Nova Manutenção
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              maintenances.map((maintenance, index) => {
                const maintenanceIsSelected = isSelected(maintenance.id);

                return (
                  <TableRow
                    key={maintenance.id}
                    data-state={maintenanceIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      index % 2 === 1 && "bg-muted/10",
                      "hover:bg-muted/20",
                      maintenanceIsSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={() => handleRowClick(maintenance)}
                    onContextMenu={(e) => handleContextMenu(e, maintenance)}
                  >
                    {/* Selection checkbox */}
                    {showInteractive && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={maintenanceIsSelected} onCheckedChange={() => handleSelectMaintenance(maintenance.id)} aria-label={`Select ${maintenance.name}`} />
                        </div>
                      </TableCell>
                    )}

                    {/* Data columns */}
                    {visibleColumnConfigs.map((column) => (
                      <TableCell key={column.key} className={cn(column.className, "p-0 !border-r-0")}>
                        <div
                          className={cn(
                            "px-4 py-2",
                            column.align === "center" && "flex justify-center",
                            column.align === "right" && "text-right flex justify-end",
                            column.align === "left" && "text-left",
                            !column.align && "text-left",
                          )}
                        >
                          {column.accessor(maintenance)}
                        </div>
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
        <DropdownMenuContent
          style={{
            position: "fixed",
            left: contextMenu?.x,
            top: contextMenu?.y,
          }}
          className="w-56"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {contextMenu?.isBulk && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{contextMenu.maintenances.length} manutenções selecionadas</div>}

          {canEdit && (
            <DropdownMenuItem onClick={handleEdit}>
              <IconEdit className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.maintenances.length > 1 ? "Editar em lote" : "Editar"}
            </DropdownMenuItem>
          )}

          {/* Show start option for pending maintenances */}
          {canEdit && contextMenu?.maintenances.some((m) => m.status === MAINTENANCE_STATUS.PENDING) && (
            <DropdownMenuItem onClick={handleStart}>
              <IconPlayerPlay className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.maintenances.length > 1 ? "Iniciar manutenções" : "Iniciar manutenção"}
            </DropdownMenuItem>
          )}

          {/* Show finish option only for in-progress maintenances */}
          {canEdit && contextMenu?.maintenances.some((m) => m.status === MAINTENANCE_STATUS.IN_PROGRESS) && (
            <DropdownMenuItem onClick={handleMarkAsFinished}>
              <IconCheck className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.maintenances.length > 1 ? "Concluir manutenções" : "Concluir manutenção"}
            </DropdownMenuItem>
          )}

          {(canEdit || canDelete) && <DropdownMenuSeparator />}

          {canDelete && (
            <DropdownMenuItem onClick={handleDelete} className="text-destructive">
              <IconTrash className="mr-2 h-4 w-4" />
              {contextMenu?.isBulk && contextMenu.maintenances.length > 1 ? "Deletar selecionadas" : "Deletar"}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
