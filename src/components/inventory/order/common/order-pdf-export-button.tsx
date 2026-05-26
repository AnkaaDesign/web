import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { IconDownload, IconFileText, IconCurrencyReal, IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useCanViewPrices } from "../../../../hooks";

interface OrderPdfExportButtonProps {
  /** Called with the chosen version: true = with values, false = budget request (no values). */
  onExport: (includePricing: boolean) => void;
  /**
   * When provided, the button exports this version directly without showing the
   * chooser modal. Used in the create/edit forms, which only offer the supplier
   * (budget request) version. Omit it on the detail page to offer both options.
   */
  fixedVersion?: boolean;
  label?: string;
  className?: string;
  size?: "sm" | "default" | "lg";
  disabled?: boolean;
}

/**
 * Primary "Exportar PDF" button that opens a dialog letting the user pick which
 * version of the order PDF to generate:
 *  - "Pedido com Valores" — full document with prices, taxes, discount and total
 *  - "Solicitação de Orçamento" — item list only, to send to the supplier requesting a budget
 */
export function OrderPdfExportButton({ onExport, fixedVersion, label = "Exportar PDF", className, size = "sm", disabled }: OrderPdfExportButtonProps) {
  const [open, setOpen] = useState(false);
  const canViewPrices = useCanViewPrices();

  const handleSelect = (includePricing: boolean) => {
    setOpen(false);
    onExport(includePricing);
  };

  const handleClick = () => {
    if (fixedVersion !== undefined) {
      onExport(fixedVersion);
      return;
    }
    // Warehouse users may only export the no-values (budget request) version.
    if (!canViewPrices) {
      onExport(false);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <Button type="button" variant="default" size={size} className={cn("gap-2", className)} onClick={handleClick} disabled={disabled}>
        <IconDownload className="h-4 w-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar PDF do Pedido</DialogTitle>
            <DialogDescription>Escolha qual versão do documento deseja gerar.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 pt-2">
            {canViewPrices && (
              <button
                type="button"
                onClick={() => handleSelect(true)}
                className="group flex items-center gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <IconCurrencyReal className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-foreground">Pedido com Valores</div>
                  <div className="text-sm text-muted-foreground">Documento completo com preços, impostos, desconto e total.</div>
                </div>
                <IconChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSelect(false)}
              className="group flex items-center gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <IconFileText className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-foreground">Solicitação de Orçamento</div>
                <div className="text-sm text-muted-foreground">Apenas a lista de itens, sem valores — para enviar ao fornecedor.</div>
              </div>
              <IconChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
