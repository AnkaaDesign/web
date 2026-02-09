import { useState } from "react";
import { IconEye, IconSettings, IconRefresh } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { SectionConfig, VisibilityState } from "@/hooks/common/use-section-visibility";

interface SectionVisibilityManagerProps {
  sections: SectionConfig[];
  visibilityState: VisibilityState;
  onToggleSection: (sectionId: string) => void;
  onToggleField: (fieldId: string) => void;
  onReset: () => void;
  className?: string;
}

export function SectionVisibilityManager({
  sections,
  visibilityState,
  onToggleSection,
  onToggleField,
  onReset,
  className,
}: SectionVisibilityManagerProps) {
  const [open, setOpen] = useState(false);

  // Count visible sections and fields (only count sections/fields that exist in current config)
  const visibleSectionsCount = sections.filter(section => visibilityState.sections.has(section.id)).length;
  const totalSectionsCount = sections.length;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("gap-2", className)}
        >
          <IconEye className="h-4 w-4" />
          <span className="hidden sm:inline">
            Seções ({visibleSectionsCount}/{totalSectionsCount})
          </span>
          <span className="sm:hidden">
            {visibleSectionsCount}/{totalSectionsCount}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <IconSettings className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Visibilidade de Seções</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-8 px-2 hover:bg-muted"
            title="Restaurar padrão"
          >
            <IconRefresh className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="h-[450px]">
          <div className="p-2 space-y-2">
            {sections.map((section) => {
              const isSectionVisible = visibilityState.sections.has(section.id);
              const visibleFieldsInSection = section.fields.filter((field) =>
                visibilityState.fields.has(field.id)
              ).length;

              return (
                <div key={section.id} className="space-y-1">
                  {/* Section Toggle */}
                  <Label
                    htmlFor={`section-${section.id}`}
                    className="group flex items-center justify-between space-x-3 p-2 hover:bg-accent hover:text-accent-foreground rounded-md cursor-pointer transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">
                        {section.label}
                      </div>
                      <p className="text-xs text-muted-foreground group-hover:text-accent-foreground/90 mt-0.5 transition-colors">
                        {visibleFieldsInSection}/{section.fields.length} campos
                      </p>
                    </div>
                    <Switch
                      id={`section-${section.id}`}
                      checked={isSectionVisible}
                      onCheckedChange={() => onToggleSection(section.id)}
                    />
                  </Label>

                  {/* Field Toggles */}
                  {isSectionVisible && section.fields.length > 0 && (
                    <div className="ml-6 space-y-1 border-l-2 border-border/40 pl-2">
                      {section.fields.map((field) => {
                        const isFieldVisible = visibilityState.fields.has(field.id);
                        const isRequired = field.required;

                        return (
                          <Label
                            key={field.id}
                            htmlFor={`field-${field.id}`}
                            className={cn(
                              "flex items-center justify-between space-x-3 p-2 rounded-md",
                              !isRequired && "hover:bg-accent hover:text-accent-foreground cursor-pointer",
                              isRequired && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <span className="text-xs flex-1 min-w-0">
                              {field.label}
                              {isRequired && (
                                <span className="ml-1.5 text-muted-foreground">(obrigatório)</span>
                              )}
                            </span>
                            <Switch
                              id={`field-${field.id}`}
                              checked={isFieldVisible}
                              onCheckedChange={() => onToggleField(field.id)}
                              disabled={isRequired}
                            />
                          </Label>
                        );
                      })}
                    </div>
                  )}

                  <Separator className="my-2" />
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="px-4 py-3 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground text-center">
            Alterne seções e campos para personalizar a visualização
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
