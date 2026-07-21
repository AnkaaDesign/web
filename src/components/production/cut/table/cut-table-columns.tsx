import { useState } from "react";
import { IconFileOff } from "@tabler/icons-react";
import type { Cut, File as AnkaaFile } from "../../../../types";
import {
  CUT_ORIGIN,
  CUT_STATUS_LABELS,
  CUT_TYPE_LABELS,
  CUT_ORIGIN_LABELS,
  CUT_REQUEST_REASON_LABELS,
  getBadgeVariant,
} from "../../../../constants";
import { formatDateTime } from "../../../../utils";
import { Badge } from "@/components/ui/badge";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import { getApiBaseUrl } from "@/config/api";
import { useFileViewer } from "@/components/common/file";
import { cn } from "@/lib/utils";
import type { DataTableColumnDef, SectorDefaults } from "@/components/ui/datatable";

/**
 * No per-sector starting layout differs for cuts — every role sees the same default
 * columns (driven by `meta.defaultVisible` below). Exported for parity with the order
 * table's wiring; kept empty so the hardcoded defaults win for every sector.
 */
export const CUT_SECTOR_DEFAULTS: SectorDefaults = {};

const muted = (text: string) => <span className="text-sm text-muted-foreground whitespace-nowrap">{text}</span>;

const thumbnailUrl = (fileId: string) => `${getApiBaseUrl()}/files/thumbnail/${fileId}?size=small`;

/**
 * File preview thumbnail for the list. Tries the on-demand thumbnail endpoint; when the backend
 * can't render one (e.g. EPS/vector files) the <img> errors — instead of leaving a broken image
 * showing the alt filename, we fall back to the colored file-type icon (the same vector-bezier icon
 * the detail page shows). Keyed by file id upstream so the error state resets per row.
 *
 * Clicking the thumbnail opens the file directly in the unified file viewer (image/PDF/video modal),
 * matching the pre-migration table. `stopPropagation` keeps the click from also triggering the row's
 * navigate-to-detail. The FileViewerProvider wraps the whole app (App.tsx), but we still guard with
 * try/catch so the column stays usable if it's ever rendered outside a provider.
 */
function CutFilePreview({ file }: { file?: AnkaaFile }) {
  const [errored, setErrored] = useState(false);

  let fileViewer: ReturnType<typeof useFileViewer> | null = null;
  try {
    fileViewer = useFileViewer();
  } catch {
    // No FileViewerProvider in this tree — thumbnail stays non-clickable.
  }

  const clickable = !!file && !!fileViewer;

  return (
    <div className="flex items-center justify-center">
      <div
        className={cn(
          "w-12 h-12 rounded-md overflow-hidden bg-muted/20 flex items-center justify-center transition-all",
          clickable && "cursor-pointer hover:ring-2 hover:ring-primary",
        )}
        onClick={
          clickable
            ? (e) => {
                e.stopPropagation();
                fileViewer!.actions.viewFile(file!);
              }
            : undefined
        }
      >
        {!file ? (
          <IconFileOff className="w-5 h-5 text-muted-foreground/50" />
        ) : errored ? (
          <FileTypeIcon filename={file.filename} mimeType={file.mimetype} size="lg" />
        ) : (
          <img
            src={thumbnailUrl(file.id)}
            alt={file.filename}
            className="w-full h-full object-contain"
            onError={() => setErrored(true)}
          />
        )}
      </div>
    </div>
  );
}

/** Human reason label: the recut reason when set, otherwise the origin's default meaning. */
function cutReasonLabel(cut: Cut): string {
  if (cut.reason) return CUT_REQUEST_REASON_LABELS[cut.reason];
  return cut.origin === CUT_ORIGIN.PLAN ? "Plano de corte" : "Solicitação";
}

