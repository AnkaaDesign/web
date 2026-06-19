import { ReceivablesList } from "@/components/financial/receivables/receivables-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const ReceivablesListPage = () => {
  // Track page access
  usePageTracker({
    title: "Contas a Receber",
    icon: "receipt-2",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Contas a Receber"
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Financeiro", href: routes.financial.root }, { label: "Contas a Receber" }]}
          className="flex-shrink-0"
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <ReceivablesList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default ReceivablesListPage;
