import { FAVORITE_PAGES, FAVORITE_PAGES_LABELS } from "../constants";

/**
 * Maps route paths to their corresponding FAVORITE_PAGES enum values
 */
const routeToFavoritePageMap: Record<string, FAVORITE_PAGES> = {
  // Production - List Pages
  "/producao/agenda": FAVORITE_PAGES.PRODUCAO_AGENDA_LISTAR,
  "/producao/cronograma": FAVORITE_PAGES.PRODUCAO_CRONOGRAMA_LISTAR,
  "/producao/recorte": FAVORITE_PAGES.PRODUCAO_RECORTE_LISTAR,
  "/producao/servicos": FAVORITE_PAGES.PRODUCAO_SERVICOS_LISTAR,
  "/producao/observacoes": FAVORITE_PAGES.PRODUCAO_OBSERVACOES_LISTAR,
  "/producao/aerografia/listar": FAVORITE_PAGES.PRODUCAO_AEROGRAFIA_LISTAR,
  "/producao/ordens-de-servico": FAVORITE_PAGES.PRODUCAO_ORDENS_SERVICO_LISTAR,
  "/producao/historico": FAVORITE_PAGES.PRODUCAO_HISTORICO_LISTAR,

  // Production - Create Pages
  "/producao/agenda/cadastrar": FAVORITE_PAGES.PRODUCAO_AGENDA_CADASTRAR,
  "/producao/recorte/cadastrar": FAVORITE_PAGES.PRODUCAO_RECORTE_CADASTRAR,
  "/producao/servicos/cadastrar": FAVORITE_PAGES.PRODUCAO_SERVICOS_CADASTRAR,
  "/producao/observacoes/cadastrar": FAVORITE_PAGES.PRODUCAO_OBSERVACOES_CADASTRAR,
  "/producao/aerografia/cadastrar": FAVORITE_PAGES.PRODUCAO_AEROGRAFIA_CADASTRAR,
  "/producao/ordens-de-servico/cadastrar": FAVORITE_PAGES.PRODUCAO_ORDENS_SERVICO_CADASTRAR,

  // Inventory - List Pages
  "/estoque/movimentacoes": FAVORITE_PAGES.ESTOQUE_MOVIMENTACOES_LISTAR,
  "/estoque/produtos": FAVORITE_PAGES.ESTOQUE_PRODUTOS_LISTAR,
  "/estoque/produtos/categorias": FAVORITE_PAGES.ESTOQUE_PRODUTOS_CATEGORIAS_LISTAR,
  "/estoque/produtos/marcas": FAVORITE_PAGES.ESTOQUE_PRODUTOS_MARCAS_LISTAR,
  "/estoque/pedidos": FAVORITE_PAGES.ESTOQUE_PEDIDOS_LISTAR,
  "/estoque/pedidos/agendamentos": FAVORITE_PAGES.ESTOQUE_PEDIDOS_AGENDAMENTOS_LISTAR,
  "/estoque/pedidos/automaticos": FAVORITE_PAGES.ESTOQUE_PEDIDOS_AUTOMATICOS_LISTAR,
  "/estoque/manutencao/listar": FAVORITE_PAGES.ESTOQUE_MANUTENCAO_LISTAR,
  "/estoque/manutencao/agendamentos": FAVORITE_PAGES.ESTOQUE_MANUTENCAO_AGENDAMENTOS_LISTAR,
  "/estoque/operacoes-externas": FAVORITE_PAGES.ESTOQUE_RETIRADAS_EXTERNAS_LISTAR,
  "/estoque/fornecedores": FAVORITE_PAGES.ESTOQUE_FORNECEDORES_LISTAR,
  "/estoque/epi": FAVORITE_PAGES.ESTOQUE_EPI_LISTAR,
  "/estoque/epi/entregas": FAVORITE_PAGES.ESTOQUE_EPI_ENTREGAS_LISTAR,
  "/estoque/epi/agendamentos": FAVORITE_PAGES.ESTOQUE_EPI_AGENDAMENTOS_LISTAR,
  "/estoque/emprestimos": FAVORITE_PAGES.ESTOQUE_EMPRESTIMOS_LISTAR,

  // Inventory - Create Pages
  "/estoque/movimentacoes/cadastrar": FAVORITE_PAGES.ESTOQUE_MOVIMENTACOES_CADASTRAR,
  "/estoque/produtos/cadastrar": FAVORITE_PAGES.ESTOQUE_PRODUTOS_CADASTRAR,
  "/estoque/produtos/categorias/cadastrar": FAVORITE_PAGES.ESTOQUE_PRODUTOS_CATEGORIAS_CADASTRAR,
  "/estoque/produtos/marcas/cadastrar": FAVORITE_PAGES.ESTOQUE_PRODUTOS_MARCAS_CADASTRAR,
  "/estoque/pedidos/cadastrar": FAVORITE_PAGES.ESTOQUE_PEDIDOS_CADASTRAR,
  "/estoque/pedidos/agendamentos/cadastrar": FAVORITE_PAGES.ESTOQUE_PEDIDOS_AGENDAMENTOS_CADASTRAR,
  "/estoque/manutencao/cadastrar": FAVORITE_PAGES.ESTOQUE_MANUTENCAO_CADASTRAR,
  "/estoque/manutencao/agendamentos/cadastrar": FAVORITE_PAGES.ESTOQUE_MANUTENCAO_AGENDAMENTOS_CADASTRAR,
  "/estoque/operacoes-externas/cadastrar": FAVORITE_PAGES.ESTOQUE_RETIRADAS_EXTERNAS_CADASTRAR,
  "/estoque/fornecedores/cadastrar": FAVORITE_PAGES.ESTOQUE_FORNECEDORES_CADASTRAR,
  "/estoque/epi/cadastrar": FAVORITE_PAGES.ESTOQUE_EPI_CADASTRAR,
  "/estoque/epi/entregas/cadastrar": FAVORITE_PAGES.ESTOQUE_EPI_ENTREGAS_CADASTRAR,
  "/estoque/epi/agendamentos/cadastrar": FAVORITE_PAGES.ESTOQUE_EPI_AGENDAMENTOS_CADASTRAR,
  "/estoque/emprestimos/cadastrar": FAVORITE_PAGES.ESTOQUE_EMPRESTIMOS_CADASTRAR,

  // Painting - List Pages
  "/pintura/catalogo": FAVORITE_PAGES.PINTURA_CATALOGO_LISTAR,
  "/pintura/producoes": FAVORITE_PAGES.PINTURA_PRODUCOES_LISTAR,
  "/pintura/tipos-de-tinta": FAVORITE_PAGES.PINTURA_TIPOS_TINTA_LISTAR,
  "/pintura/formulas/listar": FAVORITE_PAGES.PINTURA_FORMULAS_LISTAR,
  "/pintura/formulacoes/listar": FAVORITE_PAGES.PINTURA_FORMULACOES_LISTAR,
  "/pintura/componentes/listar": FAVORITE_PAGES.PINTURA_COMPONENTES_LISTAR,

  // Painting - Create Pages
  "/pintura/catalogo/cadastrar": FAVORITE_PAGES.PINTURA_CATALOGO_CADASTRAR,
  "/pintura/producoes/cadastrar": FAVORITE_PAGES.PINTURA_PRODUCOES_CADASTRAR,
  "/pintura/tipos-de-tinta/cadastrar": FAVORITE_PAGES.PINTURA_TIPOS_TINTA_CADASTRAR,
  "/pintura/formulas/cadastrar": FAVORITE_PAGES.PINTURA_FORMULAS_CADASTRAR,
  "/pintura/formulacoes/cadastrar": FAVORITE_PAGES.PINTURA_FORMULACOES_CADASTRAR,
  "/pintura/componentes/cadastrar": FAVORITE_PAGES.PINTURA_COMPONENTES_CADASTRAR,

  // Administration - List Pages
  "/financeiro/clientes": FAVORITE_PAGES.ADMINISTRACAO_CLIENTES_LISTAR,
  "/departamento-pessoal/colaboradores": FAVORITE_PAGES.ADMINISTRACAO_COLABORADORES_LISTAR,
  "/administracao/orcamentos": FAVORITE_PAGES.ADMINISTRACAO_ORCAMENTOS_LISTAR,
  "/administracao/registros-de-alteracoes": FAVORITE_PAGES.ADMINISTRACAO_REGISTROS_ALTERACOES_LISTAR,
  "/administracao/arquivos": FAVORITE_PAGES.ADMINISTRACAO_ARQUIVOS_LISTAR,
  "/administracao/setores": FAVORITE_PAGES.ADMINISTRACAO_SETORES_LISTAR,
  "/administracao/notificacoes": FAVORITE_PAGES.ADMINISTRACAO_NOTIFICACOES_LISTAR,
  "/administracao/mensagens": FAVORITE_PAGES.ADMINISTRACAO_MENSAGENS_LISTAR,

  // Administration - Create Pages
  "/financeiro/clientes/cadastrar": FAVORITE_PAGES.ADMINISTRACAO_CLIENTES_CADASTRAR,
  "/departamento-pessoal/colaboradores/cadastrar": FAVORITE_PAGES.ADMINISTRACAO_COLABORADORES_CADASTRAR,
  "/administracao/orcamentos/cadastrar": FAVORITE_PAGES.ADMINISTRACAO_ORCAMENTOS_CADASTRAR,
  "/administracao/arquivos/upload": FAVORITE_PAGES.ADMINISTRACAO_ARQUIVOS_CADASTRAR,
  "/administracao/setores/cadastrar": FAVORITE_PAGES.ADMINISTRACAO_SETORES_CADASTRAR,
  "/administracao/notificacoes/cadastrar/enviar": FAVORITE_PAGES.ADMINISTRACAO_NOTIFICACOES_CADASTRAR,
  "/administracao/mensagens/criar": FAVORITE_PAGES.ADMINISTRACAO_MENSAGENS_CRIAR,

  // Personnel Department - List Pages
  "/departamento-pessoal/cargos": FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CARGOS_LISTAR,
  "/departamento-pessoal/ferias": FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIAS_LISTAR,
  "/departamento-pessoal/calendario": FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CALENDARIO,
  "/departamento-pessoal/feriados": FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIADOS_LISTAR,
  "/departamento-pessoal/avisos": FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_AVISOS_LISTAR,
  "/medicina-do-trabalho/epi/entregas": FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_EPI_ENTREGAS_LISTAR,
  "/medicina-do-trabalho/epi/agendamentos": FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_EPI_AGENDAMENTOS_LISTAR,
  "/departamento-pessoal/setores": FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_SETORES_LISTAR,

  // Personnel Department - Create Pages
  "/departamento-pessoal/cargos/cadastrar": FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CARGOS_CADASTRAR,
  "/departamento-pessoal/ferias/cadastrar": FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIAS_CADASTRAR,
  "/departamento-pessoal/feriados/cadastrar": FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIADOS_CADASTRAR,
  "/departamento-pessoal/avisos/cadastrar": FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_AVISOS_CADASTRAR,
  "/medicina-do-trabalho/epi/entregas/cadastrar": FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_EPI_ENTREGAS_CADASTRAR,
  "/medicina-do-trabalho/epi/agendamentos/cadastrar": FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_EPI_AGENDAMENTOS_CADASTRAR,
  "/departamento-pessoal/setores/cadastrar": FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_SETORES_CADASTRAR,

  // Personal - List Pages
  "/pessoal/feriados": FAVORITE_PAGES.PESSOAL_FERIADOS_LISTAR,
  "/pessoal/meus-epis": FAVORITE_PAGES.PESSOAL_MEUS_EPIS_LISTAR,
  "/pessoal/meus-emprestimos": FAVORITE_PAGES.PESSOAL_MEUS_EMPRESTIMOS_LISTAR,
  "/pessoal/minhas-atividades": FAVORITE_PAGES.PESSOAL_MINHAS_ATIVIDADES_LISTAR,

  // Catalog Basic - List Pages
  "/pintura/catalogo-basico": FAVORITE_PAGES.CATALOGO_BASICO_LISTAR,

  // Favorites coverage — list/index pages wired for the favorites button
  "/administracao/notificacoes/configuracoes": FAVORITE_PAGES.ADMINISTRACAO_NOTIFICACOES_CONFIGURACOES_LISTAR,
  "/administracao/questionarios": FAVORITE_PAGES.ADMINISTRACAO_QUESTIONARIOS_LISTAR,
  "/administracao/questionarios-perguntas": FAVORITE_PAGES.ADMINISTRACAO_QUESTIONARIOS_PERGUNTAS_LISTAR,
  "/administracao/questionarios-temas": FAVORITE_PAGES.ADMINISTRACAO_QUESTIONARIOS_TEMAS_LISTAR,
  "/administracao/avaliacao-competencias": FAVORITE_PAGES.ADMINISTRACAO_AVALIACAO_COMPETENCIAS_LISTAR,
  "/administracao/competencias": FAVORITE_PAGES.ADMINISTRACAO_COMPETENCIAS_LISTAR,
  "/administracao/topicos": FAVORITE_PAGES.ADMINISTRACAO_TOPICOS_LISTAR,
  "/financeiro/notas-fiscais": FAVORITE_PAGES.FINANCEIRO_NOTAS_FISCAIS_LISTAR,
  "/financeiro/contas-a-receber": FAVORITE_PAGES.FINANCEIRO_CONTAS_A_RECEBER_LISTAR,
  "/financeiro/contas-recorrentes": FAVORITE_PAGES.FINANCEIRO_CONTAS_RECORRENTES_LISTAR,
  "/departamento-pessoal/controle-ponto/requisicoes": FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_REQUISICOES_LISTAR,
  "/departamento-pessoal/horarios": FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_HORARIOS_LISTAR,
  "/departamento-pessoal/emprestimos": FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_EMPRESTIMOS_LISTAR,
  "/estoque/localizacoes": FAVORITE_PAGES.ESTOQUE_LOCALIZACOES_LISTAR,
  "/meu-pessoal": FAVORITE_PAGES.MINHA_EQUIPE,
  "/meu-pessoal/avaliacoes-competencias": FAVORITE_PAGES.PRODUCAO_AVALIACAO_COMPETENCIAS_LISTAR,
  "/medicina-do-trabalho/cat": FAVORITE_PAGES.MEDICINA_DO_TRABALHO_CAT_LISTAR,
  "/perfil": FAVORITE_PAGES.PERFIL,
  "/servidor/implantacoes": FAVORITE_PAGES.SERVIDOR_IMPLANTACOES_LISTAR,
  "/ferramentas/paleta": FAVORITE_PAGES.FERRAMENTAS_PALETA,
  "/ferramentas": FAVORITE_PAGES.FERRAMENTAS,
};

