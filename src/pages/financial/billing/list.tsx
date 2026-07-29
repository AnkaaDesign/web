import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { BillingTablePage } from "@/components/financial/billing/table";
import { SECTOR_PRIVILEGES } from "@/constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const BillingPage = () => {
  usePageTracker({
    title: "Faturamento",
    icon: "file-invoice",
  });

  return (
    <PrivilegeRoute
      requiredPrivilege={[SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ACCOUNTING]}
    >
      <BillingTablePage />
    </PrivilegeRoute>
  );
};

export default BillingPage;
