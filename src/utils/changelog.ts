import { AUDIT_ACTION, ENTITY_TYPE, CHANGE_ACTION } from "../constants";

import { AUDIT_ACTION_LABELS, ENTITY_TYPE_LABELS, CHANGE_ACTION_LABELS } from "../constants";

export function getAuditActionLabel(action: AUDIT_ACTION): string {
  return AUDIT_ACTION_LABELS[action] || action;
}

export function getEntityTypeLabel(type: ENTITY_TYPE): string {
  return ENTITY_TYPE_LABELS[type] || type;
}

export function getChangeActionLabel(action: CHANGE_ACTION): string {
  return CHANGE_ACTION_LABELS[action] || action;
}

export const validateEntityType = (entityType: string): boolean => {
  const validEntityTypes = [
    "Activity",
    "Order",
    "OrderItem",
    "Item",
    "User",
    "Task",
    "Supplier",
    "Customer",
    "Commission",
    "Vacation",
    "PpeRequest",
    "ServiceOrder",
    "Borrow",
    "Warning",
    "ChangeLog",
    "Holiday",
    "Position",
    "Sector",
    "ItemBrand",
    "ItemCategory",
    "Paint",
    "Truck",
  ];
  return validEntityTypes.includes(entityType);
};

export const validateAction = (action: string): boolean => {
  const validActions = [
    "CREATE",
    "UPDATE",
    "DELETE",
    "STATUS_CHANGE",
    "QUANTITY_CHANGE",
    "RECEIVE",
    "APPROVE",
    "REJECT",
    "ASSIGN",
    "UNASSIGN",
    "ACTIVATE",
    "DEACTIVATE",
    "LOGIN",
    "LOGOUT",
    "PASSWORD_CHANGE",
    "PERMISSION_CHANGE",
  ];
  return validActions.includes(action);
};
