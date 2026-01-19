import React, { useState, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  IconUpload,
  IconFile,
  IconFileTypePdf,
  IconPhoto,
  IconFileText,
  IconX,
  IconCheck,
  IconAlertCircle,
  IconVectorBezier,
  IconFileTypeDoc,
  IconFileTypeXls,
  IconFileTypePng,
  IconFileTypeJpg,
  IconPaperclip,
} from "@tabler/icons-react";
import type { FileWithPreview } from "./file-uploader";

export interface FileUploadFieldProps {
  onFilesChange: (files: FileWithPreview[]) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
  acceptedFileTypes?: Record<string, string[]>;
  existingFiles?: FileWithPreview[];
  disabled?: boolean;
  className?: string;
  showPreview?: boolean;
  variant?: "compact" | "full";
  placeholder?: string;
  label?: string;
  showFiles?: boolean;
}

const defaultAcceptedTypes = {
  "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp", ".svg"],
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "text/plain": [".txt"],
  "text/csv": [".csv"],
  "application/postscript": [".eps", ".ai"],
  "application/x-eps": [".eps"],
  "application/eps": [".eps"],
  "image/eps": [".eps"],
  "image/x-eps": [".eps"],
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

  // Check for EPS files
  const epsTypes = ["application/postscript", "application/x-eps", "application/eps", "image/eps", "image/x-eps"];
  if (epsTypes.includes(type) || name.endsWith(".eps") || name.endsWith(".ai")) {
    return IconVectorBezier;
  }

  // More specific image icons
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

const validateFile = (file: File, maxSize: number): string | null => {
  if (file.size > maxSize) {
    return `Arquivo muito grande. Tamanho máximo: ${formatFileSize(maxSize)}`;
  }
  return null;
};

// Default empty array constant to avoid creating new references
const EMPTY_FILES: FileWithPreview[] = [];

