import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { itemCreateSchema, itemUpdateSchema, type ItemCreateFormData, type ItemUpdateFormData } from "../../../../schemas";
import { useItemCategories } from "../../../../hooks";
import { ITEM_CATEGORY_TYPE } from "../../../../constants";
import { serializeItemFormToUrlParams, debounce } from "@/utils/url-form-state";
// Import all form components
import { NameInput } from "@/components/inventory/item/form/name-input";
import { UnicodeInput } from "@/components/inventory/item/form/unicode-input";
import { StatusToggle } from "@/components/inventory/item/form/status-toggle";
import { ItemBrandSelector } from "@/components/inventory/item/form/brand-selector";
import { ItemSupplierSelector } from "@/components/inventory/item/form/supplier-selector";
import { QuantityInput } from "@/components/inventory/item/form/quantity-input";
import { MaxQuantityInput } from "@/components/inventory/item/form/max-quantity-input";
import { BoxQuantityInput } from "@/components/inventory/item/form/box-quantity-input";
import { LeadTimeInput } from "@/components/inventory/item/form/lead-time-input";
import { PriceInput } from "@/components/inventory/item/form/price-input";
import { IcmsInput } from "@/components/inventory/item/form/icms-input";
import { IpiInput } from "@/components/inventory/item/form/ipi-input";
import { BarcodeManager } from "@/components/inventory/item/form/barcode-manager";
import { AssignToUserToggle } from "@/components/inventory/item/form/assign-to-user-toggle";
import { PpeConfigSection } from "@/components/inventory/item/form/ppe-config-section";

interface BaseEpiFormProps {
  isSubmitting?: boolean;
}

interface CreateEpiFormProps extends BaseEpiFormProps {
  mode: "create";
  onSubmit: (data: ItemCreateFormData) => Promise<void>;
  defaultValues?: Partial<ItemCreateFormData>;
}

interface UpdateEpiFormProps extends BaseEpiFormProps {
  mode: "update";
  onSubmit: (data: ItemUpdateFormData) => Promise<void>;
  defaultValues?: Partial<ItemUpdateFormData>;
}

type EpiFormProps = CreateEpiFormProps | UpdateEpiFormProps;

