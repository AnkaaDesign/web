import { SECTOR_PRIVILEGES } from '@/constants';
import type { SECTOR_PRIVILEGES as SECTOR_PRIVILEGES_TYPE } from '@/constants';
import type { TASK_QUOTE_STATUS } from '@/types/task-quote';

export function canViewQuote(userRole: string): boolean {
  return [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.COMMERCIAL,
  ].includes(userRole as SECTOR_PRIVILEGES_TYPE);
}

export function canCreateQuote(userRole: string): boolean {
  return [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL].includes(userRole as SECTOR_PRIVILEGES_TYPE);
}

export function canEditQuote(userRole: string): boolean {
  return [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.COMMERCIAL,
  ].includes(userRole as SECTOR_PRIVILEGES_TYPE);
}

export function canApproveQuote(userRole: string): boolean {
  return [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.FINANCIAL].includes(userRole as SECTOR_PRIVILEGES_TYPE);
}

export function canDeleteQuote(userRole: string): boolean {
  return userRole === SECTOR_PRIVILEGES.ADMIN;
}

/**
 * Check if user can update task quote status.
 * ADMIN, FINANCIAL, and COMMERCIAL can update status.
 * COMMERCIAL cannot set BILLING_APPROVED (only ADMIN/FINANCIAL can).
 */
export function canUpdateQuoteStatus(userRole: string): boolean {
  return [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.COMMERCIAL,
  ].includes(userRole as SECTOR_PRIVILEGES_TYPE);
}

/**
 * Valid status transitions for task quote.
 *
 * Typical flow:
 *   PENDING -> BUDGET_APPROVED -> COMMERCIAL_APPROVED -> BILLING_APPROVED -> UPCOMING -> PARTIAL -> SETTLED
 *
 * DUE status represents overdue installments:
 *   UPCOMING -> DUE (when installments become overdue)
 *   DUE -> PARTIAL (when overdue installment gets paid but not all)
 *   DUE -> SETTLED (when last installment gets paid)
 *   PARTIAL -> DUE (when another installment becomes overdue)
 *
 * BILLING_APPROVED is a critical transition: it triggers automatic invoice
 * and boleto generation, which is hard to reverse. The UI should confirm
 * before allowing this transition.
 *
 * Currently all statuses can transition to any other status (except themselves)
 * to allow administrative corrections.
 */
const VALID_TRANSITIONS: Record<TASK_QUOTE_STATUS, TASK_QUOTE_STATUS[]> = {
  PENDING: ['BUDGET_APPROVED'],
  BUDGET_APPROVED: ['COMMERCIAL_APPROVED', 'PENDING'],
  // SETTLED from COMMERCIAL_APPROVED covers "direct" quotes (orçamento direto)
  // paid upfront with no billing/installment phase. The server's settleManually
  // handles this safely (no installments/boletos exist yet to clean up).
  COMMERCIAL_APPROVED: ['BILLING_APPROVED', 'BUDGET_APPROVED', 'PENDING', 'SETTLED'],
  // SETTLED from BILLING_APPROVED covers prepayment (customer pays before
  // installments are tracked) and recovery from quotes stuck at BILLING_APPROVED
  // when the auto-transition to UPCOMING failed. The server's settleManually
  // handles installment + boleto cleanup safely from this state.
  BILLING_APPROVED: ['UPCOMING', 'SETTLED'],
  UPCOMING: ['PARTIAL', 'DUE', 'BILLING_APPROVED', 'SETTLED'],
  DUE: ['PARTIAL', 'SETTLED', 'UPCOMING'],
  PARTIAL: ['SETTLED', 'DUE', 'UPCOMING'],
  // SETTLED -> PARTIAL is intentionally allowed to handle payment reversal
  // (chargeback/estorno) scenarios where a previously settled invoice has
  // a payment reversed and returns to partial payment state.
  SETTLED: ['PARTIAL'],
};

/**
 * Get available next statuses for a given quote status and user role.
 * Returns only statuses the user is allowed to transition to.
 */
export function getAvailableQuoteStatusTransitions(
  currentStatus: TASK_QUOTE_STATUS,
  userRole: string,
): TASK_QUOTE_STATUS[] {
  const transitions = VALID_TRANSITIONS[currentStatus] || [];

  // COMMERCIAL cannot set BILLING_APPROVED
  if (userRole === SECTOR_PRIVILEGES.COMMERCIAL) {
    return transitions.filter((s) => s !== 'BILLING_APPROVED');
  }

  // FINANCIAL cannot set COMMERCIAL_APPROVED (that step belongs to the commercial sector)
  if (userRole === SECTOR_PRIVILEGES.FINANCIAL) {
    return transitions.filter((s) => s !== 'COMMERCIAL_APPROVED');
  }

  return transitions;
}

/**
 * Compute the ordered sequence of legal status hops to get from `from` to `to`.
 * Returns the statuses to APPLY in order (excluding `from`, including `to`), or
 * [] when `from === to` or no legal path exists.
 *
 * The status dropdowns gate their options by the *form* status, so within one
 * editing session a user can advance several steps (e.g. PENDING →
 * BUDGET_APPROVED → COMMERCIAL_APPROVED). The server only accepts single legal
 * hops, so the save must replay the path hop-by-hop. BFS yields the shortest
 * legal path through VALID_TRANSITIONS.
 */
export function getQuoteStatusPath(
  from: TASK_QUOTE_STATUS,
  to: TASK_QUOTE_STATUS,
): TASK_QUOTE_STATUS[] {
  if (from === to) return [];
  const queue: TASK_QUOTE_STATUS[][] = [[from]];
  const visited = new Set<TASK_QUOTE_STATUS>([from]);
  while (queue.length > 0) {
    const path = queue.shift()!;
    const last = path[path.length - 1];
    for (const next of VALID_TRANSITIONS[last] || []) {
      if (next === to) return [...path.slice(1), next];
      if (!visited.has(next)) {
        visited.add(next);
        queue.push([...path, next]);
      }
    }
  }
  return [];
}
