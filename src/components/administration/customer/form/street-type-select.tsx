import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { IconRoad } from "@tabler/icons-react";
import type { CustomerCreateFormData, CustomerUpdateFormData } from "@/schemas/customer";

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

interface StreetTypeSelectProps {
  disabled?: boolean;
}

export function StreetTypeSelect({ disabled }: StreetTypeSelectProps) {
  const form = useFormContext<CustomerCreateFormData | CustomerUpdateFormData>();

  return (
    <FormField
      control={form.control}
      name="streetType"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="flex items-center gap-2">
            <IconRoad className="h-4 w-4" />
            Logradouro
          </FormLabel>
          <Combobox
            value={field.value || undefined}
            onValueChange={field.onChange}
            options={STREET_TYPES}
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