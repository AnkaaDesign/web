import { useCallback, useMemo, useRef, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  IconClipboardList,
  IconCalendarEvent,
  IconReceipt2,
  IconListCheck,
  IconNote,
  IconPaint,
  IconHistory,
  IconUsers,
  IconRulerMeasure,
  IconFiles,
  IconPhoto,
  IconScissors,
  IconBrush,
  IconCamera,
  IconPlayerPlay,
  IconCheck,
  IconEdit,
  IconExternalLink,
  IconDownload,
  IconEye,
  IconList,
  IconLayoutGrid,
} from "@tabler/icons-react";
import { DetailPage } from "@/components/ui/detailpage";
import type { DetailSectionDef, PersistedDetailConfig } from "@/components/ui/detailpage";
import type { PageAction } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileItem, useFileViewer, type FileViewMode } from "@/components/common/file";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { useTaskDetail, useTaskMutations, useForecastHistory, useRescheduleForecast } from "@/hooks/production/use-task";
import { useTaskSiblingIds } from "@/hooks/production/task/use-task-sibling-ids";
import { useCutsByTask } from "@/hooks/production/use-cut";
import { useAirbrushingsByTask } from "@/hooks/production/use-airbrushing";
import { useImplementMeasuresByTruck } from "@/hooks/administration/use-implement-measure";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { useCurrentUser } from "@/hooks/common/use-auth";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { taskQuoteService } from "@/api-client/task-quote";
import { invoiceKeys } from "@/hooks/production/use-invoice";
import { taskQuoteKeys } from "@/hooks/production/use-task-quote";
import { getCustomers } from "@/api-client/customer";
import { getSectors } from "@/api-client/sector";
import { isValidTaskStatusTransition, getTaskQuoteEditRoute } from "@/utils/task";
import { useReturnTo } from "@/hooks/common/use-return-to";
import { getAvailableQuoteStatusTransitions, canViewQuote, canUpdateQuoteStatus } from "@/utils/permissions/quote-permissions";
import { canEditTasks, canFinishTask, canViewAirbrushingFinancials as computeCanViewAirbrushingFinancials } from "@/utils/permissions/entity-permissions";
import { getVisibleServiceOrderTypes } from "@/utils/permissions/service-order-permissions";
import { areAllServiceOrdersComplete } from "@/utils/serviceOrder";
import { isTeamLeader } from "@/utils/user";
import { formatChassis, formatTruckSpot } from "@/utils";
import { ForecastHistoryTimeline } from "@/components/production/task/form/forecast-history-timeline";
import {
  routes,
  SECTOR_PRIVILEGES,
  TASK_STATUS,
  TASK_STATUS_LABELS,
  TASK_QUOTE_STATUS,
  TASK_QUOTE_STATUS_LABELS,
  BONIFICATION_STATUS,
  BONIFICATION_STATUS_LABELS,
  TRUCK_CATEGORY,
  TRUCK_CATEGORY_LABELS,
  IMPLEMENT_TYPE,
  IMPLEMENT_TYPE_LABELS,
  SERVICE_ORDER_TYPE_DISPLAY_ORDER,
  SERVICE_ORDER_TYPE_LABELS,
} from "@/constants";
import type { Task } from "@/types";
import { TaskWithServiceOrdersChangelog } from "@/components/ui/task-with-service-orders-changelog";
import { useConfirm } from "./use-confirm";
import { useReason } from "./use-reason";
import { TaskServiceOrderGroup } from "./service-orders-section";
import { QuoteBillingBreakdown } from "./sections/quote-billing-section";
import { PaintsSection } from "./sections/paints-section";
import { ResponsiblesSection } from "./sections/responsibles-section";
import { TruckImplementMeasureSection } from "./sections/truck-implement-measure-section";
import { LayoutsSection, getVisibleLayouts, downloadAllLayouts } from "./sections/layouts-section";
import { FilesSection, getVisibleTaskFiles, downloadAllTaskFiles } from "./sections/files-section";
import { CutsSection, downloadAllCuts } from "./sections/cuts-section";
import { AirbrushingsSection, downloadAllAirbrushingFiles, getAirbrushingFiles } from "./sections/airbrushings-section";
import { DossieSection, getDossieServiceOrders, countDossieFiles, downloadAllDossieFiles, exportTaskDossiePdf } from "./sections/dossie-section";

// Page audience — mirrors the legacy task-detail PrivilegeRoute (every production-adjacent sector).
const PAGE_PRIVILEGES = [
  SECTOR_PRIVILEGES.PRODUCTION,
  SECTOR_PRIVILEGES.WAREHOUSE,
  SECTOR_PRIVILEGES.DESIGNER,
  SECTOR_PRIVILEGES.FINANCIAL,
  SECTOR_PRIVILEGES.LOGISTIC,
  SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
  SECTOR_PRIVILEGES.PLOTTING,
  SECTOR_PRIVILEGES.COMMERCIAL,
  SECTOR_PRIVILEGES.ADMIN,
];

// Per-field inline-edit privilege sets — faithful port of the legacy `useTaskPermissions` field
// flags (ADMIN auto-passes via the gate, so it's never listed). These gate EDITING only; viewing is
// governed separately by `requiredPrivilege`.
//   IDENTITY (canEditIdentity excludes FINANCIAL, WAREHOUSE, DESIGNER)
const IDENTITY_EDIT_PRIVILEGES = [SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PRODUCTION_MANAGER];
//   SECTOR (canEditSector also excludes COMMERCIAL)
const SECTOR_EDIT_PRIVILEGES = [SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PRODUCTION_MANAGER];
//   BONIFICATION (canEditBonification excludes FINANCIAL, DESIGNER, LOGISTIC, PM, WAREHOUSE)
const BONIFICATION_EDIT_PRIVILEGES = [SECTOR_PRIVILEGES.COMMERCIAL];
//   DATES (canEditDates excludes WAREHOUSE, FINANCIAL, DESIGNER)
const DATE_EDIT_PRIVILEGES = [SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PRODUCTION_MANAGER];

// Per-status colors for the quote/faturamento status (TASK_QUOTE isn't in ENTITY_BADGE_CONFIG, so we
// map values → badge variants here — same palette as QuoteStatusBadge).
const QUOTE_STATUS_VARIANTS: Record<string, string> = {
  PENDING: "secondary",
  BUDGET_APPROVED: "processing",
  BILLING_APPROVED: "approved",
  UPCOMING: "pending",
  DUE: "destructive",
  PARTIAL: "inProgress",
  SETTLED: "completed",
  CANCELLED: "cancelled",
};

/** A section title with the item-count badge directly after it (left side, next to the title text). */
function titleWithCount(title: string, count: number) {
  return (
    <span className="flex items-center gap-2">
      {title}
      <Badge variant="secondary">{count}</Badge>
    </span>
  );
}

