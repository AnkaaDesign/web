import { useParams, useNavigate, useLocation } from "react-router-dom";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES, routes } from "../../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { useTaskDetail } from "../../../../hooks";
import { TaskEditForm } from "@/components/production/task/form/task-edit-form";
import { TaskEditSkeleton } from "@/components/production/task/skeleton/task-edit-skeleton";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { IconCheck, IconLoader2 } from "@tabler/icons-react";
import React from "react";

export const TaskEditPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [formState, setFormState] = React.useState({ isValid: false, isDirty: false });

  // Determine the source section from the URL path
  // /producao/cronograma/editar/123 → 'cronograma'
  // /producao/agenda/editar/123 → 'agenda'
  // /producao/historico/editar/123 → 'historico'
  const pathSegments = location.pathname.split('/');
  const source = pathSegments[2]; // Index 2 is the section (cronograma, agenda, historico)

  // Get breadcrumb configuration based on source
  const getBreadcrumbConfig = (source: string) => {
    switch (source) {
      case 'agenda':
        return {
          label: 'Agenda',
          href: routes.production.preparation.root,
          detailsRoute: routes.production.preparation.details,
        };
      case 'historico':
        return {
          label: 'Histórico',
          href: routes.production.history.root,
          detailsRoute: routes.production.history.details,
        };
      case 'cronograma':
      default:
        return {
          label: 'Cronograma',
          href: routes.production.schedule.list,
          detailsRoute: routes.production.schedule.details,
        };
    }
  };

  const breadcrumbConfig = getBreadcrumbConfig(source);

  // Debug form state
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[TaskEditPage] formState updated:', formState);
    }
  }, [formState]);

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
      serviceOrders: true,
      generalPainting: true,
      artworks: true,
      budget: true,
      budgets: true,
      invoices: true,
      receipts: true,
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

  // Get display name with fallbacks
  const getTaskDisplayName = (task: any) => {
    if (task.name) return task.name;
    if (task.customer?.fantasyName) return task.customer.fantasyName;
    if (task.serialNumberFrom) return `Série ${task.serialNumberFrom}`;
    if (task.truck?.plate) return task.truck.plate;
    return "Sem nome";
  };

  const handleCancel = () => {
    navigate(breadcrumbConfig.href);
  };

  if (isLoading) {
    return <TaskEditSkeleton />;
  }

  if (error || !task) {
    return (
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-5xl flex-shrink-0">
          <PageHeader
            variant="form"
            title="Editar Tarefa"
            breadcrumbs={[
              { label: "Produção", href: routes.production.root },
              { label: breadcrumbConfig.label, href: breadcrumbConfig.href },
              { label: "Editar" },
            ]}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="container mx-auto py-6 max-w-5xl">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Tarefa não encontrada</h2>
              <p className="text-muted-foreground mb-4">A tarefa que você está procurando não existe ou foi removida.</p>
              <Button onClick={handleCancel}>Voltar para lista</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isSubmitDisabled = !formState.isValid || !formState.isDirty;

  if (process.env.NODE_ENV !== 'production') {
    console.log('[TaskEditPage] Submit button check:', {
      isValid: formState.isValid,
      isDirty: formState.isDirty,
      isSubmitDisabled,
    });
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
      key: "submit",
      label: "Salvar Alterações",
      icon: IconCheck,
      onClick: () => {
        console.log('[TaskEditPage] Submit button clicked');
        const submitBtn = document.getElementById("task-form-submit");
        console.log('[TaskEditPage] Found submit button:', !!submitBtn);
        console.log('[TaskEditPage] Submit button disabled:', submitBtn?.getAttribute('disabled'));
        submitBtn?.click();
      },
      variant: "default" as const,
      disabled: isSubmitDisabled,
      loading: false,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PLOTTING, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-5xl flex-shrink-0">
          <PageHeader
            variant="form"
            title={`Editar ${getTaskDisplayName(task)}`}
            breadcrumbs={[
              { label: "Produção", href: routes.production.root },
              { label: breadcrumbConfig.label, href: breadcrumbConfig.href },
              { label: getTaskDisplayName(task), href: breadcrumbConfig.detailsRoute(id!) },
              { label: "Editar" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <TaskEditForm task={task} onFormStateChange={setFormState} detailsRoute={breadcrumbConfig.detailsRoute} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default TaskEditPage;
