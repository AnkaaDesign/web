import React from "react";
import { Combobox, type ComboboxOption } from "./combobox";
import { Badge } from "./badge";
import { IconX } from "@tabler/icons-react";

export interface ColorMultiSelectOption extends ComboboxOption {
  color?: string;
}

interface ColorMultiSelectProps {
  options: ColorMultiSelectOption[];
  value?: string[];
  onValueChange?: (value: string[] | undefined) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  searchable?: boolean;
  onSearchChange?: (search: string) => void;
  itemLabel?: string; // e.g., "tinta", "item", "opção"
}

export function ColorMultiSelect({
  options,
  value = [],
  onValueChange,
  placeholder = "Selecione opções",
  emptyText = "Nenhuma opção encontrada",
  className,
  disabled = false,
  searchable = true,
  onSearchChange: _onSearchChange,
  itemLabel = "item",
}: ColorMultiSelectProps) {
  const renderOption = React.useCallback((option: ColorMultiSelectOption, _isSelected: boolean) => {
    return (
      <div className="flex items-center gap-2">
        {option.color && <div className="w-5 h-5 rounded border border-gray-300 shadow-sm flex-shrink-0" style={{ backgroundColor: option.color }} />}
        <div className="flex-1">
          <div className="font-medium">{option.label}</div>
          {option.description && <div className="text-xs text-muted-foreground">{option.description}</div>}
        </div>
      </div>
    );
  }, []);

  const renderValue = React.useCallback(
    (selectedOptions: ColorMultiSelectOption[]) => {
      if (!selectedOptions || selectedOptions.length === 0) {
        return <span className="text-muted-foreground group-hover:text-inherit group-data-[state=open]:text-inherit">{placeholder}</span>;
      }

      const count = selectedOptions.length;
      const pluralLabel = itemLabel === "tinta" ? "tintas" : `${itemLabel}s`;
      return count === 1 ? `1 ${itemLabel} selecionada` : `${count} ${pluralLabel} selecionadas`;
    },
    [placeholder, itemLabel],
  );

  // Custom badge rendering with color dots
  const renderBadges = React.useCallback(() => {
    if (!value || value.length === 0) return null;

    const selectedOptions = options.filter((option) => value.includes(option.value));

    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {selectedOptions.map((option) => (
          <Badge
            key={option.value}
            variant="secondary"
            className="text-xs flex items-center gap-1 cursor-pointer group hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => {
              const newValue = value.filter((v) => v !== option.value);
              onValueChange?.(newValue.length > 0 ? newValue : undefined);
            }}
          >
            {option.color && <div className="w-3 h-3 rounded-full border border-gray-200" style={{ backgroundColor: option.color }} />}
            {option.label}
            <IconX className="ml-1 h-3 w-3 opacity-50 group-hover:opacity-100" />
          </Badge>
        ))}
      </div>
    );
  }, [value, options, onValueChange]);

  return (
    <div className={className}>
      <Combobox
        mode="multiple"
        options={options}
        value={value}
        onValueChange={(newValue) => onValueChange?.(newValue as string[] | undefined)}
        placeholder={placeholder}
        emptyText={emptyText}
        disabled={disabled}
        searchable={searchable}
        showCount={false}
        singleMode={true}
        renderOption={renderOption}
        renderValue={renderValue}
      />
      {renderBadges()}
    </div>
  );
}
