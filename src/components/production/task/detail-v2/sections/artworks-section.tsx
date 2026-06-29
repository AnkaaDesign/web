import React, { useCallback, useMemo, useState } from "react";

import { IconDownload, IconLayoutGrid, IconList } from "@tabler/icons-react";

import { FileItem, useFileViewer, type FileViewMode } from "@/components/common/file";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { File, Task } from "@/types";
import { getApiBaseUrl } from "@/utils/file";

/**
 * Artwork records are File rows that may also carry a nested `file` relation and an approval
 * `status` (neither lives on the base File type, so we widen locally to read them safely).
 */
type ArtworkLike = File & { file?: File | null; status?: string | null };

/**
 * Bare render body for the "Layouts" (artworks) detail section. The DetailPage host supplies the
 * outer Card + title; this component renders only the toolbar + file grid/list.
 *
 * Visible to every user, but contents are gated: privileged users (`canViewBadges`) see all
 * artworks each with an approval-status badge, while everyone else sees only APPROVED artworks.
 * Returns null when there is nothing to show.
 */
export function ArtworksSection({ task, canViewBadges }: { task: Task; canViewBadges: boolean }): React.ReactNode {
  const [viewMode, setViewMode] = useState<FileViewMode>("grid");
  const fileViewer = useFileViewer();

  // Only artworks that carry file data AND are visible to this user (privileged, or APPROVED).
  const filteredArtworks = useMemo<ArtworkLike[]>(() => {
    if (!task.artworks) return [];
    return (task.artworks as ArtworkLike[]).filter((artwork) => {
      const hasFileData = artwork.file || artwork.filename || artwork.path;
      return Boolean(hasFileData) && (canViewBadges || artwork.status === "APPROVED");
    });
  }, [task.artworks, canViewBadges]);

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

  // Open each artwork's download endpoint in turn, staggered to avoid popup-blocking.
  const handleDownloadAll = useCallback(async () => {
    const apiUrl = getApiBaseUrl();
    for (let i = 0; i < filteredArtworks.length; i++) {
      const artwork = filteredArtworks[i];
      const fileId = artwork.file?.id || artwork.id;
      if (fileId) {
        window.open(`${apiUrl}/files/${fileId}/download`, "_blank");
      }
      if (i < filteredArtworks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  }, [filteredArtworks]);

  if (filteredArtworks.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Toolbar: count + "Baixar Todos" (when >1) + grid/list view-mode toggle */}
      <div className="flex items-center justify-between">
        <Badge variant="secondary">{filteredArtworks.length}</Badge>
        <div className="flex items-center gap-2">
          {filteredArtworks.length > 1 && (
            <Button variant="outline" size="sm" onClick={handleDownloadAll} className="text-xs">
              <IconDownload className="h-3 w-3 mr-1" />
              Baixar Todos
            </Button>
          )}
          <div className="flex gap-1">
            <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")} className="h-7 w-7 p-0">
              <IconList className="h-3.5 w-3.5" />
            </Button>
            <Button variant={viewMode === "grid" ? "default" : "outline"} size="sm" onClick={() => setViewMode("grid")} className="h-7 w-7 p-0">
              <IconLayoutGrid className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div className={cn(viewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
        {filteredArtworks.map((artwork) => {
          const fileData = (artwork.file ?? artwork) as File;
          return (
            <div key={artwork.id} className="relative">
              <FileItem file={fileData} viewMode={viewMode} onPreview={handlePreview} onDownload={handleDownload} showActions />
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
    </div>
  );
}
