import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supplierCreateSchema, supplierUpdateSchema, type SupplierCreateFormData, type SupplierUpdateFormData } from "../../../../schemas";
import { serializeSupplierFormToUrlParams, getDefaultSupplierFormValues, debounce } from "@/utils/url-form-state";
import { createSupplierFormData } from "@/utils/form-data-helper";
import { useCnpjLookup } from "@/hooks/use-cnpj-lookup";

// Import all form components
import { FantasyNameInput } from "./fantasy-name-input";
import { CorporateNameInput } from "./corporate-name-input";
import { FormInput } from "@/components/ui/form-input";
import { WebsiteInput } from "./website-input";
import { PhoneArrayInput } from "@/components/ui/phone-array-input";
import { AddressInput } from "@/components/ui/form-address-input";
import { AddressNumberInput } from "@/components/ui/form-address-number-input";
import { AddressComplementInput } from "@/components/ui/form-address-complement-input";
import { NeighborhoodInput } from "@/components/ui/form-neighborhood-input";
import { CityInput } from "@/components/ui/form-city-input";
import { StateSelector } from "@/components/ui/form-state-selector";
import { LogradouroSelect } from "@/components/ui/form-logradouro-select";
import { LogoInput } from "./logo-input";
import { TagsInput } from "./tags-input";

interface BaseSupplierFormProps {
  isSubmitting?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onFormStateChange?: (formState: { isValid: boolean; isDirty: boolean }) => void;
}

interface CreateSupplierFormProps extends BaseSupplierFormProps {
  mode: "create";
  onSubmit: (data: SupplierCreateFormData) => Promise<void>;
  defaultValues?: Partial<SupplierCreateFormData>;
}

interface UpdateSupplierFormProps extends BaseSupplierFormProps {
  mode: "update";
  onSubmit: (data: SupplierUpdateFormData) => Promise<void>;
  defaultValues?: Partial<SupplierUpdateFormData>;
}

type SupplierFormProps = CreateSupplierFormProps | UpdateSupplierFormProps;

