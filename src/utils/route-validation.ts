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
  // routes.production.schedule.create, // Removed - tasks are now created in the "in preparation" page
  routes.production.schedule.edit(":id"),
  routes.production.schedule.details(":id"),
  routes.production.preparation.root,
  routes.production.preparation.details(":id"),
  routes.production.history.root,
  routes.production.history.cancelled,
  routes.production.history.completed,
  routes.production.cutting.root,
  routes.production.observations.root,
  routes.production.observations.create,
  routes.production.observations.edit(":id"),
  routes.production.observations.details(":id"),

  // Administration routes
  routes.administration.root,
  routes.financial.customers.root,
  routes.financial.customers.create,
  routes.financial.customers.edit(":id"),
  routes.financial.customers.details(":id"),
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

  // Financeiro routes
  "/financeiro/clientes",

  // Statistics routes
  routes.statistics.root,
  routes.statistics.production.root,
  routes.statistics.production.productivity,
  routes.statistics.production.performance,
  routes.statistics.production.bottlenecks,
  routes.statistics.production.bonusValue,
  routes.statistics.personnelDepartment.root,
  routes.statistics.personnelDepartment.payroll,
  routes.statistics.personnelDepartment.teamPerformance,
  routes.statistics.personnelDepartment.absenteeism,
  routes.statistics.financial.root,
  routes.statistics.financial.collection,
  routes.statistics.inventory.root,
  routes.statistics.inventory.consumption,
  routes.statistics.inventory.orders,

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
  routes.inventory.externalOperations.root,
  routes.inventory.externalOperations.create,
  routes.inventory.externalOperations.edit(":id"),
  routes.inventory.externalOperations.details(":id"),
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

  // Personnel Department routes
  routes.personnelDepartment.root,
  routes.personnelDepartment.requisicoes.root,
  routes.personnelDepartment.requisicoes.list,
  routes.personnelDepartment.positions.root,
  routes.personnelDepartment.positions.create,
  routes.personnelDepartment.positions.edit(":id"),
  routes.personnelDepartment.positions.details(":id"),
  routes.personnelDepartment.positions.remunerations(":positionId"),
  routes.personnelDepartment.vacations.root,
  routes.personnelDepartment.vacations.create,
  routes.personnelDepartment.vacations.details(":id"),
  routes.personnelDepartment.calendar.root,
  routes.personnelDepartment.warnings.root,
  routes.personnelDepartment.warnings.create,
  routes.personnelDepartment.warnings.edit(":id"),
  routes.personnelDepartment.warnings.details(":id"),
  // EPI delivery & schedule pages — moved to Medicina do Trabalho (Occupational Health).
  routes.occupationalHealth.ppe.deliveries.root,
  routes.occupationalHealth.ppe.deliveries.create,
  routes.occupationalHealth.ppe.deliveries.edit(":id"),
  routes.occupationalHealth.ppe.deliveries.details(":id"),
  routes.occupationalHealth.ppe.schedules.root,
  routes.occupationalHealth.ppe.schedules.create,
  routes.occupationalHealth.ppe.schedules.edit(":id"),
  routes.occupationalHealth.ppe.schedules.details(":id"),

  // Personal routes
  routes.personal.root,
  routes.personal.myHolidays.root,
  routes.personal.myPpes.root,
  routes.personal.myPpes.details(":id"),
  routes.personal.myPpes.request,
  routes.personal.myLoans.root,
  routes.personal.myLoans.details(":id"),
  routes.personal.myActivities.root,
  routes.personal.myActivities.details(":id"),

  // My Team routes
  routes.myTeam.root,
  routes.myTeam.warnings,
  routes.myTeam.loans,

  // Catalog routes
  routes.catalog.root,
  routes.catalog.details(":id"),

  // Maintenance routes
  routes.maintenance.root,
  routes.maintenance.details(":id"),

  // Profile route
  routes.profile,

  // Financial - Reconciliation (Conciliação Bancária) routes
  routes.financial.reconciliation.root,
  routes.financial.reconciliation.statement,
  routes.financial.reconciliation.transactions,
  routes.financial.reconciliation.transactionDetail(":id"),
  routes.financial.reconciliation.fiscalDocuments,
  routes.financial.reconciliation.fiscalDocumentDetail(":id"),
  routes.financial.reconciliation.categories,
  routes.financial.reconciliation.outflows,
  routes.financial.accountsReceivable.root,

  // Financial - Outflow forecast (Previsão de Saídas)
  routes.financial.outflowForecast,

  // Financial - Accounts Payable (Contas a Pagar) route
  routes.financial.accountsPayable.root,

  // Personnel Department - Payroll (Folha de Pagamento) routes
  routes.personnelDepartment.payroll.root,
  routes.personnelDepartment.payroll.create,
  routes.personnelDepartment.payroll.detail(":id"),
  routes.personnelDepartment.payroll.edit(":id"),

  // Personnel Department - Loans (Empréstimos) route
  routes.personnelDepartment.loans.root,

  // Personnel Department (Departamento Pessoal) routes
  routes.personnelDepartment.root,
  routes.personnelDepartment.admissions.root,
  routes.personnelDepartment.admissions.create,
  routes.personnelDepartment.admissions.details(":id"),
  routes.personnelDepartment.admissions.edit(":id"),
  routes.personnelDepartment.terminations.root,
  routes.personnelDepartment.terminations.create,
  routes.personnelDepartment.terminations.details(":id"),
  routes.personnelDepartment.terminations.edit(":id"),
  routes.personnelDepartment.vacations.root,
  routes.personnelDepartment.vacations.create,
  routes.personnelDepartment.vacations.details(":id"),
  routes.personnelDepartment.vacations.edit(":id"),
  routes.personnelDepartment.salaryAdjustments.root,
  routes.personnelDepartment.salaryAdjustments.details(":id"),
  routes.personnelDepartment.promotions.root,
  routes.personnelDepartment.benefits.root,
  routes.personnelDepartment.benefits.create,
  routes.personnelDepartment.benefits.details(":id"),
  routes.personnelDepartment.benefits.edit(":id"),
  routes.personnelDepartment.benefits.enrollments.root,
  routes.personnelDepartment.benefits.enrollments.create,
  routes.personnelDepartment.benefits.enrollments.details(":id"),
  routes.personnelDepartment.benefits.enrollments.edit(":id"),

  // Occupational Health (Medicina do Trabalho) routes
  routes.occupationalHealth.root,
  routes.occupationalHealth.medicalExams.root,
  routes.occupationalHealth.medicalExams.create,
  routes.occupationalHealth.medicalExams.details(":id"),
  routes.occupationalHealth.medicalExams.edit(":id"),
  routes.occupationalHealth.periodicExams.root,
  routes.occupationalHealth.leaves.root,
  routes.occupationalHealth.leaves.create,
  routes.occupationalHealth.leaves.details(":id"),
  routes.occupationalHealth.leaves.edit(":id"),
  routes.occupationalHealth.workAccidents.root,
  routes.occupationalHealth.workAccidents.create,
  routes.occupationalHealth.workAccidents.details(":id"),
  routes.occupationalHealth.workAccidents.edit(":id"),

  // Tools (Ferramentas) - Employee Cost & Notas routes
  routes.tools.employeeCost.root,
  routes.tools.notes.root,
];

