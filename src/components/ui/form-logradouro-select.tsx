import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";

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

interface LogradouroSelectProps<T extends Record<string, any>> {
  disabled?: boolean;
  fieldName?: keyof T;
}

export function LogradouroSelect<T extends Record<string, any>>({
  disabled,
  fieldName = "logradouro" as keyof T,
}: LogradouroSelectProps<T>) {
  const form = useFormContext<T>();

  return (
    <FormField
      control={form.control}
      name={fieldName as any}
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
