// Sector-default home dashboard layouts.
//
// The default layout shown to a user who has not customized their dashboard
// yet is determined by their sector privilege. Each preset below was hand-
// designed for a specific role's daily reality at Ankaa Design — a vehicle /
// truck graphics shop where work flows COMMERCIAL → DESIGNER → PLOTTING →
// PRODUCTION → LOGISTIC, supported by WAREHOUSE / MAINTENANCE / FINANCIAL /
// HR / ADMIN.
//
// Format: each builder returns a fully-formed DashboardLayout with widgets
// pre-configured for that sector's most common questions ("what's my queue
// today?", "what's near deadline?", "what's blocking me?").

import {
  SECTOR_PRIVILEGES,
  TASK_STATUS,
  STOCK_LEVEL,
  PPE_DELIVERY_STATUS,
} from "../constants";
import { DASHBOARD_LAYOUT_VERSION } from "./types";
import type { DashboardLayout, WidgetInstance } from "./types";

// ============================================================
// Helpers
// ============================================================

let presetCounter = 0;

function makeInstance(
  widgetId: string,
  size: WidgetInstance["size"],
  config: unknown = {},
): WidgetInstance {
  presetCounter += 1;
  return {
    instanceId: `preset-${widgetId}-${presetCounter}`,
    widgetId,
    size,
    config,
  };
}

// Empty defaults so callers only override what they care about.
// Typed as `Record<string, unknown>` so callers can override individual
// fields with narrower literal types without TypeScript complaining about
// the spread widening / narrowing back and forth.
const EMPTY_TASK_FILTERS: Record<string, unknown> = {
  status: [],
  sectorIds: [],
  customerIds: [],
  assigneeIds: [],
  termPreset: "any",
  forecastPreset: "any",
  finishedPreset: "any",
  createdPreset: "any",
  hasOpenSO: "any",
  hasArtworks: "any",
  hasObservation: "any",
  hasBudget: "any",
  isOverdue: "any",
  serviceOrderTypes: [],
  priceMin: null,
  priceMax: null,
};
const EMPTY_ITEM_FILTERS: Record<string, unknown> = {
  searchingFor: "",
  stockLevels: [],
  brandIds: [],
  categoryIds: [],
  supplierIds: [],
  abcCategories: [],
  xyzCategories: [],
  isActive: "yes",
  hasReorderPoint: "any",
  hasMaxQuantity: "any",
  shouldAssignToUser: "any",
  quantityMin: null,
  quantityMax: null,
};

function taskWidget(
  size: WidgetInstance["size"],
  cfg: {
    title: string;
    columns: string[];
    filters?: Record<string, unknown>;
    sort?: { key: string; direction: "asc" | "desc" };
    limit?: number;
  },
): WidgetInstance {
  return makeInstance("table.tasks", size, {
    title: cfg.title,
    columns: cfg.columns,
    filters: { ...EMPTY_TASK_FILTERS, ...(cfg.filters ?? {}) },
    sort: cfg.sort ?? { key: "term", direction: "asc" },
    limit: cfg.limit ?? 25,
    showHeader: true,
  });
}

function itemWidget(
  size: WidgetInstance["size"],
  cfg: {
    title: string;
    columns: string[];
    filters?: Record<string, unknown>;
    sort?: { key: string; direction: "asc" | "desc" };
    limit?: number;
  },
): WidgetInstance {
  return makeInstance("table.items", size, {
    title: cfg.title,
    columns: cfg.columns,
    filters: { ...EMPTY_ITEM_FILTERS, ...(cfg.filters ?? {}) },
    sort: cfg.sort ?? { key: "name", direction: "asc" },
    limit: cfg.limit ?? 30,
    showHeader: true,
  });
}

const favorites = (): WidgetInstance =>
  makeInstance(
    "home.favorites",
    { cols: 4, rows: 1 },
    { itemsPerRow: 6, itemsPerColumn: 1 },
  );
const recentMessages = (): WidgetInstance =>
  makeInstance("home.recent-messages", { cols: 4, rows: 2 }, { itemsPerRow: 4 });
