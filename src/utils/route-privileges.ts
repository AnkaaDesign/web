import { SECTOR_PRIVILEGES } from "../constants";
import { routes } from "../constants";

// Enhanced route privilege mappings with support for arrays and granular permissions
export const ROUTE_PRIVILEGES: Record<string, keyof typeof SECTOR_PRIVILEGES | (keyof typeof SECTOR_PRIVILEGES)[]> = {
  // Home - Basic access (all authenticated users can access)
  "/": "BASIC",

  // Administração - Admin access with specific granular permissions
  "/administracao": "ADMIN",
  "/administracao/clientes": "ADMIN",
  "/administracao/registros-de-alteracoes": "ADMIN",
  "/administracao/arquivos": "ADMIN",
  "/administracao/notificacoes": "ADMIN",

  // Estatísticas - Leader/Admin access
  "/statistics": ["LEADER", "ADMIN"],
  "/statistics/*": ["LEADER", "ADMIN"],

  // Estoque - Warehouse operations with granular permissions
  [routes.inventory.root]: "WAREHOUSE",
  [routes.inventory.products.root]: "WAREHOUSE",
  [routes.inventory.products.categories.root]: "WAREHOUSE",
  [routes.inventory.products.brands.root]: "WAREHOUSE",
  [routes.inventory.suppliers.root]: "WAREHOUSE",
  [routes.inventory.orders.root]: "WAREHOUSE",
  [routes.inventory.orders.automatic.root]: "ADMIN", // Automatic orders require admin
  [routes.inventory.maintenance.root]: ["WAREHOUSE", "MAINTENANCE", "ADMIN"], // Maintenance operations
  [routes.inventory.ppe.root]: "WAREHOUSE",
  [routes.inventory.ppe.deliveries.root]: ["HUMAN_RESOURCES", "ADMIN"], // PPE deliveries
  [routes.inventory.ppe.deliveries.create]: ["HUMAN_RESOURCES", "ADMIN"],
  [routes.inventory.loans.root]: "WAREHOUSE",
  [routes.inventory.externalWithdrawals.root]: "WAREHOUSE",

  // Personal - Basic access (personal info)
  "/pessoal": "BASIC",
  "/pessoal/*": "BASIC",

  // Meu Pessoal - Leader access (sector employee management)
  "/meu-pessoal": "LEADER",

  // Pintura - Production/Warehouse operations
  "/pintura": ["PRODUCTION", "WAREHOUSE", "ADMIN"],
  "/pintura/catalogo": ["PRODUCTION", "WAREHOUSE", "ADMIN"],
  "/pintura/producoes": ["PRODUCTION", "WAREHOUSE", "ADMIN"],
  "/pintura/tipos-de-tinta": ["PRODUCTION", "WAREHOUSE", "ADMIN"],
  "/pintura/formulas": ["PRODUCTION", "WAREHOUSE", "ADMIN"],

  // Produção - Production with leadership requirements for sensitive operations
  // WAREHOUSE has read access to all production routes, write access only to cut-related routes
  [routes.production.root]: ["PRODUCTION", "WAREHOUSE"], // WAREHOUSE can view production content
  [routes.production.schedule.root]: ["PRODUCTION", "WAREHOUSE"], // WAREHOUSE can view schedule
  [routes.production.schedule.create]: "PRODUCTION", // Only PRODUCTION can create
  "/producao/cronograma/editar": "PRODUCTION", // Only PRODUCTION can edit (dynamic route)
  [routes.production.scheduleOnHold]: ["PRODUCTION", "WAREHOUSE"],
  [routes.production.history.root]: ["PRODUCTION", "WAREHOUSE"], // WAREHOUSE can view history
  [routes.production.history.completed]: ["LEADER", "ADMIN"],
  [routes.production.history.cancelled]: ["PRODUCTION", "WAREHOUSE"],

  // Cut-related routes - All roles can view cuts, cut requests are created via right-click menu
  [routes.production.cutting.root]: ["LEADER", "WAREHOUSE", "ADMIN"],

  // Other production routes - WAREHOUSE has read-only access
  [routes.production.garages.root]: ["PRODUCTION", "WAREHOUSE"], // WAREHOUSE can view
  [routes.production.garages.create]: "PRODUCTION", // Only PRODUCTION can create
  "/producao/garagens/editar": "PRODUCTION", // Only PRODUCTION can edit (dynamic route)
  [routes.production.serviceOrders.root]: ["PRODUCTION", "WAREHOUSE"], // WAREHOUSE can view
  [routes.production.serviceOrders.create]: "PRODUCTION", // Only PRODUCTION can create
  "/producao/ordens-de-servico/editar": "PRODUCTION", // Only PRODUCTION can edit (dynamic route)
  [routes.production.observations.root]: ["PRODUCTION", "WAREHOUSE"], // WAREHOUSE can view
  [routes.production.observations.create]: "PRODUCTION", // Only PRODUCTION can create
  "/producao/observacoes/editar": "PRODUCTION", // Only PRODUCTION can edit (dynamic route)

  // Registro de Ponto - Basic access
  "/registro-de-ponto": "BASIC",

  // Recursos Humanos - HR with admin requirements for sensitive operations
  "/recursos-humanos": "HUMAN_RESOURCES",
  "/recursos-humanos/colaboradores": "HUMAN_RESOURCES",
  "/recursos-humanos/colaboradores/cadastrar": "ADMIN", // Employee creation requires admin
  "/recursos-humanos/setores": "HUMAN_RESOURCES",
  "/recursos-humanos/setores/cadastrar": "ADMIN", // Department creation requires admin
  "/recursos-humanos/cargos": "HUMAN_RESOURCES",
  "/recursos-humanos/cargos/cadastrar": "ADMIN", // Position creation requires admin
  "/recursos-humanos/ferias": "HUMAN_RESOURCES",
  "/recursos-humanos/feriados": "HUMAN_RESOURCES",
  "/recursos-humanos/advertencias": "HUMAN_RESOURCES",
  "/recursos-humanos/ppe": "HUMAN_RESOURCES",
  "/recursos-humanos/ppe/entregas": ["HUMAN_RESOURCES", "ADMIN"],
  "/recursos-humanos/ppe/entregas/cadastrar": ["HUMAN_RESOURCES", "ADMIN"],

  // Human Resources - HR with admin requirements for sensitive operations (new English routes)
  "/human-resources": "HUMAN_RESOURCES",
  "/human-resources/employees": "HUMAN_RESOURCES",
  "/human-resources/employees/create": "ADMIN", // Employee creation requires admin
  "/human-resources/vacations": "HUMAN_RESOURCES",

  // Catalog routes (basic access for leaders)
  [routes.catalog.root]: "LEADER",
  [routes.catalog.details(":id")]: "LEADER",

  // Maintenance routes (maintenance access for technicians)
  [routes.maintenance.root]: "MAINTENANCE",
  [routes.maintenance.create]: "MAINTENANCE",
  "/manutencao/editar/:id": "MAINTENANCE", // Dynamic route for editing
  [routes.maintenance.details(":id")]: "MAINTENANCE",

  // My Team routes (team management for leaders)
  [routes.myTeam.vacations]: "LEADER",
  [routes.myTeam.warnings]: "LEADER",
  [routes.myTeam.loans]: "LEADER",

  // Fallback patterns (for broader route matching)
  "/administracao/*": "ADMIN",
  [`${routes.inventory.root}/*`]: "WAREHOUSE",
  "/pintura/*": ["PRODUCTION", "WAREHOUSE", "ADMIN"],
  [`${routes.production.root}/*`]: ["PRODUCTION", "WAREHOUSE"], // WAREHOUSE has read access to production routes
  "/recursos-humanos/*": "HUMAN_RESOURCES",
  "/human-resources/*": "HUMAN_RESOURCES",
  "/meu-pessoal/*": "LEADER",
  "/manutencao/*": "MAINTENANCE",
};

