import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useCallback, useMemo } from "react";
import { Form } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { physicalPersonCreateSchema, physicalPersonUpdateSchema, type PhysicalPersonCreateFormData, type PhysicalPersonUpdateFormData } from "../../../../schemas";

// Import all form components
import { FullNameInput } from "./full-name-input";
import { BirthDateInput } from "./birth-date-input";
import { WebsiteInput } from "./website-input";
import { PhoneArrayInput } from "@/components/ui/phone-array-input";
import { AddressInput } from "@/components/ui/form-address-input";
import { AddressNumberInput } from "@/components/ui/form-address-number-input";
import { AddressComplementInput } from "@/components/ui/form-address-complement-input";
import { NeighborhoodInput } from "@/components/ui/form-neighborhood-input";
import { CityInput } from "@/components/ui/form-city-input";
import { StateSelector } from "@/components/ui/form-state-selector";
import { LogoInput } from "./logo-input";
import { TagsInput } from "./tags-input";

interface BasePhysicalPersonFormProps {
  isSubmitting?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
}

interface CreatePhysicalPersonFormProps extends BasePhysicalPersonFormProps {
  mode: "create";
  onSubmit: (data: PhysicalPersonCreateFormData) => Promise<void>;
  defaultValues?: Partial<PhysicalPersonCreateFormData>;
}

interface UpdatePhysicalPersonFormProps extends BasePhysicalPersonFormProps {
  mode: "update";
  onSubmit: (data: PhysicalPersonUpdateFormData) => Promise<void>;
  defaultValues?: Partial<PhysicalPersonUpdateFormData>;
}

type PhysicalPersonFormProps = CreatePhysicalPersonFormProps | UpdatePhysicalPersonFormProps;

export function PhysicalPersonForm(props: PhysicalPersonFormProps) {
  const { isSubmitting, defaultValues, mode, onDirtyChange } = props;

  // Create a custom resolver for update mode that skips validation for unchanged fields
  const customResolver = useMemo(() => {
    if (mode === "create") {
      return zodResolver(physicalPersonCreateSchema);
    }

    // For update mode, use the update schema
    return zodResolver(physicalPersonUpdateSchema);
  }, [mode]);

  // Default values for create mode
  const createDefaults: PhysicalPersonCreateFormData = {
    fantasyName: "",
    cpf: "",
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
    rg: null,
    birthDate: null,
    ...defaultValues,
  };

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

  // Handle CEP lookup (now handled directly in ZipCodeInput component)
  const handleCepLookup = useCallback(async (_cep: string) => {
    // This is now handled directly in the ZipCodeInput component
    // Keeping this function for backwards compatibility
  }, []);

  const onSubmit = async (data: PhysicalPersonCreateFormData | PhysicalPersonUpdateFormData) => {
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

      if (mode === "create") {
        await (props as CreatePhysicalPersonFormProps).onSubmit(transformedData as PhysicalPersonCreateFormData);
      } else {
        await (props as UpdatePhysicalPersonFormProps).onSubmit(transformedData as PhysicalPersonUpdateFormData);
      }
    } catch (error) {
      // Error is handled by the parent component
    }
  };

  return (
    <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden min-h-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-y-auto space-y-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle>Informações Pessoais</CardTitle>
                <CardDescription>Dados fundamentais da pessoa física</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FullNameInput disabled={isSubmitting} />
                  <FormInput<PhysicalPersonCreateFormData | PhysicalPersonUpdateFormData>
                    type="cpf"
                    name="cpf"
                    label="CPF"
                    required
                    placeholder="000.000.000-00"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormInput<PhysicalPersonCreateFormData | PhysicalPersonUpdateFormData> type="rg" name="rg" label="RG" disabled={isSubmitting} />
                  <BirthDateInput disabled={isSubmitting} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormInput<PhysicalPersonCreateFormData | PhysicalPersonUpdateFormData>
                    name="email"
                    type="email"
                    label="E-mail"
                    placeholder="Digite o e-mail"
                    disabled={isSubmitting}
                  />
                  <WebsiteInput disabled={isSubmitting} />
                </div>
              </CardContent>
            </Card>

            {/* Logo */}
            <Card>
              <CardHeader>
                <CardTitle>Foto/Logo</CardTitle>
                <CardDescription>Imagem pessoal ou logo representativo</CardDescription>
              </CardHeader>
              <CardContent>
                <LogoInput disabled={isSubmitting} existingLogoId={defaultValues?.logoId} />
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Informações de Contato</CardTitle>
                <CardDescription>Telefones e outras formas de contato</CardDescription>
              </CardHeader>
              <CardContent>
                <PhoneArrayInput control={form.control} disabled={isSubmitting} maxPhones={3} placeholder="Ex: (11) 99999-9999" />
              </CardContent>
            </Card>

            {/* Address Information */}
            <Card>
              <CardHeader>
                <CardTitle>Endereço</CardTitle>
                <CardDescription>Localização da pessoa física</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormInput<PhysicalPersonCreateFormData | PhysicalPersonUpdateFormData>
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
            <Card>
              <CardHeader>
                <CardTitle>Tags</CardTitle>
                <CardDescription>Etiquetas para categorizar a pessoa física</CardDescription>
              </CardHeader>
              <CardContent>
                <TagsInput control={form.control} disabled={isSubmitting} />
              </CardContent>
            </Card>

            {/* Hidden submit button that can be triggered by the header button */}
            <button id="physical-person-form-submit" type="submit" className="hidden" disabled={isSubmitting}>
              Submit
            </button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
