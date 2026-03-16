import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconFileCheck } from "@tabler/icons-react";
import { DashboardCardList, DashboardPagination } from "./dashboard-card-list";
import type { HomeDashboardTask } from "../../types";

const PAGE_SIZE = 20;

interface AwaitingQuoteApprovalListProps {
  tasks: HomeDashboardTask[];
}

export function AwaitingQuoteApprovalList({ tasks }: AwaitingQuoteApprovalListProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  const pagedTasks = tasks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <DashboardCardList
      title="Aguardando Faturamento Aprovado"
      icon={<IconFileCheck className="h-4 w-4 text-blue-500" />}
      viewAllLink="/producao/agenda"
      emptyMessage="Nenhuma tarefa aguardando faturamento aprovado"
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
      <div className="sticky top-0 z-10 grid grid-cols-[1.5fr_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 px-4 py-2 bg-secondary border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        <span>Logomarca</span>
        <span>Cliente</span>
        <span>Identificador</span>
      </div>
      {/* Table rows */}
      {pagedTasks.map((task, index) => (
        <div
          key={task.id}
          className={`grid grid-cols-[1.5fr_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 items-center px-4 py-2 hover:bg-secondary/50 cursor-pointer border-b border-border last:border-b-0 transition-colors ${index % 2 === 1 ? "bg-muted/30" : ""}`}
          onClick={() => navigate(`/producao/agenda/detalhes/${task.id}`)}
        >
          <span className="text-sm text-foreground truncate">
            {task.name || "Tarefa Sem Nome"}
          </span>
          <span className="text-sm text-foreground truncate">
            {task.customerName || "\u2014"}
          </span>
          <span className="text-sm text-foreground font-mono truncate">
            {task.serialNumber || task.plate || "\u2014"}
          </span>
        </div>
      ))}
    </DashboardCardList>
  );
}
