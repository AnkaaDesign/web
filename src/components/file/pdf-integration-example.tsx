/**
 * Complete Integration Example: PDF Viewing
 *
 * This file demonstrates a real-world implementation of PDF viewing
 * integrated with file management, upload, and display components.
 */

import * as React from "react";
import { FileViewerProvider, useFileViewer } from "./file-viewer";
import { FileItem } from "./file-item";
import { FileThumbnail } from "./file-thumbnail";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { File as AnkaaFile } from "../../types";
import { isPDFFile, getPDFThumbnailUrl, validatePDFFile } from "../../utils/pdf-thumbnail";
import { formatFileSize } from "../../utils/file";
import { IconFileTypePdf, IconDownload, IconEye, IconAlertCircle } from "@tabler/icons-react";

/**
 * Complete PDF File Management Example
 */
export const PDFIntegrationExample: React.FC = () => {
  return (
    <FileViewerProvider
      config={{
        pdfViewMode: "new-tab",
        pdfMaxFileSize: 50 * 1024 * 1024,
        enableSecurity: true,
      }}
      baseUrl="http://localhost:3030"
      onDownload={(file, url) => {
        console.log("Downloading:", file.filename, "from", url);
        toast.success(`Downloading ${file.filename}`);
      }}
      onSecurityWarning={(warnings, file) => {
        console.warn("Security warnings for", file.filename, warnings);
        toast.warning(`Security warnings for ${file.filename}`, {
          description: warnings.join(", "),
        });
      }}
    >
      <div className="container mx-auto py-8 space-y-8">
        <Header />
        <FileGallery />
      </div>
    </FileViewerProvider>
  );
};

/**
 * Header Section
 */
const Header: React.FC = () => {
  return (
    <div className="space-y-2">
      <h1 className="text-3xl font-bold">PDF File Manager</h1>
      <p className="text-muted-foreground">
        Complete example of PDF viewing integrated with file management
      </p>
    </div>
  );
};

/**
 * File Gallery with PDF Support
 */
const FileGallery: React.FC = () => {
  const { state } = useFileViewer();

  // Sample files including PDFs
  const sampleFiles: AnkaaFile[] = [
    {
      id: "pdf-1",
      filename: "Project Proposal.pdf",
      originalName: "project-proposal.pdf",
      mimetype: "application/pdf",
      path: "/uploads/project-proposal.pdf",
      size: 2.5 * 1024 * 1024, // 2.5MB
      thumbnailUrl: "/api/thumbnails/pdf-1.jpg",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "pdf-2",
      filename: "Annual Report 2024.pdf",
      originalName: "annual-report-2024.pdf",
      mimetype: "application/pdf",
      path: "/uploads/annual-report.pdf",
      size: 15 * 1024 * 1024, // 15MB
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      updatedAt: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: "pdf-3",
      filename: "Technical Documentation.pdf",
      originalName: "technical-docs.pdf",
      mimetype: "application/pdf",
      path: "/uploads/technical-docs.pdf",
      size: 120 * 1024 * 1024, // 120MB - Large file
      createdAt: new Date(Date.now() - 259200000).toISOString(),
      updatedAt: new Date(Date.now() - 259200000).toISOString(),
    },
    {
      id: "img-1",
      filename: "Company Logo.png",
      originalName: "logo.png",
      mimetype: "image/png",
      path: "/uploads/logo.png",
      size: 500 * 1024, // 500KB
      createdAt: new Date(Date.now() - 345600000).toISOString(),
      updatedAt: new Date(Date.now() - 345600000).toISOString(),
    },
  ];

  const pdfFiles = sampleFiles.filter(isPDFFile);
  const allFiles = sampleFiles;

  return (
    <Tabs defaultValue="all" className="space-y-4">
      <TabsList>
        <TabsTrigger value="all">
          All Files ({allFiles.length})
        </TabsTrigger>
        <TabsTrigger value="pdfs">
          PDFs Only ({pdfFiles.length})
        </TabsTrigger>
        <TabsTrigger value="grid">Grid View</TabsTrigger>
        <TabsTrigger value="list">List View</TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="space-y-4">
        <FileGridView files={allFiles} />
      </TabsContent>

      <TabsContent value="pdfs" className="space-y-4">
        <PDFOnlyView files={pdfFiles} />
      </TabsContent>

      <TabsContent value="grid" className="space-y-4">
        <FileGridView files={allFiles} viewMode="grid" />
      </TabsContent>

      <TabsContent value="list" className="space-y-4">
        <FileListView files={allFiles} />
      </TabsContent>
    </Tabs>
  );
};

