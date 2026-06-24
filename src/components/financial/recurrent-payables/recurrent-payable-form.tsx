import { useEffect, useMemo } from "react";
import { useForm, FormProvider, useWatch, useFormState } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  IconFileText,
  IconBuilding,
  IconCash,
  IconCalendarRepeat,
  IconAdjustments,
} from "@tabler/icons-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FormMoneyInput } from "@/components/ui/form-money-input";
import { FormCNPJInput } from "@/components/ui/form-cnpj-input";

import { useReconciliationCategories } from "@/hooks/financial/use-reconciliation";
import { PAYMENT_METHOD, PAYMENT_METHOD_LABELS, SCHEDULE_FREQUENCY, SCHEDULE_FREQUENCY_LABELS } from "@/constants";
import type { CreateRecurrentPayablePayload, RecurrentPayable } from "@/types/recurrent-payable";

// Frequencies offered for recurrent bills (most are monthly; the rest cover
// quarterly/semestral/annual contracts). MONTHLY is the default.
const FREQUENCY_OPTIONS = [
  SCHEDULE_FREQUENCY.MONTHLY,
  SCHEDULE_FREQUENCY.BIMONTHLY,
  SCHEDULE_FREQUENCY.QUARTERLY,
  SCHEDULE_FREQUENCY.SEMI_ANNUAL,
  SCHEDULE_FREQUENCY.ANNUAL,
].map((value) => ({ value, label: SCHEDULE_FREQUENCY_LABELS[value] }));

const PAYMENT_METHOD_OPTIONS = Object.values(PAYMENT_METHOD).map((value) => ({
  value,
  label: PAYMENT_METHOD_LABELS[value],
}));

const AMOUNT_KIND_OPTIONS = [
  { value: "FIXED", label: "Fixo (valor conhecido)" },
  { value: "VARIABLE", label: "Variável (estimativa até o pagamento)" },
];

// FIXED requires a positive fixedAmount; VARIABLE only carries an optional
// estimate. The cross-field rule mirrors the backend contract.
const formSchema = z
  .object({
    name: z.string().trim().min(1, { message: "Informe o nome da conta" }).max(200),
    description: z.string().max(500).optional(),
    payeeName: z.string().max(200).optional(),
    // Free text — formatted CNPJ; cleaned + validated (14 digits) server-side.
    payeeCnpj: z
      .string()
      .optional()
      .refine((v) => !v || v.replace(/\D/g, "").length === 0 || v.replace(/\D/g, "").length === 14, {
        message: "CNPJ deve ter 14 dígitos",
      }),
    categoryId: z.string().uuid({ message: "Selecione a categoria" }),
    amountKind: z.enum(["FIXED", "VARIABLE"]),
    fixedAmount: z.coerce.number({ invalid_type_error: "valor inválido" }).optional(),
    estimatedAmount: z.coerce.number({ invalid_type_error: "valor inválido" }).optional(),
    frequency: z.enum(["MONTHLY", "BIMONTHLY", "QUARTERLY", "TRIANNUAL", "QUADRIMESTRAL", "SEMI_ANNUAL", "ANNUAL"]),
    dueDayOfMonth: z.coerce
      .number({ invalid_type_error: "dia inválido" })
      .int()
      .min(1, { message: "Entre 1 e 31" })
      .max(31, { message: "Entre 1 e 31" }),
    paymentMethod: z.enum([PAYMENT_METHOD.PIX, PAYMENT_METHOD.BANK_SLIP, PAYMENT_METHOD.CREDIT_CARD]).optional(),
    expectsNf: z.boolean(),
    isActive: z.boolean(),
  })
  .refine((d) => d.amountKind !== "FIXED" || (typeof d.fixedAmount === "number" && d.fixedAmount > 0), {
    message: "Informe o valor fixo (maior que zero)",
    path: ["fixedAmount"],
  });

type FormData = z.infer<typeof formSchema>;

const EMPTY_DEFAULTS: FormData = {
  name: "",
  description: "",
  payeeName: "",
  payeeCnpj: "",
  categoryId: "",
  amountKind: "FIXED",
  fixedAmount: undefined,
  estimatedAmount: undefined,
  frequency: SCHEDULE_FREQUENCY.MONTHLY,
  dueDayOfMonth: undefined as unknown as number,
  paymentMethod: undefined,
  expectsNf: false,
  isActive: true,
};

