import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconChevronDown, IconChevronUp, IconSelector, IconEdit, IconTrash, IconEye, IconBuildingSkyscraper, IconAlertTriangle, IconPlus } from "@tabler/icons-react";

import type { Sector, SectorGetManyFormData, SectorOrderBy } from "../../../../types";
import { routes, SECTOR_PRIVILEGES_LABELS, SECTOR_PRIVILEGES } from "../../../../constants";
import { formatDate } from "../../../../utils";
import { useSectorMutations, useSectors } from "../../../../hooks";

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { SectorListSkeleton } from "./sector-list-skeleton";
import { useTableState } from "@/hooks/use-table-state";
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

interface SectorTableProps {
  filters: Partial<SectorGetManyFormData>;
  onDataChange?: (data: { sectors: Sector[]; totalRecords: number }) => void;
  className?: string;
}

// Convert sort configurations to SectorOrderBy format
function convertSortConfigsToSectorOrderBy(sortConfigs: Array<{ column: string; direction: "asc" | "desc" }>): SectorOrderBy | undefined {
  if (sortConfigs.length === 0) {
    return undefined;
  }

  const orderBy: SectorOrderBy = {};

  for (const config of sortConfigs) {
    // Only handle supported sector fields
    const field = config.column as keyof SectorOrderBy;
    if (field === "id" || field === "name" || field === "privileges" || field === "createdAt" || field === "updatedAt") {
      orderBy[field] = config.direction;
    }
  }

  return Object.keys(orderBy).length > 0 ? orderBy : undefined;
}

// Map privileges to badge colors
const getPrivilegeColor = (privilege: string): "destructive" | "warning" | "purple" | "blue" | "orange" | "green" | "secondary" | "default" => {
  switch (privilege) {
    case SECTOR_PRIVILEGES.ADMIN:
      return "destructive"; // Red - highest privilege
    case SECTOR_PRIVILEGES.LEADER:
      return "warning"; // Yellow/Orange - leadership role
    case SECTOR_PRIVILEGES.HUMAN_RESOURCES:
      return "purple"; // Purple - HR specific
    case SECTOR_PRIVILEGES.PRODUCTION:
      return "blue"; // Blue - production role
    case SECTOR_PRIVILEGES.MAINTENANCE:
      return "orange"; // Orange - maintenance role
    case SECTOR_PRIVILEGES.WAREHOUSE:
      return "green"; // Green - warehouse role
    case SECTOR_PRIVILEGES.EXTERNAL:
      return "secondary"; // Gray - external access
    case SECTOR_PRIVILEGES.BASIC:
    default:
      return "default"; // Default gray - basic access
  }
};

