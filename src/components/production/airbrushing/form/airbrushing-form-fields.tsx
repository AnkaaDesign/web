import { useFormContext, useWatch } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { IconInfoCircle } from "@tabler/icons-react";
import { PainterSelector } from "./painter-selector";
import { AIRBRUSHING_STATUS, AIRBRUSHING_STATUS_LABELS, AIRBRUSHING_PAYMENT_STATUS, AIRBRUSHING_PAYMENT_STATUS_LABELS } from "../../../../constants";

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

  const statusOptions: ComboboxOption[] = [
    { value: AIRBRUSHING_STATUS.PENDING, label: AIRBRUSHING_STATUS_LABELS.PENDING },
    { value: AIRBRUSHING_STATUS.IN_PRODUCTION, label: AIRBRUSHING_STATUS_LABELS.IN_PRODUCTION },
    { value: AIRBRUSHING_STATUS.COMPLETED, label: AIRBRUSHING_STATUS_LABELS.COMPLETED },
    { value: AIRBRUSHING_STATUS.CANCELLED, label: AIRBRUSHING_STATUS_LABELS.CANCELLED },
  ];

  const paymentStatusOptions: ComboboxOption[] = Object.values(AIRBRUSHING_PAYMENT_STATUS).map((value) => ({
    value,
    label: AIRBRUSHING_PAYMENT_STATUS_LABELS[value],
  }));

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
    </div>
  );
}
