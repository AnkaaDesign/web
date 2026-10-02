import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TASK_QUOTE_STATUS } from '@/types/budget';
import { BUDGET_STATUS_LABELS } from '@/constants/budget-contract';

interface QuoteStatusBadgeProps {
  status: TASK_QUOTE_STATUS;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
}

/**
 * O ESTADO DO EIXO DO VALOR do orçamento.
 *
 * ⚠️ NÃO serve para faturamento. `BILLING_STATUS` é outro enum, com outros
 * valores e outros rótulos ("Vencido" ali é parcela em atraso; aqui não existe),
 * e reaproveitar este badge lá foi exatamente o que fez a lista de Faturamento
 * mostrar o ciclo do orçamento no lugar do ciclo do pagamento. Para cobrança use
 * `BillingStatusBadge`.
 */
/**
 * A COR de cada estado. O RÓTULO não mora aqui: é o do contrato da API
 * (`BUDGET_STATUS_LABELS`), o mesmo de `TASK_QUOTE_STATUS_LABELS` — antes havia
 * dois mapas de rótulo e eles divergiam ("Aguardando Assinatura" aqui,
 * "Pendente" na API).
 */
const QUOTE_STATUS_VARIANT: Record<TASK_QUOTE_STATUS, string> = {
  // ⚠️ NÃO é o vermelho de `destructive`: voltar para reanálise não é perda, é
  // trabalho voltando para a mesa do comercial. Vermelho nesta casa é parcela
  // em atraso, que é `BILLING_STATUS.OVERDUE` — noutra entidade e noutro badge.
  EXPIRED: 'orange',
  // LEGADO (nenhum orçamento é gravado assim desde a M3o-b).
  SIGNED: 'completed',
  // Em montagem pela Ankaa. A mesma cor do `PENDING` do faturamento (decisão do
  // dono, 17/09): a mesma palavra tem a mesma cor nas duas telas.
  PENDING: 'pending',
  // Requisição é o único estado em que o trabalho ainda NÃO EXISTE — não há
  // serviço, não há valor. Roxo, cor que nenhum outro estado usa.
  REQUESTED: 'purple',
  // Com o cliente, esperando a aprovação do valor. Fora do âmbar de `PENDING`:
  // são as duas esperas que o comercial precisa separar numa varredura.
  IN_NEGOTIATION: 'teal',
  // O valor foi aprovado. AZUL, a mesma cor do `APPROVED` do faturamento
  // (decisão do dono, 17/09): aprovar abre a assinatura e a cobrança, não
  // termina nada. Verde ficou reservado para `SETTLED`.
  APPROVED: 'processing',
  CANCELLED: 'cancelled',
};

/** Rótulo (do contrato) e cor de cada estado — para quem pinta fora do `<Badge>`. */
export const QUOTE_STATUS_CONFIG: Record<TASK_QUOTE_STATUS, { label: string; variant: string }> =
  Object.fromEntries(
    (Object.keys(QUOTE_STATUS_VARIANT) as TASK_QUOTE_STATUS[]).map((status) => [
      status,
      { label: (BUDGET_STATUS_LABELS as Record<string, string>)[status], variant: QUOTE_STATUS_VARIANT[status] },
    ]),
  ) as Record<TASK_QUOTE_STATUS, { label: string; variant: string }>;

/**
 * As classes do MESMO estado para quem não pode usar `<Badge>` — o gatilho do
 * combobox de status, que é um botão sólido com borda.
 *
 * Derivado da variante, e não uma segunda tabela de cores: trocar a variante em
 * `QUOTE_STATUS_CONFIG` troca as duas superfícies juntas, que é o que faltava.
 */
const TRIGGER_CLASS_BY_VARIANT: Record<string, string> = {
  completed: 'bg-green-700 text-white hover:bg-green-800 border-green-800',
  approved: 'bg-green-700 text-white hover:bg-green-800 border-green-800',
  green: 'bg-green-700 text-white hover:bg-green-800 border-green-800',
  processing: 'bg-blue-700 text-white hover:bg-blue-800 border-blue-800',
  pending: 'bg-amber-600 text-white hover:bg-amber-700 border-amber-700',
  expired: 'bg-amber-600 text-white hover:bg-amber-700 border-amber-700',
  orange: 'bg-orange-500 text-white hover:bg-orange-600 border-orange-600',
  cancelled: 'bg-red-700 text-white hover:bg-red-800 border-red-800',
  // Os do portal (20/09/2026). Sem estas linhas `quoteStatusTriggerClass`
  // devolvia `''` e o GATILHO do seletor de status saía INCOLOR ao lado de um
  // badge colorido — mesma palavra, duas aparências, na mesma tela.
  //
  // ⚠️ Este mapa NÃO é derivado de `badgeVariants`: o gatilho é um `<button>` do
  // combobox e precisa de `border-*`, que o `<Badge>` não tem. Variante nova em
  // `QUOTE_STATUS_CONFIG` precisa de linha AQUI também.
  purple: 'bg-purple-600 text-white hover:bg-purple-700 border-purple-700',
  teal: 'bg-teal-500 text-white hover:bg-teal-600 border-teal-600',
  secondary: 'bg-neutral-200 text-neutral-900 hover:bg-neutral-300 border-neutral-300',
};

/** Normaliza a caixa: um `"approved"` legado ainda resolve em vez de vazar cru. */
function normalizeQuoteStatus(status: unknown): TASK_QUOTE_STATUS {
  return (typeof status === 'string' ? status.toUpperCase() : status) as TASK_QUOTE_STATUS;
}

/** A variante de `<Badge>` deste estado — para quem pinta fora deste componente. */
export function quoteStatusVariant(status: unknown): string {
  return QUOTE_STATUS_CONFIG[normalizeQuoteStatus(status)]?.variant ?? 'secondary';
}

/** As classes do gatilho sólido deste estado (combobox de status). */
export function quoteStatusTriggerClass(status: unknown): string {
  return TRIGGER_CLASS_BY_VARIANT[quoteStatusVariant(status)] ?? '';
}

export function QuoteStatusBadge({ status, className, size = 'default' }: QuoteStatusBadgeProps) {
  const normalized = normalizeQuoteStatus(status);
  const { label, variant } = QUOTE_STATUS_CONFIG[normalized] || { label: 'Desconhecido', variant: 'secondary' };

  return (
    <Badge variant={variant as any} size={size} className={cn('font-medium whitespace-nowrap', className)}>
      {label}
    </Badge>
  );
}
