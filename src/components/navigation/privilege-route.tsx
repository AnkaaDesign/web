import { useAuth } from "@/contexts/auth-context";
import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { IconLoader2, IconShield } from "@tabler/icons-react";
import { SECTOR_PRIVILEGES, routes } from "../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { hasAnyPrivilege, hasPrivilege } from "../../utils";

interface PrivilegeRouteProps {
  children: ReactNode;
  requiredPrivilege?: keyof typeof SECTOR_PRIVILEGES | (keyof typeof SECTOR_PRIVILEGES)[];
  fallbackRoute?: string;
}

type PrivilegeKey = keyof typeof SECTOR_PRIVILEGES;
type PrivilegeRequirement = PrivilegeKey | PrivilegeKey[];

/**
 * Check if user has required privilege(s)
 * Supports both single privileges and arrays of privileges
 */
function checkUserPrivileges(user: any, requiredPrivilege: PrivilegeRequirement, requireAll: boolean = false): boolean {
  if (!user || !requiredPrivilege) return false;

  // Handle array of privileges
  if (Array.isArray(requiredPrivilege)) {
    if (requireAll) {
      // AND logic - user must have ALL privileges
      return requiredPrivilege.every((privilege) => hasPrivilege(user, SECTOR_PRIVILEGES[privilege]));
    } else {
      // OR logic - user needs ANY of the privileges (default backend behavior)
      return hasAnyPrivilege(user, requiredPrivilege.map((p) => SECTOR_PRIVILEGES[p]) as SECTOR_PRIVILEGES[]);
    }
  }

  // Handle single privilege
  return hasPrivilege(user, SECTOR_PRIVILEGES[requiredPrivilege]);
}

function UnauthorizedAccess({ onGoBack }: { onGoBack: () => void }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-sm">
        <CardContent className="p-8 text-center space-y-6">
          <div className="flex justify-center">
            <IconShield className="h-16 w-16 text-red-500" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Acesso Negado</h1>
            <p className="text-gray-600 dark:text-gray-300">Você não tem permissão para acessar esta página.</p>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400">Entre em contato com um administrador para solicitar as permissões necessárias.</p>

            <Button onClick={onGoBack} variant="outline" className="w-full">
              Voltar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const PrivilegeRoute: React.FC<PrivilegeRouteProps> = ({ children, requiredPrivilege }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  // Show loading spinner while auth is being determined
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <IconLoader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Se o usuário não está autenticado, redireciona para a página de login
  if (!user) {
    return <Navigate to={routes.authentication.login} state={{ from: location }} replace />;
  }

  // Check if user has basic privileges and redirect to welcome
  const hasBasicPrivileges = !user.sector || user.sector.privileges === SECTOR_PRIVILEGES.BASIC;
  const isOnWelcomePage = location.pathname === "/";

  if (hasBasicPrivileges && !isOnWelcomePage) {
    return <Navigate to="/" replace />;
  }

  // If no specific privilege required, render children (for basic authenticated routes)
  if (!requiredPrivilege) {
    return <>{children}</>;
  }

  // Check if user has required privilege(s)
  const hasAccess = checkUserPrivileges(user, requiredPrivilege as PrivilegeRequirement);

  if (!hasAccess) {
    return <UnauthorizedAccess onGoBack={() => window.history.back()} />;
  }

  // User has required privilege, render children
  return <>{children}</>;
};
