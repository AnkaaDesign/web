import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IconChevronUp, IconChevronDown, IconSelector, IconEdit, IconTrash, IconEye, IconPlayerPlay, IconCheck, IconX } from "@tabler/icons-react";
import { useServiceOrders, useServiceOrderMutations, useServiceOrderBatchMutations } from "../../../../hooks";
import { routes, SERVICE_ORDER_STATUS, SERVICE_ORDER_STATUS_LABELS } from "../../../../constants";
import type { ServiceOrder } from "../../../../types";
import type { ServiceOrderGetManyFormData } from "../../../../schemas";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { useScrollbarWidth } from "@/hooks/use-scrollbar-width";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "../../../../utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ServiceOrderTableProps {
  onEdit?: (items: ServiceOrder[]) => void;
  onStart?: (items: ServiceOrder[]) => void;
  onFinish?: (items: ServiceOrder[]) => void;
  onCancel?: (items: ServiceOrder[]) => void;
  onDelete?: (items: ServiceOrder[]) => void;
  filters?: Partial<ServiceOrderGetManyFormData>;
  className?: string;
  onDataChange?: (data: { items: ServiceOrder[]; totalRecords: number }) => void;
}

// Status badge configuration
const STATUS_CONFIG = {
  [SERVICE_ORDER_STATUS.PENDING]: { variant: "pending" as const, icon: IconSelector },
  [SERVICE_ORDER_STATUS.IN_PROGRESS]: { variant: "inProgress" as const, icon: IconPlayerPlay },
  [SERVICE_ORDER_STATUS.COMPLETED]: { variant: "completed" as const, icon: IconCheck },
  [SERVICE_ORDER_STATUS.CANCELLED]: { variant: "cancelled" as const, icon: IconX },
};

