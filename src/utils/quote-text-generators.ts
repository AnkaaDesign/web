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
  vehicleCount: number,
  perVehicle: boolean,
): string {
  // A known vencimento always beats the relative "a partir da finalização do
  // serviço" wording — on a dossiê the service IS finished, so the customer
  // should read the actual date, not a countdown from an event in the past.
  const dueDate = firstDueDate ?? parseSpecificDate(pc.specificDate);

  // O ESCOPO da cláusula. Num orçamento de um veículo não existe. Com sessenta,
  // "quatro parcelas de R$ 3.042,60" é ambíguo: em `JOINT` o cliente paga UM
  // plano sobre o total geral (quatro de R$ 182.556,00), em `PER_TASK` paga
  // sessenta planos. Sem dizer qual, o número impresso não identifica a
  // obrigação — e é justamente o número que ele confere antes de assinar.
  // Espelha `paymentScope` em `api/.../signature/document/quote-text.ts`.
  const scope = vehicleCount > 1 && perVehicle ? `, para cada um dos ${vehicleCount} veículos,` : '';
  const chargeNote = (perCharge: number): string =>
    vehicleCount > 1 && perVehicle ? ` Serão ${perCharge * vehicleCount} cobranças no total.` : '';

  if (pc.type === 'CASH') {
    const head = `Pagamento à vista${scope} no valor de ${formatCurrency(total)}${methodPhrase}`;
    const tail = dueDate
      ? `, com vencimento em ${formatDate(dueDate)}.`
      : `, para ${formatDays(pc.cashDays ?? 5)} a partir da finalização do serviço.`;
    return `${head}${tail}${chargeNote(1)}`;
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

    return `Fica acertado o pagamento${scope} em ${count} (${word}) parcelas de ${formatCurrency(installmentValue)}${methodPhrase}, ${entryText} e as demais a cada ${formatDays(step)}.${chargeNote(count)}`;
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
  /**
   * Quantos veículos o orçamento cobre. 1 (ou omitido) produz exatamente o texto
   * de sempre, e é por isso que a esmagadora maioria dos orçamentos não muda uma
   * vírgula.
   */
  vehicleCount?: number | null;
  /**
   * `true` quando cada veículo tem a própria fatura (`billingSplit = PER_TASK`).
   * É o que decide se `total` é o valor de UM veículo ou o do orçamento inteiro.
   */
  perVehicleBilling?: boolean | null;
}

/**
 * Generate payment terms text.
 * Priority: paymentConfig (new) → customPaymentText (só quando é a condição escolhida) →
 * paymentCondition (legacy).
 *
 * O texto livre é a cláusula APENAS quando foi ele que se escolheu: `paymentCondition === 'CUSTOM'`
 * (o faturamento exige o texto nesse caso) ou quando não existe config estruturado. Havendo
 * `paymentConfig.type`, ele é a fonte que a tela edita — o texto livre é resíduo de orçamento
 * CLONADO, já que nenhuma tela de hoje escreve nem apaga `customPaymentText`, e ele sequestrava a
 * cláusula do PDF (caso Confiança/JAD Zogheib, orçamento 952: tela "À Vista - Boleto, 10/09/2026",
 * PDF "À COMBINAR"). Espelha `api/.../signature/document/quote-text.ts`.
 */
export function generatePaymentText(quote: PaymentTextData): string {
  const structured = quote.paymentConfig?.type ? quote.paymentConfig : null;
  if (quote.customPaymentText && (!structured || quote.paymentCondition === 'CUSTOM')) {
    return quote.customPaymentText;
  }

  const config = structured ?? conditionToConfig(quote.paymentCondition);
  if (!config) return '';

  // Anything that isn't explicitly Pix settles as boleto — mirrors the API's
  // `resolveInstallmentPaymentMethod`, so the prose names the same method the
  // generated Installments carry.
  const method = quote.paymentMethod || quote.paymentConfig?.method || 'BANK_SLIP';
  const phrase = PAYMENT_METHOD_PHRASES[method];
  const methodPhrase = phrase ? ` ${phrase}` : '';

  const parsedDue = quote.firstDueDate ? new Date(quote.firstDueDate) : null;
  const firstDueDate = parsedDue && !isNaN(parsedDue.getTime()) ? parsedDue : null;

  return generatePaymentTextFromConfig(
    config,
    quote.total,
    methodPhrase,
    firstDueDate,
    Math.max(1, Math.trunc(quote.vehicleCount ?? 1) || 1),
    quote.perVehicleBilling === true,
  );
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

// ═════════════════════════════════════════════════════════════════════════════
// O ENDEREÇO DO TOMADOR
// ═════════════════════════════════════════════════════════════════════════════
//
// ESPELHO de `api/src/modules/common/signature/document/quote-text.ts`. A página
// pública e o PDF assinado mostram o MESMO quadro, e é ele que o cliente
// confere antes de a NFS-e ser emitida.

/**
 * Tipos de logradouro em português.
 *
 * O enum é em inglês (`STREET`, `AVENUE`) e o documento é em português. Espelha
 * `street-type-select.tsx`, que é onde o operador escolhe o valor — divergir
 * faria o cadastro dizer "Rodovia" na tela e "HIGHWAY" no documento assinado.
 */
const STREET_TYPE_LABELS_PT: Record<string, string> = {
  STREET: "Rua",
  AVENUE: "Avenida",
  ALLEY: "Alameda",
  CROSSING: "Travessa",
  SQUARE: "Praça",
  HIGHWAY: "Rodovia",
  ROAD: "Estrada",
  WAY: "Via",
  PLAZA: "Largo",
  LANE: "Viela",
  DEADEND: "Beco",
  SMALL_STREET: "Ruela",
  PATH: "Caminho",
  PASSAGE: "Passagem",
  GARDEN: "Jardim",
  BLOCK: "Quadra",
  LOT: "Lote",
  SITE: "Sítio",
  PARK: "Parque",
  FARM: "Fazenda",
  RANCH: "Chácara",
  CONDOMINIUM: "Condomínio",
  COMPLEX: "Conjunto",
  RESIDENTIAL: "Residencial",
};

export interface BillingAddressParts {
  streetType?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}

/** `86200-000`. Deixa passar o que não tem oito dígitos: um CEP malformado no
 *  documento é informação (o cadastro está errado), e mascarar esconderia. */
export function formatZipCode(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length !== 8) return value?.trim() || null;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/** `Rodovia BR-369, 1200, Galpão B` — a primeira linha do endereço. */
export function formatBillingStreetLine(c: BillingAddressParts): string | null {
  if (!c?.address?.trim()) return null;
  // `OTHER` não vira rótulo: "Outro Rua das Palmeiras" é pior que "Rua das
  // Palmeiras", e quem escolhe OTHER normalmente já escreveu o tipo no campo.
  const prefix = c.streetType ? (STREET_TYPE_LABELS_PT[c.streetType] ?? null) : null;
  const street = prefix ? `${prefix} ${c.address.trim()}` : c.address.trim();
  return [street, c.addressNumber?.trim() || null, c.addressComplement?.trim() || null]
    .filter(Boolean)
    .join(", ");
}

/** `Distrito Industrial — Ibiporã/PR — CEP 86200-000` — a segunda linha. */
export function formatBillingLocalityLine(c: BillingAddressParts): string | null {
  const cityState = [c?.city?.trim() || null, c?.state?.trim() || null].filter(Boolean).join("/");
  const zip = formatZipCode(c?.zipCode);
  const parts = [c?.neighborhood?.trim() || null, cityState || null, zip ? `CEP ${zip}` : null].filter(
    Boolean,
  );
  return parts.length ? parts.join(" — ") : null;
}
