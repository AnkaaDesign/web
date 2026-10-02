import { BUDGET_MANUAL_TRANSITIONS, SECTOR_PRIVILEGES } from '@/constants';
import type { SECTOR_PRIVILEGES as SECTOR_PRIVILEGES_TYPE } from '@/constants';
import type { TASK_QUOTE_STATUS } from '@/types/budget';

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
 * Quem pode mexer no status DO ORÇAMENTO.
 *
 * ADMIN, FINANCEIRO e COMERCIAL abrem o seletor; o que cada um pode escolher é
 * decidido em `getAvailableQuoteStatusTransitions`. Aprovar FATURAMENTO não
 * passa mais por aqui — é `PUT /billings/:id/approve`, e o gate é o da rota
 * (ADMIN/FINANCEIRO).
 */
export function canUpdateQuoteStatus(userRole: string): boolean {
  return [
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.FINANCIAL,
    SECTOR_PRIVILEGES.COMMERCIAL,
  ].includes(userRole as SECTOR_PRIVILEGES_TYPE);
}

/**
 * O GRAFO DO EIXO DO VALOR — as arestas que uma pessoa pode pedir, lidas do
 * contrato da API (`orcamento.transicoesManuais`). A API delega cada destino ao
 * ATO correspondente: `→ APPROVED` exige nota (aprovar em nome do cliente),
 * `APPROVED → PENDING` exige motivo (reprovar o valor), `→ IN_NEGOTIATION` exige
 * valor (enviar ao cliente). Por isso as telas não "caminham" de estado em
 * estado: chamam os atos (`budgetService.approveValue`, `sendToCustomer`, …).
 *
 * Era um espelho escrito à mão — e ficou com `PRE_APPROVED` depois que a API o
 * apagou.
 */
const VALID_TRANSITIONS = BUDGET_MANUAL_TRANSITIONS as Record<TASK_QUOTE_STATUS, readonly TASK_QUOTE_STATUS[]>;

/**
 * Os destinos legais a partir de `currentStatus` para este setor.
 *
 * ⚠️ APROVAR O ORÇAMENTO É DO COMERCIAL. Espelha `validateQuoteStatusChangeRole`
 * na API, que restringe `APPROVED` a ADMIN/COMERCIAL — o FINANCEIRO não aprova
 * venda, ele aprova COBRANÇA, e isso é outro botão e outra rota
 * (`PUT /billings/:id/approve`). Antes era o contrário: o filtro tirava
 * `BILLING_APPROVED` do COMERCIAL, porque os dois atos moravam no mesmo enum.
 */
export function getAvailableQuoteStatusTransitions(
  currentStatus: TASK_QUOTE_STATUS,
  userRole: string,
): TASK_QUOTE_STATUS[] {
  const transitions = [...(VALID_TRANSITIONS[currentStatus] || [])];

  if (userRole === SECTOR_PRIVILEGES.FINANCIAL) {
    return transitions.filter((s) => s !== 'APPROVED');
  }

  return transitions;
}

/**
 * Compute the ordered sequence of legal status hops to get from `from` to `to`.
 * Returns the statuses to APPLY in order (excluding `from`, including `to`), or
 * [] when `from === to` or no legal path exists.
 *
 * The status dropdowns gate their options by the *form* status, so within one
 * editing session a user can step back and forth (e.g. APPROVED → PENDING →
 * APPROVED). The server only accepts single legal hops, so the save must replay
 * the path hop-by-hop. BFS yields the shortest legal path through
 * VALID_TRANSITIONS.
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
