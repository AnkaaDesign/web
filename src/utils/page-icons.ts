import {
  IconPackage,
  IconUsers,
  IconBriefcase,
  IconAlertTriangle,
  IconBuildingSkyscraper,
  IconClipboardList,
  IconTool,
  IconPaint,
  IconBrush,
  IconBeach,
  IconHistory,
  IconScissors,
  IconBuildingWarehouse,
  IconArchive,
  IconTruck,
  IconTag,
  IconShoppingCart,
  IconCalendarEvent,
  IconRepeat,
  IconBell,
  IconFile,
  IconFlask,
  IconPalette,
  IconCoins,
  IconFileInvoice,
  IconShield,
  IconNote,
  IconCalendar,
  IconTools,
  IconRuler,
  IconStar,
  IconActivity
} from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import { FAVORITE_PAGES } from '@constants';

// Map of page paths to icons and colors
export const PAGE_ICON_MAP: Record<string, { icon: Icon; color: string }> = {
  // Produção
  [FAVORITE_PAGES.PRODUCAO_AGENDA_LISTAR]: { icon: IconClipboardList, color: "bg-amber-500" },
  [FAVORITE_PAGES.PRODUCAO_CRONOGRAMA_LISTAR]: { icon: IconClipboardList, color: "bg-blue-500" },
  [FAVORITE_PAGES.PRODUCAO_CRONOGRAMA_CADASTRAR]: { icon: IconClipboardList, color: "bg-blue-600" },
  // [FAVORITE_PAGES.PRODUCAO_EM_ESPERA_LISTAR]: { icon: IconHourglass, color: "bg-yellow-500" },
  [FAVORITE_PAGES.PRODUCAO_GARAGENS_LISTAR]: { icon: IconBuildingWarehouse, color: "bg-slate-500" },
  [FAVORITE_PAGES.PRODUCAO_GARAGENS_CADASTRAR]: { icon: IconBuildingWarehouse, color: "bg-slate-600" },
  [FAVORITE_PAGES.PRODUCAO_HISTORICO_LISTAR]: { icon: IconHistory, color: "bg-gray-500" },
  [FAVORITE_PAGES.PRODUCAO_RECORTE_LISTAR]: { icon: IconScissors, color: "bg-purple-500" },
  [FAVORITE_PAGES.PRODUCAO_OBSERVACOES_LISTAR]: { icon: IconNote, color: "bg-teal-500" },
  [FAVORITE_PAGES.PRODUCAO_OBSERVACOES_CADASTRAR]: { icon: IconNote, color: "bg-teal-600" },
  [FAVORITE_PAGES.PRODUCAO_AEROGRAFIA_LISTAR]: { icon: IconBrush, color: "bg-pink-500" },
  [FAVORITE_PAGES.PRODUCAO_AEROGRAFIA_CADASTRAR]: { icon: IconBrush, color: "bg-pink-600" },
  [FAVORITE_PAGES.PRODUCAO_SERVICOS_LISTAR]: { icon: IconTools, color: "bg-orange-500" },
  [FAVORITE_PAGES.PRODUCAO_SERVICOS_CADASTRAR]: { icon: IconTools, color: "bg-orange-600" },

  // Estoque
  [FAVORITE_PAGES.ESTOQUE_MOVIMENTACOES_LISTAR]: { icon: IconArchive, color: "bg-green-500" },
  [FAVORITE_PAGES.ESTOQUE_MOVIMENTACOES_CADASTRAR]: { icon: IconArchive, color: "bg-green-600" },
  [FAVORITE_PAGES.ESTOQUE_PRODUTOS_LISTAR]: { icon: IconPackage, color: "bg-green-600" },
  [FAVORITE_PAGES.ESTOQUE_PRODUTOS_CADASTRAR]: { icon: IconPackage, color: "bg-green-700" },
  [FAVORITE_PAGES.ESTOQUE_PRODUTOS_CATEGORIAS_LISTAR]: { icon: IconTag, color: "bg-emerald-500" },
  [FAVORITE_PAGES.ESTOQUE_PRODUTOS_CATEGORIAS_CADASTRAR]: { icon: IconTag, color: "bg-emerald-600" },
  [FAVORITE_PAGES.ESTOQUE_PRODUTOS_MARCAS_LISTAR]: { icon: IconTag, color: "bg-emerald-500" },
  [FAVORITE_PAGES.ESTOQUE_PRODUTOS_MARCAS_CADASTRAR]: { icon: IconTag, color: "bg-emerald-600" },
  [FAVORITE_PAGES.ESTOQUE_FORNECEDORES_LISTAR]: { icon: IconTruck, color: "bg-cyan-500" },
  [FAVORITE_PAGES.ESTOQUE_FORNECEDORES_CADASTRAR]: { icon: IconTruck, color: "bg-cyan-600" },
  [FAVORITE_PAGES.ESTOQUE_PEDIDOS_LISTAR]: { icon: IconShoppingCart, color: "bg-blue-500" },
  [FAVORITE_PAGES.ESTOQUE_PEDIDOS_CADASTRAR]: { icon: IconShoppingCart, color: "bg-blue-600" },
  [FAVORITE_PAGES.ESTOQUE_PEDIDOS_AGENDAMENTOS_LISTAR]: { icon: IconCalendarEvent, color: "bg-blue-400" },
  [FAVORITE_PAGES.ESTOQUE_PEDIDOS_AGENDAMENTOS_CADASTRAR]: { icon: IconCalendarEvent, color: "bg-blue-500" },
  [FAVORITE_PAGES.ESTOQUE_MANUTENCAO_LISTAR]: { icon: IconTool, color: "bg-red-600" },
  [FAVORITE_PAGES.ESTOQUE_MANUTENCAO_CADASTRAR]: { icon: IconTool, color: "bg-red-700" },
  [FAVORITE_PAGES.ESTOQUE_MANUTENCAO_AGENDAMENTOS_LISTAR]: { icon: IconCalendar, color: "bg-red-500" },
  [FAVORITE_PAGES.ESTOQUE_MANUTENCAO_AGENDAMENTOS_CADASTRAR]: { icon: IconCalendar, color: "bg-red-600" },
  [FAVORITE_PAGES.ESTOQUE_RETIRADAS_EXTERNAS_LISTAR]: { icon: IconArchive, color: "bg-orange-500" },
  [FAVORITE_PAGES.ESTOQUE_RETIRADAS_EXTERNAS_CADASTRAR]: { icon: IconArchive, color: "bg-orange-600" },
  [FAVORITE_PAGES.ESTOQUE_EPI_LISTAR]: { icon: IconShield, color: "bg-yellow-500" },
  [FAVORITE_PAGES.ESTOQUE_EPI_CADASTRAR]: { icon: IconShield, color: "bg-yellow-600" },
  [FAVORITE_PAGES.ESTOQUE_EPI_ENTREGAS_LISTAR]: { icon: IconShield, color: "bg-yellow-400" },
  [FAVORITE_PAGES.ESTOQUE_EPI_ENTREGAS_CADASTRAR]: { icon: IconShield, color: "bg-yellow-500" },
  [FAVORITE_PAGES.ESTOQUE_EPI_AGENDAMENTOS_LISTAR]: { icon: IconCalendar, color: "bg-yellow-400" },
  [FAVORITE_PAGES.ESTOQUE_EPI_AGENDAMENTOS_CADASTRAR]: { icon: IconCalendar, color: "bg-yellow-500" },
  [FAVORITE_PAGES.ESTOQUE_EMPRESTIMOS_LISTAR]: { icon: IconRepeat, color: "bg-purple-500" },
  [FAVORITE_PAGES.ESTOQUE_EMPRESTIMOS_CADASTRAR]: { icon: IconRepeat, color: "bg-purple-600" },

  // Pintura
  [FAVORITE_PAGES.PINTURA_CATALOGO_LISTAR]: { icon: IconPaint, color: "bg-indigo-500" },
  [FAVORITE_PAGES.PINTURA_CATALOGO_CADASTRAR]: { icon: IconPaint, color: "bg-indigo-600" },
  [FAVORITE_PAGES.PINTURA_PRODUCOES_LISTAR]: { icon: IconFlask, color: "bg-indigo-400" },
  [FAVORITE_PAGES.PINTURA_FORMULAS_LISTAR]: { icon: IconFlask, color: "bg-indigo-500" },
  [FAVORITE_PAGES.PINTURA_FORMULAS_CADASTRAR]: { icon: IconFlask, color: "bg-indigo-600" },
  [FAVORITE_PAGES.PINTURA_TIPOS_TINTA_LISTAR]: { icon: IconPalette, color: "bg-indigo-400" },
  [FAVORITE_PAGES.PINTURA_TIPOS_TINTA_CADASTRAR]: { icon: IconPalette, color: "bg-indigo-500" },

  // Administração
  [FAVORITE_PAGES.ADMINISTRACAO_COMISSOES_LISTAR]: { icon: IconCoins, color: "bg-green-500" },
  [FAVORITE_PAGES.ADMINISTRACAO_CLIENTES_LISTAR]: { icon: IconUsers, color: "bg-orange-500" },
  [FAVORITE_PAGES.ADMINISTRACAO_CLIENTES_CADASTRAR]: { icon: IconUsers, color: "bg-orange-600" },
  [FAVORITE_PAGES.ADMINISTRACAO_COLABORADORES_LISTAR]: { icon: IconUsers, color: "bg-purple-500" },
  [FAVORITE_PAGES.ADMINISTRACAO_COLABORADORES_CADASTRAR]: { icon: IconUsers, color: "bg-purple-600" },
  [FAVORITE_PAGES.ADMINISTRACAO_ORCAMENTOS_LISTAR]: { icon: IconFileInvoice, color: "bg-blue-500" },
  [FAVORITE_PAGES.ADMINISTRACAO_ORCAMENTOS_CADASTRAR]: { icon: IconFileInvoice, color: "bg-blue-600" },
  [FAVORITE_PAGES.ADMINISTRACAO_REGISTROS_ALTERACOES_LISTAR]: { icon: IconHistory, color: "bg-gray-500" },
  [FAVORITE_PAGES.ADMINISTRACAO_ARQUIVOS_LISTAR]: { icon: IconFile, color: "bg-gray-600" },
  [FAVORITE_PAGES.ADMINISTRACAO_SETORES_LISTAR]: { icon: IconBuildingSkyscraper, color: "bg-teal-500" },
  [FAVORITE_PAGES.ADMINISTRACAO_SETORES_CADASTRAR]: { icon: IconBuildingSkyscraper, color: "bg-teal-600" },
  [FAVORITE_PAGES.ADMINISTRACAO_NOTIFICACOES_LISTAR]: { icon: IconBell, color: "bg-red-500" },
  //   [FAVORITE_PAGES.ADMINISTRACAO_NOTIFICACOES_ENVIAR]: { icon: IconBell, color: "bg-red-600" },

  // Recursos Humanos
  [FAVORITE_PAGES.RECURSOS_HUMANOS_CARGOS_LISTAR]: { icon: IconBriefcase, color: "bg-purple-500" },
  [FAVORITE_PAGES.RECURSOS_HUMANOS_CARGOS_CADASTRAR]: { icon: IconBriefcase, color: "bg-purple-600" },
  [FAVORITE_PAGES.RECURSOS_HUMANOS_FERIAS_LISTAR]: { icon: IconBeach, color: "bg-blue-500" },
  [FAVORITE_PAGES.RECURSOS_HUMANOS_FERIAS_CADASTRAR]: { icon: IconBeach, color: "bg-blue-600" },
  [FAVORITE_PAGES.RECURSOS_HUMANOS_FERIADOS_LISTAR]: { icon: IconCalendar, color: "bg-orange-500" },
  [FAVORITE_PAGES.RECURSOS_HUMANOS_FERIADOS_CADASTRAR]: { icon: IconCalendar, color: "bg-orange-600" },
  [FAVORITE_PAGES.RECURSOS_HUMANOS_AVISOS_LISTAR]: { icon: IconAlertTriangle, color: "bg-red-500" },
  [FAVORITE_PAGES.RECURSOS_HUMANOS_AVISOS_CADASTRAR]: { icon: IconAlertTriangle, color: "bg-red-600" },
  [FAVORITE_PAGES.RECURSOS_HUMANOS_EPI_LISTAR]: { icon: IconShield, color: "bg-yellow-500" },
  [FAVORITE_PAGES.RECURSOS_HUMANOS_EPI_CADASTRAR]: { icon: IconShield, color: "bg-yellow-600" },
  [FAVORITE_PAGES.RECURSOS_HUMANOS_EPI_ENTREGAS_LISTAR]: { icon: IconShield, color: "bg-yellow-400" },
  [FAVORITE_PAGES.RECURSOS_HUMANOS_EPI_ENTREGAS_CADASTRAR]: { icon: IconShield, color: "bg-yellow-500" },
  [FAVORITE_PAGES.RECURSOS_HUMANOS_EPI_AGENDAMENTOS_LISTAR]: { icon: IconCalendar, color: "bg-yellow-400" },
  [FAVORITE_PAGES.RECURSOS_HUMANOS_EPI_AGENDAMENTOS_CADASTRAR]: { icon: IconCalendar, color: "bg-yellow-500" },
  [FAVORITE_PAGES.RECURSOS_HUMANOS_SETORES_LISTAR]: { icon: IconBuildingSkyscraper, color: "bg-teal-500" },
  [FAVORITE_PAGES.RECURSOS_HUMANOS_SETORES_CADASTRAR]: { icon: IconBuildingSkyscraper, color: "bg-teal-600" },

  // Pessoal
  [FAVORITE_PAGES.PESSOAL_FERIADOS_LISTAR]: { icon: IconCalendar, color: "bg-orange-500" },
  [FAVORITE_PAGES.PESSOAL_FERIAS_LISTAR]: { icon: IconBeach, color: "bg-blue-500" },
  [FAVORITE_PAGES.PESSOAL_MEUS_EPIS_LISTAR]: { icon: IconShield, color: "bg-yellow-500" },
  [FAVORITE_PAGES.PESSOAL_MEUS_EMPRESTIMOS_LISTAR]: { icon: IconRepeat, color: "bg-purple-500" },
  [FAVORITE_PAGES.PESSOAL_MINHAS_ATIVIDADES_LISTAR]: { icon: IconActivity, color: "bg-green-500" },

  // Meu Pessoal
  //   [FAVORITE_PAGES.PESSOAL_MINHAS_COMISSOES_LISTAR]: { icon: IconCoins, color: "bg-green-500" },
  //   [FAVORITE_PAGES.MEU_PESSOAL_FERIAS_LISTAR]: { icon: IconBeach, color: "bg-blue-500" },
  //   [FAVORITE_PAGES.PESSOAL_MEUS_AVISOS_LISTAR]: { icon: IconAlertTriangle, color: "bg-red-500" },
  //   [FAVORITE_PAGES.PESSOAL_MEUS_EMPRESTIMOS_LISTAR]: { icon: IconRepeat, color: "bg-purple-500" },

  // Estatísticas
  //   [FAVORITE_PAGES.ESTATISTICAS_PRODUCAO_LISTAR]: { icon: IconChartBar, color: "bg-blue-500" },
  //   [FAVORITE_PAGES.ESTATISTICAS_ADMINISTRACAO_LISTAR]: { icon: IconChartBar, color: "bg-purple-500" },
  //   [FAVORITE_PAGES.ESTATISTICAS_RECURSOS_HUMANOS_LISTAR]: { icon: IconChartBar, color: "bg-orange-500" },
  //   [FAVORITE_PAGES.ESTATISTICAS_ESTOQUE_LISTAR]: { icon: IconChartBar, color: "bg-green-500" },

  // Other
  //   [FAVORITE_PAGES.PINTURA_CATALOGO_BASICO_LISTAR]: { icon: IconPaint, color: "bg-indigo-400" },
  //   [FAVORITE_PAGES.MANUTENCAO_LISTAR]: { icon: IconTool, color: "bg-red-500" },
  //   [FAVORITE_PAGES.MANUTENCAO_CADASTRAR]: { icon: IconTool, color: "bg-red-600" },

  // Default
  "/favoritos": { icon: IconStar, color: "bg-yellow-500" },
};

