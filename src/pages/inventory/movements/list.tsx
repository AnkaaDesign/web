import { ActivityList } from "@/components/inventory/activity/list/activity-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export const MovementsListPage = () => {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Lista de Movimentações",
    icon: "search",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
        <PageHeader
          className="flex-shrink-0"
          variant="list"
          title="Movimentações"
          favoritePage={FAVORITE_PAGES.ESTOQUE_MOVIMENTACOES_LISTAR}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Estoque", href: routes.inventory.root }, { label: "Movimentações" }]}
          actions={[
            {
              key: "create",
              label: "Nova Movimentação",
              icon: IconPlus,
              onClick: () => navigate(routes.inventory.movements.create),
              variant: "default",
            },
          ]}
        />

        <ActivityList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};
