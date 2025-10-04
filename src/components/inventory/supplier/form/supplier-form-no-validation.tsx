import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { Form } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type SupplierCreateFormData, type SupplierUpdateFormData } from "../../../../schemas";

// Import all form components
import { FantasyNameInput } from "./fantasy-name-input";
import { CorporateNameInput } from "./corporate-name-input";
import { WebsiteInput } from "./website-input";
import { PhoneArrayInput } from "@/components/ui/phone-array-input";
import { AddressInput } from "./address-input";
import { AddressNumberInput } from "./address-number-input";
import { AddressComplementInput } from "./address-complement-input";
import { NeighborhoodInput } from "./neighborhood-input";
import { CityInput } from "./city-input";
import { SupplierStateSelector } from "./state-selector";
import { LogoInput } from "./logo-input";
import { FormInput } from "@/components/ui/form-input";

interface BaseSupplierFormProps {
  isSubmitting?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
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

export function SupplierFormNoValidation(props: SupplierFormProps) {
  const { isSubmitting, defaultValues, mode, onDirtyChange } = props;

  // Default values for create mode
  const createDefaults: SupplierCreateFormData = {
    fantasyName: "",
    cnpj: null,
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
    logoId: null,
    ...defaultValues,
  };

  // Create form WITHOUT zodResolver for update mode to avoid validation on unchanged fields
  const form = useForm({
    // NO RESOLVER for update mode - we'll validate manually only changed fields
    resolver: mode === "create" ? undefined : undefined,
    defaultValues: mode === "create" ? createDefaults : defaultValues,
    mode: "onChange",
  });

  // Watch form state for dirty tracking
  const watchedValues = form.watch();

  useEffect(() => {
    if (onDirtyChange && mode === "update") {
      const isDirty = form.formState.isDirty;
      onDirtyChange(isDirty);
    }
  }, [watchedValues, form.formState.isDirty, onDirtyChange, mode]);

  const onSubmit = async (data: SupplierCreateFormData | SupplierUpdateFormData) => {
    try {
      if (mode === "create") {
        await (props as CreateSupplierFormProps).onSubmit(data as SupplierCreateFormData);
      } else {
        await (props as UpdateSupplierFormProps).onSubmit(data as SupplierUpdateFormData);
      }
    } catch (error) {
      // Error is handled by the parent component
      console.error("Error submitting supplier form:", error);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex-1 overflow-y-auto p-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>Dados fundamentais do fornecedor</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FantasyNameInput disabled={isSubmitting} />
                <CorporateNameInput disabled={isSubmitting} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormInput<SupplierCreateFormData | SupplierUpdateFormData> name="cnpj" type="cnpj" label="CNPJ" disabled={isSubmitting} />
                <FormInput<SupplierCreateFormData | SupplierUpdateFormData>
                  name="email"
                  type="email"
                  label="E-mail"
                  placeholder="contato@fornecedor.com.br"
                  disabled={isSubmitting}
                />
              </div>

              <WebsiteInput disabled={isSubmitting} />
            </CardContent>
          </Card>

          {/* Logo */}
          <Card>
            <CardHeader>
              <CardTitle>Logo</CardTitle>
              <CardDescription>Imagem do logo do fornecedor</CardDescription>
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
              <PhoneArrayInput control={form.control} disabled={isSubmitting} />
            </CardContent>
          </Card>

          {/* Address Information */}
          <Card>
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
                />
                <AddressInput disabled={isSubmitting} useGooglePlaces={!!import.meta.env.VITE_GOOGLE_MAPS_API_KEY} />
                <AddressNumberInput disabled={isSubmitting} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <AddressComplementInput disabled={isSubmitting} />
                <NeighborhoodInput disabled={isSubmitting} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <CityInput disabled={isSubmitting} />
                <SupplierStateSelector disabled={isSubmitting} />
              </div>
            </CardContent>
          </Card>

          {/* Hidden submit button that can be triggered by the header button */}
          <button id="supplier-form-submit" type="submit" className="hidden" disabled={isSubmitting}>
            Submit
          </button>
        </form>
      </Form>
    </Card>
  );
}
