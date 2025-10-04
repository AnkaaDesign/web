import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { routes } from "../constants";

export interface UseItemShortcutsOptions {
  // Element references
  searchInputRef?: React.RefObject<HTMLInputElement>;
  listRef?: React.RefObject<HTMLElement>;

  // Navigation state
  selectedItemId?: string | null;
  items?: Array<{ id: string }>;

  // Modal state
  isModalOpen?: boolean;

  // Callbacks
  onNewItem?: () => void;
  onOpenDetails?: (itemId: string) => void;
  onCloseModal?: () => void;
  onSelectItem?: (itemId: string) => void;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;

  // Feature flags
  enabled?: boolean;
  enableSearch?: boolean;
  enableNavigation?: boolean;
  enableModalClose?: boolean;
  enableNewItem?: boolean;
  enableDetailsOpen?: boolean;
}

export interface UseItemShortcutsReturn {
  // Active shortcut info
  activeShortcut: string | null;

  // Helper text for accessibility
  getShortcutText: (action: ShortcutAction) => string;

  // Manual trigger methods
  focusSearch: () => void;
  openNewItem: () => void;
  closeModal: () => void;
  navigateToSelected: () => void;
}

export type ShortcutAction = "search" | "new" | "close" | "navigate-up" | "navigate-down" | "open-details";

// Platform-specific modifier key
const getModifierKey = () => {
  return navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl";
};

// Shortcut definitions with accessibility labels
const SHORTCUTS: Record<ShortcutAction, { key: string; ctrlOrCmd?: boolean; label: string; ariaLabel: string }> = {
  search: {
    key: "f",
    ctrlOrCmd: true,
    label: `${getModifierKey()}+F`,
    ariaLabel: "Pressione Control F para focar na busca",
  },
  new: {
    key: "n",
    ctrlOrCmd: true,
    label: `${getModifierKey()}+N`,
    ariaLabel: "Pressione Control N para criar novo item",
  },
  close: {
    key: "Escape",
    label: "Esc",
    ariaLabel: "Pressione Escape para fechar",
  },
  "navigate-up": {
    key: "ArrowUp",
    label: "↑",
    ariaLabel: "Use seta para cima para navegar",
  },
  "navigate-down": {
    key: "ArrowDown",
    label: "↓",
    ariaLabel: "Use seta para baixo para navegar",
  },
  "open-details": {
    key: "Enter",
    label: "Enter",
    ariaLabel: "Pressione Enter para abrir detalhes",
  },
};

