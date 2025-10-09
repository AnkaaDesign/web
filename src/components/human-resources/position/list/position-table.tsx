import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconChevronDown, IconChevronUp, IconSelector, IconEdit, IconTrash, IconEye, IconBriefcase, IconAlertTriangle, IconPlus } from "@tabler/icons-react";

import type { Position } from "../../../../types";
import type { PositionGetManyFormData } from "../../../../schemas";
import { routes } from "../../../../constants";
import { formatDate, formatCurrency } from "../../../../utils";
import { usePositionMutations, usePositions } from "../../../../hooks";

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { PositionListSkeleton } from "./position-list-skeleton";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";

interface PositionTableProps {
  filters: Partial<PositionGetManyFormData>;
  onDataChange?: (data: { positions: Position[]; totalRecords: number }) => void;
  className?: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  positions: Position[];
}

export function PositionTable({ filters, onDataChange, className }: PositionTableProps) {
  const navigate = useNavigate();
  const { deleteAsync: removeAsync } = usePositionMutations();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ items: Position[]; isBulk: boolean } | null>(null);

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
    defaultSort: [{ column: 'hierarchy', direction: 'asc' }],
  });

  // Memoize query parameters to prevent unnecessary re-fetches
  const queryParams = React.useMemo(
    () => ({
      // When showSelectedOnly is true, don't apply filters
      ...(showSelectedOnly ? {} : filters),
      page: page + 1, // Convert 0-based to 1-based for API
      limit: pageSize,
      include: {
        // Fetch monetary values (new approach)
        monetaryValues: {
          orderBy: { createdAt: "desc" as const },
          take: 5,
        },
        // Also fetch deprecated remunerations for backwards compatibility
        remunerations: {
          orderBy: { createdAt: "desc" as const },
          take: 1,
        },
        _count: {
          select: { users: true },
        },
      },
      // Convert sortConfigs to orderBy format for API
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
      // Filter by selected IDs when showSelectedOnly is true
      ...(showSelectedOnly &&
        selectedIds.length > 0 && {
          where: {
            ...filters.where,
            id: { in: selectedIds },
          },
        }),
    }),
    [filters, page, pageSize, sortConfigs, showSelectedOnly, selectedIds],
  );

  // Fetch data in the table component
  const { data: response, isLoading, error, refetch } = usePositions(queryParams);

  const positions = response?.data || [];
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
      const dataKey = positions.length > 0 ? `${totalRecords}-${positions.map((position) => position.id).join(",")}` : `empty-${totalRecords}`;

      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ positions, totalRecords });
      }
    }
  }, [positions, totalRecords, onDataChange]);

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

  // Get current page position IDs for selection
  const currentPagePositionIds = React.useMemo(() => {
    return positions.map((position) => position.id);
  }, [positions]);

  const handleSelectAll = useCallback(() => {
    toggleSelectAll(currentPagePositionIds);
  }, [toggleSelectAll, currentPagePositionIds]);

  const handleSelectPosition = useCallback(
    (positionId: string, event?: React.MouseEvent) => {
      if (event) {
        event.stopPropagation();
      }
      toggleSelection(positionId);
    },
    [toggleSelection],
  );

  const handleRowClick = useCallback(
    (position: Position, event: React.MouseEvent) => {
      // Don't navigate if clicking checkbox or context menu
      if ((event.target as HTMLElement).closest('[role="checkbox"]') || (event.target as HTMLElement).closest('[role="menu"]')) {
        return;
      }
      navigate(routes.humanResources.positions.details(position.id));
    },
    [navigate],
  );

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, position: Position) => {
      event.preventDefault();
      event.stopPropagation();

      const isPositionSelected = isSelected(position.id);
      let positionsToShow: Position[];

      if (selectionCount > 0 && isPositionSelected) {
        // Show actions for all selected positions
        positionsToShow = positions.filter((p) => isSelected(p.id));
      } else {
        // Show actions for just the clicked position
        positionsToShow = [position];
        // Don't automatically select on right-click - let user manually select if needed
      }

      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        positions: positionsToShow,
      });
    },
    [positions, isSelected, selectionCount],
  );

  const handleView = useCallback(
    (position: Position) => {
      navigate(routes.humanResources.positions.details(position.id));
      setContextMenu(null);
    },
    [navigate],
  );

  const handleEdit = useCallback(
    (position: Position) => {
      navigate(routes.humanResources.positions.edit(position.id));
      setContextMenu(null);
    },
    [navigate],
  );

  const handleDelete = useCallback(
    (positions: Position[]) => {
      setDeleteDialog({
        items: positions,
        isBulk: positions.length > 1,
      });
      setContextMenu(null);
    },
    [],
  );

  const confirmDelete = async () => {
    if (deleteDialog) {
      try {
        if (deleteDialog.isBulk) {
          const promises = deleteDialog.items.map((p) => removeAsync(p.id));
          await Promise.all(promises);
          toast.success(`${deleteDialog.items.length} cargos excluídos com sucesso!`);
          refetch();
          resetSelection();
        } else {
          await removeAsync(deleteDialog.items[0].id);
          toast.success("Cargo excluído com sucesso");
          refetch();
        }
      } catch (error) {
        if (deleteDialog.isBulk) {
          toast.error("Erro ao excluir alguns cargos");
        }
        // Error handled by mutation for single delete
      }
      setDeleteDialog(null);
    }
  };

  // Define columns - must be before any conditional returns
  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "NOME",
        sortable: true,
        className: "min-w-[250px]",
        align: "left" as const,
        accessor: (position: Position) => (
          <span className="font-medium truncate block" title={position.name}>
            {position.name}
          </span>
        ),
      },
      {
        key: "hierarchy",
        header: "HIERARQUIA",
        sortable: true,
        className: "min-w-[120px]",
        align: "center" as const,
        accessor: (position: Position) => (
          position.hierarchy !== null && position.hierarchy !== undefined ? (
            <Badge variant="secondary" className="font-normal">
              {position.hierarchy}
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )
        ),
      },
      {
        key: "remuneration",
        header: "REMUNERAÇÃO",
        sortable: true,
        className: "min-w-[150px]",
        align: "left" as const,
        accessor: (position: Position) => {
          // Use the virtual remuneration field (populated by backend from monetaryValues or remunerations)
          // This ensures we always get the correct current remuneration value
          const remuneration = position.remuneration ?? 0;
          return remuneration > 0 ? (
            <Badge variant="primary" className="font-normal">
              {formatCurrency(remuneration)}
            </Badge>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          );
        },
      },
      {
        key: "_count.users",
        header: "FUNCIONÁRIOS",
        sortable: true,
        className: "min-w-[120px]",
        align: "left" as const,
        accessor: (position: Position) => <span className="text-sm">{position._count?.users || 0}</span>,
      },
      {
        key: "createdAt",
        header: "CRIADO EM",
        sortable: true,
        className: "min-w-[120px]",
        align: "left" as const,
        accessor: (position: Position) => <span className="text-sm text-muted-foreground">{formatDate(position.createdAt)}</span>,
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
    return <PositionListSkeleton />;
  }

  const allSelected = isAllSelected(currentPagePositionIds);
  const someSelected = isPartiallySelected(currentPagePositionIds);

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Fixed Header */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                <div className="flex items-center justify-center h-full w-full px-2">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Selecionar todos"
                    disabled={isLoading || positions.length === 0}
                    data-checkbox
                  />
                </div>
              </TableHead>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0",
                    column.className,
                    "border-r border-border last:border-r-0",
                  )}
                >
                  {column.sortable ? (
                    <button
                      onClick={() => toggleSort(column.key)}
                      className="flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer text-left border-0 bg-transparent"
                      disabled={isLoading || positions.length === 0}
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
                    <div className="text-lg font-medium mb-2">Não foi possível carregar os cargos</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : positions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconBriefcase className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhum cargo encontrado</div>
                    {filters && (filters.searchingFor || filters.where || Object.keys(filters).length > 1) ? (
                      <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                    ) : (
                      <>
                        <div className="text-sm mb-4">Comece cadastrando o primeiro cargo.</div>
                        <Button onClick={() => navigate(routes.humanResources.positions.create)} variant="outline">
                          <IconPlus className="h-4 w-4 mr-2" />
                          Cadastrar Cargo
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              positions.map((position, index) => {
                const isPositionSelected = isSelected(position.id);
                return (
                  <TableRow
                    key={position.id}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      // Alternating row colors
                      index % 2 === 1 && "bg-muted/10",
                      // Hover state that works with alternating colors
                      "hover:bg-muted/20",
                      // Selected state overrides alternating colors
                      isPositionSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={(e) => handleRowClick(position, e)}
                    onContextMenu={(e) => handleContextMenu(e, position)}
                  >
                    <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                      <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isPositionSelected}
                          onCheckedChange={() => handleSelectPosition(position.id)}
                          aria-label={`Selecionar cargo ${position.name}`}
                          data-checkbox
                        />
                      </div>
                    </TableCell>
                    {columns.map((column) => (
                      <TableCell key={column.key} className={cn("p-0 !border-r-0", column.className)}>
                        <div className={cn("px-4 py-2 text-sm")}>{column.accessor(position)}</div>
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
        <div className="fixed z-50" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <DropdownMenu open={true} onOpenChange={() => setContextMenu(null)}>
            <DropdownMenuTrigger asChild>
              <div className="w-0 h-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {contextMenu.positions.length === 1 ? (
                <>
                  <DropdownMenuItem onClick={() => handleView(contextMenu.positions[0])}>
                    <IconEye className="mr-2 h-4 w-4" />
                    Visualizar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleEdit(contextMenu.positions[0])}>
                    <IconEdit className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleDelete(contextMenu.positions)} className="text-destructive">
                    <IconTrash className="mr-2 h-4 w-4" />
                    Excluir
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <div className="px-2 py-1.5 text-sm font-medium">{contextMenu.positions.length} cargos</div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      const ids = contextMenu.positions.map((p) => p.id).join(",");
                      navigate(`${routes.humanResources.positions.batchEdit}?ids=${ids}`);
                      setContextMenu(null);
                    }}
                  >
                    <IconEdit className="mr-2 h-4 w-4" />
                    Editar em lote
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleDelete(contextMenu.positions)} className="text-destructive">
                    <IconTrash className="mr-2 h-4 w-4" />
                    Excluir selecionados
                  </DropdownMenuItem>
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
                ? `Tem certeza que deseja excluir ${deleteDialog.items.length} cargos? Esta ação não poderá ser desfeita.`
                : `Tem certeza que deseja excluir o cargo "${deleteDialog?.items[0]?.name}"? Esta ação não poderá ser desfeita.`}
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
