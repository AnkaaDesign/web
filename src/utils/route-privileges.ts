import { SECTOR_PRIVILEGES } from "../constants";
import { routes } from "../constants";

// Enhanced route privilege mappings with support for arrays and granular permissions
export const ROUTE_PRIVILEGES: Record<string, keyof typeof SECTOR_PRIVILEGES | (keyof typeof SECTOR_PRIVILEGES)[]> = {
  // Home - All authenticated users can access (all privileges)
  "/": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL"],

  // Administração - Admin access with specific granular permissions
  "/administracao": "ADMIN",
  "/administracao/clientes": ["BASIC", "ADMIN", "FINANCIAL", "LOGISTIC", "COMMERCIAL"], // BASIC allows all authenticated, but specific access for Financial and Logistic
  [routes.administration.customers.details(":id")]: ["BASIC", "ADMIN", "FINANCIAL", "LOGISTIC", "COMMERCIAL"], // Customer details using function
  "/administracao/clientes/detalhes/:id": ["BASIC", "ADMIN", "FINANCIAL", "LOGISTIC", "COMMERCIAL"], // Financial and Logistic can view customer details - explicit pattern
  [routes.administration.customers.edit(":id")]: ["ADMIN", "FINANCIAL", "COMMERCIAL", "LOGISTIC"], // Financial, Commercial, Logistic, and Admin can edit customers
  "/administracao/clientes/editar/:id": ["ADMIN", "FINANCIAL", "COMMERCIAL", "LOGISTIC"], // Financial, Commercial, Logistic, and Admin can edit customers - explicit pattern
  [routes.administration.customers.create]: ["ADMIN", "FINANCIAL", "COMMERCIAL", "LOGISTIC"], // Financial, Commercial, Logistic, and Admin can create customers
  "/administracao/clientes/cadastrar": ["ADMIN", "FINANCIAL", "COMMERCIAL", "LOGISTIC"], // Financial, Commercial, Logistic, and Admin can create customers - explicit pattern
  // Representatives - Admin and Commercial can manage representatives
  [routes.representatives.root]: ["ADMIN", "COMMERCIAL"],
  [routes.representatives.create]: ["ADMIN", "COMMERCIAL"],
  [routes.representatives.details(":id")]: ["ADMIN", "COMMERCIAL"],
  [routes.representatives.edit(":id")]: ["ADMIN", "COMMERCIAL"],
  [routes.representatives.password(":id")]: ["ADMIN", "COMMERCIAL"],
  "/administracao/clientes/representantes": ["ADMIN", "COMMERCIAL"],
  "/administracao/clientes/representantes/cadastrar": ["ADMIN", "COMMERCIAL"],
  "/administracao/clientes/representantes/detalhes/:id": ["ADMIN", "COMMERCIAL"],
  "/administracao/clientes/representantes/editar/:id": ["ADMIN", "COMMERCIAL"],
  "/administracao/clientes/representantes/senha/:id": ["ADMIN", "COMMERCIAL"],

  "/administracao/registros-de-alteracoes": "ADMIN",
  "/administracao/arquivos": "ADMIN",
  "/administracao/notificacoes": "ADMIN",

  // Financeiro - Financial sector routes
  "/financeiro": "FINANCIAL",
  "/financeiro/*": "FINANCIAL",
  "/financeiro/clientes": ["FINANCIAL", "LOGISTIC", "ADMIN"], // Financial and Logistic customers list page (team leaders check at component level)
  "/financeiro/clientes/detalhes/:id": ["FINANCIAL", "LOGISTIC", "ADMIN"], // Financial and Logistic customer details
  "/financeiro/clientes/editar/:id": ["FINANCIAL", "ADMIN"], // Only Financial and Admin can edit
  "/financeiro/clientes/cadastrar": ["FINANCIAL", "ADMIN"], // Only Financial and Admin can create
  "/financeiro/producao": "FINANCIAL", // Redirects to /producao
  "/financeiro/producao/aerografia": "FINANCIAL", // Redirects to /producao/aerografia/listar
  "/financeiro/producao/cronograma": "FINANCIAL", // Redirects to /producao/cronograma (tasks)
  "/financeiro/producao/em-preparacao": "FINANCIAL", // Redirects to /producao/em-preparacao
  "/financeiro/producao/agenda": "FINANCIAL", // Redirects to /producao/agenda
  "/financeiro/producao/historico-tarefas": "FINANCIAL", // Redirects to /producao/historico
  // Simplified financial routes
  "/financeiro/agenda": "FINANCIAL", // Redirects to /producao/agenda
  "/financeiro/aerografia": "FINANCIAL", // Redirects to /producao/aerografia/listar

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
  [routes.inventory.maintenance.list]: ["WAREHOUSE", "MAINTENANCE", "ADMIN"], // Maintenance list
  "/estoque/manutencao": ["WAREHOUSE", "MAINTENANCE", "ADMIN"], // Maintenance root - explicit
  "/estoque/manutencao/listar": ["WAREHOUSE", "MAINTENANCE", "ADMIN"], // Maintenance list - explicit
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
  "/perfil": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL"],
  "/perfil/notificacoes": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL"], // Profile notifications

  // Personal - All authenticated users can access (personal info)
  "/pessoal": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL"],
  "/pessoal/mensagens": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL"],
  "/pessoal/*": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL"],

  // Meu Pessoal - Team leader access (sector employee management)
  // Uses TEAM_LEADER virtual privilege which checks user.managedSector relation
  "/meu-pessoal": "TEAM_LEADER",

  // Pintura - Warehouse operations (PRODUCTION excluded from paint catalog)
  "/pintura": ["WAREHOUSE", "DESIGNER", "LOGISTIC", "ADMIN"],
  "/pintura/catalogo": ["WAREHOUSE", "DESIGNER", "ADMIN", "COMMERCIAL", "LOGISTIC", "PRODUCTION"],
  // NOTE: /pintura/catalogo-basico privileges defined using routes.catalog.root on line 193 to avoid duplication
  "/pintura/catalogo/detalhes/:id": ["WAREHOUSE", "DESIGNER", "ADMIN", "COMMERCIAL", "LOGISTIC", "PRODUCTION"],
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

  // Produção - Production with full WAREHOUSE access, restricted DESIGNER, FINANCIAL, LOGISTIC, PLOTTING, COMMERCIAL access
  // WAREHOUSE has full access to all production routes including create, edit, and delete operations
  // DESIGNER can edit tasks in schedule (cronograma) and preparation (agenda), view history and cuts (has flat navigation)
  // FINANCIAL has read-only access to production schedule, on-hold, history, and airbrushings routes (has flat navigation)
  // LOGISTIC can edit tasks in schedule and preparation, manage garages/layouts (has flat navigation)
  // PLOTTING can access cut page, cronograma, history, and pessoal (has flat navigation)
  // COMMERCIAL can view and edit tasks in schedule and preparation, view history, garages, observations, airbrushings, and paint catalog (has flat navigation)
  // NOTE: Team leaders (checked via isTeamLeader()) can access schedule, history (manages their sector's tasks)
  [routes.production.root]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PLOTTING", "COMMERCIAL"], // Team leaders check at component level
  [routes.production.schedule.root]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PLOTTING", "COMMERCIAL"], // Team leaders check at component level
  // [routes.production.schedule.create]: ["PRODUCTION", "WAREHOUSE"], // Removed - tasks are now created in the "in preparation" page
  [routes.production.schedule.details(":id")]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PLOTTING", "COMMERCIAL", "ADMIN"], // Task detail page
  "/producao/cronograma/detalhes/:id": ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PLOTTING", "COMMERCIAL", "ADMIN"], // Explicit cronograma details route
  [routes.production.schedule.edit(":id")]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PLOTTING", "COMMERCIAL", "ADMIN"], // DESIGNER, FINANCIAL, LOGISTIC, PLOTTING can edit with restrictions
  "/producao/cronograma/editar/:id": ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PLOTTING", "COMMERCIAL", "ADMIN"], // Explicit cronograma edit route
  [routes.production.preparation.root]: ["DESIGNER", "FINANCIAL", "LOGISTIC", "COMMERCIAL", "ADMIN"], // PRODUCTION and WAREHOUSE excluded from preparation
  "/producao/agenda": ["DESIGNER", "FINANCIAL", "LOGISTIC", "COMMERCIAL", "ADMIN"], // Agenda root (preparation) - PRODUCTION excluded
  [routes.production.preparation.create]: ["PRODUCTION", "DESIGNER", "LOGISTIC", "COMMERCIAL", "FINANCIAL", "ADMIN"], // Preparation task create - WAREHOUSE excluded
  "/producao/agenda/cadastrar": ["PRODUCTION", "DESIGNER", "LOGISTIC", "COMMERCIAL", "FINANCIAL", "ADMIN"], // Agenda create
  [routes.production.preparation.details(":id")]: ["PRODUCTION", "DESIGNER", "FINANCIAL", "LOGISTIC", "COMMERCIAL", "ADMIN"], // Preparation task detail - WAREHOUSE excluded
  "/producao/agenda/detalhes/:id": ["PRODUCTION", "DESIGNER", "FINANCIAL", "LOGISTIC", "COMMERCIAL", "ADMIN"], // Agenda details
  [routes.production.preparation.edit(":id")]: ["PRODUCTION", "DESIGNER", "FINANCIAL", "LOGISTIC", "COMMERCIAL", "ADMIN"], // Preparation task edit - WAREHOUSE excluded
  "/producao/agenda/editar/:id": ["PRODUCTION", "DESIGNER", "FINANCIAL", "LOGISTIC", "COMMERCIAL", "ADMIN"], // Agenda edit - explicit route for designer access
  [routes.production.history.root]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PLOTTING", "COMMERCIAL"], // Team leaders check at component level
  [routes.production.history.details(":id")]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PLOTTING", "COMMERCIAL", "ADMIN"], // History detail page
  [routes.production.garages.root]: ["PRODUCTION", "WAREHOUSE", "FINANCIAL", "LOGISTIC", "COMMERCIAL", "ADMIN"], // Garages/Barracões - LOGISTIC can edit layouts
  "/producao/barracoes": ["PRODUCTION", "WAREHOUSE", "FINANCIAL", "LOGISTIC", "COMMERCIAL", "ADMIN"], // Explicit barracoes route
  [routes.production.airbrushings.root]: ["WAREHOUSE", "FINANCIAL", "COMMERCIAL", "ADMIN"], // PRODUCTION and DESIGNER excluded from airbrushings
  [routes.production.airbrushings.list]: ["WAREHOUSE", "FINANCIAL", "COMMERCIAL", "ADMIN"],
  [routes.production.airbrushings.create]: ["WAREHOUSE", "COMMERCIAL", "FINANCIAL", "ADMIN"], // PRODUCTION and DESIGNER excluded
  [routes.production.airbrushings.edit(":id")]: ["WAREHOUSE", "COMMERCIAL", "FINANCIAL", "ADMIN"], // PRODUCTION and DESIGNER excluded

  // Cut-related routes - DESIGNER and PLOTTING have read-only access, WAREHOUSE removed
  [routes.production.cutting.root]: ["PRODUCTION", "DESIGNER", "PLOTTING", "ADMIN"],
  [routes.production.cutting.details(":id")]: ["PRODUCTION", "DESIGNER", "PLOTTING", "ADMIN"], // Cutting detail
  [routes.production.cutting.create]: ["PRODUCTION", "DESIGNER", "PLOTTING", "ADMIN"], // Cutting create
  [routes.production.cutting.edit(":id")]: ["PRODUCTION", "DESIGNER", "PLOTTING", "ADMIN"], // Cutting edit

  // Observations - accessible to production-related sectors (read-only for most, edit for admin)
  // DESIGNER and LOGISTIC excluded from observations
  [routes.production.observations.root]: ["PRODUCTION", "WAREHOUSE", "FINANCIAL", "COMMERCIAL", "ADMIN"],
  [routes.production.observations.details(":id")]: ["PRODUCTION", "WAREHOUSE", "FINANCIAL", "COMMERCIAL", "ADMIN"],
  [routes.production.observations.create]: ["PRODUCTION", "WAREHOUSE", "COMMERCIAL", "FINANCIAL", "ADMIN"], // Production, warehouse, commercial, financial, and admin can create
  [routes.production.observations.edit(":id")]: ["PRODUCTION", "WAREHOUSE", "COMMERCIAL", "FINANCIAL", "ADMIN"], // Production, warehouse, commercial, financial, and admin can edit

  // Registro de Ponto - All authenticated users can access
  "/registro-de-ponto": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL"],

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

  // Catalog routes (view-only for designers, commercial, logistic, team leaders - NOTE: uses same details path as painting.catalog, so privileges defined on line 87)
  // Team leaders check at component level via isTeamLeader()
  [routes.catalog.root]: ["DESIGNER", "COMMERCIAL", "LOGISTIC", "TEAM_LEADER", "ADMIN"],
  // [routes.catalog.details(":id")]: "DESIGNER", // REMOVED: Conflicts with painting.catalog.details (same path), using hardcoded entry on line 87 instead

  // Maintenance routes (maintenance access for technicians and warehouse)
  [routes.maintenance.root]: ["MAINTENANCE", "WAREHOUSE", "ADMIN"],
  [routes.maintenance.create]: ["MAINTENANCE", "WAREHOUSE", "ADMIN"],
  "/manutencao/editar/:id": ["MAINTENANCE", "WAREHOUSE", "ADMIN"], // Dynamic route for editing
  [routes.maintenance.details(":id")]: ["MAINTENANCE", "WAREHOUSE", "ADMIN"],

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
  // Note: Specific routes for /administracao/clientes are defined above, wildcards won't override them
  "/administracao/*": "ADMIN",
  [`${routes.inventory.root}/*`]: "WAREHOUSE",
  "/pintura/*": ["WAREHOUSE", "DESIGNER", "COMMERCIAL", "LOGISTIC", "TEAM_LEADER", "ADMIN"], // PRODUCTION excluded from paint routes
  [`${routes.production.root}/*`]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PLOTTING", "COMMERCIAL"], // DESIGNER, FINANCIAL, LOGISTIC, PLOTTING have read access to production routes
  "/recursos-humanos/*": "HUMAN_RESOURCES",
  "/human-resources/*": "HUMAN_RESOURCES",
  "/meu-pessoal/*": "TEAM_LEADER", // Team leader routes - uses virtual privilege
  "/manutencao/*": ["MAINTENANCE", "WAREHOUSE", "ADMIN"],
};

