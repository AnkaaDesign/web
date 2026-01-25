import { useCallback } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import type { OrderScheduleCreateFormData } from "../../../../schemas";
import { getSuppliers } from "../../../../api-client";
import type { Supplier } from "../../../../types";
import { SupplierLogoDisplay } from "@/components/ui/avatar-display";

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
      include: { logo: true },
      where: {
        isActive: true,
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
      { label: "Nenhum fornecedor selecionado", value: "_no_supplier", logo: null },
      ...suppliers.map((supplier: Supplier) => ({
        value: supplier.id,
        label: supplier.fantasyName,
        description: supplier.corporateName || undefined,
        logo: supplier.logo,
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
      name="supplierId"
      render={({ field }) => (
        <FormItem>
          <FormLabel className={required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>Fornecedor</FormLabel>
          <FormControl>
            <Combobox
              value={field.value || "_no_supplier"}
              onValueChange={(value) => field.onChange(value === "_no_supplier" ? undefined : value)}
              async={true}
              queryKey={["suppliers", "order-schedule"]}
              queryFn={fetchSuppliers}
              initialOptions={[{ label: "Nenhum fornecedor selecionado", value: "_no_supplier", logo: null }]}
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
              placeholder="Pesquisar fornecedor..."
              searchPlaceholder="Digite o nome ou CNPJ..."
              emptyText="Nenhum fornecedor encontrado"
              disabled={disabled}
              clearable={!required}
              searchable
              renderOption={(option, isSelected) => {
                if (option.value === "_no_supplier") {
                  return <span className="text-foreground/60 italic">{option.label}</span>;
                }
                return (
                  <div className="flex items-center gap-3 w-full">
                    <SupplierLogoDisplay
                      logo={(option as any).logo}
                      supplierName={option.label}
                      size="sm"
                      shape="rounded"
                      className="flex-shrink-0"
                    />
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="font-medium truncate">{option.label}</div>
                      {option.description && (
                        <div className="flex items-center gap-2 text-sm truncate group-hover:text-white transition-colors">
                          <span className="truncate">{option.description}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export default OrderScheduleSupplierSelector;
