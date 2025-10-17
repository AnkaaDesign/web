import { useState, useEffect } from "react";
import { FormItem, FormLabel, FormField, FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { IconIdBadge2, IconBuilding } from "@tabler/icons-react";
import { useFormContext, type Path } from "react-hook-form";

interface FormDocumentInputProps<T extends Record<string, any>> {
  cpfFieldName: Path<T>;
  cnpjFieldName: Path<T>;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  defaultDocumentType?: "cpf" | "cnpj";
}

export function FormDocumentInput<T extends Record<string, any>>({
  cpfFieldName,
  cnpjFieldName,
  label = "Documento",
  disabled = false,
  required = false,
  className,
  defaultDocumentType = "cnpj",
}: FormDocumentInputProps<T>) {
  const form = useFormContext<T>();
  const [documentType, setDocumentType] = useState<"cpf" | "cnpj">(defaultDocumentType);

  // Watch both fields to determine which type is filled
  const cpfValue = form.watch(cpfFieldName);
  const cnpjValue = form.watch(cnpjFieldName);

  // Auto-detect document type based on existing values
  useEffect(() => {
    if (cpfValue && !cnpjValue) {
      setDocumentType("cpf");
    } else if (cnpjValue && !cpfValue) {
      setDocumentType("cnpj");
    }
  }, [cpfValue, cnpjValue]);

  const handleDocumentTypeChange = (newType: "cpf" | "cnpj") => {
    setDocumentType(newType);

    // Clear the other field when switching document types
    if (newType === "cpf") {
      form.setValue(cnpjFieldName, null as any, { shouldValidate: true });
      form.clearErrors(cnpjFieldName);
    } else {
      form.setValue(cpfFieldName, null as any, { shouldValidate: true });
      form.clearErrors(cpfFieldName);
    }
  };

  // Get error messages from both fields
  const cpfError = form.formState.errors[cpfFieldName];
  const cnpjError = form.formState.errors[cnpjFieldName];
  const hasError = !!(cpfError || cnpjError);

  // Get the appropriate error message, prioritizing field-specific errors
  let errorMessage = "";
  if (documentType === "cpf" && cpfError?.message) {
    errorMessage = typeof cpfError.message === "string" ? cpfError.message : "";
  } else if (documentType === "cnpj" && cnpjError?.message) {
    errorMessage = typeof cnpjError.message === "string" ? cnpjError.message : "";
  } else if (cnpjError?.message && typeof cnpjError.message === "string") {
    // Schema refinement errors are typically attached to cnpj field
    errorMessage = cnpjError.message;
  } else if (cpfError?.message && typeof cpfError.message === "string") {
    errorMessage = cpfError.message;
  }

  return (
    <FormItem className={className}>
      <FormLabel className="flex items-center gap-2">
        {documentType === "cpf" ? <IconIdBadge2 className="h-4 w-4" /> : <IconBuilding className="h-4 w-4" />}
        {label}
        {required && <span className="text-destructive">*</span>}
      </FormLabel>

      {/* Document Type Selector and Input in a row */}
      <div className="flex gap-2">
        <Combobox
          value={documentType}
          onValueChange={(value) => handleDocumentTypeChange(value as "cpf" | "cnpj")}
          options={[
            { label: "CPF", value: "cpf" },
            { label: "CNPJ", value: "cnpj" },
          ]}
          disabled={disabled}
          className="w-32"
          searchable={false}
          clearable={false}
        />

        {/* CPF Input */}
        {documentType === "cpf" && (
          <FormField
            control={form.control}
            name={cpfFieldName}
            render={({ field: { value, onChange, ...field } }) => (
              <div className="flex-1">
                <FormControl>
                  <Input
                    {...field}
                    type="cpf"
                    value={value ?? ""}
                    onChange={(newValue) => {
                      onChange(newValue);
                    }}
                    placeholder="000.000.000-00"
                    disabled={disabled}
                    transparent={true}
                  />
                </FormControl>
              </div>
            )}
          />
        )}

        {/* CNPJ Input */}
        {documentType === "cnpj" && (
          <FormField
            control={form.control}
            name={cnpjFieldName}
            render={({ field: { value, onChange, ...field } }) => (
              <div className="flex-1">
                <FormControl>
                  <Input
                    {...field}
                    type="cnpj"
                    value={value ?? ""}
                    onChange={(newValue) => {
                      onChange(newValue);
                    }}
                    placeholder="00.000.000/0000-00"
                    disabled={disabled}
                    transparent={true}
                  />
                </FormControl>
              </div>
            )}
          />
        )}
      </div>

      {/* Display error message for the currently active field */}
      {hasError && errorMessage && <p className="text-sm font-medium text-destructive mt-1">{errorMessage}</p>}
    </FormItem>
  );
}
