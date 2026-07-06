import { SECTOR_PRIVILEGES } from "../../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { AirbrushingDetailPage } from "@/components/production/airbrushing/detail-page";

export const AirbrushingDetails = () => {
  // Track page access
  usePageTracker({ title: "Aerografia - Detalhes", icon: "airbrushing_detail" });

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
      <AirbrushingDetailPage />
    </PrivilegeRoute>
  );
};
