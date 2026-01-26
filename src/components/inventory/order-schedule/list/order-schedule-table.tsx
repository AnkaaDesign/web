import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
import { IconCalendar, IconClock, IconDots, IconPackage, IconPlayerPause, IconPlayerPlay, IconEdit, IconEye, IconCircleCheck, IconCircleX, IconTrash, IconChevronUp, IconChevronDown, IconSelector } from "@tabler/icons-react";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { useAuth } from "../../../../hooks/useAuth";
import { canEditOrders, canDeleteOrders } from "@/utils/permissions/entity-permissions";
import { useTableState, convertSortConfigsToOrderBy } from "@/hooks/use-table-state";
import { useOrderSchedules, useOrderScheduleMutations } from "../../../../hooks";
import type { OrderScheduleGetManyFormData } from "../../../../schemas";
import { getDynamicFrequencyLabel } from "../../../../constants";
import type { OrderSchedule } from "../../../../types";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";

interface OrderScheduleTableProps {
  visibleColumns: Set<string>;
  className?: string;
  onEdit?: (schedule: OrderSchedule) => void;
  onView?: (schedule: OrderSchedule) => void;
  filters?: Partial<OrderScheduleGetManyFormData>;
}

export function OrderScheduleTable({ visibleColumns, className, onEdit, onView, filters = {} }: OrderScheduleTableProps) {
  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    items: OrderSchedule[];
    isBulk: boolean;
  } | null>(null);

  // Permission checks
  const { user } = useAuth();
  const canEdit = user ? canEditOrders(user) : false;
  const canDelete = user ? canDeleteOrders(user) : false;

  // Mutations
  const { delete: deleteSchedule } = useOrderScheduleMutations();

  // Use URL state management for pagination and selection
  const {
    page,
    pageSize,
    selectedIds,
    sortConfigs,
    setPage,
    setPageSize,
    toggleSelection,
    toggleSelectAll,
    toggleSort,
    getSortDirection,
    isSelected,
    isAllSelected,
    isPartiallySelected,
    selectionCount,
  } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Memoize query parameters
  const queryParams = useMemo(
    () => ({
      ...filters,
      page: page + 1,
      limit: pageSize,
      orderBy: convertSortConfigsToOrderBy(
        sortConfigs.length > 0
          ? sortConfigs
          : [{ column: "createdAt", direction: "desc" }],
      ),
    }),
    [filters, page, pageSize, sortConfigs],
  );

  // Fetch data
  const { data, isLoading } = useOrderSchedules(queryParams);

  const schedules = data?.data || [];
  const totalRecords = data?.totalRecords || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

  // Column definitions
  const allColumns = useMemo(
    () => [
      {
        key: "status",
        header: "STATUS",
        sortable: true,
        render: (_schedule: OrderSchedule) => (
          <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
            Ativo
          </Badge>
        ),
      },
      {
        key: "frequency",
        header: "FREQUÊNCIA",
        sortable: true,
        render: (schedule: OrderSchedule) => {
          const frequencyLabel = getDynamicFrequencyLabel(schedule.frequency, schedule.frequencyCount);
          return <span className="font-medium">{frequencyLabel}</span>;
        },
      },
      {
        key: "itemsCount",
        header: "ITENS",
        sortable: true,
        render: (schedule: OrderSchedule) => (
          <div className="flex items-center gap-2">
            <IconPackage className="h-4 w-4 text-muted-foreground" />
            <span>{schedule.items?.length || 0}</span>
          </div>
        ),
      },
      {
        key: "nextRun",
        header: "PRÓXIMA EXECUÇÃO",
        sortable: true,
        render: (schedule: OrderSchedule) => {
          if (!schedule.nextRun) {
            return <span className="text-muted-foreground text-sm">Não agendada</span>;
          }
          const date = typeof schedule.nextRun === "string" ? new Date(schedule.nextRun) : schedule.nextRun;
          return (
            <div className="flex items-center gap-2">
              <IconCalendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{format(date, "dd/MM/yyyy", { locale: ptBR })}</span>
            </div>
          );
        },
      },
      {
        key: "lastRun",
        header: "ÚLTIMA EXECUÇÃO",
        sortable: true,
        render: (schedule: OrderSchedule) => {
          if (!schedule.lastRun) {
            return <span className="text-muted-foreground text-sm">Nunca executado</span>;
          }
          const date = typeof schedule.lastRun === "string" ? new Date(schedule.lastRun) : schedule.lastRun;
          return (
            <div className="flex items-center gap-2">
              <IconClock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{format(date, "dd/MM/yyyy", { locale: ptBR })}</span>
            </div>
          );
        },
      },
    ],
    [],
  );

  // Filter columns based on visibility
  const columns = useMemo(() => {
    return allColumns.filter((col) => visibleColumns.has(col.key));
  }, [allColumns, visibleColumns]);

  // Handle delete confirmation
  const confirmDelete = () => {
    if (!deleteDialog) return;
    deleteDialog.items.forEach((schedule) => deleteSchedule(schedule.id));
    setDeleteDialog(null);
  };

  // Render sort icon
  const renderSortIcon = (columnKey: string) => {
    const direction = getSortDirection(columnKey);
    if (direction === "asc") {
      return <IconChevronUp className="h-4 w-4" />;
    } else if (direction === "desc") {
      return <IconChevronDown className="h-4 w-4" />;
    }
    return <IconSelector className="h-4 w-4 opacity-50" />;
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Table */}
      <div className="flex-1 overflow-auto border border-border/40 rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              {/* Selection checkbox */}
              <TableHead className={cn(TABLE_LAYOUT.checkbox.className, "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0")}>
                <div className="flex items-center justify-center h-full w-full px-2">
                  <Checkbox
                    checked={isAllSelected(schedules.map(s => s.id))}
                    onCheckedChange={() => toggleSelectAll(schedules.map(s => s.id))}
                  />
                </div>
              </TableHead>

              {/* Column headers */}
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    "whitespace-nowrap font-bold uppercase text-xs",
                    column.sortable && "cursor-pointer select-none hover:bg-muted/50"
                  )}
                  onClick={() => column.sortable && toggleSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    {column.header}
                    {column.sortable && renderSortIcon(column.key)}
                  </div>
                </TableHead>
              ))}

              {/* Actions column */}
              <TableHead className="whitespace-nowrap font-bold uppercase text-xs w-20">AÇÕES</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length + 2} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : schedules.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 2} className="text-center py-8 text-muted-foreground">
                  Nenhum resultado encontrado.
                </TableCell>
              </TableRow>
            ) : (
              schedules.map((schedule) => (
                <TableRow key={schedule.id} className="hover:bg-muted/30">
                  {/* Selection checkbox */}
                  <TableCell className={cn(TABLE_LAYOUT.checkbox.className, "p-0 !border-r-0")}>
                    <div
                      className="flex items-center justify-center h-full w-full px-2 py-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelection(schedule.id);
                      }}
                    >
                      <Checkbox
                        checked={isSelected(schedule.id)}
                        onCheckedChange={() => toggleSelection(schedule.id)}
                      />
                    </div>
                  </TableCell>

                  {/* Data columns */}
                  {columns.map((column) => (
                    <TableCell key={column.key}>
                      {column.render(schedule)}
                    </TableCell>
                  ))}

                  {/* Actions */}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Abrir menu</span>
                          <IconDots className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onView && (
                          <DropdownMenuItem onClick={() => onView(schedule)}>
                            <IconEye className="mr-2 h-4 w-4" />
                            Visualizar
                          </DropdownMenuItem>
                        )}
                        {canEdit && onEdit && (
                          <DropdownMenuItem onClick={() => onEdit(schedule)}>
                            <IconEdit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                        )}

                        {canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setDeleteDialog({ items: [schedule], isBulk: false })}
                              className="text-destructive"
                            >
                              <IconTrash className="mr-2 h-4 w-4" />
                              Deletar
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalRecords > 0 && (
        <div className="mt-4">
          <SimplePaginationAdvanced
            currentPage={page}
            totalPages={totalPages}
            pageSize={pageSize}
            totalRecords={totalRecords}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[20, 40, 60, 100]}
          />
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk && deleteDialog.items.length > 1
                ? `Tem certeza que deseja deletar ${deleteDialog.items.length} agendamentos? Esta ação não pode ser desfeita.`
                : deleteDialog?.items.length === 1
                ? `Tem certeza que deseja deletar este agendamento? Esta ação não pode ser desfeita.`
                : "Tem certeza que deseja deletar os agendamentos selecionados? Esta ação não pode ser desfeita."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
