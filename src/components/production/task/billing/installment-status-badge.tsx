import { Badge } from '@/components/ui/badge';
import { INSTALLMENT_STATUS_LABELS } from '@/constants/enum-labels';
import type { INSTALLMENT_STATUS } from '@/constants/enums';
import { cn } from '@/lib/utils';

interface InstallmentStatusBadgeProps {
  status: INSTALLMENT_STATUS | string | null;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
}

const statusVariantMap: Record<string, string> = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  PAID: 'green',
  OVERDUE: 'red',
  CANCELLED: 'cancelled',
};

export function InstallmentStatusBadge({ status, className, size = 'default' }: InstallmentStatusBadgeProps) {
  if (!status) return null;

  const variant = (statusVariantMap[status] || 'default') as any;
  const label = INSTALLMENT_STATUS_LABELS[status as INSTALLMENT_STATUS] || status;

  return (
    <Badge variant={variant} size={size} className={cn('font-medium whitespace-nowrap', className)}>
      {label}
    </Badge>
  );
}
