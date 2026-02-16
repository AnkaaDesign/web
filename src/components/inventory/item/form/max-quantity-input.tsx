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
  currentValue: _currentValue,
  isManual: fallbackIsManual = false,
}: MaxQuantityInputProps) {
  const form = useFormContext();
  // Watch the form value directly to stay in sync with form resets and data refetches
  const isManualMode = form.watch('isManualMaxQuantity') ?? fallbackIsManual;

  const handleModeToggle = (checked: boolean) => {
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
                onChange={(value: string | number | null) => {
                  field.onChange(value !== null && value !== '' ? parseFloat(String(value)) : null);
                }}
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
