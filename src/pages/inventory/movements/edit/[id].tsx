import { usePageTracker } from "@/hooks/use-page-tracker";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../../../constants";
import { ActivityEditWrapper } from "@/components/inventory/activity/form";

export const EditMovementPage = () => {
  usePageTracker({
    title: "Editar Movimentação",
    icon: "edit",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]}>
      <ActivityEditWrapper />
    </PrivilegeRoute>
  );
};
