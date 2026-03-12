import { formatCurrency, formatDate } from './index';
import type { TaskQuote } from '../types/task-quote';
import type { PAYMENT_CONDITION } from '../constants/enums';

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
function getInstallmentCount(condition: PAYMENT_CONDITION | string | null): number {
  if (!condition) return 0;

  const countMap: Record<string, number> = {
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
 * Payment data needed for generating payment text.
 * paymentCondition and downPaymentDate now live on customer configs,
 * so callers must extract them before calling this function.
 */
interface PaymentTextData {
  customPaymentText: string | null;
  paymentCondition?: string | null;
  downPaymentDate?: Date | string | null;
  total: number;
}

/**
 * Generate payment terms text based on payment data
 * If customPaymentText is provided, it overrides the auto-generated text
 *
 * Payment structure:
 * - CASH: 1 payment (à vista)
 * - INSTALLMENTS_2: 2 payments (entrada + 20 days)
 * - INSTALLMENTS_3: 3 payments (entrada + 20 + 40 days)
 * - etc. (always 20 days interval between payments)
 */
export function generatePaymentText(quote: PaymentTextData): string {
  // If custom text is provided, use it
  if (quote.customPaymentText) {
    return quote.customPaymentText;
  }

  // No payment condition, return empty
  if (!quote.paymentCondition || quote.paymentCondition === 'CUSTOM') {
    return '';
  }

  const installmentCount = getInstallmentCount(quote.paymentCondition);
  if (installmentCount === 0) return '';

  const total = quote.total;
  const installmentValue = Math.round((total / installmentCount) * 100) / 100;
  const word = numberToWord(installmentCount);

  // Format the down payment date if available
  const dateText = quote.downPaymentDate
    ? ` em ${formatDate(new Date(quote.downPaymentDate))}`
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
 * Generate guarantee terms text based on quote data
 * If customGuaranteeText is provided, it overrides the auto-generated text
 */
export function generateGuaranteeText(quote: TaskQuote): string {
  // If custom text is provided, use it
  if (quote.customGuaranteeText) {
    return quote.customGuaranteeText;
  }

  // No guarantee years, return empty
  if (!quote.guaranteeYears) {
    return '';
  }

  return `A Garantia para o serviço de pintura é de ${quote.guaranteeYears} anos desde que seja atendido as condições de uso e cuidado do implemento.`;
}