/**
 * Get display name for a favorite page using the existing labels
 */
export function getFavoritePageDisplayName(favoritePage: FAVORITE_PAGES): string {
  return FAVORITE_PAGES_LABELS[favoritePage] || favoritePage;
}

/**
 * Get display name for a route path
 */
export function getRouteDisplayName(routePath: string): string {
  const favoritePage = routeToFavoritePageMap[routePath];
  if (favoritePage) {
    return getFavoritePageDisplayName(favoritePage);
  }

  // Fallback: try to extract entity name from path
  if (routePath.includes("/cadastrar")) {
    const pathParts = routePath.split("/");
    const entityIndex = pathParts.indexOf("cadastrar") - 1;
    if (entityIndex >= 0) {
      const entity = pathParts[entityIndex];
      return `Cadastrar ${getEntityDisplayName(entity)}`;
    }
  }

  // Return last part of path as fallback
  const parts = routePath.split("/");
  return parts[parts.length - 1] || routePath;
}

/**
 * Get entity display name for common entities
 */
export function getEntityDisplayName(entity: string): string {
  const entityMap: Record<string, string> = {
    // Production
    agenda: "Tarefa",
    cronograma: "Cronograma",
    recorte: "Recorte",
    servicos: "Serviço",
    observacoes: "Observação",
    aerografia: "Aerografia",
    "ordens-de-servico": "Ordem de Serviço",

    // Inventory
    movimentacoes: "Movimentação",
    produtos: "Produto",
    categorias: "Categoria",
    marcas: "Marca",
    pedidos: "Pedido",
    agendamentos: "Agendamento",
    manutencao: "Manutenção",
    "operacoes-externas": "Operação Externa",
    fornecedores: "Fornecedor",
    epi: "EPI",
    entregas: "Entrega",
    emprestimos: "Empréstimo",

    // Painting
    catalogo: "Tinta",
    producoes: "Produção",
    "tipos-de-tinta": "Tipo de Tinta",
    formulas: "Fórmula",
    formulacoes: "Formulação",
    componentes: "Componente",

    // Administration
    clientes: "Cliente",
    colaboradores: "Colaborador",
    orcamentos: "Orçamento",
    arquivos: "Arquivo",
    setores: "Setor",
    notificacoes: "Notificação",

    // Personnel Department
    cargos: "Cargo",
    ferias: "Férias",
    feriados: "Feriado",
    avisos: "Aviso",
  };

  return entityMap[entity] || entity;
}

