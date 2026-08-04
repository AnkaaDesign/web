import { Badge } from "@/components/ui/badge";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import type { DataTableColumnDef } from "@/components/ui/datatable";
import type { BadgeProps } from "@/components/ui/badge";
import type { PaintingAnalysis, PaintingAnalysisStatus } from "../../../../types";
import { PAINTING_ANALYSIS_STATUS_LABELS, PAINTING_SERVICE_CONTEXT_LABELS } from "../../../../types";
import { formatCurrency, formatDate } from "../../../../utils";

const muted = (text: string) => <span className="text-sm text-muted-foreground whitespace-nowrap">{text}</span>;

export const PAINTING_ANALYSIS_STATUS_VARIANTS: Record<PaintingAnalysisStatus, BadgeProps["variant"]> = {
  DRAFT: "secondary",
  PROCESSING: "processing",
  REVIEW: "pending",
  APPROVED: "approved",
  ARCHIVED: "inactive",
  FAILED: "failed",
};

export function PaintingAnalysisStatusBadge({ status }: { status: PaintingAnalysisStatus }) {
  return (
    <Badge variant={PAINTING_ANALYSIS_STATUS_VARIANTS[status]} size="sm">
      {PAINTING_ANALYSIS_STATUS_LABELS[status]}
    </Badge>
  );
}

export function createPaintingBudgetColumns(): DataTableColumnDef<PaintingAnalysis>[] {
  return [
    {
      id: "name",
      header: "Nome",
      accessorFn: (row) => row.name,
      enableSorting: true,
      size: 260,
      minSize: 180,
      meta: { headerLabel: "Nome", exportValue: (row) => row.name },
      cell: ({ getValue }) => <TruncatedTextWithTooltip text={getValue() as string} className="text-sm font-medium" />,
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => row.status,
      enableSorting: true,
      size: 130,
      minSize: 110,
      meta: {
        headerLabel: "Status",
        exportValue: (row) => PAINTING_ANALYSIS_STATUS_LABELS[row.status],
      },
      cell: ({ row }) => <PaintingAnalysisStatusBadge status={row.original.status} />,
    },
    {
      id: "serviceContext",
      header: "Contexto",
      accessorFn: (row) => row.serviceContext,
      enableSorting: false,
      size: 110,
      minSize: 90,
      meta: {
        headerLabel: "Contexto",
        exportValue: (row) => PAINTING_SERVICE_CONTEXT_LABELS[row.serviceContext],
      },
      cell: ({ row }) => muted(PAINTING_SERVICE_CONTEXT_LABELS[row.original.serviceContext]),
    },
    {
      id: "faces",
      header: "Faces",
      accessorFn: (row) => row.faces?.length ?? 0,
      enableSorting: false,
      size: 80,
      minSize: 70,
      meta: {
        headerLabel: "Faces",
        align: "center",
        exportValue: (row) => String(row.faces?.length ?? 0),
      },
      cell: ({ getValue }) => <span className="text-sm tabular-nums">{getValue() as number}</span>,
    },
    {
      id: "totalDays",
      header: "Dias",
      accessorFn: (row) => row.plan?.totalDays ?? null,
      enableSorting: false,
      size: 80,
      minSize: 70,
      meta: {
        headerLabel: "Dias previstos",
        align: "center",
        exportValue: (row) => (row.plan ? String(row.plan.totalDays) : ""),
      },
      cell: ({ getValue }) => {
        const value = getValue() as number | null;
        return value ? <span className="text-sm tabular-nums">{value}</span> : muted("-");
      },
    },
    {
      id: "totalCost",
      header: "Custo Total",
      accessorFn: (row) => row.plan?.totalCost ?? null,
      enableSorting: false,
      size: 130,
      minSize: 110,
      meta: {
        headerLabel: "Custo total",
        align: "right",
        exportValue: (row) => (row.plan ? formatCurrency(Number(row.plan.totalCost ?? 0)) : ""),
      },
      cell: ({ getValue }) => {
        const value = getValue() as string | number | null;
        return value !== null ? (
          <span className="text-sm tabular-nums whitespace-nowrap">{formatCurrency(Number(value))}</span>
        ) : (
          muted("-")
        );
      },
    },
    {
      id: "suggestedPrice",
      header: "Preço Sugerido",
      accessorFn: (row) => row.plan?.suggestedPrice ?? null,
      enableSorting: false,
      size: 140,
      minSize: 120,
      meta: {
        headerLabel: "Preço sugerido",
        align: "right",
        exportValue: (row) => (row.plan ? formatCurrency(Number(row.plan.suggestedPrice ?? 0)) : ""),
      },
      cell: ({ getValue }) => {
        const value = getValue() as string | number | null;
        return value !== null ? (
          <span className="text-sm font-medium tabular-nums whitespace-nowrap">{formatCurrency(Number(value))}</span>
        ) : (
          muted("-")
        );
      },
    },
    {
      id: "createdAt",
      header: "Criado em",
      accessorFn: (row) => row.createdAt,
      enableSorting: true,
      size: 120,
      minSize: 100,
      meta: {
        headerLabel: "Criado em",
        exportValue: (row) => formatDate(row.createdAt),
      },
      cell: ({ getValue }) => muted(formatDate(getValue() as string)),
    },
  ];
}
