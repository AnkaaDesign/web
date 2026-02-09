import { useNavigate } from "react-router-dom";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
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
      <div className="h-full flex flex-col px-4 pt-4">
        <div className="flex-shrink-0">
          <PageHeader
            variant="default"
            title="Agendamentos de Manutenção"
            icon={IconCalendar}
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
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="mt-4">
            <MaintenanceScheduleList />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
}
