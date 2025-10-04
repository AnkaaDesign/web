import { UnderConstruction } from "@/components/navigation/under-construction";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes } from "../../../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconCalendar } from "@tabler/icons-react";

export const EditMaintenanceSchedulePage = () => {
  // Track page access
  usePageTracker({
    title: "Editar Agendamento de Manutenção",
    icon: "calendar",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeader
            variant="default"
            title="Editar Agendamento de Manutenção"
            icon={IconCalendar}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "Manutenção", href: routes.inventory.maintenance.root },
              { label: "Agendamentos", href: routes.inventory.maintenance.schedules.root },
              { label: "Editar" },
            ]}
          />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            <UnderConstruction title="Editar Agendamento de Manutenção" />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default EditMaintenanceSchedulePage;
