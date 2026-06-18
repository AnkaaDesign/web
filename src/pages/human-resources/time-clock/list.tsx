import { Navigate } from "react-router-dom";
import { getLastTimeClockPage } from "./time-clock-tabs";
import { useAuth } from "@/contexts/auth-context";
import { hasAnyPrivilege } from "@/utils/user";
import { SECTOR_PRIVILEGES } from "../../../constants";

// /departamento-pessoal/controle-ponto is just an entry point — the views are real
// subpages, each with its own sidebar submenu. Redirect to the last subpage the
// user visited (falls back to Colaborador, which is open to everyone).
export default function TimeClockListPage() {
  const { user } = useAuth();
  const canEdit = hasAnyPrivilege(user as any, [
    SECTOR_PRIVILEGES.HUMAN_RESOURCES,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
  return <Navigate to={getLastTimeClockPage(canEdit)} replace />;
}