// Create a path-based mapping from the enum-based mapping
const PATH_TO_ICON_MAP: Record<string, { icon: Icon; color: string }> = {};
for (const [, enumValue] of Object.entries(FAVORITE_PAGES)) {
  const iconInfo = PAGE_ICON_MAP[enumValue as keyof typeof PAGE_ICON_MAP];
  if (iconInfo) {
    PATH_TO_ICON_MAP[enumValue] = iconInfo;
  }
}

// Backward compatibility for old favorites that might have different paths stored
PATH_TO_ICON_MAP["/producao/garagens"] = { icon: IconBuildingWarehouse, color: "bg-slate-500" };
PATH_TO_ICON_MAP["/producao/garagens/cadastrar"] = { icon: IconBuildingWarehouse, color: "bg-slate-600" };

// Get icon and color for a page
export function getPageIconInfo(page: string): { icon: Icon; color: string } {
  // Try path-based mapping first
  return PATH_TO_ICON_MAP[page] || PAGE_ICON_MAP[page] || { icon: IconFile, color: "bg-gray-500" };
}

// Check if a page is a cadastrar (create) page
export function isPageCadastrar(page: string): boolean {
  return page.includes("_CADASTRAR") || page.includes("/cadastrar") || page.includes("/enviar") || page.includes("/solicitar") || page.includes("/criar");
}

