import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import type { CustomerCreateFormData, CustomerUpdateFormData } from "@/schemas/customer";

const LOGRADOURO_TYPES = [
  { value: "RUA", label: "Rua" },
  { value: "AVENIDA", label: "Avenida" },
  { value: "ALAMEDA", label: "Alameda" },
  { value: "TRAVESSA", label: "Travessa" },
  { value: "PRACA", label: "Praça" },
  { value: "RODOVIA", label: "Rodovia" },
  { value: "ESTRADA", label: "Estrada" },
  { value: "VIA", label: "Via" },
  { value: "LARGO", label: "Largo" },
  { value: "VIELA", label: "Viela" },
  { value: "BECO", label: "Beco" },
  { value: "RUELA", label: "Ruela" },
  { value: "CAMINHO", label: "Caminho" },
  { value: "PASSAGEM", label: "Passagem" },
  { value: "JARDIM", label: "Jardim" },
  { value: "QUADRA", label: "Quadra" },
  { value: "LOTE", label: "Lote" },
  { value: "SITIO", label: "Sítio" },
  { value: "PARQUE", label: "Parque" },
  { value: "FAZENDA", label: "Fazenda" },
  { value: "CHACARA", label: "Chácara" },
  { value: "CONDOMINIO", label: "Condomínio" },
  { value: "CONJUNTO", label: "Conjunto" },
  { value: "RESIDENCIAL", label: "Residencial" },
  { value: "OUTRO", label: "Outro" },
] as const;

interface LogradouroTypeSelectProps {
  disabled?: boolean;
}

export function LogradouroTypeSelect({ disabled }: LogradouroTypeSelectProps) {
  const form = useFormContext<CustomerCreateFormData | CustomerUpdateFormData>();

  return (
    <FormField
      control={form.control}
      name="streetType"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Tipo de Logradouro</FormLabel>
          <Combobox
            value={field.value || undefined}
            onValueChange={field.onChange}
            options={LOGRADOURO_TYPES}
            placeholder="Selecione o tipo"
            disabled={disabled}
            searchable={true}
            clearable={true}
          />
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
