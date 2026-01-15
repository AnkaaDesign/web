import { SECTOR_PRIVILEGES, SERVICE_ORDER_TYPE, SERVICE_ORDER_STATUS } from "@/constants";

/**
 * Service Order Permission Utility
 *
 * Defines visibility and edit permissions for service order columns based on sector privileges.
 *
 * Permission Matrix (VISIBILITY):
 * | Sector          | PRODUCTION | FINANCIAL  | COMMERCIAL | LOGISTIC   | ARTWORK    |
 * |-----------------|------------|------------|------------|------------|------------|
 * | ADMIN           | view+edit  | view+edit  | view+edit  | view+edit  | view+edit  |
 * | COMMERCIAL      | view only  | view only  | view+edit* | view only  | view only  |
 * | DESIGNER        | view only  | -          | -          | -          | view+edit* |
 * | FINANCIAL       | view only  | view+edit* | -          | -          | -          |
 * | LOGISTIC        | view+edit  | -          | view only  | view+edit* | view only  |
 * | PRODUCTION      | view+edit  | -          | -          | -          | -          |
 * | WAREHOUSE       | view only  | -          | -          | -          | -          |
 * | HUMAN_RESOURCES | view only  | -          | -          | -          | -          |
 * | Others          | view only  | -          | -          | -          | -          |
 *
 * * = edit only own/unassigned service orders
 *
 * Visibility Rules:
 * - PRODUCTION: Visible to ALL sectors, Editable by Admin/Logistic/Production only
 * - FINANCIAL: Visible to Admin/Commercial/Financial only
 * - COMMERCIAL: Visible to Admin/Commercial/Logistic only, Editable by Admin/Commercial only
 * - LOGISTIC: Visible to Admin/Logistic/Commercial only, Editable by Admin/Logistic only
 * - ARTWORK: Visible to Admin/Designer/Logistic/Commercial only, Editable by Admin/Designer only
 */

export interface ServiceOrderPermissions {
  canView: boolean;
  canEdit: boolean;
  /** Can only edit if no assignment or assigned to current user */
  editOnlyOwnOrUnassigned: boolean;
}

/**
 * Get service order column visibility for a given sector privilege
 */
export function getVisibleServiceOrderTypes(sectorPrivilege: SECTOR_PRIVILEGES | undefined): SERVICE_ORDER_TYPE[] {
  if (!sectorPrivilege) return [];

  switch (sectorPrivilege) {
    case SECTOR_PRIVILEGES.ADMIN:
      // Admin sees all columns
      return [
        SERVICE_ORDER_TYPE.PRODUCTION,
        SERVICE_ORDER_TYPE.FINANCIAL,
        SERVICE_ORDER_TYPE.COMMERCIAL,
        SERVICE_ORDER_TYPE.LOGISTIC,
        SERVICE_ORDER_TYPE.ARTWORK,
      ];

    case SECTOR_PRIVILEGES.COMMERCIAL:
      // Commercial sees: ALL service orders (production, financial, commercial, logistic, artwork)
      return [
        SERVICE_ORDER_TYPE.PRODUCTION,
        SERVICE_ORDER_TYPE.FINANCIAL,
        SERVICE_ORDER_TYPE.COMMERCIAL,
        SERVICE_ORDER_TYPE.LOGISTIC,
        SERVICE_ORDER_TYPE.ARTWORK,
      ];

    case SECTOR_PRIVILEGES.DESIGNER:
      // Designer sees: production, artwork
      return [
        SERVICE_ORDER_TYPE.PRODUCTION,
        SERVICE_ORDER_TYPE.ARTWORK,
      ];

    case SECTOR_PRIVILEGES.FINANCIAL:
      // Financial sees: production, financial
      return [
        SERVICE_ORDER_TYPE.PRODUCTION,
        SERVICE_ORDER_TYPE.FINANCIAL,
      ];

    case SECTOR_PRIVILEGES.LOGISTIC:
      // Logistic sees: production, logistic, commercial, artwork
      return [
        SERVICE_ORDER_TYPE.PRODUCTION,
        SERVICE_ORDER_TYPE.LOGISTIC,
        SERVICE_ORDER_TYPE.COMMERCIAL,
        SERVICE_ORDER_TYPE.ARTWORK,
      ];

    case SECTOR_PRIVILEGES.HUMAN_RESOURCES:
    case SECTOR_PRIVILEGES.PRODUCTION:
    case SECTOR_PRIVILEGES.WAREHOUSE:
    case SECTOR_PRIVILEGES.BASIC:
    case SECTOR_PRIVILEGES.EXTERNAL:
    case SECTOR_PRIVILEGES.MAINTENANCE:
    default:
      // All other sectors see only production
      return [SERVICE_ORDER_TYPE.PRODUCTION];
  }
}

