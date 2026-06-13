import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconChevronUp, IconChevronDown, IconSelector, IconEye, IconEdit, IconTrash, IconAlertTriangle, IconCalendarOff, IconCalendarCheck, IconBan, IconPlus } from "@tabler/icons-react";

import type { Leave } from "../../../../types/leave";
import { routes, LEAVE_STATUS, SECTOR_PRIVILEGES } from "../../../../constants";
import { useLeaves } from "../../../../hooks/occupational-health/use-leaves";
import { useAuth } from "@/contexts/auth-context";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { useScrollbarWidth } from "@/hooks/common/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/common/use-table-state";

import { createLeaveColumns } from "./leave-table-columns";

const isFinishable = (leave: Leave) => leave.status === LEAVE_STATUS.SCHEDULED || leave.status === LEAVE_STATUS.ACTIVE;
const isCancellable = (leave: Leave) => leave.status === LEAVE_STATUS.SCHEDULED || leave.status === LEAVE_STATUS.ACTIVE;

interface LeaveTableProps {
  visibleColumns: Set<string>;
  className?: string;
  onFinish?: (leave: Leave) => void;
  onCancel?: (leaves: Leave[]) => void;
  onDelete?: (leaves: Leave[]) => void;
  filters?: Record<string, any>;
  onDataChange?: (data: { leaves: Leave[]; totalRecords: number }) => void;
}

