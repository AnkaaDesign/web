import { formatDateTime, formatCurrency } from "../../../../utils";
import { MEASURE_TYPE_LABELS, MEASURE_UNIT_LABELS, MEASURE_TYPE } from "../../../../constants";
import type { Item } from "../../../../types";
import type { PpeColumn } from "./types";

// Import the stock status indicator
import { StockStatusIndicator } from "../../item/list/stock-status-indicator";

// Helper function to render PPE measures
const renderPpeMeasures = (item: Item) => {
  const measures = item.measures || [];

  if (measures.length === 0) {
    return <div className="text-muted-foreground text-sm">-</div>;
  }

  // PPE items typically have SIZE type measures
  // Numeric sizes (38, 42) are stored in the value field
  // Letter sizes (P, M, G) are stored in the unit field
  const measureDisplay = measures.map(measure => {
    // For SIZE type measures, show "Tamanho: X"
    if (measure.measureType === MEASURE_TYPE.SIZE) {
      let sizeValue = null;

      // Check if it's a numeric size in the value field
      if (measure.value !== null && measure.value !== undefined) {
        sizeValue = measure.value;
      }
      // Check if it's a letter size in the unit field
      else if (measure.unit) {
        // Get the label for the unit if it exists
        const unitLabel = MEASURE_UNIT_LABELS[measure.unit as keyof typeof MEASURE_UNIT_LABELS];
        if (unitLabel) {
          sizeValue = unitLabel;
        } else {
          sizeValue = measure.unit;
        }
      }

      if (sizeValue !== null) {
        return `${MEASURE_TYPE_LABELS[MEASURE_TYPE.SIZE]}: ${sizeValue}`;
      }
    }
    // For other measure types (if any)
    else {
      const typeLabel = measure.measureType ? MEASURE_TYPE_LABELS[measure.measureType] : '';

      if (measure.value !== null && measure.value !== undefined) {
        // If there's a unit, show it
        const unitLabel = measure.unit ? MEASURE_UNIT_LABELS[measure.unit as keyof typeof MEASURE_UNIT_LABELS] : null;
        if (unitLabel) {
          return typeLabel ? `${typeLabel}: ${measure.value} ${unitLabel}` : `${measure.value} ${unitLabel}`;
        }
        // Otherwise just show the value
        return typeLabel ? `${typeLabel}: ${measure.value}` : `${measure.value}`;
      }
    }

    return null;
  }).filter(Boolean).join(' | ');

  if (!measureDisplay) {
    return <div className="text-muted-foreground text-sm">-</div>;
  }

  return (
    <div className="text-sm truncate" title={measureDisplay}>
      {measureDisplay}
    </div>
  );
};

// Helper function to render current price
const renderCurrentPrice = (item: Item) => {
  const currentPrice = item.prices && item.prices.length > 0 ? item.prices[0] : null;

  if (!currentPrice || !currentPrice.value) {
    return <div className="truncate text-muted-foreground">-</div>;
  }

  return <div className="truncate text-sm font-medium tabular-nums">{formatCurrency(currentPrice.value)}</div>;
};

export const createPpeColumns = (): PpeColumn[] => [
  // Primary columns in the correct order
  {
    key: "uniCode",
    header: "CÓDIGO",
    accessor: (item) => <div className="text-sm truncate">{item.uniCode || "-"}</div>,
    sortable: true,
    className: "w-24",
    align: "left",
  },
  {
    key: "name",
    header: "NOME",
    accessor: (item) => <div className="font-medium truncate">{item.name}</div>,
    sortable: true,
    className: "w-64",
    align: "left",
  },
  {
    key: "brand.name",
    header: "MARCA",
    accessor: (item) => <div className="truncate">{item.brand?.name || "-"}</div>,
    sortable: true,
    className: "w-32",
    align: "left",
  },
  {
    key: "category.name",
    header: "CATEGORIA",
    accessor: (item) => <div className="truncate">{item.category?.name || "-"}</div>,
    sortable: true,
    className: "w-40",
    align: "left",
  },
  {
    key: "ppeCA",
    header: "CA",
    accessor: (item) => <div className="text-sm truncate">{item.ppeCA || "-"}</div>,
    sortable: true,
    className: "w-24",
    align: "center",
  },
  {
    key: "quantity",
    header: "QUANTIDADE",
    accessor: (item) => (
      <div className="flex">
        <StockStatusIndicator item={item} showQuantity={true} />
      </div>
    ),
    sortable: true,
    className: "w-28",
    align: "left",
  },
  {
    key: "measures",
    header: "MEDIDAS",
    accessor: (item) => renderPpeMeasures(item),
    sortable: false,
    className: "w-40",
    align: "left",
  },
  // Secondary columns
  {
    key: "description",
    header: "DESCRIÇÃO",
    accessor: (_item) => <div className="truncate text-sm text-muted-foreground">-</div>,
    sortable: false,
    className: "w-64",
    align: "left",
  },
  {
    key: "currentPrice",
    header: "PREÇO ATUAL",
    accessor: (item) => renderCurrentPrice(item),
    sortable: false, // Can't sort by relation field easily
    className: "w-32",
    align: "right",
  },
  {
    key: "minQuantity",
    header: "QTD MÍNIMA",
    accessor: (item) => <div className="truncate text-sm text-center tabular-nums">{item.reorderPoint || 0}</div>,
    sortable: true,
    className: "w-28",
    align: "center",
  },
  {
    key: "maxQuantity",
    header: "QTD MÁXIMA",
    accessor: (item) => <div className="truncate text-sm text-center tabular-nums">{item.maxQuantity || "-"}</div>,
    sortable: true,
    className: "w-28",
    align: "center",
  },
  {
    key: "reorderPoint",
    header: "PONTO DE REPOSIÇÃO",
    accessor: (item) => <div className="truncate text-sm text-center tabular-nums">{item.reorderPoint || 0}</div>,
    sortable: true,
    className: "w-36",
    align: "center",
  },
  {
    key: "location",
    header: "LOCALIZAÇÃO",
    accessor: (_item) => <div className="truncate text-sm">-</div>,
    sortable: true,
    className: "w-32",
    align: "left",
  },
  {
    key: "unit",
    header: "UNIDADE",
    accessor: (_item) => <div className="truncate text-sm text-center">-</div>,
    sortable: true,
    className: "w-24",
    align: "center",
  },
  {
    key: "createdAt",
    header: "CRIADO EM",
    accessor: (item) => <div className="truncate text-xs text-muted-foreground">{formatDateTime(new Date(item.createdAt))}</div>,
    sortable: true,
    className: "w-40",
    align: "left",
  },
  {
    key: "updatedAt",
    header: "ATUALIZADO EM",
    accessor: (item) => <div className="truncate text-xs text-muted-foreground">{formatDateTime(new Date(item.updatedAt))}</div>,
    sortable: true,
    className: "w-40",
    align: "left",
  },
];

// Default visible columns
export const getDefaultVisibleColumns = (): Set<string> => {
  return new Set(["uniCode", "name", "brand.name", "category.name", "ppeCA", "quantity", "measures"]);
};
