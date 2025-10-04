import { SECTOR_PRIVILEGES } from "../../../../constants";
import { hasPrivilege, hasAnyPrivilege } from "../../../../utils";
import type { User, Borrow } from "../../../../types";

/**
 * Check if user can create new borrows
 * Requires WAREHOUSE or ADMIN privileges
 */
export function canCreateBorrow(user: User | null | undefined): boolean {
  if (!user) return false;

  return hasAnyPrivilege(user, [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]);
}

/**
 * Check if user can edit a borrow
 * Only ADMIN can edit borrows
 */
export function canEditBorrow(user: User | null | undefined, _borrow?: Borrow): boolean {
  if (!user) return false;

  // Only admins can edit borrows
  return hasPrivilege(user, SECTOR_PRIVILEGES.ADMIN);
}

/**
 * Check if user can delete a borrow
 * Only ADMIN can delete borrows
 */
export function canDeleteBorrow(user: User | null | undefined, _borrow?: Borrow): boolean {
  if (!user) return false;

  // Only admins can delete borrows
  return hasPrivilege(user, SECTOR_PRIVILEGES.ADMIN);
}

/**
 * Check if user can return a borrow
 * Requires WAREHOUSE or ADMIN privileges
 */
export function canReturnBorrow(user: User | null | undefined, _borrow?: Borrow): boolean {
  if (!user) return false;

  return hasAnyPrivilege(user, [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]);
}

/**
 * Check if user can view borrow details
 * All authenticated users can view borrows
 */
export function canViewBorrow(user: User | null | undefined): boolean {
  return !!user;
}

/**
 * Check if user can manage borrows (create, edit, delete, return)
 * Requires WAREHOUSE or ADMIN privileges
 */
export function canManageBorrows(user: User | null | undefined): boolean {
  if (!user) return false;

  return hasAnyPrivilege(user, [SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.ADMIN]);
}

/**
 * Check if user has full borrow administrative privileges
 * Only ADMIN has full privileges
 */
export function hasFullBorrowPrivileges(user: User | null | undefined): boolean {
  if (!user) return false;

  return hasPrivilege(user, SECTOR_PRIVILEGES.ADMIN);
}

/**
 * Get borrow action permissions for a user
 * Returns an object with all permission states
 */
export function getBorrowPermissions(user: User | null | undefined, borrow?: Borrow) {
  return {
    canCreate: canCreateBorrow(user),
    canEdit: canEditBorrow(user, borrow),
    canDelete: canDeleteBorrow(user, borrow),
    canReturn: canReturnBorrow(user, borrow),
    canView: canViewBorrow(user),
    canManage: canManageBorrows(user),
    hasFullPrivileges: hasFullBorrowPrivileges(user),
  };
}

/**
 * Permission messages for user feedback
 */
export const PERMISSION_MESSAGES = {
  create: "Você precisa de permissões de Almoxarifado ou Administrador para criar empréstimos.",
  edit: "Apenas Administradores podem editar empréstimos.",
  delete: "Apenas Administradores podem excluir empréstimos.",
  return: "Você precisa de permissões de Almoxarifado ou Administrador para devolver empréstimos.",
  view: "Você precisa estar autenticado para visualizar empréstimos.",
  manage: "Você precisa de permissões de Almoxarifado ou Administrador para gerenciar empréstimos.",
} as const;

/**
 * Get appropriate permission message for an action
 */
export function getPermissionMessage(action: keyof typeof PERMISSION_MESSAGES): string {
  return PERMISSION_MESSAGES[action] || "Você não tem permissão para realizar esta ação.";
}
