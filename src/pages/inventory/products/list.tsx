import { ItemList } from "@/components/inventory/item/list/item-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconPackage, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export const ProductListPage = () => {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Lista de Produtos",
    icon: "package",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Produtos"
            icon={IconPackage}
            favoritePage={FAVORITE_PAGES.ESTOQUE_PRODUTOS_LISTAR}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Estoque", href: routes.inventory.root }, { label: "Produtos" }]}
            actions={[
              {
                key: "create",
                label: "Cadastrar",
                icon: IconPlus,
                onClick: () => navigate(routes.inventory.products.create),
                variant: "default",
              },
            ]}
          />
        </div>
        <ItemList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};

export default ProductListPage;
