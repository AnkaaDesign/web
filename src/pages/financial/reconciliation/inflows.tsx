import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { ConciliationWorkspace } from "@/components/financial/reconciliation/conciliation-workspace";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { SECTOR_PRIVILEGES } from "@/constants";

/**
 * Entradas — the CREDIT-side workspace (spec §4.4). Receipts are
 * matched against issued bank slips (ponte de boleto) and outbound NFs via the
 * same candidate/matching flow as Saídas.
 */
export const ReconciliationInflowsPage = () => {
  usePageTracker({ title: "Entradas", icon: "arrow-down-left" });
  return (
    <PrivilegeRoute
      requiredPrivilege={[
        SECTOR_PRIVILEGES.ADMIN,
        SECTOR_PRIVILEGES.FINANCIAL,
        SECTOR_PRIVILEGES.ACCOUNTING,
      ]}
    >
      <ConciliationWorkspace direction="CREDIT" />
    </PrivilegeRoute>
  );
};

export default ReconciliationInflowsPage;
