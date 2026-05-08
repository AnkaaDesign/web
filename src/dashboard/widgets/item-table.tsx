// Generic, fully configurable item (inventory) table widget.
//
// Mirrors the inventory list page's column + filter set. Each instance saves
// its own choice of:
//   - title
//   - columns (16 available — code, name, brand, category, stock, prices,
//     supplier, classifications, etc.)
//   - filters: stockLevels, brand/category/supplier ids, ABC/XYZ classes,
//     isActive, shouldAssignToUser, has-reorder-point, has-max-quantity,
//     quantity range, search text
//   - sort + limit
//
// Data source: useItems() with the same `where` shape the inventory page
// uses. Combobox is used for all filter dropdowns (per user preference).

import { useMemo } from "react";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import {
  IconPackage,
  IconAlertTriangleFilled,
  IconAdjustments,
  IconColumns,
  IconFilter,
} from "@tabler/icons-react";
import { STOCK_LEVEL, STOCK_LEVEL_LABELS, ABC_CATEGORY, XYZ_CATEGORY, SECTOR_PRIVILEGES } from "../../constants";
import type { Item } from "../../types";
import { useItems } from "../../hooks/inventory/use-item";
import { useItemBrands } from "../../hooks/inventory/use-item-brand";
import { useItemCategories } from "../../hooks/inventory/use-item-category";
import { useSuppliers } from "../../hooks/inventory/use-supplier";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Combobox } from "../../components/ui/combobox";
import { Badge } from "../../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { WidgetCard } from "../components/widget-card";
import { ColumnPicker } from "../components/column-picker";
import { AccentPicker, resolveAccent } from "../components/widget-accent";
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
import type {
  WidgetAccentColor,
  WidgetAccentIcon,
  WidgetBorderColor,
} from "../components/widget-accent";
import { determineStockLevel, getStockLevelTextColor } from "../../utils/stock-level";
import type {
  WidgetConfigProps,
  WidgetDefinition,
  WidgetRenderProps,
} from "../types";

// ============================================================
// Helpers
// ============================================================

function formatNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Number.isInteger(n)
    ? n.toLocaleString("pt-BR")
    : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatCurrency(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}
function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

// ============================================================
// Column catalog
// ============================================================

type ColumnKey =
  | "uniCode"
  | "name"
  | "brand"
  | "category"
  | "quantity"
  | "reorderPoint"
  | "maxQuantity"
  | "monthlyConsumption"
  | "price"
  | "totalPrice"
  | "supplier"
  | "abcCategory"
  | "xyzCategory"
  | "isActive"
  | "shouldAssignToUser"
  | "createdAt";

interface ColumnDef {
  key: ColumnKey;
  label: string;
  track: string;
  render: (item: Item) => React.ReactNode;
}

function getLatestPrice(item: Item): number | null {
  const prices = (item as any).prices as Array<{ value: number; createdAt: string }> | undefined;
  if (!prices || prices.length === 0) return null;
  // Repository orders by createdAt desc, but defensive: find max by createdAt.
  const latest = prices.reduce((acc, p) =>
    new Date(p.createdAt) > new Date(acc.createdAt) ? p : acc,
  );
  return Number(latest.value);
}

