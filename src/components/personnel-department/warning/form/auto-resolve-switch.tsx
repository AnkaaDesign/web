import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

interface AutoResolveSwitchProps {
  control: any;
  disabled?: boolean;
  // When true (severity = SUSPENSION / FINAL_WARNING) the toggle is forced off and locked:
  // the API never auto-resolves grave measures — they always require manual closure.
  graveMeasure?: boolean;
}

export function AutoResolveSwitch({ control, disabled, graveMeasure }: AutoResolveSwitchProps) {
  return (
    <FormField
      control={control}
      name="autoResolve"
      render={({ field }) => (
        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border border-border/40 bg-muted/30 p-4">
          <FormControl>
            <Switch
              checked={graveMeasure ? false : !!field.value}
              onCheckedChange={field.onChange}
              disabled={disabled || graveMeasure}
            />
          </FormControl>
          <div className="space-y-1 leading-none">
            <FormLabel>Encerrar automaticamente ao fim do acompanhamento</FormLabel>
            <FormDescription>
              {graveMeasure
                ? "Medidas graves (Suspensão e Advertência Final) sempre exigem encerramento manual e não podem ser resolvidas automaticamente."
                : "A advertência será resolvida automaticamente quando a data de acompanhamento for ultrapassada sem reincidência."}
            </FormDescription>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
