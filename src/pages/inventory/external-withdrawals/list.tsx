import { ExternalWithdrawalList } from "@/components/inventory/external-withdrawal/list/external-withdrawal-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconPackageExport, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export const ExternalWithdrawalListPage = () => {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Lista de Retiradas Externas",
    icon: "package-export",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Retiradas Externas"
            icon={IconPackageExport}
            favoritePage={FAVORITE_PAGES.ESTOQUE_RETIRADAS_EXTERNAS_LISTAR}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Estoque", href: routes.inventory.root }, { label: "Retiradas Externas" }]}
            actions={[
              {
                key: "create",
                label: "Nova Retirada",
                icon: IconPlus,
                onClick: () => navigate(routes.inventory.externalWithdrawals?.create || "/inventory/external-withdrawals/create"),
                variant: "default",
              },
            ]}
          />
        </div>
        <ExternalWithdrawalList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};

export default ExternalWithdrawalListPage;
