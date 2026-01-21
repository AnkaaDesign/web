import { CustomerList } from "@/components/administration/customer/list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { hasPrivilege } from "@/utils";

export const CustomerListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Track page access
  usePageTracker({
    title: "Lista de Clientes",
    icon: "users",
  });

  // ADMIN, COMMERCIAL, FINANCIAL, and LOGISTIC can create customers
  const canCreate = user && (hasPrivilege(user, SECTOR_PRIVILEGES.ADMIN) || hasPrivilege(user, SECTOR_PRIVILEGES.COMMERCIAL) || hasPrivilege(user, SECTOR_PRIVILEGES.FINANCIAL) || hasPrivilege(user, SECTOR_PRIVILEGES.LOGISTIC));

  return (
    <PrivilegeRoute requiredPrivilege={["BASIC", "FINANCIAL", "LOGISTIC", "COMMERCIAL", "ADMIN"]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Clientes"
          favoritePage={FAVORITE_PAGES.ADMINISTRACAO_CLIENTES_LISTAR}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Administração", href: routes.administration.root }, { label: "Clientes" }]}
          actions={canCreate ? [
            {
              key: "create",
              label: "Cadastrar",
              icon: IconPlus,
              onClick: () => navigate(routes.administration.customers.create),
              variant: "default" as const,
            },
          ] : []}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <CustomerList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
