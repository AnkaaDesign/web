import { IconBriefcase, IconPlus, IconArrowsSort } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/page-header";
import { PositionList } from "@/components/human-resources/position/list";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const PositionListPage = () => {
  usePageTracker({ title: "Page", icon: "star" });
  const navigate = useNavigate();

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="flex flex-col h-full space-y-4">
        <PageHeaderWithFavorite
          title="Cargos"
          icon={IconBriefcase}
          favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_CARGOS_LISTAR}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Recursos Humanos" }, { label: "Cargos" }]}
          actions={[
            {
              key: "hierarchy",
              label: "Hierarquia",
              icon: IconArrowsSort,
              onClick: () => navigate(routes.humanResources.positions.hierarchy),
              variant: "outline",
            },
            {
              key: "new",
              label: "Cadastrar",
              icon: IconPlus,
              onClick: () => navigate(routes.humanResources.positions.create),
              variant: "default",
            },
          ]}
        />

        <PositionList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};
