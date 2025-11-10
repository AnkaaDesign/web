import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconCheck, IconX } from "@tabler/icons-react";

export interface FilterDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  onApply?: () => void;
  onReset?: () => void;
  applyLabel?: string;
  resetLabel?: string;
  showFooter?: boolean;
  side?: "left" | "right" | "top" | "bottom";
}

export function FilterDrawer({
  open,
  onOpenChange,
  title = "Filtros",
  description,
  children,
  onApply,
  onReset,
  applyLabel = "Aplicar",
  resetLabel = "Limpar",
  showFooter = true,
  side = "right",
}: FilterDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className="w-full sm:max-w-[400px] flex flex-col">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-4">
            {children}
          </div>
        </ScrollArea>

        {showFooter && (
          <SheetFooter className="gap-2 sm:gap-0">
            <div className="flex flex-col sm:flex-row gap-2 w-full">
              {onReset && (
                <Button onClick={onReset} variant="outline" className="flex-1">
                  <IconX className="mr-2 h-4 w-4" />
                  {resetLabel}
                </Button>
              )}
              {onApply && (
                <Button onClick={onApply} className="flex-1">
                  <IconCheck className="mr-2 h-4 w-4" />
                  {applyLabel}
                </Button>
              )}
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
