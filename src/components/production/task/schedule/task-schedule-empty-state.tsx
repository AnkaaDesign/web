import { IconCalendarOff, IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { routes } from "../../../../constants";
import { cn } from "@/lib/utils";

interface TaskScheduleEmptyStateProps {
  className?: string;
  hasSectors?: boolean;
}

export function TaskScheduleEmptyState({ className, hasSectors = true }: TaskScheduleEmptyStateProps) {
  const navigate = useNavigate();

  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4", className)}>
      <div className="bg-muted/30 rounded-full p-6 mb-6">
        <IconCalendarOff className="h-16 w-16 text-muted-foreground" />
      </div>

      <h2 className="text-2xl font-semibold text-foreground mb-2">Nenhuma tarefa agendada</h2>

      <p className="text-muted-foreground text-center max-w-md mb-8">
        {hasSectors
          ? "Não há tarefas pendentes ou em produção no momento. Crie uma nova tarefa para começar a organizar o cronograma."
          : "Configure os setores de produção antes de criar tarefas para o cronograma."}
      </p>

      {hasSectors && (
        <Button onClick={() => navigate(routes.production.schedule.create)} size="lg" className="gap-2">
          <IconPlus className="h-5 w-5" />
          Criar Nova Tarefa
        </Button>
      )}

      <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="bg-primary/10 rounded-lg p-3">
            <IconCalendarOff className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-medium text-sm">Organize o trabalho</h3>
          <p className="text-xs text-muted-foreground">Visualize todas as tarefas por setor</p>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="bg-primary/10 rounded-lg p-3">
            <IconCalendarOff className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-medium text-sm">Acompanhe prazos</h3>
          <p className="text-xs text-muted-foreground">Monitore o tempo restante de cada tarefa</p>
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="bg-primary/10 rounded-lg p-3">
            <IconCalendarOff className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-medium text-sm">Gerencie a produção</h3>
          <p className="text-xs text-muted-foreground">Controle o fluxo de trabalho eficientemente</p>
        </div>
      </div>
    </div>
  );
}
