import { useState, useEffect, useCallback } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/utils";
import { useCnpjLookup } from "@/hooks/common/use-cnpj-lookup";
import { IconCreditCard, IconBuilding, IconIdBadge2 } from "@tabler/icons-react";

const PAYMENT_CONDITION_OPTIONS = [
  { value: "CASH_5", label: "À vista (5 dias)" },
  { value: "CASH_40", label: "À vista (40 dias)" },
  { value: "INSTALLMENTS_2", label: "Entrada + 20" },
  { value: "INSTALLMENTS_3", label: "Entrada + 20/40" },
  { value: "INSTALLMENTS_4", label: "Entrada + 20/40/60" },
  { value: "INSTALLMENTS_5", label: "Entrada + 20/40/60/80" },
  { value: "INSTALLMENTS_6", label: "Entrada + 20/40/60/80/100" },
  { value: "INSTALLMENTS_7", label: "Entrada + 20/40/60/80/100/120" },
  { value: "CUSTOM", label: "Personalizado" },
];

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

interface BillingStepCustomerProps {
  configIndex: number;
  customer: any;
  disabled?: boolean;
}

export function BillingStepCustomer({ configIndex, customer, disabled }: BillingStepCustomerProps) {
  const { control, setValue: setFormValue } = useFormContext();
  const config = useWatch({ control, name: `customerConfigs.${configIndex}` });
  const customerData = config?.customerData || {};

  const [showCustomPayment, setShowCustomPayment] = useState(false);
  const [docType, setDocType] = useState<"cnpj" | "cpf">(() => {
    if (customerData.cpf && !customerData.cnpj) return "cpf";
    return "cnpj";
  });

  useEffect(() => {
    if (config?.customPaymentText || config?.paymentCondition === "CUSTOM") {
      setShowCustomPayment(true);
    }
  }, [config?.customPaymentText, config?.paymentCondition]);

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
      if (data.registrationStatus) setCustomerField("registrationStatus", data.registrationStatus);
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
      {/* Single card: Dados do Cliente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconBuilding className="h-5 w-5 text-muted-foreground" />
            Dados {customerLabel}
          </CardTitle>
          <CardDescription>Informações do cliente para emissão de NFS-e</CardDescription>
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
              <span className="text-destructive">*</span>
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
              <Label className="text-sm font-medium">Nome Fantasia <span className="text-destructive">*</span></Label>
              <Input
                value={customerData.fantasyName || ""}
                onChange={(value) => setCustomerField("fantasyName", String(value ?? ""))}
                placeholder="Nome Fantasia"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Razão Social <span className="text-destructive">*</span></Label>
              <Input
                value={customerData.corporateName || ""}
                onChange={(value) => setCustomerField("corporateName", String(value ?? ""))}
                placeholder="Razão Social"
                disabled={disabled}
              />
            </div>
          </div>

          {/* Situação Cadastral + State Registration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <Label className="text-sm font-medium">CEP <span className="text-destructive">*</span></Label>
              <Input
                type="cep"
                value={customerData.zipCode || ""}
                onChange={(value) => setCustomerField("zipCode", String(value ?? ""))}
                placeholder="00000-000"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Cidade <span className="text-destructive">*</span></Label>
              <Input
                value={customerData.city || ""}
                onChange={(value) => setCustomerField("city", String(value ?? ""))}
                placeholder="Cidade"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Estado (UF) <span className="text-destructive">*</span></Label>
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

          {/* Address - Row 2: Street Type (2/6) + Address (3/6) + Number (1/6) */}
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
              <Label className="text-sm font-medium">Logradouro <span className="text-destructive">*</span></Label>
              <Input
                value={customerData.address || ""}
                onChange={(value) => setCustomerField("address", String(value ?? ""))}
                placeholder="Rua, Avenida, etc."
                disabled={disabled}
              />
            </div>
            <div className="md:col-span-1 space-y-2">
              <Label className="text-sm font-medium">Número <span className="text-destructive">*</span></Label>
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
              <Label className="text-sm font-medium">Bairro <span className="text-destructive">*</span></Label>
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

      {/* Faturamento e Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconCreditCard className="h-5 w-5 text-muted-foreground" />
            Faturamento e Pagamento
          </CardTitle>
          <CardDescription>Condições de pagamento e faturamento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto_1fr_1fr] gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Subtotal</Label>
              <Input value={formatCurrency(configSubtotal)} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium font-bold">Total</Label>
              <Input
                value={formatCurrency(configTotal)}
                disabled
                className="bg-transparent text-lg font-bold text-primary border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium whitespace-nowrap">Gerar Nota Fiscal</Label>
              <div className="flex items-center gap-3 border border-input rounded-md px-3 py-2 h-10">
                <Switch
                  checked={config?.generateInvoice !== false}
                  onCheckedChange={(checked) => setConfigField("generateInvoice", checked)}
                  disabled={disabled}
                />
                <span className="text-sm">
                  {config?.generateInvoice !== false ? "Sim" : "Não"}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Condição de Pagamento <span className="text-destructive">*</span></Label>
              <Combobox
                value={config?.paymentCondition || ""}
                onValueChange={(v) => {
                  const val = typeof v === "string" ? v : "";
                  setConfigField("paymentCondition", val || null);
                  if (val === "CUSTOM") {
                    setShowCustomPayment(true);
                  } else {
                    setShowCustomPayment(false);
                    setConfigField("customPaymentText", null);
                  }
                }}
                options={PAYMENT_CONDITION_OPTIONS}
                placeholder="Selecione..."
                searchable={false}
                clearable
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">N° do Pedido</Label>
              <Input
                value={config?.orderNumber || ""}
                onChange={(value) => setConfigField("orderNumber", String(value ?? "") || null)}
                placeholder="Ex: 12345"
                disabled={disabled}
              />
            </div>
          </div>

          {showCustomPayment && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Condições Personalizadas</Label>
              <Textarea
                value={config?.customPaymentText || ""}
                onChange={(e) => setConfigField("customPaymentText", e.target.value || null)}
                rows={3}
                placeholder="Descreva as condições de pagamento personalizadas..."
                disabled={disabled}
                className="min-h-[80px]"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