// Helper function to get required privilege(s) for a route
// Returns single privilege or array of privileges
export function getRequiredPrivilegeForRoute(pathname: string): keyof typeof SECTOR_PRIVILEGES | (keyof typeof SECTOR_PRIVILEGES)[] | undefined {
  // First check for exact match
  if (ROUTE_PRIVILEGES[pathname]) {
    return ROUTE_PRIVILEGES[pathname];
  }

  // Then check for wildcard matches (specific routes first, then fallbacks)
  const matchingRoutes = Object.entries(ROUTE_PRIVILEGES)
    .filter(([routePattern]) => routePattern.endsWith("/*"))
    .sort(([a], [b]) => b.length - a.length); // Sort by specificity (longer patterns first)

  for (const [routePattern, privilege] of matchingRoutes) {
    const baseRoute = routePattern.slice(0, -2); // Remove /*
    if (pathname.startsWith(baseRoute + "/") || pathname === baseRoute) {
      return privilege;
    }
  }

  // Default to admin for unmatched routes (safe default)
  return "ADMIN";
}

// Helper function to check if a route requires specific privileges
export function routeRequiresPrivilege(pathname: string): boolean {
  const requiredPrivilege = getRequiredPrivilegeForRoute(pathname);

  if (Array.isArray(requiredPrivilege)) {
    // If it's an array, check if any privilege is more than BASIC
    return requiredPrivilege.some((privilege) => privilege !== "BASIC");
  }

  return requiredPrivilege !== "BASIC";
}

// Helper function to check if a route requires admin privileges
export function routeRequiresAdmin(pathname: string): boolean {
  const requiredPrivilege = getRequiredPrivilegeForRoute(pathname);

  if (Array.isArray(requiredPrivilege)) {
    // If it's an array, check if ADMIN is required
    return requiredPrivilege.includes("ADMIN");
  }

  return requiredPrivilege === "ADMIN";
}

// Helper function to get privilege display text for UI
export function getPrivilegeDisplayText(privilege: keyof typeof SECTOR_PRIVILEGES | (keyof typeof SECTOR_PRIVILEGES)[]): string {
  if (Array.isArray(privilege)) {
    return privilege.join(" ou "); // "WAREHOUSE ou ADMIN"
  }
  return privilege;
}

// Helper function for development/debugging
export function getRoutePrivilegeInfo(pathname: string) {
  const privilege = getRequiredPrivilegeForRoute(pathname);
  return {
    route: pathname,
    privilege,
    isArray: Array.isArray(privilege),
    requiresPrivilege: routeRequiresPrivilege(pathname),
    requiresAdmin: routeRequiresAdmin(pathname),
    displayText: getPrivilegeDisplayText(privilege as any),
  };
}
