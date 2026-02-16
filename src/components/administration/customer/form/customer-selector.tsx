import { useState, useMemo, useCallback } from "react";
import { Combobox } from "@/components/ui/combobox";
import { getCustomers } from "../../../../api-client";
import type { Customer } from "../../../../types";
import { formatCNPJ, formatCPF } from "../../../../utils";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";

interface CustomerSelectorProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  excludeIds?: string[];
  onQuickCreate?: (name: string) => Promise<Customer | null>;
  initialCustomer?: Customer;
}

export function CustomerSelector({
  value,
  onChange,
  disabled = false,
  placeholder = "Selecione um cliente",
  emptyMessage = "Nenhum cliente encontrado",
  className,
  excludeIds = [],
  onQuickCreate,
  initialCustomer,
}: CustomerSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);

  // Memoize initial options with proper formatting
  const initialOptions = useMemo(() => {
    if (!initialCustomer) return [];

    let description = "";
    if (initialCustomer.cnpj) {
      description = `CNPJ: ${formatCNPJ(initialCustomer.cnpj)}`;
    } else if (initialCustomer.cpf) {
      description = `CPF: ${formatCPF(initialCustomer.cpf)}`;
    }

    return [{
      value: initialCustomer.id,
      label: initialCustomer.fantasyName,
      description,
      icon: (
        <CustomerLogoDisplay
          logo={initialCustomer.logo}
          customerName={initialCustomer.fantasyName}
          size="xs"
          shape="rounded"
        />
      ),
    }];
  }, [initialCustomer]);

  // Async query function for the combobox
  const queryCustomers = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { fantasyName: "asc" },
        page: page,
        take: 50,
        include: { logo: true },
      };

      // Only add searchingFor if there's a search term
      if (searchTerm && searchTerm.trim()) {
        queryParams.searchingFor = searchTerm.trim();
      }

      const response = await getCustomers(queryParams);
      const customers = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      // Filter out excluded IDs
      const filteredCustomers = excludeIds.length > 0
        ? customers.filter((customer: Customer) => !excludeIds.includes(customer.id))
        : customers;

      // Convert customers to options format
      const options = filteredCustomers.map((customer: Customer) => {
        let description = "";
        if (customer.cnpj) {
          description = `CNPJ: ${formatCNPJ(customer.cnpj)}`;
        } else if (customer.cpf) {
          description = `CPF: ${formatCPF(customer.cpf)}`;
        }

        return {
          value: customer.id,
          label: customer.fantasyName,
          description,
          icon: (
            <CustomerLogoDisplay
              logo={customer.logo}
              customerName={customer.fantasyName}
              size="xs"
              shape="rounded"
            />
          ),
        };
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      console.error("Error fetching customers:", error);
      return {
        data: [],
        hasMore: false,
      };
    }
  }, [excludeIds]);

  return (
    <Combobox
      async={true}
      queryKey={["customers"]}
      queryFn={queryCustomers}
      initialOptions={initialOptions}
      value={value || undefined}
      onValueChange={(value) => {
        // Handle string | string[] | null | undefined -> string | null
        const normalizedValue = Array.isArray(value) ? value[0] : value;
        onChange(normalizedValue || null);
      }}
      placeholder={placeholder}
      emptyText={emptyMessage}
      searchable={true}
      disabled={disabled || isCreating}
      className={className}
      clearable={true}
      allowCreate={!!onQuickCreate && !isCreating}
      createLabel={(name: string) => `Criar cliente "${name}"`}
      onCreate={
        onQuickCreate
          ? async (name: string) => {
              setIsCreating(true);
              try {
                const newCustomer = await onQuickCreate(name);
                if (newCustomer) {
                  onChange(newCustomer.id);
                }
              } finally {
                setIsCreating(false);
              }
            }
          : undefined
      }
      isCreating={isCreating}
      minSearchLength={0}
      pageSize={50}
      debounceMs={300}
    />
  );
}
