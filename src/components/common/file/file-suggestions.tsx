import React, { useState } from "react";
import type { File as AnkaaFile } from "../../../types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IconLoader2,
  IconFile,
  IconPhoto,
  IconFileTypePdf,
  IconEye,
  IconCirclePlus,
  IconSparkles,
} from "@tabler/icons-react";
import { useFileSuggestions, useCreateFileFromExisting } from "../../../hooks/common/use-file";
import { useFileViewer } from "@/components/common/file/file-viewer";
import { formatRelativeTime } from "@/utils/date";
import { getApiBaseUrl } from "@/config/api";

export interface FileSuggestionsProps {
  customerId?: string;
  fileContext: "tasksArtworks" | "taskBaseFiles" | "taskProjectFiles";
  excludeFileIds: string[];
  onSelect: (newFile: AnkaaFile) => void;
  disabled?: boolean;
}

const getThumbnailUrl = (file: AnkaaFile): string | null => {
  if (file.thumbnailUrl) return file.thumbnailUrl;
  if (file.mimetype?.startsWith("image/")) {
    return `${getApiBaseUrl()}/files/thumbnail/${file.id}?size=small`;
  }
  return null;
};

const getFileIcon = (file: AnkaaFile) => {
  if (file.mimetype === "application/pdf") {
    return <IconFileTypePdf size={36} className="text-red-500" />;
  }
  if (file.mimetype?.startsWith("image/")) {
    return <IconPhoto size={36} className="text-blue-500" />;
  }
  return <IconFile size={36} className="text-muted-foreground" />;
};

/**
 * Renders ONLY the recommendation cards — as a fragment of flex items — so they sit in
 * the SAME horizontal strip as the attached-layout cards (the ArtworkFileUploadField
 * card row places this between the layouts and the add-card). Same size/shape as a
 * layout card, but a dashed border + amber "Recomendado" badge + "Usar" action make it
 * unmistakably a recommendation, not a selected layout.
 */
export const FileSuggestions: React.FC<FileSuggestionsProps> = ({
  customerId,
  fileContext,
  excludeFileIds,
  onSelect,
  disabled = false,
}) => {
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  // "Usar" clones the file (new id), so the ORIGINAL won't be in excludeFileIds and
  // would keep showing as a recommendation. Track the originals we've used and hide them.
  const [usedIds, setUsedIds] = useState<Set<string>>(() => new Set());

  const { data: suggestions, isLoading } = useFileSuggestions({
    customerId,
    fileContext,
    excludeIds: excludeFileIds,
  });

  const createFromExisting = useCreateFileFromExisting();
  const fileViewer = useFileViewer();

  const handleSelect = async (file: AnkaaFile) => {
    if (disabled || loadingFileId) return;
    setLoadingFileId(file.id);
    try {
      const result = await createFromExisting.mutateAsync(file.id);
      // The API now generates the clone's own thumbnail, so the attached card shows the
      // preview. (Backend also excludes the source by path on refetch.)
      onSelect(result.data);
      setUsedIds((prev) => new Set(prev).add(file.id)); // drop it from the shelf now
    } catch {
      // Error handled by react-query
    } finally {
      setLoadingFileId(null);
    }
  };

  const handleView = (file: AnkaaFile) => fileViewer.actions.viewFile(file);

  if (!customerId) return null;

  if (isLoading) {
    return (
      <>
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-[300px] w-[280px] shrink-0 rounded-lg" />
        ))}
      </>
    );
  }

  const visible = (suggestions ?? []).filter((f) => !usedIds.has(f.id));
  if (visible.length === 0) return null;

  return (
    <>
      {visible.map((file) => {
        const thumbnailUrl = getThumbnailUrl(file);
        const isCurrentLoading = loadingFileId === file.id;
        return (
          <div
            key={file.id}
            className="group/sug relative w-[280px] shrink-0 overflow-hidden rounded-lg border-2 border-dashed border-border bg-card/40"
          >
            {/* Clicking the preview USES the layout directly (one-click reuse). */}
            <button
              type="button"
              onClick={() => handleSelect(file)}
              disabled={disabled || !!loadingFileId}
              title="Usar este layout"
              className="relative block h-52 w-full bg-muted disabled:cursor-not-allowed"
            >
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={file.filename}
                  className="h-full w-full object-cover opacity-90"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.visibility = "hidden";
                  }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  {getFileIcon(file)}
                </div>
              )}
              {/* Recommendation badge — amber + sparkle. NEVER a selection check. */}
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-medium text-white shadow">
                <IconSparkles className="h-3 w-3" />
                Recomendado
              </span>
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover/sug:bg-black/40 group-hover/sug:opacity-100">
                <span className="flex items-center gap-1 text-xs font-medium text-white">
                  <IconCirclePlus size={14} />
                  Usar
                </span>
              </div>
              {isCurrentLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                  <IconLoader2 size={20} className="animate-spin text-primary" />
                </div>
              )}
            </button>
            <div className="space-y-2 p-2">
              <div>
                <p className="truncate text-xs font-medium" title={file.filename}>
                  {file.filename}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatRelativeTime(file.createdAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1 px-2"
                  onClick={() => handleView(file)}
                >
                  <IconEye className="mr-1 h-3.5 w-3.5" />
                  Ver
                </Button>
                {/* OUTLINE "Usar" (add) — distinct from the filled green "Selecionado". */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 flex-[2] px-2"
                  disabled={disabled || !!loadingFileId}
                  onClick={() => handleSelect(file)}
                >
                  <IconCirclePlus className="mr-1 h-3.5 w-3.5" />
                  Usar este layout
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};
