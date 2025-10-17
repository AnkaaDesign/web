import * as React from "react";
import { PDFViewer } from "./pdf-viewer";
import { FileViewerProvider, useFileViewer } from "./file-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { File as AnkaaFile } from "../../types";

/**
 * Demo component showing different ways to use the PDF viewer
 */
export const PDFViewerDemo: React.FC = () => {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [newTabOpen, setNewTabOpen] = React.useState(false);

  // Sample PDF file
  const samplePDFFile: AnkaaFile = {
    id: "sample-pdf-id",
    filename: "sample-document.pdf",
    originalName: "sample-document.pdf",
    mimetype: "application/pdf",
    path: "/uploads/sample-document.pdf",
    size: 2.5 * 1024 * 1024, // 2.5MB
    thumbnailUrl: "/api/files/thumbnail/sample-pdf-id?size=medium",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const samplePDFUrl = "https://example.com/api/files/serve/sample-pdf-id";

  const handleDownload = (file: AnkaaFile) => {
    console.log("Downloading:", file.filename);
    // Implement actual download logic
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">PDF Viewer Demo</h1>
        <p className="text-muted-foreground">
          Demonstration of different PDF viewing modes and features
        </p>
      </div>

      {/* Mode 1: New Tab (Recommended) */}
      <Card>
        <CardHeader>
          <CardTitle>New Tab Mode (Recommended)</CardTitle>
          <CardDescription>
            Opens PDF in a new browser tab using native browser PDF support.
            Best for user experience and performance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => setNewTabOpen(true)}>Open PDF in New Tab</Button>
          <PDFViewer
            file={samplePDFFile}
            url={samplePDFUrl}
            open={newTabOpen}
            onOpenChange={setNewTabOpen}
            mode="new-tab"
            onDownload={handleDownload}
          />
        </CardContent>
      </Card>

      {/* Mode 2: Modal with Inline Viewer */}
      <Card>
        <CardHeader>
          <CardTitle>Modal Mode</CardTitle>
          <CardDescription>
            Opens PDF in a modal dialog with inline viewer. Good for quick previews
            without leaving the page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={() => setModalOpen(true)}>Open PDF in Modal</Button>
          <PDFViewer
            file={samplePDFFile}
            url={samplePDFUrl}
            open={modalOpen}
            onOpenChange={setModalOpen}
            mode="modal"
            onDownload={handleDownload}
            showToolbar={true}
          />
        </CardContent>
      </Card>

      {/* Mode 3: With FileViewer Context */}
      <Card>
        <CardHeader>
          <CardTitle>Using FileViewer Context</CardTitle>
          <CardDescription>
            Integrated with FileViewerProvider for unified file handling across your app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileViewerProvider
            config={{
              pdfViewMode: "new-tab",
              pdfMaxFileSize: 50 * 1024 * 1024,
              enableSecurity: true,
            }}
          >
            <PDFViewerContextDemo file={samplePDFFile} />
          </FileViewerProvider>
        </CardContent>
      </Card>

      {/* Features Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
          <CardDescription>What's included in the PDF viewer</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 list-disc list-inside text-sm">
            <li>Native browser PDF support for best compatibility</li>
            <li>Automatic fallback for unsupported browsers</li>
            <li>Thumbnail generation for first page preview</li>
            <li>PDF-specific icons and styling</li>
            <li>Download option always available</li>
            <li>Graceful handling of large PDF files (automatic new-tab for files &gt; 100MB)</li>
            <li>Security warnings for oversized files</li>
            <li>Zoom controls in modal mode</li>
            <li>Loading states and error handling</li>
            <li>Configurable view modes (new-tab, modal, inline)</li>
          </ul>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Options</CardTitle>
          <CardDescription>Available configuration for PDF viewing</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`// FileViewerConfig
{
  pdfViewMode: "new-tab" | "modal" | "inline",
  pdfMaxFileSize: 50 * 1024 * 1024, // 50MB
  enableSecurity: true,
  baseUrl: "http://localhost:3030"
}

// PDFViewer props
{
  file: AnkaaFile,
  url: string,
  open: boolean,
  onOpenChange: (open: boolean) => void,
  mode?: "modal" | "new-tab" | "inline",
  onDownload?: (file: AnkaaFile) => void,
  maxFileSize?: number,
  showToolbar?: boolean,
  className?: string
}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Demo component using FileViewer context
 */
const PDFViewerContextDemo: React.FC<{ file: AnkaaFile }> = ({ file }) => {
  const { actions } = useFileViewer();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        The FileViewer context automatically handles PDF viewing based on configuration.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => actions.viewFile(file)}>View PDF</Button>
        <Button variant="outline" onClick={() => actions.downloadFile(file)}>
          Download PDF
        </Button>
      </div>
    </div>
  );
};

export default PDFViewerDemo;
