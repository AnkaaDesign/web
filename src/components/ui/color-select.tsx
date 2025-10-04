import React from "react";
import { Combobox, type ComboboxOption } from "./combobox";

export interface ColorSelectOption extends ComboboxOption {
  color: string;
}

interface ColorSelectProps {
  options: ColorSelectOption[];
  value?: string;
  onValueChange?: (value: string | undefined) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  searchable?: boolean;
}

export function ColorSelect({
  options,
  value,
  onValueChange,
  placeholder = "Selecione uma opção",
  emptyText = "Nenhuma opção encontrada",
  className,
  disabled = false,
  searchable = true,
}: ColorSelectProps) {
  const renderOption = React.useCallback((option: ColorSelectOption, isSelected: boolean) => {
    return (
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded border border-gray-300 shadow-sm flex-shrink-0" style={{ backgroundColor: option.color }} />
        <div className="flex-1">
          <div className="font-medium">{option.label}</div>
          {option.description && <div className="text-xs text-muted-foreground">{option.description}</div>}
        </div>
      </div>
    );
  }, []);

  const renderValue = React.useCallback((option: ColorSelectOption | undefined) => {
    if (!option) return null;

    return (
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded border border-gray-300" style={{ backgroundColor: option.color }} />
        <span>{option.label}</span>
      </div>
    );
  }, []);

  return (
    <Combobox
      mode="single"
      options={options}
      value={value}
      onValueChange={(newValue) => onValueChange?.(newValue as string | undefined)}
      placeholder={placeholder}
      emptyText={emptyText}
      className={className}
      disabled={disabled}
      searchable={searchable}
      clearable={true}
      renderOption={renderOption}
      renderValue={renderValue}
    />
  );
}
