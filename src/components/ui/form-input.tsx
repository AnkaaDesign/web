import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input, type InputProps } from "@/components/ui/input";
import {
  IconBuilding,
  IconIdBadge2,
  IconPhone,
  IconMail,
  IconCreditCard,
  IconPercentage,
  IconCurrencyReal,
  IconCalendar,
  IconClock,
  IconIdBadge,
  IconCar,
  IconHome,
  IconLoader2,
} from "@tabler/icons-react";
import { useFormContext, type Path } from "react-hook-form";
import { cn } from "@/lib/utils";
import React from "react";

interface FormInputProps<T extends Record<string, any>> extends Omit<InputProps, "name" | "value" | "onChange"> {
  name: Path<T>;
  label?: string | React.ReactNode;
  description?: string;
  required?: boolean;
  icon?: boolean;
  // CEP-specific props
  addressFieldName?: Path<T>;
  neighborhoodFieldName?: Path<T>;
  cityFieldName?: Path<T>;
  stateFieldName?: Path<T>;
}

const typeIcons = {
  cpf: IconIdBadge2,
  cnpj: IconBuilding,
  "cpf-cnpj": IconIdBadge2,
  phone: IconPhone,
  email: IconMail,
  pis: IconCreditCard,
  percentage: IconPercentage,
  currency: IconCurrencyReal,
  date: IconCalendar,
  time: IconClock,
  rg: IconIdBadge,
  plate: IconCar,
  cep: IconHome,
} as const;

export function FormInput<T extends Record<string, any>>({
  name,
  label,
  description,
  required = false,
  icon = true,
  className,
  type = "text",
  documentType,
  addressFieldName,
  neighborhoodFieldName,
  cityFieldName,
  stateFieldName,
  ...props
}: FormInputProps<T>) {
  const form = useFormContext<T>();
  const [cepLoading, setCepLoading] = React.useState(false);
  const IconComponent = icon && type && type in typeIcons ? typeIcons[type as keyof typeof typeIcons] : null;

  // For cpf-cnpj type, use the appropriate icon based on documentType
  const displayIcon = type === "cpf-cnpj" && documentType ? (documentType === "cnpj" ? IconBuilding : IconIdBadge2) : IconComponent;

  // Handle CEP lookup callback
  const handleCepLookup = React.useCallback(
    (data: any) => {
      if (type === "cep" && data && !data.erro) {
        // Auto-fill address fields
        if (data.logradouro && addressFieldName) {
          form.setValue(addressFieldName, data.logradouro as any, { shouldDirty: true });
        }
        if (data.bairro && neighborhoodFieldName) {
          form.setValue(neighborhoodFieldName, data.bairro as any, { shouldDirty: true });
        }
        if (data.localidade && cityFieldName) {
          form.setValue(cityFieldName, data.localidade as any, { shouldDirty: true });
        }
        if (data.uf && stateFieldName) {
          form.setValue(stateFieldName, data.uf as any, { shouldDirty: true });
        }
      }
    },
    [type, form, addressFieldName, neighborhoodFieldName, cityFieldName, stateFieldName],
  );

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          {label && (
            <FormLabel className="flex items-center gap-2">
              {typeof label === "string" ? (
                <>
                  {displayIcon && React.createElement(displayIcon, { className: "h-4 w-4" })}
                  {label}
                  {required && <span className="text-destructive">*</span>}
                  {type === "cep" && cepLoading && <IconLoader2 className="h-3 w-3 animate-spin" />}
                </>
              ) : (
                label
              )}
            </FormLabel>
          )}
          <FormControl>
            <Input
              {...field}
              type={type}
              value={field.value ?? ""}
              onChange={(newValue) => {
                // Use field.onChange directly to preserve RHF context
                field.onChange(newValue);
                // Explicitly mark as dirty and trigger validation
                form.setValue(name, newValue, { shouldDirty: true, shouldValidate: true });
              }}
              documentType={documentType}
              disabled={props.disabled}
              onCepLookup={type === "cep" ? handleCepLookup : undefined}
              showCepLoading={type === "cep"}
              transparent={true}
              {...props}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
