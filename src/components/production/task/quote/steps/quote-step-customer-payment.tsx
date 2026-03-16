import { useState, useCallback, useEffect, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { Switch } from "@/components/ui/switch";
import { IconCurrencyReal, IconCreditCard } from "@tabler/icons-react";
import { formatCurrency } from "../../../../../utils";
import { RESPONSIBLE_ROLE_LABELS } from "@/types/responsible";

const PAYMENT_CONDITIONS = [
  { value: "CASH", label: "À vista" },
  { value: "INSTALLMENTS_2", label: "Entrada + 20" },
  { value: "INSTALLMENTS_3", label: "Entrada + 20/40" },
  { value: "INSTALLMENTS_4", label: "Entrada + 20/40/60" },
  { value: "INSTALLMENTS_5", label: "Entrada + 20/40/60/80" },
  { value: "INSTALLMENTS_6", label: "Entrada + 20/40/60/80/100" },
  { value: "INSTALLMENTS_7", label: "Entrada + 20/40/60/80/100/120" },
  { value: "CUSTOM", label: "Personalizado" },
] as const;

interface QuoteStepCustomerPaymentProps {
  configIndex: number;
  customer: any;
  disabled?: boolean;
  taskResponsibles?: Array<{ id: string; name: string; role: string }>;
}

export function QuoteStepCustomerPayment({
  configIndex,
  customer,
  disabled,
  taskResponsibles,
}: QuoteStepCustomerPaymentProps) {
  const { setValue, control } = useFormContext();
  const [showCustomPayment, setShowCustomPayment] = useState(false);

  const config = useWatch({
    control,
    name: `customerConfigs.${configIndex}`,
  });

  // Initialize custom payment state
  useEffect(() => {
    if (config?.customPaymentText && !showCustomPayment) {
      setShowCustomPayment(true);
    }
  }, [config?.customPaymentText, showCustomPayment]);

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
        setValue(
          `customerConfigs.${configIndex}.responsibleId`,
          firstValid.id,
          { shouldDirty: false },
        );
      }
    }
  }, [taskResponsibles, config?.responsibleId, setValue, configIndex]);

  const handlePaymentConditionChange = useCallback(
    (value: string) => {
      if (value === "CUSTOM") {
        setShowCustomPayment(true);
        setValue(
          `customerConfigs.${configIndex}.paymentCondition`,
          "CUSTOM",
        );
      } else {
        setShowCustomPayment(false);
        setValue(
          `customerConfigs.${configIndex}.customPaymentText`,
          null,
        );
        setValue(
          `customerConfigs.${configIndex}.paymentCondition`,
          value || null,
        );
      }
    },
    [setValue, configIndex],
  );

  const configSubtotal = config?.subtotal || 0;
  const configTotal = config?.total || 0;
  const configPaymentCondition = config?.paymentCondition || "";
  const currentCondition = config?.customPaymentText
    ? "CUSTOM"
    : configPaymentCondition;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          {customer && (
            <CustomerLogoDisplay
              logo={customer.logo}
              customerName={customer.fantasyName}
              size="md"
              shape="rounded"
              className="flex-shrink-0"
            />
          )}
          <div>
            <CardTitle className="flex items-center gap-2">
              <IconCreditCard className="h-4 w-4" />
              {customer?.fantasyName || customer?.corporateName || "Cliente"}
            </CardTitle>
            {customer?.cnpj && (
              <p className="text-sm text-muted-foreground mt-0.5">
                CNPJ: {customer.cnpj}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Read-only Subtotal & Total */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormItem>
            <FormLabel className="flex items-center gap-1.5">
              <IconCurrencyReal className="h-3.5 w-3.5" />
              Subtotal (serviços atribuídos)
            </FormLabel>
            <FormControl>
              <Input
                value={formatCurrency(configSubtotal)}
                readOnly
                className="bg-muted cursor-not-allowed text-sm"
              />
            </FormControl>
          </FormItem>
          <FormItem>
            <FormLabel className="flex items-center gap-1.5">
              <IconCurrencyReal className="h-3.5 w-3.5 text-primary" />
              Valor Total (com descontos)
            </FormLabel>
            <FormControl>
              <Input
                value={formatCurrency(configTotal)}
                readOnly
                className="bg-transparent font-bold text-lg text-primary cursor-not-allowed border-primary"
              />
            </FormControl>
          </FormItem>
        </div>

        {/* Budget Responsible */}
        {taskResponsibles && taskResponsibles.length > 0 && (
          <FormField
            control={control}
            name={`customerConfigs.${configIndex}.responsibleId`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Responsável do Orçamento</FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value || ""}
                    onValueChange={(value) => field.onChange(value || null)}
                    options={taskResponsibles
                      .filter((r) => !r.id.startsWith("temp-"))
                      .map((r) => ({
                        value: r.id,
                        label: `${r.name} (${RESPONSIBLE_ROLE_LABELS[r.role as keyof typeof RESPONSIBLE_ROLE_LABELS] || r.role})`,
                      }))}
                    placeholder="Selecione o responsável"
                    emptyText="Nenhum responsável disponível"
                    disabled={disabled}
                    searchable={false}
                    clearable={true}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Generate Invoice Toggle + Payment Condition + Down Payment Date */}
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-4 items-end">
          <FormField
            control={control}
            name={`customerConfigs.${configIndex}.generateInvoice`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Emitir Nota Fiscal</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-2 rounded-md border border-border/40 dark:border-border/20 px-3 h-10">
                    <Switch
                      checked={field.value !== false}
                      onCheckedChange={field.onChange}
                      disabled={disabled}
                    />
                    <span className="text-xs text-muted-foreground">
                      {field.value !== false ? "Sim" : "Não"}
                    </span>
                  </div>
                </FormControl>
              </FormItem>
            )}
          />

          <FormItem>
            <FormLabel>Condição de Pagamento</FormLabel>
            <FormControl>
              <Combobox
                value={currentCondition}
                onValueChange={(value) => {
                  if (typeof value === "string")
                    handlePaymentConditionChange(value);
                }}
                disabled={disabled}
                options={PAYMENT_CONDITIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
                placeholder="Selecione"
                emptyText="Nenhuma opção"
              />
            </FormControl>
          </FormItem>

          <FormField
            control={control}
            name={`customerConfigs.${configIndex}.downPaymentDate`}
            render={({ field }) => (
              <DateTimeInput
                field={field}
                mode="date"
                label="Data da Entrada"
                disabled={disabled}
              />
            )}
          />
        </div>

        {/* Custom Payment Text */}
        {showCustomPayment && (
          <FormField
            control={control}
            name={`customerConfigs.${configIndex}.customPaymentText`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Texto Personalizado de Pagamento</FormLabel>
                <FormControl>
                  <textarea
                    {...field}
                    value={field.value || ""}
                    placeholder="Descreva as condições de pagamento personalizadas..."
                    disabled={disabled}
                    rows={3}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </CardContent>
    </Card>
  );
}
