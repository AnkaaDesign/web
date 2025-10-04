// apps/web/src/pages/production/cronograma/batch-edit.tsx

import { useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTasks } from "../../../hooks";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { TaskBatchEditTable } from "@/components/production/task/batch-edit/task-batch-edit-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconClipboardList, IconAlertTriangle, IconLoader, IconDeviceFloppy, IconArrowLeft } from "@tabler/icons-react";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const TaskBatchEditPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  usePageTracker({
    title: "Editar Tarefas em Lote",
    icon: "tasks",
  });

  // Extract task IDs from URL query parameters
  const taskIds = useMemo(() => {
    const ids = searchParams.get("ids");
    if (!ids) return [];
    return ids.split(",").filter(Boolean);
  }, [searchParams]);

  // Fetch tasks to edit
  const {
    data: tasksResponse,
    isLoading,
    error,
  } = useTasks(
    {
      where: {
        id: {
          in: taskIds,
        },
      },
      include: {
        customer: true,
        sector: true,
        generalPainting: true,
        truck: true,
      },
      take: taskIds.length,
    },
    {
      enabled: taskIds.length > 0,
    },
  );

  const tasks = tasksResponse?.data || [];

  // Validate that we have tasks to edit
  const hasValidTasks = tasks.length > 0;
  const allTasksFound = tasks.length === taskIds.length;

  const handleCancel = () => {
    navigate(routes.production.schedule.root);
  };

  if (taskIds.length === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-destructive" />
              Nenhuma Tarefa Selecionada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">Nenhuma tarefa foi selecionada para edição em lote.</p>
              <Button onClick={handleCancel} variant="outline">
                <IconArrowLeft className="mr-2 h-4 w-4" />
                Voltar para Cronograma
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Carregando Tarefas...</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center p-8">
              <IconLoader className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !hasValidTasks) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-destructive" />
              Erro ao Carregar Tarefas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">{error ? "Ocorreu um erro ao carregar as tarefas selecionadas." : "As tarefas selecionadas não foram encontradas."}</p>
              {!allTasksFound && tasks.length > 0 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Apenas {tasks.length} de {taskIds.length} tarefas foram encontradas. As tarefas não encontradas podem ter sido excluídas.
                  </p>
                </div>
              )}
              <div className="flex gap-2 justify-center">
                <Button onClick={handleCancel} variant="outline">
                  <IconArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para Cronograma
                </Button>
                {tasks.length > 0 && (
                  <Button onClick={() => navigate(routes.production.schedule.root)}>
                    <IconClipboardList className="mr-2 h-4 w-4" />
                    Ir para Cronograma
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: false,
    },
    {
      key: "save",
      label: "Salvar Alterações",
      icon: IconDeviceFloppy,
      onClick: () => {
        const submitButton = document.getElementById("task-batch-form-submit");
        if (submitButton) {
          submitButton.click();
        }
      },
      variant: "default" as const,
      disabled: false,
    },
  ];

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <PageHeaderWithFavorite
          title="Editar Tarefas em Lote"
          icon={IconClipboardList}
          favoritePage={FAVORITE_PAGES.PRODUCAO_CRONOGRAMA_LISTAR}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Produção", href: routes.production.root },
            { label: "Cronograma", href: routes.production.schedule.root },
            { label: "Editar em Lote" },
          ]}
          actions={actions}
        />
      </div>

      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-hidden">
        <TaskBatchEditTable
            tasks={tasks}
            onCancel={handleCancel}
            onSubmit={() => {
              // This will be triggered from the page header save button
              const submitButton = document.getElementById("task-batch-form-submit");
              if (submitButton) {
                submitButton.click();
              }
            }}
          />
      </div>
    </div>
  );
};

export default TaskBatchEditPage;