/**
 * Extract entity information from a cadastrar route
 */
export function extractEntityFromCadastrarRoute(routePath: string): {
  entityName: string;
  displayName: string;
} | null {
  if (!routePath.includes("/cadastrar")) {
    return null;
  }

  const pathParts = routePath.split("/");
  const cadastrarIndex = pathParts.indexOf("cadastrar");

  if (cadastrarIndex <= 0) {
    return null;
  }

  const entityName = pathParts[cadastrarIndex - 1];
  const displayName = getEntityDisplayName(entityName);

  return {
    entityName,
    displayName,
  };
}

/**
 * Get a properly formatted page title for favorites
 */
export function getFavoritePageTitle(favoritePage: FAVORITE_PAGES): string {
  const displayName = getFavoritePageDisplayName(favoritePage);

  // The labels already have proper context, so we can return them directly
  return displayName;
}

/**
 * Get a short display name for cadastrar pages
 * This extracts just the entity name for a cleaner display in lists
 * Example: "Cadastrar Produto" -> "Produto"
 */
export function getCadastrarPageShortName(favoritePage: FAVORITE_PAGES): string {
  if (!isCadastrarPage(favoritePage)) {
    return getFavoritePageDisplayName(favoritePage);
  }

  const fullName = getFavoritePageDisplayName(favoritePage);

  // Remove "Cadastrar " prefix
  if (fullName.startsWith("Cadastrar ")) {
    return fullName.substring("Cadastrar ".length);
  }

  // Special cases
  if (fullName === "Upload de Arquivo") {
    return "Arquivo";
  }

  if (fullName === "Enviar Notificação") {
    return "Notificação";
  }

  return fullName;
}

