import { useMemo, useCallback } from "react";
import { IconUsers } from "@tabler/icons-react";

import type { WarningCreateFormData, WarningUpdateFormData } from "../../../../schemas";
import type { User } from "../../../../types";
import { userService } from "../../../../api-client";
import { USER_STATUS } from "../../../../constants";

import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";

type WitnessOption = { value: string; label: string; position?: string };

interface WitnessMultiSelectProps {
  control: any;
  disabled?: boolean;
  excludeIds?: string[];
  initialWitnesses?: User[];
}

export function WitnessMultiSelect({ control, disabled, excludeIds = [], initialWitnesses }: WitnessMultiSelectProps) {
  // Memoize initialOptions to prevent infinite loop
  const initialOptions = useMemo(() => {
    if (!initialWitnesses || initialWitnesses.length === 0) return [];
    return initialWitnesses.map(user => ({
      value: user.id,
      label: user.name,
      position: user.position?.name,
    }));
  }, [initialWitnesses?.map(w => w.id).join(',')]);

  // Memoize queryFn
  const queryFn = useCallback(async (search: string, page: number = 1) => {
    const validExcludeIds = excludeIds.filter((id) => id && id.trim() !== "");
    const whereClause: any = { status: { not: USER_STATUS.DISMISSED } };

    if (validExcludeIds.length > 0) {
      whereClause.id = { notIn: validExcludeIds };
    }

    const response = await userService.getUsers({
      searchingFor: search,
      limit: 20,
      page,
      where: whereClause,
      include: { position: true },
    });

    const data = (response.data || []).map((user: User) => ({
      value: user.id,
      label: user.name,
      position: user.position?.name,
    }));

    return {
      data,
      hasMore: response.meta?.hasNextPage || false,
    };
  }, [excludeIds.join(',')]);

  // Memoize renderOption
  const renderOption = useCallback((option: WitnessOption) => (
    <div>
      <p className="font-medium">{option.label}</p>
      {option.position && <p className="text-xs text-muted-foreground">{option.position}</p>}
    </div>
  ), []);

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
            <Combobox<WitnessOption>
              mode="multiple"
              async={true}
              value={field.value || []}
              onValueChange={field.onChange}
              disabled={disabled}
              placeholder="Selecione as testemunhas"
              emptyText="Nenhuma testemunha encontrada"
              searchPlaceholder="Buscar testemunhas..."
              queryFn={queryFn}
              queryKey={["users", "warning-witnesses", excludeIds.join(',')]}
              initialOptions={initialOptions}
              renderOption={renderOption}
              minSearchLength={0}
            />
          </FormControl>
          <FormDescription>Pessoas que presenciaram o incidente (opcional)</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
