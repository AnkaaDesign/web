import { useEffect, useMemo } from "react";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconLoader2, IconFilePlus } from "@tabler/icons-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { FormMoneyInput } from "@/components/ui/form-money-input";
import { FormDocumentInput } from "@/components/ui/form-document-input";
import { useReconciliationCategories } from "@/hooks/financial/use-reconciliation";
import { useRecurrentPayableMutations } from "@/hooks/financial/use-recurrent-payable";
import { PAYMENT_METHOD, PAYMENT_METHOD_LABELS } from "@/constants";
import { formatPixKey } from "@/utils/formatters";
import type { CreateOneOffPayablePayload } from "@/types/recurrent-payable";

const PAYMENT_METHOD_OPTIONS = Object.values(PAYMENT_METHOD).map((value) => ({
  value,
  label: PAYMENT_METHOD_LABELS[value],
}));

/**
 * A one-off bill is deliberately a much smaller form than a recurring one: no
 * cadence, no fixo/variável split (there is no history to estimate from and
 * nothing to true up later). Just who, what, how much, when.
 */
const quickPayableSchema = z.object({
  name: z.string().trim().min(1, { message: "Informe a descrição" }).max(200),
  payeeName: z.string().max(200).optional(),
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
  amount: z.coerce.number({ invalid_type_error: "valor inválido" }).positive({ message: "Informe um valor maior que zero" }),
  dueDate: z.date({ required_error: "Informe o vencimento", invalid_type_error: "Vencimento inválido" }),
  paymentMethod: z.enum([PAYMENT_METHOD.PIX, PAYMENT_METHOD.BANK_SLIP, PAYMENT_METHOD.CREDIT_CARD]).optional(),
  pixKey: z.string().max(500, { message: "Chave Pix muito longa" }).optional(),
  expectsNf: z.boolean(),
});

type QuickPayableFormData = z.infer<typeof quickPayableSchema>;

/** Today at 13:00 — the anchor `DateTimeInput mode="date"` stamps every picked day at. */
function todayAtFormAnchor(): Date {
  const d = new Date();
  d.setHours(13, 0, 0, 0);
  return d;
}

const EMPTY_DEFAULTS = (): QuickPayableFormData => ({
  name: "",
  payeeName: "",
  payeeCnpj: "",
  payeeCpf: "",
  categoryId: "",
  amount: undefined as unknown as number,
  dueDate: todayAtFormAnchor(),
  paymentMethod: undefined,
  pixKey: "",
  expectsNf: false,
});

interface QuickPayableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired after a successful create (the list refetches itself via query invalidation). */
  onCreated?: () => void;
}

/**
 * Quick-create for a NON-recurring bill straight from Contas a Pagar.
 *
 * The full "Conta Recorrente" form asks for a cadence, an amount kind and a
 * weekday/day-of-month schedule — all meaningless for a bill you pay once. This
 * modal collects only what a one-off needs and posts to `/one-off`, which stores
 * it as a `frequency: ONCE` payable plus its single occurrence. From that point
 * it is an ordinary Contas a Pagar row: same pay/ignore actions, same bank
 * settlement and NF linking, same clearance derivation.
 */