/**
 * Group favorite pages by category
 */
export function groupFavoritePages(favoritePages: FAVORITE_PAGES[]): Record<string, FAVORITE_PAGES[]> {
  const groups: Record<string, FAVORITE_PAGES[]> = {
    Produção: [],
    Estoque: [],
    Pintura: [],
    Administração: [],
    "Departamento Pessoal": [],
    Pessoal: [],
    Catálogo: [],
  };

  favoritePages.forEach((page) => {
    if (page.startsWith("PRODUCAO_")) {
      groups["Produção"].push(page);
    } else if (page.startsWith("ESTOQUE_")) {
      groups["Estoque"].push(page);
    } else if (page.startsWith("PINTURA_")) {
      groups["Pintura"].push(page);
    } else if (page.startsWith("ADMINISTRACAO_")) {
      groups["Administração"].push(page);
    } else if (page.startsWith("DEPARTAMENTO_PESSOAL_")) {
      groups["Departamento Pessoal"].push(page);
    } else if (page.startsWith("PESSOAL_")) {
      groups["Pessoal"].push(page);
    } else if (page.startsWith("CATALOGO_")) {
      groups["Catálogo"].push(page);
    }
  });

  // Remove empty groups
  Object.keys(groups).forEach((key) => {
    if (groups[key].length === 0) {
      delete groups[key];
    }
  });

  return groups;
}

