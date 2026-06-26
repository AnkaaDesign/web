import { PpeScheduleList } from "@/components/inventory/epi/schedule/ppe-schedule-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export const PPESchedulesListPage = () => {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Lista de Agendamentos de EPI",
    icon: "calendar",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ACCOUNTING]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
        <PageHeader
          className="flex-shrink-0"
          variant="default"
          title="Agendamentos de EPI"
          favoritePage={FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_EPI_AGENDAMENTOS_LISTAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Medicina do Trabalho", href: routes.occupationalHealth.ppe.deliveries.root },
            { label: "EPIs", href: routes.occupationalHealth.ppe.deliveries.root },
            { label: "Agendamentos" },
          ]}
          actions={[
            {
              key: "create",
              label: "Cadastrar",
              icon: IconPlus,
              onClick: () => navigate(routes.occupationalHealth.ppe.schedules.create),
              variant: "default",
            },
          ]}
        />
        <PpeScheduleList
          className="flex-1 min-h-0"
          scheduleRoutes={{
            details: (id: string) => routes.occupationalHealth.ppe.schedules.details(id),
            edit: (id: string) => routes.occupationalHealth.ppe.schedules.edit(id),
          }}
        />
      </div>
    </PrivilegeRoute>
  );
};
