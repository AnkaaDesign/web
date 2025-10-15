import { useParams, useNavigate } from "react-router-dom";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES, routes } from "../../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { useTaskDetail } from "../../../../hooks";
import { TaskEditForm } from "@/components/production/task/form/task-edit-form";
import { TaskEditSkeleton } from "@/components/production/task/skeleton/task-edit-skeleton";
import { Button } from "@/components/ui/button";

export const TaskEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Editar Tarefa",
    icon: "clipboard-list",
  });

  const {
    data: response,
    isLoading,
    error,
  } = useTaskDetail(id!, {
    enabled: !!id,
    include: {
      customer: true,
      sector: true,
      services: true,
      generalPainting: true,
      artworks: true,
      cuts: {
        include: {
          file: true,
        },
      },
      logoPaints: true,
      airbrushings: {
        include: {
          receipts: true,
          invoices: true,
          artworks: true,
        },
      },
      createdBy: true,
      truck: {
        include: {
          garage: true,
        },
      },
      observation: {
        include: {
          files: true,
        },
      },
    },
  });

  const task = response?.data;

  if (isLoading) {
    return <TaskEditSkeleton />;
  }

  if (error || !task) {
    return (
      <div className="container mx-auto py-6 max-w-3xl">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Tarefa não encontrada</h2>
          <p className="text-muted-foreground mb-4">A tarefa que você está procurando não existe ou foi removida.</p>
          <Button onClick={() => navigate(routes.production.schedule.list)}>Voltar para lista</Button>
        </div>
      </div>
    );
  }

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.LEADER}>
      <div className="h-full">
        <TaskEditForm task={task} />
      </div>
    </PrivilegeRoute>
  );
};

export default TaskEditPage;
