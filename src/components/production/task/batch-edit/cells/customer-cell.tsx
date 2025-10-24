// apps/web/src/components/production/task/batch-edit/cells/customer-cell.tsx

import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { getCustomers } from "../../../../../api-client";
import type { Customer } from "../../../../../types";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { formatCNPJ } from "../../../../../utils";

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
      include: { logo: true },
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
              renderOption={(customer: Customer) => (
                <div className="flex items-center gap-2">
                  <CustomerLogoDisplay
                    logo={customer.logo}
                    customerName={customer.fantasyName}
                    size="xs"
                    shape="rounded"
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-medium truncate">{customer.fantasyName}</span>
                    {customer.cnpj && (
                      <span className="text-xs text-foreground/60">{formatCNPJ(customer.cnpj)}</span>
                    )}
                  </div>
                </div>
              )}
              allowClear
              searchable
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
