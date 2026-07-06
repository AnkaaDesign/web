import type { Airbrushing } from "../../../../types";
import {
  SECTOR_PRIVILEGES,
  AIRBRUSHING_STATUS_LABELS,
  AIRBRUSHING_PAYMENT_STATUS_LABELS,
  ENTITY_BADGE_CONFIG,
} from "../../../../constants";
import { formatCurrency, formatDate } from "../../../../utils";
import { AIRBRUSHING_FINANCE_PRIVILEGES } from "@/utils/permissions/entity-permissions";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { Badge } from "@/components/ui/badge";
import type { DataTableColumnDef } from "@/components/ui/datatable";

/**
 * Sectors allowed to see monetary / payment data on an airbrushing (Aerografia).
 * This is the CANONICAL money-visibility gate (`AIRBRUSHING_FINANCE_PRIVILEGES` =
 * FINANCIAL, ACCOUNTING, ADMIN, COMMERCIAL) spread into a mutable array so it can be
 * used as a `meta.requiredPrivilege` on the `price` / `paymentStatus` columns and the
 * `priceRange` / payment-status filters. The DataTable removes a gated column ENTIRELY
 * (header, cells, picker option, AND export) for non-viewers. ADMIN always passes.
 */
export const AIRBRUSHING_MONEY_VIEWERS: SECTOR_PRIVILEGES[] = [...AIRBRUSHING_FINANCE_PRIVILEGES];

const muted = (text: string) => <span className="text-sm text-muted-foreground whitespace-nowrap">{text}</span>;

/** The airbrushing-list column set as generic `DataTableColumnDef`s for the new DataTable. */
export function createAirbrushingColumns(): DataTableColumnDef<Airbrushing>[] {
  return [
    {
      // Dot-free id: the column id feeds a `--col-<id>-size` CSS custom property, and a dot is an
      // invalid custom-property ident — a dotted id silently breaks this column's width/resize var.
      id: "taskName",
      header: "Tarefa",
      accessorFn: (row) => row.task?.name || "",
      enableSorting: true,
      size: 300,
      minSize: 200,
      meta: { headerLabel: "Tarefa", exportValue: (row) => row.task?.name || "" },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <TruncatedTextWithTooltip text={v} className="text-sm font-medium" /> : muted("-");
      },
    },
    {
      id: "customer",
      header: "Cliente",
      accessorFn: (row) => row.task?.customer?.fantasyName || "",
      enableSorting: true,
      size: 180,
      minSize: 140,
      meta: { headerLabel: "Cliente", exportValue: (row) => row.task?.customer?.fantasyName || "" },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <TruncatedTextWithTooltip text={v} className="text-sm" /> : muted("-");
      },
    },
    {
      id: "painter",
      header: "Pintor",
      accessorFn: (row) => row.painter?.name || "",
      enableSorting: true,
      size: 150,
      minSize: 120,
      meta: { headerLabel: "Pintor", exportValue: (row) => row.painter?.name || "" },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <TruncatedTextWithTooltip text={v} className="text-sm" /> : muted("—");
      },
    },
    {
      // Sorts by the numeric `statusOrder` mirror, renders the badge.
      id: "status",
      header: "Status",
      accessorFn: (row) => row.statusOrder,
      enableSorting: true,
      size: 140,
      minSize: 120,
      meta: { headerLabel: "Status", exportValue: (row) => AIRBRUSHING_STATUS_LABELS[row.status] || row.status },
      cell: ({ row }) => (
        <Badge variant={ENTITY_BADGE_CONFIG.AIRBRUSHING[row.original.status] || "default"} className="whitespace-nowrap">
          {AIRBRUSHING_STATUS_LABELS[row.original.status] || row.original.status}
        </Badge>
      ),
    },
    {
      // Financial info — gated to AIRBRUSHING_MONEY_VIEWERS (same gate as `price`).
      id: "paymentStatus",
      header: "Pagamento",
      accessorKey: "paymentStatus",
      enableSorting: true,
      size: 140,
      minSize: 120,
      meta: {
        headerLabel: "Pagamento",
        requiredPrivilege: AIRBRUSHING_MONEY_VIEWERS,
        exportValue: (row) => AIRBRUSHING_PAYMENT_STATUS_LABELS[row.paymentStatus] || row.paymentStatus,
      },
      cell: ({ row }) => (
        <Badge variant={ENTITY_BADGE_CONFIG.AIRBRUSHING_PAYMENT[row.original.paymentStatus] || "default"} className="whitespace-nowrap">
          {AIRBRUSHING_PAYMENT_STATUS_LABELS[row.original.paymentStatus] || row.original.paymentStatus}
        </Badge>
      ),
    },
    {
      id: "price",
      header: "Preço",
      accessorFn: (row) => row.price ?? -1,
      enableSorting: true,
      size: 120,
      minSize: 110,
      meta: {
        headerLabel: "Preço",
        align: "right",
        requiredPrivilege: AIRBRUSHING_MONEY_VIEWERS,
        exportValue: (row) => (row.price != null ? row.price : ""),
      },
      cell: ({ row }) =>
        row.original.price != null ? (
          <span className="text-sm font-medium tabular-nums">{formatCurrency(row.original.price)}</span>
        ) : (
          muted("—")
        ),
    },
    {
      id: "startDate",
      header: "Início Previsto",
      accessorKey: "startDate",
      enableSorting: true,
      size: 130,
      minSize: 110,
      meta: { headerLabel: "Início Previsto", exportValue: (row) => (row.startDate ? formatDate(row.startDate) : "") },
      cell: ({ row }) => muted(row.original.startDate ? formatDate(row.original.startDate) : "—"),
    },
    {
      id: "finishDate",
      header: "Término Previsto",
      accessorKey: "finishDate",
      enableSorting: true,
      size: 140,
      minSize: 110,
      meta: { headerLabel: "Término Previsto", exportValue: (row) => (row.finishDate ? formatDate(row.finishDate) : "") },
      cell: ({ row }) => muted(row.original.finishDate ? formatDate(row.original.finishDate) : "—"),
    },
    {
      id: "startedAt",
      header: "Iniciado em",
      accessorKey: "startedAt",
      enableSorting: true,
      size: 150,
      minSize: 120,
      meta: { defaultVisible: false, headerLabel: "Iniciado em", exportValue: (row) => (row.startedAt ? formatDate(row.startedAt) : "") },
      cell: ({ row }) => muted(row.original.startedAt ? formatDate(row.original.startedAt) : "—"),
    },
    {
      id: "finishedAt",
      header: "Finalizado em",
      accessorKey: "finishedAt",
      enableSorting: true,
      size: 150,
      minSize: 120,
      meta: { defaultVisible: false, headerLabel: "Finalizado em", exportValue: (row) => (row.finishedAt ? formatDate(row.finishedAt) : "") },
      cell: ({ row }) => muted(row.original.finishedAt ? formatDate(row.original.finishedAt) : "—"),
    },
    {
      id: "createdAt",
      header: "Criado em",
      accessorKey: "createdAt",
      enableSorting: true,
      size: 130,
      minSize: 110,
      meta: { defaultVisible: false, headerLabel: "Criado em", exportValue: (row) => formatDate(row.createdAt) },
      cell: ({ row }) => muted(formatDate(row.original.createdAt)),
    },
  ];
}
