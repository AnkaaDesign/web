import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useCallback, useMemo } from "react";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { legalPersonCreateSchema, legalPersonUpdateSchema, type LegalPersonCreateFormData, type LegalPersonUpdateFormData } from "../../../../schemas";

// Import form components
import { FantasyNameInput } from "./fantasy-name-input";
import { CorporateNameInput } from "./corporate-name-input";
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

interface BaseLegalPersonFormProps {
  isSubmitting?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
}

interface CreateLegalPersonFormProps extends BaseLegalPersonFormProps {
  mode: "create";
  onSubmit: (data: LegalPersonCreateFormData) => Promise<void>;
  defaultValues?: Partial<LegalPersonCreateFormData>;
}

interface UpdateLegalPersonFormProps extends BaseLegalPersonFormProps {
  mode: "update";
  onSubmit: (data: LegalPersonUpdateFormData) => Promise<void>;
  defaultValues?: Partial<LegalPersonUpdateFormData>;
}

type LegalPersonFormProps = CreateLegalPersonFormProps | UpdateLegalPersonFormProps;

export function LegalPersonForm(props: LegalPersonFormProps) {
  const { isSubmitting, defaultValues, mode, onDirtyChange } = props;

  // Create a custom resolver for update mode that skips validation for unchanged fields
  const customResolver = useMemo(() => {
    if (mode === "create") {
      return zodResolver(legalPersonCreateSchema);
    }

    // For update mode, use the update schema
    return zodResolver(legalPersonUpdateSchema);
  }, [mode]);

  // Default values for create mode
  const createDefaults: LegalPersonCreateFormData = {
    fantasyName: "",
    corporateName: "",
    cnpj: "",
    email: null,
    website: null,
    address: null,
    addressNumber: null,
    addressComplement: null,
    neighborhood: null,
    city: null,
    state: null,
    zipCode: null,
    phones: [],
    logoId: null,
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

  const handleSubmit = useCallback(
    async (data: LegalPersonCreateFormData | LegalPersonUpdateFormData) => {
      try {
        await props.onSubmit(data as any);
      } catch (error) {
        // Error handling is managed by the parent component
        console.error("Form submission error:", error);
      }
    },
    [props],
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle>Informações da Empresa</CardTitle>
            <CardDescription>Dados básicos da pessoa jurídica</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FantasyNameInput />
              <CorporateNameInput />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput name="cnpj" type="cnpj" label="CNPJ" placeholder="00.000.000/0000-00" required={true} />
              <LogoInput />
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Informações de Contato</CardTitle>
            <CardDescription>Dados de contato da empresa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput<LegalPersonCreateFormData | LegalPersonUpdateFormData> name="email" type="email" label="E-mail" placeholder="Digite o e-mail" disabled={isSubmitting} />
              <WebsiteInput />
            </div>
            <PhoneArrayInput control={form.control} disabled={isSubmitting} maxPhones={3} />
          </CardContent>
        </Card>

        {/* Address Information */}
        <Card>
          <CardHeader>
            <CardTitle>Endereço</CardTitle>
            <CardDescription>Endereço da empresa</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <AddressInput />
              </div>
              <AddressNumberInput />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AddressComplementInput />
              <NeighborhoodInput />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <CityInput />
              <StateSelector />
              <FormInput<LegalPersonCreateFormData | LegalPersonUpdateFormData>
                type="cep"
                name="zipCode"
                label="CEP"
                addressFieldName="address"
                neighborhoodFieldName="neighborhood"
                cityFieldName="city"
                stateFieldName="state"
              />
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
