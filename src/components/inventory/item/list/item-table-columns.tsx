import { formatCurrency, formatItemLocation } from "../../../../utils";
import { PPE_TYPE_LABELS, ACCOUNTING_TYPE_LABELS } from "../../../../constants";
import type { Item } from "../../../../types";
import { Badge } from "../../../ui/badge";
import { StockStatusIndicator } from "./stock-status-indicator";
import { MeasureDisplayCompact } from "../common/measure-display";
import type { ItemColumn } from "./types";
import { IconTrendingUp, IconTrendingDown, IconMinus, IconAlertTriangle } from "@tabler/icons-react";

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

  // Red for increase (bad for inventory), green for decrease (good for inventory)
  const isUp = trend > 0;
  const colorClass = isUp ? "text-red-700 dark:text-red-500" : "text-green-700 dark:text-green-500";

  return (
    <div className={`flex items-center gap-1 text-xs ${colorClass}`}>
      {isUp ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
      <span className="whitespace-nowrap">{Math.abs(trend).toFixed(1)}%</span>
    </div>
  );
};

export const createItemColumns = (): ItemColumn[] => [
  // Primary columns in the correct order
  {
    key: "uniCode",
    header: "CÓDIGO",
    accessor: (item: Item) => <div className="text-sm truncate">{item.uniCode || "-"}</div>,
    sortable: true,
    className: "w-24",
    align: "left",
  },
  {
    key: "name",
    header: "NOME",
    accessor: (item: Item) => <div className="font-medium truncate">{item.name}</div>,
    sortable: true,
    className: "w-64",
    align: "left",
  },
  {
    key: "brand.name",
    header: "MARCA",
    accessor: (item: Item) => <div className="truncate">{item.brands?.map((b) => b.name).join(", ") || "-"}</div>,
    sortable: false,
    className: "w-32",
    align: "left",
  },
  {
    key: "category.name",
    header: "CATEGORIA",
    accessor: (item: Item) => (
      <div className="flex items-center gap-1.5 truncate">
        <span className="truncate">{item.category?.name || "-"}</span>
        {item.categoryReviewNeeded && (
          <span title="Categoria a revisar">
            <IconAlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          </span>
        )}
      </div>
    ),
    sortable: true,
    className: "w-40",
    align: "left",
  },
  {
    key: "category.accountingType",
    header: "TIPO CONTÁBIL",
    // Rolled up from the item's category (read-only display).
    accessor: (item: Item) =>
      item.category?.accountingType ? (
        <Badge variant="secondary" className="text-xs">
          {ACCOUNTING_TYPE_LABELS[item.category.accountingType] || item.category.accountingType}
        </Badge>
      ) : (
        <div className="truncate text-muted-foreground">-</div>
      ),
    sortable: false,
    className: "w-36",
    align: "left",
  },
  {
    key: "categoryReviewNeeded",
    header: "A REVISAR",
    accessor: (item: Item) =>
      item.categoryReviewNeeded ? (
        <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 dark:text-amber-400">
          <IconAlertTriangle className="h-3 w-3 mr-1" />
          A revisar
        </Badge>
      ) : (
        <div className="truncate text-muted-foreground">-</div>
      ),
    sortable: true,
    className: "w-28",
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
    header: "QNT",
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
    header: "CONSUMO MENSAL",
    accessor: (item: Item) => renderMonthlyConsumption(item),
    sortable: true,
    className: "w-28",
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
    accessor: (item: Item) => <div className="font-medium truncate">{item.prices?.[0]?.value ? formatCurrency(item.prices[0].value) : "-"}</div>,
    sortable: true,
    className: "w-28",
    align: "left",
  },
  {
    key: "totalPrice",
    header: "VALOR TOTAL",
    accessor: (item: Item) => <div className="font-semibold truncate">{item.totalPrice ? formatCurrency(item.totalPrice) : "-"}</div>,
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
    accessor: (item: Item) => <div className="text-xs truncate">{item.barcodes?.length > 0 ? item.barcodes.join(", ") : "-"}</div>,
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
    key: "warehouseLocation.name",
    header: "LOCALIZAÇÃO",
    accessor: (item: Item) => <div className="truncate">{formatItemLocation(item)}</div>,
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
        <Badge variant={item.shouldAssignToUser ? "default" : "secondary"}>{item.shouldAssignToUser ? "Sim" : "Não"}</Badge>
      </div>
    ),
    sortable: true,
    className: "w-32",
    align: "left",
  },
  {
    key: "estimatedLeadTime",
    header: "PRAZO ESTIMADO",
    accessor: (item: Item) => <div className="text-muted-foreground">{item.estimatedLeadTime ? `${item.estimatedLeadTime} dias` : "-"}</div>,
    sortable: true,
    className: "w-32",
    align: "left",
  },
  {
    key: "isActive",
    header: "STATUS",
    accessor: (item: Item) => (
      <div className="flex">
        <Badge variant={item.isActive ? "default" : "secondary"}>{item.isActive ? "Ativo" : "Inativo"}</Badge>
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
      <Badge variant="default" className="w-10 justify-center">
        {(item as any)._count?.activities || 0}
      </Badge>
    ),
    sortable: false,
    className: "w-24",
    align: "center",
  },
  {
    key: "createdAt",
    header: "CRIADO EM",
    accessor: (item: Item) => <div className="text-sm text-muted-foreground">{new Date(item.createdAt).toLocaleDateString("pt-BR")}</div>,
    sortable: true,
    className: "w-32",
    align: "left",
  },
];
