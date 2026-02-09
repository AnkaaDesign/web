import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconChevronDown } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface StatusOption {
  value: string;
  label: string;
  color?: string;
  icon?: React.ReactNode;
}

export interface StatusFilterProps {
  value: string[];
  onChange: (selected: string[]) => void;
  options: StatusOption[];
  placeholder?: string;
  className?: string;
  maxHeight?: number;
}

export function StatusFilter({
  value = [],
  onChange,
  options,
  placeholder = "Selecionar status",
  className,
  maxHeight = 300,
}: StatusFilterProps) {
  const [open, setOpen] = useState(false);

  const handleToggle = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  const handleSelectAll = () => {
    if (value.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map((opt) => opt.value));
    }
  };

  const getSelectedLabels = () => {
    if (value.length === 0) return placeholder;
    if (value.length === options.length) return "Todos";
    if (value.length === 1) {
      const option = options.find((opt) => opt.value === value[0]);
      return option?.label || value[0];
    }
    return `${value.length} selecionados`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", className)}
        >
          <span className="truncate">{getSelectedLabels()}</span>
          {value.length > 0 && (
            <Badge variant="secondary" className="ml-2 rounded-sm px-1 font-mono text-xs">
              {value.length}
            </Badge>
          )}
          <IconChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="border-b p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={handleSelectAll}
          >
            <Checkbox
              checked={value.length === options.length}
              className="mr-2"
            />
            Selecionar todos
          </Button>
        </div>
        <ScrollArea style={{ maxHeight: `${maxHeight}px` }}>
          <div className="p-2 space-y-1">
            {options.map((option) => (
              <Button
                key={option.value}
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => handleToggle(option.value)}
              >
                <Checkbox
                  checked={value.includes(option.value)}
                  className="mr-2"
                />
                {option.icon && <span className="mr-2">{option.icon}</span>}
                <span className="flex-1 text-left">{option.label}</span>
                {option.color && (
                  <div
                    className="h-3 w-3 rounded-full ml-2"
                    style={{ backgroundColor: option.color }}
                  />
                )}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
