import { IconUser } from "@tabler/icons-react";

import type { WarningCreateFormData, WarningUpdateFormData } from "../../../../schemas";
import type { User } from "../../../../types";
import { userService } from "../../../../api-client";
import { USER_STATUS } from "../../../../constants";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";

interface CollaboratorSelectProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function CollaboratorSelect({ control, disabled, required }: CollaboratorSelectProps) {
  return (
    <FormField
      control={control}
      name="collaboratorId"
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel>
            <div className="flex items-center gap-2">
              <IconUser className="h-4 w-4" />
              Colaborador {required && <span className="text-destructive">*</span>}
            </div>
          </FormLabel>
          <FormControl>
            <Combobox
              value={field.value}
              onValueChange={field.onChange}
              disabled={disabled}
              placeholder="Selecione o colaborador"
              emptyText="Nenhum colaborador encontrado"
              searchPlaceholder="Buscar colaborador..."
              async={true}
              queryKey={["users", "search"]}
              queryFn={async (search: string) => {
                const response = await userService.getUsers({
                  searchingFor: search,
                  limit: 20,
                  where: { status: { not: USER_STATUS.DISMISSED } },
                  include: { position: true },
                });
                return response.data || [];
              }}
              getOptionLabel={(user: User) => user.name}
              getOptionValue={(user: User) => user.id}
              renderOption={(user: User) => (
                <div>
                  <p className="font-medium">{user.name}</p>
                  {user.position && <p className="text-xs text-muted-foreground">{user.position.name}</p>}
                </div>
              )}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
