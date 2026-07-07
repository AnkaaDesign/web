/**
 * Installment.paymentMethod is a free-form `String?` on the API, so different
 * write paths persist different conventions for the same method — e.g. the raw
 * Portuguese "BOLETO" alongside the enum-style "BANK_SLIP". Normalizing here is
 * what keeps the badge from rendering both "Paga (BOLETO)" and "Paga (Boleto)"
 * for the same payment type. Case-insensitive, alias-aware, and it never leaks a
 * raw uppercase enum to the UI (unknown values fall back to Title Case).
 */

/** Bare method label, e.g. "Boleto" / "PIX" / "Dinheiro". Null when no method. */
export function formatInstallmentPaymentMethod(method?: string | null): string | null {
  if (!method) return null;
  const m = String(method).trim().toUpperCase();
  switch (m) {
    case "BANK_SLIP":
    case "BOLETO":
      return "Boleto";
    case "PIX":
      return "PIX";
    case "CASH":
    case "DINHEIRO":
      return "Dinheiro";
    case "TRANSFER":
    case "TRANSFERENCIA":
    case "TRANSFERÊNCIA":
      return "Transferência";
    case "CREDIT_CARD":
    case "CARTAO":
    case "CARTÃO":
      return "Cartão";
    case "OTHER":
    case "OUTRO":
      return "Outro";
    default:
      // Never surface a raw uppercase enum — Title Case the fallback.
      return m.charAt(0) + m.slice(1).toLowerCase();
  }
}

/** "Paga (Boleto)" style label for a PAID installment. Null when no method. */
export function formatPaidInstallmentLabel(method?: string | null): string | null {
  const label = formatInstallmentPaymentMethod(method);
  return label ? `Paga (${label})` : null;
}
