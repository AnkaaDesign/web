// Generated output (PDF/planilha/texto) carries REAL values even while the screen is masked.
import { formatCurrencyUnmasked as formatCurrency, formatDate } from './index';
import type { PaymentConfig, TaskQuote } from '../types/task-quote';

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
 * "1 dia" / "20 dias" — the clause reads broken without the singular form.
 */
function formatDays(n: number): string {
  return `${n} ${n === 1 ? 'dia' : 'dias'}`;
}

/**
 * Customer-facing wording for the settlement method, woven INTO the payment
 * clause ("...parcelas de R$ 1.499,67 via boleto, com entrada...") rather than
 * appended as a separate line. MANUAL/OTHER map to nothing — there's no
 * sentence-worthy wording for them, so the clause simply omits the method.
 */
const PAYMENT_METHOD_PHRASES: Record<string, string> = {
  BANK_SLIP: 'via boleto',
  PIX: 'via Pix',
  CASH: 'em dinheiro',
  TRANSFER: 'via transferência bancária',
  ACCOUNT_GENIVALDO: 'via depósito em conta',
  ACCOUNT_SERGIO: 'via depósito em conta',
};

/** Parse a `YYYY-MM-DD` config date as a LOCAL date (no timezone shift). */
function parseSpecificDate(iso?: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Map the legacy `paymentCondition` string enum onto the structured config, so
 * both shapes produce the exact same sentence (entry in 5 days, others every
 * 20 days — the wording the legacy enum always carried).
 */
export function conditionToConfig(condition?: string | null): PaymentConfig | null {
  if (!condition || condition === 'CUSTOM') return null;
  const cashDays: Record<string, number> = { CASH_5: 5, CASH_10: 10, CASH_20: 20, CASH_40: 40 };
  if (condition in cashDays) return { type: 'CASH', cashDays: cashDays[condition] };
  const counts: Record<string, number> = {
    INSTALLMENTS_2: 2, INSTALLMENTS_3: 3, INSTALLMENTS_4: 4,
    INSTALLMENTS_5: 5, INSTALLMENTS_6: 6, INSTALLMENTS_7: 7,
  };
  const installmentCount = counts[condition];
  if (!installmentCount) return null;
  return { type: 'INSTALLMENTS', installmentCount, installmentStep: 20, entryDays: 5 };
}

/**
 * Generate human-readable payment text from a structured PaymentConfig.
 * [methodPhrase] is pre-spaced (" via boleto") or empty; [firstDueDate] is the
 * concrete vencimento of the first payment when it's already known.
 */
function generatePaymentTextFromConfig(
  pc: PaymentConfig,
  total: number,
  methodPhrase: string,
  firstDueDate: Date | null,
): string {
  // A known vencimento always beats the relative "a partir da finalização do
  // serviço" wording — on a dossiê the service IS finished, so the customer
  // should read the actual date, not a countdown from an event in the past.
  const dueDate = firstDueDate ?? parseSpecificDate(pc.specificDate);

  if (pc.type === 'CASH') {
    const head = `Pagamento à vista no valor de ${formatCurrency(total)}${methodPhrase}`;
    return dueDate
      ? `${head}, com vencimento em ${formatDate(dueDate)}.`
      : `${head}, para ${formatDays(pc.cashDays ?? 5)} a partir da finalização do serviço.`;
  }

  if (pc.type === 'INSTALLMENTS') {
    const count = pc.installmentCount ?? 2;
    const step = pc.installmentStep ?? 20;
    const entryDays = pc.entryDays ?? 5;
    const installmentValue = Math.round((total / count) * 100) / 100;
    const word = numberToWord(count);
    const entryText = dueDate
      ? `com entrada em ${formatDate(dueDate)}`
      : `com entrada para ${formatDays(entryDays)} a partir da finalização do serviço`;

    return `Fica acertado o pagamento em ${count} (${word}) parcelas de ${formatCurrency(installmentValue)}${methodPhrase}, ${entryText} e as demais a cada ${formatDays(step)}.`;
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
  /**
   * InstallmentPaymentMethod wire value. Overrides `paymentConfig.method` —
   * the dossiê passes what the real Installments actually carry.
   */
  paymentMethod?: string | null;
  /**
   * Concrete vencimento of the first payment (real installment, or projected
   * from the task's finishedAt). Replaces the relative days-based wording.
   */
  firstDueDate?: Date | string | null;
}

/**
 * Generate payment terms text.
 * Priority: customPaymentText → paymentConfig (new) → paymentCondition (legacy)
 */
export function generatePaymentText(quote: PaymentTextData): string {
  // Custom free-text always wins — it's the user's own wording, verbatim.
  if (quote.customPaymentText) {
    return quote.customPaymentText;
  }

  const config = quote.paymentConfig?.type
    ? quote.paymentConfig
    : conditionToConfig(quote.paymentCondition);
  if (!config) return '';

  // Anything that isn't explicitly Pix settles as boleto — mirrors the API's
  // `resolveInstallmentPaymentMethod`, so the prose names the same method the
  // generated Installments carry.
  const method = quote.paymentMethod || quote.paymentConfig?.method || 'BANK_SLIP';
  const phrase = PAYMENT_METHOD_PHRASES[method];
  const methodPhrase = phrase ? ` ${phrase}` : '';

  const parsedDue = quote.firstDueDate ? new Date(quote.firstDueDate) : null;
  const firstDueDate = parsedDue && !isNaN(parsedDue.getTime()) ? parsedDue : null;

  return generatePaymentTextFromConfig(config, quote.total, methodPhrase, firstDueDate);
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
