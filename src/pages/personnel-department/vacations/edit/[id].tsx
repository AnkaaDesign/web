import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconCheck, IconLoader2, IconBeach } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES, VACATION_STATUS, VACATION_STATUS_LABELS } from "../../../../constants";
import type { VacationUpdateFormData } from "../../../../schemas/vacation";
import { useVacation, useVacationMutations } from "../../../../hooks/personnel-department/use-vacations";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { VacationForm } from "@/components/personnel-department/vacation/form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const VacationEditPage = () => {
  usePageTracker({ title: "Editar Férias" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { updateAsync } = useVacationMutations();

  const {
    data: response,
    isLoading,
    error,
  } = useVacation(id || "", {
    include: { user: true },
    enabled: !!id,
  });

  const vacation = response?.data;

  if (!id) {
    return <Navigate to={routes.personnelDepartment.vacations.root} replace />;
  }

  if (error) {
    return <Navigate to={routes.personnelDepartment.vacations.root} replace />;
  }

  // Only PAID is terminal/locked (mirrors the API guard, which blocks edits on
  // PAID only). VENCIDA (EXPIRED) stays editable: HR may need to adjust the gozo
  // before paying it in dobro (art. 137) — the EXPIRED → PAID exit.
  const isFinal = vacation?.status === VACATION_STATUS.PAID;

  const handleSubmit = async (data: VacationUpdateFormData) => {
    try {
      setIsSubmitting(true);
      await updateAsync({ id, data });
      navigate(routes.personnelDepartment.vacations.details(id));
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error updating vacation:", error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(routes.personnelDepartment.vacations.details(id));
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
      onClick: () => document.getElementById("vacation-form-submit")?.click(),
      variant: "default" as const,
      disabled: isSubmitting || isFinal,
      loading: isSubmitting,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            variant="form"
            title="Editar Férias"
            icon={IconBeach}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Departamento Pessoal" },
              { label: "Férias", href: routes.personnelDepartment.vacations.root },
              { label: vacation?.user?.name || "Férias", href: routes.personnelDepartment.vacations.details(id) },
              { label: "Editar" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          {isLoading || !vacation ? (
            <div className="container mx-auto max-w-4xl space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <div className="container mx-auto max-w-4xl space-y-4">
              {isFinal && (
                <Alert variant="destructive">
                  <AlertTitle>Férias {VACATION_STATUS_LABELS[vacation.status].toLowerCase()}</AlertTitle>
                  <AlertDescription>Estas férias já estão pagas e não podem ser editadas.</AlertDescription>
                </Alert>
              )}
              <VacationForm mode="update" vacation={vacation} onSubmit={handleSubmit} isSubmitting={isSubmitting} disabled={isFinal} />
            </div>
          )}
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default VacationEditPage;
