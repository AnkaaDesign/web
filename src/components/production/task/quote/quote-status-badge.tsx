import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TASK_QUOTE_STATUS } from '@/types/task-quote';

interface QuoteStatusBadgeProps {
  status: TASK_QUOTE_STATUS;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
  /** For PARTIAL status: number of paid installments */
  paidCount?: number;
  /** For PARTIAL status: total number of installments */
  totalCount?: number;
}

export function QuoteStatusBadge({ status, className, size = 'default', paidCount, totalCount }: QuoteStatusBadgeProps) {
  const config: Record<TASK_QUOTE_STATUS, { label: string; variant: string }> = {
    PENDING: {
      label: 'Pendente',
      variant: 'secondary',
    },
    // Cor PRÓPRIA, e não o verde de `approved`/`completed`: verde nesta tabela
    // quer dizer "terminou", e aqui falta a contra-assinatura da Ankaa. Também
    // não é o azul de BUDGET_APPROVED e PARTIAL, que já se repetem entre si —
    // quem varre a lista atrás do que está parado do nosso lado precisa achar
    // esta linha sem ler o rótulo.
    SIGNED: {
      label: 'Assinado',
      variant: 'teal',
    },
    // ⚠️ NÃO é o vermelho de `destructive`, que é o do DUE logo abaixo (parcela
    // vencida — dinheiro atrasado, e só o cliente pagando resolve). Vencido sem
    // assinatura não é perda: é trabalho voltando para a mesa do comercial.
    EXPIRED: {
      label: 'Aguardando Reanálise',
      variant: 'expired',
    },
    BUDGET_APPROVED: {
      label: 'Orçamento Aprovado',
      variant: 'processing',
    },
    BILLING_APPROVED: {
      label: 'Faturamento Aprovado',
      variant: 'approved',
    },
    UPCOMING: {
      label: 'A Vencer',
      variant: 'pending',
    },
    DUE: {
      label: 'Vencido',
      variant: 'destructive',
    },
    PARTIAL: {
      label: 'Parcial',
      variant: 'inProgress',
    },
    SETTLED: {
      label: 'Liquidado',
      variant: 'completed',
    },
    CANCELLED: {
      label: 'Cancelado',
      variant: 'cancelled',
    },
  };

  // Normalize casing so an unexpectedly-cased value (e.g. "budget_approved"
  // from a legacy payload) still resolves to a label instead of leaking raw.
  const normalized = (typeof status === 'string' ? status.toUpperCase() : status) as TASK_QUOTE_STATUS;
  const { label, variant } = config[normalized] || { label: 'Desconhecido', variant: 'secondary' };

  // Show paid/total count for PARTIAL status
  const displayLabel = normalized === 'PARTIAL' && paidCount != null && totalCount != null
    ? `Parcial (${paidCount}/${totalCount})`
    : label;

  return (
    <Badge variant={variant as any} size={size} className={cn('font-medium whitespace-nowrap', className)}>
      {displayLabel}
    </Badge>
  );
}
