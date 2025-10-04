import { useAuth } from "@/contexts/auth-context";
import { SECTOR_PRIVILEGES, routes } from "../../constants";
import { hasPrivilege } from "../../utils";
import { Navigate } from "react-router-dom";
import { ServerRootPage } from "./root";

export function ServerRootWrapper() {
  const { user } = useAuth();

  // Check admin privileges
  const isAdmin = user?.sector?.privileges ? hasPrivilege(user as any, SECTOR_PRIVILEGES.ADMIN) : false;

  if (!user || !isAdmin) {
    return <Navigate to={routes.home} replace />;
  }

  return <ServerRootPage />;
}
