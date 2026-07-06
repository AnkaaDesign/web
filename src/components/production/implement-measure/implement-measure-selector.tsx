import { useState } from "react";
import { ChevronDown, Layout as LayoutIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useImplementMeasureList } from "../../../hooks";
import type { ImplementMeasure, ImplementMeasureSection } from "@/types";

interface ImplementMeasureSelectorProps {
  value?: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  onCreateClick?: () => void;
  side?: "left" | "right" | "back";
}

export function ImplementMeasureSelector({
  value,
  onValueChange,
  placeholder = "Selecione uma medida",
  disabled = false,
  allowCreate = false,
  onCreateClick,
  side,
}: ImplementMeasureSelectorProps) {
  const [open, setOpen] = useState(false);

  const { data: layouts, isLoading } = useImplementMeasureList({
    limit: 50,
    orderBy: { height: "asc" },
  });

  const selectedLayout = layouts?.data?.find((layout: ImplementMeasure) => layout.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between", !value && "text-muted-foreground")}
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            <LayoutIcon className="h-4 w-4" />
            {selectedLayout ? (
              <span className="truncate">
                {selectedLayout.height}m × {selectedLayout.sections?.[0]?.width || 0}m
                {selectedLayout.sections?.length && selectedLayout.sections.length > 1 && ` (+${selectedLayout.sections.length - 1})`}
              </span>
            ) : (
              placeholder
            )}
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar medida..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Carregando..." : "Nenhuma medida encontrada."}
            </CommandEmpty>
            {layouts?.data && layouts.data.length > 0 && (
              <CommandGroup>
                {layouts.data.map((layout: ImplementMeasure) => (
                  <CommandItem
                    key={layout.id}
                    value={layout.id}
                    onSelect={() => {
                      onValueChange(layout.id === value ? null : layout.id);
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {layout.height}m × {layout.sections?.[0]?.width || 0}m
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {(layout.sections?.length || 0)} seção{(layout.sections?.length || 0) !== 1 ? "ões" : ""}
                          {layout.sections?.some((section: ImplementMeasureSection) => section.isDoor) && " • Com porta"}
                        </span>
                      </div>
                      {value === layout.id && (
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {allowCreate && (
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    onCreateClick?.();
                    setOpen(false);
                  }}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Criar nova medida{side ? ` ${side === "left" ? "esquerda" : side === "right" ? "direita" : "traseira"}` : ""}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}