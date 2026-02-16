import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Combobox } from "@/components/ui/combobox";
import { SERVICE_ORDER_TYPE } from "@/constants/enums";
import { getServiceDescriptionsByType } from "@/constants/service-descriptions";

interface ServiceDescriptionInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Filter descriptions by service order type */
  type?: SERVICE_ORDER_TYPE;
  className?: string;
  hasError?: boolean;
}

export function ServiceDescriptionInput({
  value,
  onChange,
  disabled,
  placeholder = "Selecione o serviço...",
  type = SERVICE_ORDER_TYPE.PRODUCTION,
  className,
  hasError,
}: ServiceDescriptionInputProps) {
  // Get descriptions for the selected type from enums
  const descriptions = useMemo(() => {
    return getServiceDescriptionsByType(type);
  }, [type]);

  // Convert descriptions to combobox options
  const options = useMemo(() => {
    return descriptions.map((description) => ({
      value: description,
      label: description,
    }));
  }, [descriptions]);

  return (
    <div className={cn("relative", className)}>
      <Combobox
        value={value || ""}
        onValueChange={(val) => onChange(String(val || ""))}
        disabled={disabled}
        options={options}
        placeholder={placeholder}
        searchable={true}
        clearable={true}
        className={cn("w-full", hasError && "border-destructive ring-destructive")}
      />
    </div>
  );
}
