import { ItemTablePage } from "@/components/inventory/item/table";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const ProductListPage = () => {
  // Track page access
  usePageTracker({
    title: "Lista de Produtos",
    icon: "package",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <ItemTablePage />
    </PrivilegeRoute>
  );
};

export default ProductListPage;
