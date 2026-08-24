import { useEffect, useMemo } from "react";
import { useForm, FormProvider, useWatch, useFormState, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  IconFileText,
  IconBuilding,
  IconCash,
  IconCalendarRepeat,
  IconAdjustments,
  IconQrcode,
} from "@tabler/icons-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FormMoneyInput } from "@/components/ui/form-money-input";
import { FormDocumentInput } from "@/components/ui/form-document-input";

import { useReconciliationCategories } from "@/hooks/financial/use-reconciliation";
import { PAYMENT_METHOD, PAYMENT_METHOD_LABELS, SCHEDULE_FREQUENCY, SCHEDULE_FREQUENCY_LABELS } from "@/constants";
import { formatPixKey } from "@/utils/formatters";
import type { CreateRecurrentPayablePayload, RecurrentPayable } from "@/types/recurrent-payable";
import { Button } from "@/components/ui/button";
import { IconPlus, IconTrash } from "@tabler/icons-react";

// Frequencies offered for recurrent bills. WEEKLY/BIWEEKLY are sub-monthly (use
// weekdays — e.g. a faxineira 2× por semana); the rest are monthly-family (use a
// day of the month). MONTHLY is the default.
const FREQUENCY_OPTIONS = [
  SCHEDULE_FREQUENCY.WEEKLY,
  SCHEDULE_FREQUENCY.BIWEEKLY,
  SCHEDULE_FREQUENCY.MONTHLY,
  SCHEDULE_FREQUENCY.BIMONTHLY,
  SCHEDULE_FREQUENCY.QUARTERLY,
  SCHEDULE_FREQUENCY.SEMI_ANNUAL,
  SCHEDULE_FREQUENCY.ANNUAL,
].map((value) => ({ value, label: SCHEDULE_FREQUENCY_LABELS[value] }));

// Weekday picker (0=Sunday … 6=Saturday, matching the api daysOfWeek encoding).
const WEEKDAY_OPTIONS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

const WEEKLY_FREQUENCIES: string[] = [SCHEDULE_FREQUENCY.WEEKLY, SCHEDULE_FREQUENCY.BIWEEKLY];

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
    // Tomador aceita CPF OU CNPJ (o seletor mantém apenas um preenchido, zerando
    // o outro para null). Ambos são limpos + validados (11/14 dígitos).
    payeeCnpj: z
      .string()
      .nullable()
      .optional()
      .refine((v) => !v || v.replace(/\D/g, "").length === 0 || v.replace(/\D/g, "").length === 14, {
        message: "CNPJ deve ter 14 dígitos",
      }),
    payeeCpf: z
      .string()
      .nullable()
      .optional()
      .refine((v) => !v || v.replace(/\D/g, "").length === 0 || v.replace(/\D/g, "").length === 11, {
        message: "CPF deve ter 11 dígitos",
      }),
    categoryId: z.string().uuid({ message: "Selecione a categoria" }),
    amountKind: z.enum(["FIXED", "VARIABLE"]),
    fixedAmount: z.coerce.number({ invalid_type_error: "valor inválido" }).optional(),
    estimatedAmount: z.coerce.number({ invalid_type_error: "valor inválido" }).optional(),
    frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "BIMONTHLY", "QUARTERLY", "TRIANNUAL", "QUADRIMESTRAL", "SEMI_ANNUAL", "ANNUAL"]),
    dueDayOfMonth: z.coerce
      .number({ invalid_type_error: "dia inválido" })
      .int()
      .min(1, { message: "Entre 1 e 31" })
      .max(31, { message: "Entre 1 e 31" })
      .optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).default([]),
    paymentMethod: z.enum([PAYMENT_METHOD.PIX, PAYMENT_METHOD.BANK_SLIP, PAYMENT_METHOD.CREDIT_CARD]).optional(),
    // Chave Pix (qualquer formato: CPF/CNPJ/e-mail/telefone/aleatória).
    pixKey: z.string().max(500, { message: "Chave Pix muito longa" }).optional(),
    expectsNf: z.boolean(),
    isActive: z.boolean(),
    // Opt-in to the ONE retroactive write the API allows (see the field in the
    // form below). Never sent unless the user actually turns "emite nota" off.
    applyExpectsNfToPast: z.boolean().default(false),
    // Billed installations (matrícula SAMAE, UC COPEL, linha da operadora). See
    // the card below for why a bill needs them.
    installations: z
      .array(
        z.object({
          id: z.string().nullable().optional(),
          code: z
            .string()
            .trim()
            .min(1, { message: "Informe o código" })
            .max(40, { message: "Máx. 40 caracteres" })
            .refine((v) => /\d/.test(v), { message: "O código precisa conter dígitos" }),
          label: z.string().max(120, { message: "Máx. 120 caracteres" }).optional(),
          estimatedAmount: z.coerce.number({ invalid_type_error: "valor inválido" }).optional(),
          isActive: z.boolean().default(true),
        }),
      )
      .default([]),
  })
  .superRefine((d, ctx) => {
    // Two rows pointing at the same meter would fight over the same debit.
    const seen = new Map<string, number>();
    d.installations.forEach((item, index) => {
      const key = item.code.replace(/\D/g, "").replace(/^0+/, "");
      if (!key) return;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Código repetido nesta conta",
          path: ["installations", index, "code"],
        });
      }
      seen.set(key, index);
    });
  })
  .refine((d) => d.amountKind !== "FIXED" || (typeof d.fixedAmount === "number" && d.fixedAmount > 0), {
    message: "Informe o valor fixo (maior que zero)",
    path: ["fixedAmount"],
  })
  .refine((d) => !WEEKLY_FREQUENCIES.includes(d.frequency) || d.daysOfWeek.length > 0, {
    message: "Selecione ao menos um dia da semana",
    path: ["daysOfWeek"],
  })
  .refine((d) => WEEKLY_FREQUENCIES.includes(d.frequency) || typeof d.dueDayOfMonth === "number", {
    message: "Informe o dia do vencimento (1-31)",
    path: ["dueDayOfMonth"],
  });

