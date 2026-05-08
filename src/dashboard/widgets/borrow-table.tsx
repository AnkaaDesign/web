// Borrowed-items widget — mirrors the standalone /estoque/emprestimos list page
// as a configurable home-dashboard tile. Each instance saves its own choice of
// title, columns, filters, sort, limit and accent.
//
// Data source: useBorrows() with the same `where` shape and helper params the
// list page uses. Combobox is used for every dropdown to match the rest of the
// dashboard table widgets.

import { useMemo } from "react";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import {
  IconPackage,
  IconAdjustments,
  IconColumns,
  IconFilter,
} from "@tabler/icons-react";

import { BORROW_STATUS, BORROW_STATUS_LABELS, SECTOR_PRIVILEGES } from "../../constants";
import { useBorrows } from "../../hooks/inventory/use-borrow";
import { useItemBrands } from "../../hooks/inventory/use-item-brand";
import { useItemCategories } from "../../hooks/inventory/use-item-category";
import { useItems } from "../../hooks/inventory/use-item";
import { useUsers } from "../../hooks/human-resources/use-user";
import { routes } from "../../constants/routes";

import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Combobox } from "../../components/ui/combobox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";

import { WidgetCard } from "../components/widget-card";
import { ColumnPicker } from "../components/column-picker";
import {
  AccentPicker,
  makeAccentSchema,
  resolveAccent,
} from "../components/widget-accent";
import type {
  WidgetAccentColor,
  WidgetAccentIcon,
  WidgetBorderColor,
} from "../components/widget-accent";
import type {
  WidgetConfigProps,
  WidgetDefinition,
  WidgetRenderProps,
} from "../types";
import {
  Section,
  ToggleRow,
  LimitInput,
  SORT_DIRECTION_OPTIONS,
  DENSITY_VALUES,
  DENSITY_OPTIONS,
  densityClasses,
  type Density,
} from "./_shared";

import { BorrowStatusBadge } from "../../components/inventory/borrow/common/borrow-status-badge";
import { Badge } from "../../components/ui/badge";

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

function daysSince(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  const t = new Date(d).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = Date.now() - t;
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
}

function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v) return [v];
  return [];
}

// ============================================================
// Column catalog
// ============================================================

type ColumnKey =
  | "itemUniCode"
  | "itemName"
  | "itemBrand"
  | "itemCategory"
  | "userName"
  | "userSector"
  | "quantity"
  | "status"
  | "borrowedAt"
  | "returnedAt"
  | "daysOutstanding"
  | "updatedAt";

const COLUMN_KEY_VALUES = [
  "itemUniCode",
  "itemName",
  "itemBrand",
  "itemCategory",
  "userName",
  "userSector",
  "quantity",
  "status",
  "borrowedAt",
  "returnedAt",
  "daysOutstanding",
  "updatedAt",
] as const;

interface ColumnDef {
  key: ColumnKey;
  label: string;
  track: string;
  render: (b: any) => React.ReactNode;
}