export function SupplierForm(props: SupplierFormProps) {
  const { isSubmitting, defaultValues, mode, onDirtyChange, onFormStateChange } = props;
  const [searchParams, setSearchParams] = useSearchParams();

  // Create a custom resolver for update mode that skips validation for unchanged CNPJ
  const customResolver = useMemo(() => {
    if (mode === "create") {
      return zodResolver(supplierCreateSchema);
    }

    // For update mode, use the fixed schema that handles CNPJ properly
    return zodResolver(supplierUpdateSchema);
  }, [mode]);

  // Default values for create mode with URL state integration
  const createDefaults: SupplierCreateFormData = useMemo(() => {
    if (mode === "create") {
      return getDefaultSupplierFormValues(searchParams, defaultValues);
    }
    return {
      fantasyName: "",
      cnpj: null,
      corporateName: null,
      email: null,
      logradouro: null,
      address: null,
      addressNumber: null,
      addressComplement: null,
      neighborhood: null,
      city: null,
      state: null,
      zipCode: null,
      site: null,
      phones: [],
      tags: [],
      logoId: null,
      ...defaultValues,
    };
  }, [mode, searchParams, defaultValues]);

  // Create a unified form that works for both modes
  const form = useForm({
    resolver: customResolver,
    defaultValues: mode === "create" ? createDefaults : (defaultValues || {
      fantasyName: "",
      cnpj: null,
      corporateName: null,
      email: null,
      logradouro: null,
      address: null,
      addressNumber: null,
      addressComplement: null,
      neighborhood: null,
      city: null,
      state: null,
      zipCode: null,
      site: null,
      phones: [],
      tags: [],
      logoId: null,
    }),
    mode: "onTouched", // Validate only after field is touched to avoid premature validation
    reValidateMode: "onChange", // After first validation, check on every change
    shouldFocusError: true, // Focus on first error field when validation fails
    criteriaMode: "all", // Show all errors for better UX
  });

  // CNPJ lookup hook
  const { lookupCnpj } = useCnpjLookup({
    onSuccess: (data) => {
      // Autofill fields with data from Brasil API
      form.setValue("fantasyName", data.fantasyName, { shouldDirty: true, shouldValidate: true });
      if (data.corporateName) {
        form.setValue("corporateName", data.corporateName, { shouldDirty: true, shouldValidate: true });
      }
      if (data.email) {
        form.setValue("email", data.email, { shouldDirty: true, shouldValidate: true });
      }
      if (data.zipCode) {
        form.setValue("zipCode", data.zipCode, { shouldDirty: true, shouldValidate: true });
      }
      if (data.logradouroType) {
        form.setValue("logradouro", data.logradouroType, { shouldDirty: true, shouldValidate: true });
      }
      if (data.address) {
        form.setValue("address", data.address, { shouldDirty: true, shouldValidate: true });
      }
      if (data.addressNumber) {
        form.setValue("addressNumber", data.addressNumber, { shouldDirty: true, shouldValidate: true });
      }
      if (data.addressComplement) {
        form.setValue("addressComplement", data.addressComplement, { shouldDirty: true, shouldValidate: true });
      }
      if (data.neighborhood) {
        form.setValue("neighborhood", data.neighborhood, { shouldDirty: true, shouldValidate: true });
      }
      if (data.city) {
        form.setValue("city", data.city, { shouldDirty: true, shouldValidate: true });
      }
      if (data.state) {
        form.setValue("state", data.state, { shouldDirty: true, shouldValidate: true });
      }
      if (data.phones && data.phones.length > 0) {
        // Add all phones to the phones array, avoiding duplicates
        const currentPhones = form.getValues("phones") || [];
        const newPhones = data.phones.filter(phone => !currentPhones.includes(phone));
        if (newPhones.length > 0) {
          form.setValue("phones", [...currentPhones, ...newPhones], { shouldDirty: true, shouldValidate: true });
        }
      }
    },
  });

  // Watch CNPJ field and trigger lookup when complete
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "cnpj" && value.cnpj) {
        lookupCnpj(value.cnpj);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, lookupCnpj]);

  // Reset form when defaultValues change in update mode (e.g., new supplier data loaded)
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

  // Access formState properties during render for proper subscription
  const { isValid, isDirty, errors } = form.formState;

  // Debug validation errors in development
  useEffect(() => {
    if (process.env.NODE_ENV === "development" && Object.keys(errors).length > 0) {
      console.log("Supplier form validation errors:", {
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

  // Debounced URL update function for create mode
  const debouncedUpdateUrl = useMemo(
    () =>
      debounce((formData: Partial<SupplierCreateFormData>) => {
        if (mode === "create") {
          // Clean up empty/null/undefined values before serializing
          const cleanedData = Object.entries(formData).reduce((acc, [key, value]) => {
            // Keep the value if it's not null, undefined, or empty string
            if (value !== null && value !== undefined && value !== "") {
              acc[key as keyof SupplierCreateFormData] = value;
            }
            return acc;
          }, {} as Partial<SupplierCreateFormData>);

          const newParams = serializeSupplierFormToUrlParams(cleanedData);
          setSearchParams(newParams, { replace: true });
        }
      }, 500),
    [mode, setSearchParams],
  );

  // Watch form values and update URL for create mode
  useEffect(() => {
    if (mode === "create") {
      const subscription = form.watch((data) => {
        debouncedUpdateUrl(data as Partial<SupplierCreateFormData>);
      });
      return () => subscription.unsubscribe();
    }
  }, [form, mode, debouncedUpdateUrl]);

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedUpdateUrl.cancel();
    };
  }, [debouncedUpdateUrl]);

  // Handle CEP lookup (now handled directly in ZipCodeInput component)
  const handleCepLookup = useCallback(async (_cep: string) => {
    // This is now handled directly in the ZipCodeInput component
    // Keeping this function for backwards compatibility
  }, []);

  const onSubmit = async (data: SupplierCreateFormData | SupplierUpdateFormData) => {
    try {
      // Transform phones object to array if needed
      // React Hook Form sometimes serializes field arrays as objects like {"0": "phone1", "1": "phone2"}
      const transformedData = { ...data };

      if (transformedData.phones && typeof transformedData.phones === "object" && !Array.isArray(transformedData.phones)) {
        transformedData.phones = Object.values(transformedData.phones) as string[];
      }

      if (transformedData.tags && typeof transformedData.tags === "object" && !Array.isArray(transformedData.tags)) {
        transformedData.tags = Object.values(transformedData.tags) as string[];
      }

      // Check if we have a logo file to upload
      // Get logoFile from both submitted data AND current form state (in case it wasn't included in submission)
      const logoFile = (transformedData as any).logoFile || form.getValues('logoFile' as any);

      // Debug logging
      console.log('[SupplierForm] onSubmit - logoFile check:', {
        hasLogoFile: !!logoFile,
        isFile: logoFile instanceof File,
        logoFileType: logoFile?.constructor?.name,
        fromData: !!(transformedData as any).logoFile,
        fromFormState: !!form.getValues('logoFile' as any),
      });

      // If we have a file, create FormData with proper context
      if (logoFile && logoFile instanceof File) {
        // Extract logoFile from data and prepare clean data object
        const { logoFile: _, ...dataWithoutFile } = transformedData as any;

        // Create FormData with proper context for file organization
        const formData = createSupplierFormData(
          dataWithoutFile,
          logoFile,
          {
            id: mode === "update" ? defaultValues?.id : undefined,
            name: transformedData.corporateName || transformedData.fantasyName,
            fantasyName: transformedData.fantasyName,
          }
        );

        if (mode === "create") {
          await (props as CreateSupplierFormProps).onSubmit(formData as any);
        } else {
          await (props as UpdateSupplierFormProps).onSubmit(formData as any);
        }
      } else {
        // No file, send as regular JSON (remove logoFile field if present)
        const { logoFile: _, ...dataWithoutFile } = transformedData as any;

        if (mode === "create") {
          await (props as CreateSupplierFormProps).onSubmit(dataWithoutFile as SupplierCreateFormData);
        } else {
          await (props as UpdateSupplierFormProps).onSubmit(dataWithoutFile as SupplierUpdateFormData);
        }
      }
    } catch (error) {
      // Error is handled by the parent component
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <Card className="bg-transparent">
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>Dados fundamentais do fornecedor</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FantasyNameInput disabled={isSubmitting} />
                <CorporateNameInput disabled={isSubmitting} />
              </div>

              <FormInput<SupplierCreateFormData | SupplierUpdateFormData> name="cnpj" type="cnpj" label="CNPJ" disabled={isSubmitting} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput<SupplierCreateFormData | SupplierUpdateFormData> name="email" type="email" label="E-mail" placeholder="fornecedor@exemplo.com" disabled={isSubmitting} />
                <WebsiteInput disabled={isSubmitting} />
              </div>
            </CardContent>
          </Card>

          {/* Logo */}
          <Card className="bg-transparent">
            <CardHeader>
              <CardTitle>Logo</CardTitle>
              <CardDescription>Imagem do logo do fornecedor</CardDescription>
            </CardHeader>
            <CardContent>
              <LogoInput disabled={isSubmitting} existingLogoId={defaultValues?.logoId} />
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="bg-transparent">
            <CardHeader>
              <CardTitle>Informações de Contato</CardTitle>
              <CardDescription>Telefones e outras formas de contato</CardDescription>
            </CardHeader>
            <CardContent>
              <PhoneArrayInput control={form.control} disabled={isSubmitting} maxPhones={5} />
            </CardContent>
          </Card>

          {/* Address Information */}
          <Card className="bg-transparent">
            <CardHeader>
              <CardTitle>Endereço</CardTitle>
              <CardDescription>Localização do fornecedor</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormInput<SupplierCreateFormData | SupplierUpdateFormData>
                  type="cep"
                  name="zipCode"
                  label="CEP"
                  disabled={isSubmitting}
                  addressFieldName="address"
                  neighborhoodFieldName="neighborhood"
                  cityFieldName="city"
                  stateFieldName="state"
                  logradouroFieldName="logradouro"
                />
                <CityInput disabled={isSubmitting} required={false} />
                <StateSelector disabled={isSubmitting} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                <div className="md:col-span-2">
                  <LogradouroSelect<SupplierCreateFormData | SupplierUpdateFormData> disabled={isSubmitting} />
                </div>
                <div className="md:col-span-3">
                  <AddressInput disabled={isSubmitting} useGooglePlaces={!!import.meta.env.VITE_GOOGLE_MAPS_API_KEY} required={false} />
                </div>
                <div className="md:col-span-1">
                  <AddressNumberInput disabled={isSubmitting} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <NeighborhoodInput disabled={isSubmitting} />
                <AddressComplementInput disabled={isSubmitting} />
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card className="bg-transparent">
            <CardHeader>
              <CardTitle>Tags</CardTitle>
              <CardDescription>Etiquetas para categorizar o fornecedor</CardDescription>
            </CardHeader>
            <CardContent>
              <TagsInput control={form.control} disabled={isSubmitting} />
            </CardContent>
          </Card>

          {/* Hidden submit button that can be triggered by the header button */}
          <button id="supplier-form-submit" type="submit" className="hidden" disabled={isSubmitting}>
            Submit
          </button>
        </form>
      </Form>
    </div>
  );
}
