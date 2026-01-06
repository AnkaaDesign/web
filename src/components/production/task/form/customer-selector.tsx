import { useState, useMemo, useCallback } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { getCustomers, quickCreateCustomer } from "../../../../api-client";
import type { Customer } from "../../../../types";
import { formatCNPJ } from "../../../../utils";
import { cn } from "@/lib/utils";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { IconUser } from "@tabler/icons-react";

interface CustomerSelectorProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
  initialCustomer?: Customer;
}

export function CustomerSelector({ control, disabled, required, initialCustomer }: CustomerSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);

  // Memoize initialOptions to prevent infinite loop
  const initialOptions = useMemo(() => initialCustomer ? [initialCustomer] : [], [initialCustomer?.id]);

  // Memoize callbacks to prevent infinite loop
  const getOptionLabel = useCallback((customer: Customer) => customer.fantasyName, []);
  const getOptionValue = useCallback((customer: Customer) => customer.id, []);

  // Search function for Combobox - let the combobox handle state internally
  const searchCustomers = async (
    search: string,
    page: number = 1,
  ): Promise<{
    data: Customer[];
    hasMore: boolean;
  }> => {
    const params: any = {
      orderBy: { fantasyName: "asc" },
      page: page,
      take: 50,
      include: { logo: true },
    };

    // Only add search filter if there's a search term
    if (search && search.trim()) {
      params.searchingFor = search.trim();
    }

    try {
      const response = await getCustomers(params);
      const customers = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      return {
        data: customers,
        hasMore: hasMore,
      };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[CustomerSelector] Error fetching customers:', error);
      }
      return { data: [], hasMore: false };
    }
  };

  const handleCreateCustomer = async (fantasyName: string) => {
    setIsCreating(true);
    try {
      const result = await quickCreateCustomer({
        fantasyName,
      });

      if (result.success && result.data) {
        // Return the newly created customer for selection
        return result.data.id;
      }
    } catch (error) {
      // Error is handled by the API client
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <FormField
      control={control}
      name="customerId"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconUser className="h-4 w-4" />
            Cliente
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox<Customer>
              value={field.value || ""}
              onValueChange={(value) => {
                field.onChange(value);
              }}
              placeholder="Selecione um cliente"
              emptyText="Nenhum cliente encontrado"
              searchPlaceholder="Pesquisar clientes..."
              disabled={disabled || isCreating}
              async={true}
              allowCreate={true}
              createLabel={(value) => `Criar cliente "${value}"`}
              onCreate={async (fantasyName) => {
                const newCustomerId = await handleCreateCustomer(fantasyName);
                if (newCustomerId) {
                  field.onChange(newCustomerId);
                }
              }}
              isCreating={isCreating}
              queryKey={["customers", "search"]}
              queryFn={searchCustomers}
              initialOptions={initialOptions}
              getOptionLabel={getOptionLabel}
              getOptionValue={getOptionValue}
              renderOption={(customer, isSelected) => (
                <div className="flex items-center gap-3">
                  <CustomerLogoDisplay
                    logo={customer.logo}
                    customerName={customer.fantasyName}
                    size="sm"
                    shape="rounded"
                    className="flex-shrink-0"
                  />
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="font-medium truncate">{customer.fantasyName}</div>
                    <div className="flex items-center gap-2 text-sm truncate group-hover:text-white transition-colors">
                      {customer.corporateName && <span className="truncate">{customer.corporateName}</span>}
                      {customer.cnpj && (
                        <>
                          {customer.corporateName && <span>•</span>}
                          <span>{formatCNPJ(customer.cnpj)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
              loadMoreText="Carregar mais clientes"
              loadingMoreText="Carregando..."
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