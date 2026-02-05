/**
 * Centralized entity permission utilities
 * Determines if users can perform write operations (edit, delete) on entities
 * This controls visibility of checkboxes, right-click menus, and bulk action buttons
 */

import { SECTOR_PRIVILEGES } from '@/constants';
import type { User } from '@/types';
import { hasAnyPrivilege, isTeamLeader } from '@/utils';

// =====================
// TASK PERMISSIONS
// =====================

/**
 * Can user create tasks?
 * ADMIN, COMMERCIAL, FINANCIAL, and LOGISTIC can create new tasks
 */
export function canCreateTasks(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.LOGISTIC,
  ]);
}

/**
 * Can user edit tasks?
 * ADMIN can edit all fields
 * COMMERCIAL, DESIGNER, FINANCIAL, LOGISTIC can edit limited fields (form handles field visibility)
 * Team leaders can start/finish tasks but NOT edit details
 * PRODUCTION is view-only
 */
export function canEditTasks(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.DESIGNER,
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.LOGISTIC,
  ]);
}

/**
 * Can user delete tasks?
 * Only ADMIN can delete tasks
 */
export function canDeleteTasks(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

/**
 * Can user start/finish tasks?
 * Team leaders can start/finish tasks in their managed sector (or tasks without sector)
 * ADMIN can start/finish any task
 */
export function canManageTaskStatus(user: User | null): boolean {
  if (!user) return false;
  return isTeamLeader(user) || hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

/**
 * Can user perform batch operations on tasks?
 * Only ADMIN can batch operate tasks
 */
export function canBatchOperateTasks(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

/**
 * Can user view cancelled tasks in task history?
 * ADMIN, COMMERCIAL, and FINANCIAL can view cancelled tasks via status filter
 * By default, only COMPLETED tasks are shown - user must explicitly select CANCELLED
 */
export function canViewCancelledTasks(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.FINANCIAL,
  ]);
}

/**
 * Check if team leader can manage a specific task (sector-based validation)
 * Team leaders can manage tasks in their own sector OR tasks without a sector
 * When starting a task without sector, it will be assigned to leader's sector
 * ADMIN can manage any task
 */
export function canLeaderManageTask(user: User | null, taskSectorId: string | null | undefined): boolean {
  if (!user) return false;

  // ADMIN can manage any task
  if (user.sector?.privileges === SECTOR_PRIVILEGES.ADMIN) return true;

  // Team leader can manage tasks in their managed sector OR tasks without a sector
  if (isTeamLeader(user)) {
    // Task has no sector - team leader can manage it (will assign to their sector on start)
    if (!taskSectorId) return true;
    // Task sector matches leader's managed sector
    return user.managedSector?.id === taskSectorId;
  }

  return false;
}

// =====================
// CUT PERMISSIONS
// =====================

/**
 * Can user create cuts?
 * Only ADMIN can create cuts directly
 */
export function canCreateCuts(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

/**
 * Can user edit cuts?
 * Only ADMIN can edit cut details
 */
export function canEditCuts(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

/**
 * Can user delete cuts?
 * Only ADMIN can delete cuts
 */
export function canDeleteCuts(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

/**
 * Can user start/finish cuts (change status)?
 * WAREHOUSE can start/finish cuts
 * ADMIN can also manage cut status
 */
export function canManageCutStatus(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

/**
 * Can user request a new cut?
 * Team leaders can request cuts for their sector
 * ADMIN can also request cuts
 */
export function canRequestCut(user: User | null): boolean {
  if (!user) return false;
  return isTeamLeader(user) || hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

// =====================
// AIRBRUSHING PERMISSIONS
// =====================

/**
 * Can user create/edit/delete airbrushings?
 * ADMIN, COMMERCIAL, and FINANCIAL can manage airbrushings
 */
export function canCreateAirbrushings(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.FINANCIAL,
  ]);
}

export function canEditAirbrushings(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.FINANCIAL,
  ]);
}

export function canDeleteAirbrushings(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

// =====================
// OBSERVATION PERMISSIONS
// =====================

/**
 * Can user create/edit/delete observations?
 * ADMIN, COMMERCIAL, FINANCIAL, PRODUCTION, and WAREHOUSE can create/edit observations
 */
export function canCreateObservations(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.PRODUCTION,
    SECTOR_PRIVILEGES.WAREHOUSE,
  ]);
}

export function canEditObservations(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.PRODUCTION,
    SECTOR_PRIVILEGES.WAREHOUSE,
  ]);
}

