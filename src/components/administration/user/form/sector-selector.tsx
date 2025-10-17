import { useMemo, useCallback } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { IconBuilding } from "@tabler/icons-react";
import { getSectors } from "../../../../api-client";
import { useFormContext } from "react-hook-form";
import type { Sector } from "../../../../types";

interface SectorSelectorProps {
  disabled?: boolean;
  required?: boolean;
  initialSector?: Sector;
}

export function SectorSelector({ disabled, required, initialSector }: SectorSelectorProps) {
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
      name="sectorId"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconBuilding className="h-4 w-4 text-muted-foreground" />
            Setor
            {required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox
              async={true}
              queryKey={["sectors"]}
              queryFn={querySectors}
              initialOptions={initialOptions}
              value={field.value ?? ""}
              onValueChange={field.onChange}
              placeholder="Selecione o setor do colaborador"
              emptyText="Nenhum setor encontrado"
              disabled={disabled}
              clearable={!required}
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
