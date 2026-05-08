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
// Layout authored by kennedy.ankaa@gmail.com (2026-05-08) and saved
// as the sector default. Pairs the team's daily ponto with two
// task panels — overdue work currently in production, and the
// 7-day forecast queue — plus favorites and recent messages.
// ============================================================
function productionManagerLayout(): DashboardLayout {
  presetCounter = 0;
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    updatedAt: new Date().toISOString(),
    items: [
      makeInstance(
        "home.favorites",
        { cols: 2, rows: 1 },
        {
          title: "Favoritos",
          accent: { icon: "Star", color: "blue", borderColor: "blue" },
          density: "spacious",
          itemsPerRow: 6,
          itemsPerColumn: 1,
        },
      ),
      makeInstance(
        "home.recent-messages",
        { cols: 2, rows: 1 },
        {
          title: "Mensagens Recentes",
          accent: { icon: "Message", color: "indigo", borderColor: "indigo" },
          density: "compact",
          itemsPerRow: 4,
          itemsPerColumn: 1,
        },
      ),
      makeInstance(
        "home.daily-ponto",
        { cols: 1, rows: 4 },
        {
          title: "Ponto do Dia",
          accent: { icon: "Clock24", color: "teal", borderColor: "teal" },
          columns: ["userName", "entrada1", "saida1", "entrada2", "saida2"],
          sort: { key: "userName", direction: "asc" },
          limit: 50,
          showHeader: true,
          display: {
            density: "comfortable",
            striping: true,
            gridLines: true,
            layoutMode: "flat",
            stickyHeader: true,
            showSearchBox: false,
            hoverHighlight: true,
            showViewAllLink: true,
            showDayNavigator: true,
            emptyStateMessage: "",
          },
          filters: {
            mode: "all",
            sectorNames: [],
            defaultSearch: "",
            positionNames: [],
          },
        },
      ),
      makeInstance(
        "table.tasks",
        { cols: 3, rows: 2 },
        {
          title: "Tarefas em Execução",
          accent: { icon: "ClipboardText", color: "blue", borderColor: "blue" },
          columns: [
            "name",
            "customerName",
            "serialNumber",
            "sector",
            "observation",
            "soLogistic",
            "soProduction",
            "hasArtworks",
            "term",
          ],
          columnLabels: {
            soLogistic: "OS Logística",
            soProduction: "OS Produção",
          },
          columnWidths: {},
          sort: { key: "term", direction: "asc" },
          sorts: [{ key: "term", direction: "asc" }],
          limit: 20,
          showHeader: true,
          display: {
            density: "comfortable",
            striping: true,
            gridLines: true,
            layoutMode: "flat",
            showRowDot: false,
            stickyHeader: true,
            showSearchBox: false,
            hoverHighlight: true,
            showViewAllLink: true,
            emptyStateMessage: "",
          },
          filters: {
            ...EMPTY_TASK_FILTERS,
            status: [TASK_STATUS.IN_PRODUCTION],
            termPreset: "overdue",
          },
          presets: [],
          behavior: { refetchIntervalMs: 0, viewAllRouteOverride: "" },
          cellModes: {
            paint: "swatch-name",
            status: "badge",
            serviceOrder: "progress-bar",
          },
          deadlineColors: {
            bold: true,
            enabled: true,
            termOnTrackColor: "green",
            termOverdueColor: "red",
            termCriticalColor: "amber",
            termCriticalHours: 4,
            forecastNoticeDays: 10,
            forecastNoticeColor: "yellow",
            forecastWarningDays: 7,
            forecastCriticalDays: 3,
            forecastWarningColor: "orange",
            forecastCriticalColor: "red",
          },
          rowClickTarget: "task",
        },
      ),
      makeInstance(
        "table.tasks",
        { cols: 3, rows: 2 },
        {
          title: "Tarefas Próximas",
          accent: {
            icon: "ClipboardText",
            color: "orange",
            borderColor: "orange",
          },
          columns: [
            "name",
            "customerName",
            "serialNumber",
            "observation",
            "soLogistic",
            "soArtwork",
            "hasArtworks",
            "forecastDate",
            "term",
          ],
          columnLabels: {
            soArtwork: "OS Arte",
            soLogistic: "OS Logistica",
          },
          columnWidths: {},
          sort: { key: "term", direction: "asc" },
          sorts: [{ key: "term", direction: "asc" }],
          limit: 20,
          showHeader: true,
          display: {
            density: "comfortable",
            striping: true,
            gridLines: true,
            layoutMode: "flat",
            showRowDot: false,
            stickyHeader: true,
            showSearchBox: false,
            hoverHighlight: true,
            showViewAllLink: true,
            emptyStateMessage: "",
          },
          filters: {
            ...EMPTY_TASK_FILTERS,
            forecastPreset: "next-7-days",
          },
          presets: [],
          behavior: { refetchIntervalMs: 0, viewAllRouteOverride: "" },
          cellModes: {
            paint: "swatch-name",
            status: "badge",
            serviceOrder: "progress-bar",
          },
          deadlineColors: {
            bold: true,
            enabled: true,
            termOnTrackColor: "green",
            termOverdueColor: "red",
            termCriticalColor: "amber",
            termCriticalHours: 4,
            forecastNoticeDays: 10,
            forecastNoticeColor: "yellow",
            forecastWarningDays: 7,
            forecastCriticalDays: 3,
            forecastWarningColor: "orange",
            forecastCriticalColor: "red",
          },
          rowClickTarget: "task",
        },
      ),
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
// Layout authored by kennedy.ankaa@gmail.com (2026-05-08) and saved
// as the sector default. Pairs the production calendar with overdue
// in-production work and a 7-day forecast queue, plus favorites and
// recent messages.
// ============================================================
function logisticLayout(): DashboardLayout {
  presetCounter = 0;
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    updatedAt: new Date().toISOString(),
    items: [
      makeInstance(
        "home.favorites",
        { cols: 2, rows: 1 },
        {
          title: "Favoritos",
          accent: { icon: "Star", color: "blue", borderColor: "blue" },
          density: "spacious",
          itemsPerRow: 6,
          itemsPerColumn: 1,
        },
      ),
      makeInstance(
        "home.recent-messages",
        { cols: 2, rows: 1 },
        {
          title: "Mensagens Recentes",
          accent: { icon: "Message", color: "indigo", borderColor: "indigo" },
          density: "compact",
          itemsPerRow: 4,
          itemsPerColumn: 1,
        },
      ),
      makeInstance(
        "home.production-calendar",
        { cols: 2, rows: 4 },
        {
          title: "Calendário de Produção",
          accent: { icon: "Calendar", color: "indigo", borderColor: "none" },
          display: {
            showTerm: true,
            showSunday: false,
            showFilters: true,
            showStarted: true,
            showFinished: true,
            showForecast: true,
            showSaturday: false,
          },
          filters: {
            statuses: [
              TASK_STATUS.PREPARATION,
              TASK_STATUS.WAITING_PRODUCTION,
              TASK_STATUS.IN_PRODUCTION,
              TASK_STATUS.COMPLETED,
            ],
            includeCancelled: false,
          },
        },
      ),
      makeInstance(
        "table.tasks",
        { cols: 2, rows: 2 },
        {
          title: "Tarefas em Execução",
          accent: { icon: "ClipboardText", color: "blue", borderColor: "blue" },
          columns: [
            "name",
            "serialNumber",
            "sector",
            "observation",
            "soLogistic",
            "hasArtworks",
            "term",
          ],
          columnLabels: {
            soLogistic: "OS Logística",
            soProduction: "OS Produção",
          },
          columnWidths: {},
          sort: { key: "term", direction: "asc" },
          sorts: [{ key: "term", direction: "asc" }],
          limit: 20,
          showHeader: true,
          display: {
            density: "comfortable",
            striping: true,
            gridLines: true,
            layoutMode: "flat",
            showRowDot: false,
            stickyHeader: true,
            showSearchBox: false,
            hoverHighlight: true,
            showViewAllLink: true,
            emptyStateMessage: "",
          },
          filters: {
            ...EMPTY_TASK_FILTERS,
            status: [TASK_STATUS.IN_PRODUCTION],
            termPreset: "overdue",
          },
          presets: [],
          behavior: { refetchIntervalMs: 0, viewAllRouteOverride: "" },
          cellModes: {
            paint: "swatch-name",
            status: "badge",
            serviceOrder: "progress-bar",
          },
          deadlineColors: {
            bold: true,
            enabled: true,
            termOnTrackColor: "green",
            termOverdueColor: "red",
            termCriticalColor: "amber",
            termCriticalHours: 4,
            forecastNoticeDays: 10,
            forecastNoticeColor: "yellow",
            forecastWarningDays: 7,
            forecastCriticalDays: 3,
            forecastWarningColor: "orange",
            forecastCriticalColor: "red",
          },
          rowClickTarget: "task",
        },
      ),
      makeInstance(
        "table.tasks",
        { cols: 2, rows: 2 },
        {
          title: "Tarefas Próximas",
          accent: {
            icon: "ClipboardText",
            color: "orange",
            borderColor: "orange",
          },
          columns: [
            "name",
            "serialNumber",
            "observation",
            "soLogistic",
            "hasArtworks",
            "forecastDate",
            "term",
          ],
          columnLabels: {
            soArtwork: "OS Arte",
            soLogistic: "OS Logistica",
          },
          columnWidths: {},
          sort: { key: "term", direction: "asc" },
          sorts: [{ key: "term", direction: "asc" }],
          limit: 20,
          showHeader: true,
          display: {
            density: "comfortable",
            striping: true,
            gridLines: true,
            layoutMode: "flat",
            showRowDot: false,
            stickyHeader: true,
            showSearchBox: false,
            hoverHighlight: true,
            showViewAllLink: true,
            emptyStateMessage: "",
          },
          filters: {
            ...EMPTY_TASK_FILTERS,
            forecastPreset: "next-7-days",
          },
          presets: [],
          behavior: { refetchIntervalMs: 0, viewAllRouteOverride: "" },
          cellModes: {
            paint: "swatch-name",
            status: "badge",
            serviceOrder: "progress-bar",
          },
          deadlineColors: {
            bold: true,
            enabled: true,
            termOnTrackColor: "green",
            termOverdueColor: "red",
            termCriticalColor: "amber",
            termCriticalHours: 4,
            forecastNoticeDays: 10,
            forecastNoticeColor: "yellow",
            forecastWarningDays: 7,
            forecastCriticalDays: 3,
            forecastWarningColor: "orange",
            forecastCriticalColor: "red",
          },
          rowClickTarget: "task",
        },
      ),
    ],
  };
}

// ============================================================
// COMMERCIAL
// ----------------------------------------------------------------
// Layout authored by kennedy.ankaa@gmail.com (2026-05-08) and saved
// as the sector default. Pairs quote-approval and billing-approval
// queues with the boletos pipeline; favorites and recent messages
// share the top row.
// ============================================================
function commercialLayout(): DashboardLayout {
  presetCounter = 0;
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    updatedAt: new Date().toISOString(),
    items: [
      makeInstance(
        "home.favorites",
        { cols: 2, rows: 1 },
        {
          title: "Favoritos",
          accent: { icon: "Star", color: "blue", borderColor: "blue" },
          density: "spacious",
          itemsPerRow: 6,
          itemsPerColumn: 1,
        },
      ),
      makeInstance(
        "home.recent-messages",
        { cols: 2, rows: 1 },
        {
          title: "Mensagens Recentes",
          accent: { icon: "Message", color: "indigo", borderColor: "indigo" },
          density: "compact",
          itemsPerRow: 4,
          itemsPerColumn: 1,
        },
      ),
      makeInstance(
        "table.tasks",
        { cols: 2, rows: 2 },
        {
          title: "Orçamentos Esperando Aprovação",
          accent: { icon: "ClipboardText", color: "gray", borderColor: "slate" },
          columns: [
            "name",
            "customerName",
            "serialNumber",
            "quoteTotal",
            "forecastDate",
          ],
          columnLabels: {},
          columnWidths: {},
          sort: { key: "term", direction: "asc" },
          sorts: [{ key: "term", direction: "asc" }],
          limit: 50,
          showHeader: true,
          display: {
            density: "comfortable",
            striping: true,
            gridLines: true,
            layoutMode: "flat",
            showRowDot: false,
            stickyHeader: true,
            showSearchBox: false,
            hoverHighlight: true,
            showViewAllLink: true,
            emptyStateMessage: "",
          },
          filters: {
            ...EMPTY_TASK_FILTERS,
            status: [TASK_STATUS.PREPARATION],
            hasBudget: "yes",
            quoteStatuses: ["PENDING"],
          },
          presets: [],
          behavior: { refetchIntervalMs: 0, viewAllRouteOverride: "" },
          cellModes: {
            paint: "swatch-name",
            status: "badge",
            serviceOrder: "progress-bar",
          },
          deadlineColors: {
            bold: true,
            enabled: true,
            termOnTrackColor: "green",
            termOverdueColor: "red",
            termCriticalColor: "amber",
            termCriticalHours: 4,
            forecastNoticeDays: 10,
            forecastNoticeColor: "yellow",
            forecastWarningDays: 7,
            forecastCriticalDays: 3,
            forecastWarningColor: "orange",
            forecastCriticalColor: "red",
          },
          rowClickTarget: "budget",
        },
      ),
      makeInstance(
        "table.tasks",
        { cols: 2, rows: 4 },
        {
          title: "Faturamento Aguardando Aprovação",
          accent: { icon: "ClipboardText", color: "red", borderColor: "red" },
          columns: ["name", "customerName", "serialNumber", "finishedAt"],
          columnLabels: {},
          columnWidths: {},
          sort: { key: "term", direction: "asc" },
          sorts: [{ key: "finishedAt", direction: "asc" }],
          limit: 50,
          showHeader: true,
          display: {
            density: "comfortable",
            striping: true,
            gridLines: true,
            layoutMode: "flat",
            showRowDot: false,
            stickyHeader: true,
            showSearchBox: false,
            hoverHighlight: true,
            showViewAllLink: true,
            emptyStateMessage: "",
          },
          filters: {
            ...EMPTY_TASK_FILTERS,
            status: [TASK_STATUS.COMPLETED],
            quoteStatuses: ["BUDGET_APPROVED"],
          },
          presets: [],
          behavior: { refetchIntervalMs: 0, viewAllRouteOverride: "" },
          cellModes: {
            paint: "swatch-name",
            status: "badge",
            serviceOrder: "progress-bar",
          },
          deadlineColors: {
            bold: false,
            enabled: false,
            termOnTrackColor: "green",
            termOverdueColor: "red",
            termCriticalColor: "amber",
            termCriticalHours: 4,
            forecastNoticeDays: 10,
            forecastNoticeColor: "yellow",
            forecastWarningDays: 7,
            forecastCriticalDays: 3,
            forecastWarningColor: "orange",
            forecastCriticalColor: "red",
          },
          rowClickTarget: "billing",
        },
      ),
      makeInstance(
        "financial.installments",
        { cols: 2, rows: 2 },
        {
          title: "Boletos",
          accent: { icon: "Receipt", color: "green", borderColor: "green" },
          columns: [
            "customer",
            "task",
            "dueDate",
            "amount",
            "installmentStatus",
          ],
          sort: { key: "dueDate", direction: "asc" },
          limit: 50,
          showHeader: true,
          display: {
            density: "comfortable",
            striping: true,
            gridLines: true,
            showCount: true,
            layoutMode: "flat",
            stickyHeader: true,
            showSearchBox: false,
            hoverHighlight: true,
            showBucketChips: false,
            showViewAllLink: true,
            emptyStateMessage: "",
          },
          filters: {
            customerIds: [],
            defaultBucket: "next-30-days",
            hideFullyPaid: false,
            bankSlipStatuses: [],
            hideMissingBankSlip: false,
            installmentStatuses: ["PENDING", "OVERDUE"],
          },
          refetchInterval: 0,
        },
      ),
    ],
  };
}

