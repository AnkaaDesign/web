/**
 * Single source of truth for the receivable-installment payment method.
 *
 * The API column is the Prisma `InstallmentPaymentMethod` enum, but it still
 * arrives over the wire as a string and older rows used mixed conventions
 * (e.g. the raw "BOLETO" alongside "BANK_SLIP"). Normalizing here keeps the
 * badge from rendering both "Paga (BOLETO)" and "Paga (Boleto)" for the same
 * type. Case-insensitive, alias-aware, and it never leaks a raw uppercase enum
 * to the UI (unknown values fall back to Title Case).
 */

/** Canonical wire label for every method, including system-set ones. */
const METHOD_LABELS: Record<string, string> = {
  PIX: "PIX",
  BANK_SLIP: "Boleto",
  BOLETO: "Boleto", // legacy alias
  CASH: "Dinheiro",
  DINHEIRO: "Dinheiro", // legacy alias
  TRANSFER: "Transferência",
  TRANSFERENCIA: "Transferência", // legacy alias
  ACCOUNT_GENIVALDO: "Conta Genivaldo",
  ACCOUNT_SERGIO: "Conta Sérgio",
  MANUAL: "Manual",
  CREDIT_CARD: "Cartão",
  CARTAO: "Cartão", // legacy alias
  OTHER: "Outro",
  OUTRO: "Outro", // legacy alias
};

/**
 * Options offered by the "marcar como paga" dialog — the subset a user manually
 * records. BANK_SLIP/MANUAL are omitted: those are system-set (Sicredi boleto
 * settlement / external operations), not something a user picks here.
 */
export const MANUAL_PAYMENT_METHOD_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "PIX", label: "PIX" },
  { value: "CASH", label: "Dinheiro" },
  { value: "TRANSFER", label: "Transferência" },
  { value: "ACCOUNT_GENIVALDO", label: "Conta Genivaldo" },
  { value: "ACCOUNT_SERGIO", label: "Conta Sérgio" },
  { value: "OTHER", label: "Outro" },
];

/** Bare method label, e.g. "Boleto" / "PIX" / "Conta Genivaldo". Null when no method. */
export function formatInstallmentPaymentMethod(method?: string | null): string | null {
  if (!method) return null;
  const m = String(method).trim().toUpperCase();
  const known = METHOD_LABELS[m];
  if (known) return known;
  // Never surface a raw uppercase enum — Title Case the fallback.
  return m.charAt(0) + m.slice(1).toLowerCase();
}

/** "Paga (Boleto)" style label for a PAID installment. Null when no method. */
export function formatPaidInstallmentLabel(method?: string | null): string | null {
  const label = formatInstallmentPaymentMethod(method);
  return label ? `Paga (${label})` : null;
}

/**
 * Label for the "Forma de pagamento" column: the recorded method when present
 * ("how it was paid"), otherwise "Boleto" when a bank slip was generated, else null.
 */
export function formatInstallmentPaymentForm(
  method?: string | null,
  hasBankSlip?: boolean,
): string | null {
  const label = formatInstallmentPaymentMethod(method);
  if (label) return label;
  return hasBankSlip ? "Boleto" : null;
}
