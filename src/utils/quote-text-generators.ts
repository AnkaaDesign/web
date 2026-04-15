import { formatCurrency, formatDate } from './index';
import type { TaskQuote } from '../types/task-quote';

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
 * PaymentConfig shape — mirrors the API/schema definition.
 * Kept local here to avoid a circular import on the schema package.
 */
interface PaymentConfig {
  type: 'CASH' | 'INSTALLMENTS';
  cashDays?: number;
  installmentCount?: number;
  installmentStep?: number;
  entryDays?: number;
  specificDate?: string; // YYYY-MM-DD
}

/**
 * Generate human-readable payment text from a structured PaymentConfig.
 */
function generatePaymentTextFromConfig(pc: PaymentConfig, total: number): string {
  if (pc.type === 'CASH') {
    if (pc.specificDate) {
      // Parse as local date to avoid timezone shifts
      const [y, m, d] = pc.specificDate.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return `Pagamento à vista no valor de ${formatCurrency(total)}, com vencimento em ${formatDate(date)}.`;
    }
    const days = pc.cashDays ?? 5;
    return `Pagamento à vista no valor de ${formatCurrency(total)}, para ${days} dias a partir da finalização do serviço.`;
  }

  if (pc.type === 'INSTALLMENTS') {
    const count = pc.installmentCount ?? 2;
    const step = pc.installmentStep ?? 20;
    const entryDays = pc.entryDays ?? 5;
    const installmentValue = Math.round((total / count) * 100) / 100;
    const word = numberToWord(count);

    let entryText: string;
    if (pc.specificDate) {
      const [y, m, d] = pc.specificDate.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      entryText = `com entrada em ${formatDate(date)}`;
    } else {
      entryText = `com entrada para ${entryDays} dias a partir da finalização do serviço`;
    }

    return `Fica acertado o pagamento em ${count} (${word}) parcelas de ${formatCurrency(installmentValue)}, ${entryText} e as demais a cada ${step} dias.`;
  }

  return '';
}

/**
 * Payment data needed for generating payment text.
 */
interface PaymentTextData {
  customPaymentText: string | null;
  /** New structured config — takes priority when present */
  paymentConfig?: PaymentConfig | null;
  /** Legacy string enum — used as fallback */
  paymentCondition?: string | null;
  total: number;
}

/**
 * Generate payment terms text.
 * Priority: customPaymentText → paymentConfig (new) → paymentCondition (legacy)
 */
export function generatePaymentText(quote: PaymentTextData): string {
  // Custom free-text always wins
  if (quote.customPaymentText) {
    return quote.customPaymentText;
  }

  // New structured config
  if (quote.paymentConfig?.type) {
    return generatePaymentTextFromConfig(quote.paymentConfig, quote.total);
  }

  // Legacy string enum fallback
  const condition = quote.paymentCondition;
  if (!condition || condition === 'CUSTOM') return '';

  const total = quote.total;

  if (condition === 'CASH_5')  return `Pagamento à vista no valor de ${formatCurrency(total)}, para 5 dias a partir da finalização do serviço.`;
  if (condition === 'CASH_10') return `Pagamento à vista no valor de ${formatCurrency(total)}, para 10 dias a partir da finalização do serviço.`;
  if (condition === 'CASH_20') return `Pagamento à vista no valor de ${formatCurrency(total)}, para 20 dias a partir da finalização do serviço.`;
  if (condition === 'CASH_40') return `Pagamento à vista no valor de ${formatCurrency(total)}, para 40 dias a partir da finalização do serviço.`;

  const countMap: Record<string, number> = {
    INSTALLMENTS_2: 2, INSTALLMENTS_3: 3, INSTALLMENTS_4: 4,
    INSTALLMENTS_5: 5, INSTALLMENTS_6: 6, INSTALLMENTS_7: 7,
  };
  const installmentCount = countMap[condition];
  if (!installmentCount) return '';

  const installmentValue = Math.round((total / installmentCount) * 100) / 100;
  const word = numberToWord(installmentCount);
  return `Fica acertado o pagamento em ${installmentCount} (${word}) parcelas de ${formatCurrency(installmentValue)}, com entrada para 5 dias a partir da finalização do serviço e as demais a cada 20 dias.`;
}

/**
 * Generate guarantee terms text based on quote data
 */
export function generateGuaranteeText(quote: TaskQuote): string {
  if (quote.customGuaranteeText) {
    return quote.customGuaranteeText;
  }
  if (!quote.guaranteeYears) {
    return '';
  }
  return `A Garantia para o serviço de pintura é de ${quote.guaranteeYears} anos desde que seja atendido as condições de uso e cuidado do implemento.`;
}
