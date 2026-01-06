import React, { useEffect, useRef, useCallback } from "react";
import type { TimeClockEntry } from "../../../types";
import {
  IconTrash as Trash2,
  IconArrowUp as MoveUp,
  IconArrowDown as MoveDown,
  IconFileText as FileText,
  IconMapPin as MapPin,
  IconCamera as Camera,
  IconClock as Clock,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface ContextMenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  dangerous?: boolean;
  hidden?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  entry: TimeClockEntry;
  field?: string; // Specific field if right-clicked on a cell
  onClose: () => void;
  onDeleteEntry: (entry: TimeClockEntry) => void;
  onMoveToPreviousDay: (entry: TimeClockEntry, field?: string) => void;
  onMoveToNextDay: (entry: TimeClockEntry, field?: string) => void;
  onReleaseJustification: (entry: TimeClockEntry, field?: string) => void;
  onViewLocation: (entry: TimeClockEntry) => void;
  onViewPhoto: (entry: TimeClockEntry) => void;
  className?: string;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  isOpen,
  x,
  y,
  entry,
  field,
  onClose,
  onDeleteEntry,
  onMoveToPreviousDay,
  onMoveToNextDay,
  onReleaseJustification,
  onViewLocation,
  onViewPhoto,
  className,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const keyDownRef = useRef<((e: KeyboardEvent) => void) | null>(null);

  // Handle positioning to avoid going off screen
  const getPositionedStyle = useCallback(() => {
    if (!menuRef.current) return { left: x, top: y };

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    let left = x;
    let top = y;

    // Adjust if menu would go off the right edge
    if (x + rect.width > viewport.width) {
      left = x - rect.width;
    }

    // Adjust if menu would go off the bottom edge
    if (y + rect.height > viewport.height) {
      top = y - rect.height;
    }

    // Ensure we don't go off the left or top edges
    left = Math.max(8, left);
    top = Math.max(8, top);

    return { left, top };
  }, [x, y]);

  // Get field label for display
  const getFieldLabel = useCallback((field: string): string => {
    const labels: Record<string, string> = {
      entry1: "Entrada 1",
      exit1: "Saída 1",
      entry2: "Entrada 2",
      exit2: "Saída 2",
      entry3: "Entrada 3",
      exit3: "Saída 3",
      entry4: "Entrada 4",
      exit4: "Saída 4",
      entry5: "Entrada 5",
      exit5: "Saída 5",
      compensated: "Compensado",
      neutral: "Neutro",
      dayOff: "Folga",
      freeLunch: "Almoço Gratuito",
    };
    return labels[field] || field;
  }, []);

  // Build context menu items based on context
  const menuItems: ContextMenuItem[] = [
    // Release justification - available for time fields or when entry has justifications
    {
      id: "release-justification",
      label: field ? `Liberar justificativa - ${getFieldLabel(field)}` : "Liberar justificativa",
      icon: FileText,
      action: () => onReleaseJustification(entry, field),
      hidden: !field && !entry._count?.justifications,
    },
    // Separator after justification
    {
      id: "separator-1",
      label: "",
      icon: Clock,
      action: () => {},
      separator: true,
    },
    // Delete entry - always available
    {
      id: "delete-entry",
      label: "Excluir registro",
      icon: Trash2,
      action: () => onDeleteEntry(entry),
      dangerous: true,
    },
    // Move to previous day
    {
      id: "move-previous",
      label: field ? `Mover ${getFieldLabel(field)} para dia anterior` : "Mover para dia anterior",
      icon: MoveUp,
      action: () => onMoveToPreviousDay(entry, field),
    },
    // Move to next day
    {
      id: "move-next",
      label: field ? `Mover ${getFieldLabel(field)} para próximo dia` : "Mover para próximo dia",
      icon: MoveDown,
      action: () => onMoveToNextDay(entry, field),
    },
    // Separator before location/photo actions
    {
      id: "separator-2",
      label: "",
      icon: Clock,
      action: () => {},
      separator: true,
      hidden: !entry.latitude && !entry.hasPhoto,
    },
    // View location - only if location data exists
    {
      id: "view-location",
      label: "Ver localização no mapa",
      icon: MapPin,
      action: () => onViewLocation(entry),
      hidden: !entry.latitude || !entry.longitude,
    },
    // View photo - only if photo exists
    {
      id: "view-photo",
      label: "Ver foto",
      icon: Camera,
      action: () => onViewPhoto(entry),
      hidden: !entry.hasPhoto,
    },
  ];

  // Filter out hidden items and handle separators
  const visibleItems = menuItems.filter((item, index) => {
    if (item.hidden) return false;

    // Remove separator if it's at the beginning, end, or followed by another separator
    if (item.separator) {
      const nextVisibleIndex = menuItems.findIndex((nextItem, nextIndex) => nextIndex > index && !nextItem.hidden);
      const isLast = nextVisibleIndex === -1;
      const nextItemIsSeparator = nextVisibleIndex !== -1 && menuItems[nextVisibleIndex].separator;

      return !isLast && !nextItemIsSeparator && index > 0;
    }

    return true;
  });

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "ArrowDown":
        case "ArrowUp":
          e.preventDefault();
          // Focus next/previous menu item
          const focusableItems = menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])');
          if (focusableItems && focusableItems.length > 0) {
            const currentIndex = Array.from(focusableItems).findIndex((item) => item === document.activeElement);
            let nextIndex;

            if (e.key === "ArrowDown") {
              nextIndex = currentIndex < focusableItems.length - 1 ? currentIndex + 1 : 0;
            } else {
              nextIndex = currentIndex > 0 ? currentIndex - 1 : focusableItems.length - 1;
            }

            (focusableItems[nextIndex] as HTMLElement).focus();
          }
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          // Trigger click on focused item
          if (document.activeElement && document.activeElement.getAttribute("role") === "menuitem") {
            (document.activeElement as HTMLElement).click();
          }
          break;
      }
    },
    [isOpen, onClose],
  );

  // Handle clicks outside the menu
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  // Set up event listeners
  useEffect(() => {
    if (isOpen) {
      // Store the keydown handler reference
      keyDownRef.current = handleKeyDown;

      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClickOutside);

      // Focus the first menu item
      setTimeout(() => {
        const firstItem = menuRef.current?.querySelector('[role="menuitem"]:not([disabled])');
        if (firstItem) {
          (firstItem as HTMLElement).focus();
        }
      }, 0);

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("mousedown", handleClickOutside);
        keyDownRef.current = null;
      };
    }
  }, [isOpen, handleKeyDown, handleClickOutside]);

  // Don't render if not open
  if (!isOpen) return null;

  const positionStyle = getPositionedStyle();

  return (
    <div
      ref={menuRef}
      className={cn(
        "fixed z-50 min-w-56 bg-popover text-popover-foreground border border-border/40 rounded-md shadow-sm py-1",
        "animate-in fade-in-0 zoom-in-95 duration-100",
        className,
      )}
      style={{
        left: positionStyle.left,
        top: positionStyle.top,
      }}
      role="menu"
      aria-label="Context menu"
    >
      {visibleItems.map((item) => {
        if (item.separator) {
          return <div key={item.id} className="h-px bg-border mx-2 my-1" role="separator" />;
        }

        const Icon = item.icon;

        return (
          <button
            key={item.id}
            role="menuitem"
            className={cn(
              "w-full flex items-center px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none transition-colors",
              item.dangerous && "text-destructive hover:bg-destructive/10 focus:bg-destructive/10",
            )}
            onClick={() => {
              item.action();
              onClose();
            }}
            tabIndex={0}
          >
            <Icon className="h-4 w-4 mr-3 flex-shrink-0" />
            <span className="flex-1">{item.label}</span>
          </button>
        );
      })}

      {/* Show context info at bottom for debugging in development */}
      {process.env.NODE_ENV === "development" && (
        <>
          <div className="h-px bg-border mx-2 my-1" role="separator" />
          <div className="px-3 py-1 text-xs text-muted-foreground">{field ? `Campo: ${getFieldLabel(field)}` : "Linha completa"}</div>
        </>
      )}
    </div>
  );
};

export default ContextMenu;
