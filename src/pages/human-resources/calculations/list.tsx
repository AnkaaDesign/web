import { IconCalculator } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/page-header";
import { CalculationList } from "@/components/integrations/secullum/calculations/list";
import { usePageTracker } from "@/hooks/use-page-tracker";

export default function HumanResourcesCalculationsPage() {
  usePageTracker({ title: "Cálculos de Ponto", icon: "calculator" });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="flex flex-col h-full space-y-4">
        <PageHeaderWithFavorite
          title="Cálculos de Ponto"
          icon={IconCalculator}
          favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_CALCULOS}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos", href: routes.humanResources.root },
            { label: "Cálculos de Ponto" }
          ]}
        />
        <div className="flex-1 min-h-0">
          <CalculationList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
}