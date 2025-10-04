import { PpeScheduleList } from "@/components/inventory/epi/schedule/ppe-schedule-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconCalendar, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export const PPESchedulesListPage = () => {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Lista de Agendamentos de EPI",
    icon: "calendar",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeader
            variant="default"
            title="Agendamentos de EPI"
            icon={IconCalendar}
            favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_EPI_AGENDAMENTOS_LISTAR}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "RH", href: routes.humanResources.root },
              { label: "EPIs", href: routes.humanResources.ppe?.root || routes.humanResources.ppe.root },
              { label: "Agendamentos" },
            ]}
            actions={[
              {
                key: "create",
                label: "Cadastrar",
                icon: IconPlus,
                onClick: () => navigate(routes.humanResources.ppe?.schedules?.create || routes.humanResources.ppe.schedules.create),
                variant: "default",
              },
            ]}
          />
        </div>
        <PpeScheduleList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};
