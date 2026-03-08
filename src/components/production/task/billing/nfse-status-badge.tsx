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
  CANCELLED: 'cancelled',
  ERROR: 'red',
};

export function NfseStatusBadge({ status, className, size = 'default' }: NfseStatusBadgeProps) {
  if (!status) return null;

  const variant = (statusVariantMap[status] || 'default') as any;
  const label = NFSE_STATUS_LABELS[status as NFSE_STATUS] || status;

  return (
    <Badge variant={variant} size={size} className={cn('font-medium whitespace-nowrap', className)}>
      {label}
    </Badge>
  );
}
