import { Badge } from '@/components/ui/badge';
import { INVOICE_STATUS_LABELS } from '@/constants/enum-labels';
import type { INVOICE_STATUS } from '@/constants/enums';
import { cn } from '@/lib/utils';

interface InvoiceStatusBadgeProps {
  status: INVOICE_STATUS | string | null;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
}

const statusVariantMap: Record<string, string> = {
  DRAFT: 'gray',
  ACTIVE: 'blue',
  PARTIALLY_PAID: 'yellow',
  PAID: 'green',
  CANCELLED: 'red',
};

export function InvoiceStatusBadge({ status, className, size = 'default' }: InvoiceStatusBadgeProps) {
  if (!status) return null;

  const variant = (statusVariantMap[status] || 'default') as any;
  const label = INVOICE_STATUS_LABELS[status as INVOICE_STATUS] || status;

  return (
    <Badge variant={variant} size={size} className={cn('font-medium whitespace-nowrap', className)}>
      {label}
    </Badge>
  );
}
