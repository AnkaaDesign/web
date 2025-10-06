import { useState } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { IconCertificate } from "@tabler/icons-react";
import { useFormContext } from "react-hook-form";
import { useItemBrands, useItemBrandMutations } from "../../../../hooks";
import type { ItemCreateFormData, ItemUpdateFormData } from "../../../../schemas";
import { toast } from "@/components/ui/sonner";

type FormData = ItemCreateFormData | ItemUpdateFormData;

interface BrandSelectorProps {
  disabled?: boolean;
  required?: boolean;
}

export function ItemBrandSelector({ disabled, required }: BrandSelectorProps) {
  const form = useFormContext<FormData>();
  const [isCreating, setIsCreating] = useState(false);

  const {
    data: brands,
    isLoading,
    refetch,
  } = useItemBrands({
    orderBy: { name: "asc" },
  });

  const { createMutation } = useItemBrandMutations();

  const brandOptions =
    brands?.data?.map((brand) => ({
      value: brand.id,
      label: brand.name,
    })) || [];

  const handleCreateBrand = async (name: string) => {
    setIsCreating(true);
    try {
      const result = await createMutation.mutateAsync({
        data: {
          name,
        },
      });

      if (result.success && result.data) {
        toast.success("Marca criada", `A marca "${name}" foi criada com sucesso.`);

        // Refetch brands to update the list
        await refetch();

        // Return the newly created brand ID
        return result.data.id;
      }
    } catch (error) {
      toast.error("Erro ao criar marca", "Não foi possível criar a marca. Tente novamente.");
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <FormField
      control={form.control}
      name="brandId"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconCertificate className="h-4 w-4" />
            Marca {required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox
              value={field.value || undefined}
              onValueChange={field.onChange}
              options={brandOptions}
              placeholder="Selecione (opcional)"
              emptyText="Nenhuma marca encontrada"
              disabled={disabled || isLoading || isCreating}
              allowCreate={true}
              createLabel={(value) => `Criar marca "${value}"`}
              onCreate={async (name) => {
                const newBrandId = await handleCreateBrand(name);
                if (newBrandId) {
                  field.onChange(newBrandId);
                }
              }}
              isCreating={isCreating}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
