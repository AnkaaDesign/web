import { useState, useEffect, useRef, useMemo, useCallback, memo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/contexts/sidebar-context";
import { useTheme } from "@/contexts/theme-context";
import { useFavorites } from "@/contexts/favorites-context";
import { MENU_ITEMS, routes } from "../../constants";
import type { MenuItem } from "../../constants";
import { getFilteredMenuForUser, getTablerIcon } from "../../utils";
import { useMyPendingQuestionnaireEntries } from "@/hooks/questionnaire/use-questionnaire-entry";
import { maskPhone, getPageIconName, isPageCadastrar } from "../../utils";
import { fixNavigationPath } from "@/utils/route-validation";
import { useAuth } from "@/contexts/auth-context";
import { IconLogout, IconUser, IconSettings, IconChevronRight, IconExternalLink } from "@tabler/icons-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PricingToggle } from "@/components/ui/pricing-toggle";
import { NotificationCenter } from "@/components/notification-center";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PositionedDropdownMenuContent } from "@/components/ui/positioned-dropdown-menu";
import { SidebarFlyout, useFlyoutController } from "./sidebar-flyout";
import { recordNavClick, clearNavContext, useRecordedNav, resolveActiveNav, computeExpandedFromActive } from "@/contexts/navigation-context";

import {
  IconDashboard,
  IconHome,
  IconBuilding,
  IconTool,
  IconPackage,
  IconPackages,
  IconBox,
  IconBuildingWarehouse,
  IconBuildingSkyscraper,
  IconBrush,
  IconPaint,
  IconPalette,
  IconColorPicker,
  IconColorSwatch,
  IconUsers,
  IconBriefcase,
  IconShield,
  IconUserCircle,
  IconUserCog,
  IconChartBar,
  IconChartLine,
  IconCalendar,
  IconCalendarEvent,
  IconCalendarStats,
  IconCalendarWeek,
  IconCalendarDollar,
  IconCalendarOff,
  IconPlus,
  IconEye,
  IconEdit,
  IconFileInvoice,
  IconFileDescription,
  IconClipboardList,
  IconFileText,
  IconFile,
  IconClock,
  IconPlayerPause,
  IconHistory,
  IconHourglass,
  IconFlask,
  IconRecycle,
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
  IconRefresh,
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
  IconArrowsExchange2,
  IconFileSpreadsheet,
  IconList,
  IconListDetails,
  IconArrowsUpDown,
  IconBolt,
  IconStar,
  IconStarFilled,
  IconFolderShare,
  IconDatabaseImport,
  IconFolders,
  IconTrendingUp,
  IconReceipt,
  IconCalculator,
  IconRocket,
  IconHelmet,
  IconFingerprint,
  IconSignature,
  IconDeviceIpadDollar,
  IconActivity,
  IconMessageCircle,
  IconServer,
  IconQrcode,
  IconTarget,
  IconCheck,
  IconUserCheck,
} from "@tabler/icons-react";

// Types for better type safety

// Simple icon mapping system
const iconComponents: Record<string, any> = {
  IconDashboard,
  IconHome,
  IconBuilding,
  IconTool,
  IconPackage,
  IconPackages,
  IconBox,
  IconBuildingWarehouse,
  IconBuildingSkyscraper,
  IconBrush,
  IconPaint,
  IconPalette,
  IconColorPicker,
  IconColorSwatch,
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
  IconCalendarStats,
  IconCalendarWeek,
  IconCalendarDollar,
  IconCalendarOff,
  IconPlus,
  IconEye,
  IconEdit,
  IconFileInvoice,
  IconFileDescription,
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
  IconRecycle,
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
  IconRefresh,
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
  IconArrowsExchange2,
  IconFileSpreadsheet,
  IconList,
  IconListDetails,
  IconArrowsUpDown,
  IconBolt,
  IconStar,
  IconStarFilled,
  IconFolderShare,
  IconDatabaseImport,
  IconFolders,
  IconTrendingUp,
  IconReceipt,
  IconCalculator,
  IconRocket,
  IconHelmet,
  IconFingerprint,
  IconSignature,
  IconDeviceIpadDollar,
  IconActivity,
  IconMessageCircle,
  IconServer,
  IconQrcode,
  IconTarget,
  IconCheck,
  IconUserCheck,
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
        <div className="absolute -top-1.5 -right-1.5 bg-white dark:bg-gray-200 rounded-full p-0.5">
          <IconPlus size={10} className="text-green-600 dark:text-green-700" strokeWidth={3} />
        </div>
      </div>
    );
  }

  return mainIcon;
};

