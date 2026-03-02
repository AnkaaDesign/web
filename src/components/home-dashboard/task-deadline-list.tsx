import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconCalendarDue } from "@tabler/icons-react";
import { DashboardCardList, DashboardPagination } from "./dashboard-card-list";
import type { HomeDashboardTask } from "../../types";

const PAGE_SIZE = 20;

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month} ${hours}:${minutes}`;
}

function getTermTextColor(term: string | null): string {
  if (!term) return "";

  const now = new Date();
  const deadline = new Date(term);
  const diffMs = deadline.getTime() - now.getTime();

  if (diffMs < 0) {
    return "text-red-500";
  }

  const hoursRemaining = diffMs / (1000 * 60 * 60);

  if (hoursRemaining <= 4) {
    return "text-amber-500";
  }

  return "text-green-500";
}

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

interface TaskDeadlineListProps {
  tasks: HomeDashboardTask[];
  title?: string;
  viewAllLink?: string;
  variant?: "deadline" | "forecast";
}

export function TaskDeadlineList({
  tasks,
  title = "Tarefas com Prazo Hoje",
  viewAllLink = "/producao/agenda",
  variant = "deadline",
}: TaskDeadlineListProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const isDeadline = variant === "deadline";
  const dateColumnLabel = isDeadline ? "Prazo" : "Liberação";

  const pagedTasks = tasks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <DashboardCardList
      title={title}
      icon={<IconCalendarDue className="h-4 w-4 text-red-500" />}
      viewAllLink={viewAllLink}
      emptyMessage={isDeadline ? "Nenhuma tarefa com prazo vencendo hoje" : "Nenhuma tarefa com liberação próxima"}
      isEmpty={tasks.length === 0}
      footer={
        <DashboardPagination
          totalItems={tasks.length}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      }
    >
      {/* Table header */}
      <div className="sticky top-0 z-10 grid grid-cols-[1.5fr_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 px-4 py-2 bg-secondary border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        <span>Logomarca</span>
        <span>Cliente</span>
        <span>Identificador</span>
        <span>{dateColumnLabel}</span>
      </div>
      {/* Table rows */}
      {pagedTasks.map((task, index) => {
        const dateValue = isDeadline ? task.term : task.forecastDate;
        const dateTextColor = isDeadline
          ? getTermTextColor(task.term)
          : getForecastUrgencyColor(task.forecastDate);

        return (
          <div
            key={task.id}
            className={`grid grid-cols-[1.5fr_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 items-center px-4 py-2 cursor-pointer border-b border-border last:border-b-0 transition-colors hover:bg-secondary/50 ${index % 2 === 1 ? "bg-muted/30" : ""}`}
            onClick={() => navigate(`/producao/tarefas/${task.id}`)}
          >
            <span className="text-sm text-foreground truncate">
              {task.name || "Tarefa Sem Nome"}
            </span>
            <span className="text-sm text-foreground truncate">
              {task.customerName || "—"}
            </span>
            <span className="text-sm text-foreground font-mono truncate">
              {task.serialNumber || task.plate || "—"}
            </span>
            <span className={`text-sm tabular-nums ${dateTextColor || "text-foreground"}`}>
              {dateValue ? formatDateTime(dateValue) : "—"}
            </span>
          </div>
        );
      })}
    </DashboardCardList>
  );
}
