import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconBeach, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import type { VacationGroupCreateFormData } from "../../../schemas/vacation-group";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { VacationGroupForm } from "@/components/personnel-department/vacation-group/form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useVacationGroupMutations } from "../../../hooks/personnel-department/use-vacation-groups";

export const VacationGroupCreatePage = () => {
  const navigate = useNavigate();
  const { createAsync } = useVacationGroupMutations();
  const [isSubmitting, setIsSubmitting] = useState(false);

  usePageTracker({ title: "Novas Férias Coletivas", icon: "vacation" });

  const handleSubmit = async (data: VacationGroupCreateFormData) => {
    try {
      setIsSubmitting(true);
      const result = await createAsync(data);
      if (result.data?.id) {
        navigate(routes.personnelDepartment.vacationGroups.details(result.data.id));
      } else {
        navigate(routes.personnelDepartment.vacationGroups.root);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error creating vacation group:", error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(routes.personnelDepartment.vacationGroups.root);
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
      onClick: () => document.getElementById("vacation-group-form-submit")?.click(),
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
            title="Novas Férias Coletivas"
            icon={IconBeach}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Departamento Pessoal" },
              { label: "Férias Coletivas", href: routes.personnelDepartment.vacationGroups.root },
              { label: "Novas" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <VacationGroupForm mode="create" onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default VacationGroupCreatePage;
