import { Badge } from '@/components/ui/badge';
import { BANK_SLIP_STATUS_LABELS } from '@/constants/enum-labels';
import type { BANK_SLIP_STATUS } from '@/constants/enums';
import { cn } from '@/lib/utils';

interface BankSlipStatusBadgeProps {
  status: BANK_SLIP_STATUS | string | null;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
}

const statusVariantMap: Record<string, string> = {
  CREATING: 'processing',
  REGISTERING: 'processing',
  ACTIVE: 'blue',
  OVERDUE: 'red',
  PAID: 'green',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  ERROR: 'red',
};

export function BankSlipStatusBadge({ status, className, size = 'default' }: BankSlipStatusBadgeProps) {
  if (!status) return null;

  const variant = (statusVariantMap[status] || 'default') as any;
  const label = BANK_SLIP_STATUS_LABELS[status as BANK_SLIP_STATUS] || status;

  return (
    <Badge variant={variant} size={size} className={cn('font-medium whitespace-nowrap', className)}>
      {label}
    </Badge>
  );
}
