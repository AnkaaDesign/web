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

  // Human Resources
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
      {
        id: "colaboradores",
        title: "Colaboradores",
        icon: "user",
        path: "/administracao/colaboradores",
        children: [
          { id: "colaboradores-cadastrar", title: "Cadastrar", icon: "plus", path: "/administracao/colaboradores/cadastrar", requiredPrivilege: SECTOR_PRIVILEGES.ADMIN },
          { id: "colaboradores-detalhes", title: "Detalhes", icon: "eye", path: "/administracao/colaboradores/detalhes/:id", isDynamic: true },
          { id: "colaboradores-editar", title: "Editar", icon: "edit", path: "/administracao/colaboradores/editar/:id", isDynamic: true },
        ],
      },
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
    requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ACCOUNTING],
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
        // Elotech NFS-e issuance pages — NOT what accounting needs (they use the
        // reconciliation fiscal documents inside Conciliação Bancária).
        id: "notas-fiscais",
        title: "NFS-e Emitidas",
        icon: "receipt",
        path: "/financeiro/notas-fiscais",
        requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL],
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
          },
          {
            // FINANCIAL/ADMIN-only: ACCOUNTING uses the spec's four pages above.
            id: "conciliacao-transacoes",
            title: "Transações",
            icon: "list",
            path: "/financeiro/conciliacao/transacoes",
            requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL],
          },
          {
            // Reconciliation fiscal-documents list. Now the single home for
            // "Notas Fiscais" (the top-level ACCOUNTING duplicate was removed), so
            // ACCOUNTING is included here alongside ADMIN/FINANCIAL.
            id: "conciliacao-notas",
            title: "Notas Fiscais",
            icon: "receipt",
            path: "/financeiro/conciliacao/notas",
            requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ACCOUNTING],
          },
          {
            // Kept for ACCOUNTING as a utility entry: the four reconciliation pages
            // categorize transactions, and Categorias is the only place to manage the
            // category set (the page is already reachable via /financeiro/*).
            id: "conciliacao-categorias",
            title: "Categorias",
            icon: "tags",
            path: "/financeiro/conciliacao/categorias",
            requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN],
          },
          {
            id: "conciliacao-recorrentes",
            title: "Recorrentes",
            icon: "repeat",
            path: "/financeiro/conciliacao/recorrentes",
            requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL],
          },
        ],
      },
      {
        // Single payables hub — absorbed the former "Previsão de Saídas"
        // (its forecast KPI strip + estimate styling live here now).
        id: "contas-a-pagar",
        title: "Contas a Pagar",
        icon: "receipt",
        path: "/financeiro/contas-a-pagar",
        // ACCOUNTING-only: new accounting-sector payables hub (did not exist in the
        // baseline menu). ADMIN/FINANCIAL keep their original Financeiro menu unchanged.
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING],
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
        id: "stats-recursos-humanos",
        title: "Recursos Humanos",
        icon: "users",
        path: "/estatisticas/recursos-humanos",
        children: [
          { id: "stats-rh-folha", title: "Folha de Pagamento", icon: "chartBar", path: "/estatisticas/recursos-humanos/folha" },
          { id: "stats-rh-equipe", title: "Equipe", icon: "users", path: "/estatisticas/recursos-humanos/equipe" },
          { id: "stats-rh-faltas", title: "Faltas", icon: "calendarOff", path: "/estatisticas/recursos-humanos/faltas" },
          { id: "stats-rh-competencias", title: "Competências", icon: "clipboardList", path: "/estatisticas/recursos-humanos/competencias" },
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
    title: "Colaboradores",
    icon: "users",
    path: "/administracao/colaboradores",
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
        path: "/administracao/colaboradores",
      },
      {
        // Production manager gets the view-only tabs (Colaborador, Dia, Ausências).
        // Edição and Fechamento are intentionally omitted — they remain HR/ADMIN only.
        id: "controle-de-ponto-production-manager",
        title: "Controle de Ponto",
        icon: "fingerprint",
        path: "/recursos-humanos/controle-ponto",
        requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
        children: [
          {
            id: "controle-ponto-colaborador-production-manager",
            title: "Visualização Colaborador",
            icon: "user",
            path: "/recursos-humanos/controle-ponto/colaborador",
            requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
          },
          {
            id: "controle-ponto-dia-production-manager",
            title: "Visualização Dia",
            icon: "calendar",
            path: "/recursos-humanos/controle-ponto/dia",
            requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
          },
          {
            id: "controle-ponto-ausencias-production-manager",
            title: "Ausências",
            icon: "list",
            path: "/recursos-humanos/controle-ponto/ausencias",
            requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
          },
        ],
      },
    ],
  },
  {
    id: "estatisticas-production-manager",
    title: "Estatísticas",
    icon: "barChart",
    path: "/estatisticas/recursos-humanos/equipe",
    requiredPrivilege: SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
    children: [
      {
        id: "stats-equipe-production-manager",
        title: "Equipe",
        icon: "users",
        path: "/estatisticas/recursos-humanos/equipe",
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
        path: "/estatisticas/recursos-humanos/competencias",
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
      { id: "ferramentas-qr-code-pm", title: "Gerador de QR Code", icon: "qrcode", path: "/ferramentas/qr-code" },
      { id: "ferramentas-paleta-pm", title: "Paleta de Cores", icon: "palette", path: "/ferramentas/paleta" },
      { id: "ferramentas-calculadora-de-horas-pm", title: "Calculadora de Horas", icon: "clock", path: "/ferramentas/calculadora-de-horas" },
      { id: "ferramentas-custo-horas-extras-pm", title: "Custo de Horas Extras", icon: "calendarDollar", path: "/ferramentas/custo-horas-extras" },
      { id: "ferramentas-calculadora-de-mistura-pm", title: "Calculadora de Mistura", icon: "flask", path: "/ferramentas/calculadora-de-mistura" },
      { id: "ferramentas-certificado-residuos-pm", title: "Certificado de Resíduos", icon: "recycle", path: "/ferramentas/certificado-residuos" },
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

  // RECURSOS HUMANOS
  // NOTE: ACCOUNTING must NOT see this section — everything accounting needs lives in
  // the Departamento Pessoal / Medicina do Trabalho sections below.
  {
    id: "recursos-humanos",
    title: "Recursos Humanos",
    icon: "users",
    path: "/recursos-humanos",
    requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES],
    children: [
      {
        id: "warnings",
        title: "Advertências",
        icon: "alertTriangle",
        path: "/recursos-humanos/avisos",
        children: [
          { id: "warnings-cadastrar", title: "Cadastrar", icon: "plus", path: "/recursos-humanos/avisos/cadastrar" },
          { id: "warnings-detalhes", title: "Detalhes", icon: "eye", path: "/recursos-humanos/avisos/detalhes/:id", isDynamic: true },
          { id: "warnings-editar", title: "Editar", icon: "edit", path: "/recursos-humanos/avisos/editar/:id", isDynamic: true },
        ],
      },
      {
        id: "bonus",
        title: "Bônus",
        icon: "coins",
        path: "/recursos-humanos/bonus",
        children: [
          { id: "simulacao-bonus", title: "Simulação de Bônus", icon: "calculator", path: "/recursos-humanos/bonus/simulacao-de-bonus" },
          { id: "nivel-de-performance", title: "Nível de Performance", icon: "trendingUp", path: "/recursos-humanos/bonus/nivel-de-performance" },
        ],
      },
      {
        id: "cargos",
        title: "Cargos",
        icon: "briefcase",
        path: "/recursos-humanos/cargos",
        children: [
          { id: "cargos-cadastrar", title: "Cadastrar", icon: "plus", path: "/recursos-humanos/cargos/cadastrar", requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN] },
          { id: "cargos-detalhes", title: "Detalhes", icon: "eye", path: "/recursos-humanos/cargos/detalhes/:id", isDynamic: true },
          { id: "cargos-editar", title: "Editar", icon: "edit", path: "/recursos-humanos/cargos/editar/:id", isDynamic: true },
        ],
      },
      {
        id: "controle-ponto",
        title: "Controle de Ponto",
        icon: "fingerprint",
        path: "/recursos-humanos/controle-ponto",
        children: [
          {
            id: "controle-ponto-colaborador",
            title: "Visualização Colaborador",
            icon: "user",
            path: "/recursos-humanos/controle-ponto/colaborador",
          },
          {
            id: "controle-ponto-dia",
            title: "Visualização Dia",
            icon: "calendar",
            path: "/recursos-humanos/controle-ponto/dia",
          },
          {
            id: "controle-ponto-edicao",
            title: "Edição",
            icon: "edit",
            path: "/recursos-humanos/controle-ponto/edicao",
            requiredPrivilege: [SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
          },
          {
            id: "controle-ponto-ausencias",
            title: "Ausências",
            icon: "list",
            path: "/recursos-humanos/controle-ponto/ausencias",
            requiredPrivilege: [SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.ACCOUNTING],
          },
          {
            id: "controle-ponto-fechamento",
            title: "Fechamento",
            icon: "signature",
            path: "/recursos-humanos/controle-ponto/fechamento",
            requiredPrivilege: [SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
          },
          {
            id: "controle-ponto-requisicoes",
            title: "Requisições",
            icon: "clipboardList",
            path: "/recursos-humanos/requisicoes",
            requiredPrivilege: [SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.ACCOUNTING],
          },
        ],
      },
      {
        // Secullum integration — admin tool for mapping sectors↔departamentos
        // and positions↔funções, plus an overview of active/dismissed funcionários.
        id: "integracoes-secullum",
        title: "Integração Secullum",
        icon: "users",
        path: "/recursos-humanos/integracoes/secullum",
        requiredPrivilege: [SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
      },
      {
        id: "epi-rh",
        title: "EPI",
        icon: "helmet",
        path: "/recursos-humanos/epi",
        children: [
          {
            id: "epi-rh-agendamentos",
            title: "Agendamentos",
            icon: "schedule",
            path: "/recursos-humanos/epi/agendamentos",
            children: [
              { id: "epi-rh-agendamentos-cadastrar", title: "Cadastrar", icon: "plus", path: "/recursos-humanos/epi/agendamentos/cadastrar" },
              { id: "epi-rh-agendamentos-detalhes", title: "Detalhes", icon: "eye", path: "/recursos-humanos/epi/agendamentos/detalhes/:id", isDynamic: true },
              { id: "epi-rh-agendamentos-editar", title: "Editar", icon: "edit", path: "/recursos-humanos/epi/agendamentos/editar/:id", isDynamic: true },
            ],
          },
          { id: "epi-rh-cadastrar", title: "Cadastrar", icon: "plus", path: "/recursos-humanos/epi/cadastrar" },
          { id: "epi-rh-detalhes", title: "Detalhes", icon: "eye", path: "/recursos-humanos/epi/detalhes/:id", isDynamic: true },
          { id: "epi-rh-editar", title: "Editar", icon: "edit", path: "/recursos-humanos/epi/editar/:id", isDynamic: true },
          { id: "epi-rh-tamanhos", title: "Tamanhos", icon: "sizes", path: "/recursos-humanos/epi/tamanhos" },
          {
            id: "epi-rh-entregas",
            title: "Entregas",
            icon: "truck",
            path: "/recursos-humanos/epi/entregas",
            children: [
              { id: "epi-rh-entregas-cadastrar", title: "Cadastrar", icon: "plus", path: "/recursos-humanos/epi/entregas/cadastrar" },
              { id: "epi-rh-entregas-detalhes", title: "Detalhes", icon: "eye", path: "/recursos-humanos/epi/entregas/detalhes/:id", isDynamic: true },
              { id: "epi-rh-entregas-editar", title: "Editar", icon: "edit", path: "/recursos-humanos/epi/entregas/editar/:id", isDynamic: true },
            ],
          },
        ],
      },
      {
        id: "feriados",
        title: "Feriados",
        icon: "holiday",
        path: "/recursos-humanos/feriados",
        children: [
          { id: "feriados-cadastrar", title: "Cadastrar", icon: "plus", path: "/recursos-humanos/feriados/cadastrar" },
          // No "Editar" entry: /recursos-humanos/feriados/editar/:id has no route/page (holidays are Secullum-synced; edit page was removed).
        ],
      },
      {
        id: "ferias",
        title: "Férias",
        icon: "vacation",
        path: "/recursos-humanos/ferias",
        requiredPrivilege: [SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
        children: [
          { id: "ferias-cadastrar", title: "Cadastrar", icon: "plus", path: "/recursos-humanos/ferias/cadastrar" },
          { id: "ferias-editar", title: "Editar", icon: "edit", path: "/recursos-humanos/ferias/editar/:id", isDynamic: true },
          { id: "ferias-detalhes", title: "Detalhes", icon: "eye", path: "/recursos-humanos/ferias/detalhes/:id", isDynamic: true },
        ],
      },
      {
        id: "rh-calendario",
        title: "Calendário",
        icon: "calendarStats",
        path: "/recursos-humanos/calendario",
        requiredPrivilege: [SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
      },
      {
        id: "horarios",
        title: "Horários",
        icon: "clock",
        path: "/recursos-humanos/horarios",
        children: [
          { id: "horarios-detalhes", title: "Detalhes", icon: "eye", path: "/recursos-humanos/horarios/detalhes/:id", isDynamic: true },
        ],
      },
      {
        id: "folha-de-pagamento",
        title: "Folha de Pagamento",
        icon: "payroll",
        path: "/recursos-humanos/folha-de-pagamento",
        requiredPrivilege: [SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
      },
      { id: "minhas-mensagens-rh", title: "Minhas Mensagens", icon: "message", path: "/pessoal/mensagens", requiredPrivilege: SECTOR_PRIVILEGES.HUMAN_RESOURCES },
    ],
  },

  // DEPARTAMENTO PESSOAL (Contabilidade / RH / Admin)
  // Section path points to the first real page (no /departamento-pessoal root page exists),
  // same precedent as the PRODUCTION_MANAGER grouped sections.
  {
    id: "departamento-pessoal",
    title: "Departamento Pessoal",
    icon: "team",
    path: "/administracao/colaboradores",
    // ACCOUNTING-only: this is a new accounting-sector section. HR/ADMIN keep their
    // original "Recursos Humanos" menu and must NOT see this duplicate. (Page-level
    // route privileges remain open to HR/ADMIN — only the menu entry is accounting-only.)
    requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING],
    children: [
      {
        id: "dp-colaboradores",
        title: "Colaboradores",
        icon: "user",
        path: "/administracao/colaboradores",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
        children: [
          { id: "dp-colaboradores-detalhes", title: "Detalhes", icon: "eye", path: "/administracao/colaboradores/detalhes/:id", isDynamic: true },
          { id: "dp-colaboradores-editar", title: "Editar", icon: "edit", path: "/administracao/colaboradores/editar/:id", isDynamic: true },
        ],
      },
      {
        id: "dp-advertencias",
        title: "Advertências",
        icon: "alertTriangle",
        path: "/recursos-humanos/avisos",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
        children: [
          { id: "dp-advertencias-cadastrar", title: "Cadastrar", icon: "plus", path: "/recursos-humanos/avisos/cadastrar" },
          { id: "dp-advertencias-detalhes", title: "Detalhes", icon: "eye", path: "/recursos-humanos/avisos/detalhes/:id", isDynamic: true },
          { id: "dp-advertencias-editar", title: "Editar", icon: "edit", path: "/recursos-humanos/avisos/editar/:id", isDynamic: true },
        ],
      },
      {
        // ACCOUNTING (Área Andressa) gets the FULL Controle de Ponto toolset here:
        // the view tabs (Colaborador, Dia, Ausências) plus Edição and Fechamento,
        // since folha closing/conferência is part of the accounting workflow.
        id: "dp-controle-ponto",
        title: "Controle de Ponto",
        icon: "fingerprint",
        path: "/recursos-humanos/controle-ponto",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
        children: [
          { id: "dp-controle-ponto-colaborador", title: "Visualização Colaborador", icon: "user", path: "/recursos-humanos/controle-ponto/colaborador" },
          { id: "dp-controle-ponto-dia", title: "Visualização Dia", icon: "calendar", path: "/recursos-humanos/controle-ponto/dia" },
          { id: "dp-controle-ponto-edicao", title: "Edição", icon: "edit", path: "/recursos-humanos/controle-ponto/edicao", requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN] },
          { id: "dp-controle-ponto-ausencias", title: "Ausências", icon: "list", path: "/recursos-humanos/controle-ponto/ausencias", requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN] },
          { id: "dp-controle-ponto-fechamento", title: "Fechamento", icon: "signature", path: "/recursos-humanos/controle-ponto/fechamento", requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN] },
          { id: "dp-controle-ponto-requisicoes", title: "Requisições", icon: "clipboardList", path: "/recursos-humanos/requisicoes", requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN] },
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
          { id: "dp-ferias-coletiva-detalhes", title: "Férias Coletivas", icon: "eye", path: "/departamento-pessoal/ferias/coletiva/detalhes/:id", isDynamic: true },
        ],
      },
      {
        id: "dp-decimo-terceiro",
        title: "13º Salário",
        icon: "coins",
        path: "/departamento-pessoal/decimo-terceiro",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
        children: [
          { id: "dp-decimo-terceiro-cadastrar", title: "Cadastrar", icon: "plus", path: "/departamento-pessoal/decimo-terceiro/cadastrar" },
          { id: "dp-decimo-terceiro-detalhes", title: "Detalhes", icon: "eye", path: "/departamento-pessoal/decimo-terceiro/detalhes/:id", isDynamic: true },
          { id: "dp-decimo-terceiro-editar", title: "Editar", icon: "edit", path: "/departamento-pessoal/decimo-terceiro/editar/:id", isDynamic: true },
        ],
      },
      // NOTE (spec alignment 2026-06-11): "Feriados" and "Calendário" are NOT DP items.
      // Calendário moved under Ferramentas for ACCOUNTING (HR/ADMIN keep the
      // Recursos Humanos placement); Feriados stays HR/ADMIN-only in Recursos Humanos.
      {
        id: "dp-integracao-secullum",
        title: "Integração Secullum",
        icon: "users",
        path: "/recursos-humanos/integracoes/secullum",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
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
        path: "/recursos-humanos/emprestimos",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
      },
      {
        id: "dp-salarios-e-cargos",
        title: "Salários e Cargos",
        icon: "salary",
        path: "/recursos-humanos/cargos",
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
            path: "/recursos-humanos/cargos",
            requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
            children: [
              { id: "dp-cargos-detalhes", title: "Detalhes", icon: "eye", path: "/recursos-humanos/cargos/detalhes/:id", isDynamic: true },
              { id: "dp-cargos-editar", title: "Editar", icon: "edit", path: "/recursos-humanos/cargos/editar/:id", isDynamic: true },
            ],
          },
          {
            id: "dp-horarios",
            title: "Horários",
            icon: "clock",
            path: "/recursos-humanos/horarios",
            requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
          },
          {
            id: "dp-gratificacoes",
            title: "Gratificações",
            icon: "coins",
            path: "/recursos-humanos/bonus",
            requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
            children: [
              { id: "dp-gratificacoes-simulacao", title: "Simulação de Bônus", icon: "calculator", path: "/recursos-humanos/bonus/simulacao-de-bonus" },
              { id: "dp-gratificacoes-nivel-performance", title: "Nível de Performance", icon: "trendingUp", path: "/recursos-humanos/bonus/nivel-de-performance" },
            ],
          },
          {
            id: "dp-folha-de-pagamento",
            title: "Folha de Pagamento",
            icon: "payroll",
            path: "/recursos-humanos/folha-de-pagamento",
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
    path: "/recursos-humanos/epi/entregas",
    // ACCOUNTING-only: new accounting-sector section. HR/ADMIN keep their original
    // "Recursos Humanos" menu and must NOT see this. (Route privileges unchanged.)
    requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING],
    children: [
      {
        id: "mt-epi-entregas",
        title: "Entrega de EPIs",
        icon: "truck",
        path: "/recursos-humanos/epi/entregas",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
        children: [
          // Spec (Área Andressa §3): Agendamentos and Tamanhos are CHILDREN of
          // Entrega de EPIs, not section-level Medicina do Trabalho items.
          {
            id: "mt-epi-agendamentos",
            title: "Agendamentos",
            icon: "schedule",
            path: "/recursos-humanos/epi/agendamentos",
            requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
            children: [
              { id: "mt-epi-agendamentos-cadastrar", title: "Cadastrar", icon: "plus", path: "/recursos-humanos/epi/agendamentos/cadastrar" },
              { id: "mt-epi-agendamentos-detalhes", title: "Detalhes", icon: "eye", path: "/recursos-humanos/epi/agendamentos/detalhes/:id", isDynamic: true },
              { id: "mt-epi-agendamentos-editar", title: "Editar", icon: "edit", path: "/recursos-humanos/epi/agendamentos/editar/:id", isDynamic: true },
            ],
          },
          {
            id: "mt-epi-tamanhos",
            title: "Tamanhos",
            icon: "sizes",
            path: "/recursos-humanos/epi/tamanhos",
            requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
          },
          { id: "mt-epi-entregas-cadastrar", title: "Cadastrar", icon: "plus", path: "/recursos-humanos/epi/entregas/cadastrar" },
          { id: "mt-epi-entregas-detalhes", title: "Detalhes", icon: "eye", path: "/recursos-humanos/epi/entregas/detalhes/:id", isDynamic: true },
          { id: "mt-epi-entregas-editar", title: "Editar", icon: "edit", path: "/recursos-humanos/epi/entregas/editar/:id", isDynamic: true },
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
        // ACCOUNTING-only placement (Área Andressa §5 puts Calendário under
        // Ferramentas). HR/ADMIN keep the same page under Recursos Humanos.
        id: "ferramentas-calendario-accounting",
        title: "Calendário",
        icon: "calendarStats",
        path: "/recursos-humanos/calendario",
        requiredPrivilege: [SECTOR_PRIVILEGES.ACCOUNTING],
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
  {
    id: "post-its-flat",
    title: "Post-its",
    icon: "note",
    path: "/ferramentas/post-its",
    requiredPrivilege: [SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.PRODUCTION, TEAM_LEADER],
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
