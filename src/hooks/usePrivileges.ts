import { useCurrentUser } from "./useAuth";
import { SECTOR_PRIVILEGES } from "../constants";
import { canAccessAnyPrivilege, canAccessAllPrivileges, canAccessSector, getSectorPrivilegeLevel, hasPrivilege, hasAnyPrivilege, hasAllPrivileges } from "../utils";

/**
 * Unified privilege validation hook for both web and mobile applications
 * Provides comprehensive privilege checking capabilities
 */
export function usePrivileges() {
  const { data: user } = useCurrentUser();

  /**
   * Check if user has specific privilege (hierarchical)
   */
  const hasPrivilegeAccess = (privilege: SECTOR_PRIVILEGES): boolean => {
    if (!user) return false;
    return hasPrivilege(user, privilege);
  };

  /**
   * Check if user has ANY of the specified privileges (OR logic)
   * Matches backend @Roles decorator behavior
   */
  const hasAnyPrivilegeAccess = (privileges: SECTOR_PRIVILEGES[]): boolean => {
    if (!user || !privileges.length) return false;
    return hasAnyPrivilege(user, privileges);
  };

  /**
   * Check if user has ALL of the specified privileges (AND logic)
   */
  const hasAllPrivilegeAccess = (privileges: SECTOR_PRIVILEGES[]): boolean => {
    if (!user || !privileges.length) return false;
    return hasAllPrivileges(user, privileges);
  };

  /**
   * Flexible privilege checking function
   * Supports both single privileges and arrays with configurable logic
   */
  const canAccess = (privilege: SECTOR_PRIVILEGES | SECTOR_PRIVILEGES[], requireAll: boolean = false): boolean => {
    if (!user) return false;

    if (Array.isArray(privilege)) {
      return requireAll ? hasAllPrivilegeAccess(privilege) : hasAnyPrivilegeAccess(privilege);
    }

    return hasPrivilegeAccess(privilege);
  };

  /**
   * Check if user can access based on direct privilege comparison (non-hierarchical)
   */
  const canAccessExact = (privilege: SECTOR_PRIVILEGES | SECTOR_PRIVILEGES[], requireAll: boolean = false): boolean => {
    if (!user?.sector?.privileges) return false;

    if (Array.isArray(privilege)) {
      return requireAll ? canAccessAllPrivileges(user.sector.privileges, privilege) : canAccessAnyPrivilege(user.sector.privileges, privilege);
    }

    return canAccessSector(user.sector.privileges, privilege);
  };

  /**
   * Common privilege shortcuts
   */
  const isAdmin = user ? hasPrivilegeAccess(SECTOR_PRIVILEGES.ADMIN) : false;
  const isLeader = user ? hasPrivilegeAccess(SECTOR_PRIVILEGES.LEADER) : false;
  const isHR = user ? hasPrivilegeAccess(SECTOR_PRIVILEGES.HUMAN_RESOURCES) : false;
  const isWarehouse = user ? hasPrivilegeAccess(SECTOR_PRIVILEGES.WAREHOUSE) : false;
  const isProduction = user ? hasPrivilegeAccess(SECTOR_PRIVILEGES.PRODUCTION) : false;
  const isMaintenance = user ? hasPrivilegeAccess(SECTOR_PRIVILEGES.MAINTENANCE) : false;
  const isBasic = user ? !user.sector || user.sector.privileges === SECTOR_PRIVILEGES.BASIC : false;

  /**
   * Backend controller pattern shortcuts
   * Common privilege combinations used in the backend
   */
  const canManageWarehouse = canAccess([SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]);

  const canManageMaintenance = canAccess([SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.MAINTENANCE, SECTOR_PRIVILEGES.ADMIN]);

  const canManageProduction = canAccess([SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.LEADER, SECTOR_PRIVILEGES.ADMIN]);

  const canManageHR = canAccess([SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]);

  const canManageEPI = canAccess([SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.LEADER, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]);

  const canCreateTasks = canAccess([SECTOR_PRIVILEGES.ADMIN]); // Only ADMIN can create tasks

  const canViewStatistics = canAccess([SECTOR_PRIVILEGES.LEADER, SECTOR_PRIVILEGES.ADMIN]);

  /**
   * User information
   */
  const userInfo = {
    user,
    isAuthenticated: !!user,
    currentPrivilege: user?.sector?.privileges || null,
    sectorName: user?.sector?.name || null,
    userName: user?.name || null,
  };

  /**
   * Debugging helpers (development only)
   */
  const debug = {
    logPrivileges: () => {
      if (process.env.NODE_ENV === "development") {
        console.log("🔐 User Privileges Debug:", {
          user: user?.name,
          sector: user?.sector?.name,
          privilege: user?.sector?.privileges,
          isAdmin,
          isLeader,
          isHR,
          isWarehouse,
          isProduction,
          isMaintenance,
        });
      }
    },
    checkAccess: (privilege: SECTOR_PRIVILEGES | SECTOR_PRIVILEGES[]) => {
      const access = canAccess(privilege);
      if (process.env.NODE_ENV === "development") {
        console.log(`🔍 Access Check: ${JSON.stringify(privilege)} = ${access}`);
      }
      return access;
    },
  };

  return {
    // Core privilege checking functions
    hasPrivilegeAccess,
    hasAnyPrivilegeAccess,
    hasAllPrivilegeAccess,
    canAccess,
    canAccessExact,

    // Common shortcuts
    isAdmin,
    isLeader,
    isHR,
    isWarehouse,
    isProduction,
    isMaintenance,
    isBasic,

    // Backend pattern shortcuts
    canManageWarehouse,
    canManageMaintenance,
    canManageProduction,
    canManageHR,
    canManageEPI,
    canCreateTasks,
    canViewStatistics,

    // User information
    ...userInfo,

    // Development helpers
    debug,
  };
}

/**
 * Privilege checking utilities for use outside React components
 * These are pure functions that don't use hooks
 */
export const privilegeUtils = {
  /**
   * Check user privileges without hooks (for use in utilities, configs, etc.)
   */
  checkUserPrivilege: (user: any, privilege: SECTOR_PRIVILEGES | SECTOR_PRIVILEGES[], requireAll: boolean = false): boolean => {
    if (!user) return false;

    if (Array.isArray(privilege)) {
      return requireAll ? hasAllPrivileges(user, privilege) : hasAnyPrivilege(user, privilege);
    }

    return hasPrivilege(user, privilege);
  },

  /**
   * Get privilege level number for sorting/comparison
   */
  getPrivilegeLevel: getSectorPrivilegeLevel,

  /**
   * Common privilege combinations for easy reference
   */
  combinations: {
    WAREHOUSE_OPERATIONS: [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN],
    MAINTENANCE_OPERATIONS: [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.MAINTENANCE, SECTOR_PRIVILEGES.ADMIN],
    PRODUCTION_MANAGEMENT: [SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.LEADER, SECTOR_PRIVILEGES.ADMIN],
    HR_MANAGEMENT: [SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN],
    PPE_MANAGEMENT: [SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.LEADER, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN],
    STATISTICS_ACCESS: [SECTOR_PRIVILEGES.LEADER, SECTOR_PRIVILEGES.ADMIN],
    TASK_CREATION: [SECTOR_PRIVILEGES.ADMIN], // Only ADMIN can create tasks
  } as const,
};

export default usePrivileges;
