import { IconBeach, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { VacationList } from "@/components/human-resources/vacation";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const VacationListPage = () => {
  const navigate = useNavigate();
  usePageTracker({ title: "Page", icon: "star" });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeader
            variant="default"
            title="Férias"
            icon={IconBeach}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Recursos Humanos", href: routes.humanResources.root }, { label: "Férias" }]}
            favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_FERIAS_LISTAR}
            actions={[
              {
                key: "create",
                label: "Nova Solicitação",
                icon: IconPlus,
                onClick: () => navigate(routes.humanResources.vacations.create),
                variant: "default",
              },
            ]}
          />
        </div>
        <VacationList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};
