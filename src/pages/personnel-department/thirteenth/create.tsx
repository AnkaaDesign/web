import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconCheck, IconLoader2, IconGift } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import type { ThirteenthCreateFormData } from "../../../schemas/thirteenth";
import { useThirteenthMutations } from "../../../hooks/personnel-department/use-thirteenths";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { ThirteenthForm } from "@/components/personnel-department/thirteenth/form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const ThirteenthCreatePage = () => {
  usePageTracker({ title: "Novo 13º", icon: "gift" });
  const navigate = useNavigate();
  const { createAsync } = useThirteenthMutations();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: ThirteenthCreateFormData) => {
    try {
      setIsSubmitting(true);
      const result = await createAsync({ data });
      if (result.data?.id) {
        navigate(routes.personnelDepartment.thirteenth.details(result.data.id));
      } else {
        navigate(routes.personnelDepartment.thirteenth.root);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error creating thirteenth:", error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate(routes.personnelDepartment.thirteenth.root);
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
            title="Novo 13º"
            icon={IconGift}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Departamento Pessoal" },
              { label: "13º Salário", href: routes.personnelDepartment.thirteenth.root },
              { label: "Novo" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <ThirteenthForm mode="create" onSubmit={handleSubmit} isSubmitting={isSubmitting} />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default ThirteenthCreatePage;
