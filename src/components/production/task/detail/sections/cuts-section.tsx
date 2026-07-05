import React, { useCallback } from "react";

import { FileItem, useFileViewer, type FileViewMode } from "@/components/common/file";
import { Badge } from "@/components/ui/badge";
import { CUT_ORIGIN_LABELS, CUT_STATUS_LABELS, getBadgeVariant } from "@/constants";
import { cn } from "@/lib/utils";
import type { Cut, File } from "@/types";
import { getApiBaseUrl } from "@/utils/file";

/** The File objects backing a task's cuts, skipping any cut without an attached file. */
export function getCutFiles(cuts: Cut[]): File[] {
  return cuts.map((cut) => cut.file).filter((f): f is File => Boolean(f && typeof f === "object" && "id" in f));
}

/**
 * Fetch every cut file and bundle the blobs into a single `${taskName}-recortes.zip` via JSZip.
 * Exposed so the DetailPage host can wire it into the section's headerActions ("Baixar Todos").
 */
export async function downloadAllCuts(cuts: Cut[], taskName?: string): Promise<void> {
  const apiUrl = getApiBaseUrl();
  const zipFileName = `${taskName ?? "tarefa"}-recortes.zip`;

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  await Promise.all(
    cuts.map(async (cut) => {
      if (!cut.file) return;
      try {
        const response = await fetch(`${apiUrl}/files/${cut.file.id}/download`);
        const blob = await response.blob();
        zip.file(cut.file.filename, blob);
      } catch (error) {
        console.error(`Error downloading file ${cut.file.filename}:`, error);
      }
    }),
  );

  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const link = document.createElement("a");
  link.href = url;
  link.download = zipFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Bare render body for the "Recortes" (cuts) detail section. The DetailPage host supplies the outer
 * Card + title + header actions (count badge, "Baixar Todos", view toggle) — matching the Layouts
 * and Arquivos sections — so this component renders only the file grid/list.
 *
 * Each cut's `file` is shown as a `FileItem`; clicking one opens the whole cut-file collection in
 * the app-level file viewer at that index. Returns null when there are no cuts.
 */
export function CutsSection({ cuts, view }: { cuts: Cut[]; view: FileViewMode }): React.ReactNode {
  const fileViewer = useFileViewer();

  // Preview opens the whole cut-file collection in the app-level viewer at the clicked index.
  const handlePreview = useCallback(
    (file: File) => {
      const cutFiles = getCutFiles(cuts);
      const index = cutFiles.findIndex((f) => f.id === file.id);
      fileViewer.actions.viewFiles(cutFiles, index >= 0 ? index : 0);
    },
    [cuts, fileViewer],
  );

  const handleDownload = useCallback(
    (file: File) => {
      fileViewer.actions.downloadFile(file);
    },
    [fileViewer],
  );

  if (cuts.length === 0) return null;

  return (
    <div className={cn(view === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
      {cuts.map((cut) => {
        if (!cut.file) return null;
        // A task's "Recortes" mixes PLAN cuts with REQUEST (rework) cuts. Without a marker
        // they look identical, so the count can seem to disagree with the task-edit "Plano de
        // Corte" section (which only manages PLAN cuts). Show each cut's status + origin
        // (Plano = blue, Solicitação = yellow) so every cut is unambiguous.
        const statusBadge = cut.status ? (
          <Badge variant={getBadgeVariant(cut.status, "CUT")}>{CUT_STATUS_LABELS[cut.status]}</Badge>
        ) : null;
        const originBadge = cut.origin ? (
          <Badge variant={getBadgeVariant(cut.origin, "CUT_ORIGIN")}>{CUT_ORIGIN_LABELS[cut.origin]}</Badge>
        ) : null;

        if (view === "grid") {
          // Badges sit in a caption row BELOW the thumbnail — never overlapping the image —
          // at the standard badge size so they match the cuts table and detail page.
          return (
            <div key={cut.id} className="flex flex-col gap-1.5">
              <FileItem file={cut.file} viewMode={view} onPreview={handlePreview} onDownload={handleDownload} showActions />
              <div className="flex flex-wrap items-center gap-1">
                {statusBadge}
                {originBadge}
              </div>
            </div>
          );
        }

        // List view: badges inline to the right of the file row.
        return (
          <div key={cut.id} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <FileItem file={cut.file} viewMode={view} onPreview={handlePreview} onDownload={handleDownload} showActions />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {statusBadge}
              {originBadge}
            </div>
          </div>
        );
      })}
    </div>
  );
}
