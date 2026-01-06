import { SECTOR_PRIVILEGES } from "../constants";
import { routes } from "../constants";

// Enhanced route privilege mappings with support for arrays and granular permissions
export const ROUTE_PRIVILEGES: Record<string, keyof typeof SECTOR_PRIVILEGES | (keyof typeof SECTOR_PRIVILEGES)[]> = {
  // Home - All authenticated users can access (all privileges)
  "/": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL"],

  // Administração - Admin access with specific granular permissions
  "/administracao": "ADMIN",
  "/administracao/clientes": ["ADMIN", "FINANCIAL"], // Financial sector can access customers
  "/administracao/registros-de-alteracoes": "ADMIN",
  "/administracao/arquivos": "ADMIN",
  "/administracao/notificacoes": "ADMIN",

  // Financeiro - Financial sector routes
  "/financeiro": "FINANCIAL",
  "/financeiro/*": "FINANCIAL",
  "/financeiro/clientes": ["FINANCIAL", "ADMIN"], // Financial customers list page (team leaders check at component level)
  "/financeiro/clientes/detalhes/:id": ["FINANCIAL", "ADMIN"], // Financial customer details
  "/financeiro/clientes/editar/:id": ["FINANCIAL", "ADMIN"], // Financial customer edit
  "/financeiro/clientes/cadastrar": ["FINANCIAL", "ADMIN"], // Financial customer create
  "/financeiro/producao": "FINANCIAL", // Redirects to /producao
  "/financeiro/producao/aerografia": "FINANCIAL", // Redirects to /producao/aerografia/listar
  "/financeiro/producao/cronograma": "FINANCIAL", // Redirects to /producao/cronograma (tasks)
  "/financeiro/producao/em-preparacao": "FINANCIAL", // Redirects to /producao/em-preparacao
  "/financeiro/producao/historico-tarefas": "FINANCIAL", // Redirects to /producao/historico

  // Estatísticas - Admin access (team leaders check at component level via isTeamLeader())
  "/statistics": "ADMIN",
  "/statistics/*": "ADMIN",

  // Estoque - Warehouse operations with full access
  // WAREHOUSE has full access to all inventory routes including create, edit, and delete operations
  [routes.inventory.root]: "WAREHOUSE",
  [routes.inventory.products.root]: "WAREHOUSE",
  "/estoque/produtos/detalhes/:id": "WAREHOUSE", // Item detail pages
  "/estoque/produtos/editar/:id": "WAREHOUSE", // Item edit pages
  "/estoque/produtos/cadastrar": "WAREHOUSE", // Item create page
  [routes.inventory.products.categories.root]: "WAREHOUSE",
  "/estoque/produtos/categorias/detalhes/:id": "WAREHOUSE", // Category detail
  "/estoque/produtos/categorias/editar/:id": "WAREHOUSE", // Category edit
  "/estoque/produtos/categorias/cadastrar": "WAREHOUSE", // Category create
  [routes.inventory.products.brands.root]: "WAREHOUSE",
  "/estoque/produtos/marcas/detalhes/:id": "WAREHOUSE", // Brand detail
  "/estoque/produtos/marcas/editar/:id": "WAREHOUSE", // Brand edit
  "/estoque/produtos/marcas/cadastrar": "WAREHOUSE", // Brand create
  [routes.inventory.suppliers.root]: "WAREHOUSE",
  "/estoque/fornecedores/detalhes/:id": "WAREHOUSE", // Supplier detail
  "/estoque/fornecedores/editar/:id": "WAREHOUSE", // Supplier edit
  "/estoque/fornecedores/cadastrar": "WAREHOUSE", // Supplier create
  [routes.inventory.orders.root]: "WAREHOUSE",
  "/estoque/pedidos/detalhes/:id": "WAREHOUSE", // Order detail
  "/estoque/pedidos/editar/:id": "WAREHOUSE", // Order edit
  "/estoque/pedidos/cadastrar": "WAREHOUSE", // Order create
  [routes.inventory.orders.automatic.root]: "ADMIN", // Automatic orders require admin
  [routes.inventory.maintenance.root]: ["WAREHOUSE", "MAINTENANCE", "ADMIN"], // Maintenance operations
  "/estoque/manutencao/detalhes/:id": ["WAREHOUSE", "MAINTENANCE", "ADMIN"], // Maintenance detail
  "/estoque/manutencao/editar/:id": ["WAREHOUSE", "MAINTENANCE", "ADMIN"], // Maintenance edit
  "/estoque/manutencao/cadastrar": ["WAREHOUSE", "MAINTENANCE", "ADMIN"], // Maintenance create
  [routes.inventory.ppe.root]: "WAREHOUSE",
  [routes.inventory.ppe.deliveries.root]: ["HUMAN_RESOURCES", "WAREHOUSE", "ADMIN"], // PPE deliveries - Warehouse can view and mark as delivered
  [routes.inventory.ppe.deliveries.create]: ["HUMAN_RESOURCES", "ADMIN"], // Only HR and Admin can create
  [routes.inventory.ppe.schedules.root]: ["HUMAN_RESOURCES", "WAREHOUSE", "ADMIN"], // PPE schedules - Warehouse can view
  [routes.inventory.ppe.schedules.create]: ["HUMAN_RESOURCES", "ADMIN"], // Only HR and Admin can create schedules
  "/estoque/epi/agendamentos/editar/:id": ["HUMAN_RESOURCES", "ADMIN"], // Only HR and Admin can edit schedules - dynamic route
  [routes.inventory.loans.root]: "WAREHOUSE",
  "/estoque/emprestimos/detalhes/:id": "WAREHOUSE", // Borrow detail pages
  "/estoque/emprestimos/editar/:id": "WAREHOUSE", // Borrow edit pages
  "/estoque/emprestimos/cadastrar": "WAREHOUSE", // Borrow create page
  "/estoque/emprestimos/editar-lote": "WAREHOUSE", // Borrow batch edit
  [routes.inventory.externalWithdrawals.root]: "WAREHOUSE",
  "/estoque/retiradas-externas/detalhes/:id": "WAREHOUSE", // External withdrawal detail
  "/estoque/retiradas-externas/editar/:id": "WAREHOUSE", // External withdrawal edit
  "/estoque/retiradas-externas/cadastrar": "WAREHOUSE", // External withdrawal create

  // Profile - All authenticated users can access
  "/perfil": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL"],

  // Personal - All authenticated users can access (personal info)
  "/pessoal": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL"],
  "/pessoal/*": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL"],

  // Meu Pessoal - Team leader access (sector employee management)
  // Uses TEAM_LEADER virtual privilege which checks user.managedSector relation
  "/meu-pessoal": "TEAM_LEADER",

  // Pintura - Warehouse operations (PRODUCTION excluded from paint catalog)
  "/pintura": ["WAREHOUSE", "DESIGNER", "ADMIN"],
  "/pintura/catalogo": ["WAREHOUSE", "DESIGNER", "ADMIN"], // PRODUCTION excluded
  "/pintura/catalogo/detalhes/:id": ["WAREHOUSE", "DESIGNER", "ADMIN"], // Paint detail pages - PRODUCTION excluded
  "/pintura/catalogo/editar/:id": ["WAREHOUSE", "ADMIN"], // Only WAREHOUSE and ADMIN can edit paints
  "/pintura/catalogo/cadastrar": ["WAREHOUSE", "ADMIN"], // Only WAREHOUSE and ADMIN can create paints
  "/pintura/producoes": ["PRODUCTION", "WAREHOUSE", "ADMIN"], // Designer excluded from paint productions
  "/pintura/producoes/detalhes/:id": ["PRODUCTION", "WAREHOUSE", "ADMIN"], // Paint production detail
  "/pintura/tipos-de-tinta": ["WAREHOUSE", "DESIGNER", "ADMIN"], // Paint types - PRODUCTION excluded
  "/pintura/tipos-de-tinta/detalhes/:id": ["WAREHOUSE", "DESIGNER", "ADMIN"], // Paint type detail
  "/pintura/tipos-de-tinta/editar/:id": ["WAREHOUSE", "ADMIN"], // Only WAREHOUSE and ADMIN can edit
  "/pintura/tipos-de-tinta/cadastrar": ["WAREHOUSE", "ADMIN"], // Only WAREHOUSE and ADMIN can create
  "/pintura/marcas": ["WAREHOUSE", "DESIGNER", "ADMIN"], // Paint brands list - PRODUCTION excluded
  "/pintura/marcas/detalhes/:id": ["WAREHOUSE", "DESIGNER", "ADMIN"], // Paint brand detail
  "/pintura/marcas/editar/:id": ["WAREHOUSE", "ADMIN"], // Only WAREHOUSE and ADMIN can edit
  "/pintura/marcas/cadastrar": ["WAREHOUSE", "ADMIN"], // Only WAREHOUSE and ADMIN can create
  "/pintura/formulas": ["WAREHOUSE", "DESIGNER", "ADMIN"], // Formulas visible to DESIGNER (view only)
  "/pintura/formulas/detalhes/:id": ["WAREHOUSE", "DESIGNER", "ADMIN"], // Formula detail pages
  "/pintura/formulas/editar/:id": ["WAREHOUSE", "ADMIN"], // Only WAREHOUSE and ADMIN can edit
  "/pintura/formulas/cadastrar": ["WAREHOUSE", "ADMIN"], // Only WAREHOUSE and ADMIN can create

  // Produção - Production with full WAREHOUSE access, read-only DESIGNER, FINANCIAL, LOGISTIC access
  // WAREHOUSE has full access to all production routes including create, edit, and delete operations
  // DESIGNER has read-only access to schedule, on-hold, history, and cuts
  // FINANCIAL has read-only access to production schedule, on-hold, history, and airbrushings routes
  // LOGISTIC has read-only access to schedule, on-hold, history, and garages (can edit layout only)
  // NOTE: Team leaders (checked via isTeamLeader()) can access schedule, history (manages their sector's tasks)
  [routes.production.root]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC"], // Team leaders check at component level
  [routes.production.schedule.root]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC"], // Team leaders check at component level
  // [routes.production.schedule.create]: ["PRODUCTION", "WAREHOUSE"], // Removed - tasks are now created in the "in preparation" page
  [routes.production.schedule.details(":id")]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "ADMIN"], // Task detail page
  [routes.production.schedule.edit(":id")]: ["PRODUCTION", "WAREHOUSE", "FINANCIAL", "LOGISTIC", "ADMIN"], // FINANCIAL, LOGISTIC can edit with restrictions
  [routes.production.preparation.root]: ["PRODUCTION", "DESIGNER", "FINANCIAL", "LOGISTIC"], // WAREHOUSE excluded from preparation
  [routes.production.preparation.details(":id")]: ["PRODUCTION", "DESIGNER", "FINANCIAL", "LOGISTIC", "ADMIN"], // Preparation task detail - WAREHOUSE excluded
  [routes.production.history.root]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC"], // Team leaders check at component level
  [routes.production.history.details(":id")]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "ADMIN"], // History detail page
  [routes.production.airbrushings.root]: ["PRODUCTION", "WAREHOUSE", "FINANCIAL"], // DESIGNER excluded from airbrushings
  [routes.production.airbrushings.list]: ["PRODUCTION", "WAREHOUSE", "FINANCIAL"],
  [routes.production.airbrushings.create]: ["PRODUCTION", "WAREHOUSE"], // DESIGNER excluded (read-only)
  [routes.production.airbrushings.edit(":id")]: ["PRODUCTION", "WAREHOUSE"], // DESIGNER excluded (read-only)

  // Cut-related routes - DESIGNER has read-only access
  [routes.production.cutting.root]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "ADMIN"],
  [routes.production.cutting.details(":id")]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "ADMIN"], // Cutting detail

  // Observations - accessible to all production-related sectors (read-only for most, edit for admin)
  [routes.production.observations.root]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "ADMIN"],
  [routes.production.observations.create]: ["PRODUCTION", "WAREHOUSE", "ADMIN"], // Only production/warehouse/admin can create
  [routes.production.observations.edit(":id")]: ["PRODUCTION", "WAREHOUSE", "ADMIN"], // Only production/warehouse/admin can edit

  // Registro de Ponto - All authenticated users can access
  "/registro-de-ponto": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL"],

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

  // Catalog routes (view-only for designers - NOTE: uses same details path as painting.catalog, so privileges defined on line 87)
  // Team leaders check at component level via isTeamLeader()
  [routes.catalog.root]: "DESIGNER",
  // [routes.catalog.details(":id")]: "DESIGNER", // REMOVED: Conflicts with painting.catalog.details (same path), using hardcoded entry on line 87 instead

  // Maintenance routes (maintenance access for technicians)
  [routes.maintenance.root]: "MAINTENANCE",
  [routes.maintenance.create]: "MAINTENANCE",
  "/manutencao/editar/:id": "MAINTENANCE", // Dynamic route for editing
  [routes.maintenance.details(":id")]: "MAINTENANCE",

  // My Team routes (team management for team leaders)
  // Uses TEAM_LEADER virtual privilege which checks user.managedSector relation
  [routes.myTeam.vacations]: "TEAM_LEADER",
  [routes.myTeam.warnings]: "TEAM_LEADER",
  [routes.myTeam.loans]: "TEAM_LEADER",
  [routes.myTeam.members]: "TEAM_LEADER",
  [routes.myTeam.ppes]: "TEAM_LEADER",
  [routes.myTeam.movements]: "TEAM_LEADER",
  [routes.myTeam.calculations]: "TEAM_LEADER",

  // Fallback patterns (for broader route matching)
  "/administracao/*": "ADMIN",
  [`${routes.inventory.root}/*`]: "WAREHOUSE",
  "/pintura/*": ["WAREHOUSE", "DESIGNER", "ADMIN"], // PRODUCTION excluded from paint routes
  [`${routes.production.root}/*`]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC"], // DESIGNER, FINANCIAL, LOGISTIC have read access to production routes
  "/recursos-humanos/*": "HUMAN_RESOURCES",
  "/human-resources/*": "HUMAN_RESOURCES",
  "/meu-pessoal/*": "TEAM_LEADER", // Team leader routes - uses virtual privilege
  "/manutencao/*": "MAINTENANCE",
};

// Helper function to get required privilege(s) for a route
// Returns single privilege or array of privileges
export function getRequiredPrivilegeForRoute(pathname: string): keyof typeof SECTOR_PRIVILEGES | (keyof typeof SECTOR_PRIVILEGES)[] | undefined {
  // First check for exact match
  if (ROUTE_PRIVILEGES[pathname]) {
    return ROUTE_PRIVILEGES[pathname];
  }

  // Then check for dynamic routes with :id, :taskId, etc. parameters
  const dynamicRoutes = Object.entries(ROUTE_PRIVILEGES)
    .filter(([routePattern]) => routePattern.includes(":"))
    .sort(([a], [b]) => b.length - a.length); // Sort by specificity (longer patterns first)

  for (const [routePattern, privilege] of dynamicRoutes) {
    // Convert route pattern to regex: /producao/cronograma/detalhes/:id -> /producao/cronograma/detalhes/[^/]+
    const regexPattern = routePattern
      .replace(/:[^/]+/g, "[^/]+") // Replace :id, :taskId, etc. with regex to match any segment
      .replace(/\//g, "\\/"); // Escape forward slashes

    const regex = new RegExp(`^${regexPattern}$`);
    if (regex.test(pathname)) {
      return privilege;
    }
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
