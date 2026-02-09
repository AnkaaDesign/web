import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IconAlertTriangle, IconCheck, IconChevronDown, IconLayout, IconLoader2, IconPlus, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { layoutService } from "@/api-client";
import type { Layout } from "@/types";

/**
 * LayoutSelector - A comprehensive component for selecting truck layouts
 *
 * Features:
 * - Dropdown/Combobox interface for layout selection
 * - Displays layout dimensions, sections, and usage count
 * - Warning badge for shared layouts (used by multiple trucks)
 * - "Create New Layout" button integration
 * - "Clear Selection" option
 * - Loading states for async data fetching
 * - Usage warning alert for shared layouts
 *
 * @example
 * ```tsx
 * <LayoutSelector
 *   value={layoutId}
 *   onChange={setLayoutId}
 *   side="left"
 *   truckId="truck-123"
 *   onCreateClick={() => setShowCreateDialog(true)}
 * />
 * ```
 */

interface LayoutSelectorProps {
  /** Current selected layout ID */
  value: string | null;
  /** Callback when layout selection changes */
  onChange: (layoutId: string | null) => void;
  /** Which side of the truck this layout is for */
  side: "left" | "right" | "back";
  /** ID of the truck this layout belongs to */
  truckId: string;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the "Create New Layout" option */
  allowCreate?: boolean;
  /** Callback when "Create New Layout" is clicked */
  onCreateClick?: () => void;
}

export function LayoutSelector({
  value,
  onChange,
  side,
  truckId: _truckId,
  disabled = false,
  className,
  allowCreate = true,
  onCreateClick,
}: LayoutSelectorProps) {
  const [open, setOpen] = useState(false);

  // Fetch layouts with usage information
  const { data: layoutsResponse, isLoading } = useQuery({
    queryKey: ["layouts", { includeUsage: true }],
    queryFn: () => layoutService.listLayouts({ includeUsage: true, includeSections: true }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const layouts = layoutsResponse?.data.data || [];
  const selectedLayout = layouts.find((layout) => layout.id === value);

  // Side label translation
  const sideLabel = {
    left: "esquerdo",
    right: "direito",
    back: "traseiro",
  }[side];

  // Format layout display text
  const formatLayoutDisplay = (layout: Layout) => {
    const sections = layout.layoutSections || [];
    const width = sections[0]?.width || 0;
    const sectionCount = sections.length;

    return {
      primary: `${layout.height}m × ${width}m`,
      secondary: `${sectionCount} seção${sectionCount !== 1 ? "ões" : ""}${
        sections.some((s) => s.isDoor) ? " • Com porta" : ""
      }`,
    };
  };

  // Handle clear selection
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  // Handle create new layout
  const handleCreate = () => {
    setOpen(false);
    onCreateClick?.();
  };

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between text-foreground bg-transparent h-10",
              "hover:bg-accent hover:text-white",
              "data-[state=open]:bg-accent data-[state=open]:text-white",
              !value && "text-muted-foreground"
            )}
            data-state={open ? "open" : "closed"}
            disabled={disabled}
            type="button"
          >
            <div className="flex items-center gap-2 flex-1 truncate">
              <IconLayout className="h-4 w-4 shrink-0" />
              {selectedLayout ? (
                <span className="truncate">{formatLayoutDisplay(selectedLayout).primary}</span>
              ) : (
                <span className="truncate">Selecione um layout {sideLabel}</span>
              )}
            </div>
            <div className="flex items-center ml-2 gap-1 shrink-0">
              {value && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100 rounded-sm hover:bg-destructive/20"
                  onClick={handleClear}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      handleClear(e as any);
                    }
                  }}
                  aria-label="Limpar seleção"
                >
                  <IconX className="h-4 w-4" />
                </span>
              )}
              <IconChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command>
            <CommandInput placeholder="Buscar layout..." />
            <CommandList>
              <CommandEmpty>
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-6 text-sm text-muted-foreground">
                    <IconLoader2 className="h-5 w-5 animate-spin mb-2" />
                    Carregando layouts...
                  </div>
                ) : (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Nenhum layout encontrado
                  </div>
                )}
              </CommandEmpty>

              {layouts.length > 0 && (
                <CommandGroup heading="Layouts disponíveis">
                  {/* Clear selection option */}
                  {value && (
                    <>
                      <CommandItem
                        value="__clear__"
                        onSelect={() => {
                          onChange(null);
                          setOpen(false);
                        }}
                        className="text-muted-foreground"
                      >
                        <IconX className="mr-2 h-4 w-4" />
                        <span>Limpar seleção</span>
                      </CommandItem>
                      <CommandSeparator />
                    </>
                  )}

                  {/* Layout options */}
                  {layouts.map((layout) => {
                    const display = formatLayoutDisplay(layout);
                    const isSelected = value === layout.id;
                    const isShared = (layout.usageCount || 0) > 1;

                    return (
                      <CommandItem
                        key={layout.id}
                        value={layout.id}
                        onSelect={() => {
                          onChange(layout.id === value ? null : layout.id);
                          setOpen(false);
                        }}
                      >
                        <div className="flex items-start justify-between w-full gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <IconCheck
                              className={cn(
                                "h-4 w-4 shrink-0 mt-0.5",
                                isSelected ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col gap-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{display.primary}</span>
                                {isShared && (
                                  <Badge variant="warning" size="sm" className="shrink-0">
                                    <IconAlertTriangle className="h-3 w-3 mr-1" />
                                    Compartilhado
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {display.secondary}
                              </span>
                              {isShared && (
                                <span className="text-xs text-amber-600 dark:text-amber-500">
                                  Usado por {layout.usageCount} caminhão{layout.usageCount !== 1 ? "ões" : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}

              {/* Create new layout option */}
              {allowCreate && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      value="__create__"
                      onSelect={handleCreate}
                      className="text-primary"
                    >
                      <IconPlus className="mr-2 h-4 w-4" />
                      <span>Criar novo layout {sideLabel}</span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Usage warning alert */}
      {selectedLayout && (selectedLayout.usageCount || 0) > 1 && (
        <Alert variant="warning" className="mt-2">
          <IconAlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Este layout é usado por {selectedLayout.usageCount} caminhão
            {selectedLayout.usageCount !== 1 ? "ões" : ""}.
            Alterações afetarão todas as tarefas.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
