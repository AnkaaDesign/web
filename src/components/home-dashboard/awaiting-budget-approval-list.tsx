import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconFileInvoice } from "@tabler/icons-react";
import { DashboardCardList, DashboardPagination } from "./dashboard-card-list";
import { formatCurrency } from "../../utils/number";
import type { HomeDashboardTask } from "../../types";

const PAGE_SIZE = 20;

function getExpirationStyle(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "text-muted-foreground";
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffDays = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "text-destructive font-semibold";
  if (diffDays <= 3) return "text-red-500";
  if (diffDays <= 7) return "text-orange-500";
  return "text-muted-foreground";
}

function formatExpirationLabel(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "\u2014";
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffDays = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const dateStr = new Date(expiresAt).toLocaleDateString("pt-BR");
  if (diffDays < 0) return `${dateStr} (vencido)`;
  return dateStr;
}

interface AwaitingBudgetApprovalListProps {
  tasks: HomeDashboardTask[];
}

export function AwaitingBudgetApprovalList({ tasks }: AwaitingBudgetApprovalListProps) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

  const pagedTasks = tasks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <DashboardCardList
      title="Orçamentos Aguardando Aprovação"
      icon={<IconFileInvoice className="h-4 w-4 text-orange-500" />}
      viewAllLink="/financeiro/orcamento"
      emptyMessage="Nenhum orçamento aguardando aprovação"
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
      <div className="sticky top-0 z-10 grid grid-cols-[1.2fr_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)] gap-x-3 px-4 py-2 bg-secondary border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        <span>Logomarca</span>
        <span>Cliente</span>
        <span className="text-right">Valor</span>
        <span className="text-right">Validade</span>
      </div>
      {/* Table rows */}
      {pagedTasks.map((task, index) => (
        <div
          key={task.id}
          className={`grid grid-cols-[1.2fr_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)] gap-x-3 items-center px-4 py-2 hover:bg-secondary/50 cursor-pointer border-b border-border last:border-b-0 transition-colors ${index % 2 === 1 ? "bg-muted/30" : ""}`}
          onClick={() => navigate(`/financeiro/orcamento/detalhes/${task.id}`)}
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
          <span className={`text-sm text-right truncate ${getExpirationStyle(task.quoteExpiresAt)}`}>
            {formatExpirationLabel(task.quoteExpiresAt)}
          </span>
        </div>
      ))}
    </DashboardCardList>
  );
}
