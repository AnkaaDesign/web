import React from "react";
import type { PaintProduction, PaintFormula } from "../../../../types";
import { IconDroplet, IconCalendar } from "@tabler/icons-react";
import { formatDate } from "../../../../utils";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { CanvasNormalMapRenderer } from "../../effects/canvas-normal-map-renderer";
import { PAINT_FINISH } from "../../../../constants";

export interface PaintProductionColumn {
  key: string;
  header: string;
  accessor: (production: PaintProduction) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

// Helper function to get paint info from formula
const getPaintInfo = (formula?: PaintFormula) => {
  if (!formula?.paint) return { name: "N/A", hex: "#000000", type: "N/A", finish: null };
  return {
    name: formula.paint.name,
    hex: formula.paint.hex,
    type: formula.paint.paintType?.name || "N/A",
    finish: formula.paint.finish,
  };
};

export const getDefaultVisibleColumns = (): Set<string> => {
  return new Set(["formula.paint.name", "formula.description", "volumeLiters", "createdAt"]);
};

export function createPaintProductionColumns(): PaintProductionColumn[] {
  return [
    {
      key: "formula.paint.name",
      header: "TINTA",
      accessor: (production) => {
        const paintInfo = getPaintInfo(production.formula);
        return (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md ring-1 ring-border/50 shadow-sm flex-shrink-0 overflow-hidden">
              {paintInfo.finish ? (
                <CanvasNormalMapRenderer baseColor={paintInfo.hex} finish={paintInfo.finish as PAINT_FINISH} width={32} height={32} quality="low" className="w-full h-full" />
              ) : (
                <div className="w-full h-full" style={{ backgroundColor: paintInfo.hex }} />
              )}
            </div>
            <div>
              <div className="font-medium">
                <TruncatedTextWithTooltip text={paintInfo.name} />
              </div>
              <div className="text-sm text-muted-foreground">{paintInfo.type}</div>
            </div>
          </div>
        );
      },
      sortable: true,
      className: "w-64",
      align: "left",
    },
    {
      key: "formula.description",
      header: "FÓRMULA",
      accessor: (production) => <TruncatedTextWithTooltip text={production.formula?.description || "N/A"} />,
      sortable: false,
      className: "w-48",
      align: "left",
    },
    {
      key: "volumeLiters",
      header: "VOLUME",
      accessor: (production) => (
        <div className="flex items-center gap-1">
          <IconDroplet className="h-4 w-4 text-muted-foreground" />
          <span>{production.volumeLiters.toFixed(2)} L</span>
        </div>
      ),
      sortable: true,
      className: "w-32",
      align: "left",
    },
    {
      key: "createdAt",
      header: "DATA",
      accessor: (production) => (
        <div className="flex items-center gap-1">
          <IconCalendar className="h-4 w-4 text-muted-foreground" />
          <span>{formatDate(production.createdAt)}</span>
        </div>
      ),
      sortable: true,
      className: "w-40",
      align: "left",
    },
  ];
}
