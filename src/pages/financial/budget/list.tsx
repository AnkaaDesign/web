import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { BudgetTablePage } from "@/components/financial/budget/table";
import { SECTOR_PRIVILEGES } from "@/constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const BudgetListPage = () => {
  usePageTracker({
    title: "Orçamentos",
    icon: "file-description",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL]}>
      <BudgetTablePage />
    </PrivilegeRoute>
  );
};

export default BudgetListPage;
