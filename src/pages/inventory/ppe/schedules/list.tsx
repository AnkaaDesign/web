import { PpeScheduleList } from "@/components/inventory/epi/schedule/ppe-schedule-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { FAVORITE_PAGES, SECTOR_PRIVILEGES, routes } from "../../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { useCurrentUser } from "../../../../hooks";
import { hasPrivilege } from "../../../../utils";
import { IconCalendar, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export const PPESchedulesListPage = () => {
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();

  // Check if user can create schedules (HR and Admin only)
  const canCreate = currentUser && (
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.HUMAN_RESOURCES) ||
    hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN)
  );

  // Track page access
  usePageTracker({
    title: "Lista de Agendamentos de EPI",
    icon: "calendar",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeader
            variant="default"
            title="Agendamentos de EPI"
            icon={IconCalendar}
            favoritePage={FAVORITE_PAGES.ESTOQUE_EPI_AGENDAMENTOS_LISTAR}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "EPIs", href: routes.inventory.ppe.root },
              { label: "Agendamentos" },
            ]}
            actions={canCreate ? [
              {
                key: "create",
                label: "Cadastrar",
                icon: IconPlus,
                onClick: () => navigate(routes.inventory.ppe.schedules.create),
                variant: "default",
              },
            ] : []}
          />
        </div>
        <PpeScheduleList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};
