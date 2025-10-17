import { useMemo, useCallback } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { IconShield } from "@tabler/icons-react";
import { getSectors } from "../../../../api-client";
import { useFormContext } from "react-hook-form";
import type { Sector } from "../../../../types";

interface ManagedSectorSelectorProps {
  disabled?: boolean;
  initialSector?: Sector;
}

export function ManagedSectorSelector({ disabled, initialSector }: ManagedSectorSelectorProps) {
  const form = useFormContext();

  // Memoize initial options
  const initialOptions = useMemo(() => {
    if (!initialSector) return [];
    return [{
      value: initialSector.id,
      label: initialSector.name,
    }];
  }, [initialSector]);

  // Async query function for the combobox
  const querySectors = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
      };

      // Only add searchingFor if there's a search term
      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getSectors(queryParams);
      const sectors = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      // Convert sectors to options format
      const options = sectors.map((sector) => ({
        value: sector.id,
        label: sector.name,
      }));

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      console.error("Error fetching sectors:", error);
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  return (
    <FormField
      control={form.control}
      name="managedSectorId"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconShield className="h-4 w-4" />
            Líder de Setor
          </FormLabel>
          <FormDescription>
            Selecione se este usuário é líder de algum setor
          </FormDescription>
          <FormControl>
            <Combobox
              async={true}
              queryKey={["sectors"]}
              queryFn={querySectors}
              initialOptions={initialOptions}
              value={field.value ?? ""}
              onValueChange={field.onChange}
              placeholder="Selecione um setor"
              emptyText="Nenhum setor encontrado"
              disabled={disabled}
              clearable={true}
              searchable={true}
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
