import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../../constants";
import { ExternalOperationCreateForm } from "@/components/inventory/external-operation/form/external-operation-create-form";

export const ExternalOperationCreate = () => {
  usePageTracker({
    title: "Cadastrar Operação Externa",
    icon: "plus",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <ExternalOperationCreateForm />
    </PrivilegeRoute>
  );
};
