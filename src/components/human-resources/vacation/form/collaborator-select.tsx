import { useMemo, useCallback } from "react";
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
  initialCollaborator?: User;
}

export function CollaboratorSelect({ control, disabled, required, initialCollaborator }: CollaboratorSelectProps) {
  // Memoize initial options with stable dependency
  const initialOptions = useMemo(() => {
    if (!initialCollaborator) return [];
    return [initialCollaborator];
  }, [initialCollaborator?.id]);

  // Memoize queryFn callback
  const queryFn = useCallback(async (search: string) => {
    const response = await userService.getUsers({
      searchingFor: search,
      limit: 20,
      where: { status: { not: USER_STATUS.DISMISSED } },
      include: { position: true },
    });
    return { data: response.data || [], hasMore: response.meta?.hasNextPage || false, total: response.meta?.totalRecords || 0 };
  }, []);

  // Memoize getOptionLabel callback
  const getOptionLabel = useCallback((user: User) => user.name, []);

  // Memoize getOptionValue callback
  const getOptionValue = useCallback((user: User) => user.id, []);

  // Memoize renderOption callback
  const renderOption = useCallback(
    (user: User) => (
      <div>
        <p className="font-medium">{user.name}</p>
        <div className="flex gap-2 text-xs text-muted-foreground">
          {user.email && <span>{user.email}</span>}
          {user.position?.name && <span>{user.position.name}</span>}
        </div>
      </div>
    ),
    [],
  );

  return (
    <FormField
      control={control}
      name="userId"
      render={({ field, fieldState }) => (
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
              queryFn={queryFn}
              getOptionLabel={getOptionLabel}
              getOptionValue={getOptionValue}
              renderOption={renderOption}
              initialOptions={initialOptions}
            />
          </FormControl>
          <FormDescription>
            Selecione o colaborador que irá tirar férias{fieldState.error && required && <span className="text-destructive"> (obrigatório)</span>}
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
