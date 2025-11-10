import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconCheck, IconX } from "@tabler/icons-react";

export interface FilterDialogProps {
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
}

export function FilterDialog({
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
}: FilterDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-4">
            {children}
          </div>
        </ScrollArea>

        {showFooter && (
          <DialogFooter className="gap-2 sm:gap-0">
            {onReset && (
              <Button onClick={onReset} variant="outline">
                <IconX className="mr-2 h-4 w-4" />
                {resetLabel}
              </Button>
            )}
            {onApply && (
              <Button onClick={onApply}>
                <IconCheck className="mr-2 h-4 w-4" />
                {applyLabel}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