// Helper function to get required privilege(s) for a route
// Returns single privilege or array of privileges
export function getRequiredPrivilegeForRoute(pathname: string): keyof typeof SECTOR_PRIVILEGES | (keyof typeof SECTOR_PRIVILEGES)[] | undefined {
  // Debug logging for problematic routes
  if (process.env.NODE_ENV !== 'production' && (pathname.includes('/clientes/') || pathname.includes('/cronograma/') || pathname.includes('/agenda/') || pathname.includes('/barracoes') || pathname.includes('/catalogo-basico'))) {
    console.log('[route-privileges] Checking privileges for:', pathname);
  }

  // First check for exact match
  if (ROUTE_PRIVILEGES[pathname]) {
    if (process.env.NODE_ENV !== 'production' && (pathname.includes('/clientes/') || pathname.includes('/cronograma/') || pathname.includes('/agenda/') || pathname.includes('/barracoes') || pathname.includes('/catalogo-basico'))) {
      console.log('  ✓ Found exact match:', ROUTE_PRIVILEGES[pathname]);
    }
    return ROUTE_PRIVILEGES[pathname];
  }

  // Then check for dynamic routes with :id, :taskId, etc. parameters
  const dynamicRoutes = Object.entries(ROUTE_PRIVILEGES)
    .filter(([routePattern]) => routePattern.includes(":"))
    .sort(([a], [b]) => b.length - a.length); // Sort by specificity (longer patterns first)

  if (process.env.NODE_ENV !== 'production' && (pathname.includes('/clientes/') || pathname.includes('/cronograma/') || pathname.includes('/agenda/') || pathname.includes('/barracoes'))) {
    console.log('  Checking', dynamicRoutes.length, 'dynamic routes...');
  }

  for (const [routePattern, privilege] of dynamicRoutes) {
    // Convert route pattern to regex: /producao/cronograma/detalhes/:id -> /producao/cronograma/detalhes/[^/]+
    const regexPattern = routePattern
      .replace(/:[^/]+/g, "[^/]+") // Replace :id, :taskId, etc. with regex to match any segment
      .replace(/\//g, "\\/"); // Escape forward slashes

    const regex = new RegExp(`^${regexPattern}$`);
    if (regex.test(pathname)) {
      if (process.env.NODE_ENV !== 'production' && (pathname.includes('/clientes/') || pathname.includes('/cronograma/') || pathname.includes('/agenda/') || pathname.includes('/barracoes'))) {
        console.log('  ✓ Found dynamic match:', routePattern, '=>', privilege);
      }
      return privilege;
    }
  }

  // Then check for wildcard matches (specific routes first, then fallbacks)
  const matchingRoutes = Object.entries(ROUTE_PRIVILEGES)
    .filter(([routePattern]) => routePattern.endsWith("/*"))
    .sort(([a], [b]) => b.length - a.length); // Sort by specificity (longer patterns first)

  if (process.env.NODE_ENV !== 'production' && (pathname.includes('/clientes/') || pathname.includes('/cronograma/') || pathname.includes('/agenda/') || pathname.includes('/barracoes'))) {
    console.log('  Checking wildcard routes...');
  }

  for (const [routePattern, privilege] of matchingRoutes) {
    const baseRoute = routePattern.slice(0, -2); // Remove /*
    if (pathname.startsWith(baseRoute + "/") || pathname === baseRoute) {
      if (process.env.NODE_ENV !== 'production' && (pathname.includes('/clientes/') || pathname.includes('/cronograma/') || pathname.includes('/agenda/') || pathname.includes('/barracoes'))) {
        console.log('  ✓ Found wildcard match:', routePattern, '=>', privilege);
      }
      return privilege;
    }
  }

  // Default to admin for unmatched routes (safe default)
  if (process.env.NODE_ENV !== 'production' && (pathname.includes('/clientes/') || pathname.includes('/cronograma/') || pathname.includes('/agenda/') || pathname.includes('/barracoes'))) {
    console.log('  ✗ No match found, defaulting to ADMIN');
  }
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
