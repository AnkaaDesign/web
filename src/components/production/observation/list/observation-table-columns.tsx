import type { Observation } from "../../../../types";
import { formatDate } from "../../../../utils";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { IconPaperclip } from "@tabler/icons-react";
import type { DataTableColumnDef } from "@/components/ui/datatable";

const muted = (text: string) => <span className="text-sm text-muted-foreground whitespace-nowrap">{text}</span>;

/** The observation-list column set as generic `DataTableColumnDef`s for the new DataTable. */
export function createObservationColumns(): DataTableColumnDef<Observation>[] {
  return [
    {
      // Dot-free id: the column id feeds a `--col-<id>-size` CSS custom property, and a dot is an
      // invalid custom-property ident — a dotted id silently breaks this column's width/resize var.
      id: "taskName",
      header: "Tarefa",
      accessorFn: (row) => row.task?.name || "",
      enableSorting: true,
      size: 260,
      minSize: 180,
      meta: { headerLabel: "Tarefa", exportValue: (row) => row.task?.name || "" },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <TruncatedTextWithTooltip text={v} className="text-sm font-medium" /> : muted("-");
      },
    },
    {
      id: "description",
      header: "Descrição",
      accessorFn: (row) => row.description || "",
      enableSorting: true,
      size: 360,
      minSize: 240,
      meta: { headerLabel: "Descrição", exportValue: (row) => row.description || "" },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <TruncatedTextWithTooltip text={v} className="text-sm" /> : muted("-");
      },
    },
    {
      // Files count — no server-sortable field, so sorting is disabled (matches the old table).
      id: "filesCount",
      header: "Arquivos",
      accessorFn: (row) => row.files?.length ?? 0,
      enableSorting: false,
      size: 120,
      minSize: 100,
      meta: { headerLabel: "Arquivos", exportValue: (row) => row.files?.length ?? 0 },
      cell: ({ row }) => {
        const count = row.original.files?.length ?? 0;
        return count > 0 ? (
          <div className="flex items-center gap-1.5">
            <IconPaperclip className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium tabular-nums">{count}</span>
          </div>
        ) : (
          muted("-")
        );
      },
    },
    {
      id: "createdAt",
      header: "Criado em",
      accessorKey: "createdAt",
      enableSorting: true,
      size: 150,
      minSize: 120,
      meta: { headerLabel: "Criado em", exportValue: (row) => (row.createdAt ? formatDate(row.createdAt) : "") },
      cell: ({ row }) => muted(row.original.createdAt ? formatDate(row.original.createdAt) : "-"),
    },
    {
      id: "updatedAt",
      header: "Atualizado em",
      accessorKey: "updatedAt",
      enableSorting: true,
      size: 150,
      minSize: 120,
      meta: { defaultVisible: false, headerLabel: "Atualizado em", exportValue: (row) => (row.updatedAt ? formatDate(row.updatedAt) : "") },
      cell: ({ row }) => muted(row.original.updatedAt ? formatDate(row.original.updatedAt) : "-"),
    },
  ];
}
