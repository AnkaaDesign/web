import { useNavigate } from "react-router-dom";
import { IconGift, IconCheck } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { BenefitForm } from "@/components/personnel-department/benefit/form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const BenefitCreatePage = () => {
  const navigate = useNavigate();

  usePageTracker({
    title: "Novo Benefício",
    icon: "gift",
  });

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: () => navigate(routes.personnelDepartment.benefits.root),
      variant: "outline" as const,
    },
    {
      key: "submit",
      label: "Criar",
      icon: IconCheck,
      onClick: () => document.getElementById("benefit-form-submit")?.click(),
      variant: "default" as const,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            variant="form"
            title="Novo Benefício"
            icon={IconGift}
            favoritePage={FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_BENEFICIOS_CADASTRAR}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Departamento Pessoal", href: routes.personnelDepartment.root },
              { label: "Benefícios", href: routes.personnelDepartment.benefits.root },
              { label: "Novo" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <BenefitForm mode="create" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default BenefitCreatePage;