export const Sidebar = memo(() => {
  const { isOpen } = useSidebar();
  const { user, logout } = useAuth();
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // State management
  const [expandedMenus, setExpandedMenus] = useState<{ [key: string]: boolean }>({});
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAvatarTooltip, setShowAvatarTooltip] = useState(false);
  const [navigatingItemId, setNavigatingItemId] = useState<string | null>(null);
  const [showFavorites, setShowFavorites] = useState(() => {
    const stored = localStorage.getItem("ankaa-sidebar-show-favorites");
    return stored !== null ? stored === "true" : true;
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: any } | null>(null);

  // Collapsed-sidebar cascading hover flyout (handles full menu hierarchy).
  const flyout = useFlyoutController();

  // Navigation context: the menu entry the user actually clicked (per-tab, survives
  // reload). Drives winner resolution + auto-expansion so pages shared by several
  // sections highlight/expand the section the user came from.
  const recordedNav = useRecordedNav();

  // Refs
  const navigationTimeoutRef = useRef<number | null>(null);
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
        // First, check if there's a static sibling route that matches exactly
        // This prevents dynamic routes like /mensagens/:id from matching /mensagens/criar
        // when "criar" is a known static route
        const knownStaticSegments = ["criar", "cadastrar", "editar", "detalhes", "editar-em-lote", "editar-lote"];

        // Extract the base path (everything before the first :param)
        const basePathMatch = itemPath.match(/^(.+?)\/:[^/]+/);
        if (basePathMatch) {
          const basePath = basePathMatch[1];
          // Check if current path starts with the base path
          if (currentPath.startsWith(basePath + "/")) {
            // Get the segment that would match the dynamic parameter
            const remainingPath = currentPath.slice(basePath.length + 1);
            const firstSegment = remainingPath.split("/")[0];

            // If the first segment is a known static route name, don't match this dynamic route
            if (knownStaticSegments.includes(firstSegment)) {
              return false;
            }
          }
        }

        const pathPattern = itemPath.replace(/:[^/]+/g, "[^/]+");
        const regex = new RegExp(`^${pathPattern}$`);
        return regex.test(currentPath);
      }

      // For static routes, only exact match
      return currentPath === itemPath;
    },
    [location.pathname],
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
        const currentFilteredMenu = getFilteredMenuForUser(MENU_ITEMS, user as any || undefined, "web");
        findAndCloseSiblings(currentFilteredMenu);
      }

      // Toggle the clicked item
      newExpanded[itemId] = !isCurrentlyExpanded;

      return newExpanded;
    });
  }, [user]);

  // Self-fill questionnaires nav entry should only appear when the user
  // actually has a pending entry to answer. While loading, default to "visible"
  // so a flash-of-empty doesn't hide it.
  const { data: pendingQuestionnaires } = useMyPendingQuestionnaireEntries(undefined, {
    enabled: !!user,
  } as any);
  const hasOpenQuestionnaire = useMemo(() => {
    if (!pendingQuestionnaires) return true; // unknown yet — keep visible
    return ((pendingQuestionnaires.data ?? []) as any[]).some((e) => e.status !== "SUBMITTED");
  }, [pendingQuestionnaires]);

  // Get filtered menu for current user
  const filteredMenu = useMemo(() => {
    const base = getFilteredMenuForUser(MENU_ITEMS, user as any || undefined, "web");
    if (hasOpenQuestionnaire) return base;
    // Recursively strip the questionnaires entry when nothing's pending.
    const stripQuestionnaires = (items: MenuItem[]): MenuItem[] =>
      items
        .filter((it) => it.id !== "meus-questionarios")
        .map((it) => (it.children ? { ...it, children: stripQuestionnaires(it.children) } : it));
    return stripQuestionnaires(base);
  }, [user, hasOpenQuestionnaire]);

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

          // Check if this is a contextual item (cadastrar, criar, editar, detalhes, testar)
          const isContextualItem = ["cadastrar", "criar", "editar", "detalhes", "testar"].some((action) => child.id?.includes(action) || child.path?.includes(`/${action}`));

          // For dynamic routes (with :id), check if we're on a specific instance
          if (child.isDynamic && child.path) {
            // Known static route segments that should NOT be treated as dynamic IDs
            const knownStaticSegments = ["criar", "cadastrar", "editar", "detalhes", "testar", "editar-em-lote", "editar-lote", "list", "novo"];

            // Extract base path and check if current path segment is a static route
            const basePathMatch = child.path.match(/^(.+?)\/:[^/]+/);
            if (basePathMatch) {
              const basePath = basePathMatch[1];
              if (currentPath.startsWith(basePath + "/")) {
                const remainingPath = currentPath.slice(basePath.length + 1);
                const firstSegment = remainingPath.split("/")[0];

                // If the segment is a known static route, don't show this dynamic item
                if (knownStaticSegments.includes(firstSegment)) {
                  if (isContextualItem) {
                    return null; // Hide this dynamic contextual item
                  }
                }
              }
            }

            const pathPattern = child.path.replace(/:[^/]+/g, "[^/]+");
            const regex = new RegExp(`^${pathPattern}$`);
            const shouldShow = regex.test(currentPath);

            if (!shouldShow && isContextualItem) {
              return null; // Hide this item
            }
          }

          // For cadastrar/criar, only show if we're on that exact page
          if ((child.id?.includes("cadastrar") || child.id?.includes("criar")) && child.path && !child.isDynamic) {
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
            // Special handling for catalogo (all variants)
            if (child.id === "catalogo" || child.id === "catalogo-commercial" || child.id === "catalogo-designer") {
              const paintId = formulaMatch?.[1];
              const formulaId = formulaMatch?.[2];

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
                  children: formulaMatch && formulaMatch[0].includes("/formulas")
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
              } else if (detalhesIndex !== -1 && !currentPath.includes("/pintura/catalogo/detalhes/")) {
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

  // Single-winner active highlight. For any URL, exactly ONE visible nav item gets the
  // full active style. Resolution lives in @/contexts/navigation-context: the recorded
  // nav click (when its subtree still matches the URL) takes priority, otherwise the
  // longest match across the whole visible tree wins (exact beats prefix, leaf beats
  // container, then tree order). Ancestors of the winner get a subtle context tint
  // instead — this kills the "double highlight" (e.g. ".../beneficios" lighting up
  // together with ".../beneficios/adesoes", or a section sharing its child's path)
  // AND the "wrong section highlighted" bug for paths shared between sections.
  const activeNav = useMemo(() => {
    const active = resolveActiveNav(menuWithContextualItems as MenuItem[], location.pathname, recordedNav);
    return { ...active, ancestorIds: new Set(active.trail.map((t) => t.id)) };
  }, [menuWithContextualItems, location.pathname, recordedNav]);

  // Active check used by the collapsed-sidebar flyout: nav items highlight only when
  // they ARE the single winner; non-nav rows (favorites) fall back to exact path match.
  const isFlyoutItemActive = useCallback(
    (it: any): boolean => {
      const id = it?.id || it?.path;
      if (id && activeNav.navIds.has(id)) return id === activeNav.id;
      return !!it?.path && it.path === location.pathname;
    },
    [activeNav, location.pathname],
  );

  // Save showFavorites state
  useEffect(() => {
    localStorage.setItem("ankaa-sidebar-show-favorites", showFavorites.toString());
  }, [showFavorites]);

  // Auto-expand menus based on the SINGLE active winner: exactly the winner's ancestor
  // chain is expanded and every unrelated section (at every level) is collapsed. This
  // replaces the old per-item path matching, which expanded EVERY section containing a
  // matching path (e.g. navigating to /administracao/colaboradores yanked open both
  // "Administração" and "Departamento Pessoal" for ADMIN).
  const lastExpandKeyRef = useRef<string | null>(null);
  useEffect(() => {
    // Check navigation source
    const navSource = navigationSourceRef.current;

    // Reset navigation source after checking
    navigationSourceRef.current = null;

    // Skip auto-expand only if navigating from favorite (user wants menu collapsed)
    if (navSource === "favorite") {
      return;
    }

    // No winner (e.g. /favoritos, /perfil): leave the expansion state untouched.
    if (!activeNav.id) {
      return;
    }

    // Re-apply only when the route/winner pair actually changed — menu identity churn
    // (e.g. contextual children appearing) must not fight manual chevron toggles.
    const key = `${location.pathname}|${activeNav.id}`;
    if (lastExpandKeyRef.current === key) {
      return;
    }
    lastExpandKeyRef.current = key;

    const newExpandedMenus = computeExpandedFromActive(menuWithContextualItems as MenuItem[], activeNav);

    setExpandedMenus((prev) => {
      const hasChanges = Object.keys(newExpandedMenus).some((k) => !!prev[k] !== newExpandedMenus[k]);
      return hasChanges ? newExpandedMenus : prev;
    });
  }, [location.pathname, menuWithContextualItems, activeNav]);

  // Clear navigation state on route change
  useEffect(() => {
    clearNavigationTimeout();
  }, [location.pathname, clearNavigationTimeout]);

  // Context menu positioning is now handled by PositionedDropdownMenuContent

  // Navigation + context-menu handlers shared with the collapsed flyout.
  const handleFlyoutNavigate = useCallback(
    (item: any, e: React.MouseEvent, opts?: { fromFavorite?: boolean }) => {
      if (!item?.path) return;
      const shouldOpenInNewTab = e.ctrlKey || e.metaKey || e.button === 1;
      if (shouldOpenInNewTab) {
        e.preventDefault();
        window.open(fixNavigationPath(item.path), "_blank");
        return;
      }
      navigationSourceRef.current = opts?.fromFavorite ? "favorite" : "menu";
      if (opts?.fromFavorite) {
        clearNavContext(); // favorites are section-less jumps
      } else {
        recordNavClick(item.id, item.path);
      }
      startNavigation(item.id || item.path, fixNavigationPath(item.path), !!opts?.fromFavorite);
      flyout.close();
    },
    [startNavigation, flyout],
  );

  const handleFlyoutContextMenu = useCallback((item: any, e: React.MouseEvent) => {
    if (!item?.path) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  }, []);

  // Cleanup navigation timeout on unmount (flyout timers self-clean).
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, []);

  // MenuItem component
  const MenuItem = ({ item, level = 0 }: { item: any; level?: number }) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus[item.id] || false;
    const isActive = isItemActive(item);
    const isNavigating = navigatingItemId === item.id;
    // Full active style only for the single winning item; the winner's ancestors get a
    // subtle context tint (parent expansion already signals hierarchy).
    const isHighlighted = (item.id || item.path) === activeNav.id;
    const isAncestorOfActive = !isHighlighted && activeNav.ancestorIds.has(item.id);

    const handleItemClick = (e: React.MouseEvent) => {
      // Check if Ctrl (or Cmd on Mac) is pressed or if it's a middle-click
      const shouldOpenInNewTab = e.ctrlKey || e.metaKey || e.button === 1;

      if (shouldOpenInNewTab && item.path) {
        e.preventDefault();
        window.open(fixNavigationPath(item.path), '_blank');
        return;
      }

      e.preventDefault();

      // When minimized: clicking opens the flyout immediately if the item is a
      // pure container; if it also has its own page, navigate there.
      if (!isOpen && hasChildren) {
        if (!item.path) {
          flyout.open(item, e.currentTarget as HTMLElement);
          return;
        }
        navigationSourceRef.current = "menu";
        recordNavClick(item.id, item.path);
        startNavigation(item.id, fixNavigationPath(item.path));
        flyout.close();
        return;
      }

      // If we have a path
      if (item.path) {
        // Record the clicked entry even when already on its page — clicking a section's
        // own entry re-anchors highlight/expansion to THAT section when several
        // sections share the same path.
        recordNavClick(item.id, item.path);
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

    const handleContextMenu = (e: React.MouseEvent) => {
      if (item.path) {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item });
      }
    };

    const handleChevronClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSubmenu(item.id);
    };

    return (
      <div key={item.id} style={{ paddingLeft: level > 0 ? `${Math.min(8 + level * 16, 56)}px` : "0" }}>
        <div
          className={cn(
            "group relative flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 min-h-[40px]",
            isNavigating && "bg-primary text-primary-foreground scale-[0.98]",
            // The active leaf AND its ancestor section both get the SAME full active style,
            // so the parent (e.g. "Financeiro") is highlighted exactly like the active page.
            !isNavigating && (isHighlighted || isAncestorOfActive) && "bg-primary text-primary-foreground hover:bg-primary/90",
            !isNavigating && !isHighlighted && !isAncestorOfActive && "hover:bg-muted/50",
          )}
          onClick={handleItemClick}
          onContextMenu={handleContextMenu}
          onMouseEnter={(e) => !isOpen && flyout.open(item, e.currentTarget)}
          onMouseLeave={() => !isOpen && flyout.scheduleClose()}
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
  };

  return (
    <>
      <aside className={cn("flex flex-col bg-card border-r border-border transition-all duration-300 relative", isOpen ? "w-72" : "w-16")}>
        {/* Header Section - User Profile & Theme Toggle */}
        <div className={cn(
          "border-b relative",
          isDark ? "border-neutral-800" : "border-neutral-200",
          isOpen ? "h-16 flex items-center" : "flex flex-col items-center",
        )}>
          {isOpen ? (
            /* Expanded State - User Card and Theme Toggle */
            <>
              {/* User Card - Clickable */}
              <div
                className={cn("flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors flex-1 min-w-0", "hover:bg-muted/50 transition-colors")}
                onClick={() => setShowUserMenu(!showUserMenu)}
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

              {/* Notification Center and Theme Toggle */}
              <div className="flex-shrink-0 flex items-center gap-1 px-2">
                <NotificationCenter />
                <ThemeToggle />
                <PricingToggle />
              </div>
            </>
          ) : (
            /* Minimized State - Avatar + Buttons */
            <div className="w-full flex flex-col items-center gap-1 py-2">
              {/* Avatar with hover info popup */}
              <div
                className="relative"
                onMouseEnter={() => setShowAvatarTooltip(true)}
                onMouseLeave={() => setShowAvatarTooltip(false)}
              >
                <div
                  className={cn(
                    "w-8 h-8 bg-primary rounded-full flex items-center justify-center cursor-pointer transition-all duration-200",
                    showUserMenu && "scale-110 shadow-sm",
                  )}
                  onClick={() => {
                    setShowAvatarTooltip(false);
                    setShowUserMenu(!showUserMenu);
                  }}
                >
                  <span className="text-white font-bold text-lg">{user?.name?.charAt(0)?.toUpperCase() || "U"}</span>
                </div>

                {/* Hover info popup */}
                {showAvatarTooltip && !showUserMenu && (
                  <div
                    className={cn(
                      "absolute left-full top-0 ml-3 z-50 bg-card border border-border rounded-lg shadow-md p-3 min-w-[200px] animate-in fade-in-0 slide-in-from-left-1",
                      isDark ? "border-neutral-700" : "border-neutral-200",
                    )}
                  >
                    <div className={cn("font-semibold text-sm truncate", isDark ? "text-neutral-100" : "text-neutral-900")}>
                      {user?.name || "Usuário"}
                    </div>
                    <div className={cn("text-xs mt-0.5 truncate", isDark ? "text-neutral-400" : "text-neutral-500")}>
                      {user?.email && user?.phone
                        ? user.email
                        : user?.email || (user?.phone && maskPhone(user?.phone))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons in collapsed mode */}
              <div className="flex flex-col items-center gap-0.5">
                <NotificationCenter />
                <ThemeToggle />
                <PricingToggle />
              </div>
            </div>
          )}

          {/* User dropdown menu positioned based on sidebar state */}
          {showUserMenu && (
            <>
              {/* Backdrop to close menu when clicking outside */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowUserMenu(false)}
              />
              <div
                className={cn(
                  "absolute z-50 bg-card border border-border rounded-lg shadow-sm p-1 animate-in fade-in-0 zoom-in-95",
                  isOpen ? "top-full left-3 right-3 mt-2" : "left-full top-0 ml-2 min-w-[200px]",
                )}
              >
              <button
                onClick={() => {
                  navigate("/perfil");
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
              >
                <IconUser size={16} />
                <span>Perfil</span>
              </button>
              <button
                onClick={() => {
                  navigate(routes.profileNotifications);
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
              >
                <IconSettings size={16} />
                <span>Notificações</span>
              </button>
              <button onClick={() => logout()} className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-destructive">
                <IconLogout size={16} />
                <span>Sair</span>
              </button>
            </div>
            </>
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
                  onClick={(e) => {
                    const shouldOpenInNewTab = e.ctrlKey || e.metaKey || e.button === 1;
                    if (shouldOpenInNewTab) {
                      e.preventDefault();
                      window.open(routes.favorites, '_blank');
                    } else {
                      navigate(routes.favorites);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, item: { path: routes.favorites, title: "Favoritos" } });
                  }}
                  onMouseEnter={(e) => !isOpen && flyout.open({ id: "favorites", title: "Favoritos", path: routes.favorites, children: favorites }, e.currentTarget, true)}
                  onMouseLeave={() => !isOpen && flyout.scheduleClose()}
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
                  <div className="mt-1 space-y-1 pl-6">
                    {favorites.map((fav) => (
                      <div
                        key={fav.id}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm",
                          location.pathname === fav.path ? "bg-primary text-primary-foreground" : "hover:bg-muted/50",
                        )}
                        onClick={(e) => {
                          const shouldOpenInNewTab = e.ctrlKey || e.metaKey || e.button === 1;
                          if (shouldOpenInNewTab) {
                            e.preventDefault();
                            window.open(fav.path, '_blank');
                          } else {
                            navigationSourceRef.current = "favorite";
                            clearNavContext(); // favorites are section-less jumps
                            navigate(fav.path);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({ x: e.clientX, y: e.clientY, item: fav });
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
            {favorites.length > 0 && <div className="border-t border-border my-2" />}

            {/* Regular Menu Items */}
            <div className="space-y-1">
              {menuWithContextualItems.map((item: any) => (
                <MenuItem item={item} key={item.id || item.path} />
              ))}
            </div>
          </div>
        </nav>
      </aside>

      {flyout.state && !isOpen && (
        <SidebarFlyout
          state={flyout.state}
          isItemActive={isFlyoutItemActive}
          getIcon={getIconComponent}
          renderFavoriteIcon={renderFavoriteIcon}
          onNavigate={handleFlyoutNavigate}
          onContextMenu={handleFlyoutContextMenu}
          cancelClose={flyout.cancelClose}
          scheduleClose={flyout.scheduleClose}
        />
      )}

      {/* Navigation Context Menu */}
      <DropdownMenu open={!!contextMenu} onOpenChange={(open) => !open && setContextMenu(null)}>
        <PositionedDropdownMenuContent
          position={contextMenu}
          isOpen={!!contextMenu}
          className="w-56"
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          {contextMenu?.item && (
            <>
              <DropdownMenuItem
                onClick={() => {
                  window.open(fixNavigationPath(contextMenu.item.path), '_blank');
                  setContextMenu(null);
                }}
              >
                <IconExternalLink className="mr-2 h-4 w-4" />
                Abrir em nova aba
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => {
                  toggleFavorite({
                    path: contextMenu.item.path,
                    title: contextMenu.item.title,
                    icon: contextMenu.item.icon,
                  });
                  setContextMenu(null);
                }}
              >
                <IconStarFilled
                  className={cn("mr-2 h-4 w-4", isFavorite(contextMenu.item.path) ? "text-yellow-500" : "text-muted-foreground")}
                />
                {isFavorite(contextMenu.item.path) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              </DropdownMenuItem>
            </>
          )}
        </PositionedDropdownMenuContent>
      </DropdownMenu>
    </>
  );
});

Sidebar.displayName = "Sidebar";