// ============================================================
// FINANCIAL
// ----------------------------------------------------------------
// Layout authored by kennedy.ankaa@gmail.com (2026-05-08) and saved
// as the sector default. Pairs the billing-approval queue (commercial-
// approved, finished tasks waiting on financial sign-off) with two
// installment views — upcoming/overdue and the most recent receipts.
// ============================================================
function financialLayout(): DashboardLayout {
  presetCounter = 0;
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    updatedAt: new Date().toISOString(),
    items: [
      makeInstance(
        "home.favorites",
        { cols: 2, rows: 1 },
        {
          title: "Favoritos",
          accent: { icon: "Star", color: "blue", borderColor: "blue" },
          density: "spacious",
          itemsPerRow: 6,
          itemsPerColumn: 1,
        },
      ),
      makeInstance(
        "home.recent-messages",
        { cols: 2, rows: 1 },
        {
          title: "Mensagens Recentes",
          accent: { icon: "Message", color: "indigo", borderColor: "indigo" },
          density: "compact",
          itemsPerRow: 4,
          itemsPerColumn: 1,
        },
      ),
      makeInstance(
        "table.tasks",
        { cols: 2, rows: 4 },
        {
          title: "Faturamento Aguardando Aprovação",
          accent: { icon: "ClipboardText", color: "red", borderColor: "red" },
          columns: ["name", "customerName", "serialNumber", "finishedAt"],
          columnLabels: {},
          columnWidths: {},
          sort: { key: "term", direction: "asc" },
          sorts: [{ key: "finishedAt", direction: "asc" }],
          limit: 50,
          showHeader: true,
          display: {
            density: "comfortable",
            striping: true,
            gridLines: true,
            layoutMode: "flat",
            showRowDot: false,
            stickyHeader: true,
            showSearchBox: false,
            hoverHighlight: true,
            showViewAllLink: true,
            emptyStateMessage: "",
          },
          filters: {
            ...EMPTY_TASK_FILTERS,
            status: [TASK_STATUS.COMPLETED],
            quoteStatuses: ["COMMERCIAL_APPROVED"],
          },
          presets: [],
          behavior: { refetchIntervalMs: 0, viewAllRouteOverride: "" },
          cellModes: {
            paint: "swatch-name",
            status: "badge",
            serviceOrder: "progress-bar",
          },
          deadlineColors: {
            bold: false,
            enabled: false,
            termOnTrackColor: "green",
            termOverdueColor: "red",
            termCriticalColor: "amber",
            termCriticalHours: 4,
            forecastNoticeDays: 10,
            forecastNoticeColor: "yellow",
            forecastWarningDays: 7,
            forecastCriticalDays: 3,
            forecastWarningColor: "orange",
            forecastCriticalColor: "red",
          },
          rowClickTarget: "billing",
        },
      ),
      makeInstance(
        "financial.installments",
        { cols: 2, rows: 2 },
        {
          title: "Próximos Boletos",
          accent: { icon: "Receipt", color: "yellow", borderColor: "amber" },
          columns: [
            "customer",
            "task",
            "dueDate",
            "amount",
            "installmentStatus",
          ],
          sort: { key: "dueDate", direction: "asc" },
          limit: 50,
          showHeader: true,
          display: {
            density: "comfortable",
            striping: true,
            gridLines: true,
            showCount: true,
            layoutMode: "flat",
            stickyHeader: true,
            showSearchBox: false,
            hoverHighlight: true,
            showBucketChips: false,
            showViewAllLink: true,
            emptyStateMessage: "",
          },
          filters: {
            customerIds: [],
            defaultBucket: "next-30-days",
            hideFullyPaid: false,
            bankSlipStatuses: [],
            hideMissingBankSlip: false,
            installmentStatuses: ["PENDING", "OVERDUE"],
          },
          refetchInterval: 0,
        },
      ),
      makeInstance(
        "financial.installments",
        { cols: 2, rows: 2 },
        {
          title: "Últimos Pagamentos Recebido",
          accent: { icon: "Receipt", color: "green", borderColor: "green" },
          columns: ["customer", "task", "installment", "dueDate", "paidAmount"],
          sort: { key: "dueDate", direction: "desc" },
          limit: 50,
          showHeader: true,
          display: {
            density: "comfortable",
            striping: true,
            gridLines: true,
            showCount: true,
            layoutMode: "flat",
            stickyHeader: true,
            showSearchBox: false,
            hoverHighlight: true,
            showBucketChips: false,
            showViewAllLink: true,
            emptyStateMessage: "",
          },
          filters: {
            customerIds: [],
            defaultBucket: "all",
            hideFullyPaid: false,
            bankSlipStatuses: [],
            hideMissingBankSlip: false,
            installmentStatuses: ["PAID"],
          },
          refetchInterval: 0,
        },
      ),
    ],
  };
}