type FormData = z.infer<typeof formSchema>;

const EMPTY_DEFAULTS: FormData = {
  name: "",
  description: "",
  payeeName: "",
  payeeCnpj: "",
  payeeCpf: "",
  categoryId: "",
  amountKind: "FIXED",
  fixedAmount: undefined,
  estimatedAmount: undefined,
  frequency: SCHEDULE_FREQUENCY.MONTHLY,
  dueDayOfMonth: undefined,
  daysOfWeek: [],
  paymentMethod: undefined,
  pixKey: "",
  expectsNf: false,
  isActive: true,
  applyExpectsNfToPast: false,
  installations: [],
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
    () =>
      (categories ?? [])
        // Recorrentes são despesas de serviço/overhead (aluguel, internet, água…),
        // nunca categorias de itens do estoque (ITEM_DERIVED espelha uma ItemCategory).
        // Mantém a categoria já selecionada na edição, mesmo que seja de item, para
        // não esvaziar o campo de uma conta antiga.
        .filter((c) => c.kind !== "ITEM_DERIVED" || c.id === payable?.categoryId)
        .map((c) => ({ value: c.id, label: c.name })),
    [categories, payable?.categoryId],
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
        payeeCpf: payable.payeeCpf ?? "",
        categoryId: payable.categoryId,
        amountKind: payable.amountKind,
        fixedAmount: payable.fixedAmount != null ? Number(payable.fixedAmount) : undefined,
        estimatedAmount: payable.estimatedAmount != null ? Number(payable.estimatedAmount) : undefined,
        // ONCE is the one-off (conta avulsa) cadence — it is never offered here and
        // the API rejects updating one through this endpoint, so it can only appear
        // if a caller hands us the wrong payable. Fall back rather than crash.
        frequency:
          payable.frequency && payable.frequency !== "ONCE" ? payable.frequency : SCHEDULE_FREQUENCY.MONTHLY,
        dueDayOfMonth: payable.dueDayOfMonth ?? undefined,
        daysOfWeek: payable.daysOfWeek ?? [],
        paymentMethod: (payable.paymentMethod as PAYMENT_METHOD | null) ?? undefined,
        pixKey: payable.pixKey ?? "",
        expectsNf: payable.expectsNf,
        isActive: payable.isActive,
        applyExpectsNfToPast: false,
        installations: (payable.installations ?? []).map((i) => ({
          id: i.id,
          code: i.code,
          label: i.label ?? "",
          estimatedAmount: i.estimatedAmount != null ? Number(i.estimatedAmount) : undefined,
          isActive: i.isActive,
        })),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payable?.id]);

  const { isValid, isDirty } = useFormState({ control: form.control });
  useEffect(() => {
    onFormStateChange?.({ isValid, isDirty });
  }, [isValid, isDirty, onFormStateChange]);

  const amountKind = useWatch({ control: form.control, name: "amountKind" });
  const frequency = useWatch({ control: form.control, name: "frequency" });
  const paymentMethod = useWatch({ control: form.control, name: "paymentMethod" });
  const expectsNf = useWatch({ control: form.control, name: "expectsNf" });
  const isWeekly = WEEKLY_FREQUENCIES.includes(frequency);
  const isPix = paymentMethod === PAYMENT_METHOD.PIX;
  // Only meaningful when an EXISTING bill that expected notes stops expecting
  // them — a brand-new bill has no closed competences to reach back into.
  const isTurningExpectsNfOff = !!payable?.expectsNf && !expectsNf;

  const installations = useFieldArray({ control: form.control, name: "installations" });
  // Only rows that already exist server-side can be carrying settled occurrences,
  // so only those get the "desativar em vez de remover" treatment.
  const persistedIds = useMemo(
    () => new Set((payable?.installations ?? []).map((i) => i.id)),
    [payable?.installations],
  );

  const handleSubmit = (data: FormData) => {
    const cnpjDigits = (data.payeeCnpj ?? "").replace(/\D/g, "");
    const cpfDigits = (data.payeeCpf ?? "").replace(/\D/g, "");
    const weekly = WEEKLY_FREQUENCIES.includes(data.frequency);
    const isPixMethod = data.paymentMethod === PAYMENT_METHOD.PIX;
    const pix = isPixMethod && data.pixKey?.trim() ? formatPixKey(data.pixKey.trim()) : null;
    const payload: CreateRecurrentPayablePayload = {
      name: data.name.trim(),
      description: data.description?.trim() ? data.description.trim() : null,
      // Recurrent bills are not provided by inventory suppliers — payee is free
      // text + optional CPF/CNPJ.
      supplierId: null,
      payeeName: data.payeeName?.trim() ? data.payeeName.trim() : null,
      payeeCnpj: cnpjDigits.length === 14 ? cnpjDigits : null,
      payeeCpf: cpfDigits.length === 11 ? cpfDigits : null,
      categoryId: data.categoryId,
      amountKind: data.amountKind,
      fixedAmount: data.amountKind === "FIXED" ? data.fixedAmount ?? null : null,
      estimatedAmount: data.amountKind === "VARIABLE" ? data.estimatedAmount ?? null : null,
      frequency: data.frequency,
      // Weekly bills carry weekdays (no day-of-month); monthly bills the reverse.
      dueDayOfMonth: weekly ? null : data.dueDayOfMonth ?? null,
      daysOfWeek: weekly ? data.daysOfWeek : [],
      paymentMethod: data.paymentMethod ?? null,
      // Only a PIX bill carries a key; other methods drop it.
      pixKey: pix,
      expectsNf: data.expectsNf,
      isActive: data.isActive,
      // Always the FULL desired list — the API reconciles against it, retiring
      // (never deleting) installations that already carry occurrences.
      installations: data.installations.map((i) => ({
        id: i.id ?? null,
        code: i.code.trim(),
        label: i.label?.trim() ? i.label.trim() : null,
        estimatedAmount: typeof i.estimatedAmount === "number" ? i.estimatedAmount : null,
        isActive: i.isActive,
      })),
    };
    // Only ever sent alongside an actual expectsNf → false edit; the API ignores
    // it otherwise, but not sending it keeps the payload honest about intent.
    if (payable && payable.expectsNf && !data.expectsNf && data.applyExpectsNfToPast) {
      (payload as CreateRecurrentPayablePayload & { applyExpectsNfToPast?: boolean }).applyExpectsNfToPast = true;
    }
    onSubmit(payload, payable?.id);
  };

  return (
    <FormProvider {...form}>
      <form id="recurrent-payable-form" onSubmit={form.handleSubmit(handleSubmit)} className="container mx-auto max-w-3xl">
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

                <FormDocumentInput<FormData>
                  cpfFieldName="payeeCpf"
                  cnpjFieldName="payeeCnpj"
                  label="CPF / CNPJ do tomador"
                  disabled={isSubmitting}
                />
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
              <CardDescription>
                Quando a cobrança é gerada em Contas a Pagar. Semanal/Quinzenal usa dias da semana (ex.: faxineira
                2× por semana); as demais usam um dia do mês.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forma de pagamento</FormLabel>
                      <FormControl>
                        <Combobox
                          mode="single"
                          value={field.value || undefined}
                          onValueChange={(value) => {
                            field.onChange(value || undefined);
                            // A chave Pix só pertence a uma conta Pix — troca de método a limpa.
                            if (value !== PAYMENT_METHOD.PIX) {
                              form.setValue("pixKey", "", { shouldDirty: true, shouldValidate: true });
                            }
                          }}
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

              {/* Chave Pix — só quando a forma de pagamento é Pix. Aceita qualquer
                  formato (CPF/CNPJ/e-mail/telefone/aleatória) e normaliza no blur. */}
              {isPix && (
                <FormField
                  control={form.control}
                  name="pixKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <IconQrcode className="h-4 w-4 text-muted-foreground" />
                        Chave Pix
                      </FormLabel>
                      <FormControl>
                        <Input
                          value={field.value ?? ""}
                          onChange={(value) => field.onChange(value == null ? "" : String(value))}
                          onBlur={() => {
                            const current = form.getValues("pixKey");
                            if (current && current.trim()) {
                              form.setValue("pixKey", formatPixKey(current.trim()), {
                                shouldDirty: true,
                                shouldValidate: true,
                              });
                            }
                            field.onBlur();
                          }}
                          disabled={isSubmitting}
                          placeholder="CPF, CNPJ, E-mail, Telefone ou Chave Aleatória"
                        />
                      </FormControl>
                      <FormDescription>Exibida em Contas a Pagar para facilitar o pagamento.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {isWeekly ? (
                <FormField
                  control={form.control}
                  name="daysOfWeek"
                  render={({ field }) => {
                    const selected: number[] = field.value ?? [];
                    const toggle = (day: number) =>
                      field.onChange(
                        selected.includes(day)
                          ? selected.filter((d) => d !== day)
                          : [...selected, day].sort((a, b) => a - b),
                      );
                    return (
                      <FormItem>
                        <FormLabel>
                          Dias da semana <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="flex flex-wrap gap-2">
                            {WEEKDAY_OPTIONS.map((opt) => {
                              const active = selected.includes(opt.value);
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  disabled={isSubmitting}
                                  onClick={() => toggle(opt.value)}
                                  aria-pressed={active}
                                  className={`h-9 w-12 rounded-md border text-sm font-medium transition-colors ${
                                    active
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </FormControl>
                        <FormDescription>
                          Gera uma cobrança em cada dia selecionado, toda semana (Quinzenal: a cada duas semanas).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        <FormDescription>Gera uma cobrança nesse dia do mês (a cada N meses conforme a frequência).</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Instalações faturadas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconAdjustments className="h-5 w-5 text-muted-foreground" />
                Instalações faturadas
              </CardTitle>
              <CardDescription>
                Quando o mesmo credor cobra várias instalações — matrículas do SAMAE, UCs da COPEL,
                linhas da operadora — cada uma gera a sua própria fatura, a sua própria nota e o seu
                próprio débito no extrato. Cadastre o código que aparece no memo (
                <span className="font-mono text-xs">DEBITO CONVENIOS-SAMAEIB ID 00113942</span>) para
                que cada débito encontre a sua obrigação. Sem isso só o primeiro débito do mês é
                conciliado e os demais ficam em "Sem vínculo".
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {installations.fields.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma instalação cadastrada — a conta gera uma única cobrança por competência.
                </p>
              )}

              {installations.fields.map((field, index) => (
                <div
                  key={field.id}
                  className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-3"
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                    <FormField
                      control={form.control}
                      name={`installations.${index}.code`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel>Código</FormLabel>
                          <FormControl>
                            <Input {...f} placeholder="00113942" disabled={isSubmitting} className="font-mono" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`installations.${index}.label`}
                      render={({ field: f }) => (
                        <FormItem>
                          <FormLabel>Apelido</FormLabel>
                          <FormControl>
                            <Input
                              {...f}
                              value={f.value ?? ""}
                              placeholder="Matriz, Galpão 2…"
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <FormDescription>Aparece na coluna Vínculo e em Contas a Pagar.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* `items-end` alinha o rodapé do input de estimativa com a
                      linha de controles; a nota de ajuda fica FORA do grid, senão
                      ela entra na altura da coluna e empurra o toggle e a lixeira
                      para baixo do input. */}
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <FormMoneyInput
                        name={`installations.${index}.estimatedAmount`}
                        label="Estimativa"
                        disabled={isSubmitting}
                      />
                      {/* h-10 = altura do Input/Button icon, para o Switch (baixo)
                          centralizar na mesma faixa em vez de encostar na base. */}
                      <div className="flex h-10 items-center gap-1">
                        <FormField
                          control={form.control}
                          name={`installations.${index}.isActive`}
                          render={({ field: f }) => (
                            <FormItem className="space-y-0">
                              <label className="flex h-10 items-center gap-2 cursor-pointer">
                                <FormControl>
                                  <Switch checked={f.value} onCheckedChange={f.onChange} disabled={isSubmitting} />
                                </FormControl>
                                <span className="text-sm">Ativa</span>
                              </label>
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={isSubmitting}
                          onClick={() => installations.remove(index)}
                          aria-label="Remover instalação"
                        >
                          <IconTrash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Em branco: estimada pelo histórico de débitos desta instalação.
                    </p>
                  </div>

                  {/* An installation with settled history cannot be deleted — the API
                      retires it instead. Say so before the user clicks, not after. */}
                  {field.id && persistedIds.has(form.getValues(`installations.${index}.id`) ?? "") && (
                    <p className="text-xs text-muted-foreground">
                      Se esta instalação já tiver ocorrências, remover aqui a DESATIVA (o histórico é
                      preservado). O código também deixa de ser editável depois da primeira conciliação.
                    </p>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                onClick={() =>
                  installations.append({
                    id: null,
                    code: "",
                    label: "",
                    estimatedAmount: undefined,
                    isActive: true,
                  })
                }
              >
                <IconPlus className="mr-2 h-4 w-4" />
                Adicionar instalação
              </Button>
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

              {/* Every edit is strictly forward-looking: only occurrences due AFTER
                  today are re-planned or re-priced. Turning "emite nota fiscal" OFF
                  is the single sanctioned exception — a bill that never issues one
                  would otherwise leave its already-reconciled occurrences stuck at
                  "Aguardando nota" forever. It has to be asked for, so it only
                  appears when the switch is actually being turned off on an
                  existing bill, and it starts unchecked. */}
              {isTurningExpectsNfOff && (
                <FormField
                  control={form.control}
                  name="applyExpectsNfToPast"
                  render={({ field }) => (
                    <FormItem className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                      <label className="flex items-center justify-between gap-2 cursor-pointer">
                        <span className="text-sm">
                          Aplicar também às competências já fechadas
                          <span className="block text-xs text-muted-foreground">
                            Altera ocorrências PASSADAS que ainda aguardam nota. Sem isto, apenas as
                            ocorrências com vencimento a partir de amanhã são afetadas.
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
              )}

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
