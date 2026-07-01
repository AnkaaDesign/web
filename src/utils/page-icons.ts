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
  IconFileInvoice,
  IconShield,
  IconNote,
  IconCalendar,
  IconTools,
  IconStar,
  IconActivity,
  IconMessageCircle,
  IconHome,
  IconChartBar,
  IconFileDescription,
  IconTarget,
  IconSettings,
  IconList,
  IconReceipt,
  IconClock,
  IconMapPin,
  IconCoins,
  IconFingerprint,
  IconUserCircle,
  IconRocket,
  IconUser,
  IconEdit,
  IconSignature,
  IconReportMoney,
  IconCalculator,
  IconTrendingUp,
  IconCurrencyDollar,
  IconCash,
  IconArrowsExchange2,
  IconStethoscope,
  IconServer,
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
  [FAVORITE_PAGES.ADMINISTRACAO_MENSAGENS_LISTAR]: { icon: IconMessageCircle, color: "bg-blue-500" },
  [FAVORITE_PAGES.ADMINISTRACAO_MENSAGENS_CRIAR]: { icon: IconMessageCircle, color: "bg-blue-600" },

  // Departamento Pessoal
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CARGOS_LISTAR]: { icon: IconBriefcase, color: "bg-purple-500" },
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CARGOS_CADASTRAR]: { icon: IconBriefcase, color: "bg-purple-600" },
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIAS_LISTAR]: { icon: IconBeach, color: "bg-blue-500" },
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIAS_CADASTRAR]: { icon: IconBeach, color: "bg-blue-600" },
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CALENDARIO]: { icon: IconCalendar, color: "bg-purple-500" },
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIADOS_LISTAR]: { icon: IconCalendar, color: "bg-orange-500" },
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIADOS_CADASTRAR]: { icon: IconCalendar, color: "bg-orange-600" },
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_AVISOS_LISTAR]: { icon: IconAlertTriangle, color: "bg-red-500" },
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_AVISOS_CADASTRAR]: { icon: IconAlertTriangle, color: "bg-red-600" },
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_EPI_ENTREGAS_LISTAR]: { icon: IconShield, color: "bg-yellow-400" },
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_EPI_ENTREGAS_CADASTRAR]: { icon: IconShield, color: "bg-yellow-500" },
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_EPI_AGENDAMENTOS_LISTAR]: { icon: IconCalendar, color: "bg-yellow-400" },
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_EPI_AGENDAMENTOS_CADASTRAR]: { icon: IconCalendar, color: "bg-yellow-500" },
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_SETORES_LISTAR]: { icon: IconBuildingSkyscraper, color: "bg-teal-500" },
  [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_SETORES_CADASTRAR]: { icon: IconBuildingSkyscraper, color: "bg-teal-600" },

  // Pessoal
  [FAVORITE_PAGES.PESSOAL_FERIADOS_LISTAR]: { icon: IconCalendar, color: "bg-orange-500" },
  [FAVORITE_PAGES.PESSOAL_MEUS_EPIS_LISTAR]: { icon: IconShield, color: "bg-yellow-500" },
  [FAVORITE_PAGES.PESSOAL_MEUS_EMPRESTIMOS_LISTAR]: { icon: IconRepeat, color: "bg-purple-500" },
  [FAVORITE_PAGES.PESSOAL_MINHAS_ATIVIDADES_LISTAR]: { icon: IconActivity, color: "bg-green-500" },

  // Meu Pessoal
  //   [FAVORITE_PAGES.MEU_PESSOAL_FERIAS_LISTAR]: { icon: IconBeach, color: "bg-blue-500" },
  //   [FAVORITE_PAGES.PESSOAL_MEUS_AVISOS_LISTAR]: { icon: IconAlertTriangle, color: "bg-red-500" },
  //   [FAVORITE_PAGES.PESSOAL_MEUS_EMPRESTIMOS_LISTAR]: { icon: IconRepeat, color: "bg-purple-500" },

  // Estatísticas
  //   [FAVORITE_PAGES.ESTATISTICAS_PRODUCAO_LISTAR]: { icon: IconChartBar, color: "bg-blue-500" },
  //   [FAVORITE_PAGES.ESTATISTICAS_DEPARTAMENTO_PESSOAL_LISTAR]: { icon: IconChartBar, color: "bg-orange-500" },
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

