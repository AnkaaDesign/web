import React, { useMemo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CanvasNormalMapRenderer } from "./canvas-normal-map-renderer";
import { PAINT_FINISH, PAINT_FINISH_LABELS, TRUCK_MANUFACTURER_LABELS } from "../../../constants";
import type { Paint } from "../../../types";

interface PaintTablePreviewProps {
  paint: Paint | null | undefined;
  size?: "small" | "medium";
  showTooltip?: boolean;
}

export const PaintTablePreview: React.FC<PaintTablePreviewProps> = ({ paint, size = "small", showTooltip = true }) => {
  // If no paint, show dash
  if (!paint) {
    return <span className="text-muted-foreground">-</span>;
  }

  const previewSizes = {
    small: { width: 100, height: 24 },
    medium: { width: 120, height: 32 },
  };

  const tooltipContent = useMemo(() => {
    if (!paint) return null;

    const paintFinish = paint.finish as PAINT_FINISH;

    return (
      <div className="space-y-1">
        <div className="font-semibold">{paint.name}</div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          {paint.paintType?.name && <div>{paint.paintType.name}</div>}
          {paintFinish && <div>{PAINT_FINISH_LABELS[paintFinish]}</div>}
          {paint.manufacturer && <div>{TRUCK_MANUFACTURER_LABELS[paint.manufacturer]}</div>}
          {paint.paintBrand?.name && !paint.manufacturer && <div>{paint.paintBrand?.name}</div>}
        </div>
      </div>
    );
  }, [paint]);

  const isMetallicOrPearl = paint.finish === PAINT_FINISH.METALLIC || paint.finish === PAINT_FINISH.PEARL;

  const preview = (
    <div className="w-full">
      {isMetallicOrPearl ? (
        <div
          className="w-full h-6 rounded-md overflow-hidden ring-1 ring-border/50 shadow-sm"
          style={{
            position: "relative",
          }}
        >
          <CanvasNormalMapRenderer
            baseColor={paint.hex || "#888888"}
            finish={paint.finish as PAINT_FINISH}
            width={previewSizes[size].width}
            height={previewSizes[size].height}
            quality="low"
            className="w-full h-full object-cover block rounded-md"
          />
        </div>
      ) : (
        <div className="w-full h-6 rounded-md ring-1 ring-border/50 shadow-sm" style={{ backgroundColor: paint.hex || "#888888" }} />
      )}
    </div>
  );

  if (!showTooltip) {
    return preview;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{preview}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
};

export default PaintTablePreview;
