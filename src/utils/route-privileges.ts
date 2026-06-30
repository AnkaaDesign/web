import { SECTOR_PRIVILEGES, TEAM_LEADER } from "../constants";
import { routes } from "../constants";

// Type for route privileges that includes both enum values and the virtual TEAM_LEADER
type RoutePrivilege = keyof typeof SECTOR_PRIVILEGES | typeof TEAM_LEADER;
type RoutePrivilegeValue = RoutePrivilege | RoutePrivilege[];

// Enhanced route privilege mappings with support for arrays and granular permissions
export const ROUTE_PRIVILEGES: Record<string, RoutePrivilegeValue> = {
  // Home - All authenticated users can access (all privileges)
  "/": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL", "ACCOUNTING"],

  // Administração - Admin access (messages also accessible to production manager)
  "/administracao": "ADMIN",
  "/administracao/aplicativos": "ADMIN",
  "/administracao/mensagens": ["ADMIN", "PRODUCTION_MANAGER", "ACCOUNTING"],
  "/administracao/mensagens/criar": ["ADMIN", "PRODUCTION_MANAGER", "ACCOUNTING"],
  "/administracao/mensagens/*": ["ADMIN", "PRODUCTION_MANAGER", "ACCOUNTING"],
  // Colaboradores (employee directory) lives at /departamento-pessoal/colaboradores
  // (see the Departamento Pessoal section below).
  "/administracao/avaliacao-competencias": ["ADMIN", "HUMAN_RESOURCES", "PRODUCTION_MANAGER"],
  "/administracao/avaliacao-competencias/*": ["ADMIN", "HUMAN_RESOURCES", "PRODUCTION_MANAGER"],
  "/administracao/competencias": ["ADMIN", "HUMAN_RESOURCES", "PRODUCTION_MANAGER"],
  "/administracao/competencias/*": ["ADMIN", "HUMAN_RESOURCES", "PRODUCTION_MANAGER"],
  "/administracao/topicos": ["ADMIN", "HUMAN_RESOURCES", "PRODUCTION_MANAGER"],
  "/administracao/topicos/*": ["ADMIN", "HUMAN_RESOURCES", "PRODUCTION_MANAGER"],
  // Questionnaires — admin management (campaigns + temas + perguntas catalogue)
  "/administracao/questionarios": ["ADMIN", "HUMAN_RESOURCES", "PRODUCTION_MANAGER"],
  "/administracao/questionarios/*": ["ADMIN", "HUMAN_RESOURCES", "PRODUCTION_MANAGER"],
  "/administracao/questionarios-temas": ["ADMIN", "HUMAN_RESOURCES", "PRODUCTION_MANAGER"],
  "/administracao/questionarios-temas/*": ["ADMIN", "HUMAN_RESOURCES", "PRODUCTION_MANAGER"],
  "/administracao/questionarios-perguntas": ["ADMIN", "HUMAN_RESOURCES", "PRODUCTION_MANAGER"],
  "/administracao/questionarios-perguntas/*": ["ADMIN", "HUMAN_RESOURCES", "PRODUCTION_MANAGER"],

  // Servidor - Server management routes (mostly admin, file manager also accessible to commercial and production manager)
  "/servidor/gerenciador-de-arquivos": ["ADMIN", "COMMERCIAL", "PRODUCTION_MANAGER"],
  "/servidor/gerenciador-de-arquivos/*": ["ADMIN", "COMMERCIAL", "PRODUCTION_MANAGER"],

  "/administracao/registros-de-alteracoes": "ADMIN",
  "/administracao/arquivos": "ADMIN",
  "/administracao/notificacoes": "ADMIN",

  // Financeiro - Financial sector routes
  "/financeiro": ["FINANCIAL", "ADMIN", "COMMERCIAL", "ACCOUNTING"],
  "/financeiro/*": ["FINANCIAL", "ADMIN", "COMMERCIAL", "ACCOUNTING"],
  "/financeiro/clientes": ["FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "ADMIN", "COMMERCIAL"],
  "/financeiro/clientes/detalhes/:id": ["FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "ADMIN", "COMMERCIAL"],
  "/financeiro/clientes/editar/:id": ["FINANCIAL", "ADMIN", "COMMERCIAL", "LOGISTIC", "PRODUCTION_MANAGER"],
  "/financeiro/clientes/cadastrar": ["FINANCIAL", "ADMIN", "COMMERCIAL", "LOGISTIC", "PRODUCTION_MANAGER"],
  "/financeiro/clientes/editar-em-lote": ["FINANCIAL", "ADMIN", "COMMERCIAL"],
  "/financeiro/clientes/responsaveis": ["ADMIN", "COMMERCIAL"],
  "/financeiro/clientes/responsaveis/cadastrar": ["ADMIN", "COMMERCIAL"],
  "/financeiro/clientes/responsaveis/detalhes/:id": ["ADMIN", "COMMERCIAL"],
  "/financeiro/clientes/responsaveis/editar/:id": ["ADMIN", "COMMERCIAL"],
  "/financeiro/faturamento": ["FINANCIAL", "ADMIN", "COMMERCIAL", "ACCOUNTING"],
  "/financeiro/faturamento/detalhes/:id": ["FINANCIAL", "ADMIN", "COMMERCIAL", "ACCOUNTING"],
  "/financeiro/orcamento": ["FINANCIAL", "ADMIN", "COMMERCIAL"],
  "/financeiro/orcamento/cadastrar": ["ADMIN", "COMMERCIAL"],
  "/financeiro/orcamento/detalhes/:id": ["FINANCIAL", "ADMIN", "COMMERCIAL"],
  // Unified Notas Fiscais page (Emitidas via Elotech + Recebidas via SIEG) — the
  // direction toggle is sector-defaulted; ACCOUNTING included for the Recebidas tab.
  "/financeiro/notas-fiscais": ["FINANCIAL", "ADMIN", "COMMERCIAL", "ACCOUNTING"],
  // NFS-e detail stays issuance-side (no ACCOUNTING).
  "/financeiro/notas-fiscais/:id": ["FINANCIAL", "ADMIN", "COMMERCIAL"],
  // Contas a Pagar - orders by payment status (ACCOUNTING + FINANCIAL + ADMIN)
  "/financeiro/contas-a-pagar": ["ACCOUNTING", "FINANCIAL", "ADMIN"],
  // Conciliação Bancária — spec pages (Área Andressa §4). Explicit entries tighten
  // access vs the "/financeiro/*" wildcard (COMMERCIAL excluded here).
  "/financeiro/conciliacao/extrato": ["ACCOUNTING", "FINANCIAL", "ADMIN"],
  "/financeiro/conciliacao/saidas": ["ACCOUNTING", "FINANCIAL", "ADMIN"],
  "/financeiro/conciliacao/entradas": ["ACCOUNTING", "FINANCIAL", "ADMIN"],
  // Notas Fiscais (Recebidas tab) + Categorias + first-class/legacy recorrentes —
  // explicit entries so they match the menu intent instead of the broad wildcard.
  "/financeiro/conciliacao/notas": ["ACCOUNTING", "FINANCIAL", "ADMIN"],
  "/financeiro/conciliacao/notas/:id": ["ACCOUNTING", "FINANCIAL", "ADMIN"],
  "/financeiro/conciliacao/categorias": ["ACCOUNTING", "FINANCIAL", "ADMIN"],
  "/financeiro/contas-recorrentes": ["ACCOUNTING", "FINANCIAL", "ADMIN"],
  "/financeiro/contas-recorrentes/cadastrar": ["ACCOUNTING", "FINANCIAL", "ADMIN"],
  "/financeiro/contas-recorrentes/editar/:id": ["ACCOUNTING", "FINANCIAL", "ADMIN"],
  // Previsão de Saídas — moved out of the conciliação domain to top-level Financeiro.
  "/financeiro/previsao-de-saidas": ["ACCOUNTING", "FINANCIAL", "ADMIN"],
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
  "/estatisticas": "ADMIN",
  "/estatisticas/*": "ADMIN",
  // PRODUCTION_MANAGER stat pages — explicit allowlist (otherwise falls back to ADMIN default)
  "/estatisticas/departamento-pessoal": ["ADMIN", "PRODUCTION_MANAGER"],
  "/estatisticas/departamento-pessoal/equipe": ["ADMIN", "PRODUCTION_MANAGER"],
  "/estatisticas/departamento-pessoal/competencias": ["ADMIN", "PRODUCTION_MANAGER"],
  "/estatisticas/producao/desempenho": ["ADMIN", "PRODUCTION_MANAGER"],

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
  [routes.inventory.warehouseLocations.root]: "WAREHOUSE",
  "/estoque/localizacoes/detalhes/:id": "WAREHOUSE", // Warehouse location detail
  "/estoque/localizacoes/editar/:id": "WAREHOUSE", // Warehouse location edit
  "/estoque/localizacoes/cadastrar": "WAREHOUSE", // Warehouse location create
  [routes.inventory.orders.root]: ["WAREHOUSE", "ACCOUNTING", "ADMIN"], // ACCOUNTING reads orders (contas a pagar context)
  "/estoque/pedidos/detalhes/:id": ["WAREHOUSE", "FINANCIAL", "ACCOUNTING", "ADMIN"], // Order detail - FINANCIAL/ACCOUNTING read access (contas a pagar links here)
  "/estoque/pedidos/editar/:id": "WAREHOUSE", // Order edit
  "/estoque/pedidos/cadastrar": "WAREHOUSE", // Order create
  [routes.inventory.orders.automatic.root]: "ADMIN", // Automatic orders require admin
  [routes.inventory.maintenance.root]: ["WAREHOUSE", "MAINTENANCE", "ADMIN"], // Maintenance operations
  [routes.inventory.maintenance.list]: ["WAREHOUSE", "MAINTENANCE", "ADMIN"], // Maintenance list
  "/estoque/manutencao/detalhes/:id": ["WAREHOUSE", "MAINTENANCE", "ADMIN"], // Maintenance detail
  "/estoque/manutencao/editar/:id": ["WAREHOUSE", "MAINTENANCE", "ADMIN"], // Maintenance edit
  "/estoque/manutencao/cadastrar": ["WAREHOUSE", "MAINTENANCE", "ADMIN"], // Maintenance create
  [routes.inventory.ppe.root]: "WAREHOUSE",
  [routes.inventory.ppe.deliveries.root]: ["HUMAN_RESOURCES", "WAREHOUSE", "ADMIN"], // PPE deliveries - Warehouse can view and mark as delivered
  [routes.inventory.ppe.deliveries.create]: ["HUMAN_RESOURCES", "WAREHOUSE", "ADMIN"], // HR, Warehouse, and Admin can create (matches API)
  [routes.inventory.ppe.schedules.root]: ["HUMAN_RESOURCES", "WAREHOUSE", "ADMIN"], // PPE schedules - Warehouse can view
  [routes.inventory.ppe.schedules.create]: ["HUMAN_RESOURCES", "WAREHOUSE", "ADMIN"], // HR, Warehouse, and Admin can create schedules (matches API)
  "/estoque/epi/agendamentos/editar/:id": ["HUMAN_RESOURCES", "WAREHOUSE", "ADMIN"], // HR, Warehouse, and Admin can edit schedules (matches API) - dynamic route
  [routes.inventory.loans.root]: "WAREHOUSE",
  "/estoque/emprestimos/detalhes/:id": "WAREHOUSE", // Borrow detail pages
  "/estoque/emprestimos/editar/:id": "WAREHOUSE", // Borrow edit pages
  "/estoque/emprestimos/cadastrar": "WAREHOUSE", // Borrow create page
  "/estoque/emprestimos/editar-lote": "WAREHOUSE", // Borrow batch edit
  [routes.inventory.externalOperations.root]: "ADMIN", // External operation list - ADMIN only (matches API)
  "/estoque/operacoes-externas/detalhes/:id": "ADMIN", // External operation detail - ADMIN only (matches API)
  "/estoque/operacoes-externas/editar/:id": "ADMIN", // External operation edit - ADMIN only (matches API)
  "/estoque/operacoes-externas/cadastrar": "ADMIN", // External operation create - ADMIN only (matches API)

  // Favorites - All authenticated users can access
  "/favoritos": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL", "ACCOUNTING"],

  // Profile - All authenticated users can access
  "/perfil": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL", "ACCOUNTING"],
  "/perfil/notificacoes": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL", "ACCOUNTING"], // Profile notifications

  // Personal - All authenticated users can access (personal info)
  "/pessoal": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL", "ACCOUNTING"],
  "/pessoal/mensagens": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL", "ACCOUNTING"],
  "/pessoal/*": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL", "ACCOUNTING"],
  // Self-fill questionnaires — available to ALL users (sent to anyone)
  "/pessoal/questionarios": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL", "ACCOUNTING"],
  "/pessoal/questionarios/*": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL", "ACCOUNTING"],

  // Meu Pessoal - Team leader access (sector employee management)
  // Uses TEAM_LEADER virtual privilege which checks user.ledSector relation
  "/meu-pessoal": "TEAM_LEADER",

  // Pintura - Warehouse operations (PRODUCTION excluded from paint catalog)
  "/pintura": ["WAREHOUSE", "DESIGNER", "LOGISTIC", "PRODUCTION_MANAGER", "ADMIN"],
  "/pintura/catalogo": ["WAREHOUSE", "DESIGNER", "ADMIN", "COMMERCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "PRODUCTION"],
  // NOTE: /pintura/catalogo-basico privileges defined using routes.catalog.root on line 193 to avoid duplication
  "/pintura/catalogo/detalhes/:id": ["WAREHOUSE", "DESIGNER", "ADMIN", "COMMERCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "PRODUCTION", "TEAM_LEADER"],
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
  [routes.production.root]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "PLOTTING", "COMMERCIAL"], // Team leaders check at component level
  [routes.production.schedule.root]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "PLOTTING", "COMMERCIAL"], // Team leaders check at component level
  // [routes.production.schedule.create]: ["PRODUCTION", "WAREHOUSE"], // Removed - tasks are now created in the "in preparation" page
  [routes.production.schedule.details(":id")]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "PLOTTING", "COMMERCIAL", "ADMIN"], // Task detail page
  [routes.production.schedule.edit(":id")]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "COMMERCIAL", "ADMIN"], // DESIGNER, FINANCIAL, LOGISTIC, PRODUCTION_MANAGER can edit with restrictions (PLOTTING excluded - API rejects)
  [routes.production.preparation.root]: ["DESIGNER", "LOGISTIC", "PRODUCTION_MANAGER", "COMMERCIAL", "ADMIN"], // PRODUCTION, WAREHOUSE, and FINANCIAL excluded from preparation (FINANCIAL uses /financeiro/faturamento)
  [routes.production.preparation.create]: ["COMMERCIAL", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "ADMIN"], // Preparation task create - matches API task create roles
  [routes.production.preparation.details(":id")]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "PLOTTING", "COMMERCIAL", "ADMIN"], // Task detail page (shared with schedule/history) — full 9-sector audience so task deep-links (which route to /agenda) don't 403 WAREHOUSE/PLOTTING
  "/producao/agenda/detalhes/:id": ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "PLOTTING", "COMMERCIAL", "ADMIN"], // Agenda details — same 9-sector audience as schedule.details/history.details
  [routes.production.preparation.edit(":id")]: ["PRODUCTION", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "COMMERCIAL", "ADMIN"], // Preparation task edit - WAREHOUSE excluded
  "/producao/agenda/editar/:id": ["PRODUCTION", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "COMMERCIAL", "ADMIN"], // Agenda edit - explicit route for designer access
  [routes.production.history.root]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "PLOTTING", "COMMERCIAL"], // Team leaders check at component level
  [routes.production.history.details(":id")]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "PLOTTING", "COMMERCIAL", "ADMIN"], // History detail page
  [routes.production.garages.root]: ["PRODUCTION", "WAREHOUSE", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "COMMERCIAL", "ADMIN"], // Garages/Barracões - LOGISTIC and PRODUCTION_MANAGER can edit layouts
  [routes.production.airbrushings.root]: ["WAREHOUSE", "FINANCIAL", "COMMERCIAL", "ADMIN"], // PRODUCTION and DESIGNER excluded from airbrushings
  [routes.production.airbrushings.list]: ["WAREHOUSE", "FINANCIAL", "COMMERCIAL", "ADMIN"],
  [routes.production.airbrushings.create]: ["COMMERCIAL", "FINANCIAL", "ADMIN"], // WAREHOUSE read-only (API rejects writes); PRODUCTION and DESIGNER excluded
  [routes.production.airbrushings.edit(":id")]: ["COMMERCIAL", "FINANCIAL", "ADMIN"], // WAREHOUSE read-only (API rejects writes); PRODUCTION and DESIGNER excluded

  // Cut-related routes - DESIGNER and PLOTTING have read-only access, WAREHOUSE removed
  [routes.production.cutting.root]: ["PRODUCTION", "DESIGNER", "PLOTTING", "ADMIN"],
  [routes.production.cutting.details(":id")]: ["PRODUCTION", "DESIGNER", "PLOTTING", "ADMIN"], // Cutting detail

  // Observations - accessible to production-related sectors (read-only for most, edit for admin)
  // DESIGNER and LOGISTIC excluded from observations
  [routes.production.observations.root]: ["PRODUCTION", "WAREHOUSE", "FINANCIAL", "COMMERCIAL", "PRODUCTION_MANAGER", "ADMIN"],
  [routes.production.observations.details(":id")]: ["PRODUCTION", "WAREHOUSE", "FINANCIAL", "COMMERCIAL", "PRODUCTION_MANAGER", "ADMIN"],
  [routes.production.observations.create]: ["WAREHOUSE", "COMMERCIAL", "FINANCIAL", "PRODUCTION_MANAGER", "ADMIN"], // Warehouse, commercial, financial, production manager, and admin can create (PRODUCTION excluded - API rejects)
  [routes.production.observations.edit(":id")]: ["WAREHOUSE", "COMMERCIAL", "FINANCIAL", "PRODUCTION_MANAGER", "ADMIN"], // Warehouse, commercial, financial, production manager, and admin can edit (PRODUCTION excluded - API rejects)

  // Registro de Ponto - All authenticated users can access
  "/registro-de-ponto": ["BASIC", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "ADMIN", "PRODUCTION", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL", "ACCOUNTING"],

  // Departamento Pessoal - HR with admin requirements for sensitive operations
  // ACCOUNTING (Departamento Pessoal) shares the HR routes granted by the accounting-area contract.
  "/departamento-pessoal": ["HUMAN_RESOURCES", "ACCOUNTING", "ADMIN"],
  // Colaboradores (employee directory) — canonical home under Departamento Pessoal.
  // List/detail open to the DP audience + Production Manager; edit excludes PM;
  // create is ADMIN-only (matches the page-level guards).
  "/departamento-pessoal/colaboradores": ["ADMIN", "HUMAN_RESOURCES", "ACCOUNTING", "PRODUCTION_MANAGER"],
  "/departamento-pessoal/colaboradores/detalhes/:id": ["ADMIN", "HUMAN_RESOURCES", "ACCOUNTING", "PRODUCTION_MANAGER"],
  "/departamento-pessoal/colaboradores/editar/:id": ["ADMIN", "HUMAN_RESOURCES", "ACCOUNTING"],
  "/departamento-pessoal/colaboradores/editar-em-lote": ["ADMIN", "HUMAN_RESOURCES", "ACCOUNTING"],
  "/departamento-pessoal/colaboradores/cadastrar": "ADMIN", // Employee creation requires admin
  "/departamento-pessoal/setores": "HUMAN_RESOURCES",
  "/departamento-pessoal/setores/cadastrar": "ADMIN", // Department creation requires admin
  "/departamento-pessoal/cargos": ["HUMAN_RESOURCES", "ACCOUNTING", "ADMIN"],
  "/departamento-pessoal/cargos/cadastrar": "ADMIN", // Position creation requires admin
  // Integração Secullum — ADMIN only (edits the live integration mapping + diagnostics).
  // Explicit exact entry so it wins over the "/departamento-pessoal/*" HR/ACCOUNTING/ADMIN wildcard.
  "/departamento-pessoal/integracoes/secullum": "ADMIN",
  "/departamento-pessoal/integracoes/secullum/*": "ADMIN",
  // Unified Controle de Ponto. View tabs (colaborador, dia, ausências) are open to
  // this audience; the edit tabs (edição, fechamento) are gated client-side to HR + ADMIN
  // via PrivilegeRoute on each page + the hrOnly tab filter.
  "/departamento-pessoal/controle-ponto": ["HUMAN_RESOURCES", "ADMIN", "PRODUCTION_MANAGER", "FINANCIAL", "ACCOUNTING"],
  // View tabs are explicitly listed so they win over the "/departamento-pessoal/*" HR-only
  // wildcard below. Edição and Fechamento intentionally have NO entry here — they fall
  // through to the wildcard (HR/ACCOUNTING/ADMIN) and are further guarded per-page via PrivilegeRoute.
  // COMMERCIAL excluded — the Secullum API endpoints reject it.
  "/departamento-pessoal/controle-ponto/colaborador": ["HUMAN_RESOURCES", "ADMIN", "PRODUCTION_MANAGER", "FINANCIAL", "ACCOUNTING"],
  "/departamento-pessoal/controle-ponto/dia": ["HUMAN_RESOURCES", "ADMIN", "PRODUCTION_MANAGER", "FINANCIAL", "ACCOUNTING"],
  "/departamento-pessoal/controle-ponto/ausencias": ["HUMAN_RESOURCES", "ADMIN", "PRODUCTION_MANAGER", "FINANCIAL", "ACCOUNTING"],
  // Calendário now surfaced under Ferramentas for HR/ACCOUNTING/ADMIN + PRODUCTION_MANAGER.
  "/departamento-pessoal/calendario": ["HUMAN_RESOURCES", "ACCOUNTING", "ADMIN", "PRODUCTION_MANAGER"],
  // Feriados moved to Departamento Pessoal — HR/ADMIN only (ACCOUNTING intentionally
  // excluded, matching the menu). Old /departamento-pessoal/feriados URL is handled by a
  // legacy redirect route and still matches the "/departamento-pessoal/*" HR/ACC/ADMIN wildcard.
  "/departamento-pessoal/feriados": ["HUMAN_RESOURCES", "ADMIN"],
  "/departamento-pessoal/feriados/*": ["HUMAN_RESOURCES", "ADMIN"],
  // Requisições now lives under Controle de Ponto. Explicit entry (wins over the
  // "/departamento-pessoal/*" wildcard) so its audience is documented.
  "/departamento-pessoal/controle-ponto/requisicoes": ["HUMAN_RESOURCES", "ACCOUNTING", "ADMIN"],
  "/departamento-pessoal/avisos": ["HUMAN_RESOURCES", "ACCOUNTING", "ADMIN"],
  // EPI delivery management lives under "/medicina-do-trabalho/*" (covered by its wildcard).

  // Departamento Pessoal - Personnel Department (HR / ACCOUNTING / ADMIN)
  // Production Manager additionally manages its team's admissions, terminations and
  // vacations — explicit entries (longer wildcards win) add PRODUCTION_MANAGER to just
  // those three areas; the rest of /departamento-pessoal stays HR/ACCOUNTING/ADMIN.
  "/departamento-pessoal/admissoes": ["ACCOUNTING", "HUMAN_RESOURCES", "ADMIN", "PRODUCTION_MANAGER"],
  "/departamento-pessoal/admissoes/*": ["ACCOUNTING", "HUMAN_RESOURCES", "ADMIN", "PRODUCTION_MANAGER"],
  "/departamento-pessoal/rescisoes": ["ACCOUNTING", "HUMAN_RESOURCES", "ADMIN", "PRODUCTION_MANAGER"],
  "/departamento-pessoal/rescisoes/*": ["ACCOUNTING", "HUMAN_RESOURCES", "ADMIN", "PRODUCTION_MANAGER"],
  "/departamento-pessoal/ferias": ["ACCOUNTING", "HUMAN_RESOURCES", "ADMIN", "PRODUCTION_MANAGER"],
  "/departamento-pessoal/ferias/*": ["ACCOUNTING", "HUMAN_RESOURCES", "ADMIN", "PRODUCTION_MANAGER"],
  "/departamento-pessoal/*": ["ACCOUNTING", "HUMAN_RESOURCES", "ADMIN"],

  // Medicina do Trabalho - Occupational Health (ACCOUNTING area)
  "/medicina-do-trabalho/*": ["ACCOUNTING", "HUMAN_RESOURCES", "ADMIN"],

  // Personnel Department - HR with admin requirements for sensitive operations (new English routes)
  "/personnel-department": "HUMAN_RESOURCES",
  "/personnel-department/employees": "HUMAN_RESOURCES",
  "/personnel-department/employees/create": "ADMIN", // Employee creation requires admin

  // Catalog routes (view-only for designers, commercial, logistic, team leaders - NOTE: uses same details path as painting.catalog, so privileges defined on line 87)
  // Team leaders check at component level via isTeamLeader()
  [routes.catalog.root]: ["DESIGNER", "COMMERCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "TEAM_LEADER", "ADMIN"],
  // [routes.catalog.details(":id")]: "DESIGNER", // REMOVED: Conflicts with painting.catalog.details (same path), using hardcoded entry on line 87 instead

  // Maintenance routes (maintenance access for technicians and warehouse)
  [routes.maintenance.root]: ["MAINTENANCE", "WAREHOUSE", "ADMIN"],
  [routes.maintenance.create]: ["MAINTENANCE", "WAREHOUSE", "ADMIN"],
  "/manutencao/editar/:id": ["MAINTENANCE", "WAREHOUSE", "ADMIN"], // Dynamic route for editing
  [routes.maintenance.details(":id")]: ["MAINTENANCE", "WAREHOUSE", "ADMIN"],

  // My Team routes (team management for team leaders)
  // Uses TEAM_LEADER virtual privilege which checks user.ledSector relation
  [routes.myTeam.warnings]: "TEAM_LEADER",
  [routes.myTeam.loans]: "TEAM_LEADER",
  [routes.myTeam.members]: "TEAM_LEADER",
  [routes.myTeam.ppes]: "TEAM_LEADER",
  [routes.myTeam.movements]: "TEAM_LEADER",
  [routes.myTeam.calculations]: "TEAM_LEADER",

  // Ferramentas - All authenticated users can access tools
  "/ferramentas": ["BASIC", "PRODUCTION", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "ADMIN", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL", "ACCOUNTING"],
  "/ferramentas/*": ["BASIC", "PRODUCTION", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "ADMIN", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL", "ACCOUNTING"],
  "/ferramentas/custo-de-funcionario": ["BASIC", "PRODUCTION", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "ADMIN", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL", "ACCOUNTING"],
  // Post-its notes board — broad availability (matches the other broad tools above)
  "/ferramentas/post-its": ["BASIC", "PRODUCTION", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "ADMIN", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL", "ACCOUNTING", "TEAM_LEADER"],
  // QR generator, color palette and waste certificate — ACCOUNTING and
  // PRODUCTION_MANAGER intentionally excluded (their navs hide these); everyone else
  // keeps the access they had via the "/ferramentas/*" wildcard.
  "/ferramentas/qr-code": ["BASIC", "PRODUCTION", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "ADMIN", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL"],
  "/ferramentas/paleta": ["BASIC", "PRODUCTION", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "ADMIN", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL"],
  "/ferramentas/certificado-residuos": ["BASIC", "PRODUCTION", "MAINTENANCE", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "ADMIN", "HUMAN_RESOURCES", "EXTERNAL", "PLOTTING", "COMMERCIAL", "ACCOUNTING"],

  // Fallback patterns (for broader route matching)
  "/administracao/*": "ADMIN",
  [`${routes.inventory.root}/*`]: "WAREHOUSE",
  "/pintura/*": ["WAREHOUSE", "DESIGNER", "COMMERCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "TEAM_LEADER", "ADMIN"], // PRODUCTION excluded from paint routes
  [`${routes.production.root}/*`]: ["PRODUCTION", "WAREHOUSE", "DESIGNER", "FINANCIAL", "LOGISTIC", "PRODUCTION_MANAGER", "PLOTTING", "COMMERCIAL"], // DESIGNER, FINANCIAL, LOGISTIC, PRODUCTION_MANAGER, PLOTTING have read access to production routes
  "/personnel-department/*": "HUMAN_RESOURCES",
  "/meu-pessoal/*": "TEAM_LEADER", // Team leader routes - uses virtual privilege
  "/manutencao/*": ["MAINTENANCE", "WAREHOUSE", "ADMIN"],
};

// Helper function to get required privilege(s) for a route
// Returns single privilege or array of privileges
export function getRequiredPrivilegeForRoute(pathname: string): RoutePrivilegeValue | undefined {
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
export function getPrivilegeDisplayText(privilege: RoutePrivilegeValue): string {
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
