import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";

interface UnicodeCellProps {
  control: any;
  index: number;
}

export function UnicodeCell({ control, index }: UnicodeCellProps) {
  return (
    <Controller
      control={control}
      name={`items.${index}.data.uniCode`}
      render={({ field, fieldState }) => (
        <Input
          value={field.value || ""}
          onChange={(value) => {
            field.onChange(value);
          }}
          name={field.name}
          onBlur={field.onBlur}
          ref={field.ref}
          placeholder="Código único"
          className={`h-10 ${fieldState.error ? "border-destructive" : ""}`}
        />
      )}
    />
  );
}
