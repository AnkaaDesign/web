import { useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconBuilding, IconMail, IconMapPin, IconGlobe, IconFileText } from "@tabler/icons-react";
import { supplierCreateSchema, supplierUpdateSchema, type SupplierCreateFormData, type SupplierUpdateFormData } from "../../../../schemas";
import { SupplierFormProvider, useSupplierForm } from "./supplier-form-context";
import { FormField } from "./form-field";
import { PhoneArrayInput } from "./phone-array-input-custom";
import { LogoInput } from "./logo-input-custom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { BRAZILIAN_STATES } from "../../../../constants";
import { cleanCNPJ, formatCNPJ } from "../../../../utils";
import { toast } from "sonner";
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

function SupplierFormContent({ isSubmitting }: { isSubmitting?: boolean }) {
  const { values, setValue, errors, isSubmitting: formSubmitting, touched, setTouched } = useSupplierForm();
  const loading = isSubmitting || formSubmitting;

  // Check if form has errors
  // Handle CNPJ formatting
  const handleCNPJChange = (value: string) => {
    const cleaned = cleanCNPJ(value);
    const formatted = formatCNPJ(cleaned);
    setValue("cnpj", formatted || null);
  };

  // Handle CEP lookup
  const handleCepLookup = useCallback(
    async (cep: string) => {
      if (!cep || cep.length !== 9) return; // Format: 00000-000

      try {
        const cleanCep = cep.replace(/\D/g, "");
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();

        if (data.erro) {
          toast.error("CEP não encontrado");
          return;
        }

        // Update form with address data
        setValue("address", data.logradouro || null);
        setValue("neighborhood", data.bairro || null);
        setValue("city", data.localidade || null);
        setValue("state", data.uf || null);
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error("Failed to fetch CEP:", error);
        }
      }
    },
    [setValue],
  );

  return (
    <div className="space-y-6 flex-1 overflow-y-auto p-4">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Básicas</CardTitle>
          <CardDescription>Dados fundamentais do fornecedor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              name="fantasyName"
              label="Nome Fantasia"
              icon={<IconBuilding className="h-4 w-4" />}
              placeholder="Nome comercial do fornecedor"
              disabled={loading}
              required
            />

            <FormField name="corporateName" label="Razão Social" icon={<IconFileText className="h-4 w-4" />} placeholder="Razão social completa" disabled={loading} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <IconFileText className="h-4 w-4" />
                CNPJ
              </Label>
              <Input
                value={values.cnpj ?? ""}
                onChange={(value) => {
                  handleCNPJChange(typeof value === 'string' ? value : String(value || ''));
                  setTouched("cnpj");
                }}
                onBlur={() => setTouched("cnpj")}
                placeholder="00.000.000/0000-00"
                disabled={loading}
              />
              {touched.has("cnpj") && errors.cnpj && <p className="text-sm text-destructive">{errors.cnpj}</p>}
            </div>

            <FormField name="email" label="E-mail" icon={<IconMail className="h-4 w-4" />} type="email" placeholder="email@exemplo.com" disabled={loading} />
          </div>

          <FormField name="site" label="Website" icon={<IconGlobe className="h-4 w-4" />} placeholder="https://www.exemplo.com" disabled={loading} />
        </CardContent>
      </Card>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>Imagem do logo do fornecedor</CardDescription>
        </CardHeader>
        <CardContent>
          <LogoInput disabled={loading} existingLogoId={values.logoId} />
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Informações de Contato</CardTitle>
          <CardDescription>Telefones e outras formas de contato</CardDescription>
        </CardHeader>
        <CardContent>
          <PhoneArrayInput disabled={loading} />
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
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <IconMapPin className="h-4 w-4" />
                CEP
              </Label>
              <Input
                value={values.zipCode ?? ""}
                onChange={(value) => {
                  const strValue = typeof value === 'string' ? value : String(value || '');
                  const digitsOnly = strValue.replace(/\D/g, "");
                  let formatted = digitsOnly;
                  if (digitsOnly.length > 5) {
                    formatted = `${digitsOnly.slice(0, 5)}-${digitsOnly.slice(5, 8)}`;
                  }
                  setValue("zipCode", formatted || null);
                  if (formatted.length === 9) {
                    handleCepLookup(formatted);
                  }
                }}
                placeholder="00000-000"
                disabled={loading}
              />
            </div>

            <FormField name="address" label="Endereço" icon={<IconMapPin className="h-4 w-4" />} placeholder="Rua, Avenida..." disabled={loading} />

            <FormField name="addressNumber" label="Número" placeholder="123" disabled={loading} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField name="addressComplement" label="Complemento" placeholder="Apto, Bloco, Sala..." disabled={loading} />

            <FormField name="neighborhood" label="Bairro" placeholder="Nome do bairro" disabled={loading} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField name="city" label="Cidade" icon={<IconMapPin className="h-4 w-4" />} placeholder="Nome da cidade" disabled={loading} />

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <IconMapPin className="h-4 w-4" />
                Estado
              </Label>
              <Combobox
                value={values.state ?? ""}
                onValueChange={(value) => setValue("state", typeof value === 'string' ? value : (value ? null : null))}
                disabled={loading}
                options={Object.entries(BRAZILIAN_STATES).map(([code, name]) => ({
                  label: name,
                  value: code,
                }))}
                placeholder="Selecione o estado"
                searchPlaceholder="Buscar estado..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit button - disable if loading or form is invalid */}
      <button id="supplier-form-submit" type="submit" className="hidden" disabled={loading || !values.fantasyName || values.fantasyName.trim() === ""}>
        Submit
      </button>
    </div>
  );
}

export function SupplierForm(props: SupplierFormProps) {
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
    tags: [],
    logoId: null,
    ...defaultValues,
  };

  const initialValues = mode === "create" ? createDefaults : (defaultValues as any);

  const handleSubmit = async (values: any) => {
    try {
      // Validate with schema
      const schema = mode === "create" ? supplierCreateSchema : supplierUpdateSchema;
      const result = schema.safeParse(values);
      if (result.success) {
      }

      if (!result.success) {
        // Show first error
        const firstError = result.error.errors[0];
        toast.error(firstError.message);
        return;
      }

      // Submit validated data
      await props.onSubmit(result.data as any);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Form submission error:", error);
      }
      // Parent component handles the error
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <SupplierFormProvider initialValues={initialValues} onSubmit={handleSubmit} mode={mode} onDirtyChange={onDirtyChange}>
        <SupplierFormContent isSubmitting={isSubmitting} />
      </SupplierFormProvider>
    </Card>
  );
}
