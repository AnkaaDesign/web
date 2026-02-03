import { useMemo, useCallback } from "react";
import { IconUserShield } from "@tabler/icons-react";

import type { WarningCreateFormData, WarningUpdateFormData } from "../../../../schemas";
import type { User } from "../../../../types";
import { userService } from "../../../../api-client";
import { SECTOR_PRIVILEGES, USER_STATUS } from "../../../../constants";

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";

interface SupervisorSelectProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
  initialSupervisor?: User;
}

export function SupervisorSelect({ control, disabled, required, initialSupervisor }: SupervisorSelectProps) {
  // Memoize initialOptions to prevent infinite loop
  const initialOptions = useMemo(() => initialSupervisor ? [initialSupervisor] : [], [initialSupervisor?.id]);

  // Memoize callbacks to prevent infinite loop
  const getOptionLabel = useCallback((user: User) => user.name, []);
  const getOptionValue = useCallback((user: User) => user.id, []);

  // Memoize queryFn - filter by isActive: true and sector privileges for supervisors
  const queryFn = useCallback(async (search: string, page: number = 1) => {
    const queryParams: any = {
      page,
      take: 50,
      where: {
        isActive: true,
        sector: {
          privileges: {
            in: [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES],
          },
        },
      },
      select: {
        id: true,
        name: true,
        position: {
          select: {
            id: true,
            name: true,
          },
        },
        sector: {
          select: {
            id: true,
            name: true,
          },
        },
      },
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

  // Memoize renderOption
  const renderOption = useCallback((user: User) => (
    <div>
      <p className="font-medium">{user.name}</p>
      <p className="text-xs text-muted-foreground">
        {user.position?.name} - {user.sector?.name}
      </p>
    </div>
  ), []);

  return (
    <FormField
      control={control}
      name="supervisorId"
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel>
            <div className="flex items-center gap-2">
              <IconUserShield className="h-4 w-4" />
              Supervisor {required && <span className="text-destructive">*</span>}
            </div>
          </FormLabel>
          <FormControl>
            <Combobox<User>
              value={field.value}
              onValueChange={field.onChange}
              disabled={disabled}
              placeholder="Selecione o supervisor"
              emptyText="Nenhum supervisor encontrado"
              searchPlaceholder="Buscar supervisor..."
              async={true}
              queryKey={["users", "warning-supervisor"]}
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
