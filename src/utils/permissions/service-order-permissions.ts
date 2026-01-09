import { SECTOR_PRIVILEGES, SERVICE_ORDER_TYPE } from "@/constants";

/**
 * Service Order Permission Utility
 *
 * Defines visibility and edit permissions for service order columns based on sector privileges.
 *
 * Permission Matrix:
 * | Sector          | PRODUCTION | NEGOTIATION | ARTWORK | FINANCIAL |
 * |-----------------|------------|-------------|---------|-----------|
 * | ADMIN           | view+edit  | view+edit   | view+edit| view+edit |
 * | DESIGNER        | view only  | -           | view+edit* | -       |
 * | FINANCIAL       | -          | -           | -       | view+edit* |
 * | LOGISTIC        | view+edit  | view only   | view only | -       |
 * | PRODUCTION      | view+edit  | -           | -       | -         |
 * | WAREHOUSE       | view+edit  | -           | -       | -         |
 * | HUMAN_RESOURCES | -          | -           | -       | -         |
 * | Others          | view+edit  | -           | -       | -         |
 *
 * * = edit only own/unassigned service orders
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
      // Admin sees all columns in order: negotiation, artwork, production, financial
      return [
        SERVICE_ORDER_TYPE.NEGOTIATION,
        SERVICE_ORDER_TYPE.ARTWORK,
        SERVICE_ORDER_TYPE.PRODUCTION,
        SERVICE_ORDER_TYPE.FINANCIAL,
      ];

    case SECTOR_PRIVILEGES.DESIGNER:
      // Designer sees artwork and production (view only) in order: artwork, production
      return [
        SERVICE_ORDER_TYPE.ARTWORK,
        SERVICE_ORDER_TYPE.PRODUCTION,
      ];

    case SECTOR_PRIVILEGES.FINANCIAL:
      // Financial sees only financial column
      return [SERVICE_ORDER_TYPE.FINANCIAL];

    case SECTOR_PRIVILEGES.LOGISTIC:
      // Logistic sees negotiation, artwork, and production in order: negotiation, artwork, production
      return [
        SERVICE_ORDER_TYPE.NEGOTIATION,
        SERVICE_ORDER_TYPE.ARTWORK,
        SERVICE_ORDER_TYPE.PRODUCTION,
      ];

    case SECTOR_PRIVILEGES.HUMAN_RESOURCES:
      // HR sees no service order columns
      return [];

    case SECTOR_PRIVILEGES.PRODUCTION:
    case SECTOR_PRIVILEGES.WAREHOUSE:
    case SECTOR_PRIVILEGES.BASIC:
    case SECTOR_PRIVILEGES.EXTERNAL:
    case SECTOR_PRIVILEGES.MAINTENANCE:
    default:
      // These sectors see only production column
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

  // HR has no access
  if (sectorPrivilege === SECTOR_PRIVILEGES.HUMAN_RESOURCES) {
    return { canView: false, canEdit: false, editOnlyOwnOrUnassigned: false };
  }

  switch (serviceOrderType) {
    case SERVICE_ORDER_TYPE.PRODUCTION:
      // Production available for all except DESIGNER, FINANCIAL, HR
      if (sectorPrivilege === SECTOR_PRIVILEGES.DESIGNER ||
          sectorPrivilege === SECTOR_PRIVILEGES.FINANCIAL) {
        // Designer can view but not edit production
        if (sectorPrivilege === SECTOR_PRIVILEGES.DESIGNER) {
          return { canView: true, canEdit: false, editOnlyOwnOrUnassigned: false };
        }
        return { canView: false, canEdit: false, editOnlyOwnOrUnassigned: false };
      }
      // All other sectors can view and edit production
      return { canView: true, canEdit: true, editOnlyOwnOrUnassigned: false };

    case SERVICE_ORDER_TYPE.NEGOTIATION:
      // Logistic can view negotiation but not edit
      if (sectorPrivilege === SECTOR_PRIVILEGES.LOGISTIC) {
        return { canView: true, canEdit: false, editOnlyOwnOrUnassigned: false };
      }
      return { canView: false, canEdit: false, editOnlyOwnOrUnassigned: false };

    case SERVICE_ORDER_TYPE.ARTWORK:
      // Designer can edit own/unassigned artwork
      if (sectorPrivilege === SECTOR_PRIVILEGES.DESIGNER) {
        return { canView: true, canEdit: true, editOnlyOwnOrUnassigned: true };
      }
      // Logistic can view but not edit artwork
      if (sectorPrivilege === SECTOR_PRIVILEGES.LOGISTIC) {
        return { canView: true, canEdit: false, editOnlyOwnOrUnassigned: false };
      }
      return { canView: false, canEdit: false, editOnlyOwnOrUnassigned: false };

    case SERVICE_ORDER_TYPE.FINANCIAL:
      // Financial can edit own/unassigned financial orders
      if (sectorPrivilege === SECTOR_PRIVILEGES.FINANCIAL) {
        return { canView: true, canEdit: true, editOnlyOwnOrUnassigned: true };
      }
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
