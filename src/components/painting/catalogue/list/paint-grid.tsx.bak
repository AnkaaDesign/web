import { useState, useEffect, useRef } from "react";
import type { Paint } from "../../../../types";
import { formatHexColor } from "./color-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PAINT_FINISH_LABELS, PAINT_FINISH, TRUCK_MANUFACTURER_LABELS } from "../../../../constants";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PaintGridProps {
  paints: Paint[];
  isLoading: boolean;
  onPaintClick: (paint: Paint) => void;
  onOrderChange?: (paints: Paint[]) => void;
}

const SQUARE_SIZE = 64; // Fixed size in pixels
const GAP = 8; // Gap between squares

export function PaintGrid({ paints, isLoading, onPaintClick, onOrderChange }: PaintGridProps) {
  // Local state for drag-and-drop reordering
  const [orderedPaints, setOrderedPaints] = useState<Paint[]>(paints);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const latestOrderRef = useRef<Paint[]>(paints);

  // Update ordered paints when paints prop changes
  useEffect(() => {
    setOrderedPaints(paints);
    latestOrderRef.current = paints;
  }, [paints]);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === targetIndex) return;

    // Reorder the paints array
    const newPaints = [...orderedPaints];
    const draggedPaint = newPaints[draggedIndex];
    newPaints.splice(draggedIndex, 1);
    newPaints.splice(targetIndex, 0, draggedPaint);

    setOrderedPaints(newPaints);
    latestOrderRef.current = newPaints;
    setDraggedIndex(targetIndex);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    // Notify parent of order change - compare IDs to detect actual order changes
    if (onOrderChange) {
      const orderChanged = latestOrderRef.current.some((paint, index) => paint.id !== paints[index]?.id);
      if (orderChanged) {
        onOrderChange(latestOrderRef.current);
      }
    }
  };
  if (isLoading) {
    return (
      <div className="h-full w-full overflow-auto p-4">
        <div
          className="grid justify-center"
          style={{
            gridTemplateColumns: `repeat(auto-fill, ${SQUARE_SIZE}px)`,
            gap: `${GAP}px`,
          }}
        >
          {Array.from({ length: 120 }).map((_, i) => (
            <Skeleton key={i} className="rounded-lg" style={{ width: SQUARE_SIZE, height: SQUARE_SIZE }} />
          ))}
        </div>
      </div>
    );
  }

  if (!paints || !paints.length) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Nenhuma tinta encontrada</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto p-4">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${SQUARE_SIZE}px, 1fr))`,
          gap: `${GAP}px`,
        }}
      >
        {orderedPaints.map((paint, index) => (
          <PaintSquare
            key={paint.id}
            paint={paint}
            index={index}
            onClick={() => onPaintClick(paint)}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            isDragging={draggedIndex === index}
          />
        ))}
      </div>
    </div>
  );
}

interface PaintSquareProps {
  paint: Paint;
  index: number;
  onClick: () => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

function PaintSquare({ paint, index, onClick, onDragStart, onDragOver, onDragEnd, isDragging }: PaintSquareProps) {
  const backgroundColor = formatHexColor(paint.hex);
  const paintFinish = paint.finish as PAINT_FINISH;

  const button = (
    <button
      onClick={onClick}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      className={cn(
        "rounded-lg transition-all duration-200",
        "hover:scale-110 hover:z-20 hover:shadow-lg",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        "group cursor-move overflow-hidden relative block",
        isDragging && "opacity-50 scale-95",
      )}
      style={{
        width: SQUARE_SIZE,
        height: SQUARE_SIZE,
        backgroundColor: paint.colorPreview ? "transparent" : backgroundColor || "#cccccc",
        border: "1px solid rgba(0,0,0,0.1)",
      }}
    >
      {/* Use colorPreview image if available */}
      {paint.colorPreview && (
        <img
          src={paint.colorPreview}
          alt={paint.name}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      )}
    </button>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <div className="font-semibold">{paint.name}</div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {paint.paintType?.name && <div>{paint.paintType.name}</div>}
              {paintFinish && <div>{PAINT_FINISH_LABELS[paintFinish]}</div>}
              {paint.manufacturer && <div>{TRUCK_MANUFACTURER_LABELS[paint.manufacturer]}</div>}
              {paint.paintBrand && <div>{paint.paintBrand.name}</div>}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
