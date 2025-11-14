import { formatCurrency } from "../../../../utils";
import type { Item } from "../../../../types";
import { MeasureDisplayCompact } from "../../item/common/measure-display";
import { TABLE_LAYOUT } from "../../../ui/table-constants";

export interface ItemNeededColumn {
  key: string;
  header: string;
  accessor: (item: Item & { neededQuantity?: number; subtotal?: number }) => React.ReactNode;
  sortable: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

export const createItemsNeededColumns = (): ItemNeededColumn[] => [
  {
    key: "uniCode",
    header: "CÓDIGO",
    accessor: (item) => <div className="text-sm truncate">{item.uniCode || "-"}</div>,
    sortable: true,
    className: TABLE_LAYOUT.firstDataColumn.className,
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
    key: "measures",
    header: "MEDIDAS",
    accessor: (item) => <MeasureDisplayCompact item={item} />,
    sortable: false,
    className: "w-48",
    align: "left",
  },
  {
    key: "neededQuantity",
    header: "QTD. NECESSÁRIA",
    accessor: (item) => (
      <div className="font-semibold truncate tabular-nums">
        {item.neededQuantity ? `${item.neededQuantity.toLocaleString("pt-BR")} ${item.measureUnit || "un"}` : "-"}
      </div>
    ),
    sortable: true,
    className: "w-32",
    align: "left",
  },
  {
    key: "quantity",
    header: "ESTOQUE ATUAL",
    accessor: (item) => (
      <div className="truncate tabular-nums">
        {item.quantity !== undefined && item.quantity !== null ? `${item.quantity.toLocaleString("pt-BR")} ${item.measureUnit || "un"}` : "-"}
      </div>
    ),
    sortable: true,
    className: "w-32",
    align: "left",
  },
  {
    key: "price",
    header: "PREÇO UNIT.",
    accessor: (item) => <div className="font-medium truncate">{item.prices?.[0]?.value ? formatCurrency(item.prices[0].value) : "-"}</div>,
    sortable: true,
    className: "w-28",
    align: "left",
  },
  {
    key: "subtotal",
    header: "SUBTOTAL",
    accessor: (item) => <div className="font-semibold truncate">{item.subtotal ? formatCurrency(item.subtotal) : "-"}</div>,
    sortable: true,
    className: "w-28",
    align: "left",
  },
];