/**
 * Check if a sector can view a specific service order type column
 */
export function canViewServiceOrderType(
  sectorPrivilege: SECTOR_PRIVILEGES | undefined,
  serviceOrderType: SERVICE_ORDER_TYPE
): boolean {
  const visibleTypes = getVisibleServiceOrderTypes(sectorPrivilege);
  return visibleTypes.includes(serviceOrderType);
}

/**
 * Check if user can edit service orders of a specific type
 *
 * Edit Permission Matrix:
 * | Sector          | PRODUCTION | FINANCIAL | COMMERCIAL | LOGISTIC | ARTWORK |
 * |-----------------|------------|-----------|------------|----------|---------|
 * | ADMIN           | ✓          | ✓         | ✓          | ✓        | ✓       |
 * | COMMERCIAL      | -          | -         | ✓          | -        | -       |
 * | DESIGNER        | -          | -         | -          | -        | ✓       |
 * | FINANCIAL       | -          | ✓         | -          | -        | -       |
 * | LOGISTIC        | ✓          | -         | -          | ✓        | -       |
 * | PRODUCTION      | ✓          | -         | -          | -        | -       |
 * | Others          | -          | -         | -          | -        | -       |
 */
export function canEditServiceOrderOfType(
  sectorPrivilege: SECTOR_PRIVILEGES | undefined,
  serviceOrderType: SERVICE_ORDER_TYPE
): boolean {
  if (!sectorPrivilege) return false;

  // ADMIN can edit all types
  if (sectorPrivilege === SECTOR_PRIVILEGES.ADMIN) return true;

  // Type-specific edit permissions
  switch (serviceOrderType) {
    case SERVICE_ORDER_TYPE.PRODUCTION:
      // LOGISTIC and PRODUCTION can edit production service orders
      return sectorPrivilege === SECTOR_PRIVILEGES.LOGISTIC ||
             sectorPrivilege === SECTOR_PRIVILEGES.PRODUCTION;

    case SERVICE_ORDER_TYPE.FINANCIAL:
      // Only FINANCIAL can edit financial service orders
      return sectorPrivilege === SECTOR_PRIVILEGES.FINANCIAL;

    case SERVICE_ORDER_TYPE.COMMERCIAL:
      // Only COMMERCIAL can edit commercial service orders
      return sectorPrivilege === SECTOR_PRIVILEGES.COMMERCIAL;

    case SERVICE_ORDER_TYPE.LOGISTIC:
      // Only LOGISTIC can edit logistic service orders
      return sectorPrivilege === SECTOR_PRIVILEGES.LOGISTIC;

    case SERVICE_ORDER_TYPE.ARTWORK:
      // Only DESIGNER can edit artwork service orders
      return sectorPrivilege === SECTOR_PRIVILEGES.DESIGNER;

    default:
      return false;
  }
}

/**
 * Check if user can cancel any service order
 * Only ADMIN can cancel service orders
 * IMPORTANT: CANCELLED status should only be visible/selectable by ADMIN
 */
export function canCancelServiceOrder(sectorPrivilege: SECTOR_PRIVILEGES | undefined): boolean {
  if (!sectorPrivilege) return false;
  return sectorPrivilege === SECTOR_PRIVILEGES.ADMIN;
}

/**
 * Check if user can mark ARTWORK service orders as COMPLETED
 * Only ADMIN can complete artwork service orders
 * Designers can only mark them as WAITING_APPROVE
 */
export function canCompleteArtworkServiceOrder(sectorPrivilege: SECTOR_PRIVILEGES | undefined): boolean {
  if (!sectorPrivilege) return false;
  return sectorPrivilege === SECTOR_PRIVILEGES.ADMIN;
}

