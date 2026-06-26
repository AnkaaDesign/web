import { AccountsPayableList } from "@/components/financial/accounts-payable/accounts-payable-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const AccountsPayableListPage = () => {
  // Track page access
  usePageTracker({
    title: "Contas a Pagar",
    icon: "receipt-2",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Contas a Pagar"
          favoritePage={FAVORITE_PAGES.FINANCEIRO_CONTAS_A_PAGAR_LISTAR}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Financeiro", href: routes.financial.root }, { label: "Conciliação Bancária", href: routes.financial.reconciliation.root }, { label: "Contas a Pagar" }]}
          className="flex-shrink-0"
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <AccountsPayableList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default AccountsPayableListPage;
