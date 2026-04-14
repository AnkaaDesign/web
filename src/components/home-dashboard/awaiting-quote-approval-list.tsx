import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconFileCheck } from "@tabler/icons-react";
import { DashboardCardList, DashboardPagination } from "./dashboard-card-list";
import { formatCurrency } from "../../utils/number";
import { TASK_STATUS } from "../../constants/enums";
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
      title="Faturamento Aguardando Aprovação"
      icon={<IconFileCheck className="h-4 w-4 text-blue-500" />}
      viewAllLink="/financeiro/faturamento"
      emptyMessage="Nenhuma tarefa aguardando aprovação de faturamento"
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
      <div className="sticky top-0 z-10 grid grid-cols-[1.2fr_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.7fr)] gap-x-3 px-4 py-2 bg-secondary border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        <span>Logomarca</span>
        <span>Cliente</span>
        <span className="text-right">Valor</span>
        <span className="text-right">Tarefa</span>
      </div>
      {/* Table rows */}
      {pagedTasks.map((task, index) => {
        const isCompleted = task.status === TASK_STATUS.COMPLETED;
        return (
          <div
            key={task.id}
            className={`grid grid-cols-[1.2fr_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.7fr)] gap-x-3 items-center px-4 py-2 hover:bg-secondary/50 cursor-pointer border-b border-border last:border-b-0 transition-colors ${index % 2 === 1 ? "bg-muted/30" : ""}`}
            onClick={() => navigate(`/financeiro/faturamento/detalhes/${task.id}`)}
          >
            <span className="text-sm text-foreground truncate">
              {task.name || "Sem Nome"}
            </span>
            <span className="text-sm text-foreground truncate">
              {task.customerName || "\u2014"}
            </span>
            <span className="text-sm text-foreground font-mono text-right truncate">
              {task.quoteTotal != null ? formatCurrency(task.quoteTotal) : "\u2014"}
            </span>
            <span className={`text-xs text-right truncate font-medium ${isCompleted ? "text-green-600" : "text-orange-500"}`}>
              {isCompleted ? "Concluída" : "Em Produção"}
            </span>
          </div>
        );
      })}
    </DashboardCardList>
  );
}
