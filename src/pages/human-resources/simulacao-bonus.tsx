import { usePageTracker } from "@/hooks/use-page-tracker";
import { routes, SECTOR_PRIVILEGES } from "../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { IconCalculator } from "@tabler/icons-react";
import { BonusSimulationInteractiveTable } from "@/components/human-resources/bonus-simulation/bonus-simulation-interactive-table";
import { DETAIL_PAGE_SPACING } from "@/lib/layout-constants";
import { cn } from "@/lib/utils";

export default function BonusSimulationPage() {
  // Track page access
  usePageTracker({
    title: "Simulação de Bônus",
    icon: "calculator",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
        <PageHeader
          className="flex-shrink-0"
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
        <BonusSimulationInteractiveTable className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
}