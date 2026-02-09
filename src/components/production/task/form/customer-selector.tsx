import { useState, useMemo, useCallback } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { getCustomers, quickCreateCustomer } from "../../../../api-client";
import type { Customer } from "../../../../types";
import { formatCNPJ } from "../../../../utils";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { IconUser } from "@tabler/icons-react";
import { useCnpjAutocomplete } from "@/hooks/common/use-cnpj-autocomplete";

interface CustomerSelectorProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
  initialCustomer?: Customer;
  name?: string;
  label?: string;
  placeholder?: string;
}

export function CustomerSelector({ control, disabled, required, initialCustomer, name = "customerId", label = "Cliente", placeholder = "Selecione um cliente" }: CustomerSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);

  // CNPJ autocomplete integration - detects CNPJ input and fetches company data from Brasil API
  const {
    isLookingUp,
    getCreateLabel,
    buildCustomerData,
    processInput,
    reset: resetCnpjState,
  } = useCnpjAutocomplete();

  // Memoize initialOptions to prevent infinite loop
  const initialOptions = useMemo(() => initialCustomer ? [initialCustomer] : [], [initialCustomer?.id]);

  // Memoize callbacks to prevent infinite loop
  const getOptionLabel = useCallback((customer: Customer) => customer.fantasyName, []);
  const getOptionValue = useCallback((customer: Customer) => customer.id, []);

  // Search function for Combobox - let the combobox handle state internally
  const searchCustomers = useCallback(async (
    search: string,
    page: number = 1,
  ): Promise<{
    data: Customer[];
    hasMore: boolean;
  }> => {
    // Process input for CNPJ detection
    processInput(search);

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
      return { data: [], hasMore: false };
    }
  }, [processInput]);

  // Handle customer creation with CNPJ data support
  // Returns the full customer object so the combobox can add it to cache and select it
  const handleCreateCustomer = useCallback(async (searchText: string): Promise<Customer | undefined> => {
    setIsCreating(true);
    try {
      // Build customer data based on CNPJ lookup result
      const customerData = buildCustomerData(searchText);

      const result = await quickCreateCustomer(customerData);

      if (result.success && result.data) {
        // Reset CNPJ state after successful creation
        resetCnpjState();
        // Return the full customer object for the combobox to handle selection
        return result.data;
      }
    } catch (error) {
      // Error is handled by the API client
      throw error;
    } finally {
      setIsCreating(false);
    }
  }, [buildCustomerData, resetCnpjState]);

  // Dynamic create label based on CNPJ lookup state
  const dynamicCreateLabel = useCallback((value: string) => {
    return getCreateLabel(value);
  }, [getCreateLabel]);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconUser className="h-4 w-4" />
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox<Customer>
              value={field.value || ""}
              onValueChange={(value) => {
                field.onChange(value);
                // Reset CNPJ state when a customer is selected
                if (value) {
                  resetCnpjState();
                }
              }}
              placeholder={placeholder}
              emptyText={isLookingUp ? "Buscando CNPJ..." : "Nenhum cliente encontrado"}
              searchPlaceholder="Pesquisar por nome ou CNPJ..."
              disabled={disabled || isCreating}
              async={true}
              allowCreate={true}
              createLabel={dynamicCreateLabel}
              onCreate={handleCreateCustomer}
              isCreating={isCreating || isLookingUp}
              queryKey={["customers", "search", name]}
              queryFn={searchCustomers}
              initialOptions={initialOptions}
              getOptionLabel={getOptionLabel}
              getOptionValue={getOptionValue}
              renderOption={(customer, _isSelected) => (
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
              pageSize={20}  // Reduced for better performance
              debounceMs={500}  // Increased debounce
              loadOnMount={false}  // Enable lazy loading
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}