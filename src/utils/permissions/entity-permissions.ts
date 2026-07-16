/**
 * Centralized entity permission utilities
 * Determines if users can perform write operations (edit, delete) on entities
 * This controls visibility of checkboxes, right-click menus, and bulk action buttons
 */

import { SECTOR_PRIVILEGES } from '@/constants';
import type { User, AuthUser } from '@/types';
import { hasAnyPrivilege, isTeamLeader } from '@/utils';

// Type representing the minimal user shape needed for permission checks
type PermissionUser = User | AuthUser;

// =====================
// TASK PERMISSIONS
// =====================

/**
 * Can user create tasks?
 * ADMIN, COMMERCIAL, FINANCIAL, LOGISTIC, and PRODUCTION_MANAGER can create new tasks
 */
export function canCreateTasks(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.LOGISTIC,
    SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
  ]);
}

/**
 * Can user edit tasks?
 * ADMIN can edit all fields
 * COMMERCIAL, DESIGNER, FINANCIAL, LOGISTIC, PRODUCTION_MANAGER can edit limited fields (form handles field visibility)
 * Team leaders can start/finish tasks but NOT edit details
 * PRODUCTION is view-only
 */
export function canEditTasks(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.DESIGNER,
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.LOGISTIC,
    SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
  ]);
}

/**
 * Can user delete tasks?
 * Only ADMIN can delete tasks
 */
export function canDeleteTasks(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

/**
 * Can user start/finish tasks?
 * Team leaders can start/finish tasks in their led sector (or tasks without sector)
 * ADMIN can start/finish any task
 */
export function canManageTaskStatus(user: PermissionUser | null): boolean {
  if (!user) return false;
  return isTeamLeader(user) || hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

/**
 * Can user finish/complete tasks?
 * Only PRODUCTION_MANAGER and ADMIN can finish tasks
 */
export function canFinishTask(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
    SECTOR_PRIVILEGES.LOGISTIC,
  ]);
}

/**
 * Can user perform batch operations on tasks?
 * Only ADMIN can batch operate tasks
 */
export function canBatchOperateTasks(user: PermissionUser | null): boolean {
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
export function canViewCancelledTasks(user: PermissionUser | null): boolean {
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
export function canLeaderManageTask(user: PermissionUser | null, taskSectorId: string | null | undefined): boolean {
  if (!user) return false;

  // ADMIN can manage any task
  if (user.sector?.privileges === SECTOR_PRIVILEGES.ADMIN) return true;

  // Team leaders can only manage tasks assigned to their LED sector
  // Leaders cannot manage unassigned tasks — PM/COMMERCIAL/ADMIN must assign a sector first
  if (isTeamLeader(user)) {
    if (!taskSectorId) return false;
    return user.ledSector?.id === taskSectorId;
  }

  return false;
}

// =====================
// CUT PERMISSIONS
// =====================

/**
 * Can user edit cuts?
 * DESIGNER, PLOTTING, WAREHOUSE, and ADMIN can edit cut details (matches API PUT /cuts/:id)
 */
export function canEditCuts(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.DESIGNER,
    SECTOR_PRIVILEGES.PLOTTING,
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

/**
 * Can user delete cuts?
 * DESIGNER and ADMIN can delete cuts (matches API DELETE /cuts/:id)
 */
export function canDeleteCuts(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.DESIGNER,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

/**
 * Can user start/finish cuts (change status)?
 * DESIGNER, PLOTTING, WAREHOUSE, and ADMIN can change cut status (status changes
 * go through PUT /cuts/:id, which the API restricts to these roles)
 */
export function canManageCutStatus(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.DESIGNER,
    SECTOR_PRIVILEGES.PLOTTING,
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

/**
 * Can user request a new (re-)cut?
 * ADMIN, PRODUCTION_MANAGER, or a PRODUCTION team leader — the people who discover a
 * bad/lost/wrong cut on the floor. Matches the API re-cut authorization and Flutter
 * canRequestCut. (Plain PRODUCTION and DESIGNER cannot request re-cuts.)
 */
export function canRequestCut(user: PermissionUser | null): boolean {
  if (!user) return false;
  if (hasAnyPrivilege(user, [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.PRODUCTION_MANAGER])) {
    return true;
  }
  return isTeamLeader(user) && hasAnyPrivilege(user, [SECTOR_PRIVILEGES.PRODUCTION]);
}

// =====================
// AIRBRUSHING PERMISSIONS
// =====================

/**
 * Can user create/edit/delete airbrushings?
 * ADMIN, COMMERCIAL, and FINANCIAL can manage airbrushings
 */
export function canCreateAirbrushings(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.FINANCIAL,
  ]);
}

export function canEditAirbrushings(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.FINANCIAL,
  ]);
}

export function canDeleteAirbrushings(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.FINANCIAL,
  ]);
}

