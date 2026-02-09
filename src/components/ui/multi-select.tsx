import { ColorMultiSelect, type ColorMultiSelectOption } from "./color-multi-select";

interface MultiSelectProps {
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Simple multi-select wrapper around ColorMultiSelect for backward compatibility
 */
export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  disabled,
  className,
}: MultiSelectProps) {
  const colorOptions: ColorMultiSelectOption[] = options.map((opt) => ({
    value: opt.value,
    label: opt.label,
  }));

  return (
    <ColorMultiSelect
      options={colorOptions}
      value={selected}
      onValueChange={(value) => onChange(value || [])}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
}
