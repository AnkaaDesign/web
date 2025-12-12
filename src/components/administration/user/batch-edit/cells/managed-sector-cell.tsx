import { FormField, FormItem, FormControl, FormMessage, FormLabel } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useWatch } from "react-hook-form";

interface ManagedSectorCellProps {
  control: any;
  index: number;
  disabled?: boolean;
}

/**
 * Sector Leader Cell Component
 *
 * In the new workflow, a user can only manage their own sector.
 * This component shows a switch to toggle whether the user is the leader
 * of their currently assigned sector.
 */
export function ManagedSectorCell({ control, index, disabled }: ManagedSectorCellProps) {
  // Watch the sectorId to know if a sector is selected
  const sectorId = useWatch({
    control,
    name: `users.${index}.data.sectorId`,
  });

  const isDisabled = disabled || !sectorId;

  return (
    <FormField
      control={control}
      name={`users.${index}.data.isSectorLeader`}
      render={({ field }) => (
        <FormItem className="flex items-center gap-2">
          <FormControl>
            <Switch
              checked={field.value || false}
              onCheckedChange={field.onChange}
              disabled={isDisabled}
            />
          </FormControl>
          <FormLabel className="text-xs text-muted-foreground cursor-pointer">
            {sectorId ? "Líder" : "Selecione um setor"}
          </FormLabel>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
