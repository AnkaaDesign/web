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
import { IconCreditCard, IconBuilding, IconIdBadge2 } from "@tabler/icons-react";
import {
  legacyToConfig,
  configToTypeValue,
  PAYMENT_TYPE_OPTIONS,
  VENCIMENTO_OPTIONS,
  ENTRADA_OPTIONS,
  INSTALLMENT_STEP_OPTIONS,
} from "@/components/financial/payment-config-field";
import type { PaymentConfig } from "@/schemas/budget";
import {
  BillingSplitField,
  type BillingSplitValue,
  type BillingSplitVehicle,
} from "@/components/financial/shared/billing-split-field";
import { attentionFieldClass, useAttentionField } from "@/lib/attention";
import { missingBillingCustomerKeys, NFSE_DOCUMENT_KEY } from "@/lib/billing-customer-data";
import { cn } from "@/lib/utils";
import { vehicleCombinationCount } from "@/utils/vehicle-combinations";

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

interface BudgetStepCustomerPaymentProps {
  configIndex: number;
  customer: any;
  disabled?: boolean;
  /** Attention entity id — the TASK_QUOTE this config belongs to. */
  quoteId?: string;
  /**
   * Quantos veículos o orçamento JÁ cobre, quando ele existe.
   *
   * Na criação a contagem sai de placas × números de série do passo 1 — é o
   * mesmo produto cartesiano que vira `taskIds`. Na edição esse cálculo não
   * serve: o formulário carrega os campos de UMA tarefa, daria 1, e o seletor
   * de faturamento sumiria de um orçamento de sessenta caminhões — sem jeito de
   * trocar `JOINT` por `PER_TASK` depois que o erro aparece no faturamento.
   */
  existingVehicleCount?: number;
  /**
   * OS VEÍCULOS do orçamento existente, com id.
   *
   * Só existem na EDIÇÃO. É o que permite compor lotes — "os vinte primeiros
   * numa fatura, os quarenta noutra" —, porque um lote é uma lista de ids. Na
   * criação a lista é vazia e o controle oferece só junto/separado: agrupar
   * veículos que ainda não existem exigiria identidades provisórias.
   */
  existingVehicles?: BillingSplitVehicle[];
  /** Quantas faturas deste orçamento já foram aprovadas — trava o refatiamento. */
  approvedBillingCount?: number;
}