export function ServiceOrderTable({ onEdit, onStart, onFinish, onCancel, onDelete, filters = {}, className, onDataChange }: ServiceOrderTableProps) {
  const navigate = useNavigate();
  const { delete: deleteServiceOrder } = useServiceOrderMutations();
  const { batchDelete } = useServiceOrderBatchMutations();

  // Get scrollbar width info
  const { width: scrollbarWidth, isOverlay } = useScrollbarWidth();

  // Use URL state management for pagination and sorting
  const { page, pageSize, sortConfigs, setPage, setPageSize, toggleSort, getSortDirection } = useTableState({
    defaultPageSize: 40,
    defaultSort: [{ column: "createdAt", direction: "desc" }],
    resetSelectionOnPageChange: false,
  });

  // Prepare query parameters for useServiceOrders hook
  const queryParams = useMemo(
    () => ({
      ...filters, // Include all filters (status, where, searchingFor, etc.)
      orderBy: convertSortConfigsToOrderBy(sortConfigs),
      skip: Math.max(0, (page - 1) * pageSize),
      take: pageSize,
      include: {
        task: {
          include: {
            customer: {
              select: {
                id: true,
                fantasyName: true,
                corporateName: true,
                cnpj: true,
                cpf: true,
              },
            },
          },
        },
      },
    }),
    [filters, page, pageSize, sortConfigs],
  );

  // Fetch data
  const { data: response, isLoading, error } = useServiceOrders(queryParams);

  const items = response?.data || [];
  const totalPages = response?.meta ? Math.ceil(response.meta.totalRecords / pageSize) : 1;
  const totalRecords = response?.meta?.totalRecords || 0;

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    serviceOrders: ServiceOrder[];
    isBulk: boolean;
  } | null>(null);

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  };

  // Handle context menu
  const handleContextMenu = (e: React.MouseEvent, serviceOrder: ServiceOrder) => {
    e.preventDefault();
    const isBulk = selectedIds.size > 1 && selectedIds.has(serviceOrder.id);
    const serviceOrders = isBulk ? items.filter((item) => selectedIds.has(item.id)) : [serviceOrder];

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      serviceOrders,
      isBulk,
    });
  };

  const closeContextMenu = () => setContextMenu(null);

  // Handle row click
  const handleRowClick = (serviceOrder: ServiceOrder, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      toggleSelection(serviceOrder.id);
    } else {
      navigate(routes.production.serviceOrders.details(serviceOrder.id));
    }
  };

  // Update parent with data changes
  useEffect(() => {
    onDataChange?.({ items, totalRecords });
  }, [items, totalRecords, onDataChange]);

  // Define table columns
  const columns = [
    {
      id: "select",
      header: () => <Checkbox checked={selectedIds.size === items.length && items.length > 0} onCheckedChange={toggleSelectAll} aria-label="Selecionar todos" />,
      cell: (serviceOrder: ServiceOrder) => (
        <Checkbox checked={selectedIds.has(serviceOrder.id)} onCheckedChange={() => toggleSelection(serviceOrder.id)} aria-label={`Selecionar ordem ${serviceOrder.id}`} />
      ),
      width: "w-12",
    },
    {
      id: "description",
      header: "Descrição",
      sortable: true,
      cell: (serviceOrder: ServiceOrder) => (
        <div className="max-w-xs">
          <div className="font-medium truncate">{serviceOrder.description}</div>
          {serviceOrder.task && (
            <div className="text-sm text-muted-foreground truncate">
              Tarefa: {serviceOrder.task.name || serviceOrder.task.details || `#${serviceOrder.task.id.slice(-8).toUpperCase()}`}
            </div>
          )}
        </div>
      ),
      width: "min-w-0 flex-1",
    },
    {
      id: "task",
      header: "Tarefa",
      cell: (serviceOrder: ServiceOrder) => (
        <div className="max-w-xs">
          {serviceOrder.task ? (
            <>
              <div className="font-medium truncate">{serviceOrder.task.name || serviceOrder.task.details || `#${serviceOrder.task.id.slice(-8).toUpperCase()}`}</div>
              {serviceOrder.task.customer && (
                <div className="text-sm text-muted-foreground truncate">{serviceOrder.task.customer.fantasyName || serviceOrder.task.customer.corporateName}</div>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </div>
      ),
      width: "w-48",
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      cell: (serviceOrder: ServiceOrder) => {
        const status = serviceOrder.status || SERVICE_ORDER_STATUS.PENDING;
        const config = STATUS_CONFIG[status];
        return <Badge variant={config.variant}>{SERVICE_ORDER_STATUS_LABELS[status]}</Badge>;
      },
      width: "w-32",
    },
    {
      id: "timing",
      header: "Cronometria",
      cell: (serviceOrder: ServiceOrder) => (
        <div className="text-sm">
          <div>Criado: {formatDate(serviceOrder.createdAt)}</div>
          {serviceOrder.startedAt && <div className="text-muted-foreground">Iniciado: {formatDateTime(serviceOrder.startedAt)}</div>}
          {serviceOrder.finishedAt && <div className="text-muted-foreground">Finalizado: {formatDateTime(serviceOrder.finishedAt)}</div>}
        </div>
      ),
      width: "w-40",
    },
    {
      id: "actions",
      header: "Ações",
      cell: (serviceOrder: ServiceOrder) => (
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(routes.production.serviceOrders.details(serviceOrder.id));
                  }}
                >
                  <IconEye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ver detalhes</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(routes.production.serviceOrders.edit(serviceOrder.id));
                  }}
                >
                  <IconEdit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Editar</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ),
      width: "w-24",
    },
  ];

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <div className="text-muted-foreground">Carregando ordens de serviço...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <div className="text-destructive">Erro ao carregar ordens de serviço</div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Table Container */}
      <div className="flex-1 overflow-hidden border border-border rounded-lg">
        <div className="h-full overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                {columns.map((column) => (
                  <TableHead
                    key={column.id}
                    className={cn(column.width, column.sortable && "cursor-pointer select-none hover:bg-muted/50", "border-r border-border last:border-r-0")}
                    onClick={() => column.sortable && toggleSort(column.id)}
                  >
                    <div className="flex items-center gap-2">
                      {typeof column.header === "function" ? column.header() : column.header}
                      {column.sortable && (
                        <div className="flex flex-col">
                          {getSortDirection(column.id) === "asc" ? (
                            <IconChevronUp className="h-3 w-3" />
                          ) : getSortDirection(column.id) === "desc" ? (
                            <IconChevronDown className="h-3 w-3" />
                          ) : (
                            <IconSelector className="h-3 w-3 opacity-50" />
                          )}
                        </div>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                    Nenhuma ordem de serviço encontrada
                  </TableCell>
                </TableRow>
              ) : (
                items.map((serviceOrder) => (
                  <TableRow
                    key={serviceOrder.id}
                    className={cn("cursor-pointer hover:bg-muted/50", selectedIds.has(serviceOrder.id) && "bg-muted")}
                    onClick={(e) => handleRowClick(serviceOrder, e)}
                    onContextMenu={(e) => handleContextMenu(e, serviceOrder)}
                  >
                    {columns.map((column) => (
                      <TableCell key={column.id} className={cn(column.width, "border-r border-border last:border-r-0")}>
                        {column.cell(serviceOrder)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex justify-center py-4">
        <SimplePaginationAdvanced
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          totalRecords={totalRecords}
          itemName="ordem de serviço"
          itemNamePlural="ordens de serviço"
        />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={closeContextMenu} onContextMenu={(e) => e.preventDefault()} />
          <DropdownMenu open={true} onOpenChange={closeContextMenu}>
            <DropdownMenuTrigger asChild>
              <div
                className="fixed z-50"
                style={{
                  left: contextMenu.x,
                  top: contextMenu.y,
                }}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="bottom" className="w-48">
              <DropdownMenuItem
                onClick={() => {
                  onEdit?.(contextMenu.serviceOrders);
                  closeContextMenu();
                }}
              >
                <IconEdit className="h-4 w-4 mr-2" />
                {contextMenu.isBulk ? "Editar Selecionadas" : "Editar"}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => {
                  onStart?.(contextMenu.serviceOrders);
                  closeContextMenu();
                }}
                disabled={!contextMenu.serviceOrders.some((so) => so.status === SERVICE_ORDER_STATUS.PENDING)}
              >
                <IconPlayerPlay className="h-4 w-4 mr-2" />
                Iniciar
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  onFinish?.(contextMenu.serviceOrders);
                  closeContextMenu();
                }}
                disabled={!contextMenu.serviceOrders.some((so) => so.status === SERVICE_ORDER_STATUS.IN_PROGRESS)}
              >
                <IconCheck className="h-4 w-4 mr-2" />
                Finalizar
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  onCancel?.(contextMenu.serviceOrders);
                  closeContextMenu();
                }}
                disabled={!contextMenu.serviceOrders.some((so) => so.status !== SERVICE_ORDER_STATUS.COMPLETED && so.status !== SERVICE_ORDER_STATUS.CANCELLED)}
              >
                <IconX className="h-4 w-4 mr-2" />
                Cancelar
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => {
                  onDelete?.(contextMenu.serviceOrders);
                  closeContextMenu();
                }}
                className="text-destructive focus:text-destructive"
              >
                <IconTrash className="h-4 w-4 mr-2" />
                {contextMenu.isBulk ? "Excluir Selecionadas" : "Excluir"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}
