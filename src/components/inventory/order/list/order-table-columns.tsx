import React from "react";
import type { Order } from "../../../../types";
import { formatCurrency, formatDate } from "../../../../utils";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { Badge } from "@/components/ui/badge";
import { OrderStatusBadge } from "../common/order-status-badge";
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

export const createOrderColumns = (): OrderColumn[] => [
  {
    key: "description",
    header: "DESCRIÇÃO",
    accessor: (order) => <TruncatedTextWithTooltip text={order.description || "-"} className="text-sm" />,
    sortable: true,
    align: "left",
    className: cn("w-80", TABLE_LAYOUT.firstDataColumn.className),
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
    key: "status",
    header: "STATUS",
    accessor: (order) => <OrderStatusBadge status={order.status} />,
    sortable: true,
    align: "left",
    className: "w-44",
  },
  {
    key: "itemCount",
    header: "ITENS",
    accessor: (order) => {
      const itemCount = order._count?.items ?? 0;
      return (
        <Badge variant="secondary" className="font-tabular-nums">
          {itemCount} {itemCount === 1 ? "item" : "itens"}
        </Badge>
      );
    },
    sortable: false,
    align: "left",
    className: "w-24",
  },
  {
    key: "total",
    header: "VALOR TOTAL",
    accessor: (order) => {
      if (order.items && order.items.length > 0) {
        const total = order.items.reduce((sum, item) => {
          const quantity = item.orderedQuantity || 0;
          const price = item.price || 0;
          const tax = item.tax || 0;
          const itemTotal = quantity * price * (1 + tax / 100);
          return sum + itemTotal;
        }, 0);
        return <span className="text-sm font-medium tabular-nums">{formatCurrency(total)}</span>;
      }
      return <span className="text-sm text-muted-foreground">-</span>;
    },
    sortable: false,
    align: "left",
    className: "w-36",
  },
  {
    key: "forecast",
    header: "PREVISÃO",
    accessor: (order) => <span className="text-sm text-muted-foreground whitespace-nowrap">{order.forecast ? formatDate(order.forecast) : "-"}</span>,
    sortable: true,
    align: "left",
    className: "w-32",
  },
  {
    key: "createdAt",
    header: "CRIADO EM",
    accessor: (order) => <span className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(order.createdAt)}</span>,
    sortable: true,
    align: "left",
    className: "w-32",
  },
];

// Default visible columns
export const getDefaultVisibleColumns = (): Set<string> => {
  return new Set(["description", "supplier.fantasyName", "status", "itemCount", "total", "forecast"]);
};
