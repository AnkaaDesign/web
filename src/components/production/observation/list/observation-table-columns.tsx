import React from "react";
import type { Observation } from "../../../../types";
import { formatDate } from "../../../../utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import type { StandardizedColumn } from "@/components/ui/standardized-table";
import { IconDotsVertical, IconEdit, IconTrash, IconEye, IconPaperclip } from "@tabler/icons-react";

interface CreateObservationColumnsOptions {
  selection: Record<string, boolean>;
  onRowSelection: (observationId: string, selected: boolean) => void;
  onEdit: (observation: Observation, event?: React.MouseEvent) => void;
  onDelete: (observation: Observation, event?: React.MouseEvent) => void;
  onView: (observation: Observation, event?: React.MouseEvent) => void;
}

export const createObservationColumns = (options: CreateObservationColumnsOptions): StandardizedColumn<Observation>[] => {
  const { selection, onRowSelection, onEdit, onDelete, onView } = options;

  return [
    {
      key: "select",
      header: "",
      accessor: (observation) => <Checkbox checked={!!selection[observation.id]} onCheckedChange={(checked) => onRowSelection(observation.id, !!checked)} />,
      className: "w-12",
    },
    {
      key: "task.name",
      header: "Tarefa",
      accessor: (observation) => (
        <div className="space-y-1">
          {observation.task ? <TruncatedTextWithTooltip text={observation.task.name} className="font-medium" /> : <span className="text-muted-foreground">-</span>}
        </div>
      ),
      sortable: true,
    },
    {
      key: "description",
      header: "Descrição",
      accessor: (observation) => (
        <div className="space-y-1">
          <TruncatedTextWithTooltip text={observation.description} className="font-medium" />
        </div>
      ),
      sortable: true,
    },
    {
      key: "files",
      header: "Arquivos",
      accessor: (observation) => (
        <div className="flex items-center gap-1">
          {observation.files && observation.files.length > 0 ? (
            <>
              <IconPaperclip className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{observation.files.length}</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>
      ),
      className: "w-24",
    },
    {
      key: "createdBy",
      header: "Criado por",
      accessor: (observation) => (
        <div className="text-sm">
          {observation.task?.createdBy ? <TruncatedTextWithTooltip text={observation.task.createdBy.name} /> : <span className="text-muted-foreground">-</span>}
        </div>
      ),
      className: "w-32",
    },
    {
      key: "createdAt",
      header: "Criado em",
      accessor: (observation) => (
        <div className="text-sm">{formatDate(observation.createdAt)}</div>
      ),
      sortable: true,
      className: "w-32",
    },
    {
      key: "actions",
      header: "",
      accessor: (observation) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
              <IconDotsVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => onView(observation, e)}>
              <IconEye className="h-4 w-4 mr-2" />
              Ver detalhes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => onEdit(observation, e)}>
              <IconEdit className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => onDelete(observation, e)} className="text-destructive">
              <IconTrash className="h-4 w-4 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      className: "w-12",
    },
  ];
};

// Default visible columns
export const getDefaultVisibleColumns = (): Set<string> => {
  return new Set(["task.name", "description", "files", "createdBy", "createdAt"]);
};
