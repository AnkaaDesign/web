import { useNavigate } from "react-router-dom";
import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { IconCalendar, IconPlus } from "@tabler/icons-react";
import { MaintenanceScheduleList } from "@/components/inventory/maintenance/schedule/maintenance-schedule-list";

export function MaintenanceSchedulePage() {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Agendamentos de Manutenção",
    icon: "calendar",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="default"
          title="Agendamentos de Manutenção"
          icon={IconCalendar}
          favoritePage={FAVORITE_PAGES.ESTOQUE_MANUTENCAO_AGENDAMENTOS_LISTAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Manutenção", href: routes.inventory.maintenance.root },
            { label: "Agendamentos" },
          ]}
          actions={[
            {
              key: "create",
              label: "Novo Agendamento",
              icon: IconPlus,
              onClick: () => navigate(routes.inventory.maintenance.schedules.create),
              variant: "default",
            },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <MaintenanceScheduleList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
}