export function LeaveTable({ visibleColumns, className, onFinish, onCancel, onDelete, filters = {}, onDataChange }: LeaveTableProps) {
  const navigate = useNavigate();

  // Delete is restricted to admins; the page itself is already gated to ACCOUNTING/HR/ADMIN
  const { user } = useAuth();
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

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
    toggleSelectAll,
    toggleSort,
    getSortDirection,
    getSortOrder,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    selectionCount,
    removeFromSelection,
    handleRowClick: handleRowClickSelection,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
    defaultSort: [{ column: "startDate", direction: "desc" }],
  });

  // Memoize include configuration to prevent re-renders
  const includeConfig = React.useMemo(
    () => ({
      user: {
        include: {
          position: true,
          sector: true,
        },
      },
    }),
    [],
  );

  // Memoize query parameters to prevent infinite re-renders
  const queryParams = React.useMemo(
    () => ({
      ...filters,
      page: page + 1, // Convert 0-based to 1-based for API
      limit: pageSize,
      include: includeConfig,
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
      // Filter by selected IDs when showSelectedOnly is true
      ...(showSelectedOnly &&
        selectedIds.length > 0 && {
          where: {
            ...(filters as any).where,
            id: { in: selectedIds },
          },
        }),
    }),
    [filters, page, pageSize, includeConfig, sortConfigs, showSelectedOnly, selectedIds],
  );

  const { data: response, isLoading, error } = useLeaves(queryParams);

  const leaves = response?.data || [];
  const totalRecords = response?.meta?.totalRecords || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

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
      const dataKey = leaves.length > 0 ? `${totalRecords}-${leaves.map((leave) => leave.id).join(",")}` : `empty-${totalRecords}`;
      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ leaves, totalRecords });
      }
    }
  }, [leaves, totalRecords, onDataChange]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    leaves: Leave[];
    isBulk: boolean;
  } | null>(null);

  // Define all available columns
  const allColumns = createLeaveColumns();

  // Filter columns based on visibility
  const columns = allColumns.filter((col) => visibleColumns.has(col.key));

  // Get current page leave IDs for selection
  const currentPageLeaveIds = React.useMemo(() => leaves.map((leave) => leave.id), [leaves]);

  const allSelected = isAllSelected(currentPageLeaveIds);
  const partiallySelected = isPartiallySelected(currentPageLeaveIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageLeaveIds);
  };

  const handleSelectLeave = (leaveId: string, event?: React.MouseEvent) => {
    handleRowClickSelection(leaveId, currentPageLeaveIds, event?.shiftKey || false);
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
  const handleContextMenu = (e: React.MouseEvent, leave: Leave) => {
    e.preventDefault();
    e.stopPropagation();

    const isLeaveSelected = isSelected(leave.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isLeaveSelected) {
      const selectedLeavesList = leaves.filter((l) => isSelected(l.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        leaves: selectedLeavesList,
        isBulk: true,
      });
    } else {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        leaves: [leave],
        isBulk: false,
      });
    }
  };

  const handleViewDetails = () => {
    if (contextMenu && !contextMenu.isBulk) {
      navigate(routes.occupationalHealth.leaves.details(contextMenu.leaves[0].id));
      setContextMenu(null);
    }
  };

  const handleFinish = () => {
    if (contextMenu && !contextMenu.isBulk && onFinish) {
      onFinish(contextMenu.leaves[0]);
      setContextMenu(null);
    }
  };

  const handleEdit = () => {
    if (contextMenu && !contextMenu.isBulk) {
      navigate(routes.occupationalHealth.leaves.edit(contextMenu.leaves[0].id));
      setContextMenu(null);
    }
  };

  const handleCancel = () => {
    if (contextMenu && onCancel) {
      onCancel(contextMenu.leaves.filter(isCancellable));
      setContextMenu(null);
    }
  };

  const handleDelete = () => {
    if (contextMenu && onDelete) {
      onDelete(contextMenu.leaves);
      removeFromSelection(contextMenu.leaves.map((leave) => leave.id));
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
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {/* Selection column */}
              <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                <div className="flex items-center justify-center h-full w-full px-2">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Selecionar todos os afastamentos"
                    disabled={isLoading || leaves.length === 0}
                    indeterminate={partiallySelected}
                  />
                </div>
              </TableHead>

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
                      disabled={isLoading || leaves.length === 0}
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
                    <div className="text-lg font-medium mb-2">Não foi possível carregar os afastamentos</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : leaves.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconCalendarOff className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhum afastamento encontrado</div>
                    {filters && Object.keys(filters).length > 1 ? (
                      <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                    ) : (
                      <>
                        <div className="text-sm mb-4">Comece cadastrando o primeiro afastamento.</div>
                        <Button onClick={() => navigate(routes.occupationalHealth.leaves.create)} variant="outline">
                          <IconPlus className="h-4 w-4 mr-2" />
                          Cadastrar Afastamento
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              leaves.map((leave, index) => {
                const leaveIsSelected = isSelected(leave.id);

                return (
                  <TableRow
                    key={leave.id}
                    data-state={leaveIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      index % 2 === 1 && "bg-muted/10",
                      "hover:bg-muted/20",
                      leaveIsSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={() => navigate(routes.occupationalHealth.leaves.details(leave.id))}
                    onContextMenu={(e) => handleContextMenu(e, leave)}
                  >
                    {/* Selection checkbox */}
                    <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                      <div
                        className="flex items-center justify-center h-full w-full px-2 py-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectLeave(leave.id, e);
                        }}
                      >
                        <Checkbox checked={leaveIsSelected} aria-label={`Selecionar afastamento de ${leave.user?.name || "colaborador"}`} data-checkbox />
                      </div>
                    </TableCell>

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
                        <div className="px-4 py-2">{column.accessor(leave)}</div>
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
        <PositionedDropdownMenuContent position={contextMenu} isOpen={!!contextMenu} className="w-56 ![position:fixed]" onCloseAutoFocus={(e) => e.preventDefault()}>
          {contextMenu?.isBulk && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{contextMenu.leaves.length} afastamentos selecionados</div>}

          {!contextMenu?.isBulk && (
            <DropdownMenuItem onClick={handleViewDetails}>
              <IconEye className="mr-2 h-4 w-4" />
              Ver detalhes
            </DropdownMenuItem>
          )}

          {!contextMenu?.isBulk && contextMenu?.leaves[0] && isFinishable(contextMenu.leaves[0]) && (
            <DropdownMenuItem onClick={handleFinish}>
              <IconCalendarCheck className="mr-2 h-4 w-4" />
              Finalizar
            </DropdownMenuItem>
          )}

          {!contextMenu?.isBulk && (
            <DropdownMenuItem onClick={handleEdit}>
              <IconEdit className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
          )}

          {contextMenu?.leaves.some(isCancellable) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCancel}>
                <IconBan className="mr-2 h-4 w-4" />
                {contextMenu?.isBulk && contextMenu.leaves.filter(isCancellable).length > 1 ? "Cancelar selecionados" : "Cancelar"}
              </DropdownMenuItem>
            </>
          )}

          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <IconTrash className="mr-2 h-4 w-4" />
                {contextMenu?.isBulk && contextMenu.leaves.length > 1 ? "Excluir selecionados" : "Excluir"}
              </DropdownMenuItem>
            </>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
