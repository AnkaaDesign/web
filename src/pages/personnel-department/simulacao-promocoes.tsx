import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { IconTrendingUp } from "@tabler/icons-react";
import { PromotionsSimulationInteractiveTable } from "@/components/personnel-department/promotions-simulation/promotions-simulation-interactive-table";

export default function PromotionsSimulationPage() {
  // Track page access
  usePageTracker({
    title: "Simulação de Promoções",
    icon: "trending-up",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.ACCOUNTING]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
        <PageHeader
          className="flex-shrink-0"
          title="Simulação de Promoções"
          icon={IconTrendingUp}
          favoritePage={FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_PROMOCOES_SIMULACAO}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Administração", href: routes.administration.root },
            { label: "Promoções", href: routes.personnelDepartment.promotions.root },
            { label: "Simulação de Promoções" }
          ]}
          actions={[]}
        />
        <PromotionsSimulationInteractiveTable className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
}
