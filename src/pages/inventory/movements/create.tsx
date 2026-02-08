import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../../constants";
import { ActivityBatchCreateForm } from "@/components/inventory/activity/form/activity-batch-create-form";

export const CreateMovementPage = () => {
  usePageTracker({
    title: "Cadastrar Movimentações",
    icon: "plus",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col">
        <ActivityBatchCreateForm />
      </div>
    </PrivilegeRoute>
  );
};
