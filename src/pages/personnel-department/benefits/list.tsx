import { PageHeader } from "@/components/ui/page-header";
import { IconPlus, IconHeartHandshake } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { BenefitList } from "@/components/personnel-department/benefit/list/benefit-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { FAVORITE_PAGES, routes, SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const BenefitListPage = () => {
  usePageTracker({ title: "Benefícios" });
  const navigate = useNavigate();

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Benefícios"
          favoritePage={FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_BENEFICIOS_LISTAR}
          breadcrumbs={[{ label: "Início", href: "/" }, { label: "Departamento Pessoal", href: routes.personnelDepartment.root }, { label: "Benefícios" }]}
          actions={[
            {
              key: "enrollments",
              label: "Adesões",
              icon: IconHeartHandshake,
              onClick: () => navigate(routes.personnelDepartment.benefits.enrollments.root),
              variant: "outline" as const,
            },
            {
              key: "create",
              label: "Novo Benefício",
              icon: IconPlus,
              onClick: () => navigate(routes.personnelDepartment.benefits.create),
              variant: "default" as const,
            },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <BenefitList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default BenefitListPage;
