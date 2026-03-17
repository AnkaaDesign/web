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
    CASH_5: 1,
    CASH_40: 1,
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
 * Due dates are calculated from task.finishedAt at BILLING_APPROVED time.
 */
interface PaymentTextData {
  customPaymentText: string | null;
  paymentCondition?: string | null;
  total: number;
}

/**
 * Generate payment terms text based on payment data
 * If customPaymentText is provided, it overrides the auto-generated text
 *
 * Payment structure:
 * - CASH_5: 1 payment, 5 days from task completion
 * - CASH_40: 1 payment, 40 days from task completion
 * - INSTALLMENTS_N: N payments, first at 5 days from task completion, subsequent +20 days
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

  const total = quote.total;

  // CASH_5: single payment, 5 days from completion
  if (quote.paymentCondition === 'CASH_5') {
    return `Pagamento à vista no valor de ${formatCurrency(total)} para 5 dias a partir da finalização do serviço.`;
  }

  // CASH_40: single payment, 40 days from completion
  if (quote.paymentCondition === 'CASH_40') {
    return `Pagamento à vista no valor de ${formatCurrency(total)} para 40 dias a partir da finalização do serviço.`;
  }

  const installmentCount = getInstallmentCount(quote.paymentCondition);
  if (installmentCount === 0) return '';

  const installmentValue = Math.round((total / installmentCount) * 100) / 100;
  const word = numberToWord(installmentCount);

  return `Fica acertado o pagamento em ${installmentCount} (${word}) parcelas de ${formatCurrency(installmentValue)}, com entrada para 5 dias a partir da finalização do serviço e as demais a cada 20 dias.`;
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
