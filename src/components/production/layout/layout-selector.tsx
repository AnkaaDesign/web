import { useState } from "react";
import { ChevronDown, Layout, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useLayoutList } from "../../../hooks";

interface LayoutSelectorProps {
  value?: string | null;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  onCreateClick?: () => void;
  side?: "left" | "right" | "back";
}

export function LayoutSelector({
  value,
  onValueChange,
  placeholder = "Selecione um layout",
  disabled = false,
  allowCreate = false,
  onCreateClick,
  side,
}: LayoutSelectorProps) {
  const [open, setOpen] = useState(false);

  const { data: layouts, isLoading } = useLayoutList({
    limit: 50,
    orderBy: { height: "asc" },
  });

  const selectedLayout = layouts?.data?.find((layout) => layout.id === value);

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
            <Layout className="h-4 w-4" />
            {selectedLayout ? (
              <span className="truncate">
                {selectedLayout.height}m × {selectedLayout.layoutSections?.[0]?.width || 0}m
                {selectedLayout.layoutSections?.length > 1 && ` (+${selectedLayout.layoutSections.length - 1})`}
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
          <CommandInput placeholder="Buscar layout..." />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Carregando..." : "Nenhum layout encontrado."}
            </CommandEmpty>
            {layouts?.data && layouts.data.length > 0 && (
              <CommandGroup>
                {layouts.data.map((layout) => (
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
                          {layout.height}m × {layout.layoutSections?.[0]?.width || 0}m
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {layout.layoutSections?.length || 0} seção{layout.layoutSections?.length !== 1 ? "ões" : ""}
                          {layout.layoutSections?.some(section => section.isDoor) && " • Com porta"}
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
                  Criar novo layout{side ? ` ${side === "left" ? "esquerdo" : side === "right" ? "direito" : "traseiro"}` : ""}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}