// ============================================================
// HUMAN_RESOURCES + ADMIN
// ----------------------------------------------------------------
// Layout authored by kennedy.ankaa@gmail.com (2026-05-08) and saved
// as the sector default for both HR and Admin. The team-wide Ponto
// do Dia anchors a 1/2-width column; the right column stacks the
// HR requisitions queue above the PPE delivery queue. Favorites and
// recent messages share the top row.
// ============================================================
function hrAndAdminItems(): WidgetInstance[] {
  return [
    makeInstance(
      "home.favorites",
      { cols: 2, rows: 1 },
      {
        title: "Favoritos",
        accent: { icon: "Star", color: "blue", borderColor: "blue" },
        density: "spacious",
        itemsPerRow: 6,
        itemsPerColumn: 1,
      },
    ),
    makeInstance(
      "home.recent-messages",
      { cols: 2, rows: 1 },
      {
        title: "Mensagens Recentes",
        accent: { icon: "Message", color: "indigo", borderColor: "indigo" },
        density: "compact",
        itemsPerRow: 4,
        itemsPerColumn: 1,
      },
    ),
    makeInstance(
      "home.daily-ponto",
      { cols: 2, rows: 4 },
      {
        title: "Ponto do Dia",
        accent: { icon: "Clock24", color: "teal", borderColor: "teal" },
        columns: [
          "userName",
          "sectorName",
          "entrada1",
          "saida1",
          "entrada2",
          "saida2",
          "normais",
          "faltas",
        ],
        sort: { key: "userName", direction: "asc" },
        limit: 50,
        showHeader: true,
        display: {
          density: "comfortable",
          striping: true,
          gridLines: true,
          layoutMode: "flat",
          stickyHeader: true,
          showSearchBox: false,
          hoverHighlight: true,
          showViewAllLink: true,
          showDayNavigator: true,
          emptyStateMessage: "",
        },
        filters: {
          mode: "all",
          sectorNames: [],
          defaultSearch: "",
          positionNames: [],
        },
      },
    ),
    makeInstance(
      "table.hr-requests",
      { cols: 2, rows: 2 },
      {
        title: "Requisições de RH",
        accent: { icon: "Clock", color: "lime", borderColor: "lime" },
        display: {
          density: "comfortable",
          striping: true,
          gridLines: true,
          showSearchBox: false,
          hoverHighlight: true,
          emptyStateMessage: "",
        },
        filters: { tipos: [], estados: [0], searchingFor: "" },
        sort: { key: "dataSolicitacao", direction: "desc" },
        limit: 30,
        showHeader: true,
        showActionButtons: true,
      },
    ),
    makeInstance(
      "table.ppe-deliveries",
      { cols: 2, rows: 2 },
      {
        title: "Entregas de EPI",
        accent: { icon: "ClipboardCheck", color: "amber", borderColor: "amber" },
        columns: ["itemName", "userName", "quantity", "status", "scheduledDate"],
        display: {
          density: "comfortable",
          striping: true,
          gridLines: true,
          stickyHeader: true,
          showSearchBox: false,
          hoverHighlight: true,
          emptyStateMessage: "",
        },
        filters: {
          itemIds: [],
          userIds: [],
          statuses: [
            PPE_DELIVERY_STATUS.PENDING,
            PPE_DELIVERY_STATUS.WAITING_SIGNATURE,
          ],
          searchingFor: "",
          onlyActionable: false,
        },
        sort: { key: "createdAt", direction: "desc" },
        limit: 30,
        showHeader: true,
        showRowDot: false,
        showActionButtons: true,
      },
    ),
  ];
}

function hrLayout(): DashboardLayout {
  presetCounter = 0;
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    updatedAt: new Date().toISOString(),
    items: hrAndAdminItems(),
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
// Shares the HR layout (see hrAndAdminItems above): same widgets,
// same sizes, same filters. Admin and HR sectors land on the same
// default until either is split out.
// ============================================================
function adminLayout(): DashboardLayout {
  presetCounter = 0;
  return {
    version: DASHBOARD_LAYOUT_VERSION,
    updatedAt: new Date().toISOString(),
    items: hrAndAdminItems(),
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
