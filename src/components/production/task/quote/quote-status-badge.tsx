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
    BUDGET_APPROVED: {
      label: 'Orçamento Aprovado',
      variant: 'approved',
    },
    VERIFIED_BY_FINANCIAL: {
      label: 'Verificado pelo Financeiro',
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
  };

  const { label, variant } = config[status] || { label: status, variant: 'secondary' };

  // Show paid/total count for PARTIAL status
  const displayLabel = status === 'PARTIAL' && paidCount != null && totalCount != null
    ? `Parcial (${paidCount}/${totalCount})`
    : label;

  return (
    <Badge variant={variant as any} size={size} className={cn('font-medium whitespace-nowrap', className)}>
      {displayLabel}
    </Badge>
  );
}
