import React, { useState, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  IconUpload,
  IconFile,
  IconFileTypePdf,
  IconPhoto,
  IconFileText,
  IconX,
  IconVectorBezier,
  IconFileTypeDoc,
  IconFileTypeXls,
  IconFileTypePng,
  IconFileTypeJpg,
  IconPaperclip,
} from "@tabler/icons-react";
import type { FileWithPreview } from "@/components/common/file";
import { ArtworkStatusSelector } from "../artwork";

export interface ArtworkFileUploadFieldProps {
  onFilesChange: (files: FileWithPreview[]) => void;
  onStatusChange: (fileId: string, status: 'DRAFT' | 'APPROVED' | 'REPROVED') => void;
  maxFiles?: number;
  maxSize?: number;
  acceptedFileTypes?: Record<string, string[]>;
  existingFiles?: FileWithPreview[];
  disabled?: boolean;
  className?: string;
  showPreview?: boolean;
  placeholder?: string;
  label?: string;
}

const defaultAcceptedTypes = {
  "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp", ".svg"],
  "application/pdf": [".pdf"],
  "application/postscript": [".eps", ".ai"],
  "application/x-eps": [".eps"],
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const getFileIcon = (file: File | FileWithPreview) => {
  const type = (file.type || "").toLowerCase();
  const name = (file.name || "unknown").toLowerCase();

  const epsTypes = ["application/postscript", "application/x-eps", "application/eps", "image/eps", "image/x-eps"];
  if (epsTypes.includes(type) || name.endsWith(".eps") || name.endsWith(".ai")) {
    return IconVectorBezier;
  }

  if (type.startsWith("image/")) {
    if (name.endsWith(".png")) return IconFileTypePng;
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return IconFileTypeJpg;
    return IconPhoto;
  }

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    return IconFileTypePdf;
  }

  if (type.includes("word") || name.endsWith(".doc") || name.endsWith(".docx")) {
    return IconFileTypeDoc;
  }

  if (type.includes("sheet") || type.includes("excel") || name.endsWith(".xls") || name.endsWith(".xlsx")) {
    return IconFileTypeXls;
  }

  if (type === "text/plain" || name.endsWith(".txt") || name.endsWith(".csv")) {
    return IconFileText;
  }

  return IconFile;
};