const myWeekPonto = (): WidgetInstance =>
  makeInstance("home.time-entries", { cols: 2, rows: 2 });

// Pre-canned table configs that recur across presets.
const lowStockSnapshot = (): WidgetInstance =>
  itemWidget(
    { cols: 2, rows: 2 },
    {
      title: "Estoque Baixo",
      columns: ["name", "brand", "quantity", "reorderPoint", "monthlyConsumption"],
      filters: {
        stockLevels: [
          STOCK_LEVEL.NEGATIVE_STOCK,
          STOCK_LEVEL.OUT_OF_STOCK,
          STOCK_LEVEL.CRITICAL,
          STOCK_LEVEL.LOW,
        ],
      },
      sort: { key: "quantity", direction: "asc" },
      limit: 30,
    },
  );

// ============================================================
// PRODUCTION
// ----------------------------------------------------------------
// Workflow: workers paint/apply graphics on trucks. They want to see
// the active production queue (what's in front of them now), what's
// next up, and any tasks that are running late. Their personal hours
// matter for ponto compliance.
// ============================================================
function productionLayout(): DashboardLayout {
  presetCounter = 0;
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    updatedAt: new Date().toISOString(),
    items: [
      favorites(),
      taskWidget(
        { cols: 4, rows: 2 },
        {
          title: "Em Produção",
          columns: [
            "name",
            "customerName",
            "serialNumber",
            "soOpenCount",
            "term",
            "forecastDate",
          ],
          filters: { status: [TASK_STATUS.IN_PRODUCTION] },
          sort: { key: "forecastDate", direction: "asc" },
        },
      ),
      taskWidget(
        { cols: 2, rows: 2 },
        {
          title: "Aguardando Produção",
          columns: ["name", "customerName", "serialNumber", "term"],
          filters: { status: [TASK_STATUS.WAITING_PRODUCTION] },
          sort: { key: "term", direction: "asc" },
        },
      ),
      taskWidget(
        { cols: 2, rows: 2 },
        {
          title: "Atrasadas",
          columns: ["name", "customerName", "term", "status"],
          filters: { isOverdue: "yes" },
          sort: { key: "term", direction: "asc" },
          limit: 15,
        },
      ),
      myWeekPonto(),
      recentMessages(),
    ],
  };
}

// ============================================================
// PRODUCTION_MANAGER
// ----------------------------------------------------------------
// Workflow: supervises the production funnel end-to-end. Wants the
// full pipeline view (PREP / WAITING / IN_PRODUCTION) plus the team's
// daily ponto and overdue work. They need the budget shortcut for
// ad-hoc estimates and oversight on stock that could block the line.
// ============================================================
function productionManagerLayout(): DashboardLayout {
  presetCounter = 0;
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    updatedAt: new Date().toISOString(),
    items: [
      favorites(),
      taskWidget(
        { cols: 2, rows: 2 },
        {
          title: "Em Preparação",
          columns: ["name", "customerName", "sector", "hasArtworks", "term"],
          filters: { status: [TASK_STATUS.PREPARATION] },
          sort: { key: "term", direction: "asc" },
        },
      ),
      taskWidget(
        { cols: 2, rows: 2 },
        {
          title: "Aguardando Produção",
          columns: ["name", "customerName", "serialNumber", "term"],
          filters: { status: [TASK_STATUS.WAITING_PRODUCTION] },
          sort: { key: "term", direction: "asc" },
        },
      ),
      taskWidget(
        { cols: 2, rows: 2 },
        {
          title: "Em Produção",
          columns: [
            "name",
            "customerName",
            "soOpenCount",
            "soProductionCount",
            "forecastDate",
          ],
          filters: { status: [TASK_STATUS.IN_PRODUCTION] },
          sort: { key: "forecastDate", direction: "asc" },
        },
      ),
      taskWidget(
        { cols: 2, rows: 2 },
        {
          title: "Atrasadas",
          columns: ["name", "customerName", "term", "status", "sector"],
          filters: { isOverdue: "yes" },
          sort: { key: "term", direction: "asc" },
          limit: 20,
        },
      ),
      makeInstance("home.daily-ponto", { cols: 4, rows: 3 }, {
        title: "Ponto do Dia (Equipe)",
        columns: ["entrada1", "saida1", "entrada2", "saida2", "normais", "faltas"],
        showHeader: true,
        showSector: true,
      }),
      lowStockSnapshot(),
      recentMessages(),
    ],
  };
}

