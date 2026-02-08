import { SupplierList } from "@/components/inventory/supplier/list/supplier-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { IconPlus } from "@tabler/icons-react";
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
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Fornecedores"
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
          className="flex-shrink-0"
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <SupplierList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
