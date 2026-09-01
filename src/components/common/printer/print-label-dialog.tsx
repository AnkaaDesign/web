import { useState } from "react";
import { IconLoader, IconPrinter, IconUsb, IconAlertTriangle } from "@tabler/icons-react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { getLocalStorage } from "@/lib/storage";
import { LABEL_FORMATS, LAST_LABEL_FORMAT_STORAGE_KEY } from "@/lib/printer/label-format";
import type { LabelFormat } from "@/lib/printer/label-format";
import type { usePrinterClient, PrintablePaint } from "./use-printer-client";

export interface PrintLabelDialogTarget {
  paint: PrintablePaint;
  onClose?: () => void;
}

interface PrintLabelDialogProps {
  target: PrintLabelDialogTarget | null;
  client: ReturnType<typeof usePrinterClient>;
  onOpenChange: (open: boolean) => void;
}

export function PrintLabelDialog({ target, client, onOpenChange }: PrintLabelDialogProps) {
  const [printingFormat, setPrintingFormat] = useState<LabelFormat | null>(null);
  const lastFormat = getLocalStorage(LAST_LABEL_FORMAT_STORAGE_KEY) as LabelFormat | null;

  const handlePrint = async (format: LabelFormat) => {
    if (!target) return;
    setPrintingFormat(format);
    try {
      await client.printLabel(format, target.paint);
      toast.success("Etiqueta enviada para impressão");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao imprimir etiqueta");
    } finally {
      setPrintingFormat(null);
    }
  };

  const handleConnect = async () => {
    try {
      await client.connectManually();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao conectar com a impressora");
    }
  };

  return (
    <AlertDialog open={!!target} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Imprimir Etiqueta{target ? ` — ${target.paint.name}` : ""}</AlertDialogTitle>
          <AlertDialogDescription>
            {!client.isSerialSupported
              ? "Este navegador não suporta impressão via USB. Use o Chrome ou o Edge."
              : !client.connected
                ? "Conecte a impressora Niimbot B1 pela porta USB do computador."
                : "Escolha o formato da etiqueta."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!client.isSerialSupported && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <IconAlertTriangle className="h-4 w-4 shrink-0" />
            Navegador incompatível com impressão USB.
          </div>
        )}

        {client.isSerialSupported && !client.connected && (
          <Button className="w-full" size="lg" onClick={handleConnect} disabled={client.isConnecting}>
            {client.isConnecting ? (
              <>
                <IconLoader className="h-4 w-4 mr-2 animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <IconUsb className="h-4 w-4 mr-2" />
                Conectar Impressora B1
              </>
            )}
          </Button>
        )}

        {client.connected && (
          <div className="grid grid-cols-1 gap-3">
            {(Object.entries(LABEL_FORMATS) as [LabelFormat, (typeof LABEL_FORMATS)[LabelFormat]][]).map(([format, spec]) => (
              <button
                key={format}
                type="button"
                disabled={printingFormat !== null}
                onClick={() => handlePrint(format)}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50 disabled:opacity-50 disabled:cursor-default",
                  "cursor-pointer",
                )}
              >
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    <IconPrinter className="h-4 w-4" />
                    {spec.title}
                    {lastFormat === format && <span className="text-xs font-normal text-muted-foreground">(padrão)</span>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{spec.description}</p>
                </div>
                {printingFormat === format && <IconLoader className="h-4 w-4 animate-spin shrink-0" />}
              </button>
            ))}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Fechar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
