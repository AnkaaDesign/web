import { useEditForm } from "../../../../../hooks";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconLoader2 } from "@tabler/icons-react";
import { itemBrandUpdateSchema, type ItemBrandUpdateFormData } from "../../../../../schemas";
import type { ItemBrand } from "../../../../../types";
import { zodResolver } from "@hookform/resolvers/zod";

interface BrandEditFormProps {
  brand: ItemBrand;
  onSubmit: (changedData: Partial<ItemBrandUpdateFormData>) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function BrandEditForm({ brand, onSubmit, onCancel, isSubmitting }: BrandEditFormProps) {
  const { handleSubmitChanges, getChangedFields, ...form } = useEditForm<ItemBrandUpdateFormData, any, ItemBrand>({
    resolver: zodResolver(itemBrandUpdateSchema),
    originalData: brand,
    onSubmit,
  });

  const formWithHandleSubmit = {
    ...form,
    handleSubmit: handleSubmitChanges,
  };

  return (
    <Form {...formWithHandleSubmit}>
      <form onSubmit={handleSubmitChanges()} className="space-y-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Editar Marca</CardTitle>
            <CardDescription>Atualize os dados da marca</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Marca</FormLabel>
                  <FormControl>
                    <Input value={field.value} onChange={field.onChange} onBlur={field.onBlur} name={field.name} ref={field.ref} placeholder="Digite o nome da marca" autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting || Object.keys(getChangedFields()).length === 0}>
            {isSubmitting && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Alterações
          </Button>
        </div>
      </form>
    </Form>
  );
}
