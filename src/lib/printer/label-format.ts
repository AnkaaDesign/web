export type LabelFormat = "DUPLA" | "COMBO";

export interface LabelFormatSpec {
  widthMm: number;
  heightMm: number;
  title: string;
  description: string;
}

/**
 * DUPLA (50x15mm): a single print job with two physical labels — one with
 * only the paint type, one with only the paint name.
 * COMBO (50x30mm): a single physical label with both name and type together.
 */
export const LABEL_FORMATS: Record<LabelFormat, LabelFormatSpec> = {
  DUPLA: {
    widthMm: 50,
    heightMm: 15,
    title: "50×15mm (dupla)",
    description: "Duas etiquetas: uma com o tipo, outra com o nome",
  },
  COMBO: {
    widthMm: 50,
    heightMm: 30,
    title: "50×30mm",
    description: "Uma etiqueta com nome e tipo juntos",
  },
};

export const PRINTER_LABEL_DPI = 203;

export const mmToPx = (mm: number): number => Math.round((mm / 25.4) * PRINTER_LABEL_DPI);

export const LAST_LABEL_FORMAT_STORAGE_KEY = "niimbot_last_label_format";
export const LAST_PRINTER_PORT_STORAGE_KEY = "niimbot_last_printer_port";

export interface StoredPrinterPort {
  usbVendorId?: number;
  usbProductId?: number;
}
