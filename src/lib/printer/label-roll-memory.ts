import { getLocalStorage, setLocalStorage } from "@/lib/storage";
import type { LabelFormat } from "./label-format";
import { LABEL_FORMATS } from "./label-format";

/**
 * The RFID tag inside a genuine Niimbot roll does NOT expose the label's
 * physical size over the printer protocol — it carries a UUID, a serial, a
 * per-SKU `barCode` string and the printed/total counters, and nothing else
 * (see the community protocol notes at https://printers.niim.blue/other/rfig-tags/).
 * The official app resolves the size by looking that barcode up in NIIMBOT's
 * own cloud catalog, which we have no access to.
 *
 * The barcode is stable per product SKU, though, so a 50×15 roll and a 50×30
 * roll always report different barcodes. That's enough: the first time a given
 * barcode shows up the user picks the format once, we remember the pairing
 * here, and from then on the format is detected automatically — no cloud, and
 * it also covers rolls the official catalog wouldn't know about.
 */
const BARCODE_FORMAT_MAP_STORAGE_KEY = "niimbot_barcode_label_formats";

type BarcodeFormatMap = Record<string, LabelFormat>;

const isKnownFormat = (value: unknown): value is LabelFormat => typeof value === "string" && value in LABEL_FORMATS;

const readMap = (): BarcodeFormatMap => {
  const raw = getLocalStorage(BARCODE_FORMAT_MAP_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    // Drop anything that isn't a current format, so a renamed/removed format
    // in LABEL_FORMATS can never resurrect as a bogus suggestion.
    return Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter(([, format]) => isKnownFormat(format))) as BarcodeFormatMap;
  } catch {
    return {};
  }
};

/** The format last printed on the roll with this barcode, if we've ever seen it. */
export const getFormatForBarcode = (barCode: string | null | undefined): LabelFormat | null => {
  if (!barCode) return null;
  return readMap()[barCode] ?? null;
};

/** Records that `barCode` is a roll of `format`, so the next print on it is detected automatically. */
export const rememberBarcodeFormat = (barCode: string | null | undefined, format: LabelFormat): void => {
  if (!barCode) return;
  setLocalStorage(BARCODE_FORMAT_MAP_STORAGE_KEY, JSON.stringify({ ...readMap(), [barCode]: format }));
};
