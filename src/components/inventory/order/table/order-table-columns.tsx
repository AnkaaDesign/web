import type { Order, OrderItem } from "../../../../types";
import { SECTOR_PRIVILEGES, ORDER_STATUS_LABELS, ORDER_PAYMENT_STATUS_LABELS } from "../../../../constants";
import { formatCurrency, formatDate } from "../../../../utils";
import { formatOrderNumber } from "@/utils/order-code";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { Badge } from "@/components/ui/badge";
import { OrderStatusBadge } from "../common/order-status-badge";
import { OrderPaymentStatusBadge } from "../common/order-payment-status-badge";
import type { DataTableColumnDef, PersistedTableConfig, SectorDefaults } from "@/components/ui/datatable";

/**
 * Sectors allowed to see monetary / payment data. Mirrors the legacy `canViewPrices`
 * (everyone EXCEPT warehouse — and ADMIN always passes in the DataTable gate). Used to
 * gate the "Valor Total" + "Pagamento" columns and the payment-status filter exactly as
 * the old list hid them from WAREHOUSE.
 */
export const ORDER_PRICE_VIEWERS = (Object.values(SECTOR_PRIVILEGES) as SECTOR_PRIVILEGES[]).filter(
  (p) => p !== SECTOR_PRIVILEGES.WAREHOUSE,
);

/** Order total: the manual `totalOverride` when set, else Σ items (qty × price, plus ICMS & IPI). */
export function computeOrderTotal(order: Order): number {
  // A manual override always wins — show it everywhere, never the computed value.
  if (typeof order.totalOverride === "number") return order.totalOverride;
  const items: OrderItem[] = order.items ?? [];
  if (items.length === 0) return 0;
  return items.reduce((sum, item) => {
    const quantity = item.orderedQuantity || 0;
    const price = item.price || 0;
    const icms = item.icms || 0;
    const ipi = item.ipi || 0;
    const subtotal = quantity * price;
    const itemTotal = subtotal + subtotal * (icms / 100) + subtotal * (ipi / 100);
    return sum + itemTotal;
  }, 0);
}

const muted = (text: string) => <span className="text-sm text-muted-foreground whitespace-nowrap">{text}</span>;

/** Every order-table column id, in authoring order — the basis for the per-sector default layout below. */
const ALL_ORDER_COLUMN_IDS = [
  "orderNumber",
  "description",
  "supplier",
  "status",
  "paymentStatus",
  "itemCount",
  "total",
  "forecast",
  "paidAt",
  "createdAt",
  // Export-only audit columns (hidden by default) — listed here so the ADMIN sector default explicitly
  // keeps them hidden too.
  "notes",
  "updatedAt",
  "id",
] as const;

/** Build a full table config (visibility + order) showing exactly `visible` (in that order). */
function sectorConfig(visible: string[]): Partial<PersistedTableConfig> {
  const columnVisibility: Record<string, boolean> = {};
  for (const id of ALL_ORDER_COLUMN_IDS) columnVisibility[id] = visible.includes(id);
  return {
    columnOrder: [...visible, ...ALL_ORDER_COLUMN_IDS.filter((id) => !visible.includes(id))],
    columnVisibility,
  };
}

/**
 * Per-sector STARTING column layout. The hardcoded `meta.defaultVisible` below already reproduces the
 * legacy default for non-admins (orderNumber, description, supplier, status, itemCount, total, forecast —
 * with total/payment gated out for WAREHOUSE). ADMIN additionally saw the "Pagamento" column by default
 * (legacy `getDefaultVisibleColumns(canViewPrices, isAdmin)`), so it gets an explicit entry here.
 */
export const ORDER_SECTOR_DEFAULTS: SectorDefaults = {
  [SECTOR_PRIVILEGES.ADMIN]: sectorConfig([
    "orderNumber",
    "description",
    "supplier",
    "status",
    "paymentStatus",
    "itemCount",
    "total",
    "forecast",
  ]),
};