export function QuickPayableDialog({ open, onOpenChange, onCreated }: QuickPayableDialogProps) {
  const { data: categories } = useReconciliationCategories({ includeInactive: false });
  const { createOneOffAsync, createOneOffMutation } = useRecurrentPayableMutations();
  const isPending = createOneOffMutation.isPending;

  const categoryOptions = useMemo(
    () =>
      (categories ?? [])
        // Same rule as the recurrent form: these are service/overhead expenses,
        // never the item categories that mirror an ItemCategory.
        .filter((c) => c.kind !== "ITEM_DERIVED")
        .map((c) => ({ value: c.id, label: c.name })),
    [categories],
  );

  const form = useForm<QuickPayableFormData>({
    resolver: zodResolver(quickPayableSchema),
    defaultValues: EMPTY_DEFAULTS(),
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  // Every open starts from a clean slate — a modal that remembers the last bill
  // invites creating the same one twice.
  useEffect(() => {
    if (open) form.reset(EMPTY_DEFAULTS());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const paymentMethod = useWatch({ control: form.control, name: "paymentMethod" });
  const isPix = paymentMethod === PAYMENT_METHOD.PIX;

  const handleSubmit = async (data: QuickPayableFormData) => {
    const cnpjDigits = (data.payeeCnpj ?? "").replace(/\D/g, "");
    const cpfDigits = (data.payeeCpf ?? "").replace(/\D/g, "");
    // Send the CALENDAR date, not an instant: the API anchors it to São Paulo
    // midnight itself, so a browser in another timezone can't shift the due day.
    const d = data.dueDate;
    const dueDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const payload: CreateOneOffPayablePayload = {
      name: data.name.trim(),
      payeeName: data.payeeName?.trim() ? data.payeeName.trim() : null,
      payeeCnpj: cnpjDigits.length === 14 ? cnpjDigits : null,
      payeeCpf: cpfDigits.length === 11 ? cpfDigits : null,
      categoryId: data.categoryId,
      amount: Math.abs(data.amount),
      dueDate,
      paymentMethod: data.paymentMethod ?? null,
      pixKey: isPix && data.pixKey?.trim() ? formatPixKey(data.pixKey.trim()) : null,
      expectsNf: data.expectsNf,
    };

    try {
      await createOneOffAsync(payload);
      onOpenChange(false);
      onCreated?.();
    } catch {
      // Errors are toasted by the axios interceptors.
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !isPending && onOpenChange(value)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova conta a pagar</DialogTitle>
          <DialogDescription>
            Uma conta avulsa — paga uma única vez, sem recorrência. Para uma conta que se repete todo mês, use
            Contas Recorrentes.
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
                    Descrição <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      value={field.value ?? ""}
                      onChange={(value) => field.onChange(value == null ? "" : String(value))}
                      disabled={isPending}
                      placeholder="Ex.: Conserto do portão"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormMoneyInput<QuickPayableFormData> name="amount" label="Valor" required disabled={isPending} />

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Vencimento <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <DateTimeInput
                        mode="date"
                        value={field.value ?? null}
                        onChange={(date) => field.onChange(date instanceof Date ? date : null)}
                        disabled={isPending}
                        hideLabel
                        showClearButton={false}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        disabled={isPending}
                        placeholder="Ex.: Serralheria São Jorge"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* The CNPJ is what lets the nightly sweep categorize the bank debit
                  and link an inbound NF to this bill — worth filling in. */}
              <FormDocumentInput<QuickPayableFormData>
                cpfFieldName="payeeCpf"
                cnpjFieldName="payeeCnpj"
                label="CPF / CNPJ do tomador"
                disabled={isPending}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          // A chave Pix só pertence a uma conta Pix.
                          if (value !== PAYMENT_METHOD.PIX) {
                            form.setValue("pixKey", "", { shouldDirty: true, shouldValidate: true });
                          }
                        }}
                        options={PAYMENT_METHOD_OPTIONS}
                        disabled={isPending}
                        placeholder="Selecione a forma"
                        searchable={false}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isPix && (
                <FormField
                  control={form.control}
                  name="pixKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Chave Pix</FormLabel>
                      <FormControl>
                        <Input
                          value={field.value ?? ""}
                          onChange={(value) => field.onChange(value == null ? "" : String(value))}
                          disabled={isPending}
                          placeholder="CPF/CNPJ, e-mail, telefone ou aleatória"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="expectsNf"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border border-border p-3">
                  <div className="space-y-0.5 pr-4">
                    <FormLabel className="text-sm">Espera nota fiscal</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      A NF de entrada do tomador será vinculada automaticamente a esta conta.
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isPending} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconFilePlus className="h-4 w-4 mr-2" />}
                Criar conta
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
