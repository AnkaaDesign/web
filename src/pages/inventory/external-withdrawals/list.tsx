import { ExternalWithdrawalList } from "@/components/inventory/external-withdrawal/list/external-withdrawal-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconPlus } from "@tabler/icons-react";
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
      <div className="h-full flex flex-col px-4 pt-4">
        <PageHeader
          variant="list"
          title="Retiradas Externas"
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

        <ExternalWithdrawalList className="flex-1 mt-4" />
      </div>
    </PrivilegeRoute>
  );
};

export default ExternalWithdrawalListPage;
