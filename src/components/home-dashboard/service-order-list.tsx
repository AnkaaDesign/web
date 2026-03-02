import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconClipboardList } from "@tabler/icons-react";
import { DashboardCardList, DashboardPagination } from "./dashboard-card-list";
import type { HomeDashboardServiceOrder } from "../../types";

const PAGE_SIZE = 20;

const SO_TYPE_COLORS: Record<string, string> = {
  PRODUCTION: "bg-[#2563eb]",
  FINANCIAL: "bg-[#16a34a]",
  COMMERCIAL: "bg-[#9333ea]",
  LOGISTIC: "bg-[#f59e0b]",
  ARTWORK: "bg-[#ea580c]",
};

const SO_TYPE_LABELS: Record<string, string> = {
  COMMERCIAL: "Comercial",
  LOGISTIC: "Logística",
  ARTWORK: "Arte",
  FINANCIAL: "Financeiro",
  PRODUCTION: "Produção",
};

function getForecastUrgencyColor(forecastDate: string | null): string {
  if (!forecastDate) return "";

  const now = new Date();
  const forecast = new Date(forecastDate);
  const diffDays = Math.ceil((forecast.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 3) return "text-red-500";
  if (diffDays <= 7) return "text-orange-500";
  if (diffDays <= 10) return "text-yellow-500";
  return "";
}

interface ServiceOrderListProps {
  orders: HomeDashboardServiceOrder[];
  title?: string;
}

export function ServiceOrderList({ orders, title = "Ordens de Serviço Abertas" }: ServiceOrderListProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  const pagedOrders = orders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <DashboardCardList
      title={title}
      icon={<IconClipboardList className="h-4 w-4 text-blue-500" />}
      viewAllLink="/producao/agenda"
      emptyMessage="Nenhuma ordem de serviço aberta"
      isEmpty={orders.length === 0}
      footer={
        <DashboardPagination
          totalItems={orders.length}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      }
    >
      {/* Table header */}
      <div className="sticky top-0 z-10 grid grid-cols-[1.5fr_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 px-4 py-2 bg-secondary border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        <span>Ordem de Serviço</span>
        <span>Tarefa</span>
        <span>Identificador</span>
        <span>Liberação</span>
      </div>
      {/* Table rows */}
      {pagedOrders.map((order, index) => {
        const forecastColor = getForecastUrgencyColor(order.taskForecastDate as unknown as string);
        return (
          <div
            key={order.id}
            className={`grid grid-cols-[1.5fr_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 items-center px-4 py-2 hover:bg-secondary/50 cursor-pointer border-b border-border last:border-b-0 transition-colors ${index % 2 === 1 ? "bg-muted/30" : ""}`}
            onClick={() => navigate("/producao/agenda")}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm text-foreground truncate">{order.description}</span>
              <span className={`text-[10px] font-medium text-white px-1.5 py-0.5 rounded flex-shrink-0 ${SO_TYPE_COLORS[order.type] || "bg-gray-500"}`}>
                {SO_TYPE_LABELS[order.type] || order.type}
              </span>
            </div>
            <span className="text-sm text-foreground truncate">
              {order.taskName || "—"}
            </span>
            <span className="text-sm text-foreground font-mono truncate">
              {order.taskSerialNumber || "—"}
            </span>
            <span className={`text-sm tabular-nums ${forecastColor || "text-foreground"}`}>
              {order.taskForecastDate ? new Date(order.taskForecastDate).toLocaleDateString("pt-BR") : "—"}
            </span>
          </div>
        );
      })}
    </DashboardCardList>
  );
}
