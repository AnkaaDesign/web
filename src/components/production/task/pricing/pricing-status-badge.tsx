import { Badge } from '@/components/ui/badge';
import { IconCheck, IconX, IconClock, IconBan } from '@tabler/icons-react';
import type { TASK_PRICING_STATUS } from '@/types/task-pricing';

interface PricingStatusBadgeProps {
  status: TASK_PRICING_STATUS;
  className?: string;
}

export function PricingStatusBadge({ status, className }: PricingStatusBadgeProps) {
  const config = {
    DRAFT: {
      label: 'Rascunho',
      variant: 'secondary' as const,
      icon: IconClock,
    },
    APPROVED: {
      label: 'Aprovado',
      variant: 'approved' as const,
      icon: IconCheck,
    },
    REJECTED: {
      label: 'Rejeitado',
      variant: 'rejected' as const,
      icon: IconX,
    },
    CANCELLED: {
      label: 'Cancelado',
      variant: 'cancelled' as const,
      icon: IconBan,
    },
  };

  const { label, variant, icon: Icon } = config[status];

  return (
    <Badge variant={variant} className={className}>
      <Icon className="w-3 h-3 mr-1" />
      {label}
    </Badge>
  );
}