const COLUMN_CATALOG: ColumnDef[] = [
  {
    key: "uniCode",
    label: "Código",
    track: "minmax(0, 0.8fr)",
    render: (i) => (
      <span className="text-sm font-mono truncate">{(i as any).uniCode || "—"}</span>
    ),
  },
  {
    key: "name",
    label: "Nome",
    track: "minmax(0, 1.6fr)",
    render: (i) => <span className="text-sm truncate">{i.name || "—"}</span>,
  },
  {
    key: "brand",
    label: "Marca",
    track: "minmax(0, 1fr)",
    render: (i) => (
      <span className="text-sm truncate">{(i as any).brand?.name || "—"}</span>
    ),
  },
  {
    key: "category",
    label: "Categoria",
    track: "minmax(0, 1fr)",
    render: (i) => (
      <span className="text-sm truncate">{(i as any).category?.name || "—"}</span>
    ),
  },
  {
    key: "quantity",
    label: "Quant.",
    track: "minmax(0, 0.8fr)",
    render: (i) => {
      const q = Number((i as any).quantity ?? 0);
      const stockLevel = determineStockLevel(
        q,
        (i as any).reorderPoint ?? null,
        (i as any).maxQuantity ?? null,
        false,
      );
      const color = getStockLevelTextColor(stockLevel);
      return (
        <span className={`flex items-center gap-1.5 text-sm tabular-nums ${color}`}>
          <IconAlertTriangleFilled className={`h-3 w-3 ${color}`} />
          {formatNumber(q)}
        </span>
      );
    },
  },
  {
    key: "reorderPoint",
    label: "Ponto de reposição",
    track: "minmax(0, 0.9fr)",
    render: (i) => (
      <span className="text-sm tabular-nums">
        {formatNumber((i as any).reorderPoint ?? null)}
      </span>
    ),
  },
  {
    key: "maxQuantity",
    label: "Máx.",
    track: "minmax(0, 0.8fr)",
    render: (i) => (
      <span className="text-sm tabular-nums">
        {formatNumber((i as any).maxQuantity ?? null)}
      </span>
    ),
  },
  {
    key: "monthlyConsumption",
    label: "Consumo mensal",
    track: "minmax(0, 1fr)",
    render: (i) => (
      <span className="text-sm tabular-nums">
        {formatNumber((i as any).monthlyConsumption ?? null)}
      </span>
    ),
  },
  {
    key: "price",
    label: "Preço",
    track: "minmax(0, 1fr)",
    render: (i) => (
      <span className="text-sm tabular-nums">{formatCurrency(getLatestPrice(i))}</span>
    ),
  },
  {
    key: "totalPrice",
    label: "Valor total",
    track: "minmax(0, 1fr)",
    render: (i) => (
      <span className="text-sm tabular-nums">
        {formatCurrency((i as any).totalPrice ?? null)}
      </span>
    ),
  },
  {
    key: "supplier",
    label: "Fornecedor",
    track: "minmax(0, 1.2fr)",
    render: (i) => {
      const s = (i as any).supplier;
      return (
        <span className="text-sm truncate">
          {s?.fantasyName || s?.corporateName || "—"}
        </span>
      );
    },
  },
  {
    key: "abcCategory",
    label: "ABC",
    track: "minmax(0, 0.5fr)",
    render: (i) => {
      const v = (i as any).abcCategory;
      return v ? (
        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
          {v}
        </Badge>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      );
    },
  },
  {
    key: "xyzCategory",
    label: "XYZ",
    track: "minmax(0, 0.5fr)",
    render: (i) => {
      const v = (i as any).xyzCategory;
      return v ? (
        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
          {v}
        </Badge>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      );
    },
  },
  {
    key: "isActive",
    label: "Ativo",
    track: "minmax(0, 0.6fr)",
    render: (i) =>
      (i as any).isActive ? (
        <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-emerald-500/40 text-emerald-500">
          Sim
        </Badge>
      ) : (
        <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-rose-500/40 text-rose-500">
          Não
        </Badge>
      ),
  },
  {
    key: "shouldAssignToUser",
    label: "Atribuir ao usuário",
    track: "minmax(0, 0.8fr)",
    render: (i) =>
      (i as any).shouldAssignToUser ? (
        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
          Sim
        </Badge>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
  },
  {
    key: "createdAt",
    label: "Cadastrado em",
    track: "minmax(0, 1fr)",
    render: (i) => (
      <span className="text-sm tabular-nums">{formatDate((i as any).createdAt)}</span>
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
  "name",
  "uniCode",
  "quantity",
  "monthlyConsumption",
  "price",
  "totalPrice",
  "createdAt",
  "isActive",
] as const;

const TRI_STATE = ["any", "yes", "no"] as const;

export const itemTableConfigSchema = z.object({
  title: z.string().min(1).max(80).default("Itens"),
  accent: z
    .object({
      color: z
        .enum([
          "gray",
          "slate",
          "red",
          "orange",
          "amber",
          "yellow",
          "lime",
          "green",
          "emerald",
          "teal",
          "cyan",
          "sky",
          "blue",
          "indigo",
          "violet",
          "purple",
          "fuchsia",
          "pink",
          "rose",
        ])
        .default("yellow"),
      icon: z
        .enum([
          "ClipboardText",
          "ClipboardList",
          "ClipboardCheck",
          "Calendar",
          "CalendarDue",
          "Clock",
          "Hourglass",
          "Check",
          "CircleCheck",
          "AlertTriangle",
          "Flag",
          "Star",
          "Bolt",
          "Truck",
          "Package",
          "Brush",
          "Palette",
          "Receipt",
          "FileText",
          "Tools",
          "Users",
          "Factory",
        ])
        .default("Package"),
      borderColor: z
        .enum([
          "none",
          "gray",
          "slate",
          "red",
          "orange",
          "amber",
          "yellow",
          "lime",
          "green",
          "emerald",
          "teal",
          "cyan",
          "sky",
          "blue",
          "indigo",
          "violet",
          "purple",
          "fuchsia",
          "pink",
          "rose",
        ])
        .default("none"),
    })
    .default({ color: "yellow", icon: "Package", borderColor: "none" }),
  columns: z
    .array(
      z.enum([
        "uniCode",
        "name",
        "brand",
        "category",
        "quantity",
        "reorderPoint",
        "maxQuantity",
        "monthlyConsumption",
        "price",
        "totalPrice",
        "supplier",
        "abcCategory",
        "xyzCategory",
        "isActive",
        "shouldAssignToUser",
        "createdAt",
      ]),
    )
    .min(1)
    .default(["name", "brand", "quantity", "monthlyConsumption"]),
  filters: z
    .object({
      searchingFor: z.string().default(""),
      stockLevels: z.array(z.nativeEnum(STOCK_LEVEL)).default([]),
      brandIds: z.array(z.string().uuid()).default([]),
      categoryIds: z.array(z.string().uuid()).default([]),
      supplierIds: z.array(z.string().uuid()).default([]),
      abcCategories: z.array(z.nativeEnum(ABC_CATEGORY)).default([]),
      xyzCategories: z.array(z.nativeEnum(XYZ_CATEGORY)).default([]),
      isActive: z.enum(TRI_STATE).default("yes"),
      hasReorderPoint: z.enum(TRI_STATE).default("any"),
      hasMaxQuantity: z.enum(TRI_STATE).default("any"),
      shouldAssignToUser: z.enum(TRI_STATE).default("any"),
      quantityMin: z.number().nullable().optional(),
      quantityMax: z.number().nullable().optional(),
    })
    .default({
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
    }),
  sort: z
    .object({
      key: z.enum(SORT_KEYS).default("name"),
      direction: z.enum(["asc", "desc"]).default("asc"),
    })
    .default({ key: "name", direction: "asc" }),
  limit: z.number().int().min(5).max(200).default(20),
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

export type ItemTableConfig = z.infer<typeof itemTableConfigSchema>;

// ============================================================
// useItems-friendly param builder
// ============================================================

function buildParams(config: ItemTableConfig): Record<string, unknown> {
  // useItems accepts top-level convenience filters that the API translates
  // into Prisma `where` clauses — same shape the inventory page uses.
  const f = config.filters;
  const params: Record<string, unknown> = {
    take: config.limit,
    orderBy: { [config.sort.key]: config.sort.direction },
    include: { brand: true, category: true, supplier: true, prices: true } as any,
  };
  if (f.searchingFor) params.searchingFor = f.searchingFor;
  if (f.stockLevels.length > 0) params.stockLevels = f.stockLevels;
  if (f.brandIds.length > 0) params.brandIds = f.brandIds;
  if (f.categoryIds.length > 0) params.categoryIds = f.categoryIds;
  if (f.supplierIds.length > 0) params.supplierIds = f.supplierIds;
  if (f.abcCategories.length > 0) params.abcCategories = f.abcCategories;
  if (f.xyzCategories.length > 0) params.xyzCategories = f.xyzCategories;
  if (f.isActive === "yes") params.isActive = true;
  if (f.isActive === "no") params.isActive = false;

  const where: Record<string, unknown> = {};
  if (f.hasReorderPoint === "yes") where.reorderPoint = { not: null };
  if (f.hasReorderPoint === "no") where.reorderPoint = null;
  if (f.hasMaxQuantity === "yes") where.maxQuantity = { not: null };
  if (f.hasMaxQuantity === "no") where.maxQuantity = null;
  if (f.shouldAssignToUser === "yes") where.shouldAssignToUser = true;
  if (f.shouldAssignToUser === "no") where.shouldAssignToUser = false;

  if (f.quantityMin != null || f.quantityMax != null) {
    const range: Record<string, number> = {};
    if (f.quantityMin != null) range.gte = f.quantityMin;
    if (f.quantityMax != null) range.lte = f.quantityMax;
    where.quantity = range;
  }

  if (Object.keys(where).length > 0) params.where = where;
  return params;
}

// ============================================================
// Render
// ============================================================

function ItemTableRender({ config }: WidgetRenderProps<ItemTableConfig>) {
  const navigate = useNavigate();
  const params = useMemo(() => buildParams(config), [config]);

  const { data, isLoading, isError } = useItems(params as any);
  const items = data?.data ?? [];
  // Visible row count — see task-table for why we don't trust meta.totalRecords.
  const visibleCount = items.length;

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
    (config.columns[0] === "name" || config.columns[0] === "uniCode");
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
      viewAllHref="/estoque/produtos"
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
            Erro ao carregar itens.
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhum item encontrado com os filtros atuais.
          </div>
        ) : (
          items.map((item, i) => (
            <div
              key={item.id}
              className={`grid gap-x-3 items-center ${dens.row} cursor-pointer ${rowBorder} transition-colors ${rowHover} ${
                display.striping && i % 2 === 1 ? "bg-muted/20" : ""
              }`}
              style={{ gridTemplateColumns: gridTemplate }}
              onClick={() => navigate(`/estoque/produtos/detalhes/${item.id}`)}
            >
              {cols.map((c, idx) => (
                <div key={c.key} className="min-w-0">
                  {idx === 0 && showRowDot ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${accent.classes.dot}`}
                        aria-hidden="true"
                      />
                      {c.render(item)}
                    </div>
                  ) : (
                    c.render(item)
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

const TRI_STATE_LABELS: Record<(typeof TRI_STATE)[number], string> = {
  any: "Qualquer",
  yes: "Sim",
  no: "Não",
};
const SORT_LABELS: Record<(typeof SORT_KEYS)[number], string> = {
  name: "Nome",
  uniCode: "Código",
  quantity: "Quantidade",
  monthlyConsumption: "Consumo mensal",
  price: "Preço",
  totalPrice: "Valor total",
  createdAt: "Cadastrado em",
  isActive: "Status",
};

function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string" && v) return [v];
  return [];
}

function ItemTableConfigComponent({
  config,
  onChange,
}: WidgetConfigProps<ItemTableConfig>) {
  const c = config;
  const set = <K extends keyof ItemTableConfig>(key: K, value: ItemTableConfig[K]) =>
    onChange({ ...c, [key]: value });
  const setFilter = <K extends keyof ItemTableConfig["filters"]>(
    key: K,
    value: ItemTableConfig["filters"][K],
  ) => onChange({ ...c, filters: { ...c.filters, [key]: value } });
  const setSort = <K extends keyof ItemTableConfig["sort"]>(
    key: K,
    value: ItemTableConfig["sort"][K],
  ) => onChange({ ...c, sort: { ...c.sort, [key]: value } });
  const setDisplay = <K extends keyof ItemTableConfig["display"]>(
    key: K,
    value: ItemTableConfig["display"][K],
  ) => onChange({ ...c, display: { ...c.display, [key]: value } });

  const { data: brandsData } = useItemBrands({ orderBy: { name: "asc" } } as any);
  const { data: categoriesData } = useItemCategories({ orderBy: { name: "asc" } } as any);
  const { data: suppliersData } = useSuppliers({ orderBy: { fantasyName: "asc" } } as any);

  const brandOptions = useMemo(
    () => (brandsData?.data ?? []).map((b: any) => ({ value: b.id, label: b.name })),
    [brandsData?.data],
  );
  const categoryOptions = useMemo(
    () => (categoriesData?.data ?? []).map((c: any) => ({ value: c.id, label: c.name })),
    [categoriesData?.data],
  );
  const supplierOptions = useMemo(
    () =>
      (suppliersData?.data ?? []).map((s: any) => ({
        value: s.id,
        label: s.fantasyName || s.corporateName,
      })),
    [suppliersData?.data],
  );

  const stockLevelOptions = useMemo(
    () =>
      (Object.values(STOCK_LEVEL) as STOCK_LEVEL[]).map((s) => ({
        value: s,
        label: STOCK_LEVEL_LABELS[s] ?? s,
      })),
    [],
  );
  const abcOptions = useMemo(
    () =>
      (Object.values(ABC_CATEGORY) as ABC_CATEGORY[]).map((v) => ({
        value: v,
        label: String(v),
      })),
    [],
  );
  const xyzOptions = useMemo(
    () =>
      (Object.values(XYZ_CATEGORY) as XYZ_CATEGORY[]).map((v) => ({
        value: v,
        label: String(v),
      })),
    [],
  );

  const triStateOptions = (Object.entries(TRI_STATE_LABELS) as [
    (typeof TRI_STATE)[number],
    string,
  ][]).map(([value, label]) => ({ value, label }));

  const resetFilters = () =>
    set("filters", itemTableWidget.defaultConfig.filters);

  const currentAccentColor = (c.accent?.color ?? "yellow") as WidgetAccentColor;
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
    } as ItemTableConfig["accent"]);

  return (
    <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1 -mr-1">
      <div className="space-y-1.5">
        <Label className="text-sm">Título</Label>
        <Input
          value={c.title}
          onChange={(v) => set("title", typeof v === "string" ? v : "")}
          placeholder="Itens"
        />
        <p className="text-[10px] text-muted-foreground">
          A cor escolhida abaixo será aplicada ao título.
        </p>
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
                hint="Marca cada linha com a cor do acento. Aparece apenas quando a primeira coluna é Nome ou Código."
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
              catalog={COLUMN_CATALOG.map((col) => ({ key: col.key, label: col.label }))}
              selected={c.columns}
              onChange={(next) => set("columns", next as ItemTableConfig["columns"])}
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
                      (typeof v === "string" ? v : "name") as ItemTableConfig["sort"]["key"],
                    )
                  }
                  options={SORT_KEYS.map((k) => ({ value: k, label: SORT_LABELS[k] }))}
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
                      (typeof v === "string" ? v : "asc") as ItemTableConfig["sort"]["direction"],
                    )
                  }
                  options={SORT_DIRECTION_OPTIONS}
                  clearable={false}
                />
              </div>
            </div>
            <LimitInput
              value={c.limit}
              onChange={(n) => set("limit", n)}
            />
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

          <Section title="Busca e estoque" defaultOpen>
            <div>
              <Label className="text-xs">Busca</Label>
              <Input
                value={c.filters.searchingFor}
                onChange={(v) => setFilter("searchingFor", typeof v === "string" ? v : "")}
                placeholder="Nome, código, marca, categoria..."
              />
            </div>
            <div>
              <Label className="text-xs">Níveis de estoque</Label>
              <Combobox
                mode="multiple"
                value={c.filters.stockLevels}
                onValueChange={(v) => setFilter("stockLevels", asArray(v) as STOCK_LEVEL[])}
                options={stockLevelOptions}
                placeholder="Todos os níveis"
                searchPlaceholder="Buscar nível..."
              />
            </div>
          </Section>

          <Section title="Marca, Categoria, Fornecedor">
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
              <Label className="text-xs">Fornecedores</Label>
              <Combobox
                mode="multiple"
                value={c.filters.supplierIds}
                onValueChange={(v) => setFilter("supplierIds", asArray(v))}
                options={supplierOptions}
                placeholder="Todos os fornecedores"
                searchPlaceholder="Buscar fornecedor..."
              />
            </div>
          </Section>

          <Section title="Classificação ABC / XYZ">
            <div>
              <Label className="text-xs">ABC</Label>
              <Combobox
                mode="multiple"
                value={c.filters.abcCategories}
                onValueChange={(v) =>
                  setFilter("abcCategories", asArray(v) as ABC_CATEGORY[])
                }
                options={abcOptions}
                placeholder="Todas as classes ABC"
              />
            </div>
            <div>
              <Label className="text-xs">XYZ</Label>
              <Combobox
                mode="multiple"
                value={c.filters.xyzCategories}
                onValueChange={(v) =>
                  setFilter("xyzCategories", asArray(v) as XYZ_CATEGORY[])
                }
                options={xyzOptions}
                placeholder="Todas as classes XYZ"
              />
            </div>
          </Section>

          <Section title="Características">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Ativo</Label>
                <Combobox
                  mode="single"
                  value={c.filters.isActive}
                  onValueChange={(v) =>
                    setFilter(
                      "isActive",
                      (typeof v === "string" ? v : "any") as ItemTableConfig["filters"]["isActive"],
                    )
                  }
                  options={triStateOptions}
                  clearable={false}
                />
              </div>
              <div>
                <Label className="text-xs">Tem ponto de reposição</Label>
                <Combobox
                  mode="single"
                  value={c.filters.hasReorderPoint}
                  onValueChange={(v) =>
                    setFilter(
                      "hasReorderPoint",
                      (typeof v === "string"
                        ? v
                        : "any") as ItemTableConfig["filters"]["hasReorderPoint"],
                    )
                  }
                  options={triStateOptions}
                  clearable={false}
                />
              </div>
              <div>
                <Label className="text-xs">Tem qtde máxima</Label>
                <Combobox
                  mode="single"
                  value={c.filters.hasMaxQuantity}
                  onValueChange={(v) =>
                    setFilter(
                      "hasMaxQuantity",
                      (typeof v === "string"
                        ? v
                        : "any") as ItemTableConfig["filters"]["hasMaxQuantity"],
                    )
                  }
                  options={triStateOptions}
                  clearable={false}
                />
              </div>
              <div>
                <Label className="text-xs">Atribuir ao usuário</Label>
                <Combobox
                  mode="single"
                  value={c.filters.shouldAssignToUser}
                  onValueChange={(v) =>
                    setFilter(
                      "shouldAssignToUser",
                      (typeof v === "string"
                        ? v
                        : "any") as ItemTableConfig["filters"]["shouldAssignToUser"],
                    )
                  }
                  options={triStateOptions}
                  clearable={false}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Quant. mínima</Label>
                <Input
                  type="number"
                  value={c.filters.quantityMin ?? ""}
                  onChange={(v) => {
                    const n = typeof v === "number" ? v : v ? Number(v) : null;
                    setFilter("quantityMin", Number.isFinite(n) ? (n as number) : null);
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Quant. máxima</Label>
                <Input
                  type="number"
                  value={c.filters.quantityMax ?? ""}
                  onChange={(v) => {
                    const n = typeof v === "number" ? v : v ? Number(v) : null;
                    setFilter("quantityMax", Number.isFinite(n) ? (n as number) : null);
                  }}
                />
              </div>
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

export const itemTableWidget: WidgetDefinition<ItemTableConfig> = {
  id: "table.items",
  name: "Tabela de Itens",
  description:
    "Tabela de itens / estoque totalmente configurável: 16 colunas, filtros por estoque, marca, categoria, fornecedor, ABC/XYZ. Crie quantas instâncias quiser.",
  icon: IconPackage,
  category: "inventory",
  // Mirror /estoque/produtos page (parent /estoque is [WAREHOUSE, ADMIN]).
  allowedSectors: [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ],
  defaultSize: { cols: 2, rows: 2 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 4, rows: 4 },
  configSchema: itemTableConfigSchema,
  defaultConfig: {
    title: "Itens",
    accent: { color: "yellow", icon: "Package", borderColor: "none" },
    columns: ["name", "brand", "quantity", "monthlyConsumption"],
    filters: {
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
    },
    sort: { key: "name", direction: "asc" },
    limit: 20,
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
  RenderComponent: ItemTableRender,
  ConfigComponent: ItemTableConfigComponent,
};
