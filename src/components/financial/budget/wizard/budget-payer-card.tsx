/**
 * UM PAGADOR do orçamento, no passo Faturamento: o cliente (combobox que aceita
 * criar), a cópia editável do cadastro dele e as condições de faturamento e
 * pagamento.
 *
 * Era o passo "Cliente N" — um passo inteiro por cliente, com o CNPJ digitado
 * livre. Virou um cartão numa lista (decisão do dono, 02/10/2026), com as
 * proteções de `utils/budget-payers.ts`: trocar o cliente refaz a cópia; o
 * cartão diz o que o Salvar vai mudar no cadastro e de quem; o documento só se
 * preenche em cadastro sem documento.
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { formatCurrency } from "@/utils";
import { useCnpjLookup } from "@/hooks/common/use-cnpj-lookup";
import { IconAlertTriangle, IconBuilding, IconCreditCard, IconIdBadge2, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  legacyToConfig,
  configToTypeValue,
  PAYMENT_TYPE_OPTIONS,
  VENCIMENTO_OPTIONS,
  ENTRADA_OPTIONS,
  INSTALLMENT_STEP_OPTIONS,
} from "@/components/financial/payment-config-field";
import type { PaymentConfig } from "@/schemas/budget";
import { attentionFieldClass, useAttentionField } from "@/lib/attention";
import { missingBillingCustomerKeys, NFSE_DOCUMENT_KEY } from "@/lib/billing-customer-data";
import { cn } from "@/lib/utils";
import { canEditPayerDocument, changedCustomerFieldLabels } from "@/utils/budget-payers";
import { vehicleLabel, type BillingSplitVehicle } from "@/components/financial/shared/billing-split-field";
import { PayerCustomerCombobox } from "./payer-customer-combobox";

const STREET_TYPE_OPTIONS = [
  { value: "STREET", label: "Rua" },
  { value: "AVENUE", label: "Avenida" },
  { value: "ALLEY", label: "Travessa" },
  { value: "CROSSING", label: "Cruzamento" },
  { value: "SQUARE", label: "Praça" },
  { value: "HIGHWAY", label: "Rodovia" },
  { value: "ROAD", label: "Estrada" },
  { value: "WAY", label: "Via" },
  { value: "OTHER", label: "Outro" },
];

const STATE_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
].map((s) => ({ value: s, label: s }));

const REGISTRATION_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Ativa" },
  { value: "SUSPENDED", label: "Suspensa" },
  { value: "UNFIT", label: "Inapta" },
  { value: "ACTIVE_NOT_REGULAR", label: "Ativa Não Regular" },
  { value: "DEREGISTERED", label: "Baixada" },
];

const DOC_TYPE_OPTIONS = [
  { value: "cnpj", label: "CNPJ" },
  { value: "cpf", label: "CPF" },
];

interface BudgetPayerCardProps {
  configIndex: number;
  /**
   * O cadastro do cliente COMO CARREGADO — a referência do que o Salvar vai
   * alterar (`customerUpdatePatch`) e de se o documento pode ser preenchido.
   */
  record: any | null;
  /** Clientes de OUTROS pagadores: não podem ser escolhidos de novo. */
  takenCustomerIds: string[];
  /** Troca o cliente deste pagador (a cópia do cadastro é refeita inteira). */
  onSwapCustomer: (record: any) => void;
  /** Tira este pagador do orçamento; ausente quando ele é o único. */
  onRemove?: () => void;
  customersCache: React.MutableRefObject<Map<string, any>>;
  disabled?: boolean;
  /** Attention entity id — the TASK_QUOTE this config belongs to. */
  quoteId?: string;
  /** Quantos veículos o orçamento cobre — o dinheiro do passo é POR VEÍCULO. */
  vehicleCount: number;
  /** O rótulo do cartão; ausente = "Pagador N". */
  title?: string;
  /**
   * A COBERTURA DESTA FATURA — só na tela de Faturamento, que é de UMA cobrança.
   *
   * Com ela o cartão diz de quais veículos é a fatura ("Esta fatura cobra 2
   * veículos: Série 39088, Série 39089") e o total passa a ser o DA FATURA
   * (por veículo × veículos cobertos), que é o número que sai no boleto. No
   * Orçamento não há fatura ainda: o total é por veículo e o geral é × N.
   */
  coverage?: { vehicles: BillingSplitVehicle[]; coveredIds: string[] };
}