/**
 * Get allowed status transitions for a user editing a specific service order
 * Returns array of statuses the user is allowed to set
 *
 * Status availability by service order type:
 * - ARTWORK: PENDING, IN_PROGRESS, WAITING_APPROVE, COMPLETED (approval workflow)
 * - PRODUCTION, FINANCIAL, COMMERCIAL, LOGISTIC: PENDING, IN_PROGRESS, COMPLETED (simple workflow)
 *
 * IMPORTANT:
 * - Only ADMIN can see/set CANCELLED status
 * - WAITING_APPROVE is ONLY for ARTWORK (designer → admin approval workflow)
 * - DESIGNER can only set WAITING_APPROVE, not COMPLETED (admin approves)
 */
export function getAllowedServiceOrderStatuses(
  sectorPrivilege: SECTOR_PRIVILEGES | undefined,
  serviceOrderType: SERVICE_ORDER_TYPE
): SERVICE_ORDER_STATUS[] {
  if (!sectorPrivilege) return [];

  // Check if user can edit this type at all
  if (!canEditServiceOrderOfType(sectorPrivilege, serviceOrderType)) return [];

  const isAdmin = sectorPrivilege === SECTOR_PRIVILEGES.ADMIN;

  // ARTWORK has special approval workflow with WAITING_APPROVE status
  if (serviceOrderType === SERVICE_ORDER_TYPE.ARTWORK) {
    const artworkStatuses: SERVICE_ORDER_STATUS[] = [
      SERVICE_ORDER_STATUS.PENDING,
      SERVICE_ORDER_STATUS.IN_PROGRESS,
      SERVICE_ORDER_STATUS.WAITING_APPROVE,
      SERVICE_ORDER_STATUS.COMPLETED,
    ];

    // ADMIN can set any status including CANCELLED
    if (isAdmin) {
      return [...artworkStatuses, SERVICE_ORDER_STATUS.CANCELLED];
    }

    // DESIGNER cannot set COMPLETED (only WAITING_APPROVE for admin approval)
    if (sectorPrivilege === SECTOR_PRIVILEGES.DESIGNER) {
      return artworkStatuses.filter(s => s !== SERVICE_ORDER_STATUS.COMPLETED);
    }

    return artworkStatuses;
  }

  // PRODUCTION, FINANCIAL, COMMERCIAL, LOGISTIC: Simple workflow without WAITING_APPROVE
  const simpleStatuses: SERVICE_ORDER_STATUS[] = [
    SERVICE_ORDER_STATUS.PENDING,
    SERVICE_ORDER_STATUS.IN_PROGRESS,
    SERVICE_ORDER_STATUS.COMPLETED,
  ];

  // ADMIN can set any status including CANCELLED
  if (isAdmin) {
    return [...simpleStatuses, SERVICE_ORDER_STATUS.CANCELLED];
  }

  return simpleStatuses;
}

/**
 * Get full permissions for a specific service order type and sector
 */
