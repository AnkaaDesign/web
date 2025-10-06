/**
 * Route validation utility to ensure all navigation menu items
 * have corresponding routes in the application
 */

import { MENU_ITEMS, routes } from "../constants";

// Helper function to extract all routes from menu items
function getAllRoutes(items: any[]): string[] {
  const routes: string[] = [];

  items.forEach((item) => {
    if (item.path) {
      routes.push(item.path);
    }
    if (item.children) {
      routes.push(...getAllRoutes(item.children));
    }
  });

  return routes;
}

// Extract all routes from App.tsx (these should match the actual routes)
const VALID_ROUTES = [
  // Auth routes
  routes.authentication.login,
  routes.authentication.register,
  routes.authentication.recoverPassword,
  routes.authentication.verifyCode,
  routes.authentication.verifyPasswordReset,
  routes.authentication.resetPassword(":token"),

  // Main routes
  "/",

  // Production routes
  routes.production.root,
  routes.production.schedule.root,
  routes.production.schedule.create,
  routes.production.schedule.edit(":id"),
  routes.production.schedule.details(":id"),
  routes.production.scheduleOnHold,
  routes.production.history.root,
  routes.production.history.cancelled,
  routes.production.history.completed,
  routes.production.cutting.root,
  routes.production.garages.root,
  routes.production.garages.create,
  routes.production.garages.edit(":id"),
  routes.production.garages.details(":id"),
  routes.production.serviceOrders.root,
  routes.production.serviceOrders.create,
  routes.production.serviceOrders.edit(":id"),
  routes.production.serviceOrders.details(":id"),
  routes.production.observations.root,
  routes.production.observations.create,
  routes.production.observations.edit(":id"),
  routes.production.observations.details(":id"),

  // Administration routes
  routes.administration.root,
  routes.administration.files.root,
  routes.administration.files.upload,
  routes.administration.files.details(":id"),
  routes.administration.files.orphans,
  routes.administration.customers.root,
  routes.administration.customers.create,
  routes.administration.customers.edit(":id"),
  routes.administration.customers.details(":id"),
  routes.administration.collaborators.root,
  routes.administration.collaborators.create,
  routes.administration.collaborators.edit(":id"),
  routes.administration.collaborators.details(":id"),
  routes.administration.sectors.root,
  routes.administration.sectors.create,
  routes.administration.sectors.edit(":id"),
  routes.administration.sectors.details(":id"),
  routes.administration.notifications.root,
  routes.administration.notifications.create,
  routes.administration.notifications.edit(":id"),
  routes.administration.notifications.details(":id"),

  // Statistics routes
  routes.statistics.root,
  routes.statistics.production,
  routes.statistics.administration,
  routes.statistics.humanResources,
  routes.statistics.inventory,

  // Inventory routes
  routes.inventory.root,
  routes.inventory.movements.root,
  routes.inventory.movements.create,
  routes.inventory.movements.edit(":id"),
  routes.inventory.movements.details(":id"),
  routes.inventory.products.root,
  routes.inventory.products.create,
  routes.inventory.products.edit(":id"),
  routes.inventory.products.details(":id"),
  routes.inventory.products.categories.root,
  routes.inventory.products.categories.create,
  routes.inventory.products.categories.edit(":id"),
  routes.inventory.products.categories.details(":id"),
  routes.inventory.products.brands.root,
  routes.inventory.products.brands.create,
  routes.inventory.products.brands.edit(":id"),
  routes.inventory.products.brands.details(":id"),
  routes.inventory.suppliers.root,
  routes.inventory.suppliers.create,
  routes.inventory.suppliers.edit(":id"),
  routes.inventory.suppliers.details(":id"),
  routes.inventory.orders.root,
  routes.inventory.orders.create,
  routes.inventory.orders.edit(":id"),
  routes.inventory.orders.details(":id"),
  routes.inventory.orders.schedules.root,
  routes.inventory.orders.schedules.create,
  routes.inventory.orders.schedules.edit(":id"),
  routes.inventory.orders.schedules.details(":id"),
  routes.inventory.orders.automatic.root,
  routes.inventory.orders.automatic.configure,
  routes.inventory.maintenance.root,
  routes.inventory.maintenance.create,
  routes.inventory.maintenance.edit(":id"),
  routes.inventory.maintenance.details(":id"),
  routes.inventory.externalWithdrawals.root,
  routes.inventory.externalWithdrawals.create,
  routes.inventory.externalWithdrawals.edit(":id"),
  routes.inventory.externalWithdrawals.details(":id"),
  routes.inventory.ppe.root,
  routes.inventory.ppe.create,
  routes.inventory.ppe.edit(":id"),
  routes.inventory.ppe.details(":id"),
  routes.inventory.ppe.deliveries.root,
  routes.inventory.ppe.deliveries.create,
  routes.inventory.ppe.deliveries.edit(":id"),
  routes.inventory.ppe.deliveries.details(":id"),
  routes.inventory.ppe.schedules.root,
  routes.inventory.ppe.schedules.create,
  routes.inventory.ppe.schedules.edit(":id"),
  routes.inventory.ppe.schedules.details(":id"),
  routes.inventory.loans.root,
  routes.inventory.loans.create,
  routes.inventory.loans.details(":id"),

  // Painting routes
  routes.painting.root,
  routes.painting.catalog.root,
  routes.painting.catalog.create,
  routes.painting.catalog.edit(":id"),
  routes.painting.catalog.details(":id"),
  routes.painting.catalog.formulas(":paintId"),
  routes.painting.catalog.formulaDetails(":paintId", ":formulaId"),
  routes.painting.productions.root,
  routes.painting.productions.details(":id"),
  routes.painting.paintTypes.root,
  routes.painting.paintTypes.create,
  routes.painting.paintTypes.edit(":id"),
  routes.painting.paintTypes.details(":id"),

  // Human Resources routes
  routes.humanResources.root,
  routes.humanResources.requisicoes.root,
  routes.humanResources.requisicoes.list,
  routes.humanResources.positions.root,
  routes.humanResources.positions.create,
  routes.humanResources.positions.edit(":id"),
  routes.humanResources.positions.details(":id"),
  routes.humanResources.positions.remunerations(":positionId"),
  routes.humanResources.vacations.root,
  routes.humanResources.vacations.create,
  routes.humanResources.vacations.details(":id"),
  routes.humanResources.vacations.calendar,
  routes.humanResources.warnings.root,
  routes.humanResources.warnings.create,
  routes.humanResources.warnings.edit(":id"),
  routes.humanResources.warnings.details(":id"),
  routes.humanResources.ppe.root,
  routes.humanResources.ppe.create,
  routes.humanResources.ppe.edit(":id"),
  routes.humanResources.ppe.details(":id"),
  routes.humanResources.ppe.deliveries.root,
  routes.humanResources.ppe.deliveries.create,
  routes.humanResources.ppe.deliveries.edit(":id"),
  routes.humanResources.ppe.deliveries.details(":id"),
  routes.humanResources.ppe.schedules.root,
  routes.humanResources.ppe.schedules.create,
  routes.humanResources.ppe.schedules.edit(":id"),
  routes.humanResources.ppe.schedules.details(":id"),
  routes.humanResources.ppe.sizes.root,
  routes.humanResources.ppe.sizes.create,
  routes.humanResources.ppe.sizes.edit(":id"),
  routes.humanResources.ppe.sizes.details(":id"),

  // Personal routes
  routes.personal.root,
  routes.personal.myProfile.root,
  routes.personal.myHolidays.root,
  routes.personal.myVacations.root,
  routes.personal.myVacations.details(":id"),
  routes.personal.myLoans.root,
  routes.personal.myLoans.details(":id"),
  routes.personal.myPpes.root,
  routes.personal.myPpes.request,
  routes.personal.myWarnings.root,
  routes.personal.myWarnings.details(":id"),
  routes.personal.myNotifications.root,
  routes.personal.myNotifications.details(":id"),
  routes.personal.preferences.root,

  // My Team routes
  routes.myTeam.root,
  routes.myTeam.vacations,
  routes.myTeam.warnings,
  routes.myTeam.loans,

  // Catalog routes
  routes.catalog.root,
  routes.catalog.details(":id"),

  // Maintenance routes
  routes.maintenance.root,
  routes.maintenance.details(":id"),
];

