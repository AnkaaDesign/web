import { ServiceOrderList } from "@/components/production/service-order/list/service-order-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconClipboardList, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export const ServiceOrderListPage = () => {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Lista de Ordens de Serviço",
    icon: "clipboard-list",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.PRODUCTION}>
      <div className="flex flex-col h-full space-y-4">
        <PageHeaderWithFavorite
          title="Ordens de Serviço"
          icon={IconClipboardList}
          favoritePage={FAVORITE_PAGES.PRODUCAO_ORDENS_SERVICO_LISTAR}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Produção", href: routes.production.root }, { label: "Ordens de Serviço" }]}
          actions={[
            {
              key: "create",
              label: "Nova Ordem de Serviço",
              icon: IconPlus,
              onClick: () => navigate(routes.production.serviceOrders.create),
              variant: "default",
            },
          ]}
        />
        <ServiceOrderList />
      </div>
    </PrivilegeRoute>
  );
};
