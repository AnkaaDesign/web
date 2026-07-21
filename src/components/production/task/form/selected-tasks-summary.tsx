// Shared task review card used by BOTH the cut and airbrushing wizards' review steps (create AND
// edit), so the two forms stay visually identical. Renders the labeled detail rows the edit review
// already used — Tarefa · Cliente · Identificador · Previsão — where "Identificador" is the task's
// serial number and/or truck plate, and "Previsão" is the forecast date (Setor is intentionally
// dropped in favor of the forecast).

import { IconClipboardList, IconUser, IconId, IconCalendar } from "@tabler/icons-react";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import type { ClusteredTask } from "@/components/production/task/preparation/cluster-tasks";
import { formatDate } from "../../../../utils";
import { cn } from "@/lib/utils";

// Fixed row height (h-11) so every row is identical — the customer row's logo sits inside it
// instead of stretching it taller than the text-only rows.
const rowClass = "flex justify-between items-center bg-muted/50 rounded-lg px-4 h-11 gap-3";
const labelClass = "text-sm text-muted-foreground flex items-center gap-2 flex-shrink-0";
const valueClass = "text-sm font-semibold text-foreground truncate text-right min-w-0";

const customerNameOf = (t: ClusteredTask): string => t.customer?.fantasyName || t.customer?.corporateName || "-";
const identifierOf = (t: ClusteredTask): string => [t.serialNumber, t.truck?.plate].filter(Boolean).join(" · ") || "-";

/** The labeled detail rows for a single task (Tarefa · Cliente · Identificador · Previsão). */
export const TaskReviewRows = ({ task }: { task?: ClusteredTask | null }) => {
  if (!task) return <p className="text-sm text-muted-foreground">Tarefa não encontrada.</p>;
  const forecast = task.forecastDate ? formatDate(task.forecastDate as Date) : "-";
  return (
    <div className="space-y-3">
      <div className={rowClass}>
        <span className={labelClass}>
          <IconClipboardList className="h-4 w-4" />
          Tarefa
        </span>
        <span className={valueClass}>{task.name || "-"}</span>
      </div>
      <div className={rowClass}>
        <span className={labelClass}>
          <IconUser className="h-4 w-4" />
          Cliente
        </span>
        {task.customer ? (
          <span className="flex items-center gap-2 min-w-0">
            <CustomerLogoDisplay
              logo={task.customer.logo}
              customerName={customerNameOf(task)}
              size="sm"
              shape="rounded"
              className="flex-shrink-0"
            />
            <span className={valueClass}>{customerNameOf(task)}</span>
          </span>
        ) : (
          <span className={valueClass}>-</span>
        )}
      </div>
      <div className={rowClass}>
        <span className={labelClass}>
          <IconId className="h-4 w-4" />
          Identificador
        </span>
        <span className={cn(valueClass, "font-mono")}>{identifierOf(task)}</span>
      </div>
      <div className={rowClass}>
        <span className={labelClass}>
          <IconCalendar className="h-4 w-4" />
          Previsão
        </span>
        <span className={valueClass}>{forecast}</span>
      </div>
    </div>
  );
};

interface SelectedTasksSummaryProps {
  tasks: ClusteredTask[];
  emptyMessage?: string;
  className?: string;
}

/** Scrollable list of per-task {@link TaskReviewRows} blocks — the multi-select review case. */
export const SelectedTasksSummary = ({ tasks, emptyMessage = "Nenhuma tarefa selecionada.", className }: SelectedTasksSummaryProps) => {
  if (!tasks.length) return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  // Single task: render the rows inline (no wrapper) so it reads identically to the edit review.
  if (tasks.length === 1) return <TaskReviewRows task={tasks[0]} />;
  return (
    <div className={cn("space-y-3", className)}>
      {tasks.map((t) => (
        <div key={t.id} className="rounded-lg border border-border p-3">
          <TaskReviewRows task={t} />
        </div>
      ))}
    </div>
  );
};

SelectedTasksSummary.displayName = "SelectedTasksSummary";
