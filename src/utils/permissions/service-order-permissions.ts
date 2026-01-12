import { SECTOR_PRIVILEGES, SERVICE_ORDER_TYPE } from "@/constants";

/**
 * Service Order Permission Utility
 *
 * Defines visibility and edit permissions for service order columns based on sector privileges.
 *
 * Permission Matrix (VISIBILITY):
 * | Sector          | PRODUCTION | NEGOTIATION | ARTWORK    | FINANCIAL  |
 * |-----------------|------------|-------------|------------|------------|
 * | ADMIN           | view+edit  | view+edit   | view+edit  | view+edit  |
 * | COMMERCIAL      | view only  | view+edit*  | -          | view only  |
 * | DESIGNER        | view only  | -           | view+edit* | -          |
 * | FINANCIAL       | view only  | -           | -          | view+edit* |
 * | LOGISTIC        | view+edit  | view+edit*  | view+edit* | -          |
 * | PRODUCTION      | view+edit  | -           | -          | -          |
 * | WAREHOUSE       | view only  | -           | -          | -          |
 * | HUMAN_RESOURCES | view only  | -           | -          | -          |
 * | Others          | view only  | -           | -          | -          |
 *
 * * = edit only own/unassigned service orders
 *
 * Visibility Rules:
 * - PRODUCTION: Visible to ALL sectors, Editable by Admin/Logistic/Production only
 * - NEGOTIATION: Visible to Admin/Commercial/Logistic only
 * - ARTWORK: Visible to Admin/Designer/Logistic only
 * - FINANCIAL: Visible to Admin/Commercial/Financial only
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
        SERVICE_ORDER_TYPE.NEGOTIATION,
        SERVICE_ORDER_TYPE.ARTWORK,
        SERVICE_ORDER_TYPE.FINANCIAL,
      ];

    case SECTOR_PRIVILEGES.COMMERCIAL:
      // Commercial sees: production, negotiation, financial (NO artwork)
      return [
        SERVICE_ORDER_TYPE.PRODUCTION,
        SERVICE_ORDER_TYPE.NEGOTIATION,
        SERVICE_ORDER_TYPE.FINANCIAL,
      ];

    case SECTOR_PRIVILEGES.DESIGNER:
      // Designer sees: production, artwork (NO negotiation, NO financial)
      return [
        SERVICE_ORDER_TYPE.PRODUCTION,
        SERVICE_ORDER_TYPE.ARTWORK,
      ];

    case SECTOR_PRIVILEGES.FINANCIAL:
      // Financial sees: production, financial (NO negotiation, NO artwork)
      return [
        SERVICE_ORDER_TYPE.PRODUCTION,
        SERVICE_ORDER_TYPE.FINANCIAL,
      ];

    case SECTOR_PRIVILEGES.LOGISTIC:
      // Logistic sees: production, negotiation, artwork (NO financial)
      return [
        SERVICE_ORDER_TYPE.PRODUCTION,
        SERVICE_ORDER_TYPE.NEGOTIATION,
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

    case SERVICE_ORDER_TYPE.NEGOTIATION:
      // Visible to: Admin, Commercial, Logistic
      if (sectorPrivilege === SECTOR_PRIVILEGES.COMMERCIAL) {
        return { canView: true, canEdit: true, editOnlyOwnOrUnassigned: true };
      }
      if (sectorPrivilege === SECTOR_PRIVILEGES.LOGISTIC) {
        return { canView: true, canEdit: true, editOnlyOwnOrUnassigned: true };
      }
      // Not visible to other sectors
      return { canView: false, canEdit: false, editOnlyOwnOrUnassigned: false };

    case SERVICE_ORDER_TYPE.ARTWORK:
      // Visible to: Admin, Designer, Logistic
      if (sectorPrivilege === SECTOR_PRIVILEGES.DESIGNER) {
        return { canView: true, canEdit: true, editOnlyOwnOrUnassigned: true };
      }
      if (sectorPrivilege === SECTOR_PRIVILEGES.LOGISTIC) {
        return { canView: true, canEdit: true, editOnlyOwnOrUnassigned: true };
      }
      // Not visible to other sectors
      return { canView: false, canEdit: false, editOnlyOwnOrUnassigned: false };

    case SERVICE_ORDER_TYPE.FINANCIAL:
      // Visible to: Admin, Commercial, Financial
      if (sectorPrivilege === SECTOR_PRIVILEGES.COMMERCIAL) {
        // Commercial can view but not edit financial
        return { canView: true, canEdit: false, editOnlyOwnOrUnassigned: false };
      }
      if (sectorPrivilege === SECTOR_PRIVILEGES.FINANCIAL) {
        return { canView: true, canEdit: true, editOnlyOwnOrUnassigned: true };
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