/**
 * Check if a favorite page is a cadastrar (create) page
 */
export function isCadastrarPage(favoritePage: FAVORITE_PAGES): boolean {
  return favoritePage.includes("_CADASTRAR");
}

/**
 * Convert a route path to its corresponding FAVORITE_PAGES enum value
 */
export function routeToFavoritePage(routePath: string): FAVORITE_PAGES | null {
  return routeToFavoritePageMap[routePath] || null;
}

/**
 * Check if a route path has a corresponding FAVORITE_PAGES enum
 */
export function isRouteAFavoritePage(routePath: string): boolean {
  return routePath in routeToFavoritePageMap;
}

/**
 * Get all available favorite pages grouped by module
 */
export function getAllFavoritePages(): Record<string, { page: FAVORITE_PAGES; path: string; displayName: string }[]> {
  const pages: Record<string, { page: FAVORITE_PAGES; path: string; displayName: string }[]> = {
    Produção: [],
    Estoque: [],
    Pintura: [],
    Administração: [],
    "Departamento Pessoal": [],
    Pessoal: [],
    Catálogo: [],
  };

  Object.entries(routeToFavoritePageMap).forEach(([path, page]) => {
    const displayName = getFavoritePageDisplayName(page);
    const entry = { page, path, displayName };

    if (page.startsWith("PRODUCAO_")) {
      pages["Produção"].push(entry);
    } else if (page.startsWith("ESTOQUE_")) {
      pages["Estoque"].push(entry);
    } else if (page.startsWith("PINTURA_")) {
      pages["Pintura"].push(entry);
    } else if (page.startsWith("ADMINISTRACAO_")) {
      pages["Administração"].push(entry);
    } else if (page.startsWith("DEPARTAMENTO_PESSOAL_")) {
      pages["Departamento Pessoal"].push(entry);
    } else if (page.startsWith("PESSOAL_")) {
      pages["Pessoal"].push(entry);
    } else if (page.startsWith("CATALOGO_")) {
      pages["Catálogo"].push(entry);
    }
  });

  // Remove empty groups
  Object.keys(pages).forEach((key) => {
    if (pages[key].length === 0) {
      delete pages[key];
    }
  });

  return pages;
}