// ============================================================
// WAREHOUSE
// ----------------------------------------------------------------
// Workflow: stocks paint, vinyl, and supplies. Wants to see what's
// running out FIRST (negative / out / critical / low), then what's
// being made right now so they can pre-stage materials. A general
// active-tasks panel helps them see what's coming back to the shelves.
// ============================================================
function warehouseLayout(): DashboardLayout {
  presetCounter = 0;
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    updatedAt: new Date().toISOString(),
    items: [
      favorites(),
      itemWidget(
        { cols: 4, rows: 2 },
        {
          title: "Estoque Crítico",
          columns: [
            "name",
            "brand",
            "category",
            "quantity",
            "reorderPoint",
            "monthlyConsumption",
            "supplier",
          ],
          filters: {
            stockLevels: [
              STOCK_LEVEL.NEGATIVE_STOCK,
              STOCK_LEVEL.OUT_OF_STOCK,
              STOCK_LEVEL.CRITICAL,
              STOCK_LEVEL.LOW,
            ],
          },
          sort: { key: "quantity", direction: "asc" },
          limit: 50,
        },
      ),
      makeInstance(
        "table.borrows",
        { cols: 2, rows: 2 },
        {
          title: "Empréstimos Ativos",
          accent: { color: "violet", icon: "Package", borderColor: "none" },
          columns: ["itemUniCode", "itemName", "userName", "borrowedAt"],
          filters: {
            searchingFor: "",
            statuses: [],
            itemIds: [],
            userIds: [],
            categoryIds: [],
            brandIds: [],
            createdPreset: "any",
            hideReturned: true,
            onlyOverdue: false,
          },
          sort: { key: "createdAt", direction: "desc" },
          limit: 30,
          showHeader: true,
        },
      ),
      itemWidget(
        { cols: 2, rows: 2 },
        {
          title: "Itens Classe A (alto valor)",
          columns: ["name", "brand", "quantity", "totalPrice"],
          filters: { abcCategories: ["A"] },
          sort: { key: "totalPrice", direction: "desc" },
          limit: 20,
        },
      ),
      taskWidget(
        { cols: 2, rows: 2 },
        {
          title: "Em Produção (preparar material)",
          columns: ["name", "customerName", "generalPainting", "logoPaints", "forecastDate"],
          filters: { status: [TASK_STATUS.IN_PRODUCTION, TASK_STATUS.WAITING_PRODUCTION] },
          sort: { key: "forecastDate", direction: "asc" },
        },
      ),
      myWeekPonto(),
      recentMessages(),
    ],
  };
}

// ============================================================
// DESIGNER
// ----------------------------------------------------------------
// Workflow: creates the artwork/layout for each truck. Their queue is
// "tasks in PREPARATION that don't have artworks yet" — those are the
// ones that need their hands. After upload they'd want to see what's
// recently approved (their delivered work).
// ============================================================
function designerLayout(): DashboardLayout {
  presetCounter = 0;
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    updatedAt: new Date().toISOString(),
    items: [
      favorites(),
      taskWidget(
        { cols: 4, rows: 2 },
        {
          title: "Tarefas sem Artes",
          columns: [
            "name",
            "customerName",
            "generalPainting",
            "logoPaints",
            "term",
            "createdAt",
          ],
          filters: {
            status: [TASK_STATUS.PREPARATION, TASK_STATUS.WAITING_PRODUCTION],
            hasArtworks: "no",
          },
          sort: { key: "term", direction: "asc" },
          limit: 30,
        },
      ),
      taskWidget(
        { cols: 2, rows: 2 },
        {
          title: "Em Preparação (com artes)",
          columns: ["name", "customerName", "generalPainting", "logoPaints", "term"],
          filters: {
            status: [TASK_STATUS.PREPARATION],
            hasArtworks: "yes",
          },
          sort: { key: "term", direction: "asc" },
        },
      ),
      taskWidget(
        { cols: 2, rows: 2 },
        {
          title: "Concluídas Recentes",
          columns: ["name", "customerName", "logoPaints", "finishedAt"],
          filters: {
            status: [TASK_STATUS.COMPLETED],
            finishedPreset: "last-7-days",
          },
          sort: { key: "finishedAt", direction: "desc" },
        },
      ),
      myWeekPonto(),
      recentMessages(),
    ],
  };
}

