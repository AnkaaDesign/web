import { PageHeader } from "@/components/ui/page-header";
import { IconPlus, IconGift } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { UserBenefitList } from "@/components/personnel-department/user-benefit/list/user-benefit-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { FAVORITE_PAGES, routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const UserBenefitListPage = () => {
  usePageTracker({ title: "Adesões de Benefícios" });
  const navigate = useNavigate();

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Adesões"
          favoritePage={FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_BENEFICIOS_ADESOES_LISTAR}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Departamento Pessoal" },
            { label: "Benefícios", href: routes.personnelDepartment.benefits.root },
            { label: "Adesões" },
          ]}
          actions={[
            {
              key: "benefits",
              label: "Benefícios",
              icon: IconGift,
              onClick: () => navigate(routes.personnelDepartment.benefits.root),
              variant: "outline" as const,
            },
            {
              key: "create",
              label: "Nova Adesão",
              icon: IconPlus,
              onClick: () => navigate(routes.personnelDepartment.benefits.enrollments.create),
              variant: "default" as const,
            },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <UserBenefitList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default UserBenefitListPage;
