import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconCheck, IconLoader2, IconGift } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import type { ThirteenthUpdateFormData } from "../../../../schemas/thirteenth";
import { useThirteenth, useThirteenthMutations } from "../../../../hooks/personnel-department/use-thirteenths";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { ThirteenthForm } from "@/components/personnel-department/thirteenth/form";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const ThirteenthEditPage = () => {
  usePageTracker({ title: "Editar 13º", icon: "gift" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { updateAsync } = useThirteenthMutations();

  const { data: response, isLoading, error } = useThirteenth(id || "", { include: { user: true } }, { enabled: !!id });

  const thirteenth = response?.data;

  if (!id) {
    return <Navigate to={routes.personnelDepartment.thirteenth.root} replace />;
  }

  if (error) {
    return <Navigate to={routes.personnelDepartment.thirteenth.root} replace />;
  }

  const handleSubmit = async (data: ThirteenthUpdateFormData) => {
    try {
      setIsSubmitting(true);
      await updateAsync({ id, data });
      navigate(routes.personnelDepartment.thirteenth.details(id));
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error updating thirteenth:", error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(routes.personnelDepartment.thirteenth.details(id));
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
      onClick: () => document.getElementById("thirteenth-form-submit")?.click(),
      variant: "default" as const,
      disabled: isSubmitting,
      loading: isSubmitting,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            variant="form"
            title="Editar 13º"
            icon={IconGift}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Departamento Pessoal" },
              { label: "13º Salário", href: routes.personnelDepartment.thirteenth.root },
              { label: thirteenth?.user?.name || "13º", href: routes.personnelDepartment.thirteenth.details(id) },
              { label: "Editar" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          {isLoading || !thirteenth ? (
            <div className="container mx-auto max-w-4xl space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <ThirteenthForm mode="update" thirteenth={thirteenth} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
          )}
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default ThirteenthEditPage;
