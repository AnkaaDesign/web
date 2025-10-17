import { useCallback } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import type { OrderScheduleCreateFormData } from "../../../../schemas";
import { getSuppliers } from "../../../../api-client";
import { SUPPLIER_STATUS } from "../../../../constants";
import type { Supplier } from "../../../../types";

interface SupplierSelectorProps {
  control: any;
  disabled?: boolean;
  required?: boolean;
}

export function OrderScheduleSupplierSelector({ control, disabled = false, required = false }: SupplierSelectorProps) {
  const fetchSuppliers = useCallback(async (searchTerm: string, page: number = 1) => {
    const pageSize = 50;
    const response = await getSuppliers({
      page: page,
      take: pageSize,
      where: {
        status: SUPPLIER_STATUS.ACTIVE,
        ...(searchTerm
          ? {
              OR: [
                { fantasyName: { contains: searchTerm, mode: "insensitive" } },
                { corporateName: { contains: searchTerm, mode: "insensitive" } },
                { cnpj: { contains: searchTerm } },
              ],
            }
          : {}),
      },
      orderBy: { fantasyName: "asc" },
    });

    const suppliers = response.data || [];
    const total = response.total || 0;
    const hasMore = (page * pageSize) < total;

    const options = [
      { label: "Nenhum fornecedor selecionado", value: "_no_supplier" },
      ...suppliers.map((supplier: Supplier) => ({
        value: supplier.id,
        label: supplier.fantasyName,
        description: supplier.corporateName || undefined,
      })),
    ];

    return {
      data: options,
      hasMore: hasMore,
      total: total + 1, // +1 for the "_no_supplier" option
    };
  }, []);

  return (
    <FormField
      control={control}
      name="items" // TODO: Fix this - supplierId doesn't exist in OrderScheduleCreateFormData
      render={({ field }) => (
        <FormItem>
          <FormLabel className={required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>Fornecedor</FormLabel>
          <FormControl>
            <Combobox
              value={Array.isArray(field.value) && field.value.length > 0 ? field.value[0] : "_no_supplier"}
              onValueChange={(value) => field.onChange(value === "_no_supplier" ? [] : [value])}
              async={true}
              queryKey={["suppliers", "order-schedule"]}
              queryFn={fetchSuppliers}
              initialOptions={[{ label: "Nenhum fornecedor selecionado", value: "_no_supplier" }]}
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
              placeholder="Pesquisar fornecedor..."
              searchPlaceholder="Digite o nome ou CNPJ..."
              emptyText="Nenhum fornecedor encontrado"
              disabled={disabled}
              clearable={!required}
              searchable
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export default OrderScheduleSupplierSelector;
