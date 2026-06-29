import { UserTablePage } from "@/components/administration/user/table";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

const CollaboratorListPage = () => {
  // Track page access
  usePageTracker({
    title: "Lista de Colaboradores",
    icon: "users",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.PRODUCTION_MANAGER, SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES]}>
      <UserTablePage />
    </PrivilegeRoute>
  );
};

export default CollaboratorListPage;
