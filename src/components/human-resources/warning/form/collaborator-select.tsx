import { useMemo, useCallback } from "react";
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
  initialCollaborator?: User;
}

export function CollaboratorSelect({ control, disabled, required, initialCollaborator }: CollaboratorSelectProps) {
  // Memoize initialOptions to prevent infinite loop
  const initialOptions = useMemo(() => initialCollaborator ? [initialCollaborator] : [], [initialCollaborator?.id]);

  // Memoize callbacks to prevent infinite loop
  const getOptionLabel = useCallback((user: User) => user.name, []);
  const getOptionValue = useCallback((user: User) => user.id, []);

  // Memoize queryFn
  const queryFn = useCallback(async (search: string, page: number = 1) => {
    const response = await userService.getUsers({
      searchingFor: search,
      limit: 20,
      page,
      where: { status: { not: USER_STATUS.DISMISSED } },
      include: { position: true },
    });

    return {
      data: response.data || [],
      hasMore: response.meta?.hasNextPage || false,
    };
  }, []);

  // Memoize renderOption
  const renderOption = useCallback((user: User) => (
    <div>
      <p className="font-medium">{user.name}</p>
      {user.position && <p className="text-xs text-muted-foreground">{user.position.name}</p>}
    </div>
  ), []);

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
            <Combobox<User>
              value={field.value}
              onValueChange={field.onChange}
              disabled={disabled}
              placeholder="Selecione o colaborador"
              emptyText="Nenhum colaborador encontrado"
              searchPlaceholder="Buscar colaborador..."
              async={true}
              queryKey={["users", "warning-collaborator"]}
              queryFn={queryFn}
              initialOptions={initialOptions}
              getOptionLabel={getOptionLabel}
              getOptionValue={getOptionValue}
              renderOption={renderOption}
              minSearchLength={0}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
