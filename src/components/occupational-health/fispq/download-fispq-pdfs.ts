import { downloadFile, downloadFileInBrowser } from "@/api-client/file";
import { toast } from "@/components/ui/sonner";
import type { Fispq } from "@/types/fispq";

/**
 * Downloads the official FDS/FISPQ PDF document(s) attached to the given records.
 * Records without an attached PDF are skipped. Returns the number downloaded.
 */
export async function downloadFispqPdfs(fispqs: Fispq[]): Promise<number> {
  const withPdf = fispqs.filter((f) => f.pdfFile?.id || f.pdfFileId);
  if (withPdf.length === 0) {
    toast.error("Nenhuma das FISPQ selecionadas possui PDF da FDS anexado.");
    return 0;
  }

  let ok = 0;
  for (const f of withPdf) {
    const fileId = f.pdfFile?.id ?? f.pdfFileId;
    if (!fileId) continue;
    const fallback = `FDS-${(f.item?.name || f.productName || "produto").replace(/[^a-z0-9]+/gi, "-")}.pdf`;
    const filename = f.pdfFile?.originalName || fallback;
    try {
      const blob = await downloadFile(fileId);
      downloadFileInBrowser(blob, filename);
      ok++;
    } catch {
      // continue with the rest
    }
  }

  if (ok === 0) {
    toast.error("Não foi possível baixar o(s) PDF(s) da FDS.");
  } else {
    const skipped = fispqs.length - ok;
    toast.success(`${ok} PDF(s) da FDS exportado(s)${skipped > 0 ? ` • ${skipped} sem PDF` : ""}.`);
  }
  return ok;
}