/**
 * Route mapping to fix navigation paths that don't match actual routes
 */
export const ROUTE_FIXES: Record<string, string> = {
  // Production route mappings
  "/producao/garagens/listar": "/producao/garagens",
  "/producao/ordens-de-servico/listar": "/producao/ordens-de-servico",
  "/producao/observacoes/listar": "/producao/observacoes",

  // Inventory route mappings
  "/estoque/movimentacoes/listar": "/estoque/movimentacoes",
  "/estoque/movimentacoes/relatorios": "/estoque/movimentacoes/relatorios",
  "/estoque/produtos/listar": "/estoque/produtos",
  "/estoque/fornecedores/listar": "/estoque/fornecedores",
  "/estoque/pedidos/listar": "/estoque/pedidos",
  "/estoque/pedidos/agendamentos/listar": "/estoque/pedidos/agendamentos",
  "/estoque/pedidos/automaticos/listar": "/estoque/pedidos/automaticos",
  "/estoque/manutencao/listar": "/estoque/manutencao",
  "/estoque/retiradas-externas/listar": "/estoque/retiradas-externas",
  "/estoque/epi/listar": "/estoque/epi",
  "/estoque/epi/entregas/listar": "/estoque/epi/entregas",
  "/estoque/epi/agendamentos/listar": "/estoque/epi/agendamentos",
  "/estoque/emprestimos/listar": "/estoque/emprestimos",

  // Painting route mappings
  "/pintura/catalogo/listar": "/pintura/catalogo",
  "/pintura/catalogo/detalhes/:id": "/pintura/catalogo/:id",
  "/pintura/catalogo/editar/:id": "/pintura/catalogo/editar/:id",
  "/pintura/catalogo/detalhes/:paintId/formulas": "/pintura/catalogo/detalhes/:paintId/formulas",
  "/pintura/catalogo/detalhes/:paintId/formulas/detalhes/:formulaId": "/pintura/catalogo/detalhes/:paintId/formulas/detalhes/:formulaId",
  "/pintura/producoes/listar": "/pintura/producoes",
  "/pintura/tipos-de-tinta/listar": "/pintura/tipos-de-tinta",
  "/pintura/tipos-de-tinta/editar/:id": "/pintura/tipos-de-tinta/editar/:id",
  "/pintura/catalogo-basico/listar": "/pintura/catalogo-basico",
  "/pintura/catalogo-basico/detalhes/:id": "/pintura/catalogo/:id",

  // Administration route mappings
  "/administracao/clientes/listar": "/administracao/clientes",
  "/administracao/colaboradores/listar": "/administracao/colaboradores",
  "/administracao/registros-de-alteracoes/listar": "/servidor/registros-de-alteracoes",
  "/administracao/registros-de-alteracoes": "/servidor/registros-de-alteracoes",
  "/administracao/arquivos/listar": "/administracao/arquivos",
  "/administracao/setores/listar": "/administracao/setores",
  "/administracao/notificacoes/listar": "/administracao/notificacoes",

  // Human Resources route mappings
  "/recursos-humanos/cargos/listar": "/recursos-humanos/cargos",
  "/recursos-humanos/ferias/listar": "/recursos-humanos/ferias",
  "/recursos-humanos/feriados/listar": "/recursos-humanos/feriados",
  "/recursos-humanos/feriados/detalhes/:id": "/recursos-humanos/feriados/:id",
  "/recursos-humanos/avisos/listar": "/recursos-humanos/avisos",
  "/recursos-humanos/epi/listar": "/recursos-humanos/epi",
  "/recursos-humanos/epi/entregas/listar": "/recursos-humanos/epi/entregas",
  "/recursos-humanos/epi/tamanhos/listar": "/recursos-humanos/epi/tamanhos",
  "/recursos-humanos/epi/tamanhos/detalhes/:id": "/recursos-humanos/epi/tamanhos/:id",
  "/recursos-humanos/epi/agendamentos/listar": "/recursos-humanos/epi/agendamentos",

  // Personal (Pessoal) route mappings
  "/pessoal/minhas-ferias/listar": "/pessoal/minhas-ferias",
  "/pessoal/meus-feriados/listar": "/pessoal/meus-feriados",
  "/pessoal/meus-emprestimos/listar": "/pessoal/meus-emprestimos",
  "/pessoal/meus-epis/listar": "/pessoal/meus-epis",
  "/pessoal/meus-avisos/listar": "/pessoal/meus-avisos",
  "/pessoal/minhas-notificacoes/listar": "/pessoal/minhas-notificacoes",

  // My Team (Meu Pessoal) route mappings
  "/meu-pessoal/ferias/listar": "/meu-pessoal/ferias",
  "/meu-pessoal/avisos/listar": "/meu-pessoal/avisos",
  "/meu-pessoal/emprestimos/listar": "/meu-pessoal/emprestimos",

  // Statistics route mappings
  "/estatisticas/producao/listar": "/estatisticas/producao",
  "/estatisticas/administracao/listar": "/estatisticas/administracao",
  "/estatisticas/recursos-humanos/listar": "/estatisticas/recursos-humanos",
  "/estatisticas/estoque/listar": "/estatisticas/estoque",

  // Maintenance route mappings
  "/manutencao/listar": "/manutencao",

  // Missing route mappings - these paths exist in navigation but need to be added to routes
  "/estoque/ppe/configuracoes": "/estoque/epi",
  "/estoque/ppe/configuracoes/cadastrar": "/estoque/epi/cadastrar",
  "/recursos-humanos/colaboradores": "/administracao/colaboradores",
  "/recursos-humanos/colaboradores/cadastrar": "/administracao/colaboradores/cadastrar",
  "/recursos-humanos/colaboradores/listar": "/administracao/colaboradores",
  "/recursos-humanos/colaboradores/detalhes": "/administracao/colaboradores",
  "/recursos-humanos/colaboradores/editar": "/administracao/colaboradores",
  "/recursos-humanos/setores": "/administracao/setores",
  "/recursos-humanos/setores/cadastrar": "/administracao/setores/cadastrar",
  "/recursos-humanos/vagas": "/recursos-humanos/vagas",
  "/recursos-humanos/vagas/cadastrar": "/recursos-humanos/vagas/cadastrar",
  "/recursos-humanos/ppe/configuracoes": "/recursos-humanos/epi",
  "/recursos-humanos/ppe/configuracoes/cadastrar": "/recursos-humanos/epi/cadastrar",

  // Legacy route mappings
  "/personal/absences": "/pessoal",
  "/personal/absences/details/:id": "/pessoal",
  "/personal/holidays": "/pessoal/meus-feriados",
  "/personal/payslips": "/pessoal",
  "/personal/bonuses": "/pessoal",
  "/personal/time-tracking": "/pessoal",
  "/personal/time-tracking/details/:id": "/pessoal",
  "/registro-de-ponto": "/pessoal",
  "/human-resources": "/recursos-humanos",
  "/human-resources/employees": "/administracao/colaboradores",
  "/human-resources/employees/create": "/administracao/colaboradores/cadastrar",
  "/human-resources/employees/list": "/administracao/colaboradores",
  "/human-resources/employees/details": "/administracao/colaboradores",
  "/human-resources/employees/edit": "/administracao/colaboradores",
  "/human-resources/vacations": "/recursos-humanos/ferias",
  "/human-resources/vacations/create": "/recursos-humanos/ferias/cadastrar",
  "/human-resources/vacations/request": "/recursos-humanos/ferias/cadastrar",
  "/human-resources/vacations/list": "/recursos-humanos/ferias",
  "/human-resources/vacations/calendar": "/recursos-humanos/ferias/calendario",
  "/human-resources/vacations/details": "/recursos-humanos/ferias",
  "/human-resources/vacations/[id]/approve": "/recursos-humanos/ferias",
  "/human-resources/vacations/[id]/reject": "/recursos-humanos/ferias",
  "/producao/cronograma/aguardando": "/producao/em-espera",
  "/pintura/formulas/cadastrar": "/pintura/catalogo/cadastrar",
  "/pintura/producoes/cadastrar": "/pintura/producoes",
  "/pintura/tintas": "/pintura/tipos-de-tinta",
  "/pintura/tintas/cadastrar": "/pintura/tipos-de-tinta/cadastrar",
  "/pintura/tintas/tipos-de-tinta": "/pintura/tipos-de-tinta",
  "/pintura/tintas/tipos-de-tinta/cadastrar": "/pintura/tipos-de-tinta/cadastrar",
  "/recursos-humanos/advertencias": "/recursos-humanos/avisos",
  "/recursos-humanos/advertencias/cadastrar": "/recursos-humanos/avisos/cadastrar",
  "/recursos-humanos/ppe": "/recursos-humanos/epi",
  "/recursos-humanos/ppe/cadastrar": "/recursos-humanos/epi/cadastrar",
  "/recursos-humanos/ppe/agendamentos": "/recursos-humanos/epi/agendamentos",
  "/recursos-humanos/ppe/agendamentos/cadastrar": "/recursos-humanos/epi/agendamentos/cadastrar",
  "/recursos-humanos/ppe/entregas": "/recursos-humanos/epi/entregas",
  "/recursos-humanos/ppe/entregas/cadastrar": "/recursos-humanos/epi/entregas/cadastrar",
  "/recursos-humanos/ppe/tamanhos": "/recursos-humanos/epi/tamanhos",
  "/recursos-humanos/ppe/tamanhos/cadastrar": "/recursos-humanos/epi/tamanhos/cadastrar",
  "/statistics": "/estatisticas",
  "/statistics/production": "/estatisticas/producao",
  "/statistics/administration": "/estatisticas/administracao",
  "/statistics/human-resources": "/estatisticas/recursos-humanos",
  "/statistics/inventory": "/estatisticas/estoque",
};