export function useItemShortcuts(options: UseItemShortcutsOptions = {}): UseItemShortcutsReturn {
  const {
    searchInputRef,
    listRef,
    selectedItemId,
    items = [],
    isModalOpen = false,
    onNewItem,
    onOpenDetails,
    onCloseModal,
    onSelectItem,
    onNavigateUp,
    onNavigateDown,
    enabled = true,
    enableSearch = true,
    enableNavigation = true,
    enableModalClose = true,
    enableNewItem = true,
    enableDetailsOpen = true,
  } = options;

  const navigate = useNavigate();
  const activeShortcutRef = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Set active shortcut temporarily for UI feedback
  const setActiveShortcut = useCallback((shortcut: string | null) => {
    activeShortcutRef.current = shortcut;

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Clear after 1 second
    if (shortcut) {
      timeoutRef.current = setTimeout(() => {
        activeShortcutRef.current = null;
      }, 1000);
    }
  }, []);

  // Focus search input
  const focusSearch = useCallback(() => {
    if (searchInputRef?.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
      setActiveShortcut("search");
    }
  }, [searchInputRef, setActiveShortcut]);

  // Open new item
  const openNewItem = useCallback(() => {
    if (onNewItem) {
      onNewItem();
    } else {
      // Default navigation to new item page
      navigate(routes.inventory.products.create);
    }
    setActiveShortcut("new");
  }, [onNewItem, navigate, setActiveShortcut]);

  // Close modal
  const closeModal = useCallback(() => {
    if (onCloseModal && isModalOpen) {
      onCloseModal();
      setActiveShortcut("close");
    }
  }, [onCloseModal, isModalOpen, setActiveShortcut]);

  // Navigate to selected item
  const navigateToSelected = useCallback(() => {
    if (selectedItemId) {
      if (onOpenDetails) {
        onOpenDetails(selectedItemId);
      } else {
        // Default navigation to item details
        navigate(routes.inventory.products.edit(selectedItemId));
      }
      setActiveShortcut("open-details");
    }
  }, [selectedItemId, onOpenDetails, navigate, setActiveShortcut]);

  // Navigate up in list
  const navigateUp = useCallback(() => {
    if (!items.length || !onSelectItem) return;

    const currentIndex = selectedItemId ? items.findIndex((item) => item.id === selectedItemId) : -1;

    let newIndex: number;
    if (currentIndex === -1 || currentIndex === 0) {
      // Wrap to bottom
      newIndex = items.length - 1;
    } else {
      newIndex = currentIndex - 1;
    }

    onSelectItem(items[newIndex].id);
    setActiveShortcut("navigate-up");

    // Scroll into view if needed
    if (listRef?.current) {
      const itemElement = listRef.current.querySelector(`[data-item-id="${items[newIndex].id}"]`);
      itemElement?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [items, selectedItemId, onSelectItem, listRef, setActiveShortcut]);

  // Navigate down in list
  const navigateDown = useCallback(() => {
    if (!items.length || !onSelectItem) return;

    const currentIndex = selectedItemId ? items.findIndex((item) => item.id === selectedItemId) : -1;

    let newIndex: number;
    if (currentIndex === -1 || currentIndex === items.length - 1) {
      // Wrap to top
      newIndex = 0;
    } else {
      newIndex = currentIndex + 1;
    }

    onSelectItem(items[newIndex].id);
    setActiveShortcut("navigate-down");

    // Scroll into view if needed
    if (listRef?.current) {
      const itemElement = listRef.current.querySelector(`[data-item-id="${items[newIndex].id}"]`);
      itemElement?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [items, selectedItemId, onSelectItem, listRef, setActiveShortcut]);

  // Handle keyboard events
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing in an input
      const target = event.target as HTMLElement;
      const isTyping = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.contentEditable === "true";

      // Don't interfere with typing unless it's a global shortcut
      if (isTyping && event.key !== "Escape") {
        // Allow Ctrl/Cmd shortcuts even when typing
        if (!event.ctrlKey && !event.metaKey) {
          return;
        }
      }

      // Check for Ctrl/Cmd+F (Search)
      if (enableSearch && event.key === "f" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        focusSearch();
        return;
      }

      // Check for Ctrl/Cmd+N (New Item)
      if (enableNewItem && event.key === "n" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        openNewItem();
        return;
      }

      // Check for Escape (Close Modal)
      if (enableModalClose && event.key === "Escape") {
        // Only prevent default if modal is open
        if (isModalOpen) {
          event.preventDefault();
          closeModal();
        }
        return;
      }

      // Navigation shortcuts (only when not typing)
      if (!isTyping && enableNavigation) {
        switch (event.key) {
          case "ArrowUp":
            event.preventDefault();
            if (onNavigateUp) {
              onNavigateUp();
            } else {
              navigateUp();
            }
            break;

          case "ArrowDown":
            event.preventDefault();
            if (onNavigateDown) {
              onNavigateDown();
            } else {
              navigateDown();
            }
            break;

          case "Enter":
            if (enableDetailsOpen && selectedItemId) {
              event.preventDefault();
              navigateToSelected();
            }
            break;
        }
      }
    };

    // Add event listener
    window.addEventListener("keydown", handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    enabled,
    enableSearch,
    enableNavigation,
    enableModalClose,
    enableNewItem,
    enableDetailsOpen,
    isModalOpen,
    selectedItemId,
    focusSearch,
    openNewItem,
    closeModal,
    navigateUp,
    navigateDown,
    navigateToSelected,
    onNavigateUp,
    onNavigateDown,
  ]);

  // Get shortcut text for UI display
  const getShortcutText = useCallback((action: ShortcutAction): string => {
    const shortcut = SHORTCUTS[action];
    return shortcut.label;
  }, []);

  return {
    activeShortcut: activeShortcutRef.current,
    getShortcutText,
    focusSearch,
    openNewItem,
    closeModal,
    navigateToSelected,
  };
}

// Example usage with accessibility:
/*
function ItemListPage() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { data: items } = useItems();

  const { getShortcutText } = useItemShortcuts({
    searchInputRef,
    listRef,
    selectedItemId,
    items: items?.data || [],
    isModalOpen: isCreateModalOpen,
    onNewItem: () => setIsCreateModalOpen(true),
    onCloseModal: () => setIsCreateModalOpen(false),
    onSelectItem: setSelectedItemId,
  });

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <input
          ref={searchInputRef}
          type="search"
          placeholder="Buscar items..."
          aria-label="Buscar items"
          aria-describedby="search-shortcut"
          className="flex-1"
        />
        <span id="search-shortcut" className="sr-only">
          {SHORTCUTS.search.ariaLabel}
        </span>
        <kbd className="text-xs">{getShortcutText("search")}</kbd>
        
        <button
          onClick={() => setIsCreateModalOpen(true)}
          aria-label="Criar novo item"
          aria-describedby="new-shortcut"
        >
          Novo Item
        </button>
        <span id="new-shortcut" className="sr-only">
          {SHORTCUTS.new.ariaLabel}
        </span>
        <kbd className="text-xs">{getShortcutText("new")}</kbd>
      </div>

      <div 
        ref={listRef}
        role="listbox"
        aria-label="Lista de items"
        aria-activedescendant={selectedItemId || undefined}
        tabIndex={0}
      >
        {items?.data.map(item => (
          <div
            key={item.id}
            data-item-id={item.id}
            role="option"
            aria-selected={selectedItemId === item.id}
            onClick={() => setSelectedItemId(item.id)}
            className={selectedItemId === item.id ? "selected" : ""}
          >
            {item.name}
          </div>
        ))}
      </div>

      <div className="sr-only" aria-live="polite">
        Use as setas para navegar e Enter para abrir detalhes
      </div>
    </div>
  );
}
*/
