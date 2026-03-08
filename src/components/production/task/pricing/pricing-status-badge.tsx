import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TASK_PRICING_STATUS } from '@/types/task-pricing';

interface PricingStatusBadgeProps {
  status: TASK_PRICING_STATUS;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
}

export function PricingStatusBadge({ status, className, size = 'default' }: PricingStatusBadgeProps) {
  const config: Record<TASK_PRICING_STATUS, { label: string; variant: string }> = {
    PENDING: {
      label: 'Pendente',
      variant: 'secondary',
    },
    BUDGET_APPROVED: {
      label: 'Orçamento Aprovado',
      variant: 'approved',
    },
    VERIFIED: {
      label: 'Verificado',
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
