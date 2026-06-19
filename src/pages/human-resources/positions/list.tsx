import { IconPlus, IconArrowsSort, IconPercentage } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/page-header";
import { PositionList } from "@/components/human-resources/position/list";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const PositionListPage = () => {
  usePageTracker({ title: "Page", icon: "star" });
  const navigate = useNavigate();

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ACCOUNTING]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Cargos"
          favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_CARGOS_LISTAR}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Recursos Humanos", href: routes.personnelDepartment.root }, { label: "Cargos" }]}
          actions={[
            {
              key: "adjustments",
              label: "Reajustes",
              icon: IconPercentage,
              onClick: () => navigate(routes.personnelDepartment.salaryAdjustments.root),
              variant: "outline",
            },
            {
              key: "hierarchy",
              label: "Hierarquia",
              icon: IconArrowsSort,
              onClick: () => navigate(routes.personnelDepartment.positions.hierarchy),
              variant: "outline",
            },
            {
              key: "new",
              label: "Cadastrar",
              icon: IconPlus,
              onClick: () => navigate(routes.personnelDepartment.positions.create),
              variant: "default",
            },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <PositionList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