/** Controlled grid/list view-mode toggle — rendered in a section's headerActions (right side). */
function ViewToggle({ view, onChange }: { view: FileViewMode; onChange: (v: FileViewMode) => void }) {
  return (
    <div className="flex gap-1">
      <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => onChange("list")} className="h-7 w-7 p-0">
        <IconList className="h-3.5 w-3.5" />
      </Button>
      <Button variant={view === "grid" ? "default" : "outline"} size="sm" onClick={() => onChange("grid")} className="h-7 w-7 p-0">
        <IconLayoutGrid className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// Heavier than the list include, but matched to what the detail page actually renders. Truck layout
// objects are NOT pulled here — `useImplementMeasuresByTruck` (used by the layout section) fetches them, and the
// changelog only needs the scalar `*SideMeasureId` FKs that come with `truck: true`.
const DETAIL_INCLUDE = {
  customer: { include: { logo: true } },
  sector: true,
  responsibles: true,
  truck: true,
  createdBy: true,
  serviceOrders: { include: { assignedTo: true, checkinFiles: true, checkoutFiles: true } },
  baseFiles: true,
  projectFiles: true,
  layouts: { include: { file: true } },
  observation: { include: { files: true } },
  generalPainting: {
    include: {
      paintType: true,
      paintBrand: true,
      paintGrounds: { include: { groundPaint: { include: { paintType: true, paintBrand: true } } } },
    },
  },
  logoPaints: { include: { paintType: true, paintBrand: true } },
  quote: {
    include: {
      // `invoiceToCustomer` is needed to group line items per customer on multi-customer quotes —
      // a bare `services: true` overrides the API's default include and would blank those line items.
      services: { include: { invoiceToCustomer: true } },
      layoutFiles: true,
      customerConfigs: {
        include: {
          customer: { include: { logo: true } },
          installments: { orderBy: { number: "asc" } },
          responsible: true,
          customerSignature: true,
        },
      },
    },
  },
} as const;

// Every detail section id (SO sections are `so-${TYPE}`) — the basis for the per-sector default below.
const ALL_DETAIL_SECTION_IDS = [
  "overview", "dates", "quote",
  "so-COMMERCIAL", "so-ARTWORK", "so-LOGISTIC", "so-PRODUCTION",
  "layouts", "layout", "files", "cuts", "airbrushings", "observation", "paints", "dossie", "changelog",
] as const;

/** Build a detail config showing exactly `visible` (in that order), the rest hidden. Sections gated by
 *  `requiredPrivilege` (quote, changelog, …) or absent for lack of data are ignored by the engine, so
 *  listing/hiding them here is harmless. `overview` + `dates` are in every sector's list (never hidden). */
function detailSectorConfig(visible: string[]): Partial<PersistedDetailConfig> {
  const sectionVisibility: Record<string, boolean> = {};
  for (const id of ALL_DETAIL_SECTION_IDS) sectionVisibility[id] = visible.includes(id);
  return {
    sectionOrder: [...visible, ...ALL_DETAIL_SECTION_IDS.filter((id) => !visible.includes(id))],
    sectionVisibility,
  };
}

/**
 * Per-sector STARTING section layout for the task detail page — applied only when a user has no saved
 * config (precedence: localStorage > server config > THIS > hardcoded defaults), adopted on
 * "Restaurar padrão". Each sector leads with the sections its workflow cares about; ADMIN has no entry
 * and falls back to the authored defaults. Sections the sector can't access auto-drop.
 */
const TASK_DETAIL_SECTOR_DEFAULTS: Partial<Record<SECTOR_PRIVILEGES, Partial<PersistedDetailConfig>>> = {
  [SECTOR_PRIVILEGES.PRODUCTION]: detailSectorConfig(["overview", "so-PRODUCTION", "paints", "layout", "layouts", "cuts", "airbrushings", "files", "observation", "dates", "dossie"]),
  [SECTOR_PRIVILEGES.WAREHOUSE]: detailSectorConfig(["overview", "so-PRODUCTION", "paints", "layout", "files", "observation", "dates"]),
  [SECTOR_PRIVILEGES.LOGISTIC]: detailSectorConfig(["overview", "dates", "so-LOGISTIC", "so-PRODUCTION", "dossie", "layout", "files", "layouts", "observation"]),
  [SECTOR_PRIVILEGES.PRODUCTION_MANAGER]: detailSectorConfig(["overview", "dates", "so-PRODUCTION", "so-ARTWORK", "so-LOGISTIC", "so-COMMERCIAL", "layouts", "layout", "paints", "cuts", "files", "observation", "dossie", "quote", "changelog"]),
  [SECTOR_PRIVILEGES.COMMERCIAL]: detailSectorConfig(["overview", "quote", "dates", "so-COMMERCIAL", "so-ARTWORK", "layouts", "layout", "files", "observation"]),
  [SECTOR_PRIVILEGES.FINANCIAL]: detailSectorConfig(["quote", "overview", "dates", "airbrushings", "files"]),
  [SECTOR_PRIVILEGES.DESIGNER]: detailSectorConfig(["overview", "so-ARTWORK", "layouts", "layout", "cuts", "paints", "files", "dates", "so-PRODUCTION", "observation"]),
};

export function TaskDetailPage() {
  return (
    <PrivilegeRoute requiredPrivilege={PAGE_PRIVILEGES}>
      <TaskDetailContent />
    </PrivilegeRoute>
  );
}

function TaskDetailContent() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  // Snapshot of this page's URL, handed to the budget/billing detail so its
  // Save/Cancel return here instead of dropping the user on the budget list.
  const returnTo = useReturnTo();
  const queryClient = useQueryClient();

  // This page serves THREE detail routes — Agenda (/producao/agenda), Cronograma (/producao/cronograma)
  // and Histórico (/producao/historico). The section is derived from the URL so the breadcrumb, the
  // "Editar" destination, the prev/next paging, and the page-tracker icon stay source-aware (faithful
  // port of the legacy getBreadcrumbConfig). URL = /producao/<section>/detalhes/<id> → segment[2].
  const source = location.pathname.split("/")[2];
  const breadcrumbConfig = useMemo(() => {
    switch (source) {
      case "cronograma":
        return {
          label: "Cronograma",
          href: routes.production.schedule.list,
          editRoute: routes.production.schedule.edit,
          detailsRoute: routes.production.schedule.details,
          icon: "clipboard-list" as const,
        };
      case "historico":
        return {
          label: "Histórico",
          href: routes.production.history.root,
          editRoute: routes.production.history.edit,
          detailsRoute: routes.production.history.details,
          icon: "history" as const,
        };
      case "agenda":
      default:
        return {
          label: "Agenda",
          href: routes.production.preparation.root,
          editRoute: routes.production.preparation.edit,
          detailsRoute: routes.production.preparation.details,
          icon: "clipboard-list" as const,
        };
    }
  }, [source]);
  // Prev/next pager sibling ids. Fast-path = the ordered list handed in via location.state (arriving
  // from a filtered/sorted list); fallback = reconstructed from the source's canonical list query so the
  // pager ALWAYS renders even on refresh / Back / direct URL / new tab / deep-link / calendar / search.
  const stateIds = (location.state as { ids?: string[] } | null)?.ids;
  const siblingIds = useTaskSiblingIds(source, id ?? "", stateIds);

  const { data: user } = useCurrentUser();
  const { confirm, dialog } = useConfirm();
  const { ask: askReason, dialog: reasonDialog } = useReason();
  const { mutateAsync: rescheduleAsync } = useRescheduleForecast();

  const { data, isLoading, error } = useTaskDetail(id!, { include: DETAIL_INCLUDE as never });
  const task = (data as { data?: Task } | undefined)?.data ?? null;
  usePageTracker({ title: task ? `Tarefa: ${task.name}` : "Tarefa", icon: breadcrumbConfig.icon });

  const { data: cutsResponse } = useCutsByTask(
    { taskId: id!, filters: { include: { file: true }, orderBy: { createdAt: "desc" } } } as never,
    { enabled: !!id } as never,
  );
  const cuts = ((cutsResponse as { data?: unknown[] } | undefined)?.data ?? []) as never[];

  const { data: airbrushingsResponse } = useAirbrushingsByTask(
    {
      taskId: id!,
      params: { include: { layouts: { include: { file: true } }, receipts: true, invoices: true, painter: true }, orderBy: { createdAt: "desc" } },
    } as never,
    { enabled: !!id } as never,
  );
  const airbrushings = ((airbrushingsResponse as { data?: unknown[] } | undefined)?.data ?? []) as never[];

  // Truck dimensions (width × height in cm) derived from any available side layout — shown as a
  // read-only overview field so non-leader PRODUCTION (who can't see the gated layout section) still
  // get the vehicle size. Faithful port of the legacy `truckDimensions`/"Caminhão" overview row.
  const { data: truckLayouts } = useImplementMeasuresByTruck(task?.truck?.id || "", { enabled: !!task?.truck?.id });
  const truckDimensions = useMemo(() => {
    type SideLayout = { height: number; sections?: { width: number }[] };
    const sides = truckLayouts as { leftSideMeasure?: SideLayout; rightSideMeasure?: SideLayout; backSideMeasure?: SideLayout } | undefined;
    const layout = sides?.leftSideMeasure || sides?.rightSideMeasure || sides?.backSideMeasure;
    if (!layout) return null;
    const height = Math.round(layout.height * 100);
    const totalWidth = Math.round((layout.sections ?? []).reduce((sum, s) => sum + s.width * 100, 0));
    return { width: totalWidth, height };
  }, [truckLayouts]);

  const { updateAsync } = useTaskMutations();
  const role = ((user as { sector?: { privileges?: string } } | undefined)?.sector?.privileges ?? "") as SECTOR_PRIVILEGES;
  const currentUserId = (user as { id?: string } | undefined)?.id;

  const has = useCallback(
    (privs: SECTOR_PRIVILEGES[]) => role === SECTOR_PRIVILEGES.ADMIN || privs.includes(role),
    [role],
  );
  const canEdit = canEditTasks(user as never);
  const canFinish = canFinishTask(user as never);
  // Task-status state-machine capability (matches legacy useTaskPermissions): only admins/team-leaders
  // may push a task through production; only canFinish (ADMIN/PM/LOGISTIC) may complete it. Everyone
  // else (COMMERCIAL/DESIGNER/FINANCIAL) is locked to the current status — no transition.
  const isAdmin = role === SECTOR_PRIVILEGES.ADMIN;
  const isLeader = isTeamLeader(user as never);
  const canManageStatus = isAdmin || isLeader;
  const canEditQuote = canUpdateQuoteStatus(role);
  const showQuote = canViewQuote(role);
  const canViewBaseFiles = has([SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.DESIGNER]);
  const canViewProjectFiles = canViewBaseFiles;
  const canViewCheckinFiles = has([
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.LOGISTIC,
    SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
  ]);
  const canViewLayoutBadges = has([
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.LOGISTIC,
    SECTOR_PRIVILEGES.DESIGNER,
    SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
  ]);
  const canViewRestricted = canViewLayoutBadges; // responsibles / forecast
  const canViewLayout =
    has([SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PRODUCTION_MANAGER]) ||
    (role === SECTOR_PRIVILEGES.PRODUCTION && isTeamLeader(user as never));
  // Canonical airbrushing money-visibility gate (FINANCIAL / ACCOUNTING / ADMIN / COMMERCIAL) —
  // single source of truth shared with the list/detail/form. Do NOT re-derive an ad-hoc set here.
  const canViewAirbrushingFinancials = computeCanViewAirbrushingFinancials(user as never);
  const canAccessAirbrushingDetails = has([SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.COMMERCIAL]);
  const canAccessCustomerPages = has([SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.COMMERCIAL]);
  // Legacy hid ALL service-order cards from FINANCIAL (FINANCIAL_HIDDEN_SECTIONS), even though the
  // permission matrix would otherwise expose COMMERCIAL/LOGISTIC types — preserve that.
  const visibleSoTypes = useMemo(
    () => (role === SECTOR_PRIVILEGES.FINANCIAL ? [] : getVisibleServiceOrderTypes(role)),
    [role],
  );
  const canViewChangelog =
    role !== SECTOR_PRIVILEGES.WAREHOUSE &&
    role !== SECTOR_PRIVILEGES.FINANCIAL &&
    (role !== SECTOR_PRIVILEGES.PRODUCTION || isTeamLeader(user as never));

  // Grid/list view mode for the Layouts (layouts) and Arquivos (files) galleries — owned here so the
  // toggle can live in the section header actions (right side) while the section renders only the body.
  const [layoutsView, setLayoutsView] = useState<FileViewMode>("grid");
  const [filesView, setFilesView] = useState<FileViewMode>("grid");
  const [cutsView, setCutsView] = useState<FileViewMode>("grid");
  const [airbrushingsView, setAirbrushingsView] = useState<FileViewMode>("grid");

  // Quote-status reason (captured for a PENDING downgrade) is read by onCommit after beforeCommit.
  const quoteReasonRef = useRef<string | undefined>(undefined);
  // Forecast reschedule reason (captured by the reason dialog before the date commits).
  const forecastReasonRef = useRef<string | undefined>(undefined);

  const setTaskField = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!task) return;
      await updateAsync({ id: task.id, data: patch as never });
    },
    [task, updateAsync],
  );

  const changeStatus = useCallback(
    async (next: TASK_STATUS, extra: Record<string, unknown> = {}) => {
      if (!task) return;
      const ok = await confirm({
        title: "Confirmar mudança de status",
        description: `Alterar o status da tarefa para "${TASK_STATUS_LABELS[next]}"?`,
      });
      if (!ok) return;
      try {
        // setTaskField goes through the api client, which surfaces success/error notifications.
        await setTaskField({ status: next, ...extra });
      } catch {
        // already surfaced by the api client.
      }
    },
    [task, confirm, setTaskField],
  );

  const loadCustomers = useCallback(async (search: string, page = 1) => {
    const limit = 20;
    const res = (await getCustomers({ searchingFor: search, page, limit, orderBy: { fantasyName: "asc" } } as never)) as {
      data?: Array<{ id: string; fantasyName?: string; corporateName?: string }>;
    };
    const out = (res?.data ?? []).map((c) => ({ value: c.id, label: c.corporateName || c.fantasyName || c.id }));
    return { data: out, hasMore: out.length === limit };
  }, []);

  const loadSectors = useCallback(async (search: string, page = 1) => {
    const limit = 30;
    const res = (await getSectors({ searchingFor: search, page, limit, orderBy: { name: "asc" } } as never)) as {
      data?: Array<{ id: string; name?: string }>;
    };
    const out = (res?.data ?? []).map((s) => ({ value: s.id, label: s.name || s.id }));
    return { data: out, hasMore: out.length === limit };
  }, []);

  // Layouts the current user may see (badges-viewers see all; everyone else only APPROVED).
  const filteredLayouts = useMemo(() => {
    const arts = (task?.layouts ?? []) as Array<{ file?: unknown; status?: string }>;
    return arts.filter((a) => (a.file || (a as { filename?: string }).filename) && (canViewLayoutBadges || a.status === "APPROVED"));
  }, [task?.layouts, canViewLayoutBadges]);

  const hasLayout = !!(
    task?.truck &&
    ((task.truck as { leftSideMeasureId?: string }).leftSideMeasureId ||
      (task.truck as { rightSideMeasureId?: string }).rightSideMeasureId ||
      (task.truck as { backSideMeasureId?: string }).backSideMeasureId)
  );
  const hasDossie = useMemo(
    () =>
      (task?.serviceOrders ?? []).some(
        (so) =>
          so.type === "PRODUCTION" &&
          (((so as { checkinFiles?: unknown[] }).checkinFiles?.length ?? 0) > 0 ||
            ((so as { checkoutFiles?: unknown[] }).checkoutFiles?.length ?? 0) > 0),
      ),
    [task?.serviceOrders],
  );

  const sections = useMemo<DetailSectionDef<Task>[]>(() => {
    const quoteSpan: 1 | 2 = (task?.quote?.customerConfigs?.length ?? 0) >= 2 ? 2 : 1;
    return [
      {
        id: "overview",
        label: "Informações Gerais",
        icon: IconClipboardList,
        span: 1,
        fields: [
          {
            id: "name",
            label: "Logomarca",
            editablePrivilege: IDENTITY_EDIT_PRIVILEGES,
            accessor: (t) => t.name,
            edit: canEdit ? { get: (t) => t.name, onCommit: (v) => setTaskField({ name: (v as string) ?? "" }) } : undefined,
          },
          {
            id: "customer",
            label: "Razão Social",
            dataType: "relation",
            editablePrivilege: IDENTITY_EDIT_PRIVILEGES,
            accessor: (t) => t.customer?.corporateName || t.customer?.fantasyName || null,
            // Plain text so the row's double-click-to-edit works; a small icon (not the name) navigates.
            render: (t) =>
              t.customer ? (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <CustomerLogoDisplay
                    logo={t.customer.logo ?? null}
                    customerName={t.customer.corporateName || t.customer.fantasyName}
                    size="xs"
                    shape="rounded"
                    className="shrink-0"
                  />
                  <span className="truncate">{t.customer.corporateName || t.customer.fantasyName}</span>
                  {canAccessCustomerPages ? (
                    <button
                      type="button"
                      title="Ver cliente"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(routes.financial.customers.details(t.customer!.id));
                      }}
                      onDoubleClick={(e) => e.stopPropagation()}
                    >
                      <IconExternalLink className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
            edit: canEdit
              ? {
                  get: (t) => t.customerId,
                  loadOptions: loadCustomers,
                  options: task?.customer ? [{ value: task.customer.id, label: task.customer.corporateName || task.customer.fantasyName || "" }] : undefined,
                  placeholder: "Buscar cliente...",
                  onCommit: (v) => setTaskField({ customerId: (v as string) || null }),
                }
              : undefined,
          },
          {
            id: "sector",
            label: "Setor",
            dataType: "relation",
            editablePrivilege: SECTOR_EDIT_PRIVILEGES,
            accessor: (t) => t.sector?.name || null,
            render: (t) => <span>{t.sector?.name || "Indefinido"}</span>,
            edit: canEdit
              ? {
                  get: (t) => t.sectorId,
                  loadOptions: loadSectors,
                  options: task?.sector ? [{ value: task.sector.id, label: task.sector.name || "" }] : undefined,
                  placeholder: "Selecionar setor...",
                  onCommit: (v) => setTaskField({ sectorId: (v as string) || null }),
                }
              : undefined,
          },
          {
            id: "status",
            label: "Status",
            dataType: "enum",
            accessor: (t) => t.status,
            edit: canEdit
              ? {
                  get: (t) => t.status,
                  enum: {
                    values: Object.values(TASK_STATUS),
                    labels: TASK_STATUS_LABELS,
                    badgeEntity: "TASK",
                    // Capability-aware: forward production moves require canManageStatus, completing
                    // requires canFinish, and only valid state-machine transitions are offered. A user
                    // without the capability sees only the current status (the Set always keeps it).
                    transitions: (current) => {
                      const cur = current as TASK_STATUS;
                      const allowed: TASK_STATUS[] = [cur];
                      const add = (s: TASK_STATUS) => {
                        if (isValidTaskStatusTransition(cur, s) && !allowed.includes(s)) allowed.push(s);
                      };
                      if (canManageStatus) {
                        if (cur === TASK_STATUS.PREPARATION) add(TASK_STATUS.WAITING_PRODUCTION);
                        if (cur === TASK_STATUS.WAITING_PRODUCTION) add(TASK_STATUS.IN_PRODUCTION);
                      }
                      // Completing requires canFinish AND every (non-cancelled) service order done —
                      // matches the schedule/history/preparation surfaces' Finalizar gate.
                      if (canFinish && areAllServiceOrdersComplete(task?.serviceOrders)) add(TASK_STATUS.COMPLETED);
                      return allowed;
                    },
                  },
                  beforeCommit: (v) =>
                    confirm({
                      title: "Confirmar mudança de status",
                      description: `Alterar o status da tarefa para "${TASK_STATUS_LABELS[v as TASK_STATUS]}"?`,
                    }),
                  onCommit: (v) => setTaskField({ status: v as TASK_STATUS }),
                }
              : undefined,
          },
          {
            id: "bonification",
            label: "Bonificação",
            dataType: "enum",
            requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.PRODUCTION],
            editablePrivilege: BONIFICATION_EDIT_PRIVILEGES,
            accessor: (t) => t.bonification,
            edit: canEdit
              ? {
                  get: (t) => t.bonification,
                  enum: { values: Object.values(BONIFICATION_STATUS), labels: BONIFICATION_STATUS_LABELS, badgeEntity: "BONIFICATION_STATUS" },
                  onCommit: (v) => setTaskField({ bonification: v as BONIFICATION_STATUS }),
                }
              : undefined,
          },
          {
            id: "serialNumber",
            label: "Número de Série",
            editablePrivilege: IDENTITY_EDIT_PRIVILEGES,
            accessor: (t) => t.serialNumber,
            edit: canEdit ? { get: (t) => t.serialNumber, onCommit: (v) => setTaskField({ serialNumber: (v as string) || null }) } : undefined,
          },
          {
            id: "plate",
            label: "Placa",
            editablePrivilege: IDENTITY_EDIT_PRIVILEGES,
            accessor: (t) => t.truck?.plate || null,
            render: (t) => <span>{t.truck?.plate?.toUpperCase() || "—"}</span>,
            edit: canEdit && task?.truck ? { get: (t) => t.truck?.plate ?? "", onCommit: (v) => setTaskField({ truck: { plate: (v as string) || null } }) } : undefined,
          },
          {
            id: "chassisNumber",
            label: "Nº Chassi",
            editablePrivilege: IDENTITY_EDIT_PRIVILEGES,
            accessor: (t) => t.truck?.chassisNumber || null,
            render: (t) => <span>{t.truck?.chassisNumber ? formatChassis(t.truck.chassisNumber) : "—"}</span>,
            edit: canEdit && task?.truck ? { get: (t) => t.truck?.chassisNumber ?? "", onCommit: (v) => setTaskField({ truck: { chassisNumber: (v as string) || null } }) } : undefined,
          },
          {
            id: "truckCategory",
            label: "Categoria",
            dataType: "enum",
            editablePrivilege: IDENTITY_EDIT_PRIVILEGES,
            accessor: (t) => t.truck?.category || null,
            render: (t) => (t.truck?.category ? <span>{TRUCK_CATEGORY_LABELS[t.truck.category]}</span> : <span className="text-muted-foreground">—</span>),
            edit:
              canEdit && task?.truck
                ? {
                    get: (t) => t.truck?.category ?? null,
                    enum: { values: Object.values(TRUCK_CATEGORY), labels: TRUCK_CATEGORY_LABELS },
                    onCommit: (v) => setTaskField({ truck: { category: v } }),
                  }
                : undefined,
          },
          {
            id: "implementType",
            label: "Tipo de Implemento",
            dataType: "enum",
            editablePrivilege: IDENTITY_EDIT_PRIVILEGES,
            accessor: (t) => t.truck?.implementType || null,
            render: (t) => (t.truck?.implementType ? <span>{IMPLEMENT_TYPE_LABELS[t.truck.implementType]}</span> : <span className="text-muted-foreground">—</span>),
            edit:
              canEdit && task?.truck
                ? {
                    get: (t) => t.truck?.implementType ?? null,
                    enum: { values: Object.values(IMPLEMENT_TYPE), labels: IMPLEMENT_TYPE_LABELS },
                    onCommit: (v) => setTaskField({ truck: { implementType: v } }),
                  }
                : undefined,
          },
          {
            id: "vehicle",
            label: "Caminhão",
            // Read-only vehicle size (cm) from the truck's layout — available even to sectors that
            // can't open the gated layout section.
            accessor: () => (truckDimensions ? `${truckDimensions.width}cm × ${truckDimensions.height}cm` : null),
          },
          {
            id: "truckSpot",
            label: "Local",
            accessor: (t) => (t.truck as { spot?: string } | undefined)?.spot || null,
            render: (t) => {
              const spot = (t.truck as { spot?: string } | undefined)?.spot;
              return spot ? <span>{formatTruckSpot(spot)}</span> : <span className="text-muted-foreground">—</span>;
            },
          },
          {
            id: "details",
            label: "Detalhes",
            dataType: "textarea",
            editablePrivilege: IDENTITY_EDIT_PRIVILEGES,
            accessor: (t) => t.details,
            edit: canEdit ? { get: (t) => t.details, onCommit: (v) => setTaskField({ details: (v as string) || null }) } : undefined,
          },
        ],
        // Responsáveis live inside the general-info card (subheading) — gated like the legacy restricted fields.
        render: (t) =>
          canViewRestricted && (t.responsibles?.length ?? 0) > 0 ? (
            <div>
              <h4 className="mb-2 mt-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <IconUsers className="h-3.5 w-3.5" /> Responsáveis
              </h4>
              <ResponsiblesSection task={t} role={role} />
            </div>
          ) : null,
      },
      {
        id: "dates",
        label: "Datas",
        icon: IconCalendarEvent,
        span: 1,
        fields: [
          {
            id: "createdAt",
            label: "Criado",
            dataType: "datetime",
            accessor: (t) => t.createdAt,
            render: (t) => (
              <span className="text-right">
                {t.createdAt ? new Date(t.createdAt).toLocaleString("pt-BR") : "—"}
                {(t.createdBy as { name?: string } | undefined)?.name ? (
                  <span className="block text-xs text-muted-foreground">por {(t.createdBy as { name?: string }).name}</span>
                ) : null}
              </span>
            ),
          },
          {
            id: "forecastDate",
            label: "Previsão de Liberação",
            dataType: "datetime",
            requiredPrivilege: canViewRestricted ? undefined : [SECTOR_PRIVILEGES.ADMIN],
            editablePrivilege: DATE_EDIT_PRIVILEGES,
            accessor: (t) => t.forecastDate,
            // Inline (value right) like every other field; the reschedule history renders below the
            // date rows via the section's render body.
            render: (t) =>
              t.forecastDate ? (
                <span className="inline-flex items-center justify-end gap-2">
                  {t.cleared ? (
                    <Badge variant="processing" className="shrink-0">
                      Liberado
                    </Badge>
                  ) : null}
                  <span>{new Date(t.forecastDate).toLocaleString("pt-BR")}</span>
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
            // Changing the forecast prompts for an optional reschedule reason; with a reason it records
            // a reschedule (forecast history), otherwise it just updates the date.
            edit: canEdit
              ? {
                  get: (t) => t.forecastDate,
                  beforeCommit: async () => {
                    const reason = await askReason({
                      title: "Reagendar previsão",
                      description: "Deseja registrar um motivo para o reagendamento? (opcional)",
                      label: "Motivo",
                      placeholder: "Ex.: aguardando amostra de cor...",
                    });
                    if (reason === null) return false;
                    forecastReasonRef.current = reason.trim() || undefined;
                    return true;
                  },
                  onCommit: async (v) => {
                    if (!task) return;
                    const date = (v as Date) ?? null;
                    const reason = forecastReasonRef.current;
                    if (date && reason) {
                      await rescheduleAsync({ id: task.id, data: { forecastDate: date, reason } });
                    } else {
                      await setTaskField({ forecastDate: date });
                    }
                  },
                }
              : undefined,
          },
          {
            id: "entryDate",
            label: "Entrada",
            dataType: "datetime",
            editablePrivilege: DATE_EDIT_PRIVILEGES,
            accessor: (t) => t.entryDate,
            edit: canEdit ? { get: (t) => t.entryDate, onCommit: (v) => setTaskField({ entryDate: (v as Date) ?? null }) } : undefined,
          },
          {
            id: "term",
            label: "Prazo",
            dataType: "datetime",
            editablePrivilege: DATE_EDIT_PRIVILEGES,
            accessor: (t) => t.term,
            // Overdue terms (past due and not completed/cancelled) render red with "(Atrasado)".
            render: (t) => {
              if (!t.term) return <span className="text-muted-foreground">—</span>;
              const overdue =
                new Date(t.term).getTime() < Date.now() && t.status !== TASK_STATUS.COMPLETED && t.status !== TASK_STATUS.CANCELLED;
              return (
                <span className={overdue ? "font-medium text-red-500" : undefined}>
                  {new Date(t.term).toLocaleString("pt-BR")}
                  {overdue ? " (Atrasado)" : ""}
                </span>
              );
            },
            edit: canEdit ? { get: (t) => t.term, onCommit: (v) => setTaskField({ term: (v as Date) ?? null }) } : undefined,
          },
          { id: "startedAt", label: "Iniciado", dataType: "datetime", accessor: (t) => t.startedAt },
          { id: "finishedAt", label: "Finalizado", dataType: "datetime", accessor: (t) => t.finishedAt },
        ],
        // Reschedule history sits with the dates (just below the forecast/date rows).
        render: (t: Task) => <ForecastHistoryCollapsible taskId={t.id} />,
      },
      // Quote — status inline-editable (colored), value read-only; full billing breakdown below.
      ...(showQuote && task?.quote && (task.quote.services?.length ?? 0) > 0
        ? [
            {
              id: "quote",
              // Legacy toggled the title: a still-PENDING quote is an "Orçamento", once approved it
              // becomes "Faturamento".
              label: !task.quote.status || task.quote.status === TASK_QUOTE_STATUS.PENDING ? "Orçamento" : "Faturamento",
              icon: IconReceipt2,
              span: quoteSpan,
              // The "Faturamento" title opens the in-app quote/billing DETAIL page; the header
              // "Visualizar" action opens the PUBLIC, customer-facing quote view (by quote id) in a
              // new tab (faithful to the legacy Visualizar button).
              onTitleClick: (t: Task) => navigate(getTaskQuoteEditRoute(t), { state: { returnTo } }),
              headerActions: (t: Task) => {
                const q = t.quote;
                if (!q) return null;
                const custId = q.customerConfigs?.[0]?.customerId || "all";
                return (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => window.open(routes.customer.budget(custId, q.id), "_blank")}
                  >
                    <IconEye className="h-3.5 w-3.5" />
                    Visualizar
                  </Button>
                );
              },
              render: (t: Task) => <QuoteBillingBreakdown task={t} />,
              fields: [
                {
                  id: "quoteBudget",
                  label: "Orçamento Nº",
                  accessor: (t: Task) => (t.quote?.budgetNumber ? String(t.quote.budgetNumber).padStart(4, "0") : null),
                  render: (t: Task) =>
                    t.quote?.budgetNumber ? (
                      <button type="button" className="font-medium hover:underline" onClick={() => navigate(getTaskQuoteEditRoute(t), { state: { returnTo } })}>
                        {String(t.quote.budgetNumber).padStart(4, "0")}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    ),
                },
                {
                  id: "quoteValidade",
                  label: "Validade",
                  dataType: "date" as const,
                  accessor: (t: Task) => (t.quote as { expiresAt?: Date } | undefined)?.expiresAt ?? null,
                },
                {
                  id: "invoiceToCustomers",
                  // relation: without this the editor fell through to a TEXT input pre-filled with the
                  // raw customer UUID (the "Faturar Para shows the id on double-click" bug). `relation`
                  // routes it to the customer combobox; `currentOptions` resolves the current id → name
                  // so the trigger shows the customer name immediately, before loadCustomers resolves.
                  dataType: "relation" as const,
                  label: "Faturar Para",
                  requiredPrivilege: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.COMMERCIAL],
                  accessor: (t: Task) =>
                    (t.quote?.customerConfigs ?? [])
                      .map((c) => c.customer?.corporateName || c.customer?.fantasyName || "")
                      .filter(Boolean)
                      .join(", ") || null,
                  // Inline-editable ONLY for the single-customer (or unset) case: changing the customer
                  // reconciles the quote's lone customerConfig by upsert. Multi-customer billing splits
                  // stay display-only (changing one would lose the others' order numbers/installments).
                  edit:
                    canEdit && (task?.quote?.customerConfigs?.length ?? 0) <= 1
                      ? {
                          get: (t: Task) => t.quote?.customerConfigs?.[0]?.customerId ?? null,
                          currentOptions: (t: Task) => {
                            const c = t.quote?.customerConfigs?.[0]?.customer;
                            return c ? [{ value: c.id, label: c.corporateName || c.fantasyName || "" }] : [];
                          },
                          loadOptions: loadCustomers,
                          placeholder: "Buscar cliente...",
                          onCommit: async (v, t) => {
                            const quoteId = t.quote?.id;
                            if (!quoteId || !v) return;
                            await taskQuoteService.update(quoteId, { customerConfigs: [{ customerId: v as string }] });
                            await Promise.all([
                              queryClient.invalidateQueries({ queryKey: ["tasks"] }),
                              queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all }),
                            ]);
                          },
                        }
                      : undefined,
                  render: (t: Task) => {
                    const names = (t.quote?.customerConfigs ?? [])
                      .map((c) => c.customer?.corporateName || c.customer?.fantasyName || "")
                      .filter(Boolean);
                    if (!names.length) return <span className="text-muted-foreground">—</span>;
                    return (
                      <div className="flex flex-col items-end gap-0.5">
                        {names.map((n, i) => (
                          <span key={i} className="truncate">
                            {n}
                          </span>
                        ))}
                      </div>
                    );
                  },
                },
                {
                  id: "quoteStatus",
                  label: "Status",
                  dataType: "enum" as const,
                  accessor: (t: Task) => t.quote?.status,
                  edit: canEditQuote
                    ? {
                        get: (t: Task) => t.quote?.status ?? null,
                        enum: {
                          values: Object.values(TASK_QUOTE_STATUS),
                          labels: TASK_QUOTE_STATUS_LABELS,
                          variants: QUOTE_STATUS_VARIANTS,
                          transitions: (current: string) => [current, ...getAvailableQuoteStatusTransitions(current as TASK_QUOTE_STATUS, role)],
                        },
                        beforeCommit: async (v: unknown, t: Task) => {
                          quoteReasonRef.current = undefined;
                          const next = v as TASK_QUOTE_STATUS;
                          const current = t.quote?.status;
                          if (next === TASK_QUOTE_STATUS.BILLING_APPROVED) {
                            return confirm({
                              title: "Faturamento Aprovado — Ação Irreversível",
                              description:
                                "Serão geradas, automaticamente e de forma irreversível: faturas por cliente, boletos no Sicredi por parcela, e NFS-e por fatura. Confira valores, descontos, CNPJ/CPF e parcelas antes de confirmar.",
                              confirmLabel: "Confirmar Faturamento",
                              destructive: true,
                            });
                          }
                          if (next === TASK_QUOTE_STATUS.PARTIAL && current === TASK_QUOTE_STATUS.SETTLED) {
                            return confirm({ title: "Reverter para Parcial", description: "Indica estorno de pagamento. Confirma?" });
                          }
                          if (next === TASK_QUOTE_STATUS.PENDING && current && current !== TASK_QUOTE_STATUS.PENDING) {
                            const reason = await askReason({
                              title: "Rejeitar / reverter para Pendente",
                              description: "Informe o motivo (mínimo 5 caracteres).",
                              label: "Motivo",
                              placeholder: "Motivo da rejeição...",
                              required: true,
                              minLength: 5,
                              confirmLabel: "Confirmar",
                            });
                            if (reason === null) return false;
                            // Safety net — the dialog already blocks Confirm until the reason is ≥5 chars.
                            if (reason.trim().length < 5) return false;
                            quoteReasonRef.current = reason.trim();
                          }
                          return true;
                        },
                        onCommit: async (v: unknown, t: Task) => {
                          if (!t.quote) return;
                          await taskQuoteService.updateStatus(t.quote.id, v as string, quoteReasonRef.current);
                          // A raw axios PUT bypasses react-query — invalidate the task detail, quote and
                          // invoice caches so a status change (esp. the irreversible BILLING_APPROVED that
                          // mints invoices/boletos/NFS-e) is reflected instead of leaving the UI stale.
                          await Promise.all([
                            queryClient.invalidateQueries({ queryKey: ["tasks"] }),
                            queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all }),
                            queryClient.invalidateQueries({ queryKey: invoiceKeys.all }),
                          ]);
                        },
                      }
                    : undefined,
                },
              ],
            } as DetailSectionDef<Task>,
          ]
        : []),
      // Service orders — one card PER TYPE the user's sector may SEE (legacy getVisibleServiceOrderTypes),
      // each with the full status state-machine + per-assignment gate.
      ...SERVICE_ORDER_TYPE_DISPLAY_ORDER.filter(
        (type) => visibleSoTypes.includes(type) && task?.serviceOrders?.some((so) => so.type === type),
      ).map(
        (type) =>
          ({
            id: `so-${type}`,
            label: `Ordens de Serviço · ${SERVICE_ORDER_TYPE_LABELS[type]}`,
            icon: IconListCheck,
            span: 1 as const,
            render: (t: Task) => <TaskServiceOrderGroup task={t} type={type} role={role} currentUserId={currentUserId} />,
          }) as DetailSectionDef<Task>,
      ),
      // Medidas do Implemento (SVG layout preview).
      ...(hasLayout && canViewLayout
        ? [
            {
              id: "layout",
              label: "Medidas do Implemento",
              icon: IconRulerMeasure,
              span: 2 as const,
              render: (t: Task) => <TruckImplementMeasureSection truckId={t.truck!.id} taskName={t.name} />,
            } as DetailSectionDef<Task>,
          ]
        : []),
      // Layouts (layouts).
      ...(filteredLayouts.length > 0
        ? [
            {
              id: "layouts",
              label: titleWithCount("Layouts", filteredLayouts.length),
              icon: IconPhoto,
              span: 2 as const,
              headerActions: (t: Task) => {
                const arts = getVisibleLayouts(t, canViewLayoutBadges);
                return (
                  <>
                    {arts.length > 1 ? (
                      <Button variant="default" size="sm" className="h-7 gap-1 text-xs" onClick={() => void downloadAllLayouts(arts)}>
                        <IconDownload className="h-3.5 w-3.5" />
                        Baixar Todos
                      </Button>
                    ) : null}
                    <ViewToggle view={layoutsView} onChange={setLayoutsView} />
                  </>
                );
              },
              render: (t: Task) => <LayoutsSection task={t} canViewBadges={canViewLayoutBadges} view={layoutsView} />,
            } as DetailSectionDef<Task>,
          ]
        : []),
      // Arquivos (base + project).
      ...((canViewBaseFiles && (task?.baseFiles?.length ?? 0) > 0) || (canViewProjectFiles && (task?.projectFiles?.length ?? 0) > 0)
        ? [
            {
              id: "files",
              label: titleWithCount("Arquivos", getVisibleTaskFiles(task!, canViewBaseFiles, canViewProjectFiles).all.length),
              icon: IconFiles,
              span: 2 as const,
              headerActions: (t: Task) => {
                const { all } = getVisibleTaskFiles(t, canViewBaseFiles, canViewProjectFiles);
                return (
                  <>
                    {all.length > 1 ? (
                      <Button variant="default" size="sm" className="h-7 gap-1 text-xs" onClick={() => void downloadAllTaskFiles(all)}>
                        <IconDownload className="h-3.5 w-3.5" />
                        Baixar Todos
                      </Button>
                    ) : null}
                    <ViewToggle view={filesView} onChange={setFilesView} />
                  </>
                );
              },
              render: (t: Task) => <FilesSection task={t} canViewBase={canViewBaseFiles} canViewProject={canViewProjectFiles} view={filesView} />,
            } as DetailSectionDef<Task>,
          ]
        : []),
      // Recortes (cuts).
      ...(cuts.length > 0 && role !== SECTOR_PRIVILEGES.FINANCIAL
        ? [
            {
              id: "cuts",
              label: titleWithCount("Recortes", cuts.length),
              icon: IconScissors,
              span: 2 as const,
              // Clicking the section title opens the full cuts (Recortes) page.
              onTitleClick: () => navigate(routes.production.cutting.list),
              headerActions: (t: Task) => (
                <>
                  {cuts.length > 1 ? (
                    <Button variant="default" size="sm" className="h-7 gap-1 text-xs" onClick={() => void downloadAllCuts(cuts, t.name)}>
                      <IconDownload className="h-3.5 w-3.5" />
                      Baixar Todos
                    </Button>
                  ) : null}
                  <ViewToggle view={cutsView} onChange={setCutsView} />
                </>
              ),
              render: () => <CutsSection cuts={cuts} view={cutsView} />,
            } as DetailSectionDef<Task>,
          ]
        : []),
      // Aerografias (airbrushings).
      ...(airbrushings.length > 0
        ? [
            {
              id: "airbrushings",
              label: titleWithCount("Aerografias", airbrushings.length),
              icon: IconBrush,
              span: 2 as const,
              // Clicking the title opens the airbrushing's own page: its detail when there is a
              // single one, otherwise the full airbrushing list. Gated to viewers who can reach it.
              onTitleClick: canAccessAirbrushingDetails
                ? () =>
                    navigate(
                      airbrushings.length === 1
                        ? routes.production.airbrushings.details((airbrushings[0] as { id: string }).id)
                        : routes.production.airbrushings.list,
                    )
                : undefined,
              headerActions: (t: Task) => (
                <>
                  {getAirbrushingFiles(airbrushings, canViewAirbrushingFinancials).length > 1 ? (
                    <Button
                      variant="default"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      onClick={() => void downloadAllAirbrushingFiles(airbrushings, t.name, canViewAirbrushingFinancials)}
                    >
                      <IconDownload className="h-3.5 w-3.5" />
                      Baixar Todos
                    </Button>
                  ) : null}
                  <ViewToggle view={airbrushingsView} onChange={setAirbrushingsView} />
                </>
              ),
              render: () => (
                <AirbrushingsSection
                  airbrushings={airbrushings}
                  canViewFinancials={canViewAirbrushingFinancials}
                  canAccessDetails={canAccessAirbrushingDetails}
                  view={airbrushingsView}
                />
              ),
            } as DetailSectionDef<Task>,
          ]
        : []),
      // Observação (+ attached files).
      ...(task?.observation && role !== SECTOR_PRIVILEGES.FINANCIAL
        ? [
            {
              id: "observation",
              label: "Observação",
              icon: IconNote,
              span: 2 as const,
              render: (t: Task) => <ObservationBlock task={t} />,
            } as DetailSectionDef<Task>,
          ]
        : []),
      // Tintas.
      ...(task?.generalPainting || (task?.logoPaints?.length ?? 0) > 0
        ? [{ id: "paints", label: "Tintas", icon: IconPaint, span: 1 as const, render: (t: Task) => <PaintsSection task={t} /> } as DetailSectionDef<Task>]
        : []),
      // Dossiê (check-in/check-out photos).
      ...(hasDossie && canViewCheckinFiles
        ? [
            {
              id: "dossie",
              label: titleWithCount("Dossiê", countDossieFiles(getDossieServiceOrders(task!))),
              icon: IconCamera,
              span: 2 as const,
              headerActions: (t: Task) => {
                const sos = getDossieServiceOrders(t);
                const count = countDossieFiles(sos);
                return (
                  <>
                    {count > 1 ? (
                      <Button variant="default" size="sm" className="h-7 gap-1 text-xs" onClick={() => void downloadAllDossieFiles(sos)}>
                        <IconDownload className="h-3.5 w-3.5" />
                        Baixar Todos
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => exportTaskDossiePdf(t, sos)}>
                      <IconDownload className="h-3.5 w-3.5" />
                      PDF
                    </Button>
                  </>
                );
              },
              render: (t: Task) => <DossieSection task={t} />,
            } as DetailSectionDef<Task>,
          ]
        : []),
      // Histórico — hidden from WAREHOUSE / FINANCIAL / PRODUCTION non-leaders (legacy gating).
      ...(canViewChangelog
        ? [
            ({
        id: "changelog",
        label: "Histórico de Alterações",
        icon: IconHistory,
        span: 2,
        defaultVisible: false,
        scroll: true,
        render: (t: Task) => (
          <TaskWithServiceOrdersChangelog
            embedded
            taskId={t.id}
            taskName={`${t.name}${t.serialNumber ? ` — ${t.serialNumber}` : ""}`}
            taskCreatedAt={t.createdAt}
            serviceOrderIds={(t.serviceOrders ?? []).map((s) => s.id)}
            truckId={t.truck?.id}
            layoutIds={
              [
                (t.truck as { leftSideMeasureId?: string } | undefined)?.leftSideMeasureId,
                (t.truck as { rightSideMeasureId?: string } | undefined)?.rightSideMeasureId,
                (t.truck as { backSideMeasureId?: string } | undefined)?.backSideMeasureId,
              ].filter(Boolean) as string[]
            }
            quoteId={showQuote ? t.quote?.id : undefined}
            // Fill the bounded scroll section box (scroll: true) so the changelog fills the
            // capped height and scrolls internally instead of leaving dead space below it.
            className="h-full"
          />
        ),
      } as DetailSectionDef<Task>),
          ]
        : []),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    canEdit,
    canEditQuote,
    canManageStatus,
    canFinish,
    showQuote,
    role,
    currentUserId,
    task?.id,
    task?.quote?.id,
    task?.quote?.status,
    task?.quote?.services?.length,
    task?.quote?.customerConfigs?.length,
    task?.observation?.id,
    task?.truck?.id,
    truckDimensions,
    task?.serviceOrders?.length,
    // SO statuses gate the inline "Concluída" transition (areAllServiceOrdersComplete) — the array ref
    // changes on refetch (e.g. after an SO is completed), so recompute the closure then.
    task?.serviceOrders,
    task?.responsibles?.length,
    filteredLayouts.length,
    cuts.length,
    airbrushings.length,
    hasLayout,
    hasDossie,
    canViewLayout,
    canViewLayoutBadges,
    canViewBaseFiles,
    canViewCheckinFiles,
    canViewRestricted,
    visibleSoTypes,
    canViewChangelog,
    layoutsView,
    filesView,
    cutsView,
    airbrushingsView,
    setTaskField,
    confirm,
    askReason,
    rescheduleAsync,
    loadCustomers,
    loadSectors,
    returnTo,
  ]);

  const actions = useMemo<PageAction[]>(() => {
    if (!task || !canEdit) return [];
    const list: PageAction[] = [];
    if (task.status === TASK_STATUS.PREPARATION && role !== SECTOR_PRIVILEGES.COMMERCIAL) {
      list.push({ key: "disponibilizar", label: "Disponibilizar para Produção", icon: IconPlayerPlay, variant: "default", onClick: () => void changeStatus(TASK_STATUS.WAITING_PRODUCTION) });
    } else if (task.status === TASK_STATUS.WAITING_PRODUCTION) {
      list.push({ key: "iniciar", label: "Iniciar Produção", icon: IconPlayerPlay, variant: "default", onClick: () => void changeStatus(TASK_STATUS.IN_PRODUCTION, { startedAt: new Date() }) });
    }
    if (canFinish && task.status === TASK_STATUS.IN_PRODUCTION && areAllServiceOrdersComplete(task.serviceOrders)) {
      list.push({ key: "finalizar", label: "Finalizar", icon: IconCheck, variant: "default", onClick: () => void changeStatus(TASK_STATUS.COMPLETED, { finishedAt: new Date() }) });
    }
    list.push({
      key: "editar",
      label: "Editar",
      icon: IconEdit,
      variant: "default",
      onClick: () =>
        // Commercial users ALWAYS edit through the quote (orçamento/faturamento by quote status),
        // even for a quote-less task — getTaskQuoteEditRoute falls back to the budget page, where the
        // quote gets created. Prep-edit is reserved for the other sectors (admin/logistics/PM/etc.).
        role === SECTOR_PRIVILEGES.COMMERCIAL
          ? navigate(getTaskQuoteEditRoute(task), { state: { returnTo } })
          : // Forward the prev/next id list into the edit page so the pager survives the edit round-trip.
            navigate(breadcrumbConfig.editRoute(task.id), { state: { ids: siblingIds } }),
    });
    return list;
  }, [task, canEdit, canFinish, role, changeStatus, navigate, breadcrumbConfig, returnTo, siblingIds]);

  // Display-name fallback chain (faithful to the legacy getTaskDisplayName): name → customer →
  // "Série {serial}" → plate → "Sem nome". The serial is still appended to the page title when present.
  const taskDisplayName = task
    ? task.name ||
      task.customer?.corporateName ||
      (task.serialNumber ? `Série ${task.serialNumber}` : "") ||
      task.truck?.plate ||
      "Sem nome"
    : "Tarefa";
  const taskName = task ? `${taskDisplayName}${task.name && task.serialNumber ? ` — ${task.serialNumber}` : ""}` : "Tarefa";

  return (
    <>
      <DetailPage<Task>
        detailKey="task-detail"
        data={task}
        isLoading={isLoading}
        error={error ? "Erro ao carregar a tarefa." : undefined}
        sections={sections}
        sectorDefaults={TASK_DETAIL_SECTOR_DEFAULTS}
        title={taskName}
        icon={IconClipboardList}
        actions={actions}
        favoritePage={undefined}
        hideEmptyFields
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Produção", href: routes.production.root },
          { label: breadcrumbConfig.label, href: breadcrumbConfig.href },
          { label: "Detalhe" },
        ]}
        navigation={{
          ids: siblingIds,
          toRoute: (rid) => breadcrumbConfig.detailsRoute(rid),
        }}
      />
      {dialog}
      {reasonDialog}
    </>
  );
}

