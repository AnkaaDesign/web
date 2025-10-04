import { formatDateTime } from "../../../../utils";
import { TRUCK_MANUFACTURER_LABELS } from "../../../../constants";
import type { Truck } from "../../../../types";
import { Badge } from "../../../ui/badge";
import { TABLE_LAYOUT } from "../../../ui/table-constants";

export interface TruckColumn {
  id: string;
  label: string;
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  sortable?: boolean;
  render: (truck: Truck) => React.ReactNode;
  align?: "left" | "center" | "right";
}

export const createTruckColumns = (): TruckColumn[] => [
  {
    id: "plate",
    label: "Placa",
    width: TABLE_LAYOUT.COLUMN_WIDTHS.COMPACT,
    sortable: true,
    render: (truck) => <div className="font-medium truncate">{truck.task?.plate || truck.plate || "—"}</div>,
  },
  {
    id: "task.serialNumber",
    label: "Número de Série",
    width: TABLE_LAYOUT.COLUMN_WIDTHS.MEDIUM,
    sortable: true,
    render: (truck) => <div className="truncate">{truck.task?.serialNumber || "—"}</div>,
  },
  {
    id: "model",
    label: "Modelo",
    width: TABLE_LAYOUT.COLUMN_WIDTHS.MEDIUM,
    sortable: true,
    render: (truck) => <div className="truncate">{truck.model || "—"}</div>,
  },
  {
    id: "manufacturer",
    label: "Fabricante",
    width: TABLE_LAYOUT.COLUMN_WIDTHS.MEDIUM,
    sortable: true,
    render: (truck) => <div className="truncate">{truck.manufacturer ? TRUCK_MANUFACTURER_LABELS[truck.manufacturer] || truck.manufacturer : "—"}</div>,
  },
  {
    id: "task.customer.fantasyName",
    label: "Cliente",
    width: TABLE_LAYOUT.COLUMN_WIDTHS.LARGE,
    sortable: true,
    render: (truck) => <div className="truncate">{truck.task?.customer?.fantasyName || truck.task?.customer?.corporateName || "—"}</div>,
  },
  {
    id: "garage.name",
    label: "Garagem",
    width: TABLE_LAYOUT.COLUMN_WIDTHS.MEDIUM,
    sortable: true,
    render: (truck) => <div className="truncate">{truck.garage?.name || "—"}</div>,
  },
  {
    id: "position",
    label: "Posição",
    width: TABLE_LAYOUT.COLUMN_WIDTHS.COMPACT,
    sortable: false,
    render: (truck) => <div className="truncate">{truck.xPosition !== null && truck.yPosition !== null ? `${truck.xPosition}, ${truck.yPosition}` : "—"}</div>,
  },
  {
    id: "parkingStatus",
    label: "Status",
    width: TABLE_LAYOUT.COLUMN_WIDTHS.COMPACT,
    sortable: false,
    render: (truck) => {
      const isParked = truck.garage && truck.xPosition !== null && truck.yPosition !== null;
      const hasGarage = !!truck.garage;

      return (
        <div className="flex justify-center">
          {isParked ? (
            <Badge variant="success" className="text-xs">
              Estacionado
            </Badge>
          ) : hasGarage ? (
            <Badge variant="warning" className="text-xs">
              Na Garagem
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              Não Alocado
            </Badge>
          )}
        </div>
      );
    },
    align: "center" as const,
  },
  {
    id: "createdAt",
    label: "Criado em",
    width: TABLE_LAYOUT.COLUMN_WIDTHS.DATETIME,
    sortable: true,
    render: (truck) => <div className="truncate text-muted-foreground tabular-nums">{formatDateTime(truck.createdAt)}</div>,
  },
];
