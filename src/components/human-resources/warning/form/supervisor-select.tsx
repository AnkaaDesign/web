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
}

export function SupervisorSelect({ control, disabled, required }: SupervisorSelectProps) {
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
            <Combobox
              value={field.value}
              onValueChange={field.onChange}
              disabled={disabled}
              placeholder="Selecione o supervisor"
              emptyText="Nenhum supervisor encontrado"
              searchPlaceholder="Buscar supervisor..."
              async={true}
              queryKey={["users", "supervisors"]}
              queryFn={async (search: string) => {
                const response = await userService.getUsers({
                  searchingFor: search,
                  limit: 20,
                  where: {
                    status: { not: USER_STATUS.DISMISSED },
                    sector: {
                      privileges: {
                        in: [SECTOR_PRIVILEGES.LEADER, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.HUMAN_RESOURCES],
                      },
                    },
                  },
                  include: { position: true, sector: true },
                });
                return response.data || [];
              }}
              getOptionLabel={(user: User) => user.name}
              getOptionValue={(user: User) => user.id}
              renderOption={(user: User) => (
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.position?.name} - {user.sector?.name}
                  </p>
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
