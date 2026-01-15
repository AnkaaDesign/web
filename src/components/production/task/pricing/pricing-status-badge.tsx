import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TASK_PRICING_STATUS } from '@/types/task-pricing';

interface PricingStatusBadgeProps {
  status: TASK_PRICING_STATUS;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
}

export function PricingStatusBadge({ status, className, size = 'default' }: PricingStatusBadgeProps) {
  const config = {
    DRAFT: {
      label: 'Rascunho',
      variant: 'secondary' as const,
    },
    APPROVED: {
      label: 'Aprovado',
      variant: 'approved' as const,
    },
    REJECTED: {
      label: 'Rejeitado',
      variant: 'rejected' as const,
    },
    CANCELLED: {
      label: 'Cancelado',
      variant: 'cancelled' as const,
    },
  };

  const { label, variant } = config[status];

  return (
    <Badge variant={variant} size={size} className={cn('font-medium whitespace-nowrap', className)}>
      {label}
    </Badge>
  );
}
