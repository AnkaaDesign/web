import { usePageTracker } from "@/hooks/use-page-tracker";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../../constants";
import { ExternalWithdrawalCreateForm } from "@/components/inventory/external-withdrawal/form/external-withdrawal-create-form";

export const ExternalWithdrawalCreate = () => {
  usePageTracker({
    title: "Cadastrar Retirada Externa",
    icon: "plus",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]}>
      <ExternalWithdrawalCreateForm />
    </PrivilegeRoute>
  );
};
