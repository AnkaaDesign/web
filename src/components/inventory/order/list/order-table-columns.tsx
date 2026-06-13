import React from "react";
import type { Order } from "../../../../types";
import { formatCurrency, formatDate } from "../../../../utils";
import { formatOrderNumber } from "@/utils/order-code";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { Badge } from "@/components/ui/badge";
import { OrderStatusBadge } from "../common/order-status-badge";
import { OrderPaymentStatusBadge } from "../common/order-payment-status-badge";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";
import { cn } from "@/lib/utils";

// Define column interface directly to avoid import issues
export interface OrderColumn {
  key: string;
  header: string;
  accessor: (order: Order) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

export const createOrderColumns = (canViewPrices: boolean = true): OrderColumn[] => {
  const columns: OrderColumn[] = [
  {
    key: "orderNumber",
    header: "Nº",
    accessor: (order) => (
      <span className="text-sm font-medium tabular-nums">
        {order.orderNumber != null ? formatOrderNumber(order.orderNumber) : "—"}
      </span>
    ),
    sortable: true,
    align: "left",
    className: "w-20",
  },
  {
    key: "description",
    header: "DESCRIÇÃO",
    accessor: (order) => <TruncatedTextWithTooltip text={order.description || "-"} className="text-sm" />,
    sortable: true,
    align: "left",
    className: cn("w-auto min-w-[28rem]", TABLE_LAYOUT.firstDataColumn.className),
  },
  {
    key: "supplier.fantasyName",
    header: "FORNECEDOR",
    accessor: (order) => <TruncatedTextWithTooltip text={order.supplier?.fantasyName || "-"} className="text-sm" />,
    sortable: true,
    align: "left",
    className: "w-56",
  },
  {
    key: "statusOrder",
    header: "STATUS",
    accessor: (order) => <OrderStatusBadge status={order.status} />,
    sortable: true,
    align: "left",
    className: "w-44",
  },
  {
    // Optional column (not in the curated default set) — sorts by the numeric
    // paymentStatusOrder mirror, same pattern as statusOrder.
    key: "paymentStatusOrder",
    header: "PAGAMENTO",
    accessor: (order) => <OrderPaymentStatusBadge status={order.paymentStatus} />,
    sortable: true,
    align: "left",
    className: "w-48",
  },
  {
    key: "itemCount",
    header: "ITENS",
    accessor: (order) => {
      const itemCount = order._count?.items ?? 0;
      return (
        <Badge variant="default" className="w-10 justify-center">
          {itemCount}
        </Badge>
      );
    },
    sortable: false,
    align: "center",
    className: "w-20",
  },
  {
    key: "total",
    header: "VALOR TOTAL",
    accessor: (order) => {
      if (order.items && order.items.length > 0) {
        const total = order.items.reduce((sum, item) => {
          const quantity = item.orderedQuantity || 0;
          const price = item.price || 0;
          const icms = item.icms || 0;
          const ipi = item.ipi || 0;
          const subtotal = quantity * price;
          const icmsAmount = subtotal * (icms / 100);
          const ipiAmount = subtotal * (ipi / 100);
          const itemTotal = subtotal + icmsAmount + ipiAmount;
          return sum + itemTotal;
        }, 0);
        return <span className="text-sm font-medium tabular-nums">{formatCurrency(total)}</span>;
      }
      return <span className="text-sm text-muted-foreground">-</span>;
    },
    sortable: false,
    align: "left",
    className: "w-28",
  },
  {
    key: "forecast",
    header: "PREVISÃO",
    accessor: (order) => <span className="text-sm text-muted-foreground whitespace-nowrap">{order.forecast ? formatDate(order.forecast) : "-"}</span>,
    sortable: true,
    align: "left",
    className: "w-24",
  },
  {
    key: "paymentRequestedAt",
    header: "PAG. SOLICITADO EM",
    accessor: (order) => (
      <span className="text-sm text-muted-foreground whitespace-nowrap">{order.paymentRequestedAt ? formatDate(order.paymentRequestedAt) : "-"}</span>
    ),
    sortable: true,
    align: "left",
    className: "w-28",
  },
  {
    key: "paidAt",
    header: "PAGO EM",
    accessor: (order) => <span className="text-sm text-muted-foreground whitespace-nowrap">{order.paidAt ? formatDate(order.paidAt) : "-"}</span>,
    sortable: true,
    align: "left",
    className: "w-24",
  },
  {
    key: "createdAt",
    header: "CRIADO EM",
    accessor: (order) => <span className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(order.createdAt)}</span>,
    sortable: true,
    align: "left",
    className: "w-24",
  },
  ];
  return columns.filter((column) => canViewPrices || column.key !== "total");
};

// Default visible columns
export const getDefaultVisibleColumns = (canViewPrices: boolean = true): Set<string> => {
  const base = ["orderNumber", "description", "supplier.fantasyName", "statusOrder", "itemCount", "total", "forecast"];
  return new Set(base.filter((key) => canViewPrices || key !== "total"));
};
