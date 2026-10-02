/**
 * OS PAGADORES DO ORÇAMENTO — quem é faturado, com os dados do cadastro dele.
 *
 * Cada pagador (`customerConfigs[i]`) carrega `customerData`: uma CÓPIA editável
 * do cadastro do cliente (documento, nomes, endereço), que o Salvar grava de
 * volta no `Customer`. É uma cópia, e por isso é perigosa: se o cliente do
 * pagador troca e a cópia não, os dados do anterior são gravados no cadastro do
 * novo — um CNPJ de uma empresa no registro de outra (o "Ibiporã virou Sola" de
 * 13/07/2026). Decisão do dono (02/10/2026): "cuidado para não ficar editando
 * dados de cliente com dados de outro".
 *
 * As regras que impedem isso moram aqui:
 *   · trocar o cliente REFAZ a cópia inteira a partir do cadastro do novo — nada
 *     do anterior sobra, nem campo editado (`swapPayerCustomer`);
 *   · o Salvar manda ao cadastro SÓ o que difere do que foi carregado
 *     (`customerUpdatePatch`), e a tela diz quais campos do cadastro de quem vão
 *     mudar (`changedCustomerFieldLabels`);
 *   · o documento só se preenche em cadastro que não tem um;
 *   · criar com documento já cadastrado devolve 409 com o id do dono
 *     (`existingCustomerIdFromError`) — a tela seleciona o existente.
 *
 * Puro (sem React).
 */

/** Os campos do cadastro que o passo de Faturamento edita, com o rótulo de tela. */
export const PAYER_CUSTOMER_FIELDS = [
  { key: "cnpj", label: "CNPJ" },
  { key: "cpf", label: "CPF" },
  { key: "registrationStatus", label: "Situação Cadastral" },
  { key: "stateRegistration", label: "Inscrição Estadual" },
  { key: "municipalRegistration", label: "Inscrição Municipal" },
  { key: "fantasyName", label: "Nome Fantasia" },
  { key: "corporateName", label: "Razão Social" },
  { key: "zipCode", label: "CEP" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "UF" },
  { key: "streetType", label: "Tipo de logradouro" },
  { key: "address", label: "Logradouro" },
  { key: "addressNumber", label: "Nº" },
  { key: "neighborhood", label: "Bairro" },
  { key: "addressComplement", label: "Complemento" },
] as const;

export type PayerCustomerFieldKey = (typeof PAYER_CUSTOMER_FIELDS)[number]["key"];

const DOCUMENT_KEYS = new Set<string>(["cnpj", "cpf"]);
const DIGIT_KEYS = new Set<string>(["cnpj", "cpf", "zipCode"]);

type CustomerRecord = Record<string, any> & { id: string };

/** Comparação: só dígitos nos documentos e no CEP, sem espaços nas pontas, vazio = nada. */
function normalized(key: string, value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return DIGIT_KEYS.has(key) ? text.replace(/\D/g, "") : text;
}

/** A cópia editável do cadastro, na forma que o passo usa. */
export function customerDataFromRecord(record: Record<string, any> | null | undefined): Record<string, any> {
  const r = record ?? {};
  return {
    corporateName: r.corporateName || "",
    fantasyName: r.fantasyName || "",
    cnpj: r.cnpj || "",
    cpf: r.cpf || "",
    address: r.address || "",
    addressNumber: r.addressNumber || "",
    addressComplement: r.addressComplement || "",
    neighborhood: r.neighborhood || "",
    city: r.city || "",
    state: r.state || "",
    zipCode: r.zipCode || "",
    stateRegistration: r.stateRegistration || "",
    municipalRegistration: r.municipalRegistration || "",
    // Contato só para a prévia da NFS-e (Fone/Fax e E-mail do tomador): não é
    // editado no passo nem reenviado no Salvar.
    email: r.email || "",
    phones: r.phones || [],
    streetType: r.streetType || null,
    registrationStatus: r.registrationStatus || null,
  };
}

