import { useMemo, useCallback, useState } from 'react';
import { Combobox } from '@/components/ui/combobox';
import { getCustomers, quickCreateCustomer } from '@/api-client/customer';
import { CustomerLogoDisplay } from '@/components/ui/avatar-display';
import { formatCNPJ } from '@/utils';
import { useCnpjAutocomplete } from '@/hooks/common/use-cnpj-autocomplete';
import type { Customer } from '@/types/customer';

interface CustomerComboboxProps {
  value?: string | null;
  onValueChange: (customerId: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  initialCustomer?: Customer;
  label?: string;
}

export function CustomerCombobox({
  value,
  onValueChange,
  disabled = false,
  placeholder = 'Selecione uma empresa',
  initialCustomer,
}: CustomerComboboxProps) {
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  const {
    isLookingUp,
    getCreateLabel,
    buildCustomerData,
    processInput,
    reset: resetCnpjState,
  } = useCnpjAutocomplete();

  const initialCustomerOptions = useMemo(
    () => (initialCustomer ? [initialCustomer] : []),
    [initialCustomer?.id],
  );

  const getCustomerOptionLabel = useCallback(
    (customer: Customer) => customer.fantasyName,
    [],
  );
  const getCustomerOptionValue = useCallback(
    (customer: Customer) => customer.id,
    [],
  );

  const searchCustomers = useCallback(
    async (
      search?: string,
      page: number = 1,
    ): Promise<{
      data: Customer[];
      hasMore: boolean;
    }> => {
      if (search) {
        processInput(search);
      }

      const params: any = {
        orderBy: { fantasyName: 'asc' },
        page,
        take: 50,
        include: { logo: true },
      };

      if (search && search.trim()) {
        params.searchingFor = search.trim();
      }

      try {
        const response = await getCustomers(params);
        const customers = response.data || [];
        const hasMore = response.meta?.hasNextPage || false;
        return { data: customers, hasMore };
      } catch {
        return { data: [], hasMore: false };
      }
    },
    [processInput],
  );

  const handleCreateCustomer = useCallback(
    async (searchText: string): Promise<Customer> => {
      setIsCreatingCustomer(true);
      try {
        const customerData = buildCustomerData(searchText);
        const result = await quickCreateCustomer(customerData);
        if (result.success && result.data) {
          resetCnpjState();
          return result.data;
        }
        throw new Error('Failed to create customer');
      } finally {
        setIsCreatingCustomer(false);
      }
    },
    [buildCustomerData, resetCnpjState],
  );

  const dynamicCreateLabel = useCallback(
    (val: string) => getCreateLabel(val),
    [getCreateLabel],
  );

  return (
    <Combobox<Customer>
      value={value || ''}
      onValueChange={(newValue) => {
        const stringValue = Array.isArray(newValue) ? newValue[0] : newValue;
        onValueChange(stringValue || null);
        if (stringValue) {
          resetCnpjState();
        }
      }}
      placeholder={placeholder}
      emptyText={isLookingUp ? 'Buscando CNPJ...' : 'Nenhuma empresa encontrada'}
      searchPlaceholder="Pesquisar por nome ou CNPJ..."
      disabled={disabled || isCreatingCustomer}
      async={true}
      allowCreate={true}
      createLabel={dynamicCreateLabel}
      onCreate={handleCreateCustomer}
      isCreating={isCreatingCustomer || isLookingUp}
      queryKey={['customers', 'search', 'customer-combobox']}
      queryFn={searchCustomers}
      initialOptions={initialCustomerOptions}
      getOptionLabel={getCustomerOptionLabel}
      getOptionValue={getCustomerOptionValue}
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
              {customer.corporateName && (
                <span className="truncate">{customer.corporateName}</span>
              )}
              {customer.cnpj && (
                <>
                  {customer.corporateName && <span>&bull;</span>}
                  <span>{formatCNPJ(customer.cnpj)}</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      minSearchLength={0}
      pageSize={20}
      debounceMs={500}
      className="w-full"
    />
  );
}
