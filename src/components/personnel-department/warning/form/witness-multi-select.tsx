import { useMemo, useCallback, useRef } from "react";
import { IconUsers } from "@tabler/icons-react";

import type { User } from "../../../../types";
import { userService } from "../../../../api-client";

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
  // Create a stable cache for fetched items
  const cacheRef = useRef<Map<string, WitnessOption>>(new Map());

  // Memoize initialOptions to prevent infinite loop
  const initialOptions = useMemo(() => {
    if (!initialWitnesses || initialWitnesses.length === 0) return [];
    return initialWitnesses.map(user => {
      const option = {
        value: user.id,
        label: user.name,
        position: user.position?.name,
      };
      // Add to cache
      cacheRef.current.set(user.id, option);
      return option;
    });
  }, [initialWitnesses?.map(w => w.id).join(',')]);

  // Memoize queryFn - filter by isActive: true for warning witnesses
  const queryFn = useCallback(async (search: string, page: number = 1) => {
    const validExcludeIds = excludeIds.filter((id) => id && id.trim() !== "");
    const whereClause: any = { isActive: true };

    if (validExcludeIds.length > 0) {
      whereClause.id = { notIn: validExcludeIds };
    }

    const queryParams: any = {
      page,
      take: 50,
      where: whereClause,
      select: {
        id: true,
        name: true,
        position: {
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

    const data = (response.data || []).map((user: User) => {
      const option = {
        value: user.id,
        label: user.name,
        position: user.position?.name,
      };
      // Add to cache
      cacheRef.current.set(user.id, option);
      return option;
    });

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
              pageSize={50}
              debounceMs={300}
              searchable={true}
              clearable={true}
            />
          </FormControl>
          <FormDescription>Pessoas que presenciaram o incidente (opcional)</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
