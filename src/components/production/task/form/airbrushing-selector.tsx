import { useState } from "react";
import { IconSparkles } from "@tabler/icons-react";
import { AIRBRUSHING_STATUS, AIRBRUSHING_STATUS_LABELS } from "../../../../constants";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "../../../../utils";

interface AirbrushingSelectorProps {
  control: any;
  disabled?: boolean;
  isEditMode?: boolean; // Add prop to show status field only in edit mode
}

export const AirbrushingSelector = ({ control, disabled, isEditMode = false }: AirbrushingSelectorProps) => {
  const [hasAirbrushing, setHasAirbrushing] = useState(() => {
    const value = (control as any)._getWatch?.("airbrushing");
    return value && (value.status || value.price || value.startDate || value.finishDate);
  });

  const handleToggleAirbrushing = (checked: boolean) => {
    setHasAirbrushing(checked);
    if (checked) {
      // Set default values when enabling
      (control as any)._setValue?.("airbrushing", {
        status: AIRBRUSHING_STATUS.PENDING,
        price: null,
        startDate: null,
        finishDate: null,
        receiptIds: [],
        nfeIds: [],
      });
    } else {
      // Clear airbrushing when disabling
      (control as any)._setValue?.("airbrushing", null);
    }
  };

  const airbrushingPrice = (control as any)._getWatch?.("airbrushing.price");

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <IconSparkles className="h-5 w-5 text-purple-600" />
          <span className="font-medium">Incluir Aerografia</span>
          {hasAirbrushing && airbrushingPrice && (
            <Badge variant="secondary" className="ml-2">
              {formatCurrency(airbrushingPrice)}
            </Badge>
          )}
        </div>
        <Switch checked={hasAirbrushing} onCheckedChange={handleToggleAirbrushing} disabled={disabled} />
      </div>

      {/* Airbrushing Fields */}
      {hasAirbrushing && (
        <div className="space-y-4">
          {/* All fields in a single row */}
          <div className={`grid gap-4 ${isEditMode ? "grid-cols-1 md:grid-cols-4" : "grid-cols-1 md:grid-cols-3"}`}>
            {/* Status - Only show in edit mode */}
            {isEditMode && (
              <FormField
                control={control}
                name="airbrushing.status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value || AIRBRUSHING_STATUS.PENDING}
                        onValueChange={field.onChange}
                        disabled={disabled}
                        options={Object.values(AIRBRUSHING_STATUS).map((status) => ({
                          value: status,
                          label: AIRBRUSHING_STATUS_LABELS[status],
                        }))}
                        placeholder="Selecione o status"
                        searchable={false}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Price with Input currency type */}
            <FormField
              control={control}
              name="airbrushing.price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço</FormLabel>
                  <FormControl>
                    <Input type="currency" value={field.value} onChange={field.onChange} disabled={disabled} placeholder="R$ 0,00" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Start Date */}
            <FormField
              control={control}
              name="airbrushing.startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Início</FormLabel>
                  <FormControl>
                    <DateTimeInput field={field} mode="date" context="start" disabled={disabled} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Finish Date */}
            <FormField
              control={control}
              name="airbrushing.finishDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de Conclusão</FormLabel>
                  <FormControl>
                    <DateTimeInput field={field} mode="date" context="end" disabled={disabled} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Note about file uploads - keeping it but simpler */}
          <p className="text-sm text-muted-foreground">Recibos e notas fiscais podem ser anexados após a criação da tarefa.</p>
        </div>
      )}
    </div>
  );
};
