import { FormControl, FormField, FormItem, FormLabel, FormDescription } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

interface NeedGroundSwitchProps {
  control: any;
  disabled?: boolean;
}

export function NeedGroundSwitch({ control, disabled }: NeedGroundSwitchProps) {
  return (
    <FormField
      control={control}
      name="needGround"
      render={({ field }) => (
        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border/50 p-4 bg-muted/30">
          <div className="space-y-0.5">
            <FormLabel className="text-base">Requer Fundo</FormLabel>
            <FormDescription>Ative esta opção se tintas deste tipo precisam de fundos/primers antes da aplicação</FormDescription>
          </div>
          <FormControl>
            <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
