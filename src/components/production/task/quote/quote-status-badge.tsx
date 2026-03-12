import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TASK_QUOTE_STATUS } from '@/types/task-quote';

interface QuoteStatusBadgeProps {
  status: TASK_QUOTE_STATUS;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
}

export function QuoteStatusBadge({ status, className, size = 'default' }: QuoteStatusBadgeProps) {
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
    INTERNAL_APPROVED: {
      label: 'Aprovado Internamente',
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

  return (
    <Badge variant={variant as any} size={size} className={cn('font-medium whitespace-nowrap', className)}>
      {label}
    </Badge>
  );
}
