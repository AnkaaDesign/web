import { IconCurrencyReal, IconFileInvoice, IconLock, IconPlus, IconReceipt, IconTrash, IconUserDollar } from "@tabler/icons-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CustomerCombobox } from "@/components/ui/customer-combobox";
import { PaymentConfigField } from "@/components/financial/payment-config-field";
import { formatCurrency } from "../../../../utils";
import type { PaymentConfig } from "@/schemas/task-quote";
import type { Customer } from "@/types/customer";

export interface BillingServiceRow {
  id?: string;
  description: string;
  amount: number;
}

interface ExternalOperationBillingSectionProps {
  customerId: string | null;
  onCustomerIdChange: (customerId: string | null) => void;
  initialCustomer?: Customer | null;
  generateInvoice: boolean;
  onGenerateInvoiceChange: (value: boolean) => void;
  generateBankSlip: boolean;
  onGenerateBankSlipChange: (value: boolean) => void;
  paymentConfig: PaymentConfig | null;
  onPaymentConfigChange: (config: PaymentConfig | null) => void;
  services: BillingServiceRow[];
  onServicesChange: (services: BillingServiceRow[]) => void;
  /** Service mode: at least one service row is required */
  servicesRequired?: boolean;
  disabled?: boolean;
  /** Note shown when the section is locked (status !== PENDING) */
  disabledReason?: string;
}

/**
 * Billing configuration section for CHARGEABLE external withdrawals:
 * customer selector, NFS-e / boleto switches, payment condition and the
 * ad-hoc services editor (description + amount rows).
 */
export function ExternalOperationBillingSection({
  customerId,
  onCustomerIdChange,
  initialCustomer,
  generateInvoice,
  onGenerateInvoiceChange,
  generateBankSlip,
  onGenerateBankSlipChange,
  paymentConfig,
  onPaymentConfigChange,
  services,
  onServicesChange,
  servicesRequired = false,
  disabled = false,
  disabledReason,
}: ExternalOperationBillingSectionProps) {
  const servicesTotal = services.reduce((sum, service) => sum + (Number(service.amount) || 0), 0);

  const handleServiceChange = (index: number, patch: Partial<BillingServiceRow>) => {
    onServicesChange(services.map((service, i) => (i === index ? { ...service, ...patch } : service)));
  };

  const handleAddService = () => {
    onServicesChange([...services, { description: "", amount: 0 }]);
  };

  const handleRemoveService = (index: number) => {
    onServicesChange(services.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Billing Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconUserDollar className="h-5 w-5" />
            Faturamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {disabled && disabledReason && (
            <div className="flex items-start gap-2 bg-muted/50 border border-border rounded-lg p-3 text-sm text-muted-foreground">
              <IconLock className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{disabledReason}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Cliente <span className="text-destructive">*</span>
              </Label>
              <CustomerCombobox
                value={customerId}
                onValueChange={onCustomerIdChange}
                initialCustomer={initialCustomer ?? undefined}
                disabled={disabled}
                placeholder="Selecione o cliente"
              />
              <p className="text-xs text-muted-foreground">Necessário para emitir NFS-e e boletos</p>
            </div>

            {/* Payment condition */}
            <PaymentConfigField paymentConfig={paymentConfig} onChange={onPaymentConfigChange} disabled={disabled} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* NFS-e switch */}
            <div className="flex items-center justify-between bg-muted/30 border border-border rounded-lg px-4 py-3">
              <Label htmlFor="generate-invoice-switch" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                <IconFileInvoice className="h-4 w-4 text-muted-foreground" />
                Emitir NFS-e
              </Label>
              <Switch id="generate-invoice-switch" checked={generateInvoice} onCheckedChange={onGenerateInvoiceChange} disabled={disabled} />
            </div>

            {/* Boleto switch */}
            <div className="flex items-center justify-between bg-muted/30 border border-border rounded-lg px-4 py-3">
              <Label htmlFor="generate-bank-slip-switch" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                <IconReceipt className="h-4 w-4 text-muted-foreground" />
                Gerar Boleto
              </Label>
              <Switch id="generate-bank-slip-switch" checked={generateBankSlip} onCheckedChange={onGenerateBankSlipChange} disabled={disabled} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services editor */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <IconCurrencyReal className="h-5 w-5" />
            Serviços
            {servicesRequired && <span className="text-destructive">*</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {services.length > 0 && (
            <div className="grid grid-cols-[minmax(150px,1fr)_200px_36px] gap-2 text-xs font-semibold text-muted-foreground uppercase">
              <span className="px-2">Descrição</span>
              <span className="px-2">Valor</span>
              <span />
            </div>
          )}

          {services.map((service, index) => (
            <div key={service.id ?? index} className="grid grid-cols-[minmax(150px,1fr)_200px_36px] gap-2 items-center">
              <Input
                value={service.description}
                onChange={(value: string | number | null) => handleServiceChange(index, { description: typeof value === "string" ? value : String(value ?? "") })}
                placeholder="Descrição do serviço"
                disabled={disabled}
                maxLength={500}
                className="h-9"
              />
              <Input
                type="currency"
                value={service.amount || 0}
                onChange={(val: any) => handleServiceChange(index, { amount: Number(val) || 0 })}
                disabled={disabled}
                className="h-9"
              />
              {!disabled ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveService(index)}
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              ) : (
                <span />
              )}
            </div>
          ))}

          {services.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {servicesRequired
                ? "Adicione pelo menos um serviço com descrição e valor."
                : "Nenhum serviço adicionado. Operações cobráveis podem ter itens, serviços ou ambos."}
            </p>
          )}

          {!disabled && (
            <Button type="button" variant="outline" size="sm" onClick={handleAddService} className="w-full">
              <IconPlus className="h-4 w-4 mr-2" />
              Adicionar Serviço
            </Button>
          )}

          {services.length > 0 && (
            <div className="flex items-center justify-between pt-2 border-t border-border text-sm">
              <span className="text-muted-foreground">Total de serviços</span>
              <span className="font-semibold">{formatCurrency(servicesTotal)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
