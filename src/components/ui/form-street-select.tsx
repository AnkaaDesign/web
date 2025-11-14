import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";

const STREET_TYPES = [
  { value: "STREET", label: "Street" },
  { value: "AVENUE", label: "Avenue" },
  { value: "ALLEY", label: "Alley" },
  { value: "CROSSING", label: "Crossing" },
  { value: "SQUARE", label: "Square" },
  { value: "HIGHWAY", label: "Highway" },
  { value: "ROAD", label: "Road" },
  { value: "WAY", label: "Way" },
  { value: "PLAZA", label: "Plaza" },
  { value: "LANE", label: "Lane" },
  { value: "DEADEND", label: "Deadend" },
  { value: "SMALL_STREET", label: "Small Street" },
  { value: "PATH", label: "Path" },
  { value: "PASSAGE", label: "Passage" },
  { value: "GARDEN", label: "Garden" },
  { value: "BLOCK", label: "Block" },
  { value: "LOT", label: "Lot" },
  { value: "SITE", label: "Site" },
  { value: "PARK", label: "Park" },
  { value: "FARM", label: "Farm" },
  { value: "RANCH", label: "Ranch" },
  { value: "CONDOMINIUM", label: "Condominium" },
  { value: "COMPLEX", label: "Complex" },
  { value: "RESIDENTIAL", label: "Residential" },
  { value: "OTHER", label: "Other" },
] as const;

interface StreetSelectProps<T extends Record<string, any>> {
  disabled?: boolean;
  fieldName?: keyof T;
}

export function StreetSelect<T extends Record<string, any>>({
  disabled,
  fieldName = "streetType" as keyof T,
}: StreetSelectProps<T>) {
  const form = useFormContext<T>();

  return (
    <FormField
      control={form.control}
      name={fieldName as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Street Type</FormLabel>
          <Combobox
            value={field.value || undefined}
            onValueChange={field.onChange}
            options={STREET_TYPES}
            placeholder="Select type"
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