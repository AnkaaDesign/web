import { SECTOR_PRIVILEGES, TEAM_LEADER } from "./enums";

export interface MenuItem {
  id: string;
  title: string;
  icon: string; // Icon name (generic, will be mapped to platform-specific icons)
  path?: string;
  children?: MenuItem[];
  // Support both SECTOR_PRIVILEGES and TEAM_LEADER (virtual privilege for sector leaders only)
  requiredPrivilege?: SECTOR_PRIVILEGES | typeof TEAM_LEADER | (SECTOR_PRIVILEGES | typeof TEAM_LEADER)[];
  // Explicit sibling ordering. Items with `order` sort before alphabetical siblings
  // (spec-mandated sequences, e.g. Conciliação Bancária children). Lower = first.
  order?: number;
  isControlPanel?: boolean; // Indicates if this is a control panel/dashboard
  isDynamic?: boolean; // Indicates if this is a dynamic route
  onlyInStaging?: boolean; // Indicates if this menu item should only be shown in staging environment
}

// Comprehensive Tabler icon mapping for Brazilian manufacturing system
// Updated with verified @tabler/icons-react and @tabler/icons-react-native icon names
export const TABLER_ICONS = {
  // ==================== MAIN NAVIGATION ====================
  dashboard: "IconDashboard",
  menu: "IconMenu2",
  home: "IconHome",

  // ==================== DOMAIN MODULE ICONS ====================
  // Production
  factory: "IconBuilding",
  production: "IconTool", // More manufacturing-appropriate
  manufacturing: "IconTool",

  // Inventory/Stock
  package: "IconPackage",
  inventory: "IconBox", // Better represents inventory data/statistics
  warehouse: "IconBuildingWarehouse",

  // Paint/Painting
  paintBrush: "IconBrush", // More appropriate for paint brush functionality
  paint: "IconPaint",

  // Personnel Department
  users: "IconUsers",
  hr: "IconBriefcase", // More appropriate for HR department management

  // Administration
  cog: "IconSettings",
  admin: "IconShield", // More universal administrative icon
  target: "IconTarget",
  goal: "IconTarget",

  // Personal
  userCircle: "IconUserCircle",
  personal: "IconUser",

  // Analytics/Statistics
  barChart: "IconChartBar",
  chartBar: "IconChartBar",
  analytics: "IconChartLine",

  // ==================== PRODUCTION MANAGEMENT ====================
  // Task Status
  play: "IconPlayerPlay",
  pause: "IconPlayerPause",
  stop: "IconPlayerStop",
  clock: "IconClock",
  pending: "IconClock",
  preparation: "IconClipboardList",
  inProgress: "IconPlayerPlay",
  completed: "IconCircleCheck",
  cancelled: "IconX",

  // Production Tools
  scissors: "IconScissors",
  cutting: "IconScissors",
  truck: "IconTruck",
  tool: "IconTool",
  serviceWrench: "IconTool",
  tools: "IconTools",
  qrcode: "IconQrcode",
  maintenance: "IconTools",

  // Documentation
  clipboard: "IconClipboard",
  clipboardList: "IconClipboardList", // More consistent with clipboard concept
  note: "IconNote",
  history: "IconHistory", // Better represents historical data
  hourglass: "IconHourglass",
  file: "IconFile",
  fileDescription: "IconFileDescription",

  // ==================== INVENTORY MANAGEMENT ====================
  // Products and Items
  box: "IconBox",
  item: "IconPackage",
  products: "IconPackages",

  // Categories and Organization
  tags: "IconTags",
  tag: "IconTag",
  category: "IconFolder",
  brand: "IconBadge", // More appropriate for brand representation
  packages: "IconPackages",

  // Suppliers and Orders
  suppliers: "IconUsers", // Better represents supplier relationships
  supplier: "IconTruck",
  orders: "IconClipboardList", // Better represents order management
  order: "IconFileText",
  shoppingCart: "IconShoppingCart",

  // Scheduling and Automation
  calendar: "IconCalendar",
  calendarTime: "IconCalendarTime",
  calendarStats: "IconCalendarStats",
  calendarWeek: "IconCalendarWeek",
  calendarDollar: "IconCalendarDollar",
  calendarOff: "IconCalendarOff",
  arrowsExchange: "IconArrowsExchange",
  arrowsExchange2: "IconArrowsExchange2",
  fileSpreadsheet: "IconFileSpreadsheet",
  schedule: "IconCalendarPlus",
  automation: "IconBolt",

  // Movement and Activities
  packageSearch: "IconSearch", // Better for inventory search
  activity: "IconActivity",
  movement: "IconArrowsUpDown",

  // External Operations
  external: "IconSend", // More appropriate for external operations
  withdrawal: "IconArrowUp", // Better represents withdrawal/outgoing items

  // Safety Equipment (PPE)
  shield: "IconShield", // Better represents safety verification
  hardHat: "IconHelmet",
  safety: "IconShieldCheck",
  helmet: "IconHelmet",

  // Borrowing/Lending
  borrowing: "IconArrowsExchange", // Better represents borrowing cycle
  loan: "IconArrowsExchange", // Consistent with borrowing concept
  return: "IconArrowLeft", // For returning borrowed items
  repeat: "IconRepeat",

  // Sizing
  sizes: "IconRuler",
  measurements: "IconRuler2",

  // ==================== PAINT MANAGEMENT ====================
  // Paint Types and Colors
  palette: "IconPalette",
  droplet: "IconDroplet",
  color: "IconColorSwatch",
  brush: "IconBrush",
  flask: "IconFlask",

  // Production and Formulas
  beaker: "IconFlask",
  formula: "IconCalculator",
  mixing: "IconFlask",

  // Catalog
  catalog: "IconBook",
  swatch: "IconColorPicker",
  colorPicker: "IconColorPicker",

  // ==================== HUMAN RESOURCES ====================
  // People Management
  user: "IconUser",
  employee: "IconUser",
  userCheck: "IconUserCheck",
  team: "IconUsers",

  // Organization Structure
  building: "IconBuilding",
  buildingSkyscraper: "IconBuildingSkyscraper",
  sector: "IconBuildingBank",
  position: "IconBadge",
  briefcaseUser: "IconBriefcase",
  briefcase: "IconBriefcase",

  // Time Management
  vacation: "IconBeach", // More appropriate for time off
  beach: "IconBeach",
  holiday: "IconCalendarEvent", // Standard calendar for holidays
  calendarEvent: "IconCalendarEvent",
  timeOff: "IconCalendarMinus",

  // Communication
  warning: "IconAlertTriangle",
  announcement: "IconSpeakerphone",
  notice: "IconBell",
  message: "IconMessageCircle",
  messages: "IconMessages",

  // Payments
  dollarSign: "IconCurrencyDollar",
  salary: "IconCurrencyDollar",
  payroll: "IconCalendarDollar",
  deviceIpadDollar: "IconDeviceIpadDollar",

  // Job Openings
  jobOpening: "IconBriefcase",
  vacancy: "IconUserPlus",

  // ==================== ADMINISTRATION ====================
  // Customer Management
  customers: "IconUsers",
  customer: "IconUserCircle",
  client: "IconUser",

  // Document Management
  files: "IconFolders",
  folders: "IconFolders",
  document: "IconFileText",
  fileInvoice: "IconFileInvoice",
  archive: "IconArchive",
  databaseImport: "IconDatabaseImport",

  // System Management
  auditLog: "IconList", // Better represents audit verification
  log: "IconListDetails", // Better for system logs/statistics
  system: "IconDeviceDesktop",

  // Integrations
  api: "IconApi",
  database: "IconDatabase",
  sync: "IconRefresh",
  refresh: "IconRefresh",
  calculator: "IconCalculator",

  // Notifications
  bell: "IconBell",
  notification: "IconBellRinging",
  alert: "IconAlertCircle",

  // ==================== PERSONAL/USER INTERFACE ====================
  // Profile Management
  profile: "IconUserCircle",
  account: "IconUserCircle",

  // Personal Tasks and Items
  myTasks: "IconList",
  myVacations: "IconCalendarEvent",
  myBorrows: "IconPackage",
  myPpes: "IconShieldCheck",
  myNotifications: "IconBellRinging",

  // Preferences and Settings
  preferences: "IconSettings",
  theme: "IconPalette",
  privacy: "IconLock",
  configuration: "IconSettings",

  // ==================== STATISTICS AND ANALYTICS ====================
  // Chart Types
  pieChart: "IconChartPie", // Better chart representation
  lineChart: "IconChartLine",
  areaChart: "IconChartArea",

  // Trends and Performance
  trendingUp: "IconTrendingUp",
  trendingDown: "IconTrendingDown",
  performance: "IconBolt",
  efficiency: "IconChartBar",

  // Financial Metrics
  revenue: "IconCurrencyDollar",
  profit: "IconTrendingUp",
  cost: "IconCalculator",
  financial: "IconCurrencyDollar",
  coins: "IconCoins",
  receipt: "IconReceipt",

  // ==================== COMMON ACTIONS ====================
  // CRUD Operations
  plus: "IconPlus",
  add: "IconPlus",
  create: "IconPlus",
  edit: "IconEdit",
  update: "IconRefresh",
  trash: "IconTrash",
  delete: "IconTrash",
  details: "IconEye",
  view: "IconEye",
  list: "IconList",

  // Favorites
  star: "IconStar",
  starFilled: "IconStarFilled",
  favorites: "IconStar",

  // Data Operations
  search: "IconSearch",
  filter: "IconFilter",
  sort: "IconArrowsSort",

  // File Operations
  download: "IconDownload",
  upload: "IconUpload",
  import: "IconFileImport",
  export: "IconFileExport",

  // ==================== STATUS INDICATORS ====================
  // Success/Failure
  check: "IconCheck",
  checkCircle: "IconCircleCheck",
  x: "IconX",
  xCircle: "IconCircleX",

  // Information
  info: "IconInfoCircle",
  help: "IconHelp",
  question: "IconQuestionMark",

  // Warnings and Errors
  warningTriangle: "IconAlertTriangle",
  alertTriangle: "IconAlertTriangle",
  error: "IconAlertCircle",

  // ==================== FORM AND INPUT ====================
  // Visibility
  eye: "IconEye",
  eyeOff: "IconEyeOff",

  // Selection
  radio: "IconCircle",
  checkbox: "IconCheck",

  // ==================== NAVIGATION CONTROLS ====================
  // Directional
  chevronRight: "IconChevronRight",
  chevronLeft: "IconChevronLeft",
  chevronDown: "IconChevronDown",
  chevronUp: "IconChevronUp",

  // Actions
  back: "IconArrowLeft",
  forward: "IconArrowRight",

  // ==================== LOADING AND STATES ====================
  loader: "IconLoader",
  loading: "IconLoader",

  // Biometrics
  fingerprint: "IconFingerprint",
  signature: "IconSignature",

  // ==================== AUTENTICAÇÃO ====================
  login: "IconLogin",
  logOut: "IconLogout",
  register: "IconUserPlus",
  forgotPassword: "IconKey",
  resetPassword: "IconRefresh",
  verify: "IconShieldCheck",

  // ==================== BRAZILIAN BUSINESS CONTEXT ====================
  // Documents
  cpf: "IconId",
  cnpj: "IconBuildingBank",

  // Geographic
  location: "IconMapPin",
  address: "IconHome",

  // Communication
  phone: "IconPhone",
  email: "IconMail",

  // ==================== SERVER MANAGEMENT ====================
  server: "IconServer",
  services: "IconSettings",
  systemUsers: "IconUserCog",
  fileManager: "IconFolderShare",
  systemMetrics: "IconChartLine",
  systemLogs: "IconFileText",
  rocket: "IconRocket",
  deployment: "IconRocket",

  // ==================== SPECIALIZED TOOLS ====================
  // Configuration Tools
  userCog: "IconUserCog",
  systemCog: "IconSettings",

  // Quality Control
  quality: "IconShieldCheck",
  inspection: "IconSearch",

  // Reporting
  report: "IconFileReport",
  print: "IconPrinter",

  // ==================== UTILITIES ====================
  // Common UI Elements
  more: "IconDots",
  options: "IconMenu2",
  fullscreen: "IconMaximize",

  // File Types
  fileText: "IconFileText",
  image: "IconPhoto",
  video: "IconVideo",

  // Time and Date
  time: "IconClock",
  date: "IconCalendar",
  timer: "IconClock",
  timeTracking: "IconClockHour4",
  clockIn: "IconPlayerPlay",
  clockOut: "IconPlayerPause",

  // ==================== MOBILE SPECIFIC ====================
  // Mobile Navigation
  hamburger: "IconMenu2",
  bottomTab: "IconDots",

  // Mobile Actions
  share: "IconShare",

  // ==================== STATUS SPECIFIC ====================
  // Task Statuses
  statusPending: "IconClock",
  statusInProgress: "IconPlayerPlay",
  statusCompleted: "IconCircleCheck",
  statusCancelled: "IconX",
  statusOnHold: "IconPlayerPause",

  // Order Statuses
  statusCreated: "IconCirclePlus",
  statusReceived: "IconCircleCheck",
  statusFulfilled: "IconTruck",

  // User Statuses
  statusActive: "IconUser",
  statusInactive: "IconUserX",
  statusActivate: "IconCircleCheck",
  statusDeactivate: "IconCircleX",

  // General Statuses
  statusEnabled: "IconCheck",
  statusDisabled: "IconX",

  // Priority Levels
  priorityLow: "IconArrowDown",
  priorityMedium: "IconMinus",
  priorityHigh: "IconArrowUp",
  priorityCritical: "IconAlertTriangle",

  // ==================== ENTITY SPECIFIC ====================

  // PPE Related
  ppeDelivered: "IconCircleCheck",
  ppePending: "IconClock",
  ppeExpired: "IconAlertTriangle",

  // Paint Related
  paintMixed: "IconCircleCheck",
  paintPending: "IconClock",

  // ==================== SETTINGS CATEGORIES ====================
  settingsGeneral: "IconSettings",
  settingsAccount: "IconUserCog",
  settingsNotifications: "IconBellRinging",
  settingsPrivacy: "IconLock",
  settingsTheme: "IconPalette",
  settingsSecurity: "IconShield",

  // ==================== ADDITIONAL ICONS ====================
  approve: "IconCircleCheck",
  recycle: "IconRecycle",
  reject: "IconCircleX",
  send: "IconSend",
  orphan: "IconFolderX",
  components: "IconPuzzle",
  entity: "IconDatabase",
  spotCheck: "IconEye",
} as const;

