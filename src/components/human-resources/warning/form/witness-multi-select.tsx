import { IconUsers } from "@tabler/icons-react";

import type { WarningCreateFormData, WarningUpdateFormData } from "../../../../schemas";
import type { User } from "../../../../types";
import { userService } from "../../../../api-client";
import { USER_STATUS } from "../../../../constants";

import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";

interface WitnessMultiSelectProps {
  control: any;
  disabled?: boolean;
  excludeIds?: string[];
}

export function WitnessMultiSelect({ control, disabled, excludeIds = [] }: WitnessMultiSelectProps) {
  return (
    <FormField
      control={control}
      name="witnessIds"
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel>
            <div className="flex items-center gap-2">
              <IconUsers className="h-4 w-4" />
              Testemunhas
            </div>
          </FormLabel>
          <FormControl>
            <Combobox
              mode="multiple"
              async={true}
              value={field.value || []}
              onValueChange={field.onChange}
              disabled={disabled}
              placeholder="Selecione as testemunhas"
              emptyText="Nenhuma testemunha encontrada"
              searchPlaceholder="Buscar testemunhas..."
              queryFn={async (search: string) => {
                const validExcludeIds = excludeIds.filter((id) => id && id.trim() !== "");
                const whereClause: any = { status: { not: USER_STATUS.DISMISSED } };

                if (validExcludeIds.length > 0) {
                  whereClause.id = { notIn: validExcludeIds };
                }

                const response = await userService.getUsers({
                  searchingFor: search,
                  limit: 20,
                  where: whereClause,
                  include: { position: true },
                });
                return (response.data || []).map((user: User) => ({
                  value: user.id,
                  label: user.name,
                  position: user.position?.name,
                }));
              }}
              queryKey={["witness-users"]}
              renderOption={(option: { value: string; label: string; position?: string }) => (
                <div>
                  <p className="font-medium">{option.label}</p>
                  {option.position && <p className="text-xs text-muted-foreground">{option.position}</p>}
                </div>
              )}
            />
          </FormControl>
          <FormDescription>Pessoas que presenciaram o incidente (opcional)</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
