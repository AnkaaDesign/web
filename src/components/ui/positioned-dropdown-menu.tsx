import * as React from "react";
import { DropdownMenuContent } from "./dropdown-menu";
import { useSmartMenuPosition, type MenuPosition } from "@/hooks/common/use-smart-menu-position";
import { cn } from "@/lib/utils";

export interface PositionedDropdownMenuContentProps
  extends Omit<React.ComponentPropsWithoutRef<typeof DropdownMenuContent>, "ref"> {
  /**
   * The position where the menu should appear (typically from a click event)
   * Pass { x: event.clientX, y: event.clientY } from context menu events
   */
  position: MenuPosition | null;
  /**
   * Whether the menu is open
   */
  isOpen: boolean;
  /**
   * Minimum padding from viewport edges (default: 8px)
   */
  minPadding?: number;
  /**
   * Estimated menu width for better initial positioning
   */
  estimatedWidth?: number;
  /**
   * Estimated menu height for better initial positioning
   */
  estimatedHeight?: number;
}

/**
 * Drop-in replacement for DropdownMenuContent with intelligent positioning
 *
 * This component automatically:
 * - Prevents menus from appearing outside the viewport
 * - Handles all edge cases (corners, edges, small viewports)
 * - Never crashes with null values
 * - Provides smooth positioning with no flickering
 *
 * @example
 * ```tsx
 * const [contextMenu, setContextMenu] = useState<{x: number, y: number} | null>(null);
 *
 * const handleContextMenu = (e: React.MouseEvent) => {
 *   e.preventDefault();
 *   setContextMenu({ x: e.clientX, y: e.clientY });
 * };
 *
 * return (
 *   <>
 *     <div onContextMenu={handleContextMenu}>Right-click me</div>
 *     <DropdownMenu open={!!contextMenu} onOpenChange={(open) => !open && setContextMenu(null)}>
 *       <PositionedDropdownMenuContent
 *         position={contextMenu}
 *         isOpen={!!contextMenu}
 *       >
 *         <DropdownMenuItem>Action 1</DropdownMenuItem>
 *         <DropdownMenuItem>Action 2</DropdownMenuItem>
 *       </PositionedDropdownMenuContent>
 *     </DropdownMenu>
 *   </>
 * );
 * ```
 */
export const PositionedDropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuContent>,
  PositionedDropdownMenuContentProps
>(
  (
    {
      position,
      isOpen,
      minPadding = 8,
      estimatedWidth,
      estimatedHeight,
      className,
      style,
      children,
      ...props
    },
    forwardedRef
  ) => {
    const { menuRef, position: safePosition } = useSmartMenuPosition(position, isOpen, {
      minPadding,
      estimatedWidth,
      estimatedHeight,
    });

    // Merge refs
    const mergedRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        menuRef(node);
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [menuRef, forwardedRef]
    );

    return (
      <DropdownMenuContent
        ref={mergedRef}
        className={cn(className)}
        style={{
          ...style,
          position: "fixed",
          left: `${safePosition.left}px`,
          top: `${safePosition.top}px`,
          transform: "none",
        }}
        {...props}
      >
        {children}
      </DropdownMenuContent>
    );
  }
);

PositionedDropdownMenuContent.displayName = "PositionedDropdownMenuContent";
