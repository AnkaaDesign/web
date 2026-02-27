import React, { useState } from "react";
import type { File as AnkaaFile } from "../../../types";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconLoader2, IconFile, IconPhoto, IconFileTypePdf, IconEye, IconCirclePlus } from "@tabler/icons-react";
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
    const baseUrl = getApiBaseUrl();
    return `${baseUrl}/files/thumbnail/${file.id}?size=small`;
  }
  return null;
};

const getFileIcon = (file: AnkaaFile) => {
  if (file.mimetype === "application/pdf") {
    return <IconFileTypePdf size={20} className="text-red-500" />;
  }
  if (file.mimetype?.startsWith("image/")) {
    return <IconPhoto size={20} className="text-blue-500" />;
  }
  return <IconFile size={20} className="text-muted-foreground" />;
};

const truncateFilename = (name: string, maxLen = 20): string => {
  if (name.length <= maxLen) return name;
  const ext = name.lastIndexOf(".");
  if (ext > 0) {
    const extension = name.slice(ext);
    const base = name.slice(0, maxLen - extension.length - 3);
    return `${base}...${extension}`;
  }
  return `${name.slice(0, maxLen - 3)}...`;
};

export const FileSuggestions: React.FC<FileSuggestionsProps> = ({
  customerId,
  fileContext,
  excludeFileIds,
  onSelect,
  disabled = false,
}) => {
  const [loadingFileId, setLoadingFileId] = useState<string | null>(null);
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);

  const { data: suggestions, isLoading } = useFileSuggestions({
    customerId,
    fileContext,
    excludeIds: excludeFileIds,
  });

  const createFromExisting = useCreateFileFromExisting();
  const fileViewer = useFileViewer();

  const handleSelect = async (file: AnkaaFile) => {
    if (disabled || loadingFileId) return;
    setOpenPopoverId(null);
    setLoadingFileId(file.id);
    try {
      const result = await createFromExisting.mutateAsync(file.id);
      onSelect(result.data);
    } catch {
      // Error handled by react-query
    } finally {
      setLoadingFileId(null);
    }
  };

  const handleView = (file: AnkaaFile) => {
    setOpenPopoverId(null);
    fileViewer.actions.viewFile(file);
  };

  if (!customerId) return null;

  if (isLoading) {
    return (
      <div className="mt-1.5">
        <p className="text-[11px] text-muted-foreground/80 mb-1">Arquivos recentes do cliente</p>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-[72px] shrink-0 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="mt-1.5">
      <p className="text-[11px] text-muted-foreground/80 mb-1">Arquivos recentes do cliente</p>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {suggestions.map((file) => {
          const thumbnailUrl = getThumbnailUrl(file);
          const isCurrentLoading = loadingFileId === file.id;

          return (
            <Popover
              key={file.id}
              open={openPopoverId === file.id}
              onOpenChange={(open) => setOpenPopoverId(open ? file.id : null)}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={disabled || !!loadingFileId}
                  className={cn(
                    "relative flex flex-col items-center gap-0.5 p-1 rounded border border-border/40 bg-muted/30 hover:bg-muted/60 transition-colors shrink-0 w-[72px] cursor-pointer",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    isCurrentLoading && "opacity-70",
                    openPopoverId === file.id && "ring-1 ring-primary/50 border-primary/50",
                  )}
                >
                  {isCurrentLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded z-10">
                      <IconLoader2 size={16} className="animate-spin text-primary" />
                    </div>
                  )}
                  <div className="w-11 h-11 rounded-sm flex items-center justify-center overflow-hidden bg-muted/60">
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={file.filename}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <span className={thumbnailUrl ? "hidden" : ""}>
                      {getFileIcon(file)}
                    </span>
                  </div>
                  <span className="text-[9px] text-muted-foreground leading-tight text-center w-full truncate" title={file.filename}>
                    {truncateFilename(file.filename)}
                  </span>
                  <span className="text-[8px] text-muted-foreground/60 leading-tight">
                    {formatRelativeTime(file.createdAt)}
                  </span>
                </button>
              </PopoverTrigger>

              <PopoverContent
                className="w-auto p-1 flex gap-1"
                side="top"
                sideOffset={4}
                align="center"
              >
                <button
                  type="button"
                  onClick={() => handleView(file)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                >
                  <IconEye size={14} />
                  Ver
                </button>
                <button
                  type="button"
                  onClick={() => handleSelect(file)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  <IconCirclePlus size={14} />
                  Selecionar
                </button>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
};
