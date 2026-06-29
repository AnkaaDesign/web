import {
  IconTriangleInverted,
  IconUser,
  IconPackages,
  IconCategory,
  IconCurrencyDollar,
  IconAlertTriangleFilled,
  IconBrandAsana,
  IconTruck,
  IconNumber,
} from "@tabler/icons-react";
import type { DataTableFilterDef, DataTableFilterValues } from "@/components/ui/datatable";
import type { Item } from "@/types";
import type { ItemGetManyFormData } from "@/schemas";
import { STOCK_LEVEL, STOCK_LEVEL_LABELS, ACCOUNTING_TYPE, ACCOUNTING_TYPE_LABELS } from "@/constants";
import { ITEM_SORT_FIELD_MAP } from "./item-table-columns";

export const ITEM_DEFAULT_PAGE_SIZE = 40;

/**
 * Trimmed server `include` — only what the columns render (vs. the legacy deep payload). `prices`
 * (newest one), `_count.activities` for the "Atividades" column, and `orderItems.order.status` so
 * the stock-status indicator can flag a pending order.
 */
export const ITEM_LIST_INCLUDE = {
  brands: true,
  category: true,
  supplier: true,
  warehouseLocation: true,
  measures: true,
  prices: { orderBy: { createdAt: "desc" }, take: 1 },
  orderItems: { include: { order: { select: { status: true } } } },
  _count: { select: { activities: true } },
} as const;

/** A loaded option list for the entity filters (categories / brands / suppliers). */
export interface ItemFilterOptionSources {
  categories: { value: string; label: string }[];
  brands: { value: string; label: string }[];
  suppliers: { value: string; label: string }[];
}

/**
 * Declarative filter set, faithful to the legacy `item-filters.tsx` drawer:
 *   Status, Atribuir ao usuário, Status de Estoque, Categoria, Tipo Contábil, Categoria a revisar,
 *   Marca, Fornecedor, Faixa de Quantidade, Faixa de Preço.
 * Server mode: values are mapped to `ItemGetManyFormData` by `buildItemQuery`.
 */
export function createItemFilterDefs(sources: ItemFilterOptionSources): DataTableFilterDef<Item>[] {
  return [
    {
      key: "status",
      label: "Status",
      type: "select",
      icon: <IconTriangleInverted className="h-4 w-4" />,
      placeholder: "Selecione...",
      options: [
        { value: "ativo", label: "Ativo" },
        { value: "inativo", label: "Inativo" },
        { value: "ambos", label: "Ambos" },
      ],
    },
    {
      key: "shouldAssignToUser",
      label: "Atribuir ao usuário",
      type: "boolean",
      icon: <IconUser className="h-4 w-4" />,
      placeholder: "Ambos",
    },
    {
      key: "stockLevels",
      label: "Status de Estoque",
      type: "multiselect",
      icon: <IconPackages className="h-4 w-4" />,
      placeholder: "Selecione status de estoque...",
      options: (Object.values(STOCK_LEVEL) as STOCK_LEVEL[]).map((level) => ({ value: level, label: STOCK_LEVEL_LABELS[level] })),
    },
    {
      key: "categoryIds",
      label: "Categoria",
      type: "multiselect",
      icon: <IconCategory className="h-4 w-4" />,
      placeholder: "Selecione categorias...",
      options: sources.categories,
    },
    {
      key: "accountingTypes",
      label: "Tipo Contábil",
      type: "multiselect",
      icon: <IconCurrencyDollar className="h-4 w-4" />,
      placeholder: "Selecione tipos contábeis...",
      options: (Object.values(ACCOUNTING_TYPE) as ACCOUNTING_TYPE[]).map((type) => ({ value: type, label: ACCOUNTING_TYPE_LABELS[type] })),
    },
    {
      key: "categoryReviewNeeded",
      label: "Categoria a revisar",
      type: "boolean",
      icon: <IconAlertTriangleFilled className="h-4 w-4" />,
      placeholder: "Todas",
    },
    {
      key: "brandIds",
      label: "Marca",
      type: "multiselect",
      icon: <IconBrandAsana className="h-4 w-4" />,
      placeholder: "Selecione marcas...",
      options: sources.brands,
    },
    {
      key: "supplierIds",
      label: "Fornecedor",
      type: "multiselect",
      icon: <IconTruck className="h-4 w-4" />,
      placeholder: "Selecione fornecedores...",
      options: sources.suppliers,
    },
    {
      key: "quantityRange",
      label: "Faixa de Quantidade",
      type: "number-range",
      icon: <IconNumber className="h-4 w-4" />,
    },
    {
      key: "totalPriceRange",
      label: "Faixa de Preço",
      type: "number-range",
      currency: true,
      icon: <IconCurrencyDollar className="h-4 w-4" />,
    },
  ];
}

