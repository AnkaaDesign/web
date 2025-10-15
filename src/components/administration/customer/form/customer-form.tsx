import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { customerCreateSchema, customerUpdateSchema, type CustomerCreateFormData, type CustomerUpdateFormData } from "../../../../schemas";
import { serializeCustomerFormToUrlParams, getDefaultCustomerFormValues, debounce } from "@/utils/url-form-state";
import { createCustomerFormData } from "@/utils/form-data-helper";

// Import all form components
import { FantasyNameInput } from "./fantasy-name-input";
import { CorporateNameInput } from "./corporate-name-input";
import { FormDocumentInput } from "@/components/ui/form-document-input";
import { WebsiteInput } from "./website-input";
import { PhoneArrayInput } from "@/components/ui/phone-array-input";
import { AddressInput } from "@/components/ui/form-address-input";
import { AddressNumberInput } from "@/components/ui/form-address-number-input";
import { AddressComplementInput } from "@/components/ui/form-address-complement-input";
import { NeighborhoodInput } from "@/components/ui/form-neighborhood-input";
import { CityInput } from "@/components/ui/form-city-input";
import { StateSelector } from "@/components/ui/form-state-selector";
import { FormInput } from "@/components/ui/form-input";
import { LogoInput } from "./logo-input";
import { TagsInput } from "./tags-input";

interface BaseCustomerFormProps {
  isSubmitting?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onFormStateChange?: (formState: { isValid: boolean; isDirty: boolean }) => void;
}

interface CreateCustomerFormProps extends BaseCustomerFormProps {
  mode: "create";
  onSubmit: (data: CustomerCreateFormData) => Promise<void>;
  defaultValues?: Partial<CustomerCreateFormData>;
}

interface UpdateCustomerFormProps extends BaseCustomerFormProps {
  mode: "update";
  onSubmit: (data: CustomerUpdateFormData) => Promise<void>;
  defaultValues?: Partial<CustomerUpdateFormData>;
}

type CustomerFormProps = CreateCustomerFormProps | UpdateCustomerFormProps;

