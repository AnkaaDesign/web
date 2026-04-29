import { useState, useCallback, useRef, useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { formatCurrency } from "@/utils";
import { useCnpjLookup } from "@/hooks/common/use-cnpj-lookup";
import { RESPONSIBLE_ROLE_LABELS } from "@/types/responsible";
import { IconCreditCard, IconBuilding, IconIdBadge2 } from "@tabler/icons-react";
import {
  legacyToConfig,
  configToTypeValue,
  PAYMENT_TYPE_OPTIONS,
  VENCIMENTO_OPTIONS,
  ENTRADA_OPTIONS,
  INSTALLMENT_STEP_OPTIONS,
} from "@/components/financial/payment-config-field";
import type { PaymentConfig } from "@/schemas/task-quote";

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

const DOC_TYPE_OPTIONS = [
  { value: "cnpj", label: "CNPJ" },
  { value: "cpf", label: "CPF" },
];

interface BudgetStepCustomerPaymentProps {
  configIndex: number;
  customer: any;
  disabled?: boolean;
  taskResponsibles?: Array<{ id: string; name: string; role: string }>;
}

export function BudgetStepCustomerPayment({
  configIndex,
  customer,
  disabled,
  taskResponsibles,
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

  const handleTypeChange = useCallback((v: string | string[] | null | undefined) => {
    const val = typeof v === "string" ? v : "";
    if (!val) { setPaymentConfig(null); setShowDateInput(false); return; }
    if (val === "CASH") {
      setShowDateInput(!!paymentConfig?.specificDate);
      setPaymentConfig({ type: "CASH", cashDays: paymentConfig?.cashDays ?? 5, specificDate: paymentConfig?.specificDate });
      return;
    }
    const m = val.match(/^INST_(\d+)$/);
    if (m) {
      setShowDateInput(!!paymentConfig?.specificDate);
      setPaymentConfig({
        type: "INSTALLMENTS",
        installmentCount: Number(m[1]),
        installmentStep: paymentConfig?.installmentStep ?? 20,
        entryDays: paymentConfig?.entryDays ?? 5,
        specificDate: paymentConfig?.specificDate,
      });
    }
  }, [setPaymentConfig, paymentConfig]);

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

  // Default budget responsible to the first task responsible (only on mount)
  const hasAutoDefaulted = useRef(false);
  useEffect(() => {
    if (hasAutoDefaulted.current) return;
    if (
      taskResponsibles &&
      taskResponsibles.length > 0 &&
      !config?.responsibleId
    ) {
      hasAutoDefaulted.current = true;
      const firstValid = taskResponsibles.find((r) => !r.id.startsWith("temp-"));
      if (firstValid) {
        setFormValue(
          `customerConfigs.${configIndex}.responsibleId`,
          firstValid.id,
          { shouldDirty: false },
        );
      }
    }
  }, [taskResponsibles, config?.responsibleId, setFormValue, configIndex]);

  const configSubtotal = typeof config?.subtotal === "number" ? config.subtotal : Number(config?.subtotal) || 0;
  const configTotal = typeof config?.total === "number" ? config.total : Number(config?.total) || 0;

  const setCustomerField = useCallback((field: string, value: any) => {
    setFormValue(`customerConfigs.${configIndex}.customerData.${field}`, value, { shouldDirty: true });
  }, [setFormValue, configIndex]);

  const setConfigField = useCallback((field: string, value: any) => {
    setFormValue(`customerConfigs.${configIndex}.${field}`, value, { shouldDirty: true });
  }, [setFormValue, configIndex]);

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
    setCustomerField("cnpj", value);
    const digits = value.replace(/\D/g, "");
    if (digits.length === 14) {
      lookupCnpj(digits);
    }
  }, [setCustomerField, lookupCnpj]);

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
          {/* Document Input - CPF/CNPJ switcher */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              {docType === "cnpj" ? (
                <IconBuilding className="h-4 w-4 text-muted-foreground" />
              ) : (
                <IconIdBadge2 className="h-4 w-4 text-muted-foreground" />
              )}
              Documento
            </Label>
            <div className="flex gap-2">
              <Combobox
                value={docType}
                onValueChange={handleDocTypeChange}
                options={DOC_TYPE_OPTIONS}
                searchable={false}
                clearable={false}
                className="w-32"
                disabled={disabled}
              />
              {docType === "cnpj" ? (
                <Input
                  type="cnpj"
                  value={customerData.cnpj ?? ""}
                  onChange={(value) => handleCnpjChange(String(value ?? ""))}
                  placeholder="00.000.000/0000-00"
                  disabled={disabled}
                  transparent
                  className="flex-1"
                />
              ) : (
                <Input
                  type="cpf"
                  value={customerData.cpf ?? ""}
                  onChange={(value) => setCustomerField("cpf", String(value ?? ""))}
                  placeholder="000.000.000-00"
                  disabled={disabled}
                  transparent
                  className="flex-1"
                />
              )}
            </div>
            {isLookingUpCnpj && (
              <span className="text-xs text-primary animate-pulse">Buscando dados do CNPJ...</span>
            )}
          </div>

          {/* Fantasy Name + Corporate Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nome Fantasia</Label>
              <Input
                value={customerData.fantasyName || ""}
                onChange={(value) => setCustomerField("fantasyName", String(value ?? ""))}
                placeholder="Nome Fantasia"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Razão Social</Label>
              <Input
                value={customerData.corporateName || ""}
                onChange={(value) => setCustomerField("corporateName", String(value ?? ""))}
                placeholder="Razão Social"
                disabled={disabled}
              />
            </div>
          </div>

          {/* State Registration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Inscrição Estadual</Label>
              <Input
                value={customerData.stateRegistration || ""}
                onChange={(value) => setCustomerField("stateRegistration", String(value ?? ""))}
                placeholder="Ex: 123.456.789.012"
                disabled={disabled}
              />
            </div>
          </div>

          {/* Address - Row 1: CEP + City + State */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">CEP</Label>
              <Input
                type="cep"
                value={customerData.zipCode || ""}
                onChange={(value) => setCustomerField("zipCode", String(value ?? ""))}
                placeholder="00000-000"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Cidade</Label>
              <Input
                value={customerData.city || ""}
                onChange={(value) => setCustomerField("city", String(value ?? ""))}
                placeholder="Cidade"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Estado (UF)</Label>
              <Combobox
                value={customerData.state || ""}
                onValueChange={(v) => setCustomerField("state", typeof v === "string" ? v : "")}
                options={STATE_OPTIONS}
                placeholder="UF"
                searchable
                clearable
                disabled={disabled}
              />
            </div>
          </div>

          {/* Address - Row 2: Street Type + Address + Number */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
            <div className="md:col-span-2 space-y-2">
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
            <div className="md:col-span-3 space-y-2">
              <Label className="text-sm font-medium">Logradouro</Label>
              <Input
                value={customerData.address || ""}
                onChange={(value) => setCustomerField("address", String(value ?? ""))}
                placeholder="Rua, Avenida, etc."
                disabled={disabled}
              />
            </div>
            <div className="md:col-span-1 space-y-2">
              <Label className="text-sm font-medium">Número</Label>
              <Input
                value={customerData.addressNumber || ""}
                onChange={(value) => setCustomerField("addressNumber", String(value ?? ""))}
                placeholder="Nº"
                disabled={disabled}
              />
            </div>
          </div>

          {/* Address - Row 3: Neighborhood + Complement */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Bairro</Label>
              <Input
                value={customerData.neighborhood || ""}
                onChange={(value) => setCustomerField("neighborhood", String(value ?? ""))}
                placeholder="Bairro"
                disabled={disabled}
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
              <Label className="text-sm text-muted-foreground">Subtotal</Label>
              <Input value={formatCurrency(configSubtotal)} disabled className="bg-muted" />
            </div>
            <div className="space-y-1.5 flex-1 min-w-[100px]">
              <Label className="text-sm font-bold">Total</Label>
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
            <div className="space-y-1.5 flex-1 min-w-[100px]">
              <Label className="text-sm font-medium">N° do Pedido</Label>
              <Input
                type="natural"
                value={config?.orderNumber ? (parseInt(config.orderNumber.replace(/\D/g, ''), 10) || undefined) : undefined}
                onChange={(value) => setConfigField("orderNumber", value != null ? String(value) : null)}
                placeholder="Ex: 12345"
                disabled={disabled}
              />
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
            {taskResponsibles && taskResponsibles.length > 0 && (
              <div className="space-y-1.5 flex-1 min-w-[130px]">
                <Label className="text-sm font-medium">Responsável</Label>
                <Combobox
                  value={config?.responsibleId || ""}
                  onValueChange={(value) => setConfigField("responsibleId", value || null)}
                  options={taskResponsibles
                    .filter((r) => !r.id.startsWith("temp-"))
                    .map((r) => ({
                      value: r.id,
                      label: `${r.name} (${RESPONSIBLE_ROLE_LABELS[r.role as keyof typeof RESPONSIBLE_ROLE_LABELS] || r.role})`,
                    }))}
                  placeholder="Selecione"
                  emptyText="Nenhum responsável"
                  disabled={disabled}
                  searchable={false}
                  clearable={true}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
