import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PaintingBudgetTablePage } from "@/components/administration/painting-budget/list/painting-budget-table-page";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { SECTOR_PRIVILEGES } from "../../../constants";

const ALLOWED = [
  SECTOR_PRIVILEGES.ADMIN,
  SECTOR_PRIVILEGES.COMMERCIAL,
  SECTOR_PRIVILEGES.FINANCIAL,
  SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
  SECTOR_PRIVILEGES.ACCOUNTING,
];

export function PaintingBudgetListPage() {
  usePageTracker({ title: "Orçamentos de Pintura", icon: "calculator" });
  return (
    <PrivilegeRoute requiredPrivilege={ALLOWED}>
      <PaintingBudgetTablePage />
    </PrivilegeRoute>
  );
}

export default PaintingBudgetListPage;
