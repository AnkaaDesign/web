import React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IconDotsVertical, IconEdit, IconTrash, IconEye, IconPhoto } from "@tabler/icons-react";
import { formatDate, formatRelativeTime, formatCurrency } from "../../../../utils";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { AIRBRUSHING_STATUS_LABELS } from "../../../../constants";
import type { Airbrushing } from "../../../../types";
import type { StandardizedColumn } from "@/components/ui/standardized-table";

interface AirbrushingTableColumnsProps {
  selection: Record<string, boolean>;
  onRowSelection: (airbrushingId: string, selected: boolean) => void;
  onView: (airbrushing: Airbrushing, event?: React.MouseEvent) => void;
  onEdit: (airbrushing: Airbrushing, event?: React.MouseEvent) => void;
  onDelete: (airbrushing: Airbrushing, event?: React.MouseEvent) => void;
}

export function getDefaultVisibleColumns(): Set<string> {
  return new Set(["task.name", "task.customer.fantasyName", "status", "price", "startDate", "finishDate", "artworksCount"]);
}

export function getAirbrushingTableColumns({ selection, onRowSelection, onView, onEdit, onDelete }: AirbrushingTableColumnsProps): StandardizedColumn<Airbrushing>[] {
  return [
    {
      key: "select",
      header: "",
      accessor: (airbrushing) => <Checkbox checked={!!selection[airbrushing.id]} onCheckedChange={(checked) => onRowSelection(airbrushing.id, !!checked)} />,
      className: "w-12",
    },
    {
      key: "task.name",
      header: "Tarefa",
      accessor: (airbrushing) => (
        <div className="space-y-1">
          {airbrushing.task ? <TruncatedTextWithTooltip text={airbrushing.task.name} className="font-medium" /> : <span className="text-muted-foreground">-</span>}
        </div>
      ),
      sortable: true,
      className: "min-w-[200px]",
    },
    {
      key: "task.customer.fantasyName",
      header: "Cliente",
      accessor: (airbrushing) => (
        <div className="space-y-1">
          {airbrushing.task?.customer ? (
            <TruncatedTextWithTooltip text={airbrushing.task.customer.fantasyName} className="text-sm" />
          ) : (
            <span className="text-muted-foreground text-sm">-</span>
          )}
        </div>
      ),
      className: "min-w-[180px]",
    },
    {
      key: "status",
      header: "Status",
      accessor: (airbrushing) => (
        <Badge
          variant={
            airbrushing.status === "PENDING" ? "secondary" : airbrushing.status === "IN_PRODUCTION" ? "default" : airbrushing.status === "COMPLETED" ? "success" : "destructive"
          }
          className="whitespace-nowrap"
        >
          {AIRBRUSHING_STATUS_LABELS[airbrushing.status]}
        </Badge>
      ),
      sortable: true,
      className: "w-32",
    },
    {
      key: "price",
      header: "Preço",
      accessor: (airbrushing) => (
        <div className="text-sm font-medium">{airbrushing.price !== null ? formatCurrency(airbrushing.price) : <span className="text-muted-foreground">-</span>}</div>
      ),
      sortable: true,
      className: "w-28 text-right",
    },
    {
      key: "startDate",
      header: "Data Início",
      accessor: (airbrushing) => (
        <div className="space-y-1">
          {airbrushing.startDate ? (
            <>
              <div className="text-sm">{formatDate(airbrushing.startDate)}</div>
              <div className="text-xs text-muted-foreground">{formatRelativeTime(airbrushing.startDate)}</div>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>
      ),
      sortable: true,
      className: "w-32",
    },
    {
      key: "finishDate",
      header: "Data Finalização",
      accessor: (airbrushing) => (
        <div className="space-y-1">
          {airbrushing.finishDate ? (
            <>
              <div className="text-sm">{formatDate(airbrushing.finishDate)}</div>
              <div className="text-xs text-muted-foreground">{formatRelativeTime(airbrushing.finishDate)}</div>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>
      ),
      sortable: true,
      className: "w-32",
    },
    {
      key: "artworksCount",
      header: "Artes",
      accessor: (airbrushing) => (
        <div className="flex items-center gap-1.5">
          <IconPhoto className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{airbrushing.artworks?.length || 0}</span>
        </div>
      ),
      className: "w-20 text-center",
    },
    {
      key: "actions",
      header: "",
      accessor: (airbrushing) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <IconDotsVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e: React.MouseEvent) => onView(airbrushing, e)}>
              <IconEye className="h-4 w-4 mr-2" />
              Ver detalhes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e: React.MouseEvent) => onEdit(airbrushing, e)}>
              <IconEdit className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e: React.MouseEvent) => onDelete(airbrushing, e)} className="text-destructive">
              <IconTrash className="h-4 w-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      className: "w-12",
    },
  ];
}
