import React from "react";
import type { PaintBrand } from "../../../../types";
import { IconBrush, IconComponents } from "@tabler/icons-react";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "../../../../utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";

export interface PaintBrandColumn {
  key: string;
  header: string | React.ReactNode;
  accessor: (paintBrand: PaintBrand) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

export function createPaintBrandColumns(): PaintBrandColumn[] {
  return [
    {
      key: "name",
      header: "NOME",
      accessor: (paintBrand) => <TruncatedTextWithTooltip text={paintBrand.name} />,
      sortable: true,
      className: TABLE_LAYOUT.firstDataColumn.className,
    },
    {
      key: "_count.paints",
      header: "TINTAS",
      accessor: (paintBrand) => {
        const count = paintBrand._count?.paints || 0;
        return (
          <div className="flex items-center gap-2">
            <IconBrush className="h-4 w-4 text-muted-foreground" />
            <Badge variant="default" className="w-10 justify-center">
              {count}
            </Badge>
          </div>
        );
      },
      sortable: false,
      align: "left",
      className: "w-28",
    },
    {
      key: "_count.componentItems",
      header: "COMPONENTES",
      accessor: (paintBrand) => {
        const count = paintBrand._count?.componentItems || 0;
        return (
          <div className="flex items-center gap-2">
            <IconComponents className="h-4 w-4 text-muted-foreground" />
            <Badge variant="default" className="w-10 justify-center">
              {count}
            </Badge>
          </div>
        );
      },
      sortable: false,
      align: "left",
      className: "w-32",
    },
    {
      key: "createdAt",
      header: "DATA DE CRIAÇÃO",
      accessor: (paintBrand) => formatDate(paintBrand.createdAt),
      sortable: true,
      className: "w-32",
    },
  ];
}

// Default visible columns
export const getDefaultVisibleColumns = (): Set<string> => {
  return new Set(["name", "_count.paints", "_count.componentItems", "createdAt"]);
};
