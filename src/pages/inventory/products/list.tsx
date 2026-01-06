import { ItemList } from "@/components/inventory/item/list/item-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconPlus, IconClipboardCheck } from "@tabler/icons-react";
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
      <div className="h-full flex flex-col bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Produtos"
          favoritePage={FAVORITE_PAGES.ESTOQUE_PRODUTOS_LISTAR}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Estoque", href: routes.inventory.root }, { label: "Produtos" }]}
          actions={[
            {
              key: "stock-balance",
              label: "Balanco",
              icon: IconClipboardCheck,
              onClick: () => navigate(routes.inventory.stockBalance.create),
              variant: "outline",
            },
            {
              key: "create",
              label: "Cadastrar",
              icon: IconPlus,
              onClick: () => navigate(routes.inventory.products.create),
              variant: "default",
            },
          ]}
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <ItemList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default ProductListPage;
