import { ActivityList } from "@/components/inventory/activity/list/activity-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconTransfer, IconPlus } from "@tabler/icons-react";
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
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Movimentações"
            icon={IconTransfer}
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
        </div>
        <ActivityList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};
