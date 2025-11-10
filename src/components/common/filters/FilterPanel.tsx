import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconChevronDown, IconFilter, IconX, IconCheck, IconDeviceFloppy } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface FilterSection {
  id: string;
  title: string;
  description?: string;
  content: React.ReactNode;
  defaultOpen?: boolean;
  badge?: number;
}

export interface FilterPanelProps {
  sections: FilterSection[];
  onApply?: () => void;
  onReset?: () => void;
  onSavePreset?: () => void;
  onLoadPreset?: () => void;
  activeFiltersCount?: number;
  showActions?: boolean;
  className?: string;
  title?: string;
  description?: string;
}

export function FilterPanel({
  sections,
  onApply,
  onReset,
  onSavePreset,
  onLoadPreset,
  activeFiltersCount = 0,
  showActions = true,
  className,
  title = "Filtros",
  description = "Configure os filtros para refinar sua busca",
}: FilterPanelProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(sections.filter((s) => s.defaultOpen !== false).map((s) => s.id))
  );

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            <CardTitle>{title}</CardTitle>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary">
                {activeFiltersCount}
              </Badge>
            )}
          </div>
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className="max-h-[600px] pr-4">
          <div className="space-y-2">
            {sections.map((section, index) => (
              <div key={section.id}>
                <Collapsible
                  open={openSections.has(section.id)}
                  onOpenChange={() => toggleSection(section.id)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-3 h-auto"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{section.title}</span>
                        {section.badge !== undefined && section.badge > 0 && (
                          <Badge variant="secondary" className="rounded-full px-2 py-0 text-xs">
                            {section.badge}
                          </Badge>
                        )}
                      </div>
                      <IconChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          openSections.has(section.id) && "rotate-180"
                        )}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-3">
                    {section.description && (
                      <p className="text-sm text-muted-foreground mb-3">
                        {section.description}
                      </p>
                    )}
                    <div className="space-y-3">
                      {section.content}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                {index < sections.length - 1 && <Separator className="my-2" />}
              </div>
            ))}
          </div>
        </ScrollArea>

        {showActions && (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                {onApply && (
                  <Button onClick={onApply} className="flex-1">
                    <IconCheck className="mr-2 h-4 w-4" />
                    Aplicar
                  </Button>
                )}
                {onReset && (
                  <Button onClick={onReset} variant="outline" className="flex-1">
                    <IconX className="mr-2 h-4 w-4" />
                    Limpar
                  </Button>
                )}
              </div>
              {(onSavePreset || onLoadPreset) && (
                <div className="flex gap-2">
                  {onSavePreset && (
                    <Button onClick={onSavePreset} variant="secondary" size="sm" className="flex-1">
                      <IconDeviceFloppy className="mr-2 h-4 w-4" />
                      Salvar preset
                    </Button>
                  )}
                  {onLoadPreset && (
                    <Button onClick={onLoadPreset} variant="secondary" size="sm" className="flex-1">
                      Carregar preset
                    </Button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
