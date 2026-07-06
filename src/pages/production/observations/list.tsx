import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { ObservationTablePage } from "@/components/production/observation/list";
import { SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const ObservationsList = () => {
  // Track page for analytics
  usePageTracker({ title: "Observações - Lista", icon: "observations_list" });

  return (
    <PrivilegeRoute
      requiredPrivilege={[
        SECTOR_PRIVILEGES.PRODUCTION,
        SECTOR_PRIVILEGES.WAREHOUSE,
        SECTOR_PRIVILEGES.FINANCIAL,
        SECTOR_PRIVILEGES.COMMERCIAL,
        SECTOR_PRIVILEGES.ADMIN,
      ]}
    >
      <ObservationTablePage />
    </PrivilegeRoute>
  );
};
