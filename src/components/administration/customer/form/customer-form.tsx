import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { IconInfoCircle, IconPhoto, IconPhone, IconMapPin, IconTag } from "@tabler/icons-react";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { customerCreateSchema, customerUpdateSchema, type CustomerCreateFormData, type CustomerUpdateFormData } from "../../../../schemas";
import { serializeCustomerFormToUrlParams, getDefaultCustomerFormValues, debounce } from "@/utils/url-form-state";
import { createCustomerFormData } from "@/utils/form-data-helper";
import { useCnpjLookup } from "@/hooks/common/use-cnpj-lookup";
import { createEconomicActivity } from "@/api-client/economic-activity";

// Import all form components
import { FantasyNameInput } from "./fantasy-name-input";
import { CorporateNameInput } from "./corporate-name-input";
import { FormDocumentInput } from "@/components/ui/form-document-input";
import { WebsiteInput } from "./website-input";
import { PhoneArrayInput } from "@/components/ui/phone-array-input";
import { FormAddressInput } from "@/components/ui/form-address-input";
import { FormAddressNumberInput } from "@/components/ui/form-address-number-input";
import { FormAddressComplementInput } from "@/components/ui/form-address-complement-input";
import { FormNeighborhoodInput } from "@/components/ui/form-neighborhood-input";
import { FormCityInput } from "@/components/ui/form-city-input";
import { FormStateSelector } from "@/components/ui/form-state-selector";
import { FormInput } from "@/components/ui/form-input";
import { LogoInput } from "./logo-input";
import { TagsInput } from "./tags-input";
import { SituacaoCadastralSelect } from "./situacao-cadastral-select";
import { StreetTypeSelect } from "./street-type-select";
import { EconomicActivitySelect } from "./economic-activity-select";

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
  const queryClient = useQueryClient();

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
      streetType: null,
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
      registrationStatus: null,
      stateRegistration: null,
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

  // CNPJ lookup hook
  const { lookupCnpj } = useCnpjLookup({
    onSuccess: async (data) => {
      // Autofill company info fields from Brasil API
      form.setValue("fantasyName", data.fantasyName, { shouldDirty: true, shouldValidate: true });

      if (data.corporateName) {
        form.setValue("corporateName", data.corporateName, { shouldDirty: true, shouldValidate: true });
      }
      if (data.email) {
        form.setValue("email", data.email, { shouldDirty: true, shouldValidate: true });
      }

      // Only set CEP from CNPJ - the CEP lookup will fill the rest of the address fields
      // This ensures more accurate address data from the postal code API
      if (data.zipCode) {
        form.setValue("zipCode", data.zipCode, { shouldDirty: true, shouldValidate: true });
      }

      // Only set address number and complement from CNPJ (CEP API doesn't have these)
      if (data.addressNumber) {
        form.setValue("addressNumber", data.addressNumber, { shouldDirty: true, shouldValidate: true });
      }
      if (data.addressComplement) {
        form.setValue("addressComplement", data.addressComplement, { shouldDirty: true, shouldValidate: true });
      }

      if (data.phones && data.phones.length > 0) {
        // Add all phones to the phones array, avoiding duplicates
        const currentPhones = form.getValues("phones") || [];
        const newPhones = data.phones.filter(phone => !currentPhones.includes(phone));
        if (newPhones.length > 0) {
          form.setValue("phones", [...currentPhones, ...newPhones], { shouldDirty: true, shouldValidate: true });
        }
      }
      if (data.registrationStatus) {
        form.setValue("registrationStatus", data.registrationStatus, { shouldDirty: true, shouldValidate: true });
      }

      // Handle economic activity (CNAE)
      if (data.economicActivityCode && data.economicActivityDescription) {
        try {
          // Create or get existing activity (API is idempotent)
          const response = await createEconomicActivity({
            code: data.economicActivityCode,
            description: data.economicActivityDescription,
          });
          if (response.data?.id) {
            form.setValue("economicActivityId", response.data.id, { shouldDirty: true, shouldValidate: true });
          }
          // Invalidate the query cache so the combobox refetches and includes the new activity
          queryClient.invalidateQueries({ queryKey: ["economic-activities"] });
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error("Error handling economic activity:", error);
          }
          // Don't fail the whole process if economic activity fails
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

  // Reset form when customer data changes (e.g., navigating between different customers)
  useEffect(() => {
    if (mode === "update" && defaultValues) {
      form.reset(defaultValues);
    }
  }, [mode, defaultValues]);

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
            // Handle arrays separately - don't filter them out if they're empty arrays
            if (value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0)) {
              acc[key as keyof CustomerCreateFormData] = value as any;
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

      // If we have a file, create FormData with proper context
      if (logoFile && logoFile instanceof File) {
        // Extract logoFile from data and prepare clean data object
        const { logoFile: _, ...dataWithoutFile } = transformedData as any;

        // Create FormData with proper context for file organization
        const formData = createCustomerFormData(
          dataWithoutFile,
          logoFile,
          {
            id: mode === "update" ? (defaultValues as any)?.id : undefined,
            name: transformedData.corporateName || transformedData.fantasyName,
            fantasyName: transformedData.fantasyName,
          }
        );

        if (mode === "create") {
          await (props as CreateCustomerFormProps).onSubmit(formData as any);
        } else {
          await (props as UpdateCustomerFormProps).onSubmit(formData as any);
        }
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
    <Form {...form}>
      <form id="customer-form" onSubmit={form.handleSubmit(onSubmit)} className="container mx-auto max-w-4xl">
        {/* Hidden submit button for programmatic form submission */}
        <button id="customer-form-submit" type="submit" className="hidden" disabled={isSubmitting}>
          Submit
        </button>

        <div className="space-y-4">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconInfoCircle className="h-5 w-5 text-muted-foreground" />
                Informações Básicas
              </CardTitle>
              <CardDescription>Dados fundamentais do cliente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormDocumentInput<CustomerCreateFormData | CustomerUpdateFormData> cpfFieldName="cpf" cnpjFieldName="cnpj" defaultDocumentType="cnpj" disabled={isSubmitting} required />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FantasyNameInput disabled={isSubmitting} />
                <CorporateNameInput disabled={isSubmitting} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput<CustomerCreateFormData | CustomerUpdateFormData> name="email" type="email" label="E-mail" placeholder="cliente@exemplo.com" disabled={isSubmitting} />
                <WebsiteInput disabled={isSubmitting} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SituacaoCadastralSelect />
                <FormInput<CustomerCreateFormData | CustomerUpdateFormData>
                  name="stateRegistration"
                  type="text"
                  label="Inscrição Estadual"
                  placeholder="Ex: 123.456.789.012"
                  disabled={isSubmitting}
                />
              </div>

              <EconomicActivitySelect />
            </CardContent>
          </Card>

          {/* Logo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconPhoto className="h-5 w-5 text-muted-foreground" />
                Logo
              </CardTitle>
              <CardDescription>Imagem do logo do cliente</CardDescription>
            </CardHeader>
            <CardContent>
              <LogoInput disabled={isSubmitting} existingLogoId={defaultValues?.logoId ?? undefined} />
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconPhone className="h-5 w-5 text-muted-foreground" />
                Informações de Contato
              </CardTitle>
              <CardDescription>Telefones e outras formas de contato</CardDescription>
            </CardHeader>
            <CardContent>
              <PhoneArrayInput control={form.control} disabled={isSubmitting} maxPhones={5} />
            </CardContent>
          </Card>

          {/* Address Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconMapPin className="h-5 w-5 text-muted-foreground" />
                Endereço
              </CardTitle>
              <CardDescription>Localização do cliente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* First row: CEP, cidade, estado */}
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
                <FormCityInput<CustomerCreateFormData | CustomerUpdateFormData> name="city" disabled={isSubmitting} required={false} />
                <FormStateSelector<CustomerCreateFormData | CustomerUpdateFormData> name="state" disabled={isSubmitting} />
              </div>

              {/* Second row: street type (2/6), address (3/6), number (1/6) */}
              <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                <div className="md:col-span-2">
                  <StreetTypeSelect />
                </div>
                <div className="md:col-span-3">
                  <FormAddressInput<CustomerCreateFormData | CustomerUpdateFormData> name="address" disabled={isSubmitting} required={false} />
                </div>
                <div className="md:col-span-1">
                  <FormAddressNumberInput<CustomerCreateFormData | CustomerUpdateFormData> name="addressNumber" disabled={isSubmitting} />
                </div>
              </div>

              {/* Third row: bairro, complemento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormNeighborhoodInput<CustomerCreateFormData | CustomerUpdateFormData> name="neighborhood" disabled={isSubmitting} />
                <FormAddressComplementInput<CustomerCreateFormData | CustomerUpdateFormData> name="addressComplement" disabled={isSubmitting} />
              </div>
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconTag className="h-5 w-5 text-muted-foreground" />
                Tags
              </CardTitle>
              <CardDescription>Etiquetas para categorizar o cliente</CardDescription>
            </CardHeader>
            <CardContent>
              <TagsInput control={form.control} disabled={isSubmitting} />
            </CardContent>
          </Card>
        </div>
      </form>
    </Form>
  );
}
