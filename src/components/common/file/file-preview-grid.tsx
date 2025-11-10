import React, { useState } from "react";
import type { File as AnkaaFile } from "../../../types";
import { FilePreviewCard } from "./file-preview-card";
import { FilePreview } from "./file-preview";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IconGrid3x3, IconList, IconDownload, IconFiles, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

export interface FilePreviewGridProps {
  files: AnkaaFile[];
  title?: string;
  onDownload?: (file: AnkaaFile) => void;
  className?: string;
  maxFiles?: number;
  size?: "sm" | "md" | "lg";
  showViewToggle?: boolean;
  showMetadata?: boolean;
  showPagination?: boolean;
  filesPerPage?: number;
}

type ViewMode = "grid" | "list";

export const FilePreviewGrid: React.FC<FilePreviewGridProps> = ({
  files = [],
  title = "Arquivos",
  onDownload,
  className,
  maxFiles,
  size = "md",
  showViewToggle = true,
  showMetadata = true,
  showPagination = false,
  filesPerPage = 12,
}) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFileIndex, setPreviewFileIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [currentPage, setCurrentPage] = useState(1);

  // Filter and limit files if needed
  const displayFiles = maxFiles ? files.slice(0, maxFiles) : files;

  // Pagination logic
  const totalPages = Math.ceil(displayFiles.length / filesPerPage);
  const startIndex = (currentPage - 1) * filesPerPage;
  const endIndex = showPagination ? startIndex + filesPerPage : displayFiles.length;
  const currentFiles = displayFiles.slice(startIndex, endIndex);

  const handlePreview = (file: AnkaaFile) => {
    const fileIndex = displayFiles.findIndex((f) => f.id === file.id);
    if (fileIndex !== -1) {
      setPreviewFileIndex(fileIndex);
      setPreviewOpen(true);
    }
  };

  const handleDownload = (file: AnkaaFile) => {
    if (onDownload) {
      onDownload(file);
    } else {
      // Default download behavior
      const apiUrl = (window as any).__ANKAA_API_URL__ || import.meta.env.VITE_API_URL || "http://localhost:3030";
      const downloadUrl = `${apiUrl}/files/${file.id}/download`;
      window.open(downloadUrl, "_blank");
    }
  };

  const handleDownloadAll = async () => {
    // Download files with a small delay to avoid popup blockers
    for (let i = 0; i < displayFiles.length; i++) {
      const file = displayFiles[i];
      handleDownload(file);
      // Add a small delay between downloads to avoid browser blocking
      if (i < displayFiles.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  };

  const getGridColumns = () => {
    switch (size) {
      case "sm":
        return "grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12";
      case "lg":
        return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
      default: // md
        return "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8";
    }
  };

  if (displayFiles.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <IconFiles className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Nenhum arquivo encontrado</p>
            <p className="text-xs text-muted-foreground">Os arquivos anexados aparecerão aqui</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header - Only show if title is provided */}
      {title && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <Badge variant="secondary" className="text-xs">
              {displayFiles.length}
            </Badge>
            {maxFiles && files.length > maxFiles && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                +{files.length - maxFiles} mais
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Download All Button */}
            {displayFiles.length > 1 && (
              <Button variant="outline" size="sm" onClick={handleDownloadAll} className="text-xs">
                <IconDownload className="h-3 w-3 mr-1" />
                Baixar Todos
              </Button>
            )}

            {/* View Toggle */}
            {showViewToggle && (
              <div className="flex rounded-md border border-border overflow-hidden">
                <Button variant={viewMode === "grid" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("grid")} className="rounded-none px-2 h-7">
                  <IconGrid3x3 className="h-3 w-3" />
                </Button>
                <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("list")} className="rounded-none px-2 h-7">
                  <IconList className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {viewMode === "grid" ? (
        <div className={cn("grid gap-3", getGridColumns())}>
          {currentFiles.map((file) => (
            <FilePreviewCard key={file.id} file={file} size={size} showMetadata={showMetadata} onDownload={handleDownload} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {currentFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border/30 hover:border-primary/30 hover:bg-muted/30 transition-all duration-200 cursor-pointer group"
              onClick={() => handlePreview(file)}
            >
              <div className="w-10 h-10 rounded bg-muted/50 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                <IconFiles className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{file.filename}</h4>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                  {showMetadata && file.createdAt && <span className="ml-2">• Adicionado {new Date(file.createdAt).toLocaleDateString()}</span>}
                </p>
              </div>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreview(file);
                  }}
                  className="h-7 w-7 p-0"
                >
                  <IconFiles className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(file);
                  }}
                  className="h-7 w-7 p-0"
                >
                  <IconDownload className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-border/30">
          <div className="text-xs text-muted-foreground">
            Mostrando {startIndex + 1} - {Math.min(endIndex, displayFiles.length)} de {displayFiles.length} arquivos
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1} className="h-7 w-7 p-0">
              <IconChevronLeft className="h-3 w-3" />
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  // Show first, last, current, and adjacent pages
                  return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                })
                .map((page, index, filtered) => {
                  // Add ellipsis if there's a gap
                  const prevPage = filtered[index - 1];
                  const showEllipsis = prevPage && page - prevPage > 1;

                  return (
                    <React.Fragment key={page}>
                      {showEllipsis && <span className="text-xs text-muted-foreground px-1">...</span>}
                      <Button variant={currentPage === page ? "default" : "ghost"} size="sm" onClick={() => setCurrentPage(page)} className="h-7 w-7 p-0 text-xs">
                        {page}
                      </Button>
                    </React.Fragment>
                  );
                })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="h-7 w-7 p-0"
            >
              <IconChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      <FilePreview files={displayFiles} initialFileIndex={previewFileIndex} open={previewOpen} onOpenChange={setPreviewOpen} />
    </div>
  );
};

export default FilePreviewGrid;
