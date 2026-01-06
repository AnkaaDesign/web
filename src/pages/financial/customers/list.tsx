import { CustomerList } from "@/components/administration/customer/list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { LIST_PAGE_SPACING } from "@/lib/layout-constants";
import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export const FinancialCustomersListPage = () => {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Clientes - Financeiro",
    icon: "users",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col px-4 pt-4">
        <PageHeader
          title="Clientes"
          favoritePage={FAVORITE_PAGES.FINANCEIRO_CLIENTES_LISTAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: "/financeiro" },
            { label: "Clientes" },
          ]}
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
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="mt-4 space-y-4">
            <CustomerList className="flex-1 min-h-0" />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default FinancialCustomersListPage;
