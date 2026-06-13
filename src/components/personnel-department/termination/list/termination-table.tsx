import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Termination } from "../../../../types/termination";
import type { TerminationGetManyFormData } from "../../../../schemas/termination";
import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { useAuth } from "../../../../hooks/common/use-auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IconChevronUp, IconChevronDown, IconSelector, IconEye, IconEdit, IconBan, IconTrash, IconAlertTriangle, IconUserOff } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { useTerminations } from "../../../../hooks/personnel-department/use-terminations";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { useScrollbarWidth } from "@/hooks/common/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { createTerminationColumns, isTerminationFinal } from "./termination-table-columns";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/common/use-table-state";
import { TerminationListSkeleton } from "./termination-list-skeleton";

interface TerminationTableProps {
  visibleColumns: Set<string>;
  className?: string;
  onCancel?: (termination: Termination) => void;
  onDelete?: (termination: Termination) => void;
  filters?: Partial<TerminationGetManyFormData>;
}

export function TerminationTable({ visibleColumns, className, onCancel, onDelete, filters = {} }: TerminationTableProps) {
  const navigate = useNavigate();

  // Delete is ADMIN-only (server-enforced as well)
  const { user } = useAuth();
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Use URL state management for pagination and sorting
  const { page, pageSize, sortConfigs, setPage, setPageSize, toggleSort, getSortDirection, getSortOrder } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
    defaultSort: [{ column: "createdAt", direction: "desc" }],
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
      items: true,
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
    }),
    [filters, page, pageSize, includeConfig, sortConfigs],
  );

  const { data: response, isLoading, error } = useTerminations(queryParams);

  const terminations = response?.data || [];
  const totalRecords = response?.meta?.totalRecords || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    termination: Termination;
  } | null>(null);

  // Define all available columns
  const allColumns = createTerminationColumns();

  // Filter columns based on visibility
  const columns = allColumns.filter((col) => visibleColumns.has(col.key));

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
  const handleContextMenu = (e: React.MouseEvent, termination: Termination) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, termination });
  };

  const handleViewDetails = () => {
    if (contextMenu) {
      navigate(routes.personnelDepartment.terminations.details(contextMenu.termination.id));
      setContextMenu(null);
    }
  };

  const handleEdit = () => {
    if (contextMenu) {
      navigate(routes.personnelDepartment.terminations.edit(contextMenu.termination.id));
      setContextMenu(null);
    }
  };

  const handleCancel = () => {
    if (contextMenu) {
      onCancel?.(contextMenu.termination);
      setContextMenu(null);
    }
  };

  const handleDelete = () => {
    if (contextMenu) {
      onDelete?.(contextMenu.termination);
      setContextMenu(null);
    }
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  if (isLoading) {
    return <TerminationListSkeleton />;
  }

  const contextIsFinal = contextMenu ? isTerminationFinal(contextMenu.termination) : false;

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
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
                      disabled={isLoading || terminations.length === 0}
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
                <TableCell colSpan={columns.length} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconAlertTriangle className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">Não foi possível carregar as rescisões</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : terminations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconUserOff className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhuma rescisão encontrada</div>
                    {filters && Object.keys(filters).length > 1 ? (
                      <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                    ) : (
                      <div className="text-sm">Use a ação "Nova Rescisão" para iniciar o primeiro processo de rescisão.</div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              terminations.map((termination, index) => (
                <TableRow
                  key={termination.id}
                  className={cn(
                    "cursor-pointer transition-colors border-b border-border",
                    // Alternating row colors
                    index % 2 === 1 && "bg-muted/10",
                    // Hover state that works with alternating colors
                    "hover:bg-muted/20",
                  )}
                  onClick={() => navigate(routes.personnelDepartment.terminations.details(termination.id))}
                  onContextMenu={(e) => handleContextMenu(e, termination)}
                >
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
                      <div className="px-4 py-2">{column.accessor(termination)}</div>
                    </TableCell>
                  ))}
                </TableRow>
              ))
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
          <DropdownMenuItem onClick={handleViewDetails}>
            <IconEye className="mr-2 h-4 w-4" />
            Ver detalhes
          </DropdownMenuItem>

          {/* Edit and cancel are blocked for completed/cancelled terminations */}
          {!contextIsFinal && (
            <>
              <DropdownMenuItem onClick={handleEdit}>
                <IconEdit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>

              <DropdownMenuItem onClick={handleCancel} className="text-destructive">
                <IconBan className="mr-2 h-4 w-4" />
                Cancelar
              </DropdownMenuItem>
            </>
          )}

          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <IconTrash className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
