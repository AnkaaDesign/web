import { useAuth } from "@/contexts/auth-context";
import { SECTOR_PRIVILEGES, routes } from "../../constants";
import { hasAnyPrivilege } from "../../utils";
import {
  IconFolderShare,
  IconRefresh,
  IconFolder,
  IconCalendar,
  IconDeviceDesktop,
  IconPalette,
  IconFileText,
  IconCamera,
  IconTrash,
  IconBrandApple,
  IconFileInvoice,
  IconNotes,
  IconCalculator,
  IconPrinter,
  IconBriefcase,
  IconFileDescription,
  IconPhoto,
  IconArchive,
  IconFolders,
  IconFiles,
  IconChevronRight,
  IconList,
  IconLayoutGrid,
  IconSearch,
  IconUsers,
  IconBuildingStore,
  IconTruck,
  IconDroplet,
  IconMessage,
  IconLayout,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { PageHeader } from "@/components/ui/page-header";
import { useFileManagerFolders, useFileManagerFolderContents } from "../../hooks";
import { useToast } from "@/hooks/common/use-toast";
import { apiClient } from "@/api-client";
import { FileViewerProvider, useFileViewer } from "@/components/common/file/file-viewer";
import { FileItem, type FileViewMode } from "@/components/common/file";
import type { File as AnkaaFile } from "@/types";

// Utility function to parse remote storage size string to bytes
function parseRemoteSize(sizeStr: string): number {
  if (!sizeStr || sizeStr === "-" || sizeStr === "0") return 0;

  const match = sizeStr.match(/^(\d+\.?\d*)\s*([KMGT]?)B?$/i);
  if (!match) return 0;

  const [, numStr, unit] = match;
  const num = parseFloat(numStr);

  const multipliers: Record<string, number> = {
    "": 1,
    "K": 1024,
    "M": 1024 * 1024,
    "G": 1024 * 1024 * 1024,
    "T": 1024 * 1024 * 1024 * 1024,
  };

  return Math.floor(num * (multipliers[unit.toUpperCase()] || 1));
}

// Utility function to convert remote storage items to AnkaaFile format for viewer
function convertRemoteItemToAnkaaFile(
  item: {
    name: string;
    type: "file" | "directory";
    size: string;
    lastModified: Date;
    remoteUrl?: string;
    // Database file fields (when matched)
    dbFileId?: string;
    dbFilePath?: string;
    dbThumbnailUrl?: string | null;
    dbMimeType?: string;
    dbFileSize?: number;
  },
  folderPath: string
): AnkaaFile {
  const extension = item.name.split(".").pop()?.toLowerCase() || "";
  let mimetype = "application/octet-stream";

  if (["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(extension)) {
    mimetype = `image/${extension === "jpg" ? "jpeg" : extension}`;
  } else if (["mp4", "webm", "ogg", "mov", "avi"].includes(extension)) {
    mimetype = `video/${extension}`;
  } else if (extension === "pdf") {
    mimetype = "application/pdf";
  } else if (["doc", "docx"].includes(extension)) {
    mimetype = "application/msword";
  } else if (["xls", "xlsx"].includes(extension)) {
    mimetype = "application/vnd.ms-excel";
  }

  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(extension);
  const isPdf = extension === "pdf";

  // Use database file info when available (enables proper thumbnails and inline viewing)
  if (item.dbFileId) {
    return {
      id: item.dbFileId,
      filename: item.name,
      originalName: item.name,
      mimetype: item.dbMimeType || mimetype,
      path: item.dbFilePath || item.remoteUrl || "",
      size: item.dbFileSize || parseRemoteSize(item.size),
      thumbnailUrl: item.dbThumbnailUrl || (isImage && item.remoteUrl ? item.remoteUrl : null),
      createdAt: item.lastModified,
      updatedAt: item.lastModified,
    };
  }

  // Fallback for files without database records
  return {
    id: `remote-${folderPath}-${item.name}`,
    filename: item.name,
    originalName: item.name,
    mimetype,
    path: item.remoteUrl || "",
    size: parseRemoteSize(item.size),
    // Only set thumbnailUrl for images - PDFs from remote storage can't use backend thumbnail generator
    thumbnailUrl: isImage && item.remoteUrl ? item.remoteUrl : null,
    createdAt: item.lastModified,
    updatedAt: item.lastModified,
  };
}

// Component for file browsing with file viewer integration
function FileContentsBrowser({
  folderContents,
  isLoading,
  currentSubPath,
  selectedFolder,
  fileDisplayMode,
  searchQuery,
  handleNavigateToSubfolder,
}: {
  folderContents: any;
  isLoading: boolean;
  currentSubPath?: string;
  selectedFolder: string;
  fileDisplayMode: FileViewMode;
  searchQuery: string;
  handleNavigateToSubfolder: (path: string) => void;
}) {
  const fileViewer = useFileViewer();

  const handleFileClick = (file: AnkaaFile, _index: number) => {
    const remoteUrl = file.path;
    const extension = file.filename.split(".").pop()?.toLowerCase() || "";
    const isImage = ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(extension);
    const isPdf = extension === "pdf";
    const isVideo = ["mp4", "webm", "ogg", "mov", "avi"].includes(extension);

    if (isImage) {
      // For images, collect all image files in the current folder for navigation
      const allImageFiles = folderContents?.data?.files
        ?.filter((item: any) => {
          const ext = item.name.split(".").pop()?.toLowerCase() || "";
          return item.type !== "directory" && ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext);
        })
        .map((item: any) => convertRemoteItemToAnkaaFile(item, `${selectedFolder}/${currentSubPath || ""}`)) || [];

      const imageIndex = allImageFiles.findIndex((f: AnkaaFile) => f.id === file.id);
      if (imageIndex !== -1) {
        fileViewer?.actions.viewFiles(allImageFiles, imageIndex);
      }
    } else if (isPdf || isVideo) {
      // Use the file viewer to open PDFs and videos in the inline modal
      fileViewer?.actions.viewFile(file);
    } else {
      // For other file types, download them
      const link = document.createElement("a");
      link.href = remoteUrl;
      link.download = file.filename;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDirectoryClick = (item: any) => {
    const newPath = currentSubPath ? `${currentSubPath}/${item.name}` : item.name;
    handleNavigateToSubfolder(newPath);
  };

  const handleDownload = (file: AnkaaFile) => {
    const link = document.createElement("a");
    link.href = file.path;
    link.download = file.filename;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className={fileDisplayMode === "grid" ? "grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3" : "grid grid-cols-1 gap-2"}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            {fileDisplayMode === "grid" ? (
              <div className="h-[180px] bg-muted rounded-lg"></div>
            ) : (
              <div className="flex items-center gap-3 p-3 border border-border rounded">
                <div className="h-12 w-12 bg-muted rounded"></div>
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-muted rounded w-48"></div>
                  <div className="h-3 bg-muted rounded w-24"></div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (!folderContents?.data?.files || folderContents.data.files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <IconFiles className="h-16 w-16 mb-4 opacity-20" />
        <p className="text-lg font-medium">Pasta vazia</p>
        <p className="text-sm">Nenhum arquivo encontrado nesta pasta.</p>
      </div>
    );
  }

  const directories = folderContents.data.files.filter((item: any) => item.type === "directory");
  const files = folderContents.data.files.filter((item: any) => item.type !== "directory");

  const filteredDirectories = searchQuery
    ? directories.filter((dir: any) => dir.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : directories;
  const filteredFiles = searchQuery
    ? files.filter((file: any) => file.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : files;

  const ankaaFiles = filteredFiles.map((item: any) => convertRemoteItemToAnkaaFile(item, `${selectedFolder}/${currentSubPath || ""}`));

  if (filteredDirectories.length === 0 && ankaaFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
        <IconSearch className="h-16 w-16 mb-4 opacity-20" />
        <p className="text-lg font-medium">Nenhum resultado</p>
        <p className="text-sm">Nenhum arquivo ou pasta corresponde à sua busca.</p>
      </div>
    );
  }

  return (
    <div className={fileDisplayMode === "grid" ? "grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3" : "grid grid-cols-1 gap-2"}>
      {filteredDirectories.map((dir: any) => (
        <div
          key={dir.name}
          className={
            fileDisplayMode === "grid"
              ? "group relative overflow-hidden transition-all duration-300 rounded-lg hover:shadow-sm cursor-pointer border border-border"
              : "flex items-center gap-3 p-3 border border-border rounded hover:bg-muted/50 transition-colors cursor-pointer"
          }
          onClick={() => handleDirectoryClick(dir)}
        >
          {fileDisplayMode === "grid" ? (
            <>
              <div className="flex items-center justify-center rounded-t-lg bg-muted/30" style={{ height: "8rem" }}>
                <IconFolder className="h-16 w-16 text-blue-600" />
              </div>
              <div className="p-3 border-t border-border">
                <p className="text-sm font-medium truncate" title={dir.name}>
                  {dir.name}
                </p>
                {(dir.fileCount !== undefined || dir.folderCount !== undefined) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {dir.folderCount || 0} pastas, {dir.fileCount || 0} arquivos
                  </p>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex-shrink-0">
                <IconFolder className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{dir.name}</span>
                  <IconChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-xs text-muted-foreground">
                  {dir.fileCount !== undefined || dir.folderCount !== undefined
                    ? `${dir.folderCount || 0} pastas • ${dir.fileCount || 0} arquivos`
                    : "Pasta"}
                </div>
              </div>
            </>
          )}
        </div>
      ))}

      {ankaaFiles.map((file: AnkaaFile, index: number) => (
        <FileItem
          key={file.id}
          file={file}
          viewMode={fileDisplayMode}
          onPreview={() => handleFileClick(file, index)}
          onDownload={() => handleDownload(file)}
          showActions={true}
        />
      ))}
    </div>
  );
}

export function ServerFileManagerPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { success } = useToast();

  const pathSegments = location.pathname
    .replace("/servidor/gerenciador-de-arquivos", "")
    .split("/")
    .filter(Boolean)
    .map(segment => decodeURIComponent(segment));
  const selectedFolder = pathSegments[0] || null;
  const currentSubPath = pathSegments.slice(1).join("/") || undefined;
  const viewMode = selectedFolder ? "browse" : "folders";

  const [fileDisplayMode, setFileDisplayMode] = useState<FileViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");

  const hasAccess = user?.sector?.privileges ? hasAnyPrivilege(user as any, [SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL]) : false;

  usePageTracker({
    title: "Gerenciador de Arquivos",
    icon: "fileManager",
  });

  const { data: folders, isLoading, refetch } = useFileManagerFolders();

  const {
    data: folderContents,
    isLoading: isLoadingContents,
    refetch: refetchContents,
  } = useFileManagerFolderContents(selectedFolder ?? undefined, currentSubPath ?? undefined, { enabled: viewMode === "browse" && !!selectedFolder });

  useEffect(() => {
    setSearchQuery("");
  }, [location.pathname]);

  useEffect(() => {
    if (!hasAccess) {
      navigate(routes.home);
    }
  }, [hasAccess, navigate]);

  const filteredFolders = useMemo(() => {
    if (!folders?.data) return [];
    if (!searchQuery) return folders.data;
    return folders.data.filter(folder =>
      folder.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [folders?.data, searchQuery]);

  const totals = useMemo(() => {
    if (viewMode === "browse" && folderContents?.data) {
      return {
        files: folderContents.data.totalFiles || 0,
        size: folderContents.data.totalSize || "0",
      };
    }
    if (folders?.data) {
      return {
        count: folders.data.length,
      };
    }
    return null;
  }, [viewMode, folderContents?.data, folders?.data]);

  const handleBrowseFolder = (folderName: string) => {
    navigate(`/servidor/gerenciador-de-arquivos/${encodeURIComponent(folderName)}`);
  };

  const handleNavigateToSubfolder = (subPath: string) => {
    const fullPath = `${selectedFolder}/${subPath}`;
    const encodedPath = fullPath.split("/").map(seg => encodeURIComponent(seg)).join("/");
    navigate(`/servidor/gerenciador-de-arquivos/${encodedPath}`);
  };

  const formatFileSize = (size: string) => {
    const match = size.match(/^(\d+\.?\d*)\s*([KMGT]?)B?$/i);
    if (!match) return size;

    const [, sizeNum, unit] = match;
    const unitMap: Record<string, string> = {
      "": "B",
      K: "KB",
      M: "MB",
      G: "GB",
      T: "TB",
    };

    return `${sizeNum} ${unitMap[unit.toUpperCase()] || unit}`;
  };

  const getBreadcrumbs = () => {
    const breadcrumbs: Array<{ label: string; href: string; onClick: (e: React.MouseEvent) => void }> = [
      {
        label: "Início",
        href: routes.home,
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          navigate(routes.home);
        },
      },
      {
        label: "Servidor",
        href: routes.server.root,
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          navigate(routes.server.root);
        },
      },
    ];

    if (viewMode === "folders") {
      breadcrumbs.push({
        label: "Gerenciador de Arquivos",
        href: routes.server.fileManager,
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          refetch();
        },
      });
    } else if (selectedFolder) {
      breadcrumbs.push(
        {
          label: "Gerenciador de Arquivos",
          href: routes.server.fileManager,
          onClick: (e: React.MouseEvent) => {
            e.preventDefault();
            navigate(routes.server.fileManager);
          },
        },
        {
          label: selectedFolder,
          href: `/servidor/gerenciador-de-arquivos/${encodeURIComponent(selectedFolder)}`,
          onClick: (e: React.MouseEvent) => {
            e.preventDefault();
            navigate(`/servidor/gerenciador-de-arquivos/${encodeURIComponent(selectedFolder)}`);
          },
        },
      );

      if (currentSubPath) {
        const pathParts = currentSubPath.split("/");
        let accumulatedPath = selectedFolder;

        pathParts.forEach((part) => {
          accumulatedPath += `/${part}`;
          const encodedPath = accumulatedPath.split("/").map(seg => encodeURIComponent(seg)).join("/");
          const routePath = `/servidor/gerenciador-de-arquivos/${encodedPath}`;

          breadcrumbs.push({
            label: part,
            href: routePath,
            onClick: (e: React.MouseEvent) => {
              e.preventDefault();
              navigate(routePath);
            },
          });
        });
      }
    }

    return breadcrumbs;
  };

  if (!hasAccess) {
    return null;
  }

  // Derive folder type from name when not provided
  const deriveFolderType = (folderName: string, providedType?: string): string => {
    if (providedType && providedType !== "other") return providedType;

    const name = folderName.toLowerCase();

    // Match folder names to types
    if (name.includes("projeto") || name === "projetos") return "projects";
    if (name.includes("orcamento") || name.includes("orçamento")) return "budgets";
    if (name.includes("observa")) return "observations";
    if (name.includes("nota") || name.includes("fiscal") || name.includes("invoice")) return "invoices";
    if (name.includes("logo")) return "logos";
    if (name.includes("plotter") || name.includes("corte")) return "plotter";
    if (name.includes("imagem") || name.includes("imagens") || name.includes("fotos")) return "images";
    if (name.includes("backup")) return "backup";
    if (name.includes("lixeira") || name.includes("trash") || name.includes("excluido")) return "trash";
    if (name.includes("recibo") || name.includes("comprovante")) return "receipts";
    if (name.includes("rascunho") || name.includes("draft")) return "drafts";
    if (name.includes("thumbnail") || name.includes("miniatura")) return "thumbnails";
    if (name.includes("colaborador") || name.includes("funcionario") || name.includes("equipe")) return "team";
    if (name.includes("cliente") || name.includes("customer")) return "customers";
    if (name.includes("fornecedor") || name.includes("supplier")) return "suppliers";
    if (name.includes("aerografia") || name.includes("airbrush")) return "artwork";
    if (name.includes("pdf")) return "documents";
    if (name.includes("outro") || name === "outros") return "misc";
    if (name.includes("tinta") || name.includes("tintas") || name.includes("paint")) return "paints";
    if (name.includes("mensagem") || name.includes("message") || name.includes("whatsapp") || name.includes("chat")) return "messages";
    if (name.includes("layout") || name.includes("design") || name.includes("arte")) return "layouts";

    return "general";
  };

  const getFolderIcon = (type?: string) => {
    switch (type) {
      case "artwork": return IconPalette;
      case "general": return IconFileText;
      case "backup": return IconArchive;
      case "receipts": return IconFileDescription;
      case "images": return IconCamera;
      case "trash": return IconTrash;
      case "logos": return IconBrandApple;
      case "invoices": return IconFileInvoice;
      case "observations": return IconNotes;
      case "budgets": return IconCalculator;
      case "plotter": return IconPrinter;
      case "projects": return IconBriefcase;
      case "drafts": return IconFileDescription;
      case "thumbnails": return IconPhoto;
      case "team": return IconUsers;
      case "customers": return IconBuildingStore;
      case "suppliers": return IconTruck;
      case "documents": return IconFileText;
      case "misc": return IconFolders;
      case "paints": return IconDroplet;
      case "messages": return IconMessage;
      case "layouts": return IconLayout;
      default: return IconFolder;
    }
  };

  // All main folders use the same color scheme - only icons are different
  const getFolderColor = (_type?: string) => {
    return "text-blue-600 dark:text-blue-400 bg-muted/50";
  };

  // Toolbar JSX - inlined to prevent focus loss on re-render
  const toolbarContent = (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
      {/* Search Input */}
      <div className="relative w-full sm:w-auto sm:min-w-[300px]">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={viewMode === "browse" ? "Buscar arquivos e pastas..." : "Buscar pastas..."}
          value={searchQuery}
          onChange={(value) => setSearchQuery((value as string) || "")}
          className="pl-9"
        />
      </div>

      {/* Stats and View Toggle */}
      <div className="flex items-center gap-3">
        {/* Stats */}
        {totals && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {viewMode === "browse" ? (
              <>
                <Badge variant="outline" className="font-normal">
                  <IconFiles className="h-3 w-3 mr-1" />
                  {totals.files} arquivos
                </Badge>
                <Badge variant="outline" className="font-normal">
                  <IconDeviceDesktop className="h-3 w-3 mr-1" />
                  {totals.size}
                </Badge>
              </>
            ) : (
              <Badge variant="outline" className="font-normal">
                <IconFolders className="h-3 w-3 mr-1" />
                {totals.count} pastas
              </Badge>
            )}
          </div>
        )}

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            variant={fileDisplayMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setFileDisplayMode("list")}
            className="h-8 px-3"
          >
            <IconList className="h-4 w-4" />
          </Button>
          <Button
            variant={fileDisplayMode === "grid" ? "default" : "ghost"}
            size="sm"
            onClick={() => setFileDisplayMode("grid")}
            className="h-8 px-3"
          >
            <IconLayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  // Render folder browser or folder list based on view mode
  if (viewMode === "browse" && selectedFolder) {
    return (
      <FileViewerProvider baseUrl={apiClient.defaults.baseURL}>
        <div className="h-full flex flex-col px-4 pt-4">
          <div className="flex-shrink-0">
            <PageHeader
              title={currentSubPath ? currentSubPath.split("/").pop() || selectedFolder : selectedFolder}
              icon={IconFolder}
              breadcrumbs={getBreadcrumbs()}
              actions={[
                {
                  key: "refresh",
                  label: "Atualizar",
                  icon: IconRefresh,
                  onClick: () => {
                    refetchContents();
                    success("Conteúdo atualizado");
                  },
                  variant: "outline" as const,
                  disabled: isLoadingContents,
                },
              ]}
            />
          </div>

          <Card className="flex-1 flex flex-col min-h-0 mt-4">
            <CardContent className="flex-1 overflow-auto p-4 pb-6">
              {toolbarContent}
              <FileContentsBrowser
                folderContents={folderContents}
                isLoading={isLoadingContents}
                currentSubPath={currentSubPath}
                selectedFolder={selectedFolder || ""}
                fileDisplayMode={fileDisplayMode}
                searchQuery={searchQuery}
                handleNavigateToSubfolder={handleNavigateToSubfolder}
              />
            </CardContent>
          </Card>
        </div>
      </FileViewerProvider>
    );
  }

  // Main folder list view
  return (
    <FileViewerProvider baseUrl={apiClient.defaults.baseURL}>
      <div className="h-full flex flex-col px-4 pt-4">
        <div className="flex-shrink-0">
          <PageHeader
            title="Gerenciador de Arquivos"
            icon={IconFolderShare}
            breadcrumbs={getBreadcrumbs()}
            actions={[
              {
                key: "refresh",
                label: "Atualizar",
                icon: IconRefresh,
                onClick: () => {
                  refetch();
                  success("Pastas atualizadas");
                },
                variant: "outline" as const,
                disabled: isLoading,
              },
            ]}
          />
        </div>

        <Card className="flex-1 flex flex-col min-h-0 mt-4">
          <CardContent className="flex-1 overflow-auto p-4 pb-6">
            {toolbarContent}

            {isLoading ? (
              <div className={fileDisplayMode === "grid" ? "grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4" : "space-y-3"}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    {fileDisplayMode === "grid" ? (
                      <div className="h-[200px] bg-muted rounded-lg"></div>
                    ) : (
                      <div className="flex items-center gap-4 p-4 border border-border rounded-lg">
                        <div className="h-12 w-12 bg-muted rounded-lg"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded w-32"></div>
                          <div className="h-3 bg-muted rounded w-48"></div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : filteredFolders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                {searchQuery ? (
                  <>
                    <IconSearch className="h-16 w-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium">Nenhum resultado</p>
                    <p className="text-sm">Nenhuma pasta corresponde à sua busca.</p>
                  </>
                ) : (
                  <>
                    <IconFolderShare className="h-16 w-16 mb-4 opacity-20" />
                    <p className="text-lg font-medium">Nenhuma pasta encontrada</p>
                    <p className="text-sm">Não há pastas configuradas no gerenciador de arquivos no momento.</p>
                  </>
                )}
              </div>
            ) : fileDisplayMode === "grid" ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                {filteredFolders.map((folder) => {
                  const folderType = deriveFolderType(folder.name, folder.type);
                  const FolderIcon = getFolderIcon(folderType);
                  const colorClass = getFolderColor(folderType);

                  return (
                    <div
                      key={folder.name}
                      className="group relative overflow-hidden transition-all duration-300 rounded-lg hover:shadow-md cursor-pointer border border-border bg-card hover:border-primary/30"
                      onClick={() => handleBrowseFolder(folder.name)}
                    >
                      <div className={`flex items-center justify-center h-32 ${colorClass.split(" ").slice(2).join(" ")}`}>
                        <FolderIcon className={`h-16 w-16 ${colorClass.split(" ").slice(0, 2).join(" ")} transition-transform group-hover:scale-110`} />
                      </div>

                      <div className="p-3 border-t border-border">
                        <h3 className="font-semibold text-sm truncate mb-1" title={folder.name}>{folder.name}</h3>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{folder.fileCount ?? 0} arquivos</span>
                          <span>•</span>
                          <span>{formatFileSize(folder.size)}</span>
                        </div>

                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <IconCalendar className="h-3 w-3" />
                          <span>{new Date(folder.lastModified).toLocaleDateString("pt-BR")}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFolders.map((folder) => {
                  const folderType = deriveFolderType(folder.name, folder.type);
                  const FolderIcon = getFolderIcon(folderType);
                  const colorClass = getFolderColor(folderType);

                  return (
                    <div
                      key={folder.name}
                      className="flex items-center gap-4 p-4 border border-border rounded-lg hover:bg-muted/50 hover:border-primary/30 transition-colors cursor-pointer group"
                      onClick={() => handleBrowseFolder(folder.name)}
                    >
                      <div className={`p-3 rounded-lg ${colorClass}`}>
                        <FolderIcon className="h-6 w-6" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate mb-1">{folder.name}</h3>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <IconFiles className="h-3.5 w-3.5" />
                            {folder.fileCount ?? 0} arquivos
                          </span>
                          <span className="flex items-center gap-1">
                            <IconFolders className="h-3.5 w-3.5" />
                            {folder.subdirCount ?? 0} pastas
                          </span>
                          <span className="flex items-center gap-1">
                            <IconDeviceDesktop className="h-3.5 w-3.5" />
                            {formatFileSize(folder.size)}
                          </span>
                          <span className="flex items-center gap-1">
                            <IconCalendar className="h-3.5 w-3.5" />
                            {new Date(folder.lastModified).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      </div>

                      <IconChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </FileViewerProvider>
  );
}