export function SectorTable({ filters, onDataChange, className }: SectorTableProps) {
  const navigate = useNavigate();
  const { delete: deleteSector } = useSectorMutations();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    sectors: Sector[];
    isBulk: boolean;
  } | null>(null);

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{ items: Sector[]; isBulk: boolean } | null>(null);

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
        _count: {
          users: true,
          tasks: true,
        },
      },
      // Convert sortConfigs to orderBy format for API
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToSectorOrderBy(sortConfigs),
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
  const { data: response, isLoading, error, refetch } = useSectors(queryParams);

  const sectors = response?.data || [];
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
      const dataKey = sectors.length > 0 ? `${totalRecords}-${sectors.map((sector) => sector.id).join(",")}` : `empty-${totalRecords}`;

      if (dataKey !== lastNotifiedDataRef.current) {
        lastNotifiedDataRef.current = dataKey;
        onDataChange({ sectors, totalRecords });
      }
    }
  }, [sectors, totalRecords, onDataChange]);

  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Get current page sector IDs for selection
  const currentPageSectorIds = React.useMemo(() => {
    return sectors.map((sector) => sector.id);
  }, [sectors]);

  const handleSelectAll = useCallback(() => {
    toggleSelectAll(currentPageSectorIds);
  }, [toggleSelectAll, currentPageSectorIds]);

  const handleSelectSector = useCallback(
    (sectorId: string, event?: React.MouseEvent) => {
      if (event) {
        event.stopPropagation();
      }
      toggleSelection(sectorId);
    },
    [toggleSelection],
  );

  const handleRowClick = useCallback(
    (sector: Sector, event: React.MouseEvent) => {
      // Don't navigate if clicking checkbox or context menu
      if ((event.target as HTMLElement).closest('[role="checkbox"]') || (event.target as HTMLElement).closest('[role="menu"]')) {
        return;
      }
      navigate(routes.administration.sectors.details(sector.id));
    },
    [navigate],
  );

  const handleViewDetails = useCallback(() => {
    if (contextMenu && !contextMenu.isBulk) {
      navigate(routes.administration.sectors.details(contextMenu.sectors[0].id));
      setContextMenu(null);
    }
  }, [contextMenu, navigate]);

  const handleEdit = useCallback(() => {
    if (contextMenu) {
      if (contextMenu.isBulk && contextMenu.sectors.length > 1) {
        const ids = contextMenu.sectors.map((s) => s.id).join(",");
        navigate(`${routes.administration.sectors.batchEdit}?ids=${ids}`);
      } else {
        navigate(routes.administration.sectors.edit(contextMenu.sectors[0].id));
      }
      setContextMenu(null);
    }
  }, [contextMenu, navigate]);

  const handleDelete = useCallback(() => {
    if (contextMenu) {
      setDeleteDialog({ items: contextMenu.sectors, isBulk: contextMenu.sectors.length > 1 });
      setContextMenu(null);
    }
  }, [contextMenu]);

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      if (deleteDialog.isBulk) {
        const promises = deleteDialog.items.map((s) => deleteSector(s.id));
        await Promise.all(promises);
        resetSelection();
      } else {
        await deleteSector(deleteDialog.items[0].id);
      }
      refetch();
      setDeleteDialog(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, sector: Sector) => {
      event.preventDefault();
      event.stopPropagation();

      const isSectorSelected = isSelected(sector.id);
      const hasSelection = selectionCount > 0;

      if (hasSelection && isSectorSelected) {
        // Show bulk actions for all selected sectors
        const selectedSectorsList = sectors.filter((s) => isSelected(s.id));
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          sectors: selectedSectorsList,
          isBulk: true,
        });
      } else {
        // Show actions for just the clicked sector
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          sectors: [sector],
          isBulk: false,
        });
      }
    },
    [sectors, isSelected, selectionCount],
  );

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Define columns with alignment info
  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "NOME",
        sortable: true,
        className: "min-w-[200px]",
        align: "left" as const,
        accessor: (sector: Sector) => (
          <span className="font-medium truncate block" title={sector.name}>
            {sector.name}
          </span>
        ),
      },
      {
        key: "privileges",
        header: "PRIVILÉGIOS",
        sortable: true,
        className: "min-w-[150px]",
        align: "left" as const,
        accessor: (sector: Sector) => (
          <Badge variant={getPrivilegeColor(sector.privileges)} className="font-normal">
            {SECTOR_PRIVILEGES_LABELS[sector.privileges]}
          </Badge>
        ),
      },
      {
        key: "_count.users",
        header: "USUÁRIOS",
        sortable: true,
        className: "min-w-[80px]",
        align: "center" as const,
        accessor: (sector: Sector) => {
          const count = sector._count?.users || 0;
          return (
            <Badge variant={count > 0 ? "default" : "secondary"} className="min-w-[2rem] justify-center">
              {count}
            </Badge>
          );
        },
      },
      {
        key: "_count.tasks",
        header: "TAREFAS",
        sortable: true,
        className: "min-w-[80px]",
        align: "center" as const,
        accessor: (sector: Sector) => {
          const count = sector._count?.tasks || 0;
          return (
            <Badge variant={count > 0 ? "default" : "secondary"} className="min-w-[2rem] justify-center">
              {count}
            </Badge>
          );
        },
      },
      {
        key: "createdAt",
        header: "CRIADO EM",
        sortable: true,
        className: "min-w-[120px]",
        align: "left" as const,
        accessor: (sector: Sector) => <span className="text-sm text-muted-foreground">{formatDate(sector.createdAt)}</span>,
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
    return <SectorListSkeleton />;
  }

  const allSelected = isAllSelected(currentPageSectorIds);
  const someSelected = isPartiallySelected(currentPageSectorIds);

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
                    disabled={isLoading || sectors.length === 0}
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
                    column.align === "center" && "text-center",
                    column.align === "right" && "text-right",
                    "border-r border-border last:border-r-0",
                  )}
                >
                  {column.sortable ? (
                    <button
                      onClick={() => toggleSort(column.key)}
                      className={cn(
                        "flex items-center gap-1 w-full h-full min-h-[2.5rem] px-4 py-2 hover:bg-muted/80 transition-colors cursor-pointer border-0 bg-transparent",
                        column.align === "center" && "justify-center",
                        column.align === "right" && "justify-end",
                        column.align === "left" && "justify-start text-left",
                      )}
                      disabled={isLoading || sectors.length === 0}
                    >
                      <span className="truncate">{column.header}</span>
                      {renderSortIndicator(column.key)}
                    </button>
                  ) : (
                    <div
                      className={cn("flex items-center h-full min-h-[2.5rem] px-4 py-2", column.align === "center" && "justify-center", column.align === "right" && "justify-end")}
                    >
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
                    <div className="text-lg font-medium mb-2">Não foi possível carregar os setores</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : sectors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconBuildingSkyscraper className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhum setor encontrado</div>
                    {filters && Object.keys(filters).length > 1 ? (
                      <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                    ) : (
                      <>
                        <div className="text-sm mb-4">Comece cadastrando o primeiro setor.</div>
                        <Button onClick={() => navigate(routes.administration.sectors.create)} variant="outline">
                          <IconPlus className="h-4 w-4 mr-2" />
                          Cadastrar Setor
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sectors.map((sector, index) => {
                const isSectorSelected = isSelected(sector.id);
                return (
                  <TableRow
                    key={sector.id}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      // Alternating row colors
                      index % 2 === 1 && "bg-muted/10",
                      // Hover state that works with alternating colors
                      "hover:bg-muted/20",
                      // Selected state overrides alternating colors
                      isSectorSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={(e) => handleRowClick(sector, e)}
                    onContextMenu={(e) => handleContextMenu(e, sector)}
                  >
                    <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                      <div className="flex items-center justify-center h-full w-full px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSectorSelected} onCheckedChange={() => handleSelectSector(sector.id)} aria-label={`Selecionar setor ${sector.name}`} data-checkbox />
                      </div>
                    </TableCell>
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn("p-0 !border-r-0", column.className, column.align === "center" && "text-center", column.align === "right" && "text-right")}
                      >
                        <div className={cn("px-4 py-2 text-sm", column.align === "center" && "text-center", column.align === "right" && "text-right")}>
                          {column.accessor(sector)}
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
          pageSize={pageSize}
          totalItems={totalRecords}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[20, 40, 60, 100]}
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
          {contextMenu?.isBulk && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{contextMenu.sectors.length} setores selecionados</div>}

          {!contextMenu?.isBulk && (
            <DropdownMenuItem onClick={handleViewDetails}>
              <IconEye className="mr-2 h-4 w-4" />
              Ver Detalhes
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={handleEdit}>
            <IconEdit className="mr-2 h-4 w-4" />
            {contextMenu?.isBulk && contextMenu.sectors.length > 1 ? "Editar em lote" : "Editar"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            <IconTrash className="mr-2 h-4 w-4" />
            {contextMenu?.isBulk && contextMenu.sectors.length > 1 ? "Excluir selecionados" : "Excluir"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk
                ? `Tem certeza que deseja excluir ${deleteDialog.items.length} setores? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja excluir o setor "${deleteDialog?.items[0]?.name}"? Esta ação não pode ser desfeita.`}
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