/** Um pagador novo, com a cópia do cadastro e as condições padrão. */
export function newPayerConfig(record: CustomerRecord, carry?: Record<string, unknown> | null): Record<string, any> {
  return {
    customerId: record.id,
    subtotal: 0,
    total: 0,
    discountType: (carry?.discountType as string) ?? "NONE",
    discountValue: (carry?.discountValue as number | null) ?? null,
    discountReference: (carry?.discountReference as string | null) ?? null,
    paymentCondition: null,
    paymentConfig: null,
    customPaymentText: null,
    generateInvoice: true,
    generateBankSlip: true,
    customerData: customerDataFromRecord(record),
  };
}

/** O índice de outro pagador com o mesmo cliente (−1 se não há). */
export function duplicatePayerIndex(
  configs: ReadonlyArray<{ customerId?: string | null } | null | undefined>,
  customerId: string,
  exceptIndex = -1,
): number {
  return configs.findIndex((c, i) => i !== exceptIndex && !!c && c.customerId === customerId);
}

/**
 * TROCA O CLIENTE de um pagador.
 *
 * A cópia do cadastro é REFEITA a partir do novo — nenhum campo do anterior
 * sobra, nem o que o operador editou. As condições do pagador (pagamento, NF,
 * boleto, desconto) ficam: são do faturamento, não do cadastro. O `id` da linha
 * sai — o pagador agora é outro, e a API o trata como novo — e as parcelas
 * geradas para o anterior também.
 */
export function swapPayerCustomer(config: Record<string, any>, record: CustomerRecord): Record<string, any> {
  if (config.customerId === record.id) return config;
  const { id: _id, installments: _installments, customer: _customer, ...rest } = config;
  return { ...rest, customerId: record.id, customerData: customerDataFromRecord(record) };
}

/**
 * Os serviços que apontavam para `fromId` passam a apontar para `toId` (ou para
 * ninguém, quando o pagador sai). Sem isso, trocar ou tirar um pagador deixava
 * serviços presos a um cliente que não paga mais nada — e o valor deles sumia de
 * todo total por pagador.
 */
export function remapServicesPayer<T extends { invoiceToCustomerId?: string | null }>(
  services: readonly T[],
  fromId: string,
  toId: string | null,
): T[] {
  return services.map((s) => (s?.invoiceToCustomerId === fromId ? { ...s, invoiceToCustomerId: toId } : s));
}

/** O documento pode ser preenchido neste cadastro? Só quando ele não tem um. */
export function canEditPayerDocument(record: Record<string, any> | null | undefined): boolean {
  return !normalized("cnpj", record?.cnpj) && !normalized("cpf", record?.cpf);
}

/**
 * O QUE O SALVAR GRAVA NO CADASTRO — só o que mudou em relação ao carregado.
 *
 * Campo apagado no passo NÃO apaga o cadastro (o comportamento de sempre: o
 * Salvar mandava `valor || undefined`). Documento só entra quando o cadastro
 * ainda não tem um. Volta `{}` quando nada mudou — e aí não há o que gravar.
 */
export function customerUpdatePatch(
  record: Record<string, any> | null | undefined,
  data: Record<string, any> | null | undefined,
): Partial<Record<PayerCustomerFieldKey, string>> {
  const patch: Partial<Record<PayerCustomerFieldKey, string>> = {};
  if (!data) return patch;
  const documentEditable = canEditPayerDocument(record);
  for (const { key } of PAYER_CUSTOMER_FIELDS) {
    if (DOCUMENT_KEYS.has(key) && !documentEditable) continue;
    const next = normalized(key, data[key]);
    if (!next) continue;
    if (next === normalized(key, record?.[key])) continue;
    patch[key] = DOCUMENT_KEYS.has(key) ? next : String(data[key]).trim();
  }
  return patch;
}

/** Os rótulos dos campos do cadastro que o Salvar vai alterar. */
export function changedCustomerFieldLabels(
  record: Record<string, any> | null | undefined,
  data: Record<string, any> | null | undefined,
): string[] {
  const patch = customerUpdatePatch(record, data);
  return PAYER_CUSTOMER_FIELDS.filter((f) => f.key in patch).map((f) => f.label);
}

/** O id do cliente dono do documento, quando a API recusou com 409. */
export function existingCustomerIdFromError(error: unknown): string | null {
  const data = (error as any)?.response?.data;
  const id = data?.details?.existingCustomerId ?? data?.existingCustomerId;
  return typeof id === "string" && id ? id : null;
}
