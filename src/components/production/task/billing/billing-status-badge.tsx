import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BillingStatusBadgeProps {
  status: string | null;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
}

/**
 * @deprecated paymentStatus was removed from the Task type.
 * This component is kept for backward compatibility but renders nothing.
 */
export function BillingStatusBadge({ status, className, size = 'default' }: BillingStatusBadgeProps) {
  if (!status) return null;

  return (
    <Badge variant="secondary" size={size} className={cn('font-medium whitespace-nowrap', className)}>
      {status}
    </Badge>
  );
}
