// packages/utils/src/navigation.ts
// Navigation utility functions moved from constants package

import { SECTOR_PRIVILEGES, TABLER_ICONS } from "../constants";
import type { MenuItem } from "../constants";

// Define minimal user interface for navigation
interface NavigationUser {
  sector?: {
    privileges?: SECTOR_PRIVILEGES;
  };
  position?: {
    sector?: {
      privileges?: SECTOR_PRIVILEGES;
    };
  };
  managedSector?: {
    id?: string;
  } | null;
}

/**
 * Get filtered menu for a specific user and platform
 */
export function getFilteredMenuForUser(menuItems: MenuItem[], user: NavigationUser | undefined, platform: "web" | "mobile"): MenuItem[] {
  let filteredMenu = filterMenuByPlatform(menuItems, platform);

  // Apply environment filtering (staging vs production)
  filteredMenu = filterMenuByEnvironment(filteredMenu);

  // Apply privilege and team leader filtering
  const userPrivilege = user?.sector?.privileges || user?.position?.sector?.privileges;
  const isTeamLeader = Boolean(user?.managedSector?.id);

  filteredMenu = filterMenuByPrivilegesAndTeamLeader(filteredMenu, userPrivilege as SECTOR_PRIVILEGES | undefined, isTeamLeader);

  return filteredMenu;
}

/**
 * Get Tabler icon name for a given icon key
 */
export function getTablerIcon(iconKey: string): string {
  const icon = TABLER_ICONS[iconKey as keyof typeof TABLER_ICONS];
  if (!icon) return iconKey; // Return original if not found
  return icon;
}

/**
 * Backward compatibility function - maps to getTablerIcon
 * @deprecated Use getTablerIcon instead
 */
export function getIconoirIcon(iconKey: string): string {
  return getTablerIcon(iconKey);
}

/**
 * Check if user has access to menu item based on privilege requirements and team leader status
 * Uses exact matching for navigation (not hierarchical)
 * TEAM_LEADER is a virtual privilege - checked via user.managedSector relationship
 */
function hasMenuItemAccess(item: MenuItem, userPrivilege?: SECTOR_PRIVILEGES, isTeamLeader: boolean = false): boolean {
  // If no privilege required, show to all
  if (!item.requiredPrivilege) return true;

  // Handle array of privileges (OR logic)
  if (Array.isArray(item.requiredPrivilege)) {
    // Check if TEAM_LEADER is in the required privileges and user is a team leader
    if (item.requiredPrivilege.includes(SECTOR_PRIVILEGES.TEAM_LEADER) && isTeamLeader) {
      return true;
    }

    // If user has no privilege, hide privileged items (unless they're a team leader and that's allowed)
    if (!userPrivilege) return false;

    // User needs to have EXACTLY one of the specified privileges for menu display
    // Filter out TEAM_LEADER since it's handled above via isTeamLeader check
    const regularPrivileges = item.requiredPrivilege.filter(p => p !== SECTOR_PRIVILEGES.TEAM_LEADER);
    return regularPrivileges.includes(userPrivilege);
  }

  // Handle single privilege
  // Check if the required privilege is TEAM_LEADER
  if (item.requiredPrivilege === SECTOR_PRIVILEGES.TEAM_LEADER) {
    return isTeamLeader;
  }

  // If user has no privilege, hide privileged items
  if (!userPrivilege) return false;

  // Exact match for menu display
  return userPrivilege === item.requiredPrivilege;
}

/**
 * Filter menu items based on user privileges and team leader status
 * Now supports both single privileges and arrays of privileges
 */
export function filterMenuByPrivilegesAndTeamLeader(menuItems: MenuItem[], userPrivilege?: SECTOR_PRIVILEGES, isTeamLeader: boolean = false): MenuItem[] {
  return menuItems
    .filter((item) => hasMenuItemAccess(item, userPrivilege, isTeamLeader))
    .map((item) => {
      // Recursively filter children
      if (item.children) {
        return {
          ...item,
          children: filterMenuByPrivilegesAndTeamLeader(item.children, userPrivilege, isTeamLeader),
        };
      }
      return item;
    })
    .filter((item) => {
      // Remove items with no children after filtering
      if (item.children && item.children.length === 0) return false;
      return true;
    });
}

/**
 * Filter menu items based on user privileges
 * Now supports both single privileges and arrays of privileges
 * @deprecated Use filterMenuByPrivilegesAndTeamLeader instead
 */
export function filterMenuByPrivileges(menuItems: MenuItem[], userPrivilege?: SECTOR_PRIVILEGES): MenuItem[] {
  return filterMenuByPrivilegesAndTeamLeader(menuItems, userPrivilege, false);
}

