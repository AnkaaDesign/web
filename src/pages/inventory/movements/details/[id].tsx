import { usePageTracker } from "@/hooks/use-page-tracker";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../../../constants";
import ActivityDetail from "@/components/inventory/activity/detail/activity-detail";

export const MovementDetailsPage = () => {
  usePageTracker({
    title: "Detalhes da Movimentação",
    icon: "eye",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]}>
      <ActivityDetail />
    </PrivilegeRoute>
  );
};

export default MovementDetailsPage;
