import { BrandList } from "@/components/inventory/item/brand/list/brand-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { FAVORITE_PAGES, SECTOR_PRIVILEGES, routes } from "../../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconTag, IconPlus } from "@tabler/icons-react";
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
      <div className="flex flex-col h-full space-y-4 min-h-0">
        <PageHeader
          variant="default"
          title="Marcas"
          icon={IconTag}
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
        />
        <BrandList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};

export default BrandListPage;