/**
 * Filter menu items by platform
 * Note: MenuItem interface doesn't have platforms field anymore, but keeping for backward compatibility
 */
export function filterMenuByPlatform(menuItems: MenuItem[], platform: "web" | "mobile"): MenuItem[] {
  return menuItems
    .filter(() => {
      // Since platforms field was removed, show all items on all platforms
      return true;
    })
    .map((item) => {
      // Recursively filter children
      if (item.children) {
        return {
          ...item,
          children: filterMenuByPlatform(item.children, platform),
        };
      }
      return item;
    });
}

/**
 * Filter menu items by environment (staging vs production)
 */
export function filterMenuByEnvironment(menuItems: MenuItem[]): MenuItem[] {
  // Check if we're in staging environment by looking at the API URL
  const apiUrl = import.meta.env.VITE_API_URL || '';
  const isStagingEnvironment = apiUrl.includes('staging.api');

  return menuItems
    .filter((item) => {
      // If item is only for staging, filter it out in production
      if (item.onlyInStaging && !isStagingEnvironment) {
        return false;
      }
      return true;
    })
    .map((item) => {
      // Recursively filter children
      if (item.children) {
        return {
          ...item,
          children: filterMenuByEnvironment(item.children),
        };
      }
      return item;
    })
    .filter((item) => {
      // Remove items with no children after filtering
      if (item.children && item.children.length === 0) return false;
      return true;
    });
}

/**
 * Get control panel items (dashboards for each domain)
 */
export function getControlPanelItems(menuItems: MenuItem[]): MenuItem[] {
  const controlPanels: MenuItem[] = [];

  function extractControlPanels(items: MenuItem[]) {
    items.forEach((item) => {
      if (item.isControlPanel) {
        controlPanels.push(item);
      }
      if (item.children) {
        extractControlPanels(item.children);
      }
    });
  }

  extractControlPanels(menuItems);
  return controlPanels;
}

/**
 * Get flattened list of all routes
 */
export function getAllRoutes(menuItems: MenuItem[]): string[] {
  const routes: string[] = [];

  function extractRoutes(items: MenuItem[]) {
    items.forEach((item) => {
      if (item.path && !item.isDynamic) {
        routes.push(item.path);
      }
      if (item.children) {
        extractRoutes(item.children);
      }
    });
  }

  extractRoutes(menuItems);
  return routes;
}

/**
 * Find menu item by path
 */
export function findMenuItemByPath(menuItems: MenuItem[], path: string): MenuItem | null {
  for (const item of menuItems) {
    if (item.path === path) return item;

    if (item.children) {
      const found = findMenuItemByPath(item.children, path);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Get breadcrumb items for a given path
 */
export function getBreadcrumbs(menuItems: MenuItem[], path: string): MenuItem[] {
  const breadcrumbs: MenuItem[] = [];

  function matchPath(menuPath: string, actualPath: string): boolean {
    // Exact match
    if (menuPath === actualPath) return true;

    // Dynamic route match
    if (menuPath.includes(":")) {
      // Convert route pattern to regex
      // /estoque/produtos/detalhes/:id -> /estoque/produtos/detalhes/[^/]+
      const pattern = menuPath.replace(/:[^/]+/g, "[^/]+");
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(actualPath);
    }

    return false;
  }

  function findPath(items: MenuItem[], currentPath: MenuItem[] = []): boolean {
    for (const item of items) {
      const newPath = [...currentPath, item];

      if (item.path && matchPath(item.path, path)) {
        breadcrumbs.push(...newPath);
        return true;
      }

      if (item.children) {
        if (findPath(item.children, newPath)) {
          return true;
        }
      }
    }
    return false;
  }

  findPath(menuItems);
  return breadcrumbs;
}

/**
 * Get menu items for a specific domain
 */
export function getMenuItemsByDomain(menuItems: MenuItem[], domain: string): MenuItem | undefined {
  return menuItems.find((item) => item.id === domain);
}

/**
 * Check if user has access to a specific menu item
 * Uses exact matching for navigation (not hierarchical)
 */
export function hasAccessToMenuItem(item: MenuItem, userPrivilege?: SECTOR_PRIVILEGES, isTeamLeader: boolean = false): boolean {
  // Check team leader requirement first
  if (item.requiresTeamLeader) {
    return isTeamLeader;
  }

  if (!item.requiredPrivilege) return true;
  if (!userPrivilege) return false;

  // Handle array of privileges
  if (Array.isArray(item.requiredPrivilege)) {
    // OR logic - user needs to have EXACTLY one of the specified privileges
    return item.requiredPrivilege.includes(userPrivilege);
  }

  // Handle single privilege - exact match only
  return userPrivilege === item.requiredPrivilege;
}
