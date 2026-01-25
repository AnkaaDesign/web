import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { IconStack, IconRobot, IconUser } from '@tabler/icons-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <FormLabel className="flex items-center gap-2">
          <IconStack className="h-4 w-4" />
          Quantidade Máxima
        </FormLabel>
        <div className="flex items-center gap-2">
          <IconRobot className={`h-4 w-4 ${!isManualMode ? 'text-primary' : 'text-muted-foreground'}`} />
          <Switch
            checked={isManualMode}
            onCheckedChange={handleModeToggle}
            disabled={disabled}
          />
          <IconUser className={`h-4 w-4 ${isManualMode ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
      </div>

      {!isManualMode ? (
        <Alert>
          <IconRobot className="h-4 w-4" />
          <AlertDescription>
            <strong>Modo Automático:</strong> A quantidade máxima será calculada automaticamente com
            base no consumo e tendências de demanda.
            {currentValue !== null && currentValue !== undefined && (
              <span className="block mt-1">
                Valor atual calculado: <strong>{currentValue}</strong>
              </span>
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <FormField
          control={form.control}
          name="maxQuantity"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  placeholder="Quantidade máxima"
                  disabled={disabled}
                  value={field.value || ''}
                  onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                  transparent={true}
                />
              </FormControl>
              <FormDescription>
                <IconUser className="inline h-3 w-3 mr-1" />
                Valor manual: Quantidade máxima permitida em estoque
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
