import { useEffect, useRef, useState, useCallback, useMemo } from "react";

export interface MenuPosition {
  x: number;
  y: number;
}

export interface CalculatedPosition {
  left: number;
  top: number;
}

export interface SmartMenuPositionOptions {
  /** Minimum padding from viewport edges (default: 8px) */
  minPadding?: number;
  /** Estimated menu width for initial calculation (default: auto-detect) */
  estimatedWidth?: number;
  /** Estimated menu height for initial calculation (default: auto-detect) */
  estimatedHeight?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Enhanced hook for intelligent menu positioning with viewport boundary checking
 *
 * This hook provides bulletproof positioning that:
 * - Never crashes with null values
 * - Intelligently avoids all screen edges
 * - Provides instant safe positioning before menu renders
 * - Refines position after actual dimensions are measured
 * - Works with any menu type (context menus, dropdowns, popovers)
 *
 * @param position - The initial position {x, y} or null
 * @param isOpen - Whether the menu is currently open
 * @param options - Configuration options
 * @returns Object containing menuRef, safe position, and position state
 *
 * @example
 * ```tsx
 * const [contextMenu, setContextMenu] = useState<{x: number, y: number} | null>(null);
 * const { menuRef, position } = useSmartMenuPosition(contextMenu, !!contextMenu);
 *
 * return (
 *   <DropdownMenuContent
 *     ref={menuRef}
 *     style={{
 *       position: "fixed",
 *       left: position.left,
 *       top: position.top,
 *     }}
 *   />
 * );
 * ```
 */
export function useSmartMenuPosition(
  initialPosition: MenuPosition | null,
  isOpen: boolean,
  options: SmartMenuPositionOptions = {}
) {
  const {
    minPadding = 8,
    estimatedWidth = 224, // w-56 = 14rem = 224px (common menu width)
    estimatedHeight = 200,
    debug = false,
  } = options;

  const elementRef = useRef<HTMLDivElement | null>(null);
  const [refinedPosition, setRefinedPosition] = useState<CalculatedPosition | null>(null);
  const [isCalculated, setIsCalculated] = useState(false);
  const recalculateTimeoutRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Get viewport dimensions safely
  const getViewport = useCallback(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
  }), []);

  // Calculate safe position with intelligent edge avoidance
  const calculateSafePosition = useCallback(
    (pos: MenuPosition, menuWidth?: number, menuHeight?: number): CalculatedPosition => {
      const viewport = getViewport();
      const width = menuWidth ?? estimatedWidth;
      const height = menuHeight ?? estimatedHeight;

      let left = pos.x;
      let top = pos.y;

      if (debug) {
        console.log('[SmartMenuPosition] Calculating position:', {
          cursor: pos,
          viewport,
          menuSize: { width, height },
          isEstimated: !menuWidth,
        });
      }

      // Right edge check - try to show menu to the right first
      if (left + width > viewport.width - minPadding) {
        // Not enough space on right, try left side
        const leftSidePosition = left - width;
        if (leftSidePosition >= minPadding) {
          left = leftSidePosition;
        } else {
          // Not enough space on either side, constrain to viewport
          left = Math.max(minPadding, Math.min(left, viewport.width - width - minPadding));
        }
      }

      // Bottom edge check - try to show menu below first
      if (top + height > viewport.height - minPadding) {
        // Not enough space below, try above
        const abovePosition = top - height;
        if (abovePosition >= minPadding) {
          top = abovePosition;
        } else {
          // Not enough space on either side, constrain to viewport
          top = Math.max(minPadding, Math.min(top, viewport.height - height - minPadding));
        }
      }

      // Final safety checks
      left = Math.max(minPadding, Math.min(left, viewport.width - width - minPadding));
      top = Math.max(minPadding, Math.min(top, viewport.height - height - minPadding));

      // Ultimate fallback - ensure we're never negative or beyond viewport
      left = Math.max(0, Math.min(left, viewport.width - minPadding));
      top = Math.max(0, Math.min(top, viewport.height - minPadding));

      if (debug) {
        console.log('[SmartMenuPosition] Calculated position:', { left, top });
      }

      return { left, top };
    },
    [estimatedWidth, estimatedHeight, minPadding, getViewport, debug]
  );

  // Calculate safe position synchronously - this runs immediately during render
  const safePosition = useMemo(() => {
    if (!initialPosition || !isOpen) {
      return { left: 0, top: 0 };
    }
    // Use refined position if available, otherwise calculate from initial position
    if (refinedPosition && isCalculated) {
      return refinedPosition;
    }
    return calculateSafePosition(initialPosition);
  }, [initialPosition, isOpen, refinedPosition, isCalculated, calculateSafePosition]);

  // Recalculate position with actual menu dimensions
  const refinePosition = useCallback(
    (element: HTMLDivElement) => {
      if (!initialPosition) return;

      const rect = element.getBoundingClientRect();

      // If dimensions are still 0, menu hasn't fully rendered
      if (rect.width === 0 || rect.height === 0) {
        if (recalculateTimeoutRef.current) {
          clearTimeout(recalculateTimeoutRef.current);
        }
        recalculateTimeoutRef.current = window.setTimeout(() => {
          if (elementRef.current) {
            refinePosition(elementRef.current);
          }
        }, 10);
        return;
      }

      // Calculate with actual dimensions
      const refined = calculateSafePosition(initialPosition, rect.width, rect.height);
      setRefinedPosition(refined);
      setIsCalculated(true);

      if (debug) {
        console.log('[SmartMenuPosition] Refined with actual dimensions:', {
          measured: { width: rect.width, height: rect.height },
          position: refined,
        });
      }
    },
    [initialPosition, calculateSafePosition, debug]
  );

  // Callback ref that triggers calculation when element is attached
  const menuRef = useCallback(
    (element: HTMLDivElement | null) => {
      elementRef.current = element;

      // Cleanup previous observer
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }

      if (element && isOpen && initialPosition) {
        // Use requestAnimationFrame to ensure proper render timing
        requestAnimationFrame(() => {
          if (elementRef.current) {
            refinePosition(elementRef.current);
          }
        });

        // Set up ResizeObserver to handle dynamic content changes
        if (typeof ResizeObserver !== 'undefined') {
          resizeObserverRef.current = new ResizeObserver((entries) => {
            for (const entry of entries) {
              if (entry.target === element && initialPosition) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                  const refined = calculateSafePosition(initialPosition, width, height);
                  setRefinedPosition(refined);
                }
              }
            }
          });
          resizeObserverRef.current.observe(element);
        }
      }
    },
    [isOpen, initialPosition, refinePosition, calculateSafePosition]
  );

  // Reset when menu closes
  useEffect(() => {
    if (!isOpen) {
      setRefinedPosition(null);
      setIsCalculated(false);
      if (recalculateTimeoutRef.current) {
        clearTimeout(recalculateTimeoutRef.current);
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    }
  }, [isOpen]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (recalculateTimeoutRef.current) {
        clearTimeout(recalculateTimeoutRef.current);
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, []);

  return {
    menuRef,
    position: safePosition,
    isCalculated,
  };
}

/**
 * Get safe inline styles for menu positioning
 * Helper function to safely extract position values with guaranteed fallbacks
 */
export function getMenuPositionStyles(
  calculatedPosition: CalculatedPosition | null | undefined,
  fallbackPosition?: MenuPosition | null
): React.CSSProperties {
  const left = calculatedPosition?.left ?? fallbackPosition?.x ?? 0;
  const top = calculatedPosition?.top ?? fallbackPosition?.y ?? 0;

  return {
    position: "fixed",
    left: `${left}px`,
    top: `${top}px`,
    transform: "none",
  };
}
