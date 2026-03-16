import type { HomeDashboardData } from "../../types";
import { SECTOR_PRIVILEGES } from "../../constants";
import { TaskDeadlineList } from "./task-deadline-list";
import { ServiceOrderList } from "./service-order-list";
import { LowStockList } from "./low-stock-list";
import { CompletedTasksList } from "./completed-tasks-list";
import { AwaitingApprovalTasksList } from "./awaiting-approval-tasks-list";
import { AwaitingQuoteApprovalList } from "./awaiting-quote-approval-list";
import { TimeEntriesCard } from "./time-entries-card";

interface HomeDashboardSectionProps {
  data: HomeDashboardData;
  sector?: string;
  showTimeEntries?: boolean;
  isSectionVisible?: (sectionId: string) => boolean;
}

export function HomeDashboardSection({ data, sector, showTimeEntries, isSectionVisible }: HomeDashboardSectionProps) {
  const isVisible = (id: string) => !isSectionVisible || isSectionVisible(id);
  const isAdmin = sector === SECTOR_PRIVILEGES.ADMIN;

  const hasContent =
    (data.tasksCloseDeadline && data.tasksCloseDeadline.length > 0) ||
    (data.openServiceOrders && data.openServiceOrders.length > 0) ||
    (data.tasksCloseForecast && data.tasksCloseForecast.length > 0) ||
    (data.lowStockItems && data.lowStockItems.length > 0) ||
    (data.completedTasks && data.completedTasks.length > 0) ||
    (data.tasksAwaitingPaymentApproval && data.tasksAwaitingPaymentApproval.length > 0) ||
    (data.tasksAwaitingQuoteApproval && data.tasksAwaitingQuoteApproval.length > 0) ||
    showTimeEntries;

  if (!hasContent) return null;

  const deadlineViewAllLink = sector === SECTOR_PRIVILEGES.PRODUCTION
    ? "/producao/cronograma"
    : "/producao/agenda";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {isVisible("tasksCloseDeadline") && data.tasksCloseDeadline && data.tasksCloseDeadline.length > 0 && (
        <TaskDeadlineList
          tasks={data.tasksCloseDeadline}
          title="Tarefas com Prazo Hoje"
          variant="deadline"
          viewAllLink={deadlineViewAllLink}
        />
      )}

      {isVisible("openServiceOrders") && data.openServiceOrders && data.openServiceOrders.length > 0 && (
        <ServiceOrderList orders={data.openServiceOrders} title="Ordens de Serviço Abertas" showTypeBadge={isAdmin} />
      )}

      {isVisible("tasksCloseForecast") && data.tasksCloseForecast && data.tasksCloseForecast.length > 0 && (
        <TaskDeadlineList
          tasks={data.tasksCloseForecast}
          title="Tarefas com Liberação Próxima"
          variant="forecast"
          viewAllLink="/producao/agenda"
        />
      )}

      {isVisible("completedTasks") && data.completedTasks && data.completedTasks.length > 0 && (
        <CompletedTasksList tasks={data.completedTasks} />
      )}

      {isVisible("tasksAwaitingPaymentApproval") && data.tasksAwaitingPaymentApproval && data.tasksAwaitingPaymentApproval.length > 0 && (
        <AwaitingApprovalTasksList tasks={data.tasksAwaitingPaymentApproval} />
      )}

      {isVisible("tasksAwaitingQuoteApproval") && data.tasksAwaitingQuoteApproval && data.tasksAwaitingQuoteApproval.length > 0 && (
        <AwaitingQuoteApprovalList tasks={data.tasksAwaitingQuoteApproval} />
      )}

      {isVisible("lowStockItems") && data.lowStockItems && data.lowStockItems.length > 0 && (
        <LowStockList items={data.lowStockItems} totalCount={data.counts.lowStockItems} />
      )}

      {isVisible("timeEntries") && showTimeEntries && <TimeEntriesCard />}
    </div>
  );
}
