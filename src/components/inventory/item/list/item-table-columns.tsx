import { formatCurrency } from "../../../../utils";
import { PPE_TYPE_LABELS, PPE_SIZE_LABELS } from "../../../../constants";
import type { Item } from "../../../../types";
import { Badge } from "../../../ui/badge";
import { StockStatusIndicator } from "./stock-status-indicator";
import { MeasureDisplayCompact } from "../common/measure-display";
import { AbcXyzBadge } from "../common/abc-xyz-badge";
import { TABLE_LAYOUT } from "../../../ui/table-constants";
import type { ItemColumn } from "./types";
import { IconTrendingUp, IconTrendingDown, IconMinus } from "@tabler/icons-react";

// Helper function to render monthly consumption with trend
const renderMonthlyConsumptionWithTrend = (item: Item) => {
  const consumption = item.monthlyConsumption;
  const trend = item.monthlyConsumptionTrendPercent;

  if (!consumption) return <div className="truncate">-</div>;

  const formattedConsumption =
    consumption % 1 === 0 ? consumption.toLocaleString("pt-BR") : consumption.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getTrendIcon = (trendValue: number | null) => {
    if (trendValue === null || trendValue === 0) {
      return <IconMinus size={12} className="text-muted-foreground" />;
    }
    if (trendValue > 0) {
      return <IconTrendingUp size={12} className="text-red-700 dark:text-red-500" />; // Red for increase (bad for inventory)
    }
    return <IconTrendingDown size={12} className="text-green-700 dark:text-green-500" />; // Green for decrease (good for inventory)
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

export const createItemColumns = (): ItemColumn[] => [
  // Primary columns in the correct order
  {
    key: "uniCode",
    header: "CÓDIGO",
    accessor: (item: Item) => <div className="text-sm truncate">{item.uniCode || "-"}</div>,
    sortable: true,
    className: TABLE_LAYOUT.firstDataColumn.className,
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
    header: "QUANTIDADE",
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
    accessor: (item: Item) => renderMonthlyConsumptionWithTrend(item),
    sortable: true,
    className: "w-40", // Wider to accommodate consumption and trend in same row
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
    key: "abcxyz",
    header: "ABC/XYZ",
    accessor: (item: Item) => (
      <div className="flex">
        <AbcXyzBadge item={item} showBoth={true} size="sm" />
      </div>
    ),
    sortable: false,
    className: "w-24",
    align: "left",
  },
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
    key: "reorderQuantity",
    header: "QTD. DE REPOSIÇÃO",
    accessor: (item: Item) => (
      <div className="text-muted-foreground truncate">
        {item.reorderQuantity !== null && item.reorderQuantity !== undefined
          ? item.reorderQuantity % 1 === 0
            ? item.reorderQuantity.toLocaleString("pt-BR")
            : item.reorderQuantity.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : "-"}
      </div>
    ),
    sortable: true,
    className: "w-28",
    align: "left",
  },
  {
    key: "boxQuantity",
    header: "QTD. POR CAIXA",
    accessor: (item: Item) => (
      <div className="text-muted-foreground truncate">
        {item.boxQuantity !== null && item.boxQuantity !== undefined
          ? item.boxQuantity % 1 === 0
            ? item.boxQuantity.toLocaleString("pt-BR")
            : item.boxQuantity.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : "-"}
      </div>
    ),
    sortable: true,
    className: "w-28",
    align: "left",
  },
  {
    key: "tax",
    header: "TAXA",
    accessor: (item: Item) => (
      <div className="text-muted-foreground truncate">
        {item.tax !== null && item.tax !== undefined
          ? `${item.tax % 1 === 0 ? item.tax.toLocaleString("pt-BR") : item.tax.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
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
    key: "ppeSize",
    header: "TAMANHO EPI",
    accessor: (item: Item) => {
      const ppeSize = item.ppeSize;
      if (!ppeSize) {
        return <div className="text-muted-foreground">-</div>;
      }
      return (
        <Badge variant="outline" className="text-xs">
          {PPE_SIZE_LABELS[ppeSize] || ppeSize.replace("SIZE_", "")}
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
      <div className="text-center">
        <Badge variant="outline" className="font-mono">
          {(item as any)._count?.activities || 0}
        </Badge>
      </div>
    ),
    sortable: false,
    className: "w-24",
    align: "center",
  },
  {
    key: "borrowsCount",
    header: "EMPRÉSTIMOS",
    accessor: (item: Item) => (
      <div className="text-center">
        <Badge variant="outline" className="font-mono">
          {(item as any)._count?.borrows || 0}
        </Badge>
      </div>
    ),
    sortable: false,
    className: "w-28",
    align: "center",
  },
  {
    key: "pricesCount",
    header: "HISTÓRICO PREÇOS",
    accessor: (item: Item) => (
      <div className="text-center">
        <Badge variant="outline" className="font-mono">
          {(item as any)._count?.prices || 0}
        </Badge>
      </div>
    ),
    sortable: false,
    className: "w-32",
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
  {
    key: "updatedAt",
    header: "ATUALIZADO EM",
    accessor: (item: Item) => <div className="text-sm text-muted-foreground">{new Date(item.updatedAt).toLocaleDateString("pt-BR")}</div>,
    sortable: true,
    className: "w-32",
    align: "left",
  },
];