// Path prefix to icon mapping for dynamic routes
const PATH_PREFIX_ICON_MAP: Array<{ prefix: string; icon: Icon; color: string }> = [
  // Home
  { prefix: "/", icon: IconHome, color: "bg-blue-500" },

  // Produção
  { prefix: "/producao/agenda", icon: IconClipboardList, color: "bg-amber-500" },
  { prefix: "/producao/cronograma", icon: IconClipboardList, color: "bg-blue-500" },
  { prefix: "/producao/barracoes", icon: IconBuildingWarehouse, color: "bg-slate-500" },
  { prefix: "/producao/garagens", icon: IconBuildingWarehouse, color: "bg-slate-500" },
  { prefix: "/producao/historico", icon: IconHistory, color: "bg-gray-500" },
  { prefix: "/producao/recorte", icon: IconScissors, color: "bg-purple-500" },
  { prefix: "/producao/observacoes", icon: IconNote, color: "bg-teal-500" },
  { prefix: "/producao/aerografia", icon: IconBrush, color: "bg-pink-500" },
  { prefix: "/producao/servicos", icon: IconTools, color: "bg-orange-500" },
  { prefix: "/producao/ordens-de-servico", icon: IconClipboardList, color: "bg-blue-600" },
  { prefix: "/producao/dashboard", icon: IconChartBar, color: "bg-blue-500" },
  { prefix: "/producao", icon: IconClipboardList, color: "bg-blue-500" },

  // Estoque
  { prefix: "/estoque/movimentacoes", icon: IconArchive, color: "bg-green-500" },
  { prefix: "/estoque/produtos/categorias", icon: IconTag, color: "bg-emerald-500" },
  { prefix: "/estoque/produtos/marcas", icon: IconTag, color: "bg-emerald-500" },
  { prefix: "/estoque/produtos", icon: IconPackage, color: "bg-green-600" },
  { prefix: "/estoque/fornecedores", icon: IconTruck, color: "bg-cyan-500" },
  { prefix: "/estoque/pedidos/agendamentos", icon: IconCalendarEvent, color: "bg-blue-400" },
  { prefix: "/estoque/pedidos/automaticos", icon: IconRepeat, color: "bg-blue-500" },
  { prefix: "/estoque/pedidos", icon: IconShoppingCart, color: "bg-blue-500" },
  { prefix: "/estoque/manutencao/agendamentos", icon: IconCalendar, color: "bg-red-500" },
  { prefix: "/estoque/manutencao", icon: IconTool, color: "bg-red-600" },
  { prefix: "/estoque/operacoes-externas", icon: IconArchive, color: "bg-orange-500" },
  { prefix: "/estoque/epi/entregas", icon: IconShield, color: "bg-yellow-400" },
  { prefix: "/estoque/epi/agendamentos", icon: IconCalendar, color: "bg-yellow-400" },
  { prefix: "/estoque/epi", icon: IconShield, color: "bg-yellow-500" },
  { prefix: "/estoque/emprestimos", icon: IconRepeat, color: "bg-purple-500" },
  { prefix: "/estoque", icon: IconPackage, color: "bg-green-500" },

  // Pintura
  { prefix: "/pintura/catalogo", icon: IconPaint, color: "bg-indigo-500" },
  { prefix: "/pintura/producoes", icon: IconFlask, color: "bg-indigo-400" },
  { prefix: "/pintura/formulas", icon: IconFlask, color: "bg-indigo-500" },
  { prefix: "/pintura/formulacoes", icon: IconFlask, color: "bg-indigo-500" },
  { prefix: "/pintura/componentes", icon: IconFlask, color: "bg-indigo-500" },
  { prefix: "/pintura/tipos-de-tinta", icon: IconPalette, color: "bg-indigo-400" },
  { prefix: "/pintura/dashboard", icon: IconChartBar, color: "bg-indigo-500" },
  { prefix: "/pintura", icon: IconPaint, color: "bg-indigo-500" },

  // Administração
  { prefix: "/financeiro/orcamento", icon: IconFileDescription, color: "bg-green-600" },
  { prefix: "/financeiro/faturamento", icon: IconFileInvoice, color: "bg-amber-600" },
  { prefix: "/financeiro/clientes", icon: IconUsers, color: "bg-orange-500" },
  { prefix: "/departamento-pessoal/colaboradores", icon: IconUsers, color: "bg-purple-500" },
  { prefix: "/administracao/orcamentos", icon: IconFileInvoice, color: "bg-blue-500" },
  { prefix: "/administracao/registros-de-alteracoes", icon: IconHistory, color: "bg-gray-500" },
  { prefix: "/administracao/arquivos", icon: IconFile, color: "bg-gray-600" },
  { prefix: "/administracao/setores", icon: IconBuildingSkyscraper, color: "bg-teal-500" },
  { prefix: "/administracao/notificacoes", icon: IconBell, color: "bg-red-500" },
  { prefix: "/administracao/mensagens", icon: IconMessageCircle, color: "bg-blue-500" },
  { prefix: "/administracao/metas", icon: IconTarget, color: "bg-amber-500" },
  { prefix: "/administracao", icon: IconBuildingSkyscraper, color: "bg-teal-500" },

  // Departamento Pessoal
  { prefix: "/departamento-pessoal/cargos", icon: IconBriefcase, color: "bg-purple-500" },
  { prefix: "/departamento-pessoal/ferias", icon: IconBeach, color: "bg-blue-500" },
  { prefix: "/departamento-pessoal/calendario", icon: IconCalendar, color: "bg-purple-500" },
  { prefix: "/departamento-pessoal/feriados", icon: IconCalendar, color: "bg-orange-500" },
  { prefix: "/departamento-pessoal/avisos", icon: IconAlertTriangle, color: "bg-red-500" },
  { prefix: "/medicina-do-trabalho/epi/entregas", icon: IconShield, color: "bg-yellow-400" },
  { prefix: "/medicina-do-trabalho/epi/agendamentos", icon: IconCalendar, color: "bg-yellow-400" },
  { prefix: "/departamento-pessoal/setores", icon: IconBuildingSkyscraper, color: "bg-teal-500" },
  { prefix: "/departamento-pessoal", icon: IconUsers, color: "bg-purple-500" },

  // Pessoal
  { prefix: "/pessoal/feriados", icon: IconCalendar, color: "bg-orange-500" },
  { prefix: "/pessoal/meus-epis", icon: IconShield, color: "bg-yellow-500" },
  { prefix: "/pessoal/meus-emprestimos", icon: IconRepeat, color: "bg-purple-500" },
  { prefix: "/pessoal/minhas-atividades", icon: IconActivity, color: "bg-green-500" },
  { prefix: "/pessoal", icon: IconUsers, color: "bg-blue-500" },

  // Estatísticas
  { prefix: "/estatisticas", icon: IconChartBar, color: "bg-blue-500" },

  // Favorites coverage — list/index pages wired for the favorites button
  { prefix: "/administracao/notificacoes/configuracoes", icon: IconSettings, color: "bg-red-500" },
  { prefix: "/administracao/questionarios-perguntas", icon: IconList, color: "bg-cyan-500" },
  { prefix: "/administracao/questionarios-temas", icon: IconList, color: "bg-cyan-500" },
  { prefix: "/administracao/questionarios", icon: IconClipboardList, color: "bg-cyan-500" },
  { prefix: "/administracao/avaliacao-competencias", icon: IconClipboardList, color: "bg-cyan-600" },
  { prefix: "/administracao/competencias", icon: IconClipboardList, color: "bg-cyan-700" },
  { prefix: "/administracao/topicos", icon: IconList, color: "bg-cyan-600" },
  { prefix: "/financeiro/notas-fiscais", icon: IconReceipt, color: "bg-amber-600" },
  { prefix: "/financeiro/contas-a-receber", icon: IconReceipt, color: "bg-emerald-600" },
  { prefix: "/financeiro/contas-recorrentes", icon: IconRepeat, color: "bg-amber-500" },
  { prefix: "/departamento-pessoal/controle-ponto/requisicoes", icon: IconClipboardList, color: "bg-purple-500" },
  { prefix: "/departamento-pessoal/horarios", icon: IconClock, color: "bg-purple-500" },
  { prefix: "/departamento-pessoal/emprestimos", icon: IconCoins, color: "bg-purple-600" },
  { prefix: "/estoque/localizacoes", icon: IconMapPin, color: "bg-green-500" },
  { prefix: "/meu-pessoal/avaliacoes-competencias", icon: IconFingerprint, color: "bg-blue-600" },
  { prefix: "/meu-pessoal", icon: IconUsers, color: "bg-blue-500" },
  { prefix: "/medicina-do-trabalho/cat", icon: IconAlertTriangle, color: "bg-red-600" },
  { prefix: "/servidor/implantacoes", icon: IconRocket, color: "bg-indigo-500" },
  { prefix: "/ferramentas/paleta", icon: IconPalette, color: "bg-pink-500" },
  { prefix: "/ferramentas", icon: IconTools, color: "bg-slate-500" },
  { prefix: "/perfil", icon: IconUserCircle, color: "bg-slate-500" },

  // Favorites coverage batch 2 — Departamento Pessoal / Controle de Ponto
  // (more-specific prefixes win, so the per-subview entries beat the base)
  { prefix: "/departamento-pessoal/controle-ponto/colaborador", icon: IconUser, color: "bg-purple-500" },
  { prefix: "/departamento-pessoal/controle-ponto/dia", icon: IconCalendar, color: "bg-purple-500" },
  { prefix: "/departamento-pessoal/controle-ponto/edicao", icon: IconEdit, color: "bg-purple-500" },
  { prefix: "/departamento-pessoal/controle-ponto/ausencias", icon: IconList, color: "bg-purple-500" },
  { prefix: "/departamento-pessoal/controle-ponto/fechamento", icon: IconSignature, color: "bg-purple-500" },
  { prefix: "/departamento-pessoal/controle-ponto", icon: IconFingerprint, color: "bg-purple-500" },
  { prefix: "/departamento-pessoal/folha-de-pagamento", icon: IconReportMoney, color: "bg-purple-600" },
  { prefix: "/departamento-pessoal/calculos", icon: IconCalculator, color: "bg-purple-600" },
  { prefix: "/departamento-pessoal/bonus/nivel-de-performance", icon: IconTrendingUp, color: "bg-purple-500" },
  { prefix: "/departamento-pessoal/bonus/simulacao-de-bonus", icon: IconCalculator, color: "bg-purple-600" },
  { prefix: "/departamento-pessoal/bonus", icon: IconCoins, color: "bg-purple-600" },
  { prefix: "/departamento-pessoal/admissoes", icon: IconUser, color: "bg-green-600" },
  { prefix: "/departamento-pessoal/rescisoes", icon: IconUser, color: "bg-red-600" },
  { prefix: "/departamento-pessoal/beneficios", icon: IconCoins, color: "bg-pink-500" },
  { prefix: "/departamento-pessoal/integracoes", icon: IconArrowsExchange2, color: "bg-slate-500" },

  // Favorites coverage batch 2 — Financeiro (had no base prefix → fell to IconHome)
  { prefix: "/financeiro/contas-a-pagar", icon: IconCash, color: "bg-rose-600" },
  { prefix: "/financeiro/conciliacao", icon: IconArrowsExchange2, color: "bg-emerald-600" },
  { prefix: "/financeiro", icon: IconCurrencyDollar, color: "bg-amber-600" },

  // Favorites coverage batch 2 — Medicina do Trabalho / Servidor base prefixes
  { prefix: "/medicina-do-trabalho", icon: IconStethoscope, color: "bg-red-500" },
  { prefix: "/servidor/implantacoes", icon: IconRocket, color: "bg-indigo-500" },
  { prefix: "/servidor", icon: IconServer, color: "bg-indigo-500" },

  // Favorites coverage batch 2 — Minha Equipe / Pessoal leaf paths
  { prefix: "/meu-pessoal/calculos", icon: IconFingerprint, color: "bg-blue-600" },
  { prefix: "/meu-pessoal/epis", icon: IconShield, color: "bg-blue-600" },
  { prefix: "/meu-pessoal/emprestimos", icon: IconCoins, color: "bg-blue-600" },
  { prefix: "/meu-pessoal/movimentacoes", icon: IconArchive, color: "bg-blue-600" },
  { prefix: "/meu-pessoal/advertencias", icon: IconAlertTriangle, color: "bg-blue-600" },
  { prefix: "/meu-pessoal/usuarios", icon: IconUsers, color: "bg-blue-600" },
  { prefix: "/pessoal/meus-pontos", icon: IconFingerprint, color: "bg-blue-500" },
  { prefix: "/pessoal/minhas-movimentacoes", icon: IconActivity, color: "bg-green-500" },
  { prefix: "/pessoal/mensagens", icon: IconMessageCircle, color: "bg-blue-500" },
  { prefix: "/pessoal/advertencias", icon: IconAlertTriangle, color: "bg-red-500" },
  { prefix: "/pessoal/minhas-advertencias", icon: IconAlertTriangle, color: "bg-red-500" },

  // Favorites coverage batch 2 — Produção calendar
  { prefix: "/producao/calendario", icon: IconCalendarEvent, color: "bg-blue-500" },

  // Favoritos
  { prefix: "/favoritos", icon: IconStar, color: "bg-yellow-500" },
];