export function BudgetStepCustomerPayment({
  configIndex,
  customer,
  disabled,
  quoteId,
  existingVehicleCount,
  existingVehicles,
  approvedBillingCount = 0,
}: BudgetStepCustomerPaymentProps) {
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

  // ── QUANTOS VEÍCULOS ──────────────────────────────────────────────────────
  //
  // A MESMA conta do passo 1 (`vehicleCombinations`) e a mesma que a criação usa
  // para montar `taskIds`. Duas fontes de verdade sobre esta contagem
  // produziriam um seletor oferecendo "uma fatura por veículo" para um número de
  // veículos que não é o que será criado.
  const platesWatch = (useWatch({ control, name: "plates" }) as string[] | undefined) ?? [];
  const serialNumbersWatch =
    (useWatch({ control, name: "serialNumbers" }) as unknown[] | undefined) ?? [];
  const billingSplit = useWatch({ control, name: "billingSplit" }) as string | undefined;
  // A PARTIÇÃO dos veículos, só relevante em lotes. Vive num campo do orçamento
  // (e não espalhada por `customerConfigs`) porque é a MESMA para todos os
  // clientes: quem a transforma em `taskIds` por fatura é o save.
  const billingGroups =
    (useWatch({ control, name: "billingGroups" }) as string[][] | undefined) ?? [];
  const vehicleCount = useMemo(() => {
    // O orçamento já existe: quem manda é a contagem de tarefas dele.
    if (existingVehicleCount && existingVehicleCount > 0) return existingVehicleCount;
    return vehicleCombinationCount(platesWatch, serialNumbersWatch as (string | number)[]);
  }, [existingVehicleCount, platesWatch, serialNumbersWatch]);

  // O N° DO PEDIDO NÃO MORA MAIS AQUI. Ele é da ENTREGA
  // (`Task.customerOrderNumber`), não do cliente, e vive no passo 1, ao lado da
  // placa e do número de série: na criação um valor para os N veículos que vão
  // nascer, e depois um por caminhão, editável abrindo a tarefa (ou o orçamento
  // por ela). Aqui o campo aparecia uma vez POR CLIENTE, e num orçamento de dois
  // clientes a segunda cópia sobrescrevia a primeira sem que ninguém notasse.

  // Attention: `task-quote.billing-customer-incomplete`. Identical narrowing to the Faturamento
  // step (see `billing-step-customer.tsx`) — one address for the whole cadastro, painted only on
  // the inputs that are empty in the FORM, and only for configs that will produce a nota. The
  // rule can be active here because an approved budget is reachable from BOTH lists, and the
  // cadastro is fixed in the same place either way.
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
  // `services[].amount` é o preço de UM caminhão (ver `utils/quote-money.ts`) e
  // o formulário guarda o total na mesma escala — é o que o Resumo depois
  // apresenta como "TOTAL POR VEÍCULO · × N · TOTAL GERAL". Aqui os dois campos
  // diziam só "Subtotal" e "Total", e num orçamento de quatro caminhões esse
  // "Total" é um quarto do que o cliente vai pagar.
  const configSubtotal = typeof config?.subtotal === "number" ? config.subtotal : Number(config?.subtotal) || 0;
  const configTotal = typeof config?.total === "number" ? config.total : Number(config?.total) || 0;
  const showPerVehicleLabels = vehicleCount > 1;
  const configGrandTotal = Math.round(configTotal * vehicleCount * 100) / 100;

  const setCustomerField = useCallback((field: string, value: any) => {
    setFormValue(`customerConfigs.${configIndex}.customerData.${field}`, value, { shouldDirty: true });
  }, [setFormValue, configIndex]);

  // Lock the CNPJ field once the linked customer already has one on record.
  // Typing a CNPJ here fires a Brasil-API lookup that OVERWRITES corporateName,
  // address, city, etc. on the shared master customer at save time — so entering
  // a different company's CNPJ silently clobbers an existing customer's registry
  // (this turned the "Ibiporã" customer into "Sola" on 2026-07-13). The lookup is
  // only meant to fill in a customer that has no CNPJ yet; corrections to an
  // existing CNPJ must be made in the customer registry, not in this step.
  const customerHasCnpj = String(customer?.cnpj ?? "").replace(/\D/g, "").length > 0;

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
    <div className="space-y-4">
      {/* Customer Data Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconBuilding className="h-5 w-5 text-muted-foreground" />
            Dados {customerLabel}
          </CardTitle>
          <CardDescription>Informações do cliente para o orçamento</CardDescription>
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
                  disabled={disabled}
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
                    disabled={disabled}
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
              {docType === "cnpj" && customerHasCnpj && !isLookingUpCnpj && (
                <span className="block text-xs text-muted-foreground">
                  CNPJ já cadastrado — para corrigi-lo, edite o cliente no cadastro.
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
        </CardContent>
      </Card>

      {/* Billing & Payment Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconCreditCard className="h-5 w-5 text-muted-foreground" />
            Faturamento e Pagamento
          </CardTitle>
          <CardDescription>Condições de pagamento e faturamento</CardDescription>
        </CardHeader>
        <CardContent>
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
                  Total geral ({vehicleCount} veíc.)
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
            {/* ═══════════════════════════════════════════════════════════════
                JUNTO, SEPARADO OU EM LOTES

                Mora aqui, e não no passo Informações, porque a escolha É sobre
                faturamento: quantas faturas, quantas notas fiscais e quantos
                planos de parcelas este cliente vai receber. Fica na mesma linha
                da condição de pagamento, que é a outra metade da mesma decisão.

                Só no PRIMEIRO cliente: a escolha é do ORÇAMENTO, não de cada
                cliente (um lote é uma unidade de cobrança, não um negócio
                diferente), e repeti-la por passo faria a segunda cópia
                sobrescrever a primeira sem que ninguém notasse. Com um veículo
                só o componente não renderiza nada — a pergunta não existe.

                ⚠️ E A CONTAGEM ENTRA NA CONDIÇÃO, não só dentro do componente.
                `BillingSplitField` devolve `null` com um veículo, mas o
                INVÓLUCRO continuava sendo renderizado: um item de flex com
                `flex-1 min-w-[260px]` e nada dentro, ou seja, um buraco de 260px
                no meio da linha em todo orçamento de UM veículo — que é a
                esmagadora maioria. Quem decide não renderizar tem de ser quem
                ocupa o espaço. (Defeito gêmeo em `billing-step-customer`.)
                ═════════════════════════════════════════════════════════════ */}
            {configIndex === 0 && ((existingVehicles?.length ?? 0) > 1 || (vehicleCount ?? 0) > 1) && (
              <div className="flex-1 min-w-[260px]">
                <BillingSplitField
                  vehicles={existingVehicles ?? []}
                  vehicleCount={vehicleCount}
                  value={(billingSplit ?? "JOINT") as BillingSplitValue}
                  groups={billingGroups}
                  disabled={disabled}
                  approvedCount={approvedBillingCount}
                  onChange={({ billingSplit: nextSplit, billingGroups: nextGroups }) => {
                    setFormValue("billingSplit", nextSplit, { shouldDirty: true });
                    setFormValue("billingGroups", nextGroups, { shouldDirty: true });
                  }}
                />
              </div>
            )}
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
        </CardContent>
      </Card>
    </div>
  );
}