/**
 * Route mapping to fix navigation paths that don't match actual routes
 */
export const ROUTE_FIXES: Record<string, string> = {
  // Production route mappings
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
  "/estoque/operacoes-externas/listar": "/estoque/operacoes-externas",
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
  "/administracao/clientes/listar": "/financeiro/clientes",
  "/departamento-pessoal/colaboradores/listar": "/departamento-pessoal/colaboradores",
  "/administracao/registros-de-alteracoes/listar": "/servidor/registros-de-alteracoes",
  "/administracao/registros-de-alteracoes": "/servidor/registros-de-alteracoes",
  "/administracao/arquivos/listar": "/administracao/arquivos",
  "/administracao/setores/listar": "/administracao/setores",
  "/administracao/notificacoes/listar": "/administracao/notificacoes",

  // Personnel Department route mappings
  "/departamento-pessoal/cargos/listar": "/departamento-pessoal/cargos",
  "/departamento-pessoal/ausencias/listar": "/departamento-pessoal/ferias",
  "/departamento-pessoal/ausencias": "/departamento-pessoal/ferias",
  "/departamento-pessoal/ausencias/cadastrar": "/departamento-pessoal/ferias/cadastrar",
  "/departamento-pessoal/faltas/listar": "/departamento-pessoal",
  "/departamento-pessoal/faltas": "/departamento-pessoal",
  "/departamento-pessoal/faltas/cadastrar": "/departamento-pessoal",
  "/departamento-pessoal/feriados/listar": "/departamento-pessoal/feriados",
  "/departamento-pessoal/feriados/detalhes/:id": "/departamento-pessoal/feriados/:id",
  "/departamento-pessoal/avisos/listar": "/departamento-pessoal/avisos",

  // Personal (Pessoal) route mappings
  "/pessoal/meus-feriados": "/pessoal/feriados",
  "/pessoal/meus-feriados/listar": "/pessoal/feriados",
  "/pessoal/meus-epis/listar": "/pessoal/meus-epis",
  "/pessoal/meus-emprestimos/listar": "/pessoal/meus-emprestimos",
  "/pessoal/minhas-atividades/listar": "/pessoal/minhas-atividades",

  // My Team (Meu Pessoal) route mappings
  "/meu-pessoal/avisos/listar": "/meu-pessoal/avisos",
  "/meu-pessoal/emprestimos/listar": "/meu-pessoal/emprestimos",

  // Statistics route mappings
  "/estatisticas/producao/listar": "/estatisticas/producao",
  "/estatisticas/departamento-pessoal/listar": "/estatisticas/departamento-pessoal",
  "/estatisticas/estoque/listar": "/estatisticas/estoque",

  // Maintenance route mappings
  "/manutencao/listar": "/manutencao",

  // Missing route mappings - these paths exist in navigation but need to be added to routes
  "/estoque/ppe/configuracoes": "/estoque/epi",
  "/estoque/ppe/configuracoes/cadastrar": "/estoque/epi/cadastrar",
  "/departamento-pessoal/colaboradores/detalhes": "/departamento-pessoal/colaboradores",
  "/departamento-pessoal/colaboradores/editar": "/departamento-pessoal/colaboradores",
  "/departamento-pessoal/setores": "/administracao/setores",
  "/departamento-pessoal/setores/cadastrar": "/administracao/setores/cadastrar",
  "/departamento-pessoal/vagas": "/departamento-pessoal/vagas",
  "/departamento-pessoal/vagas/cadastrar": "/departamento-pessoal/vagas/cadastrar",

  // Financial sector route mappings - redirect to main production routes
  "/financeiro/producao": "/producao",
  "/financeiro/producao/aerografia": "/producao/aerografia/listar",
  "/financeiro/producao/cronograma": "/producao/cronograma",
  "/financeiro/producao/em-espera": "/producao/agenda",
  "/financeiro/producao/em-preparacao": "/producao/agenda",
  "/financeiro/producao/agenda": "/producao/agenda",
  "/financeiro/producao/historico-tarefas": "/producao/historico",
  // Simplified financial routes (cleaner menu structure)
  "/financeiro/agenda": "/producao/agenda",
  "/financeiro/aerografia": "/producao/aerografia/listar",

  // Designer sector routes - no redirects needed, they use regular production/painting routes directly

  // Legacy route mappings
  "/personal/absences": "/pessoal",
  "/personal/absences/details/:id": "/pessoal",
  "/personal/holidays": "/pessoal/meus-feriados",
  "/personal/payslips": "/pessoal",
  "/personal/bonuses": "/pessoal",
  "/personal/time-tracking": "/pessoal",
  "/personal/time-tracking/details/:id": "/pessoal",
  "/registro-de-ponto": "/pessoal",
  "/producao/cronograma/aguardando": "/producao/agenda",
  "/producao/em-espera": "/producao/agenda",
  "/pintura/formulas/cadastrar": "/pintura/catalogo/cadastrar",
  "/pintura/producoes/cadastrar": "/pintura/producoes",
  "/pintura/tintas": "/pintura/tipos-de-tinta",
  "/pintura/tintas/cadastrar": "/pintura/tipos-de-tinta/cadastrar",
  "/pintura/tintas/tipos-de-tinta": "/pintura/tipos-de-tinta",
  "/pintura/tintas/tipos-de-tinta/cadastrar": "/pintura/tipos-de-tinta/cadastrar",
  "/departamento-pessoal/advertencias": "/departamento-pessoal/avisos",
  "/departamento-pessoal/advertencias/cadastrar": "/departamento-pessoal/avisos/cadastrar",
  "/statistics": "/estatisticas",
  "/statistics/production": "/estatisticas/producao",
  "/statistics/inventory": "/estatisticas/estoque",
};

