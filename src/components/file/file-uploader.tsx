import React, { useState, useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CardProgressOverlay } from "@/components/ui/upload-progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconUpload, IconX, IconAlertCircle } from "@tabler/icons-react";
import { FileTypeAvatar } from "@/components/ui/file-type-icon";
import { getApiBaseUrl } from "@/utils/file";

export interface FileWithPreview extends File {
  id: string;
  preview?: string;
  uploadProgress?: number;
  error?: string;
  uploaded?: boolean;
  uploadedFileId?: string;
  thumbnailUrl?: string;
}

export interface FileUploaderProps {
  onFilesChange: (files: FileWithPreview[]) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
  acceptedFileTypes?: Record<string, string[]>;
  existingFiles?: FileWithPreview[];
  disabled?: boolean;
  className?: string;
  showPreview?: boolean;
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

// Removed getFileIcon function - now using FileTypeAvatar component

const validateFile = (file: File, maxSize: number): string | null => {
  if (file.size > maxSize) {
    return `Arquivo muito grande. Tamanho máximo: ${formatFileSize(maxSize)}`;
  }
  return null;
};

export function FileUploader({
  onFilesChange,
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB default
  acceptedFileTypes = defaultAcceptedTypes,
  existingFiles = [],
  disabled = false,
  className,
  showPreview = true,
}: FileUploaderProps) {
  const [files, setFiles] = useState<FileWithPreview[]>(existingFiles);
  const [pendingThumbnails, setPendingThumbnails] = useState<Set<string>>(new Set());
  const [thumbnailPollingStartTime] = useState<Map<string, number>>(new Map());
  const THUMBNAIL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes timeout

  // Sync with external file changes (important for parent components managing file state)
  React.useEffect(() => {
    setFiles(existingFiles);
  }, [existingFiles]);

  // Poll for thumbnails that are being generated in background (PDF, EPS)
  React.useEffect(() => {
    const checkPendingThumbnails = async () => {
      if (pendingThumbnails.size === 0) return;

      const currentTime = Date.now();
      const filesToRemove = new Set<string>();

      for (const fileId of pendingThumbnails) {
        // Check if polling has timed out
        const startTime = thumbnailPollingStartTime.get(fileId);
        if (startTime && currentTime - startTime > THUMBNAIL_TIMEOUT_MS) {
          filesToRemove.add(fileId);
          continue;
        }

        try {
          const apiBaseUrl = getApiBaseUrl();
          const response = await fetch(`${apiBaseUrl}/files/thumbnail/${fileId}`);
          if (response.ok) {
            // Thumbnail is ready, update the file
            setFiles((prevFiles) =>
              prevFiles.map((f) => {
                if (f.uploadedFileId === fileId && !f.thumbnailUrl) {
                  return {
                    ...f,
                    thumbnailUrl: `${apiBaseUrl}/files/thumbnail/${fileId}`,
                  };
                }
                return f;
              }),
            );

            filesToRemove.add(fileId);
          }
        } catch (error) {
          // Check if this is a 404 (thumbnail not ready) vs other errors
        }
      }

      // Remove completed or timed out files from pending
      if (filesToRemove.size > 0) {
        setPendingThumbnails((prev) => {
          const newSet = new Set(prev);
          filesToRemove.forEach((id) => {
            newSet.delete(id);
            thumbnailPollingStartTime.delete(id);
          });
          return newSet;
        });
      }
    };

    const interval = setInterval(checkPendingThumbnails, 2000); // Check every 2 seconds
    return () => clearInterval(interval);
  }, [pendingThumbnails]);

  // Track files that might need thumbnail polling
  React.useEffect(() => {
    const newPending = new Set<string>();

    files.forEach((file) => {
      if (file.uploaded && file.uploadedFileId && !file.thumbnailUrl) {
        const fileType = file.type || "";
        const fileName = file.name || "";

        // Check for files that support thumbnails
        const supportsThumbnails =
          fileType === "application/pdf" ||
          fileType === "application/postscript" ||
          fileType === "application/x-eps" ||
          fileType === "application/eps" ||
          fileType === "image/eps" ||
          fileType === "image/x-eps" ||
          fileName.toLowerCase().endsWith(".eps") ||
          fileName.toLowerCase().endsWith(".pdf");

        if (supportsThumbnails) {
          newPending.add(file.uploadedFileId);

          // Record start time for timeout tracking (only if not already tracking)
          if (!thumbnailPollingStartTime.has(file.uploadedFileId)) {
            thumbnailPollingStartTime.set(file.uploadedFileId, Date.now());
          }
        }
      }
    });

    // Log for debugging page reload scenarios
    if (newPending.size > 0) {
    }

    setPendingThumbnails(newPending);
  }, [files]);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      if (disabled) return;

      // Process accepted files
      const newFiles: FileWithPreview[] = acceptedFiles.map((file) => {
        const fileWithId: FileWithPreview = Object.assign(file, {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          uploadProgress: 0,
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
        const fileWithId: FileWithPreview = Object.assign(file, {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          error: errors.map((e: any) => e.message).join(", "),
        });
        return fileWithId;
      });

      const allNewFiles = [...newFiles, ...rejectedFileObjects];

      // Check total file count
      const updatedFiles = [...files, ...allNewFiles];
      const finalFiles = updatedFiles.slice(0, maxFiles);

      if (updatedFiles.length > maxFiles) {
        // Show warning that some files were not added
        console.warn(`Limite de ${maxFiles} arquivos excedido. Alguns arquivos não foram adicionados.`);
      }

      setFiles(finalFiles);
      onFilesChange(finalFiles);
    },
    [files, maxFiles, maxSize, disabled, showPreview, onFilesChange],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFileTypes,
    disabled,
    maxFiles: maxFiles - files.length,
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
    // Remove duplicates and limit display
    const uniqueExtensions = Array.from(new Set(allExtensions));

    // If too many extensions, show a shorter version
    if (uniqueExtensions.length > 8) {
      const mainExtensions = uniqueExtensions.slice(0, 6).join(", ");
      return `${mainExtensions} e outros`;
    }

    return uniqueExtensions.join(", ");
  }, [acceptedFileTypes]);

