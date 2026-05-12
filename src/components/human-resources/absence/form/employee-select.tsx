import { useCallback, useMemo } from "react";
import { IconUser } from "@tabler/icons-react";

import type { User } from "../../../../types";
import { userService } from "../../../../api-client";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";

interface EmployeeSelectProps {
  control: any;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  initialUser?: User;
}

// Single-employee picker that requires the user to be linked to Secullum
// (secullumEmployeeId !== null). Without that link the absence POST cannot resolve
// to a Secullum funcionarioId, so we filter the search results upfront.
export function EmployeeSelect({ control, name = "userId", disabled, required, initialUser }: EmployeeSelectProps) {
  const initialOptions = useMemo(() => (initialUser ? [initialUser] : []), [initialUser?.id]);

  const queryFn = useCallback(async (search: string, page: number = 1) => {
    const queryParams: any = {
      page,
      take: 50,
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        secullumEmployeeId: true,
        position: { select: { id: true, name: true } },
        sector: { select: { id: true, name: true } },
      },
    };
    if (search?.trim()) queryParams.searchingFor = search.trim();
    const response = await userService.getUsers(queryParams);
    // Filter to Secullum-linked users client-side (where filter doesn't accept this).
    const filtered = (response.data || []).filter((u: any) => u.secullumEmployeeId != null);
    return { data: filtered, hasMore: response.meta?.hasNextPage || false };
  }, []);

  const getOptionLabel = useCallback((u: User) => u.name, []);
  const getOptionValue = useCallback((u: User) => u.id, []);
  const renderOption = useCallback(
    (u: User) => (
      <div>
        <p className="font-medium">{u.name}</p>
        <div className="flex gap-2 text-xs text-muted-foreground">
          {u.position?.name && <span>{u.position.name}</span>}
          {u.sector?.name && <span>· {u.sector.name}</span>}
        </div>
      </div>
    ),
    [],
  );

  return (
    <FormField
      control={control}
      name={name}
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
              placeholder="Buscar colaborador..."
              emptyText="Nenhum colaborador vinculado ao Secullum"
              queryFn={queryFn}
              initialOptions={initialOptions}
              getOptionLabel={getOptionLabel}
              getOptionValue={getOptionValue}
              renderOption={renderOption}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
