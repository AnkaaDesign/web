import React, { useState, useCallback, useContext, useMemo, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { FileViewerContext } from "@/components/common/file/file-viewer";
import type { File as AnkaaFile } from "@/types";
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
import { LayoutStatusSelector } from "../layout";
import { getApiBaseUrl } from "@/config/api";
import { rewriteCdnUrl } from "@/utils/file";
import { generatePDFThumbnailFromBlob } from "@/utils/pdf-thumbnail";

const isPdfFile = (file: File): boolean =>
  file.type === "application/pdf" || (file.name || "").toLowerCase().endsWith(".pdf");

export interface LayoutFileUploadFieldProps {
  onFilesChange: (files: FileWithPreview[]) => void;
  // Optional: some consumers (e.g. airbrushing layouts) have no per-file status workflow.
  onStatusChange?: (fileId: string, status: 'DRAFT' | 'APPROVED' | 'REPROVED') => void;
  // When false, the per-file status selector is hidden entirely (no DRAFT/APPROVED/REPROVED).
  showStatus?: boolean;
  maxFiles?: number;
  maxSize?: number;
  acceptedFileTypes?: Record<string, string[]>;
  existingFiles?: FileWithPreview[];
  disabled?: boolean;
  className?: string;
  showPreview?: boolean;
  placeholder?: string;
  label?: string;
  children?: React.ReactNode;
  // "list" (default) = compact rows; "card" = image-on-top cards in a single
  // horizontal-scroll row (no wrapping), matching the budget "Layout Aprovado" cards.
  variant?: "list" | "card";
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

export function LayoutFileUploadField({
  onFilesChange,
  onStatusChange,
  showStatus = true,
  maxFiles = 10,
  maxSize = 100 * 1024 * 1024,
  acceptedFileTypes = defaultAcceptedTypes,
  existingFiles = [],
  disabled = false,
  className,
  showPreview = true,
  placeholder,
  label,
  children,
  variant = "list",
}: LayoutFileUploadFieldProps) {
  const [files, setFiles] = useState<FileWithPreview[]>(existingFiles);
  const [thumbnailErrors, setThumbnailErrors] = useState<Record<string, boolean>>({});

  // Card row is a single horizontal-scroll strip. Let a normal vertical mouse wheel
  // scroll it sideways (no Shift) — but SMARTLY: only hijack the wheel while the strip
  // can still scroll that way, so at either end the page scrolls normally (no trap).
  // Non-passive listener so preventDefault works.
  const cardScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = cardScrollRef.current;
    if (!el || variant !== "card") return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      if (el.scrollWidth <= el.clientWidth) return; // no overflow → let the page scroll
      const atStart = el.scrollLeft <= 0;
      const atEnd = Math.ceil(el.scrollLeft + el.clientWidth) >= el.scrollWidth;
      if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return; // edge → page scroll
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [variant]);

  // Sync with external file changes (important for parent components managing file state)
  React.useEffect(() => {
    setFiles(existingFiles);
  }, [existingFiles]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (disabled) return;

      const newFiles: FileWithPreview[] = acceptedFiles.map((file) => {
        const isImage = file.type.startsWith("image/");
        const isPdf = isPdfFile(file);
        const fileWithId = Object.assign(file, {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          preview: showPreview && isImage ? URL.createObjectURL(file) : undefined,
          // PDFs get a rendered first-page thumbnail generated asynchronously below.
          pdfPreviewLoading: showPreview && isPdf,
          uploadProgress: 0,
          uploaded: false,
          status: 'DRAFT' as const, // Default status for new uploads
        }) as FileWithPreview;

        return fileWithId;
      });

      const finalFiles = [...files, ...newFiles].slice(0, maxFiles);

      setFiles(finalFiles);
      onFilesChange(finalFiles);

      // Generate first-page previews for freshly dropped PDFs (client-side, before
      // upload). Each resolves independently and patches its own file's `preview`.
      if (showPreview) {
        finalFiles
          .filter((f) => newFiles.some((nf) => nf.id === f.id) && isPdfFile(f))
          .forEach((pdf) => {
            generatePDFThumbnailFromBlob(pdf).then((dataUrl) => {
              setFiles((prev) =>
                prev.map((f) => {
                  if (f.id !== pdf.id) return f;
                  const patch = { preview: dataUrl || undefined, pdfPreviewLoading: false };
                  return (f instanceof File
                    ? Object.assign(f, patch)
                    : { ...f, ...patch }) as FileWithPreview;
                }),
              );
            });
          });
      }
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

  // Open a clicked thumbnail in the unified file viewer (already-uploaded files open
  // as a gallery; freshly dropped files open their local blob preview in a new tab)
  const fileViewer = useContext(FileViewerContext);
  const openFilePreview = useCallback(
    (clicked: FileWithPreview) => {
      if (clicked.uploaded || clicked.uploadedFileId) {
        if (!fileViewer) return;
        const uploadedFiles = files.filter((f) => f.uploaded || f.uploadedFileId);
        const viewerFiles = uploadedFiles.map(
          (f) =>
            ({
              id: f.uploadedFileId || f.id,
              filename: f.name,
              originalName: f.name,
              mimetype: f.type || "application/octet-stream",
              size: f.size || 0,
              thumbnailUrl: f.thumbnailUrl || null,
            }) as unknown as AnkaaFile,
        );
        const index = uploadedFiles.findIndex((f) => f.id === clicked.id);
        fileViewer.actions.viewFiles(viewerFiles, index >= 0 ? index : 0);
      } else if (clicked instanceof File) {
        // Open the ACTUAL local file (for PDFs `preview` is a rendered JPEG thumbnail,
        // not the document itself), so the browser shows the real PDF/image.
        const url = URL.createObjectURL(clicked);
        window.open(url, "_blank");
      } else if (clicked.preview) {
        window.open(clicked.preview, "_blank");
      }
    },
    [fileViewer, files],
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

  // Per-file CARD (image-on-top) for the `card` variant grid — mirrors the budget
  // "Layout Aprovado" card: preview (click → Ver), filename + size, colored status
  // selector, and a remove ✕ over the image.
  const renderFileCard = (file: FileWithPreview) => {
    const IconComponent = getFileIcon(file);
    const hasError = !!file.error;
    const isUploaded = !!file.uploaded;
    const isUploading =
      file.uploadProgress !== undefined &&
      file.uploadProgress > 0 &&
      file.uploadProgress < 100 &&
      !isUploaded &&
      !hasError;
    const thumbnailError = thumbnailErrors[file.id] || false;
    // An IMAGE that's already persisted (has a real File id) can always be previewed
    // via the /files/thumbnail/<id> endpoint even when `thumbnailUrl` wasn't loaded —
    // otherwise it falls back to a generic "JPG" icon. (onError still degrades to the
    // icon if the endpoint 404s.)
    const isImageFile =
      (file.type || "").startsWith("image/") ||
      /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(file.name || "");
    const shouldShowThumbnail =
      showPreview &&
      !thumbnailError &&
      !!(file.preview || file.thumbnailUrl || (isImageFile && file.uploadedFileId));
    const getThumbnailSrc = () => {
      const apiBaseUrl = getApiBaseUrl();
      if (file.thumbnailUrl) {
        if (file.thumbnailUrl.startsWith("/api")) return `${apiBaseUrl}${file.thumbnailUrl}`;
        if (file.thumbnailUrl.startsWith("http")) return rewriteCdnUrl(file.thumbnailUrl);
        return file.thumbnailUrl;
      }
      if (file.preview) return file.preview;
      if (file.uploadedFileId) return `${apiBaseUrl}/files/thumbnail/${file.uploadedFileId}`;
      return "";
    };
    const handleStatusChange = (newStatus: string) => {
      setFiles((prev) =>
        prev.map((f) => {
          if (f.id !== file.id) return f;
          if (f instanceof File) {
            return Object.assign(f, { status: newStatus }) as FileWithPreview;
          }
          const fileObj = f as FileWithPreview;
          return {
            ...fileObj,
            name: fileObj.name,
            size: fileObj.size,
            type: fileObj.type,
            status: newStatus as any,
          };
        }),
      );
      onStatusChange?.(file.uploadedFileId || file.id, newStatus as any);
    };
    return (
      <div
        key={file.id}
        className={cn(
          "relative w-[280px] shrink-0 overflow-hidden rounded-lg border-2 border-border bg-card",
        )}
      >
        <button
          type="button"
          onClick={() => !isUploading && openFilePreview(file)}
          title="Ver"
          className="relative block h-52 w-full bg-muted"
        >
          {isUploading || file.pdfPreviewLoading ? (
            <div className="flex h-full w-full items-center justify-center">
              <div className="h-5 w-5 animate-spin rounded-full border border-primary/30 border-t-primary" />
            </div>
          ) : shouldShowThumbnail ? (
            <img
              src={getThumbnailSrc()}
              alt={file.name}
              // PDFs render the whole page centered (no zoom/crop) with white
              // letterbox stripes; raster images fill the card.
              className={cn("h-full w-full", isPdfFile(file) ? "object-contain bg-white" : "object-cover")}
              onError={() => setThumbnailErrors((prev) => ({ ...prev, [file.id]: true }))}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <IconComponent
                className={cn("h-8 w-8", isUploaded ? "text-primary" : "text-muted-foreground")}
              />
            </div>
          )}
        </button>
        {!disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeFile(file.id);
            }}
            title="Remover"
            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-destructive hover:text-white"
          >
            <IconX className="h-3.5 w-3.5" />
          </button>
        )}
        <div className="space-y-2 p-2">
          <div>
            <p className="truncate text-xs font-medium text-foreground" title={file.name}>
              {file.name}
            </p>
            <p className="text-[10px] text-muted-foreground">{formatFileSize(file.size || 0)}</p>
          </div>
          {hasError && <p className="text-[10px] text-destructive">{file.error}</p>}
          {showStatus && (
            <LayoutStatusSelector
              value={file.status || "DRAFT"}
              onChange={handleStatusChange}
              disabled={disabled}
              className="w-full"
              triggerClassName="h-8 w-full justify-between"
            />
          )}
        </div>
      </div>
    );
  };

  // The dropzone rendered as an "add" CARD the same size as the layout cards, placed
  // at the END of the grid (no separate top dropzone, no "anexados" header).
  const renderAddCard = () => (
    <div
      {...getRootProps()}
      className={cn(
        "flex min-h-[300px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 p-4 text-center transition-colors",
        !disabled && "hover:border-primary/50 hover:bg-muted/30",
        isDragActive && "border-primary bg-primary/5",
        disabled && "cursor-not-allowed opacity-50",
        "w-[280px] shrink-0",
      )}
    >
      <input {...getInputProps()} />
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <IconUpload
          className={cn("h-5 w-5", isDragActive ? "text-primary" : "text-muted-foreground")}
        />
      </div>
      <p className="text-xs font-medium text-foreground">
        {isDragActive ? "Solte aqui..." : placeholder || "Adicionar layout"}
      </p>
      <p className="text-[10px] text-muted-foreground">{acceptedFilesList}</p>
    </div>
  );

  // CARD variant — ONE horizontal-scroll strip. The upload/add card (the actual file
  // picker) comes FIRST/left, then the attached layout cards NEWEST-FIRST (so a file you
  // just added sits right next to the picker), then any `children` (e.g. FileSuggestions'
  // inline "Recomendado" recommendation cards).
  if (variant === "card") {
    return (
      <div className={cn("w-full", className)}>
        <div ref={cardScrollRef} className="flex gap-3 overflow-x-auto pb-2">
          {!isAtLimit && renderAddCard()}
          {[...files].reverse().map((file) => renderFileCard(file))}
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3 w-full", className)}>
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed border-border rounded-lg p-4 text-center transition-colors",
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

      {/* Slot for content between upload area and file list (e.g. file suggestions) */}
      {children}

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
              const isImageFile =
                (file.type || "").startsWith("image/") ||
                /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(file.name || "");
              const shouldShowThumbnail =
                showPreview &&
                !thumbnailError &&
                !!(file.preview || file.thumbnailUrl || (isImageFile && file.uploadedFileId));

              const getThumbnailSrc = () => {
                const apiBaseUrl = getApiBaseUrl();
                if (file.thumbnailUrl) {
                  if (file.thumbnailUrl.startsWith("/api")) return `${apiBaseUrl}${file.thumbnailUrl}`;
                  if (file.thumbnailUrl.startsWith("http")) return rewriteCdnUrl(file.thumbnailUrl);
                  return file.thumbnailUrl;
                }
                if (file.preview) return file.preview;
                if (file.uploadedFileId) return `${apiBaseUrl}/files/thumbnail/${file.uploadedFileId}`;
                return "";
              };

              // Status change — preserve the File instance (Object.assign) so submit's
              // `instanceof File` filter still works; rebuild plain objects explicitly.
              const handleStatusChange = (newStatus: string) => {
                setFiles((prev) =>
                  prev.map((f) => {
                    if (f.id !== file.id) return f;
                    if (f instanceof File) {
                      return Object.assign(f, { status: newStatus }) as FileWithPreview;
                    }
                    const fileObj = f as FileWithPreview;
                    return {
                      ...fileObj,
                      name: fileObj.name,
                      size: fileObj.size,
                      type: fileObj.type,
                      status: newStatus as any,
                    };
                  }),
                );
                onStatusChange?.(file.uploadedFileId || file.id, newStatus as any);
              };

              return (
                <div key={file.id} className="flex items-center gap-1.5 p-2.5 min-h-14 border border-border/30 rounded-lg bg-card hover:bg-muted/30 transition-colors">
                  {/* Thumbnail or Icon */}
                  <div
                    className={cn(
                      "flex-shrink-0 w-9 h-9 flex items-center justify-center rounded border border-border/20 bg-muted/50 overflow-hidden",
                      !isUploading && (file.uploaded || file.uploadedFileId || file.preview) && "cursor-pointer hover:ring-2 hover:ring-primary/50 transition-shadow",
                    )}
                    onClick={() => !isUploading && openFilePreview(file)}
                  >
                    {isUploading || file.pdfPreviewLoading ? (
                      <div className="w-4 h-4 border border-primary/30 border-t-primary animate-spin rounded-full" />
                    ) : shouldShowThumbnail ? (
                      <img
                        src={getThumbnailSrc()}
                        alt={file.name}
                        className={cn("w-full h-full", isPdfFile(file) ? "object-contain bg-white" : "object-cover")}
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
                  {showStatus && (
                    <div className="shrink-0">
                      <LayoutStatusSelector
                        value={file.status || 'DRAFT'}
                        onChange={handleStatusChange}
                        disabled={disabled}
                      />
                    </div>
                  )}

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
