import { format, isToday, isYesterday } from "date-fns";
import { IconFileOff, IconScissors } from "@tabler/icons-react";
import type { Cut } from "../../../../types";
import { CUT_STATUS_LABELS, CUT_REQUEST_REASON_LABELS, CUT_ORIGIN_LABELS, CUT_TYPE_LABELS, getBadgeVariant } from "../../../../constants";
import { CUT_ORIGIN } from "../../../../constants";
import { Badge } from "@/components/ui/badge";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import type { CutColumn } from "./types";

// Helper functions
const formatDateDisplay = (dateString: string | Date | null) => {
  if (!dateString) return "-";

  const date = new Date(dateString);

  if (isToday(date)) {
    return format(date, "HH:mm");
  } else if (isYesterday(date)) {
    return "Ontem";
  } else {
    return format(date, "dd/MM");
  }
};

const getTaskName = (item: Cut) => {
  if (item.task?.name) {
    return item.task.name;
  }
  return "-";
};

const getSourceType = (item: Cut) => {
  return CUT_ORIGIN_LABELS[item.origin];
};

const getReason = (item: Cut) => {
  if (item.reason) {
    return CUT_REQUEST_REASON_LABELS[item.reason];
  }
  return item.origin === CUT_ORIGIN.PLAN ? "Plano de corte" : "Solicitação";
};

const getThumbnailUrl = (file: any) => {
  const apiUrl = (window as any).__ANKAA_API_URL__ || (import.meta as any).env?.VITE_API_URL || "http://localhost:3030";
  return `${apiUrl}/files/thumbnail/${file.id}?size=small`;
};

export const createCutColumns = (): CutColumn[] => [
  {
    key: "filePreview",
    header: "ARQUIVO",
    accessor: (item: Cut) => (
      <div className="flex items-center justify-center">
        {item.file ? (
          <div className="w-12 h-12 rounded-md overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all">
            <img src={getThumbnailUrl(item.file)} alt={item.file.filename} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-md bg-muted/20 flex items-center justify-center">
            <IconFileOff className="w-5 h-5 text-muted-foreground/50" />
          </div>
        )}
      </div>
    ),
    sortable: false,
    className: "w-20",
    align: "center",
  },
  {
    key: "fileName",
    header: "NOME DO ARQUIVO",
    accessor: (item: Cut) => (
      <div className="px-4 py-2">
        <TruncatedTextWithTooltip text={item.file?.filename || "-"} className="text-sm" />
      </div>
    ),
    sortable: false,
    className: "w-48",
    align: "left",
  },
  {
    key: "task.name",
    header: "TAREFA",
    accessor: (item: Cut) => (
      <div className="px-4 py-2">
        <TruncatedTextWithTooltip text={getTaskName(item)} className="font-medium" />
      </div>
    ),
    sortable: true,
    className: "w-48",
    align: "left",
  },
  {
    key: "status",
    header: "STATUS",
    accessor: (item: Cut) => (
      <div className="px-4 py-2">
        <Badge variant={getBadgeVariant(item.status, "CUT")}>
          {CUT_STATUS_LABELS[item.status]}
        </Badge>
      </div>
    ),
    sortable: true,
    className: "w-28",
    align: "left",
  },
  {
    key: "type",
    header: "TIPO",
    accessor: (item: Cut) => (
      <div className="px-4 py-2">
        {item.type ? (
          <div className="flex items-center gap-2">
            <IconScissors className="h-4 w-4 text-muted-foreground" />
            <span>{CUT_TYPE_LABELS[item.type]}</span>
          </div>
        ) : (
          "-"
        )}
      </div>
    ),
    sortable: false,
    className: "w-32",
    align: "left",
  },
  {
    key: "origin",
    header: "ORIGEM",
    accessor: (item: Cut) => (
      <div className="px-4 py-2">
        <Badge variant="outline">{getSourceType(item)}</Badge>
      </div>
    ),
    sortable: false,
    className: "w-32",
    align: "left",
  },
  {
    key: "reason",
    header: "MOTIVO",
    accessor: (item: Cut) => (
      <div className="px-4 py-2">
        <TruncatedTextWithTooltip text={getReason(item)} />
      </div>
    ),
    sortable: false,
    className: "w-48",
    align: "left",
  },
  {
    key: "startedAt",
    header: "INICIADO EM",
    accessor: (item: Cut) => <div className="px-4 py-2 text-sm">{formatDateDisplay(item.startedAt)}</div>,
    sortable: true,
    className: "w-32",
    align: "left",
  },
  {
    key: "completedAt",
    header: "FINALIZADO EM",
    accessor: (item: Cut) => <div className="px-4 py-2 text-sm">{formatDateDisplay(item.completedAt)}</div>,
    sortable: true,
    className: "w-32",
    align: "left",
  },
];