/**
 * Grid View for Files
 */
const FileGridView: React.FC<{
  files: AnkaaFile[];
  viewMode?: "grid" | "list";
}> = ({ files, viewMode = "grid" }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {files.map((file) => (
        <FileItem
          key={file.id}
          file={file}
          viewMode={viewMode}
          showActions={true}
        />
      ))}
    </div>
  );
};

/**
 * List View for Files
 */
const FileListView: React.FC<{ files: AnkaaFile[] }> = ({ files }) => {
  return (
    <div className="space-y-2">
      {files.map((file) => (
        <FileItem
          key={file.id}
          file={file}
          viewMode="list"
          showActions={true}
        />
      ))}
    </div>
  );
};

/**
 * PDF-Only View with Enhanced Details
 */
const PDFOnlyView: React.FC<{ files: AnkaaFile[] }> = ({ files }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {files.map((file) => (
        <PDFCard key={file.id} file={file} />
      ))}
    </div>
  );
};

/**
 * Enhanced PDF Card with Validation
 */
const PDFCard: React.FC<{ file: AnkaaFile }> = ({ file }) => {
  const { actions } = useFileViewer();
  const validation = validatePDFFile(file);
  const thumbnailUrl = getPDFThumbnailUrl(file, { size: "medium" });

  const handleView = () => {
    actions.viewFile(file);
  };

  const handleDownload = () => {
    actions.downloadFile(file);
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <IconFileTypePdf className="h-5 w-5 text-red-500 shrink-0" />
            <CardTitle className="text-sm truncate">{file.filename}</CardTitle>
          </div>
          <Badge variant="secondary" className="shrink-0">
            PDF
          </Badge>
        </div>
        <CardDescription className="text-xs">
          {formatFileSize(file.size)}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Thumbnail Preview */}
        <div className="relative aspect-[4/3] bg-white rounded-lg border-2 border-red-100 overflow-hidden">
          <FileThumbnail
            file={file}
            size="md"
            onClick={handleView}
            showActions={false}
            className="w-full h-full"
          />
        </div>

        {/* Validation Warnings */}
        {validation.warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2">
            <div className="flex gap-2 items-start">
              <IconAlertCircle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                {validation.warnings.map((warning, idx) => (
                  <p key={idx} className="text-xs text-yellow-800">
                    {warning}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleView}
            className="flex-1"
          >
            <IconEye className="h-4 w-4 mr-2" />
            View
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownload}
          >
            <IconDownload className="h-4 w-4" />
          </Button>
        </div>

        {/* File Info */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <div className="flex justify-between">
            <span>Created:</span>
            <span>{new Date(file.createdAt).toLocaleDateString()}</span>
          </div>
          {file.size > 50 * 1024 * 1024 && (
            <div className="text-yellow-600 flex items-center gap-1">
              <IconAlertCircle className="h-3 w-3" />
              <span>Large file</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Usage Stats Component
 */
export const PDFStats: React.FC<{ files: AnkaaFile[] }> = ({ files }) => {
  const pdfFiles = files.filter(isPDFFile);
  const totalSize = pdfFiles.reduce((sum, file) => sum + file.size, 0);
  const largeFiles = pdfFiles.filter((f) => f.size > 50 * 1024 * 1024);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Total PDFs</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{pdfFiles.length}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Total Size</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{formatFileSize(totalSize)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Large Files (&gt;50MB)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{largeFiles.length}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PDFIntegrationExample;