export const NAVIGATION_MENU: MenuItem[] = [
  // HOME - Página Inicial (Exceção - sempre primeiro)
  {
    id: "home",
    title: "Início",
    icon: "home",
    path: "/",
  },

  // ADMINISTRAÇÃO
  // NOTE: ACCOUNTING must NOT appear here — the /administracao root page denies it.
  // ACCOUNTING gets dedicated root-level "Mensagens"/"Minhas Mensagens" items below instead.
  {
    id: "administracao",
    title: "Administração",
    icon: "briefcase",
    path: "/administracao",
    requiredPrivilege: [SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
    children: [
      // Colaboradores (employee directory) lives under the Departamento Pessoal
      // section now (dp-colaboradores) — removed from Administração to avoid the
      // duplicate entry. ADMIN/HR still reach it via Departamento Pessoal.
      {
        id: "mensagens-admin",
        title: "Mensagens",
        icon: "message",
        path: "/administracao/mensagens",
        children: [
          { id: "mensagens-admin-criar", title: "Criar", icon: "plus", path: "/administracao/mensagens/criar" },
          { id: "mensagens-admin-detalhes", title: "Detalhes", icon: "eye", path: "/administracao/mensagens/:id", isDynamic: true },
          { id: "mensagens-admin-editar", title: "Editar", icon: "edit", path: "/administracao/mensagens/:id/editar", isDynamic: true },
        ],
      },
      {
        id: "minhas-mensagens-admin",
        title: "Minhas Mensagens",
        icon: "message",
        path: "/pessoal/mensagens",
        requiredPrivilege: SECTOR_PRIVILEGES.ADMIN,
      },
      {
        id: "notificacoes-admin",
        title: "Notificações",
        icon: "notification",
        path: "/administracao/notificacoes",
        requiredPrivilege: [SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
        children: [
          { id: "notificacoes-admin-cadastrar", title: "Enviar", icon: "external", path: "/administracao/notificacoes/cadastrar/enviar" },
          { id: "notificacoes-admin-detalhes", title: "Detalhes", icon: "eye", path: "/administracao/notificacoes/detalhes/:id", isDynamic: true },
          { id: "notificacoes-admin-editar", title: "Editar", icon: "edit", path: "/administracao/notificacoes/editar/:id", isDynamic: true },
          {
            id: "notificacoes-configuracoes",
            title: "Configurações",
            icon: "cog",
            path: "/administracao/notificacoes/configuracoes",
            requiredPrivilege: SECTOR_PRIVILEGES.ADMIN,
            children: [
              { id: "notificacoes-configuracoes-cadastrar", title: "Cadastrar", icon: "plus", path: "/administracao/notificacoes/configuracoes/cadastrar" },
              { id: "notificacoes-configuracoes-detalhes", title: "Detalhes", icon: "eye", path: "/administracao/notificacoes/configuracoes/detalhes/:key", isDynamic: true },
              { id: "notificacoes-configuracoes-editar", title: "Editar", icon: "edit", path: "/administracao/notificacoes/configuracoes/editar/:key", isDynamic: true },
              { id: "notificacoes-configuracoes-testar", title: "Testar", icon: "check", path: "/administracao/notificacoes/configuracoes/testar/:key", isDynamic: true },
            ],
          },
        ],
      },
      {
        id: "setores",
        title: "Setores",
        icon: "building",
        path: "/administracao/setores",
        requiredPrivilege: [SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
        children: [
          { id: "setores-cadastrar", title: "Cadastrar", icon: "plus", path: "/administracao/setores/cadastrar", requiredPrivilege: SECTOR_PRIVILEGES.ADMIN },
          { id: "setores-detalhes", title: "Detalhes", icon: "eye", path: "/administracao/setores/detalhes/:id", isDynamic: true },
          { id: "setores-editar", title: "Editar", icon: "edit", path: "/administracao/setores/editar/:id", isDynamic: true },
        ],
      },
      {
        id: "metas",
        title: "Metas",
        icon: "target",
        path: "/administracao/metas",
        requiredPrivilege: SECTOR_PRIVILEGES.ADMIN,
      },
      {
        id: "aplicativos-moveis",
        title: "Aplicativos Móveis",
        icon: "deployment",
        path: "/administracao/aplicativos",
        requiredPrivilege: SECTOR_PRIVILEGES.ADMIN,
      },
      {
        id: "avaliacao-competencias-admin",
        title: "Aval. de Competências",
        icon: "clipboardList",
        path: "/administracao/avaliacao-competencias",
        requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.PRODUCTION_MANAGER],
        children: [
          {
            id: "avaliacao-competencias-campanhas",
            title: "Campanhas",
            icon: "clipboardList",
            path: "/administracao/avaliacao-competencias",
            requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.PRODUCTION_MANAGER],
          },
          {
            id: "avaliacao-competencias-skills",
            title: "Competências",
            icon: "clipboardList",
            path: "/administracao/competencias",
            requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES],
          },
          {
            id: "avaliacao-competencias-topics",
            title: "Tópicos",
            icon: "clipboardList",
            path: "/administracao/topicos",
            requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES],
          },
        ],
      },
      {
        id: "questionarios-admin",
        title: "Questionários",
        icon: "clipboardList",
        path: "/administracao/questionarios",
        requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.PRODUCTION_MANAGER],
        children: [
          {
            id: "questionarios-campanhas",
            title: "Campanhas",
            icon: "clipboardList",
            path: "/administracao/questionarios",
            requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.PRODUCTION_MANAGER],
          },
          {
            id: "questionarios-temas",
            title: "Temas",
            icon: "clipboardList",
            path: "/administracao/questionarios-temas",
            requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.PRODUCTION_MANAGER],
          },
          {
            id: "questionarios-perguntas",
            title: "Perguntas",
            icon: "clipboardList",
            path: "/administracao/questionarios-perguntas",
            requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.PRODUCTION_MANAGER],
          },
        ],
      },
    ],
  },

  // CONTABILIDADE - Direct root-level items (ACCOUNTING only).
  // Menu filtering is exact-match; ADMIN/HR/PM reach these pages from their own sections,
  // so gating these to ACCOUNTING alone avoids duplicate entries for other roles.
  {
    id: "mensagens-accounting",
    title: "Mensagens",
    icon: "message",
    path: "/administracao/mensagens",
    requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING],
    children: [
      { id: "mensagens-accounting-criar", title: "Criar", icon: "plus", path: "/administracao/mensagens/criar" },
      { id: "mensagens-accounting-detalhes", title: "Detalhes", icon: "eye", path: "/administracao/mensagens/:id", isDynamic: true },
      { id: "mensagens-accounting-editar", title: "Editar", icon: "edit", path: "/administracao/mensagens/:id/editar", isDynamic: true },
    ],
  },
  {
    id: "minhas-mensagens-accounting",
    title: "Minhas Mensagens",
    icon: "message",
    path: "/pessoal/mensagens",
    requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING],
  },

  // FINANCEIRO
  {
    id: "financeiro",
    title: "Financeiro",
    icon: "financial",
    path: "/financeiro",
    // FINANCIAL must be here or the menu filter (which prunes a failed parent
    // before its children) hides the entire group from FINANCIAL users.
    requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ACCOUNTING],
    children: [
      {
        id: "clientes-financeiro-menu",
        title: "Clientes",
        icon: "users",
        path: "/financeiro/clientes",
        requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PRODUCTION_MANAGER],
        children: [
          { id: "clientes-financeiro-cadastrar", title: "Cadastrar", icon: "plus", path: "/financeiro/clientes/cadastrar", requiredPrivilege: SECTOR_PRIVILEGES.ADMIN },
          { id: "clientes-financeiro-detalhes", title: "Detalhes", icon: "eye", path: "/financeiro/clientes/detalhes/:id", isDynamic: true },
          { id: "clientes-financeiro-editar", title: "Editar", icon: "edit", path: "/financeiro/clientes/editar/:id", isDynamic: true, requiredPrivilege: SECTOR_PRIVILEGES.ADMIN },
          { id: "responsaveis-financeiro", title: "Responsáveis", icon: "users", path: "/financeiro/clientes/responsaveis", requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL] },
        ],
      },
      {
        id: "faturamento",
        title: "Faturamento",
        icon: "fileInvoice",
        path: "/financeiro/faturamento",
        requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ACCOUNTING],
        children: [
          { id: "faturamento-detalhes", title: "Detalhes", icon: "eye", path: "/financeiro/faturamento/detalhes/:id", isDynamic: true },
        ],
      },
      {
        // Unified Notas Fiscais surface — one page with a direction toggle
        // (Emitidas = NFS-e we issue via Elotech; Recebidas = supplier NFs via
        // SIEG). Sector-defaulted: FINANCIAL/COMMERCIAL → Emitidas, ACCOUNTING →
        // Recebidas. Replaces both the old "NFS-e Emitidas" and the
        // "Conciliação > Notas Fiscais" entries.
        id: "notas-fiscais",
        title: "Notas Fiscais",
        icon: "receipt",
        path: "/financeiro/notas-fiscais",
        requiredPrivilege: [
          SECTOR_PRIVILEGES.ADMIN,
          SECTOR_PRIVILEGES.FINANCIAL,
          SECTOR_PRIVILEGES.COMMERCIAL,
          SECTOR_PRIVILEGES.ACCOUNTING,
        ],
        children: [
          // Document detail opens from two surfaces — the Notas Fiscais list
          // (/notas-fiscais/:id) and a reconciled transaction
          // (/conciliacao/notas/:id). Register both as dynamic children so the
          // active-nav resolver maps them onto "Notas Fiscais" instead of falling
          // back to the top-level "Financeiro" prefix match (which left the detail
          // page with no highlighted nav item).
          { id: "notas-fiscais-detalhes", title: "Detalhes", icon: "eye", path: "/financeiro/notas-fiscais/:id", isDynamic: true },
          { id: "notas-fiscais-conciliacao-detalhes", title: "Detalhes", icon: "eye", path: "/financeiro/conciliacao/notas/:id", isDynamic: true },
        ],
      },
      {
        id: "orcamento",
        title: "Orçamentos",
        icon: "fileDescription",
        path: "/financeiro/orcamento",
        requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL],
        children: [
          { id: "orcamento-detalhes", title: "Detalhes", icon: "eye", path: "/financeiro/orcamento/detalhes/:id", isDynamic: true },
        ],
      },
      {
        id: "conciliacao-bancaria",
        title: "Conciliação Bancária",
        icon: "arrowsExchange2",
        path: "/financeiro/conciliacao/extrato",
        requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ACCOUNTING],
        children: [
          // Extrato is the single Conciliação Bancária view — it absorbed the
          // former Saídas/Entradas pages (now CREDIT/DEBIT + status filters on
          // the Extrato itself). `order` keeps it ahead of the alphabetical
          // FINANCIAL/ADMIN-only utilities below.
          {
            id: "conciliacao-extrato",
            title: "Extrato",
            icon: "fileSpreadsheet",
            path: "/financeiro/conciliacao/extrato",
            order: 1,
            requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN],
            children: [
              // Transaction detail opens from the Extrato list but lives at a
              // sibling path (/transacoes/:id, not /extrato/:id). Register it as a
              // dynamic child so the active-nav resolver maps it onto Extrato →
              // Conciliação Bancária instead of falling back to the top-level
              // "Financeiro" prefix match.
              { id: "conciliacao-transacao-detalhes", title: "Detalhes", icon: "eye", path: "/financeiro/conciliacao/transacoes/:id", isDynamic: true },
            ],
          },
          {
            // Inflow ledger — open/overdue/received receivable installments
            // (task-quotes + external operations + invoices). FINANCIAL emphasis.
            id: "contas-a-receber",
            title: "Contas a Receber",
            icon: "receipt",
            path: "/financeiro/conciliacao/entradas",
            order: 2,
            requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN],
          },
          {
            // Outflow ledger — unified payables (orders + airbrushing + payroll +
            // taxes + recurrents). ACCOUNTING emphasis. FINANCIAL also manages cash.
            id: "contas-a-pagar",
            title: "Contas a Pagar",
            icon: "receipt",
            path: "/financeiro/contas-a-pagar",
            order: 3,
            requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN],
          },
          {
            // Recurring monthly bills (aluguel/internet/energia/água). One page:
            // a monthly Pago/Pendente/Previsão dashboard + full CRUD. Each bill
            // materializes a monthly occurrence into Contas a Pagar. (Consolidated
            // — absorbed the former legacy "Recorrentes (categorias)" forecast.)
            id: "contas-recorrentes",
            title: "Recorrentes",
            icon: "repeat",
            path: "/financeiro/contas-recorrentes",
            order: 4,
            requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN],
          },
          {
            // Manage the transaction category set (the only place to edit it).
            id: "conciliacao-categorias",
            title: "Categorias",
            icon: "tags",
            path: "/financeiro/conciliacao/categorias",
            order: 5,
            requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN],
          },
        ],
      },
    ],
  },

  // ESTATÍSTICAS
  {
    id: "estatisticas",
    title: "Estatísticas",
    icon: "barChart",
    path: "/estatisticas",
    requiredPrivilege: SECTOR_PRIVILEGES.ADMIN,
    children: [
      {
        id: "stats-estoque",
        title: "Estoque",
        icon: "box",
        path: "/estatisticas/estoque",
        children: [
          { id: "stats-estoque-consumo", title: "Análise de Consumo", icon: "chartBar", path: "/estatisticas/estoque/consumo" },
          { id: "stats-estoque-pedidos", title: "Análise de Pedidos", icon: "clipboardList", path: "/estatisticas/estoque/pedidos" },
        ],
      },
      {
        id: "stats-producao",
        title: "Produção",
        icon: "building",
        path: "/estatisticas/producao",
        children: [
          { id: "stats-producao-produtividade", title: "Produtividade", icon: "chartBar", path: "/estatisticas/producao/produtividade" },
          { id: "stats-producao-desempenho", title: "Desempenho", icon: "activity", path: "/estatisticas/producao/desempenho" },
          { id: "stats-producao-gargalos", title: "Gargalos", icon: "alertTriangle", path: "/estatisticas/producao/gargalos" },
          { id: "stats-producao-valor-bonus", title: "Relação Bônus / Produção", icon: "coins", path: "/estatisticas/producao/valor-bonus" },
        ],
      },
      {
        id: "stats-financeiro",
        title: "Financeiro",
        icon: "dollarSign",
        path: "/estatisticas/financeiro",
        children: [
          { id: "stats-financeiro-cobrancas", title: "Visão Financeira", icon: "chartBar", path: "/estatisticas/financeiro/cobrancas" },
          { id: "stats-financeiro-nfse", title: "NFS-e", icon: "receipt", path: "/estatisticas/financeiro/nfse" },
        ],
      },
      {
        id: "stats-departamento-pessoal",
        title: "Departamento Pessoal",
        icon: "users",
        path: "/estatisticas/departamento-pessoal",
        children: [
          { id: "stats-rh-folha", title: "Folha de Pagamento", icon: "chartBar", path: "/estatisticas/departamento-pessoal/folha" },
          { id: "stats-rh-equipe", title: "Equipe", icon: "users", path: "/estatisticas/departamento-pessoal/equipe" },
          { id: "stats-rh-faltas", title: "Faltas", icon: "calendarOff", path: "/estatisticas/departamento-pessoal/faltas" },
          { id: "stats-rh-competencias", title: "Competências", icon: "clipboardList", path: "/estatisticas/departamento-pessoal/competencias" },
        ],
      },
    ],
  },

  // ESTOQUE
  {
    id: "estoque",
    title: "Estoque",
    icon: "packages",
    path: "/estoque",
    requiredPrivilege: [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN],
    children: [
      {
        id: "emprestimos",
        title: "Empréstimos",
        icon: "borrowing",
        path: "/estoque/emprestimos",
        children: [
          { id: "emprestimos-cadastrar", title: "Cadastrar", icon: "plus", path: "/estoque/emprestimos/cadastrar" },
          { id: "emprestimos-detalhes", title: "Detalhes", icon: "eye", path: "/estoque/emprestimos/detalhes/:id", isDynamic: true },
          { id: "emprestimos-editar-lote", title: "Editar em Lote", icon: "edit", path: "/estoque/emprestimos/editar-lote" },
        ],
      },
      {
        id: "epi-estoque",
        title: "EPI",
        icon: "helmet",
        path: "/estoque/epi",
        children: [
          {
            id: "epi-agendamentos",
            title: "Agendamentos",
            icon: "schedule",
            path: "/estoque/epi/agendamentos",
            children: [
              { id: "agendamentos-cadastrar", title: "Cadastrar", icon: "plus", path: "/estoque/epi/agendamentos/cadastrar", requiredPrivilege: SECTOR_PRIVILEGES.ADMIN },
              { id: "agendamentos-detalhes", title: "Detalhes", icon: "eye", path: "/estoque/epi/agendamentos/detalhes/:id", isDynamic: true },
              { id: "agendamentos-editar", title: "Editar", icon: "edit", path: "/estoque/epi/agendamentos/editar/:id", isDynamic: true, requiredPrivilege: SECTOR_PRIVILEGES.ADMIN },
            ],
          },
          { id: "epi-cadastrar", title: "Cadastrar", icon: "plus", path: "/estoque/epi/cadastrar" },
          { id: "epi-detalhes", title: "Detalhes", icon: "eye", path: "/estoque/epi/detalhes/:id", isDynamic: true },
          { id: "epi-editar", title: "Editar", icon: "edit", path: "/estoque/epi/editar/:id", isDynamic: true },
          {
            id: "epi-entregas",
            title: "Entregas",
            icon: "truck",
            path: "/estoque/epi/entregas",
            children: [
              { id: "epi-entregas-cadastrar", title: "Cadastrar", icon: "plus", path: "/estoque/epi/entregas/cadastrar" },
              { id: "epi-entregas-detalhes", title: "Detalhes", icon: "eye", path: "/estoque/epi/entregas/detalhes/:id", isDynamic: true },
              { id: "v-entregas-editar", title: "Editar", icon: "edit", path: "/estoque/epi/entregas/editar/:id", isDynamic: true },
            ],
          },
        ],
      },
      {
        id: "fornecedores",
        title: "Fornecedores",
        icon: "users",
        path: "/estoque/fornecedores",
        children: [
          { id: "fornecedores-cadastrar", title: "Cadastrar", icon: "plus", path: "/estoque/fornecedores/cadastrar" },
          { id: "fornecedores-detalhes", title: "Detalhes", icon: "eye", path: "/estoque/fornecedores/detalhes/:id", isDynamic: true },
          { id: "fornecedores-editar", title: "Editar", icon: "edit", path: "/estoque/fornecedores/editar/:id", isDynamic: true },
        ],
      },
      {
        id: "localizacoes",
        title: "Localizações",
        icon: "location",
        path: "/estoque/localizacoes",
        children: [
          { id: "localizacoes-cadastrar", title: "Cadastrar", icon: "plus", path: "/estoque/localizacoes/cadastrar" },
          { id: "localizacoes-detalhes", title: "Detalhes", icon: "eye", path: "/estoque/localizacoes/detalhes/:id", isDynamic: true },
          { id: "localizacoes-editar", title: "Editar", icon: "edit", path: "/estoque/localizacoes/editar/:id", isDynamic: true },
        ],
      },
      {
        id: "manutencao",
        title: "Manutenção",
        icon: "maintenance",
        path: "/estoque/manutencao",
        children: [
          {
            id: "manutencao-agendamentos",
            title: "Agendamentos",
            icon: "calendar",
            path: "/estoque/manutencao/agendamentos",
            children: [
              { id: "agendamentos-manutencao-cadastrar", title: "Cadastrar", icon: "plus", path: "/estoque/manutencao/agendamentos/cadastrar" },
              { id: "agendamentos-manutencao-detalhes", title: "Detalhes", icon: "eye", path: "/estoque/manutencao/agendamentos/detalhes/:id", isDynamic: true },
              { id: "agendamentos-manutencao-editar", title: "Editar", icon: "edit", path: "/estoque/manutencao/agendamentos/editar/:id", isDynamic: true },
            ],
          },
          { id: "manutencao-cadastrar", title: "Cadastrar", icon: "plus", path: "/estoque/manutencao/cadastrar" },
          { id: "manutencao-detalhes", title: "Detalhes", icon: "eye", path: "/estoque/manutencao/detalhes/:id", isDynamic: true },
          { id: "manutencao-editar", title: "Editar", icon: "edit", path: "/estoque/manutencao/editar/:id", isDynamic: true },
        ],
      },
      {
        id: "movimentacoes",
        title: "Movimentações",
        icon: "movement",
        path: "/estoque/movimentacoes",
        children: [
          { id: "movimentacoes-cadastrar", title: "Cadastrar", icon: "plus", path: "/estoque/movimentacoes/cadastrar" },
          { id: "movimentacoes-detalhes", title: "Detalhes", icon: "eye", path: "/estoque/movimentacoes/detalhes/:id", isDynamic: true },
          { id: "movimentacoes-editar", title: "Editar", icon: "edit", path: "/estoque/movimentacoes/editar/:id", isDynamic: true },
          { id: "movimentacoes-editar-lote", title: "Editar em Lote", icon: "edit", path: "/estoque/movimentacoes/editar-lote" },
        ],
      },
      {
        id: "pedidos",
        title: "Pedidos",
        icon: "clipboardList",
        path: "/estoque/pedidos",
        children: [
          {
            id: "pedidos-agendamentos",
            title: "Agendamentos",
            icon: "schedule",
            path: "/estoque/pedidos/agendamentos",
            children: [
              { id: "agendamentos-cadastrar", title: "Cadastrar", icon: "plus", path: "/estoque/pedidos/agendamentos/cadastrar", requiredPrivilege: SECTOR_PRIVILEGES.ADMIN },
              { id: "agendamentos-detalhes", title: "Detalhes", icon: "eye", path: "/estoque/pedidos/agendamentos/detalhes/:id", isDynamic: true },
              { id: "agendamentos-editar", title: "Editar", icon: "edit", path: "/estoque/pedidos/agendamentos/editar/:id", isDynamic: true, requiredPrivilege: SECTOR_PRIVILEGES.ADMIN },
            ],
          },
          { id: "pedidos-automaticos", title: "Automáticos", icon: "automation", path: "/estoque/pedidos/automaticos" },
          { id: "pedidos-cadastrar", title: "Cadastrar", icon: "plus", path: "/estoque/pedidos/cadastrar", requiredPrivilege: SECTOR_PRIVILEGES.ADMIN },
          { id: "pedidos-detalhes", title: "Detalhes", icon: "eye", path: "/estoque/pedidos/detalhes/:id", isDynamic: true },
          { id: "pedidos-editar", title: "Editar", icon: "edit", path: "/estoque/pedidos/editar/:id", isDynamic: true, requiredPrivilege: SECTOR_PRIVILEGES.ADMIN },
        ],
      },
      {
        id: "produtos",
        title: "Produtos",
        icon: "package",
        path: "/estoque/produtos",
        children: [
          { id: "produtos-cadastrar", title: "Cadastrar", icon: "plus", path: "/estoque/produtos/cadastrar" },
          {
            id: "produtos-categorias",
            title: "Categorias",
            icon: "tags",
            path: "/estoque/produtos/categorias",
            children: [
              { id: "categorias-cadastrar", title: "Cadastrar", icon: "plus", path: "/estoque/produtos/categorias/cadastrar" },
              { id: "categorias-detalhes", title: "Detalhes", icon: "eye", path: "/estoque/produtos/categorias/detalhes/:id", isDynamic: true },
              { id: "categorias-editar", title: "Editar", icon: "edit", path: "/estoque/produtos/categorias/editar/:id", isDynamic: true },
              { id: "categorias-editar-em-lote", title: "Editar em Lote", icon: "edit", path: "/estoque/produtos/categorias/editar-em-lote" },
            ],
          },
          { id: "produtos-detalhes", title: "Detalhes", icon: "eye", path: "/estoque/produtos/detalhes/:id", isDynamic: true },
          { id: "produtos-editar", title: "Editar", icon: "edit", path: "/estoque/produtos/editar/:id", isDynamic: true },
          { id: "produtos-editar-em-lote", title: "Editar em Lote", icon: "edit", path: "/estoque/produtos/editar-em-lote" },
          {
            id: "produtos-marcas",
            title: "Marcas",
            icon: "brand",
            path: "/estoque/produtos/marcas",
            children: [
              { id: "marcas-cadastrar", title: "Cadastrar", icon: "plus", path: "/estoque/produtos/marcas/cadastrar" },
              { id: "marcas-detalhes", title: "Detalhes", icon: "eye", path: "/estoque/produtos/marcas/detalhes/:id", isDynamic: true },
              { id: "marcas-editar", title: "Editar", icon: "edit", path: "/estoque/produtos/marcas/editar/:id", isDynamic: true },
              { id: "marcas-editar-em-lote", title: "Editar em Lote", icon: "edit", path: "/estoque/produtos/marcas/editar-em-lote" },
            ],
          },
        ],
      },
      {
        id: "operacoes-externas",
        title: "Operações Externas",
        icon: "external",
        path: "/estoque/operacoes-externas",
        requiredPrivilege: SECTOR_PRIVILEGES.ADMIN,
        children: [
          {
            id: "operacoes-externas-cadastrar",
            title: "Cadastrar",
            icon: "plus",
            path: "/estoque/operacoes-externas/cadastrar",
            requiredPrivilege: SECTOR_PRIVILEGES.ADMIN,
          },
          {
            id: "operacoes-externas-detalhes",
            title: "Detalhes",
            icon: "eye",
            path: "/estoque/operacoes-externas/detalhes/:id",
            isDynamic: true,
            requiredPrivilege: SECTOR_PRIVILEGES.ADMIN,
          },
          {
            id: "operacoes-externas-editar",
            title: "Editar",
            icon: "edit",
            path: "/estoque/operacoes-externas/editar/:id",
            isDynamic: true,
            requiredPrivilege: SECTOR_PRIVILEGES.ADMIN,
          },
        ],
      },
    ],
  },

  // DESIGNER - Direct menu items (flat structure, sorted alphabetically)
  // Provides simplified navigation for designers with only relevant sections
  {
    id: "agenda-designer",
    title: "Agenda",
    icon: "preparation",
    path: "/producao/agenda",
    requiredPrivilege: SECTOR_PRIVILEGES.DESIGNER,
  },
  {
    id: "catalogo-designer",
    title: "Catálogo",
    icon: "palette",
    path: "/pintura/catalogo-basico",
    requiredPrivilege: SECTOR_PRIVILEGES.DESIGNER,
    children: [{ id: "catalogo-detalhes", title: "Detalhes", icon: "eye", path: "/pintura/catalogo/detalhes/:id", isDynamic: true }],
  },
  {
    id: "cronograma-designer",
    title: "Cronograma",
    icon: "calendarStats",
    path: "/producao/cronograma",
    requiredPrivilege: SECTOR_PRIVILEGES.DESIGNER,
  },
  {
    id: "calendario-producao-designer",
    title: "Calendário",
    icon: "calendarStats",
    path: "/producao/calendario",
    requiredPrivilege: SECTOR_PRIVILEGES.DESIGNER,
  },
  {
    id: "feriados-designer",
    title: "Feriados",
    icon: "holiday",
    path: "/pessoal/feriados",
    requiredPrivilege: SECTOR_PRIVILEGES.DESIGNER,
  },
  {
    id: "historico-designer",
    title: "Histórico",
    icon: "history",
    path: "/producao/historico",
    requiredPrivilege: SECTOR_PRIVILEGES.DESIGNER,
  },
  {
    id: "meus-pontos-designer",
    title: "Meus Pontos",
    icon: "fingerprint",
    path: "/pessoal/meus-pontos",
    requiredPrivilege: SECTOR_PRIVILEGES.DESIGNER,
  },
  {
    id: "minhas-mensagens-designer",
    title: "Minhas Mensagens",
    icon: "message",
    path: "/pessoal/mensagens",
    requiredPrivilege: SECTOR_PRIVILEGES.DESIGNER,
  },

  // FINANCEIRO - Direct menu items (flat structure, sorted alphabetically)
  {
    id: "aerografia-financeiro",
    title: "Aerografia",
    icon: "paintBrush",
    path: "/producao/aerografia",
    requiredPrivilege: SECTOR_PRIVILEGES.FINANCIAL,
  },
  {
    id: "clientes-financeiro",
    title: "Clientes",
    icon: "users",
    path: "/financeiro/clientes",
    requiredPrivilege: SECTOR_PRIVILEGES.FINANCIAL,
  },
  {
    id: "faturamento-financeiro",
    title: "Faturamento",
    icon: "fileInvoice",
    path: "/financeiro/faturamento",
    requiredPrivilege: SECTOR_PRIVILEGES.FINANCIAL,
  },
  {
    id: "historico-financeiro",
    title: "Histórico",
    icon: "history",
    path: "/producao/historico",
    requiredPrivilege: SECTOR_PRIVILEGES.FINANCIAL,
  },
  {
    id: "minhas-mensagens-financeiro",
    title: "Minhas Mensagens",
    icon: "message",
    path: "/pessoal/mensagens",
    requiredPrivilege: SECTOR_PRIVILEGES.FINANCIAL,
  },
  {
    id: "notas-fiscais-financeiro",
    title: "Notas Fiscais",
    icon: "receipt",
    path: "/financeiro/notas-fiscais",
    requiredPrivilege: SECTOR_PRIVILEGES.FINANCIAL,
  },
  {
    id: "orcamento-financeiro",
    title: "Orçamentos",
    icon: "fileDescription",
    path: "/financeiro/orcamento",
    requiredPrivilege: SECTOR_PRIVILEGES.FINANCIAL,
  },

  // LOGISTIC - Direct menu items (flat structure, sorted alphabetically)
  // Provides simplified navigation for logistic users with only relevant sections
  {
    id: "agenda-logistic",
    title: "Agenda",
    icon: "preparation",
    path: "/producao/agenda",
    requiredPrivilege: SECTOR_PRIVILEGES.LOGISTIC,
  },
  {
    id: "barracoes-logistic",
    title: "Barracões",
    icon: "warehouse",
    path: "/producao/barracoes",
    requiredPrivilege: SECTOR_PRIVILEGES.LOGISTIC,
  },
  {
    id: "catalogo-logistic",
    title: "Catálogo",
    icon: "palette",
    path: "/pintura/catalogo-basico",
    requiredPrivilege: SECTOR_PRIVILEGES.LOGISTIC,
    children: [{ id: "catalogo-detalhes", title: "Detalhes", icon: "eye", path: "/pintura/catalogo/detalhes/:id", isDynamic: true }],
  },
  {
    id: "clientes-logistic",
    title: "Clientes",
    icon: "users",
    path: "/financeiro/clientes",
    requiredPrivilege: SECTOR_PRIVILEGES.LOGISTIC,
  },
  {
    id: "cronograma-logistic",
    title: "Cronograma",
    icon: "calendarStats",
    path: "/producao/cronograma",
    requiredPrivilege: SECTOR_PRIVILEGES.LOGISTIC,
  },
  {
    id: "calendario-producao-logistic",
    title: "Calendário",
    icon: "calendarStats",
    path: "/producao/calendario",
    requiredPrivilege: SECTOR_PRIVILEGES.LOGISTIC,
  },
  {
    id: "historico-logistic",
    title: "Histórico",
    icon: "history",
    path: "/producao/historico",
    requiredPrivilege: SECTOR_PRIVILEGES.LOGISTIC,
  },
  {
    id: "pessoal-logistic",
    title: "Pessoal",
    icon: "users",
    path: "/pessoal/advertencias",
    requiredPrivilege: SECTOR_PRIVILEGES.LOGISTIC,
    children: [
      { id: "pessoal-logistic-advertencias", title: "Advertências", icon: "alertTriangle", path: "/pessoal/advertencias" },
      { id: "pessoal-logistic-calculos", title: "Meus Pontos", icon: "deviceIpadDollar", path: "/pessoal/meus-pontos" },
      { id: "pessoal-logistic-feriados", title: "Feriados", icon: "holiday", path: "/pessoal/feriados" },
      { id: "pessoal-logistic-mensagens", title: "Minhas Mensagens", icon: "message", path: "/pessoal/mensagens" },
    ],
  },

  // PRODUCTION_MANAGER - Grouped navigation
  // Two primary domains (Produção, Colaboradores) followed by leaf items.
  // Other items remain at root: Catálogo, Clientes, Ferramentas, Gerenciador de Arquivos, Mensagens, Minhas Mensagens.
  {
    id: "producao-production-manager",
    title: "Produção",
    icon: "factory",
    // Parent points to Agenda (not /producao) — the /producao root page redirects
    // non-admin/financial users to schedule, causing an Acesso Negado flash.
    path: "/producao/agenda",
    requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
    children: [
      { id: "agenda-production-manager", title: "Agenda", icon: "preparation", path: "/producao/agenda" },
      { id: "barracoes-production-manager", title: "Barracões", icon: "warehouse", path: "/producao/barracoes" },
      { id: "calendario-producao-production-manager", title: "Calendário", icon: "calendarStats", path: "/producao/calendario" },
      { id: "cronograma-production-manager", title: "Cronograma", icon: "calendarStats", path: "/producao/cronograma" },
      { id: "historico-production-manager", title: "Histórico", icon: "history", path: "/producao/historico" },
    ],
  },
  {
    id: "colaboradores-group-production-manager",
    title: "Departamento Pessoal",
    icon: "users",
    path: "/departamento-pessoal/colaboradores",
    requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
    children: [
      {
        id: "avaliacao-competencias-production-manager",
        title: "Aval. de Competências",
        icon: "clipboardList",
        path: "/administracao/avaliacao-competencias",
        children: [
          {
            id: "avaliacao-competencias-campanhas-pm",
            title: "Campanhas",
            icon: "clipboardList",
            path: "/administracao/avaliacao-competencias",
          },
          {
            id: "avaliacao-competencias-skills-pm",
            title: "Competências",
            icon: "clipboardList",
            path: "/administracao/competencias",
          },
          {
            id: "avaliacao-competencias-topics-pm",
            title: "Tópicos",
            icon: "clipboardList",
            path: "/administracao/topicos",
          },
        ],
      },
      {
        id: "colaboradores-production-manager",
        title: "Colaboradores",
        icon: "user",
        path: "/departamento-pessoal/colaboradores",
      },
      {
        // Production manager gets the view-only tabs (Colaborador, Dia, Ausências).
        // Edição and Fechamento are intentionally omitted — they remain HR/ADMIN only.
        id: "controle-de-ponto-production-manager",
        title: "Controle de Ponto",
        icon: "fingerprint",
        path: "/departamento-pessoal/controle-ponto",
        requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
        children: [
          {
            id: "controle-ponto-colaborador-production-manager",
            title: "Espelho de Ponto",
            icon: "user",
            path: "/departamento-pessoal/controle-ponto/colaborador",
            requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
          },
          {
            id: "controle-ponto-dia-production-manager",
            title: "Resumo do Dia",
            icon: "calendar",
            path: "/departamento-pessoal/controle-ponto/dia",
            requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
          },
          {
            id: "controle-ponto-ausencias-production-manager",
            title: "Ausências",
            icon: "list",
            path: "/departamento-pessoal/controle-ponto/ausencias",
            requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
          },
        ],
      },
      {
        // Production Manager also manages the lifecycle of its team: admissions,
        // terminations and vacations. These reuse the Departamento Pessoal pages
        // (route + page guards grant PRODUCTION_MANAGER access). Delete stays ADMIN-only.
        id: "dp-admissoes-production-manager",
        title: "Admissões",
        icon: "userCheck",
        path: "/departamento-pessoal/admissoes",
        requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
        children: [
          { id: "dp-admissoes-cadastrar-pm", title: "Cadastrar", icon: "plus", path: "/departamento-pessoal/admissoes/cadastrar", requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER },
          { id: "dp-admissoes-detalhes-pm", title: "Detalhes", icon: "eye", path: "/departamento-pessoal/admissoes/detalhes/:id", isDynamic: true, requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER },
          { id: "dp-admissoes-editar-pm", title: "Editar", icon: "edit", path: "/departamento-pessoal/admissoes/editar/:id", isDynamic: true, requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER },
        ],
      },
      {
        id: "dp-rescisoes-production-manager",
        title: "Rescisões",
        icon: "logOut",
        path: "/departamento-pessoal/rescisoes",
        requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
        children: [
          { id: "dp-rescisoes-cadastrar-pm", title: "Cadastrar", icon: "plus", path: "/departamento-pessoal/rescisoes/cadastrar", requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER },
          { id: "dp-rescisoes-detalhes-pm", title: "Detalhes", icon: "eye", path: "/departamento-pessoal/rescisoes/detalhes/:id", isDynamic: true, requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER },
          { id: "dp-rescisoes-editar-pm", title: "Editar", icon: "edit", path: "/departamento-pessoal/rescisoes/editar/:id", isDynamic: true, requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER },
        ],
      },
      {
        id: "dp-ferias-production-manager",
        title: "Férias",
        icon: "vacation",
        path: "/departamento-pessoal/ferias",
        requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
        children: [
          { id: "dp-ferias-cadastrar-pm", title: "Cadastrar", icon: "plus", path: "/departamento-pessoal/ferias/cadastrar", requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER },
          { id: "dp-ferias-detalhes-pm", title: "Detalhes", icon: "eye", path: "/departamento-pessoal/ferias/detalhes/:id", isDynamic: true, requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER },
          { id: "dp-ferias-editar-pm", title: "Editar", icon: "edit", path: "/departamento-pessoal/ferias/editar/:id", isDynamic: true, requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER },
        ],
      },
      {
        id: "dp-advertencias-production-manager",
        title: "Advertências",
        icon: "alertTriangle",
        path: "/departamento-pessoal/avisos",
        requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
        children: [
          { id: "dp-advertencias-cadastrar-pm", title: "Cadastrar", icon: "plus", path: "/departamento-pessoal/avisos/cadastrar", requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER },
          { id: "dp-advertencias-detalhes-pm", title: "Detalhes", icon: "eye", path: "/departamento-pessoal/avisos/detalhes/:id", isDynamic: true, requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER },
          { id: "dp-advertencias-editar-pm", title: "Editar", icon: "edit", path: "/departamento-pessoal/avisos/editar/:id", isDynamic: true, requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER },
        ],
      },
    ],
  },
  {
    id: "estatisticas-production-manager",
    title: "Estatísticas",
    icon: "barChart",
    path: "/estatisticas/departamento-pessoal/equipe",
    requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
    children: [
      {
        id: "stats-equipe-production-manager",
        title: "Equipe",
        icon: "users",
        path: "/estatisticas/departamento-pessoal/equipe",
      },
      {
        id: "stats-performance-production-manager",
        title: "Performance",
        icon: "activity",
        path: "/estatisticas/producao/desempenho",
      },
      {
        id: "stats-competencias-production-manager",
        title: "Competências",
        icon: "clipboardList",
        path: "/estatisticas/departamento-pessoal/competencias",
      },
    ],
  },
  {
    id: "catalogo-production-manager",
    title: "Catálogo",
    icon: "palette",
    path: "/pintura/catalogo-basico",
    requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
    children: [{ id: "catalogo-detalhes-pm", title: "Detalhes", icon: "eye", path: "/pintura/catalogo/detalhes/:id", isDynamic: true }],
  },
  {
    id: "clientes-production-manager",
    title: "Clientes",
    icon: "users",
    path: "/financeiro/clientes",
    requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
  },
  {
    id: "ferramentas-production-manager",
    title: "Ferramentas",
    icon: "tools",
    path: "/ferramentas",
    requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
    children: [
      // QR Code, Paleta de Cores and Certificado de Resíduos are intentionally
      // omitted for PRODUCTION_MANAGER (not part of its toolset).
      { id: "ferramentas-calculadora-de-horas-pm", title: "Calculadora de Horas", icon: "clock", path: "/ferramentas/calculadora-de-horas" },
      { id: "ferramentas-custo-horas-extras-pm", title: "Custo de Horas Extras", icon: "calendarDollar", path: "/ferramentas/custo-horas-extras" },
      { id: "ferramentas-calculadora-de-mistura-pm", title: "Calculadora de Mistura", icon: "flask", path: "/ferramentas/calculadora-de-mistura" },
      { id: "ferramentas-calendario-pm", title: "Calendário", icon: "calendarStats", path: "/departamento-pessoal/calendario" },
      { id: "ferramentas-post-its-pm", title: "Post-its", icon: "note", path: "/ferramentas/post-its" },
    ],
  },
  {
    id: "gerenciador-de-arquivos-production-manager",
    title: "Gerenciador de Arquivos",
    icon: "fileManager",
    path: "/servidor/gerenciador-de-arquivos",
    requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
  },
  {
    id: "mensagens-production-manager",
    title: "Mensagens",
    icon: "message",
    path: "/administracao/mensagens",
    requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
    children: [
      { id: "mensagens-criar-pm", title: "Criar", icon: "plus", path: "/administracao/mensagens/criar" },
      { id: "mensagens-detalhes-pm", title: "Detalhes", icon: "eye", path: "/administracao/mensagens/:id", isDynamic: true },
      { id: "mensagens-editar-pm", title: "Editar", icon: "edit", path: "/administracao/mensagens/:id/editar", isDynamic: true },
    ],
  },
  {
    id: "minhas-mensagens-production-manager",
    title: "Minhas Mensagens",
    icon: "message",
    path: "/pessoal/mensagens",
    requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
  },

  // COMMERCIAL - Direct menu items (flat structure, sorted alphabetically)
  // Provides simplified navigation for commercial users with relevant sections
  {
    id: "aerografia-commercial",
    title: "Aerografia",
    icon: "paintBrush",
    path: "/producao/aerografia",
    requiredPrivilege: SECTOR_PRIVILEGES.COMMERCIAL,
  },
  {
    id: "agenda-commercial",
    title: "Agenda",
    icon: "preparation",
    path: "/producao/agenda",
    requiredPrivilege: SECTOR_PRIVILEGES.COMMERCIAL,
  },
  {
    id: "barracoes-commercial",
    title: "Barracões",
    icon: "warehouse",
    path: "/producao/barracoes",
    requiredPrivilege: SECTOR_PRIVILEGES.COMMERCIAL,
  },
  {
    id: "catalogo-commercial",
    title: "Catálogo",
    icon: "palette",
    path: "/pintura/catalogo-basico",
    requiredPrivilege: SECTOR_PRIVILEGES.COMMERCIAL,
    children: [{ id: "catalogo-detalhes", title: "Detalhes", icon: "eye", path: "/pintura/catalogo/detalhes/:id", isDynamic: true }],
  },
  {
    id: "cronograma-commercial",
    title: "Cronograma",
    icon: "calendarStats",
    path: "/producao/cronograma",
    requiredPrivilege: SECTOR_PRIVILEGES.COMMERCIAL,
  },
  {
    id: "calendario-producao-commercial",
    title: "Calendário",
    icon: "calendarStats",
    path: "/producao/calendario",
    requiredPrivilege: SECTOR_PRIVILEGES.COMMERCIAL,
  },
  {
    id: "gerenciador-de-arquivos",
    title: "Gerenciador de Arquivos",
    icon: "fileManager",
    path: "/servidor/gerenciador-de-arquivos",
    requiredPrivilege: SECTOR_PRIVILEGES.COMMERCIAL,
  },
  {
    id: "historico-commercial",
    title: "Histórico",
    icon: "history",
    path: "/producao/historico",
    requiredPrivilege: SECTOR_PRIVILEGES.COMMERCIAL,
  },
  {
    id: "minhas-mensagens-commercial",
    title: "Minhas Mensagens",
    icon: "message",
    path: "/pessoal/mensagens",
    requiredPrivilege: SECTOR_PRIVILEGES.COMMERCIAL,
  },
  {
    id: "observacoes-commercial",
    title: "Observações",
    icon: "note",
    path: "/producao/observacoes",
    requiredPrivilege: SECTOR_PRIVILEGES.COMMERCIAL,
  },

  // PLOTTING - Direct menu items (flat structure, sorted alphabetically)
  // Provides simplified navigation for plotting users with relevant sections
  {
    id: "cronograma-plotting",
    title: "Cronograma",
    icon: "calendarStats",
    path: "/producao/cronograma",
    requiredPrivilege: SECTOR_PRIVILEGES.PLOTTING,
  },
  {
    id: "calendario-producao-plotting",
    title: "Calendário",
    icon: "calendarStats",
    path: "/producao/calendario",
    requiredPrivilege: SECTOR_PRIVILEGES.PLOTTING,
  },
  {
    id: "feriados-plotting",
    title: "Feriados",
    icon: "holiday",
    path: "/pessoal/feriados",
    requiredPrivilege: SECTOR_PRIVILEGES.PLOTTING,
  },
  {
    id: "historico-plotting",
    title: "Histórico",
    icon: "history",
    path: "/producao/historico",
    requiredPrivilege: SECTOR_PRIVILEGES.PLOTTING,
  },
  {
    id: "meus-pontos-plotting",
    title: "Meus Pontos",
    icon: "fingerprint",
    path: "/pessoal/meus-pontos",
    requiredPrivilege: SECTOR_PRIVILEGES.PLOTTING,
  },
  {
    id: "minhas-mensagens-plotting",
    title: "Minhas Mensagens",
    icon: "message",
    path: "/pessoal/mensagens",
    requiredPrivilege: SECTOR_PRIVILEGES.PLOTTING,
  },
  {
    id: "recorte-plotting",
    title: "Recorte",
    icon: "scissors",
    path: "/producao/recorte",
    requiredPrivilege: SECTOR_PRIVILEGES.PLOTTING,
  },

  // MANUTENÇÃO
  {
    id: "manutencao",
    title: "Manutenção",
    icon: "maintenance",
    path: "/manutencao",
    requiredPrivilege: [SECTOR_PRIVILEGES.MAINTENANCE],
    children: [
      { id: "manutencao-cadastrar", title: "Cadastrar", icon: "plus", path: "/manutencao/cadastrar" },
      { id: "manutencao-detalhes", title: "Detalhes", icon: "eye", path: "/manutencao/detalhes/:id", isDynamic: true },
      { id: "manutencao-editar", title: "Editar", icon: "edit", path: "/manutencao/editar/:id", isDynamic: true },
    ],
  },
  {
    id: "minhas-mensagens-maintenance",
    title: "Minhas Mensagens",
    icon: "message",
    path: "/pessoal/mensagens",
    requiredPrivilege: SECTOR_PRIVILEGES.MAINTENANCE,
  },

  // CATÁLOGO - View-only for Team Leaders (Designers now have direct flattened menu)
  // Positioned here to maintain alphabetical order with other TEAM_LEADER items (Catálogo < Minha Equipe)
  {
    id: "catalogo",
    title: "Catálogo",
    icon: "palette",
    path: "/pintura/catalogo-basico",
    requiredPrivilege: [TEAM_LEADER],
    children: [{ id: "catalogo-detalhes", title: "Detalhes", icon: "eye", path: "/pintura/catalogo/detalhes/:id", isDynamic: true }],
  },

  // MINHA EQUIPE - Team leaders only (checked via ledSector relation, not privilege)
  // This menu item is only visible to users who are sector leaders (have ledSector relation)
  {
    id: "minha-equipe",
    title: "Minha Equipe",
    icon: "team",
    path: "/meu-pessoal",
    requiredPrivilege: [TEAM_LEADER], // Only visible to sector leaders
    children: [
      { id: "membros-equipe", title: "Membros", icon: "users", path: "/meu-pessoal/usuarios" },
      { id: "emprestimos-equipe", title: "Empréstimos", icon: "loan", path: "/meu-pessoal/emprestimos" },
      { id: "advertencias-equipe", title: "Advertências", icon: "alertTriangle", path: "/meu-pessoal/advertencias" },
      { id: "epis-equipe", title: "Entregas de EPI", icon: "helmet", path: "/meu-pessoal/epis" },
      { id: "movimentacoes-equipe", title: "Movimentações", icon: "activity", path: "/meu-pessoal/movimentacoes" },
      { id: "calculos-equipe", title: "Controle de Ponto", icon: "fingerprint", path: "/meu-pessoal/calculos" },
      { id: "avaliacao-competencias-lider", title: "Aval. de Competências", icon: "clipboardList", path: "/meu-pessoal/avaliacoes-competencias" },
    ],
  },

  // PESSOAL - Only for production workers (PRODUCTION, WAREHOUSE)
  // Note: DESIGNER now has flattened navigation with direct menu items
  {
    id: "pessoal",
    title: "Pessoal",
    icon: "userCircle",
    path: "/pessoal",
    requiredPrivilege: [SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE],
    children: [
      { id: "meus-feriados", title: "Feriados", icon: "holiday", path: "/pessoal/feriados" },
      // Questionários - self-fill, visible to ALL users (no requiredPrivilege)
      { id: "meus-questionarios", title: "Questionários", icon: "clipboardList", path: "/pessoal/questionarios" },
      {
        id: "meus-emprestimos",
        title: "Meus Empréstimos",
        icon: "loan",
        path: "/pessoal/meus-emprestimos",
        requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION,
        children: [{ id: "meus-emprestimos-detalhes", title: "Detalhes", icon: "eye", path: "/pessoal/meus-emprestimos/detalhes/:id", isDynamic: true }],
      },
      {
        id: "meus-epis",
        title: "Meus EPIs",
        icon: "helmet",
        path: "/pessoal/meus-epis",
        requiredPrivilege: [SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE],
        children: [
          { id: "meus-epis-detalhes", title: "Detalhes", icon: "eye", path: "/pessoal/meus-epis/detalhes/:id", isDynamic: true },
          { id: "meus-epis-solicitar", title: "Solicitar EPI", icon: "plus", path: "/pessoal/meus-epis/solicitar" },
        ],
      },
      { id: "meus-pontos", title: "Meus Pontos", icon: "fingerprint", path: "/pessoal/meus-pontos", requiredPrivilege: [SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE] },
      {
        id: "minhas-advertencias",
        title: "Minhas Advertências",
        icon: "alertTriangle",
        path: "/pessoal/minhas-advertencias",
        requiredPrivilege: [SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE],
        children: [{ id: "minhas-advertencias-detalhes", title: "Detalhes", icon: "eye", path: "/pessoal/minhas-advertencias/detalhes/:id", isDynamic: true }],
      },
      { id: "minhas-mensagens", title: "Minhas Mensagens", icon: "message", path: "/pessoal/mensagens" },
      // Post-its for PRODUCTION lives here inside "Pessoal" (not floating at the root via
      // post-its-flat). WAREHOUSE already gets Post-its through the Ferramentas section, so
      // gate this to PRODUCTION only to avoid a duplicate entry for warehouse users.
      { id: "meus-post-its", title: "Post-its", icon: "note", path: "/ferramentas/post-its", requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION },
      {
        id: "minhas-movimentacoes",
        title: "Minhas Movimentações",
        icon: "movement",
        path: "/pessoal/minhas-movimentacoes",
        requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION,
        children: [{ id: "minhas-movimentacoes-detalhes", title: "Detalhes", icon: "eye", path: "/pessoal/minhas-movimentacoes/detalhes/:id", isDynamic: true }],
      },
    ],
  },

  // PINTURA
  {
    id: "pintura",
    title: "Pintura",
    icon: "paint",
    path: "/pintura",
    requiredPrivilege: [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN],
    children: [
      {
        id: "catalogo",
        title: "Catálogo",
        icon: "palette",
        path: "/pintura/catalogo",
        requiredPrivilege: [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN],
        children: [
          { id: "catalogo-cadastrar", title: "Cadastrar", icon: "plus", path: "/pintura/catalogo/cadastrar", requiredPrivilege: [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN] },
          {
            id: "catalogo-detalhes",
            title: "Detalhes",
            icon: "eye",
            path: "/pintura/catalogo/detalhes/:id",
            isDynamic: true,
            children: [
              { id: "catalogo-formula-detalhes", title: "Detalhes da Fórmula", icon: "eye", path: "/pintura/catalogo/detalhes/:paintId/formulas/detalhes/:formulaId", isDynamic: true, requiredPrivilege: [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN] },
              { id: "catalogo-formulas", title: "Fórmulas", icon: "beaker", path: "/pintura/catalogo/detalhes/:paintId/formulas", isDynamic: true, requiredPrivilege: [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN] },
            ],
          },
          { id: "catalogo-editar", title: "Editar", icon: "edit", path: "/pintura/catalogo/editar/:id", isDynamic: true, requiredPrivilege: [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN] },
        ],
      },
      {
        id: "marcas-de-tinta",
        title: "Marcas de Tinta",
        icon: "brand",
        path: "/pintura/marcas-de-tinta",
        requiredPrivilege: [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN],
        children: [
          { id: "marcas-tinta-cadastrar", title: "Cadastrar", icon: "plus", path: "/pintura/marcas-de-tinta/cadastrar" },
          { id: "marcas-tinta-editar", title: "Editar", icon: "edit", path: "/pintura/marcas-de-tinta/editar/:id", isDynamic: true },
        ],
      },
      {
        id: "producoes-pintura",
        title: "Produções",
        icon: "colorPicker",
        path: "/pintura/producoes",
        requiredPrivilege: [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN],
        children: [{ id: "producoes-detalhes", title: "Detalhes", icon: "eye", path: "/pintura/producoes/detalhes/:id", isDynamic: true }],
      },
      {
        id: "tipos-de-tinta",
        title: "Tipos de Tinta",
        icon: "tags",
        path: "/pintura/tipos-de-tinta",
        requiredPrivilege: [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN],
        children: [
          { id: "tipos-tinta-cadastrar", title: "Cadastrar", icon: "plus", path: "/pintura/tipos-de-tinta/cadastrar" },
          { id: "tipos-tinta-editar", title: "Editar", icon: "edit", path: "/pintura/tipos-de-tinta/editar/:id", isDynamic: true },
        ],
      },
    ],
  },

  // PRODUÇÃO
  // Note: DESIGNER and LOGISTIC now have flattened navigation with direct menu items
  {
    id: "producao",
    title: "Produção",
    icon: "factory",
    path: "/producao",
    requiredPrivilege: [SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN],
    children: [
      {
        id: "aerografia",
        title: "Aerografia",
        icon: "paintBrush",
        path: "/producao/aerografia",
        requiredPrivilege: SECTOR_PRIVILEGES.ADMIN,
        children: [
          { id: "aerografia-cadastrar", title: "Cadastrar", icon: "plus", path: "/producao/aerografia/cadastrar", requiredPrivilege: SECTOR_PRIVILEGES.ADMIN },
          { id: "aerografia-detalhes", title: "Detalhes", icon: "eye", path: "/producao/aerografia/detalhes/:id", isDynamic: true },
          { id: "aerografia-editar", title: "Editar", icon: "edit", path: "/producao/aerografia/editar/:id", isDynamic: true, requiredPrivilege: SECTOR_PRIVILEGES.ADMIN },
        ],
      },
      {
        id: "agenda",
        title: "Agenda",
        icon: "preparation",
        path: "/producao/agenda",
        requiredPrivilege: SECTOR_PRIVILEGES.ADMIN,
        children: [
          { id: "agenda-cadastrar", title: "Cadastrar", icon: "plus", path: "/producao/agenda/cadastrar", requiredPrivilege: SECTOR_PRIVILEGES.ADMIN },
          { id: "agenda-detalhes", title: "Detalhes", icon: "eye", path: "/producao/agenda/detalhes/:id", isDynamic: true },
          { id: "agenda-editar", title: "Editar", icon: "edit", path: "/producao/agenda/editar/:id", isDynamic: true, requiredPrivilege: SECTOR_PRIVILEGES.ADMIN },
        ],
      },
      { id: "barracoes", title: "Barracões", icon: "warehouse", path: "/producao/barracoes", requiredPrivilege: [SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN] }, // LOGISTIC has direct access via flat menu
      {
        id: "cronograma",
        title: "Cronograma",
        icon: "calendarStats",
        path: "/producao/cronograma",
        children: [
          { id: "cronograma-detalhes", title: "Detalhes", icon: "eye", path: "/producao/cronograma/detalhes/:id", isDynamic: true },
          { id: "cronograma-editar", title: "Editar", icon: "edit", path: "/producao/cronograma/editar/:id", isDynamic: true, requiredPrivilege: [SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN] },
          // { id: "cronograma-cadastrar", title: "Nova Tarefa", icon: "plus", path: "/producao/cronograma/cadastrar", requiredPrivilege: SECTOR_PRIVILEGES.ADMIN }, // Removed - tasks are now created in the "in preparation" page
        ],
      },
      { id: "calendario-producao", title: "Calendário", icon: "calendarStats", path: "/producao/calendario" },
      { id: "historico", title: "Histórico", icon: "history", path: "/producao/historico", requiredPrivilege: [SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN] },
      {
        id: "observacoes",
        title: "Observações",
        icon: "note",
        path: "/producao/observacoes",
        requiredPrivilege: [SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN],
        children: [
          { id: "observacoes-cadastrar", title: "Cadastrar", icon: "plus", path: "/producao/observacoes/cadastrar", requiredPrivilege: SECTOR_PRIVILEGES.ADMIN },
          { id: "observacoes-detalhes", title: "Detalhes", icon: "eye", path: "/producao/observacoes/detalhes/:id", isDynamic: true },
          { id: "observacoes-editar", title: "Editar", icon: "edit", path: "/producao/observacoes/editar/:id", isDynamic: true, requiredPrivilege: SECTOR_PRIVILEGES.ADMIN },
        ],
      },
      { id: "recorte", title: "Recorte", icon: "scissors", path: "/producao/recorte", requiredPrivilege: [SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.PLOTTING, SECTOR_PRIVILEGES.ADMIN] },
    ],
  },

  // DEPARTAMENTO PESSOAL (Contabilidade / RH / Admin)
  // Section path points to the first real page (no /departamento-pessoal root page exists),
  // same precedent as the PRODUCTION_MANAGER grouped sections.
  {
    id: "departamento-pessoal",
    title: "Departamento Pessoal",
    icon: "team",
    path: "/departamento-pessoal/colaboradores",
    // Single consolidated personnel area. The legacy "Departamento Pessoal" section was
    // retired and merged here, so this is now the one home shared by HR, ACCOUNTING
    // and ADMIN. (Production Manager reaches a curated subset via its own grouped menu.)
    requiredPrivilege: [SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.ADMIN],
    children: [
      {
        id: "dp-colaboradores",
        title: "Colaboradores",
        icon: "user",
        path: "/departamento-pessoal/colaboradores",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
        children: [
          { id: "dp-colaboradores-cadastrar", title: "Cadastrar", icon: "plus", path: "/departamento-pessoal/colaboradores/cadastrar", requiredPrivilege: SECTOR_PRIVILEGES.ADMIN },
          { id: "dp-colaboradores-detalhes", title: "Detalhes", icon: "eye", path: "/departamento-pessoal/colaboradores/detalhes/:id", isDynamic: true },
          { id: "dp-colaboradores-editar", title: "Editar", icon: "edit", path: "/departamento-pessoal/colaboradores/editar/:id", isDynamic: true },
        ],
      },
      {
        id: "dp-advertencias",
        title: "Advertências",
        icon: "alertTriangle",
        path: "/departamento-pessoal/avisos",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.PRODUCTION_MANAGER],
        children: [
          { id: "dp-advertencias-cadastrar", title: "Cadastrar", icon: "plus", path: "/departamento-pessoal/avisos/cadastrar" },
          { id: "dp-advertencias-detalhes", title: "Detalhes", icon: "eye", path: "/departamento-pessoal/avisos/detalhes/:id", isDynamic: true },
          { id: "dp-advertencias-editar", title: "Editar", icon: "edit", path: "/departamento-pessoal/avisos/editar/:id", isDynamic: true },
        ],
      },
      {
        // ACCOUNTING (Área Andressa) gets the FULL Controle de Ponto toolset here:
        // the view tabs (Colaborador, Dia, Ausências) plus Edição and Fechamento,
        // since folha closing/conferência is part of the accounting workflow.
        id: "dp-controle-ponto",
        title: "Controle de Ponto",
        icon: "fingerprint",
        path: "/departamento-pessoal/controle-ponto",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
        children: [
          { id: "dp-controle-ponto-colaborador", title: "Espelho de Ponto", icon: "user", path: "/departamento-pessoal/controle-ponto/colaborador" },
          { id: "dp-controle-ponto-dia", title: "Resumo do Dia", icon: "calendar", path: "/departamento-pessoal/controle-ponto/dia" },
          { id: "dp-controle-ponto-edicao", title: "Edição", icon: "edit", path: "/departamento-pessoal/controle-ponto/edicao", requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN] },
          { id: "dp-controle-ponto-ausencias", title: "Ausências", icon: "list", path: "/departamento-pessoal/controle-ponto/ausencias", requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN] },
          { id: "dp-controle-ponto-fechamento", title: "Fechamento", icon: "signature", path: "/departamento-pessoal/controle-ponto/fechamento", requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN] },
          { id: "dp-controle-ponto-requisicoes", title: "Requisições", icon: "clipboardList", path: "/departamento-pessoal/controle-ponto/requisicoes", requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN] },
        ],
      },
      {
        id: "dp-ferias",
        title: "Férias",
        icon: "vacation",
        path: "/departamento-pessoal/ferias",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
        children: [
          { id: "dp-ferias-cadastrar", title: "Cadastrar", icon: "plus", path: "/departamento-pessoal/ferias/cadastrar" },
          { id: "dp-ferias-detalhes", title: "Detalhes", icon: "eye", path: "/departamento-pessoal/ferias/detalhes/:id", isDynamic: true },
          { id: "dp-ferias-editar", title: "Editar", icon: "edit", path: "/departamento-pessoal/ferias/editar/:id", isDynamic: true },
        ],
      },
      // 13º Salário no longer has a dedicated DP menu/page. It is handled
      // per-collaborator (generate/edit/pay) from the colaborador detail page.
      // The Thirteenth model, engine, and Contas a Pagar forecast are untouched.
      // NOTE: "Calendário" lives under Ferramentas (shared by HR/ACCOUNTING/ADMIN/PM);
      // "Feriados" and "EPI" are DP items below, scoped to HR/ADMIN (ACCOUNTING gets
      // EPI via the Medicina do Trabalho section instead).
      {
        // Secullum mapping/diagnostics — ADMIN-only (it edits the live integration
        // mapping and exposes the smoke-test diagnostics grid).
        id: "dp-integracao-secullum",
        title: "Integração Secullum",
        icon: "users",
        path: "/departamento-pessoal/integracoes/secullum",
        requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN],
      },
      {
        id: "dp-admissoes",
        title: "Admissões",
        icon: "userCheck",
        path: "/departamento-pessoal/admissoes",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
        children: [
          { id: "dp-admissoes-cadastrar", title: "Cadastrar", icon: "plus", path: "/departamento-pessoal/admissoes/cadastrar" },
          { id: "dp-admissoes-detalhes", title: "Detalhes", icon: "eye", path: "/departamento-pessoal/admissoes/detalhes/:id", isDynamic: true },
          { id: "dp-admissoes-editar", title: "Editar", icon: "edit", path: "/departamento-pessoal/admissoes/editar/:id", isDynamic: true },
        ],
      },
      {
        id: "dp-rescisoes",
        title: "Rescisões",
        icon: "logOut",
        path: "/departamento-pessoal/rescisoes",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
        children: [
          { id: "dp-rescisoes-cadastrar", title: "Cadastrar", icon: "plus", path: "/departamento-pessoal/rescisoes/cadastrar" },
          { id: "dp-rescisoes-detalhes", title: "Detalhes", icon: "eye", path: "/departamento-pessoal/rescisoes/detalhes/:id", isDynamic: true },
          { id: "dp-rescisoes-editar", title: "Editar", icon: "edit", path: "/departamento-pessoal/rescisoes/editar/:id", isDynamic: true },
        ],
      },
      {
        id: "dp-emprestimos",
        title: "Empréstimos",
        icon: "payroll",
        path: "/departamento-pessoal/emprestimos",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
      },
      {
        // Feriados — Secullum-synced holiday list. HR/ADMIN only (matches the prior
        // Departamento Pessoal placement; ACCOUNTING was intentionally excluded).
        id: "dp-feriados",
        title: "Feriados",
        icon: "holiday",
        path: "/departamento-pessoal/feriados",
        requiredPrivilege: [SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
        children: [
          { id: "dp-feriados-cadastrar", title: "Cadastrar", icon: "plus", path: "/departamento-pessoal/feriados/cadastrar" },
        ],
      },
      {
        id: "dp-salarios-e-cargos",
        title: "Salários e Cargos",
        icon: "salary",
        path: "/departamento-pessoal/cargos",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
        children: [
          {
            id: "dp-reajustes",
            title: "Reajustes",
            icon: "trendingUp",
            path: "/departamento-pessoal/reajustes",
            requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
            children: [
              { id: "dp-reajustes-detalhes", title: "Detalhes", icon: "eye", path: "/departamento-pessoal/reajustes/detalhes/:id", isDynamic: true },
            ],
          },
          {
            id: "dp-promocoes",
            title: "Promoções",
            icon: "arrowsExchange",
            path: "/departamento-pessoal/promocoes",
            requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
          },
          {
            id: "dp-cargos",
            title: "Cargos",
            icon: "briefcase",
            path: "/departamento-pessoal/cargos",
            requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
            children: [
              { id: "dp-cargos-detalhes", title: "Detalhes", icon: "eye", path: "/departamento-pessoal/cargos/detalhes/:id", isDynamic: true },
              { id: "dp-cargos-editar", title: "Editar", icon: "edit", path: "/departamento-pessoal/cargos/editar/:id", isDynamic: true },
            ],
          },
          {
            id: "dp-horarios",
            title: "Horários",
            icon: "clock",
            path: "/departamento-pessoal/horarios",
            requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
          },
          {
            id: "dp-gratificacoes",
            title: "Gratificações",
            icon: "coins",
            path: "/departamento-pessoal/bonus",
            requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
            children: [
              { id: "dp-gratificacoes-simulacao", title: "Simulação de Bônus", icon: "calculator", path: "/departamento-pessoal/bonus/simulacao-de-bonus" },
              { id: "dp-gratificacoes-nivel-performance", title: "Nível de Performance", icon: "trendingUp", path: "/departamento-pessoal/bonus/nivel-de-performance" },
            ],
          },
          {
            id: "dp-folha-de-pagamento",
            title: "Folha de Pagamento",
            icon: "payroll",
            path: "/departamento-pessoal/folha-de-pagamento",
            requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
          },
        ],
      },
      {
        id: "dp-beneficios",
        title: "Benefícios",
        icon: "coins",
        path: "/departamento-pessoal/beneficios",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
        children: [
          {
            // Catalog of benefit plans — kept titled "Benefícios" (user decision: the group
            // exposes two clearly separated entries, "Benefícios" and "Adesões").
            id: "dp-beneficios-lista",
            title: "Benefícios",
            icon: "coins",
            path: "/departamento-pessoal/beneficios",
            requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
            children: [
              { id: "dp-beneficios-cadastrar", title: "Cadastrar", icon: "plus", path: "/departamento-pessoal/beneficios/cadastrar" },
              { id: "dp-beneficios-detalhes", title: "Detalhes", icon: "eye", path: "/departamento-pessoal/beneficios/detalhes/:id", isDynamic: true },
              { id: "dp-beneficios-editar", title: "Editar", icon: "edit", path: "/departamento-pessoal/beneficios/editar/:id", isDynamic: true },
            ],
          },
          {
            id: "dp-beneficios-adesoes",
            title: "Adesões",
            icon: "userCheck",
            path: "/departamento-pessoal/beneficios/adesoes",
            requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
            children: [
              { id: "dp-beneficios-adesoes-cadastrar", title: "Cadastrar", icon: "plus", path: "/departamento-pessoal/beneficios/adesoes/cadastrar" },
              { id: "dp-beneficios-adesoes-detalhes", title: "Detalhes", icon: "eye", path: "/departamento-pessoal/beneficios/adesoes/detalhes/:id", isDynamic: true },
              { id: "dp-beneficios-adesoes-editar", title: "Editar", icon: "edit", path: "/departamento-pessoal/beneficios/adesoes/editar/:id", isDynamic: true },
            ],
          },
        ],
      },
    ],
  },

  // MEDICINA DO TRABALHO (Contabilidade / RH / Admin)
  // Section path points to the first real page (no /medicina-do-trabalho root page exists).
  {
    id: "medicina-do-trabalho",
    title: "Medicina do Trabalho",
    icon: "safety",
    path: "/medicina-do-trabalho/epi/entregas",
    // ACCOUNTING-only: new accounting-sector section. HR/ADMIN keep their original
    // "Departamento Pessoal" menu and must NOT see this. (Route privileges unchanged.)
    requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING],
    children: [
      {
        id: "mt-epi-entregas",
        title: "Entrega de EPIs",
        icon: "truck",
        path: "/medicina-do-trabalho/epi/entregas",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
        children: [
          // Agendamentos is a CHILD of Entrega de EPIs.
          {
            id: "mt-epi-agendamentos",
            title: "Agendamentos",
            icon: "schedule",
            path: "/medicina-do-trabalho/epi/agendamentos",
            requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
            children: [
              { id: "mt-epi-agendamentos-cadastrar", title: "Cadastrar", icon: "plus", path: "/medicina-do-trabalho/epi/agendamentos/cadastrar" },
              { id: "mt-epi-agendamentos-detalhes", title: "Detalhes", icon: "eye", path: "/medicina-do-trabalho/epi/agendamentos/detalhes/:id", isDynamic: true },
              { id: "mt-epi-agendamentos-editar", title: "Editar", icon: "edit", path: "/medicina-do-trabalho/epi/agendamentos/editar/:id", isDynamic: true },
            ],
          },
          { id: "mt-epi-entregas-cadastrar", title: "Cadastrar", icon: "plus", path: "/medicina-do-trabalho/epi/entregas/cadastrar" },
          { id: "mt-epi-entregas-detalhes", title: "Detalhes", icon: "eye", path: "/medicina-do-trabalho/epi/entregas/detalhes/:id", isDynamic: true },
          { id: "mt-epi-entregas-editar", title: "Editar", icon: "edit", path: "/medicina-do-trabalho/epi/entregas/editar/:id", isDynamic: true },
        ],
      },
      {
        id: "mt-aso",
        title: "ASO",
        icon: "clipboardList",
        path: "/medicina-do-trabalho/aso",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
        children: [
          { id: "mt-aso-cadastrar", title: "Cadastrar", icon: "plus", path: "/medicina-do-trabalho/aso/cadastrar" },
          { id: "mt-aso-detalhes", title: "Detalhes", icon: "eye", path: "/medicina-do-trabalho/aso/detalhes/:id", isDynamic: true },
          { id: "mt-aso-editar", title: "Editar", icon: "edit", path: "/medicina-do-trabalho/aso/editar/:id", isDynamic: true },
        ],
      },
      {
        id: "mt-exames-periodicos",
        title: "Exames Periódicos",
        icon: "calendarStats",
        path: "/medicina-do-trabalho/exames-periodicos",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
      },
      {
        id: "mt-afastamentos",
        title: "Afastamentos",
        icon: "calendarOff",
        path: "/medicina-do-trabalho/afastamentos",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
        children: [
          { id: "mt-afastamentos-cadastrar", title: "Cadastrar", icon: "plus", path: "/medicina-do-trabalho/afastamentos/cadastrar" },
          { id: "mt-afastamentos-detalhes", title: "Detalhes", icon: "eye", path: "/medicina-do-trabalho/afastamentos/detalhes/:id", isDynamic: true },
          { id: "mt-afastamentos-editar", title: "Editar", icon: "edit", path: "/medicina-do-trabalho/afastamentos/editar/:id", isDynamic: true },
        ],
      },
      {
        id: "mt-cat",
        title: "CAT",
        icon: "clipboardList",
        path: "/medicina-do-trabalho/cat",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
        children: [
          { id: "mt-cat-cadastrar", title: "Cadastrar", icon: "plus", path: "/medicina-do-trabalho/cat/cadastrar" },
          { id: "mt-cat-detalhes", title: "Detalhes", icon: "eye", path: "/medicina-do-trabalho/cat/detalhes/:id", isDynamic: true },
          { id: "mt-cat-editar", title: "Editar", icon: "edit", path: "/medicina-do-trabalho/cat/editar/:id", isDynamic: true },
        ],
      },
      {
        id: "mt-fispq",
        title: "FISPQ/FDS",
        icon: "flask",
        path: "/medicina-do-trabalho/fispq",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
        children: [
          { id: "mt-fispq-cadastrar", title: "Cadastrar", icon: "plus", path: "/medicina-do-trabalho/fispq/cadastrar" },
          { id: "mt-fispq-detalhes", title: "Detalhes", icon: "eye", path: "/medicina-do-trabalho/fispq/detalhes/:id", isDynamic: true },
          { id: "mt-fispq-editar", title: "Editar", icon: "edit", path: "/medicina-do-trabalho/fispq/editar/:id", isDynamic: true },
        ],
      },
    ],
  },

  // FERRAMENTAS
  // Shown only for hierarchical-nav roles; flat-nav roles (COMMERCIAL, FINANCIAL, DESIGNER,
  // LOGISTIC, PLOTTING, MAINTENANCE, PRODUCTION_MANAGER) have their own specific items or no tools access.
  // PRODUCTION is excluded — production-sector workers don't need the calculators/QR tools.
  // Production team leaders are also excluded (TEAM_LEADER virtual privilege removed) — they were
  // still seeing the menu otherwise.
  // BASIC is excluded because production sectors default to BASIC when `privileges` is unset
  // (see api/src/schemas/sector.ts default + auth.service.ts fallback) — keeping BASIC here would
  // leak the menu to those users.
  {
    id: "ferramentas",
    title: "Ferramentas",
    icon: "tools",
    path: "/ferramentas",
    requiredPrivilege: [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.EXTERNAL, SECTOR_PRIVILEGES.ACCOUNTING],
    children: [
      {
        // Explicit gate = section audience MINUS ACCOUNTING (gateless children inherit
        // section visibility, which would leak these tools to accounting users).
        id: "ferramentas-qr-code",
        title: "Gerador de QR Code",
        icon: "qrcode",
        path: "/ferramentas/qr-code",
        requiredPrivilege: [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.EXTERNAL],
      },
      {
        id: "ferramentas-paleta",
        title: "Paleta de Cores",
        icon: "palette",
        path: "/ferramentas/paleta",
        requiredPrivilege: [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.EXTERNAL],
      },
      {
        // Calendário now lives under Ferramentas for the whole personnel audience
        // (the old Departamento Pessoal placement was retired). PRODUCTION_MANAGER gets
        // it via its own Ferramentas group below. Explicit gate so the other
        // Ferramentas-section roles (WAREHOUSE/EXTERNAL) do NOT see it.
        id: "ferramentas-calendario",
        title: "Calendário",
        icon: "calendarStats",
        path: "/departamento-pessoal/calendario",
        requiredPrivilege: [SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.ADMIN],
      },
      {
        id: "ferramentas-calculadora-de-horas",
        title: "Calculadora de Horas",
        icon: "clock",
        path: "/ferramentas/calculadora-de-horas",
      },
      {
        id: "ferramentas-custo-horas-extras",
        title: "Custo de Horas Extras",
        icon: "calendarDollar",
        path: "/ferramentas/custo-horas-extras",
      },
      {
        id: "ferramentas-calculadora-de-mistura",
        title: "Calculadora de Mistura",
        icon: "flask",
        path: "/ferramentas/calculadora-de-mistura",
        requiredPrivilege: [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.EXTERNAL],
      },
      {
        id: "ferramentas-certificado-residuos",
        title: "Certificado de Resíduos",
        icon: "recycle",
        path: "/ferramentas/certificado-residuos",
      },
      {
        id: "ferramentas-custo-de-funcionario",
        title: "Custo de Funcionário",
        icon: "calendarDollar",
        path: "/ferramentas/custo-de-funcionario",
        // Accounting-sector tool. Gate explicitly so it does NOT inherit the broad
        // Ferramentas audience (WAREHOUSE/HR/ADMIN/EXTERNAL).
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING],
      },
      {
        // Gateless = inherits the section audience (WAREHOUSE/HR/ADMIN/EXTERNAL/ACCOUNTING),
        // same convention as the other broad tools above. Flat-nav roles get their own
        // root-level Post-its entry (see "post-its-flat" below) and the PM tools group.
        id: "ferramentas-post-its",
        title: "Post-its",
        icon: "note",
        path: "/ferramentas/post-its",
      },
    ],
  },

  // POST-ITS - root-level entry for flat-navigation roles that don't see the
  // hierarchical "Ferramentas" section (their navs are flat per-role item lists).
  // PRODUCTION/TEAM_LEADER are intentionally NOT here: PRODUCTION (and production team
  // leaders, who are PRODUCTION-sector users) reach Post-its through the "Pessoal" group
  // (see "meus-post-its" above), so they don't get a floating root-level entry.
  {
    id: "post-its-flat",
    title: "Post-its",
    icon: "note",
    path: "/ferramentas/post-its",
    requiredPrivilege: [SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.COMMERCIAL],
  },

  // SERVIDOR
  {
    id: "servidor",
    title: "Servidor",
    icon: "server",
    path: "/servidor",
    requiredPrivilege: SECTOR_PRIVILEGES.ADMIN,
    children: [
      { id: "servidor-backup", title: "Backup do Sistema", icon: "databaseImport", path: "/servidor/backup" },
      { id: "servidor-gerenciador-de-arquivos", title: "Gerenciador de Arquivos", icon: "fileManager", path: "/servidor/gerenciador-de-arquivos" },
      {
        id: "servidor-implantacoes",
        title: "Implantações",
        icon: "rocket",
        path: "/servidor/implantacoes",
        children: [
          { id: "servidor-implantacoes-cadastrar", title: "Cadastrar", icon: "plus", path: "/servidor/implantacoes/cadastrar" },
          { id: "servidor-implantacoes-detalhes", title: "Detalhes", icon: "eye", path: "/servidor/implantacoes/detalhes/:id", isDynamic: true },
        ],
      },
      { id: "servidor-logs", title: "Logs do Sistema", icon: "systemLogs", path: "/servidor/logs" },
      { id: "servidor-metricas", title: "Métricas do Sistema", icon: "systemMetrics", path: "/servidor/metricas" },
      {
        id: "servidor-registros-de-alteracoes",
        title: "Registros de Alterações",
        icon: "auditLog",
        path: "/servidor/registros-de-alteracoes",
        children: [
          { id: "servidor-registros-detalhes", title: "Detalhes", icon: "eye", path: "/servidor/registros-de-alteracoes/detalhes/:id", isDynamic: true },
        ],
      },
      { id: "servidor-servicos", title: "Serviços do Sistema", icon: "services", path: "/servidor/servicos" },
      {
        id: "servidor-usuarios",
        title: "Usuários do Sistema",
        icon: "systemUsers",
        path: "/servidor/usuarios",
        children: [{ id: "servidor-usuarios-cadastrar", title: "Criar Usuário", icon: "plus", path: "/servidor/usuarios/cadastrar" }],
      },
    ],
  },
];

// Export the menu items for use in applications
export const MENU_ITEMS = NAVIGATION_MENU;
