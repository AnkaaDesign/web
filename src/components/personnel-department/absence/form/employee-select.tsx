import { useCallback, useMemo } from "react";
import { IconUser } from "@tabler/icons-react";

import type { User } from "../../../../types";
import { userService } from "../../../../api-client";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { CONTRACT_STATUS } from "@/constants";

// Sentinel id used to represent the "collective vacations" choice. Anything
// upstream that consumes the selected value should test for this constant
// before treating it as a real user id.
export const COLLECTIVE_USER_ID = "__COLLECTIVE__";

// Synthetic option injected as the first row of the combobox. Shaped enough
// like a User to satisfy Combobox's generic typing, but never resolved against
// the database — the form handler short-circuits it into applyToAll=true.
const COLLECTIVE_OPTION = {
  id: COLLECTIVE_USER_ID,
  name: "Férias Coletiva — todos os colaboradores",
  email: null,
  secullumEmployeeId: 0,
  position: null,
  sector: null,
  __collective: true,
} as unknown as User;

interface EmployeeSelectProps {
  control: any;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  initialUser?: User;
  // When true (default), prepends a synthetic "Coletiva" option to the list.
  // Edit mode passes false so a real user id is always selected.
  allowCollective?: boolean;
}

// Single-employee picker that requires the user to be linked to Secullum
// (secullumEmployeeId !== null). Without that link the absence POST cannot
// resolve to a Secullum funcionarioId, so we filter the search server-side.
export function EmployeeSelect({
  control,
  name = "userId",
  disabled,
  required,
  initialUser,
  allowCollective = true,
}: EmployeeSelectProps) {
  const initialOptions = useMemo(() => {
    const base = initialUser ? [initialUser] : [];
    return allowCollective ? [COLLECTIVE_OPTION, ...base] : base;
  }, [initialUser?.id, allowCollective]);

  const queryFn = useCallback(
    async (search: string, page: number = 1) => {
      const queryParams: any = {
        page,
        take: 50,
        where: { currentContractStatus: CONTRACT_STATUS.ACTIVE, secullumEmployeeId: { not: null } },
        orderBy: { name: "asc" },
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
      const realUsers = (response.data || []) as User[];
      // Pin the Coletiva option to the top of the first page when no search
      // is active — it should not appear mixed into search results.
      const data =
        allowCollective && page === 1 && !search?.trim()
          ? [COLLECTIVE_OPTION, ...realUsers]
          : realUsers;
      return { data, hasMore: response.meta?.hasNextPage || false };
    },
    [allowCollective],
  );

  const getOptionLabel = useCallback((u: User) => u.name, []);
  const getOptionValue = useCallback((u: User) => u.id, []);
  const renderOption = useCallback((u: User) => {
    if ((u as any).__collective) {
      return (
        <div>
          <p className="font-medium">Férias Coletiva</p>
          <p className="text-xs text-muted-foreground">
            Aplicar a todos os colaboradores ativos vinculados ao Secullum
          </p>
        </div>
      );
    }
    return (
      <div>
        <p className="font-medium">{u.name}</p>
        <div className="flex gap-2 text-xs text-muted-foreground">
          {u.position?.name && <span>{u.position.name}</span>}
          {u.sector?.name && <span>· {u.sector.name}</span>}
        </div>
      </div>
    );
  }, []);

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
              async
              queryKey={["users", "secullum-linked", allowCollective ? "with-coletiva" : "no-coletiva"]}
              minSearchLength={0}
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
