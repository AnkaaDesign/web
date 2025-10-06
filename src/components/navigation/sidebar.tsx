import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/contexts/sidebar-context";
import { useTheme } from "@/contexts/theme-context";
import { useFavorites } from "@/contexts/favorites-context";
import { MENU_ITEMS, routes } from "../../constants";
import type { MenuItem } from "../../constants";
import { getFilteredMenuForUser, getTablerIcon } from "../../utils";
import { maskPhone, getPageIconName, isPageCadastrar } from "../../utils";
import { fixNavigationPath } from "@/utils/route-validation";
import { useAuth } from "@/contexts/auth-context";
import { IconLogout, IconUser, IconSettings, IconChevronRight, IconMenu2, IconStarFilled, IconServer } from "@tabler/icons-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

import {
  IconDashboard,
  IconHome,
  IconBuilding,
  IconTool,
  IconPackage,
  IconBox,
  IconBuildingWarehouse,
  IconBuildingSkyscraper,
  IconBrush,
  IconPaint,
  IconPalette,
  IconUsers,
  IconBriefcase,
  IconShield,
  IconUserCircle,
  IconUserCog,
  IconChartBar,
  IconChartLine,
  IconCalendar,
  IconCalendarEvent,
  IconPlus,
  IconEye,
  IconEdit,
  IconFileInvoice,
  IconClipboardList,
  IconFileText,
  IconFile,
  IconClock,
  IconPlayerPause,
  IconHistory,
  IconHourglass,
  IconFlask,
  IconBook,
  IconScissors,
  IconTags,
  IconClipboard,
  IconSpeakerphone,
  IconArchive,
  IconRobot,
  IconBrandApple,
  IconCircleCheck,
  IconCircleX,
  IconCoins,
  IconCurrencyDollar,
  IconDatabase,
  IconFolderX,
  IconNote,
  IconBell,
  IconBellRinging,
  IconRepeat,
  IconShoppingCart,
  IconCalendarPlus,
  IconSearch,
  IconSend,
  IconShieldCheck,
  IconRuler,
  IconTag,
  IconTruck,
  IconUpload,
  IconBeach,
  IconAlertTriangle,
  IconTools,
  IconBadge,
  IconArrowsExchange,
  IconList,
  IconListDetails,
  IconArrowsUpDown,
  IconBolt,
  IconStar,
  IconFolderShare,
  IconDatabaseImport,
  IconFolders,
  IconTrendingUp,
  IconReceipt,
  IconCalculator,
  IconRocket,
} from "@tabler/icons-react";

// Types for better type safety

// Simple icon mapping system
const iconComponents: Record<string, any> = {
  IconDashboard,
  IconMenu2,
  IconHome,
  IconBuilding,
  IconTool,
  IconPackage,
  IconBox,
  IconBuildingWarehouse,
  IconBuildingSkyscraper,
  IconBrush,
  IconPaint,
  IconPalette,
  IconUsers,
  IconBriefcase,
  IconSettings,
  IconShield,
  IconUserCircle,
  IconUser,
  IconUserCog,
  IconChartBar,
  IconChartLine,
  IconCalendar,
  IconCalendarEvent,
  IconPlus,
  IconEye,
  IconEdit,
  IconFileInvoice,
  IconClipboardList,
  IconFileText,
  IconClock,
  IconPlayerPause,
  IconHistory,
  IconHourglass,
  IconChevronRight,
  IconLogout,
  IconFile,
  IconFlask,
  IconBook,
  IconScissors,
  IconTags,
  IconClipboard,
  IconSpeakerphone,
  IconArchive,
  IconRobot,
  IconBrandApple,
  IconCircleCheck,
  IconCircleX,
  IconCoins,
  IconCurrencyDollar,
  IconDatabase,
  IconFolderX,
  IconNote,
  IconBell,
  IconBellRinging,
  IconRepeat,
  IconShoppingCart,
  IconCalendarPlus,
  IconSearch,
  IconSend,
  IconShieldCheck,
  IconRuler,
  IconTag,
  IconTruck,
  IconUpload,
  IconBeach,
  IconAlertTriangle,
  IconTools,
  IconBadge,
  IconArrowsExchange,
  IconList,
  IconListDetails,
  IconArrowsUpDown,
  IconBolt,
  IconStar,
  IconStarFilled,
  IconServer,
  IconFolderShare,
  IconDatabaseImport,
  IconFolders,
  IconTrendingUp,
  IconReceipt,
  IconCalculator,
  IconRocket,
};

