import { useState } from "react";
import { IconPlus } from "@tabler/icons-react";

import { AccountsPayableList } from "@/components/financial/accounts-payable/accounts-payable-list";
import { QuickPayableDialog } from "@/components/financial/accounts-payable/quick-payable-dialog";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { usePrivileges } from "@/hooks/common/use-privileges";

// Financial-only: WAREHOUSE manages orders but never creates a payable.
const PAYMENT_MANAGER_PRIVILEGES: SECTOR_PRIVILEGES[] = [
  SECTOR_PRIVILEGES.FINANCIAL,
  SECTOR_PRIVILEGES.ACCOUNTING,
  SECTOR_PRIVILEGES.ADMIN,
];

export const AccountsPayableListPage = () => {
  // Track page access
  usePageTracker({
    title: "Contas a Pagar",
    icon: "receipt-2",
  });

  const { hasAnyPrivilegeAccess } = usePrivileges();
  const canManagePayments = hasAnyPrivilegeAccess(PAYMENT_MANAGER_PRIVILEGES);

  // Quick-create for a one-off (non-recurring) bill. It lives here rather than in
  // the table toolbar so "Nova conta" sits where every other list page puts its
  // primary action — including Contas Recorrentes, right next door.
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Contas a Pagar"
          favoritePage={FAVORITE_PAGES.FINANCEIRO_CONTAS_A_PAGAR_LISTAR}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Financeiro", href: routes.financial.root }, { label: "Contas a Pagar" }]}
          actions={
            canManagePayments
              ? [
                  {
                    key: "create",
                    label: "Nova conta",
                    icon: IconPlus,
                    onClick: () => setQuickCreateOpen(true),
                    variant: "default" as const,
                  },
                ]
              : []
          }
          className="flex-shrink-0"
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <AccountsPayableList className="h-full" />
        </div>
      </div>

      <QuickPayableDialog open={quickCreateOpen} onOpenChange={setQuickCreateOpen} />
    </PrivilegeRoute>
  );
};

export default AccountsPayableListPage;
