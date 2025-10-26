import React from "react";
import type { Activity } from "../../../../types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ACTIVITY_REASON_LABELS, ACTIVITY_OPERATION_LABELS, ACTIVITY_OPERATION } from "../../../../constants";

// Custom date formatter for hh:mm - dd/mm/yy
function formatActivityDate(date: Date | string | null | undefined): string {
  if (!date) return "Data inválida";

  const d = typeof date === "string" ? new Date(date) : date;
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return "Data inválida";

  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);

  return `${hours}:${minutes} - ${day}/${month}/${year}`;
}

// Format quantity with 2 decimals only if needed
function formatQuantity(value: number): string {
  // Check if the number has decimals
  if (value % 1 === 0) {
    return value.toString();
  }
  // Format with 2 decimals and use pt-BR locale
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface ActivityColumn {
  key: string;
  header: string;
  accessor: (activity: Activity) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

export function getActivityColumns(): ActivityColumn[] {
  return [
    {
      key: "item.uniCode",
      header: "CÓDIGO",
      accessor: (activity) => {
        if (!activity.item) {
          return <span className="text-sm text-muted-foreground">-</span>;
        }
        return <div className="text-sm truncate max-w-full">{activity.item.uniCode || "-"}</div>;
      },
      sortable: true,
      className: "w-28",
    },
    {
      key: "item.name",
      header: "ITEM",
      accessor: (activity) => {
        if (!activity.item) {
          return <span className="text-sm text-muted-foreground">-</span>;
        }
        return <div className="text-sm font-medium truncate">{activity.item.name}</div>;
      },
      sortable: true,
      className: "w-52",
    },
    {
      key: "operation",
      header: "OPERAÇÃO",
      accessor: (activity) => (
        <Badge
          className={cn(
            "text-xs font-medium border text-white whitespace-nowrap inline-flex items-center gap-1 max-w-full",
            activity.operation === ACTIVITY_OPERATION.INBOUND ? "bg-green-700 hover:bg-green-800 border-green-700" : "bg-red-700 hover:bg-red-800 border-red-700",
          )}
        >
          <span className="font-enhanced-unicode sort-arrow shrink-0">{activity.operation === ACTIVITY_OPERATION.INBOUND ? "↑" : "↓"}</span>
          <span className="truncate">{activity.operation ? ACTIVITY_OPERATION_LABELS[activity.operation] : "-"}</span>
        </Badge>
      ),
      sortable: true,
      className: "w-32",
      align: "left",
    },
    {
      key: "quantity",
      header: "QNT",
      accessor: (activity) => (
        <span
          className={cn(
            "text-sm font-medium tabular-nums",
            activity.operation === ACTIVITY_OPERATION.INBOUND ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400",
          )}
        >
          {activity.operation === ACTIVITY_OPERATION.INBOUND ? "+" : "-"}
          {formatQuantity(Math.abs(activity.quantity))}
        </span>
      ),
      sortable: true,
      className: "w-24",
      align: "left",
    },
    {
      key: "user.name",
      header: "USUÁRIO",
      accessor: (activity) => {
        if (!activity.user) {
          return <span className="text-sm text-muted-foreground">Sistema</span>;
        }
        return <div className="text-sm truncate">{activity.user.name}</div>;
      },
      sortable: true,
      className: "w-40",
    },
    {
      key: "reason",
      header: "MOTIVO",
      accessor: (activity) => (
        <Badge variant="secondary" className="text-xs font-medium max-w-full truncate" title={activity.reason ? ACTIVITY_REASON_LABELS[activity.reason] : "-"}>
          {activity.reason ? ACTIVITY_REASON_LABELS[activity.reason] : "-"}
        </Badge>
      ),
      sortable: true,
      className: "w-56",
      align: "left",
    },
    {
      key: "createdAt",
      header: "DATA",
      accessor: (activity) => <div className="text-sm">{formatActivityDate(activity.createdAt)}</div>,
      sortable: true,
      className: "w-44",
      align: "left",
    },
  ];
}

export function getDefaultVisibleColumns(): Set<string> {
  return new Set(["item.uniCode", "item.name", "operation", "quantity", "user.name", "reason", "createdAt"]);
}