/** Reschedule history — only renders when there's at least one non-INITIAL forecast entry. */
function ForecastHistoryCollapsible({ taskId }: { taskId: string }) {
  const { data } = useForecastHistory(taskId);
  // A reschedule has a `previousDate` (the first time a forecast is set has none) — same rule the
  // timeline uses, so the collapsible only appears when there's actual reschedule history to show.
  const entries = ((data as { data?: Array<{ previousDate?: unknown }> } | undefined)?.data ?? []) as Array<{ previousDate?: unknown }>;
  if (!entries.some((e) => e.previousDate)) return null;
  return (
    // Stop the toggle gesture from reaching the forecast field's double-click-to-edit handler.
    <Collapsible className="mt-1" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <CollapsibleTrigger className="text-xs font-medium text-muted-foreground hover:text-foreground">
        Ver histórico de reagendamentos
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2">
        <ForecastHistoryTimeline taskId={taskId} />
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Observation text + any attached files (preview via the app-level file viewer). */
function ObservationBlock({ task }: { task: Task }) {
  const fileViewer = useFileViewer();
  const obs = task.observation as { description?: string; files?: Array<Record<string, unknown>> } | undefined;
  const files = obs?.files ?? [];
  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap rounded-md bg-yellow-500/10 p-3 text-sm">{obs?.description}</p>
      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map((f, i) => (
            <FileItem
              key={(f.id as string) ?? i}
              file={f as never}
              viewMode="grid"
              showActions={false}
              onPreview={() => fileViewer.actions?.viewFiles?.(files as never, i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