// ============================================================
// PLOTTING
// ----------------------------------------------------------------
// Workflow: cuts the vinyl using a plotter once the artwork is ready.
// They need to see tasks that have artworks and are waiting on cuts.
// "OS Arte" count is a useful indicator of work assigned to them.
// ============================================================
function plottingLayout(): DashboardLayout {
  presetCounter = 0;
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    updatedAt: new Date().toISOString(),
    items: [
      favorites(),
      taskWidget(
        { cols: 4, rows: 2 },
        {
          title: "Aguardando Plotagem",
          columns: [
            "name",
            "customerName",
            "logoPaints",
            "soArtworkCount",
            "soOpenCount",
            "term",
          ],
          filters: {
            status: [TASK_STATUS.PREPARATION, TASK_STATUS.WAITING_PRODUCTION],
            hasArtworks: "yes",
          },
          sort: { key: "term", direction: "asc" },
          limit: 30,
        },
      ),
      taskWidget(
        { cols: 4, rows: 2 },
        {
          title: "Em Produção",
          columns: ["name", "customerName", "soOpenCount", "soArtworkCount", "forecastDate"],
          filters: { status: [TASK_STATUS.IN_PRODUCTION] },
          sort: { key: "forecastDate", direction: "asc" },
        },
      ),
      myWeekPonto(),
      recentMessages(),
    ],
  };
}

// ============================================================
// LOGISTIC
// ----------------------------------------------------------------
// Workflow: receives trucks, parks them, and dispatches finished ones
// back to the customer. Cares about: trucks ready to leave (COMPLETED
// last 7 days), what's coming up on forecastDate (when can the
// customer pick up?), and any logistical service orders.
// ============================================================
function logisticLayout(): DashboardLayout {
  presetCounter = 0;
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    updatedAt: new Date().toISOString(),
    items: [
      favorites(),
      taskWidget(
        { cols: 4, rows: 2 },
        {
          title: "Liberação Próxima",
          columns: ["name", "customerName", "serialNumber", "status", "forecastDate"],
          filters: {
            forecastPreset: "next-7-days",
            status: [
              TASK_STATUS.PREPARATION,
              TASK_STATUS.WAITING_PRODUCTION,
              TASK_STATUS.IN_PRODUCTION,
            ],
          },
          sort: { key: "forecastDate", direction: "asc" },
        },
      ),
      taskWidget(
        { cols: 2, rows: 2 },
        {
          title: "Concluídas (Aguardando Retirada)",
          columns: ["name", "customerName", "serialNumber", "finishedAt"],
          filters: {
            status: [TASK_STATUS.COMPLETED],
            finishedPreset: "last-7-days",
          },
          sort: { key: "finishedAt", direction: "desc" },
        },
      ),
      taskWidget(
        { cols: 2, rows: 2 },
        {
          title: "OS Logística Abertas",
          columns: ["name", "customerName", "soLogisticCount", "forecastDate"],
          filters: {
            hasOpenSO: "yes",
            serviceOrderTypes: ["LOGISTIC"],
          },
          sort: { key: "forecastDate", direction: "asc" },
        },
      ),
      myWeekPonto(),
      recentMessages(),
    ],
  };
}

