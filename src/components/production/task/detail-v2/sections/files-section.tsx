import React, { useState } from "react";
import { IconFile, IconLayoutGrid, IconList } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileItem, useFileViewer, type FileViewMode } from "@/components/common/file";
import type { Task } from "@/types";

/** Element type of `task.baseFiles` / `task.projectFiles` (the `@/types` `File`). */
type TaskFile = NonNullable<Task["baseFiles"]>[number];

/**
 * One file group with a unified toolbar (a `secondary` count badge — matching the Layouts/Dossiê
 * sections — and a grid/list view-mode toggle). The group LABEL ("Arquivos Base" / "Projetos") is
 * only shown when more than one group is present (`showTitle`); with a single group the section card
 * title "Arquivos" already names it, so the sub-label would be redundant.
 */
function FileSubsection({
  title,
  showTitle,
  files,
  onPreview,
  onDownload,
}: {
  title: string;
  showTitle: boolean;
  files: TaskFile[];
  onPreview: (file: TaskFile) => void;
  onDownload: (file: TaskFile) => void;
}) {
  const [viewMode, setViewMode] = useState<FileViewMode>("grid");

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {showTitle && <IconFile className="h-4 w-4 text-muted-foreground" />}
          {showTitle && <h4 className="text-sm font-semibold">{title}</h4>}
          <Badge variant="secondary">{files.length}</Badge>
        </div>
        <div className="flex gap-1">
          <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")} className="h-7 w-7 p-0">
            <IconList className="h-3.5 w-3.5" />
          </Button>
          <Button variant={viewMode === "grid" ? "default" : "outline"} size="sm" onClick={() => setViewMode("grid")} className="h-7 w-7 p-0">
            <IconLayoutGrid className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className={cn(viewMode === "grid" ? "flex flex-wrap gap-3" : "grid grid-cols-1 gap-2")}>
        {files.map((file) => (
          <FileItem key={file.id} file={file} viewMode={viewMode} onPreview={onPreview} onDownload={onDownload} showActions />
        ))}
      </div>
    </div>
  );
}

/**
 * "Arquivos" card body — bare (the host supplies the Card + title).
 * Renders the base-files and project-files subsections, each privilege-gated.
 * Returns null when there are no visible files at all.
 */
export function FilesSection({ task, canViewBase, canViewProject }: { task: Task; canViewBase: boolean; canViewProject: boolean }): React.ReactNode {
  const fileViewer = useFileViewer();

  const baseFiles = canViewBase && task.baseFiles ? task.baseFiles : [];
  const projectFiles = canViewProject && task.projectFiles ? task.projectFiles : [];

  if (baseFiles.length === 0 && projectFiles.length === 0) return null;

  const handleBaseFileClick = (file: TaskFile) => {
    const index = baseFiles.findIndex((f) => f.id === file.id);
    fileViewer.actions.viewFiles(baseFiles, index);
  };

  const handleProjectFileClick = (file: TaskFile) => {
    const index = projectFiles.findIndex((f) => f.id === file.id);
    fileViewer.actions.viewFiles(projectFiles, index);
  };

  const handleDownload = (file: TaskFile) => {
    fileViewer.actions.downloadFile(file);
  };

  const groups = [
    baseFiles.length > 0 ? { key: "base", title: "Arquivos Base", files: baseFiles, onPreview: handleBaseFileClick } : null,
    projectFiles.length > 0 ? { key: "projects", title: "Projetos", files: projectFiles, onPreview: handleProjectFileClick } : null,
  ].filter((g): g is NonNullable<typeof g> => g !== null);
  // Only label the groups when there's more than one — with a single group the "Arquivos" card title
  // already names it, so a "Arquivos Base" sub-label would just be redundant.
  const showTitle = groups.length > 1;

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <FileSubsection key={g.key} title={g.title} showTitle={showTitle} files={g.files} onPreview={g.onPreview} onDownload={handleDownload} />
      ))}
    </div>
  );
}
