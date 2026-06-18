// PPE delivery approval widget — for HR / ADMIN users to view, approve and
// reject pending PPE deliveries inline from the home dashboard.
//
// Mirrors the standalone /departamento-pessoal/epi/entregas list page but compact:
//   • Default filter: PENDING + WAITING_SIGNATURE (the actionable states)
//   • Inline action column with Approve (IconCircleCheck) / Reject (IconCircleX)
//   • Reject opens AlertDialog with a reason Textarea
//   • Buttons hidden when the current user lacks canManageHR privilege
//   • Row click navigates to the delivery's detail page
//   • Configurable density, striping, gridLines, hover, sticky header,
//     in-widget search box and empty-state message — same surface as Boletos.
//
// API: usePpeDeliveries (list), useBatchApprovePpeDeliveries / useBatchRejectPpeDeliveries
// (the same batch endpoints the list page uses; we just submit a single id).

import { useDeferredValue, useMemo, useState } from "react";
import { WidgetTabsBar } from "../components/config-kit";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import {
  IconShieldCheck,
  IconAdjustments,
  IconColumns,
  IconFilter,
  IconCircleCheck,
  IconCircleX,
  IconSearch,
} from "@tabler/icons-react";

import {
  PPE_DELIVERY_STATUS,
  PPE_DELIVERY_STATUS_LABELS,
  SECTOR_PRIVILEGES,
} from "../../constants";
import {
  usePpeDeliveries,
  useBatchApprovePpeDeliveries,
  useBatchRejectPpeDeliveries,
} from "../../hooks/human-resources/use-ppe";
import { useUsers } from "../../hooks/human-resources/use-user";
import { useItems } from "../../hooks/inventory/use-item";
import { usePrivileges } from "../../hooks/common/use-privileges";
import { routes } from "../../constants/routes";

import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Combobox } from "../../components/ui/combobox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../../components/ui/dropdown-menu";
import { Badge } from "../../components/ui/badge";
import { Textarea } from "../../components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { WidgetCard } from "../components/widget-card";
import { ColumnPicker, type ColumnSort } from "../components/column-picker";
import {
  AccentPicker,
  makeAccentSchema,
  resolveAccent,
} from "../components/widget-accent";
import type {
  WidgetAccentColor,
  WidgetAccentIcon,
  WidgetAccentShade,
} from "../components/widget-accent";
import type {
  WidgetConfigProps,
  WidgetDefinition,
  WidgetRenderProps,
} from "../types";
import {
  Section,
  SectionGroup,
  ToggleRow,
  LimitInput,
  DensitySegmented,
  densityClasses,
  makeTableDisplaySchema,
  TABLE_DISPLAY_DEFAULTS,
  type Density,
} from "./_shared";

// ============================================================
// Helpers
// ============================================================

function formatNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Number.isInteger(n)
    ? n.toLocaleString("pt-BR")
    : n.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
}
function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}
function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v) return [v];
  return [];
}

// ============================================================
// Status badge
// ============================================================

// Solid BADGE_COLORS palette (centralized in src/constants/badge-colors.ts):
//   pending → amber, approved → blue, delivered → cyan,
//   waiting-signature → orange, completed → green, reproved/rejected → red.
const STATUS_BADGE_TONES: Record<string, string> = {
  PENDING: "bg-amber-600 text-white border-amber-700",
  APPROVED: "bg-blue-700 text-white border-blue-800",
  DELIVERED: "bg-cyan-600 text-white border-cyan-700",
  WAITING_SIGNATURE: "bg-orange-600 text-white border-orange-700",
  COMPLETED: "bg-green-700 text-white border-green-800",
  REPROVED: "bg-red-700 text-white border-red-800",
  SIGNATURE_REJECTED: "bg-red-700 text-white border-red-800",
  CANCELLED: "bg-neutral-500 text-white border-neutral-600",
};

