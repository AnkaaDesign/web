import { CategoryList } from "@/components/inventory/item/category/list/category-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { FAVORITE_PAGES, SECTOR_PRIVILEGES, routes } from "../../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconCategory, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

const CategoryListPage = () => {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Lista de Categorias",
    icon: "tag",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.BASIC}>
      <div className="flex flex-col h-full space-y-4">
        <PageHeader
          variant="default"
          title="Categorias"
          icon={IconCategory}
          favoritePage={FAVORITE_PAGES.ESTOQUE_PRODUTOS_CATEGORIAS_LISTAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Produtos", href: routes.inventory.products.list },
            { label: "Categorias" },
          ]}
          actions={[
            {
              key: "create",
              label: "Nova Categoria",
              icon: IconPlus,
              onClick: () => navigate(routes.inventory.products.categories.create),
              variant: "default",
            },
          ]}
        />
        <CategoryList className="flex-1" />
      </div>
    </PrivilegeRoute>
  );
};

export default CategoryListPage;
