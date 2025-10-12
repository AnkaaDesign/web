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

  const fetchSuppliers = async (searchTerm: string) => {
    const response = await getSuppliers({
      page: 1,
      limit: 20,
      orderBy: { fantasyName: "asc" },
      where: searchTerm
        ? {
            OR: [
              { fantasyName: { contains: searchTerm, mode: "insensitive" } },
              { corporateName: { contains: searchTerm, mode: "insensitive" } },
              { cnpj: { contains: searchTerm } },
            ],
          }
        : undefined,
    });

    if (response.success && response.data) {
      // Add fetched suppliers to cache
      response.data.forEach((supplier: Supplier) => {
        cacheRef.current.set(supplier.id, supplier);
      });

      return response.data.map((supplier: Supplier) => ({
        value: supplier.id,
        label: supplier.fantasyName,
        description: supplier.corporateName || undefined,
      }));
    }

    return [];
  };

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
        toast.success("Fornecedor criado", `O fornecedor "${fantasyName}" foi criado com sucesso. Complete as informações restantes posteriormente.`);
        return result.data.id;
      }
    } catch (error) {
      toast.error("Erro ao criar fornecedor", "Não foi possível criar o fornecedor. Tente novamente.");
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
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
