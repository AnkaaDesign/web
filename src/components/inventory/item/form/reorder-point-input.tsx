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
import { IconAlertTriangle, IconRobot, IconUser } from '@tabler/icons-react';
import { Alert, AlertDescription } from '@/components/ui/alert';


interface ReorderPointInputProps {
  disabled?: boolean;
  required?: boolean;
  currentValue?: number | null;
  isManual?: boolean;
}

export function ReorderPointInput({
  disabled,
  required,
  currentValue,
  isManual: fallbackIsManual = false,
}: ReorderPointInputProps) {
  const form = useFormContext();
  // Watch the form value directly to stay in sync with form resets and data refetches
  const isManualMode = form.watch('isManualReorderPoint') ?? fallbackIsManual;

  const handleModeToggle = (checked: boolean) => {
    form.setValue('isManualReorderPoint', checked, { shouldDirty: true });

    // If switching to automatic, clear the manual value
    if (!checked) {
      form.setValue('reorderPoint', null, { shouldDirty: true });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <FormLabel className="flex items-center gap-2">
          <IconAlertTriangle className="h-4 w-4" />
          Ponto de Reposição {required && <span className="text-destructive">*</span>}
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
            <strong>Modo Automático:</strong> O ponto de reposição será calculado automaticamente
            com base no consumo médio e tempo de entrega.
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
          name="reorderPoint"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  disabled={disabled}
                  value={field.value || ''}
                  onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                  transparent={true}
                />
              </FormControl>
              <FormDescription>
                <IconUser className="inline h-3 w-3 mr-1" />
                Valor manual: Quantidade mínima em estoque para gerar alerta de reposição
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