// Get icon name for sidebar - works with paths
export function getPageIconName(path: string): string {
  // Direct path to icon mapping
  const pathIconMap: Record<string, string> = {
    // Produção
    "/producao/agenda": "clipboard-list",
    "/producao/cronograma": "calendar-stats",
    "/producao/cronograma/cadastrar": "calendar-stats",
    "/producao/barracoes": "warehouse",
    "/producao/barracoes/cadastrar": "warehouse",
    "/producao/garagens": "warehouse", // Backward compatibility
    "/producao/garagens/cadastrar": "warehouse", // Backward compatibility
    "/producao/em-espera": "pause",
    "/producao/historico": "history",
    "/producao/recorte": "scissors",
    "/producao/observacoes": "note",
    "/producao/observacoes/cadastrar": "note",
    "/producao/aerografia": "paint-brush",
    "/producao/aerografia/listar": "paint-brush",
    "/producao/aerografia/cadastrar": "paint-brush",
    "/producao/servicos": "tools",
    "/producao/servicos/cadastrar": "tools",

    // Estoque
    "/estoque/movimentacoes": "movement",
    "/estoque/movimentacoes/cadastrar": "movement",
    "/estoque/produtos": "package",
    "/estoque/produtos/cadastrar": "package",
    "/estoque/produtos/categorias": "tags",
    "/estoque/produtos/categorias/cadastrar": "tags",
    "/estoque/produtos/marcas": "brand",
    "/estoque/produtos/marcas/cadastrar": "brand",
    "/estoque/fornecedores": "users",
    "/estoque/fornecedores/cadastrar": "users",
    "/estoque/pedidos": "clipboard-list",
    "/estoque/pedidos/cadastrar": "clipboard-list",
    "/estoque/pedidos/agendamentos": "schedule",
    "/estoque/pedidos/agendamentos/cadastrar": "schedule",
    "/estoque/manutencao": "maintenance",
    "/estoque/manutencao/listar": "maintenance",
    "/estoque/manutencao/cadastrar": "maintenance",
    "/estoque/manutencao/agendamentos": "calendar",
    "/estoque/manutencao/agendamentos/cadastrar": "calendar",
    "/estoque/retiradas-externas": "external",
    "/estoque/retiradas-externas/cadastrar": "external",
    "/estoque/epi": "helmet",
    "/estoque/epi/cadastrar": "helmet",
    "/estoque/epi/entregas": "truck",
    "/estoque/epi/entregas/cadastrar": "truck",
    "/estoque/epi/agendamentos": "schedule",
    "/estoque/epi/agendamentos/cadastrar": "schedule",
    "/estoque/emprestimos": "borrowing",
    "/estoque/emprestimos/cadastrar": "borrowing",

    // Pintura
    "/pintura/catalogo": "palette",
    "/pintura/catalogo/cadastrar": "palette",
    "/pintura/producoes": "color-picker",
    "/pintura/formulas": "flask",
    "/pintura/formulas/listar": "flask",
    "/pintura/formulas/cadastrar": "flask",
    "/pintura/tipos-de-tinta": "tags",
    "/pintura/tipos-de-tinta/cadastrar": "tags",
    "/pintura/marcas-de-tinta": "brand",
    "/pintura/marcas-de-tinta/cadastrar": "brand",

    // Administração
    "/administracao/comissoes": "coins",
    "/administracao/clientes": "users",
    "/administracao/clientes/cadastrar": "users",
    "/administracao/colaboradores": "user",
    "/administracao/colaboradores/cadastrar": "user",
    "/administracao/orcamentos": "file-invoice",
    "/administracao/orcamentos/cadastrar": "file-invoice",
    "/administracao/registros-de-alteracoes": "history",
    "/administracao/arquivos": "file",
    "/administracao/setores": "building",
    "/administracao/setores/cadastrar": "building",
    "/administracao/notificacoes": "notification",
    "/administracao/notificacoes/cadastrar/enviar": "notification",

    // Recursos Humanos
    "/recursos-humanos/cargos": "briefcase",
    "/recursos-humanos/cargos/cadastrar": "briefcase",
    "/recursos-humanos/ferias": "calendar-week",
    "/recursos-humanos/ferias/cadastrar": "calendar-week",
    "/recursos-humanos/feriados": "holiday",
    "/recursos-humanos/feriados/cadastrar": "holiday",
    "/recursos-humanos/avisos": "alert-triangle",
    "/recursos-humanos/avisos/cadastrar": "alert-triangle",
    "/recursos-humanos/epi": "helmet",
    "/recursos-humanos/epi/cadastrar": "helmet",
    "/recursos-humanos/epi/entregas": "truck",
    "/recursos-humanos/epi/entregas/cadastrar": "truck",
    "/recursos-humanos/epi/agendamentos": "schedule",
    "/recursos-humanos/epi/agendamentos/cadastrar": "schedule",
    "/recursos-humanos/setores": "building",
    "/recursos-humanos/setores/cadastrar": "building",
    "/recursos-humanos/folha-de-pagamento": "payroll",
    "/recursos-humanos/bonus": "coins",
    "/recursos-humanos/bonus/:id": "coins",
    "/recursos-humanos/calculos": "device-ipad-dollar",
    "/recursos-humanos/controle-ponto": "fingerprint",
    "/recursos-humanos/bonus/nivel-de-performance": "trending-up",
    "/recursos-humanos/requisicoes": "clipboard-list",
    "/recursos-humanos/simulacao-bonus": "calculator",

    // Pessoal
    "/pessoal/feriados": "holiday",
    "/pessoal/ferias": "calendar-week",
    "/pessoal/meus-epis": "helmet",
    "/pessoal/meus-epis/solicitar": "helmet",
    "/pessoal/meus-emprestimos": "loan",
    "/pessoal/meus-pontos": "fingerprint",
    "/pessoal/minhas-movimentacoes": "movement",

    // Estatísticas
    "/estatisticas/producao": "chart-bar",
    "/estatisticas/administracao": "chart-bar",
    "/estatisticas/recursos-humanos": "chart-bar",
    "/estatisticas/estoque": "chart-bar",

    // Other
    "/favoritos": "star",
    "/manutencao": "tool",
    "/manutencao/cadastrar": "tool",
  };

  // Try exact match first
  if (pathIconMap[path]) {
    return pathIconMap[path];
  }

  // Try to find a partial match
  for (const [key, value] of Object.entries(pathIconMap)) {
    if (path.includes(key) || key.includes(path)) {
      return value;
    }
  }

  // Legacy enum-based mapping (updated to match navigation icons)
  const iconMap: Record<string, string> = {
    // Produção
    [FAVORITE_PAGES.PRODUCAO_AGENDA_LISTAR]: "clipboard-list",
    [FAVORITE_PAGES.PRODUCAO_CRONOGRAMA_LISTAR]: "calendar-stats",
    [FAVORITE_PAGES.PRODUCAO_CRONOGRAMA_CADASTRAR]: "calendar-stats",
    [FAVORITE_PAGES.PRODUCAO_GARAGENS_LISTAR]: "warehouse",
    [FAVORITE_PAGES.PRODUCAO_GARAGENS_CADASTRAR]: "warehouse",
    [FAVORITE_PAGES.PRODUCAO_HISTORICO_LISTAR]: "history",
    [FAVORITE_PAGES.PRODUCAO_RECORTE_LISTAR]: "scissors",
    [FAVORITE_PAGES.PRODUCAO_OBSERVACOES_LISTAR]: "note",
    [FAVORITE_PAGES.PRODUCAO_OBSERVACOES_CADASTRAR]: "note",
    [FAVORITE_PAGES.PRODUCAO_AEROGRAFIA_LISTAR]: "paint-brush",
    [FAVORITE_PAGES.PRODUCAO_AEROGRAFIA_CADASTRAR]: "paint-brush",
    [FAVORITE_PAGES.PRODUCAO_SERVICOS_LISTAR]: "tools",
    [FAVORITE_PAGES.PRODUCAO_SERVICOS_CADASTRAR]: "tools",

    // Estoque
    [FAVORITE_PAGES.ESTOQUE_MOVIMENTACOES_LISTAR]: "movement",
    [FAVORITE_PAGES.ESTOQUE_MOVIMENTACOES_CADASTRAR]: "movement",
    [FAVORITE_PAGES.ESTOQUE_PRODUTOS_LISTAR]: "package",
    [FAVORITE_PAGES.ESTOQUE_PRODUTOS_CADASTRAR]: "package",
    [FAVORITE_PAGES.ESTOQUE_PRODUTOS_CATEGORIAS_LISTAR]: "tags",
    [FAVORITE_PAGES.ESTOQUE_PRODUTOS_CATEGORIAS_CADASTRAR]: "tags",
    [FAVORITE_PAGES.ESTOQUE_PRODUTOS_MARCAS_LISTAR]: "brand",
    [FAVORITE_PAGES.ESTOQUE_PRODUTOS_MARCAS_CADASTRAR]: "brand",
    [FAVORITE_PAGES.ESTOQUE_FORNECEDORES_LISTAR]: "users",
    [FAVORITE_PAGES.ESTOQUE_FORNECEDORES_CADASTRAR]: "users",
    [FAVORITE_PAGES.ESTOQUE_PEDIDOS_LISTAR]: "clipboard-list",
    [FAVORITE_PAGES.ESTOQUE_PEDIDOS_CADASTRAR]: "clipboard-list",
    [FAVORITE_PAGES.ESTOQUE_PEDIDOS_AGENDAMENTOS_LISTAR]: "schedule",
    [FAVORITE_PAGES.ESTOQUE_PEDIDOS_AGENDAMENTOS_CADASTRAR]: "schedule",
    [FAVORITE_PAGES.ESTOQUE_MANUTENCAO_LISTAR]: "maintenance",
    [FAVORITE_PAGES.ESTOQUE_MANUTENCAO_CADASTRAR]: "maintenance",
    [FAVORITE_PAGES.ESTOQUE_MANUTENCAO_AGENDAMENTOS_LISTAR]: "calendar",
    [FAVORITE_PAGES.ESTOQUE_MANUTENCAO_AGENDAMENTOS_CADASTRAR]: "calendar",
    [FAVORITE_PAGES.ESTOQUE_RETIRADAS_EXTERNAS_LISTAR]: "external",
    [FAVORITE_PAGES.ESTOQUE_RETIRADAS_EXTERNAS_CADASTRAR]: "external",
    [FAVORITE_PAGES.ESTOQUE_EPI_LISTAR]: "helmet",
    [FAVORITE_PAGES.ESTOQUE_EPI_CADASTRAR]: "helmet",
    [FAVORITE_PAGES.ESTOQUE_EPI_ENTREGAS_LISTAR]: "truck",
    [FAVORITE_PAGES.ESTOQUE_EPI_ENTREGAS_CADASTRAR]: "truck",
    [FAVORITE_PAGES.ESTOQUE_EPI_AGENDAMENTOS_LISTAR]: "schedule",
    [FAVORITE_PAGES.ESTOQUE_EPI_AGENDAMENTOS_CADASTRAR]: "schedule",
    [FAVORITE_PAGES.ESTOQUE_EMPRESTIMOS_LISTAR]: "borrowing",
    [FAVORITE_PAGES.ESTOQUE_EMPRESTIMOS_CADASTRAR]: "borrowing",

    // Pintura
    [FAVORITE_PAGES.PINTURA_CATALOGO_LISTAR]: "palette",
    [FAVORITE_PAGES.PINTURA_CATALOGO_CADASTRAR]: "palette",
    [FAVORITE_PAGES.PINTURA_PRODUCOES_LISTAR]: "color-picker",
    [FAVORITE_PAGES.PINTURA_FORMULAS_LISTAR]: "flask",
    [FAVORITE_PAGES.PINTURA_FORMULAS_CADASTRAR]: "flask",
    [FAVORITE_PAGES.PINTURA_TIPOS_TINTA_LISTAR]: "tags",
    [FAVORITE_PAGES.PINTURA_TIPOS_TINTA_CADASTRAR]: "tags",

    // Administração
    [FAVORITE_PAGES.ADMINISTRACAO_COMISSOES_LISTAR]: "coins",
    [FAVORITE_PAGES.ADMINISTRACAO_CLIENTES_LISTAR]: "users",
    [FAVORITE_PAGES.ADMINISTRACAO_CLIENTES_CADASTRAR]: "users",
    [FAVORITE_PAGES.ADMINISTRACAO_COLABORADORES_LISTAR]: "user",
    [FAVORITE_PAGES.ADMINISTRACAO_COLABORADORES_CADASTRAR]: "user",
    [FAVORITE_PAGES.ADMINISTRACAO_ORCAMENTOS_LISTAR]: "file-invoice",
    [FAVORITE_PAGES.ADMINISTRACAO_ORCAMENTOS_CADASTRAR]: "file-invoice",
    [FAVORITE_PAGES.ADMINISTRACAO_REGISTROS_ALTERACOES_LISTAR]: "history",
    [FAVORITE_PAGES.ADMINISTRACAO_ARQUIVOS_LISTAR]: "file",
    [FAVORITE_PAGES.ADMINISTRACAO_SETORES_LISTAR]: "building",
    [FAVORITE_PAGES.ADMINISTRACAO_SETORES_CADASTRAR]: "building",
    [FAVORITE_PAGES.ADMINISTRACAO_NOTIFICACOES_LISTAR]: "notification",

    // Recursos Humanos
    [FAVORITE_PAGES.RECURSOS_HUMANOS_CARGOS_LISTAR]: "briefcase",
    [FAVORITE_PAGES.RECURSOS_HUMANOS_CARGOS_CADASTRAR]: "briefcase",
    [FAVORITE_PAGES.RECURSOS_HUMANOS_FERIAS_LISTAR]: "calendar-week",
    [FAVORITE_PAGES.RECURSOS_HUMANOS_FERIAS_CADASTRAR]: "calendar-week",
    [FAVORITE_PAGES.RECURSOS_HUMANOS_FERIADOS_LISTAR]: "holiday",
    [FAVORITE_PAGES.RECURSOS_HUMANOS_FERIADOS_CADASTRAR]: "holiday",
    [FAVORITE_PAGES.RECURSOS_HUMANOS_AVISOS_LISTAR]: "alert-triangle",
    [FAVORITE_PAGES.RECURSOS_HUMANOS_AVISOS_CADASTRAR]: "alert-triangle",
    [FAVORITE_PAGES.RECURSOS_HUMANOS_EPI_LISTAR]: "helmet",
    [FAVORITE_PAGES.RECURSOS_HUMANOS_EPI_CADASTRAR]: "helmet",
    [FAVORITE_PAGES.RECURSOS_HUMANOS_EPI_ENTREGAS_LISTAR]: "truck",
    [FAVORITE_PAGES.RECURSOS_HUMANOS_EPI_ENTREGAS_CADASTRAR]: "truck",
    [FAVORITE_PAGES.RECURSOS_HUMANOS_EPI_AGENDAMENTOS_LISTAR]: "schedule",
    [FAVORITE_PAGES.RECURSOS_HUMANOS_EPI_AGENDAMENTOS_CADASTRAR]: "schedule",
    [FAVORITE_PAGES.RECURSOS_HUMANOS_SETORES_LISTAR]: "building",
    [FAVORITE_PAGES.RECURSOS_HUMANOS_SETORES_CADASTRAR]: "building",

    // Default
    "/favoritos": "star",
  };

  return iconMap[path] || "file";
}