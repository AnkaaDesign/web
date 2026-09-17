import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TASK_QUOTE_STATUS } from '@/types/task-quote';

interface QuoteStatusBadgeProps {
  status: TASK_QUOTE_STATUS;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
}

/**
 * O ESTADO DO ORÇAMENTO — os cinco, e nada além.
 *
 * ⚠️ NÃO serve para faturamento. `BILLING_STATUS` é outro enum, com outros
 * valores e outros rótulos ("Vencido" ali é parcela em atraso; aqui não existe),
 * e reaproveitar este badge lá foi exatamente o que fez a lista de Faturamento
 * mostrar o ciclo do orçamento no lugar do ciclo do pagamento. Para cobrança use
 * `BillingStatusBadge`.
 */
export function QuoteStatusBadge({ status, className, size = 'default' }: QuoteStatusBadgeProps) {
  const config: Record<TASK_QUOTE_STATUS, { label: string; variant: string }> = {
    // ⚠️ NÃO é o vermelho de `destructive`: vencer sem assinatura não é perda, é
    // trabalho voltando para a mesa do comercial. Vermelho nesta casa é parcela
    // em atraso, que é `BILLING_STATUS.OVERDUE` — noutra entidade e noutro badge.
    EXPIRED: {
      label: 'Aguardando Reanálise',
      variant: 'expired',
    },
    // Cor PRÓPRIA, e não o verde de `approved`/`completed`: verde nesta tabela
    // quer dizer "terminou", e aqui falta a contra-assinatura da Ankaa. Quem
    // varre a lista atrás do que está parado do NOSSO lado precisa achar esta
    // linha sem ler o rótulo.
    SIGNED: {
      label: 'Assinado',
      variant: 'teal',
    },
    PENDING: {
      label: 'Pendente',
      variant: 'secondary',
    },
    // O ÚLTIMO estado do orçamento — daqui em diante quem anda é a COBRANÇA.
    APPROVED: {
      label: 'Aprovado',
      variant: 'approved',
    },
    CANCELLED: {
      label: 'Cancelado',
      variant: 'cancelled',
    },
  };

  // Normalize casing so an unexpectedly-cased value (e.g. "approved" from a
  // legacy payload) still resolves to a label instead of leaking raw.
  const normalized = (typeof status === 'string' ? status.toUpperCase() : status) as TASK_QUOTE_STATUS;
  const { label, variant } = config[normalized] || { label: 'Desconhecido', variant: 'secondary' };

  return (
    <Badge variant={variant as any} size={size} className={cn('font-medium whitespace-nowrap', className)}>
      {label}
    </Badge>
  );
}
