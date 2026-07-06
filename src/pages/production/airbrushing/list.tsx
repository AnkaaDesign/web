import { AirbrushingTablePage } from "@/components/production/airbrushing/table";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const AirbrushingListPage = () => {
  // Track page for analytics
  usePageTracker({ title: "Aerografia - Lista" });

  return (
    <PrivilegeRoute
      requiredPrivilege={[
        SECTOR_PRIVILEGES.PRODUCTION,
        SECTOR_PRIVILEGES.FINANCIAL,
        SECTOR_PRIVILEGES.ACCOUNTING,
        SECTOR_PRIVILEGES.COMMERCIAL,
        SECTOR_PRIVILEGES.ADMIN,
      ]}
    >
      <AirbrushingTablePage />
    </PrivilegeRoute>
  );
};
