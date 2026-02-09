import { useState, useEffect } from "react";
import { useWatch, useFormContext } from "react-hook-form";
import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";


interface CpfCnpjCellProps<_TFieldValues extends FieldValues = FieldValues> {
  control: any;
  index: number;
  disabled?: boolean;
}

type DocumentType = "cpf" | "cnpj";

export function CpfCnpjCell<_TFieldValues extends FieldValues = FieldValues>({ control, index, disabled }: CpfCnpjCellProps<_TFieldValues>) {
  const { setValue, getValues } = useFormContext<TFieldValues>();

  // Watch the current values to determine initial document type
  const watchCpf = useWatch({
    control,
    name: `customers.${index}.data.cpf` as Path<TFieldValues>,
  });
  const watchCnpj = useWatch({
    control,
    name: `customers.${index}.data.cnpj` as Path<TFieldValues>,
  });

  // Initialize document type based on existing values
  const initializeDocumentType = (): DocumentType => {
    const cpfValue = getValues(`customers.${index}.data.cpf` as Path<TFieldValues>);
    const cnpjValue = getValues(`customers.${index}.data.cnpj` as Path<TFieldValues>);

    // If CNPJ has a value and CPF doesn't, show CNPJ
    if (cnpjValue && !cpfValue) {
      return "cnpj";
    }
    // Default to CPF (covers both CPF having value or both being empty)
    return "cpf";
  };

  const [documentType, setDocumentType] = useState<DocumentType>(initializeDocumentType);

  useEffect(() => {
    // Only update if the values actually changed and there's a clear preference
    if (watchCnpj && !watchCpf) {
      setDocumentType("cnpj");
    } else if (watchCpf && !watchCnpj) {
      setDocumentType("cpf");
    }
  }, [watchCpf, watchCnpj]);

  const handleDocumentTypeChange = (value: string) => {
    if (value === "cpf" || value === "cnpj") {
      setDocumentType(value);
      // Clear the other field when switching using proper form methods
      if (value === "cpf") {
        setValue(`customers.${index}.data.cnpj` as Path<TFieldValues>, null as any);
      } else {
        setValue(`customers.${index}.data.cpf` as Path<TFieldValues>, null as any);
      }
    }
  };

  return (
    <div className="flex gap-2">
      <Combobox
        value={documentType}
        onValueChange={(value) => handleDocumentTypeChange(value as "cpf" | "cnpj")}
        options={[
          { label: "CPF", value: "cpf" },
          { label: "CNPJ", value: "cnpj" },
        ]}
        disabled={disabled}
        className="w-28 h-8 border-muted-foreground/20"
        searchable={false}
        clearable={false}
      />

      <div className="flex-1">
        {documentType === "cpf" ? (
          <FormField
            control={control}
            name={`customers.${index}.data.cpf` as unknown as Path<TFieldValues>}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    type="cpf"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    disabled={disabled}
                    onBlur={field.onBlur}
                    placeholder="000.000.000-00"
                    className="h-8 border-muted-foreground/20"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <FormField
            control={control}
            name={`customers.${index}.data.cnpj` as unknown as Path<TFieldValues>}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    type="cnpj"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    disabled={disabled}
                    onBlur={field.onBlur}
                    placeholder="00.000.000/0000-00"
                    className="h-8 border-muted-foreground/20"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
    </div>
  );
}
