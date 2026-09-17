import { SECTOR_PRIVILEGES } from '@/constants';
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
 * O GRAFO DO ORÇAMENTO — quatro arestas, e nenhuma delas é de cobrança.
 *
 * Fluxo: PENDING → APPROVED, com SIGNED e EXPIRED entrando pela CERIMÔNIA de
 * assinatura (por isso não são DESTINO de ninguém aqui: o que as linhas deles
 * declaram é como se SAI deles), e CANCELLED como terminal.
 *
 * ⚠️ O GRAFO ENCOLHEU EM 16/09/2026. Ele descrevia também o ciclo do pagamento —
 * BILLING_APPROVED → UPCOMING → PARTIAL/DUE → SETTLED, com as voltas de estorno.
 * Nada disso é transição de orçamento: é a cobrança andando, e a cobrança agora
 * é o `Billing`, cujo estado NINGUÉM digita (`BillingStatusCascadeService` o
 * deriva das parcelas). Some com isso uma classe inteira de defeito que este
 * grafo tinha por construção: um orçamento com duas cobranças, uma paga e outra
 * vencida, precisava escolher UMA aresta — escolhia a última que rodasse.
 *
 * ⚠️ ESPELHA `validateStatusTransition` em
 * `api/src/modules/production/task-quote/task-quote.service.ts`, byte a byte.
 * Divergir faz a tela oferecer uma transição que o servidor devolve em 400.
 */
const VALID_TRANSITIONS: Record<TASK_QUOTE_STATUS, TASK_QUOTE_STATUS[]> = {
  // Vencido sem todas as assinaturas. O comercial reanalisa o valor: reformula
  // (o que já devolve o orçamento a PENDING pelo auto-revert do servidor),
  // estende a validade, ou cancela. NÃO vai direto para APPROVED — aprovar sem
  // assinatura é exatamente o que a cerimônia existe para impedir.
  EXPIRED: ['PENDING', 'CANCELLED'],
  // De SIGNED não se vai para EXPIRED: aceita a proposta dentro do prazo, o
  // relógio para de correr contra o cliente — o que falta é nosso.
  SIGNED: ['APPROVED', 'PENDING', 'CANCELLED'],
  PENDING: ['APPROVED', 'CANCELLED'],
  // APPROVED é o ÚLTIMO estado do orçamento: dele só se volta ou se cancela.
  // APPROVED → PENDING existe para o caminho de desistência mais comum, o
  // cliente voltando atrás ANTES de haver cobrança. Depois que alguma cobrança
  // foi aprovada o servidor barra a edição (`isQuoteMoneyLocked`) e o caminho é
  // "Reverter Faturamento" — hoje `PUT /billings/:id/revert`, que desfaz AQUELA
  // cobrança (baixa os boletos dela e deixa a NFS-e viva para ser substituída).
  // `PUT /budgets/:id/revert-billing` continua de pé, mas desmonta o ciclo do
  // orçamento INTEIRO e nenhuma tela o chama.
  APPROVED: ['PENDING', 'CANCELLED'],
  // Terminal: um orçamento cancelado não volta. Recotar cria um novo.
  CANCELLED: [],
};

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
  const transitions = VALID_TRANSITIONS[currentStatus] || [];

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
