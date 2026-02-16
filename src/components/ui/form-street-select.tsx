import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { IconRoad } from "@tabler/icons-react";
import { useFormContext, type Path } from "react-hook-form";

const STREET_TYPES = [
  { value: "STREET", label: "Rua" },
  { value: "AVENUE", label: "Avenida" },
  { value: "ALLEY", label: "Alameda" },
  { value: "CROSSING", label: "Travessa" },
  { value: "SQUARE", label: "Praça" },
  { value: "HIGHWAY", label: "Rodovia" },
  { value: "ROAD", label: "Estrada" },
  { value: "WAY", label: "Via" },
  { value: "PLAZA", label: "Largo" },
  { value: "LANE", label: "Viela" },
  { value: "DEADEND", label: "Beco" },
  { value: "SMALL_STREET", label: "Ruela" },
  { value: "PATH", label: "Caminho" },
  { value: "PASSAGE", label: "Passagem" },
  { value: "GARDEN", label: "Jardim" },
  { value: "BLOCK", label: "Quadra" },
  { value: "LOT", label: "Lote" },
  { value: "SITE", label: "Sítio" },
  { value: "PARK", label: "Parque" },
  { value: "FARM", label: "Fazenda" },
  { value: "RANCH", label: "Chácara" },
  { value: "CONDOMINIUM", label: "Condomínio" },
  { value: "COMPLEX", label: "Conjunto" },
  { value: "RESIDENTIAL", label: "Residencial" },
  { value: "OTHER", label: "Outro" },
] as const;

interface FormStreetSelectProps<T extends Record<string, any>> {
  name?: Path<T>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export function StreetSelect<T extends Record<string, any>>({
  name = "streetType" as Path<T>,
  label = "Logradouro",
  placeholder = "Selecione o tipo",
  disabled = false,
  required = false,
}: FormStreetSelectProps<T>) {
  const form = useFormContext<T>();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconRoad className="h-4 w-4" />
            {label}
            {required && <span className="text-destructive">*</span>}
          </FormLabel>
          <FormControl>
            <Combobox
              value={field.value || undefined}
              onValueChange={(value) => field.onChange(value || null)}
              options={[...STREET_TYPES]}
              placeholder={placeholder}
              disabled={disabled}
              searchable={true}
              clearable={true}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
