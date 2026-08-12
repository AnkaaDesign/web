import { useFormContext, useWatch } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { IconInfoCircle } from "@tabler/icons-react";
import { PainterSelector } from "./painter-selector";
import {
  AIRBRUSHING_STATUS,
  AIRBRUSHING_STATUS_LABELS,
  AIRBRUSHING_PAYMENT_STATUS,
  AIRBRUSHING_PAYMENT_STATUS_LABELS,
  AIRBRUSHING_DUE_DATE_RULE,
  AIRBRUSHING_DUE_DATE_RULE_LABELS,
  PAYMENT_METHOD,
  PAYMENT_METHOD_LABELS,
} from "../../../../constants";
import { AIRBRUSHING_DEFAULT_PAYMENT_TERM_DAYS, resolveAirbrushingDueDate } from "@/utils/airbrushing";
import { formatDate } from "@/utils/date";

interface AirbrushingFormFieldsProps {
  control: any;
  disabled?: boolean;
  initialPainter?: { id: string; name: string; email?: string | null; status?: string | null };
  /**
   * Whether the current user may see monetary/payment information.
   * Gate for `price` + `paymentStatus` — derived from the canonical
   * `canViewAirbrushingFinancials(user)`. When false these fields are hidden.
   */
  canViewFinancials?: boolean;
}

