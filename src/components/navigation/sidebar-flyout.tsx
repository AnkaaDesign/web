import { useState, useRef, useLayoutEffect, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

/**
 * Cascading hover flyout for the collapsed (minimized) sidebar.
 *
 * The sidebar is docked on the RIGHT side of the viewport, so the root column
 * opens to the LEFT of the sidebar and each nested column cascades further left.
 * When a column would overflow the left edge it flips to the right of its parent.
 *
 * Design goals (see why each existed in the previous implementation):
 *  - Render the FULL menu hierarchy (3rd/4th level), not just one level.
 *  - Hover intent: short open-delay + generous close-delay so quick passes don't
 *    flash popovers and the trigger->column gap never drops the hover.
 *  - Real measurement + viewport flip/clamp + internal scroll, never guesswork.
 */

const GAP = 4; // px between a column and its anchor (small, bridged by close-delay)
const EDGE = 8; // min padding from viewport edges
const BASE_Z = 9999;
const ROW_INTENT_MS = 90; // delay before a hovered row opens its own submenu

type Side = "left" | "right";

export interface FlyoutHandlers {
  isItemActive: (item: any) => boolean;
  /**
   * Whether a row should show the "new activity" blinking red ring. `isOpenTrail` is
   * true when this row's own submenu column is currently open, so an ancestor stops
   * blinking once the user drills into it (the nudge hops to the deeper column).
   */
  shouldBlink?: (item: any, isOpenTrail: boolean) => boolean;
  /** Returns a sized icon element for a menu item's `icon` string. */
  getIcon: (iconName: string, size?: number) => React.ReactNode;
  /** Favorites render their icon differently (entity badges etc.). */
  renderFavoriteIcon: (fav: any, size?: number) => React.ReactNode;
  /** Navigate to an item. `opts.fromFavorite` flags the navigation source. */
  onNavigate: (item: any, e: React.MouseEvent, opts?: { fromFavorite?: boolean }) => void;
  onContextMenu: (item: any, e: React.MouseEvent) => void;
  /** Keep the whole flyout chain alive while the pointer is inside any column. */
  cancelClose: () => void;
  scheduleClose: () => void;
}

interface FlyoutColumnProps extends FlyoutHandlers {
  items: any[];
  /** Bounding rect of the trigger (sidebar item for the root, hovered row for nested). */
  anchorRect: { top: number; bottom: number; left: number; right: number };
  /** Direction this column should try to open. Root = "left"; nested inherit. */
  preferSide: Side;
  depth: number;
  /** Column header. `item` null => non-clickable label (path-less container). */
  header?: { item: any | null; label: string; fromFavorite?: boolean } | null;
  isFavoritesRoot?: boolean;
}

const itemLabel = (item: any, isFavorite: boolean): string => {
  if (isFavorite) return item.entityName ? `${item.title} - ${item.entityName}` : item.title;
  return item.title;
};

function FlyoutColumn({
  items,
  anchorRect,
  preferSide,
  depth,
  header,
  isFavoritesRoot,
  isItemActive,
  shouldBlink,
  getIcon,
  renderFavoriteIcon,
  onNavigate,
  onContextMenu,
  cancelClose,
  scheduleClose,
}: FlyoutColumnProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const [side, setSide] = useState<Side>(preferSide);

  // Which child row is currently expanded into a nested column, plus its rect.
  const [active, setActive] = useState<{ item: any; rect: DOMRect } | null>(null);
  const rowIntentTimer = useRef<number | null>(null);

  // Measure this column and position it relative to its anchor, flipping at the
  // viewport edge and clamping/scrolling vertically. Runs before paint so there
  // is no visible jump; the column stays invisible (pos === null) until placed.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    // documentElement.clientWidth/Height is zoom-adjusted, matching offsetWidth/
    // Height and anchorRect (getBoundingClientRect). window.innerWidth/Height is
    // the real viewport (not zoom-adjusted), so it would flip/clamp at the wrong
    // threshold under the document-level CSS zoom.
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;

    // Horizontal placement with edge flip.
    let resolvedSide = preferSide;
    let left = preferSide === "left" ? anchorRect.left - width - GAP : anchorRect.right + GAP;
    if (preferSide === "left" && left < EDGE) {
      resolvedSide = "right";
      left = anchorRect.right + GAP;
    } else if (preferSide === "right" && left + width > vw - EDGE) {
      resolvedSide = "left";
      left = anchorRect.left - width - GAP;
    }
    left = Math.max(EDGE, Math.min(left, vw - width - EDGE));

    // Vertical placement: align with the anchor top, clamp into the viewport.
    const maxHeight = vh - EDGE * 2;
    let top = anchorRect.top;
    if (top + height > vh - EDGE) top = vh - EDGE - Math.min(height, maxHeight);
    top = Math.max(EDGE, top);

    setSide(resolvedSide);
    setPos({ top, left, maxHeight });
  }, [anchorRect.top, anchorRect.left, anchorRect.right, anchorRect.bottom, preferSide, items]);

  useEffect(() => {
    return () => {
      if (rowIntentTimer.current) clearTimeout(rowIntentTimer.current);
    };
  }, []);

  const handleRowEnter = useCallback((item: any, el: HTMLElement) => {
    if (rowIntentTimer.current) clearTimeout(rowIntentTimer.current);
    const hasChildren = item.children && item.children.length > 0;
    const rect = el.getBoundingClientRect();
    // Short intent delay before swapping the nested column, so dragging across
    // sibling rows toward an open submenu doesn't thrash it.
    rowIntentTimer.current = window.setTimeout(() => {
      setActive(hasChildren ? { item, rect } : null);
    }, ROW_INTENT_MS);
  }, []);

  const SubmenuChevron = side === "left" ? IconChevronLeft : IconChevronRight;
  const activeId = active?.item?.id;

  const column = createPortal(
    <div
      ref={ref}
      role="menu"
      style={{
        position: "fixed",
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        maxHeight: pos?.maxHeight,
        zIndex: BASE_Z + depth,
        opacity: pos ? 1 : 0,
        transform: pos ? "translateX(0)" : `translateX(${side === "left" ? 8 : -8}px)`,
        transition: "opacity 150ms ease, transform 150ms ease",
        pointerEvents: pos ? "auto" : "none",
      }}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      <div className="flex flex-col overflow-y-auto overflow-x-hidden bg-card border border-border rounded-lg shadow-lg p-1.5 min-w-[200px] max-w-[320px]" style={{ maxHeight: pos?.maxHeight }}>
        {header &&
          (header.item ? (
            <button
              type="button"
              onClick={(e) => onNavigate(header.item, e, { fromFavorite: header.fromFavorite })}
              onContextMenu={(e) => onContextMenu(header.item, e)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 mb-1 text-sm font-semibold rounded-md border-b border-border transition-colors text-left",
                isItemActive(header.item) ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              <span className="truncate">{header.label}</span>
            </button>
          ) : (
            <div className="px-3 py-2 mb-1 text-sm font-semibold border-b border-border truncate">{header.label}</div>
          ))}

        {items.map((child: any) => {
          const hasChildren = child.children && child.children.length > 0;
          const isActiveRow = isItemActive(child);
          const isOpenTrail = activeId && activeId === child.id;
          const isBlinking = shouldBlink ? shouldBlink(child, !!isOpenTrail) : false;
          return (
            <button
              key={child.id || child.path}
              type="button"
              role="menuitem"
              onMouseEnter={(e) => handleRowEnter(child, e.currentTarget)}
              onClick={(e) => {
                // Containers without their own path just toggle their submenu open.
                if (!child.path && hasChildren) {
                  setActive({ item: child, rect: e.currentTarget.getBoundingClientRect() });
                  return;
                }
                if (child.path) onNavigate(child, e, { fromFavorite: isFavoritesRoot });
              }}
              onContextMenu={(e) => onContextMenu(child, e)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors text-left",
                isActiveRow
                  ? "bg-primary text-primary-foreground"
                  : isOpenTrail
                    ? "bg-muted"
                    : "hover:bg-muted",
                isBlinking && "nav-activity-blink",
              )}
            >
              <span className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                {isFavoritesRoot ? renderFavoriteIcon(child, 16) : getIcon(child.icon, 16)}
              </span>
              <span className="flex-1 truncate">{itemLabel(child, !!isFavoritesRoot)}</span>
              {hasChildren && <SubmenuChevron size={14} className="flex-shrink-0 opacity-60" />}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      {column}
      {active && active.item.children && (
        <FlyoutColumn
          key={active.item.id || active.item.path}
          items={active.item.children}
          anchorRect={active.rect}
          preferSide={side}
          depth={depth + 1}
          header={active.item.path ? { item: active.item, label: active.item.title } : null}
          isItemActive={isItemActive}
          shouldBlink={shouldBlink}
          getIcon={getIcon}
          renderFavoriteIcon={renderFavoriteIcon}
          onNavigate={onNavigate}
          onContextMenu={onContextMenu}
          cancelClose={cancelClose}
          scheduleClose={scheduleClose}
        />
      )}
    </>
  );
}

export interface FlyoutState {
  item: any;
  rect: DOMRect;
  isFavorites?: boolean;
}

const OPEN_DELAY_MS = 90; // hover intent before opening (ignores quick fly-overs)
const CLOSE_DELAY_MS = 220; // grace period; bridges the trigger->column gap

/**
 * Hover-intent controller shared by the sidebar triggers and the flyout columns.
 * A single open-timer and a single close-timer guarantee there are never racing
 * timeouts (the root cause of the old flicker/stuck-popover bugs).
 */
export function useFlyoutController() {
  const [state, setState] = useState<FlyoutState | null>(null);
  const stateRef = useRef<FlyoutState | null>(null);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const sync = (next: FlyoutState | null) => {
    stateRef.current = next;
    setState(next);
  };
  const cancelOpen = () => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  };
  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const open = useCallback((item: any, el: HTMLElement, isFavorites = false) => {
    cancelClose();
    const rect = el.getBoundingClientRect();
    if (stateRef.current) {
      // Already open: switch roots immediately so browsing icons feels instant.
      cancelOpen();
      sync({ item, rect, isFavorites });
    } else {
      cancelOpen();
      openTimer.current = window.setTimeout(() => {
        sync({ item, rect, isFavorites });
        openTimer.current = null;
      }, OPEN_DELAY_MS);
    }
  }, [cancelClose]);

  const scheduleClose = useCallback(() => {
    cancelOpen(); // a quick pass that never resolved must not open later
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      sync(null);
      closeTimer.current = null;
    }, CLOSE_DELAY_MS);
  }, []);

  const close = useCallback(() => {
    cancelOpen();
    cancelClose();
    sync(null);
  }, [cancelClose]);

  useEffect(() => {
    return () => {
      cancelOpen();
      cancelClose();
    };
  }, [cancelClose]);

  return { state, open, openImmediate: open, scheduleClose, cancelClose, close };
}

