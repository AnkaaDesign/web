import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface ContextMenuContextType {
  isOpen: boolean;
  openMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
  closeMenu: () => void;
}

const ContextMenuContext = createContext<ContextMenuContextType | null>(null);

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "destructive";
}

interface ContextMenuProviderProps {
  children: React.ReactNode;
}

export function ContextMenuProvider({ children }: ContextMenuProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [adjustedPosition, setAdjustedPosition] = useState({ x: 0, y: 0 });
  const [items, setItems] = useState<ContextMenuItem[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  const openMenu = (x: number, y: number, menuItems: ContextMenuItem[]) => {
    setPosition({ x, y });
    setItems(menuItems);
    setIsOpen(true);
  };

  const closeMenu = () => {
    setIsOpen(false);
    setItems([]);
  };

  // Viewport boundary checking with 8px padding
  useEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const menu = menuRef.current;
    const menuRect = menu.getBoundingClientRect();
    const padding = 8;

    let adjustedX = position.x;
    let adjustedY = position.y;

    // Check right edge
    if (position.x + menuRect.width > window.innerWidth - padding) {
      adjustedX = window.innerWidth - menuRect.width - padding;
    }

    // Check left edge
    if (adjustedX < padding) {
      adjustedX = padding;
    }

    // Check bottom edge
    if (position.y + menuRect.height > window.innerHeight - padding) {
      adjustedY = window.innerHeight - menuRect.height - padding;
    }

    // Check top edge
    if (adjustedY < padding) {
      adjustedY = padding;
    }

    setAdjustedPosition({ x: adjustedX, y: adjustedY });
  }, [isOpen, position]);

  // Close menu on outside click or escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <ContextMenuContext.Provider value={{ isOpen, openMenu, closeMenu }}>
      {children}
      {isOpen && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-32 rounded-md border bg-white dark:bg-gray-800 shadow-sm"
          style={{
            left: adjustedPosition.x,
            top: adjustedPosition.y,
          }}
        >
          <div className="py-1">
            {items.map((item) => (
              <button
                key={item.id}
                className={cn(
                  "flex w-full items-center px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                  item.disabled && "opacity-50 cursor-not-allowed",
                  item.variant === "destructive" && "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20",
                )}
                onClick={() => {
                  if (!item.disabled) {
                    item.onClick();
                    closeMenu();
                  }
                }}
                disabled={item.disabled}
              >
                {item.icon && <span className="mr-2 h-4 w-4 flex-shrink-0">{item.icon}</span>}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </ContextMenuContext.Provider>
  );
}

export function useContextMenu() {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error("useContextMenu must be used within a ContextMenuProvider");
  }
  return context;
}

interface ContextMenuTriggerProps {
  children: React.ReactNode;
  items: ContextMenuItem[];
  disabled?: boolean;
}

export function ContextMenuTrigger({ children, items, disabled }: ContextMenuTriggerProps) {
  const { openMenu } = useContextMenu();

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!disabled && items.length > 0) {
      openMenu(event.clientX, event.clientY, items);
    }
  };

  // Clone the child element and add the onContextMenu handler
  return React.cloneElement(children as React.ReactElement<any>, {
    onContextMenu: handleContextMenu,
  });
}
