import React, { useCallback, useMemo } from "react";

import { FileItem, useFileViewer, type FileViewMode } from "@/components/common/file";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { File, Task } from "@/types";
import { getApiBaseUrl } from "@/utils/file";

/**
 * Layout records are File rows that may also carry a nested `file` relation and an approval
 * `status` (neither lives on the base File type, so we widen locally to read them safely).
 */
type LayoutLike = File & { file?: File | null; status?: string | null };

/**
 * The layouts visible to the current user: those carrying file data AND either visible to a
 * privileged (`canViewBadges`) viewer or APPROVED for everyone else. Shared by the section body and
 * the page-composed header actions (count badge + "Baixar Todos") so both stay in sync.
 */
export function getVisibleLayouts(task: Task, canViewBadges: boolean): LayoutLike[] {
  if (!task.layouts) return [];
  return (task.layouts as LayoutLike[]).filter((artwork) => {
    const hasFileData = artwork.file || artwork.filename || artwork.path;
    return Boolean(hasFileData) && (canViewBadges || artwork.status === "APPROVED");
  });
}

/** Open each artwork's download endpoint in turn, staggered to avoid popup-blocking. */
export async function downloadAllLayouts(layouts: LayoutLike[]): Promise<void> {
  const apiUrl = getApiBaseUrl();
  for (let i = 0; i < layouts.length; i++) {
    const fileId = layouts[i].file?.id || layouts[i].id;
    if (fileId) window.open(`${apiUrl}/files/${fileId}/download`, "_blank");
    if (i < layouts.length - 1) await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/**
 * Bare render body for the "Layouts" (layouts) detail section. The DetailPage host supplies the
 * outer Card + title; this component renders only the toolbar + file grid/list.
 *
 * Visible to every user, but contents are gated: privileged users (`canViewBadges`) see all
 * layouts each with an approval-status badge, while everyone else sees only APPROVED layouts.
 * Returns null when there is nothing to show.
 */
export function LayoutsSection({ task, canViewBadges, view }: { task: Task; canViewBadges: boolean; view: FileViewMode }): React.ReactNode {
  const fileViewer = useFileViewer();

  // Only layouts that carry file data AND are visible to this user (privileged, or APPROVED).
  const filteredLayouts = useMemo<LayoutLike[]>(() => getVisibleLayouts(task, canViewBadges), [task, canViewBadges]);

  // Preview opens the whole artwork collection in the app-level file viewer at the clicked index.
  const handlePreview = useCallback(
    (file: File) => {
      const layouts = ((task.layouts ?? []) as LayoutLike[])
        .map((artwork) => (artwork.file ?? artwork) as File)
        .filter((f): f is File => Boolean(f && typeof f === "object" && "id" in f));
      const index = layouts.findIndex((f) => f.id === file.id);
      fileViewer.actions.viewFiles(layouts, index >= 0 ? index : 0);
    },
    [task.layouts, fileViewer],
  );

  const handleDownload = useCallback(
    (file: File) => {
      fileViewer.actions.downloadFile(file);
    },
    [fileViewer],
  );

  if (filteredLayouts.length === 0) return null;

  return (
    <div className={cn(view === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
      {filteredLayouts.map((artwork) => {
          const fileData = (artwork.file ?? artwork) as File;
          return (
            <div key={artwork.id} className="relative">
              <FileItem file={fileData} viewMode={view} onPreview={handlePreview} onDownload={handleDownload} showActions />
              {canViewBadges && artwork.status && (
                <div className="pointer-events-none absolute left-1 top-1 max-w-[calc(100%-0.5rem)]">
                  <Badge
                    variant={artwork.status === "APPROVED" ? "approved" : artwork.status === "REPROVED" ? "rejected" : "secondary"}
                    className="h-4 truncate px-1 text-[9px] font-medium leading-none shadow-sm"
                  >
                    {artwork.status === "APPROVED" ? "Aprovado" : artwork.status === "REPROVED" ? "Reprovado" : "Rascunho"}
                  </Badge>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}
