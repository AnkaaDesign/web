import { SECTOR_PRIVILEGES } from "../constants";
import { routes } from "../constants";

// Enhanced route privilege mappings with support for arrays and granular permissions
export const ROUTE_PRIVILEGES: Record<string, keyof typeof SECTOR_PRIVILEGES | (keyof typeof SECTOR_PRIVILEGES)[]> = {
  // Home - Basic access (all authenticated users can access)
  "/": "BASIC",

  // Administração - Admin access with specific granular permissions
  "/administracao": "ADMIN",
  "/administracao/clientes": ["ADMIN", "FINANCIAL"], // Financial sector can access customers
  "/administracao/registros-de-alteracoes": "ADMIN",
  "/administracao/arquivos": "ADMIN",
  "/administracao/notificacoes": "ADMIN",

  // Financeiro - Financial sector routes
  "/financeiro": "FINANCIAL",
  "/financeiro/*": "FINANCIAL",
  "/financeiro/clientes": "FINANCIAL", // Direct route to Financial customers page
  "/financeiro/producao": "FINANCIAL", // Redirects to /producao
  "/financeiro/producao/aerografia": "FINANCIAL", // Redirects to /producao/aerografia/listar
  "/financeiro/producao/cronograma": "FINANCIAL", // Redirects to /producao/cronograma (tasks)
  "/financeiro/producao/em-espera": "FINANCIAL", // Redirects to /producao/em-espera
  "/financeiro/producao/historico-tarefas": "FINANCIAL", // Redirects to /producao/historico

  // Estatísticas - Leader/Admin access
  "/statistics": ["LEADER", "ADMIN"],
  "/statistics/*": ["LEADER", "ADMIN"],

  // Estoque - Warehouse operations with full access
  // WAREHOUSE has full access to all inventory routes including create, edit, and delete operations
  [routes.inventory.root]: "WAREHOUSE",
  [routes.inventory.products.root]: "WAREHOUSE",
  [routes.inventory.products.categories.root]: "WAREHOUSE",
  [routes.inventory.products.brands.root]: "WAREHOUSE",
  [routes.inventory.suppliers.root]: "WAREHOUSE",
  [routes.inventory.orders.root]: "WAREHOUSE",
  [routes.inventory.orders.automatic.root]: "ADMIN", // Automatic orders require admin
  [routes.inventory.maintenance.root]: ["WAREHOUSE", "MAINTENANCE", "ADMIN"], // Maintenance operations
  [routes.inventory.ppe.root]: "WAREHOUSE",
  [routes.inventory.ppe.deliveries.root]: ["HUMAN_RESOURCES", "WAREHOUSE", "ADMIN"], // PPE deliveries - Warehouse can view and mark as delivered
  [routes.inventory.ppe.deliveries.create]: ["HUMAN_RESOURCES", "ADMIN"], // Only HR and Admin can create
  [routes.inventory.ppe.schedules.root]: ["HUMAN_RESOURCES", "WAREHOUSE", "ADMIN"], // PPE schedules - Warehouse can view
  [routes.inventory.ppe.schedules.create]: ["HUMAN_RESOURCES", "ADMIN"], // Only HR and Admin can create schedules
  "/estoque/epi/agendamentos/editar/:id": ["HUMAN_RESOURCES", "ADMIN"], // Only HR and Admin can edit schedules - dynamic route
  [routes.inventory.loans.root]: "WAREHOUSE",
  [routes.inventory.externalWithdrawals.root]: "WAREHOUSE",

  // Profile - Basic access (all authenticated users)
  "/perfil": "BASIC",

  // Personal - Basic access (personal info)
  "/pessoal": "BASIC",
  "/pessoal/*": "BASIC",

  // Meu Pessoal - Leader access (sector employee management)
  "/meu-pessoal": "LEADER",

  // Pintura - Production/Warehouse/Designer operations
  "/pintura": ["PRODUCTION", "WAREHOUSE", "DESIGNER", "ADMIN"],
  "/pintura/catalogo": ["PRODUCTION", "WAREHOUSE", "DESIGNER", "ADMIN"],
  "/pintura/producoes": ["PRODUCTION", "WAREHOUSE", "ADMIN"], // Designer excluded from paint productions
  "/pintura/tipos-de-tinta": ["PRODUCTION", "WAREHOUSE", "ADMIN"], // Designer excluded from paint types
  "/pintura/formulas": ["PRODUCTION", "WAREHOUSE", "ADMIN"], // Designer excluded from formulas

  // Produção - Production with full WAREHOUSE access, read-only DESIGNER, FINANCIAL, and LOGISTIC access
  // WAREHOUSE has full access to all production routes including create, edit, and delete operations
  // DESIGNER has read-only access to schedule, on-hold, history, and cuts
  // FINANCIAL has read-only access to production schedule, on-hold, history, and airbrushings routes
  // LOGISTIC has read-only access to schedule, on-hold, history, and garages (can edit layout only)
  [routes.production.root]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC"], // DESIGNER, FINANCIAL, and LOGISTIC can view
  [routes.production.schedule.root]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC"], // DESIGNER, FINANCIAL, and LOGISTIC can view schedule
  [routes.production.schedule.create]: ["PRODUCTION", "WAREHOUSE"], // DESIGNER and FINANCIAL excluded (cannot create)
  "/producao/cronograma/detalhes/:id": ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "LEADER", "ADMIN"], // Task detail page
  "/producao/cronograma/editar/:id": ["PRODUCTION", "WAREHOUSE", "FINANCIAL", "LOGISTIC", "LEADER", "ADMIN"], // FINANCIAL and LOGISTIC can edit with restrictions
  [routes.production.scheduleOnHold.root]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC"], // DESIGNER, FINANCIAL, and LOGISTIC can view on-hold
  "/producao/em-espera/detalhes/:id": ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "LEADER", "ADMIN"], // On-hold task detail
  [routes.production.history.root]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC"], // DESIGNER, FINANCIAL, and LOGISTIC can view history
  [routes.production.history.completed]: ["LEADER", "ADMIN"],
  [routes.production.history.cancelled]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC"],
  "/producao/historico/detalhes/:id": ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "LEADER", "ADMIN"], // History detail page
  [routes.production.airbrushings.root]: ["PRODUCTION", "WAREHOUSE", "FINANCIAL"], // DESIGNER excluded from airbrushings
  [routes.production.airbrushings.list]: ["PRODUCTION", "WAREHOUSE", "FINANCIAL"],
  [routes.production.airbrushings.create]: ["PRODUCTION", "WAREHOUSE"], // DESIGNER excluded (read-only)
  "/producao/aerografia/editar": ["PRODUCTION", "WAREHOUSE"], // DESIGNER excluded (read-only)

  // Cut-related routes - DESIGNER has read-only access
  [routes.production.cutting.root]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "LEADER", "ADMIN"],
  "/producao/recorte/detalhes/:id": ["PRODUCTION", "WAREHOUSE", "DESIGNER", "LEADER", "ADMIN"], // Cutting detail

  // Other production routes
  [routes.production.garages.root]: ["PRODUCTION", "LOGISTIC", "LEADER", "ADMIN"], // LOGISTIC has read access, Warehouse excluded
  [routes.production.garages.create]: ["PRODUCTION", "LEADER", "ADMIN"], // LOGISTIC excluded (read-only), Warehouse excluded
  "/producao/garagens/editar": ["PRODUCTION", "LEADER", "ADMIN"], // LOGISTIC excluded (read-only), Warehouse excluded (dynamic route)
  [routes.production.observations.root]: ["PRODUCTION", "WAREHOUSE"], // WAREHOUSE has full access
  [routes.production.observations.create]: ["PRODUCTION", "WAREHOUSE"], // WAREHOUSE can create
  "/producao/observacoes/editar": ["PRODUCTION", "WAREHOUSE"], // WAREHOUSE can edit (dynamic route)

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
  "/pintura/*": ["PRODUCTION", "WAREHOUSE", "DESIGNER", "ADMIN"],
  [`${routes.production.root}/*`]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC"], // DESIGNER, FINANCIAL, and LOGISTIC have read access to production routes
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