export function EpiForm(props: EpiFormProps) {
  const { isSubmitting, defaultValues, mode } = props;
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>();
  const [_isPPE] = useState(true); // Always true for EPI forms

  // Get the first EPI category to auto-select it
  const { data: epiCategories } = useItemCategories({
    where: { type: ITEM_CATEGORY_TYPE.PPE },
    orderBy: { createdAt: "asc" },
    take: 1,
  });

  // Auto-select first EPI category when available
  useEffect(() => {
    if (epiCategories?.data?.[0] && !defaultValues?.categoryId && !selectedCategoryId) {
      const firstEpiCategory = epiCategories.data[0];
      setSelectedCategoryId(firstEpiCategory.id);
    }
  }, [epiCategories, defaultValues?.categoryId, selectedCategoryId]);

  // Default values for create mode
  const createDefaults = {
    name: "",
    uniCode: null,
    quantity: 0,
    reorderPoint: null,
    reorderQuantity: null,
    maxQuantity: null,
    boxQuantity: null,
    icms: 0,
    ipi: 0,
    measureValue: null,
    measureUnit: null,
    barcodes: [],
    shouldAssignToUser: true,
    abcCategory: null,
    xyzCategory: null,
    brandId: undefined,
    categoryId: selectedCategoryId || epiCategories?.data?.[0]?.id,
    supplierId: null,
    estimatedLeadTime: 30,
    isActive: true,
    price: undefined,
    // PPE fields
    ppeType: null,
    ppeCA: null,
    ppeDeliveryMode: null,
    ppeStandardQuantity: null,
    ...defaultValues,
  };

  // Ensure defaultValues has barcodes as arrays for update mode
  const processedDefaultValues =
    mode === "update" && defaultValues
      ? {
          ...defaultValues,
          barcodes: Array.isArray(defaultValues.barcodes) ? defaultValues.barcodes : [],
        }
      : defaultValues;

  // Create a unified form that works for both modes
  const form = useForm({
    resolver: zodResolver(mode === "create" ? itemCreateSchema : itemUpdateSchema),
    defaultValues: mode === "create" ? (createDefaults as ItemCreateFormData) : processedDefaultValues,
    mode: "onBlur", // Validate on blur for better UX
  });

  // Debounced function to update URL parameters
  const debouncedUpdateUrl = useMemo(
    () =>
      debounce((formData: Partial<ItemCreateFormData | ItemUpdateFormData>) => {
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
        debouncedUpdateUrl(values as Partial<ItemCreateFormData>);
      });

      return () => subscription.unsubscribe();
    }
  }, [form, debouncedUpdateUrl, mode]);

  // Ensure barcodes are initialized as arrays
  React.useEffect(() => {
    const currentBarcodes = form.getValues("barcodes");
    if (!Array.isArray(currentBarcodes)) {
      form.setValue("barcodes", [], { shouldValidate: false });
    }
  }, [form]);

  // Update categoryId when EPI category is found
  useEffect(() => {
    if (epiCategories?.data?.[0] && mode === "create" && !form.getValues("categoryId")) {
      form.setValue("categoryId", epiCategories.data[0].id);
      setSelectedCategoryId(epiCategories.data[0].id);
    }
  }, [epiCategories, form, mode]);

  const handleSubmit = async (data: ItemCreateFormData | ItemUpdateFormData) => {
    try {
      // Ensure barcodes are always arrays before submitting
      const processedData = {
        ...data,
        barcodes: Array.isArray(data.barcodes) ? data.barcodes : [],
      };

      if (mode === "create") {
        await (props as CreateEpiFormProps).onSubmit(processedData as ItemCreateFormData);
      } else {
        await (props as UpdateEpiFormProps).onSubmit(processedData as ItemUpdateFormData);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error submitting EPI form:", error);
      }
      // Re-throw so parent can handle
      throw error;
    }
  };

  const isRequired = mode === "create";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4">
        <Form {...form}>
          <form
            id="epi-form"
            onSubmit={form.handleSubmit(handleSubmit, (errors) => {
              if (process.env.NODE_ENV !== 'production') {
                console.error("EPI form validation errors:", errors);
              }
            })}
            className="container mx-auto max-w-4xl space-y-6"
          >
            {/* Hidden submit button for programmatic form submission */}
            <button type="submit" id="epi-form-submit" className="hidden" aria-hidden="true" />

            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Informações Básicas</CardTitle>
                <CardDescription>Identificação e classificação do EPI</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <UnicodeInput disabled={isSubmitting} />
                  <NameInput disabled={isSubmitting} required={isRequired} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ItemBrandSelector disabled={isSubmitting} />
                  <ItemSupplierSelector disabled={isSubmitting} />
                </div>
              </CardContent>
            </Card>

            {/* Inventory */}
            <Card>
              <CardHeader>
                <CardTitle>Controle de Estoque</CardTitle>
                <CardDescription>Quantidades e níveis de estoque</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <QuantityInput disabled={isSubmitting} required={isRequired} />
                  <MaxQuantityInput
                    disabled={isSubmitting}
                    currentValue={defaultValues?.maxQuantity}
                    isManual={defaultValues?.isManualMaxQuantity || false}
                  />
                  <BoxQuantityInput disabled={isSubmitting} />
                  <LeadTimeInput disabled={isSubmitting} />
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle>Preço e Taxas</CardTitle>
                <CardDescription>Informações de preço e impostos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <PriceInput disabled={isSubmitting} />
                  <IcmsInput
                    control={form.control}
                    disabled={isSubmitting}
                    priceFieldName="price"
                    onPriceUpdate={(newPrice) => form.setValue("price", newPrice, { shouldDirty: true, shouldValidate: true })}
                    watch={form.watch}
                  />
                  <IpiInput
                    control={form.control}
                    disabled={isSubmitting}
                    priceFieldName="price"
                    onPriceUpdate={(newPrice) => form.setValue("price", newPrice, { shouldDirty: true, shouldValidate: true })}
                    watch={form.watch}
                  />
                </div>
              </CardContent>
            </Card>

            {/* PPE Configuration - Always show for EPI forms */}
            <PpeConfigSection disabled={isSubmitting} required={isRequired} />
            {/* Display PPE configuration validation errors */}
            {(form.formState.errors.ppeType || form.formState.errors.ppeCA || form.formState.errors.ppeDeliveryMode || form.formState.errors.ppeStandardQuantity) && (
              <div className="text-red-500 text-sm mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <strong>Erros na configuração de EPI:</strong>
                <ul className="mt-1 space-y-1">
                  {form.formState.errors.ppeType && <li>• {form.formState.errors.ppeType.message}</li>}
                  {form.formState.errors.ppeCA && <li>• {form.formState.errors.ppeCA.message}</li>}
                  {form.formState.errors.ppeDeliveryMode && <li>• {form.formState.errors.ppeDeliveryMode.message}</li>}
                  {form.formState.errors.ppeStandardQuantity && <li>• {form.formState.errors.ppeStandardQuantity.message}</li>}
                </ul>
              </div>
            )}

            {/* Tracking */}
            <Card>
              <CardHeader>
                <CardTitle>Rastreamento</CardTitle>
                <CardDescription>Códigos de barras para identificação do EPI</CardDescription>
              </CardHeader>
              <CardContent>
                <BarcodeManager disabled={isSubmitting} />
              </CardContent>
            </Card>

            {/* Extra Configurations */}
            <Card>
              <CardHeader>
                <CardTitle>Configurações Extras</CardTitle>
                <CardDescription>Configurações adicionais do EPI</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <AssignToUserToggle disabled={isSubmitting} />
                  <StatusToggle disabled={isSubmitting} />
                </div>
              </CardContent>
            </Card>

            {/* Form Validation Summary */}
            {Object.keys(form.formState.errors).length > 0 && (
              <Card className="bg-red-50 border-red-200">
                <CardHeader>
                  <CardTitle className="text-red-800 flex items-center gap-2">
                    <span>⚠️</span>
                    Erros de Validação
                  </CardTitle>
                  <CardDescription className="text-red-700">Corrija os erros abaixo antes de enviar o formulário:</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-red-700 text-sm space-y-2">
                    {Object.entries(form.formState.errors).map(([field, error]) => (
                      <li key={field} className="flex items-start gap-2">
                        <span className="font-medium min-w-0">
                          {field === "name" && "Nome:"}
                          {field === "quantity" && "Quantidade:"}
                          {field === "price" && "Preço:"}
                          {field === "ppeType" && "Tipo de EPI:"}
                          {field === "ppeCA" && "Certificado de Aprovação:"}
                          {field === "ppeDeliveryMode" && "Modo de Entrega:"}
                          {field === "barcodes" && "Códigos de Barras:"}
                          {!["name", "quantity", "price", "ppeType", "ppeCA", "ppeDeliveryMode", "barcodes"].includes(field) && `${field}:`}
                        </span>
                        <span className="flex-1">{error?.message || "Campo inválido"}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </form>
        </Form>
      </div>
    </div>
  );
}
