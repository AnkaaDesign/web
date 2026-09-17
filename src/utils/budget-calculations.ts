/**
 * Task Quote calculation utilities for global customer discount.
 */

/** The discount terms of a billing config — the part that belongs to the DEAL and
 *  must survive a change of billing customer. */
export interface ConfigDiscountTerms {
  discountType: string;
  discountValue: number | null;
  discountReference: string | null;
}

/** True when a config carries no effective discount: absent, NONE, or zero-valued. */
export function hasNoEffectiveDiscount(config?: {
  discountType?: string | null;
  discountValue?: number | null;
}): boolean {
  if (!config) return true;
  const t = config.discountType;
  if (!t || t === 'NONE') return true;
  return Number(config.discountValue ?? 0) === 0;
}

export function pickDiscountTerms(config: any): ConfigDiscountTerms {
  return {
    discountType: config?.discountType ?? 'NONE',
    discountValue: config?.discountValue ?? null,
    discountReference: config?.discountReference ?? null,
  };
}

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
  const assigned = isSingleConfig
    ? services
    : services.filter((s) => s.invoiceToCustomerId === customerId);
  const subtotal = assigned.reduce((sum, s) => sum + (s.amount || 0), 0);
  const discount = computeConfigDiscount(subtotal, discountType, discountValue);
  const total = Math.max(0, subtotal - discount);
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}
