import React from "react";
import type { File as AnkaaFile } from "../../types";
import { FilePreviewGrid } from "./file-preview-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconFiles } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

export interface FilePreviewSectionProps {
  files: AnkaaFile[];
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
  onDownload?: (file: AnkaaFile) => void;
  className?: string;
  cardClassName?: string;
  size?: "sm" | "md" | "lg";
  showViewToggle?: boolean;
  showMetadata?: boolean;
  showPagination?: boolean;
  filesPerPage?: number;
  maxFiles?: number;
  level?: number;
  animationDelay?: string;
  emptyMessage?: string;
  emptyDescription?: string;
}

export const FilePreviewSection: React.FC<FilePreviewSectionProps> = ({
  files = [],
  title = "Arquivos",
  icon: Icon = IconFiles,
  onDownload,
  className,
  cardClassName,
  size = "md",
  showViewToggle = true,
  showMetadata = true,
  showPagination = false,
  filesPerPage = 12,
  maxFiles,
  level = 1,
  animationDelay = "duration-1000",
  emptyMessage,
  emptyDescription,
}) => {
  const handleDownload = (file: AnkaaFile) => {
    if (onDownload) {
      onDownload(file);
    } else {
      // Default download behavior
      const apiUrl = (window as any).__ANKAA_API_URL__ || process.env.VITE_API_URL || "http://localhost:3030";
      const downloadUrl = `${apiUrl}/files/${file.id}/download`;
      window.open(downloadUrl, "_blank");
    }
  };

  // Don't render if no files and no custom empty message
  if (files.length === 0 && !emptyMessage) {
    return null;
  }

  // Determine if this section should span full width based on file count or size
  const shouldSpanFull = files.length > 6 || size === "lg" || showPagination;
  const spanClass = shouldSpanFull ? "lg:col-span-2" : "";

  return (
    <Card className={cn("border flex flex-col animate-in fade-in-50", animationDelay, spanClass, cardClassName, className)} level={level}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg font-medium">
          <Icon className="h-5 w-5 text-muted-foreground" />
          {title}
          {files.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {files.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        {files.length > 0 ? (
          <FilePreviewGrid
            files={files}
            title=""
            size={size}
            showViewToggle={showViewToggle}
            showMetadata={showMetadata}
            showPagination={showPagination}
            filesPerPage={filesPerPage}
            maxFiles={maxFiles}
            onDownload={handleDownload}
          />
        ) : (
          <div className="text-center py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Icon className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{emptyMessage || "Nenhum arquivo encontrado"}</p>
                <p className="text-xs text-muted-foreground">{emptyDescription || "Os arquivos anexados aparecerão aqui"}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default FilePreviewSection;
