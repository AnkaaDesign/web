/**
 * Task Quote calculation utilities for service-level discounts.
 */

export function computeServiceDiscount(
  amount: number,
  discountType?: string,
  discountValue?: number | null,
): number {
  if (!discountType || discountType === 'NONE' || !discountValue) return 0;
  if (discountType === 'PERCENTAGE')
    return Math.round(((amount * discountValue) / 100) * 100) / 100;
  if (discountType === 'FIXED_VALUE') return Math.min(discountValue, amount);
  return 0;
}

export function computeServiceNet(service: {
  amount: number;
  discountType?: string;
  discountValue?: number | null;
}): number {
  return Math.max(
    0,
    (service.amount || 0) -
      computeServiceDiscount(
        service.amount || 0,
        service.discountType,
        service.discountValue,
      ),
  );
}

export function computeCustomerConfigTotals(
  services: Array<{
    amount?: number | null;
    discountType?: string;
    discountValue?: number | null;
    invoiceToCustomerId?: string | null;
  }>,
  customerId: string,
  isSingleConfig: boolean,
) {
  const assigned = services.filter(
    (s) =>
      s.invoiceToCustomerId === customerId ||
      (isSingleConfig && !s.invoiceToCustomerId),
  );
  const subtotal = assigned.reduce((sum, s) => sum + (s.amount || 0), 0);
  const total = assigned.reduce(
    (sum, s) =>
      sum +
      computeServiceNet({
        amount: s.amount || 0,
        discountType: s.discountType,
        discountValue: s.discountValue,
      }),
    0,
  );
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}
