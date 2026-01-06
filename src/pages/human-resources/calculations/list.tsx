import { IconCalculator } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/page-header";
import { CalculationList } from "@/components/integrations/secullum/calculations/list";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { DETAIL_PAGE_SPACING } from "@/lib/layout-constants";
import { cn } from "@/lib/utils";

export default function HumanResourcesCalculationsPage() {
  usePageTracker({ title: "Cálculos de Ponto", icon: "calculator" });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
        <PageHeader
          className="flex-shrink-0"
          title="Cálculos de Ponto"
          favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_CALCULOS}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos", href: routes.humanResources.root },
            { label: "Cálculos de Ponto" }
          ]}
        />
        <CalculationList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
}