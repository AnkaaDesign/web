import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { routes } from "@/constants";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { responsibleService } from "@/services/responsibleService";
import type { Responsible, ResponsibleGetManyFormData, ResponsibleGetManyResponse } from "@/types/responsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  IconEdit,
  IconTrash,
  IconLock,
  IconLockOpen,
  IconChevronUp,
  IconChevronDown,
  IconSelector,
  IconEye,
  IconUsers,
  IconPlus,
} from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { ResponsibleTableSkeleton } from "./responsible-table-skeleton";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/common/use-toast";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/common/use-table-state";
import { useScrollbarWidth } from "@/hooks/common/use-scrollbar-width";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { createResponsibleColumns, type ResponsibleColumn } from "./responsible-columns";

interface ResponsibleTableProps {
  filters: Partial<ResponsibleGetManyFormData>;
  visibleColumns: Set<string>;
  onEdit?: (responsibles: Responsible[]) => void;
  onDelete?: (responsibles: Responsible[]) => void;
  onToggleActive?: (responsible: Responsible) => void;
  onUpdatePassword?: (responsible: Responsible) => void;
  onDataChange?: (data: { responsibles: Responsible[]; totalRecords: number }) => void;
  className?: string;
  searchTerm?: string;
}

export function ResponsibleTable({
  filters,
  visibleColumns,
  onEdit,
  onDelete,
  onToggleActive,
  onUpdatePassword,
  onDataChange,
  className,
  searchTerm,
}: ResponsibleTableProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
  });

  // Define all available columns
  const allColumns: ResponsibleColumn[] = useMemo(() => createResponsibleColumns(), []);

  // Filter columns based on visibility
  const columns = useMemo(() => allColumns.filter((col) => visibleColumns.has(col.key)), [allColumns, visibleColumns]);

  // Memoize query parameters
  const queryParams = useMemo(() => {
    const params = {
      ...filters,
      page: page + 1, // Convert 0-based to 1-based for API
      pageSize,
      search: searchTerm || undefined,
      ...(sortConfigs.length > 0 && {
        orderBy: convertSortConfigsToOrderBy(sortConfigs),
      }),
      ...(showSelectedOnly && selectedIds.length > 0 && {
        ids: selectedIds,
      }),
    };
    return params;
  }, [filters, page, pageSize, searchTerm, sortConfigs, showSelectedOnly, selectedIds]);

  // Fetch responsibles data
  const { data, isLoading, error } = useQuery<ResponsibleGetManyResponse>({
    queryKey: ["responsibles", queryParams],
    queryFn: async () => {
      const response = await responsibleService.getAll(queryParams);

      // Notify parent of data change
      if (onDataChange) {
        onDataChange({
          responsibles: response.data,
          totalRecords: response.meta.total,
        });
      }

      return response;
    },
    placeholderData: keepPreviousData,
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: (id: string) => responsibleService.toggleActive(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["responsibles"] });
      toast({
        title: "Sucesso",
        description: `Responsável ${data.isActive ? "ativado" : "desativado"} com sucesso`,
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao alterar status do responsável",
        variant: "error",
      });
    },
  });

  // All data-derived values
  const responsibles = data?.data || [];
  const totalRecords = data?.meta?.total || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

  // Get current page responsible IDs for selection
  const currentPageResponsibleIds = useMemo(
    () => responsibles.map((resp: Responsible) => resp.id),
    [responsibles]
  );

  // Selection state for current page
  const allSelected = isAllSelected(currentPageResponsibleIds);
  const partiallySelected = isPartiallySelected(currentPageResponsibleIds);

  const handleSelectAll = () => {
    toggleSelectAll(currentPageResponsibleIds);
  };

  const handleSelectResponsible = (responsibleId: string, event?: React.MouseEvent) => {
    handleRowClickSelection(responsibleId, currentPageResponsibleIds, event?.shiftKey || false);
  };

  // Context menu state
  const [contextMenu, setContextMenu] = React.useState<{
    x: number;
    y: number;
    responsibles: Responsible[];
    isBulk: boolean;
  } | null>(null);

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
  const handleContextMenu = (e: React.MouseEvent, responsible: Responsible) => {
    e.preventDefault();
    e.stopPropagation();

    const isResponsibleSelected = isSelected(responsible.id);
    const hasSelection = selectionCount > 0;

    if (hasSelection && isResponsibleSelected) {
      const selectedResponsiblesList = responsibles.filter((r: Responsible) => isSelected(r.id));
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        responsibles: selectedResponsiblesList,
        isBulk: true,
      });
    } else {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        responsibles: [responsible],
        isBulk: false,
      });
    }
  };

  const handleViewDetails = () => {
    if (contextMenu && !contextMenu.isBulk) {
      navigate(routes.responsibles.details(contextMenu.responsibles[0].id));
      setContextMenu(null);
    }
  };

  const handleEdit = () => {
    if (contextMenu) {
      if (onEdit) {
        onEdit(contextMenu.responsibles);
      } else {
        navigate(routes.responsibles.edit(contextMenu.responsibles[0].id));
      }
      setContextMenu(null);
    }
  };

  const handleToggleActive = () => {
    if (contextMenu && !contextMenu.isBulk) {
      const responsible = contextMenu.responsibles[0];
      if (onToggleActive) {
        onToggleActive(responsible);
      } else {
        toggleActiveMutation.mutate(responsible.id);
      }
      setContextMenu(null);
    }
  };

  const handleUpdatePassword = () => {
    if (contextMenu && !contextMenu.isBulk) {
      const responsible = contextMenu.responsibles[0];
      if (onUpdatePassword) {
        onUpdatePassword(responsible);
      } else {
        navigate(routes.responsibles.password(responsible.id));
      }
      setContextMenu(null);
    }
  };

  const handleDelete = () => {
    if (contextMenu) {
      if (onDelete) {
        onDelete(contextMenu.responsibles);
        const deletedIds = contextMenu.responsibles.map((resp) => resp.id);
        removeFromSelection(deletedIds);
      }
      setContextMenu(null);
    }
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  if (isLoading && !data) {
    return <ResponsibleTableSkeleton />;
  }

  return (
    <div className={cn("rounded-lg flex flex-col overflow-hidden", className)}>
      {/* Fixed Header Table */}
      <div className="border-l border-r border-t border-border rounded-t-lg overflow-hidden">
        <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
          <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted">
            <TableRow className="bg-muted hover:bg-muted even:bg-muted">
              {/* Selection column */}
              <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                <div className="flex items-center justify-center h-full w-full px-2 min-h-[2.5rem]">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={partiallySelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Selecionar todos"
                    disabled={isLoading || responsibles.length === 0}
                    data-checkbox
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
              {!isOverlay && <TableHead style={{ width: `${scrollbarWidth}px`, minWidth: `${scrollbarWidth}px` }} className="bg-muted p-0 border-0 !border-r-0 shrink-0" />}
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
                    <div className="text-lg font-medium mb-2">Não foi possível carregar os responsáveis</div>
                    <div className="text-sm text-muted-foreground">Tente novamente mais tarde.</div>
                  </div>
                </TableCell>
              </TableRow>
            ) : responsibles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="p-0">
                  <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <IconUsers className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <div className="text-lg font-medium mb-2">Nenhum responsável encontrado</div>
                    {filters && Object.keys(filters).length > 1 ? (
                      <div className="text-sm">Ajuste os filtros para ver mais resultados.</div>
                    ) : (
                      <>
                        <div className="text-sm mb-4">Comece cadastrando o primeiro responsável.</div>
                        <Button onClick={() => navigate(routes.responsibles.create)} variant="outline">
                          <IconPlus className="h-4 w-4 mr-2" />
                          Cadastrar Responsável
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              responsibles.map((responsible: Responsible, index: number) => {
                const responsibleIsSelected = isSelected(responsible.id);

                return (
                  <TableRow
                    key={responsible.id}
                    data-state={responsibleIsSelected ? "selected" : undefined}
                    className={cn(
                      "cursor-pointer transition-colors border-b border-border",
                      index % 2 === 1 && "bg-muted/10",
                      "hover:bg-muted/20",
                      responsibleIsSelected && "bg-muted/30 hover:bg-muted/40",
                    )}
                    onClick={() => navigate(routes.responsibles.details(responsible.id))}
                    onContextMenu={(e) => handleContextMenu(e, responsible)}
                  >
                    {/* Selection checkbox */}
                    <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                      <div
                        className="flex items-center justify-center h-full w-full px-2 py-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectResponsible(responsible.id, e);
                        }}
                      >
                        <Checkbox
                          checked={responsibleIsSelected}
                          aria-label={`Selecionar ${responsible.name}`}
                          data-checkbox
                        />
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
                        <div className="px-4 py-2">{column.accessor(responsible)}</div>
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
          {contextMenu?.isBulk && <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{contextMenu.responsibles.length} responsáveis selecionados</div>}

          {!contextMenu?.isBulk && (
            <DropdownMenuItem onClick={handleViewDetails}>
              <IconEye className="mr-2 h-4 w-4" />
              Ver Detalhes
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={handleEdit}>
            <IconEdit className="mr-2 h-4 w-4" />
            {contextMenu?.isBulk && contextMenu.responsibles.length > 1 ? "Editar em lote" : "Editar"}
          </DropdownMenuItem>

          {!contextMenu?.isBulk && contextMenu?.responsibles[0]?.email && (
            <DropdownMenuItem onClick={handleUpdatePassword}>
              <IconLock className="mr-2 h-4 w-4" />
              Alterar Senha
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {!contextMenu?.isBulk && (
            <DropdownMenuItem onClick={handleToggleActive}>
              {contextMenu?.responsibles[0]?.isActive ? (
                <>
                  <IconLock className="mr-2 h-4 w-4" />
                  Desativar
                </>
              ) : (
                <>
                  <IconLockOpen className="mr-2 h-4 w-4" />
                  Ativar
                </>
              )}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleDelete} className="text-destructive">
            <IconTrash className="mr-2 h-4 w-4" />
            {contextMenu?.isBulk && contextMenu.responsibles.length > 1 ? "Deletar selecionados" : "Deletar"}
          </DropdownMenuItem>
        </PositionedDropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
