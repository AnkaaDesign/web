import { useState } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { getCustomers, quickCreateCustomer } from "../../../../api-client";
import type { Customer } from "../../../../types";
import { formatCNPJ } from "../../../../utils";
import { cn } from "@/lib/utils";

interface CustomerSelectorProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
  initialCustomer?: Customer;
}

export function CustomerSelector({ control, disabled, required, initialCustomer }: CustomerSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);

  // Search function for Combobox - let the combobox handle state internally
  const searchCustomers = async (
    search: string,
    page: number = 1,
  ): Promise<{
    data: Customer[];
    hasMore: boolean;
  }> => {
    console.log('[CustomerSelector] searchCustomers called:', { search, page });

    const params: any = {
      orderBy: { fantasyName: "asc" },
      page: page,
      take: 20,
    };

    // Only add search filter if there's a search term
    if (search && search.trim()) {
      params.searchingFor = search.trim();
    }

    console.log('[CustomerSelector] API params:', params);

    try {
      const response = await getCustomers(params);
      console.log('[CustomerSelector] API response:', {
        dataLength: response.data?.length,
        hasMore: response.meta?.hasNextPage,
        firstItem: response.data?.[0],
      });

      const customers = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      return {
        data: customers,
        hasMore: hasMore,
      };
    } catch (error) {
      console.error('[CustomerSelector] Error fetching customers:', error);
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
          <FormLabel>
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
              initialOptions={initialCustomer ? [initialCustomer] : []}
              getOptionLabel={(customer) => customer.fantasyName}
              getOptionValue={(customer) => customer.id}
              renderOption={(customer, isSelected) => (
                <div className="flex flex-col gap-1">
                  <div className="font-medium">{customer.fantasyName}</div>
                  <div className={cn(
                    "flex items-center gap-2 text-sm",
                    isSelected ? "text-accent-foreground/80" : "text-muted-foreground group-hover:text-accent-foreground/80"
                  )}>
                    {customer.corporateName && <span>{customer.corporateName}</span>}
                    {customer.cnpj && (
                      <>
                        {customer.corporateName && <span>•</span>}
                        <span>{formatCNPJ(customer.cnpj)}</span>
                      </>
                    )}
                  </div>
                </div>
              )}
              loadMoreText="Carregar mais clientes"
              loadingMoreText="Carregando..."
              minSearchLength={0}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}