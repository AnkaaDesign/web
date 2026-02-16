import { useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "react-router-dom";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { itemCategoryCreateSchema, itemCategoryUpdateSchema, type ItemCategoryCreateFormData, type ItemCategoryUpdateFormData } from "../../../../../schemas";
import { ITEM_CATEGORY_TYPE } from "../../../../../constants";
import { Combobox } from "@/components/ui/combobox";
import { apiClient } from "../../../../../api-client";
import { FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { serializeItemCategoryFormToUrlParams, debounce } from "@/utils/url-form-state";
import type { Item } from "../../../../../types";

// Import form components
import { NameInput } from "./name-input";
import { TypeSelector } from "./type-selector";

interface BaseCategoryFormProps {
  isSubmitting?: boolean;
  initialItems?: Item[];
}

interface CreateCategoryFormProps extends BaseCategoryFormProps {
  mode: "create";
  onSubmit: (data: ItemCategoryCreateFormData & { itemIds?: string[] }) => Promise<void>;
  defaultValues?: Partial<ItemCategoryCreateFormData>;
}

interface UpdateCategoryFormProps extends BaseCategoryFormProps {
  mode: "update";
  onSubmit: (data: ItemCategoryUpdateFormData & { itemIds?: string[] }) => Promise<void>;
  defaultValues?: Partial<ItemCategoryUpdateFormData>;
  categoryId?: string;
}

type CategoryFormProps = CreateCategoryFormProps | UpdateCategoryFormProps;

export function CategoryForm(props: CategoryFormProps) {
  const { isSubmitting, defaultValues, mode, initialItems } = props;
  const [searchParams, setSearchParams] = useSearchParams();

  // For create mode, merge URL params with provided defaults
  const createDefaults: ItemCategoryCreateFormData & { itemIds?: string[] } = {
    name: "",
    type: ITEM_CATEGORY_TYPE.REGULAR,
    itemIds: [],
    ...defaultValues,
  };

  // Create a unified form that works for both modes
  const form = useForm<ItemCategoryCreateFormData | ItemCategoryUpdateFormData>({
    resolver: zodResolver(mode === "create" ? itemCategoryCreateSchema : itemCategoryUpdateSchema),
    defaultValues: mode === "create" ? createDefaults : { ...defaultValues, itemIds: defaultValues?.itemIds || [] },
    mode: "onChange", // Validate on change for immediate feedback
    reValidateMode: "onChange", // Re-validate on change
  });

  // Debounced function to update URL parameters
  const debouncedUpdateUrl = useMemo(
    () =>
      debounce((formData: Partial<ItemCategoryCreateFormData>) => {
        if (mode === "create") {
          // Clean up empty/null/undefined values before serializing
          const cleanedData = Object.entries(formData).reduce((acc, [key, value]) => {
            // Keep the value if it's not null, undefined, or empty string
            if (value !== null && value !== undefined && value !== "") {
              acc[key as keyof ItemCategoryCreateFormData] = value as any;
            }
            return acc;
          }, {} as Partial<ItemCategoryCreateFormData>);

          const params = serializeItemCategoryFormToUrlParams(cleanedData);
          const currentParams = new URLSearchParams(searchParams);

          // Only update if params have actually changed
          if (params.toString() !== currentParams.toString()) {
            setSearchParams(params, { replace: true });
          }
        }
      }, 1000),
    [mode, setSearchParams, searchParams],
  );

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedUpdateUrl.cancel();
    };
  }, [debouncedUpdateUrl]);

  // Watch form values and update URL
  useEffect(() => {
    if (mode === "create") {
      const subscription = form.watch((values) => {
        debouncedUpdateUrl(values as Partial<ItemCategoryCreateFormData>);
      });

      return () => subscription.unsubscribe();
    }
  }, [form, debouncedUpdateUrl, mode]);

  // Reset form when defaultValues change (for update mode)
  useEffect(() => {
    if (mode === "update" && defaultValues) {
      form.reset({ ...defaultValues, itemIds: defaultValues.itemIds || [] });
    }
  }, [mode, defaultValues, form]);

  const handleSubmit = async (data: ItemCategoryCreateFormData | ItemCategoryUpdateFormData) => {
    try {
      if (mode === "create") {
        await (props as CreateCategoryFormProps).onSubmit(data as ItemCategoryCreateFormData & { itemIds?: string[] });
        // Clear URL parameters on successful submission
        setSearchParams({}, { replace: true });
      } else {
        await (props as UpdateCategoryFormProps).onSubmit(data as ItemCategoryUpdateFormData & { itemIds?: string[] });
      }
    } catch (error) {
      // Error handling done by parent component
    }
  };

  const isRequired = mode === "create";

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
      response.data?.data?.map((item: { id: string; name: string; uniCode?: string; brand?: { name: string }; category?: { name: string } }) => ({
        value: item.id,
        label: item.name,
        unicode: item.uniCode,
        brand: item.brand?.name,
        category: item.category?.name,
      })) || []
    );
  }, []);

  // Create memoized initial options from initialItems
  // Use stable dependency by joining IDs to prevent unnecessary re-renders
  const initialOptions = useMemo(() => {
    if (!initialItems || initialItems.length === 0) {
      return [];
    }

    return initialItems.map((item) => ({
      value: item.id,
      label: item.name,
      unicode: item.uniCode || undefined,
      brand: item.brand?.name,
      category: item.category?.name,
    }));
  }, [initialItems?.map((i) => i.id).join(",")]);

  // Memoize the option label and value callbacks for stable references
  const getOptionLabel = useCallback((option: any) => option.label, []);
  const getOptionValue = useCallback((option: any) => option.value, []);

  return (
    <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden min-h-0">
        <Form {...form}>
          <form id="category-form" onSubmit={form.handleSubmit(handleSubmit)} className="container mx-auto max-w-4xl flex-1 flex flex-col overflow-y-auto space-y-6">
            {/* Hidden submit button for programmatic form submission */}
            <button type="submit" id="category-form-submit" className="hidden" aria-hidden="true" disabled={isSubmitting || !form.formState.isValid} />
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Informações da Categoria</CardTitle>
                <CardDescription>{mode === "create" ? "Preencha os dados para criar uma nova categoria" : "Atualize os dados da categoria"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <NameInput control={form.control} disabled={isSubmitting} required={isRequired} />

                  <TypeSelector control={form.control} disabled={isSubmitting} />
                </div>

                <FormField
                  control={form.control}
                  name="itemIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Produtos Associados</FormLabel>
                      <FormControl>
                        <Combobox
                          mode="multiple"
                          async={true}
                          value={field.value || []}
                          onValueChange={field.onChange}
                          placeholder="Selecione produtos para associar à categoria"
                          emptyText="Nenhum produto encontrado"
                          disabled={isSubmitting}
                          queryFn={searchItems}
                          formatDisplay="brand"
                          initialOptions={initialOptions}
                          minSearchLength={0}
                          getOptionLabel={getOptionLabel}
                          getOptionValue={getOptionValue}
                          queryKey={["category-form-items"]}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
