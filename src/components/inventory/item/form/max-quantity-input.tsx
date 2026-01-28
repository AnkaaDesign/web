import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { IconStack, IconRobot, IconUser } from '@tabler/icons-react';

interface MaxQuantityInputProps {
  disabled?: boolean;
  currentValue?: number | null;
  isManual?: boolean;
}

export function MaxQuantityInput({
  disabled,
  currentValue,
  isManual: initialIsManual = false,
}: MaxQuantityInputProps) {
  const form = useFormContext();
  const [isManualMode, setIsManualMode] = useState(initialIsManual);

  const handleModeToggle = (checked: boolean) => {
    setIsManualMode(checked);
    form.setValue('isManualMaxQuantity', checked, { shouldDirty: true });

    // If switching to automatic, clear the manual value
    if (!checked) {
      form.setValue('maxQuantity', null, { shouldDirty: true });
    }
  };

  return (
    <FormField
      control={form.control}
      name="maxQuantity"
      render={({ field }) => (
        <FormItem>
          <div className="flex items-center justify-between">
            <FormLabel className="flex items-center gap-2">
              <IconStack className="h-4 w-4 text-muted-foreground" />
              Quantidade Máxima
            </FormLabel>
            <div className="flex items-center gap-1.5">
              <IconRobot className={`h-3.5 w-3.5 ${!isManualMode ? 'text-primary' : 'text-muted-foreground'}`} />
              <Switch
                checked={isManualMode}
                onCheckedChange={handleModeToggle}
                disabled={disabled}
              />
              <IconUser className={`h-3.5 w-3.5 ${isManualMode ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
          </div>
          <FormControl>
            {!isManualMode ? (
              <div className="flex items-center h-10 px-2 py-2 rounded-md border border-border bg-transparent text-sm text-muted-foreground">
                <IconRobot className="h-4 w-4 mr-2 flex-shrink-0" />
                <span>Modo Automático</span>
              </div>
            ) : (
              <Input
                type="number"
                min={0}
                placeholder="Quantidade máxima"
                disabled={disabled}
                value={field.value ?? ''}
                onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                transparent={true}
                className="transition-all duration-200"
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
