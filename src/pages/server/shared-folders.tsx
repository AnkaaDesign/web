import { useAuth } from "@/contexts/auth-context";
import { SECTOR_PRIVILEGES, routes } from "../../constants";
import { hasPrivilege } from "../../utils";
import {
  IconFolderShare,
  IconRefresh,
  IconFolder,
  IconUsers,
  IconEye,
  IconCalendar,
  IconDeviceDesktop,
  IconExternalLink,
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
  IconFileZip,
  IconFolders,
  IconFiles,
  IconArrowRight,
  IconArrowLeft,
  IconChevronRight,
  IconHome,
  IconDownload,
  IconFile,
  IconList,
  IconLayoutGrid,
  IconFileTypePdf,
  IconFileTypeDoc,
  IconFileTypeXls,
  IconFileTypePpt,
  IconFileMusic,
  IconVideo,
  IconFileCode,
} from "@tabler/icons-react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { PageHeader } from "@/components/ui/page-header";
import { useSharedFolders, useSharedFolderContents } from "../../hooks";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/api-client";

export function ServerSharedFoldersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { success } = useToast();

  // Parse the current path from URL
  const pathSegments = location.pathname.replace("/servidor/pastas-compartilhadas", "").split("/").filter(Boolean);
  const selectedFolder = pathSegments[0] || null;
  const currentSubPath = pathSegments.slice(1).join("/") || undefined;
  const viewMode = selectedFolder ? "browse" : "folders";

  const [fileDisplayMode, setFileDisplayMode] = useState<"list" | "grid">("list");

  // Check admin privileges
  const isAdmin = user?.sector?.privileges ? hasPrivilege(user as any, SECTOR_PRIVILEGES.ADMIN) : false;

  // Track page access
  usePageTracker({
    title: "Pastas Compartilhadas",
    icon: "sharedFolders",
  });

  // Fetch shared folders
  const { data: sharedFolders, isLoading, refetch } = useSharedFolders();

  // Fetch folder contents when browsing
  const {
    data: folderContents,
    isLoading: isLoadingContents,
    refetch: refetchContents,
  } = useSharedFolderContents(selectedFolder, currentSubPath, { enabled: viewMode === "browse" && !!selectedFolder });

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin) {
      navigate(routes.home);
    }
  }, [isAdmin, navigate]);

  // Navigation handlers using actual routes
  const handleBrowseFolder = (folderName: string) => {
    navigate(`/servidor/pastas-compartilhadas/${folderName}`);
  };

  const handleNavigateToSubfolder = (subPath: string) => {
    // subPath already contains the full path from the root of the selected folder
    const fullPath = `${selectedFolder}/${subPath}`;
    navigate(`/servidor/pastas-compartilhadas/${fullPath}`);
  };

  const handleNavigateUp = () => {
    if (currentSubPath) {
      const parentPath = currentSubPath.split("/").slice(0, -1).join("/");
      const newPath = parentPath ? `/servidor/pastas-compartilhadas/${selectedFolder}/${parentPath}` : `/servidor/pastas-compartilhadas/${selectedFolder}`;
      navigate(newPath);
    } else if (selectedFolder) {
      navigate("/servidor/pastas-compartilhadas");
    }
  };

  const handleBackToFolders = () => {
    navigate("/servidor/pastas-compartilhadas");
  };

  const formatFileSize = (size: string) => {
    // Size comes as string like "1.2G", "500M", "2.5K"
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

  // Helper functions for file type detection
  const getFileExtension = (filename: string): string => {
    const parts = filename.split(".");
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
  };

  const isImageFile = (filename: string): boolean => {
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico", "tiff", "tif"];
    return imageExtensions.includes(getFileExtension(filename));
  };

  const getFileIcon = (filename: string) => {
    const ext = getFileExtension(filename);

    // Document types
    if (["pdf"].includes(ext)) return IconFileTypePdf;
    if (["doc", "docx", "odt", "rtf"].includes(ext)) return IconFileTypeDoc;
    if (["xls", "xlsx", "ods", "csv"].includes(ext)) return IconFileTypeXls;
    if (["ppt", "pptx", "odp"].includes(ext)) return IconFileTypePpt;

    // Media types
    if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico", "tiff", "tif"].includes(ext)) return IconPhoto;
    if (["mp3", "wav", "ogg", "flac", "aac", "m4a"].includes(ext)) return IconFileMusic;
    if (["mp4", "avi", "mov", "wmv", "flv", "mkv", "webm"].includes(ext)) return IconVideo;

    // Code types
    if (["js", "ts", "jsx", "tsx", "py", "java", "c", "cpp", "cs", "php", "rb", "go", "rs", "swift", "kt", "html", "css", "scss", "json", "xml", "yaml", "yml"].includes(ext))
      return IconFileCode;

    // Archive types
    if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(ext)) return IconFileZip;

    // Default
    return IconFile;
  };

  const getThumbnailUrl = (item: any): string | null => {
    if (item.type !== "file" || !isImageFile(item.name)) return null;

    // If webdavUrl exists, use it as the thumbnail source
    if (item.webdavUrl) {
      return item.webdavUrl;
    }

    return null;
  };

  const getBreadcrumbs = () => {
    const breadcrumbs = [
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
        label: "Pastas Compartilhadas",
        href: routes.server.sharedFolders,
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          // Already on the main page, just refresh if needed
          refetch();
        },
      });
    } else if (selectedFolder) {
      breadcrumbs.push(
        {
          label: "Pastas Compartilhadas",
          href: routes.server.sharedFolders,
          onClick: (e: React.MouseEvent) => {
            e.preventDefault();
            navigate("/servidor/pastas-compartilhadas");
          },
        },
        {
          label: selectedFolder,
          href: `/servidor/pastas-compartilhadas/${selectedFolder}`,
          onClick: (e: React.MouseEvent) => {
            e.preventDefault();
            navigate(`/servidor/pastas-compartilhadas/${selectedFolder}`);
          },
        },
      );

      if (currentSubPath) {
        const pathParts = currentSubPath.split("/");
        let accumulatedPath = selectedFolder;

        pathParts.forEach((part, index) => {
          accumulatedPath += `/${part}`;
          const routePath = `/servidor/pastas-compartilhadas/${accumulatedPath}`;

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

  if (!isAdmin) {
    return null;
  }

  const formatPermissions = (permissions: string) => {
    // Convert numeric permissions like "755" to readable format
    const numericMatch = permissions.match(/^(\d)(\d)(\d)$/);
    if (numericMatch) {
      const [, owner, group, others] = numericMatch;
      const permMap: Record<string, string> = {
        "0": "---",
        "1": "--x",
        "2": "-w-",
        "3": "-wx",
        "4": "r--",
        "5": "r-x",
        "6": "rw-",
        "7": "rwx",
      };

      return `${permMap[owner] || "???"}/${permMap[group] || "???"}/${permMap[others] || "???"}`;
    }

    // If already in readable format, return as is
    return permissions;
  };

  const getPermissionLevel = (permissions: string): "read-only" | "read-write" | "full" | "restricted" => {
    if (permissions.includes("drwxrwsr-x") || permissions.includes("drwxrwxr-x")) {
      return "full";
    } else if (permissions.includes("rw") || permissions.includes("w")) {
      return "read-write";
    } else if (permissions.includes("r")) {
      return "read-only";
    } else {
      return "restricted";
    }
  };

  const getPermissionBadgeVariant = (level: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (level) {
      case "full":
        return "default";
      case "read-write":
        return "secondary";
      case "read-only":
        return "outline";
      case "restricted":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getPermissionDescription = (permissions: string): string => {
    const level = getPermissionLevel(permissions);
    switch (level) {
      case "full":
        return "Acesso completo para proprietário e grupo";
      case "read-write":
        return "Leitura e escrita permitida";
      case "read-only":
        return "Apenas leitura permitida";
      case "restricted":
        return "Acesso restrito";
      default:
        return "Permissões desconhecidas";
    }
  };

  const getFolderIcon = (type?: string) => {
    switch (type) {
      case "artwork":
        return IconPalette;
      case "general":
        return IconFileText;
      case "backup":
        return IconArchive;
      case "receipts":
        return IconFileDescription;
      case "images":
        return IconCamera;
      case "trash":
        return IconTrash;
      case "logos":
        return IconBrandApple;
      case "invoices":
        return IconFileInvoice;
      case "observations":
        return IconNotes;
      case "budgets":
        return IconCalculator;
      case "plotter":
        return IconPrinter;
      case "projects":
        return IconBriefcase;
      case "drafts":
        return IconFileDescription;
      case "thumbnails":
        return IconPhoto;
      default:
        return IconFolder;
    }
  };

  const getFolderColor = (type?: string) => {
    switch (type) {
      case "artwork":
        return "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900";
      case "general":
        return "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900";
      case "backup":
        return "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900";
      case "receipts":
        return "text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900";
      case "images":
        return "text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-900";
      case "trash":
        return "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900";
      case "logos":
        return "text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900";
      case "invoices":
        return "text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900";
      case "observations":
        return "text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-900";
      case "budgets":
        return "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900";
      case "plotter":
        return "text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900";
      case "projects":
        return "text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900";
      case "drafts":
        return "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900";
      case "thumbnails":
        return "text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900";
      default:
        return "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900";
    }
  };

  // Render folder browser or folder list based on view mode
  if (viewMode === "browse" && selectedFolder) {
    return (
      <div className="flex flex-col h-full space-y-4">
        {/* Fixed Header */}
        <div className="flex-shrink-0">
          <PageHeader
            title={`Navegando: ${selectedFolder}`}
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

        {/* Browser Content */}
        <Card className="flex-1 flex flex-col min-h-0">
          <CardContent className="flex-1 overflow-auto p-6 space-y-4">
            {/* Navigation Controls - removed redundant section since breadcrumbs handle navigation */}

            {/* Folder Contents */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-xl">Conteúdo da pasta</CardTitle>
                  <div className="flex items-center gap-4">
                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                      <Button variant={fileDisplayMode === "list" ? "default" : "ghost"} size="sm" onClick={() => setFileDisplayMode("list")} className="h-8 px-3">
                        <IconList className="h-4 w-4" />
                        <span className="ml-2 hidden sm:inline">Lista</span>
                      </Button>
                      <Button variant={fileDisplayMode === "grid" ? "default" : "ghost"} size="sm" onClick={() => setFileDisplayMode("grid")} className="h-8 px-3">
                        <IconLayoutGrid className="h-4 w-4" />
                        <span className="ml-2 hidden sm:inline">Grade</span>
                      </Button>
                    </div>

                    {folderContents?.data && (
                      <div className="flex gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline">
                          <IconFiles className="h-3 w-3 mr-1" />
                          {folderContents.data.totalFiles} arquivos
                        </Badge>
                        <Badge variant="outline">
                          <IconDeviceDesktop className="h-3 w-3 mr-1" />
                          {folderContents.data.totalSize}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingContents ? (
                  <div className="space-y-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="animate-pulse flex items-center gap-3 p-3 border rounded">
                        <div className="h-8 w-8 bg-gray-200 rounded"></div>
                        <div className="flex-1 space-y-1">
                          <div className="h-4 bg-gray-200 rounded w-48"></div>
                          <div className="h-3 bg-gray-200 rounded w-24"></div>
                        </div>
                        <div className="h-3 bg-gray-200 rounded w-16"></div>
                      </div>
                    ))}
                  </div>
                ) : folderContents?.data?.files && folderContents.data.files.length > 0 ? (
                  fileDisplayMode === "list" ? (
                    // List View
                    <div className="space-y-2">
                      {folderContents.data.files.map((item) => (
                        <div
                          key={item.name}
                          className={`flex items-center gap-3 p-3 border rounded hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors ${
                            item.type === "directory" ? "cursor-pointer" : ""
                          }`}
                          onClick={
                            item.type === "directory"
                              ? () => {
                                  const newPath = currentSubPath ? `${currentSubPath}/${item.name}` : item.name;
                                  handleNavigateToSubfolder(newPath);
                                }
                              : undefined
                          }
                        >
                          <div className="flex-shrink-0">
                            {item.type === "directory" ? (
                              <IconFolder className="h-6 w-6 text-blue-600" />
                            ) : (
                              (() => {
                                const FileIcon = getFileIcon(item.name);
                                return <FileIcon className="h-6 w-6 text-gray-600" />;
                              })()
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{item.name}</span>
                              {item.type === "directory" && <IconChevronRight className="h-4 w-4 text-muted-foreground" />}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{formatFileSize(item.size)}</span>
                              <span>{new Date(item.lastModified).toLocaleDateString("pt-BR")}</span>
                            </div>
                          </div>

                          {item.webdavUrl && (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(item.webdavUrl, "_blank");
                              }}
                              variant="ghost"
                              size="sm"
                            >
                              <IconDownload className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Grid View
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {folderContents.data.files.map((item) => (
                        <div
                          key={item.name}
                          className={`group border rounded-lg p-4 flex flex-col items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-all hover:shadow-md ${
                            item.type === "directory" ? "cursor-pointer" : ""
                          }`}
                          onClick={
                            item.type === "directory"
                              ? () => {
                                  const newPath = currentSubPath ? `${currentSubPath}/${item.name}` : item.name;
                                  handleNavigateToSubfolder(newPath);
                                }
                              : undefined
                          }
                        >
                          <div className="relative">
                            {item.type === "directory" ? (
                              <IconFolder className="h-12 w-12 text-blue-600" />
                            ) : (
                              (() => {
                                const thumbnailUrl = getThumbnailUrl(item);
                                if (thumbnailUrl) {
                                  // Show image thumbnail
                                  return (
                                    <div className="h-16 w-16 relative overflow-hidden rounded-lg border">
                                      <img
                                        src={thumbnailUrl}
                                        alt={item.name}
                                        className="h-full w-full object-cover"
                                        onError={(e) => {
                                          // Fallback to icon if image fails to load
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = "none";
                                          const parent = target.parentElement;
                                          if (parent) {
                                            const icon = document.createElement("div");
                                            icon.innerHTML =
                                              '<svg class="h-12 w-12 text-gray-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
                                            parent.appendChild(icon.firstChild as Node);
                                          }
                                        }}
                                      />
                                    </div>
                                  );
                                } else {
                                  // Show file type icon
                                  const FileIcon = getFileIcon(item.name);
                                  return <FileIcon className="h-12 w-12 text-gray-600" />;
                                }
                              })()
                            )}
                            {item.webdavUrl && (
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(item.webdavUrl, "_blank");
                                }}
                                variant="ghost"
                                size="icon"
                                className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <IconDownload className="h-3 w-3" />
                              </Button>
                            )}
                          </div>

                          <div className="text-center w-full">
                            <p className="text-xs font-medium truncate" title={item.name}>
                              {item.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">{formatFileSize(item.size)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="text-center py-12">
                    <IconFolder className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-muted-foreground mb-2">Pasta vazia</h3>
                    <p className="text-sm text-muted-foreground">Esta pasta não contém nenhum arquivo ou subpasta.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main folder list view
  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <PageHeader
          title="Pastas Compartilhadas"
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

      {/* Content Card */}
      <Card className="flex-1 flex flex-col min-h-0">
        <CardContent className="flex-1 overflow-auto p-6 space-y-4">
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="animate-pulse flex justify-between items-center p-4 border rounded">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-gray-200 rounded"></div>
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-32"></div>
                          <div className="h-3 bg-gray-200 rounded w-48"></div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-20"></div>
                        <div className="h-3 bg-gray-200 rounded w-16"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {sharedFolders?.data?.map((folder) => {
                    const FolderIcon = getFolderIcon(folder.type);
                    const colorClass = getFolderColor(folder.type);

                    return (
                      <div key={folder.name} className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors relative">
                        <div className="flex justify-between items-start">
                          <div className="flex items-start space-x-4 flex-1">
                            {/* Folder Icon */}
                            <div className={`p-3 rounded-lg ${colorClass}`}>
                              <FolderIcon className="h-6 w-6" />
                            </div>

                            {/* Folder Details */}
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-3">
                                <h3 className="text-lg font-semibold text-secondary-foreground">{folder.name}</h3>
                                {folder.type && (
                                  <Badge variant="outline" className="text-xs">
                                    {folder.type}
                                  </Badge>
                                )}
                              </div>

                              {/* Description */}
                              {folder.description && <p className="text-sm text-muted-foreground italic">{folder.description}</p>}

                              {/* Enhanced Statistics */}
                              <div className="flex gap-4 my-2">
                                <Badge variant="secondary">
                                  <IconFiles className="h-3 w-3 mr-1" />
                                  {folder.fileCount ?? 0} arquivos
                                </Badge>
                                <Badge variant="secondary">
                                  <IconFolders className="h-3 w-3 mr-1" />
                                  {folder.subdirCount ?? 0} pastas
                                </Badge>
                                <Badge variant="secondary">
                                  <IconDeviceDesktop className="h-3 w-3 mr-1" />
                                  {formatFileSize(folder.size)}
                                </Badge>
                              </div>

                              {/* Modification Date - below folder info */}
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <IconCalendar className="h-4 w-4" />
                                <span className="font-medium">Modificado:</span>
                                <span>{new Date(folder.lastModified).toLocaleString("pt-BR")}</span>
                              </div>

                              <div className="text-sm text-muted-foreground space-y-1 pb-12">
                                <div className="flex items-center gap-2">
                                  <IconEye className="h-4 w-4" />
                                  <span>Caminho: {folder.path}</span>
                                </div>

                                {/* WebDAV URL */}
                                {folder.webdavPath && (
                                  <div className="flex items-center gap-2">
                                    <IconExternalLink className="h-4 w-4" />
                                    <span>WebDAV: </span>
                                    <a href={folder.webdavPath} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline truncate">
                                      {folder.webdavPath}
                                    </a>
                                  </div>
                                )}

                                <div className="flex items-center gap-6 mt-3">
                                  <div className="flex items-center gap-2">
                                    <IconUsers className="h-4 w-4" />
                                    <span className="font-medium">Proprietário:</span>
                                    <Badge variant="outline">{folder.owner}</Badge>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <IconUsers className="h-4 w-4" />
                                    <span className="font-medium">Grupo:</span>
                                    <Badge variant="outline">{folder.group}</Badge>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Permissions */}
                          <div className="ml-4 space-y-2 min-w-[180px]">
                            <div className="text-right space-y-2">
                              <div className="text-xs text-muted-foreground mb-1">Permissões</div>

                              {/* Permission Level Badge */}
                              <Badge className="text-xs block w-full justify-center" variant={getPermissionBadgeVariant(getPermissionLevel(folder.permissions))}>
                                {getPermissionLevel(folder.permissions).toUpperCase()}
                              </Badge>

                              {/* Raw Permissions */}
                              <Badge className="font-mono text-xs block w-full justify-center" variant="outline">
                                {formatPermissions(folder.permissions)}
                              </Badge>

                              {/* Permission Description */}
                              <p className="text-xs text-muted-foreground text-center">{getPermissionDescription(folder.permissions)}</p>
                            </div>
                          </div>
                        </div>

                        {/* Navegar Button - Bottom Right */}
                        <div className="absolute bottom-4 right-4">
                          <Button onClick={() => handleBrowseFolder(folder.name)} variant="outline" size="sm">
                            <IconArrowRight className="h-4 w-4 mr-2" />
                            Navegar
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  {(!sharedFolders?.data || sharedFolders.data.length === 0) && !isLoading && (
                    <div className="text-center py-12">
                      <IconFolderShare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-muted-foreground mb-2">Nenhuma pasta WebDAV encontrada</h3>
                      <p className="text-sm text-muted-foreground">
                        Não há pastas WebDAV configuradas no diretório /srv/samba/shares no momento.
                        <br />
                        Verifique se o serviço de compartilhamento de arquivos está ativo.
                      </p>
                    </div>
                  )}
                </div>
              )}
        </CardContent>
      </Card>
    </div>
  );
}