export function CustomerForm(props: CustomerFormProps) {
  const { isSubmitting, defaultValues, mode, onDirtyChange, onFormStateChange } = props;
  const [searchParams, setSearchParams] = useSearchParams();

  // Create a custom resolver for update mode that skips validation for unchanged fields
  const customResolver = useMemo(() => {
    if (mode === "create") {
      return zodResolver(customerCreateSchema);
    }

    // For update mode, use the update schema
    return zodResolver(customerUpdateSchema);
  }, [mode]);

  // Default values for create mode with URL state integration
  const createDefaults: CustomerCreateFormData = useMemo(() => {
    if (mode === "create") {
      return getDefaultCustomerFormValues(searchParams, defaultValues);
    }
    return {
      fantasyName: "",
      cnpj: null,
      cpf: null,
      corporateName: null,
      email: null,
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
    defaultValues: mode === "create" ? createDefaults : defaultValues,
    mode: "onBlur", // Validate on blur for better UX
    reValidateMode: "onChange", // Re-validate on change after first validation
    shouldFocusError: true, // Focus on first error field when validation fails
    criteriaMode: "firstError", // Stop at first error per field for better performance
  });

  // Initialize form only once for update mode
  useEffect(() => {
    if (mode === "update" && defaultValues) {
      form.reset(defaultValues);
    }
  }, [mode]); // Only depend on mode, not defaultValues to avoid re-initialization

  // Track dirty state without triggering validation
  useEffect(() => {
    if (onDirtyChange && mode === "update") {
      const isDirty = form.formState.isDirty;
      onDirtyChange(isDirty);
    }
  }, [form.formState.isDirty, onDirtyChange, mode]);

  // Track form state changes for submit button
  useEffect(() => {
    if (onFormStateChange) {
      onFormStateChange({
        isValid: form.formState.isValid,
        isDirty: form.formState.isDirty,
      });
    }
  }, [form.formState.isValid, form.formState.isDirty, onFormStateChange]);

  // Debounced URL update function for create mode
  const debouncedUpdateUrl = useMemo(
    () =>
      debounce((formData: Partial<CustomerCreateFormData>) => {
        if (mode === "create") {
          // Clean up empty/null/undefined values before serializing
          const cleanedData = Object.entries(formData).reduce((acc, [key, value]) => {
            // Keep the value if it's not null, undefined, or empty string
            if (value !== null && value !== undefined && value !== "") {
              acc[key as keyof CustomerCreateFormData] = value;
            }
            return acc;
          }, {} as Partial<CustomerCreateFormData>);

          const newParams = serializeCustomerFormToUrlParams(cleanedData);
          setSearchParams(newParams, { replace: true });
        }
      }, 500),
    [mode, setSearchParams],
  );

  // Watch form values and update URL for create mode
  useEffect(() => {
    if (mode === "create") {
      const subscription = form.watch((data) => {
        debouncedUpdateUrl(data as Partial<CustomerCreateFormData>);
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

  const onSubmit = async (data: CustomerCreateFormData | CustomerUpdateFormData) => {
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

      // Debug logging (production enabled temporarily for debugging)
      console.log('[CustomerForm] onSubmit - logoFile check:', {
        hasLogoFile: !!logoFile,
        isFile: logoFile instanceof File,
        logoFileType: logoFile?.constructor?.name,
        fromData: !!(transformedData as any).logoFile,
        fromFormState: !!form.getValues('logoFile' as any),
        allKeys: Object.keys(transformedData),
        mode: mode,
      });

      // If we have a file, create FormData with proper context
      if (logoFile && logoFile instanceof File) {
        console.log('[CustomerForm] Creating FormData with logoFile:', {
          fileName: logoFile.name,
          fileSize: logoFile.size,
          fileType: logoFile.type,
          customerId: mode === "update" ? defaultValues?.id : undefined,
          customerName: transformedData.corporateName || transformedData.fantasyName,
        });

        // Extract logoFile from data and prepare clean data object
        const { logoFile: _, ...dataWithoutFile } = transformedData as any;

        // Create FormData with proper context for file organization
        const formData = createCustomerFormData(
          dataWithoutFile,
          logoFile,
          {
            id: mode === "update" ? defaultValues?.id : undefined,
            name: transformedData.corporateName || transformedData.fantasyName,
            fantasyName: transformedData.fantasyName,
          }
        );

        console.log('[CustomerForm] FormData created, submitting...');

        if (mode === "create") {
          await (props as CreateCustomerFormProps).onSubmit(formData as any);
        } else {
          await (props as UpdateCustomerFormProps).onSubmit(formData as any);
        }

        console.log('[CustomerForm] FormData submission completed');
      } else {
        // No file, send as regular JSON (remove logoFile field if present)
        const { logoFile: _, ...dataWithoutFile } = transformedData as any;

        if (mode === "create") {
          await (props as CreateCustomerFormProps).onSubmit(dataWithoutFile as CustomerCreateFormData);
        } else {
          await (props as UpdateCustomerFormProps).onSubmit(dataWithoutFile as CustomerUpdateFormData);
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
              <CardDescription>Dados fundamentais do cliente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FantasyNameInput disabled={isSubmitting} />
                <CorporateNameInput disabled={isSubmitting} />
              </div>

              <FormDocumentInput<CustomerCreateFormData | CustomerUpdateFormData> cpfFieldName="cpf" cnpjFieldName="cnpj" disabled={isSubmitting} required />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput<CustomerCreateFormData | CustomerUpdateFormData> name="email" type="email" label="E-mail" placeholder="cliente@exemplo.com" disabled={isSubmitting} />
                <WebsiteInput disabled={isSubmitting} />
              </div>
            </CardContent>
          </Card>

          {/* Logo */}
          <Card className="bg-transparent">
            <CardHeader>
              <CardTitle>Logo</CardTitle>
              <CardDescription>Imagem do logo do cliente</CardDescription>
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
              <CardDescription>Localização do cliente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormInput<CustomerCreateFormData | CustomerUpdateFormData>
                  type="cep"
                  name="zipCode"
                  label="CEP"
                  disabled={isSubmitting}
                  addressFieldName="address"
                  neighborhoodFieldName="neighborhood"
                  cityFieldName="city"
                  stateFieldName="state"
                />
                <AddressInput disabled={isSubmitting} useGooglePlaces={!!import.meta.env.VITE_GOOGLE_MAPS_API_KEY} required={false} />
                <AddressNumberInput disabled={isSubmitting} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AddressComplementInput disabled={isSubmitting} />
                <NeighborhoodInput disabled={isSubmitting} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <CityInput disabled={isSubmitting} required={false} />
                <StateSelector disabled={isSubmitting} />
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card className="bg-transparent">
            <CardHeader>
              <CardTitle>Tags</CardTitle>
              <CardDescription>Etiquetas para categorizar o cliente</CardDescription>
            </CardHeader>
            <CardContent>
              <TagsInput control={form.control} disabled={isSubmitting} />
            </CardContent>
          </Card>

          {/* Hidden submit button that can be triggered by the header button */}
          <button id="customer-form-submit" type="submit" className="hidden" disabled={isSubmitting}>
            Submit
          </button>
        </form>
      </Form>
    </div>
  );
}