/**
 * Fix a navigation path to ensure it points to a valid route
 * If the path contains dynamic segments (like :id, :key), replace them with
 * actual values from the current URL when possible
 */
export function fixNavigationPath(path: string): string {
  // If path contains dynamic parameters, try to replace them with actual values from current URL
  if (path.includes(":")) {
    const currentPath = typeof window !== "undefined" ? window.location.pathname : "";

    // Split both paths into segments
    const pathSegments = path.split("/");
    const currentSegments = currentPath.split("/");

    // If same number of segments, try to replace dynamic params with actual values
    if (pathSegments.length === currentSegments.length) {
      const resolvedSegments = pathSegments.map((segment, index) => {
        if (segment.startsWith(":")) {
          // Replace dynamic segment with actual value from current URL
          const actualValue = currentSegments[index];
          // Only use the actual value if it's not also a dynamic param
          if (actualValue && !actualValue.startsWith(":")) {
            return actualValue;
          }
        }
        return segment;
      });

      const resolvedPath = resolvedSegments.join("/");
      // Only use resolved path if it no longer contains dynamic params
      if (!resolvedPath.includes(":")) {
        return resolvedPath;
      }
    }

    // If we couldn't resolve all params, return current path if it matches the pattern
    // This prevents navigating to literal :key URLs
    const pathPattern = path.replace(/:[^/]+/g, "[^/]+");
    const regex = new RegExp(`^${pathPattern}$`);
    if (regex.test(currentPath)) {
      return currentPath;
    }
  }

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
      if (process.env.NODE_ENV !== 'production') {
        console.warn("Non-string value found in VALID_ROUTES:", route);
      }
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
