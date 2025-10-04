import { useState, useMemo } from "react";
import { Combobox } from "@/components/ui/combobox";
import { useCustomersInfinite } from "../../../../hooks";
import type { Customer, CustomerGetManyResponse } from "../../../../types";
import { IconUser, IconBuilding } from "@tabler/icons-react";
import { formatCNPJ, formatCPF } from "../../../../utils";

interface CustomerSelectorProps {
  value?: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  excludeIds?: string[];
  onQuickCreate?: (name: string) => Promise<Customer | null>;
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
}: CustomerSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);

  // Fetch customers with infinite scrolling
  const { data } = useCustomersInfinite({
    orderBy: { fantasyName: "asc" },
  });

  // Flatten pages and filter out excluded IDs
  const customers = useMemo(() => {
    if (!data?.pages) return [];
    const allCustomers = data.pages.flatMap((page: CustomerGetManyResponse) => page.data || []);
    return excludeIds.length > 0 ? allCustomers.filter((customer: Customer) => !excludeIds.includes(customer.id)) : allCustomers;
  }, [data, excludeIds]);

  // Format options for combobox
  const options = useMemo(
    () =>
      customers.map((customer: Customer) => {
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
          icon: customer.cnpj ? <IconBuilding className="h-4 w-4" /> : <IconUser className="h-4 w-4" />,
        };
      }),
    [customers],
  );

  return (
    <Combobox
      value={value || undefined}
      onValueChange={(value) => onChange(value || null)}
      options={options}
      placeholder={placeholder}
      emptyText={emptyMessage}
      searchable={true}
      disabled={disabled || isCreating}
      className={className}
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
    />
  );
}
