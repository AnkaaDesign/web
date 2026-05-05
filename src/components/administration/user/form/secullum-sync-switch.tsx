import { useFormContext } from "react-hook-form";
import { IconClock } from "@tabler/icons-react";
import { Switch } from "@/components/ui/switch";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";

/**
 * "Criar no Secullum" toggle on the user form.
 *
 * - On the CREATE form: when ON, the API will provision a Funcionario in Secullum
 *   right after the user is persisted, using all available fields (CPF, PIS,
 *   payrollNumber, position→Funcao, sector→Departamento, admissionDate, etc.).
 *   The returned `Funcionario.Id` is stored on `User.secullumEmployeeId`.
 *
 * - On the EDIT form: when ON and the user already has `secullumEmployeeId`, any
 *   profile change is pushed to Secullum (POST /Funcionarios upsert). When OFF,
 *   the existing Secullum record is left alone.
 *
 * Backed by `User.secullumSyncEnabled` (Boolean, default false).
 */
export function SecullumSyncSwitch({
  disabled,
  alreadyLinkedSecullumId,
}: {
  disabled?: boolean;
  alreadyLinkedSecullumId?: number | null;
}) {
  const form = useFormContext();

  return (
    <FormField
      control={form.control}
      name="secullumSyncEnabled"
      render={({ field }) => (
        <FormItem className="flex flex-row items-start justify-between rounded-lg border border-border/60 bg-muted/30 p-4">
          <div className="space-y-1">
            <FormLabel className="flex items-center gap-2 text-sm font-medium">
              <IconClock className="h-4 w-4" />
              Criar / sincronizar no Secullum
            </FormLabel>
            <FormDescription className="text-xs text-muted-foreground">
              {alreadyLinkedSecullumId
                ? `Vinculado ao funcionário Secullum #${alreadyLinkedSecullumId}. ` +
                  `Quando ativo, alterações deste cadastro serão refletidas no Secullum.`
                : "Quando ativo, ao salvar o usuário um funcionário será criado no Secullum " +
                  "com todos os dados disponíveis (CPF, PIS, nº folha, cargo, departamento, admissão, etc.). " +
                  "Em caso de demissão, o desligamento também será refletido."}
            </FormDescription>
          </div>
          <FormControl>
            <Switch
              checked={!!field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
              aria-label="Sincronizar com Secullum"
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
