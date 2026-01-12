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
      className: 'bg-gray-100 text-gray-700',
    },
    APPROVED: {
      label: 'Aprovado',
      variant: 'success' as const,
      icon: IconCheck,
      className: 'bg-green-100 text-green-700',
    },
    REJECTED: {
      label: 'Rejeitado',
      variant: 'destructive' as const,
      icon: IconX,
      className: 'bg-red-100 text-red-700',
    },
    CANCELLED: {
      label: 'Cancelado',
      variant: 'outline' as const,
      icon: IconBan,
      className: 'bg-gray-50 text-gray-600',
    },
  };

  const { label, variant, icon: Icon, className: statusClass } = config[status];

  return (
    <Badge variant={variant} className={`${statusClass} ${className}`}>
      <Icon className="w-3 h-3 mr-1" />
      {label}
    </Badge>
  );
}
