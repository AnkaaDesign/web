import { SupplierList } from "@/components/inventory/supplier/list/supplier-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconBuildingStore, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export const SupplierListPage = () => {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Lista de Fornecedores",
    icon: "building-store",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Fornecedores"
            icon={IconBuildingStore}
            favoritePage={FAVORITE_PAGES.ESTOQUE_FORNECEDORES_LISTAR}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Estoque", href: routes.inventory.root }, { label: "Fornecedores" }]}
            actions={[
              {
                key: "create",
                label: "Cadastrar",
                icon: IconPlus,
                onClick: () => navigate(routes.inventory.suppliers.create),
                variant: "default",
              },
            ]}
          />
        </div>
        <SupplierList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};
