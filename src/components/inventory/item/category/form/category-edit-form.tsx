import { useEffect } from "react";
import { useEditForm } from "../../../../../hooks";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconLoader2 } from "@tabler/icons-react";
import type { ItemCategoryUpdateFormData } from "../../../../../schemas";
import type { ItemCategory } from "../../../../../types";
import { ParentCategorySelector } from "./parent-category-selector";
import { AccountingTypeSelector } from "./accounting-type-selector";

interface CategoryEditFormProps {
  category: ItemCategory;
  onSubmit: (changedData: Partial<ItemCategoryUpdateFormData>) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function CategoryEditForm({ category, onSubmit, onCancel, isSubmitting }: CategoryEditFormProps) {
  const { handleSubmitChanges, getChangedFields, ...form } = useEditForm<ItemCategoryUpdateFormData>({
    originalData: category,
    onSubmit,
  });

  // A category with a parent is a Subcategoria (level 2); otherwise a top-level Categoria (level 1).
  const watchedParentId = form.watch("parentId" as any) as string | undefined;
  const isSubcategory = !!watchedParentId;

  // Keep categoryLevel in sync with the presence of a parent.
  useEffect(() => {
    const nextLevel = isSubcategory ? 2 : 1;
    if ((form.getValues("categoryLevel" as any) as number | undefined) !== nextLevel) {
      form.setValue("categoryLevel" as any, nextLevel, { shouldDirty: true });
    }
  }, [isSubcategory, form]);

  // When a parent is chosen, roll up its accountingType (read-only).
  const handleParentChange = (parent: ItemCategory | undefined) => {
    if (parent?.accountingType) {
      form.setValue("accountingType" as any, parent.accountingType, { shouldDirty: true, shouldValidate: true });
    }
  };

  return (
    <Form {...(form as any)}>
      <form onSubmit={handleSubmitChanges()} className="space-y-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Editar Categoria
              <Badge variant={isSubcategory ? "secondary" : "default"} className="text-xs">
                {isSubcategory ? "Nível 2 · Subcategoria" : "Nível 1 · Categoria"}
              </Badge>
            </CardTitle>
            <CardDescription>Atualize os dados da categoria</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Categoria</FormLabel>
                  <FormControl>
                    <Input
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                      placeholder="Digite o nome da categoria"
                      autoFocus
                      transparent
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ParentCategorySelector control={form.control} disabled={isSubmitting} excludeId={category.id} onParentChange={handleParentChange} />

              {/* Top-level categories pick their accounting type; subcategories roll up the parent's (read-only). */}
              <AccountingTypeSelector control={form.control} disabled={isSubmitting} readOnlyRollup={isSubcategory} />
            </div>
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
