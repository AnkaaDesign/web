// apps/web/src/components/production/task/batch-edit/cells/customer-cell.tsx

import { useMemo, useCallback } from "react";
import { FormField, FormItem, FormControl } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { getCustomers } from "../../../../../api-client";
import type { Customer } from "../../../../../types";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { formatCNPJ } from "../../../../../utils";

interface CustomerCellProps {
  control: any;
  index: number;
  initialCustomer?: Customer | null;
}

export function CustomerCell({ control, index, initialCustomer }: CustomerCellProps) {
  // Memoize initial options to prevent infinite loops
  const initialOptions = useMemo(() =>
    initialCustomer ? [initialCustomer] : [],
    [initialCustomer?.id]
  );

  // Memoize callbacks
  const getOptionLabel = useCallback((customer: Customer) => customer.corporateName || customer.fantasyName, []);
  const getOptionValue = useCallback((customer: Customer) => customer.id, []);

  // Search function for Combobox
  const searchCustomers = useCallback(async (
    search: string,
    page: number = 1
  ): Promise<{ data: Customer[]; hasMore: boolean }> => {
    const params: any = {
      orderBy: { fantasyName: "asc" },
      page,
      take: 50,
      include: { logo: true },
    };

    if (search && search.trim()) {
      params.searchingFor = search.trim();
    }

    try {
      const response = await getCustomers(params);
      return {
        data: response.data || [],
        hasMore: response.meta?.hasNextPage || false,
      };
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
      return { data: [], hasMore: false };
    }
  }, []);

  return (
    <FormField
      control={control}
      name={`tasks.${index}.data.customerId`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Combobox<Customer>
              value={field.value || ""}
              onValueChange={(value) => field.onChange(value || null)}
              placeholder="Selecionar cliente"
              emptyText="Nenhum cliente encontrado"
              searchPlaceholder="Buscar cliente..."
              getOptionLabel={getOptionLabel}
              getOptionValue={getOptionValue}
              async={true}
              queryKey={["customers", "batch-edit-cell", index]}
              queryFn={searchCustomers}
              minSearchLength={0}
              initialOptions={initialOptions}
              renderOption={(customer: Customer) => (
                <div className="flex items-center gap-2">
                  <CustomerLogoDisplay
                    logo={customer.logo}
                    customerName={customer.corporateName || customer.fantasyName}
                    size="xs"
                    shape="rounded"
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-medium truncate">{customer.corporateName || customer.fantasyName}</span>
                    {customer.cnpj && (
                      <span className="text-xs text-foreground/60">{formatCNPJ(customer.cnpj)}</span>
                    )}
                  </div>
                </div>
              )}
              clearable
              searchable
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}