const COLUMN_CATALOG: ColumnDef[] = [
  {
    key: "itemUniCode",
    label: "Código",
    track: "minmax(0, 0.7fr)",
    render: (b) => (
      <span className="text-sm font-mono truncate">
        {b.item?.uniCode || "—"}
      </span>
    ),
  },
  {
    key: "itemName",
    label: "Item",
    track: "minmax(0, 1.6fr)",
    render: (b) => (
      <span className="text-sm truncate">{b.item?.name || "—"}</span>
    ),
  },
  {
    key: "itemBrand",
    label: "Marca",
    track: "minmax(0, 1fr)",
    render: (b) => (
      <span className="text-sm truncate">{b.item?.brand?.name || "—"}</span>
    ),
  },
  {
    key: "itemCategory",
    label: "Categoria",
    track: "minmax(0, 1fr)",
    render: (b) => (
      <span className="text-sm truncate">
        {b.item?.category?.name || "—"}
      </span>
    ),
  },
  {
    key: "userName",
    label: "Usuário",
    track: "minmax(0, 1.3fr)",
    render: (b) => (
      <span className="text-sm truncate">{b.user?.name || "—"}</span>
    ),
  },
  {
    key: "userSector",
    label: "Setor",
    track: "minmax(0, 1fr)",
    render: (b) => (
      <span className="text-sm truncate">
        {b.user?.sector?.name || "—"}
      </span>
    ),
  },
  {
    key: "quantity",
    label: "Qnt.",
    track: "minmax(0, 0.6fr)",
    render: (b) => (
      <span className="text-sm tabular-nums">
        {formatNumber(Number(b.quantity ?? 0))}
      </span>
    ),
  },
  {
    key: "status",
    label: "Status",
    track: "minmax(0, 1.1fr)",
    render: (b) => {
      const isOverdue =
        b.status === BORROW_STATUS.ACTIVE && (daysSince(b.createdAt) ?? 0) > 30;
      return (
        <BorrowStatusBadge
          status={b.status as BORROW_STATUS}
          size="sm"
          isOverdue={isOverdue}
        />
      );
    },
  },
  {
    key: "borrowedAt",
    label: "Emprestado em",
    track: "minmax(0, 1fr)",
    render: (b) => (
      <span className="text-sm tabular-nums">{formatDate(b.createdAt)}</span>
    ),
  },
  {
    key: "returnedAt",
    label: "Devolvido em",
    track: "minmax(0, 1fr)",
    render: (b) => (
      <span className="text-sm tabular-nums">{formatDate(b.returnedAt)}</span>
    ),
  },
  {
    key: "daysOutstanding",
    label: "Dias em uso",
    track: "minmax(0, 0.8fr)",
    render: (b) => {
      if (b.status !== BORROW_STATUS.ACTIVE) {
        return <span className="text-xs text-muted-foreground">—</span>;
      }
      const d = daysSince(b.createdAt);
      if (d == null) return <span className="text-xs text-muted-foreground">—</span>;
      const overdue = d > 30;
      return (
        <Badge
          variant="outline"
          className={`text-[10px] py-0 px-1.5 ${
            overdue
              ? "border-rose-500/40 text-rose-500"
              : "border-border text-muted-foreground"
          }`}
        >
          {d}d
        </Badge>
      );
    },
  },
  {
    key: "updatedAt",
    label: "Atualizado em",
    track: "minmax(0, 1fr)",
    render: (b) => (
      <span className="text-sm tabular-nums">{formatDate(b.updatedAt)}</span>
    ),
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
  "returnedAt",
  "status",
  "quantity",
  "itemName",
  "userName",
  "updatedAt",
] as const;

const SORT_LABELS: Record<(typeof SORT_KEYS)[number], string> = {
  createdAt: "Emprestado em",
  returnedAt: "Devolvido em",
  status: "Status",
  quantity: "Quantidade",
  itemName: "Nome do item",
  userName: "Nome do usuário",
  updatedAt: "Atualizado em",
};

const CREATED_PRESETS = [
  "any",
  "today",
  "last-7-days",
  "last-30-days",
  "this-month",
] as const;
type CreatedPreset = (typeof CREATED_PRESETS)[number];
const CREATED_PRESET_LABELS: Record<CreatedPreset, string> = {
  any: "Qualquer período",
  today: "Hoje",
  "last-7-days": "Últimos 7 dias",
  "last-30-days": "Últimos 30 dias",
  "this-month": "Este mês",
};

export const borrowTableConfigSchema = z.object({
  title: z.string().min(1).max(80).default("Empréstimos"),
  accent: makeAccentSchema({
    color: "violet",
    icon: "Package",
    borderColor: "none",
  }),
  columns: z
    .array(z.enum(COLUMN_KEY_VALUES))
    .min(1)
    .default(["itemUniCode", "itemName", "status", "borrowedAt"]),
  filters: z
    .object({
      searchingFor: z.string().default(""),
      statuses: z.array(z.nativeEnum(BORROW_STATUS)).default([]),
      itemIds: z.array(z.string().uuid()).default([]),
      userIds: z.array(z.string().uuid()).default([]),
      categoryIds: z.array(z.string().uuid()).default([]),
      brandIds: z.array(z.string().uuid()).default([]),
      createdPreset: z.enum(CREATED_PRESETS).default("any"),
      hideReturned: z.boolean().default(true),
      onlyOverdue: z.boolean().default(false),
    })
    .default({
      searchingFor: "",
      statuses: [],
      itemIds: [],
      userIds: [],
      categoryIds: [],
      brandIds: [],
      createdPreset: "any",
      hideReturned: true,
      onlyOverdue: false,
    }),
  sort: z
    .object({
      key: z.enum(SORT_KEYS).default("createdAt"),
      direction: z.enum(["asc", "desc"]).default("desc"),
    })
    .default({ key: "createdAt", direction: "desc" }),
  limit: z.number().int().min(5).max(200).default(30),
  showHeader: z.boolean().default(true),
  showRowDot: z.boolean().default(true),
  display: z
    .object({
      density: z.enum(DENSITY_VALUES).default("comfortable"),
      striping: z.boolean().default(true),
      gridLines: z.boolean().default(true),
      hoverHighlight: z.boolean().default(true),
      stickyHeader: z.boolean().default(true),
    })
    .default({
      density: "comfortable",
      striping: true,
      gridLines: true,
      hoverHighlight: true,
      stickyHeader: true,
    }),
});

export type BorrowTableConfig = z.infer<typeof borrowTableConfigSchema>;

// ============================================================
// Query params
// ============================================================

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfMonth(): Date {
  const d = startOfToday();
  d.setDate(1);
  return d;
}
function nDaysAgo(n: number): Date {
  const d = startOfToday();
  d.setDate(d.getDate() - n);
  return d;
}

function resolveCreatedPreset(p: CreatedPreset): { gte?: Date } | null {
  switch (p) {
    case "today":
      return { gte: startOfToday() };
    case "last-7-days":
      return { gte: nDaysAgo(7) };
    case "last-30-days":
      return { gte: nDaysAgo(30) };
    case "this-month":
      return { gte: startOfMonth() };
    case "any":
    default:
      return null;
  }
}

const SORT_KEY_TO_API: Record<(typeof SORT_KEYS)[number], string> = {
  createdAt: "createdAt",
  returnedAt: "returnedAt",
  status: "statusOrder",
  quantity: "quantity",
  itemName: "item.name",
  userName: "user.name",
  updatedAt: "updatedAt",
};

function buildOrderBy(
  sort: BorrowTableConfig["sort"],
): Record<string, unknown> | Record<string, unknown>[] {
  const apiKey = SORT_KEY_TO_API[sort.key];
  // Nested keys like "item.name" need the Prisma nested orderBy shape.
  if (apiKey.includes(".")) {
    const [rel, field] = apiKey.split(".");
    return { [rel]: { [field]: sort.direction } };
  }
  return { [apiKey]: sort.direction };
}

function buildParams(config: BorrowTableConfig): Record<string, unknown> {
  const f = config.filters;
  const params: Record<string, unknown> = {
    take: config.limit,
    orderBy: buildOrderBy(config.sort),
    include: {
      item: { include: { brand: true, category: true } },
      user: { include: { sector: true } },
    } as any,
  };

  if (f.searchingFor) params.searchingFor = f.searchingFor;
  if (f.itemIds.length > 0) params.itemIds = f.itemIds;
  if (f.userIds.length > 0) params.userIds = f.userIds;
  if (f.categoryIds.length > 0) params.categoryIds = f.categoryIds;
  if (f.brandIds.length > 0) params.brandIds = f.brandIds;

  const where: Record<string, unknown> = {};
  if (f.statuses.length > 0) {
    where.status = { in: f.statuses };
  } else if (f.hideReturned) {
    // When no explicit status filter is set, hideReturned hides RETURNED only.
    where.status = { not: BORROW_STATUS.RETURNED };
  }

  const created = resolveCreatedPreset(f.createdPreset);
  if (created?.gte) where.createdAt = { gte: created.gte };

  if (Object.keys(where).length > 0) params.where = where;
  return params;
}

// ============================================================
// Render
// ============================================================

function BorrowTableRender({
  config,
}: WidgetRenderProps<BorrowTableConfig>) {
  const navigate = useNavigate();
  const params = useMemo(() => buildParams(config), [config]);

  const { data, isLoading, isError } = useBorrows(params as any);
  const allRows = (data?.data ?? []) as any[];

  // onlyOverdue is a client-side filter — the API doesn't expose it directly.
  const rows = useMemo(() => {
    if (!config.filters.onlyOverdue) return allRows;
    return allRows.filter(
      (b) =>
        b.status === BORROW_STATUS.ACTIVE && (daysSince(b.createdAt) ?? 0) > 30,
    );
  }, [allRows, config.filters.onlyOverdue]);

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
      }),
    [config.accent?.color, config.accent?.icon],
  );
  const AccentIcon = accent.Icon;
  const showRowDot =
    config.showRowDot &&
    (config.columns[0] === "itemName" || config.columns[0] === "itemUniCode");
  const display = config.display;
  const dens = densityClasses(display.density as Density);
  const stickyClass = display.stickyHeader ? "sticky top-0 z-20" : "";
  const rowBorder = display.gridLines ? "border-b border-border last:border-b-0" : "";
  const rowHover = display.hoverHighlight ? "hover:bg-secondary/50" : "";

  return (
    <WidgetCard
      showHeader={config.showHeader}
      title={<span className={accent.classes.text}>{config.title}</span>}
      icon={<AccentIcon className={`h-4 w-4 ${accent.classes.icon}`} />}
      viewAllHref={routes.inventory.loans.list}
      count={!isLoading ? visibleCount : null}
      borderColor={config.accent?.borderColor as WidgetBorderColor | undefined}
    >
      <>
        <div
          className={`${stickyClass} grid gap-x-3 ${dens.header} bg-muted/95 backdrop-blur-sm border-b border-border font-semibold uppercase tracking-wider text-muted-foreground`}
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {cols.map((c) => (
            <div key={c.key} className="truncate">
              {c.label}
            </div>
          ))}
        </div>

        {isLoading ? (
          <SkeletonRows columns={cols.length} count={6} gridTemplate={gridTemplate} dens={dens} />
        ) : isError ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Erro ao carregar empréstimos.
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhum empréstimo encontrado com os filtros atuais.
          </div>
        ) : (
          rows.map((b, i) => (
            <div
              key={b.id}
              className={`grid gap-x-3 items-center ${dens.row} cursor-pointer ${rowBorder} transition-colors ${rowHover} ${
                display.striping && i % 2 === 1 ? "bg-muted/20" : ""
              }`}
              style={{ gridTemplateColumns: gridTemplate }}
              onClick={() => navigate(routes.inventory.loans.details(b.id))}
            >
              {cols.map((c, idx) => (
                <div key={c.key} className="min-w-0 overflow-hidden">
                  {idx === 0 && showRowDot ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${accent.classes.dot}`}
                        aria-hidden="true"
                      />
                      {c.render(b)}
                    </div>
                  ) : (
                    c.render(b)
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </>
    </WidgetCard>
  );
}

function SkeletonRows({
  columns,
  count,
  gridTemplate,
  dens,
}: {
  columns: number;
  count: number;
  gridTemplate: string;
  dens: { row: string; header: string };
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`grid gap-x-3 items-center ${dens.row} border-b border-border last:border-b-0`}
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

const BORROW_STATUS_OPTIONS = (
  Object.values(BORROW_STATUS) as BORROW_STATUS[]
).map((s) => ({ value: s, label: BORROW_STATUS_LABELS[s] ?? s }));

const CREATED_PRESET_OPTIONS = CREATED_PRESETS.map((p) => ({
  value: p,
  label: CREATED_PRESET_LABELS[p],
}));

function BorrowTableConfigComponent({
  config,
  onChange,
}: WidgetConfigProps<BorrowTableConfig>) {
  const c = config;
  const set = <K extends keyof BorrowTableConfig>(
    key: K,
    value: BorrowTableConfig[K],
  ) => onChange({ ...c, [key]: value });
  const setFilter = <K extends keyof BorrowTableConfig["filters"]>(
    key: K,
    value: BorrowTableConfig["filters"][K],
  ) => onChange({ ...c, filters: { ...c.filters, [key]: value } });
  const setSort = <K extends keyof BorrowTableConfig["sort"]>(
    key: K,
    value: BorrowTableConfig["sort"][K],
  ) => onChange({ ...c, sort: { ...c.sort, [key]: value } });
  const setDisplay = <K extends keyof BorrowTableConfig["display"]>(
    key: K,
    value: BorrowTableConfig["display"][K],
  ) => onChange({ ...c, display: { ...c.display, [key]: value } });

  // Async-loaded option lists for the filter combos.
  const { data: brandsData } = useItemBrands({ orderBy: { name: "asc" } } as any);
  const { data: categoriesData } = useItemCategories({
    orderBy: { name: "asc" },
  } as any);
  const { data: itemsData } = useItems({
    orderBy: { name: "asc" },
    take: 200,
  } as any);
  const { data: usersData } = useUsers({ orderBy: { name: "asc" } } as any);

  const brandOptions = useMemo(
    () =>
      ((brandsData?.data ?? []) as any[]).map((b) => ({
        value: b.id,
        label: b.name,
      })),
    [brandsData?.data],
  );
  const categoryOptions = useMemo(
    () =>
      ((categoriesData?.data ?? []) as any[]).map((cat) => ({
        value: cat.id,
        label: cat.name,
      })),
    [categoriesData?.data],
  );
  const itemOptions = useMemo(
    () =>
      ((itemsData?.data ?? []) as any[]).map((i) => ({
        value: i.id,
        label: i.uniCode ? `${i.uniCode} — ${i.name}` : i.name,
      })),
    [itemsData?.data],
  );
  const userOptions = useMemo(
    () =>
      ((usersData?.data ?? []) as any[]).map((u) => ({
        value: u.id,
        label: u.name,
      })),
    [usersData?.data],
  );

  const resetFilters = () => set("filters", borrowTableWidget.defaultConfig.filters);

  const currentAccentColor = (c.accent?.color ?? "violet") as WidgetAccentColor;
  const currentAccentIcon = (c.accent?.icon ?? "Package") as WidgetAccentIcon;
  const currentBorderColor = (c.accent?.borderColor ?? "none") as WidgetBorderColor;
  const setAccent = (
    patch: Partial<{
      color: WidgetAccentColor;
      icon: WidgetAccentIcon;
      borderColor: WidgetBorderColor;
    }>,
  ) =>
    set("accent", {
      color: currentAccentColor,
      icon: currentAccentIcon,
      borderColor: currentBorderColor,
      ...patch,
    } as BorrowTableConfig["accent"]);

  return (
    <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1 -mr-1">
      <div className="space-y-1.5">
        <Label className="text-sm">Título</Label>
        <Input
          value={c.title}
          onChange={(v) => set("title", typeof v === "string" ? v : "")}
          placeholder="Empréstimos"
        />
      </div>

      <Tabs defaultValue="appearance" className="flex flex-col gap-2">
        <TabsList className="self-start">
          <TabsTrigger value="appearance" className="gap-1">
            <IconAdjustments className="h-3.5 w-3.5" /> Aparência
          </TabsTrigger>
          <TabsTrigger value="columns" className="gap-1">
            <IconColumns className="h-3.5 w-3.5" /> Colunas e ordenação
          </TabsTrigger>
          <TabsTrigger value="filters" className="gap-1">
            <IconFilter className="h-3.5 w-3.5" /> Filtros
          </TabsTrigger>
        </TabsList>

        {/* ---- APPEARANCE ---- */}
        <TabsContent value="appearance" className="space-y-3 mt-0">
          <Section title="Acento (cor, ícone, borda)" defaultOpen>
            <AccentPicker
              value={{
                color: currentAccentColor,
                icon: currentAccentIcon,
                borderColor: currentBorderColor,
              }}
              onChange={(next) =>
                setAccent({
                  color: next.color,
                  icon: next.icon,
                  borderColor: next.borderColor,
                })
              }
            />
          </Section>
          <Section title="Visibilidade" defaultOpen>
            <div className="grid grid-cols-2 gap-2">
              <ToggleRow
                label="Exibir cabeçalho do widget"
                checked={c.showHeader}
                onCheckedChange={(v) => set("showHeader", v)}
              />
              <ToggleRow
                label="Bolinha colorida nas linhas"
                hint="Marca cada linha com a cor do acento. Aparece apenas quando a primeira coluna é Item ou Código."
                checked={c.showRowDot}
                onCheckedChange={(v) => set("showRowDot", v)}
              />
            </div>
          </Section>
          <Section title="Densidade e linhas" defaultOpen>
            <div className="space-y-1">
              <Label className="text-xs">Densidade</Label>
              <Combobox
                mode="single"
                value={c.display?.density ?? "comfortable"}
                onValueChange={(v) =>
                  setDisplay(
                    "density",
                    (typeof v === "string" ? v : "comfortable") as Density,
                  )
                }
                options={DENSITY_OPTIONS}
                clearable={false}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ToggleRow
                label="Listras zebra"
                hint="Alterna fundo nas linhas pares para facilitar leitura."
                checked={c.display?.striping ?? true}
                onCheckedChange={(v) => setDisplay("striping", v)}
              />
              <ToggleRow
                label="Linhas divisórias"
                checked={c.display?.gridLines ?? true}
                onCheckedChange={(v) => setDisplay("gridLines", v)}
              />
              <ToggleRow
                label="Realçar linha sob o cursor"
                checked={c.display?.hoverHighlight ?? true}
                onCheckedChange={(v) => setDisplay("hoverHighlight", v)}
              />
              <ToggleRow
                label="Cabeçalho fixo"
                hint="O cabeçalho permanece visível ao rolar."
                checked={c.display?.stickyHeader ?? true}
                onCheckedChange={(v) => setDisplay("stickyHeader", v)}
              />
            </div>
          </Section>
        </TabsContent>

        {/* ---- COLUMNS & SORTING ---- */}
        <TabsContent value="columns" className="space-y-3 mt-0">
          <Section title="Selecionar e reordenar" defaultOpen>
            <ColumnPicker
              catalog={COLUMN_CATALOG.map((col) => ({
                key: col.key,
                label: col.label,
              }))}
              selected={c.columns}
              onChange={(next) =>
                set("columns", next as BorrowTableConfig["columns"])
              }
            />
          </Section>
          <Section title="Ordenação e limite" defaultOpen>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Ordenar por</Label>
                <Combobox
                  mode="single"
                  value={c.sort.key}
                  onValueChange={(v) =>
                    setSort(
                      "key",
                      (typeof v === "string"
                        ? v
                        : "createdAt") as BorrowTableConfig["sort"]["key"],
                    )
                  }
                  options={SORT_KEYS.map((k) => ({
                    value: k,
                    label: SORT_LABELS[k],
                  }))}
                  clearable={false}
                />
              </div>
              <div>
                <Label className="text-xs">Direção</Label>
                <Combobox
                  mode="single"
                  value={c.sort.direction}
                  onValueChange={(v) =>
                    setSort(
                      "direction",
                      (typeof v === "string"
                        ? v
                        : "desc") as BorrowTableConfig["sort"]["direction"],
                    )
                  }
                  options={SORT_DIRECTION_OPTIONS}
                  clearable={false}
                />
              </div>
            </div>
            <LimitInput value={c.limit} onChange={(n) => set("limit", n)} />
          </Section>
        </TabsContent>

        {/* ---- FILTERS ---- */}
        <TabsContent value="filters" className="space-y-2.5 mt-0">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={resetFilters}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            >
              Limpar filtros
            </button>
          </div>

          <Section title="Busca e status" defaultOpen>
            <div>
              <Label className="text-xs">Busca</Label>
              <Input
                value={c.filters.searchingFor}
                onChange={(v) =>
                  setFilter("searchingFor", typeof v === "string" ? v : "")
                }
                placeholder="Item, código, usuário..."
              />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Combobox
                mode="multiple"
                value={c.filters.statuses}
                onValueChange={(v) =>
                  setFilter("statuses", asArray(v) as BORROW_STATUS[])
                }
                options={BORROW_STATUS_OPTIONS}
                placeholder="Todos os status"
                searchPlaceholder="Buscar status..."
              />
            </div>
            <div>
              <Label className="text-xs">Período (Emprestado em)</Label>
              <Combobox
                mode="single"
                value={c.filters.createdPreset}
                onValueChange={(v) =>
                  setFilter(
                    "createdPreset",
                    (typeof v === "string" ? v : "any") as CreatedPreset,
                  )
                }
                options={CREATED_PRESET_OPTIONS}
                clearable={false}
              />
            </div>
          </Section>

          <Section title="Item">
            <div>
              <Label className="text-xs">Itens</Label>
              <Combobox
                mode="multiple"
                value={c.filters.itemIds}
                onValueChange={(v) => setFilter("itemIds", asArray(v))}
                options={itemOptions}
                placeholder="Todos os itens"
                searchPlaceholder="Buscar item..."
              />
            </div>
            <div>
              <Label className="text-xs">Categorias</Label>
              <Combobox
                mode="multiple"
                value={c.filters.categoryIds}
                onValueChange={(v) => setFilter("categoryIds", asArray(v))}
                options={categoryOptions}
                placeholder="Todas as categorias"
                searchPlaceholder="Buscar categoria..."
              />
            </div>
            <div>
              <Label className="text-xs">Marcas</Label>
              <Combobox
                mode="multiple"
                value={c.filters.brandIds}
                onValueChange={(v) => setFilter("brandIds", asArray(v))}
                options={brandOptions}
                placeholder="Todas as marcas"
                searchPlaceholder="Buscar marca..."
              />
            </div>
          </Section>

          <Section title="Usuário">
            <div>
              <Label className="text-xs">Usuários</Label>
              <Combobox
                mode="multiple"
                value={c.filters.userIds}
                onValueChange={(v) => setFilter("userIds", asArray(v))}
                options={userOptions}
                placeholder="Todos os usuários"
                searchPlaceholder="Buscar usuário..."
              />
            </div>
          </Section>

          <Section title="Comportamento">
            <div className="grid grid-cols-2 gap-2">
              <ToggleRow
                label="Esconder devolvidos"
                hint="Oculta empréstimos com status DEVOLVIDO quando nenhum status específico está selecionado."
                checked={c.filters.hideReturned}
                onCheckedChange={(v) => setFilter("hideReturned", v)}
              />
              <ToggleRow
                label="Apenas atrasados"
                hint="Mostra somente empréstimos ATIVOS há mais de 30 dias."
                checked={c.filters.onlyOverdue}
                onCheckedChange={(v) => setFilter("onlyOverdue", v)}
              />
            </div>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Definition
// ============================================================

export const borrowTableWidget: WidgetDefinition<BorrowTableConfig> = {
  id: "table.borrows",
  name: "Tabela de Empréstimos",
  description:
    "Acompanhamento de itens emprestados: status, prazo, usuário, item, marca, categoria. Filtros por período, status e atrasados.",
  icon: IconPackage,
  category: "inventory",
  // Mirror /estoque/emprestimos page (parent /estoque is [WAREHOUSE, ADMIN]).
  allowedSectors: [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ],
  defaultSize: { cols: 2, rows: 2 },
  minSize: { cols: 2, rows: 1 },
  maxSize: { cols: 4, rows: 4 },
  configSchema: borrowTableConfigSchema,
  defaultConfig: {
    title: "Empréstimos",
    accent: { color: "violet", icon: "Package", borderColor: "none" },
    columns: ["itemUniCode", "itemName", "status", "borrowedAt"],
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
    showRowDot: true,
    display: {
      density: "comfortable",
      striping: true,
      gridLines: true,
      hoverHighlight: true,
      stickyHeader: true,
    },
  },
  RenderComponent: BorrowTableRender,
  ConfigComponent: BorrowTableConfigComponent,
};
