import { useCallback, useMemo } from "react";
import {
  IconArrowBack,
  IconAlertCircle,
  IconCheck,
  IconClock,
  IconFile,
  IconHash,
  IconPlayerPlay,
  IconProgress,
} from "@tabler/icons-react";

import { FileItem, useFileViewer } from "@/components/common/file";
import { Badge } from "@/components/ui/badge";
import { InlineEditField, enumBadge } from "@/components/ui/detailpage";
import type { DetailFieldDef, EnumEditConfig } from "@/components/ui/detailpage";
import {
  CUT_STATUS,
  CUT_STATUS_LABELS,
  CUT_ORIGIN_LABELS,
  CUT_TYPE_LABELS,
  CUT_REQUEST_REASON_LABELS,
  getBadgeVariant,
} from "@/constants";
import type { Cut, File as AnkaaFile } from "@/types";
import { formatDateTime } from "@/utils/date";
import { cn } from "@/lib/utils";

/**
 * Human-readable execution time for a cut:
 * - started + completed → the elapsed duration (e.g. "2h 15min" / "45 minutos")
 * - started, not completed → "Em andamento"
 * - not started → "Não iniciado"
 */
export function formatCutDuration(cut: Cut): { text: string; muted: boolean } {
  if (!cut.startedAt) return { text: "Não iniciado", muted: true };
  if (!cut.completedAt) return { text: "Em andamento", muted: false };

  const start = new Date(cut.startedAt).getTime();
  const end = new Date(cut.completedAt).getTime();
  const diff = Math.max(0, end - start);
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return { text: `${hours}h ${minutes}min`, muted: false };
  return { text: `${minutes} minutos`, muted: false };
}

// Status state-machine mirrored from the lifecycle actions: PENDING → CUTTING → COMPLETED (the
// current value is always kept by the enum editor). Shared by the display badge and the inline editor.
const STATUS_ENUM_CONFIG: EnumEditConfig<Cut> = {
  values: Object.values(CUT_STATUS),
  labels: CUT_STATUS_LABELS,
  badgeEntity: "CUT",
  transitions: (current) => {
    if (current === CUT_STATUS.PENDING) return [CUT_STATUS.CUTTING];
    if (current === CUT_STATUS.CUTTING) return [CUT_STATUS.COMPLETED];
    return [];
  },
};

interface CutOverviewSectionProps {
  cut: Cut;
  canEdit: boolean;
  /** Persist a status change (sets startedAt/completedAt automatically). */
  onStatusCommit: (cut: Cut, next: CUT_STATUS) => Promise<void>;
}

/**
 * "Informações Gerais" body — the file preview (left, sized to the field column) beside the cut's
 * key fields (right). Status is inline-editable (double-click) with the app's colored enum editor;
 * Origem/Tipo render as colored badges; timestamps show date + time and the execution duration.
 */
export function CutOverviewSection({ cut, canEdit, onStatusCommit }: CutOverviewSectionProps) {
  const fileViewer = useFileViewer();

  const handlePreview = useCallback(
    (file: AnkaaFile) => fileViewer.actions.viewFiles([file], 0),
    [fileViewer],
  );
  const handleDownload = useCallback(
    (file: AnkaaFile) => fileViewer.actions.downloadFile(file),
    [fileViewer],
  );

  const fields = useMemo<DetailFieldDef<Cut>[]>(() => {
    const list: DetailFieldDef<Cut>[] = [
      {
        id: "status",
        label: "Status",
        icon: IconProgress,
        dataType: "enum",
        accessor: (c) => c.status,
        render: (c) => enumBadge(c.status, STATUS_ENUM_CONFIG),
        edit: canEdit
          ? {
              get: (c) => c.status,
              enum: STATUS_ENUM_CONFIG,
              onCommit: (v, c) => onStatusCommit(c, v as CUT_STATUS),
            }
          : undefined,
      },
      {
        id: "origin",
        label: "Origem",
        icon: IconArrowBack,
        accessor: (c) => c.origin,
        render: (c) => <Badge variant={getBadgeVariant(c.origin, "CUT_ORIGIN")}>{CUT_ORIGIN_LABELS[c.origin]}</Badge>,
      },
      {
        id: "type",
        label: "Tipo",
        icon: IconHash,
        accessor: (c) => c.type,
        render: (c) => <Badge variant="secondary">{CUT_TYPE_LABELS[c.type]}</Badge>,
      },
    ];

    // Timestamps — DATE + TIME. Only surface each once it exists (a still-pending cut shows neither).
    if (cut.startedAt) {
      list.push({
        id: "startedAt",
        label: "Iniciado em",
        icon: IconPlayerPlay,
        accessor: (c) => c.startedAt,
        render: (c) => <span>{formatDateTime(c.startedAt)}</span>,
      });
    }
    if (cut.completedAt) {
      list.push({
        id: "completedAt",
        label: "Finalizado em",
        icon: IconCheck,
        accessor: (c) => c.completedAt,
        render: (c) => <span>{formatDateTime(c.completedAt)}</span>,
      });
    }

    // Tempo de Execução (duration / "tempo levado").
    list.push({
      id: "duration",
      label: "Tempo de Execução",
      icon: IconClock,
      accessor: (c) => formatCutDuration(c).text,
      render: (c) => {
        const d = formatCutDuration(c);
        return <span className={cn("font-medium", d.muted && "italic text-muted-foreground")}>{d.text}</span>;
      },
    });

    // Motivo do Retrabalho — only for rework cuts.
    if (cut.reason) {
      list.push({
        id: "reason",
        label: "Motivo do Retrabalho",
        icon: IconAlertCircle,
        accessor: (c) => c.reason,
        render: (c) =>
          c.reason ? (
            <span className="font-medium text-orange-600 dark:text-orange-400">{CUT_REQUEST_REASON_LABELS[c.reason]}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      });
    }

    return list;
  }, [cut.startedAt, cut.completedAt, cut.reason, canEdit, onStatusCommit]);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      {/* Left: file preview, height-matched to the field column (~3 rows). */}
      {cut.file ? (
        <div className="shrink-0" style={{ height: "8.5rem" }}>
          <FileItem file={cut.file} viewMode="grid" showActions onPreview={handlePreview} onDownload={handleDownload} className="w-44" />
        </div>
      ) : (
        <div
          className="flex shrink-0 flex-col items-center justify-center rounded-lg bg-muted/30 text-muted-foreground"
          style={{ height: "8.5rem", width: "11rem" }}
        >
          <IconFile className="mb-1 h-8 w-8 opacity-50" />
          <span className="text-xs">Sem arquivo</span>
        </div>
      )}

      {/* Right: inline-editable / badge fields. */}
      <div className="min-w-0 flex-1 space-y-2">
        {fields.map((f) => (
          <InlineEditField key={f.id} field={f} row={cut} editable={canEdit && !!f.edit} />
        ))}
      </div>
    </div>
  );
}