export function getServiceOrderPermissions(
  sectorPrivilege: SECTOR_PRIVILEGES | undefined,
  serviceOrderType: SERVICE_ORDER_TYPE
): ServiceOrderPermissions {
  if (!sectorPrivilege) {
    return { canView: false, canEdit: false, editOnlyOwnOrUnassigned: false };
  }

  // Admin has full access to everything
  if (sectorPrivilege === SECTOR_PRIVILEGES.ADMIN) {
    return { canView: true, canEdit: true, editOnlyOwnOrUnassigned: false };
  }

  switch (serviceOrderType) {
    case SERVICE_ORDER_TYPE.PRODUCTION:
      // Production visible to ALL, but editable only by Admin, Logistic, and Production
      const canEditProduction =
        sectorPrivilege === SECTOR_PRIVILEGES.LOGISTIC ||
        sectorPrivilege === SECTOR_PRIVILEGES.PRODUCTION;

      return {
        canView: true,
        canEdit: canEditProduction,
        editOnlyOwnOrUnassigned: false
      };

    case SERVICE_ORDER_TYPE.FINANCIAL:
      // Visible to: Admin, Commercial, Financial
      // Editable by: Admin, Financial only
      if (sectorPrivilege === SECTOR_PRIVILEGES.COMMERCIAL) {
        // Commercial can view but not edit financial
        return { canView: true, canEdit: false, editOnlyOwnOrUnassigned: false };
      }
      if (sectorPrivilege === SECTOR_PRIVILEGES.FINANCIAL) {
        return { canView: true, canEdit: true, editOnlyOwnOrUnassigned: true };
      }
      // Not visible to other sectors
      return { canView: false, canEdit: false, editOnlyOwnOrUnassigned: false };

    case SERVICE_ORDER_TYPE.COMMERCIAL:
      // Visible to: Admin, Commercial, Logistic
      // Editable by: Admin, Commercial only
      if (sectorPrivilege === SECTOR_PRIVILEGES.COMMERCIAL) {
        return { canView: true, canEdit: true, editOnlyOwnOrUnassigned: true };
      }
      if (sectorPrivilege === SECTOR_PRIVILEGES.LOGISTIC) {
        // Logistic can view but not edit commercial service orders
        return { canView: true, canEdit: false, editOnlyOwnOrUnassigned: false };
      }
      // Not visible to other sectors
      return { canView: false, canEdit: false, editOnlyOwnOrUnassigned: false };

    case SERVICE_ORDER_TYPE.LOGISTIC:
      // Visible to: Admin, Logistic, Commercial
      // Editable by: Admin, Logistic only
      if (sectorPrivilege === SECTOR_PRIVILEGES.LOGISTIC) {
        return { canView: true, canEdit: true, editOnlyOwnOrUnassigned: true };
      }
      if (sectorPrivilege === SECTOR_PRIVILEGES.COMMERCIAL) {
        // Commercial can view but not edit logistic service orders
        return { canView: true, canEdit: false, editOnlyOwnOrUnassigned: false };
      }
      // Not visible to other sectors
      return { canView: false, canEdit: false, editOnlyOwnOrUnassigned: false };

    case SERVICE_ORDER_TYPE.ARTWORK:
      // Visible to: Admin, Designer, Logistic, Commercial
      // Editable by: Admin, Designer only
      if (sectorPrivilege === SECTOR_PRIVILEGES.DESIGNER) {
        return { canView: true, canEdit: true, editOnlyOwnOrUnassigned: true };
      }
      if (sectorPrivilege === SECTOR_PRIVILEGES.LOGISTIC || sectorPrivilege === SECTOR_PRIVILEGES.COMMERCIAL) {
        // Logistic and Commercial can view but not edit artwork service orders
        return { canView: true, canEdit: false, editOnlyOwnOrUnassigned: false };
      }
      // Not visible to other sectors
      return { canView: false, canEdit: false, editOnlyOwnOrUnassigned: false };

    default:
      return { canView: false, canEdit: false, editOnlyOwnOrUnassigned: false };
  }
}

/**
 * Check if user can edit a specific service order based on sector, type, and assignment
 */
export function canEditServiceOrder(
  sectorPrivilege: SECTOR_PRIVILEGES | undefined,
  serviceOrderType: SERVICE_ORDER_TYPE,
  serviceOrderAssignedToId: string | null | undefined,
  currentUserId: string | undefined
): boolean {
  const permissions = getServiceOrderPermissions(sectorPrivilege, serviceOrderType);

  if (!permissions.canEdit) {
    return false;
  }

  // If edit is restricted to own/unassigned, check assignment
  if (permissions.editOnlyOwnOrUnassigned) {
    // Can edit if unassigned or assigned to current user
    return !serviceOrderAssignedToId || serviceOrderAssignedToId === currentUserId;
  }

  return true;
}

/**
 * Get the column IDs that should be visible for a given sector
 */
export function getVisibleServiceOrderColumnIds(sectorPrivilege: SECTOR_PRIVILEGES | undefined): string[] {
  const visibleTypes = getVisibleServiceOrderTypes(sectorPrivilege);
  return visibleTypes.map(type => `serviceOrders.${type.toLowerCase()}`);
}

/**
 * Map SERVICE_ORDER_TYPE to column ID format
 */
export function serviceOrderTypeToColumnId(type: SERVICE_ORDER_TYPE): string {
  return `serviceOrders.${type.toLowerCase()}`;
}

/**
 * Check if column ID is for a service order type
 */
export function isServiceOrderColumn(columnId: string): boolean {
  return columnId.startsWith('serviceOrders.');
}

/**
 * Extract SERVICE_ORDER_TYPE from column ID
 */
export function columnIdToServiceOrderType(columnId: string): SERVICE_ORDER_TYPE | null {
  if (!isServiceOrderColumn(columnId)) return null;

  const typePart = columnId.replace('serviceOrders.', '').toUpperCase();
  if (Object.values(SERVICE_ORDER_TYPE).includes(typePart as SERVICE_ORDER_TYPE)) {
    return typePart as SERVICE_ORDER_TYPE;
  }
  return null;
}
