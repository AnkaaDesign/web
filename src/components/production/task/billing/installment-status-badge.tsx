import { Badge } from '@/components/ui/badge';
import { INSTALLMENT_STATUS_LABELS } from '@/constants/enum-labels';
import type { INSTALLMENT_STATUS } from '@/constants/enums';
import { cn } from '@/lib/utils';
import { formatPaidInstallmentLabel } from '@/utils';

interface InstallmentStatusBadgeProps {
  status: INSTALLMENT_STATUS | string | null;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
  /** When true, shows "Paga (por fora)" instead of just "Paga" */
  paidExternally?: boolean;
  /** Payment method used (PIX, CASH, TRANSFER, BANK_SLIP, etc.) */
  paymentMethod?: string | null;
}

const statusVariantMap: Record<string, string> = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  PAID: 'green',
  OVERDUE: 'red',
  CANCELLED: 'cancelled',
};

export function InstallmentStatusBadge({ status, className, size = 'default', paidExternally, paymentMethod }: InstallmentStatusBadgeProps) {
  if (!status) return null;

  const variant = (statusVariantMap[status] || 'default') as any;
  let label = INSTALLMENT_STATUS_LABELS[status as INSTALLMENT_STATUS] || status;

  if (status === 'PAID' && paymentMethod) {
    // Normalize so raw "BOLETO" and enum "BANK_SLIP" render one consistent label.
    label = formatPaidInstallmentLabel(paymentMethod) ?? label;
  } else if (status === 'PAID' && paidExternally) {
    label = 'Paga (por fora)';
  }

  return (
    <Badge variant={variant} size={size} className={cn('font-medium whitespace-nowrap', className)}>
      {label}
    </Badge>
  );
}