export function canDeleteObservations(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

// =====================
// ITEM/INVENTORY PERMISSIONS
// =====================

/**
 * Can user edit/delete inventory items?
 * WAREHOUSE manages all inventory
 */
export function canEditItems(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeleteItems(user: User | null): boolean {
  return canEditItems(user);
}

export function canBatchOperateItems(user: User | null): boolean {
  return canEditItems(user);
}

// =====================
// PAINT PERMISSIONS
// =====================

/**
 * Can user edit/delete paints?
 * WAREHOUSE manages paint inventory
 */
export function canEditPaints(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeletePaints(user: User | null): boolean {
  return canEditPaints(user);
}

export function canBatchOperatePaints(user: User | null): boolean {
  return canEditPaints(user);
}

// Paint brands and types follow same rules as paints
export const canEditPaintBrands = canEditPaints;
export const canDeletePaintBrands = canDeletePaints;
export const canEditPaintTypes = canEditPaints;
export const canDeletePaintTypes = canDeletePaints;

/**
 * Can user edit/delete paint productions?
 * PRODUCTION and WAREHOUSE can manage paint productions
 */
export function canEditPaintProductions(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.PRODUCTION,
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeletePaintProductions(user: User | null): boolean {
  return canEditPaintProductions(user);
}

/**
 * Can user edit/delete paint formulas?
 * WAREHOUSE manages paint formulas
 */
export function canEditPaintFormulas(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeletePaintFormulas(user: User | null): boolean {
  return canEditPaintFormulas(user);
}

// =====================
// CUSTOMER PERMISSIONS
// =====================

/**
 * Can user edit/delete customers?
 * FINANCIAL, COMMERCIAL, LOGISTIC, and ADMIN manage customers
 */
export function canEditCustomers(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.LOGISTIC,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeleteCustomers(user: User | null): boolean {
  return canEditCustomers(user);
}

export function canBatchOperateCustomers(user: User | null): boolean {
  return canEditCustomers(user);
}

// =====================
// ORDER PERMISSIONS
// =====================

/**
 * Can user edit/delete orders?
 * WAREHOUSE manages orders
 */
export function canEditOrders(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeleteOrders(user: User | null): boolean {
  return canEditOrders(user);
}

export function canBatchOperateOrders(user: User | null): boolean {
  return canEditOrders(user);
}

// =====================
// BORROW PERMISSIONS
// =====================

/**
 * Can user edit/delete borrows?
 * WAREHOUSE manages equipment borrows
 */
export function canEditBorrows(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeleteBorrows(user: User | null): boolean {
  return canEditBorrows(user);
}

export function canBatchOperateBorrows(user: User | null): boolean {
  return canEditBorrows(user);
}

// =====================
// PPE DELIVERY PERMISSIONS
// =====================

/**
 * Can user edit/delete PPE deliveries?
 * WAREHOUSE manages PPE deliveries
 */
export function canEditPpeDeliveries(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeletePpeDeliveries(user: User | null): boolean {
  return canEditPpeDeliveries(user);
}

export function canBatchOperatePpeDeliveries(user: User | null): boolean {
  return canEditPpeDeliveries(user);
}

// =====================
// MAINTENANCE PERMISSIONS
// =====================

/**
 * Can user edit/delete maintenance records?
 * WAREHOUSE and MAINTENANCE sectors manage maintenance
 */
export function canEditMaintenance(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.MAINTENANCE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeleteMaintenance(user: User | null): boolean {
  return canEditMaintenance(user);
}

export function canBatchOperateMaintenance(user: User | null): boolean {
  return canEditMaintenance(user);
}

// =====================
// EXTERNAL WITHDRAWAL PERMISSIONS
// =====================

/**
 * Can user edit/delete external withdrawals?
 * WAREHOUSE manages external withdrawals
 */
export function canEditExternalWithdrawals(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeleteExternalWithdrawals(user: User | null): boolean {
  return canEditExternalWithdrawals(user);
}

export function canBatchOperateExternalWithdrawals(user: User | null): boolean {
  return canEditExternalWithdrawals(user);
}

// =====================
// SUPPLIER PERMISSIONS
// =====================

/**
 * Can user edit/delete suppliers?
 * WAREHOUSE manages suppliers
 */
export function canEditSuppliers(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeleteSuppliers(user: User | null): boolean {
  return canEditSuppliers(user);
}

// =====================
// HR ENTITY PERMISSIONS
// =====================

/**
 * Can user edit HR entities (vacations, warnings, positions)?
 * HUMAN_RESOURCES and ADMIN manage HR data
 */
export function canEditHrEntities(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.HUMAN_RESOURCES,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeleteHrEntities(user: User | null): boolean {
  return canEditHrEntities(user);
}

// =====================
// USER PERMISSIONS
// =====================

/**
 * Can user edit/delete users?
 * Only ADMIN and HR can manage users
 */
export function canEditUsers(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.HUMAN_RESOURCES,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeleteUsers(user: User | null): boolean {
  return canEditUsers(user);
}

// =====================
// GENERAL UTILITY
// =====================

/**
 * Should interactive elements (checkboxes, right-click menus) be shown?
 * This is the main function to use in table components
 */
export function shouldShowInteractiveElements(
  user: User | null,
  entityType: 'task' | 'cut' | 'item' | 'paint' | 'customer' | 'order' |
               'borrow' | 'ppe' | 'maintenance' | 'externalWithdrawal' |
               'supplier' | 'hr' | 'user' | 'paintBrand' | 'paintType' |
               'paintFormula' | 'observation' | 'airbrushing'
): boolean {
  switch (entityType) {
    case 'task':
      return canEditTasks(user);
    case 'cut':
      return canEditCuts(user);
    case 'item':
      return canEditItems(user);
    case 'paint':
    case 'paintBrand':
    case 'paintType':
      return canEditPaints(user);
    case 'paintFormula':
      return canEditPaintFormulas(user);
    case 'customer':
      return canEditCustomers(user);
    case 'order':
      return canEditOrders(user);
    case 'borrow':
      return canEditBorrows(user);
    case 'ppe':
      return canEditPpeDeliveries(user);
    case 'maintenance':
      return canEditMaintenance(user);
    case 'externalWithdrawal':
      return canEditExternalWithdrawals(user);
    case 'supplier':
      return canEditSuppliers(user);
    case 'hr':
      return canEditHrEntities(user);
    case 'user':
      return canEditUsers(user);
    case 'observation':
      return canEditObservations(user);
    case 'airbrushing':
      return canEditAirbrushings(user);
    default:
      return false;
  }
}
