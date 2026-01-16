import { formatCurrency, formatDate } from './index';
import type { TaskPricing, PAYMENT_CONDITION } from '../types/task-pricing';

/**
 * Convert number to written form in Portuguese
 */
function numberToWord(n: number): string {
  const words: Record<number, string> = {
    1: 'uma',
    2: 'duas',
    3: 'três',
    4: 'quatro',
    5: 'cinco',
    6: 'seis',
    7: 'sete',
  };
  return words[n] || n.toString();
}

/**
 * Get the number of installments from payment condition
 */
function getInstallmentCount(condition: PAYMENT_CONDITION | null): number {
  if (!condition) return 0;

  const countMap: Record<PAYMENT_CONDITION, number> = {
    CASH: 1,
    INSTALLMENTS_2: 2,
    INSTALLMENTS_3: 3,
    INSTALLMENTS_4: 4,
    INSTALLMENTS_5: 5,
    INSTALLMENTS_6: 6,
    INSTALLMENTS_7: 7,
    CUSTOM: 0,
  };

  return countMap[condition] || 0;
}

/**
 * Generate payment terms text based on pricing data
 * If customPaymentText is provided, it overrides the auto-generated text
 *
 * Payment structure:
 * - CASH: 1 payment (à vista)
 * - INSTALLMENTS_2: 2 payments (entrada + 20 days)
 * - INSTALLMENTS_3: 3 payments (entrada + 20 + 40 days)
 * - etc. (always 20 days interval between payments)
 */
export function generatePaymentText(pricing: TaskPricing): string {
  // If custom text is provided, use it
  if (pricing.customPaymentText) {
    return pricing.customPaymentText;
  }

  // No payment condition, return empty
  if (!pricing.paymentCondition || pricing.paymentCondition === 'CUSTOM') {
    return '';
  }

  const installmentCount = getInstallmentCount(pricing.paymentCondition);
  if (installmentCount === 0) return '';

  const total = pricing.total;
  const installmentValue = Math.round((total / installmentCount) * 100) / 100;
  const word = numberToWord(installmentCount);

  // Format the down payment date if available
  const dateText = pricing.downPaymentDate
    ? ` em ${formatDate(new Date(pricing.downPaymentDate))}`
    : '';

  // Single payment (à vista)
  if (installmentCount === 1) {
    return `Pagamento à vista no valor de ${formatCurrency(total)}${dateText}.`;
  }

  // Two payments (Entrada + 20)
  if (installmentCount === 2) {
    return `Fica acertado o pagamento em 2 (${word}) parcelas de ${formatCurrency(installmentValue)}, a primeira${dateText} e a segunda em 20 dias a contar da primeira parcela.`;
  }

  // Multiple payments - build the payment schedule description
  return `Fica acertado o pagamento em ${installmentCount} (${word}) parcelas de ${formatCurrency(installmentValue)}, a primeira${dateText} e as demais a cada 20 dias a contar da primeira parcela.`;
}

/**
 * Generate guarantee terms text based on pricing data
 * If customGuaranteeText is provided, it overrides the auto-generated text
 */
export function generateGuaranteeText(pricing: TaskPricing): string {
  // If custom text is provided, use it
  if (pricing.customGuaranteeText) {
    return pricing.customGuaranteeText;
  }

  // No guarantee years, return empty
  if (!pricing.guaranteeYears) {
    return '';
  }

  return `A Garantia para o serviço de pintura é de ${pricing.guaranteeYears} anos desde que seja atendido as condições de uso e cuidado do implemento.`;
}