/**
 * Fix a navigation path to ensure it points to a valid route
 */
export function fixNavigationPath(path: string): string {
  // Check if there's a direct fix available
  if (ROUTE_FIXES[path]) {
    return ROUTE_FIXES[path];
  }

  // Handle multiple dynamic segments specifically for formula routes
  if (path.includes("/detalhes/:paintId/formulas")) {
    // Check if it's already a valid formula route pattern
    if (isValidRoute(path)) {
      return path;
    }
    // Try to match against known formula route patterns
    if (path === "/pintura/catalogo/detalhes/:paintId/formulas") {
      return path; // This should be valid now
    }
    if (path === "/pintura/catalogo/detalhes/:paintId/formulas/detalhes/:formulaId") {
      return path; // This should be valid now
    }
  }

  // Check if path contains '/listar' and needs mapping
  if (path.includes("/listar")) {
    // First check if there's a specific mapping in ROUTE_FIXES
    if (ROUTE_FIXES[path]) {
      return ROUTE_FIXES[path];
    }
    // For /listar routes, usually the base path is the list view
    const mappedPath = path.replace("/listar", "");
    if (isValidRoute(mappedPath)) {
      return mappedPath;
    }
  }

  // Check for legacy English routes
  if (path.startsWith("/statistics")) {
    const portuguesePath = path.replace("/statistics", "/estatisticas");
    if (isValidRoute(portuguesePath)) {
      return portuguesePath;
    }
  }

  if (path.startsWith("/human-resources")) {
    const portuguesePath = path.replace("/human-resources", "/recursos-humanos");
    if (isValidRoute(portuguesePath)) {
      return portuguesePath;
    }
  }

  // Handle paint-specific legacy routes
  if (path.startsWith("/pintura/formulas")) {
    // All formula routes should redirect to catalog since formulas are managed within paint details
    if (path === "/pintura/formulas" || path === "/pintura/formulas/listar") {
      return "/pintura/catalogo";
    }
    if (path === "/pintura/formulas/cadastrar") {
      return "/pintura/catalogo/cadastrar";
    }
    if (path.match(/^\/pintura\/formulas\/detalhes\/[^/]+$/)) {
      // Formulas are now accessed through paint catalog details
      return "/pintura/catalogo";
    }
  }

  // Don't redirect domain roots - they should be valid routes
  if (isValidRoute(path)) {
    return path;
  }

  // If path ends with /cadastrar but parent exists, keep it
  if (path.endsWith("/cadastrar")) {
    const parentPath = path.replace("/cadastrar", "");
    if (isValidRoute(parentPath)) {
      return path; // Keep cadastrar if parent exists
    }
  }

  // Default: return the path as-is (might be a dynamic route)
  return path;
}

