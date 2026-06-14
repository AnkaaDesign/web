import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconBeach, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import type { VacationCreateFormData } from "../../../schemas/vacation";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { VacationForm } from "@/components/personnel-department/vacation/form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useVacationMutations } from "../../../hooks/personnel-department/use-vacations";

export const VacationCreatePage = () => {
  const navigate = useNavigate();
  const { createAsync } = useVacationMutations();
  const [isSubmitting, setIsSubmitting] = useState(false);

  usePageTracker({ title: "Novas Férias", icon: "vacation" });

  const handleSubmit = async (data: VacationCreateFormData) => {
    try {
      setIsSubmitting(true);
      const result = await createAsync(data);
      if (result.data?.id) {
        navigate(routes.personnelDepartment.vacations.details(result.data.id));
      } else {
        navigate(routes.personnelDepartment.vacations.root);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error creating vacation:", error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(routes.personnelDepartment.vacations.root);
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
      label: "Criar",
      icon: isSubmitting ? IconLoader2 : IconCheck,
      onClick: () => document.getElementById("vacation-form-submit")?.click(),
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
            title="Novas Férias"
            icon={IconBeach}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Departamento Pessoal" },
              { label: "Férias", href: routes.personnelDepartment.vacations.root },
              { label: "Novas" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <VacationForm mode="create" onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default VacationCreatePage;
