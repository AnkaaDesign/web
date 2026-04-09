/**
 * Task Quote calculation utilities for global customer discount.
 */

export function computeConfigDiscount(
  subtotal: number,
  discountType?: string,
  discountValue?: number | null,
): number {
  if (!discountType || discountType === 'NONE' || !discountValue) return 0;
  if (discountType === 'PERCENTAGE')
    return Math.round(((subtotal * discountValue) / 100) * 100) / 100;
  if (discountType === 'FIXED_VALUE') return Math.min(discountValue, subtotal);
  return 0;
}

export function computeCustomerConfigTotals(
  services: Array<{
    amount?: number | null;
    invoiceToCustomerId?: string | null;
  }>,
  customerId: string,
  isSingleConfig: boolean,
  discountType?: string,
  discountValue?: number | null,
) {
  const assigned = services.filter(
    (s) =>
      s.invoiceToCustomerId === customerId ||
      (isSingleConfig && !s.invoiceToCustomerId),
  );
  const subtotal = assigned.reduce((sum, s) => sum + (s.amount || 0), 0);
  const discount = computeConfigDiscount(subtotal, discountType, discountValue);
  const total = Math.max(0, subtotal - discount);
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}
