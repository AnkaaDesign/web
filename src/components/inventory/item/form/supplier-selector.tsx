import { useState, useMemo, useRef, useCallback } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { useFormContext } from "react-hook-form";
import { useCreateSupplier } from "../../../../hooks";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";
import { toast } from "@/components/ui/sonner";
import { getSuppliers } from "../../../../api-client";
import { supplierKeys } from "../../../../hooks";
import type { Supplier } from "../../../../types";
import { IconTruck } from "@tabler/icons-react";
import { SupplierLogoDisplay } from "@/components/ui/avatar-display";
import { formatCNPJ } from "../../../../utils";

type FormData = ItemCreateFormData | ItemUpdateFormData;

interface SupplierSelectorProps {
  disabled?: boolean;
  initialSupplier?: Supplier;
}

export function ItemSupplierSelector({ disabled, initialSupplier }: SupplierSelectorProps) {
  const form = useFormContext<FormData>();
  const [isCreating, setIsCreating] = useState(false);
  const createSupplier = useCreateSupplier();

  // Create memoized initialOptions with stable dependency
  const initialOptions = useMemo(
    () =>
      initialSupplier
        ? [
            {
              value: initialSupplier.id,
              label: initialSupplier.fantasyName,
              description: initialSupplier.corporateName || undefined,
              logo: initialSupplier.logo,
            },
          ]
        : [],
    [initialSupplier?.id]
  );

  // Initialize cache with initial supplier
  const cacheRef = useRef<Map<string, Supplier>>(new Map());

  // Add initial supplier to cache on mount or when it changes
  useMemo(() => {
    if (initialSupplier) {
      cacheRef.current.set(initialSupplier.id, initialSupplier);
    }
  }, [initialSupplier?.id]);

  // Memoize getOptionLabel callback
  const getOptionLabel = useCallback((supplier: Supplier) => supplier.fantasyName, []);

  // Memoize getOptionValue callback
  const getOptionValue = useCallback((supplier: Supplier) => supplier.id, []);

  const fetchSuppliers = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const response = await getSuppliers({
        page: page,
        take: 50,
        orderBy: { fantasyName: "asc" },
        include: { logo: true },
        where: searchTerm && searchTerm.trim()
          ? {
              OR: [
                { fantasyName: { contains: searchTerm.trim(), mode: "insensitive" } },
                { corporateName: { contains: searchTerm.trim(), mode: "insensitive" } },
                { cnpj: { contains: searchTerm.trim() } },
              ],
            }
          : undefined,
      });

      const suppliers = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      // Add fetched suppliers to cache
      const options = suppliers.map((supplier: Supplier) => {
        const option = {
          value: supplier.id,
          label: supplier.fantasyName,
          description: supplier.corporateName || undefined,
          logo: supplier.logo,
        };
        cacheRef.current.set(supplier.id, supplier);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  const handleCreateSupplier = async (fantasyName: string) => {
    setIsCreating(true);
    try {
      const result = await createSupplier.mutateAsync({
        fantasyName,
        corporateName: fantasyName, // Using fantasyName as corporateName for simplicity
        address: "A definir",
        zipCode: "00000-000", // Default placeholder address
        city: "A definir", // Default placeholder city
      });

      if (result.success && result.data) {
        return result.data.id;
      }
    } catch (error) {
      console.error("Error creating supplier:", error);
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <FormField
      control={form.control}
      name="supplierId"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconTruck className="h-4 w-4" />
            Fornecedor
          </FormLabel>
          <FormControl>
            <Combobox
              value={field.value || ""}
              onValueChange={field.onChange}
              async={true}
              queryKey={["suppliers", "selector"]}
              queryFn={fetchSuppliers}
              initialOptions={initialOptions}
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
              placeholder="Pesquisar fornecedor..."
              emptyText="Nenhum fornecedor encontrado"
              searchPlaceholder="Digite o nome ou CNPJ..."
              disabled={disabled || isCreating}
              allowCreate={true}
              createLabel={(value) => `Criar fornecedor "${value}"`}
              onCreate={async (fantasyName) => {
                const newSupplierId = await handleCreateSupplier(fantasyName);
                if (newSupplierId) {
                  field.onChange(newSupplierId);
                }
              }}
              isCreating={isCreating}
              queryKeysToInvalidate={[supplierKeys.all]}
              renderOption={(option, isSelected) => (
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
              )}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
