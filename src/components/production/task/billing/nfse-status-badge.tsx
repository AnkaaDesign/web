import { Badge } from '@/components/ui/badge';
import { NFSE_STATUS_LABELS } from '@/constants/enum-labels';
import type { NFSE_STATUS } from '@/constants/enums';
import { cn } from '@/lib/utils';

interface NfseStatusBadgeProps {
  status: NFSE_STATUS | string | null;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
}

const statusVariantMap: Record<string, string> = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  AUTHORIZED: 'green',
  CANCEL_REQUESTED: 'amber',
  CANCEL_REJECTED: 'red',
  CANCELLED: 'cancelled',
  ERROR: 'red',
};

// Labels for the cancellation-lifecycle statuses not present in NFSE_STATUS_LABELS.
const EXTRA_STATUS_LABELS: Record<string, string> = {
  AUTHORIZED: 'Emitida',
  CANCEL_REQUESTED: 'Aguardando Fiscal',
  CANCEL_REJECTED: 'Cancelamento Rejeitado',
};

export function NfseStatusBadge({ status, className, size = 'default' }: NfseStatusBadgeProps) {
  if (!status) return null;

  const variant = (statusVariantMap[status] || 'default') as any;
  const label = EXTRA_STATUS_LABELS[status] || NFSE_STATUS_LABELS[status as NFSE_STATUS] || status;

  return (
    <Badge variant={variant} size={size} className={cn('font-medium whitespace-nowrap', className)}>
      {label}
    </Badge>
  );
}
