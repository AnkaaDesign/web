import type { WarehouseLocation } from "../../../../types";
import { Badge } from "../../../ui/badge";
import { TABLE_LAYOUT } from "../../../ui/table-constants";
import type { WarehouseLocationColumn } from "./types";

export const createWarehouseLocationColumns = (): WarehouseLocationColumn[] => [
  {
    key: "name",
    header: "NOME",
    accessor: (location: WarehouseLocation) => <span className="font-medium truncate">{location.name}</span>,
    sortable: true,
    className: TABLE_LAYOUT.firstDataColumn.className,
    align: "left",
  },
  {
    key: "section",
    header: "SETOR",
    accessor: (location: WarehouseLocation) => <div className="truncate">{location.section || "-"}</div>,
    sortable: true,
    className: "w-40",
    align: "left",
  },
  {
    key: "code",
    header: "CÓDIGO",
    accessor: (location: WarehouseLocation) => <div className="font-mono text-sm truncate">{location.code || "-"}</div>,
    sortable: true,
    className: "w-32",
    align: "left",
  },
  {
    key: "description",
    header: "DESCRIÇÃO",
    accessor: (location: WarehouseLocation) => <div className="text-sm truncate text-muted-foreground">{location.description || "-"}</div>,
    sortable: false,
    className: "w-64",
    align: "left",
  },
  {
    key: "isActive",
    header: "ATIVO",
    accessor: (location: WarehouseLocation) => (
      <Badge variant={location.isActive ? "default" : "secondary"} className="justify-center">
        {location.isActive ? "Ativo" : "Inativo"}
      </Badge>
    ),
    sortable: true,
    className: "w-24",
    align: "center",
  },
  {
    key: "_count.items",
    header: "PRODUTOS",
    accessor: (location: WarehouseLocation) => {
      const count = (location as any)._count?.items || 0;
      return (
        <Badge variant="default" className="w-10 justify-center">
          {count}
        </Badge>
      );
    },
    sortable: true,
    className: "w-24",
    align: "center",
  },
  {
    key: "createdAt",
    header: "CRIADO EM",
    accessor: (location: WarehouseLocation) => <div className="text-sm text-muted-foreground">{new Date(location.createdAt).toLocaleDateString("pt-BR")}</div>,
    sortable: true,
    className: "w-32",
    align: "left",
  },
  {
    key: "updatedAt",
    header: "ATUALIZADO EM",
    accessor: (location: WarehouseLocation) => <div className="text-sm text-muted-foreground">{new Date(location.updatedAt).toLocaleDateString("pt-BR")}</div>,
    sortable: true,
    className: "w-32",
    align: "left",
  },
];