// ============================================================
// COMMERCIAL
// ----------------------------------------------------------------
// Workflow: sells the service, creates budgets, manages customer
// relationships. They want quick budget creation front-and-center,
// plus a view of pending budgets that need follow-up with customers.
// ============================================================
function commercialLayout(): DashboardLayout {
  presetCounter = 0;
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    updatedAt: new Date().toISOString(),
    items: [
      favorites(),
      makeInstance("quick-action.budget", { cols: 2, rows: 4 }, {
        title: "Novo Orçamento",
      }),
      taskWidget(
        { cols: 2, rows: 2 },
        {
          title: "Orçamentos Pendentes",
          columns: ["name", "customerName", "quoteTotal", "createdAt"],
          filters: {
            hasBudget: "yes",
            status: [TASK_STATUS.PREPARATION],
          },
          sort: { key: "createdAt", direction: "desc" },
          limit: 30,
        },
      ),
      taskWidget(
        { cols: 2, rows: 2 },
        {
          title: "Orçamentos Recentes (mês)",
          columns: ["name", "customerName", "quoteTotal", "status"],
          filters: {
            hasBudget: "yes",
            createdPreset: "this-month",
          },
          sort: { key: "createdAt", direction: "desc" },
          limit: 30,
        },
      ),
      recentMessages(),
    ],
  };
}

// ============================================================
// FINANCIAL
// ----------------------------------------------------------------
// Workflow: bills completed tasks, approves payments, manages NFe.
// Their queue is COMPLETED tasks with budgets ready to invoice. They
// also want to track high-value tasks and overdue billing.
// ============================================================
function financialLayout(): DashboardLayout {
  presetCounter = 0;
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    updatedAt: new Date().toISOString(),
    items: [
      favorites(),
      makeInstance("quick-action.budget", { cols: 2, rows: 4 }, {
        title: "Novo Orçamento",
      }),
      taskWidget(
        { cols: 2, rows: 2 },
        {
          title: "Concluídas a Faturar",
          columns: ["name", "customerName", "quoteTotal", "finishedAt"],
          filters: {
            status: [TASK_STATUS.COMPLETED],
            hasBudget: "yes",
            finishedPreset: "last-30-days",
          },
          sort: { key: "finishedAt", direction: "desc" },
          limit: 40,
        },
      ),
      taskWidget(
        { cols: 2, rows: 2 },
        {
          title: "Concluídas no Mês",
          columns: ["name", "customerName", "quoteTotal", "finishedAt"],
          filters: {
            status: [TASK_STATUS.COMPLETED],
            hasBudget: "yes",
            finishedPreset: "this-month",
          },
          sort: { key: "finishedAt", direction: "desc" },
          limit: 30,
        },
      ),
      taskWidget(
        { cols: 4, rows: 2 },
        {
          title: "Sem Orçamento (Atenção)",
          columns: ["name", "customerName", "status", "createdAt"],
          filters: {
            hasBudget: "no",
            status: [TASK_STATUS.PREPARATION, TASK_STATUS.IN_PRODUCTION],
          },
          sort: { key: "createdAt", direction: "asc" },
          limit: 30,
        },
      ),
      recentMessages(),
    ],
  };
}

