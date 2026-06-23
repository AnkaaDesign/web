import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconUserOff, IconCheck, IconLoader2 } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import type { TerminationCreateFormData } from "../../../schemas/termination";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { TerminationForm } from "@/components/personnel-department/termination/form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useTerminationMutations } from "../../../hooks/personnel-department/use-terminations";

export const TerminationCreatePage = () => {
  const navigate = useNavigate();
  const { createAsync } = useTerminationMutations();
  const [isSubmitting, setIsSubmitting] = useState(false);

  usePageTracker({
    title: "Nova Rescisão",
    icon: "user-off",
  });

  const handleSubmit = async (data: TerminationCreateFormData) => {
    try {
      setIsSubmitting(true);
      const result = await createAsync(data);
      if (result.data?.id) {
        navigate(routes.personnelDepartment.terminations.details(result.data.id));
      } else {
        navigate(routes.personnelDepartment.terminations.root);
      }
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error creating termination:", error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(routes.personnelDepartment.terminations.root);
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
      onClick: () => document.getElementById("termination-form-submit")?.click(),
      variant: "default" as const,
      disabled: isSubmitting,
      loading: isSubmitting,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            variant="form"
            title="Nova Rescisão"
            icon={IconUserOff}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Departamento Pessoal", href: routes.personnelDepartment.root },
              { label: "Rescisões", href: routes.personnelDepartment.terminations.root },
              { label: "Nova" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <TerminationForm mode="create" onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default TerminationCreatePage;
