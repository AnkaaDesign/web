import { IconUser } from "@tabler/icons-react";

import type { VacationCreateFormData, VacationUpdateFormData } from "../../../../schemas";
import type { User } from "../../../../types";
import { userService } from "../../../../api-client";
import { USER_STATUS } from "../../../../constants";

import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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
      name="userId"
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
              value={field.value || ""}
              onValueChange={field.onChange}
              disabled={disabled}
              placeholder="Selecione um colaborador"
              emptyText="Nenhum colaborador encontrado"
              searchPlaceholder="Buscar colaborador..."
              async={true}
              minSearchLength={0}
              queryKey={["users", "vacation"]}
              queryFn={async (search: string) => {
                const response = await userService.getUsers({
                  searchingFor: search,
                  limit: 20,
                  where: { status: { not: USER_STATUS.DISMISSED } },
                  include: { position: true },
                });
                return { data: response.data || [], hasMore: response.meta?.hasNextPage || false, total: response.meta?.totalRecords || 0 };
              }}
              getOptionLabel={(user: User) => user.name}
              getOptionValue={(user: User) => user.id}
              renderOption={(user: User) => (
                <div>
                  <p className="font-medium">{user.name}</p>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    {user.email && <span>{user.email}</span>}
                    {user.position?.name && <span>{user.position.name}</span>}
                  </div>
                </div>
              )}
            />
          </FormControl>
          <FormDescription>Selecione o colaborador que irá tirar férias{required && " (obrigatório)"}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