/**
 * CANONICAL money-visibility gate for airbrushing (Aerografia).
 *
 * Single source of truth for who may see monetary/payment information on an
 * airbrushing: price, paymentStatus, paidAt, the invoice/receipt financial
 * files, and Contas a Pagar rows. Use this everywhere (list columns, detail
 * sections, task-detail card, form price/payment fields) — do NOT re-derive
 * ad-hoc {FINANCIAL, ADMIN} sets, and do NOT use useCanViewPrices() (which only
 * excludes WAREHOUSE and is far too permissive for painter payments).
 *
 * COMMERCIAL is included because they quote/set the airbrushing price.
 */
export const AIRBRUSHING_FINANCE_PRIVILEGES = [
  SECTOR_PRIVILEGES.FINANCIAL,
  SECTOR_PRIVILEGES.ACCOUNTING,
  SECTOR_PRIVILEGES.ADMIN,
  SECTOR_PRIVILEGES.COMMERCIAL,
] as const;

export function canViewAirbrushingFinancials(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [...AIRBRUSHING_FINANCE_PRIVILEGES]);
}

// =====================
// OBSERVATION PERMISSIONS
// =====================

/**
 * Can user create/edit/delete observations?
 * ADMIN, COMMERCIAL, FINANCIAL, WAREHOUSE, and PRODUCTION_MANAGER can
 * create/edit observations (PRODUCTION excluded — matches API)
 */
export function canCreateObservations(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
  ]);
}

export function canEditObservations(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
  ]);
}