// Get icon component helper
const getIconComponent = (iconName: string, size = 20) => {
  if (!iconName) {
    return null;
  }

  // Convert kebab-case to camelCase for TABLER_ICONS lookup
  const camelCaseName = iconName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  const tablerName = getTablerIcon(camelCaseName);
  const IconComponent = iconComponents[tablerName];

  if (!IconComponent) {
    // Return a default icon if not found
    return <IconFile size={size} stroke={1.5} />;
  }

  return <IconComponent size={size} stroke={1.5} />;
};

// Function to render favorite icon with plus overlay for cadastrar pages
const renderFavoriteIcon = (fav: any, size: number = 20) => {
  // Try to get icon name from the path itself
  const iconName = getPageIconName(fav.path);
  const isCadastrar = isPageCadastrar(fav.path);
  const mainIcon = getIconComponent(iconName, size);

  if (!mainIcon) return null;

  if (isCadastrar) {
    return (
      <div className="relative">
        {mainIcon}
        <div className="absolute -top-1.5 -right-1.5 bg-white dark:bg-gray-800 rounded-full p-0.5">
          <IconPlus size={10} className="text-green-600" strokeWidth={3} />
        </div>
      </div>
    );
  }

  return mainIcon;
};

export const Sidebar = memo(() => {
  const { isOpen } = useSidebar();
  const { user, logout } = useAuth();
  const { favorites } = useFavorites();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // State management
  const [expandedMenus, setExpandedMenus] = useState<{ [key: string]: boolean }>({});
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [navigatingItemId, setNavigatingItemId] = useState<string | null>(null);
  const [_hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ top: number; left: number; item: any } | null>(null);
  const [isPopoverAnimating, setIsPopoverAnimating] = useState(false);
  const [showFavorites, setShowFavorites] = useState(() => {
    const stored = localStorage.getItem("ankaa-sidebar-show-favorites");
    return stored !== null ? stored === "true" : true;
  });

  // Refs
  const timeoutRef = useRef<number | null>(null);
  const navigationTimeoutRef = useRef<number | null>(null);
  const mouseInPopover = useRef(false);
  const navigationSourceRef = useRef<"menu" | "favorite" | null>(null);

  // Clear navigation timeout
  const clearNavigationTimeout = useCallback(() => {
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
      navigationTimeoutRef.current = null;
    }
    setNavigatingItemId(null);
  }, []);

  // Start navigation with loading state
  const startNavigation = useCallback(
    (itemId: string, path: string, isFromFavorite = false) => {
      clearNavigationTimeout();
      setNavigatingItemId(itemId);

      if (isFromFavorite) {
        navigationSourceRef.current = "favorite";
      }

      navigationTimeoutRef.current = window.setTimeout(() => {
        clearNavigationTimeout();
      }, 2000); // 2 second timeout

      navigate(path);
    },
    [navigate, clearNavigationTimeout],
  );

  // Check if item is active
  const isItemActive = useCallback(
    (item: any): boolean => {
      const currentPath = location.pathname;
      const itemPath = item.path;

      if (!itemPath) return false;

      // For dynamic routes (with :id), check pattern match
      if (itemPath.includes(":")) {
        const pathPattern = itemPath.replace(/:[^/]+/g, "[^/]+");
        const regex = new RegExp(`^${pathPattern}$`);
        return regex.test(currentPath);
      }

      // For static routes, only exact match
      return currentPath === itemPath;
    },
    [location.pathname],
  );

  // Check if current path is under this item's path (for styling)
  const isPathUnderItem = useCallback(
    (item: any): boolean => {
      const currentPath = location.pathname;
      const itemPath = item.path;

      if (!itemPath) return false;

      // Clean paths for comparison
      const cleanItemPath = itemPath.replace(/\/:[^/]+/g, "");
      return currentPath.startsWith(cleanItemPath + "/");
    },
    [location.pathname],
  );

  // Check if item has active child
  const hasActiveChild = useCallback(
    (item: any): boolean => {
      if (!item.children) return false;

      return item.children.some((child: any) => {
        // Check if child is exactly active or if current path is under child
        if (isItemActive(child) || isPathUnderItem(child)) return true;
        return hasActiveChild(child);
      });
    },
    [isItemActive, isPathUnderItem],
  );

  // Toggle submenu with accordion behavior
  const toggleSubmenu = useCallback((itemId: string) => {
    setExpandedMenus((prev) => {
      const newExpanded = { ...prev };
      const isCurrentlyExpanded = prev[itemId];

      if (!isCurrentlyExpanded) {
        // If expanding this menu, find and close all sibling menus at the same level
        const findAndCloseSiblings = (items: any[]) => {
          items.forEach((item) => {
            if (item.id === itemId) {
              // Found our target item, close its siblings at the root level
              items.forEach((sibling) => {
                if (sibling.id !== itemId && sibling.children && sibling.children.length > 0) {
                  newExpanded[sibling.id] = false;
                }
              });
              return;
            }

            // Recursively search in children and close siblings at each level
            if (item.children && item.children.length > 0) {
              const foundInChildren = item.children.some((child: any) => {
                if (child.id === itemId) {
                  // Close siblings at this level
                  item.children.forEach((sibling: any) => {
                    if (sibling.id !== itemId && sibling.children && sibling.children.length > 0) {
                      newExpanded[sibling.id] = false;
                    }
                  });
                  return true;
                }
                return false;
              });

              if (!foundInChildren) {
                findAndCloseSiblings(item.children);
              }
            }
          });
        };

        // Use filteredMenu instead of menuWithContextualItems to avoid circular dependency
        const currentFilteredMenu = getFilteredMenuForUser(MENU_ITEMS, user || undefined, "web");
        findAndCloseSiblings(currentFilteredMenu);
      }

      // Toggle the clicked item
      newExpanded[itemId] = !isCurrentlyExpanded;

      return newExpanded;
    });
  }, [user]);

  // Get filtered menu for current user
  const filteredMenu = useMemo(() => {
    return getFilteredMenuForUser(MENU_ITEMS, user || undefined, "web");
  }, [user]);

  // Filter menu items based on current route (hide cadastrar/editar/detalhes unless on relevant pages)
  const menuWithContextualItems = useMemo(() => {
    const currentPath = location.pathname;

    // Helper to filter children based on context
    const filterChildren = (children: MenuItem[]): MenuItem[] => {
      if (!children) return children;

      return children
        .map((child): MenuItem | null => {
          // FIRST: Handle editar-em-lote and editar-lote explicitly (before other checks)
          if (
            (child.id?.includes("editar-em-lote") || child.id?.includes("editar-lote") || child.path?.includes("/editar-em-lote") || child.path?.includes("/editar-lote")) &&
            child.path
          ) {
            const shouldShow = currentPath === child.path;
            if (!shouldShow) {
              return null;
            }
            // If we should show it, skip other contextual checks
            const filteredChild: MenuItem = {
              ...child,
              children: child.children ? filterChildren(child.children) : undefined,
            };
            if (filteredChild.children?.length === 0) {
              delete filteredChild.children;
            }
            return filteredChild;
          }

          // Check if this is a contextual item (cadastrar, editar, detalhes)
          const isContextualItem = ["cadastrar", "editar", "detalhes"].some((action) => child.id?.includes(action) || child.path?.includes(`/${action}`));

          // For dynamic routes (with :id), check if we're on a specific instance
          if (child.isDynamic && child.path) {
            const pathPattern = child.path.replace(/:[^/]+/g, "[^/]+");
            const regex = new RegExp(`^${pathPattern}$`);
            const shouldShow = regex.test(currentPath);

            if (!shouldShow && isContextualItem) {
              return null; // Hide this item
            }
          }

          // For cadastrar, only show if we're on that exact page
          if (child.id?.includes("cadastrar") && child.path && !child.isDynamic) {
            const shouldShow = currentPath === child.path;
            if (!shouldShow) {
              return null;
            }
          }

          // Recursively filter children
          const filteredChild: MenuItem = {
            ...child,
            children: child.children ? filterChildren(child.children) : undefined,
          };

          // Remove children array if empty
          if (filteredChild.children?.length === 0) {
            delete filteredChild.children;
          }

          return filteredChild;
        })
        .filter((item): item is MenuItem => item !== null); // Remove null items
    };

    // Special handling for paint formula routes
    const formulaMatch = currentPath.match(/^\/pintura\/catalogo\/detalhes\/([^/]+)(?:\/formulas(?:\/detalhes\/([^/]+))?)?/);

    return filteredMenu.map((item) => {
      const filteredItem = {
        ...item,
        children: item.children
          ?.map((child) => {
            // Special handling for catalogo
            if (child.id === "catalogo" && formulaMatch) {
              const paintId = formulaMatch[1];
              const formulaId = formulaMatch[2];

              const catalogoChildren = [...(child.children || [])];

              // Filter editar-em-lote from catalogo children
              const batchEditIndex = catalogoChildren.findIndex((gc) => gc.id?.includes("editar-em-lote"));
              if (batchEditIndex !== -1 && currentPath !== catalogoChildren[batchEditIndex].path) {
                catalogoChildren.splice(batchEditIndex, 1);
              }

              // Only show cadastrar if on cadastrar page
              const cadastrarIndex = catalogoChildren.findIndex((gc) => gc.id === "catalogo-cadastrar");
              if (cadastrarIndex !== -1 && currentPath !== "/pintura/catalogo/cadastrar") {
                catalogoChildren.splice(cadastrarIndex, 1);
              }

              // Only show editar if on edit page
              const editarIndex = catalogoChildren.findIndex((gc) => gc.id === "catalogo-editar");
              if (editarIndex !== -1 && !currentPath.match(/^\/pintura\/catalogo\/editar\/[^/]+$/)) {
                catalogoChildren.splice(editarIndex, 1);
              }

              // Update detalhes to show current paint
              const detalhesIndex = catalogoChildren.findIndex((gc) => gc.id === "catalogo-detalhes");
              if (detalhesIndex !== -1 && paintId) {
                catalogoChildren[detalhesIndex] = {
                  ...catalogoChildren[detalhesIndex],
                  path: `/pintura/catalogo/detalhes/${paintId}`,
                  children: formulaMatch[0].includes("/formulas")
                    ? [
                        {
                          id: "catalogo-formulas",
                          title: "Fórmulas",
                          icon: "beaker",
                          path: `/pintura/catalogo/detalhes/${paintId}/formulas`,
                          children: formulaId
                            ? [
                                {
                                  id: "catalogo-formula-detalhes",
                                  title: "Detalhes da Fórmula",
                                  icon: "eye",
                                  path: `/pintura/catalogo/detalhes/${paintId}/formulas/detalhes/${formulaId}`,
                                },
                              ]
                            : [],
                        } as MenuItem,
                      ]
                    : [],
                } as MenuItem;
              } else if (detalhesIndex !== -1 && !currentPath.includes("/detalhes/")) {
                catalogoChildren.splice(detalhesIndex, 1);
              }

              return { ...child, children: catalogoChildren };
            }

            // For other items, filter children normally
            const filtered = filterChildren([child])[0];
            if (!filtered) return null;
            return {
              ...filtered,
              children: filtered.children ? filterChildren(filtered.children) : undefined,
            };
          })
          .filter(Boolean),
      };

      // Remove children array if empty
      if (filteredItem.children?.length === 0) {
        delete filteredItem.children;
      }

      return filteredItem;
    });
  }, [filteredMenu, location.pathname]);

  // Save showFavorites state
  useEffect(() => {
    localStorage.setItem("ankaa-sidebar-show-favorites", showFavorites.toString());
  }, [showFavorites]);

  // Auto-expand menus based on current route
  useEffect(() => {
    // Check navigation source
    const navSource = navigationSourceRef.current;

    // Reset navigation source after checking
    navigationSourceRef.current = null;

    // Skip auto-expand if navigating from favorite or on first page load
    if (navSource === "favorite" || navSource === null) {
      return;
    }

    const newExpandedMenus: { [key: string]: boolean } = {};

    const findAndExpandPath = (items: any[], parentExpanded = false) => {
      let hasExpandedSibling = false;

      items.forEach((item) => {
        const isActive = isItemActive(item);
        const hasActive = hasActiveChild(item);

        if ((isActive || hasActive) && item.id) {
          newExpandedMenus[item.id] = true;
          hasExpandedSibling = true;
        }

        if (item.children && (isActive || hasActive || parentExpanded)) {
          findAndExpandPath(item.children, isActive || hasActive);
        }
      });

      // If we found an expanded sibling, close others at this level (accordion behavior)
      if (hasExpandedSibling) {
        items.forEach((item) => {
          if (item.id && !newExpandedMenus[item.id]) {
            newExpandedMenus[item.id] = false;
          }
        });
      }
    };

    findAndExpandPath(menuWithContextualItems);

    setExpandedMenus((prev) => {
      // Only update if there are changes
      const hasChanges = Object.keys(newExpandedMenus).some((key) => prev[key] !== newExpandedMenus[key]);

      if (hasChanges) {
        return { ...prev, ...newExpandedMenus };
      }
      return prev;
    });
  }, [location.pathname, menuWithContextualItems, isItemActive, hasActiveChild]);

  // Clear navigation state on route change
  useEffect(() => {
    clearNavigationTimeout();
  }, [location.pathname, clearNavigationTimeout]);

  // Handle popover mouse events
  const handleMouseEnter = useCallback(
    (itemId: string, item: any, element: HTMLElement) => {
      if (isOpen) return; // Don't show popover when sidebar is expanded

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      const rect = element.getBoundingClientRect();
      setHoveredItemId(itemId);
      setPopoverPosition({
        top: rect.top,
        left: rect.right + 8,
        item,
      });

      // Small delay before showing animation
      setTimeout(() => {
        setIsPopoverAnimating(true);
      }, 50);
    },
    [isOpen],
  );

  const handleMouseLeave = useCallback(() => {
    // Set a timeout to hide the popover
    timeoutRef.current = window.setTimeout(() => {
      if (!mouseInPopover.current) {
        setIsPopoverAnimating(false);
        setTimeout(() => {
          setHoveredItemId(null);
          setPopoverPosition(null);
        }, 200);
      }
    }, 150);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  // MenuItem component
  const MenuItem = memo(({ item, level = 0 }: { item: any; level?: number }) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus[item.id] || false;
    const isActive = isItemActive(item);
    const hasActive = hasActiveChild(item);
    const isNavigating = navigatingItemId === item.id;

    const handleItemClick = (e: React.MouseEvent) => {
      e.preventDefault();

      // If we have a path
      if (item.path) {
        // Navigate if we're not on the exact same page
        if (!isActive) {
          navigationSourceRef.current = "menu";
          startNavigation(item.id, fixNavigationPath(item.path));
        }
        // If we're on the exact same page and have children, toggle submenu
        else if (hasChildren) {
          toggleSubmenu(item.id);
        }
        // If we're on the exact same page but no children, do nothing
      } else if (hasChildren) {
        // For items without paths (just containers), always toggle
        toggleSubmenu(item.id);
      }
    };

    const handleChevronClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSubmenu(item.id);
    };

    return (
      <div key={item.id} style={{ paddingLeft: level > 0 ? `${Math.min(level * 12, 36)}px` : "0" }}>
        <div
          className={cn(
            "group relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 min-h-[40px]",
            isNavigating && "bg-primary text-primary-foreground scale-[0.98]",
            !isNavigating && isActive && "bg-primary text-primary-foreground hover:bg-primary/90",
            !isNavigating && !isActive && (hasActive || isPathUnderItem(item)) && "bg-primary text-primary-foreground hover:bg-primary/90",
            !isNavigating && !isActive && !hasActive && !isPathUnderItem(item) && "hover:bg-muted/50",
          )}
          onClick={handleItemClick}
          onMouseEnter={(e) => handleMouseEnter(item.id, item, e.currentTarget)}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={cn("w-5 flex-shrink-0", !isOpen && "w-full flex justify-center")}>
              {isNavigating ? <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : getIconComponent(item.icon, 20)}
            </div>
            {isOpen && <span className="flex-1 text-sm font-medium truncate">{item.title}</span>}
          </div>

          {hasChildren && isOpen && (
            <div onClick={handleChevronClick} className="p-0.5 hover:bg-muted/50 rounded flex items-center justify-center">
              <IconChevronRight size={16} className={cn("transition-transform duration-200", isExpanded && "rotate-90")} />
            </div>
          )}
        </div>

        {hasChildren && isOpen && isExpanded && (
          <div className="mt-1 space-y-1">
            {item.children.map((child: any) => (
              <MenuItem item={child} level={level + 1} key={child.id || child.path} />
            ))}
          </div>
        )}
      </div>
    );
  });

  // Popover Portal
  const PopoverPortal = () => {
    if (!popoverPosition || isOpen) return null;

    const { item, top, left } = popoverPosition;
    const hasChildren = item.children && item.children.length > 0;

    return createPortal(
      <div
        style={{
          position: "fixed",
          top,
          left,
          zIndex: 9999,
          opacity: isPopoverAnimating ? 1 : 0,
          transform: isPopoverAnimating ? "translateX(0)" : "translateX(-8px)",
          transition: "opacity 200ms, transform 200ms",
        }}
        onMouseEnter={() => {
          mouseInPopover.current = true;
        }}
        onMouseLeave={() => {
          mouseInPopover.current = false;
          handleMouseLeave();
        }}
      >
        <div className={cn("bg-card border border-border rounded-lg shadow-lg p-2", hasChildren || item.id === "favorites" ? "min-w-[200px]" : "px-3 py-2")}>
          {item.id === "favorites" ? (
            <div className="space-y-1">
              <button
                onClick={() => {
                  startNavigation("favorites", routes.favorites);
                }}
                className={cn(
                  "w-full px-3 py-2 text-sm font-medium border-b border-border truncate flex items-center gap-2 rounded-md transition-colors",
                  location.pathname === routes.favorites ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                <IconStarFilled size={16} className="text-yellow-500" />
                <span>Favoritos</span>
              </button>
              {favorites.length > 0 && (
                <div className="space-y-1">
                  {favorites.map((fav: any) => (
                    <button
                      key={fav.id}
                      onClick={() => {
                        startNavigation(fav.id, fav.path, true);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                        location.pathname === fav.path ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                      )}
                    >
                      <div className="w-5">{renderFavoriteIcon(fav)}</div>
                      <span className="truncate">{fav.entityName ? `${fav.title} - ${fav.entityName}` : fav.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : hasChildren ? (
            <div className="space-y-1">
              <div className="px-3 py-2 text-sm font-medium border-b border-border truncate">{item.title}</div>
              {item.children.map((child: any) => (
                <button
                  key={child.id || child.path}
                  onClick={() => {
                    if (child.path) {
                      navigationSourceRef.current = "menu";
                      startNavigation(child.id, fixNavigationPath(child.path));
                    }
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                    isItemActive(child) ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  <div className="w-4">{getIconComponent(child.icon, 16)}</div>
                  <span className="truncate">{child.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm font-medium whitespace-nowrap truncate">{item.title}</div>
          )}
        </div>
      </div>,
      document.body,
    );
  };

  return (
    <>
      <aside className={cn("flex flex-col bg-card border-r border-border transition-all duration-300 relative", isOpen ? "w-64" : "w-16")}>
        {/* Header Section - User Profile & Theme Toggle */}
        <div className={cn("border-b relative h-16 flex items-center", isDark ? "border-neutral-800" : "border-neutral-200")}>
          {isOpen ? (
            /* Expanded State - User Card and Theme Toggle */
            <>
              {/* User Card - Clickable */}
              <div
                className={cn("flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors flex-1 min-w-0", "hover:bg-muted/50 transition-colors")}
                onClick={() => setShowUserMenu(!showUserMenu)}
                onMouseEnter={() => setHoveredItemId("user-menu")}
                onMouseLeave={() => setHoveredItemId(null)}
              >
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-lg">{user?.name?.charAt(0)?.toUpperCase() || "U"}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className={cn("font-semibold text-base truncate", isDark ? "text-neutral-100" : "text-neutral-900")}>{user?.name || "Usuário"}</div>
                  <div className={cn("text-sm opacity-70 truncate", isDark ? "text-neutral-400" : "text-neutral-500")}>
                    {user?.email && user?.phone ? user.email : user?.email || (user?.phone && maskPhone(user?.phone))}
                  </div>
                </div>
              </div>

              {/* Theme Toggle */}
              <div className="flex-shrink-0 px-2">
                <ThemeToggle />
              </div>
            </>
          ) : (
            /* Minimized State - User Icon Only */
            <div className="w-full flex items-center justify-center">
              <div
                className={cn(
                  "w-8 h-8 bg-primary rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 relative",
                  showUserMenu && "scale-110 shadow-lg",
                )}
                onClick={() => setShowUserMenu(!showUserMenu)}
                onMouseEnter={() => setHoveredItemId("user-menu")}
                onMouseLeave={() => setHoveredItemId(null)}
              >
                <span className="text-white font-bold text-lg">{user?.name?.charAt(0)?.toUpperCase() || "U"}</span>
              </div>
            </div>
          )}

          {/* User dropdown menu positioned based on sidebar state */}
          {showUserMenu && (
            <div
              className={cn(
                "absolute z-50 bg-card border border-border rounded-lg shadow-lg p-1 animate-in fade-in-0 zoom-in-95",
                isOpen ? "top-full left-3 right-3 mt-2" : "left-full top-0 ml-2 min-w-[200px]",
              )}
            >
              <button
                onClick={() => {
                  navigate(routes.personal.myProfile.root);
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
              >
                <IconSettings size={16} />
                <span>Configurações</span>
              </button>
              <button onClick={() => logout()} className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-destructive">
                <IconLogout size={16} />
                <span>Sair</span>
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="space-y-4 px-2">
            {/* Favorites Section */}
            {favorites.length > 0 && (
              <div className="space-y-1">
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                    location.pathname === routes.favorites ? "bg-primary text-primary-foreground" : "hover:bg-muted/50",
                    showFavorites && location.pathname !== routes.favorites && "bg-muted/30",
                  )}
                  onClick={() => navigate(routes.favorites)}
                  onMouseEnter={(e) => !isOpen && handleMouseEnter("favorites", { id: "favorites", title: "Favoritos", children: favorites }, e.currentTarget)}
                  onMouseLeave={handleMouseLeave}
                >
                  <div className={cn("w-5 flex-shrink-0", !isOpen && "w-full flex justify-center")}>
                    <IconStarFilled size={20} className="text-yellow-500" />
                  </div>
                  {isOpen && (
                    <>
                      <span className="flex-1 text-sm font-semibold">Favoritos</span>
                      {favorites.length > 0 && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowFavorites(!showFavorites);
                          }}
                          className="p-0.5 hover:bg-muted/50 rounded flex items-center justify-center"
                        >
                          <IconChevronRight size={16} className={cn("transition-transform duration-200", showFavorites && "rotate-90")} />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {showFavorites && isOpen && (
                  <div className="mt-1 space-y-1 pl-4">
                    {favorites.map((fav) => (
                      <div
                        key={fav.id}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm",
                          location.pathname === fav.path ? "bg-primary text-primary-foreground" : "hover:bg-muted/50",
                        )}
                        onClick={() => {
                          navigationSourceRef.current = "favorite";
                          navigate(fav.path);
                        }}
                      >
                        <div className="w-5 flex-shrink-0">{renderFavoriteIcon(fav)}</div>
                        <span className="flex-1 truncate">{fav.entityName ? `${fav.title} - ${fav.entityName}` : fav.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Divider if there are favorites */}
            {favorites.length > 0 && <div className="border-t border-border/50 my-2" />}

            {/* Regular Menu Items */}
            <div className="space-y-1">
              {menuWithContextualItems.map((item: any) => (
                <MenuItem item={item} key={item.id || item.path} />
              ))}
            </div>
          </div>
        </nav>
      </aside>

      <PopoverPortal />
    </>
  );
});

Sidebar.displayName = "Sidebar";
