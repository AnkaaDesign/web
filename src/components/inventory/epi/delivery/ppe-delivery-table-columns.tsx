import { formatDateTime, formatDate } from "../../../../utils";
import { PPE_DELIVERY_STATUS_LABELS, getBadgeVariant, MEASURE_TYPE, MEASURE_UNIT_LABELS } from "../../../../constants";
import type { PpeDelivery, Item } from "../../../../types";
import { Badge } from "../../../ui/badge";
import { TABLE_LAYOUT } from "../../../ui/table-constants";
import type { PpeDeliveryColumn } from "./types";

// Helper function to get PPE size from item measures
const getItemSize = (item: Item | undefined): string => {
  if (!item?.measures || item.measures.length === 0) {
    return "-";
  }

  const sizeMeasure = item.measures.find((m) => m.measureType === MEASURE_TYPE.SIZE);
  if (!sizeMeasure) {
    return "-";
  }

  // Check if it's a numeric size in the value field (e.g., 38, 42 for boots)
  if (sizeMeasure.value !== null && sizeMeasure.value !== undefined) {
    return String(sizeMeasure.value);
  }

  // Check if it's a letter size in the unit field (e.g., P, M, G for shirts)
  if (sizeMeasure.unit) {
    const unitLabel = MEASURE_UNIT_LABELS[sizeMeasure.unit as keyof typeof MEASURE_UNIT_LABELS];
    return unitLabel || sizeMeasure.unit;
  }

  return "-";
};

export const createPpeDeliveryColumns = (): PpeDeliveryColumn[] => [
  // Primary columns in the correct order
  {
    key: "item.uniCode",
    header: "CÓDIGO",
    accessor: (delivery: PpeDelivery) => <div className="font-mono truncate">{delivery.item?.uniCode || "-"}</div>,
    sortable: true,
    className: TABLE_LAYOUT.firstDataColumn.className + " w-24",
    align: "left",
  },
  {
    key: "item.name",
    header: "ITEM",
    accessor: (delivery: PpeDelivery) => <div className="font-medium truncate">{delivery.item?.name || "-"}</div>,
    sortable: true,
    className: "w-52",
    align: "left",
  },
  {
    key: "item.measures",
    header: "TAMANHO",
    accessor: (delivery: PpeDelivery) => <div className="truncate">{getItemSize(delivery.item)}</div>,
    sortable: false,
    className: "w-24",
    align: "left",
  },
  {
    key: "item.brand.name",
    header: "MARCA",
    accessor: (delivery: PpeDelivery) => <div className="truncate">{delivery.item?.brand?.name || "-"}</div>,
    sortable: true,
    className: "w-32",
    align: "left",
  },
  {
    key: "user.name",
    header: "USUÁRIO",
    accessor: (delivery: PpeDelivery) => <div className="truncate">{delivery.user?.name || "-"}</div>,
    sortable: true,
    className: "w-48",
    align: "left",
  },
  {
    key: "status",
    header: "STATUS",
    accessor: (delivery: PpeDelivery) => {
      const label = PPE_DELIVERY_STATUS_LABELS[delivery.status] || delivery.status;
      const variant = getBadgeVariant(delivery.status, "PPE_DELIVERY");

      return (
        <div className="flex">
          <Badge variant={variant} className="whitespace-nowrap">
            {label}
          </Badge>
        </div>
      );
    },
    sortable: true,
    className: "w-32",
    align: "left",
  },
  {
    key: "quantity",
    header: "QUANTIDADE",
    accessor: (delivery: PpeDelivery) => <div className="truncate text-center tabular-nums font-medium">{delivery.quantity || 0}</div>,
    sortable: true,
    className: "w-28",
    align: "center",
  },
  {
    key: "createdAt",
    header: "DATA DE REQUISIÇÃO",
    accessor: (delivery: PpeDelivery) => {
      if (!delivery.createdAt) return <div className="truncate text-muted-foreground">-</div>;

      const formatted = formatDateTime(new Date(delivery.createdAt)).replace(",", " -");
      return <div className="truncate">{formatted}</div>;
    },
    sortable: true,
    className: "w-44",
    align: "left",
  },
  // Secondary columns
  {
    key: "scheduledDate",
    header: "DATA PROGRAMADA",
    accessor: (delivery: PpeDelivery) => {
      if (!delivery.scheduledDate) return <div className="truncate text-muted-foreground">-</div>;

      return <div className="truncate">{formatDate(new Date(delivery.scheduledDate))}</div>;
    },
    sortable: true,
    className: "w-40",
    align: "left",
  },
  {
    key: "actualDeliveryDate",
    header: "DATA ENTREGA",
    accessor: (delivery: PpeDelivery) => {
      if (!delivery.actualDeliveryDate) return <div className="truncate text-muted-foreground">-</div>;

      const formatted = formatDateTime(new Date(delivery.actualDeliveryDate)).replace(",", " -");
      return <div className="truncate">{formatted}</div>;
    },
    sortable: true,
    className: "w-44",
    align: "left",
  },
  {
    key: "reviewedByUser.name",
    header: "APROVADO POR",
    accessor: (delivery: PpeDelivery) => <div className="truncate text-sm">{delivery.reviewedByUser?.name || "-"}</div>,
    sortable: true,
    className: "w-40",
    align: "left",
  },
  {
    key: "updatedAt",
    header: "ATUALIZADO EM",
    accessor: (delivery: PpeDelivery) => <div className="truncate text-xs text-muted-foreground">{formatDateTime(new Date(delivery.updatedAt))}</div>,
    sortable: true,
    className: "w-40",
    align: "left",
  },
];

export function getDefaultVisibleColumns(): Set<string> {
  return new Set(["item.uniCode", "item.name", "item.measures", "user.name", "status", "quantity", "createdAt"]);
}
