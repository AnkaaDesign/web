import { IconTrendingUp, IconTrendingDown, IconMinus, IconAlertTriangle } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import type { DataTableColumnDef } from "@/components/ui/datatable";
import type { Item } from "@/types";
import {
  SECTOR_PRIVILEGES,
  PPE_TYPE_LABELS,
  ACCOUNTING_TYPE_LABELS,
  MEASURE_UNIT_LABELS,
} from "@/constants";
import { formatCurrency, formatDate, formatItemLocation, itemUtils } from "@/utils";
import { StockStatusIndicator } from "../list/stock-status-indicator";
import { MeasureDisplayCompact } from "../common/measure-display";
import { AbcXyzBadge } from "../common/abc-xyz-badge";

// Sectors allowed to see monetary columns — everyone EXCEPT warehouse (mirrors `canViewPrices`,
// which hides money from WAREHOUSE only). ADMIN always passes the gate automatically.
const PRICE_VIEWERS = (Object.values(SECTOR_PRIVILEGES) as SECTOR_PRIVILEGES[]).filter(
  (p) => p !== SECTOR_PRIVILEGES.WAREHOUSE,
);

/** Format an optional number the pt-BR way: whole numbers without decimals, else 2 decimals. */
function fmtNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return value % 1 === 0
    ? value.toLocaleString("pt-BR")
    : value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return `${value % 1 === 0 ? value.toLocaleString("pt-BR") : value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function measuresText(item: Item): string {
  if (!item.measures || item.measures.length === 0) return "";
  return item.measures
    .map((m) => `${m.value} ${m.unit && MEASURE_UNIT_LABELS[m.unit] ? MEASURE_UNIT_LABELS[m.unit] : m.unit || ""}`)
    .join(", ");
}

const MutedDash = () => <div className="truncate text-muted-foreground">-</div>;

/** Render the monthly-consumption value only (the trend lives in its own column). */
function MonthlyConsumptionCell({ item }: { item: Item }) {
  if (!item.monthlyConsumption) return <div className="truncate">-</div>;
  return <div className="truncate tabular-nums">{Math.round(item.monthlyConsumption).toLocaleString("pt-BR")}</div>;
}

/** Render the consumption trend with up/down/flat arrow. Red = rising (bad), green = falling (good). */
function ConsumptionTrendCell({ item }: { item: Item }) {
  const trend = item.monthlyConsumptionTrendPercent;
  if (trend === null || trend === undefined || trend === 0) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <IconMinus size={12} />
        <span>-</span>
      </div>
    );
  }
  const isUp = trend > 0;
  const colorClass = isUp ? "text-red-700 dark:text-red-500" : "text-green-700 dark:text-green-500";
  return (
    <div className={`flex items-center gap-1 text-xs ${colorClass}`}>
      {isUp ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
      <span className="whitespace-nowrap">{Math.abs(trend).toFixed(1)}%</span>
    </div>
  );
}

/**
 * The full item column set as generic `DataTableColumnDef`s. Every column sets `meta.exportValue`
 * + `meta.exportHeader` so the built-in xlsx/pdf export + global search match the legacy export
 * content. Monetary columns (price / totalPrice) carry `requiredPrivilege: PRICE_VIEWERS` so they
 * are dropped entirely (cells, header, picker, export) for WAREHOUSE users — same as the legacy
 * `canViewPrices` gate.
 *
 * `defaultVisible` mirrors the legacy default column set:
 *   uniCode, name, brand, category, quantity, monthlyConsumption, monthlyConsumptionTrend, price.
 */
export function createItemTableColumns(): DataTableColumnDef<Item>[] {
  return [
    {
      id: "uniCode",
      header: "CÓDIGO",
      accessorKey: "uniCode",
      enableSorting: true,
      size: 110,
      minSize: 90,
      meta: { headerLabel: "Código", exportHeader: "Código Único", exportValue: (i) => i.uniCode || "" },
      cell: ({ row }) => <div className="text-sm truncate">{row.original.uniCode || "-"}</div>,
    },
    {
      id: "name",
      header: "NOME",
      accessorKey: "name",
      enableSorting: true,
      size: 256,
      minSize: 180,
      meta: { headerLabel: "Nome", exportHeader: "Nome", exportValue: (i) => i.name },
      cell: ({ row }) => <div className="font-medium truncate">{row.original.name}</div>,
    },
    {
      id: "brand",
      enableSorting: false,
      header: "MARCA",
      accessorFn: (i) => i.brands?.map((b) => b.name).join(", ") || "",
      size: 140,
      minSize: 100,
      meta: { headerLabel: "Marca", exportHeader: "Marca", exportValue: (i) => i.brands?.map((b) => b.name).join(", ") || "" },
      cell: ({ row }) => <div className="truncate">{row.original.brands?.map((b) => b.name).join(", ") || "-"}</div>,
    },
    {
      id: "category",
      header: "CATEGORIA",
      accessorFn: (i) => i.category?.name || "",
      enableSorting: true,
      size: 160,
      minSize: 120,
      meta: { headerLabel: "Categoria", exportHeader: "Categoria", exportValue: (i) => i.category?.name || "" },
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 truncate">
          <span className="truncate">{row.original.category?.name || "-"}</span>
          {row.original.categoryReviewNeeded && (
            <span title="Categoria a revisar">
              <IconAlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            </span>
          )}
        </div>
      ),
    },
    {
      id: "accountingType",
      enableSorting: false,
      header: "TIPO CONTÁBIL",
      accessorFn: (i) => (i.category?.accountingType ? ACCOUNTING_TYPE_LABELS[i.category.accountingType] : ""),
      size: 144,
      meta: {
        defaultVisible: false,
        headerLabel: "Tipo Contábil",
        exportHeader: "Tipo Contábil",
        exportValue: (i) => (i.category?.accountingType ? ACCOUNTING_TYPE_LABELS[i.category.accountingType] : ""),
      },
      cell: ({ row }) =>
        row.original.category?.accountingType ? (
          <Badge variant="secondary" className="text-xs">
            {ACCOUNTING_TYPE_LABELS[row.original.category.accountingType] || row.original.category.accountingType}
          </Badge>
        ) : (
          <MutedDash />
        ),
    },
    {
      id: "categoryReviewNeeded",
      enableSorting: false,
      header: "A REVISAR",
      accessorFn: (i) => (i.categoryReviewNeeded ? "A revisar" : ""),
      size: 112,
      meta: {
        defaultVisible: false,
        headerLabel: "A Revisar",
        exportHeader: "A Revisar",
        exportValue: (i) => (i.categoryReviewNeeded ? "Sim" : "Não"),
      },
      cell: ({ row }) =>
        row.original.categoryReviewNeeded ? (
          <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 dark:text-amber-400">
            <IconAlertTriangle className="h-3 w-3 mr-1" />
            A revisar
          </Badge>
        ) : (
          <MutedDash />
        ),
    },
    {
      id: "measures",
      enableSorting: false,
      header: "MEDIDAS",
      accessorFn: (i) => measuresText(i),
      size: 192,
      meta: { defaultVisible: false, headerLabel: "Medidas", exportHeader: "Medidas", exportValue: (i) => measuresText(i) },
      cell: ({ row }) => <MeasureDisplayCompact item={row.original} />,
    },
    {
      id: "quantity",
      header: "QNT",
      accessorKey: "quantity",
      enableSorting: true,
      size: 120,
      minSize: 90,
      meta: { headerLabel: "Quantidade", exportHeader: "Quantidade", exportValue: (i) => itemUtils.formatItemQuantity(i) },
      cell: ({ row }) => (
        <div className="flex">
          <StockStatusIndicator item={row.original} showQuantity />
        </div>
      ),
    },
    {
      id: "monthlyConsumption",
      header: "CONSUMO MENSAL",
      accessorKey: "monthlyConsumption",
      enableSorting: true,
      size: 130,
      meta: {
        headerLabel: "Consumo Mensal",
        exportHeader: "Consumo Mensal",
        exportValue: (i) => (i.monthlyConsumption ? i.monthlyConsumption.toLocaleString("pt-BR") : ""),
      },
      cell: ({ row }) => <MonthlyConsumptionCell item={row.original} />,
    },
    {
      id: "monthlyConsumptionTrend",
      header: "TENDÊNCIA",
      accessorFn: (i) => i.monthlyConsumptionTrendPercent ?? 0,
      enableSorting: true,
      size: 120,
      meta: {
        headerLabel: "Tendência",
        exportHeader: "Tendência de Consumo (%)",
        exportValue: (i) =>
          i.monthlyConsumptionTrendPercent !== null && i.monthlyConsumptionTrendPercent !== undefined
            ? `${i.monthlyConsumptionTrendPercent > 0 ? "+" : ""}${i.monthlyConsumptionTrendPercent.toFixed(2)}%`
            : "",
      },
      cell: ({ row }) => <ConsumptionTrendCell item={row.original} />,
    },
    {
      id: "price",
      enableSorting: false,
      header: "PREÇO",
      accessorFn: (i) => i.prices?.[0]?.value ?? null,
      size: 120,
      minSize: 90,
      meta: {
        headerLabel: "Preço",
        exportHeader: "Preço",
        requiredPrivilege: PRICE_VIEWERS,
        exportValue: (i) => (i.prices?.[0]?.value ? formatCurrency(i.prices[0].value) : ""),
      },
      cell: ({ row }) => (
        <div className="font-medium truncate">{row.original.prices?.[0]?.value ? formatCurrency(row.original.prices[0].value) : "-"}</div>
      ),
    },
    {
      id: "totalPrice",
      enableSorting: false,
      header: "VALOR TOTAL",
      accessorKey: "totalPrice",
      size: 120,
      minSize: 90,
      meta: {
        // Hidden by default — the legacy default column set showed `price` but never `totalPrice`
        // (see the default-set doc-comment above). Only the absence of this flag made it show up.
        defaultVisible: false,
        headerLabel: "Valor Total",
        exportHeader: "Valor Total",
        requiredPrivilege: PRICE_VIEWERS,
        exportValue: (i) => (i.totalPrice ? formatCurrency(i.totalPrice) : ""),
      },
      cell: ({ row }) => <div className="font-semibold truncate">{row.original.totalPrice ? formatCurrency(row.original.totalPrice) : "-"}</div>,
    },
    {
      id: "abcxyz",
      enableSorting: false,
      header: "ABC/XYZ",
      accessorFn: (i) => `${i.abcCategory ?? ""}${i.xyzCategory ?? ""}`,
      size: 110,
      meta: {
        defaultVisible: false,
        headerLabel: "ABC/XYZ",
        exportHeader: "ABC/XYZ",
        exportValue: (i) => `${i.abcCategory ?? ""}${i.xyzCategory ?? ""}`,
      },
      cell: ({ row }) =>
        row.original.abcCategory || row.original.xyzCategory ? (
          <div className="flex">
            <AbcXyzBadge item={row.original} showBoth size="sm" />
          </div>
        ) : (
          <MutedDash />
        ),
    },
    {
      id: "ca",
      header: "CA",
      accessorFn: (i) => i.ppeCA || "",
      enableSorting: true,
      size: 112,
      meta: { defaultVisible: false, headerLabel: "CA", exportHeader: "CA", exportValue: (i) => i.ppeCA || "" },
      cell: ({ row }) => <div className="text-sm truncate">{row.original.ppeCA || "-"}</div>,
    },
    {
      id: "barcodes",
      enableSorting: false,
      header: "CÓDIGOS DE BARRAS",
      accessorFn: (i) => i.barcodes?.join(", ") || "",
      size: 192,
      meta: {
        defaultVisible: false,
        headerLabel: "Códigos de Barras",
        exportHeader: "Códigos de Barras",
        exportValue: (i) => i.barcodes?.join(", ") || "",
      },
      cell: ({ row }) => <div className="text-xs truncate">{row.original.barcodes?.length > 0 ? row.original.barcodes.join(", ") : "-"}</div>,
    },
    {
      id: "maxQuantity",
      header: "QTD. MÁXIMA",
      accessorKey: "maxQuantity",
      enableSorting: true,
      size: 120,
      meta: { defaultVisible: false, headerLabel: "Qtd. Máxima", exportHeader: "Qtd. Máxima", exportValue: (i) => i.maxQuantity?.toString() || "" },
      cell: ({ row }) => <div className="text-muted-foreground truncate">{fmtNumber(row.original.maxQuantity)}</div>,
    },
    {
      id: "reorderPoint",
      header: "PONTO DE REPOSIÇÃO",
      accessorKey: "reorderPoint",
      enableSorting: true,
      size: 130,
      meta: {
        defaultVisible: false,
        headerLabel: "Ponto de Reposição",
        exportHeader: "Ponto de Reposição",
        exportValue: (i) => i.reorderPoint?.toString() || "",
      },
      cell: ({ row }) => <div className="text-muted-foreground truncate">{fmtNumber(row.original.reorderPoint)}</div>,
    },
    {
      id: "reorderQuantity",
      header: "QTD. DE REPOSIÇÃO",
      accessorKey: "reorderQuantity",
      enableSorting: true,
      size: 130,
      meta: {
        defaultVisible: false,
        headerLabel: "Qtd. de Reposição",
        exportHeader: "Qtd. de Reposição",
        exportValue: (i) => i.reorderQuantity?.toString() || "",
      },
      cell: ({ row }) => <div className="text-muted-foreground truncate">{fmtNumber(row.original.reorderQuantity)}</div>,
    },
    {
      id: "boxQuantity",
      header: "QTD. POR CAIXA",
      accessorKey: "boxQuantity",
      enableSorting: true,
      size: 120,
      meta: { defaultVisible: false, headerLabel: "Qtd. por Caixa", exportHeader: "Qtd. por Caixa", exportValue: (i) => i.boxQuantity?.toString() || "" },
      cell: ({ row }) => <div className="text-muted-foreground truncate">{fmtNumber(row.original.boxQuantity)}</div>,
    },
    {
      id: "icms",
      header: "ICMS",
      accessorKey: "icms",
      enableSorting: true,
      size: 90,
      meta: { defaultVisible: false, requiredPrivilege: PRICE_VIEWERS, headerLabel: "ICMS", exportHeader: "ICMS", exportValue: (i) => (i.icms ? `${i.icms}%` : "") },
      cell: ({ row }) => <div className="text-muted-foreground truncate">{fmtPercent(row.original.icms)}</div>,
    },
    {
      id: "ipi",
      header: "IPI",
      accessorKey: "ipi",
      enableSorting: true,
      size: 90,
      meta: { defaultVisible: false, requiredPrivilege: PRICE_VIEWERS, headerLabel: "IPI", exportHeader: "IPI", exportValue: (i) => (i.ipi ? `${i.ipi}%` : "") },
      cell: ({ row }) => <div className="text-muted-foreground truncate">{fmtPercent(row.original.ipi)}</div>,
    },
    {
      id: "supplier",
      header: "FORNECEDOR",
      accessorFn: (i) => i.supplier?.fantasyName || "",
      enableSorting: true,
      size: 160,
      meta: { defaultVisible: false, headerLabel: "Fornecedor", exportHeader: "Fornecedor", exportValue: (i) => i.supplier?.fantasyName || "" },
      cell: ({ row }) => <div className="truncate">{row.original.supplier?.fantasyName || "-"}</div>,
    },
    {
      id: "warehouseLocation",
      header: "LOCALIZAÇÃO",
      accessorFn: (i) => formatItemLocation(i),
      enableSorting: true,
      size: 160,
      meta: { defaultVisible: false, headerLabel: "Localização", exportHeader: "Localização", exportValue: (i) => formatItemLocation(i) },
      cell: ({ row }) => <div className="truncate">{formatItemLocation(row.original)}</div>,
    },
    {
      id: "ppeType",
      enableSorting: false,
      header: "TIPO EPI",
      accessorFn: (i) => (i.ppeType ? PPE_TYPE_LABELS[i.ppeType] || i.ppeType : ""),
      size: 130,
      meta: {
        defaultVisible: false,
        headerLabel: "Tipo EPI",
        exportHeader: "Tipo EPI",
        exportValue: (i) => (i.ppeType ? PPE_TYPE_LABELS[i.ppeType] || i.ppeType : ""),
      },
      cell: ({ row }) =>
        row.original.ppeType ? (
          <Badge variant="outline" className="text-xs">
            {PPE_TYPE_LABELS[row.original.ppeType] || row.original.ppeType}
          </Badge>
        ) : (
          <div className="text-muted-foreground">-</div>
        ),
    },
    {
      id: "shouldAssignToUser",
      header: "ATRIBUIR AO USUÁRIO",
      accessorKey: "shouldAssignToUser",
      enableSorting: true,
      size: 140,
      meta: {
        defaultVisible: false,
        headerLabel: "Atribuir ao Usuário",
        exportHeader: "Atribuir ao Usuário",
        exportValue: (i) => (i.shouldAssignToUser ? "Sim" : "Não"),
      },
      cell: ({ row }) => (
        <div className="flex">
          <Badge variant={row.original.shouldAssignToUser ? "default" : "secondary"}>{row.original.shouldAssignToUser ? "Sim" : "Não"}</Badge>
        </div>
      ),
    },
    {
      id: "estimatedLeadTime",
      header: "PRAZO ESTIMADO",
      accessorKey: "estimatedLeadTime",
      enableSorting: true,
      size: 130,
      meta: {
        defaultVisible: false,
        headerLabel: "Prazo Estimado",
        exportHeader: "Prazo Estimado",
        exportValue: (i) => (i.estimatedLeadTime ? `${i.estimatedLeadTime} dias` : ""),
      },
      cell: ({ row }) => <div className="text-muted-foreground">{row.original.estimatedLeadTime ? `${row.original.estimatedLeadTime} dias` : "-"}</div>,
    },
    {
      id: "isActive",
      header: "STATUS",
      accessorKey: "isActive",
      enableSorting: true,
      size: 90,
      meta: { defaultVisible: false, headerLabel: "Status", exportHeader: "Status", exportValue: (i) => (i.isActive ? "Ativo" : "Inativo") },
      cell: ({ row }) => (
        <div className="flex">
          <Badge variant={row.original.isActive ? "default" : "secondary"}>{row.original.isActive ? "Ativo" : "Inativo"}</Badge>
        </div>
      ),
    },
    {
      id: "activitiesCount",
      enableSorting: false,
      header: "ATIVIDADES",
      accessorFn: (i) => (i as { _count?: { activities?: number } })._count?.activities ?? 0,
      size: 110,
      meta: {
        defaultVisible: false,
        align: "center",
        headerLabel: "Atividades",
        exportHeader: "Atividades",
        exportValue: (i) => String((i as { _count?: { activities?: number } })._count?.activities ?? 0),
      },
      cell: ({ row }) => (
        <Badge variant="default" className="w-10 justify-center">
          {(row.original as { _count?: { activities?: number } })._count?.activities || 0}
        </Badge>
      ),
    },
    {
      id: "createdAt",
      header: "CRIADO EM",
      accessorKey: "createdAt",
      enableSorting: true,
      size: 130,
      meta: { defaultVisible: false, headerLabel: "Criado em", exportHeader: "Criado em", exportValue: (i) => formatDate(new Date(i.createdAt)) },
      cell: ({ row }) => <div className="text-sm text-muted-foreground">{new Date(row.original.createdAt).toLocaleDateString("pt-BR")}</div>,
    },
    {
      id: "updatedAt",
      header: "ATUALIZADO EM",
      accessorKey: "updatedAt",
      enableSorting: true,
      size: 130,
      meta: { defaultVisible: false, headerLabel: "Atualizado em", exportHeader: "Atualizado em", exportValue: (i) => formatDate(new Date(i.updatedAt)) },
      cell: ({ row }) => <div className="text-sm text-muted-foreground">{new Date(row.original.updatedAt).toLocaleDateString("pt-BR")}</div>,
    },
  ];
}

/**
 * Server-side sort mapping: column id → `ItemOrderBy` for that direction. Only columns that map to a
 * real API orderBy field are server-sortable (the others set `enableSorting:false`). price /
 * totalPrice / categoryReviewNeeded / abcxyz have no scalar orderBy and are intentionally not sorted.
 */
export const ITEM_SORT_FIELD_MAP: Record<string, (dir: "asc" | "desc") => Record<string, unknown>> = {
  uniCode: (d) => ({ uniCode: d }),
  name: (d) => ({ name: d }),
  category: (d) => ({ category: { name: d } }),
  quantity: (d) => ({ quantity: d }),
  monthlyConsumption: (d) => ({ monthlyConsumption: d }),
  monthlyConsumptionTrend: (d) => ({ monthlyConsumptionTrendPercent: d }),
  ca: (d) => ({ CA: d }),
  maxQuantity: (d) => ({ maxQuantity: d }),
  reorderPoint: (d) => ({ reorderPoint: d }),
  reorderQuantity: (d) => ({ reorderQuantity: d }),
  boxQuantity: (d) => ({ boxQuantity: d }),
  icms: (d) => ({ icms: d }),
  ipi: (d) => ({ ipi: d }),
  supplier: (d) => ({ supplier: { fantasyName: d } }),
  warehouseLocation: (d) => ({ warehouseLocation: { name: d } }),
  shouldAssignToUser: (d) => ({ shouldAssignToUser: d }),
  estimatedLeadTime: (d) => ({ estimatedLeadTime: d }),
  isActive: (d) => ({ isActive: d }),
  createdAt: (d) => ({ createdAt: d }),
  updatedAt: (d) => ({ updatedAt: d }),
};