export function ArtworkFileUploadField({
  onFilesChange,
  onStatusChange,
  maxFiles = 5,
  maxSize = 100 * 1024 * 1024,
  acceptedFileTypes = defaultAcceptedTypes,
  existingFiles = [],
  disabled = false,
  className,
  showPreview = true,
  placeholder,
  label,
}: ArtworkFileUploadFieldProps) {
  const [files, setFiles] = useState<FileWithPreview[]>(existingFiles);
  const [thumbnailErrors, setThumbnailErrors] = useState<Record<string, boolean>>({});

  // Sync with external file changes (important for parent components managing file state)
  React.useEffect(() => {
    setFiles(existingFiles);
  }, [existingFiles]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (disabled) return;

      const newFiles: FileWithPreview[] = acceptedFiles.map((file) => {
        const fileWithId = Object.assign(file, {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          preview: showPreview && file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
          uploadProgress: 0,
          uploaded: false,
          status: 'DRAFT' as const, // Default status for new uploads
        }) as FileWithPreview;

        return fileWithId;
      });

      const finalFiles = [...files, ...newFiles].slice(0, maxFiles);

      setFiles(finalFiles);
      onFilesChange(finalFiles);
    },
    [files, maxFiles, maxSize, disabled, showPreview, onFilesChange],
  );

  const isAtLimit = files.length >= maxFiles;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes,
    disabled: disabled || isAtLimit,
    maxFiles: maxFiles - files.length,
    noClick: isAtLimit,
    noKeyboard: isAtLimit,
  });

  const removeFile = useCallback(
    (fileId: string) => {
      if (disabled) return;

      setFiles((prevFiles) => {
        const fileToRemove = prevFiles.find((f) => f.id === fileId);
        if (fileToRemove?.preview) {
          URL.revokeObjectURL(fileToRemove.preview);
        }
        const updatedFiles = prevFiles.filter((f) => f.id !== fileId);
        onFilesChange(updatedFiles);
        return updatedFiles;
      });
    },
    [disabled, onFilesChange],
  );

  const acceptedFilesList = useMemo(() => {
    const allExtensions = Object.values(acceptedFileTypes).flat();
    const uniqueExtensions = Array.from(new Set(allExtensions));

    if (uniqueExtensions.length > 8) {
      const mainExtensions = uniqueExtensions.slice(0, 6).join(", ");
      return `${mainExtensions} e outros`;
    }

    return uniqueExtensions.join(", ");
  }, [acceptedFileTypes]);

  React.useEffect(() => {
    return () => {
      files.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, []);

  return (
    <div className={cn("space-y-3 w-full", className)}>
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed border-border/40 rounded-lg p-4 text-center transition-colors",
          !isAtLimit && !disabled && "cursor-pointer hover:border-primary/50 hover:bg-muted/30",
          isDragActive && !isAtLimit && "border-primary bg-primary/5",
          (disabled || isAtLimit) && "cursor-not-allowed opacity-50 bg-muted/10",
          "min-h-[100px] flex items-center justify-center",
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center space-y-2">
          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
            <IconUpload className={cn("w-4 h-4", isDragActive ? "text-primary" : "text-muted-foreground")} />
          </div>

          <div className="text-center">
            {isDragActive ? (
              <p className="text-sm font-medium text-primary">Solte os arquivos aqui...</p>
            ) : isAtLimit ? (
              <>
                <p className="text-sm font-medium text-muted-foreground">Limite de arquivos atingido</p>
                <p className="text-xs text-muted-foreground mt-1">Remova arquivos para adicionar novos</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">{placeholder || (files.length > 0 ? "Adicionar mais arquivos" : "Arraste ou clique para selecionar")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {acceptedFilesList} • Máx: {maxFiles} arquivos
                </p>
              </>
            )}
          </div>
        </div>

        {files.length > 0 && (
          <Badge variant="secondary" className="absolute top-2 right-2">
            {files.length}/{maxFiles}
          </Badge>
        )}
      </div>

      {/* File List with Status Controls */}
      {files.length > 0 && (
        <div className="space-y-2 w-full">
          {label && (
            <div className="flex items-center gap-2">
              <IconPaperclip className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{label}</span>
              <Badge variant="secondary" className="text-xs">
                {files.length}
              </Badge>
            </div>
          )}

          <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2">
            {files.map((file) => {
              const IconComponent = getFileIcon(file);
              const hasError = !!file.error;
              const isUploaded = !!file.uploaded;
              const isUploading = file.uploadProgress !== undefined && file.uploadProgress > 0 && file.uploadProgress < 100 && !isUploaded && !hasError;

              const thumbnailError = thumbnailErrors[file.id] || false;
              const shouldShowThumbnail = showPreview && !thumbnailError && (file.preview || (isUploaded && file.thumbnailUrl));

              const getThumbnailSrc = () => {
                const apiBaseUrl = (window as any).__ANKAA_API_URL__ || import.meta.env.VITE_API_URL || "http://localhost:3030";
                if (file.thumbnailUrl) {
                  if (file.thumbnailUrl.startsWith("/api")) return `${apiBaseUrl}${file.thumbnailUrl}`;
                  if (file.thumbnailUrl.startsWith("http")) return file.thumbnailUrl;
                  return file.thumbnailUrl;
                }
                if (file.preview) return file.preview;
                if (file.uploadedFileId) return `${apiBaseUrl}/files/thumbnail/${file.uploadedFileId}`;
                return "";
              };

              return (
                <div key={file.id} className="flex items-center gap-1.5 p-2.5 min-h-14 border border-border/30 rounded-lg bg-card hover:bg-muted/30 transition-colors">
                  {/* Thumbnail or Icon */}
                  <div className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded border border-border/20 bg-muted/50 overflow-hidden">
                    {isUploading ? (
                      <div className="w-4 h-4 border border-primary/30 border-t-primary animate-spin rounded-full" />
                    ) : shouldShowThumbnail ? (
                      <img
                        src={getThumbnailSrc()}
                        alt={file.name}
                        className="w-full h-full object-cover"
                        onError={() => setThumbnailErrors(prev => ({ ...prev, [file.id]: true }))}
                      />
                    ) : (
                      <IconComponent className={cn("w-4 h-4", isUploaded ? "text-primary" : "text-muted-foreground")} />
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{formatFileSize(file.size || 0)}</p>
                  </div>

                  {/* Status Selector */}
                  <ArtworkStatusSelector
                    value={file.status || 'DRAFT'}
                    onChange={(newStatus) => {
                      // Update file status in local state
                      setFiles(prev => prev.map(f => {
                        if (f.id !== file.id) return f;

                        // For File objects (new uploads), use Object.assign to preserve the File instance
                        // This is important because form submission uses `instanceof File` to filter files
                        if (f instanceof File) {
                          return Object.assign(f, { status: newStatus }) as FileWithPreview;
                        }

                        // For plain objects (existing files from server), create new object with
                        // explicit name/size/type properties. These properties are normally getters
                        // on File prototype and wouldn't be copied by spread operator alone.
                        return { ...f, name: f.name, size: f.size, type: f.type, status: newStatus as any };
                      }));

                      // Notify parent of status change
                      // Use uploadedFileId for existing files, or id for new uploads
                      const fileId = file.uploadedFileId || file.id;
                      console.log('[ArtworkFileUploadField] Status changed:', { fileId, uploadedFileId: file.uploadedFileId, id: file.id, newStatus });
                      onStatusChange(fileId, newStatus as any);
                    }}
                    disabled={disabled}
                  />

                  {/* Remove button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(file.id);
                    }}
                    disabled={disabled}
                    className="flex-shrink-0 h-7 w-7 p-0 hover:bg-destructive hover:text-white rounded-full"
                  >
                    <IconX className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
