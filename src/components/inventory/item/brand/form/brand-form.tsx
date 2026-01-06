import { useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "react-router-dom";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { itemBrandCreateSchema, itemBrandUpdateSchema, type ItemBrandCreateFormData, type ItemBrandUpdateFormData } from "../../../../../schemas";
import { Combobox } from "@/components/ui/combobox";
import { apiClient } from "../../../../../api-client";
import { FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { serializeItemBrandFormToUrlParams, deserializeUrlParamsToItemBrandForm, debounce } from "@/utils/url-form-state";

// Import form components
import { NameInput } from "./name-input";
import type { Item } from "../../../../../types";

interface BaseBrandFormProps {
  isSubmitting?: boolean;
  initialItems?: Item[];
}

interface CreateBrandFormProps extends BaseBrandFormProps {
  mode: "create";
  onSubmit: (data: ItemBrandCreateFormData & { itemIds?: string[] }) => Promise<void>;
  defaultValues?: Partial<ItemBrandCreateFormData>;
}

interface UpdateBrandFormProps extends BaseBrandFormProps {
  mode: "update";
  onSubmit: (data: ItemBrandUpdateFormData & { itemIds?: string[] }) => Promise<void>;
  defaultValues?: Partial<ItemBrandUpdateFormData>;
  currentItemIds?: string[];
}

type BrandFormProps = CreateBrandFormProps | UpdateBrandFormProps;

export function BrandForm(props: BrandFormProps) {
  const { isSubmitting, defaultValues, mode, initialItems } = props;
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL parameters (only in create mode)
  const initialUrlState = mode === "create" ? deserializeUrlParamsToItemBrandForm(searchParams) : {};

  // Default values for create mode - merge URL params with defaults
  const createDefaults: ItemBrandCreateFormData = {
    name: "",
    itemIds: [],
    ...defaultValues,
    ...(mode === "create" ? initialUrlState : {}),
  };

  // Create a unified form that works for both modes
  const form = useForm({
    resolver: zodResolver(mode === "create" ? itemBrandCreateSchema : itemBrandUpdateSchema),
    defaultValues: mode === "create" ? createDefaults : defaultValues,
    mode: "onChange", // Validate on change for immediate feedback
    reValidateMode: "onChange", // Re-validate on change
  });

  // Debounced function to update URL parameters
  const debouncedUpdateUrl = useMemo(
    () =>
      debounce((formData: Partial<ItemBrandCreateFormData>) => {
        if (mode === "create") {
          // Clean up empty/null/undefined values before serializing
          const cleanedData = Object.entries(formData).reduce((acc, [key, value]) => {
            // Keep the value if it's not null, undefined, or empty string
            if (value !== null && value !== undefined && value !== "") {
              acc[key as keyof ItemBrandCreateFormData] = value;
            }
            return acc;
          }, {} as Partial<ItemBrandCreateFormData>);

          const params = serializeItemBrandFormToUrlParams(cleanedData);
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
        // Filter out undefined values and ensure proper type handling
        const filteredValues: Partial<ItemBrandCreateFormData> = {};

        if (values.name !== undefined) {
          filteredValues.name = values.name;
        }

        if (values.itemIds !== undefined) {
          // Ensure itemIds is an array of strings and filter out any undefined values
          filteredValues.itemIds = Array.isArray(values.itemIds) ? values.itemIds.filter((id): id is string => typeof id === "string" && id !== undefined) : [];
        }

        debouncedUpdateUrl(filteredValues);
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

  // Create memoized initial options from initialItems prop
  // Use stable dependency to prevent unnecessary re-renders
  const initialOptions = useMemo(() => {
    if (!initialItems || initialItems.length === 0) return [];

    return initialItems.map((item) => ({
      value: item.id,
      label: item.name,
      unicode: item.uniCode,
      brand: item.brand?.name,
      category: item.category?.name,
    }));
  }, [initialItems?.map((i) => i.id).join(",")]);

  // Memoize getOptionLabel callback
  const getOptionLabel = useCallback((option: any) => option.label, []);

  // Memoize getOptionValue callback
  const getOptionValue = useCallback((option: any) => option.value, []);

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
        unicode: item.uniCode,
        brand: item.brand?.name,
        category: item.category?.name,
      })) || []
    );
  }, []);

  const handleSubmit = async (data: any) => {
    try {
      // Get the selected item IDs from the form
      const itemIds = form.getValues("itemIds");

      if (mode === "create") {
        await (props as CreateBrandFormProps).onSubmit({ ...data, itemIds });
      } else {
        await (props as UpdateBrandFormProps).onSubmit({ ...data, itemIds });
      }
    } catch (error) {
      // Error handling done by parent component
    }
  };

  const isRequired = mode === "create";

  return (
    <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden min-h-0">
        <Form {...form}>
          <form id="brand-form" onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 flex flex-col overflow-y-auto space-y-6">
            {/* Hidden submit button for programmatic form submission */}
            <button type="submit" id="brand-form-submit" className="hidden" aria-hidden="true" disabled={isSubmitting || !form.formState.isValid} />
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Informações da Marca</CardTitle>
                <CardDescription>{mode === "create" ? "Preencha os dados para criar uma nova marca" : "Atualize os dados da marca"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <NameInput control={form.control} disabled={isSubmitting} required={isRequired} />

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
                          placeholder="Selecione produtos para associar à marca"
                          emptyText="Nenhum produto encontrado"
                          queryKey={["brand-form-items"]}
                          disabled={isSubmitting}
                          queryFn={searchItems}
                          formatDisplay="category"
                          initialOptions={initialOptions}
                          minSearchLength={0}
                          getOptionLabel={getOptionLabel}
                          getOptionValue={getOptionValue}
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
