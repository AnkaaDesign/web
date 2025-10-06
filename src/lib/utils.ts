import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { File as BackendFile } from "../types";
import type { FileWithPreview } from "@/components/file";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert a backend File object to a FileWithPreview object for use in file upload components
 * This creates a compatible File-like object that extends the browser File API
 */
export function formatDateTime(date: Date | string | null): string {
  if (!date) return "";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getBadgeVariant(status: string): string {
  // Define badge variants based on status
  const variants: Record<string, string> = {
    ACTIVE: "success",
    INACTIVE: "secondary",
    PENDING: "warning",
    COMPLETED: "success",
    CANCELLED: "destructive",
    IN_PROGRESS: "default",
  };

  return variants[status] || "default";
}

export function backendFileToFileWithPreview(backendFile: BackendFile): FileWithPreview {
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3030";

  // Create a minimal File-like object that satisfies the FileWithPreview interface
  const fileWithPreview = Object.create(File.prototype);

  // Set required File properties
  Object.defineProperties(fileWithPreview, {
    name: { value: backendFile.filename, enumerable: true },
    size: { value: backendFile.size || 0, enumerable: true },
    type: { value: backendFile.mimetype || "", enumerable: true },
    lastModified: { value: new Date(backendFile.createdAt).getTime(), enumerable: true },
    webkitRelativePath: { value: "", enumerable: true },
  });

  // Add FileWithPreview specific properties
  fileWithPreview.id = backendFile.id;
  fileWithPreview.uploaded = true;
  fileWithPreview.uploadedFileId = backendFile.id;
  fileWithPreview.thumbnailUrl = backendFile.thumbnailUrl || undefined;
  fileWithPreview.preview = backendFile.thumbnailUrl ? `${apiBaseUrl}${backendFile.thumbnailUrl}` : undefined;

  // Add File API methods
  fileWithPreview.arrayBuffer = () => Promise.resolve(new ArrayBuffer(0));
  fileWithPreview.slice = (_start?: number, _end?: number, contentType?: string) => new Blob([], { type: contentType });
  fileWithPreview.stream = () => new ReadableStream();
  fileWithPreview.text = () => Promise.resolve("");

  return fileWithPreview as FileWithPreview;
}