type Range = { min?: number; max?: number };

function activeRange(r: unknown): Range | undefined {
  if (!r || typeof r !== "object") return undefined;
  const { min, max } = r as Range;
  if (min == null && max == null) return undefined;
  return { ...(min != null ? { min } : {}), ...(max != null ? { max } : {}) };
}

/**
 * Map the declarative filter values + global search onto an `ItemGetManyFormData` query.
 * Mirrors the legacy `ItemFilters.handleApply` mapping. Default (no Status chosen) is active-only,
 * matching the legacy `isActive: true` default; "Ambos" lifts the filter entirely.
 */
export function buildItemQuery(filters: DataTableFilterValues, search: string): Partial<ItemGetManyFormData> {
  const root: Record<string, unknown> = {};
  const where: Record<string, unknown> = {};

  // Status → isActive (default active-only; "ambos" = both).
  const status = filters.status as string | undefined;
  if (status === "ambos") {
    // no isActive filter
  } else if (status === "inativo") {
    root.isActive = false;
  } else {
    root.isActive = true; // "ativo" or unset
  }

  // Atribuir ao usuário (where.shouldAssignToUser).
  const saiu = filters.shouldAssignToUser;
  if (saiu === "true" || saiu === true) where.shouldAssignToUser = true;
  else if (saiu === "false" || saiu === false) where.shouldAssignToUser = false;

  // Status de Estoque (root stockLevels; resolved against reorder points by the service layer).
  const stockLevels = filters.stockLevels;
  if (Array.isArray(stockLevels) && stockLevels.length > 0) root.stockLevels = stockLevels;

  // Categoria (root categoryIds + includeSubcategories so a parent matches its subcategories too).
  const categoryIds = filters.categoryIds;
  if (Array.isArray(categoryIds) && categoryIds.length > 0) {
    root.categoryIds = categoryIds;
    root.includeSubcategories = true;
  }

  // Tipo Contábil (rolled up from the item's category).
  const accountingTypes = filters.accountingTypes;
  if (Array.isArray(accountingTypes) && accountingTypes.length > 0) {
    where.category = { ...(where.category as Record<string, unknown> | undefined), accountingType: { in: accountingTypes } };
  }

  // Categoria a revisar.
  const reviewNeeded = filters.categoryReviewNeeded;
  if (reviewNeeded === "true" || reviewNeeded === true) root.categoryReviewNeeded = true;
  else if (reviewNeeded === "false" || reviewNeeded === false) root.categoryReviewNeeded = false;

  // Marca / Fornecedor (root id arrays).
  const brandIds = filters.brandIds;
  if (Array.isArray(brandIds) && brandIds.length > 0) root.brandIds = brandIds;
  const supplierIds = filters.supplierIds;
  if (Array.isArray(supplierIds) && supplierIds.length > 0) root.supplierIds = supplierIds;

  // Ranges.
  const qr = activeRange(filters.quantityRange);
  if (qr) root.quantityRange = qr;
  const pr = activeRange(filters.totalPriceRange);
  if (pr) root.totalPriceRange = pr;

  if (Object.keys(where).length > 0) root.where = where;
  if (search) root.searchingFor = search;

  return root as Partial<ItemGetManyFormData>;
}

/** Build the API `orderBy` from the table's sort state; defaults to name ascending. */
export function buildItemOrderBy(sorting: { id: string; desc: boolean }[]): Record<string, unknown> | Record<string, unknown>[] {
  const entries = sorting
    .map((s) => ITEM_SORT_FIELD_MAP[s.id]?.(s.desc ? "desc" : "asc"))
    .filter((e): e is Record<string, unknown> => !!e);
  if (entries.length === 0) return { name: "asc" };
  return entries.length === 1 ? entries[0] : entries;
}
