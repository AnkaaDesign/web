import type { ReactNode } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Navigate, useLocation } from "react-router-dom";
import { IconLoader2, IconShield } from "@tabler/icons-react";
import { SECTOR_PRIVILEGES, routes } from "../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getRequiredPrivilegeForRoute } from "@/utils/route-privileges";
import { hasAnyPrivilege, hasPrivilege, getSectorPrivilegesLabel } from "../../utils";

interface AutoPrivilegeRouteProps {
  children: ReactNode;
}

/**
 * Check if user has required privilege(s) for route access
 * Supports both single privileges and arrays of privileges (OR logic)
 */
function hasRequiredPrivilegeForRoute(user: any, requiredPrivilege: keyof typeof SECTOR_PRIVILEGES | (keyof typeof SECTOR_PRIVILEGES)[]): boolean {
  if (!user || !requiredPrivilege) return false;

  // Handle array of privileges (OR logic - user needs ANY of the privileges)
  if (Array.isArray(requiredPrivilege)) {
    const privilegeValues = requiredPrivilege.map((key) => SECTOR_PRIVILEGES[key]);
    return hasAnyPrivilege(user, privilegeValues);
  }

  // Handle single privilege
  return hasPrivilege(user, SECTOR_PRIVILEGES[requiredPrivilege]);
}

/**
 * Helper function to get privilege labels for arrays
 * Uses existing getSectorPrivilegesLabel utility for single privileges
 */
function getRequiredPrivilegeLabels(requiredPrivilege: keyof typeof SECTOR_PRIVILEGES | (keyof typeof SECTOR_PRIVILEGES)[]): string {
  if (Array.isArray(requiredPrivilege)) {
    return requiredPrivilege.map((key) => getSectorPrivilegesLabel(SECTOR_PRIVILEGES[key])).join(", ");
  }

  return getSectorPrivilegesLabel(SECTOR_PRIVILEGES[requiredPrivilege]);
}

/**
 * Helper function to get user privilege labels
 * Handles user's sector privileges properly using existing utilities
 */
function getUserPrivilegeLabels(user: any): string {
  if (!user?.sector?.privileges) {
    return "Nenhuma";
  }

  // If privileges is an array
  if (Array.isArray(user.sector.privileges)) {
    return user.sector.privileges.map((privilege: SECTOR_PRIVILEGES) => getSectorPrivilegesLabel(privilege)).join(", ");
  }

  // If privileges is a single value
  if (typeof user.sector.privileges === "string") {
    return getSectorPrivilegesLabel(user.sector.privileges as SECTOR_PRIVILEGES);
  }

  // Fallback
  return user.sector.privileges.toString();
}

function UnauthorizedAccess({ currentRoute, requiredPrivilege }: { currentRoute: string; requiredPrivilege: keyof typeof SECTOR_PRIVILEGES | (keyof typeof SECTOR_PRIVILEGES)[] }) {
  const { user, logout } = useAuth();

  const handleGoBack = () => {
    window.history.back();
  };

  const handleGoHome = () => {
    window.location.href = routes.home;
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = routes.authentication.login;
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-sm">
        <CardContent className="p-8 text-center space-y-6">
          <div className="flex justify-center">
            <IconShield className="h-16 w-16 text-destructive" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-card-foreground">Acesso Negado</h1>
            <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
          </div>

          <div className="bg-destructive/10 p-4 rounded-lg">
            <p className="text-sm text-destructive">
              <strong>Página:</strong> {currentRoute}
            </p>
            <p className="text-sm text-destructive">
              <strong>Permissão necessária:</strong> {getRequiredPrivilegeLabels(requiredPrivilege)}
            </p>
            <p className="text-sm text-destructive">
              <strong>Sua permissão:</strong> {getUserPrivilegeLabels(user)}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Entre em contato com um administrador para solicitar as permissões necessárias.</p>

            <div className="space-y-2">
              <Button onClick={handleGoHome} className="w-full">
                Ir para Página Inicial
              </Button>

              <Button onClick={handleGoBack} variant="outline" className="w-full">
                Voltar
              </Button>

              <Button onClick={handleLogout} variant="ghost" className="w-full text-muted-foreground">
                Sair da Conta
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const AutoPrivilegeRoute: React.FC<AutoPrivilegeRouteProps> = ({ children }) => {
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

  // Get required privilege for current route
  const requiredPrivilege = getRequiredPrivilegeForRoute(location.pathname);

  // Check if user has basic privileges and redirect to welcome if trying to access routes that require higher privileges
  const hasBasicPrivileges = !user.sector || user.sector.privileges === SECTOR_PRIVILEGES.BASIC;
  const isOnWelcomePage = location.pathname === "/";

  // Only redirect basic users if the route requires MORE than basic privileges
  const routeRequiresMoreThanBasic = requiredPrivilege && requiredPrivilege !== "BASIC" &&
    !(Array.isArray(requiredPrivilege) && requiredPrivilege.includes("BASIC"));

  if (hasBasicPrivileges && !isOnWelcomePage && routeRequiresMoreThanBasic) {
    return <Navigate to="/" replace />;
  }

  // Only check privilege if it's defined (route requires specific privilege)
  if (requiredPrivilege) {
    // Check if user has required privilege(s)
    const hasAccess = hasRequiredPrivilegeForRoute(user, requiredPrivilege as keyof typeof SECTOR_PRIVILEGES | (keyof typeof SECTOR_PRIVILEGES)[]);

    if (!hasAccess) {
      return <UnauthorizedAccess currentRoute={location.pathname} requiredPrivilege={requiredPrivilege as keyof typeof SECTOR_PRIVILEGES | (keyof typeof SECTOR_PRIVILEGES)[]} />;
    }
  }

  // User has required privilege, render children
  return <>{children}</>;
};
