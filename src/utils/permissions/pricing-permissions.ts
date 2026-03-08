import { SECTOR_PRIVILEGES } from '@/constants';
import type { SECTOR_PRIVILEGES as SECTOR_PRIVILEGES_TYPE } from '@/constants';
import type { TASK_PRICING_STATUS } from '@/types/task-pricing';

export function canViewPricing(userRole: string): boolean {
  return [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.COMMERCIAL,
  ].includes(userRole as SECTOR_PRIVILEGES_TYPE);
}

export function canCreatePricing(userRole: string): boolean {
  return [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.FINANCIAL].includes(userRole as SECTOR_PRIVILEGES_TYPE);
}

export function canEditPricing(userRole: string): boolean {
  return [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.FINANCIAL].includes(userRole as SECTOR_PRIVILEGES_TYPE);
}

export function canApprovePricing(userRole: string): boolean {
  return [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL].includes(userRole as SECTOR_PRIVILEGES_TYPE);
}

export function canDeletePricing(userRole: string): boolean {
  return userRole === SECTOR_PRIVILEGES.ADMIN;
}

/**
 * Check if user can update task pricing status.
 * ADMIN, FINANCIAL, and COMMERCIAL can update status.
 * FINANCIAL cannot set INTERNAL_APPROVED (only ADMIN/COMMERCIAL can).
 */
export function canUpdatePricingStatus(userRole: string): boolean {
  return [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.COMMERCIAL,
  ].includes(userRole as SECTOR_PRIVILEGES_TYPE);
}

/**
 * Valid status transitions for task pricing.
 *
 * Typical flow:
 *   PENDING → BUDGET_APPROVED → VERIFIED → INTERNAL_APPROVED → UPCOMING → PARTIAL → SETTLED
 *
 * INTERNAL_APPROVED is a critical transition: it triggers automatic invoice
 * and boleto generation, which is hard to reverse. The UI should confirm
 * before allowing this transition.
 *
 * Currently all statuses can transition to any other status (except themselves)
 * to allow administrative corrections.
 */
const ALL_STATUSES: TASK_PRICING_STATUS[] = [
  'PENDING', 'BUDGET_APPROVED', 'VERIFIED', 'INTERNAL_APPROVED',
  'UPCOMING', 'PARTIAL', 'SETTLED',
];

const VALID_TRANSITIONS: Record<TASK_PRICING_STATUS, TASK_PRICING_STATUS[]> = {
  PENDING: ['BUDGET_APPROVED'],
  BUDGET_APPROVED: ['VERIFIED'],
  VERIFIED: ['INTERNAL_APPROVED'],
  INTERNAL_APPROVED: ['UPCOMING'],
  UPCOMING: ['PARTIAL'],
  PARTIAL: ['SETTLED', 'UPCOMING'],
  // SETTLED → PARTIAL is intentionally allowed to handle payment reversal
  // (chargeback/estorno) scenarios where a previously settled invoice has
  // a payment reversed and returns to partial payment state.
  SETTLED: ['PARTIAL'],
};

/**
 * Get available next statuses for a given pricing status and user role.
 * Returns only statuses the user is allowed to transition to.
 */
export function getAvailablePricingStatusTransitions(
  currentStatus: TASK_PRICING_STATUS,
  userRole: string,
): TASK_PRICING_STATUS[] {
  const transitions = VALID_TRANSITIONS[currentStatus] || [];

  // FINANCIAL cannot set INTERNAL_APPROVED
  if (userRole === SECTOR_PRIVILEGES.FINANCIAL) {
    return transitions.filter((s) => s !== 'INTERNAL_APPROVED');
  }

  return transitions;
}