export function canDeleteObservations(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.FINANCIAL,
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
export function canEditItems(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

/**
 * Can user delete inventory items?
 * Only ADMIN can delete items (matches API)
 */
export function canDeleteItems(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canBatchOperateItems(user: PermissionUser | null): boolean {
  return canEditItems(user);
}

// =====================
// PAINT PERMISSIONS
// =====================

/**
 * Can user edit/delete paints?
 * WAREHOUSE manages paint inventory
 */
export function canEditPaints(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeletePaints(user: PermissionUser | null): boolean {
  return canEditPaints(user);
}

export function canBatchOperatePaints(user: PermissionUser | null): boolean {
  return canEditPaints(user);
}

// Paint brands and types follow same rules as paints
export const canEditPaintBrands = canEditPaints;
export const canDeletePaintBrands = canDeletePaints;
export const canEditPaintTypes = canEditPaints;
export const canDeletePaintTypes = canDeletePaints;

/**
 * Can user edit/delete paint productions?
 * WAREHOUSE and ADMIN manage paint productions (PRODUCTION is view-only — matches API)
 */
export function canEditPaintProductions(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeletePaintProductions(user: PermissionUser | null): boolean {
  return canEditPaintProductions(user);
}

/**
 * Can user edit/delete paint formulas?
 * WAREHOUSE manages paint formulas
 */
export function canEditPaintFormulas(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeletePaintFormulas(user: PermissionUser | null): boolean {
  return canEditPaintFormulas(user);
}

// =====================
// CUSTOMER PERMISSIONS
// =====================

/**
 * Can user edit/delete customers?
 * FINANCIAL, COMMERCIAL, LOGISTIC, PRODUCTION_MANAGER, and ADMIN manage customers
 */
export function canEditCustomers(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.LOGISTIC,
    SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeleteCustomers(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canBatchOperateCustomers(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

// =====================
// ORDER PERMISSIONS
// =====================

/**
 * Can user edit/delete orders?
 * WAREHOUSE manages orders
 */
export function canEditOrders(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

/**
 * Can user delete orders?
 * Only ADMIN can delete orders (matches API)
 */
export function canDeleteOrders(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canBatchOperateOrders(user: PermissionUser | null): boolean {
  return canEditOrders(user);
}

// =====================
// BORROW PERMISSIONS
// =====================

/**
 * Can user edit/delete borrows?
 * WAREHOUSE manages equipment borrows
 */
export function canEditBorrows(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeleteBorrows(user: PermissionUser | null): boolean {
  return canEditBorrows(user);
}

export function canBatchOperateBorrows(user: PermissionUser | null): boolean {
  return canEditBorrows(user);
}

// =====================
// PPE DELIVERY PERMISSIONS
// =====================

/**
 * Can user edit/delete PPE deliveries?
 * WAREHOUSE manages PPE deliveries
 */
export function canEditPpeDeliveries(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeletePpeDeliveries(user: PermissionUser | null): boolean {
  return canEditPpeDeliveries(user);
}

export function canBatchOperatePpeDeliveries(user: PermissionUser | null): boolean {
  return canEditPpeDeliveries(user);
}

// =====================
// MAINTENANCE PERMISSIONS
// =====================

/**
 * Can user edit/delete maintenance records?
 * WAREHOUSE and MAINTENANCE sectors manage maintenance
 */
export function canEditMaintenance(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.MAINTENANCE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeleteMaintenance(user: PermissionUser | null): boolean {
  return canEditMaintenance(user);
}

export function canBatchOperateMaintenance(user: PermissionUser | null): boolean {
  return canEditMaintenance(user);
}

// =====================
// EXTERNAL OPERATION PERMISSIONS
// =====================

/**
 * Can user edit external operations?
 * ADMIN only — the API restricts every external-operation write endpoint
 * (POST/PUT/PATCH/DELETE + billing) to @Roles(ADMIN). Offering this to
 * WAREHOUSE/FINANCIAL would surface buttons the server rejects.
 */
export function canEditExternalOperations(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

/**
 * Can user delete external operations?
 * ADMIN only (matches API @Roles(ADMIN) on DELETE / DELETE batch).
 */
export function canDeleteExternalOperations(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canBatchOperateExternalOperations(user: PermissionUser | null): boolean {
  return canDeleteExternalOperations(user);
}

// =====================
// SUPPLIER PERMISSIONS
// =====================

/**
 * Can user edit/delete suppliers?
 * WAREHOUSE manages suppliers
 */
export function canEditSuppliers(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

/**
 * Can user delete suppliers?
 * Only ADMIN can delete suppliers (matches API)
 */
export function canDeleteSuppliers(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

// =====================
// WAREHOUSE LOCATION PERMISSIONS
// =====================

/**
 * Can user create/edit warehouse locations?
 * WAREHOUSE and ADMIN manage warehouse locations
 */
export function canEditWarehouseLocations(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

/**
 * Can user delete warehouse locations?
 * WAREHOUSE and ADMIN can delete warehouse locations (matches API)
 */
export function canDeleteWarehouseLocations(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

// =====================
// HR ENTITY PERMISSIONS
// =====================

/**
 * Can user edit HR entities (vacations, warnings, positions)?
 * HUMAN_RESOURCES, ACCOUNTING (Departamento Pessoal), and ADMIN manage HR data (matches API @Roles)
 */
export function canEditHrEntities(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.HUMAN_RESOURCES,
    SECTOR_PRIVILEGES.ACCOUNTING,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeleteHrEntities(user: PermissionUser | null): boolean {
  return canEditHrEntities(user);
}

/**
 * Can user manage skill-assessment campaigns (edit / open / close / cancel / delete)?
 * HUMAN_RESOURCES and ADMIN run HR, and PRODUCTION_MANAGER owns the production
 * skill matrix — so all three may manage campaigns. Mirrors the API @Roles on
 * the /assessment endpoints (skill.controller.ts).
 */
export function canEditAssessments(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.HUMAN_RESOURCES,
    SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

export function canDeleteAssessments(user: PermissionUser | null): boolean {
  return canEditAssessments(user);
}

// =====================
// USER PERMISSIONS
// =====================

/**
 * Can user edit/delete users?
 * ADMIN, HR, and ACCOUNTING (read/update — Departamento Pessoal) can manage users
 */
export function canEditUsers(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.HUMAN_RESOURCES,
    SECTOR_PRIVILEGES.ACCOUNTING,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

/**
 * Can user delete users?
 * HR and ADMIN only — ACCOUNTING has read/update but NOT delete (matches API)
 */
export function canDeleteUsers(user: PermissionUser | null): boolean {
  if (!user) return false;
  return hasAnyPrivilege(user, [
    SECTOR_PRIVILEGES.HUMAN_RESOURCES,
    SECTOR_PRIVILEGES.ADMIN,
  ]);
}

// =====================
// GENERAL UTILITY
// =====================

/**
 * Should interactive elements (checkboxes, right-click menus) be shown?
 * This is the main function to use in table components
 */
export function shouldShowInteractiveElements(
  user: PermissionUser | null,
  entityType: 'task' | 'cut' | 'item' | 'paint' | 'customer' | 'order' |
               'borrow' | 'ppe' | 'maintenance' | 'externalOperation' |
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
    case 'externalOperation':
      return canEditExternalOperations(user);
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
