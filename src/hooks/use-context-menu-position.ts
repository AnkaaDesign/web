import { useEffect, useRef, useState, useCallback } from "react";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export interface CalculatedPosition {
  left: number;
  top: number;
}

/**
 * Hook for calculating context menu position with viewport boundary checking
 *
 * Ensures context menus never display outside the viewport by automatically
 * adjusting position when the menu would overflow viewport edges.
 *
 * @param position - The initial click position {x, y}
 * @param isOpen - Whether the context menu is currently open
 * @param minPadding - Minimum padding from viewport edges (default: 8px)
 * @returns Object containing menuRef and calculated position
 *
 * @example
 * ```tsx
 * const [contextMenu, setContextMenu] = useState<{x: number, y: number} | null>(null);
 * const { menuRef, calculatedPosition } = useContextMenuPosition(
 *   contextMenu,
 *   !!contextMenu
 * );
 *
 * return (
 *   <DropdownMenuContent
 *     ref={menuRef}
 *     style={{
 *       position: "fixed",
 *       left: calculatedPosition?.left ?? contextMenu?.x,
 *       top: calculatedPosition?.top ?? contextMenu?.y,
 *     }}
 *   />
 * );
 * ```
 */
export function useContextMenuPosition(
  position: ContextMenuPosition | null,
  isOpen: boolean,
  minPadding: number = 8
) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [calculatedPosition, setCalculatedPosition] = useState<CalculatedPosition | null>(null);
  const recalculateTimeoutRef = useRef<number | null>(null);

  // Calculate initial safe position immediately (before menu renders)
  const getInitialSafePosition = useCallback((pos: ContextMenuPosition): CalculatedPosition => {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    // Estimate menu dimensions (will be refined after render)
    const estimatedWidth = 224; // w-56 = 14rem = 224px
    const estimatedHeight = 200; // Conservative estimate

    let left = pos.x;
    let top = pos.y;

    // Check if menu would overflow right
    if (left + estimatedWidth > viewport.width - minPadding) {
      left = Math.max(minPadding, viewport.width - estimatedWidth - minPadding);
    }

    // Check if menu would overflow bottom
    if (top + estimatedHeight > viewport.height - minPadding) {
      top = Math.max(minPadding, viewport.height - estimatedHeight - minPadding);
    }

    // Ensure minimum padding
    left = Math.max(minPadding, left);
    top = Math.max(minPadding, top);

    return { left, top };
  }, [minPadding]);

  // Set initial position when menu opens
  useEffect(() => {
    if (isOpen && position && !calculatedPosition) {
      setCalculatedPosition(getInitialSafePosition(position));
    }
  }, [isOpen, position, calculatedPosition, getInitialSafePosition]);

  const calculatePosition = useCallback((element: HTMLDivElement) => {
    if (!position) return;

    const rect = element.getBoundingClientRect();

    // If dimensions are 0, menu hasn't fully rendered yet
    if (rect.width === 0 || rect.height === 0) {
      // Try again after a short delay
      if (recalculateTimeoutRef.current) {
        clearTimeout(recalculateTimeoutRef.current);
      }
      recalculateTimeoutRef.current = window.setTimeout(() => {
        if (elementRef.current) {
          calculatePosition(elementRef.current);
        }
      }, 10);
      return;
    }

    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    let left = position.x;
    let top = position.y;

    // Adjust if menu would go off the right edge
    if (position.x + rect.width > viewport.width - minPadding) {
      // Try to show menu to the left of cursor
      left = position.x - rect.width;
    }

    // Adjust if menu would go off the bottom edge
    if (position.y + rect.height > viewport.height - minPadding) {
      // Try to show menu above the cursor
      top = position.y - rect.height;
    }

    // Ensure we don't go off the left edge
    if (left < minPadding) {
      left = minPadding;
    }

    // Ensure we don't go off the top edge
    if (top < minPadding) {
      top = minPadding;
    }

    // Final check: ensure we don't exceed right edge after left adjustment
    if (left + rect.width > viewport.width - minPadding) {
      left = Math.max(minPadding, viewport.width - rect.width - minPadding);
    }

    // Final check: ensure we don't exceed bottom edge after top adjustment
    if (top + rect.height > viewport.height - minPadding) {
      top = Math.max(minPadding, viewport.height - rect.height - minPadding);
    }

    setCalculatedPosition({ left, top });
  }, [position, minPadding]);

  // Callback ref that triggers calculation when element is attached
  const menuRef = useCallback((element: HTMLDivElement | null) => {
    elementRef.current = element;

    if (element && isOpen && position) {
      // Use requestAnimationFrame to ensure the element is fully rendered
      requestAnimationFrame(() => {
        if (elementRef.current) {
          calculatePosition(elementRef.current);
        }
      });
    }
  }, [isOpen, position, calculatePosition]);

  // Reset when menu closes
  useEffect(() => {
    if (!isOpen) {
      setCalculatedPosition(null);
      if (recalculateTimeoutRef.current) {
        clearTimeout(recalculateTimeoutRef.current);
      }
    }
  }, [isOpen]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (recalculateTimeoutRef.current) {
        clearTimeout(recalculateTimeoutRef.current);
      }
    };
  }, []);

  return { menuRef, calculatedPosition };
}
