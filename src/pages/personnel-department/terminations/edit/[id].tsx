import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconCheck, IconLoader2, IconUserOff } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES, TERMINATION_STATUS, TERMINATION_STATUS_LABELS } from "../../../../constants";
import type { TerminationUpdateFormData } from "../../../../schemas/termination";
import { useTermination, useTerminationMutations } from "../../../../hooks/personnel-department/use-terminations";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { TerminationForm } from "@/components/personnel-department/termination/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const TerminationEditPage = () => {
  usePageTracker({ title: "Editar Rescisão" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { updateAsync } = useTerminationMutations();

  const {
    data: response,
    isLoading,
    error,
  } = useTermination(id || "", {
    include: { user: true },
    enabled: !!id,
  });

  const termination = response?.data;

  if (!id) {
    return <Navigate to={routes.personnelDepartment.terminations.root} replace />;
  }

  if (error) {
    return <Navigate to={routes.personnelDepartment.terminations.root} replace />;
  }

  const isFinal = termination?.status === TERMINATION_STATUS.COMPLETED || termination?.status === TERMINATION_STATUS.CANCELLED;

  const handleSubmit = async (data: TerminationUpdateFormData) => {
    try {
      setIsSubmitting(true);
      await updateAsync({ id, data });
      navigate(routes.personnelDepartment.terminations.details(id));
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error updating termination:", error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(routes.personnelDepartment.terminations.details(id));
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: handleCancel,
      variant: "outline" as const,
      disabled: isSubmitting,
    },
    {
      key: "submit",
      label: "Salvar",
      icon: isSubmitting ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("termination-form-submit")?.click(),
      variant: "default" as const,
      disabled: isSubmitting || isFinal,
      loading: isSubmitting,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            variant="form"
            title="Editar Rescisão"
            icon={IconUserOff}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Departamento Pessoal" },
              { label: "Rescisões", href: routes.personnelDepartment.terminations.root },
              { label: termination?.user?.name || "Rescisão", href: routes.personnelDepartment.terminations.details(id) },
              { label: "Editar" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          {isLoading || !termination ? (
            <div className="container mx-auto max-w-4xl space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <div className="container mx-auto max-w-4xl space-y-4">
              {isFinal && (
                <Alert variant="destructive">
                  <AlertTitle>Rescisão {TERMINATION_STATUS_LABELS[termination.status].toLowerCase()}</AlertTitle>
                  <AlertDescription>
                    Esta rescisão está {termination.status === TERMINATION_STATUS.COMPLETED ? "concluída" : "cancelada"} e não pode ser editada.
                  </AlertDescription>
                </Alert>
              )}
              <TerminationForm mode="update" termination={termination} onSubmit={handleSubmit} isSubmitting={isSubmitting} disabled={isFinal} />
            </div>
          )}
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default TerminationEditPage;
