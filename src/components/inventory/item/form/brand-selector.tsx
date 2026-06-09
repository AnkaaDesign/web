import { useState, useMemo, useRef, useCallback } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { IconCertificate } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import { useItemBrandMutations } from "../../../../hooks";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";
import type { ItemBrand } from "../../../../types";
import { getItemBrands } from "../../../../api-client";

type FormData = ItemCreateFormData | ItemUpdateFormData;

interface BrandSelectorProps {
  disabled?: boolean;
  required?: boolean;
  initialBrands?: ItemBrand[];
}

export function ItemBrandSelector({ disabled, required, initialBrands }: BrandSelectorProps) {
  const form = useFormContext<FormData>();
  const [isCreating, setIsCreating] = useState(false);
  const { createMutation } = useItemBrandMutations();

  // Stable key for the initial brands dependency
  const initialBrandsKey = (initialBrands ?? []).map((b) => b.id).join(",");

  // Create memoized initialOptions with stable dependency
  const initialOptions = useMemo(
    () =>
      (initialBrands ?? []).map((brand) => ({
        value: brand.id,
        label: brand.name,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialBrandsKey]
  );

  // Initialize cache with initial brands
  const cacheRef = useRef<Map<string, ItemBrand>>(new Map());

  // Add initial brands to cache on mount or when they change
  useMemo(() => {
    (initialBrands ?? []).forEach((brand) => {
      cacheRef.current.set(brand.id, brand);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBrandsKey]);

  const fetchBrands = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const response = await getItemBrands({
        page: page,
        take: 50,
        orderBy: { name: "asc" },
        where: searchTerm && searchTerm.trim()
          ? {
              name: { contains: searchTerm.trim(), mode: "insensitive" },
            }
          : undefined,
      });

      const brands = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      // Add fetched brands to cache
      const options = brands.map((brand: ItemBrand) => {
        const option = {
          value: brand.id,
          label: brand.name,
        };
        cacheRef.current.set(brand.id, brand);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching brands:", error);
      }
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  const handleCreateBrand = async (name: string) => {
    setIsCreating(true);
    try {
      const result = await createMutation.mutateAsync({
        data: {
          name,
        },
      });

      if (result.success && result.data) {
        return result.data.id;
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error creating brand:", error);
      }
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <FormField
      control={form.control}
      name="brandIds"
      render={({ field }) => {
        const selectedValues: string[] = Array.isArray(field.value) ? field.value : [];

        // In multiple mode the combobox emits an array, but the internal
        // create flow emits a single string — coerce both into the array.
        const handleValueChange = (value: string | string[] | null | undefined) => {
          if (Array.isArray(value)) {
            field.onChange(value);
          } else if (typeof value === "string" && value) {
            field.onChange(selectedValues.includes(value) ? selectedValues : [...selectedValues, value]);
          } else {
            field.onChange([]);
          }
        };

        return (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <IconCertificate className="h-4 w-4" />
              Marcas {required && <span className="text-destructive">*</span>}
            </FormLabel>
            <FormControl>
              <Combobox
                mode="multiple"
                value={selectedValues}
                onValueChange={handleValueChange}
                async={true}
                queryKey={["item-brands", "selector"]}
                queryFn={fetchBrands}
                initialOptions={initialOptions}
                minSearchLength={0}
                pageSize={50}
                debounceMs={300}
                placeholder="Pesquisar marcas..."
                emptyText="Nenhuma marca encontrada"
                searchPlaceholder="Digite o nome da marca..."
                disabled={disabled || isCreating}
                allowCreate={true}
                createLabel={(value) => `Criar marca "${value}"`}
                onCreate={async (name) => {
                  const newBrandId = await handleCreateBrand(name);
                  if (newBrandId) {
                    field.onChange(selectedValues.includes(newBrandId) ? selectedValues : [...selectedValues, newBrandId]);
                  }
                }}
                isCreating={isCreating}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
