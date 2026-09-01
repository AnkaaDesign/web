import { useContext } from "react";
import { PrinterContext } from "./printer-context";

export function usePrinter() {
  const ctx = useContext(PrinterContext);
  if (!ctx) throw new Error("usePrinter must be used within a PrinterProvider");
  return ctx;
}