export function AirbrushingFormFields({ control, disabled, initialPainter, canViewFinancials = true }: AirbrushingFormFieldsProps) {
  const { setValue } = useFormContext();

  // Watch status reactively to gate the payment status field (never mirror form state with useState)
  const status = useWatch({ control, name: "status" });
  const isCompleted = status === AIRBRUSHING_STATUS.COMPLETED;

  // Full lifecycle, in order — "Aguardando Produção" is how the form disponibiliza a job.
  const statusOptions: ComboboxOption[] = Object.values(AIRBRUSHING_STATUS).map((value) => ({
    value,
    label: AIRBRUSHING_STATUS_LABELS[value],
  }));

  const paymentStatusOptions: ComboboxOption[] = Object.values(AIRBRUSHING_PAYMENT_STATUS).map((value) => ({
    value,
    label: AIRBRUSHING_PAYMENT_STATUS_LABELS[value],
  }));

  const paymentMethodOptions: ComboboxOption[] = Object.values(PAYMENT_METHOD).map((value) => ({
    value,
    label: PAYMENT_METHOD_LABELS[value],
  }));

  const dueDateRuleOptions: ComboboxOption[] = Object.values(AIRBRUSHING_DUE_DATE_RULE).map((value) => ({
    value,
    label: AIRBRUSHING_DUE_DATE_RULE_LABELS[value],
  }));

  // A prévia do vencimento usa a MESMA referência do servidor: término real quando
  // existe, término previsto enquanto o serviço não acabou.
  const dueDateRule = useWatch({ control, name: "dueDateRule" }) ?? AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH;
  const paymentTermDays = useWatch({ control, name: "paymentTermDays" });
  const dueDayOfMonth = useWatch({ control, name: "dueDayOfMonth" });
  const finishDate = useWatch({ control, name: "finishDate" });
  const finishedAt = useWatch({ control, name: "finishedAt" });

  const previewDueDate = resolveAirbrushingDueDate({ dueDateRule, paymentTermDays, dueDayOfMonth }, finishedAt ?? finishDate);

  return (
    <div className="space-y-4">
      {/* Row 1: Painter | Price (price gated behind financial visibility) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="painterId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pintor</FormLabel>
              <FormControl>
                <PainterSelector value={field.value ?? undefined} onChange={field.onChange} initialUser={initialPainter} disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {canViewFinancials && (
          <FormField
            control={control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preço do Serviço</FormLabel>
                <FormControl>
                  <Input type="currency" value={field.value ?? undefined} onChange={field.onChange} placeholder="R$ 0,00" disabled={disabled} className="bg-transparent" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>

      {/* Row 2: Status | Payment Status (payment gated behind financial visibility + COMPLETED) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <FormControl>
                <Combobox
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    // Payment status is only meaningful for completed airbrushings:
                    // reset it to PENDING whenever the status leaves COMPLETED
                    if (value !== AIRBRUSHING_STATUS.COMPLETED) {
                      setValue("paymentStatus", AIRBRUSHING_PAYMENT_STATUS.PENDING, { shouldDirty: true });
                    }
                  }}
                  options={statusOptions}
                  placeholder="Selecione o status"
                  searchable={false}
                  clearable={false}
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {canViewFinancials && (
          <FormField
            control={control}
            name="paymentStatus"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-1.5">
                  Status do Pagamento
                  {!isCompleted && (
                    <IconInfoCircle className="h-3.5 w-3.5 text-muted-foreground" title="Disponível somente após a conclusão da aerografia" />
                  )}
                </FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value}
                    onValueChange={field.onChange}
                    options={paymentStatusOptions}
                    placeholder="Selecione o status do pagamento"
                    searchable={false}
                    clearable={false}
                    disabled={disabled || !isCompleted}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>

      {/* Row 2b: Payment configuration — how the painter is paid and when it falls due.
          Both feed Contas a Pagar directly ("Forma" and "Vencimento"), so they sit with
          the payment status rather than with the schedule dates. */}
      {canViewFinancials && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={control}
            name="paymentMethod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Forma de Pagamento</FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value ?? undefined}
                    onValueChange={(value) => field.onChange(value ?? null)}
                    options={paymentMethodOptions}
                    placeholder="Selecione a forma de pagamento"
                    searchable={false}
                    clearable
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="dueDateRule"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Regra de Vencimento</FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value ?? AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH}
                    onValueChange={(value) => {
                      field.onChange(value);
                      // Cada regra consome um campo diferente; limpar os outros evita que
                      // um valor órfão de uma regra anterior volte a valer se o usuário
                      // trocar de ideia duas vezes (mesmo cascade-clear do formulário de pedido).
                      if (value !== AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH) setValue("paymentTermDays", null, { shouldDirty: true });
                      if (value !== AIRBRUSHING_DUE_DATE_RULE.DAY_OF_MONTH) setValue("dueDayOfMonth", null, { shouldDirty: true });
                      if (value !== AIRBRUSHING_DUE_DATE_RULE.FIXED_DATE) setValue("dueDate", null, { shouldDirty: true });
                    }}
                    options={dueDateRuleOptions}
                    placeholder="Selecione a regra"
                    searchable={false}
                    clearable={false}
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {dueDateRule === AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH && (
            <FormField
              control={control}
              name="paymentTermDays"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prazo após o Término</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={365}
                      value={field.value ?? ""}
                      onChange={(value) => field.onChange(value === "" || value === null || value === undefined ? null : Number(value))}
                      placeholder={String(AIRBRUSHING_DEFAULT_PAYMENT_TERM_DAYS)}
                      disabled={disabled}
                      className="bg-transparent"
                    />
                  </FormControl>
                  <FormDescription>Dias corridos após o término do serviço. Em branco usa {AIRBRUSHING_DEFAULT_PAYMENT_TERM_DAYS} dias.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {dueDateRule === AIRBRUSHING_DUE_DATE_RULE.DAY_OF_MONTH && (
            <FormField
              control={control}
              name="dueDayOfMonth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dia do Vencimento</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={field.value ?? ""}
                      onChange={(value) => field.onChange(value === "" || value === null || value === undefined ? null : Number(value))}
                      placeholder="1-31"
                      disabled={disabled}
                      className="bg-transparent"
                    />
                  </FormControl>
                  <FormDescription>Próximo dia {field.value || "X"} a partir do término. Meses curtos usam o último dia.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {dueDateRule === AIRBRUSHING_DUE_DATE_RULE.FIXED_DATE && (
            <FormField control={control} name="dueDate" render={({ field }) => <DateTimeInput field={field} label="Data de Vencimento" mode="date" context="end" disabled={disabled} />} />
          )}

          {/* Prévia do que o servidor vai gravar. Some quando não há término de
              referência — nesse caso a aerografia entra em Contas a Pagar sem vencimento. */}
          {dueDateRule !== AIRBRUSHING_DUE_DATE_RULE.FIXED_DATE && (
            <div className="md:col-span-2 -mt-1">
              {previewDueDate ? (
                <p className="text-xs text-muted-foreground">
                  Vencimento previsto: <span className="font-medium text-foreground">{formatDate(previewDueDate)}</span>
                  {!finishedAt && " (a partir do término previsto; a data se firma quando a aerografia for concluída)"}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Sem data de término, a aerografia aparece em Contas a Pagar sem vencimento.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Row 3: Planned dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="startDate"
          render={({ field }) => (
            <DateTimeInput field={field} label="Início Previsto" mode="date" context="start" disabled={disabled} />
          )}
        />

        <FormField
          control={control}
          name="finishDate"
          render={({ field }) => (
            <DateTimeInput field={field} label="Término Previsto" mode="date" context="end" disabled={disabled} />
          )}
        />
      </div>

      {/* Description — full width, multi-line, so it sits outside the two-column grid. */}
      <FormField
        control={control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Descrição</FormLabel>
            <FormControl>
              <Textarea
                value={field.value || ""}
                onChange={(e) => field.onChange(e.target.value)}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
                placeholder="Detalhes da aerografia..."
                rows={4}
                maxLength={500}
                disabled={disabled}
                className="bg-transparent"
              />
            </FormControl>
            <div className="flex items-center justify-between">
              <FormMessage />
              {field.value && <p className="text-xs text-muted-foreground">{String(field.value).length}/500 caracteres</p>}
            </div>
          </FormItem>
        )}
      />
    </div>
  );
}