interface SidebarFlyoutProps extends FlyoutHandlers {
  state: FlyoutState;
}

/** Top-level entry: renders the root column (children, or a tooltip for leaves). */
export function SidebarFlyout({ state, ...handlers }: SidebarFlyoutProps) {
  const { item, rect, isFavorites } = state;
  const hasChildren = item.children && item.children.length > 0;

  // Leaf item (no children): a simple tooltip with the title.
  if (!hasChildren) {
    return (
      <div
        role="tooltip"
        style={{
          position: "fixed",
          top: rect.top,
          left: rect.left - GAP,
          transform: "translateX(-100%)",
          zIndex: BASE_Z,
        }}
        onMouseEnter={handlers.cancelClose}
        onMouseLeave={handlers.scheduleClose}
      >
        <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2">
          <span className="text-sm font-medium whitespace-nowrap">{item.title}</span>
        </div>
      </div>
    );
  }

  return (
    <FlyoutColumn
      key={item.id || item.path}
      items={item.children}
      anchorRect={rect}
      preferSide="left"
      depth={0}
      header={
        isFavorites
          ? { item: { path: item.path, title: item.title, icon: item.icon }, label: item.title, fromFavorite: true }
          : { item: item.path ? item : null, label: item.title }
      }
      isFavoritesRoot={isFavorites}
      {...handlers}
    />
  );
}
