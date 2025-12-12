/**
 * FileViewerCard Demo Component
 *
 * Demonstrates the usage of FileViewerCard component with various file types
 * and configuration options.
 *
 * @module FileViewerCardDemo
 */

import React from "react";
import { FileViewerCard } from "./file-viewer-card";
import { FileViewerProvider } from "./file-viewer";
import type { File as AnkaaFile } from "../../../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// =====================
// Mock Data
// =====================

const mockFiles: AnkaaFile[] = [
  // Images
  {
    id: "1",
    filename: "product-photo.jpg",
    originalName: "product-photo.jpg",
    mimetype: "image/jpeg",
    path: "/uploads/images/product-photo.jpg",
    size: 2457600, // 2.4 MB
    thumbnailUrl: "/thumbnails/product-photo.jpg",
    createdAt: new Date("2024-01-15"),
    updatedAt: new Date("2024-01-15"),
  },
  {
    id: "2",
    filename: "logo.png",
    originalName: "company-logo.png",
    mimetype: "image/png",
    path: "/uploads/images/logo.png",
    size: 156800, // 153 KB
    thumbnailUrl: null,
    createdAt: new Date("2024-01-10"),
    updatedAt: new Date("2024-01-10"),
  },
  {
    id: "3",
    filename: "banner.webp",
    originalName: "website-banner.webp",
    mimetype: "image/webp",
    path: "/uploads/images/banner.webp",
    size: 524288, // 512 KB
    thumbnailUrl: null,
    createdAt: new Date("2024-02-01"),
    updatedAt: new Date("2024-02-01"),
  },

  // Videos
  {
    id: "4",
    filename: "tutorial.mp4",
    originalName: "product-tutorial.mp4",
    mimetype: "video/mp4",
    path: "/uploads/videos/tutorial.mp4",
    size: 15728640, // 15 MB
    thumbnailUrl: "/thumbnails/tutorial-thumb.jpg",
    createdAt: new Date("2024-01-20"),
    updatedAt: new Date("2024-01-20"),
  },
  {
    id: "5",
    filename: "demo.webm",
    originalName: "feature-demo.webm",
    mimetype: "video/webm",
    path: "/uploads/videos/demo.webm",
    size: 8388608, // 8 MB
    thumbnailUrl: null,
    createdAt: new Date("2024-02-05"),
    updatedAt: new Date("2024-02-05"),
  },

  // PDFs
  {
    id: "6",
    filename: "manual.pdf",
    originalName: "user-manual.pdf",
    mimetype: "application/pdf",
    path: "/uploads/documents/manual.pdf",
    size: 3145728, // 3 MB
    thumbnailUrl: "/thumbnails/manual-page1.jpg",
    createdAt: new Date("2024-01-12"),
    updatedAt: new Date("2024-01-12"),
  },
  {
    id: "7",
    filename: "contract.pdf",
    originalName: "service-contract.pdf",
    mimetype: "application/pdf",
    path: "/uploads/documents/contract.pdf",
    size: 1048576, // 1 MB
    thumbnailUrl: null,
    createdAt: new Date("2024-02-10"),
    updatedAt: new Date("2024-02-10"),
  },

  // Documents
  {
    id: "8",
    filename: "report.docx",
    originalName: "monthly-report.docx",
    mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    path: "/uploads/documents/report.docx",
    size: 2097152, // 2 MB
    thumbnailUrl: "/thumbnails/report-thumb.jpg",
    createdAt: new Date("2024-01-25"),
    updatedAt: new Date("2024-01-25"),
  },
  {
    id: "9",
    filename: "budget.xlsx",
    originalName: "annual-budget.xlsx",
    mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    path: "/uploads/documents/budget.xlsx",
    size: 1572864, // 1.5 MB
    thumbnailUrl: null,
    createdAt: new Date("2024-02-01"),
    updatedAt: new Date("2024-02-01"),
  },
  {
    id: "10",
    filename: "presentation.pptx",
    originalName: "sales-presentation.pptx",
    mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    path: "/uploads/documents/presentation.pptx",
    size: 5242880, // 5 MB
    thumbnailUrl: "/thumbnails/presentation-thumb.jpg",
    createdAt: new Date("2024-01-18"),
    updatedAt: new Date("2024-01-18"),
  },

  // Other file types
  {
    id: "11",
    filename: "data.zip",
    originalName: "backup-data.zip",
    mimetype: "application/zip",
    path: "/uploads/archives/data.zip",
    size: 10485760, // 10 MB
    thumbnailUrl: null,
    createdAt: new Date("2024-02-08"),
    updatedAt: new Date("2024-02-08"),
  },
  {
    id: "12",
    filename: "design.eps",
    originalName: "logo-design.eps",
    mimetype: "application/postscript",
    path: "/uploads/vectors/design.eps",
    size: 4194304, // 4 MB
    thumbnailUrl: "/thumbnails/design-thumb.jpg",
    createdAt: new Date("2024-01-22"),
    updatedAt: new Date("2024-01-22"),
  },
];

// =====================
// Demo Component
// =====================

