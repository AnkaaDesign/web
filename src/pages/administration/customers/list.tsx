import { CustomerList } from "@/components/administration/customer/list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconUsers, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export const CustomerListPage = () => {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Lista de Clientes",
    icon: "users",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.BASIC}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Clientes"
            icon={IconUsers}
            favoritePage={FAVORITE_PAGES.ADMINISTRACAO_CLIENTES_LISTAR}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Administração", href: routes.administration.root }, { label: "Clientes" }]}
            actions={[
              {
                key: "create",
                label: "Cadastrar",
                icon: IconPlus,
                onClick: () => navigate(routes.administration.customers.create),
                variant: "default" as const,
              },
            ]}
          />
        </div>
        <CustomerList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};
