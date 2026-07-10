import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { ProductionAvailabilityPlanner } from "@/components/painting/production-availability";
import { SECTOR_PRIVILEGES } from "@/constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export default function ProductionAvailabilityPage() {
  usePageTracker({
    title: "Disponibilidade de Produção",
    icon: "calculator",
  });

  return (
    <PrivilegeRoute
      requiredPrivilege={[
        SECTOR_PRIVILEGES.PRODUCTION,
        SECTOR_PRIVILEGES.WAREHOUSE,
        SECTOR_PRIVILEGES.ADMIN,
      ]}
    >
      <div className="flex h-full flex-col overflow-hidden px-4 pt-4">
        <ProductionAvailabilityPlanner />
      </div>
    </PrivilegeRoute>
  );
}