/** The order-list column set as generic `DataTableColumnDef`s for the new DataTable. */
export function createOrderColumns(): DataTableColumnDef<Order>[] {
  return [
    {
      id: "orderNumber",
      header: "Nº",
      accessorFn: (row) => row.orderNumber ?? -1,
      enableSorting: true,
      size: 90,
      minSize: 70,
      meta: {
        headerLabel: "Nº",
        exportValue: (row) => (row.orderNumber != null ? formatOrderNumber(row.orderNumber) : ""),
      },
      cell: ({ row }) => (
        <span className="text-sm font-medium tabular-nums">
          {row.original.orderNumber != null ? formatOrderNumber(row.original.orderNumber) : "—"}
        </span>
      ),
    },
    {
      id: "description",
      header: "Descrição",
      accessorKey: "description",
      enableSorting: true,
      size: 460,
      minSize: 280,
      meta: { headerLabel: "Descrição", exportValue: (row) => row.description || "" },
      cell: ({ getValue }) => <TruncatedTextWithTooltip text={(getValue() as string) || "-"} className="text-sm" />,
    },
    {
      id: "supplier",
      header: "Fornecedor",
      accessorFn: (row) => row.supplier?.fantasyName || "",
      enableSorting: true,
      size: 224,
      minSize: 160,
      meta: { headerLabel: "Fornecedor", exportValue: (row) => row.supplier?.fantasyName || "" },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <TruncatedTextWithTooltip text={v} className="text-sm" /> : muted("-");
      },
    },
    {
      // Sorts by the numeric `statusOrder` mirror (legacy "statusOrder" sort key), renders the badge.
      id: "status",
      header: "Status",
      accessorFn: (row) => row.statusOrder,
      enableSorting: true,
      size: 176,
      minSize: 120,
      meta: { headerLabel: "Status", exportValue: (row) => ORDER_STATUS_LABELS[row.status] || row.status },
      cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
    },
    {
      // Financial info — gated from WAREHOUSE (same flag as "total"). Sorts by `paymentStatusOrder`.
      id: "paymentStatus",
      header: "Pagamento",
      accessorFn: (row) => row.paymentStatusOrder,
      enableSorting: true,
      size: 192,
      minSize: 130,
      meta: {
        defaultVisible: false,
        headerLabel: "Pagamento",
        requiredPrivilege: ORDER_PRICE_VIEWERS,
        exportValue: (row) => ORDER_PAYMENT_STATUS_LABELS[row.paymentStatus] || row.paymentStatus,
      },
      cell: ({ row }) => <OrderPaymentStatusBadge status={row.original.paymentStatus} paymentMethod={row.original.paymentMethod} />,
    },
    {
      id: "itemCount",
      header: "Itens",
      accessorFn: (row) => row._count?.items ?? row.items?.length ?? 0,
      enableSorting: false,
      size: 80,
      minSize: 70,
      meta: { headerLabel: "Itens", align: "center", exportValue: (row) => row._count?.items ?? row.items?.length ?? 0 },
      cell: ({ getValue }) => (
        <Badge variant="default" className="w-10 justify-center">
          {(getValue() as number) ?? 0}
        </Badge>
      ),
    },
    {
      id: "total",
      header: "Valor Total",
      accessorFn: (row) => computeOrderTotal(row),
      enableSorting: false,
      size: 144,
      minSize: 110,
      meta: {
        headerLabel: "Valor Total",
        requiredPrivilege: ORDER_PRICE_VIEWERS,
        exportValue: (row) => (row.items && row.items.length > 0 ? computeOrderTotal(row) : ""),
      },
      cell: ({ row }) =>
        row.original.items && row.original.items.length > 0 ? (
          <span className="text-sm font-medium tabular-nums">{formatCurrency(computeOrderTotal(row.original))}</span>
        ) : (
          muted("-")
        ),
    },
    {
      id: "forecast",
      header: "Previsão",
      accessorKey: "forecast",
      enableSorting: true,
      size: 120,
      minSize: 100,
      meta: { headerLabel: "Previsão", exportValue: (row) => (row.forecast ? formatDate(row.forecast) : "") },
      cell: ({ row }) => muted(row.original.forecast ? formatDate(row.original.forecast) : "-"),
    },
    {
      id: "paidAt",
      header: "Pago em",
      accessorKey: "paidAt",
      enableSorting: true,
      size: 120,
      minSize: 100,
      // Payment date is financial info → gated from WAREHOUSE, same as `total`/`paymentStatus` (and
      // the detail's payment section). Without this a warehouse user could re-enable "Pago em".
      meta: { defaultVisible: false, requiredPrivilege: ORDER_PRICE_VIEWERS, headerLabel: "Pago em", exportValue: (row) => (row.paidAt ? formatDate(row.paidAt) : "") },
      cell: ({ row }) => muted(row.original.paidAt ? formatDate(row.original.paidAt) : "-"),
    },
    {
      id: "createdAt",
      header: "Criado em",
      accessorKey: "createdAt",
      enableSorting: true,
      size: 120,
      minSize: 100,
      meta: { defaultVisible: false, headerLabel: "Criado em", exportValue: (row) => formatDate(row.createdAt) },
      cell: ({ row }) => muted(formatDate(row.original.createdAt)),
    },
    // --- Export-only audit columns (hidden by default; selectable in the share dialog) ---
    // Restore the legacy OrderExport's OBSERVAÇÕES / FINALIZADO EM / CÓDIGO fields so audit exports stay
    // complete without cluttering the visible table.
    {
      id: "notes",
      header: "Observações",
      accessorFn: (row) => row.notes ?? "",
      enableSorting: false,
      size: 240,
      minSize: 160,
      meta: { defaultVisible: false, headerLabel: "Observações", exportHeader: "Observações", exportValue: (row) => row.notes || "" },
      cell: ({ row }) => (row.original.notes ? <TruncatedTextWithTooltip text={row.original.notes} className="text-sm" /> : muted("-")),
    },
    {
      id: "updatedAt",
      header: "Finalizado em",
      accessorKey: "updatedAt",
      enableSorting: true,
      size: 120,
      minSize: 100,
      meta: { defaultVisible: false, headerLabel: "Finalizado em", exportHeader: "Finalizado em", exportValue: (row) => (row.updatedAt ? formatDate(row.updatedAt) : "") },
      cell: ({ row }) => muted(row.original.updatedAt ? formatDate(row.original.updatedAt) : "-"),
    },
    {
      id: "id",
      header: "Código",
      accessorKey: "id",
      enableSorting: false,
      size: 220,
      minSize: 140,
      meta: { defaultVisible: false, headerLabel: "Código", exportHeader: "Código", exportValue: (row) => row.id },
      cell: ({ row }) => <span className="text-sm font-mono tabular-nums">{row.original.id}</span>,
    },
  ];
}