// ============================================================
// HUMAN_RESOURCES
// ----------------------------------------------------------------
// Workflow: manages people, hours, vacations. The daily ponto of the
// entire team is the centerpiece. They also need broadcast messages
// for HR comms.
// ============================================================
function hrLayout(): DashboardLayout {
  presetCounter = 0;
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    updatedAt: new Date().toISOString(),
    items: [
      favorites(),
      makeInstance(
        "table.hr-requests",
        { cols: 4, rows: 3 },
        {
          title: "Requisições de RH",
          accent: { color: "indigo", icon: "Clock", borderColor: "none" },
          display: {
            density: "comfortable",
            striping: true,
            gridLines: true,
            hoverHighlight: true,
            showSearchBox: true,
            emptyStateMessage: "",
          },
          filters: { searchingFor: "", estados: [0], tipos: [] },
          sort: { key: "dataSolicitacao", direction: "desc" },
          limit: 30,
          showHeader: true,
          showActionButtons: true,
        },
      ),
      makeInstance(
        "table.ppe-deliveries",
        { cols: 4, rows: 2 },
        {
          title: "Entregas de EPI Pendentes",
          accent: { color: "amber", icon: "ClipboardCheck", borderColor: "none" },
          display: {
            density: "comfortable",
            striping: true,
            gridLines: true,
            hoverHighlight: true,
            stickyHeader: true,
            showSearchBox: true,
            emptyStateMessage: "",
          },
          columns: ["itemName", "userName", "quantity", "status", "scheduledDate"],
          filters: {
            searchingFor: "",
            statuses: [
              PPE_DELIVERY_STATUS.PENDING,
              PPE_DELIVERY_STATUS.WAITING_SIGNATURE,
            ],
            itemIds: [],
            userIds: [],
            onlyActionable: false,
          },
          sort: { key: "createdAt", direction: "desc" },
          limit: 30,
          showHeader: true,
          showRowDot: true,
          showActionButtons: true,
        },
      ),
      makeInstance("home.daily-ponto", { cols: 4, rows: 4 }, {
        title: "Ponto do Dia",
        columns: [
          "entrada1",
          "saida1",
          "entrada2",
          "saida2",
          "normais",
          "faltas",
          "ex50",
          "ex100",
          "ajuste",
        ],
        showHeader: true,
        showSector: true,
      }),
      myWeekPonto(),
      recentMessages(),
    ],
  };
}

// ============================================================
// MAINTENANCE
// ----------------------------------------------------------------
// Workflow: keeps tools and equipment running. Without a dedicated
// maintenance widget yet, the inventory table filtered by their
// category covers their day. Recent messages keep them in the loop
// on tool requests from production.
// ============================================================
function maintenanceLayout(): DashboardLayout {
  presetCounter = 0;
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    updatedAt: new Date().toISOString(),
    items: [
      favorites(),
      itemWidget(
        { cols: 4, rows: 2 },
        {
          title: "Itens com Manutenção",
          columns: ["name", "brand", "category", "quantity", "supplier"],
          filters: { hasReorderPoint: "any" },
          sort: { key: "name", direction: "asc" },
          limit: 50,
        },
      ),
      lowStockSnapshot(),
      myWeekPonto(),
      recentMessages(),
    ],
  };
}

// ============================================================
// ADMIN
// ----------------------------------------------------------------
// Workflow: full system oversight. The dashboard should show the
// state of everything that matters at a glance — tasks, items,
// people, comms.
// ============================================================
function adminLayout(): DashboardLayout {
  presetCounter = 0;
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    updatedAt: new Date().toISOString(),
    items: [
      favorites(),
      taskWidget(
        { cols: 2, rows: 2 },
        {
          title: "Tarefas Atrasadas",
          columns: ["name", "customerName", "sector", "term", "status"],
          filters: { isOverdue: "yes" },
          sort: { key: "term", direction: "asc" },
          limit: 25,
        },
      ),
      taskWidget(
        { cols: 2, rows: 2 },
        {
          title: "Em Produção (Geral)",
          columns: ["name", "customerName", "soOpenCount", "forecastDate"],
          filters: { status: [TASK_STATUS.IN_PRODUCTION] },
          sort: { key: "forecastDate", direction: "asc" },
        },
      ),
      lowStockSnapshot(),
      makeInstance("home.daily-ponto", { cols: 2, rows: 2 }, {
        title: "Ponto do Dia",
        columns: ["entrada1", "saida1", "entrada2", "saida2", "normais", "faltas"],
        showHeader: true,
        showSector: true,
      }),
      makeInstance("quick-action.budget", { cols: 2, rows: 4 }, {
        title: "Novo Orçamento",
      }),
      taskWidget(
        { cols: 2, rows: 2 },
        {
          title: "Concluídas Hoje",
          columns: ["name", "customerName", "finishedAt"],
          filters: {
            status: [TASK_STATUS.COMPLETED],
            finishedPreset: "today",
          },
          sort: { key: "finishedAt", direction: "desc" },
        },
      ),
      makeInstance(
        "table.ppe-deliveries",
        { cols: 2, rows: 2 },
        {
          title: "EPIs Pendentes",
          accent: { color: "amber", icon: "ClipboardCheck", borderColor: "none" },
          display: {
            density: "comfortable",
            striping: true,
            gridLines: true,
            hoverHighlight: true,
            stickyHeader: true,
            showSearchBox: true,
            emptyStateMessage: "",
          },
          columns: ["itemName", "userName", "status", "scheduledDate"],
          filters: {
            searchingFor: "",
            statuses: [
              PPE_DELIVERY_STATUS.PENDING,
              PPE_DELIVERY_STATUS.WAITING_SIGNATURE,
            ],
            itemIds: [],
            userIds: [],
            onlyActionable: false,
          },
          sort: { key: "createdAt", direction: "desc" },
          limit: 20,
          showHeader: true,
          showRowDot: true,
          showActionButtons: true,
        },
      ),
      makeInstance(
        "table.hr-requests",
        { cols: 4, rows: 2 },
        {
          title: "Requisições de RH",
          accent: { color: "indigo", icon: "Clock", borderColor: "none" },
          display: {
            density: "compact",
            striping: true,
            gridLines: true,
            hoverHighlight: true,
            showSearchBox: false,
            emptyStateMessage: "",
          },
          filters: { searchingFor: "", estados: [0], tipos: [] },
          sort: { key: "dataSolicitacao", direction: "desc" },
          limit: 20,
          showHeader: true,
          showActionButtons: true,
        },
      ),
      recentMessages(),
    ],
  };
}

