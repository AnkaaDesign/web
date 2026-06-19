// Complete route structure for Ankaa Brazilian manufacturing management system
// Updated to match navigation menu structure exactly
export const routes = {
  // Administration - Administração - Administration
  administration: {
    collaborators: {
      batchEdit: "/departamento-pessoal/colaboradores/editar-em-lote",
      create: "/departamento-pessoal/colaboradores/cadastrar",
      details: (id: string) => `/departamento-pessoal/colaboradores/detalhes/${id}`,
      edit: (id: string) => `/departamento-pessoal/colaboradores/editar/${id}`,
      root: "/departamento-pessoal/colaboradores",
    },
    notifications: {
      create: "/administracao/notificacoes/cadastrar/enviar",
      details: (id: string) => `/administracao/notificacoes/detalhes/${id}`,
      edit: (id: string) => `/administracao/notificacoes/editar/${id}`,
      root: "/administracao/notificacoes",
      configurations: {
        root: "/administracao/notificacoes/configuracoes",
        create: "/administracao/notificacoes/configuracoes/cadastrar",
        details: (key: string) => `/administracao/notificacoes/configuracoes/detalhes/${key}`,
        edit: (key: string) => `/administracao/notificacoes/configuracoes/editar/${key}`,
        test: (key: string) => `/administracao/notificacoes/configuracoes/testar/${key}`,
      },
    },
    messages: {
      create: "/administracao/mensagens/criar",
      details: (id: string) => `/administracao/mensagens/${id}`,
      edit: (id: string) => `/administracao/mensagens/${id}/editar`,
      root: "/administracao/mensagens",
    },
    root: "/administracao",
    sectors: {
      batchEdit: "/administracao/setores/editar-em-lote",
      create: "/administracao/setores/cadastrar",
      details: (id: string) => `/administracao/setores/detalhes/${id}`,
      edit: (id: string) => `/administracao/setores/editar/${id}`,
      root: "/administracao/setores",
    },
    goals: {
      root: "/administracao/metas",
    },
    users: {
      batchEdit: "/departamento-pessoal/colaboradores/editar-em-lote",
      create: "/departamento-pessoal/colaboradores/cadastrar",
      details: (id: string) => `/departamento-pessoal/colaboradores/detalhes/${id}`,
      edit: (id: string) => `/departamento-pessoal/colaboradores/editar/${id}`,
      root: "/departamento-pessoal/colaboradores",
    },
    monitoring: {
      dashboard: "/administracao/monitoramento/dashboard",
      root: "/administracao/monitoramento",
      metrics: {
        list: "/administracao/monitoramento/metricas",
        root: "/administracao/monitoramento/metricas",
      },
      alerts: {
        list: "/administracao/monitoramento/alertas",
        root: "/administracao/monitoramento/alertas",
      },
      logs: {
        list: "/administracao/monitoramento/logs",
        root: "/administracao/monitoramento/logs",
      },
    },
    // ---------------------------------------------------------------
    // Skill-Assessment domain (Phase-4 rewrite)
    // Skill = catálogo de habilidades (BEHAVIORAL/SAFETY/PRODUCTIVITY)
    // Topic = item avaliável dentro de uma Skill
    // Assessment = campanha de avaliação (período + setores + tópicos)
    // ---------------------------------------------------------------
    skill: {
      root: "/administracao/competencias",
      create: "/administracao/competencias/cadastrar",
      details: (id: string) => `/administracao/competencias/detalhes/${id}`,
      edit: (id: string) => `/administracao/competencias/editar/${id}`,
      batchEdit: "/administracao/competencias/editar-lote",
    },
    topic: {
      root: "/administracao/topicos",
      create: "/administracao/topicos/cadastrar",
      details: (id: string) => `/administracao/topicos/detalhes/${id}`,
      edit: (id: string) => `/administracao/topicos/editar/${id}`,
      batchEdit: "/administracao/topicos/editar-lote",
    },
    skillAssessment: {
      root: "/administracao/avaliacao-competencias",
      create: "/administracao/avaliacao-competencias/nova",
      details: (id: string) => `/administracao/avaliacao-competencias/${id}`,
      edit: (id: string) => `/administracao/avaliacao-competencias/${id}/editar`,
      entry: (id: string, entryId: string) =>
        `/administracao/avaliacao-competencias/${id}/avaliacoes/${entryId}`,
      analytics: (id: string) => `/administracao/avaliacao-competencias/${id}/analytics`,
    },
    questionnaire: {
      root: "/administracao/questionarios",
      create: "/administracao/questionarios/novo",
      details: (id: string) => `/administracao/questionarios/${id}`,
      edit: (id: string) => `/administracao/questionarios/${id}/editar`,
      entry: (id: string, entryId: string) =>
        `/administracao/questionarios/${id}/respostas/${entryId}`,
      // Catalogue: Tema → Pergunta → Opção (separate roots so the "Campanhas"
      // nav item — at /administracao/questionarios — isn't a path prefix of these).
      temas: "/administracao/questionarios-temas",
      temaCreate: "/administracao/questionarios-temas/novo",
      temaDetail: (id: string) => `/administracao/questionarios-temas/${id}`,
      temaEdit: (id: string) => `/administracao/questionarios-temas/${id}/editar`,
      perguntas: "/administracao/questionarios-perguntas",
      perguntaCreate: "/administracao/questionarios-perguntas/nova",
      perguntaDetail: (id: string) => `/administracao/questionarios-perguntas/${id}`,
      perguntaEdit: (id: string) => `/administracao/questionarios-perguntas/${id}/editar`,
    },
  },

  // Leader fill — Produção: leader fills the assessment entries assigned to them
  skillAssessmentLeader: {
    pending: "/meu-pessoal/avaliacoes-competencias",
    campaign: (campaignId: string) =>
      `/meu-pessoal/avaliacoes-competencias/${campaignId}`,
    fill: (entryId: string) => `/meu-pessoal/avaliacoes-competencias/preencher/${entryId}`,
  },

  // Self-fill questionnaire — personal domain, available to ALL users
  questionnaire: {
    mine: "/pessoal/questionarios",
    fill: (entryId: string) => `/pessoal/questionarios/preencher/${entryId}`,
    detail: (entryId: string) => `/pessoal/questionarios/${entryId}`,
  },

  // Authentication - Rotas de autenticação
  authentication: {
    login: "/autenticacao/entrar", // fazer login
    recoverPassword: "/autenticacao/recuperar-senha", // recuperar senha
    register: "/autenticacao/registrar", // registrar-se
    resetPassword: (token: string) => `/autenticacao/redefinir-senha/${token}`, // redefinir senha com token
    verifyCode: "/autenticacao/verificar-codigo", // código de verificação (unificado)
    verifyPasswordReset: "/autenticacao/verificar-redefinicao-senha", // verificação de redefinição de senha
  },

  // Basic Catalog - Catálogo Básico - Basic catalog access for leaders
  catalog: {
    details: (id: string) => `/pintura/catalogo/detalhes/${id}`,
    root: "/pintura/catalogo-basico",
  },

  // Customers - Alias for financial customers
  customers: {
    batchEdit: "/financeiro/clientes/editar-em-lote",
    create: "/financeiro/clientes/cadastrar",
    details: (id: string) => `/financeiro/clientes/detalhes/${id}`,
    edit: (id: string) => `/financeiro/clientes/editar/${id}`,
    root: "/financeiro/clientes",
  },

  // Responsibles - Responsáveis - Customer Responsibles Management
  responsibles: {
    create: "/financeiro/clientes/responsaveis/cadastrar",
    details: (id: string) => `/financeiro/clientes/responsaveis/detalhes/${id}`,
    edit: (id: string) => `/financeiro/clientes/responsaveis/editar/${id}`,
    password: (id: string) => `/financeiro/clientes/responsaveis/senha/${id}`,
    root: "/financeiro/clientes/responsaveis",
  },

  // Favorites - Favoritos - User Favorites
  favorites: "/favoritos",

  // Financial - Financeiro - Financial Management
  financial: {
    customers: {
      batchEdit: "/financeiro/clientes/editar-em-lote",
      create: "/financeiro/clientes/cadastrar",
      details: (id: string) => `/financeiro/clientes/detalhes/${id}`,
      edit: (id: string) => `/financeiro/clientes/editar/${id}`,
      root: "/financeiro/clientes",
    },
    billing: {
      root: "/financeiro/faturamento",
      details: (id: string) => `/financeiro/faturamento/detalhes/${id}`,
      // Full-page preview of a single NFS-e/boleto, opened in a new tab from the
      // billing-approval modal. Data is handed off via localStorage (key in `?k=`).
      documentPreview: "/financeiro/faturamento/previa-documento",
    },
    budget: {
      root: "/financeiro/orcamento",
      create: "/financeiro/orcamento/cadastrar",
      details: (taskId: string) => `/financeiro/orcamento/detalhes/${taskId}`,
    },
    nfse: {
      detail: (id: number) => `/financeiro/notas-fiscais/${id}`,
      root: "/financeiro/notas-fiscais",
    },
    reconciliation: {
      root: "/financeiro/conciliacao",
      transactions: "/financeiro/conciliacao/transacoes",
      transactionDetail: (id: string) => `/financeiro/conciliacao/transacoes/${id}`,
      fiscalDocuments: "/financeiro/conciliacao/notas",
      fiscalDocumentDetail: (id: string) => `/financeiro/conciliacao/notas/${id}`,
      categories: "/financeiro/conciliacao/categorias",
      recurring: "/financeiro/conciliacao/recorrentes",
      // Conciliação Bancária workflow views (spec §4: Extrato, Saídas,
      // Previsão de Saídas, Entradas).
      statement: "/financeiro/conciliacao/extrato",
      outflows: "/financeiro/conciliacao/saidas",
      inflows: "/financeiro/conciliacao/entradas",
    },
    // Top-level (outside the conciliação domain) — a forward forecast page.
    outflowForecast: "/financeiro/previsao-de-saidas",
    accountsPayable: {
      root: "/financeiro/contas-a-pagar",
    },
    recurrentPayables: {
      root: "/financeiro/contas-recorrentes",
    },
    root: "/financeiro",
  },

  // Home - Página inicial
  home: "/",

  // Inventory - Estoque - Inventory Management
  inventory: {
    externalOperations: {
      create: "/estoque/operacoes-externas/cadastrar",
      details: (id: string) => `/estoque/operacoes-externas/detalhes/${id}`,
      edit: (id: string) => `/estoque/operacoes-externas/editar/${id}`,
      list: "/estoque/operacoes-externas",
      root: "/estoque/operacoes-externas",
    },
    loans: {
      batchEdit: "/estoque/emprestimos/editar-lote",
      create: "/estoque/emprestimos/cadastrar",
      details: (id: string) => `/estoque/emprestimos/detalhes/${id}`,
      import: "/estoque/emprestimos/importar",
      list: "/estoque/emprestimos",
      root: "/estoque/emprestimos",
    },
    maintenance: {
      create: "/estoque/manutencao/cadastrar",
      details: (id: string) => `/estoque/manutencao/detalhes/${id}`,
      edit: (id: string) => `/estoque/manutencao/editar/${id}`,
      list: "/estoque/manutencao/listar",
      root: "/estoque/manutencao",
      schedules: {
        create: "/estoque/manutencao/agendamentos/cadastrar",
        details: (id: string) => `/estoque/manutencao/agendamentos/detalhes/${id}`,
        edit: (id: string) => `/estoque/manutencao/agendamentos/editar/${id}`,
        root: "/estoque/manutencao/agendamentos",
      },
    },
    movements: {
      batchEdit: "/estoque/movimentacoes/editar-lote",
      create: "/estoque/movimentacoes/cadastrar",
      details: (id: string) => `/estoque/movimentacoes/detalhes/${id}`,
      edit: (id: string) => `/estoque/movimentacoes/editar/${id}`,
      list: "/estoque/movimentacoes",
      root: "/estoque/movimentacoes",
    },
    orders: {
      automatic: {
        configure: "/estoque/pedidos/automaticos/configurar",
        create: "/estoque/pedidos/automaticos/cadastrar",
        details: (id: string) => `/estoque/pedidos/automaticos/detalhes/${id}`,
        edit: (id: string) => `/estoque/pedidos/automaticos/editar/${id}`,
        list: "/estoque/pedidos/automaticos/listar",
        root: "/estoque/pedidos/automaticos",
      },
      create: "/estoque/pedidos/cadastrar",
      details: (id: string) => `/estoque/pedidos/detalhes/${id}`,
      edit: (id: string) => `/estoque/pedidos/editar/${id}`,
      list: "/estoque/pedidos",
      root: "/estoque/pedidos",
      schedules: {
        create: "/estoque/pedidos/agendamentos/cadastrar",
        details: (id: string) => `/estoque/pedidos/agendamentos/detalhes/${id}`,
        edit: (id: string) => `/estoque/pedidos/agendamentos/editar/${id}`,
        root: "/estoque/pedidos/agendamentos",
      },
    },
    ppe: {
      create: "/estoque/epi/cadastrar",
      deliveries: {
        create: "/estoque/epi/entregas/cadastrar",
        details: (id: string) => `/estoque/epi/entregas/detalhes/${id}`,
        edit: (id: string) => `/estoque/epi/entregas/editar/${id}`,
        list: "/estoque/epi/entregas",
        root: "/estoque/epi/entregas",
      },
      details: (id: string) => `/estoque/epi/detalhes/${id}`,
      edit: (id: string) => `/estoque/epi/editar/${id}`,
      root: "/estoque/epi",
      schedules: {
        create: "/estoque/epi/agendamentos/cadastrar",
        details: (id: string) => `/estoque/epi/agendamentos/detalhes/${id}`,
        edit: (id: string) => `/estoque/epi/agendamentos/editar/${id}`,
        root: "/estoque/epi/agendamentos",
      },
    },
    products: {
      batchEdit: "/estoque/produtos/editar-em-lote",
      stockBalance: "/estoque/produtos/balanco-estoque",
      brands: {
        batchEdit: "/estoque/produtos/marcas/editar-em-lote",
        create: "/estoque/produtos/marcas/cadastrar",
        details: (id: string) => `/estoque/produtos/marcas/detalhes/${id}`,
        edit: (id: string) => `/estoque/produtos/marcas/editar/${id}`,
        list: "/estoque/produtos/marcas",
        root: "/estoque/produtos/marcas",
      },
      categories: {
        batchEdit: "/estoque/produtos/categorias/editar-em-lote",
        create: "/estoque/produtos/categorias/cadastrar",
        details: (id: string) => `/estoque/produtos/categorias/detalhes/${id}`,
        edit: (id: string) => `/estoque/produtos/categorias/editar/${id}`,
        list: "/estoque/produtos/categorias",
        root: "/estoque/produtos/categorias",
      },
      create: "/estoque/produtos/cadastrar",
      details: (id: string) => `/estoque/produtos/detalhes/${id}`,
      edit: (id: string) => `/estoque/produtos/editar/${id}`,
      list: "/estoque/produtos",
      root: "/estoque/produtos",
    },
    root: "/estoque",
    stockBalance: {
      create: "/estoque/balanco",
    },
    suppliers: {
      batchEdit: "/estoque/fornecedores/editar-em-lote",
      create: "/estoque/fornecedores/cadastrar",
      details: (id: string) => `/estoque/fornecedores/detalhes/${id}`,
      edit: (id: string) => `/estoque/fornecedores/editar/${id}`,
      root: "/estoque/fornecedores",
    },
  },

  maintenance: {
    create: "/manutencao/cadastrar",
    details: (id: string) => `/manutencao/detalhes/${id}`,
    edit: (id: string) => `/manutencao/editar/${id}`,
    root: "/manutencao",
  },

  // Meu Pessoal - Sector Employee Management for Leaders
  meuPessoal: {
    avisos: {
      details: (sectorId: string, id: string) => `/meu-pessoal/avisos/${sectorId}/detalhes/${id}`,
      root: (sectorId: string) => `/meu-pessoal/avisos/${sectorId}`,
    },
    emprestimos: {
      details: (sectorId: string, id: string) => `/meu-pessoal/emprestimos/${sectorId}/detalhes/${id}`,
      root: (sectorId: string) => `/meu-pessoal/emprestimos/${sectorId}`,
    },
    root: "/meu-pessoal",
  },

  // My Team - Minha Equipe - Team management for leaders (simplified routes)
  myTeam: {
    calculations: "/meu-pessoal/calculos",
    loans: "/meu-pessoal/emprestimos",
    members: "/meu-pessoal/usuarios",
    movements: "/meu-pessoal/movimentacoes",
    ppes: "/meu-pessoal/epis",
    root: "/meu-pessoal",
    warnings: "/meu-pessoal/advertencias",
  },

  // Occupational Health - Medicina do Trabalho - Occupational Health Management
  occupationalHealth: {
    root: "/medicina-do-trabalho",
    medicalExams: {
      create: "/medicina-do-trabalho/aso/cadastrar",
      details: (id: string) => `/medicina-do-trabalho/aso/detalhes/${id}`,
      edit: (id: string) => `/medicina-do-trabalho/aso/editar/${id}`,
      root: "/medicina-do-trabalho/aso",
    },
    periodicExams: {
      root: "/medicina-do-trabalho/exames-periodicos",
    },
    leaves: {
      create: "/medicina-do-trabalho/afastamentos/cadastrar",
      details: (id: string) => `/medicina-do-trabalho/afastamentos/detalhes/${id}`,
      edit: (id: string) => `/medicina-do-trabalho/afastamentos/editar/${id}`,
      root: "/medicina-do-trabalho/afastamentos",
    },
    // CAT — Comunicação de Acidente de Trabalho (Part E)
    workAccidents: {
      create: "/medicina-do-trabalho/cat/cadastrar",
      details: (id: string) => `/medicina-do-trabalho/cat/detalhes/${id}`,
      edit: (id: string) => `/medicina-do-trabalho/cat/editar/${id}`,
      root: "/medicina-do-trabalho/cat",
    },
  },

  // Painting - Pintura - Paint Management
  painting: {
    catalog: {
      create: "/pintura/catalogo/cadastrar",
      details: (id: string) => `/pintura/catalogo/detalhes/${id}`,
      edit: (id: string) => `/pintura/catalogo/editar/${id}`,
      formulaDetails: (paintId: string, formulaId: string) => `/pintura/catalogo/detalhes/${paintId}/formulas/detalhes/${formulaId}`,
      formulas: (paintId: string) => `/pintura/catalogo/detalhes/${paintId}/formulas`,
      root: "/pintura/catalogo",
    },
    formulas: {
      create: "/pintura/formulas/cadastrar",
      details: (id: string) => `/pintura/formulas/detalhes/${id}`,
      edit: (id: string) => `/pintura/formulas/editar/${id}`,
      list: "/pintura/formulas/listar",
      root: "/pintura/formulas",
    },
    paintTypes: {
      create: "/pintura/tipos-de-tinta/cadastrar",
      details: (id: string) => `/pintura/tipos-de-tinta/detalhes/${id}`,
      edit: (id: string) => `/pintura/tipos-de-tinta/editar/${id}`,
      list: "/pintura/tipos-de-tinta/listar",
      root: "/pintura/tipos-de-tinta",
    },
    paintBrands: {
      create: "/pintura/marcas-de-tinta/cadastrar",
      details: (id: string) => `/pintura/marcas-de-tinta/detalhes/${id}`,
      edit: (id: string) => `/pintura/marcas-de-tinta/editar/${id}`,
      list: "/pintura/marcas-de-tinta/listar",
      root: "/pintura/marcas-de-tinta",
    },
    productions: {
      create: "/pintura/producoes/cadastrar",
      details: (id: string) => `/pintura/producoes/detalhes/${id}`,
      edit: (id: string) => `/pintura/producoes/editar/${id}`,
      root: "/pintura/producoes",
    },
    palette: {
      root: "/pintura/paleta",
    },
    root: "/pintura",
  },

  // Personal - Pessoal - Personal (User-specific data)
  personal: {
    myMessages: {
      root: "/pessoal/mensagens",
    },
    myHolidays: {
      root: "/pessoal/feriados",
    },
    myPpes: {
      details: (id: string) => `/pessoal/meus-epis/detalhes/${id}`,
      request: "/pessoal/meus-epis/solicitar",
      root: "/pessoal/meus-epis",
    },
    myLoans: {
      details: (id: string) => `/pessoal/meus-emprestimos/detalhes/${id}`,
      root: "/pessoal/meus-emprestimos",
    },
    myActivities: {
      details: (id: string) => `/pessoal/minhas-movimentacoes/detalhes/${id}`,
      root: "/pessoal/minhas-movimentacoes",
    },
    myTimeEntries: {
      root: "/pessoal/meus-pontos",
    },
    myWarnings: {
      details: (id: string) => `/pessoal/minhas-advertencias/detalhes/${id}`,
      root: "/pessoal/minhas-advertencias",
    },
    root: "/pessoal",
    // Production Manager "Pessoal" section - company/team-wide views
    pmWarnings: {
      root: "/pessoal/advertencias",
    },
    pmCalculations: {
      root: "/pessoal/calculos-ponto",
    },
    pmSchedules: {
      root: "/pessoal/horarios",
    },
  },

  // Personnel Department - Departamento Pessoal - Personnel Department Management
  personnelDepartment: {
    root: "/departamento-pessoal",
    admissions: {
      create: "/departamento-pessoal/admissoes/cadastrar",
      details: (id: string) => `/departamento-pessoal/admissoes/detalhes/${id}`,
      edit: (id: string) => `/departamento-pessoal/admissoes/editar/${id}`,
      root: "/departamento-pessoal/admissoes",
    },
    terminations: {
      create: "/departamento-pessoal/rescisoes/cadastrar",
      details: (id: string) => `/departamento-pessoal/rescisoes/detalhes/${id}`,
      edit: (id: string) => `/departamento-pessoal/rescisoes/editar/${id}`,
      root: "/departamento-pessoal/rescisoes",
    },
    vacations: {
      create: "/departamento-pessoal/ferias/cadastrar",
      details: (id: string) => `/departamento-pessoal/ferias/detalhes/${id}`,
      edit: (id: string) => `/departamento-pessoal/ferias/editar/${id}`,
      root: "/departamento-pessoal/ferias",
    },
    // LEGACY: 13º Salário no longer has standalone pages — it is managed
    // per-collaborator from the colaborador detail page. These paths are kept
    // only so App.tsx can redirect old links/bookmarks to the colaborador list.
    thirteenth: {
      create: "/departamento-pessoal/decimo-terceiro/cadastrar",
      details: (id: string) => `/departamento-pessoal/decimo-terceiro/detalhes/${id}`,
      edit: (id: string) => `/departamento-pessoal/decimo-terceiro/editar/${id}`,
      root: "/departamento-pessoal/decimo-terceiro",
    },
    salaryAdjustments: {
      details: (id: string) => `/departamento-pessoal/reajustes/detalhes/${id}`,
      root: "/departamento-pessoal/reajustes",
    },
    promotions: {
      root: "/departamento-pessoal/promocoes",
    },
    benefits: {
      create: "/departamento-pessoal/beneficios/cadastrar",
      details: (id: string) => `/departamento-pessoal/beneficios/detalhes/${id}`,
      edit: (id: string) => `/departamento-pessoal/beneficios/editar/${id}`,
      root: "/departamento-pessoal/beneficios",
      enrollments: {
        create: "/departamento-pessoal/beneficios/adesoes/cadastrar",
        details: (id: string) => `/departamento-pessoal/beneficios/adesoes/detalhes/${id}`,
        edit: (id: string) => `/departamento-pessoal/beneficios/adesoes/editar/${id}`,
        root: "/departamento-pessoal/beneficios/adesoes",
      },
    },
    calculations: {
      list: "/departamento-pessoal/calculos",
      root: "/departamento-pessoal/calculos",
    },
    holidays: {
      calendar: "/departamento-pessoal/feriados/calendario",
      create: "/departamento-pessoal/feriados/cadastrar",
      details: (id: string) => `/departamento-pessoal/feriados/detalhes/${id}`,
      edit: (id: string) => `/departamento-pessoal/feriados/editar/${id}`,
      list: "/departamento-pessoal/feriados",
      root: "/departamento-pessoal/feriados",
    },
    horarios: {
      root: "/departamento-pessoal/horarios",
      list: "/departamento-pessoal/horarios",
      details: (id: string) => `/departamento-pessoal/horarios/detalhes/${id}`,
    },
    integrations: {
      // Secullum Ponto Web integration. Drives the user-form
      // "Criar / sincronizar no Secullum" toggle and the bridge
      // service in apps/api/src/modules/integrations/secullum.
      secullum: {
        root: "/departamento-pessoal/integracoes/secullum",
      },
    },
    positions: {
      batchEdit: "/departamento-pessoal/cargos/editar-em-lote",
      create: "/departamento-pessoal/cargos/cadastrar",
      details: (id: string) => `/departamento-pessoal/cargos/detalhes/${id}`,
      edit: (id: string) => `/departamento-pessoal/cargos/editar/${id}`,
      hierarchy: "/departamento-pessoal/cargos/hierarquia",
      remunerations: (positionId: string) => `/departamento-pessoal/cargos/${positionId}/remuneracoes`,
      root: "/departamento-pessoal/cargos",
    },
    ppe: {
      create: "/departamento-pessoal/epi/cadastrar",
      deliveries: {
        create: "/departamento-pessoal/epi/entregas/cadastrar",
        details: (id: string) => `/departamento-pessoal/epi/entregas/detalhes/${id}`,
        edit: (id: string) => `/departamento-pessoal/epi/entregas/editar/${id}`,
        root: "/departamento-pessoal/epi/entregas",
      },
      details: (id: string) => `/departamento-pessoal/epi/detalhes/${id}`,
      edit: (id: string) => `/departamento-pessoal/epi/editar/${id}`,
      reports: {
        masks: "/departamento-pessoal/epi/relatorios/mascaras",
        root: "/departamento-pessoal/epi/relatorios",
        stock: "/departamento-pessoal/epi/relatorios/estoque",
        usage: "/departamento-pessoal/epi/relatorios/uso",
      },
      root: "/departamento-pessoal/epi",
      sizes: {
        root: "/departamento-pessoal/epi/tamanhos",
      },
      schedules: {
        create: "/departamento-pessoal/epi/agendamentos/cadastrar",
        details: (id: string) => `/departamento-pessoal/epi/agendamentos/detalhes/${id}`,
        edit: (id: string) => `/departamento-pessoal/epi/agendamentos/editar/${id}`,
        root: "/departamento-pessoal/epi/agendamentos",
      },
    },
    requisicoes: {
      list: "/departamento-pessoal/controle-ponto/requisicoes",
      root: "/departamento-pessoal/controle-ponto/requisicoes",
    },
    timeClock: {
      list: "/departamento-pessoal/controle-ponto",
      root: "/departamento-pessoal/controle-ponto",
      // Each view is its own subpage (with a sidebar submenu).
      colaborador: "/departamento-pessoal/controle-ponto/colaborador",
      dia: "/departamento-pessoal/controle-ponto/dia",
      edicao: "/departamento-pessoal/controle-ponto/edicao",
      ausencias: "/departamento-pessoal/controle-ponto/ausencias",
      // Fechamento (formerly "Assinatura Digital").
      fechamento: {
        root: "/departamento-pessoal/controle-ponto/fechamento",
        list: "/departamento-pessoal/controle-ponto/fechamento",
        details: (id: string | number) =>
          `/departamento-pessoal/controle-ponto/fechamento/${id}`,
      },
    },
    calendar: {
      root: "/departamento-pessoal/calendario",
    },
    warnings: {
      batchEdit: "/departamento-pessoal/avisos/editar-em-lote",
      create: "/departamento-pessoal/avisos/cadastrar",
      details: (id: string) => `/departamento-pessoal/avisos/detalhes/${id}`,
      edit: (id: string) => `/departamento-pessoal/avisos/editar/${id}`,
      root: "/departamento-pessoal/avisos",
    },
    payroll: {
      root: "/departamento-pessoal/folha-de-pagamento",
      list: "/departamento-pessoal/folha-de-pagamento",
      detail: (payrollId: string) => `/departamento-pessoal/folha-de-pagamento/detalhe/${payrollId}`,
      create: "/departamento-pessoal/folha-de-pagamento/criar",
      edit: (payrollId: string) => `/departamento-pessoal/folha-de-pagamento/editar/${payrollId}`,
    },
    loans: {
      root: "/departamento-pessoal/emprestimos",
      list: "/departamento-pessoal/emprestimos",
    },
    bonus: {
      root: "/departamento-pessoal/bonus",
      list: "/departamento-pessoal/bonus",
      details: (id: string) => `/departamento-pessoal/bonus/${id}`,
      simulation: "/departamento-pessoal/bonus/simulacao-de-bonus",
      performanceLevels: {
        list: "/departamento-pessoal/bonus/nivel-de-performance",
        root: "/departamento-pessoal/bonus/nivel-de-performance",
      },
    },
  },

  // Production - Produção - Production Management
  production: {
    airbrushings: {
      create: "/producao/aerografia/cadastrar",
      details: (id: string) => `/producao/aerografia/detalhes/${id}`,
      edit: (id: string) => `/producao/aerografia/editar/${id}`,
      list: "/producao/aerografia/listar",
      root: "/producao/aerografia",
    },
    cutting: {
      create: "/producao/recorte/cadastrar",
      details: (id: string) => `/producao/recorte/detalhes/${id}`,
      edit: (id: string) => `/producao/recorte/editar/${id}`,
      list: "/producao/recorte",
      root: "/producao/recorte",
    },
    history: {
      cancelled: "/producao/historico/cancelados",
      completed: "/producao/historico/concluidos",
      root: "/producao/historico",
      details: (id: string) => `/producao/historico/detalhes/${id}`,
      edit: (id: string) => `/producao/historico/editar/${id}`,
      /** @deprecated Use routes.financial.budget.details instead */
      quote: (taskId: string) => `/financeiro/orcamento/detalhes/${taskId}`,
    },
    observations: {
      create: "/producao/observacoes/cadastrar",
      details: (id: string) => `/producao/observacoes/detalhes/${id}`,
      edit: (id: string) => `/producao/observacoes/editar/${id}`,
      list: "/producao/observacoes",
      root: "/producao/observacoes",
    },
    root: "/producao",
    // Note: 'schedule' property name is kept for backward compatibility but routes point to 'cronograma'
    calendar: "/producao/calendario",
    schedule: {
      batchEdit: "/producao/cronograma/editar-em-lote",
      create: "/producao/cronograma/cadastrar",
      details: (id: string) => `/producao/cronograma/detalhes/${id}`,
      edit: (id: string) => `/producao/cronograma/editar/${id}`,
      list: "/producao/cronograma",
      root: "/producao/cronograma",
      /** @deprecated Use routes.financial.budget.details instead */
      quote: (taskId: string) => `/financeiro/orcamento/detalhes/${taskId}`,
    },
    preparation: {
      root: "/producao/agenda",
      create: "/producao/agenda/cadastrar",
      details: (id: string) => `/producao/agenda/detalhes/${id}`,
      edit: (id: string) => `/producao/agenda/editar/${id}`,
      /** @deprecated Use routes.financial.budget.details instead */
      quote: (taskId: string) => `/financeiro/orcamento/detalhes/${taskId}`,
    },
    garages: {
      root: "/producao/barracoes",
    },
    skillAssessment: {
      root: "/producao/avaliacao-competencias",
      period: (periodId: string) => `/producao/avaliacao-competencias/${periodId}`,
      assess: (periodId: string, assesseeId: string) => `/producao/avaliacao-competencias/${periodId}/avaliar/${assesseeId}`,
      assessment: (id: string) => `/producao/avaliacao-competencias/avaliacoes/${id}`,
    },
  },

  // Server - Servidor - Server Management
  server: {
    backup: "/servidor/backup",
    changeLogs: {
      details: (id: string) => `/servidor/registros-de-alteracoes/detalhes/${id}`,
      root: "/servidor/registros-de-alteracoes",
    },
    databaseSync: "/servidor/sincronizacao-bd",
    deployments: {
      create: "/servidor/implantacoes/cadastrar",
      details: (id: string) => `/servidor/implantacoes/detalhes/${id}`,
      edit: (id: string) => `/servidor/implantacoes/editar/${id}`,
      root: "/servidor/implantacoes",
    },
    throttler: {
      root: "/servidor/rate-limiting",
    },
    logs: "/servidor/logs",
    metrics: "/servidor/metricas",
    root: "/servidor",
    services: "/servidor/servicos",
    fileManager: "/servidor/gerenciador-de-arquivos",
    users: {
      create: "/servidor/usuarios/cadastrar",
      root: "/servidor/usuarios",
    },
  },

  // Statistics - Estatísticas - Statistics/Analytics
  statistics: {
    root: "/estatisticas",
    // Entity-specific statistics
    inventory: {
      root: "/estatisticas/estoque",
      consumption: "/estatisticas/estoque/consumo",
      orders: "/estatisticas/estoque/pedidos",
    },
    production: {
      root: "/estatisticas/producao",
      productivity: "/estatisticas/producao/produtividade",
      performance: "/estatisticas/producao/desempenho",
      bottlenecks: "/estatisticas/producao/gargalos",
      bonusValue: "/estatisticas/producao/valor-bonus",
    },
    financial: {
      root: "/estatisticas/financeiro",
      collection: "/estatisticas/financeiro/cobrancas",
      revenueQuotes: "/estatisticas/financeiro/receita-orcamentos",
      nfse: "/estatisticas/financeiro/nfse",
      reconciliation: "/estatisticas/financeiro/conciliacao",
    },
    personnelDepartment: {
      root: "/estatisticas/departamento-pessoal",
      payroll: "/estatisticas/departamento-pessoal/folha",
      salaryCost: "/estatisticas/departamento-pessoal/custo-folha",
      teamPerformance: "/estatisticas/departamento-pessoal/equipe",
      absenteeism: "/estatisticas/departamento-pessoal/faltas",
      skillAssessment: "/estatisticas/departamento-pessoal/competencias",
    },
    // Advanced Analytics
    analytics: {
      root: "/estatisticas/analytics",
      predictive: "/estatisticas/analytics/preditiva",
      comparative: "/estatisticas/analytics/comparativa",
      correlation: "/estatisticas/analytics/correlacao",
      cohort: "/estatisticas/analytics/cohort",
    },
    // Dashboards and Monitoring
    dashboards: {
      executive: "/estatisticas/dashboards/executivo",
      goals: "/estatisticas/dashboards/metas",
      realtime: "/estatisticas/dashboards/tempo-real",
      explorer: "/estatisticas/dashboards/explorador",
    },
    // Reports
    reports: {
      builder: "/estatisticas/relatorios/construtor",
    },
  },

  // Tools - Ferramentas - Utility tools for the company
  tools: {
    root: "/ferramentas",
    qrCode: {
      root: "/ferramentas/qr-code",
    },
    colorPalette: {
      root: "/ferramentas/paleta",
    },
    timeCalculator: {
      root: "/ferramentas/calculadora-de-horas",
    },
    overtimeCost: {
      root: "/ferramentas/custo-horas-extras",
    },
    paintMix: {
      root: "/ferramentas/calculadora-de-mistura",
    },
    wasteCertificate: {
      root: "/ferramentas/certificado-residuos",
    },
    employeeCost: {
      root: "/ferramentas/custo-de-funcionario",
    },
    postIts: {
      root: "/ferramentas/post-its",
    },
  },

  // Users - Alias for administration users (collaborators) for backward compatibility
  users: {
    batchEdit: "/departamento-pessoal/colaboradores/editar-em-lote",
    create: "/departamento-pessoal/colaboradores/cadastrar",
    details: (id: string) => `/departamento-pessoal/colaboradores/detalhes/${id}`,
    edit: (id: string) => `/departamento-pessoal/colaboradores/editar/${id}`,
    root: "/departamento-pessoal/colaboradores",
  },

  // Profile - User profile page
  profile: "/perfil",
  profileNotifications: "/perfil/notificacoes",

  // Customer routes (public, no authentication required)
  customer: {
    budget: (customerId: string, budgetId: string) => `/cliente/${customerId}/orcamento/${budgetId}`,
    serviceReport: (customerId: string, quoteId: string) => `/cliente/${customerId}/dossie/${quoteId}`,
    root: "/cliente",
  },

  // Public certificate route (no authentication required)
  publicWasteCertificate: (id: string) => `/certificado-residuos/${id}`,

  // Public legal pages (no authentication required)
  privacyPolicy: "/politica-de-privacidade",
} as const;

// Export types for type safety
export type { Routes };
type Routes = typeof routes;
