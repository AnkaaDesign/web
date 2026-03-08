import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconCircleCheck } from "@tabler/icons-react";
import { DashboardCardList, DashboardPagination } from "./dashboard-card-list";
import type { HomeDashboardTask } from "../../types";

const PAGE_SIZE = 20;

interface CompletedTasksListProps {
  tasks: HomeDashboardTask[];
}

export function CompletedTasksList({ tasks }: CompletedTasksListProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  const pagedTasks = tasks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <DashboardCardList
      title="Tarefas Concluídas (7 dias)"
      icon={<IconCircleCheck className="h-4 w-4 text-green-500" />}
      viewAllLink="/producao/tarefas"
      emptyMessage="Nenhuma tarefa concluída nos últimos 7 dias"
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
        <span>Concluída</span>
      </div>
      {/* Table rows */}
      {pagedTasks.map((task, index) => (
        <div
          key={task.id}
          className={`grid grid-cols-[1.5fr_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 items-center px-4 py-2 hover:bg-secondary/50 cursor-pointer border-b border-border last:border-b-0 transition-colors ${index % 2 === 1 ? "bg-muted/30" : ""}`}
          onClick={() => navigate(`/producao/agenda/detalhes/${task.id}`)}
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
          <span className="text-sm text-foreground">
            {task.term ? new Date(task.term).toLocaleDateString("pt-BR") : "—"}
          </span>
        </div>
      ))}
    </DashboardCardList>
  );
}
