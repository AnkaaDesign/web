import React, { useState, useEffect, useMemo, useRef } from "react";
import { useForm, useFieldArray, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "react-router-dom";
import { FormInput } from "@/components/ui/form-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { itemCreateSchema, itemUpdateSchema, type ItemCreateFormData, type ItemUpdateFormData } from "../../../../schemas";
import { useItemCategories } from "../../../../hooks";
import { ITEM_CATEGORY_TYPE } from "../../../../constants";
import { serializeItemFormToUrlParams, debounce } from "@/utils/url-form-state";
import type { Supplier, ItemBrand, ItemCategory } from "../../../../types";
// import { FormValidationDebugger } from "@/components/debug/form-validation-debugger"; // Debug component removed

// Import all form components
import { NameInput } from "./name-input";
import { UnicodeInput } from "./unicode-input";
import { StatusToggle } from "./status-toggle";
import { ItemBrandSelector } from "./brand-selector";
import { CategorySelector } from "./category-selector";
import { ItemSupplierSelector } from "./supplier-selector";
import { QuantityInput } from "./quantity-input";
import { MaxQuantityInput } from "./max-quantity-input";
import { BoxQuantityInput } from "./box-quantity-input";
import { LeadTimeInput } from "./lead-time-input";
import { PriceInput } from "./price-input";
import { MeasureInput } from "./measure-input";
import { BarcodeManager } from "./barcode-manager";
import { AssignToUserToggle } from "./assign-to-user-toggle";
import { PpeConfigSection } from "./ppe-config-section";

interface BaseItemFormProps {
  isSubmitting?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onFormStateChange?: (formState: { isValid: boolean; isDirty: boolean }) => void;
  initialSupplier?: Supplier;
  initialBrand?: ItemBrand;
  initialCategory?: ItemCategory;
}

interface CreateItemFormProps extends BaseItemFormProps {
  mode: "create";
  onSubmit: (data: ItemCreateFormData) => Promise<void>;
  defaultValues?: Partial<ItemCreateFormData>;
}

interface UpdateItemFormProps extends BaseItemFormProps {
  mode: "update";
  onSubmit: (data: ItemUpdateFormData) => Promise<void>;
  defaultValues?: Partial<ItemUpdateFormData>;
}

type ItemFormProps = CreateItemFormProps | UpdateItemFormProps;

export function ItemForm(props: ItemFormProps) {
  const { isSubmitting, defaultValues, mode, onFormStateChange, onDirtyChange, initialSupplier, initialBrand, initialCategory } = props;
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(defaultValues?.categoryId || undefined);
  const [isPPE, setIsPPE] = useState(false);

  // Default values for create mode
  const createDefaults: ItemCreateFormData = {
    name: "",
    uniCode: null,
    quantity: 0,
    reorderPoint: null,
    reorderQuantity: null,
    maxQuantity: null,
    boxQuantity: null,
    tax: undefined,
    measures: [], // Initialize with empty measures array
    barcodes: [],
    shouldAssignToUser: true,
    abcCategory: null,
    xyzCategory: null,
    brandId: undefined,
    categoryId: undefined,
    supplierId: null,
    estimatedLeadTime: 30,
    isActive: true,
    price: undefined,
    // PPE fields
    ppeType: null,
    ppeCA: null,
    ppeDeliveryMode: null,
    ppeStandardQuantity: null,
    ppeAutoOrderMonths: null,
    ...defaultValues,
  };

  // Ensure defaultValues has barcodes and measures as arrays for update mode
  const processedDefaultValues =
    mode === "update" && defaultValues
      ? {
          ...defaultValues,
          barcodes: Array.isArray(defaultValues.barcodes) ? defaultValues.barcodes : [],
          measures: Array.isArray(defaultValues.measures) ? defaultValues.measures : [],
        }
      : defaultValues;

  // Create a unified form that works for both modes
  const form = useForm({
    resolver: zodResolver(mode === "create" ? itemCreateSchema : itemUpdateSchema),
    defaultValues: mode === "create" ? createDefaults : processedDefaultValues,
    mode: "onTouched", // Validate only after field is touched to avoid premature validation
    reValidateMode: "onChange", // After first validation, check on every change
    shouldFocusError: true, // Focus on first error field when validation fails
    criteriaMode: "all", // Show all errors for better UX
  });

  // useFieldArray for measures
  const measuresFieldArray = useFieldArray({
    control: form.control,
    name: "measures",
  });

  // Debounced function to update URL parameters
  const debouncedUpdateUrl = useMemo(
    () =>
      debounce((formData: Partial<ItemCreateFormData>) => {
        if (mode === "create") {
          // Clean up empty/null/undefined values before serializing
          const cleanedData = Object.entries(formData).reduce((acc, [key, value]) => {
            // Keep the value if it's not null, undefined, or empty string
            if (value !== null && value !== undefined && value !== "") {
              acc[key as keyof ItemCreateFormData] = value;
            }
            return acc;
          }, {} as Partial<ItemCreateFormData>);

          const params = serializeItemFormToUrlParams(cleanedData);
          const currentParams = new URLSearchParams(searchParams);

          // Only update if params have actually changed
          if (params.toString() !== currentParams.toString()) {
            setSearchParams(params, { replace: true });
          }
        }
      }, 1000),
    [mode, setSearchParams, searchParams],
  );

  // Reset form when defaultValues change in update mode (e.g., new item data loaded)
  const defaultValuesRef = useRef(defaultValues);
  useEffect(() => {
    if (mode === "update" && defaultValues && defaultValues !== defaultValuesRef.current) {
      // Reset form with new defaults and mark form as untouched/pristine
      form.reset(defaultValues, {
        keepDefaultValues: false,
        keepDirty: false,
        keepTouched: false,
      });
      defaultValuesRef.current = defaultValues;
    }
  }, [defaultValues, form, mode]);

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
        // Filter out undefined values from arrays
        const cleanValues = {
          ...values,
          barcodes: values.barcodes?.filter((barcode): barcode is string => barcode !== undefined),
          measures: values.measures?.filter(
            (measure): measure is { measureType: string; value?: number | null; unit?: string | null } =>
              measure !== undefined && measure.measureType !== undefined && typeof measure.measureType === "string",
          ),
        };
        debouncedUpdateUrl(cleanValues);
      });

      return () => subscription.unsubscribe();
    }
  }, [form, debouncedUpdateUrl, mode]);

  // Ensure barcodes and measures are initialized as arrays
  React.useEffect(() => {
    const currentBarcodes = form.getValues("barcodes");
    if (!Array.isArray(currentBarcodes)) {
      form.setValue("barcodes", [], { shouldValidate: false });
    }

    const currentMeasures = form.getValues("measures");
    if (!Array.isArray(currentMeasures)) {
      form.setValue("measures", [], { shouldValidate: false });
    }
  }, [form]);

  // Access formState properties during render for proper subscription
  const { isValid, isDirty, errors } = form.formState;

  // Debug validation errors in development
  useEffect(() => {
    if (process.env.NODE_ENV === "development" && Object.keys(errors).length > 0) {
      console.log("Item form validation errors:", {
        errors,
        currentValues: form.getValues(),
      });
    }
  }, [errors, form]);

  // Track dirty state without triggering validation
  useEffect(() => {
    if (onDirtyChange && mode === "update") {
      onDirtyChange(isDirty);
    }
  }, [isDirty, onDirtyChange, mode]);

  // Track form state changes for submit button
  useEffect(() => {
    if (onFormStateChange) {
      onFormStateChange({
        isValid,
        isDirty,
      });
    }
  }, [isValid, isDirty, onFormStateChange]);

  // Check if selected category is PPE
  const { data: categories } = useItemCategories({
    where: { id: selectedCategoryId },
  });

  useEffect(() => {
    if (categories?.data?.[0]) {
      setIsPPE(categories.data[0].type === ITEM_CATEGORY_TYPE.PPE);
    }
  }, [categories]);

  const handleSubmit = async (data: any) => {
    console.group("🎯 ItemForm handleSubmit");
    console.groupEnd();

    try {
      // Convert measures object to array if needed
      let measuresArray = [];
      if (data.measures) {
        if (Array.isArray(data.measures)) {
          measuresArray = data.measures;
        } else if (typeof data.measures === "object") {
          // Convert object with numeric keys to array
          measuresArray = Object.values(data.measures);
        }
      }

      // Ensure barcodes and measures are always arrays before submitting
      const processedData = {
        ...data,
        barcodes: Array.isArray(data.barcodes) ? data.barcodes : [],
        measures: measuresArray,
      };
      if (mode === "create") {
        await (props as CreateItemFormProps).onSubmit(processedData);
      } else {
        await (props as UpdateItemFormProps).onSubmit(processedData);
      }
    } catch (error) {
      console.error("❌ Submit error:", error);
      // Re-throw so parent can handle
      throw error;
    }
  };

  const isRequired = mode === "create";

  return (
    <div className="h-full overflow-y-auto p-6">
      <FormProvider {...form}>
        <form id="item-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Hidden submit button for programmatic form submission */}
          <button id="item-form-submit" type="submit" className="hidden" disabled={isSubmitting}>
            Submit
          </button>
          {/* Basic Information & Classification */}
          <Card className="bg-transparent">
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>Identificação e classificação do item</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <UnicodeInput disabled={isSubmitting} />
                <NameInput disabled={isSubmitting} required={isRequired} />
              </div>
              <Separator />
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <CategorySelector disabled={isSubmitting} onCategoryChange={setSelectedCategoryId} initialCategory={initialCategory} />
                  <ItemBrandSelector disabled={isSubmitting} initialBrand={initialBrand} />
                </div>
                <ItemSupplierSelector disabled={isSubmitting} initialSupplier={initialSupplier} />
              </div>
            </CardContent>
          </Card>

          {/* Inventory */}
          <Card className="bg-transparent">
            <CardHeader>
              <CardTitle>Controle de Estoque</CardTitle>
              <CardDescription>Quantidades e níveis de estoque</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <QuantityInput disabled={isSubmitting} required={isRequired} />
                <MaxQuantityInput disabled={isSubmitting} />
                <BoxQuantityInput disabled={isSubmitting} />
                <LeadTimeInput disabled={isSubmitting} />
              </div>
            </CardContent>
          </Card>

          {/* Pricing */}
          <Card className="bg-transparent">
            <CardHeader>
              <CardTitle>Preço e Taxas</CardTitle>
              <CardDescription>Informações de preço e impostos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PriceInput disabled={isSubmitting} />
                <FormInput<ItemCreateFormData> name="tax" label="Taxa" type="percentage" disabled={isSubmitting} decimals={2} />
              </div>
            </CardContent>
          </Card>

          {/* Multiple Measures - Only show for non-PPE categories */}
          {!isPPE && <MeasureInput fieldArray={measuresFieldArray} disabled={isSubmitting} required={isRequired} categoryId={selectedCategoryId} />}

          {/* PPE Configuration - Only show for PPE categories */}
          {isPPE && <PpeConfigSection disabled={isSubmitting} required={isRequired} />}

          {/* Tracking */}
          <Card className="bg-transparent">
            <CardHeader>
              <CardTitle>Rastreamento</CardTitle>
              <CardDescription>Códigos de barras para identificação do item</CardDescription>
            </CardHeader>
            <CardContent>
              <BarcodeManager disabled={isSubmitting} />
            </CardContent>
          </Card>

          {/* Extra Configurations */}
          <Card className="bg-transparent">
            <CardHeader>
              <CardTitle>Configurações Extras</CardTitle>
              <CardDescription>Configurações adicionais do item</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AssignToUserToggle disabled={isSubmitting} />
                <StatusToggle disabled={isSubmitting} />
              </div>
            </CardContent>
          </Card>
        </form>
      </FormProvider>
    </div>
  );
}
