/**
 * Centralized entity permission utilities
 * Determines if users can perform write operations (edit, delete) on entities
 * This controls visibility of checkboxes, right-click menus, and bulk action buttons
 */

import { SECTOR_PRIVILEGES } from '@/constants';
import type { User } from '@/types';
import { hasAnyPrivilege } from '@/utils';

// =====================
// TASK PERMISSIONS
// =====================

/**
 * Can user edit/delete tasks?
 * Tasks: LEADER and ADMIN can create/delete
 * PRODUCTION can update (start/finish/move)
 * Others are view-only
 */
export function canEditTasks(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.PRODUCTION,
    SECTOR_PRIVILEGES.LEADER,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeleteTasks(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.LEADER,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canBatchOperateTasks(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.PRODUCTION,
    SECTOR_PRIVILEGES.LEADER,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

// =====================
// CUT PERMISSIONS
// =====================

/**
 * Can user edit/delete cuts?
 * WAREHOUSE makes the physical cuts (vinyl/stencil)
 * DESIGNER creates cut designs
 * ADMIN has full control
 */
export function canEditCuts(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.DESIGNER,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeleteCuts(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.DESIGNER,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

// =====================
// AIRBRUSHING PERMISSIONS
// =====================

/**
 * Can user edit/delete airbrushings?
 * PRODUCTION and WAREHOUSE manage airbrushings
 */
export function canEditAirbrushings(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.PRODUCTION,
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeleteAirbrushings(user: User | null): boolean {
  return canEditAirbrushings(user);
}

// =====================
// OBSERVATION PERMISSIONS
// =====================

/**
 * Can user edit/delete observations?
 * PRODUCTION and WAREHOUSE manage observations
 */
export function canEditObservations(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.PRODUCTION,
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeleteObservations(user: User | null): boolean {
  return canEditObservations(user);
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

// =====================
// CUSTOMER PERMISSIONS
// =====================

/**
 * Can user edit/delete customers?
 * FINANCIAL and LEADER manage customers
 */
export function canEditCustomers(user: User | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.LEADER,
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
               'supplier' | 'hr' | 'user' | 'paintBrand' | 'paintType'
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
    default:
      return false;
  }
}
