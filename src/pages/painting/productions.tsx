import ProductionsListPage from "./productions/list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";

export function PaintProductionsPage() {
  // Track page access
  usePageTracker({
    title: "Produções de Tinta",
    icon: "flask",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]}>
      <ProductionsListPage />
    </PrivilegeRoute>
  );
}