/** startedAt→completedAt elapsed as "1d 2h 15min" / "45min". */
function formatElapsed(start: Date, end: Date): string {
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return "—";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}min`);
  return parts.join(" ");
}

/** Time a cut took: elapsed once finished, "Em andamento" while cutting, "—" before it starts. */
export function cutDurationLabel(cut: Cut): string {
  if (cut.startedAt && cut.completedAt) return formatElapsed(new Date(cut.startedAt), new Date(cut.completedAt));
  if (cut.startedAt) return "Em andamento";
  return "—";
}

/** The cut-list column set as generic `DataTableColumnDef`s for the new DataTable. */
export function createCutColumns(): DataTableColumnDef<Cut>[] {
  return [
    {
      id: "filePreview",
      header: "Arquivo",
      accessorFn: (row) => row.file?.filename ?? "",
      enableSorting: false,
      size: 72,
      minSize: 64,
      meta: { headerLabel: "Arquivo", align: "center", excludeFromExport: true },
      cell: ({ row }) => <CutFilePreview key={row.original.file?.id ?? "none"} file={row.original.file} />,
    },
    {
      id: "fileName",
      header: "Nome do Arquivo",
      accessorFn: (row) => row.file?.filename ?? "",
      enableSorting: false,
      size: 220,
      minSize: 160,
      meta: { headerLabel: "Nome do Arquivo", exportValue: (row) => row.file?.filename || "" },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <TruncatedTextWithTooltip text={v} className="text-sm" /> : muted("-");
      },
    },
    {
      id: "taskName",
      header: "Tarefa",
      accessorFn: (row) => row.task?.name ?? "",
      enableSorting: true,
      size: 220,
      minSize: 160,
      meta: { headerLabel: "Tarefa", exportValue: (row) => row.task?.name || "" },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <TruncatedTextWithTooltip text={v} className="text-sm font-medium" /> : muted("-");
      },
    },
    {
      // Sorts by the numeric `statusOrder` mirror, renders the colored badge.
      id: "status",
      header: "Status",
      accessorFn: (row) => row.statusOrder,
      enableSorting: true,
      size: 140,
      minSize: 110,
      meta: { headerLabel: "Status", exportValue: (row) => CUT_STATUS_LABELS[row.status] || row.status },
      cell: ({ row }) => <Badge variant={getBadgeVariant(row.original.status, "CUT")}>{CUT_STATUS_LABELS[row.original.status]}</Badge>,
    },
    {
      id: "type",
      header: "Tipo",
      accessorFn: (row) => row.type,
      enableSorting: false,
      size: 120,
      minSize: 100,
      meta: { headerLabel: "Tipo", exportValue: (row) => (row.type ? CUT_TYPE_LABELS[row.type] : "") },
      cell: ({ row }) => (row.original.type ? <Badge variant="secondary">{CUT_TYPE_LABELS[row.original.type]}</Badge> : muted("-")),
    },
    {
      id: "origin",
      header: "Origem",
      accessorFn: (row) => row.origin,
      enableSorting: false,
      size: 120,
      minSize: 100,
      meta: { headerLabel: "Origem", exportValue: (row) => CUT_ORIGIN_LABELS[row.origin] || row.origin },
      cell: ({ row }) => <Badge variant={getBadgeVariant(row.original.origin, "CUT_ORIGIN")}>{CUT_ORIGIN_LABELS[row.original.origin]}</Badge>,
    },
    {
      id: "reason",
      header: "Motivo",
      accessorFn: (row) => cutReasonLabel(row),
      enableSorting: false,
      size: 200,
      minSize: 140,
      meta: { defaultVisible: false, headerLabel: "Motivo", exportValue: (row) => cutReasonLabel(row) },
      cell: ({ getValue }) => <TruncatedTextWithTooltip text={(getValue() as string) || "-"} className="text-sm" />,
    },
    {
      id: "startedAt",
      header: "Iniciado em",
      accessorKey: "startedAt",
      enableSorting: true,
      size: 168,
      minSize: 140,
      meta: { headerLabel: "Iniciado em", exportValue: (row) => (row.startedAt ? formatDateTime(row.startedAt) : "") },
      cell: ({ row }) => muted(row.original.startedAt ? formatDateTime(row.original.startedAt) : "-"),
    },
    {
      id: "completedAt",
      header: "Finalizado em",
      accessorKey: "completedAt",
      enableSorting: true,
      size: 168,
      minSize: 140,
      meta: { headerLabel: "Finalizado em", exportValue: (row) => (row.completedAt ? formatDateTime(row.completedAt) : "") },
      cell: ({ row }) => muted(row.original.completedAt ? formatDateTime(row.original.completedAt) : "-"),
    },
    {
      id: "duration",
      header: "Duração",
      accessorFn: (row) => cutDurationLabel(row),
      enableSorting: false,
      size: 132,
      minSize: 110,
      meta: { headerLabel: "Duração", exportValue: (row) => cutDurationLabel(row) },
      cell: ({ getValue }) => <span className="text-sm text-muted-foreground whitespace-nowrap">{getValue() as string}</span>,
    },
  ];
}