/**
 * Check if a route is valid (exists in our route definitions)
 */
export function isValidRoute(path: string): boolean {
  // Remove trailing slash for comparison
  const cleanPath = path.replace(/\/$/, "") || "/";

  // Check direct match
  if (VALID_ROUTES.includes(cleanPath)) {
    return true;
  }

  // Check if it matches a dynamic route pattern
  return VALID_ROUTES.some((route) => {
    // Type guard to ensure route is a string
    if (typeof route !== "string") {
      console.warn("Non-string value found in VALID_ROUTES:", route);
      return false;
    }

    if (route.includes(":")) {
      // Handle routes with multiple dynamic segments more carefully
      // Split both paths into segments and compare them
      const routeSegments = route.split("/");
      const pathSegments = cleanPath.split("/");

      // Must have same number of segments
      if (routeSegments.length !== pathSegments.length) {
        return false;
      }

      // Compare each segment
      return routeSegments.every((routeSegment, index) => {
        const pathSegment = pathSegments[index];

        // If route segment is dynamic parameter, accept any non-empty path segment
        if (routeSegment.startsWith(":")) {
          return pathSegment && pathSegment.length > 0;
        }

        // Otherwise, must match exactly
        return routeSegment === pathSegment;
      });
    }
    return false;
  });
}