  // Auto-upload files when they are added (if needed)
  // Note: Some components like CutSelector handle uploads manually

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

  const FileItem = ({ file }: { file: FileWithPreview }) => {
    // Ensure file exists
    if (!file) {
      return null;
    }

    const hasError = !!file.error;
    const isUploaded = !!file.uploaded;
    const isUploading = file.uploadProgress !== undefined && file.uploadProgress > 0 && file.uploadProgress < 100 && !isUploaded && !hasError;
    const isProcessing = file.uploadProgress === 100 && !isUploaded && !hasError;
    const [thumbnailError, setThumbnailError] = React.useState(false);

    // Determine upload status for progress component
    const uploadStatus = React.useMemo(() => {
      if (hasError) return "error";
      if (isUploaded) return "completed";
      if (isProcessing) return "processing";
      if (isUploading) return "uploading";
      return "idle";
    }, [hasError, isUploaded, isProcessing, isUploading]);

    // Get progress message based on status
    const getProgressMessage = () => {
      switch (uploadStatus) {
        case "uploading":
          return "Enviando...";
        case "processing":
          return "Processando...";
        case "completed":
          return "Concluído!";
        case "error":
          return file.error || "Erro no upload";
        default:
          return undefined;
      }
    };

    // Determine if we should show a thumbnail
    const shouldShowThumbnail =
      showPreview &&
      !thumbnailError &&
      (file.preview || // Local preview for images
        (isUploaded && file.thumbnailUrl)); // Only show thumbnail when we have a confirmed thumbnailUrl from server

    // Debug PDF and EPS files - variables removed as they were unused

    // Reset thumbnail error when file changes
    React.useEffect(() => {
      setThumbnailError(false);
    }, [file.id, file.thumbnailUrl]);

    const getThumbnailSrc = () => {
      // Get base URL for API requests
      const apiBaseUrl = "http://localhost:3030"; // This should match your API server

      const src = (() => {
        if (file.thumbnailUrl) {
          // If thumbnailUrl starts with /api, prepend base URL
          if (file.thumbnailUrl.startsWith("/api")) {
            return `${apiBaseUrl}${file.thumbnailUrl}`;
          }
          return file.thumbnailUrl;
        }
        if (file.preview) return file.preview; // Local preview for images only
        if (file.uploadedFileId) {
          // Always use full URL for API endpoints
          // For PDFs and EPS files, always try thumbnail endpoint
          return `${apiBaseUrl}/files/thumbnail/${file.uploadedFileId}`;
        }
        return "";
      })();

      return src;
    };

    return (
      <div className="flex flex-col w-48 min-w-0">
        {/* File card with fixed width */}
        <div className="relative flex flex-col items-center p-2 border border-border/50 rounded-lg bg-card overflow-hidden">
          {/* Integrated progress overlay */}
          <CardProgressOverlay
            progress={file.uploadProgress || 0}
            status={uploadStatus}
            message={getProgressMessage()}
            className={cn("transition-all duration-300", uploadStatus === "completed" && "animate-success-bounce", uploadStatus === "error" && "animate-error-shake")}
          />

          {/* Thumbnail/Icon */}
          <div className="relative w-44 h-28 mb-2 flex-shrink-0">
            {isUploading ? (
              // Show loading spinner during upload
              <div className="w-full h-full flex items-center justify-center rounded border bg-primary/5">
                <div className="w-8 h-8 border-2 border-primary/30 border-t-primary animate-spin rounded-full" />
              </div>
            ) : shouldShowThumbnail ? (
              <img
                src={getThumbnailSrc()}
                alt={file.name || "thumbnail"}
                className="w-full h-full object-cover rounded border"
                onLoad={() => {
                  if (file.preview && !isUploaded) {
                    URL.revokeObjectURL(file.preview);
                  }
                }}
                onError={() => {
                  setThumbnailError(true);
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center rounded border">
                <FileTypeAvatar
                  filename={file.name || "unknown"}
                  mimeType={file.type}
                  isProcessing={isProcessing}
                  isError={hasError}
                  className="border-0" // Remove extra border since parent has border
                />
              </div>
            )}

            {/* Remove button in top-right */}
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                removeFile(file.id);
              }}
              disabled={disabled}
              className="absolute top-1 right-1 h-6 w-6 p-0 flex-shrink-0 bg-background/90 hover:bg-destructive hover:text-white rounded-full shadow-sm z-10"
            >
              <IconX className="w-3.5 h-3.5" />
            </Button>

            {/* Error indicator */}
            {hasError && (
              <div className="absolute top-1 left-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-sm">
                <IconAlertCircle className="w-3 h-3 text-white" />
              </div>
            )}
          </div>

          {/* File name */}
          <p className="text-xs font-medium text-foreground text-center truncate w-full max-w-full px-1" title={file.name}>
            {file.name || "Arquivo sem nome"}
          </p>

          {/* File size */}
          <p className="text-xs text-muted-foreground mt-0.5 flex-shrink-0">{formatFileSize(file.size || 0)}</p>
        </div>

        {/* Error message below card (only for severe errors) */}
        {hasError && uploadStatus === "error" && <p className="text-xs text-destructive text-center mt-1 px-1 animate-error-shake truncate max-w-full" title={file.error}>{file.error}</p>}
      </div>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Dropzone */}
      <Card>
        <CardContent className="p-0">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
              "hover:border-primary/50 hover:bg-muted/30",
              isDragActive && "border-primary bg-primary/5",
              disabled && "cursor-not-allowed opacity-50",
              files.length >= maxFiles && "cursor-not-allowed opacity-50",
              className,
            )}
          >
            <input {...getInputProps()} />

            <div className="flex flex-col items-center space-y-2">
              <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                <IconUpload className={cn("w-5 h-5", isDragActive ? "text-primary" : "text-muted-foreground")} />
              </div>

              <div className="space-y-1 text-center max-w-[200px]">
                {isDragActive ? (
                  <p className="text-sm font-medium text-primary">Solte os arquivos aqui...</p>
                ) : (
                  <p className="text-sm font-medium text-foreground">Arraste ou clique</p>
                )}

                <p className="text-xs text-muted-foreground truncate" title={`${acceptedFilesList} • Máx: ${maxFiles} arquivos`}>
                  {acceptedFilesList} • Máx: {maxFiles} arquivos
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-foreground">
                Arquivos Selecionados ({files.length}/{maxFiles})
              </h4>
            </div>

            <ScrollArea className="w-full">
              <div className="flex gap-3 pb-2">
                {files.map((file) => (
                  <FileItem key={file.id} file={file} />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
