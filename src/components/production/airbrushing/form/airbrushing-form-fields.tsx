import { useWatch } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { PainterSelector } from "./painter-selector";
import { AIRBRUSHING_STATUS, AIRBRUSHING_STATUS_LABELS, AIRBRUSHING_PAYMENT_STATUS, AIRBRUSHING_PAYMENT_STATUS_LABELS } from "../../../../constants";

interface AirbrushingFormFieldsProps {
  control: any;
  disabled?: boolean;
  initialPainter?: { id: string; name: string; email?: string | null };
}

export function AirbrushingFormFields({ control, disabled, initialPainter }: AirbrushingFormFieldsProps) {
  // Watch status reactively to gate the payment status field (never mirror form state with useState)
  const status = useWatch({ control, name: "status" });
  const isCompleted = status === AIRBRUSHING_STATUS.COMPLETED;

  const statusOptions: ComboboxOption[] = [
    { value: AIRBRUSHING_STATUS.PENDING, label: AIRBRUSHING_STATUS_LABELS.PENDING },
    { value: AIRBRUSHING_STATUS.IN_PRODUCTION, label: AIRBRUSHING_STATUS_LABELS.IN_PRODUCTION },
    { value: AIRBRUSHING_STATUS.COMPLETED, label: AIRBRUSHING_STATUS_LABELS.COMPLETED },
  ];

  const paymentStatusOptions: ComboboxOption[] = Object.values(AIRBRUSHING_PAYMENT_STATUS).map((value) => ({
    value,
    label: AIRBRUSHING_PAYMENT_STATUS_LABELS[value],
  }));

  return (
    <div className="space-y-4">
      {/* Row 1: Price | Painter */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Preço do Serviço</FormLabel>
              <FormControl>
                <Input type="currency" value={field.value || undefined} onChange={field.onChange} placeholder="R$ 0,00" disabled={disabled} className="bg-transparent" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
      </div>

      {/* Row 2: Status | Payment Status (gated on COMPLETED) */}
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
                  onValueChange={field.onChange}
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

        <FormField
          control={control}
          name="paymentStatus"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status do Pagamento</FormLabel>
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
              {!isCompleted && <FormDescription>Disponível somente após a conclusão da aerografia</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Row 3: Expected dates */}
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

      {/* Row 4: Actual dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="startedAt"
          render={({ field }) => (
            <DateTimeInput field={field} label="Iniciado em" mode="datetime" context="start" disabled={disabled} />
          )}
        />

        <FormField
          control={control}
          name="finishedAt"
          render={({ field }) => (
            <DateTimeInput field={field} label="Finalizado em" mode="datetime" context="end" disabled={disabled} />
          )}
        />
      </div>
    </div>
  );
}