// Get icon and color for a page by path (supports dynamic routes)
export function getIconInfoByPath(path: string): { icon: Icon; color: string } {
  // Exact match for home
  if (path === "/" || path === "") {
    return { icon: IconHome, color: "bg-blue-500" };
  }

  // Find the most specific matching prefix (longer prefix = more specific)
  let bestMatch: { icon: Icon; color: string } | null = null;
  let bestMatchLength = 0;

  for (const entry of PATH_PREFIX_ICON_MAP) {
    if (path.startsWith(entry.prefix) && entry.prefix.length > bestMatchLength) {
      bestMatch = { icon: entry.icon, color: entry.color };
      bestMatchLength = entry.prefix.length;
    }
  }

  if (bestMatch) {
    return bestMatch;
  }

  return { icon: IconFile, color: "bg-gray-500" };
}

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
    "/estoque/operacoes-externas": "external",
    "/estoque/operacoes-externas/cadastrar": "external",
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
    "/financeiro/clientes": "users",
    "/financeiro/clientes/cadastrar": "users",
    "/financeiro/orcamento": "file-description",
    "/financeiro/orcamento/cadastrar": "file-description",
    "/financeiro/faturamento": "file-invoice",
    "/departamento-pessoal/colaboradores": "user",
    "/departamento-pessoal/colaboradores/cadastrar": "user",
    "/administracao/orcamentos": "file-invoice",
    "/administracao/orcamentos/cadastrar": "file-invoice",
    "/administracao/registros-de-alteracoes": "history",
    "/administracao/arquivos": "file",
    "/administracao/setores": "building",
    "/administracao/setores/cadastrar": "building",
    "/administracao/notificacoes": "notification",
    "/administracao/notificacoes/cadastrar/enviar": "notification",
    "/administracao/mensagens": "message",
    "/administracao/mensagens/criar": "message",
    "/administracao/metas": "target",
    "/administracao/metas/cadastrar": "target",

    // Departamento Pessoal
    "/departamento-pessoal/cargos": "briefcase",
    "/departamento-pessoal/cargos/cadastrar": "briefcase",
    "/departamento-pessoal/ferias": "calendar-week",
    "/departamento-pessoal/ferias/cadastrar": "calendar-week",
    "/departamento-pessoal/calendario": "calendar-stats",
    "/departamento-pessoal/feriados": "holiday",
    "/departamento-pessoal/feriados/cadastrar": "holiday",
    "/departamento-pessoal/avisos": "alert-triangle",
    "/departamento-pessoal/avisos/cadastrar": "alert-triangle",
    "/medicina-do-trabalho/epi/entregas": "truck",
    "/medicina-do-trabalho/epi/entregas/cadastrar": "truck",
    "/medicina-do-trabalho/epi/agendamentos": "schedule",
    "/medicina-do-trabalho/epi/agendamentos/cadastrar": "schedule",
    "/departamento-pessoal/setores": "building",
    "/departamento-pessoal/setores/cadastrar": "building",
    "/departamento-pessoal/folha-de-pagamento": "payroll",
    "/departamento-pessoal/bonus": "coins",
    "/departamento-pessoal/bonus/:id": "coins",
    "/departamento-pessoal/calculos": "device-ipad-dollar",
    "/departamento-pessoal/controle-ponto": "fingerprint",
    "/departamento-pessoal/controle-ponto/assinatura-digital": "signature",
    "/departamento-pessoal/controle-ponto/assinatura-digital/:id": "signature",
    "/departamento-pessoal/bonus/nivel-de-performance": "trending-up",
    "/departamento-pessoal/controle-ponto/requisicoes": "clipboard-list",
    "/departamento-pessoal/simulacao-bonus": "calculator",

    // Pessoal
    "/pessoal/feriados": "holiday",
    "/pessoal/meus-epis": "helmet",
    "/pessoal/meus-epis/solicitar": "helmet",
    "/pessoal/meus-emprestimos": "loan",
    "/pessoal/meus-pontos": "fingerprint",
    "/pessoal/minhas-movimentacoes": "movement",

    // Estatísticas
    "/estatisticas/producao": "chart-bar",
    "/estatisticas/departamento-pessoal": "chart-bar",
    "/estatisticas/estoque": "chart-bar",

    // Favorites coverage — list/index pages wired for the favorites button
    "/administracao/notificacoes/configuracoes": "cog",
    "/administracao/questionarios": "clipboard-list",
    "/administracao/questionarios-perguntas": "list",
    "/administracao/questionarios-temas": "list",
    "/administracao/avaliacao-competencias": "clipboard-list",
    "/administracao/competencias": "clipboard-list",
    "/administracao/topicos": "list",
    "/financeiro/notas-fiscais": "receipt",
    "/financeiro/contas-a-receber": "receipt",
    "/financeiro/contas-recorrentes": "repeat",
    "/departamento-pessoal/horarios": "clock",
    "/departamento-pessoal/emprestimos": "coins",
    "/estoque/localizacoes": "location",
    "/meu-pessoal": "users",
    "/meu-pessoal/avaliacoes-competencias": "fingerprint",
    "/medicina-do-trabalho/cat": "alert-triangle",
    "/servidor/implantacoes": "rocket",
    "/ferramentas": "tools",
    "/ferramentas/paleta": "palette",
    "/perfil": "user-circle",

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
    [FAVORITE_PAGES.ADMINISTRACAO_MENSAGENS_LISTAR]: "message",
    [FAVORITE_PAGES.ADMINISTRACAO_MENSAGENS_CRIAR]: "message",

    // Departamento Pessoal
    [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CARGOS_LISTAR]: "briefcase",
    [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CARGOS_CADASTRAR]: "briefcase",
    [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIAS_LISTAR]: "calendar-week",
    [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIAS_CADASTRAR]: "calendar-week",
    [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_CALENDARIO]: "calendar-stats",
    [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIADOS_LISTAR]: "holiday",
    [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_FERIADOS_CADASTRAR]: "holiday",
    [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_AVISOS_LISTAR]: "alert-triangle",
    [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_AVISOS_CADASTRAR]: "alert-triangle",
    [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_EPI_ENTREGAS_LISTAR]: "truck",
    [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_EPI_ENTREGAS_CADASTRAR]: "truck",
    [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_EPI_AGENDAMENTOS_LISTAR]: "schedule",
    [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_EPI_AGENDAMENTOS_CADASTRAR]: "schedule",
    [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_SETORES_LISTAR]: "building",
    [FAVORITE_PAGES.DEPARTAMENTO_PESSOAL_SETORES_CADASTRAR]: "building",

    // Default
    "/favoritos": "star",
  };

  return iconMap[path] || "file";
}