import { cn } from "@/lib/utils";
import type { ResizeHandleProps } from "@/hooks/common/use-resizable-columns";

export interface ColumnResizeHandleProps extends ResizeHandleProps {
  /** True while this column is being dragged — highlights the handle. */
  active?: boolean;
  className?: string;
}

/**
 * Draggable divider for the right edge of a resizable header cell. Styled to match the
 * DataTable's resize handle so hand-rolled detail/form tables feel identical to the main
 * lists. Spread the props from `useResizableColumns().getResizeHandleProps(id)` onto it.
 *
 * The parent header cell must be `position: relative` (the handle is absolutely placed).
 */
export function ColumnResizeHandle({ onMouseDown, onTouchStart, active, className }: ColumnResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-primary/40",
        active && "bg-primary",
        className,
      )}
    />
  );
}
