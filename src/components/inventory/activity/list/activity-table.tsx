import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconChevronDown, IconChevronUp, IconSelector, IconEye, IconEdit, IconTrash, IconAlertTriangle, IconArrowsExchange } from "@tabler/icons-react";
import type { Activity } from "../../../../types";
import type { ActivityGetManyFormData } from "../../../../schemas";
import { useActivityMutations, useActivities } from "../../../../hooks";
import { shouldShowInteractiveElements, canEditItems, canDeleteItems } from "@/utils/permissions/entity-permissions";
import { useAuth } from "@/hooks/useAuth";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { routes } from "../../../../constants";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getActivityColumns } from "./activity-table-columns";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { ActivityListSkeleton } from "./activity-list-skeleton";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";

interface ActivityTableProps {
  filters: Partial<ActivityGetManyFormData>;
  visibleColumns: Set<string>;
  onDataChange?: (data: { activities: Activity[]; totalRecords: number }) => void;
  className?: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  activities: Activity[];
}

export const ActivityTable = ({ filters, visibleColumns, onDataChange, className }: ActivityTableProps) => {
  const navigate = useNavigate();
  const { deleteAsync } = useActivityMutations();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Permission checks
  const { user } = useAuth();
  const canEdit = user ? canEditItems(user) : false;
  const canDelete = user ? canDeleteItems(user) : false;
  const showInteractive = user ? shouldShowInteractiveElements(user, 'item') : false;

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
    handleRowClick: handleRowClickSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Memoize query parameters to prevent unnecessary re-fetches
  const queryParams = React.useMemo(
    () => ({
      // When showSelectedOnly is true, don't apply filters
      ...(showSelectedOnly ? {} : filters),
      page: page + 1, // Convert 0-based to 1-based for API
      limit: pageSize,
      // Convert sortConfigs to orderBy format for API
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
      // Filter by selected IDs when showSelectedOnly is true
      ...(showSelectedOnly &&
        selectedIds.length > 0 && {
          where: {
            id: { in: selectedIds },
          },
        }),
    }),
    [filters, page, pageSize, sortConfigs, showSelectedOnly, selectedIds],
  );

  // Fetch data in the table component
  const { data: response, isLoading, error, refetch } = useActivities(queryParams);

  const activities = response?.data || [];
  const totalRecords = response?.meta?.totalRecords || 0;
  const totalPages = response?.meta ? Math.ceil(response.meta.totalRecords / pageSize) : 1;

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
      const dataKey = activities.length > 0 ? `${totalRecords}-${activities.map((activity) => activity.id).join(",")}` : `empty-${totalRecords}`;

      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ activities, totalRecords });
      }
    }
  }, [activities, totalRecords, onDataChange]);

  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Get columns from the columns file
  const columns = useMemo(() => getActivityColumns(), []);
  const filteredColumns = useMemo(() => columns.filter((col) => visibleColumns.has(col.key)), [columns, visibleColumns]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [contextMenu]);

  // Get current page activity IDs for selection
  const currentPageActivityIds = React.useMemo(() => {
    return activities.map((activity) => activity.id);
  }, [activities]);

  const handleSelectAll = useCallback(() => {
    toggleSelectAll(currentPageActivityIds);
  }, [toggleSelectAll, currentPageActivityIds]);

  const handleSelectActivity = useCallback(
    (activityId: string, event?: React.MouseEvent) => {
      if (event) {
        event.stopPropagation();
      }
      handleRowClickSelection(activityId, currentPageActivityIds, event?.shiftKey || false);
    },
    [handleRowClickSelection, currentPageActivityIds],
  );

  const handleRowClick = useCallback(
    (activity: Activity, event: React.MouseEvent) => {
      // Don't navigate if clicking checkbox or context menu
      if ((event.target as HTMLElement).closest('[role="checkbox"]') || (event.target as HTMLElement).closest('[role="menu"]')) {
        return;
      }
      navigate(routes.inventory.movements.details(activity.id));
    },
    [navigate],
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, activity: Activity) => {
      event.preventDefault();
      event.stopPropagation();

      const isActivitySelected = isSelected(activity.id);
      let activitiesToShow: Activity[];

      if (selectionCount > 0 && isActivitySelected) {
        // Show actions for all selected activities
        activitiesToShow = activities.filter((a) => isSelected(a.id));
      } else {
        // Show actions for just the clicked activity
        activitiesToShow = [activity];
        // Don't automatically select on right-click - let user manually select if needed
      }

      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        activities: activitiesToShow,
      });
    },
    [activities, isSelected, selectionCount],
  );

  const handleView = useCallback(
    (activity: Activity) => {
      navigate(routes.inventory.movements.details(activity.id));
      setContextMenu(null);
    },
    [navigate],
  );

  const handleEdit = useCallback(
    (activity: Activity) => {
      navigate(routes.inventory.movements.edit(activity.id));
      setContextMenu(null);
    },
    [navigate],
  );

  const handleDelete = useCallback(
    async (activities: Activity[]) => {
      if (activities.length === 1) {
        try {
          await deleteAsync(activities[0].id);
          refetch();
        } catch (error) {
          // Error handled by API client
        }
      } else {
        // Handle bulk delete
        try {
          const promises = activities.map((a) => deleteAsync(a.id));
          await Promise.all(promises);
          refetch();
          resetSelection();
        } catch (error) {
          // Error handled by API client
        }
      }
      setContextMenu(null);
    },
    [deleteAsync, refetch, resetSelection],
  );

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

  if (isLoading) {
    return <ActivityListSkeleton />;
  }

  const allSelected = isAllSelected(currentPageActivityIds);

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Fixed Header */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {/* Selection column - only show if user has edit permissions */}
              {showInteractive && (
                <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                  <div className="flex items-center justify-center h-full w-full px-2">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={isPartiallySelected(currentPageActivityIds)}
                      onCheckedChange={handleSelectAll}
                      aria-label="Selecionar todos"
                      disabled={isLoading || activities.length === 0}
                      data-checkbox
                    />
                  </div>
                </TableHead>
              )}
              {filteredColumns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0",
                    column.className,
                    column.align === "center" && "text-center",
                    column.align === "right" && "text-right",
                    "border-r border-border last:border-r-0",
                  )}
                >
                  {column.sortable ? (
                    <button
                      onClick={() => toggleSort(column.key)}
                      className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                      disabled={isLoading || activities.length === 0}
                    >
                      <span className="truncate">{column.header}</span>
                      {renderSortIndicator(column.key)}
                    </button>
                  ) : (
                    <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                      <span className="truncate">{column.header}</span>
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

      {/* Scrollable Body */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden border-l border-r border-border">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={filteredColumns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconAlertTriangle className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">Não foi possível carregar as movimentações</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : activities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={filteredColumns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconArrowsExchange className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhuma movimentação encontrada</div>
                    {filters && Object.keys(filters).length > 1 && <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              activities.map((activity, index) => {
                const isActivitySelected = isSelected(activity.id);
                return (
                  <TableRow
                    key={activity.id}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      // Alternating row colors
                      index % 2 === 1 && "bg-muted/10",
                      // Hover state that works with alternating colors
                      "hover:bg-muted/20",
                      // Selected state overrides alternating colors
                      isActivitySelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={(e) => handleRowClick(activity, e)}
                    onContextMenu={(e) => handleContextMenu(e, activity)}
                  >
                    {/* Selection checkbox - only show if user has edit permissions */}
                    {showInteractive && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div
                          className="flex items-center justify-center h-full w-full px-2 py-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectActivity(activity.id, e);
                          }}
                        >
                          <Checkbox
                            checked={isActivitySelected}
                            aria-label={`Selecionar movimentação ${activity.id}`}
                            data-checkbox
                          />
                        </div>
                      </TableCell>
                    )}
                    {filteredColumns.map((column) => (
                      <TableCell key={column.key} className={cn("p-0 !border-r-0", column.className)}>
                        <div className={cn("px-4 py-2 text-sm", column.align === "center" && "text-center", column.align === "right" && "text-right")}>
                          {column.accessor(activity)}
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
        <SimplePaginationAdvanced currentPage={page} totalPages={totalPages} pageSize={pageSize} totalItems={totalRecords} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div className="fixed z-50" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <DropdownMenu open={true} onOpenChange={() => setContextMenu(null)}>
            <DropdownMenuTrigger asChild>
              <div className="w-0 h-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {contextMenu.activities.length === 1 ? (
                <>
                  <DropdownMenuItem onClick={() => handleView(contextMenu.activities[0])}>
                    <IconEye className="mr-2 h-4 w-4" />
                    Visualizar
                  </DropdownMenuItem>
                  {canEdit && (
                    <DropdownMenuItem onClick={() => handleEdit(contextMenu.activities[0])}>
                      <IconEdit className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                  )}
                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleDelete(contextMenu.activities)} className="text-destructive">
                        <IconTrash className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="px-2 py-1.5 text-sm font-medium">{contextMenu.activities.length} movimentações</div>
                  {canEdit && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          const ids = contextMenu.activities.map((a) => a.id).join(",");
                          navigate(`${routes.inventory.movements.batchEdit}?ids=${ids}`);
                          setContextMenu(null);
                        }}
                      >
                        <IconEdit className="mr-2 h-4 w-4" />
                        Editar em lote
                      </DropdownMenuItem>
                    </>
                  )}
                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleDelete(contextMenu.activities)} className="text-destructive">
                        <IconTrash className="mr-2 h-4 w-4" />
                        Excluir selecionadas
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
};
