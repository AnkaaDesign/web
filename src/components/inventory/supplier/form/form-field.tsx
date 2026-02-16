import { useSupplierForm } from "./supplier-form-context";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  name: keyof import("../../../../schemas").SupplierCreateFormData;
  label?: string;
  icon?: React.ReactNode;
  type?: "text" | "email" | "password" | "number" | "decimal" | "currency" | "percentage" | "cpf" | "cnpj" | "cpf-cnpj" | "phone" | "pis" | "cep" | "date" | "time" | "rg" | "plate" | "chassis" | "integer" | "natural";
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  children?: (props: { value: any; onChange: (value: any) => void; onBlur: () => void; error?: string; disabled?: boolean }) => React.ReactNode;
}

export function FormField({ name, label, icon, type = "text", placeholder, disabled, className, required, children }: FormFieldProps) {
  const { getFieldProps, errors, touched, setTouched } = useSupplierForm();
  const fieldProps = getFieldProps(name);
  const showError = touched.has(name) && errors[name];

  const handleBlur = () => {
    fieldProps.onBlur();
    setTouched(name);
  };

  if (children) {
    return (
      <div className={cn("space-y-2", className)}>
        {label && (
          <Label htmlFor={name} className="flex items-center gap-1">
            {icon}
            {label}
            {required && <span className="text-destructive">*</span>}
          </Label>
        )}
        {children({
          ...fieldProps,
          disabled,
        })}
        {showError && <p className="text-sm text-destructive">{errors[name]}</p>}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label htmlFor={name} className="flex items-center gap-1">
          {icon}
          {label}
          {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      <Input
        id={name}
        type={type as any}
        placeholder={placeholder}
        disabled={disabled}
        {...fieldProps}
        value={typeof fieldProps.value === 'string' ? fieldProps.value : Array.isArray(fieldProps.value) ? fieldProps.value[0] || "" : ""}
        onChange={(value) => fieldProps.onChange(typeof value === 'number' ? String(value) : value)}
        onBlur={handleBlur}
      />
      {showError && <p className="text-sm text-destructive">{errors[name]}</p>}
    </div>
  );
}
