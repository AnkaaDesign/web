import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconCalendarOff, IconCheck, IconLoader2 } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { useLeave } from "../../../../hooks/occupational-health/use-leaves";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { LeaveForm } from "@/components/occupational-health/leave/form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const LeaveEditPage = () => {
  usePageTracker({ title: "Editar Afastamento" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const {
    data: response,
    isLoading,
    error,
  } = useLeave(id || "", {
    include: {
      user: true,
      files: true,
    },
    enabled: !!id,
  });

  const leave = response?.data;

  if (!id) {
    return <Navigate to={routes.occupationalHealth.leaves.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar afastamento</p>
        <Navigate to={routes.occupationalHealth.leaves.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!leave) {
    return <Navigate to={routes.occupationalHealth.leaves.root} replace />;
  }

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: () => navigate(routes.occupationalHealth.leaves.details(id)),
      variant: "outline" as const,
    },
    {
      key: "submit",
      label: "Salvar",
      icon: IconCheck,
      onClick: () => document.getElementById("leave-form-submit")?.click(),
      variant: "default" as const,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            variant="form"
            title="Editar Afastamento"
            icon={IconCalendarOff}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Medicina do Trabalho", href: routes.occupationalHealth.root },
              { label: "Afastamentos", href: routes.occupationalHealth.leaves.root },
              { label: leave.user?.name || "Afastamento", href: routes.occupationalHealth.leaves.details(id) },
              { label: "Editar" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <LeaveForm mode="update" leave={leave} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default LeaveEditPage;
