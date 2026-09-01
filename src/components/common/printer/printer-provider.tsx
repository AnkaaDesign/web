import * as React from "react";
import { usePrinterClient } from "./use-printer-client";
import type { PrintablePaint } from "./use-printer-client";
import { PrinterContext } from "./printer-context";
import { PrintLabelDialog } from "./print-label-dialog";
import type { PrintLabelDialogTarget } from "./print-label-dialog";

export function PrinterProvider({ children }: { children: React.ReactNode }) {
  const client = usePrinterClient();
  const [target, setTarget] = React.useState<PrintLabelDialogTarget | null>(null);

  const openPrintDialog = React.useCallback((paint: PrintablePaint, opts?: { onClose?: () => void }) => {
    setTarget({ paint, onClose: opts?.onClose });
  }, []);

  const handleOpenChange = React.useCallback((open: boolean) => {
    if (!open) {
      setTarget((current) => {
        current?.onClose?.();
        return null;
      });
    }
  }, []);

  const value = React.useMemo(
    () => ({ connected: client.connected, printerName: client.printerName, openPrintDialog }),
    [client.connected, client.printerName, openPrintDialog],
  );

  return (
    <PrinterContext.Provider value={value}>
      {children}
      <PrintLabelDialog target={target} client={client} onOpenChange={handleOpenChange} />
    </PrinterContext.Provider>
  );
}
