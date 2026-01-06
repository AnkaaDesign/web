import React from "react";
import { FileTypeIcon, FileTypeAvatar, FileTypeBadge, FileTypeInfo } from "./file-type-icon";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { getCategoryGroups, getCategoryLabel } from "../../utils";

/**
 * Demo Component for File Type Icon System
 *
 * This component showcases all file type icons and their variations.
 * Use it for testing and demonstrating the icon system capabilities.
 */

const testFiles = [
  // Documents
  { name: "document.pdf", mime: "application/pdf", size: 2500000 },
  { name: "report.docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 1500000 },
  { name: "spreadsheet.xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 800000 },
  { name: "presentation.pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", size: 5000000 },
  { name: "readme.txt", mime: "text/plain", size: 15000 },

  // Images
  { name: "photo.jpg", mime: "image/jpeg", size: 3200000 },
  { name: "logo.png", mime: "image/png", size: 125000 },
  { name: "vector.svg", mime: "image/svg+xml", size: 45000 },
  { name: "design.eps", mime: "application/postscript", size: 2100000 },
  { name: "favicon.ico", mime: "image/x-icon", size: 8000 },
  { name: "raw-photo.cr2", mime: "image/x-canon-cr2", size: 25000000 },

  // Video
  { name: "video.mp4", mime: "video/mp4", size: 45000000 },
  { name: "movie.mkv", mime: "video/x-matroska", size: 125000000 },
  { name: "web-video.webm", mime: "video/webm", size: 15000000 },

  // Audio
  { name: "music.mp3", mime: "audio/mpeg", size: 4500000 },
  { name: "podcast.m4a", mime: "audio/mp4", size: 35000000 },
  { name: "audio.wav", mime: "audio/wav", size: 52000000 },

  // Code
  { name: "script.js", mime: "text/javascript", size: 25000 },
  { name: "component.tsx", mime: "text/typescript", size: 18000 },
  { name: "index.html", mime: "text/html", size: 12000 },
  { name: "styles.css", mime: "text/css", size: 8500 },
  { name: "api.py", mime: "text/x-python", size: 15000 },
  { name: "Main.java", mime: "text/x-java-source", size: 22000 },
  { name: "config.json", mime: "application/json", size: 3500 },
  { name: "data.xml", mime: "application/xml", size: 45000 },

  // Archives
  { name: "archive.zip", mime: "application/zip", size: 125000000 },
  { name: "backup.rar", mime: "application/x-rar-compressed", size: 85000000 },
  { name: "compressed.7z", mime: "application/x-7z-compressed", size: 95000000 },

  // CAD & 3D
  { name: "drawing.dwg", mime: "application/acad", size: 5500000 },
  { name: "model.obj", mime: "application/x-tgif", size: 12000000 },

  // Special
  { name: "font.ttf", mime: "font/ttf", size: 250000 },
  { name: "database.sqlite", mime: "application/x-sqlite3", size: 15000000 },
  { name: "installer.exe", mime: "application/x-msdownload", size: 85000000 },

  // Unknown
  { name: "unknown.xyz", mime: "application/octet-stream", size: 50000 },
];

export const FileTypeIconDemo: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [selectedSize, setSelectedSize] = React.useState<"xs" | "sm" | "md" | "lg" | "xl">("md");
  const [showProcessing, setShowProcessing] = React.useState(false);
  const [showError, setShowError] = React.useState(false);

  const categoryGroups = getCategoryGroups();

  return (
    <div className="space-y-6 p-4">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">File Type Icon System</h1>
        <p className="text-muted-foreground">Comprehensive file type icons with color coding and processing states</p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Demo Controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category Filter</label>
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="px-3 py-1 border rounded-md text-sm">
                <option value="all">All Categories</option>
                <option value="documents">Documents</option>
                <option value="images">Images</option>
                <option value="media">Media</option>
                <option value="code">Code</option>
                <option value="archives">Archives</option>
                <option value="specialized">Specialized</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Icon Size</label>
              <select value={selectedSize} onChange={(e) => setSelectedSize(e.target.value as any)} className="px-3 py-1 border rounded-md text-sm">
                <option value="xs">Extra Small</option>
                <option value="sm">Small</option>
                <option value="md">Medium</option>
                <option value="lg">Large</option>
                <option value="xl">Extra Large</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">States</label>
              <div className="flex gap-2">
                <Button variant={showProcessing ? "default" : "outline"} size="sm" onClick={() => setShowProcessing(!showProcessing)}>
                  Processing
                </Button>
                <Button variant={showError ? "destructive" : "outline"} size="sm" onClick={() => setShowError(!showError)}>
                  Error
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Component Variations */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* FileTypeIcon */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">FileTypeIcon</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {testFiles.slice(0, 5).map((file, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <FileTypeIcon filename={file.name} mimeType={file.mime} size={selectedSize} isProcessing={showProcessing} isError={showError} />
                <span className="text-sm truncate">{file.name}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* FileTypeAvatar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">FileTypeAvatar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {testFiles.slice(0, 3).map((file, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2">
                <FileTypeAvatar filename={file.name} mimeType={file.mime} isProcessing={showProcessing} isError={showError} />
                <span className="text-xs text-center truncate w-full">{file.name}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* FileTypeBadge */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">FileTypeBadge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {testFiles.slice(0, 8).map((file, idx) => (
              <FileTypeBadge key={idx} filename={file.name} mimeType={file.mime} size="sm" isProcessing={showProcessing} isError={showError} />
            ))}
          </CardContent>
        </Card>

        {/* FileTypeInfo */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">FileTypeInfo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {testFiles.slice(0, 4).map((file, idx) => (
              <FileTypeInfo key={idx} filename={file.name} mimeType={file.mime} fileSize={file.size} isProcessing={showProcessing} isError={showError} />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Full Icon Grid */}
      <Card>
        <CardHeader>
          <CardTitle>All File Types ({testFiles.length} examples)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {testFiles.map((file, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <FileTypeIcon filename={file.name} mimeType={file.mime} size="lg" showLabel isProcessing={showProcessing} isError={showError} />
                <span className="text-xs text-center truncate w-full" title={file.name}>
                  {file.name}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Color Legend */}
      <Card>
        <CardHeader>
          <CardTitle>Color Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(categoryGroups).map(([groupName, categories]) => (
              <div key={groupName} className="space-y-2">
                <h4 className="text-sm font-medium capitalize">{groupName}</h4>
                <div className="space-y-1">
                  {categories.slice(0, 3).map((category) => (
                    <div key={category} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-xs">{getCategoryLabel(category)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FileTypeIconDemo;
