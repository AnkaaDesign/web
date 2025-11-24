import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconChevronDown, IconChevronUp, IconSelector, IconEdit, IconTrash, IconEye, IconBeach, IconAlertTriangle } from "@tabler/icons-react";

import type { Vacation } from "../../../../types";
import type { VacationGetManyFormData } from "../../../../schemas";
import { routes, VACATION_STATUS_LABELS } from "../../../../constants";
import { useAuth } from "../../../../hooks/useAuth";
import { canEditHrEntities, canDeleteHrEntities, shouldShowInteractiveElements } from "@/utils/permissions/entity-permissions";
import { formatDate, getWorkdaysBetween } from "../../../../utils";
import { useVacationMutations, useVacations } from "../../../../hooks";

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
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
import { VacationListSkeleton } from "./vacation-list-skeleton";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";

interface VacationTableProps {
  filters: Partial<VacationGetManyFormData>;
  onDataChange?: (data: { vacations: Vacation[]; totalRecords: number }) => void;
  className?: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  vacations: Vacation[];
}

export function VacationTable({ filters, onDataChange, className }: VacationTableProps) {
  const navigate = useNavigate();
  const { deleteAsync } = useVacationMutations();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ items: Vacation[]; isBulk: boolean } | null>(null);

  // Permission checks
  const { user, isLoading: isAuthLoading } = useAuth();
  const canEdit = user ? canEditHrEntities(user) : false;
  const canDelete = user ? canDeleteHrEntities(user) : false;
  const showInteractive = user ? shouldShowInteractiveElements(user, 'hr') : false;

  // Use viewport boundary checking hook
  
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

  // Memoize query parameters to prevent unnecessary re-fetches
  const queryParams = React.useMemo(
    () => ({
      // When showSelectedOnly is true, don't apply filters
      ...(showSelectedOnly ? {} : filters),
      page: page + 1, // Convert 0-based to 1-based for API
      limit: pageSize,
      include: {
        user: true,
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
    }),
    [filters, page, pageSize, sortConfigs, showSelectedOnly, selectedIds],
  );

  // Fetch data in the table component
  const { data: response, isLoading, error, refetch } = useVacations(queryParams);

  const vacations = response?.data || [];
  const totalRecords = response?.meta?.totalRecords || 0;
  // const totalPages = response?.meta ? Math.ceil(response.meta.totalRecords / pageSize) : 1;

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
      const dataKey = vacations.length > 0 ? `${totalRecords}-${vacations.map((vacation) => vacation.id).join(",")}` : `empty-${totalRecords}`;

      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ vacations, totalRecords });
      }
    }
  }, [vacations, totalRecords, onDataChange]);

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

  // Get current page vacation IDs for selection
  const currentPageVacationIds = React.useMemo(() => {
    return vacations.map((vacation) => vacation.id);
  }, [vacations]);

  const handleSelectAll = useCallback(() => {
    toggleSelectAll(currentPageVacationIds);
  }, [toggleSelectAll, currentPageVacationIds]);

  const handleSelectVacation = useCallback(
    (vacationId: string, event?: React.MouseEvent) => {
      if (event) {
        event.stopPropagation();
      }
      toggleSelection(vacationId);
    },
    [toggleSelection],
  );

  const handleRowClick = useCallback(
    (vacation: Vacation, event: React.MouseEvent) => {
      // Don't navigate if clicking checkbox or context menu
      if ((event.target as HTMLElement).closest('[role="checkbox"]') || (event.target as HTMLElement).closest('[role="menu"]')) {
        return;
      }
      navigate(routes.humanResources.vacations.details(vacation.id));
    },
    [navigate],
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, vacation: Vacation) => {
      event.preventDefault();
      event.stopPropagation();

      const isVacationSelected = isSelected(vacation.id);
      let vacationsToShow: Vacation[];

      if (selectionCount > 0 && isVacationSelected) {
        // Show actions for all selected vacations
        vacationsToShow = vacations.filter((v) => isSelected(v.id));
      } else {
        // Show actions for just the clicked vacation
        vacationsToShow = [vacation];
        // Don't automatically select on right-click - let user manually select if needed
      }

      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        vacations: vacationsToShow,
      });
    },
    [vacations, isSelected, selectionCount],
  );

  const handleView = useCallback(
    (vacation: Vacation) => {
      navigate(routes.humanResources.vacations.details(vacation.id));
      setContextMenu(null);
    },
    [navigate],
  );

  const handleEdit = useCallback(
    (vacation: Vacation) => {
      navigate(routes.humanResources.vacations.edit(vacation.id));
      setContextMenu(null);
    },
    [navigate],
  );

  const handleDelete = useCallback(
    (vacations: Vacation[]) => {
      setDeleteDialog({
        items: vacations,
        isBulk: vacations.length > 1,
      });
      setContextMenu(null);
    },
    [],
  );

  const confirmDelete = async () => {
    if (deleteDialog) {
      try {
        if (deleteDialog.isBulk) {
          const promises = deleteDialog.items.map((v) => deleteAsync(v.id));
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

  // Define columns - must be before any conditional returns
  const columns = useMemo(
    () => [
      {
        key: "user.name",
        header: "FUNCIONÁRIO",
        sortable: true,
        className: "min-w-[200px]",
        accessor: (vacation: Vacation) => (
          <span className="font-medium truncate block" title={vacation.user?.name}>
            {vacation.user?.name || "—"}
          </span>
        ),
      },
      {
        key: "period",
        header: "PERÍODO",
        sortable: false,
        className: "min-w-[200px]",
        accessor: (vacation: Vacation) => (
          <span className="text-sm">{vacation.startAt && vacation.endAt ? `${formatDate(vacation.startAt)} - ${formatDate(vacation.endAt)}` : "—"}</span>
        ),
      },
      {
        key: "status",
        header: "STATUS",
        sortable: true,
        className: "min-w-[150px]",
        accessor: (vacation: Vacation) => (
          <Badge variant="primary" className="font-normal">
            {VACATION_STATUS_LABELS[vacation.status]}
          </Badge>
        ),
      },
      {
        key: "daysRequested",
        header: "DIAS",
        sortable: true,
        className: "min-w-[80px]",
        align: "center" as const,
        accessor: (vacation: Vacation) => {
          // Calculate working days excluding weekends using the utility function
          const workingDays = getWorkdaysBetween(vacation.startAt, vacation.endAt);

          return <span className="text-sm">{workingDays}</span>;
        },
      },
      {
        key: "createdAt",
        header: "SOLICITADO EM",
        sortable: true,
        className: "min-w-[120px]",
        accessor: (vacation: Vacation) => <span className="text-sm text-muted-foreground">{formatDate(vacation.createdAt)}</span>,
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
    return <VacationListSkeleton />;
  }

  const allSelected = isAllSelected(currentPageVacationIds);
  const someSelected = isPartiallySelected(currentPageVacationIds);

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
                      disabled={isLoading || vacations.length === 0}
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
                      disabled={isLoading || vacations.length === 0}
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
                    <div className="text-lg font-medium mb-2">Não foi possível carregar as férias</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : vacations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconBeach className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhuma férias encontrada</div>
                    {filters && Object.keys(filters).length > 1 && <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              vacations.map((vacation, index) => {
                const isVacationSelected = isSelected(vacation.id);
                return (
                  <TableRow
                    key={vacation.id}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      // Alternating row colors
                      index % 2 === 1 && "bg-muted/10",
                      // Hover state that works with alternating colors
                      "hover:bg-muted/20",
                      // Selected state overrides alternating colors
                      isVacationSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={(e) => handleRowClick(vacation, e)}
                    onContextMenu={(e) => handleContextMenu(e, vacation)}
                  >
                    {showInteractive && (
                      <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                        <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isVacationSelected}
                            onCheckedChange={() => handleSelectVacation(vacation.id)}
                            aria-label={`Selecionar férias de ${vacation.user?.name}`}
                            data-checkbox
                          />
                        </div>
                      </TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell key={column.key} className={cn("p-0 !border-r-0", column.className)}>
                        <div className={cn("px-4 py-2 text-sm", column.align === "center" && "text-center")}>{column.accessor(vacation)}</div>
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
          totalPages={Math.ceil(totalRecords / pageSize)}
          pageSize={pageSize}
          totalItems={totalRecords}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <DropdownMenu open={true} onOpenChange={() => setContextMenu(null)}>
          <DropdownMenuTrigger asChild>
            <div className="w-0 h-0" />
          </DropdownMenuTrigger>
          <PositionedDropdownMenuContent
            position={contextMenu}
            isOpen={!!contextMenu}
            align="start"
            className="w-48"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
              {contextMenu.vacations.length === 1 ? (
                <>
                  <DropdownMenuItem onClick={() => handleView(contextMenu.vacations[0])}>
                    <IconEye className="mr-2 h-4 w-4" />
                    Visualizar
                  </DropdownMenuItem>
                  {canEdit && (
                    <DropdownMenuItem onClick={() => handleEdit(contextMenu.vacations[0])}>
                      <IconEdit className="mr-2 h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                  )}
                  {(canEdit || canDelete) && <DropdownMenuSeparator />}
                  {canDelete && (
                    <DropdownMenuItem onClick={() => handleDelete(contextMenu.vacations)} className="text-destructive">
                      <IconTrash className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  )}
                </>
              ) : (
                <>
                  <div className="px-2 py-1.5 text-sm font-medium">{contextMenu.vacations.length} férias</div>
                  {canEdit && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          const ids = contextMenu.vacations.map((v) => v.id).join(",");
                          navigate(`${routes.humanResources.vacations.batchEdit}?ids=${ids}`);
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
                      <DropdownMenuItem onClick={() => handleDelete(contextMenu.vacations)} className="text-destructive">
                        <IconTrash className="mr-2 h-4 w-4" />
                        Excluir selecionadas
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              )}
            </PositionedDropdownMenuContent>
          </DropdownMenu>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk
                ? `Tem certeza que deseja excluir ${deleteDialog.items.length} solicitações de férias? Esta ação não poderá ser desfeita.`
                : `Tem certeza que deseja excluir a solicitação de férias de "${deleteDialog?.items[0]?.user?.name || "Desconhecido"}"? Esta ação não poderá ser desfeita.`}
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
