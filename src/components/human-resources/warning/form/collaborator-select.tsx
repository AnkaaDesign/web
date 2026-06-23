import { useMemo, useCallback } from "react";
import { IconUser } from "@tabler/icons-react";

import type { User } from "../../../../types";
import { userService } from "../../../../api-client";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";

interface CollaboratorSelectProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
  initialCollaborator?: User;
  /** Called with the full user object (including sector.leader) when selection changes. */
  onUserSelect?: (user: User | null) => void;
}

export function CollaboratorSelect({ control, disabled, required, initialCollaborator, onUserSelect }: CollaboratorSelectProps) {
  const initialOptions = useMemo(() => initialCollaborator ? [initialCollaborator] : [], [initialCollaborator?.id]);

  const getOptionLabel = useCallback((user: User) => user.name, []);
  const getOptionValue = useCallback((user: User) => user.id, []);

  const queryFn = useCallback(async (search: string) => {
    const queryParams: any = {
      take: 50,
      where: { isActive: true },
    };
    if (search && search.trim()) {
      queryParams.searchingFor = search.trim();
    }
    const response = await userService.getUsers(queryParams);
    return {
      data: response.data || [],
      hasMore: response.meta?.hasNextPage || false,
    };
  }, []);

  const renderOption = useCallback((user: User) => (
    <div>
      <p className="font-medium">{user.name}</p>
      {(user as any).position && <p className="text-xs text-muted-foreground">{(user as any).position.name}</p>}
    </div>
  ), []);

  const handleValueChange = useCallback(async (value: string | string[] | null | undefined) => {
    if (!onUserSelect) return;

    if (!value) {
      onUserSelect(null);
      return;
    }

    const id = value as string;
    try {
      // Fetch the full user including sector.leader via a direct GET /users/:id
      const response = await userService.getUserById(id, {
        include: {
          position: true,
          sector: {
            include: {
              leader: {
                include: { position: true },
              },
            },
          },
        },
      } as any);
      onUserSelect((response.data as User) ?? null);
    } catch {
      onUserSelect(null);
    }
  }, [onUserSelect]);

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
              onValueChange={(value) => {
                field.onChange(value);
                handleValueChange(value);
              }}
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
              pageSize={50}
              debounceMs={300}
              searchable={true}
              clearable={true}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
