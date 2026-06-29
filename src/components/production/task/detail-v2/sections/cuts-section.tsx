import React from "react";
import { IconDownload } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileItem, useFileViewer } from "@/components/common/file";
import type { Cut, File } from "@/types";
import { getApiBaseUrl } from "@/utils/file";

/**
 * Bare render body for the "Recortes" (cuts) detail section. The DetailPage host supplies the
 * outer Card + title; this component renders only the toolbar + cut-file grid.
 *
 * Each cut's `file` is shown as a grid `FileItem`; clicking one opens the whole cut-file
 * collection in the app-level file viewer at that index. "Baixar Todos" (shown when there is
 * more than one cut) fetches every cut file and bundles the blobs into a single
 * `${taskName}-recortes.zip` via JSZip. Returns null when there are no cuts.
 *
 * The cuts are fetched by the host (via `useCutsByTask`) and passed in — this component does not
 * call the hook itself.
 */
export function CutsSection({ cuts, taskName }: { cuts: Cut[]; taskName?: string }): React.ReactNode {
  const fileViewer = useFileViewer();

  if (cuts.length === 0) return null;

  // Preview opens the whole cut-file collection in the app-level viewer at the clicked index.
  const handleCutFileClick = (file: File) => {
    const cutFiles = cuts
      .map((cut) => cut.file)
      .filter((f): f is File => Boolean(f && typeof f === "object" && "id" in f));
    const index = cutFiles.findIndex((f) => f.id === file.id);
    fileViewer.actions.viewFiles(cutFiles, index >= 0 ? index : 0);
  };

  // Fetch every cut file and bundle the blobs into a single zip named after the task.
  const handleDownloadAll = async () => {
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
  };

  return (
    <div className="space-y-4">
      {/* Toolbar: count + "Baixar Todos" (when >1, zips every cut file). */}
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{cuts.length}</Badge>
        {cuts.length > 1 && (
          <Button variant="outline" size="sm" onClick={handleDownloadAll} className="text-xs">
            <IconDownload className="h-3 w-3 mr-1" />
            Baixar Todos
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {cuts.map(
          (cut) => cut.file && <FileItem key={cut.id} file={cut.file} viewMode="grid" onPreview={handleCutFileClick} />,
        )}
      </div>
    </div>
  );
}
