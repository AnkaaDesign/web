import { useState, type ComponentType } from "react";
import { Button } from "@/components/ui/button";
import { IconLayoutGrid, IconList } from "@tabler/icons-react";
import type { File as AnkaaFile } from "../../../../types";
import { cn } from "@/lib/utils";
import { FileItem, type FileViewMode, useFileViewer } from "@/components/common/file";

interface AirbrushingFilesSectionProps {
  files: AnkaaFile[];
  /** Icon shown in the empty state. */
  emptyIcon: ComponentType<{ className?: string }>;
  emptyTitle: string;
  emptyDescription: string;
  /** Initial layout — "grid" for layouts (images), "list" for documents. */
  defaultViewMode?: FileViewMode;
}

/**
 * Bare file gallery — the BODY of an airbrushing files card without any Card/header chrome
 * (the DetailPage section provides the title). Grid/list toggle + click-to-preview via the
 * app-level file viewer. Mirrors order-documents-section.tsx; reused for layouts, invoices,
 * and receipts.
 */
export function AirbrushingFilesSection({ files, emptyIcon: EmptyIcon, emptyTitle, emptyDescription, defaultViewMode = "list" }: AirbrushingFilesSectionProps) {
  const [viewMode, setViewMode] = useState<FileViewMode>(defaultViewMode);
  const { actions } = useFileViewer();

  const handleFileClick = (file: AnkaaFile) => {
    const index = files.findIndex((f) => f.id === file.id);
    actions.viewFiles(files, index >= 0 ? index : 0);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-1">
        <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")} className="h-8 w-8 p-0">
          <IconList className="h-4 w-4" />
        </Button>
        <Button variant={viewMode === "grid" ? "default" : "outline"} size="sm" onClick={() => setViewMode("grid")} className="h-8 w-8 p-0">
          <IconLayoutGrid className="h-4 w-4" />
        </Button>
      </div>
      {files.length > 0 ? (
        <div className="max-h-[420px] overflow-y-auto">
          <div className={cn(viewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
            {files.map((file) => (
              <FileItem key={file.id} file={file} viewMode={viewMode} onPreview={handleFileClick} />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <EmptyIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-foreground">{emptyTitle}</h3>
          <p className="text-sm text-muted-foreground">{emptyDescription}</p>
        </div>
      )}
    </div>
  );
}
