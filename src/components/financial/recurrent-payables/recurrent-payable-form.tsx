import { useEffect, useMemo } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconLoader2 } from "@tabler/icons-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FormMoneyInput } from "@/components/ui/form-money-input";

import { useSuppliers } from "@/hooks/inventory/use-supplier";
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
    supplierId: z.string().optional(),
    payeeName: z.string().max(200).optional(),
    categoryId: z.string().uuid({ message: "Selecione a categoria" }),
    amountKind: z.enum(["FIXED", "VARIABLE"]),
    fixedAmount: z.coerce.number({ invalid_type_error: "valor inválido" }).optional(),
    estimatedAmount: z.coerce.number({ invalid_type_error: "valor inválido" }).optional(),
    frequency: z.string().min(1),
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

interface RecurrentPayableFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided the dialog edits an existing recurrent payable. */
  payable?: RecurrentPayable | null;
  isPending?: boolean;
  onSubmit: (payload: CreateRecurrentPayablePayload, id?: string) => void;
}

export function RecurrentPayableForm({ open, onOpenChange, payable, isPending, onSubmit }: RecurrentPayableFormProps) {
  const isEdit = !!payable;

  const { data: suppliersResponse } = useSuppliers({ orderBy: { fantasyName: "asc" } });
  const suppliers = suppliersResponse?.data ?? [];
  const { data: categories } = useReconciliationCategories({ includeInactive: false });

  const supplierOptions = useMemo(
    () => suppliers.map((s) => ({ value: s.id, label: s.fantasyName })),
    [suppliers],
  );
  const categoryOptions = useMemo(
    () => (categories ?? []).map((c) => ({ value: c.id, label: c.name })),
    [categories],
  );

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      supplierId: undefined,
      payeeName: "",
      categoryId: "",
      amountKind: "FIXED",
      fixedAmount: undefined,
      estimatedAmount: undefined,
      frequency: SCHEDULE_FREQUENCY.MONTHLY,
      dueDayOfMonth: undefined as unknown as number,
      paymentMethod: undefined,
      expectsNf: false,
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (payable) {
      form.reset({
        name: payable.name,
        description: payable.description ?? "",
        supplierId: payable.supplierId ?? undefined,
        payeeName: payable.payeeName ?? "",
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
    } else {
      form.reset({
        name: "",
        description: "",
        supplierId: undefined,
        payeeName: "",
        categoryId: "",
        amountKind: "FIXED",
        fixedAmount: undefined,
        estimatedAmount: undefined,
        frequency: SCHEDULE_FREQUENCY.MONTHLY,
        dueDayOfMonth: undefined as unknown as number,
        paymentMethod: undefined,
        expectsNf: false,
        isActive: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payable?.id]);

  const amountKind = useWatch({ control: form.control, name: "amountKind" });

  const handleSubmit = (data: FormData) => {
    const payload: CreateRecurrentPayablePayload = {
      name: data.name.trim(),
      description: data.description?.trim() ? data.description.trim() : null,
      supplierId: data.supplierId || null,
      payeeName: data.payeeName?.trim() ? data.payeeName.trim() : null,
      categoryId: data.categoryId,
      amountKind: data.amountKind,
      // Only the relevant amount is sent for the chosen kind.
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
    <Dialog open={open} onOpenChange={(value) => !isPending && onOpenChange(value)}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar conta recorrente" : "Nova conta recorrente"}</DialogTitle>
          <DialogDescription>
            Contas recorrentes (aluguel, internet, energia, água) geram automaticamente uma cobrança mensal em Contas a Pagar.
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                      disabled={isPending}
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
                      disabled={isPending}
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
                      disabled={isPending}
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

            <FormField
              control={form.control}
              name="supplierId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fornecedor</FormLabel>
                  <FormControl>
                    <Combobox
                      mode="single"
                      value={field.value || undefined}
                      onValueChange={(value) => field.onChange(value || undefined)}
                      options={supplierOptions}
                      disabled={isPending}
                      placeholder="Selecione o fornecedor (opcional)"
                      emptyText="Nenhum fornecedor encontrado"
                      searchPlaceholder="Buscar fornecedor..."
                      searchable
                      clearable
                    />
                  </FormControl>
                  <FormDescription>Use o campo abaixo se o tomador não for um fornecedor cadastrado.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payeeName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tomador (texto livre)</FormLabel>
                  <FormControl>
                    <Input
                      value={field.value ?? ""}
                      onChange={(value) => field.onChange(value == null ? "" : String(value))}
                      disabled={isPending}
                      placeholder="Ex.: Imobiliária XYZ (opcional)"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      disabled={isPending}
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
              <FormMoneyInput<FormData> name="fixedAmount" label="Valor fixo" required disabled={isPending} />
            ) : (
              <div className="space-y-1">
                <FormMoneyInput<FormData> name="estimatedAmount" label="Valor estimado" disabled={isPending} />
                <p className="text-xs text-muted-foreground">Estimativa exibida até o pagamento; o valor real é informado na quitação.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
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
                        disabled={isPending}
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
                        disabled={isPending}
                        placeholder="1-31"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                      disabled={isPending}
                      placeholder="Selecione a forma (opcional)"
                      clearable
                      searchable={false}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="expectsNf"
              render={({ field }) => (
                <FormItem>
                  <label className="flex items-center justify-between gap-2 cursor-pointer">
                    <span className="text-sm">
                      Emite nota fiscal
                      <span className="block text-xs text-muted-foreground">A NF será sincronizada e conciliada automaticamente.</span>
                    </span>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isPending} />
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
                      <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isPending} />
                    </FormControl>
                  </label>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEdit ? "Salvar" : "Criar conta"}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
