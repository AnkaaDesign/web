import { formatCurrency } from "../../../../utils";
import { PPE_TYPE_LABELS } from "../../../../constants";
import type { Item } from "../../../../types";
import { Badge } from "../../../ui/badge";
import { Input } from "../../../ui/input";
import { Checkbox } from "../../../ui/checkbox";
import { StockStatusIndicator } from "../../item/list/stock-status-indicator";
import { MeasureDisplayCompact } from "../../item/common/measure-display";
import { TABLE_LAYOUT } from "../../../ui/table-constants";
import type { ItemSelectorColumn, ItemSelectorContext, EditableColumnsConfig } from "./item-selector-types";
import { IconTrendingUp, IconTrendingDown, IconMinus } from "@tabler/icons-react";

// Helper function to render the monthly consumption value only
const renderMonthlyConsumption = (item: Item) => {
  const consumption = item.monthlyConsumption;
  if (!consumption) return <div className="truncate">-</div>;
  const formattedConsumption = Math.round(consumption).toLocaleString("pt-BR");
  return <div className="truncate tabular-nums">{formattedConsumption}</div>;
};

// Helper function to render the consumption trend in its own column
const renderConsumptionTrend = (item: Item) => {
  const trend = item.monthlyConsumptionTrendPercent;

  if (trend === null || trend === 0) {
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
};

/**
 * Compute estimated per-cycle quantity for the order-schedule preview.
 * Algorithm-spec §9: system auto-calculates the quantity each cycle from
 * daily consumption × cycle days + lead time + safety buffer, snapped up to
 * the box quantity (when defined). Floored at the reorder point so the next
 * cycle always replenishes to a healthy level.
 */
export function computeCyclePreviewQuantity(item: Item, cycleDays: number): number | null {
  if (!cycleDays || cycleDays <= 0) return null;
  const monthly = item.monthlyConsumption || 0;
  if (monthly <= 0 && (item.reorderPoint || 0) <= 0) return null;
  const dailyConsumption = monthly / 30;
  const leadTime = item.estimatedLeadTime || 0;
  const safetyBuffer = 0.05; // 5% safety buffer (matches API default)
  const projected = dailyConsumption * (cycleDays + leadTime) * (1 + safetyBuffer);
  const floor = item.reorderPoint || 0;
  let quantity = Math.max(projected, floor);
  // Snap up to multiples of boxQuantity when set
  if (item.boxQuantity && item.boxQuantity > 0) {
    quantity = Math.ceil(quantity / item.boxQuantity) * item.boxQuantity;
  } else {
    quantity = Math.ceil(quantity);
  }
  return quantity;
}

/**
 * Create all available columns for item selector
 * Includes both display columns and editable input columns
 */
export const createItemSelectorColumns = (
  editableConfig?: EditableColumnsConfig,
  _context?: ItemSelectorContext,
  extraConfig?: { cycleDays?: number }
): ItemSelectorColumn[] => {
  const columns: ItemSelectorColumn[] = [
    // Checkbox column - always fixed
    {
      key: "checkbox",
      header: "",
      accessor: (item: Item, ctx?: ItemSelectorContext) => {
        const isSelected = ctx?.isSelected?.(item.id) ?? ctx?.selectedItems.has(item.id) ?? false;
        return (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => {
              // Pass item data (quantity/stock, price, icms, ipi) when selecting
              const quantity = item.quantity; // Current stock
              const price = item.prices?.[0]?.value;
              const icms = item.icms;
              const ipi = item.ipi;
              ctx?.onSelectItem?.(item.id, quantity, price, icms, ipi);
            }}
          />
        );
      },
      sortable: false,
      className: TABLE_LAYOUT.checkbox.className,
      align: "left",
      fixed: true,
      fixedReason: "Necessário para seleção de itens",
    },
    // Primary columns
    {
      key: "uniCode",
      header: "CÓDIGO",
      accessor: (item: Item) => <div className="text-sm truncate">{item.uniCode || "-"}</div>,
      sortable: true,
      className: "w-28",
      align: "left",
    },
    {
      key: "name",
      header: "NOME",
      accessor: (item: Item) => <div className="font-medium truncate">{item.name}</div>,
      sortable: true,
      className: "w-64",
      align: "left",
      fixed: true,
      fixedReason: "Essencial para identificar o item",
    },
    {
      key: "brand.name",
      header: "MARCA",
      accessor: (item: Item) => <div className="truncate">{item.brand?.name || "-"}</div>,
      sortable: true,
      className: "w-32",
      align: "left",
    },
    {
      key: "category.name",
      header: "CATEGORIA",
      accessor: (item: Item) => <div className="truncate">{item.category?.name || "-"}</div>,
      sortable: true,
      className: "w-40",
      align: "left",
    },
    {
      key: "measures",
      header: "MEDIDAS",
      accessor: (item: Item) => <MeasureDisplayCompact item={item} />,
      sortable: false,
      className: "w-48",
      align: "left",
    },
    {
      key: "quantity",
      header: "ESTOQUE",
      accessor: (item: Item) => (
        <div className="flex">
          <StockStatusIndicator item={item} showQuantity={true} />
        </div>
      ),
      sortable: true,
      className: "w-28",
      align: "left",
    },
    {
      key: "monthlyConsumption",
      header: "CONSUMO",
      accessor: (item: Item) => renderMonthlyConsumption(item),
      sortable: true,
      className: "w-24",
      align: "left",
    },
    {
      key: "monthlyConsumptionTrendPercent",
      header: "TENDÊNCIA",
      accessor: (item: Item) => renderConsumptionTrend(item),
      sortable: true,
      className: "w-28",
      align: "left",
    },
    {
      key: "price",
      header: "PREÇO",
      accessor: (item: Item) => (
        <div className="font-medium truncate">
          {item.prices?.[0]?.value ? formatCurrency(item.prices[0].value) : "-"}
        </div>
      ),
      sortable: true,
      className: "w-28",
      align: "left",
    },
    {
      key: "totalPrice",
      header: "VALOR TOTAL",
      accessor: (item: Item) => (
        <div className="font-semibold truncate">
          {item.totalPrice ? formatCurrency(item.totalPrice) : "-"}
        </div>
      ),
      sortable: true,
      className: "w-28",
      align: "left",
    },
    // Per-row order subtotal — qty (this order) × unit price + ICMS + IPI.
    // Distinct from `totalPrice` above (which is current stock × catalog price).
    {
      key: "orderSubtotal",
      header: "SUBTOTAL",
      accessor: (item: Item, ctx?: ItemSelectorContext) => {
        const isSelected = ctx?.isSelected?.(item.id) ?? ctx?.selectedItems.has(item.id) ?? false;
        if (!isSelected) return <div className="text-muted-foreground">—</div>;
        const qty = Number(ctx?.quantities?.[item.id]) || 0;
        const price = Number(ctx?.prices?.[item.id]) || 0;
        const icms = Number(ctx?.icmses?.[item.id]) || 0;
        const ipi = Number(ctx?.ipis?.[item.id]) || 0;
        const subtotal = qty * price;
        const total = subtotal + (subtotal * (icms / 100)) + (subtotal * (ipi / 100));
        return <div className="font-semibold truncate">{formatCurrency(total)}</div>;
      },
      sortable: false,
      className: "w-32",
      align: "left",
    },
    // Secondary columns
    {
      key: "CA",
      header: "CA",
      accessor: (item: Item) => <div className="text-sm truncate">{item.ppeCA || "-"}</div>,
      sortable: true,
      className: "w-28",
      align: "left",
    },
    {
      key: "barcodes",
      header: "CÓDIGOS DE BARRAS",
      accessor: (item: Item) => (
        <div className="text-xs truncate">
          {item.barcodes?.length > 0 ? item.barcodes.join(", ") : "-"}
        </div>
      ),
      sortable: false,
      className: "w-48",
      align: "left",
    },
    {
      key: "maxQuantity",
      header: "QTD. MÁXIMA",
      accessor: (item: Item) => (
        <div className="text-muted-foreground truncate">
          {item.maxQuantity !== null && item.maxQuantity !== undefined
            ? item.maxQuantity % 1 === 0
              ? item.maxQuantity.toLocaleString("pt-BR")
              : item.maxQuantity.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "-"}
        </div>
      ),
      sortable: true,
      className: "w-28",
      align: "left",
    },
    {
      key: "reorderPoint",
      header: "PONTO DE REPOSIÇÃO",
      accessor: (item: Item) => (
        <div className="text-muted-foreground truncate">
          {item.reorderPoint !== null && item.reorderPoint !== undefined
            ? item.reorderPoint % 1 === 0
              ? item.reorderPoint.toLocaleString("pt-BR")
              : item.reorderPoint.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "-"}
        </div>
      ),
      sortable: true,
      className: "w-28",
      align: "left",
    },
    // Order-schedule preview column (algorithm-spec §9). Hidden by default and
    // only rendered with a meaningful value when a cycleDays value is provided
    // by the parent form.
    {
      key: "computedCycleQuantity",
      header: "QTD. POR CICLO (ESTIMADA)",
      accessor: (item: Item) => {
        const cycleDays = extraConfig?.cycleDays;
        if (!cycleDays) return <div className="text-muted-foreground">—</div>;
        const qty = computeCyclePreviewQuantity(item, cycleDays);
        if (qty == null) return <div className="text-muted-foreground">—</div>;
        return (
          <div className="flex flex-col">
            <span className="font-semibold tabular-nums">
              {qty.toLocaleString("pt-BR")}
            </span>
            <span className="text-[10px] text-muted-foreground leading-tight">
              Estimada — confirmada a cada ciclo
            </span>
          </div>
        );
      },
      sortable: false,
      className: "w-44",
      align: "left",
    },
    {
      key: "icms",
      header: "ICMS",
      accessor: (item: Item) => (
        <div className="text-muted-foreground truncate">
          {item.icms !== null && item.icms !== undefined
            ? `${item.icms % 1 === 0 ? item.icms.toLocaleString("pt-BR") : item.icms.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
            : "-"}
        </div>
      ),
      sortable: true,
      className: "w-20",
      align: "left",
    },
    {
      key: "ipi",
      header: "IPI",
      accessor: (item: Item) => (
        <div className="text-muted-foreground truncate">
          {item.ipi !== null && item.ipi !== undefined
            ? `${item.ipi % 1 === 0 ? item.ipi.toLocaleString("pt-BR") : item.ipi.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
            : "-"}
        </div>
      ),
      sortable: true,
      className: "w-20",
      align: "left",
    },
    {
      key: "supplier.fantasyName",
      header: "FORNECEDOR",
      accessor: (item: Item) => <div className="truncate">{item.supplier?.fantasyName || "-"}</div>,
      sortable: true,
      className: "w-40",
      align: "left",
    },
    {
      key: "ppeType",
      header: "TIPO EPI",
      accessor: (item: Item) => {
        const ppeType = item.ppeType;
        if (!ppeType) {
          return <div className="text-muted-foreground">-</div>;
        }
        return (
          <Badge variant="outline" className="text-xs">
            {PPE_TYPE_LABELS[ppeType] || ppeType}
          </Badge>
        );
      },
      sortable: false,
      className: "w-32",
      align: "left",
    },
    {
      key: "shouldAssignToUser",
      header: "ATRIBUIR AO USUÁRIO",
      accessor: (item: Item) => (
        <div className="flex">
          <Badge variant={item.shouldAssignToUser ? "default" : "secondary"}>
            {item.shouldAssignToUser ? "Sim" : "Não"}
          </Badge>
        </div>
      ),
      sortable: true,
      className: "w-32",
      align: "left",
    },
    {
      key: "estimatedLeadTime",
      header: "PRAZO ESTIMADO",
      accessor: (item: Item) => (
        <div className="text-muted-foreground">
          {item.estimatedLeadTime ? `${item.estimatedLeadTime} dias` : "-"}
        </div>
      ),
      sortable: true,
      className: "w-32",
      align: "left",
    },
    {
      key: "isActive",
      header: "STATUS",
      accessor: (item: Item) => (
        <div className="flex">
          <Badge variant={item.isActive ? "default" : "secondary"}>
            {item.isActive ? "Ativo" : "Inativo"}
          </Badge>
        </div>
      ),
      sortable: true,
      className: "w-20",
      align: "left",
    },
    {
      key: "activitiesCount",
      header: "ATIVIDADES",
      accessor: (item: Item) => (
        <div className="text-center">
          <Badge variant="outline" className="font-mono">
            {(item as any)._count?.activities || 0}
          </Badge>
        </div>
      ),
      sortable: false,
      className: "w-24",
      align: "left",
    },
    {
      key: "createdAt",
      header: "CRIADO EM",
      accessor: (item: Item) => (
        <div className="text-sm text-muted-foreground">
          {new Date(item.createdAt).toLocaleDateString("pt-BR")}
        </div>
      ),
      sortable: true,
      className: "w-32",
      align: "left",
    },
  ];

  // Add editable columns based on configuration
  const editableColumns: ItemSelectorColumn[] = [];

  if (editableConfig?.showQuantityInput) {
    editableColumns.push({
      key: "quantityInput",
      header: "QUANTIDADE",
      accessor: (item: Item, ctx?: ItemSelectorContext) => {
        const quantity = ctx?.quantities?.[item.id] ?? 1;
        const isSelected = ctx?.isSelected?.(item.id) ?? ctx?.selectedItems.has(item.id) ?? false;

        return (
          <Input
            type="decimal"
            min={0.01}
            step={0.01}
            value={quantity || ""}
            onChange={(value) => {
              const numValue = typeof value === "string" ? parseFloat(value) : value;
              if (numValue !== null && !isNaN(numValue) && numValue >= 0) {
                ctx?.onQuantityChange?.(item.id, numValue);
              }
            }}
            disabled={!isSelected}
            className="w-20 h-8 bg-transparent border-border"
          />
        );
      },
      sortable: false,
      className: "w-24",
      align: "left",
      editable: true,
      fixed: true,
      fixedReason: "Campo obrigatório para especificar quantidade",
    });
  }

  if (editableConfig?.showPriceInput) {
    editableColumns.push({
      key: "priceInput",
      header: "VALOR UNIT.",
      accessor: (item: Item, ctx?: ItemSelectorContext) => {
        const price = ctx?.prices?.[item.id] ?? item.prices?.[0]?.value ?? 0;
        const isSelected = ctx?.isSelected?.(item.id) ?? ctx?.selectedItems.has(item.id) ?? false;

        return (
          <Input
            type="currency"
            decimals={3}
            value={price || undefined}
            onChange={(value) => {
              const numValue = typeof value === "number" ? value : 0;
              ctx?.onPriceChange?.(item.id, numValue);
            }}
            disabled={!isSelected}
            className="w-28 h-8 bg-transparent border-border"
          />
        );
      },
      sortable: false,
      className: "w-32",
      align: "left",
      editable: true,
      fixed: true,
      fixedReason: "Campo obrigatório para especificar preço",
    });
  }

  if (editableConfig?.showIcmsInput) {
    editableColumns.push({
      key: "icmsInput",
      header: "ICMS %",
      accessor: (item: Item, ctx?: ItemSelectorContext) => {
        const icms = ctx?.icmses?.[item.id] ?? item.icms ?? 0;
        const isSelected = ctx?.isSelected?.(item.id) ?? ctx?.selectedItems.has(item.id) ?? false;

        return (
          <Input
            type="decimal"
            min={0}
            max={100}
            step={0.01}
            value={icms || ""}
            onChange={(value) => {
              const numValue = typeof value === "string" ? parseFloat(value) : value;
              if (numValue !== null && !isNaN(numValue) && numValue >= 0 && numValue <= 100) {
                ctx?.onIcmsChange?.(item.id, numValue);
              }
            }}
            disabled={!isSelected}
            className="w-20 h-8 bg-transparent border-border"
          />
        );
      },
      sortable: false,
      className: "w-24",
      align: "left",
      editable: true,
    });
  }

  if (editableConfig?.showIpiInput) {
    editableColumns.push({
      key: "ipiInput",
      header: "IPI %",
      accessor: (item: Item, ctx?: ItemSelectorContext) => {
        const ipi = ctx?.ipis?.[item.id] ?? item.ipi ?? 0;
        const isSelected = ctx?.isSelected?.(item.id) ?? ctx?.selectedItems.has(item.id) ?? false;

        return (
          <Input
            type="decimal"
            min={0}
            max={100}
            step={0.01}
            value={ipi || ""}
            onChange={(value) => {
              const numValue = typeof value === "string" ? parseFloat(value) : value;
              if (numValue !== null && !isNaN(numValue) && numValue >= 0 && numValue <= 100) {
                ctx?.onIpiChange?.(item.id, numValue);
              }
            }}
            disabled={!isSelected}
            className="w-20 h-8 bg-transparent border-border"
          />
        );
      },
      sortable: false,
      className: "w-24",
      align: "left",
      editable: true,
    });
  }

  // Insert editable columns after primary columns (after totalPrice)
  const totalPriceIndex = columns.findIndex((col) => col.key === "totalPrice");
  if (totalPriceIndex !== -1) {
    columns.splice(totalPriceIndex + 1, 0, ...editableColumns);
  } else {
    columns.push(...editableColumns);
  }

  return columns;
};

/**
 * Get default visible columns for item selector
 * Minimal defaults: checkbox and name, plus any editable inputs configured
 */
export function getDefaultVisibleColumns(editableConfig?: EditableColumnsConfig): Set<string> {
  const defaults = new Set([
    "checkbox",
    "name",
  ]);

  // Add editable columns to defaults if enabled
  if (editableConfig?.showQuantityInput) defaults.add("quantityInput");
  if (editableConfig?.showPriceInput) defaults.add("priceInput");
  if (editableConfig?.showIcmsInput) defaults.add("icmsInput");
  if (editableConfig?.showIpiInput) defaults.add("ipiInput");

  return defaults;
}
