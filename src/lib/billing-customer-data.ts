// =====================================================
// "Can this customer be invoiced?" — ONE definition
// =====================================================
//
// The data a customer must carry before an NFS-e can be issued for them. Everything with
// an opinion on that question now reads it from here:
//
//   • the attention rule `task-quote.billing-customer-incomplete` (lib/attention/rules.ts),
//     which BUILDS its predicate from this list — so the blink can never ask for a field the
//     save gate does not require, nor stay silent about one it does;
//   • the save gate on both quote wizards (`validateCustomerData`), which refuses
//     BILLING_APPROVED while anything here is empty;
//   • the "Dados completos / Dados incompletos" badges on the Faturar Para and Resumo steps;
//   • the per-input highlight on the customer step.
//
// These were three different lists before: the badge checked six fields, the save gate nine,
// and the rule none at all — so a customer could read "Dados completos" on one step and be
// rejected on save from another.
//
// The keys are deliberately the `Customer` model's own, because the wizard's `customerData`
// draft is seeded field-for-field from that record (see the detail pages' `form.reset`). One
// helper therefore answers for BOTH the persisted customer — which is what the attention rule
// and its server mirror evaluate — and the unsaved form draft, which is what the inputs show.

/** A required field: the `Customer` key and how the user is told to fill it. */
export interface BillingCustomerField {
  key: string;
  label: string;
}

/**
 * The document is required as a PAIR — either CNPJ or CPF satisfies it — so it cannot live in
 * the list below, whose members are each independently required. `DOCUMENT_KEY` is the
 * pseudo-key the helpers report it under.
 */
export const NFSE_DOCUMENT_KEY = "document";
export const NFSE_DOCUMENT_LABEL = "CNPJ ou CPF";
export const NFSE_DOCUMENT_FIELDS = ["cnpj", "cpf"] as const;

/** Every independently-required field, in the order the customer step lays them out. */
export const NFSE_REQUIRED_CUSTOMER_FIELDS: BillingCustomerField[] = [
  { key: "fantasyName", label: "Nome Fantasia" },
  { key: "corporateName", label: "Razão Social" },
  { key: "zipCode", label: "CEP" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "Estado" },
  { key: "address", label: "Logradouro" },
  { key: "addressNumber", label: "Número" },
  { key: "neighborhood", label: "Bairro" },
];

/** Label for any key the helpers return, including the document pseudo-key. */
export const NFSE_FIELD_LABELS: Record<string, string> = {
  [NFSE_DOCUMENT_KEY]: NFSE_DOCUMENT_LABEL,
  ...Object.fromEntries(NFSE_REQUIRED_CUSTOMER_FIELDS.map((f) => [f.key, f.label])),
};

type BillingCustomerLike = Record<string, unknown> | null | undefined;

/**
 * Empty for this purpose. Whitespace counts as empty here but NOT in the attention predicate
 * (`isNull` there treats only null/undefined/"" as missing, mirroring the SQL `= ''`). The gap
 * is deliberate and harmless: a customer whose city is a single space is a data-entry accident
 * the UI should flag, not something the nav needs to hunt for across the whole database.
 */
function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  return typeof value === "string" ? value.trim() === "" : false;
}

/**
 * Keys of every requirement this record fails, `NFSE_DOCUMENT_KEY` first when it has neither
 * CNPJ nor CPF. Empty array = ready to invoice.
 *
 * Accepts a persisted `Customer` or a `customerData` form draft — same keys, by construction.
 */
export function missingBillingCustomerKeys(data: BillingCustomerLike): string[] {
  if (!data) return [NFSE_DOCUMENT_KEY, ...NFSE_REQUIRED_CUSTOMER_FIELDS.map((f) => f.key)];
  const missing: string[] = [];
  if (NFSE_DOCUMENT_FIELDS.every((k) => isBlank(data[k]))) missing.push(NFSE_DOCUMENT_KEY);
  for (const field of NFSE_REQUIRED_CUSTOMER_FIELDS) {
    if (isBlank(data[field.key])) missing.push(field.key);
  }
  return missing;
}

/** The same answer as user-facing labels, ready for a toast or a tooltip. */
export function missingBillingCustomerLabels(data: BillingCustomerLike): string[] {
  return missingBillingCustomerKeys(data).map((key) => NFSE_FIELD_LABELS[key] ?? key);
}

/** True when an NFS-e can be issued for this customer. */
export function hasCompleteBillingCustomerData(data: BillingCustomerLike): boolean {
  return missingBillingCustomerKeys(data).length === 0;
}

/** Is this specific requirement unmet? `key` may be `NFSE_DOCUMENT_KEY` or any field key. */
export function isBillingCustomerFieldMissing(data: BillingCustomerLike, key: string): boolean {
  return missingBillingCustomerKeys(data).includes(key);
}
