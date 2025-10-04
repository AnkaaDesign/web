import { usePageTracker } from "@/hooks/use-page-tracker";
import { routes, SECTOR_PRIVILEGES } from "../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { IconCalculator } from "@tabler/icons-react";
import { BonusSimulationInteractiveTable } from "@/components/human-resources/bonus-simulation/bonus-simulation-interactive-table";

export default function BonusSimulationPage() {
  // Track page access
  usePageTracker({
    title: "Simulação de Bônus",
    icon: "calculator",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="flex flex-col h-full space-y-4">
        {/* Page Header */}
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Simulação de Bônus"
            icon={IconCalculator}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Administração" },
              { label: "Simulação de Bônus" }
            ]}
            description="Simulação interativa de bonificações - ajuste quantidade de tarefas, selecione usuários e modifique cargos e níveis em tempo real"
            actions={[]}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <BonusSimulationInteractiveTable />
        </div>
      </div>
    </PrivilegeRoute>
  );
}