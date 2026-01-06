import { usePageTracker } from "@/hooks/use-page-tracker";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../../constants";
import { BorrowBatchCreateForm } from "@/components/inventory/borrow/form/borrow-batch-create-form";

export const LoanCreate = () => {
  usePageTracker({
    title: "Novo Empréstimo",
    icon: "package",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]}>
      <BorrowBatchCreateForm />
    </PrivilegeRoute>
  );
};
