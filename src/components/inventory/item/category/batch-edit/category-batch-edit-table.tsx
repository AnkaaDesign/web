import { useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ItemCategory } from "../../../../../types";
import { itemCategoryUpdateSchema } from "../../../../../schemas";
import { useItemCategoryBatchMutations } from "../../../../../hooks";
import { apiClient } from "../../../../../api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormControl } from "@/components/ui/form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Combobox } from "@/components/ui/combobox";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { routes, ITEM_CATEGORY_TYPE, ITEM_CATEGORY_TYPE_LABELS } from "../../../../../constants";
import { IconLoader, IconDeviceFloppy, IconX, IconShield } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";

// Schema for batch edit form
const categoryBatchEditSchema = z.object({
  categories: z.array(
    z.object({
      id: z.string(),
      data: itemCategoryUpdateSchema,
    }),
  ),
});

type CategoryBatchEditFormData = z.infer<typeof categoryBatchEditSchema>;

interface CategoryBatchEditTableProps {
  categories: ItemCategory[];
  onCancel: () => void;
}

export function CategoryBatchEditTable({ categories, onCancel }: CategoryBatchEditTableProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { batchUpdateAsync } = useItemCategoryBatchMutations();

  // Function to search items from API
  const searchItems = useCallback(async (searchTerm: string) => {
    const response = await apiClient.get("/items", {
      params: {
        searchingFor: searchTerm,
        include: {
          brand: true,
          category: true,
        },
        orderBy: { name: "asc" },
        limit: 50,
      },
    });

    return (
      response.data?.data?.map((item: any) => ({
        value: item.id,
        label: item.name,
        unicode: item.uniCode || undefined,
        brand: item.brand?.name,
        category: item.category?.name,
      })) || []
    );
  }, []);

  // Get initial options for already selected items
  const getInitialOptions = useCallback(() => {
    const allItems = categories.flatMap((cat) => cat.items || []);
    return allItems.map((item) => ({
      value: item.id,
      label: item.name,
      unicode: item.uniCode || undefined,
      brand: item.brand?.name,
      category: item.category?.name,
    }));
  }, [categories]);

  const form = useForm<CategoryBatchEditFormData>({
    resolver: zodResolver(categoryBatchEditSchema),
    mode: "onChange", // Validate on change for immediate feedback
    reValidateMode: "onChange", // Re-validate on change
    defaultValues: {
      categories: categories.map((category) => ({
        id: category.id,
        data: {
          name: category.name,
          type: category.type,
          itemIds: category.items?.map((item) => item.id) || [],
        },
      })),
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "categories",
  });

  const handleSubmit = async (data: CategoryBatchEditFormData) => {
    const updateCategories = data.categories.map((category) => ({
      id: category.id,
      data: {
        ...category.data,
        // Ensure itemIds is always an array, even if empty
        itemIds: category.data.itemIds || [],
      },
    }));

    setIsSubmitting(true);
    try {
      const result = await batchUpdateAsync({ itemCategories: updateCategories });

      if (result) {
        const { totalSuccess = 0, totalFailed = 0 } = result.data || {};

        if (totalSuccess > 0) {
          toast.success(`${totalSuccess} ${totalSuccess === 1 ? "categoria atualizada" : "categorias atualizadas"} com sucesso`);
        }

        if (totalFailed > 0) {
          toast.error(`${totalFailed} ${totalFailed === 1 ? "categoria falhou" : "categorias falharam"} ao atualizar`);
        }

        if (totalFailed === 0) {
          navigate(routes.inventory.products.categories.list);
        }
      }
    } catch (error) {
      toast.error("Erro ao atualizar categorias em lote");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <Card className="h-full flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Editar Categorias em Lote</CardTitle>
              <div className="mt-2">
                <Breadcrumb />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
                <IconX className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
              <Button onClick={form.handleSubmit(handleSubmit)} disabled={isSubmitting || !form.formState.isValid}>
                {isSubmitting ? (
                  <>
                    <IconLoader className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <IconDeviceFloppy className="mr-2 h-4 w-4" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 flex-1 overflow-hidden flex flex-col">
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <h3 className="text-sm font-medium text-foreground">
                Editando {categories.length} {categories.length === 1 ? "categoria selecionada" : "categorias selecionadas"}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">As alterações serão aplicadas a todas as categorias listadas abaixo</p>
          </div>
          <div className="rounded-lg border border-border flex flex-col flex-1 overflow-hidden">
            {/* Unified scrollable container with horizontal scroll */}
            <div className="flex-1 overflow-x-auto overflow-y-auto">
              <Table className={cn("w-full min-w-max [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
                {/* Sticky Header */}
                <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted sticky top-0 z-10">
                  <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                    <TableHead className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-[350px] min-w-[350px]")}>
                      <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                        <span>Nome da Categoria</span>
                      </div>
                    </TableHead>
                    <TableHead className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-[450px] min-w-[450px]")}>
                      <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                        <span>Produtos Associados</span>
                      </div>
                    </TableHead>
                    <TableHead className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-[120px] min-w-[120px]")}>
                      <div className="flex items-center justify-center h-full min-h-[2.5rem] px-4 py-2 gap-1">
                        <IconShield className="h-4 w-4" />
                        <span>Tipo</span>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>

                {/* Scrollable Body */}
                <TableBody>
                  {fields.map((field, index) => {
                    return (
                      <TableRow
                        key={field.id}
                        className={cn(
                          "transition-colors border-b border-border",
                          // Alternating row colors
                          index % 2 === 1 && "bg-muted/10",
                          // Hover state that works with alternating colors
                          "hover:bg-muted/20",
                        )}
                      >
                        <TableCell className={cn("p-0 !border-r-0 w-[350px] min-w-[350px]")}>
                          <div className="px-4 py-2">
                            <FormField
                              control={form.control}
                              name={`categories.${index}.data.name`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      value={field.value || ""}
                                      onChange={(value) => {
                                        field.onChange(value);
                                      }}
                                      name={field.name}
                                      onBlur={field.onBlur}
                                      ref={field.ref}
                                      className="h-8 border-muted-foreground/20 w-full"
                                      placeholder="Nome da categoria"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="p-0 !border-r-0 w-[450px] min-w-[450px]">
                          <div className="px-4 py-2">
                            <FormField
                              control={form.control}
                              name={`categories.${index}.data.itemIds`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Combobox
                                      mode="multiple"
                                      async={true}
                                      value={field.value || []}
                                      onValueChange={field.onChange}
                                      placeholder="Selecionar produtos para esta categoria"
                                      emptyText="Nenhum produto encontrado"
                                      disabled={isSubmitting}
                                      className="h-8"
                                      queryFn={searchItems}
                                      formatDisplay="brand"
                                      initialOptions={getInitialOptions()}
                                      queryKey={["category-items", index]}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="p-0 !border-r-0 w-[120px] min-w-[120px]">
                          <div className="flex items-center justify-center px-2 py-2">
                            <FormField
                              control={form.control}
                              name={`categories.${index}.data.type`}
                              render={({ field }) => (
                                <FormItem className="w-full">
                                  <FormControl>
                                    <Combobox
                                      onValueChange={field.onChange}
                                      value={field.value}
                                      options={Object.values(ITEM_CATEGORY_TYPE).map((type) => ({
                                        label: ITEM_CATEGORY_TYPE_LABELS[type],
                                        value: type,
                                      }))}
                                      placeholder="Selecione o tipo"
                                      searchPlaceholder="Buscar tipo..."
                                      className="h-8 text-xs"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </Form>
  );
}
