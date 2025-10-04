// apps/web/src/components/production/task/batch-edit/cells/customer-cell.tsx

import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { getCustomers } from "../../../../../api-client";
import type { Customer } from "../../../../../types";

interface CustomerCellProps {
  control: any;
  index: number;
}

export function CustomerCell({ control, index }: CustomerCellProps) {
  // Search function for Combobox
  const searchCustomers = async (search: string): Promise<Customer[]> => {
    const params: any = {
      orderBy: { fantasyName: "asc" },
      take: 50,
    };

    if (search && search.trim()) {
      params.searchingFor = search.trim();
    }

    try {
      const response = await getCustomers(params);
      return response.data || [];
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
      return [];
    }
  };

  return (
    <FormField
      control={control}
      name={`tasks.${index}.data.customerId`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Combobox
              value={field.value || ""}
              onValueChange={(value) => field.onChange(value || null)}
              searchFunction={searchCustomers}
              placeholder="Selecionar cliente"
              emptyMessage="Nenhum cliente encontrado"
              searchPlaceholder="Buscar cliente..."
              getOptionLabel={(customer: Customer) => customer.fantasyName}
              getOptionValue={(customer: Customer) => customer.id}
              allowClear
              searchable
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
