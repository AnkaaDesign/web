import { BrandList } from "@/components/inventory/item/brand/list/brand-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { FAVORITE_PAGES, SECTOR_PRIVILEGES, routes } from "../../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

const BrandListPage = () => {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Lista de Marcas",
    icon: "tag",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.BASIC}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Marcas"
          favoritePage={FAVORITE_PAGES.ESTOQUE_PRODUTOS_MARCAS_LISTAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Produtos", href: routes.inventory.products.list },
            { label: "Marcas" },
          ]}
          actions={[
            {
              key: "create",
              label: "Nova Marca",
              icon: IconPlus,
              onClick: () => navigate(routes.inventory.products.brands.create),
              variant: "default",
            },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <BrandList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default BrandListPage;
