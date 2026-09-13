import { useCallback, useEffect, useRef, useState } from "react";
import { IconLoader, IconPrinter, IconUsb, IconAlertTriangle, IconTag } from "@tabler/icons-react";
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
  // Whether the auto-print (below) failed and the operator must be given the
  // manual list as a fallback, even though the roll's format is known.
  const [autoPrintFailed, setAutoPrintFailed] = useState(false);
  const lastFormat = getLocalStorage(LAST_LABEL_FORMAT_STORAGE_KEY) as LabelFormat | null;

  const { connected, readLabelRoll, labelRoll, isReadingRoll } = client;
  const isOpen = !!target;
  const detectedFormat = labelRoll?.detectedFormat ?? null;

  // Read the roll's RFID tag every time the dialog opens on a connected
  // printer — the roll may well have been swapped since the last print.
  useEffect(() => {
    if (!isOpen || !connected) return;
    void readLabelRoll();
  }, [isOpen, connected, readLabelRoll]);

  // The detected format goes first, so the roll actually in the printer is the
  // one under the cursor.
  const formats = (Object.entries(LABEL_FORMATS) as [LabelFormat, (typeof LABEL_FORMATS)[LabelFormat]][]).sort(
    ([a], [b]) => Number(b === detectedFormat) - Number(a === detectedFormat),
  );

  const handlePrint = useCallback(
    async (format: LabelFormat): Promise<boolean> => {
      if (!target) return false;
      setPrintingFormat(format);
      try {
        await client.printLabel(format, target.paint);
        toast.success("Etiqueta enviada para impressão");
        onOpenChange(false);
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falha ao imprimir etiqueta");
        return false;
      } finally {
        setPrintingFormat(null);
      }
    },
    [target, client, onOpenChange],
  );

  // The roll's RFID tag already says what format is loaded — asking the
  // operator to pick between formats at that point is a pointless extra
  // click, so print the moment it's identified instead of showing the list.
  const autoPrintedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) {
      autoPrintedRef.current = false;
      setAutoPrintFailed(false);
    }
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen || !connected || isReadingRoll || autoPrintedRef.current || !detectedFormat) return;
    autoPrintedRef.current = true;
    void handlePrint(detectedFormat).then((ok) => {
      if (!ok) setAutoPrintFailed(true);
    });
  }, [isOpen, connected, isReadingRoll, detectedFormat, handlePrint]);

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
                : detectedFormat && !autoPrintFailed
                  ? "Rolo reconhecido — imprimindo automaticamente."
                  : autoPrintFailed
                    ? "Não foi possível imprimir automaticamente. Escolha o formato."
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
          <>
            {(isReadingRoll || labelRoll) && (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {isReadingRoll ? (
                  <>
                    <IconLoader className="h-4 w-4 shrink-0 animate-spin" />
                    Lendo o rolo na impressora...
                  </>
                ) : (
                  labelRoll && (
                    <>
                      <IconTag className="h-4 w-4 shrink-0" />
                      <span>
                        {detectedFormat ? `Rolo de ${LABEL_FORMATS[detectedFormat].title}` : "Rolo ainda não identificado — escolha o formato uma vez"}
                        {labelRoll.remaining !== null && ` · restam ${labelRoll.remaining} etiquetas`}
                      </span>
                    </>
                  )
                )}
              </div>
            )}

            {detectedFormat && !autoPrintFailed ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-primary">
                <IconLoader className="h-4 w-4 shrink-0 animate-spin" />
                Imprimindo etiqueta {LABEL_FORMATS[detectedFormat].title}...
              </div>
            ) : (
              !isReadingRoll && (
                <div className="grid grid-cols-1 gap-3">
                  {formats.map(([format, spec]) => {
                    const isDetected = detectedFormat === format;
                    return (
                      <button
                        key={format}
                        type="button"
                        disabled={printingFormat !== null}
                        onClick={() => handlePrint(format)}
                        className={cn(
                          "flex items-center justify-between gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 disabled:opacity-50 disabled:cursor-default",
                          "cursor-pointer",
                          isDetected ? "border-primary bg-primary/5" : "border-border bg-card",
                        )}
                      >
                        <div>
                          <div className="flex items-center gap-2 font-medium">
                            <IconPrinter className="h-4 w-4" />
                            {spec.title}
                            {isDetected ? (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary">na impressora</span>
                            ) : (
                              !detectedFormat && lastFormat === format && <span className="text-xs font-normal text-muted-foreground">(padrão)</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">{spec.description}</p>
                        </div>
                        {printingFormat === format && <IconLoader className="h-4 w-4 animate-spin shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )
            )}
          </>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Fechar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
