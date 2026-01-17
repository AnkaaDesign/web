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

// Helper function to render monthly consumption with trend
const renderMonthlyConsumptionWithTrend = (item: Item) => {
  const consumption = item.monthlyConsumption;
  const trend = item.monthlyConsumptionTrendPercent;

  if (!consumption) return <div className="truncate">-</div>;

  const formattedConsumption = Math.round(consumption).toLocaleString("pt-BR");

  const getTrendIcon = (trendValue: number | null) => {
    if (trendValue === null || trendValue === 0) {
      return <IconMinus size={12} className="text-muted-foreground" />;
    }
    if (trendValue > 0) {
      return <IconTrendingUp size={12} className="text-red-700 dark:text-red-500" />;
    }
    return <IconTrendingDown size={12} className="text-green-700 dark:text-green-500" />;
  };

  const getTrendColor = (trendValue: number | null) => {
    if (trendValue === null || trendValue === 0) return "text-muted-foreground";
    return trendValue > 0 ? "text-red-700 dark:text-red-500" : "text-green-700 dark:text-green-500";
  };

  return (
    <div className="flex items-center justify-between w-full min-w-0">
      <div className="truncate flex-shrink tabular-nums">{formattedConsumption}</div>
      {trend !== null && trend !== 0 && (
        <div className={`flex items-center gap-1 text-xs flex-shrink-0 mr-6 ${getTrendColor(trend)}`}>
          {getTrendIcon(trend)}
          <span className="whitespace-nowrap">{Math.abs(trend).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
};

/**
 * Create all available columns for item selector
 * Includes both display columns and editable input columns
 */
export const createItemSelectorColumns = (
  editableConfig?: EditableColumnsConfig,
  context?: ItemSelectorContext
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
      accessor: (item: Item) => renderMonthlyConsumptionWithTrend(item),
      sortable: true,
      className: "w-40",
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
              if (!isNaN(numValue) && numValue > 0) {
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
              if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
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
              if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
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
