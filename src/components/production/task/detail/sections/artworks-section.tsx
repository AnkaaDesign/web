import React, { useCallback, useMemo } from "react";

import { FileItem, useFileViewer, type FileViewMode } from "@/components/common/file";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { File, Task } from "@/types";
import { getApiBaseUrl } from "@/utils/file";

/**
 * Artwork records are File rows that may also carry a nested `file` relation and an approval
 * `status` (neither lives on the base File type, so we widen locally to read them safely).
 */
type ArtworkLike = File & { file?: File | null; status?: string | null };

/**
 * The artworks visible to the current user: those carrying file data AND either visible to a
 * privileged (`canViewBadges`) viewer or APPROVED for everyone else. Shared by the section body and
 * the page-composed header actions (count badge + "Baixar Todos") so both stay in sync.
 */
export function getVisibleArtworks(task: Task, canViewBadges: boolean): ArtworkLike[] {
  if (!task.artworks) return [];
  return (task.artworks as ArtworkLike[]).filter((artwork) => {
    const hasFileData = artwork.file || artwork.filename || artwork.path;
    return Boolean(hasFileData) && (canViewBadges || artwork.status === "APPROVED");
  });
}

/** Open each artwork's download endpoint in turn, staggered to avoid popup-blocking. */
export async function downloadAllArtworks(artworks: ArtworkLike[]): Promise<void> {
  const apiUrl = getApiBaseUrl();
  for (let i = 0; i < artworks.length; i++) {
    const fileId = artworks[i].file?.id || artworks[i].id;
    if (fileId) window.open(`${apiUrl}/files/${fileId}/download`, "_blank");
    if (i < artworks.length - 1) await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/**
 * Bare render body for the "Layouts" (artworks) detail section. The DetailPage host supplies the
 * outer Card + title; this component renders only the toolbar + file grid/list.
 *
 * Visible to every user, but contents are gated: privileged users (`canViewBadges`) see all
 * artworks each with an approval-status badge, while everyone else sees only APPROVED artworks.
 * Returns null when there is nothing to show.
 */
export function ArtworksSection({ task, canViewBadges, view }: { task: Task; canViewBadges: boolean; view: FileViewMode }): React.ReactNode {
  const fileViewer = useFileViewer();

  // Only artworks that carry file data AND are visible to this user (privileged, or APPROVED).
  const filteredArtworks = useMemo<ArtworkLike[]>(() => getVisibleArtworks(task, canViewBadges), [task, canViewBadges]);

  // Preview opens the whole artwork collection in the app-level file viewer at the clicked index.
  const handlePreview = useCallback(
    (file: File) => {
      const artworkFiles = ((task.artworks ?? []) as ArtworkLike[])
        .map((artwork) => (artwork.file ?? artwork) as File)
        .filter((f): f is File => Boolean(f && typeof f === "object" && "id" in f));
      const index = artworkFiles.findIndex((f) => f.id === file.id);
      fileViewer.actions.viewFiles(artworkFiles, index >= 0 ? index : 0);
    },
    [task.artworks, fileViewer],
  );

  const handleDownload = useCallback(
    (file: File) => {
      fileViewer.actions.downloadFile(file);
    },
    [fileViewer],
  );

  if (filteredArtworks.length === 0) return null;

  return (
    <div className={cn(view === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
      {filteredArtworks.map((artwork) => {
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
