import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { ConciliationWorkspace } from "@/components/financial/reconciliation/conciliation-workspace";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { SECTOR_PRIVILEGES } from "@/constants";

/** Saídas — the DEBIT-side conciliation workspace (spec §4.2). */
export const ReconciliationOutflowsPage = () => {
  usePageTracker({ title: "Saídas", icon: "arrow-up-right" });
  return (
    <PrivilegeRoute
      requiredPrivilege={[
        SECTOR_PRIVILEGES.ADMIN,
        SECTOR_PRIVILEGES.FINANCIAL,
        SECTOR_PRIVILEGES.ACCOUNTING,
      ]}
    >
      <ConciliationWorkspace direction="DEBIT" />
    </PrivilegeRoute>
  );
};

export default ReconciliationOutflowsPage;
