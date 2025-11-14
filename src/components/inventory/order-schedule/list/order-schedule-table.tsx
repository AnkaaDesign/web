import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableWithSelection } from "@/components/ui/data-table-with-selection";
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
import { IconCalendar, IconClock, IconDots, IconPackage, IconPlayerPause, IconPlayerPlay, IconEdit, IconEye, IconCircleCheck, IconCircleX, IconTrash } from "@tabler/icons-react";
import { useColumnVisibility } from "@/hooks/use-column-visibility";

import { getDynamicFrequencyLabel } from "../../../../constants";
import type { OrderSchedule } from "../../../../types";

// Extended interface for table display with potential supplier/category info
interface OrderScheduleWithDisplayInfo extends OrderSchedule {
  supplier?: {
    id: string;
    fantasyName: string;
  };
  category?: {
    id: string;
    name: string;
  };
}

interface OrderScheduleTableProps {
  data: OrderScheduleWithDisplayInfo[];
  isLoading?: boolean;
  onEdit?: (schedule: OrderScheduleWithDisplayInfo) => void;
  onView?: (schedule: OrderScheduleWithDisplayInfo) => void;
  onStatusChange?: (schedule: OrderScheduleWithDisplayInfo, newStatus: string) => void;
  onDelete?: (scheduleIds: string[]) => void;
  className?: string;
}

export function OrderScheduleTable({ data, isLoading = false, onEdit, onView, onStatusChange, onDelete, className }: OrderScheduleTableProps) {
  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    items: OrderScheduleWithDisplayInfo[];
    isBulk: boolean;
  } | null>(null);

  // Use column visibility hook with localStorage persistence
  const { visibleColumns } = useColumnVisibility(
    "order-schedule-table-visible-columns",
    new Set(["status", "target", "frequency", "itemsCount", "nextRun", "lastRun"])
  );

  const allColumns = React.useMemo(
    () => [
      // Status
      {
        key: "status",
        header: "Status",
        accessor: (_row: OrderScheduleWithDisplayInfo) => {
          return (
            <Badge variant="outline" className="bg-green-50 text-green-700">
              Ativo
            </Badge>
          );
        },
        sortable: true,
      },

      // Supplier/Category
      {
        key: "target",
        header: "Fornecedor/Categoria",
        accessor: (schedule: OrderScheduleWithDisplayInfo) => {
          return (
            <div className="flex flex-col">
              {schedule.supplier ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Fornecedor
                  </Badge>
                  <span className="font-medium">{schedule.supplier.fantasyName}</span>
                </div>
              ) : schedule.category ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Categoria
                  </Badge>
                  <span className="font-medium">{schedule.category.name}</span>
                </div>
              ) : (
                <span className="text-muted-foreground text-sm">Não definido</span>
              )}
            </div>
          );
        },
        sortable: false,
      },

      // Frequency
      {
        key: "frequency",
        header: "Frequência",
        accessor: (schedule: OrderScheduleWithDisplayInfo) => {
          const frequencyLabel = getDynamicFrequencyLabel(schedule.frequency, schedule.frequencyCount);
          return (
            <div className="flex flex-col">
              <span className="font-medium">{frequencyLabel}</span>
            </div>
          );
        },
        sortable: true,
      },

      // Items Count
      {
        key: "itemsCount",
        header: "Itens",
        accessor: (schedule: OrderScheduleWithDisplayInfo) => {
          return (
            <div className="flex items-center gap-2">
              <IconPackage className="h-4 w-4 text-muted-foreground" />
              <span>{schedule.items?.length || 0}</span>
            </div>
          );
        },
        sortable: true,
      },

      // Next Run
      {
        key: "nextRun",
        header: "Próxima Execução",
        accessor: (schedule: OrderScheduleWithDisplayInfo) => {
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
        sortable: true,
      },

      // Last Run
      {
        key: "lastRun",
        header: "Última Execução",
        accessor: (schedule: OrderScheduleWithDisplayInfo) => {
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
        sortable: true,
      },

      // Actions
      {
        key: "actions",
        header: "Ações",
        accessor: (schedule: OrderScheduleWithDisplayInfo) => {
          return (
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
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(schedule)}>
                    <IconEdit className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                {/* Status transitions */}
                {onStatusChange && (
                  <>
                    {schedule.isActive && !schedule.finishedAt && (
                      <DropdownMenuItem onClick={() => onStatusChange(schedule, "PAUSED")}>
                        <IconPlayerPause className="mr-2 h-4 w-4" />
                        Pausar
                      </DropdownMenuItem>
                    )}

                    {!schedule.isActive && !schedule.finishedAt && (
                      <DropdownMenuItem onClick={() => onStatusChange(schedule, "ACTIVE")}>
                        <IconPlayerPlay className="mr-2 h-4 w-4" />
                        Reativar
                      </DropdownMenuItem>
                    )}

                    {!schedule.finishedAt && (
                      <>
                        <DropdownMenuItem onClick={() => onStatusChange(schedule, "COMPLETED")}>
                          <IconCircleCheck className="mr-2 h-4 w-4" />
                          Marcar como Concluído
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={() => onStatusChange(schedule, "CANCELLED")} className="text-destructive">
                          <IconCircleX className="mr-2 h-4 w-4" />
                          Cancelar
                        </DropdownMenuItem>
                      </>
                    )}
                  </>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => {
                    setDeleteDialog({ items: [schedule], isBulk: false });
                  }}
                  className="text-destructive"
                >
                  <IconTrash className="mr-2 h-4 w-4" />
                  Deletar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        sortable: false,
      },
    ],
    [onEdit, onView, onStatusChange],
  );

  // Filter columns based on visibility (always include actions)
  const columns = useMemo(() => {
    return allColumns.filter((col) => col.key === "actions" || visibleColumns.has(col.key));
  }, [allColumns, visibleColumns]);

  // Handle delete confirmation
  const confirmDelete = () => {
    if (!deleteDialog || !onDelete) return;

    const scheduleIds = deleteDialog.items.map((schedule) => schedule.id);
    onDelete(scheduleIds);
    setDeleteDialog(null);
  };

  // Bulk actions component
  const bulkActionsComponent = onDelete && (
    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-md">
      <span className="text-sm text-muted-foreground">Cronogramas selecionados</span>
      <Button
        variant="destructive"
        size="sm"
        onClick={() => {
          // Note: The actual selected IDs will be managed by DataTableWithSelection
          // This is a placeholder - the actual implementation would need to get the selected IDs
          // For now, this triggers the delete dialog with empty items
          setDeleteDialog({ items: [], isBulk: true });
        }}
      >
        <IconCircleX className="mr-2 h-4 w-4" />
        Excluir Selecionados
      </Button>
    </div>
  );

  return (
    <div className={className}>
      <DataTableWithSelection
        columns={columns}
        data={data}
        rowId={(schedule) => schedule.id}
        searchKey="id" // Can be changed to a more relevant field
        searchPlaceholder="Buscar cronogramas..."
        bulkActionsComponent={bulkActionsComponent}
        className={isLoading ? "opacity-50" : ""}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk && deleteDialog.items.length > 1
                ? `Tem certeza que deseja deletar ${deleteDialog.items.length} cronogramas? Esta ação não pode ser desfeita.`
                : deleteDialog?.items.length === 1
                ? `Tem certeza que deseja deletar este cronograma? Esta ação não pode ser desfeita.`
                : "Tem certeza que deseja deletar os cronogramas selecionados? Esta ação não pode ser desfeita."}
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
