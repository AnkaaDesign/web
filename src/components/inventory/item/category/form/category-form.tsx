import { useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "react-router-dom";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { itemCategoryCreateSchema, itemCategoryUpdateSchema, type ItemCategoryCreateFormData, type ItemCategoryUpdateFormData } from "../../../../../schemas";
import { ITEM_CATEGORY_TYPE } from "../../../../../constants";
import { Combobox } from "@/components/ui/combobox";
import { apiClient } from "../../../../../api-client";
import { FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { serializeItemCategoryFormToUrlParams, debounce } from "@/utils/url-form-state";
import type { Item, ItemCategory } from "../../../../../types";

// Import form components
import { NameInput } from "./name-input";
import { TypeSelector } from "./type-selector";
import { ParentCategorySelector } from "./parent-category-selector";
import { AccountingTypeSelector } from "./accounting-type-selector";

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
  const editingCategoryId = props.mode === "update" ? props.categoryId : undefined;
  const [searchParams, setSearchParams] = useSearchParams();

  // For create mode, merge URL params with provided defaults
  const createDefaults: ItemCategoryCreateFormData & { itemIds?: string[] } = {
    name: "",
    type: ITEM_CATEGORY_TYPE.REGULAR,
    categoryLevel: 1,
    parentId: null,
    itemIds: [],
    ...defaultValues,
  } as ItemCategoryCreateFormData & { itemIds?: string[] };

  // Create a unified form that works for both modes
  const form = useForm<ItemCategoryCreateFormData | ItemCategoryUpdateFormData>({
    resolver: zodResolver(mode === "create" ? itemCategoryCreateSchema : itemCategoryUpdateSchema),
    defaultValues: mode === "create" ? createDefaults : { ...defaultValues, itemIds: defaultValues?.itemIds || [] },
    mode: "onChange", // Validate on change for immediate feedback
    reValidateMode: "onChange", // Re-validate on change
  });

  // A category with a parent is a Subcategoria (level 2); otherwise a top-level Categoria (level 1).
  const watchedParentId = form.watch("parentId" as any) as string | undefined;
  const isSubcategory = !!watchedParentId;

  // Keep categoryLevel in sync with the presence of a parent so the API stores the right level.
  useEffect(() => {
    const nextLevel = isSubcategory ? 2 : 1;
    if ((form.getValues("categoryLevel" as any) as number | undefined) !== nextLevel) {
      form.setValue("categoryLevel" as any, nextLevel, { shouldDirty: true });
    }
    // Top-level categories own their accountingType; subcategories roll up the parent's, so we
    // clear the local value when switching back to top-level is not needed — rollup is applied on parent change.
  }, [isSubcategory, form]);

  // When a parent is chosen, roll up its accountingType onto this subcategory (read-only in the UI).
  const handleParentChange = (parent: ItemCategory | undefined) => {
    if (parent?.accountingType) {
      form.setValue("accountingType" as any, parent.accountingType, { shouldDirty: true, shouldValidate: true });
    }
  };

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
        // NOTE: onSubmit (the page handler) navigates away on success. Do NOT call
        // setSearchParams() afterwards — it resolves relative to the create route and
        // replaces the URL back to the form, cancelling the redirect.
        await (props as CreateCategoryFormProps).onSubmit(data as ItemCategoryCreateFormData & { itemIds?: string[] });
      } else {
        await (props as UpdateCategoryFormProps).onSubmit(data as ItemCategoryUpdateFormData & { itemIds?: string[] });
      }
    } catch (error) {
      // Error handling done by parent component
    }
  };

  const isRequired = mode === "create";

  // Function to search items from API (paginated for infinite scroll)
  const searchItems = useCallback(async (searchTerm: string, page = 1) => {
    const response = await apiClient.get("/items", {
      params: {
        searchingFor: searchTerm,
        include: {
          brand: true,
          category: true,
        },
        orderBy: { name: "asc" },
        page,
        take: 50,
      },
    });

    const items =
      response.data?.data?.map((item: { id: string; name: string; uniCode?: string; brand?: { name: string }; category?: { name: string } }) => ({
        value: item.id,
        label: item.name,
        unicode: item.uniCode,
        brand: item.brand?.name,
        category: item.category?.name,
      })) || [];

    return { data: items, hasMore: response.data?.meta?.hasNextPage || false };
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
    <Form {...form}>
      <form id="category-form" onSubmit={form.handleSubmit(handleSubmit)} className="container mx-auto max-w-4xl">
        {/* Hidden submit button for programmatic form submission */}
        <button type="submit" id="category-form-submit" className="hidden" aria-hidden="true" disabled={isSubmitting || !form.formState.isValid} />
        <div className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Informações da Categoria
              <Badge variant={isSubcategory ? "secondary" : "default"} className="text-xs">
                {isSubcategory ? "Nível 2 · Subcategoria" : "Nível 1 · Categoria"}
              </Badge>
            </CardTitle>
            <CardDescription>{mode === "create" ? "Preencha os dados para criar uma nova categoria" : "Atualize os dados da categoria"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NameInput control={form.control} disabled={isSubmitting} required={isRequired} />

              <TypeSelector control={form.control} disabled={isSubmitting} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ParentCategorySelector control={form.control} disabled={isSubmitting} excludeId={editingCategoryId} onParentChange={handleParentChange} />

              {/* Top-level categories pick their accounting type; subcategories roll up the parent's (read-only). */}
              <AccountingTypeSelector control={form.control} disabled={isSubmitting} readOnlyRollup={isSubcategory} />
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
        </div>
      </form>
    </Form>
  );
}
