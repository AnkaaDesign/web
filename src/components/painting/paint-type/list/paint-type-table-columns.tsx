import React from "react";
import type { PaintType } from "../../../../types";
import { Badge } from "@/components/ui/badge";
import { IconBrush, IconComponents } from "@tabler/icons-react";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { formatDate } from "../../../../utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";

export interface PaintTypeColumn {
  key: string;
  header: string | React.ReactNode;
  accessor: (paintType: PaintType) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

// Stable accessor functions
const nameAccessor = (paintType: PaintType) => <TruncatedTextWithTooltip text={paintType.name} />;

const needGroundAccessor = (paintType: PaintType) => <Badge variant={paintType.needGround ? "default" : "secondary"}>{paintType.needGround ? "Sim" : "Não"}</Badge>;

const paintsCountAccessor = (paintType: PaintType) => {
  const count = paintType._count?.paints || 0;
  return (
    <div className="flex items-center gap-2">
      <IconBrush className="h-4 w-4 text-muted-foreground" />
      <Badge variant="default" className="w-10 justify-center">
        {count}
      </Badge>
    </div>
  );
};

const componentItemsCountAccessor = (paintType: PaintType) => {
  const count = paintType._count?.componentItems || 0;
  return (
    <div className="flex items-center gap-2">
      <IconComponents className="h-4 w-4 text-muted-foreground" />
      <Badge variant="default" className="w-10 justify-center">
        {count}
      </Badge>
    </div>
  );
};

const createdAtAccessor = (paintType: PaintType) => formatDate(paintType.createdAt);

// Memoized column definitions
const PAINT_TYPE_COLUMNS: PaintTypeColumn[] = [
  {
    key: "name",
    header: "NOME",
    accessor: nameAccessor,
    sortable: true,
    className: TABLE_LAYOUT.firstDataColumn.className,
  },
  {
    key: "needGround",
    header: "PRECISA DE FUNDO",
    accessor: needGroundAccessor,
    sortable: true,
    className: "w-40",
  },
  {
    key: "_count.paints",
    header: "TINTAS",
    accessor: paintsCountAccessor,
    sortable: false,
    align: "left" as const,
    className: "w-28",
  },
  {
    key: "_count.componentItems",
    header: "COMPONENTES",
    accessor: componentItemsCountAccessor,
    sortable: false,
    align: "left" as const,
    className: "w-32",
  },
  {
    key: "createdAt",
    header: "DATA DE CRIAÇÃO",
    accessor: createdAtAccessor,
    sortable: true,
    className: "w-32",
  },
];

export function createPaintTypeColumns(): PaintTypeColumn[] {
  return PAINT_TYPE_COLUMNS;
}

// Default visible columns
export const getDefaultVisibleColumns = (): Set<string> => {
  return new Set(["name", "needGround", "_count.paints", "_count.componentItems", "createdAt"]);
};
