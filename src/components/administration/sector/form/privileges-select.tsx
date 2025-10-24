import type { SectorCreateFormData, SectorUpdateFormData } from "../../../../types";
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
  const privilegeInfo = {
    [SECTOR_PRIVILEGES.BASIC]: { order: 1, description: "Acesso básico aos recursos do sistema" },
    [SECTOR_PRIVILEGES.EXTERNAL]: { order: 2, description: "Acesso para colaboradores externos" },
    [SECTOR_PRIVILEGES.WAREHOUSE]: { order: 3, description: "Controle de estoque e almoxarifado" },
    [SECTOR_PRIVILEGES.DESIGNER]: { order: 4, description: "Design e criação de artes" },
    [SECTOR_PRIVILEGES.PRODUCTION]: { order: 5, description: "Gestão de produção e tarefas" },
    [SECTOR_PRIVILEGES.MAINTENANCE]: { order: 6, description: "Manutenção e equipamentos" },
    [SECTOR_PRIVILEGES.LOGISTIC]: { order: 7, description: "Logística e transporte" },
    [SECTOR_PRIVILEGES.LEADER]: { order: 8, description: "Liderança de equipe e supervisão" },
    [SECTOR_PRIVILEGES.HUMAN_RESOURCES]: { order: 9, description: "Recursos humanos e pessoal" },
    [SECTOR_PRIVILEGES.FINANCIAL]: { order: 10, description: "Controle financeiro e orçamentário" },
    [SECTOR_PRIVILEGES.ADMIN]: { order: 11, description: "Administração completa do sistema" },
  };

  // Sort privileges by order
  const sortedPrivileges = Object.entries(SECTOR_PRIVILEGES_LABELS).sort(
    ([a], [b]) => privilegeInfo[a as keyof typeof privilegeInfo].order - privilegeInfo[b as keyof typeof privilegeInfo].order,
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