export interface RecurrentPayableFormState {
  isValid: boolean;
  isDirty: boolean;
}

interface RecurrentPayableFormProps {
  /** Existing payable when editing — seeds the form. Omit/null to create. */
  payable?: RecurrentPayable | null;
  isSubmitting?: boolean;
  onSubmit: (payload: CreateRecurrentPayablePayload, id?: string) => void;
  onFormStateChange?: (state: RecurrentPayableFormState) => void;
}

export function RecurrentPayableForm({ payable, isSubmitting, onSubmit, onFormStateChange }: RecurrentPayableFormProps) {
  const { data: categories } = useReconciliationCategories({ includeInactive: false });
  const categoryOptions = useMemo(
    () => (categories ?? []).map((c) => ({ value: c.id, label: c.name })),
    [categories],
  );

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_DEFAULTS,
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  // Seed from the existing payable once it loads (edit mode).
  useEffect(() => {
    if (payable) {
      form.reset({
        name: payable.name,
        description: payable.description ?? "",
        payeeName: payable.payeeName ?? "",
        payeeCnpj: payable.payeeCnpj ?? "",
        categoryId: payable.categoryId,
        amountKind: payable.amountKind,
        fixedAmount: payable.fixedAmount != null ? Number(payable.fixedAmount) : undefined,
        estimatedAmount: payable.estimatedAmount != null ? Number(payable.estimatedAmount) : undefined,
        frequency: payable.frequency || SCHEDULE_FREQUENCY.MONTHLY,
        dueDayOfMonth: payable.dueDayOfMonth,
        paymentMethod: (payable.paymentMethod as PAYMENT_METHOD | null) ?? undefined,
        expectsNf: payable.expectsNf,
        isActive: payable.isActive,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payable?.id]);

  const { isValid, isDirty } = useFormState({ control: form.control });
  useEffect(() => {
    onFormStateChange?.({ isValid, isDirty });
  }, [isValid, isDirty, onFormStateChange]);

  const amountKind = useWatch({ control: form.control, name: "amountKind" });

  const handleSubmit = (data: FormData) => {
    const cnpjDigits = (data.payeeCnpj ?? "").replace(/\D/g, "");
    const payload: CreateRecurrentPayablePayload = {
      name: data.name.trim(),
      description: data.description?.trim() ? data.description.trim() : null,
      // Recurrent bills are not provided by inventory suppliers — payee is free
      // text + optional CNPJ.
      supplierId: null,
      payeeName: data.payeeName?.trim() ? data.payeeName.trim() : null,
      payeeCnpj: cnpjDigits.length === 14 ? cnpjDigits : null,
      categoryId: data.categoryId,
      amountKind: data.amountKind,
      fixedAmount: data.amountKind === "FIXED" ? data.fixedAmount ?? null : null,
      estimatedAmount: data.amountKind === "VARIABLE" ? data.estimatedAmount ?? null : null,
      frequency: data.frequency,
      dueDayOfMonth: data.dueDayOfMonth,
      paymentMethod: data.paymentMethod ?? null,
      expectsNf: data.expectsNf,
      isActive: data.isActive,
    };
    onSubmit(payload, payable?.id);
  };

  return (
    <FormProvider {...form}>
      <form id="recurrent-payable-form" onSubmit={form.handleSubmit(handleSubmit)} className="container mx-auto max-w-4xl">
        {/* Programmatic submit target for the PageHeader action button. */}
        <button id="recurrent-payable-form-submit" type="submit" className="hidden" disabled={isSubmitting}>
          Submit
        </button>

        <div className="space-y-4">
          {/* Identificação */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconFileText className="h-5 w-5 text-muted-foreground" />
                Identificação
              </CardTitle>
              <CardDescription>Nome, descrição e a categoria contábil usada na conciliação.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Nome <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        value={field.value ?? ""}
                        onChange={(value) => field.onChange(value == null ? "" : String(value))}
                        disabled={isSubmitting}
                        placeholder="Ex.: Aluguel da sede, Internet fibra..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea
                        value={field.value ?? ""}
                        onChange={(value) => field.onChange(value ?? "")}
                        disabled={isSubmitting}
                        placeholder="Detalhes adicionais (opcional)"
                        rows={2}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Categoria <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Combobox
                        mode="single"
                        value={field.value || undefined}
                        onValueChange={(value) => field.onChange(value || "")}
                        options={categoryOptions}
                        disabled={isSubmitting}
                        placeholder="Selecione a categoria"
                        emptyText="Nenhuma categoria encontrada"
                        searchPlaceholder="Buscar categoria..."
                        searchable
                      />
                    </FormControl>
                    <FormDescription>Categoria contábil usada na conciliação desta conta.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Tomador */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconBuilding className="h-5 w-5 text-muted-foreground" />
                Tomador
              </CardTitle>
              <CardDescription>Para quem o pagamento é feito (imobiliária, concessionária…).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="payeeName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tomador</FormLabel>
                      <FormControl>
                        <Input
                          value={field.value ?? ""}
                          onChange={(value) => field.onChange(value == null ? "" : String(value))}
                          disabled={isSubmitting}
                          placeholder="Ex.: Imobiliária XYZ"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-1">
                  <FormCNPJInput<FormData> name="payeeCnpj" label="CNPJ do tomador" disabled={isSubmitting} />
                  <p className="text-xs text-muted-foreground">
                    Informe o CNPJ para sincronizar e conciliar a NF automaticamente.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Valor */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconCash className="h-5 w-5 text-muted-foreground" />
                Valor
              </CardTitle>
              <CardDescription>Fixo para valores conhecidos (aluguel) ou variável estimado (energia, água).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="amountKind"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Tipo de valor <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Combobox
                          mode="single"
                          value={field.value}
                          onValueChange={(value) => field.onChange(value || "FIXED")}
                          options={AMOUNT_KIND_OPTIONS}
                          disabled={isSubmitting}
                          placeholder="Selecione o tipo de valor"
                          clearable={false}
                          searchable={false}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {amountKind === "FIXED" ? (
                  <FormMoneyInput<FormData> name="fixedAmount" label="Valor fixo" required disabled={isSubmitting} />
                ) : (
                  <div className="space-y-1">
                    <FormMoneyInput<FormData> name="estimatedAmount" label="Valor estimado" disabled={isSubmitting} />
                    <p className="text-xs text-muted-foreground">Estimativa exibida até o pagamento; o valor real é informado na quitação.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recorrência */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconCalendarRepeat className="h-5 w-5 text-muted-foreground" />
                Recorrência
              </CardTitle>
              <CardDescription>Quando e como a cobrança mensal é gerada em Contas a Pagar.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequência</FormLabel>
                      <FormControl>
                        <Combobox
                          mode="single"
                          value={field.value}
                          onValueChange={(value) => field.onChange(value || SCHEDULE_FREQUENCY.MONTHLY)}
                          options={FREQUENCY_OPTIONS}
                          disabled={isSubmitting}
                          placeholder="Frequência"
                          clearable={false}
                          searchable={false}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dueDayOfMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Dia do vencimento <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={31}
                          value={field.value ?? ""}
                          onChange={(value) => field.onChange(value === null || value === "" ? undefined : Number(value))}
                          disabled={isSubmitting}
                          placeholder="1-31"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forma de pagamento</FormLabel>
                      <FormControl>
                        <Combobox
                          mode="single"
                          value={field.value || undefined}
                          onValueChange={(value) => field.onChange(value || undefined)}
                          options={PAYMENT_METHOD_OPTIONS}
                          disabled={isSubmitting}
                          placeholder="Selecione a forma (opcional)"
                          clearable
                          searchable={false}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Configurações */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconAdjustments className="h-5 w-5 text-muted-foreground" />
                Configurações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="expectsNf"
                render={({ field }) => (
                  <FormItem>
                    <label className="flex items-center justify-between gap-2 cursor-pointer">
                      <span className="text-sm">
                        Emite nota fiscal
                        <span className="block text-xs text-muted-foreground">
                          A NF será sincronizada e conciliada automaticamente (requer CNPJ do tomador).
                        </span>
                      </span>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} />
                      </FormControl>
                    </label>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <label className="flex items-center justify-between gap-2 cursor-pointer">
                      <span className="text-sm">
                        Ativa
                        <span className="block text-xs text-muted-foreground">Contas inativas não geram novas cobranças mensais.</span>
                      </span>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} />
                      </FormControl>
                    </label>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>
      </form>
    </FormProvider>
  );
}