function StatusBadge({ status }: { status: PPE_DELIVERY_STATUS }) {
  const tone = STATUS_BADGE_TONES[status] ?? "border-border text-muted-foreground";
  return (
    <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${tone}`}>
      {PPE_DELIVERY_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

// ============================================================
// Column catalog
// ============================================================

type ColumnKey =
  | "itemUniCode"
  | "itemName"
  | "userName"
  | "userSector"
  | "quantity"
  | "status"
  | "scheduledDate"
  | "actualDeliveryDate"
  | "reviewedBy"
  | "reason"
  | "createdAt"
  | "updatedAt";

const COLUMN_KEY_VALUES = [
  "itemUniCode",
  "itemName",
  "userName",
  "userSector",
  "quantity",
  "status",
  "scheduledDate",
  "actualDeliveryDate",
  "reviewedBy",
  "reason",
  "createdAt",
  "updatedAt",
] as const;

interface ColumnDef {
  key: ColumnKey;
  label: string;
  track: string;
  render: (d: any) => React.ReactNode;
}

const COLUMN_CATALOG: ColumnDef[] = [
  {
    key: "itemUniCode",
    label: "Código",
    track: "minmax(0, 0.7fr)",
    render: (d) => (
      <span className="font-mono truncate">{d.item?.uniCode || "—"}</span>
    ),
  },
  {
    key: "itemName",
    label: "EPI",
    track: "minmax(0, 1.6fr)",
    render: (d) => <span className="truncate">{d.item?.name || "—"}</span>,
  },
  {
    key: "userName",
    label: "Colaborador",
    track: "minmax(0, 1.4fr)",
    render: (d) => <span className="truncate">{d.user?.name || "—"}</span>,
  },
  {
    key: "userSector",
    label: "Setor",
    track: "minmax(0, 1fr)",
    render: (d) => (
      <span className="truncate">{d.user?.sector?.name || "—"}</span>
    ),
  },
  {
    key: "quantity",
    label: "Qnt.",
    track: "minmax(0, 0.6fr)",
    render: (d) => (
      <span className="tabular-nums">{formatNumber(Number(d.quantity ?? 0))}</span>
    ),
  },
  {
    key: "status",
    label: "Status",
    track: "minmax(0, 1.2fr)",
    render: (d) => <StatusBadge status={d.status as PPE_DELIVERY_STATUS} />,
  },
  {
    key: "scheduledDate",
    label: "Agendado",
    track: "minmax(0, 1fr)",
    render: (d) => <span className="tabular-nums">{formatDate(d.scheduledDate)}</span>,
  },
  {
    key: "actualDeliveryDate",
    label: "Entregue",
    track: "minmax(0, 1fr)",
    render: (d) => (
      <span className="tabular-nums">{formatDate(d.actualDeliveryDate)}</span>
    ),
  },
  {
    key: "reviewedBy",
    label: "Revisado por",
    track: "minmax(0, 1.2fr)",
    render: (d) => (
      <span className="truncate">{d.reviewedByUser?.name || "—"}</span>
    ),
  },
  {
    key: "reason",
    label: "Motivo",
    track: "minmax(0, 1.4fr)",
    render: (d) => (
      <span className="text-muted-foreground truncate" title={d.reason}>
        {d.reason || "—"}
      </span>
    ),
  },
  {
    key: "createdAt",
    label: "Solicitado em",
    track: "minmax(0, 1fr)",
    render: (d) => <span className="tabular-nums">{formatDate(d.createdAt)}</span>,
  },
  {
    key: "updatedAt",
    label: "Atualizado em",
    track: "minmax(0, 1fr)",
    render: (d) => <span className="tabular-nums">{formatDate(d.updatedAt)}</span>,
  },
];

const COLUMN_BY_KEY: Record<ColumnKey, ColumnDef> = COLUMN_CATALOG.reduce(
  (acc, c) => {
    acc[c.key] = c;
    return acc;
  },
  {} as Record<ColumnKey, ColumnDef>,
);

// ============================================================
// Config schema
// ============================================================

const SORT_KEYS = [
  "createdAt",
  "scheduledDate",
  "actualDeliveryDate",
  "status",
  "itemName",
  "userName",
  "updatedAt",
] as const;

const SORT_KEY_TO_API: Record<(typeof SORT_KEYS)[number], string> = {
  createdAt: "createdAt",
  scheduledDate: "scheduledDate",
  actualDeliveryDate: "actualDeliveryDate",
  status: "statusOrder",
  itemName: "item.name",
  userName: "user.name",
  updatedAt: "updatedAt",
};

export const ppeDeliveryTableConfigSchema = z.object({
  title: z.string().min(1).max(80).default("Entregas de EPI"),
  accent: makeAccentSchema({
    color: "amber",
    icon: "ClipboardCheck",
  }),
  // Canonical cross-platform table display block. Previous defaults all matched
  // TABLE_DISPLAY_DEFAULTS (incl. showSearchBox=true, emptyStateMessage=""); the
  // factory additively contributes showColumnHeaders / showRowDot /
  // showViewAllLink / refreshIntervalMs.
  display: makeTableDisplaySchema(),
  columns: z
    .array(z.enum(COLUMN_KEY_VALUES))
    .min(1)
    .default(["itemName", "userName", "quantity", "status", "scheduledDate"]),
  filters: z
    .object({
      searchingFor: z.string().default(""),
      statuses: z
        .array(z.nativeEnum(PPE_DELIVERY_STATUS))
        .default([
          PPE_DELIVERY_STATUS.PENDING,
          PPE_DELIVERY_STATUS.WAITING_SIGNATURE,
        ]),
      itemIds: z.array(z.string().uuid()).default([]),
      userIds: z.array(z.string().uuid()).default([]),
      onlyActionable: z.boolean().default(false),
    })
    .default({
      searchingFor: "",
      statuses: [
        PPE_DELIVERY_STATUS.PENDING,
        PPE_DELIVERY_STATUS.WAITING_SIGNATURE,
      ],
      itemIds: [],
      userIds: [],
      onlyActionable: false,
    }),
  sorts: z
    .array(
      z.object({
        key: z.string(),
        direction: z.enum(["asc", "desc"]),
      }),
    )
    .default([{ key: "createdAt", direction: "desc" }]),
  limit: z.number().int().min(5).max(200).default(30),
  // showActionButtons removed — actions are now exposed via the right-click
  // context menu (mirrors the original list page).
});

export type PpeDeliveryTableConfig = z.infer<typeof ppeDeliveryTableConfigSchema>;

// ============================================================
// Query params
// ============================================================

function buildOrderBy(
  sorts: PpeDeliveryTableConfig["sorts"],
): Record<string, unknown>[] {
  return (sorts ?? []).map((s) => {
    const apiKey =
      (SORT_KEY_TO_API as Record<string, string>)[s.key] ?? s.key;
    if (apiKey.includes(".")) {
      const [rel, field] = apiKey.split(".");
      return { [rel]: { [field]: s.direction } };
    }
    return { [apiKey]: s.direction };
  });
}

function buildParams(
  config: PpeDeliveryTableConfig,
  liveSearch: string,
): Record<string, unknown> {
  const f = config.filters;
  const params: Record<string, unknown> = {
    take: config.limit,
    orderBy: buildOrderBy(config.sorts),
    include: {
      item: true,
      user: { include: { sector: true } },
      reviewedByUser: true,
    } as any,
  };

  const search = liveSearch || f.searchingFor;
  if (search) params.searchingFor = search;
  if (f.itemIds.length > 0) params.itemIds = f.itemIds;
  if (f.userIds.length > 0) params.userIds = f.userIds;

  const where: Record<string, unknown> = {};
  if (f.statuses.length > 0) {
    where.status = { in: f.statuses };
  }

  if (Object.keys(where).length > 0) params.where = where;
  return params;
}

// ============================================================
// Render
// ============================================================

const ACTIONABLE_STATUSES = new Set<PPE_DELIVERY_STATUS>([
  PPE_DELIVERY_STATUS.PENDING,
  PPE_DELIVERY_STATUS.WAITING_SIGNATURE,
]);

function PpeDeliveryTableRender({
  config,
}: WidgetRenderProps<PpeDeliveryTableConfig>) {
  const navigate = useNavigate();
  const display = config.display;
  const dens = densityClasses(display.density as Density);
  const { canManageHR } = usePrivileges();

  // Live in-widget search box (when display.showSearchBox is true).
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDeferredValue(searchInput);

  const params = useMemo(
    () => buildParams(config, display.showSearchBox ? debouncedSearch : ""),
    [config, debouncedSearch, display.showSearchBox],
  );

  const { data, isLoading, isError } = usePpeDeliveries(params as any);
  const allRows = (data?.data ?? []) as any[];

  const rows = useMemo(() => {
    if (!config.filters.onlyActionable) return allRows;
    return allRows.filter((d) => ACTIONABLE_STATUSES.has(d.status));
  }, [allRows, config.filters.onlyActionable]);

  const visibleCount = rows.length;

  const cols = useMemo(
    () => config.columns.map((k) => COLUMN_BY_KEY[k]).filter(Boolean),
    [config.columns],
  );
  const gridTemplate = cols.map((c) => c.track).join(" ");

  const accent = useMemo(
    () =>
      resolveAccent({
        color: config.accent?.color as WidgetAccentColor,
        icon: config.accent?.icon as WidgetAccentIcon,
        shade: config.accent?.shade as WidgetAccentShade | undefined,
      }),
    [config.accent?.color, config.accent?.icon, config.accent?.shade],
  );
  const AccentIcon = accent.Icon;

  // ---- Mutations + Reject dialog state ----
  const approveMutation = useBatchApprovePpeDeliveries();
  const rejectMutation = useBatchRejectPpeDeliveries();
  const [rejectTarget, setRejectTarget] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // ---- Right-click context menu (replaces inline action buttons) ----
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    delivery: any;
  } | null>(null);
  const canAct = canManageHR;

  const handleContextMenu = (e: React.MouseEvent, delivery: any) => {
    if (!canAct) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, delivery });
  };

  const onApprove = (deliveryId: string) => {
    approveMutation.mutate({ deliveryIds: [deliveryId] });
  };
  const onConfirmReject = () => {
    if (!rejectTarget) return;
    rejectMutation.mutate(
      {
        deliveryIds: [rejectTarget.id],
        reason: rejectReason.trim() || undefined,
      },
      {
        onSettled: () => {
          setRejectTarget(null);
          setRejectReason("");
        },
      },
    );
  };

  // ---- Header search box (lives in WidgetCard.headerExtra) ----
  const headerExtra = display.showSearchBox ? (
    <div className="relative">
      <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        value={searchInput}
        onChange={(v) => setSearchInput(typeof v === "string" ? v : "")}
        placeholder="Buscar..."
        className="h-7 pl-7 text-xs w-44"
      />
    </div>
  ) : undefined;

  // Hardcoded chrome — striping/hoverHighlight/gridLines no longer configurable.
  const rowBorder = "border-b border-border last:border-b-0";
  const rowHover = "hover:bg-secondary/50";
  const headerSticky = display.stickyHeader ? "sticky top-0 z-20" : "";

  return (
    <WidgetCard
      showHeader={config.display.showHeader ?? true}
      title={<span className={accent.classes.text}>{config.title}</span>}
      icon={<AccentIcon className={`h-4 w-4 ${accent.classes.icon}`} />}
      viewAllHref={
        (config.display.showViewAllLink ?? true)
          ? routes.humanResources.ppe.deliveries.root
          : undefined
      }
      headerExtra={headerExtra}
      count={(config.display.showCount ?? true) && !isLoading ? visibleCount : null}
      accentColor={config.accent?.color as WidgetAccentColor}
      accentShade={config.accent?.shade as WidgetAccentShade | undefined}
    >
      <>
        <div
          className={`${headerSticky} grid gap-x-3 ${dens.header} bg-muted/95 backdrop-blur-sm border-b border-border font-semibold uppercase tracking-wider text-muted-foreground`}
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {cols.map((c) => (
            <div key={c.key} className="truncate">
              {c.label}
            </div>
          ))}
        </div>

        {isLoading ? (
          <SkeletonRows
            columns={cols.length}
            count={6}
            gridTemplate={gridTemplate}
            rowClass={dens.row}
          />
        ) : isError ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Erro ao carregar entregas de EPI.
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {display.emptyStateMessage?.trim() ||
              "Nenhuma entrega encontrada com os filtros atuais."}
          </div>
        ) : (
          rows.map((d, i) => {
            // Striping is hardcoded ON.
            const stripeBg = i % 2 === 1 ? "bg-muted/20" : "";
            return (
              <div
                key={d.id}
                className={`grid gap-x-3 items-center ${dens.row} cursor-pointer ${rowBorder} ${rowHover} ${stripeBg} transition-colors`}
                style={{ gridTemplateColumns: gridTemplate }}
                onClick={() =>
                  navigate(routes.humanResources.ppe.deliveries.details(d.id))
                }
                onContextMenu={(e) => handleContextMenu(e, d)}
              >
                {cols.map((c) => (
                  <div key={c.key} className="min-w-0 overflow-hidden">
                    {c.render(d)}
                  </div>
                ))}
              </div>
            );
          })
        )}

        {/* Right-click action menu — approve / reject. Only visible to users
            with HR/Admin privileges (canManageHR). Mirrors the original list
            page's pattern (controlled `open` + Radix's built-in outside-click
            and item-click handling — no manual document listener needed). */}
        <DropdownMenu
          open={!!contextMenu}
          onOpenChange={(open) => !open && setContextMenu(null)}
        >
          <DropdownMenuContent
            style={{
              position: "fixed",
              left: contextMenu?.x,
              top: contextMenu?.y,
            }}
            className="w-56"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DropdownMenuItem
              onClick={() =>
                contextMenu &&
                navigate(routes.humanResources.ppe.deliveries.details(contextMenu.delivery.id))
              }
            >
              <IconCircleCheck className="mr-2 h-4 w-4 opacity-0" />
              Abrir detalhes
            </DropdownMenuItem>
            {contextMenu?.delivery.status === PPE_DELIVERY_STATUS.PENDING && (
              <DropdownMenuItem
                onClick={() => onApprove(contextMenu.delivery.id)}
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                <IconCircleCheck className="mr-2 h-4 w-4 text-green-700" />
                Aprovar entrega
              </DropdownMenuItem>
            )}
            {(contextMenu?.delivery.status === PPE_DELIVERY_STATUS.PENDING ||
              contextMenu?.delivery.status === PPE_DELIVERY_STATUS.APPROVED) && (
              <DropdownMenuItem
                onClick={() => {
                  setRejectTarget({
                    id: contextMenu.delivery.id,
                    label:
                      contextMenu.delivery.item?.name ||
                      contextMenu.delivery.item?.uniCode ||
                      contextMenu.delivery.id,
                  });
                  setRejectReason("");
                }}
                disabled={approveMutation.isPending || rejectMutation.isPending}
              >
                <IconCircleX className="mr-2 h-4 w-4 text-destructive" />
                Reprovar entrega
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog
          open={!!rejectTarget}
          onOpenChange={(open) => {
            if (!open) {
              setRejectTarget(null);
              setRejectReason("");
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reprovar entrega de EPI</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja reprovar a entrega de{" "}
                <span className="font-medium text-foreground">
                  {rejectTarget?.label}
                </span>
                ? Você pode adicionar um motivo opcional abaixo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label className="text-xs">Motivo (opcional)</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ex.: tamanho incorreto, item indisponível..."
                rows={3}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={rejectMutation.isPending}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={onConfirmReject}
                disabled={rejectMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Reprovar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    </WidgetCard>
  );
}

function SkeletonRows({
  columns,
  count,
  gridTemplate,
  rowClass,
}: {
  columns: number;
  count: number;
  gridTemplate: string;
  rowClass: string;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`grid gap-x-3 items-center ${rowClass} border-b border-border last:border-b-0`}
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {Array.from({ length: columns }).map((__, j) => (
            <div
              key={j}
              className="h-3 rounded bg-muted/60 animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      ))}
    </>
  );
}

// ============================================================
// Configure UI
// ============================================================

const PPE_STATUS_OPTIONS = (
  Object.values(PPE_DELIVERY_STATUS) as PPE_DELIVERY_STATUS[]
).map((s) => ({
  value: s,
  label: PPE_DELIVERY_STATUS_LABELS[s] ?? s,
}));

function PpeDeliveryTableConfigComponent({
  config,
  onChange,
}: WidgetConfigProps<PpeDeliveryTableConfig>) {
  const c = config;
  const set = <K extends keyof PpeDeliveryTableConfig>(
    key: K,
    value: PpeDeliveryTableConfig[K],
  ) => onChange({ ...c, [key]: value });
  const setDisplay = <K extends keyof PpeDeliveryTableConfig["display"]>(
    key: K,
    value: PpeDeliveryTableConfig["display"][K],
  ) => onChange({ ...c, display: { ...c.display, [key]: value } });
  const setFilter = <K extends keyof PpeDeliveryTableConfig["filters"]>(
    key: K,
    value: PpeDeliveryTableConfig["filters"][K],
  ) => onChange({ ...c, filters: { ...c.filters, [key]: value } });
  // Sort state is now driven by the column-picker's per-row chips.

  const { data: usersData } = useUsers({ orderBy: { name: "asc" } } as any);
  const { data: itemsData } = useItems({
    orderBy: { name: "asc" },
    take: 200,
  } as any);

  const userOptions = useMemo(
    () =>
      ((usersData?.data ?? []) as any[]).map((u) => ({
        value: u.id,
        label: u.name,
      })),
    [usersData?.data],
  );
  const itemOptions = useMemo(
    () =>
      ((itemsData?.data ?? []) as any[]).map((i) => ({
        value: i.id,
        label: i.uniCode ? `${i.uniCode} — ${i.name}` : i.name,
      })),
    [itemsData?.data],
  );

  const currentAccentColor = (c.accent?.color ?? "amber") as WidgetAccentColor;
  const currentAccentIcon = (c.accent?.icon ?? "ClipboardCheck") as WidgetAccentIcon;
  const currentAccentShade = (c.accent?.shade ?? "500") as WidgetAccentShade;

  return (
    <div className="space-y-3">
      <Tabs defaultValue="appearance" className="flex flex-col gap-2">
        <WidgetTabsBar><TabsList className="self-start">
          <TabsTrigger value="appearance" className="gap-1">
            <IconAdjustments className="h-3.5 w-3.5" /> Aparência
          </TabsTrigger>
          <TabsTrigger value="columns" className="gap-1">
            <IconColumns className="h-3.5 w-3.5" /> Colunas e ordenação
          </TabsTrigger>
          <TabsTrigger value="filters" className="gap-1">
            <IconFilter className="h-3.5 w-3.5" /> Filtros
          </TabsTrigger>
        </TabsList></WidgetTabsBar>

        {/* ---- APPEARANCE ---- */}
        <TabsContent value="appearance" className="space-y-3 mt-0">
          <SectionGroup defaultOpenId={null}>
            <Section title="Destaque (cor e ícone)" defaultOpen>
              <AccentPicker
                value={{
                  color: currentAccentColor,
                  icon: currentAccentIcon,
                  shade: currentAccentShade,
                }}
                onChange={(next) =>
                  set("accent", {
                    color: next.color || currentAccentColor,
                    icon: next.icon || currentAccentIcon,
                    shade: next.shade || currentAccentShade,
                  } as PpeDeliveryTableConfig["accent"])
                }
              />
            </Section>
            <Section title="Densidade e linhas">
              <div className="space-y-2">
                <DensitySegmented
                  value={c.display.density}
                  onChange={(d) => setDisplay("density", d)}
                />
              </div>
            </Section>
            <Section title="Cabeçalho e link">
              <div className="space-y-1">
                <ToggleRow
                  label="Exibir cabeçalho"
                  checked={c.display.showHeader ?? true}
                  onCheckedChange={(v) => setDisplay("showHeader", v)}
                />
                <ToggleRow
                  label="Cabeçalho fixo"
                  checked={c.display.stickyHeader}
                  onCheckedChange={(v) => setDisplay("stickyHeader", v)}
                />
                <ToggleRow
                  label="Exibir contagem"
                  checked={c.display.showCount ?? true}
                  onCheckedChange={(v) => setDisplay("showCount", v)}
                />
                <ToggleRow
                  label="Caixa de busca"
                  checked={c.display.showSearchBox}
                  onCheckedChange={(v) => setDisplay("showSearchBox", v)}
                />
                <ToggleRow
                  label='Link "Ver todos"'
                  checked={c.display.showViewAllLink ?? true}
                  onCheckedChange={(v) => setDisplay("showViewAllLink", v)}
                />
              </div>
            </Section>
            <Section title="Mensagem quando vazio">
              <Input
                value={c.display.emptyStateMessage}
                onChange={(v) =>
                  setDisplay("emptyStateMessage", typeof v === "string" ? v : "")
                }
                placeholder="Nenhuma entrega encontrada com os filtros atuais."
              />
            </Section>
          </SectionGroup>
        </TabsContent>

        {/* ---- COLUMNS & SORTING ---- */}
        <TabsContent value="columns" className="space-y-3 mt-0">
          <ColumnPicker
            catalog={COLUMN_CATALOG.map((col) => ({
              key: col.key,
              label: col.label,
            }))}
            selected={c.columns}
            onChange={(next) =>
              set("columns", next as PpeDeliveryTableConfig["columns"])
            }
            sorts={c.sorts as ColumnSort<ColumnKey>[]}
            onSortsChange={(next) =>
              set("sorts", next as PpeDeliveryTableConfig["sorts"])
            }
          />
          <LimitInput value={c.limit} onChange={(n) => set("limit", n)} />
        </TabsContent>

        {/* ---- FILTERS ---- */}
        <TabsContent value="filters" className="space-y-2.5 mt-0">
          <div className="space-y-1.5">
            <Label className="text-xs">Busca padrão</Label>
            <Input
              value={c.filters.searchingFor}
              onChange={(v) =>
                setFilter("searchingFor", typeof v === "string" ? v : "")
              }
              placeholder="EPI, código, colaborador..."
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Aplicado sempre. A caixa de busca em tempo real (se ativada)
              prevalece.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Combobox
              mode="multiple"
              value={c.filters.statuses}
              onValueChange={(v) =>
                setFilter("statuses", asArray(v) as PPE_DELIVERY_STATUS[])
              }
              options={PPE_STATUS_OPTIONS}
              placeholder="Todos os status"
              searchPlaceholder="Buscar status..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">EPIs</Label>
            <Combobox
              mode="multiple"
              value={c.filters.itemIds}
              onValueChange={(v) => setFilter("itemIds", asArray(v))}
              options={itemOptions}
              placeholder="Todos os EPIs"
              searchPlaceholder="Buscar EPI..."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Colaboradores</Label>
            <Combobox
              mode="multiple"
              value={c.filters.userIds}
              onValueChange={(v) => setFilter("userIds", asArray(v))}
              options={userOptions}
              placeholder="Todos os colaboradores"
              searchPlaceholder="Buscar colaborador..."
            />
          </div>
          <ToggleRow
            label="Apenas acionáveis"
            hint="Mostra somente entregas com status PENDENTE ou AGUARDANDO ASSINATURA."
            checked={c.filters.onlyActionable}
            onCheckedChange={(v) => setFilter("onlyActionable", v)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Definition
// ============================================================

export const ppeDeliveryTableWidget: WidgetDefinition<PpeDeliveryTableConfig> = {
  id: "table.ppe-deliveries",
  name: "Entregas de EPI",
  description:
    "Aprove, reprove ou registre a entrega de EPIs direto do dashboard. RH e Admin aprovam/reprovam solicitações; o estoque registra a entrega física.",
  icon: IconShieldCheck,
  category: "hr",
  // PPE is a shared concern: HR/Admin approve the request, Warehouse records
  // the physical delivery. Each sector still sees only the actions it can take
  // (action-button visibility is gated inline at render time).
  allowedSectors: [
    SECTOR_PRIVILEGES.HUMAN_RESOURCES,
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.WAREHOUSE,
  ],
  defaultSize: { cols: 4, rows: 2 },
  minSize: { cols: 2, rows: 1 },
  maxSize: { cols: 4, rows: 4 },
  configSchema: ppeDeliveryTableConfigSchema,
  defaultConfig: {
    title: "Entregas de EPI",
    accent: { color: "amber", icon: "ClipboardCheck" },
    display: { ...TABLE_DISPLAY_DEFAULTS },
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
    sorts: [{ key: "createdAt", direction: "desc" }],
    limit: 30,
  },
  RenderComponent: PpeDeliveryTableRender,
  ConfigComponent: PpeDeliveryTableConfigComponent,
};
