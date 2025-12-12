// PDF Thumbnail Generation Utilities
import type { File as AnkaaFile } from "../types";

/**
 * Get API base URL from environment or fallback
 */
const getApiBaseUrl = (): string => {
  if (typeof globalThis !== "undefined" && typeof globalThis.window !== "undefined") {
    const windowApiUrl = (globalThis.window as any).__ANKAA_API_URL__;
    if (windowApiUrl) return windowApiUrl;
  }

  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  return "http://localhost:3030";
};

/**
 * PDF thumbnail options
 */
export interface PDFThumbnailOptions {
  size?: "small" | "medium" | "large";
  page?: number; // Which page to generate thumbnail from (default: 1)
  width?: number; // Custom width in pixels
  height?: number; // Custom height in pixels
  quality?: number; // JPEG quality 0-100 (default: 85)
}

/**
 * Generate PDF thumbnail URL
 * This assumes the backend supports PDF thumbnail generation
 */
export const getPDFThumbnailUrl = (
  file: AnkaaFile,
  options: PDFThumbnailOptions = {}
): string => {
  const apiUrl = getApiBaseUrl();
  const {
    size = "medium",
    page = 1,
    width,
    height,
    quality = 85,
  } = options;

  // If the file already has a thumbnail URL, use it
  if (file.thumbnailUrl) {
    if (file.thumbnailUrl.startsWith("http")) {
      return file.thumbnailUrl;
    }
    // Build full URL with size parameter
    const url = new URL(`${apiUrl}${file.thumbnailUrl}`);
    url.searchParams.set("size", size);
    return url.toString();
  }

  // Build thumbnail URL with parameters
  const url = new URL(`${apiUrl}/files/thumbnail/${file.id}`);
  url.searchParams.set("size", size);
  url.searchParams.set("page", page.toString());
  url.searchParams.set("quality", quality.toString());

  if (width) {
    url.searchParams.set("width", width.toString());
  }
  if (height) {
    url.searchParams.set("height", height.toString());
  }

  return url.toString();
};

/**
 * Check if a file is a PDF
 */
export const isPDFFile = (file: AnkaaFile): boolean => {
  return (
    file.mimetype?.toLowerCase() === "application/pdf" ||
    file.filename?.toLowerCase().endsWith(".pdf")
  );
};

/**
 * Get PDF metadata (number of pages, etc.)
 * This would typically come from the backend
 */
export interface PDFMetadata {
  pages?: number;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
}

/**
 * Fetch PDF metadata from backend
 */
export const getPDFMetadata = async (
  file: AnkaaFile
): Promise<PDFMetadata | null> => {
  if (!isPDFFile(file)) {
    return null;
  }

  try {
    const apiUrl = getApiBaseUrl();
    const response = await fetch(`${apiUrl}/files/${file.id}/metadata`);

    if (!response.ok) {
      console.warn("Failed to fetch PDF metadata:", response.statusText);
      return null;
    }

    const metadata = await response.json();
    return metadata;
  } catch (error) {
    console.warn("Error fetching PDF metadata:", error);
    return null;
  }
};

/**
 * Generate multiple thumbnail URLs for different pages
 */
export const getPDFPageThumbnails = (
  file: AnkaaFile,
  pageCount: number,
  options: Omit<PDFThumbnailOptions, "page"> = {}
): string[] => {
  const thumbnails: string[] = [];

  for (let page = 1; page <= pageCount; page++) {
    thumbnails.push(getPDFThumbnailUrl(file, { ...options, page }));
  }

  return thumbnails;
};

/**
 * Preload PDF thumbnail image
 */
export const preloadPDFThumbnail = (
  file: AnkaaFile,
  options: PDFThumbnailOptions = {}
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = getPDFThumbnailUrl(file, options);

    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load PDF thumbnail"));
    img.src = url;
  });
};

/**
 * Generate PDF thumbnail blob for upload/caching
 */
export const generatePDFThumbnailBlob = async (
  file: AnkaaFile,
  options: PDFThumbnailOptions = {}
): Promise<Blob | null> => {
  try {
    const url = getPDFThumbnailUrl(file, options);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch thumbnail: ${response.statusText}`);
    }

    return await response.blob();
  } catch (error) {
    console.error("Error generating PDF thumbnail blob:", error);
    return null;
  }
};

/**
 * Client-side PDF thumbnail generation using PDF.js
 * This is an optional enhancement if you want to generate thumbnails client-side
 * Note: Requires pdfjs-dist package to be installed
 */
export const generateClientSidePDFThumbnail = async (
  pdfUrl: string,
  options: {
    page?: number;
    scale?: number;
    width?: number;
    height?: number;
  } = {}
): Promise<string | null> => {
  // This is a placeholder for client-side thumbnail generation
  // You would need to install and import pdfjs-dist to implement this
  console.warn(
    "Client-side PDF thumbnail generation requires pdfjs-dist package"
  );
  return null;

  /*
  Example implementation with pdfjs-dist:

  import * as pdfjsLib from 'pdfjs-dist';

  const { page = 1, scale = 1.0, width, height } = options;

  try {
    // Load PDF document
    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;

    // Get the first page
    const pdfPage = await pdf.getPage(page);

    // Calculate viewport
    let viewport = pdfPage.getViewport({ scale });

    if (width || height) {
      const scaleX = width ? width / viewport.width : 1;
      const scaleY = height ? height / viewport.height : 1;
      const newScale = Math.min(scaleX, scaleY) * scale;
      viewport = pdfPage.getViewport({ scale: newScale });
    }

    // Create canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Failed to get canvas context');
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Render PDF page to canvas
    await pdfPage.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;

    // Convert canvas to data URL
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch (error) {
    console.error('Error generating client-side PDF thumbnail:', error);
    return null;
  }
  */
};

/**
 * Get size dimensions for thumbnail presets
 */
export const getThumbnailSizeDimensions = (
  size: "small" | "medium" | "large"
): { width: number; height: number } => {
  switch (size) {
    case "small":
      return { width: 150, height: 150 };
    case "medium":
      return { width: 300, height: 300 };
    case "large":
      return { width: 600, height: 600 };
    default:
      return { width: 300, height: 300 };
  }
};

/**
 * Validate PDF file before processing
 */
export interface PDFValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const validatePDFFile = (
  file: AnkaaFile,
  options: {
    maxFileSize?: number; // in bytes
    requireThumbnail?: boolean;
  } = {}
): PDFValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { maxFileSize = 100 * 1024 * 1024, requireThumbnail = false } = options;

  // Check if it's a PDF
  if (!isPDFFile(file)) {
    errors.push("File is not a PDF");
  }

  // Check file size
  if (file.size > maxFileSize) {
    warnings.push(
      `File size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds recommended maximum (${(maxFileSize / (1024 * 1024)).toFixed(0)}MB)`
    );
  }

  // Check for thumbnail
  if (requireThumbnail && !file.thumbnailUrl) {
    warnings.push("PDF does not have a pre-generated thumbnail");
  }

  // Check for empty file
  if (file.size === 0) {
    errors.push("PDF file is empty");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Format PDF file info for display
 */
export interface PDFFileInfo {
  filename: string;
  size: string;
  pages?: number;
  isPDF: boolean;
  hasThumbnail: boolean;
  thumbnailUrl?: string;
}

export const getPDFFileInfo = (file: AnkaaFile): PDFFileInfo => {
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return {
    filename: file.filename,
    size: formatSize(file.size),
    isPDF: isPDFFile(file),
    hasThumbnail: !!file.thumbnailUrl,
    thumbnailUrl: file.thumbnailUrl || undefined,
  };
};
