import { MaintenanceList } from "@/components/inventory/maintenance/list/maintenance-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { FAVORITE_PAGES, SECTOR_PRIVILEGES, routes } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

const MaintenanceListPage = () => {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Lista de Manutenções",
    icon: "tool",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.MAINTENANCE}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Manutenções"
          favoritePage={FAVORITE_PAGES.ESTOQUE_MANUTENCAO_LISTAR}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Estoque", href: routes.inventory.root }, { label: "Manutenções" }]}
          actions={[
            {
              key: "create",
              label: "Nova Manutenção",
              icon: IconPlus,
              onClick: () => navigate(routes.inventory.maintenance.create),
              variant: "default",
            },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <MaintenanceList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default MaintenanceListPage;
