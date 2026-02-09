import { SECTOR_PRIVILEGES_LABELS, SECTOR_PRIVILEGES } from "../../../../constants";

import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";

interface PrivilegesSelectProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function PrivilegesSelect({ control, disabled, required }: PrivilegesSelectProps) {
  // Define privilege descriptions and order
  const privilegeInfo: Record<string, { order: number; description: string }> = {
    [SECTOR_PRIVILEGES.BASIC]: { order: 1, description: "Acesso básico aos recursos do sistema" },
    [SECTOR_PRIVILEGES.EXTERNAL]: { order: 2, description: "Acesso para colaboradores externos" },
    [SECTOR_PRIVILEGES.WAREHOUSE]: { order: 3, description: "Controle de estoque e almoxarifado" },
    [SECTOR_PRIVILEGES.DESIGNER]: { order: 4, description: "Design e criação de artes" },
    [SECTOR_PRIVILEGES.PLOTTING]: { order: 5, description: "Plotagem e impressão de materiais" },
    [SECTOR_PRIVILEGES.PRODUCTION]: { order: 6, description: "Gestão de produção e tarefas" },
    [SECTOR_PRIVILEGES.MAINTENANCE]: { order: 7, description: "Manutenção e equipamentos" },
    [SECTOR_PRIVILEGES.LOGISTIC]: { order: 8, description: "Logística e transporte" },
    [SECTOR_PRIVILEGES.COMMERCIAL]: { order: 9, description: "Atividades comerciais e vendas" },
    [SECTOR_PRIVILEGES.HUMAN_RESOURCES]: { order: 10, description: "Recursos humanos e pessoal" },
    [SECTOR_PRIVILEGES.FINANCIAL]: { order: 11, description: "Controle financeiro e orçamentário" },
    [SECTOR_PRIVILEGES.ADMIN]: { order: 12, description: "Administração completa do sistema" },
  };

  // Sort privileges by order (with fallback for any missing entries)
  const sortedPrivileges = Object.entries(SECTOR_PRIVILEGES_LABELS).sort(
    ([a], [b]) => (privilegeInfo[a]?.order ?? 999) - (privilegeInfo[b]?.order ?? 999),
  );

  return (
    <FormField
      control={control}
      name="privileges"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Privilégios {required && <span className="text-destructive">*</span>}</FormLabel>
          <FormControl>
            <Combobox
              disabled={disabled}
              value={field.value}
              onValueChange={field.onChange}
              options={sortedPrivileges.map(([key, label]) => ({
                value: key,
                label: label,
              }))}
              placeholder="Selecione os privilégios do setor"
            />
          </FormControl>
          <FormDescription>
            {field.value && privilegeInfo[field.value as keyof typeof privilegeInfo] && (
              <span className="text-sm">{privilegeInfo[field.value as keyof typeof privilegeInfo].description}</span>
            )}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