/**
 * Get icon suggestion for a favorite page based on its category
 */
export function getFavoritePageIcon(favoritePage: FAVORITE_PAGES): string {
  // Production icons
  if (favoritePage.includes("CRONOGRAMA")) return "📅";
  if (favoritePage.includes("RECORTE")) return "✂️";
  if (favoritePage.includes("SERVICOS")) return "🔧";
  if (favoritePage.includes("OBSERVACOES")) return "📝";
  if (favoritePage.includes("AEROGRAFIA")) return "🎨";
  if (favoritePage.includes("ORDENS_SERVICO")) return "📋";

  // Inventory icons
  if (favoritePage.includes("MOVIMENTACOES")) return "📦";
  if (favoritePage.includes("PRODUTOS")) return "📦";
  if (favoritePage.includes("PEDIDOS")) return "🛒";
  if (favoritePage.includes("FORNECEDORES")) return "🏢";
  if (favoritePage.includes("MANUTENCAO")) return "🔧";
  if (favoritePage.includes("EPI")) return "🦺";
  if (favoritePage.includes("EMPRESTIMOS")) return "🤝";

  // Painting icons
  if (favoritePage.includes("CATALOGO")) return "🎨";
  if (favoritePage.includes("PRODUCOES")) return "🏭";
  if (favoritePage.includes("FORMULAS")) return "🧪";

  // Administration icons
  if (favoritePage.includes("CLIENTES")) return "👥";
  if (favoritePage.includes("COLABORADORES")) return "👷";
  if (favoritePage.includes("ORCAMENTOS")) return "💵";
  if (favoritePage.includes("ARQUIVOS")) return "📁";
  if (favoritePage.includes("NOTIFICACOES")) return "🔔";

  // Personnel Department icons
  if (favoritePage.includes("CARGOS")) return "💼";
  if (favoritePage.includes("FERIAS")) return "🏖️";
  if (favoritePage.includes("FERIADOS")) return "📅";
  if (favoritePage.includes("AVISOS")) return "⚠️";

  // Default icon
  return "📄";
}
