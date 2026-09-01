import { createContext } from "react";
import type { PrintablePaint } from "./use-printer-client";

export interface PrinterContextValue {
  connected: boolean;
  printerName: string | null;
  /** Opens the shared print dialog for `paint`. `onClose` fires when the dialog is dismissed, whether or not it printed. */
  openPrintDialog: (paint: PrintablePaint, opts?: { onClose?: () => void }) => void;
}

export const PrinterContext = createContext<PrinterContextValue | null>(null);
