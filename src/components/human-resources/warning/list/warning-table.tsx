import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconChevronDown, IconChevronUp, IconSelector, IconEdit, IconTrash, IconEye, IconAlertTriangle, IconPaperclip } from "@tabler/icons-react";

import type { Warning } from "../../../../types";
import type { WarningGetManyFormData } from "../../../../schemas";
import { routes, WARNING_SEVERITY_LABELS, WARNING_CATEGORY_LABELS } from "../../../../constants";
import { useAuth } from "../../../../hooks/useAuth";
import { canEditHrEntities, canDeleteHrEntities, shouldShowInteractiveElements } from "@/utils/permissions/entity-permissions";
import { formatDate } from "../../../../utils";
import { useWarningMutations, useWarnings, useMyWarnings } from "../../../../hooks";

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { WarningListSkeleton } from "./warning-list-skeleton";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";

interface WarningTableProps {
  filters: Partial<WarningGetManyFormData>;
  onDataChange?: (data: { warnings: Warning[]; totalRecords: number }) => void;
  className?: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  warnings: Warning[];
}

export function WarningTable({ filters, onDataChange, className }: WarningTableProps) {
  const navigate = useNavigate();
  const { deleteAsync } = useWarningMutations();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ items: Warning[]; isBulk: boolean } | null>(null);

  // Permission checks
  const { user, isLoading: isAuthLoading } = useAuth();
  const canEdit = user ? canEditHrEntities(user) : false;
  const canDelete = user ? canDeleteHrEntities(user) : false;
  const showInteractive = user ? shouldShowInteractiveElements(user, 'hr') : false;

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
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Check if we should use the my-warnings endpoint
  const useMyWarningsEndpoint = (filters as any)?._useMyWarningsEndpoint;

  // Memoize query parameters to prevent unnecessary re-fetches
  const queryParams = React.useMemo(
    () => {
      const { _useMyWarningsEndpoint, ...restFilters } = filters as any;
      return {
        // When showSelectedOnly is true, don't apply filters
        ...(showSelectedOnly ? {} : restFilters),
        page: page + 1, // Convert 0-based to 1-based for API
        take: pageSize,
        include: {
          collaborator: true,
          attachments: true,
        },
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
      };
    },
    [filters, page, pageSize, sortConfigs, showSelectedOnly, selectedIds],
  );

  // Fetch data in the table component - use my-warnings endpoint if flag is set
  const { data: response, isLoading, error, refetch } = useMyWarningsEndpoint
    ? useMyWarnings(queryParams)
    : useWarnings(queryParams);

  const warnings = response?.data || [];
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
      const dataKey = warnings.length > 0 ? `${totalRecords}-${warnings.map((warning: Warning) => warning.id).join(",")}` : `empty-${totalRecords}`;

      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ warnings, totalRecords });
      }
    }
  }, [warnings, totalRecords, onDataChange]);

  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [contextMenu]);

  // Get current page warning IDs for selection
  const currentPageWarningIds = React.useMemo(() => {
    return warnings.map((warning: Warning) => warning.id);
  }, [warnings]);

  const handleSelectAll = useCallback(() => {
    toggleSelectAll(currentPageWarningIds);
  }, [toggleSelectAll, currentPageWarningIds]);

  const handleSelectWarning = useCallback(
    (warningId: string, event?: React.MouseEvent) => {
      if (event) {
        event.stopPropagation();
      }
      toggleSelection(warningId);
    },
    [toggleSelection],
  );

  const handleRowClick = useCallback(
    (warning: Warning, event: React.MouseEvent) => {
      // Don't navigate if clicking checkbox or context menu
      if ((event.target as HTMLElement).closest('[role="checkbox"]') || (event.target as HTMLElement).closest('[role="menu"]')) {
        return;
      }
      navigate(routes.humanResources.warnings.details(warning.id));
    },
    [navigate],
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, warning: Warning) => {
      event.preventDefault();
      event.stopPropagation();

      const isWarningSelected = isSelected(warning.id);
      let warningsToShow: Warning[];

      if (selectionCount > 0 && isWarningSelected) {
        // Show actions for all selected warnings
        warningsToShow = warnings.filter((w) => isSelected(w.id));
      } else {
        // Show actions for just the clicked warning
        warningsToShow = [warning];
        // Don't automatically select on right-click - let user manually select if needed
      }

      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        warnings: warningsToShow,
      });
    },
    [warnings, isSelected, selectionCount],
  );

  const handleView = useCallback(
    (warning: Warning) => {
      navigate(routes.humanResources.warnings.details(warning.id));
      setContextMenu(null);
    },
    [navigate],
  );

  const handleEdit = useCallback(
    (warning: Warning) => {
      navigate(routes.humanResources.warnings.edit(warning.id));
      setContextMenu(null);
    },
    [navigate],
  );

  const handleDelete = useCallback(
    (warnings: Warning[]) => {
      setDeleteDialog({
        items: warnings,
        isBulk: warnings.length > 1,
      });
      setContextMenu(null);
    },
    [],
  );

  const confirmDelete = async () => {
    if (deleteDialog) {
      try {
        if (deleteDialog.isBulk) {
          const promises = deleteDialog.items.map((w: Warning) => deleteAsync(w.id));
          await Promise.all(promises);
          refetch();
          resetSelection();
        } else {
          await deleteAsync(deleteDialog.items[0].id);
          refetch();
        }
      } catch (error) {
        // Error handled by API client
      }
      setDeleteDialog(null);
    }
  };

  // Define columns
  const columns = useMemo(
    () => [
      {
        key: "collaborator.name",
        header: "FUNCIONÁRIO",
        sortable: true,
        className: "min-w-[200px]",
        accessor: (warning: Warning) => (
          <span className="font-medium truncate block" title={warning.collaborator?.name}>
            {warning.collaborator?.name || "—"}
          </span>
        ),
      },
      {
        key: "category",
        header: "CATEGORIA",
        sortable: true,
        className: "min-w-[150px]",
        accessor: (warning: Warning) => (
          <Badge variant="primary" className="font-normal">
            {WARNING_CATEGORY_LABELS[warning.category]}
          </Badge>
        ),
      },
      {
        key: "severity",
        header: "SEVERIDADE",
        sortable: true,
        className: "min-w-[150px]",
        accessor: (warning: Warning) => (
          <Badge variant="secondary" className="font-normal">
            {WARNING_SEVERITY_LABELS[warning.severity]}
          </Badge>
        ),
      },
      {
        key: "followUpDate",
        header: "DATA",
        sortable: true,
        className: "min-w-[120px]",
        accessor: (warning: Warning) => <span className="text-sm">{formatDate(warning.followUpDate)}</span>,
      },
      {
        key: "attachments",
        header: "ANEXO",
        sortable: false,
        className: "min-w-[80px]",
        align: "center" as const,
        accessor: (warning: Warning) =>
          warning.attachments && warning.attachments.length > 0 ? (
            <IconPaperclip className="h-4 w-4 text-muted-foreground" />
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          ),
      },
      {
        key: "createdAt",
        header: "CRIADO EM",
        sortable: true,
        className: "min-w-[120px]",
        accessor: (warning: Warning) => <span className="text-sm text-muted-foreground">{formatDate(warning.createdAt)}</span>,
      },
    ],
    [],
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
    return <WarningListSkeleton />;
  }

  const allSelected = isAllSelected(currentPageWarningIds);
  const someSelected = isPartiallySelected(currentPageWarningIds);

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Fixed Header */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {showInteractive && (
                <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                  <div className="flex items-center justify-center h-full w-full px-2">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Selecionar todos"
                      disabled={isLoading || warnings.length === 0}
                      data-checkbox
                    />
                  </div>
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0",
                    column.className,
                    column.align === "center" && "text-center",
                    "border-r border-border last:border-r-0",
                  )}
                >
                  {column.sortable ? (
                    <button
                      onClick={() => toggleSort(column.key)}
                      className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                      disabled={Boolean(error) || warnings.length === 0}
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
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-destructive">
                    <IconAlertTriangle className="h-8 w-8 mb-4" />
                    <div className="text-lg font-medium mb-2">Não foi possível carregar as advertências</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : warnings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconAlertTriangle className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhuma advertência encontrada</div>
                    {filters && Object.keys(filters).length > 1 && <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              warnings.map((warning, index) => {
                const isWarningSelected = isSelected(warning.id);
                return (
                  <TableRow
                    key={warning.id}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      // Alternating row colors
                      index % 2 === 1 && "bg-muted/10",
                      // Hover state that works with alternating colors
                      "hover:bg-muted/20",
                      // Selected state overrides alternating colors
                      isWarningSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={(e) => handleRowClick(warning, e)}
                    onContextMenu={(e) => handleContextMenu(e, warning)}
                  >
                    {showInteractive && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={isWarningSelected} onCheckedChange={() => handleSelectWarning(warning.id)} aria-label={`Selecionar advertência`} data-checkbox />
                        </div>
                      </TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell key={column.key} className={cn("p-0 !border-r-0", column.className)}>
                        <div className={cn("px-4 py-2 text-sm", column.align === "center" && "text-center")}>{column.accessor(warning)}</div>
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
              {contextMenu.warnings.length === 1 ? (
                <>
                  <DropdownMenuItem onClick={() => handleView(contextMenu.warnings[0])}>
                    <IconEye className="mr-2 h-4 w-4" />
                    Visualizar
                  </DropdownMenuItem>
                  {canEdit && (
                    <DropdownMenuItem onClick={() => handleEdit(contextMenu.warnings[0])}>
                      <IconEdit className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                  )}
                  {(canEdit || canDelete) && <DropdownMenuSeparator />}
                  {canDelete && (
                    <DropdownMenuItem onClick={() => handleDelete(contextMenu.warnings)} className="text-destructive">
                      <IconTrash className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  )}
                </>
              ) : (
                <>
                  <div className="px-2 py-1.5 text-sm font-medium">{contextMenu.warnings.length} advertências</div>
                  {canEdit && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          const ids = contextMenu.warnings.map((w: Warning) => w.id).join(",");
                          navigate(`${routes.humanResources.warnings.batchEdit}?ids=${ids}`);
                          setContextMenu(null);
                        }}
                      >
                        <IconEdit className="mr-2 h-4 w-4" />
                        Editar em lote
                      </DropdownMenuItem>
                    </>
                  )}
                  {(canEdit || canDelete) && <DropdownMenuSeparator />}
                  {canDelete && (
                    <DropdownMenuItem onClick={() => handleDelete(contextMenu.warnings)} className="text-destructive">
                      <IconTrash className="mr-2 h-4 w-4" />
                      Excluir selecionadas
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk
                ? `Tem certeza que deseja excluir ${deleteDialog.items.length} advertências? Esta ação não poderá ser desfeita.`
                : "Tem certeza que deseja excluir a advertência? Esta ação não poderá ser desfeita."}
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
    </div>
  );
}