export function FileUploadField({
  onFilesChange,
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB default
  acceptedFileTypes = defaultAcceptedTypes,
  existingFiles = EMPTY_FILES,
  disabled = false,
  className,
  showPreview = true,
  variant = "compact",
  placeholder,
  label,
  showFiles = true,
}: FileUploadFieldProps) {
  const [files, setFiles] = useState<FileWithPreview[]>(existingFiles);
  const [thumbnailErrors, setThumbnailErrors] = useState<Record<string, boolean>>({});

  // Sync with external file changes - only when existingFiles reference changes externally
  // Don't sync if the change came from our own onFilesChange callback
  React.useEffect(() => {
    // Only update if existingFiles truly came from external source
    // Compare by creating a sorted string of IDs to avoid order issues
    const existingIds = [...existingFiles].sort((a, b) => a.id.localeCompare(b.id)).map(f => f.id).join(',');
    const currentIds = [...files].sort((a, b) => a.id.localeCompare(b.id)).map(f => f.id).join(',');

    if (existingIds !== currentIds) {
      setFiles(existingFiles);
    }
    // Only depend on existingFiles, not on files
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingFiles]);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      if (disabled) return;

      // Process accepted files
      const newFiles: FileWithPreview[] = acceptedFiles.map((file) => {
        const fileWithId: FileWithPreview = Object.assign(file, {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          uploadProgress: 0,
          uploaded: false, // Mark as not uploaded yet (new file)
        });

        // Create preview for images
        if (showPreview && file.type && file.type.startsWith("image/")) {
          fileWithId.preview = URL.createObjectURL(file);
        }

        // Validate file
        const error = validateFile(file, maxSize);
        if (error) {
          fileWithId.error = error;
        }

        return fileWithId;
      });

      // Handle rejected files
      const rejectedFileObjects: FileWithPreview[] = rejectedFiles.map(({ file, errors }) => {
        // Translate error messages to Portuguese
        const translatedErrors = errors.map((e: any) => {
          switch (e.code) {
            case "file-too-large":
              return `Arquivo muito grande. Tamanho máximo: ${formatFileSize(maxSize)}`;
            case "file-invalid-type":
              return "Tipo de arquivo não permitido";
            case "too-many-files":
              return `Muitos arquivos. Máximo permitido: ${maxFiles}`;
            default:
              return e.message;
          }
        });

        const fileWithId: FileWithPreview = Object.assign(file, {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          error: translatedErrors.join(", "),
          uploaded: false, // Mark as not uploaded yet (new file)
        });
        return fileWithId;
      });

      const allNewFiles = [...newFiles, ...rejectedFileObjects];

      // Check total file count
      const updatedFiles = [...files, ...allNewFiles];
      const finalFiles = updatedFiles.slice(0, maxFiles);

      if (updatedFiles.length > maxFiles) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`Limite de ${maxFiles} arquivos excedido. Alguns arquivos não foram adicionados.`);
        }
      }

      setFiles(finalFiles);
      onFilesChange(finalFiles);
    },
    [files, maxFiles, maxSize, disabled, showPreview, onFilesChange],
  );

  // Check if we've reached the file limit
  const isAtLimit = files.length >= maxFiles;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes,
    disabled: disabled || isAtLimit,
    maxFiles: maxFiles - files.length,
    noClick: isAtLimit, // Prevent click when at limit
    noKeyboard: isAtLimit, // Prevent keyboard activation when at limit
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

  // Clean up object URLs on unmount
  React.useEffect(() => {
    return () => {
      files.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, []);

  if (variant === "compact") {
    return (
      <div className={cn("space-y-3 w-full", className)}>
        {/* Compact Rectangle Upload Area */}
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

        {/* Compact File List */}
        {showFiles && files.length > 0 && (
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

  // Full variant (similar to original FileUploader but with rectangle focus)
  return (
    <div className={cn("space-y-4", className)}>
      {/* Rectangle Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed border-border/40 rounded-lg p-4 text-center transition-colors",
          !isAtLimit && !disabled && "cursor-pointer hover:border-primary/50 hover:bg-muted/30",
          isDragActive && !isAtLimit && "border-primary bg-primary/5",
          (disabled || isAtLimit) && "cursor-not-allowed opacity-50 bg-muted/10",
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center space-y-3">
          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
            <IconUpload className={cn("w-6 h-6", isDragActive ? "text-primary" : "text-muted-foreground")} />
          </div>

          <div className="space-y-1 text-center">
            {isDragActive ? (
              <p className="text-sm font-medium text-primary">Solte os arquivos aqui...</p>
            ) : isAtLimit ? (
              <>
                <p className="text-sm font-medium text-muted-foreground">Limite de arquivos atingido</p>
                <p className="text-xs text-muted-foreground">Remova arquivos para adicionar novos • Máx: {maxFiles} arquivos</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-foreground">{placeholder || "Arraste arquivos ou clique para selecionar"}</p>
                <p className="text-xs text-muted-foreground">
                  {acceptedFilesList} • Máx: {maxFiles} arquivos • Máx: {formatFileSize(maxSize)}
                </p>
              </>
            )}
          </div>

          {files.length > 0 && (
            <Badge variant="secondary">
              {files.length}/{maxFiles} arquivos
            </Badge>
          )}
        </div>
      </div>

      {/* File Grid */}
      {showFiles && files.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-foreground">
              Arquivos Selecionados ({files.length}/{maxFiles})
            </h4>
          </div>

          <ScrollArea className="w-full">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-2">
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
                  <div key={file.id} className="flex flex-col min-w-0 w-full">
                    {/* File card */}
                    <div className="flex flex-col items-center p-3 border border-border/30 rounded-lg bg-card">
                      {/* Thumbnail or Icon */}
                      <div className="relative w-full h-24 mb-2 overflow-hidden rounded border border-border/20 flex-shrink-0">
                        {isUploading ? (
                          <div className="w-full h-full flex items-center justify-center bg-primary/5">
                            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary animate-spin rounded-full" />
                          </div>
                        ) : shouldShowThumbnail ? (
                          <img
                            src={getThumbnailSrc()}
                            alt={file.name}
                            className="w-full h-full object-cover"
                            onError={() => setThumbnailErrors(prev => ({ ...prev, [file.id]: true }))}
                          />
                        ) : (
                          <div className={cn("w-full h-full flex items-center justify-center", isUploaded ? "bg-primary/10" : "bg-muted")}>
                            <IconComponent className={cn("w-8 h-8", isUploaded ? "text-primary" : "text-muted-foreground")} />
                          </div>
                        )}

                        {/* Remove button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(file.id);
                          }}
                          disabled={disabled}
                          className="absolute top-1 right-1 h-8 w-8 min-w-[2rem] min-h-[2rem] p-0 flex-shrink-0 bg-background/90 hover:bg-destructive hover:text-white rounded-full shadow-sm z-10"
                        >
                          <IconX className="w-4 h-4" />
                        </Button>

                        {/* Status indicator */}
                        {hasError && (
                          <div className="absolute top-1 left-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-sm">
                            <IconAlertCircle className="w-3 h-3 text-white" />
                          </div>
                        )}
                        {isUploaded && !hasError && (
                          <div className="absolute top-1 left-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
                            <IconCheck className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>

                      {/* File name */}
                      <p className="text-xs font-medium text-foreground text-center truncate w-full px-1" title={file.name}>
                        {file.name}
                      </p>

                      {/* File size */}
                      <p className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap">{formatFileSize(file.size || 0)}</p>
                    </div>

                    {/* Progress bar */}
                    {isUploading && (
                      <div className="mt-2">
                        <div className="h-1.5">
                          <Progress value={file.uploadProgress || 0} />
                        </div>
                        <p className="text-xs text-primary text-center mt-1">{Math.round(file.uploadProgress || 0)}%</p>
                      </div>
                    )}

                    {/* Error message */}
                    {hasError && <p className="text-xs text-destructive text-center mt-1 px-1 truncate w-full" title={file.error}>{file.error}</p>}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