export const FileViewerCardDemo: React.FC = () => {
  const [selectedSize, setSelectedSize] = React.useState<"sm" | "md" | "lg">("md");
  const [showName, setShowName] = React.useState(true);
  const [showSize, setShowSize] = React.useState(true);
  const [showType, setShowType] = React.useState(false);
  const [enableHover, setEnableHover] = React.useState(true);

  const handleCustomClick = (file: AnkaaFile) => {
    toast.info(`Arquivo clicado: ${file.filename}`, {
      description: `ID: ${file.id} | Tipo: ${file.mimetype}`,
    });
  };

  const handleCustomDownload = (file: AnkaaFile) => {
    toast.success(`Download iniciado: ${file.filename}`, {
      description: `Tamanho: ${(file.size / 1024 / 1024).toFixed(2)} MB`,
    });
  };

  return (
    <FileViewerProvider>
      <div className="container mx-auto py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">FileViewerCard Demo</h1>
          <p className="text-muted-foreground">
            Demonstração do componente FileViewerCard com diferentes tipos de arquivos
          </p>
        </div>

        {/* Configuration Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Size Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">Tamanho</label>
                <div className="flex gap-2">
                  <Button
                    variant={selectedSize === "sm" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSize("sm")}
                  >
                    Pequeno
                  </Button>
                  <Button
                    variant={selectedSize === "md" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSize("md")}
                  >
                    Médio
                  </Button>
                  <Button
                    variant={selectedSize === "lg" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSize("lg")}
                  >
                    Grande
                  </Button>
                </div>
              </div>

              {/* Toggle Options */}
              <div>
                <label className="text-sm font-medium mb-2 block">Opções de Exibição</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showName}
                      onChange={(e) => setShowName(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Mostrar nome</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSize}
                      onChange={(e) => setShowSize(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Mostrar tamanho</span>
                  </label>
                </div>
              </div>

              {/* Additional Options */}
              <div>
                <label className="text-sm font-medium mb-2 block">Recursos</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showType}
                      onChange={(e) => setShowType(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Mostrar badge de tipo</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableHover}
                      onChange={(e) => setEnableHover(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Ativar efeitos hover</span>
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* File Grid - Images */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Imagens</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {mockFiles
              .filter((f) => f.mimetype.startsWith("image/"))
              .map((file) => (
                <FileViewerCard
                  key={file.id}
                  file={file}
                  size={selectedSize}
                  showName={showName}
                  showSize={showSize}
                  showType={showType}
                  enableHover={enableHover}
                />
              ))}
          </div>
        </section>

        {/* File Grid - Videos */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Vídeos</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {mockFiles
              .filter((f) => f.mimetype.startsWith("video/"))
              .map((file) => (
                <FileViewerCard
                  key={file.id}
                  file={file}
                  size={selectedSize}
                  showName={showName}
                  showSize={showSize}
                  showType={showType}
                  enableHover={enableHover}
                />
              ))}
          </div>
        </section>

        {/* File Grid - PDFs */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">PDFs</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {mockFiles
              .filter((f) => f.mimetype === "application/pdf")
              .map((file) => (
                <FileViewerCard
                  key={file.id}
                  file={file}
                  size={selectedSize}
                  showName={showName}
                  showSize={showSize}
                  showType={showType}
                  enableHover={enableHover}
                />
              ))}
          </div>
        </section>

        {/* File Grid - Documents */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Documentos</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {mockFiles
              .filter(
                (f) =>
                  f.mimetype.includes("word") ||
                  f.mimetype.includes("excel") ||
                  f.mimetype.includes("powerpoint") ||
                  f.mimetype.includes("sheet") ||
                  f.mimetype.includes("presentation")
              )
              .map((file) => (
                <FileViewerCard
                  key={file.id}
                  file={file}
                  size={selectedSize}
                  showName={showName}
                  showSize={showSize}
                  showType={showType}
                  enableHover={enableHover}
                />
              ))}
          </div>
        </section>

        {/* File Grid - Other */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Outros</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {mockFiles
              .filter(
                (f) =>
                  !f.mimetype.startsWith("image/") &&
                  !f.mimetype.startsWith("video/") &&
                  f.mimetype !== "application/pdf" &&
                  !f.mimetype.includes("word") &&
                  !f.mimetype.includes("excel") &&
                  !f.mimetype.includes("powerpoint")
              )
              .map((file) => (
                <FileViewerCard
                  key={file.id}
                  file={file}
                  size={selectedSize}
                  showName={showName}
                  showSize={showSize}
                  showType={showType}
                  enableHover={enableHover}
                />
              ))}
          </div>
        </section>

        {/* Custom Handlers Example */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Com Handlers Customizados</h2>
          <p className="text-muted-foreground mb-4">
            Estes cards usam handlers personalizados para click e download
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {mockFiles.slice(0, 4).map((file) => (
              <FileViewerCard
                key={`custom-${file.id}`}
                file={file}
                size={selectedSize}
                showName={showName}
                showSize={showSize}
                showType={showType}
                enableHover={enableHover}
                onClick={handleCustomClick}
                onDownload={handleCustomDownload}
              />
            ))}
          </div>
        </section>

        {/* Disabled State Example */}
        <section>
          <h2 className="text-2xl font-semibold mb-4">Estado Desabilitado</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {mockFiles.slice(0, 3).map((file) => (
              <FileViewerCard
                key={`disabled-${file.id}`}
                file={file}
                size={selectedSize}
                showName={showName}
                showSize={showSize}
                showType={showType}
                enableHover={enableHover}
                disabled={true}
              />
            ))}
          </div>
        </section>
      </div>
    </FileViewerProvider>
  );
};

export default FileViewerCardDemo;
