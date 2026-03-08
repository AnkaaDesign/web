import { Badge } from '@/components/ui/badge';
import { PAYMENT_METHOD_LABELS } from '@/constants/enum-labels';
import type { PAYMENT_METHOD } from '@/constants/enums';
import { cn } from '@/lib/utils';

interface PaymentMethodBadgeProps {
  method: PAYMENT_METHOD | string | null;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
}

const methodVariantMap: Record<string, string> = {
  PIX: 'purple',
  BANK_SLIP: 'blue',
  CREDIT_CARD: 'orange',
};

export function PaymentMethodBadge({ method, className, size = 'default' }: PaymentMethodBadgeProps) {
  if (!method) return null;

  const variant = (methodVariantMap[method] || 'default') as any;
  const label = PAYMENT_METHOD_LABELS[method as PAYMENT_METHOD] || method;

  return (
    <Badge variant={variant} size={size} className={cn('font-medium whitespace-nowrap', className)}>
      {label}
    </Badge>
  );
}