// ============================================================
// EXTERNAL
// ----------------------------------------------------------------
// Workflow: very limited access (e.g., a guest collaborator). Just
// favorites + messages — no production / financial visibility.
// ============================================================
function externalLayout(): DashboardLayout {
  presetCounter = 0;
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    updatedAt: new Date().toISOString(),
    items: [favorites(), recentMessages()],
  };
}

// ============================================================
// Default fallback (BASIC users + anyone without a sector preset)
// ============================================================
function defaultBaseLayout(): DashboardLayout {
  presetCounter = 0;
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    updatedAt: new Date().toISOString(),
    items: [
      favorites(),
      taskWidget(
        { cols: 2, rows: 2 },
        {
          title: "Tarefas com Prazo Hoje",
          columns: ["name", "customerName", "serialNumber", "term"],
          filters: { termPreset: "today" },
        },
      ),
      taskWidget(
        { cols: 2, rows: 2 },
        {
          title: "Liberação Próxima",
          columns: ["name", "customerName", "serialNumber", "forecastDate"],
          filters: { forecastPreset: "next-7-days" },
          sort: { key: "forecastDate", direction: "asc" },
        },
      ),
      lowStockSnapshot(),
      recentMessages(),
    ],
  };
}

// ============================================================
// Sector → preset map
// ============================================================

const presetsBySector: Partial<Record<SECTOR_PRIVILEGES, () => DashboardLayout>> = {
  [SECTOR_PRIVILEGES.PRODUCTION]: productionLayout,
  [SECTOR_PRIVILEGES.PRODUCTION_MANAGER]: productionManagerLayout,
  [SECTOR_PRIVILEGES.WAREHOUSE]: warehouseLayout,
  [SECTOR_PRIVILEGES.LOGISTIC]: logisticLayout,
  [SECTOR_PRIVILEGES.DESIGNER]: designerLayout,
  [SECTOR_PRIVILEGES.PLOTTING]: plottingLayout,
  [SECTOR_PRIVILEGES.COMMERCIAL]: commercialLayout,
  [SECTOR_PRIVILEGES.FINANCIAL]: financialLayout,
  [SECTOR_PRIVILEGES.HUMAN_RESOURCES]: hrLayout,
  [SECTOR_PRIVILEGES.MAINTENANCE]: maintenanceLayout,
  [SECTOR_PRIVILEGES.ADMIN]: adminLayout,
  [SECTOR_PRIVILEGES.EXTERNAL]: externalLayout,
};

export function getDefaultLayoutForSector(
  sector: SECTOR_PRIVILEGES | null | undefined,
): DashboardLayout {
  if (!sector) return defaultBaseLayout();
  const builder = presetsBySector[sector];
  return builder ? builder() : defaultBaseLayout();
}
