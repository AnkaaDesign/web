import { useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ItemBrand } from "../../../../../types";
import { itemBrandUpdateSchema } from "../../../../../schemas";
import { useItemBrandBatchMutations } from "../../../../../hooks";
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
import { routes } from "../../../../../constants";
import { IconLoader, IconDeviceFloppy, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { TABLE_LAYOUT } from "@/components/ui/table-constants";

// Schema for batch edit form
const brandBatchEditSchema = z.object({
  brands: z.array(
    z.object({
      id: z.string(),
      data: itemBrandUpdateSchema,
    }),
  ),
});

type BrandBatchEditFormData = z.infer<typeof brandBatchEditSchema>;

interface BrandBatchEditTableProps {
  brands: ItemBrand[];
  onCancel: () => void;
}

export function BrandBatchEditTable({ brands, onCancel }: BrandBatchEditTableProps) {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { batchUpdateAsync } = useItemBrandBatchMutations();

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
    const allItems = brands.flatMap((brand) => brand.items || []);
    return allItems.map((item) => ({
      value: item.id,
      label: item.name,
      unicode: item.uniCode || undefined,
      brand: item.brand?.name,
      category: item.category?.name,
    }));
  }, [brands]);

  const form = useForm<BrandBatchEditFormData>({
    resolver: zodResolver(brandBatchEditSchema),
    mode: "onChange", // Validate on change for immediate feedback
    reValidateMode: "onChange", // Re-validate on change
    defaultValues: {
      brands: brands.map((brand) => ({
        id: brand.id,
        data: {
          name: brand.name,
          itemIds: brand.items?.map((item) => item.id) || [],
        },
      })),
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "brands",
  });

  const handleSubmit = async (data: BrandBatchEditFormData) => {
    const updateBrands = data.brands.map((brand) => ({
      id: brand.id,
      data: {
        ...brand.data,
        // Ensure itemIds is always an array, even if empty
        itemIds: brand.data.itemIds || [],
      },
    }));

    setIsSubmitting(true);
    try {
      const result = await batchUpdateAsync({ itemBrands: updateBrands });

      if (result) {
        const { totalSuccess = 0, totalFailed = 0 } = result.data || {};

        if (totalSuccess > 0) {
          toast.success(`${totalSuccess} ${totalSuccess === 1 ? "marca atualizada" : "marcas atualizadas"} com sucesso`);
        }

        if (totalFailed > 0) {
          toast.error(`${totalFailed} ${totalFailed === 1 ? "marca falhou" : "marcas falharam"} ao atualizar`);
        }

        if (totalFailed === 0) {
          navigate(routes.inventory.products.brands.list);
        }
      }
    } catch (error) {
      // Error is handled by the API client with detailed message
      console.error("Error updating brands in batch:", error);
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
              <CardTitle>Editar Marcas em Lote</CardTitle>
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
        <CardContent className="p-6 flex-1 overflow-hidden flex flex-col">
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <h3 className="text-sm font-medium text-foreground">
                Editando {brands.length} {brands.length === 1 ? "marca selecionada" : "marcas selecionadas"}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">As alterações serão aplicadas a todas as marcas listadas abaixo</p>
          </div>
          <div className="rounded-lg border border-border overflow-hidden flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto overflow-x-auto">
              <Table className={cn("w-full [&>div]:border-0 [&>div]:rounded-none", TABLE_LAYOUT.tableLayout)}>
                <TableHeader className="[&_tr]:border-b-0 [&_tr]:hover:bg-muted sticky top-0 z-10">
                  <TableRow className="bg-muted hover:bg-muted even:bg-muted">
                    <TableHead
                      className={cn(
                        "whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-[350px] min-w-[350px]",
                        TABLE_LAYOUT.firstDataColumn.className,
                      )}
                    >
                      <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                        <span>Nome da Marca</span>
                      </div>
                    </TableHead>
                    <TableHead className={cn("whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted !border-r-0 p-0 w-[450px] min-w-[450px]")}>
                      <div className="flex items-center h-full min-h-[2.5rem] px-4 py-2">
                        <span>Produtos Associados</span>
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
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
                        <TableCell className={cn("p-0 !border-r-0 w-[350px] min-w-[350px]", TABLE_LAYOUT.firstDataColumn.className)}>
                          <div className="px-4 py-2">
                            <FormField
                              control={form.control}
                              name={`brands.${index}.data.name`}
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
                                      placeholder="Nome da marca"
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
                              name={`brands.${index}.data.itemIds`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Combobox
                                      mode="multiple"
                                      async={true}
                                      value={field.value || []}
                                      onValueChange={field.onChange}
                                      placeholder="Selecionar produtos para esta marca"
                                      emptyText="Nenhum produto encontrado"
                                      disabled={isSubmitting}
                                      className="h-8"
                                      queryFn={searchItems}
                                      formatDisplay="category"
                                      initialOptions={getInitialOptions()}
                                      queryKey={["brand-items", index]}
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
