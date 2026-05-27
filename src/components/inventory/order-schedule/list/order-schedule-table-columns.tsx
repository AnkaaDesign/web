import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { IconCalendar, IconClock, IconPackage } from "@tabler/icons-react";
import { getScheduleCadenceLabel } from "../../../../constants";
import { formatCurrency } from "../../../../utils";
import { cn } from "@/lib/utils";
import type { OrderSchedule } from "../../../../types";

/**
 * Extra render-time context passed to every column accessor so columns whose
 * value comes from a separate batch request (e.g. the expected-price column)
 * can read it without each row triggering its own fetch.
 */
export interface OrderScheduleColumnContext {
  // schedule id -> projected total order cost on its next scheduled date
  expectedTotals?: Map<string, number>;
  expectedTotalsLoading?: boolean;
}

export interface OrderScheduleColumn {
  key: string;
  header: string;
  accessor: (schedule: OrderSchedule, ctx?: OrderScheduleColumnContext) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

export function createOrderScheduleColumns(): OrderScheduleColumn[] {
  return [
    {
      key: "name",
      header: "Nome",
      accessor: (schedule: OrderSchedule) => (
        <div className="font-medium truncate">{schedule.name || "-"}</div>
      ),
      sortable: true,
      className: "w-48",
      align: "left",
    },
    {
      key: "description",
      header: "Descrição",
      accessor: (schedule: OrderSchedule) => (
        <div className="truncate text-muted-foreground">{schedule.description || "-"}</div>
      ),
      sortable: false,
      className: "w-64",
      align: "left",
    },
    {
      key: "frequency",
      header: "Frequência",
      accessor: (schedule: OrderSchedule) => {
        // Show base label + detail when available: "Mensal — toda primeira quinta-feira"
        const label = getScheduleCadenceLabel(schedule.frequency, schedule.frequencyCount, {
          dayOfMonth: schedule.dayOfMonth as any,
          dayOfWeek: schedule.dayOfWeek as any,
          month: schedule.month as any,
          monthlyConfig: (schedule as any).monthlyConfig ?? null,
          weeklyConfig: (schedule as any).weeklyConfig ?? null,
          yearlyConfig: (schedule as any).yearlyConfig ?? null,
        });
        return <span className="font-medium">{label}</span>;
      },
      sortable: true,
      className: "w-64",
      align: "left",
    },
    {
      key: "itemsCount",
      header: "Itens",
      accessor: (schedule: OrderSchedule) => (
        <div className="flex items-center gap-2">
          <IconPackage className="h-4 w-4 text-muted-foreground" />
          <span>{schedule.items?.length || 0}</span>
        </div>
      ),
      sortable: false,
      className: "w-20",
      align: "left",
    },
    {
      key: "expectedTotal",
      header: "Preço esperado",
      accessor: (schedule: OrderSchedule, ctx?: OrderScheduleColumnContext) => {
        const value = ctx?.expectedTotals?.get(schedule.id);
        if (value === undefined) {
          // Subtle skeleton while the batch request is in-flight, otherwise an em dash.
          return ctx?.expectedTotalsLoading ? (
            <div className={cn("ml-auto h-4 w-20 animate-pulse rounded bg-muted")} />
          ) : (
            <span className="text-muted-foreground">—</span>
          );
        }
        return <span className="tabular-nums font-medium">{formatCurrency(value)}</span>;
      },
      sortable: false,
      className: "w-32",
      align: "right",
    },
    {
      key: "nextRun",
      header: "Próxima Execução",
      accessor: (schedule: OrderSchedule) => {
        if (!schedule.nextRun) {
          return <span className="text-muted-foreground text-sm">Não agendada</span>;
        }
        const date = typeof schedule.nextRun === "string" ? new Date(schedule.nextRun) : schedule.nextRun;
        return (
          <div className="flex items-center gap-2">
            <IconCalendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{format(date, "dd/MM/yyyy", { locale: ptBR })}</span>
          </div>
        );
      },
      sortable: true,
      className: "w-36",
      align: "left",
    },
    {
      key: "lastRun",
      header: "Última Execução",
      accessor: (schedule: OrderSchedule) => {
        if (!schedule.lastRun) {
          return <span className="text-muted-foreground text-sm">Nunca executado</span>;
        }
        const date = typeof schedule.lastRun === "string" ? new Date(schedule.lastRun) : schedule.lastRun;
        return (
          <div className="flex items-center gap-2">
            <IconClock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{format(date, "dd/MM/yyyy", { locale: ptBR })}</span>
          </div>
        );
      },
      sortable: true,
      className: "w-36",
      align: "left",
    },
    {
      key: "createdAt",
      header: "Criado em",
      accessor: (schedule: OrderSchedule) => (
        <div className="text-sm text-muted-foreground">
          {format(new Date(schedule.createdAt), "dd/MM/yyyy", { locale: ptBR })}
        </div>
      ),
      sortable: true,
      className: "w-28",
      align: "left",
    },
    {
      key: "isActive",
      header: "Status",
      accessor: (schedule: OrderSchedule) => (
        <Badge variant={schedule.isActive ? "active" : "destructive"}>
          {schedule.isActive ? "Ativo" : "Inativo"}
        </Badge>
      ),
      sortable: true,
      className: "w-24",
      align: "left",
    },
  ];
}

// Default visible columns
export function getDefaultVisibleColumns(): Set<string> {
  return new Set(["name", "frequency", "itemsCount", "expectedTotal", "nextRun", "lastRun", "isActive"]);
}