export function BudgetPayerCard({
  configIndex,
  record,
  takenCustomerIds,
  onSwapCustomer,
  onRemove,
  customersCache,
  disabled,
  quoteId,
  vehicleCount,
  title,
  coverage,
}: BudgetPayerCardProps) {
  const customer = record;
  const { control, setValue: setFormValue } = useFormContext();
  const config = useWatch({ control, name: `customerConfigs.${configIndex}` });
  const customerData = config?.customerData || {};

  const [docType, setDocType] = useState<"cnpj" | "cpf">(() => {
    if (customerData.cpf && !customerData.cnpj) return "cpf";
    return "cnpj";
  });

  // Sync docType when form data loads asynchronously (after form.reset())
  useEffect(() => {
    if (customerData.cpf && !customerData.cnpj) {
      setDocType("cpf");
    } else if (customerData.cnpj) {
      setDocType("cnpj");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.customerId]);

  const paymentConfig: PaymentConfig | null =
    config?.paymentConfig ?? legacyToConfig(config?.paymentCondition);
  const paymentType = paymentConfig?.type ?? null;
  const typeValue = configToTypeValue(paymentConfig);
  const [showDateInput, setShowDateInput] = useState(() => !!paymentConfig?.specificDate);

  // Sync showDateInput when form data loads asynchronously (after form.reset())
  useEffect(() => {
    if (paymentConfig?.specificDate) {
      setShowDateInput(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.paymentConfig, config?.paymentCondition]);

  const setPaymentConfig = useCallback((next: PaymentConfig | null) => {
    setFormValue(`customerConfigs.${configIndex}.paymentConfig`, next, { shouldDirty: true });
    setFormValue(`customerConfigs.${configIndex}.paymentCondition`, null);
  }, [setFormValue, configIndex]);

  const patchPayment = useCallback((partial: Partial<PaymentConfig>) => {
    setPaymentConfig({ ...(paymentConfig as PaymentConfig), ...partial } as PaymentConfig);
  }, [setPaymentConfig, paymentConfig]);

  // Declared here (rather than alongside setCustomerField below) so handleTypeChange
  // — which needs it to auto-sync "Gerar Boleto" with the chosen method — can
  // reference it in its dependency array without a temporal-dead-zone error.
  const setConfigField = useCallback((field: string, value: any) => {
    setFormValue(`customerConfigs.${configIndex}.${field}`, value, { shouldDirty: true });
  }, [setFormValue, configIndex]);

  // O N° DO PEDIDO NÃO MORA MAIS AQUI. Ele é da ENTREGA
  // (`Task.customerOrderNumber`), não do cliente, e vive no passo 1, ao lado da
  // placa e do número de série: na criação um valor para os N veículos que vão
  // nascer, e depois um por implemento, editável abrindo a tarefa (ou o orçamento
  // por ela). Aqui o campo aparecia uma vez POR CLIENTE, e num orçamento de dois
  // clientes a segunda cópia sobrescrevia a primeira sem que ninguém notasse.

  // Attention: `task-quote.billing-customer-incomplete` addresses the whole cadastro under one
  // field id (`customerData`). Narrow it twice before painting anything: to configs that will
  // actually produce a nota (`generateInvoice: false` needs no cadastro), and to the inputs that
  // are empty in the FORM right now (`missingBillingCustomerKeys`, the same list the approval gate
  // uses), so typing a CNPJ clears its own highlight at once. This card is the payer on BOTH
  // screens — Orçamento and Faturamento — so the cadastro is fixed in the same place either way.
  const customerDataAttention = useAttentionField("TASK_QUOTE", quoteId, "customerData");
  const missingBillingKeys = useMemo(
    () =>
      customerDataAttention?.active && config?.generateInvoice !== false
        ? missingBillingCustomerKeys(customerData)
        : [],
    [customerDataAttention?.active, config?.generateInvoice, customerData],
  );
  const customerFieldAttention = useCallback(
    (key: string) => (missingBillingKeys.includes(key) ? attentionFieldClass(customerDataAttention) : ""),
    [missingBillingKeys, customerDataAttention],
  );
  const customerFieldTitle = customerDataAttention?.match.rule.name;

  const handleTypeChange = useCallback((v: string | string[] | null | undefined) => {
    const val = typeof v === "string" ? v : "";
    if (!val) { setPaymentConfig(null); setShowDateInput(false); return; }
    if (val === "CASH_BANK_SLIP" || val === "CASH_PIX") {
      setShowDateInput(!!paymentConfig?.specificDate);
      setPaymentConfig({
        type: "CASH",
        method: val === "CASH_PIX" ? "PIX" : "BANK_SLIP",
        cashDays: paymentConfig?.cashDays ?? 5,
        specificDate: paymentConfig?.specificDate,
      });
      // Pix settles directly — no boleto to emit. Boleto flips generation back on
      // (both directions stay in sync with the method so the toggle never silently
      // disagrees with what was just chosen).
      setConfigField("generateBankSlip", val === "CASH_BANK_SLIP");
      return;
    }
    const m = val.match(/^INST_(\d+)$/);
    if (m) {
      setShowDateInput(!!paymentConfig?.specificDate);
      setPaymentConfig({
        type: "INSTALLMENTS",
        // No Boleto/Pix picker for installments — always starts on BANK_SLIP.
        method: "BANK_SLIP",
        installmentCount: Number(m[1]),
        installmentStep: paymentConfig?.installmentStep ?? 20,
        entryDays: paymentConfig?.entryDays ?? 5,
        specificDate: paymentConfig?.specificDate,
      });
      setConfigField("generateBankSlip", true);
    }
  }, [setPaymentConfig, paymentConfig, setConfigField]);

  const vencimentoValue = paymentConfig?.specificDate ? "CUSTOM" : String(paymentConfig?.cashDays ?? "");
  const handleVencimentoChange = useCallback((v: string | string[] | null | undefined) => {
    const val = typeof v === "string" ? v : "";
    if (!val) { patchPayment({ cashDays: undefined, specificDate: undefined }); setShowDateInput(false); return; }
    if (val === "CUSTOM") { setShowDateInput(true); return; }
    patchPayment({ cashDays: Number(val) as any, specificDate: undefined });
    setShowDateInput(false);
  }, [patchPayment]);

  const entradaValue = paymentConfig?.specificDate ? "CUSTOM" : String(paymentConfig?.entryDays ?? "");
  const handleEntradaChange = useCallback((v: string | string[] | null | undefined) => {
    const val = typeof v === "string" ? v : "";
    if (!val) { patchPayment({ entryDays: undefined, specificDate: undefined }); setShowDateInput(false); return; }
    if (val === "CUSTOM") { setShowDateInput(true); return; }
    patchPayment({ entryDays: Number(val), specificDate: undefined });
    setShowDateInput(false);
  }, [patchPayment]);

  // ─── O DINHEIRO DESTE PASSO É POR VEÍCULO ────────────────────────────────
  //
  // `services[].amount` é o preço de UM implemento (ver `utils/quote-money.ts`) e
  // o formulário guarda o total na mesma escala — é o que o Resumo depois
  // apresenta como "TOTAL POR VEÍCULO · × N · TOTAL GERAL". Aqui os dois campos
  // diziam só "Subtotal" e "Total", e num orçamento de quatro implementos esse
  // "Total" é um quarto do que o cliente vai pagar.
  const configSubtotal = typeof config?.subtotal === "number" ? config.subtotal : Number(config?.subtotal) || 0;
  const configTotal = typeof config?.total === "number" ? config.total : Number(config?.total) || 0;
  const showPerVehicleLabels = vehicleCount > 1;
  const coveredVehicles = useMemo(() => {
    if (!coverage) return [];
    const ids = new Set(coverage.coveredIds);
    return coverage.vehicles.filter((v) => ids.has(v.id));
  }, [coverage]);
  // Na fatura, o "geral" é o que ELA cobra: por veículo × veículos cobertos.
  const grandTotalVehicles = coverage
    ? Math.max(1, coveredVehicles.length || coverage.vehicles.length || 1)
    : vehicleCount;
  const configGrandTotal = Math.round(configTotal * grandTotalVehicles * 100) / 100;
  const coverageText =
    coverage && coverage.vehicles.length > 1 && coveredVehicles.length > 0
      ? `Esta fatura cobra ${
          coveredVehicles.length === 1 ? "o veículo" : `${coveredVehicles.length} veículos`
        }: ${coveredVehicles.map(vehicleLabel).join(", ")}`
      : null;

  const setCustomerField = useCallback((field: string, value: any) => {
    setFormValue(`customerConfigs.${configIndex}.customerData.${field}`, value, { shouldDirty: true });
  }, [setFormValue, configIndex]);

  // O DOCUMENTO SÓ SE PREENCHE EM CADASTRO QUE NÃO TEM UM. Digitar um CNPJ aqui
  // dispara a busca na Receita, que SOBRESCREVE razão social, endereço e cidade
  // no cadastro do cliente ao salvar — e digitar o CNPJ de outra empresa num
  // cliente que já tem o seu transformou o "Ibiporã" em "Sola" em 13/07/2026.
  // Trocar de empresa é trocar o CLIENTE do pagador, no combobox acima.
  const documentLocked = !canEditPayerDocument(record);
  const customerHasCnpj = documentLocked;

  // O QUE O SALVAR VAI MUDAR NO CADASTRO — dito antes, com o nome do dono.
  const changedFields = useMemo(() => changedCustomerFieldLabels(record, customerData), [record, customerData]);

  const { lookupCnpj, isLoading: isLookingUpCnpj } = useCnpjLookup({
    onSuccess: (data) => {
      if (data.corporateName) setCustomerField("corporateName", data.corporateName);
      if (data.fantasyName) setCustomerField("fantasyName", data.fantasyName);
      if (data.address) setCustomerField("address", data.address);
      if (data.addressNumber) setCustomerField("addressNumber", data.addressNumber);
      if (data.addressComplement) setCustomerField("addressComplement", data.addressComplement);
      if (data.neighborhood) setCustomerField("neighborhood", data.neighborhood);
      if (data.city) setCustomerField("city", data.city);
      if (data.state) setCustomerField("state", data.state);
      if (data.zipCode) setCustomerField("zipCode", data.zipCode);
      if (data.streetType) setCustomerField("streetType", data.streetType);
    },
  });

  const handleCnpjChange = useCallback((value: string) => {
    // Never mutate/lookup the CNPJ of a customer that already has one on record.
    if (customerHasCnpj) return;
    setCustomerField("cnpj", value);
    const digits = value.replace(/\D/g, "");
    if (digits.length === 14) {
      lookupCnpj(digits);
    }
  }, [setCustomerField, lookupCnpj, customerHasCnpj]);

  const handleDocTypeChange = useCallback((newType: any) => {
    const type = typeof newType === "string" ? newType : "cnpj";
    setDocType(type as "cnpj" | "cpf");
    if (type === "cnpj") {
      setCustomerField("cpf", "");
    } else {
      setCustomerField("cnpj", "");
    }
  }, [setCustomerField]);

  const customerLabel = customerData.fantasyName || customerData.corporateName || customer?.fantasyName || customer?.corporateName || `Cliente ${configIndex + 1}`;

  return (
    <div className="space-y-4" id={`pagador-${configIndex}`}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <IconBuilding className="h-5 w-5 text-muted-foreground" />
                {title ?? `Pagador ${configIndex + 1}`}
              </CardTitle>
              <CardDescription className="mt-1">
                {coverageText ?? "Quem é faturado, com os dados que vão na nota."}
              </CardDescription>
            </div>
            {onRemove && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-destructive"
                onClick={onRemove}
                disabled={disabled}
              >
                <IconTrash className="h-4 w-4" />
                Remover pagador
              </Button>
            )}
          </div>
          <div className="pt-2">
            <Label className="mb-2 block text-sm font-medium">
              Cliente <span className="text-destructive">*</span>
            </Label>
            <PayerCustomerCombobox
              value={config?.customerId ?? null}
              selected={record}
              onSelect={onSwapCustomer}
              takenCustomerIds={takenCustomerIds}
              customersCache={customersCache}
              disabled={disabled}
              queryKey={`budget-payer-${configIndex}`}
            />
          </div>
          {changedFields.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
              <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p>
                Ao salvar, isto altera o cadastro de{" "}
                <span className="font-semibold">{record?.fantasyName || record?.corporateName || customerLabel}</span>:{" "}
                {changedFields.join(", ")}.
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Row 1: Documento + Situação Cadastral + Inscrição Estadual.
              Same four-column grid as the Faturamento step: the two wizards edit the SAME Customer
              record with the same required-field gate, so a field that sits in a different place on
              each screen is just a way to miss it on one of them. */}
          {/* `items-start`, NÃO `items-end`: a célula do Documento é a única que
              ganha uma linha de aviso embaixo ("Buscando dados do CNPJ...",
              "CNPJ já cadastrado..."). Alinhando pelo fim, essa linha extra
              empurrava rótulo e campo do Documento ~20px para CIMA dos vizinhos —
              o texto de aviso desalinhava a fileira inteira. Pelo início, rótulos
              e campos ficam na mesma altura e o aviso apenas pende embaixo. */}
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_1fr_1fr] gap-4 items-start">
            <div className="space-y-2 md:col-span-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                {docType === "cnpj" ? (
                  <IconBuilding className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <IconIdBadge2 className="h-4 w-4 text-muted-foreground" />
                )}
                Documento
                <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Combobox
                  value={docType}
                  onValueChange={handleDocTypeChange}
                  options={DOC_TYPE_OPTIONS}
                  searchable={false}
                  clearable={false}
                  className="w-[150px]"
                  disabled={disabled || documentLocked}
                />
                {docType === "cnpj" ? (
                  <Input
                    type="cnpj"
                    value={customerData.cnpj ?? ""}
                    onChange={(value) => handleCnpjChange(String(value ?? ""))}
                    placeholder="00.000.000/0000-00"
                    disabled={disabled || customerHasCnpj}
                    transparent
                    className={cn("flex-1", customerFieldAttention(NFSE_DOCUMENT_KEY))}
                    title={customerFieldAttention(NFSE_DOCUMENT_KEY) ? customerFieldTitle : undefined}
                  />
                ) : (
                  <Input
                    type="cpf"
                    value={customerData.cpf ?? ""}
                    onChange={(value) => setCustomerField("cpf", String(value ?? ""))}
                    placeholder="000.000.000-00"
                    disabled={disabled || documentLocked}
                    transparent
                    className={cn("flex-1", customerFieldAttention(NFSE_DOCUMENT_KEY))}
                    title={customerFieldAttention(NFSE_DOCUMENT_KEY) ? customerFieldTitle : undefined}
                  />
                )}
              </div>
              {/* `block`: como filho inline o `space-y-2` do container não
                  aplicava margem nenhuma, e o aviso colava no campo. */}
              {isLookingUpCnpj && (
                <span className="block text-xs text-primary animate-pulse">Buscando dados do CNPJ...</span>
              )}
              {documentLocked && !isLookingUpCnpj && (
                <span className="block text-xs text-muted-foreground">
                  Documento do cadastro — para outra empresa, troque o cliente acima; para corrigi-lo, edite o cliente
                  no cadastro.
                </span>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Situação Cadastral</Label>
              <Combobox
                value={customerData.registrationStatus || ""}
                onValueChange={(v) => setCustomerField("registrationStatus", v || null)}
                options={REGISTRATION_STATUS_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable
                disabled={disabled}
              />
            </div>
            {/* As duas inscrições dividem a célula que era só da Estadual — metade cada. */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Inscrição Estadual</Label>
                <Input
                  value={customerData.stateRegistration || ""}
                  onChange={(value) => setCustomerField("stateRegistration", String(value ?? ""))}
                  placeholder="Ex: 123.456.789.012"
                  disabled={disabled}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Inscrição Municipal</Label>
                <Input
                  value={customerData.municipalRegistration || ""}
                  onChange={(value) => setCustomerField("municipalRegistration", String(value ?? ""))}
                  placeholder="Ex: 123456"
                  disabled={disabled}
                />
              </div>
            </div>
          </div>

          {/* Row 2: Nome Fantasia + Razão Social */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nome Fantasia <span className="text-destructive">*</span></Label>
              <Input
                value={customerData.fantasyName || ""}
                onChange={(value) => setCustomerField("fantasyName", String(value ?? ""))}
                placeholder="Nome Fantasia"
                disabled={disabled}
                className={customerFieldAttention("fantasyName")}
                title={customerFieldAttention("fantasyName") ? customerFieldTitle : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Razão Social <span className="text-destructive">*</span></Label>
              <Input
                value={customerData.corporateName || ""}
                onChange={(value) => setCustomerField("corporateName", String(value ?? ""))}
                placeholder="Razão Social"
                disabled={disabled}
                className={customerFieldAttention("corporateName")}
                title={customerFieldAttention("corporateName") ? customerFieldTitle : undefined}
              />
            </div>
          </div>

          {/* Row 3: CEP + Cidade + UF + Tipo + Logradouro + Nº */}
          <div className="grid grid-cols-2 md:grid-cols-[150px_1fr_150px_150px_1fr_150px] gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">CEP <span className="text-destructive">*</span></Label>
              <Input
                type="cep"
                value={customerData.zipCode || ""}
                onChange={(value) => setCustomerField("zipCode", String(value ?? ""))}
                placeholder="00000-000"
                disabled={disabled}
                className={customerFieldAttention("zipCode")}
                title={customerFieldAttention("zipCode") ? customerFieldTitle : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Cidade <span className="text-destructive">*</span></Label>
              <Input
                value={customerData.city || ""}
                onChange={(value) => setCustomerField("city", String(value ?? ""))}
                placeholder="Cidade"
                disabled={disabled}
                className={customerFieldAttention("city")}
                title={customerFieldAttention("city") ? customerFieldTitle : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">UF <span className="text-destructive">*</span></Label>
              <Combobox
                value={customerData.state || ""}
                onValueChange={(v) => setCustomerField("state", typeof v === "string" ? v : "")}
                options={STATE_OPTIONS}
                placeholder="UF"
                searchable
                clearable
                disabled={disabled}
                // `triggerClassName`, not `className`: `className` lands on Combobox's wrapper div,
                // whose padding box is exactly coincident with the trigger Button's border box —
                // and a child's border paints over the parent's INSET shadow, so the ring was
                // invisible at rest. On the trigger it also inherits the right radius.
                triggerClassName={customerFieldAttention("state")}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipo</Label>
              <Combobox
                value={customerData.streetType || ""}
                onValueChange={(v) => setCustomerField("streetType", v || null)}
                options={STREET_TYPE_OPTIONS}
                placeholder="Tipo"
                searchable={false}
                clearable
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Logradouro <span className="text-destructive">*</span></Label>
              <Input
                value={customerData.address || ""}
                onChange={(value) => setCustomerField("address", String(value ?? ""))}
                placeholder="Rua, Avenida, etc."
                disabled={disabled}
                className={customerFieldAttention("address")}
                title={customerFieldAttention("address") ? customerFieldTitle : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nº <span className="text-destructive">*</span></Label>
              <Input
                value={customerData.addressNumber || ""}
                onChange={(value) => setCustomerField("addressNumber", String(value ?? ""))}
                placeholder="Nº"
                disabled={disabled}
                className={customerFieldAttention("addressNumber")}
                title={customerFieldAttention("addressNumber") ? customerFieldTitle : undefined}
              />
            </div>
          </div>

          {/* Row 4: Bairro + Complemento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Bairro <span className="text-destructive">*</span></Label>
              <Input
                value={customerData.neighborhood || ""}
                onChange={(value) => setCustomerField("neighborhood", String(value ?? ""))}
                placeholder="Bairro"
                disabled={disabled}
                className={customerFieldAttention("neighborhood")}
                title={customerFieldAttention("neighborhood") ? customerFieldTitle : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Complemento</Label>
              <Input
                value={customerData.addressComplement || ""}
                onChange={(value) => setCustomerField("addressComplement", String(value ?? ""))}
                placeholder="Apto, Sala, etc."
                disabled={disabled}
              />
            </div>
          </div>

          {/* FATURAMENTO E PAGAMENTO — no mesmo cartão do pagador: cadastro e
              condições são a mesma pessoa, e cartões separados embaralhavam de
              quem era cada condição numa lista de dois pagadores. */}
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <IconCreditCard className="h-4 w-4 text-muted-foreground" />
              Faturamento e Pagamento
            </div>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5 flex-1 min-w-[100px]">
              <Label className="text-sm text-muted-foreground">
                {showPerVehicleLabels ? "Subtotal por veículo" : "Subtotal"}
              </Label>
              <Input value={formatCurrency(configSubtotal)} disabled className="bg-muted" />
            </div>
            {showPerVehicleLabels && (
              <div className="space-y-1.5 flex-1 min-w-[110px]">
                <Label className="text-sm text-muted-foreground">
                  {coverage ? `Total da fatura (${grandTotalVehicles} veíc.)` : `Total geral (${vehicleCount} veíc.)`}
                </Label>
                <Input value={formatCurrency(configGrandTotal)} disabled className="bg-muted" />
              </div>
            )}
            <div className="space-y-1.5 flex-1 min-w-[100px]">
              <Label className="text-sm font-bold">
                {showPerVehicleLabels ? "Total por veículo" : "Total"}
              </Label>
              <Input
                value={formatCurrency(configTotal)}
                disabled
                className="bg-transparent font-bold text-primary border-primary"
              />
            </div>
            <div className="space-y-1.5 min-w-[90px]">
              <Label className="text-sm font-medium whitespace-nowrap">Gerar NF</Label>
              <div className="flex items-center gap-2 border border-input rounded-md px-3 py-2 h-9">
                <Switch
                  checked={config?.generateInvoice !== false}
                  onCheckedChange={(checked) => setConfigField("generateInvoice", checked)}
                  disabled={disabled}
                />
                <span className="text-sm">{config?.generateInvoice !== false ? "Sim" : "Não"}</span>
              </div>
            </div>
            <div className="space-y-1.5 min-w-[90px]">
              <Label className="text-sm font-medium whitespace-nowrap">Gerar Boleto</Label>
              <div className="flex items-center gap-2 border border-input rounded-md px-3 py-2 h-9">
                <Switch
                  checked={config?.generateBankSlip !== false}
                  onCheckedChange={(checked) => setConfigField("generateBankSlip", checked)}
                  disabled={disabled}
                />
                <span className="text-sm">{config?.generateBankSlip !== false ? "Sim" : "Não"}</span>
              </div>
            </div>
            {/* ── Condição de Pagamento (type) ── */}
            <div className="space-y-1.5 flex-1 min-w-[130px]">
              <Label className="text-sm font-medium">Condição de Pagamento</Label>
              <Combobox
                value={typeValue}
                onValueChange={handleTypeChange}
                options={PAYMENT_TYPE_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable
                disabled={disabled}
              />
            </div>
            {/* ── À vista: Vencimento ── */}
            {paymentType === "CASH" && (
              <div className="space-y-1.5 flex-1 min-w-[100px]">
                <Label className="text-sm font-medium">Vencimento</Label>
                <Combobox
                  value={vencimentoValue}
                  onValueChange={handleVencimentoChange}
                  options={VENCIMENTO_OPTIONS}
                  placeholder="Dias..."
                  searchable={false}
                  clearable={false}
                  disabled={disabled}
                />
              </div>
            )}
            {/* ── Parcelado: Intervalo ── */}
            {paymentType === "INSTALLMENTS" && (
              <div className="space-y-1.5 flex-1 min-w-[100px]">
                <Label className="text-sm font-medium">Intervalo</Label>
                <Combobox
                  value={String(paymentConfig?.installmentStep ?? 20)}
                  onValueChange={(v) => patchPayment({ installmentStep: Number(v) })}
                  options={INSTALLMENT_STEP_OPTIONS}
                  placeholder="Intervalo..."
                  searchable={false}
                  clearable={false}
                  disabled={disabled}
                />
              </div>
            )}
            {/* ── Parcelado: Entrada ── */}
            {paymentType === "INSTALLMENTS" && (
              <div className="space-y-1.5 flex-1 min-w-[100px]">
                <Label className="text-sm font-medium">Entrada</Label>
                <Combobox
                  value={entradaValue}
                  onValueChange={handleEntradaChange}
                  options={ENTRADA_OPTIONS}
                  placeholder="Dias..."
                  searchable={false}
                  clearable={false}
                  disabled={disabled}
                />
              </div>
            )}
            {/* ── Data específica ── */}
            {paymentType && showDateInput && (
              <div className="space-y-1.5 flex-1 min-w-[130px]">
                <Label className="text-sm font-medium">Data específica</Label>
                <DateTimeInput
                  mode="date"
                  value={
                    paymentConfig?.specificDate
                      ? (() => {
                          const [y, m, d] = paymentConfig.specificDate.split("-").map(Number);
                          return new Date(y, m - 1, d, 13, 0, 0);
                        })()
                      : null
                  }
                  onChange={(date) => {
                    if (!date || !(date instanceof Date)) {
                      patchPayment({ specificDate: undefined });
                      return;
                    }
                    const yyyy = date.getFullYear();
                    const mm = String(date.getMonth() + 1).padStart(2, "0");
                    const dd = String(date.getDate()).padStart(2, "0");
                    patchPayment({ specificDate: `${yyyy}-${mm}-${dd}` });
                  }}
                  disabled={disabled}
                  hideLabel
                  showClearButton
                />
              </div>
            )}
          </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