/**
 * Validate all navigation menu routes
 */
export function validateNavigationRoutes() {
  const menuRoutes = getAllRoutes(MENU_ITEMS);
  const issues: Array<{ route: string; issue: string; fix?: string }> = [];

  menuRoutes.forEach((route) => {
    if (!isValidRoute(route)) {
      const fixedRoute = fixNavigationPath(route);
      issues.push({
        route,
        issue: "Route does not exist in App.tsx",
        fix: fixedRoute !== route ? fixedRoute : undefined,
      });
    }
  });

  return issues;
}

/**
 * Get corrected navigation menu with fixed routes
 */
export function getCorrectedNavigationMenu() {
  const fixMenu = (items: any[]): any[] => {
    return items.map((item) => {
      const correctedItem = { ...item };

      if (correctedItem.path) {
        correctedItem.path = fixNavigationPath(correctedItem.path);
      }

      if (correctedItem.children) {
        correctedItem.children = fixMenu(correctedItem.children);
      }

      return correctedItem;
    });
  };

  return fixMenu(MENU_ITEMS);
}

/**
 * Test all navigation routes and log issues
 */
export function testAllNavigationRoutes() {
  const allRoutes = getAllRoutes(MENU_ITEMS);
  const issues: { path: string; status: "invalid" | "mapped"; fixedPath?: string }[] = [];
  const validPaths: string[] = [];

  allRoutes.forEach((path) => {
    if (!path || path.includes(":id")) {
      // Skip dynamic routes for this test
      return;
    }

    if (ROUTE_FIXES[path]) {
      issues.push({
        path,
        status: "mapped",
        fixedPath: ROUTE_FIXES[path],
      });
    } else if (!isValidRoute(path)) {
      const fixedPath = fixNavigationPath(path);
      if (fixedPath !== path) {
        issues.push({
          path,
          status: "mapped",
          fixedPath,
        });
      } else {
        issues.push({
          path,
          status: "invalid",
        });
      }
    } else {
      validPaths.push(path);
    }
  });

  if (issues.length > 0) {
    issues.forEach((issue) => {
      if (issue.status === "mapped") {
        // Handle mapped issues
      } else {
        // Handle invalid issues
      }
    });
  }

  return { validPaths, issues };
}
